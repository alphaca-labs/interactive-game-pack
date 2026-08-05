// 퍼펙트 슬라이스 브라우저 검증 — Chrome + CDP(추가 의존성 없음)
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const GAME_URL = process.argv[2];
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const profile = mkdtempSync(join(tmpdir(), 'ps-chrome-'));

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
const consoleErrors = [];
const requests = [];

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

await send('Log.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

await send('Page.navigate', { url: GAME_URL });
await sleep(1200);

// 1. 로드 & 순수 점수 함수
check('로드: PerfectSlice API 노출', await evaluate('typeof window.PerfectSlice === "object"'));

const scoreTests = await evaluate(`(() => {
  const P = window.PerfectSlice;
  const perfect = [1/6, 2/6, 3/6, 4/6, 5/6];
  const skewed  = [0.08, 0.18, 0.30, 0.62, 0.90];
  return {
    perfect: P.calculateScore(perfect),
    perfectPieces: P.deriveSegments(perfect).length,
    skewed: P.calculateScore(skewed),
    unsortedSame: P.calculateScore([5/6, 1/6, 4/6, 2/6, 3/6].slice().sort((a,b)=>a-b)),
    boundaryExact: P.isValidCut(0.045, []),
    boundaryUnder: P.isValidCut(0.0449, []),
    nearExisting: P.isValidCut(0.20 + 0.044, [0.20]),
    atEnd: P.isValidCut(1, []),
    gradePerfect: P.gradeFor(100).label,
    gradeLow: P.gradeFor(40).label
  };
})()`);

check('점수: 1/6 균등 5회 절단 = 100점, 6조각',
  scoreTests.perfect === 100 && scoreTests.perfectPieces === 6, JSON.stringify(scoreTests));
check('점수: 편차 큰 절단은 100점 미만이고 성공선(65) 미만',
  scoreTests.skewed < 65, `skewed=${scoreTests.skewed}`);
check('점수: 입력 순서와 무관하게 동일', scoreTests.unsortedSame === 100);
check('유효성: 4.5% 경계값은 유효, 그 미만은 무효',
  scoreTests.boundaryExact === true && scoreTests.boundaryUnder === false);
check('유효성: 기존 절단선 근접·양 끝은 무효',
  scoreTests.nearExisting === false && scoreTests.atEnd === false);
check('등급 매핑', scoreTests.gradePerfect === '완벽한 칼질' && scoreTests.gradeLow === '한 번 더');

// 2. 초기 화면 — 스크롤 없음, 타이머 정지
const intro = await evaluate(`({
  phase: document.getElementById('shell').dataset.phase,
  scrollable: document.documentElement.scrollHeight > window.innerHeight + 2,
  timer: document.getElementById('timerNum').textContent,
  cuts: document.getElementById('cutsNum').textContent,
  primary: document.getElementById('primaryBtn').textContent,
  guides: document.querySelectorAll('.guide').length,
  pieces: document.querySelectorAll('#pieces .piece').length
})`);
check('초기: intro 단계 · 스크롤 없음 · 25초 · 5회 · 가이드 5개 · 조각 1개',
  intro.phase === 'intro' && !intro.scrollable && intro.timer === '25'
  && intro.cuts === '5' && intro.guides === 5 && intro.pieces === 1, JSON.stringify(intro));

await sleep(1100);
const timerHeld = await evaluate(`document.getElementById('timerNum').textContent`);
check('초기: 시작 전 타이머가 감소하지 않음', timerHeld === '25', `after 1.1s => ${timerHeld}`);

// 3. 포인터 드래그로 정확히 1/6 간격 5회 절단
await evaluate(`document.getElementById('primaryBtn').click()`);
await sleep(60);
check('시작: playing 단계 전환',
  (await evaluate(`document.getElementById('shell').dataset.phase`)) === 'playing');

const rect = await evaluate(`(() => { const r = document.getElementById('cukeWrap').getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);

async function dragCut(frac) {
  const x = rect.left + rect.width * frac;
  const y = rect.top + rect.height / 2;
  const base = { x, y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' };
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...base });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base, buttons: 0 });
  await sleep(360);
}

for (const f of [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6]) await dragCut(f);
await sleep(700);

const done = await evaluate(`(() => {
  const r = document.getElementById('result');
  return {
    phase: document.getElementById('shell').dataset.phase,
    hidden: r.hidden,
    success: r.dataset.success,
    score: Number(document.getElementById('resultScore').textContent),
    grade: document.getElementById('resultGrade').textContent,
    best: document.getElementById('bestScore').textContent,
    pieces: document.querySelectorAll('#pieces .piece').length,
    cutFaces: document.querySelectorAll('#pieces .cut-face').length,
    focus: document.activeElement && document.activeElement.id,
    live: document.getElementById('live').textContent
  };
})()`);
check('플레이: 마우스 드래그 5회 → 6조각 · 결과 표시 · 성공',
  done.phase === 'result' && done.hidden === false && done.success === 'true'
  && done.pieces === 6 && done.score >= 95, JSON.stringify(done));
check('결과: 절단면 렌더 10개(내부 경계 5 × 양쪽)', done.cutFaces === 10, `faces=${done.cutFaces}`);
check('결과: 포커스가 다시 자르기 버튼으로 이동', done.focus === 'retryBtn', `focus=${done.focus}`);
check('결과: 화면 낭독 안내 문구 존재', /정확도/.test(done.live || ''), done.live);

// 4. 무효 절단 — 남은 칼질/조각 불변
await evaluate(`document.getElementById('retryBtn').click()`);
await sleep(120);
const beforeInvalid = await evaluate(`({ cuts: document.getElementById('cutsNum').textContent,
  pieces: document.querySelectorAll('#pieces .piece').length })`);
await dragCut(0.5);
await dragCut(0.5 + 0.02); // 기존 절단선에서 2% → 무효
const afterInvalid = await evaluate(`({ cuts: document.getElementById('cutsNum').textContent,
  pieces: document.querySelectorAll('#pieces .piece').length,
  hint: document.getElementById('hint').textContent,
  live: document.getElementById('live').textContent })`);
check('무효 절단: 남은 칼질·조각 수 불변 + 안내 표시',
  beforeInvalid.cuts === '5' && afterInvalid.cuts === '4' && afterInvalid.pieces === 2
  && /안쪽/.test(afterInvalid.hint), JSON.stringify({ beforeInvalid, afterInvalid }));

// 5. 키보드 완주 (Home → 방향키 → Space)
await evaluate(`document.getElementById('retryBtn')?.click(); document.getElementById('primaryBtn').click()`);
await sleep(120);
await evaluate(`document.getElementById('knife').focus()`);

async function key(k, shift = false) {
  const common = { key: k, code: k === ' ' ? 'Space' : k, windowsVirtualKeyCode: k === ' ' ? 32 : (k === 'Home' ? 36 : (k === 'ArrowRight' ? 39 : 37)), modifiers: shift ? 8 : 0 };
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...common, text: k === ' ' ? ' ' : undefined });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...common });
}

await key('Home');
for (let c = 0; c < 5; c++) {
  for (let i = 0; i < 3; i++) await key('ArrowRight', true);   // 3 × 5% = 15%
  for (let i = 0; i < 2; i++) await key('ArrowRight');         // 2 × 1.5% = 3% → 누적 18%씩
  await key(' ');
  await sleep(340);
}
await sleep(700);
const kbd = await evaluate(`(() => {
  const r = document.getElementById('result');
  return { phase: document.getElementById('shell').dataset.phase, hidden: r.hidden,
    score: Number(document.getElementById('resultScore').textContent),
    valuetext: document.getElementById('knife').getAttribute('aria-valuetext') };
})()`);
check('키보드: 방향키+Space만으로 완주해 결과 도달',
  kbd.phase === 'result' && kbd.hidden === false && kbd.score > 0, JSON.stringify(kbd));

// 6. 재시작 초기화
await evaluate(`document.getElementById('retryBtn').click()`);
await sleep(80);
const restarted = await evaluate(`({ phase: document.getElementById('shell').dataset.phase,
  cuts: document.getElementById('cutsNum').textContent,
  pieces: document.querySelectorAll('#pieces .piece').length,
  timer: document.getElementById('timerNum').textContent,
  resultHidden: document.getElementById('result').hidden,
  score: document.getElementById('scoreValue').textContent })`);
check('재시작: 조각·칼질·타이머·결과 초기화',
  restarted.phase === 'playing' && restarted.cuts === '5' && restarted.pieces === 1
  && restarted.timer === '25' && restarted.resultHidden === true && restarted.score === '—',
  JSON.stringify(restarted));

// 7. 시간 종료
await evaluate(`(() => { const s = window.PerfectSlice; return true; })()`);
await sleep(26000);
const timeout = await evaluate(`({ phase: document.getElementById('shell').dataset.phase,
  title: document.getElementById('resultTitle').textContent,
  success: document.getElementById('result').dataset.success,
  desc: document.getElementById('resultDesc').textContent,
  timer: document.getElementById('timerNum').textContent })`);
check('시간 종료: 25초 후 실패 결과 + 미완성 조각 안내',
  timeout.phase === 'result' && timeout.success === 'false'
  && /시간/.test(timeout.title) && /조각/.test(timeout.desc) && timeout.timer === '0',
  JSON.stringify(timeout));

// 8. 리사이즈 후 상태 보존
await evaluate(`document.getElementById('retryBtn').click()`);
await sleep(80);
await dragCut(1 / 3);
const beforeResize = await evaluate(`document.querySelectorAll('#pieces .piece').length`);
await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 2, mobile: true });
await sleep(400);
const afterResize = await evaluate(`({ pieces: document.querySelectorAll('#pieces .piece').length,
  cuts: document.getElementById('cutsNum').textContent,
  phase: document.getElementById('shell').dataset.phase })`);
check('리사이즈: 진행 중 절단·상태 보존',
  beforeResize === 2 && afterResize.pieces === 2 && afterResize.cuts === '4' && afterResize.phase === 'playing',
  JSON.stringify({ beforeResize, afterResize }));

// 9. 작은 화면 / 가로 화면 잘림 확인
for (const [w, h, label] of [[320, 568, '320×568'], [360, 640, '360×640'], [740, 420, '가로 740×420']]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
  await sleep(300);
  const fit = await evaluate(`(() => {
    const d = document.documentElement;
    const btn = document.getElementById('primaryBtn').getBoundingClientRect();
    const board = document.querySelector('.board').getBoundingClientRect();
    return { vScroll: d.scrollHeight - window.innerHeight, hScroll: d.scrollWidth - window.innerWidth,
      btnVisible: btn.bottom <= window.innerHeight + 1 && btn.width >= 100 && btn.height >= 44,
      boardVisible: board.top >= 0 && board.bottom <= window.innerHeight };
  })()`);
  check(`반응형 ${label}: 가로 스크롤 없음 · 주 버튼/도마 노출`,
    fit.hScroll <= 1 && fit.vScroll <= 1 && fit.btnVisible && fit.boardVisible, JSON.stringify(fit));
}

// 10. 외부 요청 0건 / 콘솔 오류 0건
const external = requests.filter((u) => !u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('about:'));
check('독립 실행: 외부 네트워크 요청 0건', external.length === 0, external.join(', '));
check('콘솔 오류·경고 0건', consoleErrors.length === 0, consoleErrors.join(' | '));

// 11. 감소된 모션에서도 동일 규칙 완주
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await evaluate(`location.reload()`);
await sleep(1000);
const rect2 = await evaluate(`(() => { const r = document.getElementById('cukeWrap').getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);
rect.left = rect2.left; rect.top = rect2.top; rect.width = rect2.width; rect.height = rect2.height;
await evaluate(`document.getElementById('primaryBtn').click()`);
await sleep(60);
for (const f of [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6]) await dragCut(f);
await sleep(400);
const reduced = await evaluate(`({ phase: document.getElementById('shell').dataset.phase,
  score: Number(document.getElementById('resultScore').textContent),
  success: document.getElementById('result').dataset.success })`);
check('감소된 모션: 동일 규칙으로 완주하고 즉시 점수 확정',
  reduced.phase === 'result' && reduced.score === 100 && reduced.success === 'true', JSON.stringify(reduced));

// 12. 접근성 기본
const a11y = await evaluate(`(() => {
  const k = document.getElementById('knife');
  const btns = [...document.querySelectorAll('button, .btn')];
  const small = btns.filter(b => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44; })
    .map(b => b.id || b.textContent.trim());
  return { role: k.getAttribute('role'), min: k.getAttribute('aria-valuemin'), max: k.getAttribute('aria-valuemax'),
    now: k.getAttribute('aria-valuenow'), text: k.getAttribute('aria-valuetext'),
    tabbable: k.tabIndex === 0, live: document.getElementById('live').getAttribute('aria-live'),
    lang: document.documentElement.lang, h1: document.querySelectorAll('h1').length, small };
})()`);
check('접근성: 칼 slider 역할·값 · live 영역 · lang · h1 · 44px 이상 버튼',
  a11y.role === 'slider' && a11y.tabbable && a11y.live === 'polite' && a11y.lang === 'ko'
  && a11y.h1 === 1 && a11y.small.length === 0, JSON.stringify(a11y));

ws.close();
chrome.kill();

let failed = 0;
console.log('\n=== 퍼펙트 슬라이스 검증 결과 ===');
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '\n      → ' + r.detail}`);
}
console.log(`\n${results.length - failed}/${results.length} 통과`);
process.exit(failed ? 1 : 0);
