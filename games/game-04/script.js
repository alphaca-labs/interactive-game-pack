/* 윈터 팬트리 (Winter Pantry) — 겨울 산장 재료 찾기
 * 항목 4 / 8 · Type A 탭 매칭 · 기획서: outputs/plans/winter-pantry.md
 *
 * 외부 요청 0건: 이미지·폰트·오디오 파일·SDK 없이 인라인 SVG와 Web Audio 합성만 사용한다.
 * URL 파라미터
 *   ?seed=<정수>  동일 보드 재현 (재시작해도 같은 보드 — QA 전용)
 *   ?test=1       순수 함수 자기 테스트 실행 후 좌하단 패널·콘솔에 결과 출력
 */
(function () {
  'use strict';

  /* ===================== 규칙 상수 ===================== */

  var DURATION_MS = 30000;          // 라운드 제한 시간
  var TARGET_COUNT = 5;             // 목표 재료 배치 수
  var COLS = 5, ROWS = 4;
  var CELL_COUNT = COLS * ROWS;     // 20칸
  var WRONG_PENALTY_MS = 2000;      // 오답 시간 차감
  var WRONG_SCORE = 50;             // 오답 점수 차감
  var BASE_SCORE = 100;             // 정답 기본 점수
  var MULTIPLIERS = [1, 1.25, 1.5, 1.75, 2];
  var TIME_BONUS_PER_SEC = 10;      // 승리 시 남은 초당 보너스
  var WRONG_FEEDBACK_MS = 450;      // 오답 표식 유지 시간(해당 칸 입력 잠금)
  var MAX_DISTRACTOR_COPIES = 4;    // 오답 재료는 최대 4칸 — 목표만 유일하게 5칸
  var MIN_DISTRACTOR_TYPES = 5, MAX_DISTRACTOR_TYPES = 8;

  /* ===================== 오리지널 재료 에셋 =====================
   * 20종 모두 자체 제작 인라인 SVG(viewBox 0 0 64 64).
   * family = 실루엣 계열. 목표와 같은 계열은 같은 라운드의 오답으로 쓰지 않는다.
   */

  var INGREDIENTS = [
    { id: 'carrot', name: '당근', family: 'cone', svg:
      '<path d="M25 17c-4-5-10-6-14-5 2 5 7 8 13 8zM39 17c4-5 10-6 14-5-2 5-7 8-13 8z" fill="#4f9d5a"/>' +
      '<path d="M32 15c6 0 9 3 9 6 0 6-5 22-9 33-4-11-9-27-9-33 0-3 3-6 9-6z" fill="#ec7a2c"/>' +
      '<path d="M26 27h11M27 35h9M29 43h5" stroke="#bd5c15" stroke-width="2" stroke-linecap="round" fill="none"/>' },
    { id: 'chili', name: '고추', family: 'cone', svg:
      '<path d="M36 21c3 12 0 23-8 29-6 4-13 4-16 0 7 0 13-3 17-9 4-7 6-13 5-20z" fill="#d8382c"/>' +
      '<path d="M35 21c-1-5 2-8 6-9-2 3-1 5 1 7z" fill="#4f9147"/>' +
      '<path d="M28 30c2 6 1 12-3 17" stroke="#a5231a" stroke-width="2" stroke-linecap="round" fill="none"/>' },
    { id: 'onion', name: '양파', family: 'bulb', svg:
      '<path d="M32 19c9 0 16 8 16 17s-7 15-16 15-16-6-16-15 7-17 16-17z" fill="#d9b3d2"/>' +
      '<path d="M32 19v32M23 24c-4 8-4 20 0 27M41 24c4 8 4 20 0 27" stroke="#a4779c" stroke-width="1.7" fill="none"/>' +
      '<path d="M32 19c-1-5-4-8-8-10 5-1 10 2 12 6 2-3 5-4 8-4-3 3-4 6-4 8z" fill="#6a9f6a"/>' },
    { id: 'garlic', name: '마늘', family: 'bulb', svg:
      '<path d="M32 12c3 5 3 8 3 8 8 3 13 10 13 18 0 8-7 13-16 13s-16-5-16-13c0-8 5-15 13-18 0 0 0-3 3-8z" fill="#f3edf3" stroke="#c5b6c5" stroke-width="1.6"/>' +
      '<path d="M32 22v27M23 28c-3 7-3 15 0 20M41 28c3 7 3 15 0 20" stroke="#c5b6c5" stroke-width="1.5" fill="none"/>' },
    { id: 'mushroom', name: '버섯', family: 'stalk', svg:
      '<path d="M13 35c0-12 9-20 19-20s19 8 19 20z" fill="#c25545"/>' +
      '<circle cx="24" cy="27" r="3.4" fill="#f4e6d4"/><circle cx="38" cy="24" r="2.6" fill="#f4e6d4"/><circle cx="43" cy="31" r="2.2" fill="#f4e6d4"/>' +
      '<path d="M25 35h14v11c0 4-3 7-7 7s-7-3-7-7z" fill="#f0e2cf"/>' },
    { id: 'broccoli', name: '브로콜리', family: 'stalk', svg:
      '<path d="M28 33h8v17c0 3-2 4-4 4s-4-1-4-4z" fill="#93c07a"/>' +
      '<circle cx="22" cy="29" r="10" fill="#3f7f3f"/><circle cx="42" cy="29" r="10" fill="#3f7f3f"/><circle cx="32" cy="21" r="11" fill="#4f9950"/>' },
    { id: 'corn', name: '옥수수', family: 'long', svg:
      '<path d="M21 33c-7 4-9 13-7 20 7-2 11-9 12-15z" fill="#6fa85a"/>' +
      '<path d="M43 33c7 4 9 13 7 20-7-2-11-9-12-15z" fill="#6fa85a"/>' +
      '<ellipse cx="32" cy="33" rx="10" ry="20" fill="#f0c53c"/>' +
      '<path d="M25 24h14M24 32h16M25 40h14M27 48h10" stroke="#c99a17" stroke-width="1.6" stroke-linecap="round" fill="none"/>' },
    { id: 'pumpkin', name: '호박', family: 'lumpy', svg:
      '<path d="M29 21h6v-7h-6z" fill="#5f7f42"/>' +
      '<ellipse cx="32" cy="38" rx="22" ry="16" fill="#e8862b"/>' +
      '<path d="M32 22v32M21 25c-4 8-4 18 0 26M43 25c4 8 4 18 0 26" stroke="#c26512" stroke-width="1.8" fill="none"/>' },
    { id: 'potato', name: '감자', family: 'lumpy', svg:
      '<path d="M17 34c1-11 10-17 18-15 10 2 13 9 12 18-1 10-9 16-17 15-9-1-14-8-13-18z" fill="#c99a5f"/>' +
      '<ellipse cx="26" cy="31" rx="2.6" ry="2" fill="#a2743f"/><ellipse cx="37" cy="26" rx="2.2" ry="1.7" fill="#a2743f"/>' +
      '<ellipse cx="34" cy="41" rx="2.6" ry="2" fill="#a2743f"/><ellipse cx="24" cy="43" rx="2" ry="1.6" fill="#a2743f"/>' },
    { id: 'tomato', name: '토마토', family: 'round', svg:
      '<circle cx="32" cy="37" r="18" fill="#df4630"/>' +
      '<path d="M24 30c-2 3-3 6-3 9" stroke="#f5a091" stroke-width="3" stroke-linecap="round" fill="none"/>' +
      '<path d="M32 19l-5 4-7-4 4 8-8 1 8 3 8-3 8 3 8-3-8-1 4-8-7 4z" fill="#4f9147"/>' },
    { id: 'apple', name: '사과', family: 'round', svg:
      '<path d="M32 24c4-4 13-5 16 2 3 7 1 19-6 27-3 4-7 4-10 2-3 2-7 2-10-2-7-8-9-20-6-27 3-7 12-6 16-2z" fill="#d43b3b"/>' +
      '<path d="M31 24c0-5 1-8 3-11 1 4 1 8 0 11z" fill="#7a4a25"/>' +
      '<path d="M35 17c4-4 9-5 12-4-1 5-6 8-11 7z" fill="#4f9147"/>' },
    { id: 'pear', name: '배', family: 'pear', svg:
      '<path d="M32 20c3 0 5 3 5 6 0 5 9 8 9 19 0 9-6 14-14 14s-14-5-14-14c0-11 9-14 9-19 0-3 2-6 5-6z" fill="#d8d060"/>' +
      '<path d="M32 20v-7" stroke="#7a5c2b" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M33 15c4-4 9-4 12-3-2 5-7 7-11 6z" fill="#4f9147"/>' },
    { id: 'eggplant', name: '가지', family: 'pear', svg:
      '<path d="M38 24c8 3 11 10 11 17 0 8-7 14-16 14s-15-6-15-13c0-9 7-15 15-18z" fill="#6b3f8f"/>' +
      '<path d="M31 25c-4-4-9-5-13-4 2 5 7 8 12 8zM33 24c1-4 4-7 8-8-1 4-1 6 0 8z" fill="#4f9147"/>' +
      '<path d="M26 34c-2 5-2 10 0 14" stroke="#a37fc0" stroke-width="2.4" stroke-linecap="round" fill="none"/>' },
    { id: 'fish', name: '생선', family: 'fish', svg:
      '<path d="M14 33l-9-9v19z" fill="#5a83a5"/>' +
      '<path d="M14 33c8-10 22-14 32-10 6 3 9 7 9 10s-3 8-9 10c-10 4-24 0-32-10z" fill="#84a9c8"/>' +
      '<path d="M30 22c2 6 2 16 0 22" stroke="#5a83a5" stroke-width="2" fill="none"/>' +
      '<circle cx="47" cy="30" r="2.6" fill="#1e3245"/>' },
    { id: 'bread', name: '빵', family: 'loaf', svg:
      '<path d="M12 42c0-15 9-22 20-22s20 7 20 22z" fill="#c98a4b"/>' +
      '<rect x="11" y="40" width="42" height="9" rx="4" fill="#a96a34"/>' +
      '<path d="M23 33l6-7M33 32l6-7" stroke="#9d5e28" stroke-width="2.6" stroke-linecap="round" fill="none"/>' },
    { id: 'cheese', name: '치즈', family: 'wedge', svg:
      '<path d="M11 44V33l42-11v22z" fill="#f2c94c" stroke="#cfa129" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M11 33l42-11" stroke="#cfa129" stroke-width="2"/>' +
      '<circle cx="27" cy="37" r="3.4" fill="#d8a92e"/><circle cx="41" cy="34" r="2.4" fill="#d8a92e"/><circle cx="18" cy="40" r="2" fill="#d8a92e"/>' },
    { id: 'egg', name: '달걀', family: 'oval', svg:
      '<path d="M32 13c9 0 15 13 15 22 0 10-6 16-15 16s-15-6-15-16c0-9 6-22 15-22z" fill="#f7f1e4" stroke="#d5c8b0" stroke-width="1.6"/>' +
      '<path d="M25 33l5 4-4 4 6 4" stroke="#c9b99b" stroke-width="2" fill="none" stroke-linecap="round"/>' },
    { id: 'chestnut', name: '밤', family: 'oval', svg:
      '<path d="M32 15c11 7 17 15 17 23 0 6-8 10-17 10s-17-4-17-10c0-8 6-16 17-23z" fill="#8a5227"/>' +
      '<path d="M17 42c4 4 9 6 15 6s11-2 15-6c0 5-7 8-15 8s-15-3-15-8z" fill="#e8d2ac"/>' +
      '<path d="M32 15c-1-4 0-6 2-8-3 1-4 4-4 8z" fill="#5d3616"/>' },
    { id: 'milk', name: '우유', family: 'carton', svg:
      '<path d="M20 27h24v27a3 3 0 01-3 3H23a3 3 0 01-3-3z" fill="#eef3f7"/>' +
      '<path d="M20 27l12-13 12 13z" fill="#cadcea"/>' +
      '<rect x="20" y="38" width="24" height="8" fill="#5b8fc4"/>' },
    { id: 'honey', name: '꿀', family: 'jar', svg:
      '<path d="M20 29h24v22a5 5 0 01-5 5H25a5 5 0 01-5-5z" fill="#e8a72a"/>' +
      '<rect x="17" y="21" width="30" height="9" rx="3" fill="#9c5f1c"/>' +
      '<path d="M32 36l6 3.5v7L32 50l-6-3.5v-7z" fill="#f8dd97"/>' }
  ];

  var BY_ID = {};
  INGREDIENTS.forEach(function (ing) { BY_ID[ing.id] = ing; });

  /* ===================== 순수 함수 (테스트 대상) ===================== */

  // mulberry32 — 짧고 재현 가능한 PRNG
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, rng) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    }
    return list;
  }

  /** 20칸 보드를 만든다. 목표 5칸 + 오답 15칸(5~8종, 종당 최대 4칸). */
  function createRound(seed) {
    var rng = makeRng(seed);
    var target = INGREDIENTS[Math.floor(rng() * INGREDIENTS.length)];

    var pool = shuffle(INGREDIENTS.filter(function (ing) {
      return ing.family !== target.family;
    }), rng);

    var typeCount = MIN_DISTRACTOR_TYPES +
      Math.floor(rng() * (MAX_DISTRACTOR_TYPES - MIN_DISTRACTOR_TYPES + 1));
    typeCount = Math.min(typeCount, pool.length);
    var types = pool.slice(0, typeCount);

    var counts = types.map(function () { return 1; });
    var remaining = CELL_COUNT - TARGET_COUNT - types.length;
    var guard = 0;
    while (remaining > 0 && guard++ < 400) {          // 무작위 분배
      var i = Math.floor(rng() * types.length);
      if (counts[i] < MAX_DISTRACTOR_COPIES) { counts[i]++; remaining--; }
    }
    for (var k = 0; remaining > 0 && k < types.length; k++) {  // 결정적 마무리(종료 보장)
      while (counts[k] < MAX_DISTRACTOR_COPIES && remaining > 0) { counts[k]++; remaining--; }
    }

    var cells = [];
    for (var t = 0; t < TARGET_COUNT; t++) cells.push({ ingredientId: target.id, isTarget: true });
    types.forEach(function (ing, idx) {
      for (var c = 0; c < counts[idx]; c++) cells.push({ ingredientId: ing.id, isTarget: false });
    });
    shuffle(cells, rng);

    cells.forEach(function (cell, idx) {
      cell.id = idx;
      cell.row = Math.floor(idx / COLS) + 1;
      cell.col = (idx % COLS) + 1;
      cell.state = 'available';
    });

    return { seed: seed >>> 0, targetId: target.id, cells: cells };
  }

  function multiplierFor(streak) {
    return MULTIPLIERS[Math.min(streak, MULTIPLIERS.length - 1)];
  }
  function correctScore(streak) {
    return Math.round(BASE_SCORE * multiplierFor(streak));
  }
  function applyWrongScore(score) {
    return Math.max(0, score - WRONG_SCORE);
  }
  function timeBonus(remainMs) {
    return Math.floor(Math.max(0, remainMs) / 1000) * TIME_BONUS_PER_SEC;
  }

  /* ===================== DOM 참조 ===================== */

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    shell: $('shell'), board: $('board'), defs: $('spriteDefs'),
    goal: $('goal'), goalIcon: $('goalIcon'), goalName: $('goalName'), foundNum: $('foundNum'),
    timeNum: $('timeNum'), timeFill: $('timeFill'),
    scoreNum: $('scoreNum'), comboNum: $('comboNum'), comboChip: $('comboChip'),
    basket: $('basket'), hint: $('hint'), live: $('live'), muteBtn: $('muteBtn'),
    result: $('result'), resultCard: $('resultCard'), resultArt: $('resultArt'),
    resultTitle: $('resultTitle'), resultDesc: $('resultDesc'),
    rScore: $('rScore'), rFound: $('rFound'), rTime: $('rTime'), rBonus: $('rBonus'),
    replayBtn: $('replayBtn'), moreBtn: $('moreBtn')
  };

  /* ===================== 상태 ===================== */

  var params = new URLSearchParams(location.search);
  var pinnedSeed = null;
  if (params.has('seed')) {
    var parsed = parseInt(params.get('seed'), 10);
    if (!isNaN(parsed)) pinnedSeed = parsed >>> 0;
  }

  var S = {
    phase: 'BOOT',
    seed: 0, targetId: null, cells: [],
    found: 0, score: 0, streak: 0,
    startedAt: 0, pausedAccum: 0, pauseStart: 0, penaltyMs: 0,
    frozenRemain: DURATION_MS, bonus: 0,
    focusIndex: 0, muted: false, raf: 0,
    announced10: false, announced5: false
  };

  var cellNodes = [];
  var wrongTimers = {};

  function clock() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  function remainingMs() {
    if (S.phase === 'BOOT' || S.phase === 'READY') return DURATION_MS;
    if (S.phase === 'WON' || S.phase === 'LOST' || S.phase === 'RESOLVING') return S.frozenRemain;
    var now = clock();
    var paused = S.pausedAccum + (S.pauseStart ? now - S.pauseStart : 0);
    return DURATION_MS - (now - S.startedAt - paused) - S.penaltyMs;
  }

  /* ===================== 오디오 ===================== */

  var actx = null;
  var userGesture = false;            // 실제 입력 전에는 AudioContext를 만들지 않는다
  function markGesture() { userGesture = true; }

  function audioCtx() {
    if (S.muted || !userGesture) return null;
    if (!actx) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      try { actx = new Ctor(); } catch (e) { actx = null; return null; }
    }
    if (actx.state === 'suspended') { try { actx.resume(); } catch (e) {} }
    return actx;
  }
  function tone(freq, startAt, dur, gain, type) {
    var ctx = audioCtx();
    if (!ctx) return;
    var t0 = ctx.currentTime + startAt;
    var osc = ctx.createOscillator();
    var amp = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp); amp.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  var sfx = {
    correct: function () { tone(660, 0, 0.1, 0.16); tone(880, 0.07, 0.14, 0.14); },
    wrong: function () { tone(150, 0, 0.2, 0.18, 'triangle'); },
    win: function () { tone(523, 0, 0.14, 0.16); tone(659, 0.11, 0.14, 0.16); tone(784, 0.22, 0.26, 0.18); },
    lose: function () { tone(300, 0, 0.2, 0.14, 'triangle'); tone(190, 0.16, 0.34, 0.14, 'triangle'); }
  };

  function loadMuted() {
    try { return localStorage.getItem('winter-pantry-muted') === '1'; } catch (e) { return false; }
  }
  function saveMuted(v) {
    try { localStorage.setItem('winter-pantry-muted', v ? '1' : '0'); } catch (e) {}
  }

  /* ===================== 스프라이트·렌더 ===================== */

  function symbolId(ingredientId) { return 'ing-' + ingredientId; }

  function buildSprite(usedIds) {
    var out = '';
    usedIds.forEach(function (id) {
      out += '<symbol id="' + symbolId(id) + '" viewBox="0 0 64 64">' + BY_ID[id].svg + '</symbol>';
    });
    el.defs.innerHTML = out;
  }

  function iconMarkup(ingredientId) {
    return '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="#' +
      symbolId(ingredientId) + '"></use></svg>';
  }

  function say(text) {
    el.live.textContent = '';
    // 같은 문구 반복도 읽히도록 다음 프레임에 넣는다.
    window.setTimeout(function () { el.live.textContent = text; }, 20);
  }

  function setHint(text, tone) {
    el.hint.textContent = text;
    if (tone) el.hint.setAttribute('data-tone', tone);
    else el.hint.removeAttribute('data-tone');
  }

  function renderBoard() {
    el.board.innerHTML = '';
    cellNodes = [];
    S.cells.forEach(function (cell) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell';
      btn.dataset.id = String(cell.id);
      btn.dataset.state = 'available';
      btn.tabIndex = cell.id === 0 ? 0 : -1;
      var ing = BY_ID[cell.ingredientId];
      btn.innerHTML = iconMarkup(cell.ingredientId) + '<span class="tag">' + ing.name + '</span>';
      btn.setAttribute('aria-label', cell.row + '행 ' + cell.col + '열, ' + ing.name);
      el.board.appendChild(btn);
      cellNodes.push(btn);
    });
    S.focusIndex = 0;
  }

  function renderBasket() {
    var out = '';
    for (var i = 0; i < TARGET_COUNT; i++) {
      out += '<span class="slot"' + (i < S.found ? ' data-filled="1">' + iconMarkup(S.targetId) : '>') + '</span>';
    }
    el.basket.innerHTML = out;
  }

  function renderHud() {
    var ing = BY_ID[S.targetId];
    el.goalIcon.innerHTML = iconMarkup(S.targetId);
    el.goalName.textContent = ing.name;
    el.foundNum.textContent = String(S.found);
    el.scoreNum.textContent = String(S.score);
    var mult = multiplierFor(S.streak);
    el.comboNum.textContent = '×' + mult.toFixed(2);
    el.comboChip.setAttribute('data-hot', mult > 1 ? '1' : '0');
    el.shell.setAttribute('data-phase', S.phase);
  }

  function renderTime(remain) {
    var clamped = Math.max(0, remain);
    el.timeNum.textContent = (clamped / 1000).toFixed(1) + '초';
    el.timeFill.style.setProperty('--p', String(clamped / DURATION_MS));
    el.shell.setAttribute('data-low', clamped <= 10000 ? '1' : '0');
  }

  /* ===================== 라운드 진행 ===================== */

  function newSeed() {
    if (pinnedSeed !== null) return pinnedSeed;
    var buf = new Uint32Array(1);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(buf);
    else buf[0] = (Math.random() * 0xffffffff) >>> 0;
    return buf[0];
  }

  function startRound() {
    stopClock();
    Object.keys(wrongTimers).forEach(function (k) { clearTimeout(wrongTimers[k]); });
    wrongTimers = {};

    var round = createRound(newSeed());
    S.phase = 'READY';
    S.seed = round.seed;
    S.targetId = round.targetId;
    S.cells = round.cells;
    S.found = 0; S.score = 0; S.streak = 0;
    S.startedAt = 0; S.pausedAccum = 0; S.pauseStart = 0; S.penaltyMs = 0;
    S.frozenRemain = DURATION_MS; S.bonus = 0;
    S.announced10 = false; S.announced5 = false;

    var used = {};
    S.cells.forEach(function (c) { used[c.ingredientId] = true; });
    buildSprite(Object.keys(used));

    renderBoard();
    renderBasket();
    renderHud();
    renderTime(DURATION_MS);
    el.goal.setAttribute('data-pulse', '1');
    setHint('같은 재료 5개를 찾아요. 아무 칸이나 누르면 시작합니다.');
    say(BY_ID[S.targetId].name + ' 5개를 찾으세요. 준비되었습니다.');
  }

  function startPlaying() {
    S.phase = 'PLAYING';
    S.startedAt = clock();
    el.goal.removeAttribute('data-pulse');
    setHint('남은 시간 안에 ' + BY_ID[S.targetId].name + ' 5개를 모두 찾으세요.');
    el.shell.setAttribute('data-phase', 'PLAYING');
    tickLoop();
  }

  function tickLoop() {
    stopClock();
    S.raf = window.requestAnimationFrame(function step() {
      if (S.phase !== 'PLAYING') return;
      var remain = remainingMs();
      renderTime(remain);
      if (!S.announced10 && remain <= 10000 && remain > 5000) {
        S.announced10 = true; say('10초 남았습니다.');
      } else if (!S.announced5 && remain <= 5000 && remain > 0) {
        S.announced5 = true; say('5초 남았습니다.');
      }
      if (remain <= 0) { finish('LOST'); return; }
      S.raf = window.requestAnimationFrame(step);
    });
  }

  function stopClock() {
    if (S.raf) { window.cancelAnimationFrame(S.raf); S.raf = 0; }
  }

  /** 종료는 단 한 번만 — 마지막 정답과 타이머 만료가 경합해도 먼저 확정된 쪽이 이긴다. */
  function finish(result) {
    if (S.phase === 'RESOLVING' || S.phase === 'WON' || S.phase === 'LOST') return false;
    var remain = Math.max(0, remainingMs());   // 시계를 멈추기 전에 읽는다
    S.phase = 'RESOLVING';
    stopClock();

    S.frozenRemain = remain;
    S.bonus = 0;
    if (result === 'WON') {
      S.bonus = timeBonus(remain);
      S.score += S.bonus;
    }
    S.phase = result;
    renderHud();
    renderTime(remain);
    showResult(result);
    if (result === 'WON') sfx.win(); else sfx.lose();
    return true;
  }

  function flyToBasket(node) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var slots = el.basket.querySelectorAll('.slot');
    var target = slots[Math.min(S.found, TARGET_COUNT) - 1];
    if (!target) return;
    var from = node.getBoundingClientRect();
    var to = target.getBoundingClientRect();
    var ghost = document.createElement('div');
    ghost.className = 'fly';
    ghost.innerHTML = iconMarkup(S.targetId);
    ghost.style.left = from.left + from.width / 2 - 20 + 'px';
    ghost.style.top = from.top + from.height / 2 - 20 + 'px';
    document.body.appendChild(ghost);
    // 다음 프레임에 목표 위치로 이동
    window.requestAnimationFrame(function () {
      ghost.style.transform = 'translate(' +
        (to.left + to.width / 2 - from.left - from.width / 2) + 'px,' +
        (to.top + to.height / 2 - from.top - from.height / 2) + 'px) scale(0.55)';
      ghost.style.opacity = '0.2';
    });
    window.setTimeout(function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 380);
  }

  function selectCell(id) {
    if (S.phase !== 'READY' && S.phase !== 'PLAYING') return;
    var cell = S.cells[id];
    var node = cellNodes[id];
    if (!cell || !node) return;
    if (cell.state === 'collected' || cell.state === 'wrong') return;  // 중복 집계·중복 차감 방지

    if (S.phase === 'READY') startPlaying();

    if (cell.isTarget) {
      cell.state = 'collected';
      var gained = correctScore(S.streak);
      S.score += gained;
      S.streak += 1;
      S.found += 1;

      node.dataset.state = 'collected';
      node.setAttribute('aria-disabled', 'true');
      node.setAttribute('aria-label', cell.row + '행 ' + cell.col + '열, ' +
        BY_ID[cell.ingredientId].name + ', 수집 완료');
      node.dataset.hit = '1';
      window.setTimeout(function () { node.removeAttribute('data-hit'); }, 240);

      renderBasket();
      flyToBasket(node);
      renderHud();
      sfx.correct();
      setHint('좋아요! ' + BY_ID[S.targetId].name + ' ' + S.found + '개 수집 (+' + gained + '점)', 'good');
      say(BY_ID[S.targetId].name + ' ' + S.found + '개 수집, ' + gained + '점 획득.');

      if (S.found >= TARGET_COUNT) finish('WON');
      return;
    }

    // 오답
    S.streak = 0;
    S.score = applyWrongScore(S.score);
    S.penaltyMs += WRONG_PENALTY_MS;
    cell.state = 'wrong';
    node.dataset.state = 'wrong';
    sfx.wrong();
    renderHud();
    setHint(BY_ID[cell.ingredientId].name + '은(는) 목표가 아니에요. 시간 2초, 점수 50점 차감.', 'bad');
    say('오답입니다. 시간 2초와 점수 50점이 줄었습니다.');

    wrongTimers[id] = window.setTimeout(function () {
      delete wrongTimers[id];
      if (S.cells[id] && S.cells[id].state === 'wrong') {
        S.cells[id].state = 'available';
        if (cellNodes[id]) cellNodes[id].dataset.state = 'available';
      }
    }, WRONG_FEEDBACK_MS);

    var remain = remainingMs();
    renderTime(remain);
    if (remain <= 0) finish('LOST');
  }

  /* ===================== 결과 ===================== */

  var SOUP_SVG =
    '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">' +
    '<path d="M18 20c0-4 2-7 3-10 1 3-1 5-1 8s2 4 2 7c-2-1-4-3-4-5z" fill="#cfe0ec" opacity=".8"/>' +
    '<path d="M31 18c0-4 2-7 3-10 1 3-1 5-1 8s2 5 2 8c-2-1-4-4-4-6z" fill="#cfe0ec" opacity=".8"/>' +
    '<path d="M44 20c0-4 2-7 3-10 1 3-1 5-1 8s2 4 2 7c-2-1-4-3-4-5z" fill="#cfe0ec" opacity=".8"/>' +
    '<path d="M8 36h48c0 12-11 20-24 20S8 48 8 36z" fill="#e8862b"/>' +
    '<rect x="6" y="32" width="52" height="6" rx="3" fill="#f2c94c"/>' +
    '</svg>';
  var EMBER_SVG =
    '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">' +
    '<rect x="10" y="30" width="44" height="24" rx="6" fill="#2b2b34"/>' +
    '<path d="M32 36c5 4 8 8 8 11 0 4-4 6-8 6s-8-2-8-6c0-3 3-7 8-11z" fill="#7a4a1c"/>' +
    '<path d="M12 24c4-3 8-4 12-3M40 21c4-1 8 0 12 3" stroke="#5b6b7c" stroke-width="3" stroke-linecap="round" fill="none"/>' +
    '</svg>';

  var lastFocused = null;

  function showResult(result) {
    var won = result === 'WON';
    lastFocused = document.activeElement;
    el.resultCard.dataset.outcome = won ? 'won' : 'lost';
    el.resultArt.innerHTML = won ? SOUP_SVG : EMBER_SVG;
    el.resultTitle.textContent = won ? '따뜻한 식사 완성!' : '난롯불이 꺼졌어요';
    el.resultDesc.textContent = won
      ? BY_ID[S.targetId].name + ' 5개를 모두 찾았습니다.'
      : BY_ID[S.targetId].name + '을(를) ' + S.found + '개만 찾았습니다. 다시 도전해 보세요.';
    el.rScore.textContent = String(S.score);
    el.rFound.textContent = S.found + ' / ' + TARGET_COUNT;
    el.rTime.textContent = (S.frozenRemain / 1000).toFixed(1) + '초';
    el.rBonus.textContent = won && S.bonus > 0
      ? '시간 보너스 +' + S.bonus + '점 (남은 ' + Math.floor(S.frozenRemain / 1000) + '초 × 10)'
      : '';
    el.result.hidden = false;
    setHint(won ? '식사를 완성했습니다.' : '시간이 모두 지났습니다.', won ? 'good' : 'bad');
    say((won ? '성공. ' : '실패. ') + '총점 ' + S.score + '점, ' + S.found + '개 수집.');
    window.setTimeout(function () { el.resultTitle.focus(); }, 40);
  }

  function hideResult() {
    el.result.hidden = true;
  }

  function restart() {
    hideResult();
    startRound();
    window.setTimeout(function () {
      if (cellNodes[0]) { setFocus(0); cellNodes[0].focus(); }
    }, 20);
  }

  /* ===================== 입력 ===================== */

  function setFocus(index) {
    if (!cellNodes.length) return;
    var next = Math.max(0, Math.min(CELL_COUNT - 1, index));
    cellNodes.forEach(function (n, i) { n.tabIndex = i === next ? 0 : -1; });
    S.focusIndex = next;
  }

  el.board.addEventListener('click', function (ev) {
    markGesture();
    var btn = ev.target.closest ? ev.target.closest('.cell') : null;
    if (!btn) return;
    var id = parseInt(btn.dataset.id, 10);
    setFocus(id);
    selectCell(id);
  });

  el.board.addEventListener('keydown', function (ev) {
    markGesture();
    var keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (keys.indexOf(ev.key) === -1) return;
    ev.preventDefault();
    var i = S.focusIndex;
    var row = Math.floor(i / COLS), col = i % COLS;
    if (ev.key === 'ArrowLeft') col = Math.max(0, col - 1);
    else if (ev.key === 'ArrowRight') col = Math.min(COLS - 1, col + 1);
    else if (ev.key === 'ArrowUp') row = Math.max(0, row - 1);
    else if (ev.key === 'ArrowDown') row = Math.min(ROWS - 1, row + 1);
    else if (ev.key === 'Home') col = 0;
    else if (ev.key === 'End') col = COLS - 1;
    var next = row * COLS + col;
    setFocus(next);
    cellNodes[next].focus();
  });

  // 결과 모달 포커스 유지 — 필수 결과 화면이라 Escape로 닫지 않는다.
  el.result.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Tab') return;
    var focusables = [el.replayBtn, el.moreBtn];
    var idx = focusables.indexOf(document.activeElement);
    ev.preventDefault();
    var next = ev.shiftKey ? idx - 1 : idx + 1;
    if (idx === -1) next = 0;
    if (next < 0) next = focusables.length - 1;
    if (next >= focusables.length) next = 0;
    focusables[next].focus();
  });

  el.replayBtn.addEventListener('click', restart);

  el.muteBtn.addEventListener('click', function () { markGesture(); setMuted(!S.muted); });

  function setMuted(v) {
    S.muted = v;
    saveMuted(v);
    el.muteBtn.setAttribute('aria-pressed', v ? 'true' : 'false');
    el.muteBtn.textContent = v ? '소리 꺼짐' : '소리 켜기';
    if (v && actx) { try { actx.suspend(); } catch (e) {} }
  }

  document.addEventListener('keydown', function (ev) {
    markGesture();
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    var k = ev.key.toLowerCase();
    if (k === 'm') { ev.preventDefault(); setMuted(!S.muted); return; }
    if (k === 'r' && (S.phase === 'WON' || S.phase === 'LOST')) { ev.preventDefault(); restart(); }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (S.phase === 'PLAYING' && !S.pauseStart) {
        S.pauseStart = clock();
        stopClock();
        setHint('일시정지 — 화면으로 돌아오면 이어집니다.');
      }
    } else if (S.pauseStart) {
      S.pausedAccum += clock() - S.pauseStart;
      S.pauseStart = 0;
      if (S.phase === 'PLAYING') {
        setHint('이어서 진행합니다. ' + BY_ID[S.targetId].name + ' ' + (TARGET_COUNT - S.found) + '개 남음');
        tickLoop();
      }
    }
  });

  /* ===================== 자기 테스트 (?test=1) ===================== */

  function runSelfTest() {
    var lines = [], pass = 0, fail = 0;
    function ok(cond, label) {
      if (cond) { pass++; lines.push('<b>PASS</b> ' + label); }
      else { fail++; lines.push('<i>FAIL</i> ' + label); }
    }

    for (var s = 1; s <= 60; s++) {
      var r = createRound(s * 7919);
      var targets = r.cells.filter(function (c) { return c.isTarget; });
      var distractors = r.cells.filter(function (c) { return !c.isTarget; });
      if (r.cells.length !== CELL_COUNT) { ok(false, 'seed ' + s + ' 칸 수 20'); break; }
      if (targets.length !== TARGET_COUNT) { ok(false, 'seed ' + s + ' 목표 5칸'); break; }

      var counts = {}, familyClash = false;
      distractors.forEach(function (c) {
        counts[c.ingredientId] = (counts[c.ingredientId] || 0) + 1;
        if (BY_ID[c.ingredientId].family === BY_ID[r.targetId].family) familyClash = true;
      });
      var typeIds = Object.keys(counts);
      var over = typeIds.some(function (id) { return counts[id] > MAX_DISTRACTOR_COPIES; });
      if (familyClash) { ok(false, 'seed ' + s + ' 동일 실루엣 계열 혼입'); break; }
      if (over) { ok(false, 'seed ' + s + ' 오답 재료가 5칸 이상'); break; }
      if (typeIds.length < MIN_DISTRACTOR_TYPES || typeIds.length > MAX_DISTRACTOR_TYPES) {
        ok(false, 'seed ' + s + ' 오답 종류 5~8'); break;
      }
      if (s === 60) {
        ok(true, '60개 seed 모두 20칸/목표 5칸/오답 5~8종·종당 ≤4칸/동일계열 없음');
      }
    }

    var a = createRound(123456), b = createRound(123456), c = createRound(123457);
    ok(a.targetId === b.targetId && a.cells.map(function (x) { return x.ingredientId; }).join() ===
       b.cells.map(function (x) { return x.ingredientId; }).join(), '같은 seed → 같은 보드 (재현성)');
    ok(a.cells.map(function (x) { return x.ingredientId; }).join() !==
       c.cells.map(function (x) { return x.ingredientId; }).join(), '다른 seed → 다른 보드');

    ok(correctScore(0) === 100 && correctScore(1) === 125 && correctScore(2) === 150 &&
       correctScore(3) === 175 && correctScore(4) === 200, '콤보 점수 100·125·150·175·200');
    ok(correctScore(9) === 200 && multiplierFor(50) === 2, '콤보 배수 상한 2.00');
    ok(applyWrongScore(30) === 0 && applyWrongScore(0) === 0 && applyWrongScore(200) === 150,
       '오답 점수 −50, 하한 0');
    ok(timeBonus(12400) === 120 && timeBonus(999) === 0 && timeBonus(-5) === 0,
       '시간 보너스 floor(초)×10');
    ok(WRONG_PENALTY_MS === 2000 && DURATION_MS === 30000, '제한 30초 · 오답 −2초');

    // 종료 1회 가드
    var savedPhase = S.phase;
    S.phase = 'PLAYING'; S.startedAt = clock(); S.frozenRemain = 0;
    var first = finish('WON'), second = finish('LOST');
    ok(first === true && second === false && S.phase === 'WON', 'finishOnce — 승리 확정 후 실패로 덮이지 않음');
    hideResult();
    S.phase = savedPhase;

    var panel = document.createElement('div');
    panel.className = 'test-panel';
    panel.setAttribute('role', 'note');
    panel.innerHTML = '윈터 팬트리 자기 테스트 — ' + pass + ' pass / ' + fail + ' fail\n' + lines.join('\n');
    document.body.appendChild(panel);
    (fail ? console.error : console.log)('[winter-pantry] self-test', pass + ' pass', fail + ' fail');
    return { pass: pass, fail: fail };
  }

  /* ===================== 부팅 ===================== */

  setMuted(loadMuted());
  startRound();
  if (params.get('test') === '1') {
    var res = runSelfTest();
    restart();
    if (res.fail === 0) console.log('[winter-pantry] all rule assertions passed');
  }

  // 개발·검증용 훅 (프로덕션 로직은 이 객체에 의존하지 않는다)
  window.WinterPantry = {
    state: S,
    createRound: createRound,
    correctScore: correctScore,
    applyWrongScore: applyWrongScore,
    timeBonus: timeBonus,
    selectCell: selectCell,
    restart: restart,
    remainingMs: remainingMs,
    forceExpire: function () {                 // 테스트에서 타이머를 즉시 만료시킨다
      if (S.phase === 'PLAYING') { S.penaltyMs += DURATION_MS; }
    }
  };
})();
