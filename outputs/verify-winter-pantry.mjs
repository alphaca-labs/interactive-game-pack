// 윈터 팬트리(games/game-04) 브라우저 검증 — Chrome headless + CDP (추가 의존성 없음)
// 사용: node outputs/verify-winter-pantry.mjs "file:///.../games/game-04/index.html"
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_URL = process.argv[2];
const SHOT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'screenshots');
mkdirSync(SHOT_DIR, { recursive: true });

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9337;
const profile = mkdtempSync(join(tmpdir(), 'wp-chrome-'));

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

const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++msgId;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
  return r.result.value;
};

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); };

const setViewport = (w, h, mobile = true) =>
  send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SHOT_DIR, name), Buffer.from(r.data, 'base64'));
}

// 실제 마우스 클릭 (합성 click 이벤트가 아니라 입력 파이프라인 경유)
async function clickCell(index) {
  const box = await evaluate(`(() => {
    const n = document.querySelectorAll('.cell')[${index}];
    const r = n.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
  }
  await sleep(60);
}

// 텍스트를 만드는 키는 keyDown+text, 방향키 등은 rawKeyDown 이어야 기본 동작이 실행된다.
const KEY_TEXT = { Enter: '\r', Tab: '\t' };
async function key(k, code, keyCode) {
  const text = KEY_TEXT[k] !== undefined ? KEY_TEXT[k] : (k.length === 1 ? k : undefined);
  const base = { key: k, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
  await send('Input.dispatchKeyEvent', text !== undefined
    ? { ...base, type: 'keyDown', text, unmodifiedText: text }
    : { ...base, type: 'rawKeyDown' });
  await send('Input.dispatchKeyEvent', { ...base, type: 'keyUp' });
  await sleep(50);
}

await send('Log.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Page.enable');
await setViewport(390, 844);

/* ---------- 1. 로드 · 독립성 ---------- */
await send('Page.navigate', { url: GAME_URL + '?seed=20260806' });
await sleep(1000);

check('로드: WinterPantry API 노출', await evaluate('typeof window.WinterPantry === "object"'));
check('로드: 콘솔 오류·경고 0건', consoleErrors.length === 0, consoleErrors.join(' | '));
const external = requests.filter((u) => !u.startsWith('file://') && !u.startsWith('data:'));
check('독립성: 외부(http/https) 요청 0건', external.length === 0, external.join(' | '));
check('독립성: 요청은 자기 3파일뿐',
  requests.filter((u) => u.startsWith('file://')).length === 3,
  requests.filter((u) => u.startsWith('file://')).map((u) => u.split('/').pop()).join(', '));

/* ---------- 2. 보드 구성 ---------- */
const board = await evaluate(`(() => {
  const S = WinterPantry.state;
  const nodes = document.querySelectorAll('.cell');
  return {
    cells: S.cells.length,
    nodes: nodes.length,
    targets: S.cells.filter(c => c.isTarget).length,
    phase: S.phase,
    labels: [...nodes].every(n => /^\\d행 \\d열, .+/.test(n.getAttribute('aria-label'))),
    tabbable: [...nodes].filter(n => n.tabIndex === 0).length,
    names: [...nodes].every(n => n.querySelector('.tag') && n.querySelector('.tag').textContent.length > 0),
    familyClash: (() => {
      const t = S.targetId;
      return false; // 계열 검증은 ?test=1 자기 테스트가 60개 seed로 수행
    })(),
  };
})()`);
check('보드: 20칸 DOM 생성', board.cells === 20 && board.nodes === 20, `state ${board.cells} / DOM ${board.nodes}`);
check('보드: 목표 정확히 5칸', board.targets === 5, String(board.targets));
check('보드: 초기 상태 READY', board.phase === 'READY');
check('접근성: 모든 칸 aria-label "N행 M열, 재료"', board.labels);
check('접근성: 모든 칸 이름 텍스트 병기(색상 의존 아님)', board.names);
check('키보드: roving tabindex 1개', board.tabbable === 1, String(board.tabbable));

const minCell = await evaluate(`Math.min(...[...document.querySelectorAll('.cell')].map(n => Math.min(n.getBoundingClientRect().width, n.getBoundingClientRect().height)))`);
check('타깃 크기: 390px 폭에서 최소 44px', minCell >= 44, `${minCell.toFixed(1)}px`);

await shot('winter-pantry-01-ready.png');

/* ---------- 3. 첫 입력이 타이머를 시작 ---------- */
const beforeStart = await evaluate('WinterPantry.state.phase');
const idx = await evaluate('WinterPantry.state.cells.map((c,i)=>c.isTarget?i:-1).filter(i=>i>=0)');
const wrongIdx = await evaluate('WinterPantry.state.cells.map((c,i)=>c.isTarget?-1:i).filter(i=>i>=0)');

await clickCell(idx[0]);
const afterFirst = await evaluate(`({
  phase: WinterPantry.state.phase,
  found: WinterPantry.state.found,
  score: WinterPantry.state.score,
  slot: document.querySelectorAll('.slot[data-filled="1"]').length,
})`);
check('시작: 별도 시작 버튼 없이 첫 탭이 유효 입력', beforeStart === 'READY' && afterFirst.phase === 'PLAYING');
check('정답 1회: 점수 100, 수집 1', afterFirst.score === 100 && afterFirst.found === 1, JSON.stringify(afterFirst));
check('정답 1회: 바구니 슬롯 1칸 채움', afterFirst.slot === 1);

/* ---------- 4. 콤보 누적 ---------- */
await clickCell(idx[1]);
await clickCell(idx[2]);
const combo = await evaluate('({score: WinterPantry.state.score, streak: WinterPantry.state.streak, label: document.getElementById("comboNum").textContent})');
check('콤보: 100+125+150 = 375', combo.score === 375, JSON.stringify(combo));
check('콤보 표시: 4번째 정답 배수 ×1.75', combo.label === '×1.75', combo.label);

/* ---------- 5. 오답 페널티 ---------- */
const preWrong = await evaluate('({t: WinterPantry.remainingMs(), s: WinterPantry.state.score, p: WinterPantry.state.penaltyMs})');
await clickCell(wrongIdx[0]);
const postWrong = await evaluate(`({
  s: WinterPantry.state.score, streak: WinterPantry.state.streak, p: WinterPantry.state.penaltyMs,
  cellState: WinterPantry.state.cells[${wrongIdx[0]}].state,
  stillThere: !!document.querySelectorAll('.cell')[${wrongIdx[0]}],
  combo: document.getElementById('comboNum').textContent,
})`);
check('오답: 점수 −50', postWrong.s === preWrong.s - 50, `${preWrong.s} → ${postWrong.s}`);
check('오답: 시간 정확히 −2초', postWrong.p - preWrong.p === 2000, `${postWrong.p - preWrong.p}ms`);
check('오답: 콤보 1.00 초기화', postWrong.streak === 0 && postWrong.combo === '×1.00');
check('오답: 칸은 제거되지 않고 X 표식', postWrong.cellState === 'wrong' && postWrong.stillThere);

// 잠금 중 재탭 → 중복 차감 없음
const dup = await evaluate('({s: WinterPantry.state.score, p: WinterPantry.state.penaltyMs})');
await clickCell(wrongIdx[0]);
const dup2 = await evaluate('({s: WinterPantry.state.score, p: WinterPantry.state.penaltyMs})');
check('오답: 피드백 중 재탭은 중복 차감 없음', dup.s === dup2.s && dup.p === dup2.p);

// 450ms 후에는 다시 유효한 오답 대상
await sleep(520);
await clickCell(wrongIdx[0]);
const dup3 = await evaluate('({s: WinterPantry.state.score, p: WinterPantry.state.penaltyMs})');
check('오답: 잠금 해제 후 재탭은 다시 페널티', dup3.p - dup2.p === 2000);

// 수집 완료 칸 재탭 → 재집계 없음
const preRe = await evaluate('({s: WinterPantry.state.score, f: WinterPantry.state.found})');
await clickCell(idx[0]);
const postRe = await evaluate('({s: WinterPantry.state.score, f: WinterPantry.state.found})');
check('수집 칸 재탭: 재집계 없음', preRe.s === postRe.s && preRe.f === postRe.f);

await shot('winter-pantry-02-playing.png');

/* ---------- 6. 승리 · 시간 보너스 1회 ---------- */
await clickCell(idx[3]);
await clickCell(idx[4]);
await sleep(200);
const win = await evaluate(`(() => {
  const S = WinterPantry.state;
  return {
    phase: S.phase, found: S.found, bonus: S.bonus, score: S.score,
    remain: S.frozenRemain,
    open: !document.getElementById('result').hidden,
    title: document.getElementById('resultTitle').textContent,
    rScore: document.getElementById('rScore').textContent,
    rFound: document.getElementById('rFound').textContent,
    focused: document.activeElement && document.activeElement.id,
  };
})()`);
check('승리: 5/5 수집 후 WON', win.phase === 'WON' && win.found === 5, JSON.stringify(win));
check('승리: 결과 모달 표시', win.open && win.title.includes('완성'));
check('승리: 시간 보너스 = floor(남은초)×10, 1회만 반영',
  win.bonus === Math.floor(win.remain / 1000) * 10 && Number(win.rScore) === win.score,
  `bonus ${win.bonus}, remain ${win.remain.toFixed(0)}ms, score ${win.score}`);
check('승리: 결과 제목으로 포커스 이동', win.focused === 'resultTitle', String(win.focused));
check('승리: 표시 개수 5 / 5', win.rFound === '5 / 5');

await shot('winter-pantry-03-result-win.png');

// 종료 후 보드 입력은 상태를 바꾸지 않는다
await clickCell(wrongIdx[1]);
const afterEnd = await evaluate('({s: WinterPantry.state.score, phase: WinterPantry.state.phase})');
check('종료 후: 보드 입력이 점수·상태를 바꾸지 않음', afterEnd.s === win.score && afterEnd.phase === 'WON');

/* ---------- 7. 결과 모달 포커스 유지 ---------- */
await key('Tab', 'Tab', 9);
const tab1 = await evaluate('document.activeElement.id');
await key('Tab', 'Tab', 9);
const tab2 = await evaluate('document.activeElement.id');
await key('Tab', 'Tab', 9);
const tab3 = await evaluate('document.activeElement.id');
check('결과 모달: Tab이 두 CTA 안에 유지',
  ['replayBtn', 'moreBtn'].includes(tab1) && ['replayBtn', 'moreBtn'].includes(tab2) && ['replayBtn', 'moreBtn'].includes(tab3),
  [tab1, tab2, tab3].join(' → '));

/* ---------- 8. 재시작 ---------- */
await evaluate('document.getElementById("replayBtn").click()');
await sleep(250);
const restarted = await evaluate(`({
  phase: WinterPantry.state.phase,
  score: WinterPantry.state.score, found: WinterPantry.state.found, streak: WinterPantry.state.streak,
  penalty: WinterPantry.state.penaltyMs,
  time: document.getElementById('timeNum').textContent,
  hidden: document.getElementById('result').hidden,
  collected: document.querySelectorAll('.cell[data-state="collected"]').length,
  focusedCell: document.activeElement.classList.contains('cell'),
  firstFocus: document.activeElement === document.querySelectorAll('.cell')[0],
})`);
check('재시작: READY·점수/수집/콤보/시간 초기화',
  restarted.phase === 'READY' && restarted.score === 0 && restarted.found === 0 &&
  restarted.streak === 0 && restarted.penalty === 0 && restarted.time === '30.0초',
  JSON.stringify(restarted));
check('재시작: 결과 모달 닫힘·수집 표식 제거', restarted.hidden && restarted.collected === 0);
check('재시작: 첫 보드 칸으로 포커스', restarted.focusedCell && restarted.firstFocus);

/* ---------- 9. 시간 실패 ---------- */
const t2 = await evaluate('WinterPantry.state.cells.map((c,i)=>c.isTarget?i:-1).filter(i=>i>=0)');
await clickCell(t2[0]);                          // PLAYING 진입
await evaluate('WinterPantry.forceExpire()');    // 타이머 즉시 만료
await sleep(300);
const lost = await evaluate(`({
  phase: WinterPantry.state.phase,
  open: !document.getElementById('result').hidden,
  title: document.getElementById('resultTitle').textContent,
  bonus: WinterPantry.state.bonus,
  remain: document.getElementById('timeNum').textContent,
})`);
check('시간 실패: 5개 미만에서 만료 시 LOST', lost.phase === 'LOST' && lost.open, JSON.stringify(lost));
check('시간 실패: 보너스 미지급·남은 시간 0.0초', lost.bonus === 0 && lost.remain === '0.0초');
await shot('winter-pantry-04-result-lose.png');

/* ---------- 10. 키보드 단독 완주 ---------- */
await evaluate('WinterPantry.restart()');
await sleep(250);
await evaluate('document.querySelectorAll(".cell")[0].focus()');
const kbTargets = await evaluate('WinterPantry.state.cells.map((c,i)=>c.isTarget?i:-1).filter(i=>i>=0)');
const KEY = {
  ArrowRight: ['ArrowRight', 39], ArrowLeft: ['ArrowLeft', 37],
  ArrowDown: ['ArrowDown', 40], ArrowUp: ['ArrowUp', 38],
};
let cur = 0;
let visited = new Set([0]);
for (const t of kbTargets) {
  const [tr, tc] = [Math.floor(t / 5), t % 5];
  let guard = 0;
  while (cur !== t && guard++ < 20) {
    const [r, c] = [Math.floor(cur / 5), cur % 5];
    const k = r < tr ? 'ArrowDown' : r > tr ? 'ArrowUp' : c < tc ? 'ArrowRight' : 'ArrowLeft';
    await key(...[k, ...KEY[k]]);
    cur = await evaluate('WinterPantry.state.focusIndex');
    visited.add(cur);
  }
  await key('Enter', 'Enter', 13);
}
const kb = await evaluate(`({
  phase: WinterPantry.state.phase, found: WinterPantry.state.found,
  score: WinterPantry.state.score,
})`);
check('키보드 완주: 방향키+Enter만으로 승리', kb.phase === 'WON' && kb.found === 5, JSON.stringify(kb));
check('키보드: 수집 완료 칸도 좌표 이동에서 건너뛰지 않음(aria-disabled 사용)',
  await evaluate('[...document.querySelectorAll(".cell[data-state=\\"collected\\"]")].every(n => !n.disabled && n.getAttribute("aria-disabled") === "true")'));

// 경계에서 같은 행/열 유지
await evaluate('WinterPantry.restart()');
await sleep(200);
await evaluate('document.querySelectorAll(".cell")[0].focus()');
await key('ArrowLeft', 'ArrowLeft', 37);
const edgeL = await evaluate('WinterPantry.state.focusIndex');
await key('ArrowUp', 'ArrowUp', 38);
const edgeU = await evaluate('WinterPantry.state.focusIndex');
for (let i = 0; i < 7; i++) await key('ArrowRight', 'ArrowRight', 39);
const edgeR = await evaluate('WinterPantry.state.focusIndex');   // 0행 마지막 열 = 4
for (let i = 0; i < 6; i++) await key('ArrowDown', 'ArrowDown', 40);
const edgeD = await evaluate('WinterPantry.state.focusIndex');   // 3행 마지막 열 = 19
check('키보드: 4방향 경계에서 래핑 없이 같은 행/열 유지',
  edgeL === 0 && edgeU === 0 && edgeR === 4 && edgeD === 19, `${edgeL}/${edgeU}/${edgeR}/${edgeD}`);

/* ---------- 11. 음소거 토글 · 저장 ---------- */
await key('m', 'KeyM', 77);
const muted = await evaluate('({muted: WinterPantry.state.muted, pressed: document.getElementById("muteBtn").getAttribute("aria-pressed"), label: document.getElementById("muteBtn").textContent, ls: localStorage.getItem("winter-pantry-muted")})');
check('음소거: M 키 토글 + aria-pressed + localStorage 저장',
  muted.muted === true && muted.pressed === 'true' && muted.ls === '1', JSON.stringify(muted));
await key('m', 'KeyM', 77);
check('음소거: 재토글 복귀', await evaluate('WinterPantry.state.muted === false'));

/* ---------- 12. 재시작 20회 후 중복 없음 ---------- */
consoleErrors = [];
await evaluate('for (let i=0;i<20;i++) WinterPantry.restart();');
await sleep(400);
const after20 = await evaluate(`({
  nodes: document.querySelectorAll('.cell').length,
  phase: WinterPantry.state.phase,
  ghosts: document.querySelectorAll('.fly').length,
  score: WinterPantry.state.score,
})`);
const t3 = await evaluate('WinterPantry.state.cells.map((c,i)=>c.isTarget?i:-1).filter(i=>i>=0)');
await clickCell(t3[0]);
const oneTap = await evaluate('WinterPantry.state.score');
check('재시작 20회: DOM 20칸 유지·잔여 고스트 0', after20.nodes === 20 && after20.ghosts === 0, JSON.stringify(after20));
check('재시작 20회: 리스너 중복 없음(1탭 = 100점)', oneTap === 100, String(oneTap));
check('재시작 20회: 콘솔 오류 0건', consoleErrors.length === 0, consoleErrors.join(' | '));

/* ---------- 13. 리사이즈 상태 보존 ---------- */
const beforeResize = await evaluate('({s: WinterPantry.state.score, f: WinterPantry.state.found, t: Math.round(WinterPantry.remainingMs()/100), seed: WinterPantry.state.seed})');
await setViewport(844, 390, false);
await sleep(350);
const afterResize = await evaluate('({s: WinterPantry.state.score, f: WinterPantry.state.found, t: Math.round(WinterPantry.remainingMs()/100), seed: WinterPantry.state.seed, phase: WinterPantry.state.phase})');
check('리사이즈: 점수·수집·seed·진행 상태 보존',
  beforeResize.s === afterResize.s && beforeResize.f === afterResize.f &&
  beforeResize.seed === afterResize.seed && afterResize.phase === 'PLAYING' &&
  afterResize.t <= beforeResize.t,
  JSON.stringify({ beforeResize, afterResize }));
await shot('winter-pantry-05-landscape.png');

/* ---------- 14. 반응형 4종 ---------- */
for (const [w, h, mobile, label] of [[320, 568, true, '320×568'], [390, 844, true, '390×844'], [844, 390, false, '844×390'], [1440, 900, false, '1440×900']]) {
  await setViewport(w, h, mobile);
  await sleep(300);
  const r = await evaluate(`(() => {
    const cells = [...document.querySelectorAll('.cell')];
    const boxes = cells.map(n => n.getBoundingClientRect());
    return {
      hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      minSide: Math.min(...boxes.map(b => Math.min(b.width, b.height))),
      cols: new Set(boxes.map(b => Math.round(b.left))).size,
      rows: new Set(boxes.map(b => Math.round(b.top))).size,
      boardVisible: document.getElementById('board').getBoundingClientRect().width > 0,
    };
  })()`);
  check(`반응형 ${label}: 가로 스크롤 없음 · 5×4 유지 · 44px 이상`,
    !r.hScroll && r.cols === 5 && r.rows === 4 && r.minSide >= 43.5 && r.boardVisible,
    JSON.stringify(r));
}
await setViewport(320, 568, true);
await sleep(250);
await shot('winter-pantry-06-320.png');

/* ---------- 15. 감소된 모션 ---------- */
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await setViewport(390, 844, true);
await evaluate('WinterPantry.restart()');
await sleep(250);
const rmTargets = await evaluate('WinterPantry.state.cells.map((c,i)=>c.isTarget?i:-1).filter(i=>i>=0)');
await clickCell(rmTargets[0]);
const rm = await evaluate(`({
  ghosts: document.querySelectorAll('.fly').length,
  snow: getComputedStyle(document.getElementById('snow')).display,
  found: WinterPantry.state.found,
  check: getComputedStyle(document.querySelectorAll('.cell')[${rmTargets[0]}], '::after').content,
})`);
check('감소된 모션: 이동 고스트·눈 애니메이션 없음, 체크 표식은 유지',
  rm.ghosts === 0 && rm.snow === 'none' && rm.found === 1 && rm.check.includes('✓'),
  JSON.stringify(rm));
await send('Emulation.setEmulatedMedia', { features: [] });

/* ---------- 16. 자기 테스트(?test=1) ---------- */
consoleErrors = [];
await send('Page.navigate', { url: GAME_URL + '?test=1' });
await sleep(1500);
const selfTest = await evaluate(`(() => {
  const p = document.querySelector('.test-panel');
  return { text: p ? p.textContent.split('\\n')[0] : 'none', fail: p ? (p.textContent.match(/FAIL/g) || []).length : -1 };
})()`);
check('자기 테스트 ?test=1: 전부 통과', selfTest.fail === 0, selfTest.text);
check('자기 테스트: 실행 중 콘솔 오류 0건', consoleErrors.filter((e) => !e.includes('self-test')).length === 0, consoleErrors.join(' | '));

/* ---------- 17. seed 재현성 ---------- */
await send('Page.navigate', { url: GAME_URL + '?seed=42' });
await sleep(800);
const a = await evaluate('WinterPantry.state.cells.map(c=>c.ingredientId).join()+"|"+WinterPantry.state.targetId');
await send('Page.navigate', { url: GAME_URL + '?seed=42' });
await sleep(800);
const b = await evaluate('WinterPantry.state.cells.map(c=>c.ingredientId).join()+"|"+WinterPantry.state.targetId');
check('?seed 재현성: 같은 seed → 같은 보드', a === b);

/* ---------- 보고 ---------- */
const passed = results.filter((r) => r.ok).length;
console.log(`\n윈터 팬트리 검증 — ${passed}/${results.length} 통과\n`);
for (const r of results) console.log(`${r.ok ? '  PASS' : '  FAIL'}  ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
console.log(`\n스크린샷: ${SHOT_DIR}`);

ws.close();
chrome.kill();
process.exit(passed === results.length ? 0 : 1);
