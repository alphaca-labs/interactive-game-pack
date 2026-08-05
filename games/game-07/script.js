/* 키친 타이디 (Kitchen Tidy) — 독립 실행 프로토타입
 * 외부 라이브러리·이미지·폰트·음원 요청 0건. 아이콘은 인라인 SVG, 소리는 Web Audio 합성.
 * 계획서: outputs/plans/kitchen-tidy.md
 */
(function () {
  'use strict';

  /* ===================== 상수 ===================== */

  var COLS = 4;
  var ROWS = 6;
  var PER_TYPE = 3;
  var TYPES_PER_ROUND = 8;
  var TOTAL_TOOLS = TYPES_PER_ROUND * PER_TYPE; // 24
  var BASKET_MAX = 7;
  var ROUND_MS = 35000;
  var COMBO_WINDOW_MS = 4000;
  var COMBO_STEP = 25;
  var COMBO_MAX_STEP = 3;
  var BASE_POINTS = 100;
  var TIME_BONUS_PER_SEC = 10;
  var HINT_READY_MS = 7000;
  var HINT_COST = 100;
  var HINT_SHOW_MS = 1200;
  var MOVE_MS = 180;

  /* ===================== 조리도구 12종 (오리지널 인라인 SVG) ===================== */

  var TOOL_LIBRARY = [
    {
      id: 'pan', ko: '프라이팬',
      svg: '<circle cx="19" cy="27" r="12.6" fill="#6b7f96" stroke="#2c3a4b" stroke-width="2"/>' +
           '<circle cx="19" cy="27" r="7.6" fill="#46586e"/>' +
           '<path d="M30.2 22.4 42.5 14.6" stroke="#2c3a4b" stroke-width="4.6" stroke-linecap="round"/>'
    },
    {
      id: 'pot', ko: '냄비',
      svg: '<path d="M11 19h26v15a6 6 0 0 1-6 6H17a6 6 0 0 1-6-6z" fill="#d0705f" stroke="#6f2f24" stroke-width="2"/>' +
           '<path d="M11 26H5.5M37 26h5.5" stroke="#6f2f24" stroke-width="3.2" stroke-linecap="round"/>' +
           '<rect x="7" y="13.5" width="34" height="5.5" rx="2.7" fill="#a94e3f" stroke="#6f2f24" stroke-width="1.6"/>' +
           '<rect x="21" y="7" width="6" height="6" rx="3" fill="#6f2f24"/>'
    },
    {
      id: 'spatula', ko: '주걱',
      svg: '<path d="M16.5 28h15v6.5A7.5 7.5 0 0 1 24 42a7.5 7.5 0 0 1-7.5-7.5z" fill="#e0b45c" stroke="#7a5514" stroke-width="2"/>' +
           '<rect x="20.8" y="5" width="6.4" height="24" rx="3.2" fill="#c08f34" stroke="#7a5514" stroke-width="1.6"/>' +
           '<circle cx="24" cy="9" r="1.9" fill="#7a5514"/>'
    },
    {
      id: 'whisk', ko: '거품기',
      svg: '<rect x="20.6" y="4" width="6.8" height="15" rx="3.4" fill="#8e99a6" stroke="#4a545f" stroke-width="1.6"/>' +
           '<path d="M24 19c-8.5 3.4-11.5 10.5-8 24M24 19c8.5 3.4 11.5 10.5 8 24M24 19v24" fill="none" stroke="#4a545f" stroke-width="2.1" stroke-linecap="round"/>' +
           '<path d="M15.5 30.5c5.6 3.2 11.4 3.2 17 0" fill="none" stroke="#4a545f" stroke-width="2.1" stroke-linecap="round"/>'
    },
    {
      id: 'bowl', ko: '그릇',
      svg: '<path d="M6.5 22h35c0 11.6-7.9 19-17.5 19S6.5 33.6 6.5 22z" fill="#7fb69b" stroke="#2c5a48" stroke-width="2"/>' +
           '<ellipse cx="24" cy="22" rx="17.5" ry="4.8" fill="#55937b" stroke="#2c5a48" stroke-width="1.6"/>' +
           '<path d="M13 30.5c2.4 4.6 6.2 6.8 11 6.8" fill="none" stroke="#e9f4ef" stroke-width="1.8" stroke-linecap="round"/>'
    },
    {
      id: 'mug', ko: '머그',
      svg: '<path d="M9.5 13.5h22.5V36a5 5 0 0 1-5 5H14.5a5 5 0 0 1-5-5z" fill="#d99ab5" stroke="#74304f" stroke-width="2"/>' +
           '<rect x="9.5" y="13.5" width="22.5" height="5.5" fill="#b96e91" stroke="#74304f" stroke-width="1.6"/>' +
           '<path d="M32 21h4.5a6.5 6.5 0 0 1 0 13H32" fill="none" stroke="#74304f" stroke-width="3.2"/>'
    },
    {
      id: 'kettle', ko: '주전자',
      svg: '<path d="M14 21h20a9 9 0 0 1 9 9v3.5a6.5 6.5 0 0 1-6.5 6.5H11.5A6.5 6.5 0 0 1 5 33.5V30a9 9 0 0 1 9-9z" fill="#8f8ec6" stroke="#3b3a6b" stroke-width="2"/>' +
           '<path d="M13.5 27 4.5 20l2-3.4 9.2 6.6z" fill="#6a68a5" stroke="#3b3a6b" stroke-width="1.6" stroke-linejoin="round"/>' +
           '<path d="M16 21.5c2.5-9 13.5-9 16 0" fill="none" stroke="#3b3a6b" stroke-width="3.2" stroke-linecap="round"/>' +
           '<rect x="20.5" y="9" width="7" height="4.4" rx="2.2" fill="#3b3a6b"/>'
    },
    {
      id: 'toaster', ko: '토스터',
      svg: '<rect x="6.5" y="16" width="34" height="24" rx="6.5" fill="#e3906a" stroke="#7a3a1e" stroke-width="2"/>' +
           '<rect x="12" y="11.5" width="9" height="6" rx="2.4" fill="#c26a44" stroke="#7a3a1e" stroke-width="1.6"/>' +
           '<rect x="26" y="11.5" width="9" height="6" rx="2.4" fill="#c26a44" stroke="#7a3a1e" stroke-width="1.6"/>' +
           '<circle cx="33.5" cy="31.5" r="3.4" fill="#7a3a1e"/>' +
           '<path d="M43.5 22.5v8" stroke="#7a3a1e" stroke-width="3.4" stroke-linecap="round"/>'
    },
    {
      id: 'waffle', ko: '와플팬',
      svg: '<rect x="7" y="14" width="27" height="24" rx="5" fill="#c9a06a" stroke="#63431f" stroke-width="2"/>' +
           '<path d="M16 14v24M25 14v24M7 22h27M7 30h27" stroke="#a67c48" stroke-width="1.8"/>' +
           '<path d="M34 22.5h9.5" stroke="#63431f" stroke-width="4.2" stroke-linecap="round"/>'
    },
    {
      id: 'board', ko: '도마',
      svg: '<path d="M13.5 6h21a4.5 4.5 0 0 1 4.5 4.5v29a4.5 4.5 0 0 1-4.5 4.5h-21A4.5 4.5 0 0 1 9 39.5v-29A4.5 4.5 0 0 1 13.5 6z" fill="#d9b389" stroke="#7a5330" stroke-width="2"/>' +
           '<circle cx="24" cy="12" r="2.7" fill="none" stroke="#7a5330" stroke-width="2"/>' +
           '<path d="M13.5 21h21M13.5 27.5h21M13.5 34h21" stroke="#bb8f60" stroke-width="2" stroke-linecap="round"/>'
    },
    {
      id: 'mortar', ko: '절구',
      svg: '<path d="M9 24h30l-3.6 12.5A6 6 0 0 1 29.6 41H18.4a6 6 0 0 1-5.8-4.5z" fill="#a5aab3" stroke="#454a52" stroke-width="2"/>' +
           '<rect x="6" y="20" width="36" height="4.6" rx="2.3" fill="#7d838d" stroke="#454a52" stroke-width="1.6"/>' +
           '<path d="M32 6 22.5 20" stroke="#454a52" stroke-width="4.6" stroke-linecap="round"/>' +
           '<circle cx="21.5" cy="21.5" r="3.6" fill="#454a52"/>'
    },
    {
      id: 'mitt', ko: '오븐장갑',
      svg: '<path d="M16.5 6h13a7.5 7.5 0 0 1 7.5 7.5v13a10.5 10.5 0 0 1-10.5 10.5h-5A10.5 10.5 0 0 1 11 26.5v-13A7.5 7.5 0 0 1 16.5 6z" fill="#77b3cf" stroke="#245a75" stroke-width="2"/>' +
           '<path d="M11 17.5H7.5a5.5 5.5 0 0 0 0 11H11" fill="#77b3cf" stroke="#245a75" stroke-width="2"/>' +
           '<rect x="13" y="34.5" width="22" height="7.5" rx="3.5" fill="#4f8dab" stroke="#245a75" stroke-width="2"/>'
    }
  ];

  /** 받침 유무로 조사를 고른다. "거품기을(를)" 같은 표기를 쓰지 않는다. */
  function particle(word, withJong, withoutJong) {
    var code = word.charCodeAt(word.length - 1);
    var hasJong = code >= 0xAC00 && code <= 0xD7A3 && ((code - 0xAC00) % 28) !== 0;
    return word + (hasJong ? withJong : withoutJong);
  }

  function toolSvg(typeId, cls) {
    var t = byType(typeId);
    return '<svg class="' + (cls || '') + '" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' + t.svg + '</svg>';
  }

  function byType(typeId) {
    for (var i = 0; i < TOOL_LIBRARY.length; i++) {
      if (TOOL_LIBRARY[i].id === typeId) return TOOL_LIBRARY[i];
    }
    return null;
  }

  /* ===================== 시드 난수 ===================== */

  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    var s = String(str);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    var t = a >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  /* ===================== 라운드 생성 (순수) ===================== */

  /**
   * 정확히 8종 × 3개 = 24개를 4열 × 6행 논리 앵커에 배치한다.
   * 앵커는 셀 단위라 hit area 가 겹치지 않고, 흩어진 느낌은 셀 안쪽의 제한된
   * 흔들림(--jx/--jy, ±10%/±8%)과 회전(±10도)으로만 만든다.
   */
  function createRound(seedInput) {
    var seed = hashSeed(seedInput);
    var rnd = mulberry32(seed);

    var lib = TOOL_LIBRARY.map(function (t) { return t.id; });
    var types = shuffle(lib.slice(), rnd).slice(0, TYPES_PER_ROUND);

    var bag = [];
    for (var i = 0; i < types.length; i++) {
      for (var k = 0; k < PER_TYPE; k++) bag.push(types[i]);
    }
    shuffle(bag, rnd);

    var anchors = [];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) anchors.push({ row: r, col: c });
    }

    var tools = bag.map(function (typeId, idx) {
      var a = anchors[idx];
      return {
        id: 't' + idx,
        typeId: typeId,
        anchor: idx,
        row: a.row,
        col: a.col,
        jx: Math.round((rnd() * 2 - 1) * 100) / 100,
        jy: Math.round((rnd() * 2 - 1) * 100) / 100,
        rot: Math.round((rnd() * 2 - 1) * 10),
        status: 'floor'
      };
    });

    // 튜토리얼 세트: 서로 다른 사분면에 놓인 한 종류를 우선 고른다.
    var tutorial = pickTutorialType(tools, types);

    return { seed: seed, seedLabel: String(seedInput), types: types, tools: tools, tutorialType: tutorial };
  }

  function quadrant(t) {
    return (t.row < ROWS / 2 ? 0 : 2) + (t.col < COLS / 2 ? 0 : 1);
  }

  function pickTutorialType(tools, types) {
    var best = types[0];
    var bestSpread = -1;
    for (var i = 0; i < types.length; i++) {
      var q = {};
      var n = 0;
      for (var j = 0; j < tools.length; j++) {
        if (tools[j].typeId === types[i]) {
          if (!q[quadrant(tools[j])]) { q[quadrant(tools[j])] = 1; n++; }
        }
      }
      if (n > bestSpread) { bestSpread = n; best = types[i]; }
    }
    return best;
  }

  /* ===================== 순수 판정 ===================== */

  function findTriple(basketTypeIds) {
    var count = {};
    for (var i = 0; i < basketTypeIds.length; i++) {
      var id = basketTypeIds[i];
      count[id] = (count[id] || 0) + 1;
      if (count[id] >= PER_TYPE) return id;
    }
    return null;
  }

  function comboPoints(step) {
    return BASE_POINTS + COMBO_STEP * Math.min(step, COMBO_MAX_STEP);
  }

  function nextComboStep(prevStep, lastMatchAt, now) {
    if (lastMatchAt === null) return 0;
    return (now - lastMatchAt <= COMBO_WINDOW_MS) ? Math.min(prevStep + 1, COMBO_MAX_STEP) : 0;
  }

  function finalScore(raw, remainingMs, won, hintUsed, relax) {
    var s = raw;
    if (won && !relax) s += Math.floor(Math.max(0, remainingMs) / 1000) * TIME_BONUS_PER_SEC;
    if (hintUsed) s -= HINT_COST;
    return Math.max(0, s);
  }

  /* ===================== 상태 ===================== */

  var S = null;
  var els = {};
  var rafId = 0;
  var busy = false;      // 입력 재진입 잠금 (연타·키 반복 중복 처리 방지)
  var hintTimer = 0;
  var announcedMarks = {};
  var roundsStarted = 0; // 튜토리얼 강조는 첫 라운드에만

  function q(id) { return document.getElementById(id); }

  function cacheEls() {
    ['app', 'floor', 'basket', 'basketNum', 'basketSummary', 'status', 'live', 'fx',
      'timeValue', 'timeBox', 'scoreValue', 'setsValue', 'hintBtn', 'hintSub', 'muteBtn',
      'start', 'startBtn', 'relaxCheck', 'startTitle',
      'pause', 'resumeBtn', 'pauseTitle',
      'result', 'resultBadge', 'resultTitle', 'resultLead', 'resultBasket',
      'rScore', 'rSets', 'rTime', 'rBreak', 'replayBtn', 'moreLink'
    ].forEach(function (id) { els[id] = q(id); });
  }

  function prefersReduced() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function readSeedParam() {
    var p = new URLSearchParams(location.search);
    return p.get('seed');
  }

  function newSeed(runCount) {
    // ?seed= 가 있으면 재시작해도 같은 판을 만든다(검증·재현용).
    var fromUrl = readSeedParam();
    if (fromUrl !== null && fromUrl !== '') return fromUrl;
    return 'kt-' + Math.floor(Math.random() * 1e9) + '-' + runCount;
  }

  function resetState(runCount, relax) {
    var round = createRound(newSeed(runCount));
    S = {
      phase: 'ready',
      relax: !!relax,
      seed: round.seed,
      seedLabel: round.seedLabel,
      runCount: runCount,
      round: round,
      tools: round.tools,
      basket: [],
      score: 0,
      comboStep: 0,
      lastMatchAt: null,
      lastProgressAt: 0,
      startedAt: 0,
      elapsedMs: 0,
      pausedAt: 0,
      hintUsed: false,
      clearedSets: 0,
      ended: false,
      muted: S ? S.muted : false,
      reduced: prefersReduced()
    };
    announcedMarks = {};
    return S;
  }

  /* ===================== 파생값 ===================== */

  function floorTools() { return S.tools.filter(function (t) { return t.status === 'floor'; }); }
  function basketTypes() {
    return S.basket.map(function (id) { return toolById(id).typeId; });
  }
  function toolById(id) {
    for (var i = 0; i < S.tools.length; i++) if (S.tools[i].id === id) return S.tools[i];
    return null;
  }
  function remainingMs() {
    if (S.relax) return Infinity;
    return Math.max(0, ROUND_MS - S.elapsedMs);
  }
  function typeRemaining(typeId) {
    var n = 0;
    for (var i = 0; i < S.tools.length; i++) {
      if (S.tools[i].typeId === typeId && S.tools[i].status !== 'cleared') n++;
    }
    return n;
  }

  /* ===================== 렌더 ===================== */

  function buildFloor() {
    var frag = document.createDocumentFragment();
    S.tools.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tool';
      b.id = 'tool-' + t.id;
      b.dataset.id = t.id;
      b.dataset.type = t.typeId;
      b.style.setProperty('--c', String(t.col + 1));
      b.style.setProperty('--r', String(t.row + 1));
      b.style.setProperty('--jx', String(t.jx));
      b.style.setProperty('--jy', String(t.jy));
      b.style.setProperty('--rot', String(t.rot));
      b.setAttribute('aria-label', byType(t.typeId).ko + ', 바닥 ' + (t.row + 1) + '행 ' + (t.col + 1) + '열');
      b.innerHTML = toolSvg(t.typeId);
      frag.appendChild(b);
    });
    els.floor.textContent = '';
    els.floor.appendChild(frag);
  }

  function renderBasket(popIndex) {
    var html = '';
    for (var i = 0; i < BASKET_MAX; i++) {
      var id = S.basket[i];
      if (id) {
        html += '<li class="filled' + (i === popIndex ? ' pop' : '') + '" data-type="' +
          toolById(id).typeId + '">' + toolSvg(toolById(id).typeId) + '</li>';
      } else {
        html += '<li></li>';
      }
    }
    els.basket.innerHTML = html;
    els.basketNum.textContent = String(S.basket.length);
    els.basket.parentNode.classList.toggle('full', S.basket.length >= BASKET_MAX - 1);
    els.basketSummary.textContent = basketSummaryText();
  }

  function basketSummaryText() {
    if (!S.basket.length) return '바구니가 비어 있습니다. 총 0/' + BASKET_MAX + '.';
    var order = [];
    var count = {};
    basketTypes().forEach(function (t) {
      if (!count[t]) { count[t] = 0; order.push(t); }
      count[t]++;
    });
    var parts = order.map(function (t) { return byType(t).ko + ' ' + count[t] + '개'; });
    return parts.join(', ') + ', 총 ' + S.basket.length + '/' + BASKET_MAX + '.';
  }

  function renderHud() {
    els.scoreValue.textContent = String(S.score);
    els.setsValue.textContent = String(S.clearedSets);
    if (S.relax) {
      els.timeValue.textContent = '연습';
      els.timeBox.classList.add('relax');
      els.timeBox.classList.remove('low');
    } else {
      els.timeBox.classList.remove('relax');
      var left = Math.ceil(remainingMs() / 1000);
      els.timeValue.textContent = String(left);
      els.timeBox.classList.toggle('low', left <= 10);
    }
    var small = els.timeBox.querySelector('small');
    if (small) small.hidden = S.relax;
    var canHint = S.phase === 'playing' && !S.hintUsed &&
      (nowMs() - S.lastProgressAt) >= HINT_READY_MS && floorTools().length > 0;
    els.hintBtn.disabled = !canHint;
    els.hintSub.textContent = S.hintUsed ? '(사용됨)' : '(-' + HINT_COST + ')';
  }

  function setStatus(text, tone) {
    els.status.textContent = text;
    els.status.className = 'status' + (tone ? ' ' + tone : '');
  }

  function announce(text) {
    els.live.textContent = text;
  }

  /* ===================== 시간 ===================== */

  function nowMs() { return performance.now(); }

  function tick() {
    rafId = requestAnimationFrame(tick);
    if (S.phase !== 'playing') return;
    S.elapsedMs = nowMs() - S.startedAt;
    renderHud();

    if (!S.relax) {
      var left = Math.ceil(remainingMs() / 1000);
      if ((left === 10 || left === 5) && !announcedMarks[left]) {
        announcedMarks[left] = true;
        announce(left + '초 남았습니다.');
      }
      // selectTool 은 전 구간이 동기라 진행 중이면 rAF 가 끼어들 수 없다.
      // 즉 이미 시작된 유효 입력의 트리플·성공 판정이 항상 먼저 끝나고,
      // finishOnce 의 단일 가드가 그 뒤의 시간 종료를 무시한다. busy 는 이중 안전장치다.
      if (remainingMs() <= 0 && !busy) finishOnce('lost-time');
    }
  }

  /* ===================== 게임 흐름 ===================== */

  function startRound(relax) {
    resetState(S ? S.runCount + 1 : 0, relax);
    roundsStarted++;
    document.body.classList.toggle('reduced', S.reduced);
    buildFloor();
    renderBasket();
    S.phase = 'playing';
    S.startedAt = nowMs();
    S.lastProgressAt = S.startedAt;
    S.elapsedMs = 0;
    renderHud();
    setStatus(S.relax
      ? '여유 모드 · 같은 조리도구 3개를 모아 정리하세요.'
      : '같은 조리도구 3개를 모아 정리하세요.');
    announce('라운드 시작. 조리도구 24개, ' + (S.relax ? '제한 시간 없음' : '제한 시간 35초') + '.');
    showTutorialHint();
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function showTutorialHint() {
    if (S.reduced || roundsStarted !== 1) return;
    var type = S.round.tutorialType;
    els.floor.querySelectorAll('.tool[data-type="' + type + '"]').forEach(function (el) {
      el.classList.add('pulse');
    });
  }

  function clearTutorialHint() {
    els.floor.querySelectorAll('.tool.pulse').forEach(function (el) { el.classList.remove('pulse'); });
  }

  /**
   * 판정 순서: 입력 잠금 → 도구 이동 → 트리플 제거 → 성공 확인 → 바구니 초과 확인 → 잠금 해제.
   * 순서를 바꾸면 일곱 번째 도구가 트리플을 완성해도 실패 처리된다.
   */
  function selectTool(id) {
    if (busy) return false;
    if (S.phase !== 'playing') return false;
    var tool = toolById(id);
    if (!tool || tool.status !== 'floor') return false;

    busy = true;
    clearTutorialHint();
    clearHintHighlight();

    // 1) 이동
    tool.status = 'basket';
    S.basket.push(tool.id);
    var btn = document.getElementById('tool-' + tool.id);
    if (btn) {
      btn.classList.add('taking');
      btn.disabled = true;
      btn.setAttribute('aria-hidden', 'true');
      btn.tabIndex = -1;
      window.setTimeout(function () { btn.classList.add('gone'); }, S.reduced ? 0 : MOVE_MS);
    }
    beep('tap');

    // 2) 트리플 제거
    var tripleType = findTriple(basketTypes());
    if (tripleType) resolveTriple(tripleType);

    renderBasket(tripleType ? -1 : S.basket.length - 1);
    renderHud();
    moveFocusAfter(tool, tripleType);

    // 3) 성공 확인
    if (S.clearedSets >= TYPES_PER_ROUND) {
      busy = false;
      finishOnce('won');
      return true;
    }

    // 4) 바구니 초과 확인
    if (S.basket.length >= BASKET_MAX) {
      busy = false;
      finishOnce('lost-full');
      return true;
    }

    if (!tripleType) {
      var left = BASKET_MAX - S.basket.length;
      setStatus('바구니 여유 ' + left + '칸 · ' + particle(byType(tool.typeId).ko, '을', '를') + ' 담았습니다.',
        left <= 2 ? 'warn' : null);
    }

    busy = false;
    return true;
  }

  function resolveTriple(typeId) {
    var removed = [];
    var kept = [];
    for (var i = 0; i < S.basket.length; i++) {
      var t = toolById(S.basket[i]);
      if (t.typeId === typeId && removed.length < PER_TYPE) {
        t.status = 'cleared';
        removed.push(t.id);
      } else {
        kept.push(S.basket[i]);
      }
    }
    S.basket = kept;
    S.clearedSets++;

    var now = nowMs();
    S.comboStep = nextComboStep(S.comboStep, S.lastMatchAt, now);
    var gained = comboPoints(S.comboStep);
    S.score += gained;
    S.lastMatchAt = now;
    S.lastProgressAt = now;

    var name = byType(typeId).ko;
    var comboText = S.comboStep > 0 ? ' 연속 ' + (S.comboStep + 1) + '단계 +' + (COMBO_STEP * S.comboStep) : '';
    setStatus(name + ' 3개 정리! +' + gained + '점' + comboText + ' · ' + S.clearedSets + '/' + TYPES_PER_ROUND, 'good');
    announce(name + ' 세트를 정리했습니다. ' + S.clearedSets + ' / ' + TYPES_PER_ROUND + ', 점수 ' + S.score + '점.');
    beep('clear');
    bubbles();
    return removed;
  }

  function moveFocusAfter(taken, tripleType) {
    if (document.activeElement !== document.body &&
        !(document.activeElement && document.activeElement.dataset && document.activeElement.dataset.id === taken.id)) {
      return; // 포커스가 도구에 있지 않았다면 건드리지 않는다.
    }
    var pool = floorTools();
    if (!pool.length) return;
    var same = pool.filter(function (t) { return t.typeId === taken.typeId; });
    var target = same.length ? same[0] : null;
    if (!target) {
      var after = pool.filter(function (t) { return t.anchor > taken.anchor; });
      target = after.length ? after[0] : pool[0];
    }
    var el = document.getElementById('tool-' + target.id);
    if (el) el.focus();
    void tripleType;
  }

  /* ===================== 힌트 ===================== */

  function useHint() {
    if (S.phase !== 'playing' || S.hintUsed) return;
    if ((nowMs() - S.lastProgressAt) < HINT_READY_MS) return;

    // 바구니 + 바닥 합계가 정확히 3개인 종류 중, 바구니에 가장 많이 담긴 것을 고른다.
    var bt = basketTypes();
    var best = null;
    var bestInBasket = -1;
    S.round.types.forEach(function (typeId) {
      if (typeRemaining(typeId) !== PER_TYPE) return;
      var inBasket = bt.filter(function (x) { return x === typeId; }).length;
      if (inBasket > bestInBasket) { bestInBasket = inBasket; best = typeId; }
    });
    if (!best) return;

    S.hintUsed = true;
    highlightType(best);
    setStatus(byType(best).ko + ' 3개를 모으면 정리됩니다. (최종 점수 -' + HINT_COST + ')');
    announce('힌트: ' + byType(best).ko + ' 세트를 완성할 수 있습니다.');
    renderHud();

    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(clearHintHighlight, HINT_SHOW_MS);
  }

  function highlightType(typeId) {
    els.floor.querySelectorAll('.tool[data-type="' + typeId + '"]').forEach(function (el) {
      if (!el.classList.contains('gone')) el.classList.add('hint-on');
    });
    els.basket.querySelectorAll('li[data-type="' + typeId + '"]').forEach(function (el) {
      el.classList.add('hint-on');
    });
  }

  function clearHintHighlight() {
    document.querySelectorAll('.hint-on').forEach(function (el) { el.classList.remove('hint-on'); });
  }

  /* ===================== 종료 ===================== */

  function finishOnce(phase) {
    if (S.ended) return;
    S.ended = true;
    S.phase = phase;
    window.clearTimeout(hintTimer);
    clearHintHighlight();
    clearTutorialHint();

    var elapsed = S.relax ? S.elapsedMs : Math.min(S.elapsedMs, ROUND_MS);
    var left = S.relax ? 0 : Math.max(0, ROUND_MS - elapsed);
    var won = phase === 'won';
    var total = finalScore(S.score, left, won, S.hintUsed, S.relax);

    els.resultBadge.className = 'badge' + (won ? '' : ' bad');
    els.resultBadge.textContent = won ? '정리 완료' : '정리 실패';
    els.resultTitle.textContent = won ? '주방이 깨끗해졌어요!'
      : (phase === 'lost-full' ? '바구니가 가득 찼어요' : '시간 안에 다 치우지 못했어요');
    els.resultLead.textContent = won
      ? (S.relax ? '여유 모드로 8세트를 모두 정리했습니다.' : '8세트를 모두 정리했습니다.')
      : (phase === 'lost-full'
        ? '서로 짝이 없는 도구 ' + BASKET_MAX + '개가 바구니를 채웠습니다. 완성 가능한 세트를 먼저 고르세요.'
        : '남은 도구 ' + (floorTools().length + S.basket.length) + '개를 치우지 못했습니다.');

    if (!won && S.basket.length) {
      els.resultBasket.hidden = false;
      els.resultBasket.innerHTML = S.basket.map(function (id) {
        var ty = toolById(id).typeId;
        return '<li title="' + byType(ty).ko + '">' + toolSvg(ty) + '</li>';
      }).join('');
    } else {
      els.resultBasket.hidden = true;
      els.resultBasket.innerHTML = '';
    }

    els.rScore.textContent = String(total);
    els.rSets.textContent = S.clearedSets + ' / ' + TYPES_PER_ROUND;
    els.rTime.textContent = (elapsed / 1000).toFixed(1) + '초';

    var parts = ['정리 ' + S.score + '점'];
    if (won && !S.relax) parts.push('시간 보너스 +' + (Math.floor(left / 1000) * TIME_BONUS_PER_SEC));
    if (S.hintUsed) parts.push('힌트 -' + HINT_COST);
    if (S.relax) parts.push('연습(시간 보너스 없음)');
    els.rBreak.textContent = parts.join(' · ');

    beep(won ? 'win' : 'lose');
    openOverlay(els.result, els.resultTitle);
  }

  /* ===================== 오버레이 ===================== */

  var lastFocus = null;

  function openOverlay(el, focusEl) {
    lastFocus = document.activeElement;
    el.hidden = false;
    els.app.setAttribute('aria-hidden', 'true');
    window.setTimeout(function () { if (focusEl) focusEl.focus(); }, 20);
  }

  function closeOverlay(el) {
    el.hidden = true;
    els.app.removeAttribute('aria-hidden');
    if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus(); } catch (e) { /* noop */ } }
  }

  function trapTab(e, panelRoot) {
    if (e.key !== 'Tab') return;
    var focusables = panelRoot.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openOverlayEl() {
    if (!els.start.hidden) return els.start;
    if (!els.pause.hidden) return els.pause;
    if (!els.result.hidden) return els.result;
    return null;
  }

  /* ===================== 오디오 (합성) ===================== */

  var actx = null;

  /* AudioContext 는 실제 사용자 제스처 안에서만 만든다.
     제스처 없이 생성하면 Chrome 이 호출마다 autoplay 경고를 남긴다(?test=1 에서 실측). */
  function unlockAudio() {
    if (actx) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = new AC();
    } catch (e) { /* noop */ }
  }

  function beep(kind) {
    if (S && S.muted) return;
    if (!actx) return;
    try {
      if (actx.state === 'suspended') actx.resume();
      var seq = { tap: [[520, 0.06]], clear: [[660, 0.07], [880, 0.09]], win: [[523, 0.1], [659, 0.1], [784, 0.18]], lose: [[220, 0.16], [165, 0.22]] }[kind];
      if (!seq) return;
      var t0 = actx.currentTime;
      seq.forEach(function (s, i) {
        var osc = actx.createOscillator();
        var g = actx.createGain();
        osc.type = kind === 'lose' ? 'triangle' : 'sine';
        osc.frequency.value = s[0];
        g.gain.setValueAtTime(0.0001, t0 + i * 0.08);
        g.gain.exponentialRampToValueAtTime(0.14, t0 + i * 0.08 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.08 + s[1]);
        osc.connect(g); g.connect(actx.destination);
        osc.start(t0 + i * 0.08);
        osc.stop(t0 + i * 0.08 + s[1] + 0.02);
      });
    } catch (e) { /* 오디오 실패는 게임 진행에 영향 주지 않는다 */ }
  }

  /* ===================== 파티클 ===================== */

  function bubbles() {
    if (S.reduced) return;
    var rect = els.basket.getBoundingClientRect();
    for (var i = 0; i < 8; i++) {
      var b = document.createElement('span');
      b.className = 'bubble';
      b.style.left = (rect.left + rect.width * (0.15 + Math.random() * 0.7)) + 'px';
      b.style.top = (rect.top + rect.height * 0.5) + 'px';
      b.style.setProperty('--dx', (Math.random() * 60 - 30).toFixed(0) + 'px');
      b.style.setProperty('--dy', (-40 - Math.random() * 50).toFixed(0) + 'px');
      els.fx.appendChild(b);
      (function (node) { window.setTimeout(function () { node.remove(); }, 700); })(b);
    }
  }

  /* ===================== 입력 ===================== */

  function bindInputs() {
    document.addEventListener('pointerdown', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });

    els.floor.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.tool') : null;
      if (!btn || btn.disabled) return;
      selectTool(btn.dataset.id);
    });

    els.floor.addEventListener('keydown', function (e) {
      var dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (!dirs[e.key]) return;
      var cur = e.target.closest ? e.target.closest('.tool') : null;
      if (!cur) return;
      e.preventDefault();
      var next = nearestInDirection(cur, dirs[e.key]);
      if (next) next.focus();
    });

    els.hintBtn.addEventListener('click', useHint);

    els.muteBtn.addEventListener('click', function () {
      S.muted = !S.muted;
      els.muteBtn.setAttribute('aria-pressed', S.muted ? 'true' : 'false');
      els.muteBtn.querySelector('.sr-only').textContent = S.muted ? '효과음 켜기 (단축키 M)' : '효과음 끄기 (단축키 M)';
      announce(S.muted ? '효과음을 껐습니다.' : '효과음을 켰습니다.');
    });

    els.startBtn.addEventListener('click', function () {
      var relax = els.relaxCheck.checked;
      closeOverlay(els.start);
      startRound(relax);
      var first = els.floor.querySelector('.tool');
      if (first) first.focus();
    });

    els.replayBtn.addEventListener('click', function () {
      closeOverlay(els.result);
      startRound(S.relax);
      var first = els.floor.querySelector('.tool');
      if (first) first.focus();
    });

    els.resumeBtn.addEventListener('click', resumeFromPause);

    document.addEventListener('keydown', function (e) {
      var overlay = openOverlayEl();
      if (overlay) { trapTab(e, overlay); }

      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      var k = e.key.toLowerCase();
      if (k === 'm') {
        e.preventDefault();
        els.muteBtn.click();
      } else if (k === 'h' && !els.hintBtn.disabled && !overlay) {
        e.preventDefault();
        useHint();
      } else if (k === 'r' && !els.result.hidden) {
        e.preventDefault();
        els.replayBtn.click();
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pauseForHidden();
    });
  }

  function nearestInDirection(curEl, dir) {
    var cur = curEl.getBoundingClientRect();
    var cx = cur.left + cur.width / 2;
    var cy = cur.top + cur.height / 2;
    var best = null;
    var bestScore = Infinity;
    els.floor.querySelectorAll('.tool').forEach(function (el) {
      if (el === curEl || el.disabled) return;
      var r = el.getBoundingClientRect();
      var dx = (r.left + r.width / 2) - cx;
      var dy = (r.top + r.height / 2) - cy;
      var along = dx * dir[0] + dy * dir[1];
      if (along <= 2) return;
      var across = Math.abs(dx * dir[1] + dy * dir[0]);
      var score = along + across * 2.2;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    return best;
  }

  function pauseForHidden() {
    if (S.phase !== 'playing' || S.relax) return;
    S.phase = 'paused';
    S.pausedAt = nowMs();
    openOverlay(els.pause, els.pauseTitle);
  }

  function resumeFromPause() {
    if (S.phase !== 'paused') { closeOverlay(els.pause); return; }
    var gap = nowMs() - S.pausedAt;
    S.startedAt += gap;
    S.phase = 'playing';
    closeOverlay(els.pause);
  }

  /* ===================== 자동 검증 (?test=1) ===================== */

  function runTests() {
    var results = [];
    function check(name, cond) {
      results.push({ name: name, pass: !!cond });
      if (!cond) console.error('FAIL · ' + name);
    }

    // 1. 생성 불변식 100 시드
    var okCount = true, okTypes = true, okAnchor = true, okJitter = true;
    for (var i = 0; i < 100; i++) {
      var r = createRound('seed-' + i);
      if (r.tools.length !== TOTAL_TOOLS) okCount = false;
      var tally = {};
      r.tools.forEach(function (t) { tally[t.typeId] = (tally[t.typeId] || 0) + 1; });
      var keys = Object.keys(tally);
      if (keys.length !== TYPES_PER_ROUND) okTypes = false;
      keys.forEach(function (k) { if (tally[k] !== PER_TYPE) okTypes = false; });
      var seen = {};
      r.tools.forEach(function (t) {
        var key = t.row + ':' + t.col;
        if (seen[key]) okAnchor = false;
        seen[key] = 1;
        if (t.row < 0 || t.row >= ROWS || t.col < 0 || t.col >= COLS) okAnchor = false;
        if (Math.abs(t.jx) > 1 || Math.abs(t.jy) > 1 || Math.abs(t.rot) > 10) okJitter = false;
      });
    }
    check('100시드 · 총 24개', okCount);
    check('100시드 · 8종 × 3개', okTypes);
    check('100시드 · 앵커 24칸 중복 없음', okAnchor);
    check('100시드 · 흔들림/회전 범위 제한', okJitter);

    // 2. 시드 재현성
    var a = createRound('fixed-seed');
    var b = createRound('fixed-seed');
    check('같은 seed 재현', JSON.stringify(a.tools) === JSON.stringify(b.tools));
    check('다른 seed 분기', JSON.stringify(createRound('other').tools) !== JSON.stringify(a.tools));

    // 3. 트리플 판정
    check('트리플 없음', findTriple(['pan', 'pot', 'pan']) === null);
    check('트리플 검출', findTriple(['pan', 'pot', 'pan', 'mug', 'pan']) === 'pan');
    check('빈 바구니', findTriple([]) === null);

    // 4. 점수
    check('기본 100점', comboPoints(0) === 100);
    check('콤보 상한 175점', comboPoints(5) === 175);
    check('콤보 창 경계 내', nextComboStep(0, 1000, 4000) === 1);
    check('콤보 창 경계 밖', nextComboStep(2, 1000, 5100) === 0);
    check('첫 트리플은 콤보 없음', nextComboStep(0, null, 100) === 0);
    check('시간 보너스', finalScore(800, 12400, true, false, false) === 800 + 120);
    check('힌트 차감', finalScore(800, 0, false, true, false) === 700);
    check('점수 하한 0', finalScore(50, 0, false, true, false) === 0);
    check('여유 모드 시간 보너스 없음', finalScore(800, 12400, true, false, true) === 800);

    // 4-1. 조사 처리
    check('조사 · 받침 있음 → 을', particle('그릇', '을', '를') === '그릇을');
    check('조사 · 받침 없음 → 를', particle('거품기', '을', '를') === '거품기를');
    check('조사 · 12종 모두 처리', TOOL_LIBRARY.every(function (t) {
      var s = particle(t.ko, '을', '를');
      return s.indexOf('(') === -1 && (s.slice(-1) === '을' || s.slice(-1) === '를');
    }));

    // 5. 실제 라운드 상태 전이 (DOM 사용)
    startRound(false);
    var byT = {};
    S.tools.forEach(function (t) { (byT[t.typeId] = byT[t.typeId] || []).push(t); });
    var typeIds = Object.keys(byT);

    // 5-1. 같은 버튼 연타 → 1회만 처리
    var first = byT[typeIds[0]][0];
    selectTool(first.id);
    var basketAfter = S.basket.length;
    selectTool(first.id);
    check('연타 중복 없음', S.basket.length === basketAfter && basketAfter === 1);

    // 5-2. 트리플 우선 판정: 비매칭 4개 + 같은 종류 3개 → 7번째에서 트리플, 실패 아님
    // 현재 바구니: [typeIds[0]] 1개. 서로 다른 종류 3개를 더 넣어 4개를 만든다.
    selectTool(byT[typeIds[1]][0].id);
    selectTool(byT[typeIds[2]][0].id);
    selectTool(byT[typeIds[3]][0].id);
    check('비매칭 4개 적재', S.basket.length === 4);
    // typeIds[4] 를 3개 넣으면 5·6·7번째에서 트리플이 발생해야 한다.
    selectTool(byT[typeIds[4]][0].id);
    selectTool(byT[typeIds[4]][1].id);
    var setsBefore = S.clearedSets;
    selectTool(byT[typeIds[4]][2].id);
    check('7번째가 트리플이면 실패 아님', S.phase === 'playing');
    check('트리플 제거 후 바구니 4개', S.basket.length === 4);
    check('진행 1 증가', S.clearedSets === setsBefore + 1);
    check('점수 1회 가산', S.score === 100);

    // 5-3. 바구니 초과 실패
    selectTool(byT[typeIds[5]][0].id);
    selectTool(byT[typeIds[6]][0].id);
    check('실패 직전 6개', S.basket.length === 6 && S.phase === 'playing');
    selectTool(byT[typeIds[7]][0].id);
    check('비매칭 7번째 → 바구니 실패', S.phase === 'lost-full');
    check('종료 후 입력 무시', selectTool(byT[typeIds[0]][1].id) === false);

    // 5-4. 종료 1회 가드
    var phaseAtEnd = S.phase;
    finishOnce('lost-time');
    check('종료 가드 1회', S.phase === phaseAtEnd);

    // 6. 완주 → 성공
    closeOverlay(els.result);
    startRound(false);
    var groups = {};
    S.tools.forEach(function (t) { (groups[t.typeId] = groups[t.typeId] || []).push(t); });
    Object.keys(groups).forEach(function (ty) {
      groups[ty].forEach(function (t) { selectTool(t.id); });
    });
    check('8세트 완주 → 성공', S.phase === 'won');
    check('바구니 비움', S.basket.length === 0);
    check('정리 8/8', S.clearedSets === 8);
    check('바닥 도구 0개', floorTools().length === 0);

    // 7. hit area 비중첩 (실제 렌더 좌표)
    closeOverlay(els.result);
    startRound(false);
    var rects = [];
    els.floor.querySelectorAll('.tool').forEach(function (el) { rects.push(el.getBoundingClientRect()); });
    var overlap = false, tooSmall = false;
    for (var m = 0; m < rects.length; m++) {
      if (rects[m].width < 43.5 || rects[m].height < 43.5) tooSmall = true;
      for (var n = m + 1; n < rects.length; n++) {
        var A = rects[m], B = rects[n];
        if (A.left < B.right - 0.5 && B.left < A.right - 0.5 &&
            A.top < B.bottom - 0.5 && B.top < A.bottom - 0.5) overlap = true;
      }
    }
    check('hit area 44px 이상', !tooSmall);
    check('hit area 비중첩', !overlap);
    check('가로 스크롤 없음', document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

    var passed = results.filter(function (r) { return r.pass; }).length;
    var summary = { total: results.length, passed: passed, failed: results.length - passed, results: results };
    window.__ktTest = summary;
    console.log('KT-TEST ' + (summary.failed === 0 ? 'PASS' : 'FAIL') + ' ' + passed + '/' + results.length);
    document.title = 'KT-TEST ' + (summary.failed === 0 ? 'PASS' : 'FAIL') + ' ' + passed + '/' + results.length;
    return summary;
  }

  /* ===================== 부트 ===================== */

  function boot() {
    cacheEls();
    resetState(0, false);
    document.body.classList.toggle('reduced', S.reduced);
    buildFloor();
    renderBasket();
    renderHud();
    bindInputs();

    var params = new URLSearchParams(location.search);
    if (params.get('relax') === '1') els.relaxCheck.checked = true;

    if (params.get('test') === '1') {
      els.start.hidden = true;
      els.app.removeAttribute('aria-hidden');
      runTests();
      return;
    }
    els.app.setAttribute('aria-hidden', 'true'); // 시작 오버레이가 떠 있는 동안
    window.setTimeout(function () { els.startTitle.focus(); }, 30);
  }

  // 테스트/외부 확인용 최소 노출
  window.KitchenTidy = {
    createRound: createRound,
    findTriple: findTriple,
    comboPoints: comboPoints,
    nextComboStep: nextComboStep,
    finalScore: finalScore,
    selectTool: function (id) { return selectTool(id); },
    startRound: startRound,
    getState: function () { return S; },
    runTests: runTests
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
