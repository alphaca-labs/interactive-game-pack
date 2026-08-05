#!/usr/bin/env node
/**
 * 카드 썸네일 생성 — assets/thumbs/game-0N.jpg.
 *
 * 허브 카드에 올라가는 건 목업이 아니라 우리 데모의 실제 플레이 화면이다. 그래서 촬영도
 * 실제 Chrome 으로 한다. 시작 화면이 아니라 "플레이 중" 을 담아야 하므로, 시작 버튼을
 * 라벨로 찾아 누른 뒤(위치가 타이틀마다 다르다) 잠깐 진행시키고 찍는다.
 *
 * 결과물이 곧 배포 자산이라 용량을 묶어 둔다 — 390×844@2x 로 찍고 긴 변 780 JPEG 로 줄여
 * 8장 합계 0.5MB 아래를 유지한다(줄이지 않으면 2MB 를 넘는다).
 *
 * macOS 전용 의존: Google Chrome, sips. npm 의존성은 없다.
 * 사용: node scripts/capture-thumbs.mjs
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, dirname, resolve, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CDP_PORT = 9388;
const OUT_DIR = join(root, "assets", "thumbs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
};

// ── 촬영 대상은 games.json 하나에서만 읽는다 (app.js 와의 일치는 check-hub.mjs 가 본다) ──
const games = JSON.parse(readFileSync(join(root, "games.json"), "utf8")).games;

const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  let file = join(root, rel);
  if (!file.startsWith(root)) return void res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const profile = mkdtempSync(join(tmpdir(), "thumb-chrome-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=390,844",
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function devtools(path) {
  for (let i = 0; i < 80; i++) {
    try {
      return await (await fetch(`http://127.0.0.1:${CDP_PORT}${path}`)).json();
    } catch {
      await sleep(250);
    }
  }
  throw new Error("Chrome DevTools 엔드포인트에 연결하지 못했습니다.");
}

const page = (await devtools("/json/list")).find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
};
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++msgId;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

mkdirSync(OUT_DIR, { recursive: true });

for (const game of games) {
  await send("Page.navigate", { url: `${origin}/games/${game.dir}/index.html` });
  await sleep(2200);

  // 시작 버튼은 타이틀마다 위치가 달라 좌표가 아니라 라벨로 찾는다.
  await send("Runtime.evaluate", {
    expression: `(() => {
      const start = [...document.querySelectorAll('button')].find(
        (b) => !b.disabled && b.offsetParent && /시작|플레이|장사|START|PLAY/i.test(b.textContent || '')
      );
      if (start) start.click();
    })()`,
  });
  await sleep(500);

  // "첫 입력이 곧 시작" 인 타이틀(윈터 팬트리 등)을 위한 보조 동작.
  for (const type of ["mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", { type, x: 195, y: 470, button: "left", clickCount: 1 });
  }
  await sleep(1700);

  const raw = join(profile, `${game.dir}.png`);
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(raw, Buffer.from(data, "base64"));

  await new Promise((res, rej) => {
    const p = spawn(
      "sips",
      ["-Z", "780", "-s", "format", "jpeg", "-s", "formatOptions", "78", raw, "--out", join(OUT_DIR, `${game.dir}.jpg`)],
      { stdio: "ignore" },
    );
    p.on("exit", (code) => (code === 0 ? res() : rej(new Error(`sips 실패: ${game.dir}`))));
  });

  const size = statSync(join(OUT_DIR, `${game.dir}.jpg`)).size;
  console.log(`  ${game.dir}.jpg  ${(size / 1024).toFixed(0)}KB`);
}

ws.close();
chrome.kill();
server.close();
console.log(`\n${games.length}장 생성 완료 → assets/thumbs/`);
