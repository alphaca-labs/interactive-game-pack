// 키친 타이디(항목 07) 브라우저 검증 — 실제 Chrome + CDP 입력. 추가 의존성 없음.
// 사용: node outputs/verify-kitchen-tidy.mjs file:///.../games/game-07/index.html
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const GAME_URL = process.argv[2];
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9345;
const profile = mkdtempSync(join(tmpdir(), 'kt-chrome-'));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--allow-file-access-from-files', '--window-size=390,844', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(path) {
  for (let i = 0; i < 60; i++) {
    try { return await (await fetch(`http://127.0.0.1:${PORT}${path}`)).json(); }
    catch { await sleep(250); }
  }
  throw new Error('Chrome DevTools endpoint unreachable');
}

const targets = await fetchJson('/json/list');
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0;
const pending = new Map();
let consoleErrors = [];
let requests = [];

ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    return;
  }
  if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) {
    consoleErrors.push(`${m.params.entry.level}: ${m.params.entry.text}`);
  }
  if (m.method === 'Runtime.exceptionThrown') {
    consoleErrors.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  }
  if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
};

// 페이지가 예기치 않게 이동하면 실행 컨텍스트와 함께 응답이 사라진다 → 무한 대기 방지.
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++msgId;
  const timer = setTimeout(() => {
    if (pending.has(id)) { pending.delete(id); rej(new Error(`CDP timeout: ${method}`)); }
  }, 15000);
  pending.set(id, { res: (v) => { clearTimeout(timer); res(v); }, rej: (e) => { clearTimeout(timer); rej(e); } });
  ws.send(JSON.stringify({ id, method, params }));
});

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
  return r.result.value;
};

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); };

async function setViewport(w, h, mobile = true) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
}

async function nav(url) {
  consoleErrors = [];
  requests = [];
  await send('Page.navigate', { url });
  await sleep(700);
}

async function centerOf(sel) {
  return evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  })()`);
}

async function clickSel(sel) {
  const c = await centerOf(sel);
  if (!c) throw new Error('no element for ' + sel);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', {
      type, x: c.x, y: c.y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0,
    });
  }
  await sleep(30);
  return c;
}

// 라운드가 끝나면 결과 오버레이가 화면을 덮으므로, 그 위를 계속 클릭하면
// '다른 데모 보기' 링크를 눌러 페이지가 이동해 버린다. 종료되면 즉시 멈춘다.
async function playThrough() {
  for (let guard = 0; guard < 40; guard++) {
    const next = await evaluate(`(() => {
      const S = window.KitchenTidy.getState();
      if (S.phase !== 'playing') return null;
      const floor = S.tools.filter(t => t.status === 'floor');
      if (!floor.length) return null;
      const inBasket = S.basket.map(id => S.tools.find(t => t.id === id).typeId);
      const pick = floor.find(t => inBasket.indexOf(t.typeId) !== -1) || floor[0];
      return pick.id;
    })()`);
    if (!next) return;
    await clickSel('#tool-' + next);
  }
}

async function key(code, keyName, opts = {}) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: opts.vk || 0, text: opts.text });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: opts.vk || 0 });
  await sleep(40);
}

await send('Log.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Page.enable');

/* ============ A. 인게임 자동 검증 (?test=1) ============ */
await setViewport(390, 844);
await nav(GAME_URL + '?test=1');
await sleep(900);
const suite = await evaluate('window.__ktTest');
check('인게임 자동 검증 전부 통과', suite && suite.failed === 0,
  suite ? `${suite.passed}/${suite.total}` + (suite.failed ? ' 실패: ' + suite.results.filter(r => !r.pass).map(r => r.name).join(', ') : '') : 'no result');
check('자동 검증 중 콘솔 오류 0건', consoleErrors.length === 0, consoleErrors.join(' | '));

/* ============ B. 독립 실행 · 외부 요청 ============ */
await nav(GAME_URL + '?seed=e2e');
const external = requests.filter((u) => !u.startsWith('file://') && !u.startsWith('data:'));
check('외부 네트워크 요청 0건', external.length === 0, external.join(', '));
check('로컬 파일 3개만 로드', requests.filter(u => u.startsWith('file://')).length <= 3, String(requests.length));

/* ============ C. 시작 화면 ============ */
check('시작 오버레이 표시', await evaluate('!document.getElementById("start").hidden'));
check('시작 시 본문 aria-hidden', await evaluate('document.getElementById("app").getAttribute("aria-hidden") === "true"'));
check('시작 제목에 포커스', await evaluate('document.activeElement && document.activeElement.id === "startTitle"'));

await clickSel('#startBtn');
await sleep(300);

/* ============ D. 라운드 생성 불변식 (실제 렌더) ============ */
const gen = await evaluate(`(() => {
  const S = window.KitchenTidy.getState();
  const els = [...document.querySelectorAll('.tool')];
  const rects = els.map(e => e.getBoundingClientRect());
  let overlap = 0, small = 0;
  for (let i = 0; i < rects.length; i++) {
    if (rects[i].width < 43.5 || rects[i].height < 43.5) small++;
    for (let j = i + 1; j < rects.length; j++) {
      const A = rects[i], B = rects[j];
      if (A.left < B.right - 0.5 && B.left < A.right - 0.5 && A.top < B.bottom - 0.5 && B.top < A.bottom - 0.5) overlap++;
    }
  }
  const tally = {};
  S.tools.forEach(t => tally[t.typeId] = (tally[t.typeId] || 0) + 1);
  return {
    tools: S.tools.length, els: els.length, types: Object.keys(tally).length,
    perType: [...new Set(Object.values(tally))], overlap, small,
    labelled: els.every(e => /행 \\d열$/.test(e.getAttribute('aria-label') || '')),
    phase: S.phase, seed: S.seedLabel,
    scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
})()`);
check('도구 24개 생성·렌더', gen.tools === 24 && gen.els === 24, JSON.stringify(gen));
check('8종 × 3개', gen.types === 8 && gen.perType.length === 1 && gen.perType[0] === 3, JSON.stringify(gen.perType));
check('hit area 44px 이상', gen.small === 0, `미달 ${gen.small}개`);
check('hit area 비중첩', gen.overlap === 0, `중첩 ${gen.overlap}쌍`);
check('접근성 이름에 종류+논리 위치', gen.labelled === true);
check('플레이 진입', gen.phase === 'playing');
check('가로 스크롤 없음(390×844)', gen.scrollX <= 1, String(gen.scrollX));

/* ============ E. 실제 클릭 — 수집·연타·트리플·콤보 ============ */
const groups = await evaluate(`(() => {
  const S = window.KitchenTidy.getState();
  const g = {};
  S.tools.forEach(t => (g[t.typeId] = g[t.typeId] || []).push(t.id));
  return g;
})()`);
const types = Object.keys(groups);

await clickSel('#tool-' + groups[types[0]][0]);
const afterOne = await evaluate('({b: window.KitchenTidy.getState().basket.length, sum: document.getElementById("basketSummary").textContent})');
check('클릭 1회 → 바구니 1개', afterOne.b === 1, JSON.stringify(afterOne));
check('바구니 텍스트 요약 갱신', /총 1\/7/.test(afterOne.sum), afterOne.sum);

// 같은 버튼 연타(빠른 3연속 클릭)
const c = await centerOf('#tool-' + groups[types[0]][1]);
for (let i = 0; i < 3; i++) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1, buttons: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'left', clickCount: 1, buttons: 0 });
}
await sleep(120);
check('연타해도 1회만 처리', await evaluate('window.KitchenTidy.getState().basket.length === 2'));

await clickSel('#tool-' + groups[types[0]][2]);
const t1 = await evaluate(`({ score: window.KitchenTidy.getState().score, sets: window.KitchenTidy.getState().clearedSets,
  basket: window.KitchenTidy.getState().basket.length, hud: document.getElementById("scoreValue").textContent,
  sets2: document.getElementById("setsValue").textContent, status: document.getElementById("status").textContent })`);
check('트리플 → 100점·진행 1·바구니 비움', t1.score === 100 && t1.sets === 1 && t1.basket === 0, JSON.stringify(t1));
check('HUD 반영', t1.hud === '100' && t1.sets2 === '1', JSON.stringify(t1));
check('상태 문구 안내', /정리! \+100점/.test(t1.status), t1.status);

// 4초 안에 두 번째 트리플 → 콤보 +25
for (const id of groups[types[1]]) await clickSel('#tool-' + id);
const t2 = await evaluate('({score: window.KitchenTidy.getState().score, step: window.KitchenTidy.getState().comboStep})');
check('4초 내 연속 트리플 콤보 +25', t2.score === 225 && t2.step === 1, JSON.stringify(t2));

/* ============ F. 키보드 완주 동등성 ============ */
// 남은 6종을 키보드(포커스 + Enter/Space)만으로 처리
const rest = types.slice(2);
let kbOk = true;
for (const ty of rest) {
  for (const id of groups[ty]) {
    await evaluate(`document.getElementById("tool-${id}").focus()`);
    const okFocus = await evaluate(`document.activeElement.id === "tool-${id}"`);
    if (!okFocus) { kbOk = false; break; }
    await key('Enter', 'Enter', { vk: 13, text: '\r' });
  }
}
const won = await evaluate(`({
  phase: window.KitchenTidy.getState().phase,
  sets: window.KitchenTidy.getState().clearedSets,
  resultShown: !document.getElementById("result").hidden,
  title: document.getElementById("resultTitle").textContent,
  score: document.getElementById("rScore").textContent,
  rsets: document.getElementById("rSets").textContent,
  focus: document.activeElement.id,
  brk: document.getElementById("rBreak").textContent
})`);
check('키보드 Enter 로 도구 선택 가능', kbOk);
check('8세트 완주 → 성공 결과', won.phase === 'won' && won.sets === 8 && won.resultShown, JSON.stringify(won));
check('성공 제목·8/8', /깨끗해졌어요/.test(won.title) && won.rsets === '8 / 8', JSON.stringify(won));
check('결과 제목으로 포커스 이동', won.focus === 'resultTitle', won.focus);
check('시간 보너스 표기', /시간 보너스 \+\d+/.test(won.brk), won.brk);
check('완주 시 콘솔 오류 0건', consoleErrors.length === 0, consoleErrors.join(' | '));

/* ============ G. 재시작 초기화 ============ */
await clickSel('#replayBtn');
await sleep(250);
const replay = await evaluate(`(() => {
  const S = window.KitchenTidy.getState();
  return { score: S.score, sets: S.clearedSets, basket: S.basket.length, phase: S.phase,
    tools: document.querySelectorAll('.tool:not(.gone)').length,
    time: document.getElementById('timeValue').textContent,
    hidden: document.getElementById('result').hidden,
    ariaHidden: document.getElementById('app').getAttribute('aria-hidden') };
})()`);
check('재시작 → 0점·빈 바구니·24개·35초', replay.score === 0 && replay.sets === 0 && replay.basket === 0
  && replay.tools === 24 && Number(replay.time) >= 34, JSON.stringify(replay));
check('재시작 후 결과 오버레이 닫힘·본문 복구', replay.hidden === true && replay.ariaHidden === null, JSON.stringify(replay));

/* ============ H. 경계 판정 — 7번째가 트리플이면 실패 아님 ============ */
const g2 = await evaluate(`(() => { const S = window.KitchenTidy.getState(); const g = {};
  S.tools.forEach(t => (g[t.typeId] = g[t.typeId] || []).push(t.id)); return g; })()`);
const ty2 = Object.keys(g2);
for (let i = 0; i < 4; i++) await clickSel('#tool-' + g2[ty2[i]][0]);     // 비매칭 4개
await clickSel('#tool-' + g2[ty2[4]][0]);
await clickSel('#tool-' + g2[ty2[4]][1]);                                  // 6개
const before7 = await evaluate('window.KitchenTidy.getState().basket.length');
await clickSel('#tool-' + g2[ty2[4]][2]);                                  // 7번째 = 트리플
const edge = await evaluate('({phase: window.KitchenTidy.getState().phase, basket: window.KitchenTidy.getState().basket.length, sets: window.KitchenTidy.getState().clearedSets})');
check('실패 직전 바구니 6개', before7 === 6, String(before7));
check('7번째가 트리플이면 실패하지 않음', edge.phase === 'playing' && edge.basket === 4 && edge.sets === 1, JSON.stringify(edge));

/* ============ I. 바구니 가득 참 실패 ============ */
for (let i = 5; i < 8; i++) await clickSel('#tool-' + g2[ty2[i]][0]);      // 5,6,7번째 비매칭
const lost = await evaluate(`({ phase: window.KitchenTidy.getState().phase,
  shown: !document.getElementById('result').hidden,
  title: document.getElementById('resultTitle').textContent,
  badge: document.getElementById('resultBadge').textContent,
  basketShown: !document.getElementById('resultBasket').hidden,
  items: document.querySelectorAll('#resultBasket li').length })`);
check('비매칭 7칸 → 바구니 실패 1회', lost.phase === 'lost-full' && lost.shown, JSON.stringify(lost));
check('실패 사유 문구·배지', /바구니가 가득/.test(lost.title) && lost.badge === '정리 실패', JSON.stringify(lost));
check('종료 시 바구니 구성 표시', lost.basketShown && lost.items === 7, JSON.stringify(lost));
// 종료 후 입력 무시
const ignored = await evaluate(`window.KitchenTidy.selectTool(Object.values(${JSON.stringify(g2)})[0][1]) === false`);
check('종료 후 입력 무시', ignored);

/* ============ J. 힌트 (7초 대기 후) ============ */
await nav(GAME_URL + '?seed=hint');
await clickSel('#startBtn');
check('힌트 초기 비활성', await evaluate('document.getElementById("hintBtn").disabled === true'));
await sleep(7400);
check('7초 무진행 → 힌트 활성', await evaluate('document.getElementById("hintBtn").disabled === false'));
await clickSel('#hintBtn');
const hint = await evaluate(`({
  used: window.KitchenTidy.getState().hintUsed,
  marked: document.querySelectorAll('.tool.hint-on').length,
  status: document.getElementById('status').textContent,
  sub: document.getElementById('hintSub').textContent,
  disabled: document.getElementById('hintBtn').disabled
})`);
check('힌트 사용 → 3개 강조(색 외 테두리·심볼)', hint.used === true && hint.marked === 3, JSON.stringify(hint));
check('힌트 안내 문구·1회 제한', /-100/.test(hint.status) && hint.sub === '(사용됨)' && hint.disabled, JSON.stringify(hint));
await sleep(1400);
check('힌트 1.2초 뒤 자동 해제', await evaluate('document.querySelectorAll(".hint-on").length === 0'));

/* ============ K. 시간 종료 실패 ============ */
const leftNow = await evaluate('Number(document.getElementById("timeValue").textContent)');
await sleep((leftNow + 1.5) * 1000);
const timeout = await evaluate(`({ phase: window.KitchenTidy.getState().phase,
  title: document.getElementById('resultTitle').textContent,
  time: document.getElementById('rTime').textContent,
  score: document.getElementById('rScore').textContent,
  brk: document.getElementById('rBreak').textContent })`);
check('35초 경과 → 시간 실패 1회', timeout.phase === 'lost-time' && /시간 안에/.test(timeout.title), JSON.stringify(timeout));
check('시간 실패에 힌트 -100 반영', /힌트 -100/.test(timeout.brk), timeout.brk);
check('시간 실패 시 소요 시간 35.0초', /^3[45]\.\d초$/.test(timeout.time), timeout.time);

/* ============ L. 여유 모드 ============ */
await nav(GAME_URL + '?seed=relax&relax=1');
await clickSel('#startBtn');
await sleep(1200);
const relax = await evaluate(`({ relax: window.KitchenTidy.getState().relax,
  time: document.getElementById('timeValue').textContent,
  status: document.getElementById('status').textContent })`);
check('여유 모드 = 제한 시간 없음', relax.relax === true && relax.time === '연습', JSON.stringify(relax));
check('여유 모드 안내 문구', /여유 모드/.test(relax.status), relax.status);

/* ============ M. 음소거·단축키 ============ */
await key('KeyM', 'm', { vk: 77, text: 'm' });
check('M 단축키로 음소거', await evaluate('window.KitchenTidy.getState().muted === true && document.getElementById("muteBtn").getAttribute("aria-pressed") === "true"'));
await key('KeyM', 'm', { vk: 77, text: 'm' });
check('M 재입력으로 해제', await evaluate('window.KitchenTidy.getState().muted === false'));

/* ============ N. 방향키 공간 이동 ============ */
await evaluate('document.querySelectorAll(".tool")[0].focus()');
const firstId = await evaluate('document.activeElement.id');
await key('ArrowRight', 'ArrowRight', { vk: 39 });
const rightId = await evaluate('document.activeElement.id');
await key('ArrowDown', 'ArrowDown', { vk: 40 });
const downId = await evaluate('document.activeElement.id');
check('방향키로 인접 도구 이동', firstId !== rightId && rightId !== downId, `${firstId} → ${rightId} → ${downId}`);

/* ============ O. 반응형 5종 ============ */
for (const [w, h, mobile] of [[320, 568, true], [390, 844, true], [844, 390, true], [768, 1024, true], [1440, 900, false]]) {
  await setViewport(w, h, mobile);
  await nav(GAME_URL + '?seed=vp' + w);
  await clickSel('#startBtn');
  await sleep(250);
  const vp = await evaluate(`(() => {
    const rects = [...document.querySelectorAll('.tool')].map(e => e.getBoundingClientRect());
    let overlap = 0, small = 0, offscreen = 0;
    for (let i = 0; i < rects.length; i++) {
      if (rects[i].width < 43.5 || rects[i].height < 43.5) small++;
      if (rects[i].left < -1 || rects[i].right > document.documentElement.clientWidth + 1) offscreen++;
      for (let j = i + 1; j < rects.length; j++) {
        const A = rects[i], B = rects[j];
        if (A.left < B.right - 0.5 && B.left < A.right - 0.5 && A.top < B.bottom - 0.5 && B.top < A.bottom - 0.5) overlap++;
      }
    }
    const basket = document.querySelector('.basket-wrap').getBoundingClientRect();
    return { overlap, small, offscreen,
      hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      basketVisible: basket.width > 0 && basket.height > 0,
      count: rects.length };
  })()`);
  check(`반응형 ${w}×${h}: 겹침·미달·가로스크롤 없음`,
    vp.overlap === 0 && vp.small === 0 && vp.offscreen === 0 && vp.hScroll <= 1 && vp.count === 24 && vp.basketVisible,
    JSON.stringify(vp));
}

/* ============ P. 축소 동작 ============ */
await setViewport(390, 844);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await nav(GAME_URL + '?seed=rm');
await clickSel('#startBtn');
await sleep(300);
const rm = await evaluate(`(() => {
  const el = document.querySelector('.tool');
  const cs = getComputedStyle(el);
  return { reduced: window.KitchenTidy.getState().reduced, body: document.body.classList.contains('reduced'),
    transform: cs.transform, pulse: document.querySelectorAll('.tool.pulse').length };
})()`);
check('축소 동작: 흔들림·회전·튜토리얼 맥동 제거', rm.reduced && rm.body && rm.transform === 'none' && rm.pulse === 0, JSON.stringify(rm));
// 축소 동작에서도 완주 가능
await playThrough();
check('축소 동작에서도 완주 가능', await evaluate('window.KitchenTidy.getState().phase === "won"'));
await send('Emulation.setEmulatedMedia', { features: [] });

/* ============ Q. 강제 색상 / 200% 확대 ============ */
await send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
await setViewport(195, 422); // 200% 확대 상당(390×844 의 절반 CSS 픽셀)
await nav(GAME_URL + '?seed=zoom');
const zoom = await evaluate(`(() => {
  const btn = document.getElementById('startBtn').getBoundingClientRect();
  return { visible: btn.width > 0 && btn.height >= 44, hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
})()`);
check('200% 확대 상당에서 시작 버튼 접근 가능', zoom.visible && zoom.hScroll <= 1, JSON.stringify(zoom));

/* ============ R. 스크린샷 ============ */
await setViewport(390, 844);
await nav(GAME_URL + '?seed=shot');
await clickSel('#startBtn');
await sleep(400);
const shot1 = await send('Page.captureScreenshot', { format: 'png' });
const g4 = await evaluate(`(() => { const S = window.KitchenTidy.getState(); const g = {};
  S.tools.forEach(t => (g[t.typeId] = g[t.typeId] || []).push(t.id)); return g; })()`);
const k4 = Object.keys(g4);
for (const id of g4[k4[0]]) await clickSel('#tool-' + id);
await clickSel('#tool-' + g4[k4[1]][0]);
await clickSel('#tool-' + g4[k4[2]][0]);
await sleep(300);
const shot2 = await send('Page.captureScreenshot', { format: 'png' });
await playThrough();
await sleep(400);
const shot3 = await send('Page.captureScreenshot', { format: 'png' });

const { writeFileSync, mkdirSync } = await import('node:fs');
mkdirSync('outputs/screenshots', { recursive: true });
writeFileSync('outputs/screenshots/kitchen-tidy-01-start.png', Buffer.from(shot1.data, 'base64'));
writeFileSync('outputs/screenshots/kitchen-tidy-02-play.png', Buffer.from(shot2.data, 'base64'));
writeFileSync('outputs/screenshots/kitchen-tidy-03-result.png', Buffer.from(shot3.data, 'base64'));
check('스크린샷 3장 저장', true, 'outputs/screenshots/kitchen-tidy-0{1,2,3}-*.png');

check('전체 실행 콘솔 오류 0건(최종 구간)', consoleErrors.length === 0, consoleErrors.join(' | '));

/* ============ 결과 ============ */
const pass = results.filter((r) => r.ok).length;
console.log('\n=== 키친 타이디 브라우저 검증 ===');
results.forEach((r) => console.log(`${r.ok ? 'PASS' : 'FAIL'} · ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
console.log(`\n${pass}/${results.length} 통과`);

ws.close();
chrome.kill();
process.exit(pass === results.length ? 0 : 1);
