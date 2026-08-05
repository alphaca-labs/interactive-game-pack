#!/usr/bin/env node
/**
 * 팩 전체 실브라우저 검증 — 실제 Google Chrome + CDP. 추가 의존성 없음.
 *
 * 정적 서버를 띄우고(Pages 와 같은 http 조건) 허브 → 8개 진입점을 차례로 열어
 * ① 허브가 8개 카드를 렌더하는가 ② 각 링크가 200 으로 열리고 게임이 실제로 부팅하는가
 * ③ 콘솔 오류 0건 ④ 외부(origin 밖) 네트워크 요청 0건 을 확인한다.
 *
 * 사용: node scripts/verify-pack.mjs [--base /prefix] [--url http://host]
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync, mkdtempSync } from "node:fs";
import { join, dirname, resolve, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CDP_PORT = 9377;
const HTTP_PORT = 8477;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : null;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
};

let server = null;
let origin = argUrl;

if (!origin) {
  server = createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    let file = join(root, normalize(urlPath).replace(/^(\.\.[/\\])+/, ""));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(HTTP_PORT, "127.0.0.1", r));
  origin = `http://127.0.0.1:${HTTP_PORT}`;
}

const profile = mkdtempSync(join(tmpdir(), "pack-chrome-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--window-size=390,844",
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function cdpJson(path) {
  for (let i = 0; i < 80; i++) {
    try {
      return await (await fetch(`http://127.0.0.1:${CDP_PORT}${path}`)).json();
    } catch {
      await sleep(250);
    }
  }
  throw new Error("Chrome DevTools endpoint unreachable");
}

const target = (await cdpJson("/json/list")).find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let msgId = 0;
const pending = new Map();
let consoleErrors = [];
let failedRequests = [];
let externalRequests = [];

ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve: r, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : r(m.result);
    return;
  }
  if (m.method === "Runtime.exceptionThrown") {
    consoleErrors.push(m.params.exceptionDetails.text + " " + (m.params.exceptionDetails.exception?.description ?? ""));
  }
  if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) {
    consoleErrors.push(m.params.type + ": " + m.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
  }
  if (m.method === "Network.requestWillBeSent") {
    const url = m.params.request.url;
    if (!url.startsWith(origin) && !url.startsWith("data:") && !url.startsWith("blob:")) externalRequests.push(url);
  }
  if (m.method === "Network.loadingFailed") failedRequests.push(m.params.errorText);
};

function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};

async function goto(url) {
  consoleErrors = [];
  failedRequests = [];
  externalRequests = [];
  await send("Page.navigate", { url });
  for (let i = 0; i < 60; i++) {
    await sleep(200);
    if ((await evaluate("document.readyState")) === "complete") break;
  }
  await sleep(500);
}

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");

const checks = [];
const failures = [];
const expect = (cond, label) => (cond ? checks : failures).push(label);

// ── 허브 ────────────────────────────────────────────────
await goto(`${origin}/index.html`);
const hub = await evaluate(`(() => ({
  cards: document.querySelectorAll('#game-grid .card').length,
  links: [...document.querySelectorAll('#game-grid .card__link')].map(a => a.getAttribute('href')),
  titles: [...document.querySelectorAll('.card__title')].map(h => h.firstChild.textContent.trim()),
  ctas: [...document.querySelectorAll('.card__cta')].every(n => n.getBoundingClientRect().height >= 44),
  rows: document.querySelectorAll('#estimate-body tr').length,
  overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  title: document.title,
}))()`);

expect(hub.cards === 8, `허브 카드 8개 (실제 ${hub.cards})`);
expect(hub.rows === 4, `견적 표 유형 4행 (실제 ${hub.rows})`);
expect(hub.ctas, "모든 CTA 높이 ≥ 44px");
expect(!hub.overflow, "허브 390px 가로 넘침 없음");
expect(consoleErrors.length === 0, `허브 콘솔 오류·경고 0건${consoleErrors.length ? " → " + consoleErrors.join(" | ") : ""}`);
expect(externalRequests.length === 0, `허브 외부 요청 0건${externalRequests.length ? " → " + externalRequests.join(" | ") : ""}`);
expect(failedRequests.length === 0, `허브 실패 요청 0건${failedRequests.length ? " → " + failedRequests.join(" | ") : ""}`);

// 카드 썸네일. 404 는 loadingFailed 를 내지 않으므로(응답 자체는 정상 완료다) 실패 요청 검사로는 안 잡힌다.
// lazy 이미지는 화면 밖이면 complete=false 라 그냥 세면 놓친다 → eager 로 바꾸고 기다린 뒤 판정한다.
await evaluate(`[...document.images].forEach((i) => { i.loading = 'eager'; })`);
await sleep(1200);
const shots = await evaluate(`(() => {
  const imgs = [...document.querySelectorAll('#game-grid .card__shot')];
  return { total: imgs.length, broken: imgs.filter((i) => i.naturalWidth === 0).map((i) => i.getAttribute('src')) };
})()`);
expect(shots.total === 8, `카드 썸네일 8장 렌더 (실제 ${shots.total})`);
expect(shots.broken.length === 0, `카드 썸네일 깨짐 0건${shots.broken.length ? " → " + shots.broken.join(" | ") : ""}`);

// 필터 동작
const filtered = await evaluate(`(() => {
  document.querySelector('[data-filter="six-second"]').click();
  const visible = [...document.querySelectorAll('#game-grid .card')].filter(c => !c.hidden).length;
  document.querySelector('[data-filter="all"]').click();
  const back = [...document.querySelectorAll('#game-grid .card')].filter(c => !c.hidden).length;
  return { visible, back };
})()`);
expect(filtered.visible === 4, `6초 구간 필터 = 4종 (실제 ${filtered.visible})`);
expect(filtered.back === 8, `전체 복귀 = 8종 (실제 ${filtered.back})`);

// 1440px 데스크톱
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(300);
const wide = await evaluate("document.documentElement.scrollWidth > window.innerWidth + 1");
expect(!wide, "허브 1440px 가로 넘침 없음");
await send("Emulation.clearDeviceMetricsOverride");

// ── 8개 진입점 ──────────────────────────────────────────
for (const href of hub.links) {
  const name = href.split("/")[1];
  await goto(`${origin}/${href}`);
  const state = await evaluate(`(() => ({
    title: document.title,
    body: document.body ? document.body.innerText.trim().length : 0,
    nodes: document.body ? document.body.querySelectorAll('*').length : 0,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  }))()`);

  expect(state.nodes > 30, `${name}: DOM 렌더 (노드 ${state.nodes})`);
  expect(state.body > 20, `${name}: 화면 텍스트 출력 (${state.body}자)`);
  expect(!!state.title, `${name}: 문서 제목 존재 — ${state.title}`);
  expect(!state.overflow, `${name}: 390px 가로 넘침 없음`);
  expect(consoleErrors.length === 0, `${name}: 콘솔 오류·경고 0건${consoleErrors.length ? " → " + consoleErrors.slice(0, 3).join(" | ") : ""}`);
  expect(externalRequests.length === 0, `${name}: 외부 요청 0건${externalRequests.length ? " → " + externalRequests.join(" | ") : ""}`);
  expect(failedRequests.length === 0, `${name}: 실패 요청 0건${failedRequests.length ? " → " + failedRequests.join(" | ") : ""}`);
}

// ── 허브 복귀 동선 ──────────────────────────────────────
// 8종은 각자 독립 실행되지만, 팩으로 묶인 이상 "다른 데모 보기" 는 허브로 돌아와야 한다.
// 링크가 <a href> 인 타이틀과 JS 로 이동하는 타이틀이 섞여 있어, 실제로 눌러 보고 착지 경로를 본다.
// (game-01 이 실제로 이동하지 않고 안내 문구만 띄우던 것을 이 검사로 잡았다.)
for (const href of hub.links) {
  const name = href.split("/")[1];
  await goto(`${origin}/${href}`);
  const clicked = await evaluate(`(() => {
    const hit = [...document.querySelectorAll('a, button')].find((e) => /다른 (데모|게임)|둘러보기/.test(e.textContent || ''));
    if (!hit) return false;
    hit.hidden = false;
    hit.disabled = false;
    const wrap = hit.closest('[hidden]');
    if (wrap) wrap.hidden = false;
    hit.click();
    return true;
  })()`);
  expect(clicked, `${name}: 허브로 돌아가는 링크 존재`);
  if (!clicked) continue;
  await sleep(1200);
  const landed = await evaluate("location.pathname");
  expect(landed === "/index.html" || landed === "/", `${name}: 허브로 복귀 (착지 ${landed})`);
}

for (const label of checks) console.log(`  ok  ${label}`);
for (const label of failures) console.error(`FAIL  ${label}`);
console.log(`\n${checks.length} passed, ${failures.length} failed  (origin ${origin})`);

ws.close();
chrome.kill();
server?.close();
process.exit(failures.length ? 1 : 0);
