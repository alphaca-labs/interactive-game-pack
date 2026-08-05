/* 오더 트레이 (Order Tray) — 항목 1/8, 유형 B 보드상태 퍼즐
 * 외부 라이브러리·네트워크 요청 0건. file:// 직접 실행을 지원한다.
 * ?seed=<정수> 로 동일 보드 재현, ?test=1 로 순수 함수 자동 검증. */
(function () {
  'use strict';

  /* =========================================================================
   * 1. 튜닝 상수 — 밸런싱은 이 블록만 수정한다
   * ====================================================================== */
  var TUNING = {
    TRAY_SLOTS: 6,          // 트레이 칸 수 (승률 55~70% 목표 구간의 조절점)
    ROUND_MS: 40000,        // 라운드 제한 시간
    TILE_TYPES: 8,          // 한 판에 쓰는 요리 종류 수
    COPIES_PER_TYPE: 3,     // 요리당 타일 수 = 매칭 성립 개수
    BOARD_COLS: 4,
    BOARD_ROWS: 4,
    STACK2_CELLS: 9,        // 2층으로 쌓는 칸 수 (16칸 - 빈칸 1 = 15칸 중)
    MAX_PER_SILHOUETTE: 2,  // 실루엣 그룹당 최대 채택 종수 (변별력 방어)
    TICKET_COUNT: 5,        // 한 판의 총 주문 수
    TICKET_VISIBLE: 3,      // 동시 노출 티켓 수
    TICKET_REWARDS: [20, 50, 100, 200, 500],
    LOOSE_MATCH_COIN: 10,   // 노출 티켓이 요구하지 않는 3매칭 보상
    COMBO_STEPS: [1.0, 1.2, 1.5],
    COMBO_WINDOW_MS: 4000,
    TIME_BONUS_PER_SEC: 5,
    TRAY_WARN_LEFT: 2,      // 잔여 칸이 이 값 이하이면 경고
    FLY_MS: 320,
    CLEAR_MS: 380,
    STAMP_MS: 250
  };

  var TOTAL_TILES = TUNING.TILE_TYPES * TUNING.COPIES_PER_TYPE;          // 24
  var CELL_COUNT = TUNING.BOARD_COLS * TUNING.BOARD_ROWS;                // 16
  var FILLED_CELLS = CELL_COUNT - 1;                                     // 15 (빈 칸 1개)

  /* =========================================================================
   * 2. 오리지널 요리 아이콘 12종 (인라인 SVG, 외부 에셋 없음)
   *    group = 실루엣 그룹. 한 판에 같은 그룹은 최대 2종만 뽑는다.
   * ====================================================================== */
  var S = '" stroke="#16283f" stroke-width="2.4" stroke-linejoin="round"';
  var DISHES = [
    { id: 'ramen', name: '라멘', group: 'bowl', art:
      '<path d="M8 29h48a24 24 0 0 1-24 24A24 24 0 0 1 8 29Z" fill="#eef4fa' + S + '/>' +
      '<path d="M6 29h52" fill="none" stroke="#16283f" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M16 27c3-8 9-11 16-11s13 3 16 11" fill="none" stroke="#e8a33d" stroke-width="3.4" stroke-linecap="round"/>' +
      '<circle cx="24" cy="21" r="4.6" fill="#fff" stroke="#16283f" stroke-width="2"/>' +
      '<path d="M40 9 52 24" fill="none" stroke="#8a5a2b" stroke-width="3" stroke-linecap="round"/>' },

    { id: 'soup', name: '국', group: 'bowl', art:
      '<path d="M13 31h38l-4 17a7 7 0 0 1-7 6H24a7 7 0 0 1-7-6Z" fill="#fff2d6' + S + '/>' +
      '<path d="M10 31h44" fill="none" stroke="#16283f" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M25 22c0-5 4-5 4-10M35 22c0-5 4-5 4-10" fill="none" stroke="#9db7cc" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M23 41h18" fill="none" stroke="#c99a4a" stroke-width="2.4" stroke-linecap="round"/>' },

    { id: 'donburi', name: '덮밥', group: 'bowl', art:
      '<path d="M9 33h46a23 23 0 0 1-23 22A23 23 0 0 1 9 33Z" fill="#d9b98c' + S + '/>' +
      '<path d="M18 33a14 14 0 0 1 28 0Z" fill="#fffdf7' + S + '/>' +
      '<circle cx="27" cy="27" r="3" fill="#e05b3a"/><circle cx="37" cy="25" r="3" fill="#6fa85f"/>' +
      '<path d="M14 44h36" fill="none" stroke="#a5814f" stroke-width="2.2" stroke-linecap="round"/>' },

    { id: 'shrimp', name: '새우', group: 'long', art:
      '<path d="M32 43 23 54h18Z" fill="#f4a578' + S + '/>' +
      '<path d="M46 18c-15-4-29 5-29 17 0 7 6 12 13 13" fill="none" stroke="#f4834f" stroke-width="11" stroke-linecap="round"/>' +
      '<path d="M35 17 32 24M24 21 22 28M19 28 17 35M19 37 22 43" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M46 18c4-4 8-5 12-3" fill="none" stroke="#f4834f" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="45" cy="19" r="2.8" fill="#16283f"/>' },

    { id: 'oden', name: '어묵', group: 'long', art:
      '<path d="M32 5v48" fill="none" stroke="#b98b52" stroke-width="3.4" stroke-linecap="round"/>' +
      '<circle cx="32" cy="16" r="8.5" fill="#f6dda8' + S + '/>' +
      '<rect x="21" y="26" width="22" height="12" rx="4" fill="#efb8a2' + S + '/>' +
      '<path d="M32 40 42 52 22 52Z" fill="#cfe0d0' + S + '/>' },

    { id: 'sushi', name: '초밥', group: 'block', art:
      '<rect x="10" y="32" width="44" height="19" rx="9.5" fill="#fffdf7' + S + '/>' +
      '<path d="M8 33c4-9 13-14 24-14s20 5 24 14Z" fill="#f4834f' + S + '/>' +
      '<path d="M14 27h36" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>' +
      '<path d="M26 32v19M38 32v19" fill="none" stroke="#e4dccd" stroke-width="1.8"/>' },

    { id: 'bento', name: '도시락', group: 'block', art:
      '<rect x="8" y="15" width="48" height="35" rx="7" fill="#c8532f' + S + '/>' +
      '<rect x="13" y="20" width="18" height="25" rx="3.5" fill="#fff8ee"/>' +
      '<rect x="35" y="20" width="16" height="11" rx="3.5" fill="#8fc98a"/>' +
      '<rect x="35" y="34" width="16" height="11" rx="3.5" fill="#f6c744"/>' +
      '<path d="M17 26h10M17 32h10" fill="none" stroke="#d8cfbf" stroke-width="2" stroke-linecap="round"/>' },

    { id: 'roll', name: '롤', group: 'round', art:
      '<circle cx="32" cy="32" r="21" fill="#2f4a33' + S + '/>' +
      '<circle cx="32" cy="32" r="15.5" fill="#fffdf7"/>' +
      '<circle cx="32" cy="33" r="6" fill="#f4834f' + S + '/>' +
      '<circle cx="24" cy="25" r="3.4" fill="#8fc98a"/><circle cx="40" cy="25" r="3.4" fill="#f6c744"/>' },

    { id: 'tamago', name: '계란말이', group: 'round', art:
      '<rect x="11" y="15" width="42" height="35" rx="11" fill="#f6c744' + S + '/>' +
      '<path d="M42 24a9.5 9.5 0 1 0 0 17 6 6 0 1 1 0-12" fill="none" stroke="#c1890f" stroke-width="2.8" stroke-linecap="round"/>' +
      '<path d="M21 18v29" fill="none" stroke="#c1890f" stroke-width="2.4" stroke-linecap="round"/>' },

    { id: 'salmon', name: '연어', group: 'wedge', art:
      '<path d="M7 43 43 13l14 9-36 30Z" fill="#f4834f' + S + '/>' +
      '<path d="M15 40 45 18M21 47 51 25" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" opacity=".85"/>' },

    { id: 'tempura', name: '튀김', group: 'wedge', art:
      '<path d="M17 51c-7-5-9-14-4-22 6-11 18-17 28-15 9 2 11 11 6 20-6 11-20 22-30 17Z" fill="#f2c069' + S + '/>' +
      '<circle cx="26" cy="30" r="3.4" fill="#e0a13f"/><circle cx="37" cy="24" r="2.8" fill="#e0a13f"/>' +
      '<circle cx="33" cy="41" r="3" fill="#e0a13f"/>' },

    { id: 'gyoza', name: '만두', group: 'wedge', art:
      '<path d="M8 42c4-15 15-23 27-23 11 0 20 6 20 15 0 9-9 15-22 15-11 0-20-3-25-7Z" fill="#f7ecd2' + S + '/>' +
      '<path d="M16 30c2-5 5-5 7 0M27 25c2-5 5-5 7 0M38 25c2-5 5-5 7 0" fill="none" stroke="#c9a86f" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M12 45c10 4 26 4 36-1" fill="none" stroke="#c9a86f" stroke-width="2.2" stroke-linecap="round"/>' }
  ];

  var BY_ID = {};
  DISHES.forEach(function (d) { BY_ID[d.id] = d; });

  function dishSvg(id, cls) {
    var d = BY_ID[id];
    return '<svg class="' + cls + '" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' + d.art + '</svg>';
  }

  var COIN_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="9.5" fill="#f5b93b" stroke="#a9701a" stroke-width="1.6"/>' +
    '<circle cx="12" cy="12" r="5.5" fill="none" stroke="#a9701a" stroke-width="1.2"/></svg>';

  /* =========================================================================
   * 3. 시드 PRNG · 셔플 (순수 함수)
   * ====================================================================== */
  function makeRng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5;  s >>>= 0;
      return s / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* =========================================================================
   * 4. 라운드 생성 (순수 함수) — 해결 가능성이 이 게임의 유일한 치명 결함 지점
   * ====================================================================== */

  /** 실루엣 그룹당 MAX_PER_SILHOUETTE 종까지만 채택해 TILE_TYPES 종을 뽑는다. */
  function pickDishes(rng) {
    var pool = shuffle(DISHES, rng);
    var chosen = [], used = {};
    for (var i = 0; i < pool.length && chosen.length < TUNING.TILE_TYPES; i++) {
      var g = pool[i].group;
      if ((used[g] || 0) < TUNING.MAX_PER_SILHOUETTE) {
        used[g] = (used[g] || 0) + 1;
        chosen.push(pool[i]);
      }
    }
    return chosen.map(function (d) { return d.id; });
  }

  /**
   * 16칸 보드를 만든다. cells[i] = 아래→위 순서의 요리 배열.
   * 불변식: 요리별 정확히 3장 / 요리마다 최소 1장은 최상단(즉시 선택 가능) /
   *         첫 티켓 요리는 3장 모두 최상단 / 빈 칸 정확히 1개.
   */
  function buildBoard(rng, dishIds, firstDish) {
    var order = shuffle(range(CELL_COUNT), rng);
    var emptyCell = order[0];
    var filled = order.slice(1);                       // 15칸
    var deep = filled.slice(0, TUNING.STACK2_CELLS);   // 이 중 9칸은 2층

    var topSlots = shuffle(filled, rng);               // 최상단 15자리
    var reserved = {};                                 // cellIndex -> dishId

    // ① 첫 티켓 요리 3장을 최상단에 고정한다 (튜토리얼 성공 보장)
    var cursor = 0, k;
    for (k = 0; k < TUNING.COPIES_PER_TYPE; k++) reserved[topSlots[cursor++]] = firstDish;
    // ② 나머지 요리도 최상단 1자리씩 확보한다 (즉시 도달 가능성 보장)
    for (k = 0; k < dishIds.length; k++) {
      if (dishIds[k] === firstDish) continue;
      reserved[topSlots[cursor++]] = dishIds[k];
    }

    // ③ 남은 타일을 남은 자리(잔여 최상단 + 하단 9자리)에 무작위 배치
    var restTiles = [];
    dishIds.forEach(function (id) {
      var placed = id === firstDish ? TUNING.COPIES_PER_TYPE : 1;
      for (var n = placed; n < TUNING.COPIES_PER_TYPE; n++) restTiles.push(id);
    });
    restTiles = shuffle(restTiles, rng);

    var openTops = topSlots.slice(cursor);
    var bag = restTiles.slice();
    openTops.forEach(function (cell) { reserved[cell] = bag.pop(); });

    var cells = [];
    for (var i = 0; i < CELL_COUNT; i++) cells.push([]);
    deep.forEach(function (cell) { cells[cell].push(bag.pop()); });   // 하단층
    filled.forEach(function (cell) { cells[cell].push(reserved[cell]); }); // 최상단

    return { cells: cells, emptyCell: emptyCell, dishes: dishIds, firstDish: firstDish };
  }

  /** 배치 불변식 검증. 위반 사유 배열을 돌려준다(빈 배열이면 정상). */
  function validateBoard(board) {
    var problems = [];
    var counts = {}, tops = {}, total = 0, empties = 0;

    board.cells.forEach(function (stack) {
      if (stack.length === 0) { empties++; return; }
      if (stack.length > 2) problems.push('스택 3층 이상');
      stack.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; total++; });
      var top = stack[stack.length - 1];
      tops[top] = (tops[top] || 0) + 1;
    });

    if (total !== TOTAL_TILES) problems.push('총 타일 수 ' + total + ' ≠ ' + TOTAL_TILES);
    if (empties !== 1) problems.push('빈 칸 ' + empties + '개');
    if (board.dishes.length !== TUNING.TILE_TYPES) problems.push('요리 종수 불일치');

    board.dishes.forEach(function (id) {
      if (counts[id] !== TUNING.COPIES_PER_TYPE) problems.push(id + ' 타일 ' + (counts[id] || 0) + '장');
      if (!tops[id]) problems.push(id + ' 완전 가림(데드락 후보)');
    });
    if ((tops[board.firstDish] || 0) !== TUNING.COPIES_PER_TYPE) problems.push('첫 주문 요리가 1층에 있음');
    return problems;
  }

  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }

  /* =========================================================================
   * 5. 트레이 규칙 (순수 함수)
   * ====================================================================== */

  /** 같은 요리끼리 인접하도록 최초 등장 순서 기준으로 안정 정렬한다. */
  function sortTray(tray) {
    var order = [], seen = {};
    tray.forEach(function (t) { if (!seen[t.dish]) { seen[t.dish] = true; order.push(t.dish); } });
    var out = [];
    order.forEach(function (dish) {
      tray.forEach(function (t) { if (t.dish === dish) out.push(t); });
    });
    return out;
  }

  /** 3장 모인 요리의 트레이 인덱스 배열. 없으면 null. */
  function findTriple(tray) {
    var byDish = {};
    tray.forEach(function (t, i) { (byDish[t.dish] = byDish[t.dish] || []).push(i); });
    for (var dish in byDish) {
      if (byDish[dish].length >= TUNING.COPIES_PER_TYPE) {
        return { dish: dish, indices: byDish[dish].slice(0, TUNING.COPIES_PER_TYPE) };
      }
    }
    return null;
  }

  /**
   * 3매칭이 소모한 요리로 어떤 티켓을 처리할지 결정한다(순수 함수).
   * cleared 는 이번 매칭이 이미 반영된 상태여야 한다.
   *
   * ① 노출된 티켓이 그 요리를 요구하면 그 티켓을 완료한다.
   * ② 아니면, 남은 요리가 대기 티켓 수보다 모자라지는지 본다. 모자라면 대기 티켓을
   *    이 요리로 승격해 라운드가 조용히 클리어 불가 상태가 되는 것을 막는다.
   * ③ 둘 다 아니면 정리 보너스만 준다.
   */
  function pickTicketForClear(tickets, dishIds, cleared, dish) {
    var i;
    for (i = 0; i < tickets.length; i++) {
      if (tickets[i].status === 'active' && tickets[i].dish === dish) {
        return { ticket: tickets[i], promoted: false };
      }
    }
    var uncleared = 0, active = 0, queued = 0;
    for (i = 0; i < dishIds.length; i++) if (!cleared[dishIds[i]]) uncleared++;
    for (i = 0; i < tickets.length; i++) {
      if (tickets[i].status === 'active') active++;
      else if (tickets[i].status === 'queued') queued++;
    }
    if (uncleared - active < queued) {
      for (i = 0; i < tickets.length; i++) {
        if (tickets[i].status === 'queued') return { ticket: tickets[i], promoted: true };
      }
    }
    return { ticket: null, promoted: false };
  }

  function comboMultiplier(step) {
    var steps = TUNING.COMBO_STEPS;
    return steps[Math.min(Math.max(step, 0), steps.length - 1)];
  }

  function awardCoins(base, step) {
    return Math.max(0, Math.floor(base * comboMultiplier(step)));
  }

  /* =========================================================================
   * 6. DOM 참조
   * ====================================================================== */
  var el = {
    board: document.getElementById('board'),
    tray: document.getElementById('tray'),
    trayWrap: document.querySelector('.tray-wrap'),
    trayLeft: document.getElementById('trayLeft'),
    ticketList: document.getElementById('ticketList'),
    queueInfo: document.getElementById('queueInfo'),
    doneCount: document.getElementById('doneCount'),
    totalCount: document.getElementById('totalCount'),
    coinBox: document.getElementById('coinBox'),
    coinValue: document.getElementById('coinValue'),
    timerBox: document.getElementById('timerBox'),
    timerFill: document.getElementById('timerFill'),
    timerValue: document.getElementById('timerValue'),
    hint: document.getElementById('hint'),
    live: document.getElementById('live'),
    fx: document.getElementById('fx'),
    muteBtn: document.getElementById('muteBtn'),
    pause: document.getElementById('pause'),
    resumeBtn: document.getElementById('resumeBtn'),
    result: document.getElementById('result'),
    resultBadge: document.getElementById('resultBadge'),
    resultTitle: document.getElementById('resultTitle'),
    resultLead: document.getElementById('resultLead'),
    rCoins: document.getElementById('rCoins'),
    rOrders: document.getElementById('rOrders'),
    rTime: document.getElementById('rTime'),
    rCombo: document.getElementById('rCombo'),
    replayBtn: document.getElementById('replayBtn'),
    moreBtn: document.getElementById('moreBtn'),
    moreNote: document.getElementById('moreNote')
  };

  /* =========================================================================
   * 7. 상태
   * ====================================================================== */
  var state = null;
  var uidSeq = 0;
  var rafId = 0;
  var timeoutPending = false;

  function reduceMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function readSeedParam() {
    try {
      var m = /[?&]seed=(-?\d+)/.exec(window.location.search);
      if (m) return parseInt(m[1], 10) >>> 0;
    } catch (e) { /* file:// 등에서 무시 */ }
    return 0;
  }

  function loadMuted() {
    try { return window.localStorage.getItem('order-tray:muted') === '1'; }
    catch (e) { return false; }
  }
  function saveMuted(v) {
    try { window.localStorage.setItem('order-tray:muted', v ? '1' : '0'); }
    catch (e) { /* 저장 실패해도 게임은 정상 동작한다 */ }
  }

  function newRound(seedOverride) {
    var seed = seedOverride || readSeedParam() || (((Date.now() ^ (uidSeq * 2654435761)) >>> 0) || 1);
    var rng = makeRng(seed);
    var dishes = pickDishes(rng);
    var firstDish = dishes[Math.floor(rng() * dishes.length)];
    var board = buildBoard(rng, dishes, firstDish);

    var problems = validateBoard(board);
    if (problems.length) {
      // 폴백: 전량 1층 배치(난이도 하향). 실제로 도달하지 않는 안전망이다.
      board = buildFlatFallback(rng, dishes, firstDish);
    }

    var tickets = [];
    for (var i = 0; i < TUNING.TICKET_COUNT; i++) {
      tickets.push({ reward: TUNING.TICKET_REWARDS[i], dish: null, status: 'queued' });
    }
    tickets[0].dish = firstDish;

    state = {
      phase: 'READY',
      seed: seed,
      rng: rng,
      cells: board.cells,
      dishes: dishes,
      cleared: {},              // 이미 3매칭으로 소모한 요리
      tray: [],
      tickets: tickets,
      coins: 0,
      comboStep: -1,
      comboUntil: 0,
      maxComboStep: 0,
      ordersDone: 0,
      timeLeftMs: TUNING.ROUND_MS,
      lastNow: 0,
      locked: false,
      muted: loadMuted(),
      focusIndex: 0,
      announced: {}
    };
    timeoutPending = false;

    // 최초 노출 티켓 3장 채우기
    for (var v = 0; v < TUNING.TICKET_VISIBLE; v++) revealTicket();
  }

  function buildFlatFallback(rng, dishIds, firstDish) {
    var tiles = [];
    dishIds.forEach(function (id) {
      for (var n = 0; n < TUNING.COPIES_PER_TYPE; n++) tiles.push(id);
    });
    tiles = shuffle(tiles, rng);
    // 16칸에 24장을 1층으로 담을 수 없으므로 8장은 부득이 2층으로 남긴다.
    var cells = [];
    for (var i = 0; i < CELL_COUNT; i++) cells.push([]);
    var order = shuffle(range(CELL_COUNT), rng);
    var emptyCell = order[0];
    var filled = order.slice(1);
    filled.forEach(function (c, i) { cells[c].push(tiles[i]); });
    tiles.slice(FILLED_CELLS).forEach(function (t, i) { cells[filled[i]].push(t); });
    return { cells: cells, emptyCell: emptyCell, dishes: dishIds, firstDish: firstDish };
  }

  /** 노출 슬롯이 비면 아직 소모되지 않은 요리 중에서 다음 티켓을 뽑는다. */
  function revealTicket() {
    var active = state.tickets.filter(function (t) { return t.status === 'active'; });
    if (active.length >= TUNING.TICKET_VISIBLE) return;
    var next = null;
    for (var i = 0; i < state.tickets.length; i++) {
      if (state.tickets[i].status === 'queued') { next = state.tickets[i]; break; }
    }
    if (!next) return;

    if (!next.dish) {
      var taken = {};
      active.forEach(function (t) { taken[t.dish] = true; });
      var pool = state.dishes.filter(function (id) { return !state.cleared[id] && !taken[id]; });
      if (!pool.length) return;                       // 남은 요리가 없으면 노출하지 않는다
      next.dish = pool[Math.floor(state.rng() * pool.length)];
    } else if (state.cleared[next.dish]) {
      var alt = state.dishes.filter(function (id) { return !state.cleared[id]; });
      if (!alt.length) return;
      next.dish = alt[Math.floor(state.rng() * alt.length)];
    }
    next.status = 'active';
  }

  /* =========================================================================
   * 8. 렌더
   * ====================================================================== */
  function renderAll() {
    renderBoard(true);
    renderTray();
    renderTickets();
    renderHud();
  }

  function cellLabel(i) {
    var row = Math.floor(i / TUNING.BOARD_COLS) + 1;
    var col = (i % TUNING.BOARD_COLS) + 1;
    var stack = state.cells[i];
    if (!stack.length) return row + '행 ' + col + '열, 빈 칸';
    var top = BY_ID[stack[stack.length - 1]];
    return row + '행 ' + col + '열, ' + top.name + ', 남은 층 ' + stack.length;
  }

  function renderBoard(rebuild) {
    if (rebuild) el.board.textContent = '';
    for (var i = 0; i < CELL_COUNT; i++) {
      var btn = el.board.children[i];
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cell';
        btn.dataset.index = String(i);
        el.board.appendChild(btn);
      }
      var stack = state.cells[i];
      var playable = stack.length > 0 && state.phase !== 'WON' && state.phase !== 'LOST';
      btn.disabled = !playable;
      btn.setAttribute('aria-label', cellLabel(i));
      btn.classList.toggle('empty', stack.length === 0);
      btn.classList.toggle('stacked', stack.length > 1);
      btn.tabIndex = i === state.focusIndex && playable ? 0 : -1;

      if (!stack.length) { btn.innerHTML = ''; delete btn.dataset.dish; continue; }
      var top = BY_ID[stack[stack.length - 1]];
      btn.dataset.dish = top.id;
      btn.innerHTML =
        dishSvg(top.id, 'c-ico') +
        '<span class="c-name">' + top.name + '</span>' +
        (stack.length > 1 ? '<span class="c-badge" aria-hidden="true">+' + (stack.length - 1) + '</span>' : '');
    }
    ensureFocusable();
  }

  function ensureFocusable() {
    var cur = el.board.children[state.focusIndex];
    if (cur && !cur.disabled) return;
    for (var i = 0; i < CELL_COUNT; i++) {
      if (!el.board.children[i].disabled) { setFocusIndex(i, false); return; }
    }
  }

  function setFocusIndex(i, move) {
    state.focusIndex = i;
    for (var k = 0; k < CELL_COUNT; k++) {
      el.board.children[k].tabIndex = (k === i && !el.board.children[k].disabled) ? 0 : -1;
    }
    if (move) el.board.children[i].focus();
  }

  function renderTray(clearingIdx) {
    el.tray.textContent = '';
    for (var i = 0; i < TUNING.TRAY_SLOTS; i++) {
      var li = document.createElement('li');
      li.className = 'slot';
      var t = state.tray[i];
      if (t) {
        li.classList.add('filled');
        li.dataset.dish = t.dish;
        li.innerHTML = dishSvg(t.dish, 's-ico');
        li.setAttribute('aria-label', (i + 1) + '번 칸, ' + BY_ID[t.dish].name);
        if (clearingIdx && clearingIdx.indexOf(i) !== -1) li.classList.add('clearing');
      } else {
        li.setAttribute('aria-label', (i + 1) + '번 칸, 비어 있음');
      }
      el.tray.appendChild(li);
    }
    var left = TUNING.TRAY_SLOTS - state.tray.length;
    el.trayLeft.textContent = '여유 ' + left + '칸';
    el.trayWrap.classList.toggle('warn', left <= TUNING.TRAY_WARN_LEFT && state.phase !== 'WON' && state.phase !== 'LOST');
    if (left <= TUNING.TRAY_WARN_LEFT && !state.announced['tray' + left]) {
      state.announced['tray' + left] = true;
      announce('트레이 여유 ' + left + '칸');
    }
  }

  function renderTickets() {
    el.ticketList.textContent = '';
    var active = state.tickets.filter(function (t) { return t.status === 'active' || t.status === 'stamping'; });
    for (var i = 0; i < TUNING.TICKET_VISIBLE; i++) {
      var li = document.createElement('li');
      var t = active[i];
      if (!t) {
        li.className = 'ticket slot-empty';
        li.setAttribute('aria-label', '빈 주문 자리');
        el.ticketList.appendChild(li);
        continue;
      }
      var d = BY_ID[t.dish];
      li.className = 'ticket' + (t.status === 'stamping' ? ' done' : '');
      li.dataset.dish = t.dish;
      li.setAttribute('aria-label', d.name + ' 3개 주문, 보상 ' + t.reward + '코인' + (t.status === 'stamping' ? ', 완료' : ''));
      li.innerHTML =
        dishSvg(d.id, 't-ico') +
        '<span class="t-name">' + d.name + '</span>' +
        '<span class="t-reward">' + COIN_SVG + t.reward + '</span>';
      el.ticketList.appendChild(li);
    }
    var queued = state.tickets.filter(function (t) { return t.status === 'queued'; }).length;
    el.queueInfo.textContent = queued ? '대기 주문 ' + queued + '장' : '대기 주문 없음';
    el.doneCount.textContent = String(state.ordersDone);
    el.totalCount.textContent = String(TUNING.TICKET_COUNT);
  }

  function renderHud() {
    el.coinValue.textContent = String(state.coins);
    var ratio = Math.max(0, state.timeLeftMs) / TUNING.ROUND_MS;
    el.timerFill.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
    el.timerValue.textContent = (Math.max(0, state.timeLeftMs) / 1000).toFixed(1);
    el.timerBox.classList.toggle('low', state.timeLeftMs <= 10000);
    el.muteBtn.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
    el.muteBtn.querySelector('.sr-only').textContent =
      (state.muted ? '효과음 켜기' : '효과음 끄기') + ' (단축키 M)';
  }

  function announce(msg) {
    el.live.textContent = '';
    // 같은 문구 반복도 읽히도록 다음 프레임에 넣는다
    window.setTimeout(function () { el.live.textContent = msg; }, 30);
  }

  /* =========================================================================
   * 9. 오디오 (Web Audio 합성 — 음원 파일 없음)
   * ====================================================================== */
  var audioCtx = null;
  function tone(freq, ms, type, gain) {
    if (state.muted) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(gain || 0.09, audioCtx.currentTime + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + ms / 1000 + 0.02);
    } catch (e) { /* 오디오 실패는 게임에 영향을 주지 않는다 */ }
  }
  function sfxSend() { tone(520, 90, 'triangle', 0.06); }
  function sfxMatch() { [660, 830, 990].forEach(function (f, i) { window.setTimeout(function () { tone(f, 120, 'sine', 0.08); }, i * 70); }); }
  function sfxTicket() { [740, 1110].forEach(function (f, i) { window.setTimeout(function () { tone(f, 200, 'triangle', 0.09); }, i * 130); }); }
  function sfxFail() { tone(150, 420, 'sawtooth', 0.07); }

  /* =========================================================================
   * 10. 이펙트
   * ====================================================================== */
  function wait(ms) {
    return new Promise(function (res) { window.setTimeout(res, reduceMotion() ? 1 : ms); });
  }

  function flyTile(fromEl, toEl, dishId) {
    if (reduceMotion() || !fromEl || !toEl || !fromEl.animate) return Promise.resolve();
    var a = fromEl.getBoundingClientRect();
    var b = toEl.getBoundingClientRect();
    var node = document.createElement('div');
    node.className = 'flyer';
    node.style.left = a.left + 'px';
    node.style.top = a.top + 'px';
    node.style.width = a.width + 'px';
    node.style.height = a.height + 'px';
    node.innerHTML = dishSvg(dishId, 'f-ico');
    el.fx.appendChild(node);

    var dx = b.left - a.left, dy = b.top - a.top;
    var scale = b.width / Math.max(1, a.width);
    var anim = node.animate([
      { transform: 'translate(0,0) scale(1)' },
      { transform: 'translate(' + dx * 0.55 + 'px,' + (dy * 0.35 - 24) + 'px) scale(' + ((1 + scale) / 2) + ')', offset: 0.55 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + scale + ')' }
    ], { duration: TUNING.FLY_MS, easing: 'cubic-bezier(.34,.9,.4,1)' });

    return new Promise(function (res) {
      anim.onfinish = function () { node.remove(); res(); };
      window.setTimeout(function () { if (node.parentNode) { node.remove(); res(); } }, TUNING.FLY_MS + 240);
    });
  }

  /** rect 는 호출 전에 미리 측정한 값이어야 한다(제거된 슬롯은 0 크기를 돌려준다). */
  function coinSparks(a) {
    if (reduceMotion() || !a || !el.fx.animate) return;
    var b = el.coinBox.getBoundingClientRect();
    for (var i = 0; i < 4; i++) {
      (function (i) {
        var s = document.createElement('span');
        s.className = 'spark';
        s.style.left = (a.left + a.width / 2 - 9) + 'px';
        s.style.top = (a.top + a.height / 2 - 9) + 'px';
        el.fx.appendChild(s);
        var an = s.animate([
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: 'translate(' + (b.left - a.left) + 'px,' + (b.top - a.top) + 'px) scale(.35)', opacity: .2 }
        ], { duration: 380 + i * 60, easing: 'cubic-bezier(.4,0,.2,1)', delay: i * 40 });
        an.onfinish = function () { s.remove(); };
      })(i);
    }
    el.coinBox.classList.add('bump');
    window.setTimeout(function () { el.coinBox.classList.remove('bump'); }, 200);
  }

  /* =========================================================================
   * 11. 코어 루프
   * ====================================================================== */
  function startPlaying() {
    if (state.phase !== 'READY') return;
    state.phase = 'PLAYING';
    state.lastNow = performance.now();
    el.hint.hidden = true;
    loop();
  }

  function loop() {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function step(now) {
      if (state.phase !== 'PLAYING' && state.phase !== 'RESOLVING') return;
      var dt = now - state.lastNow;
      state.lastNow = now;
      if (state.phase === 'PLAYING') {
        state.timeLeftMs -= dt;
        var sec = Math.ceil(state.timeLeftMs / 1000);
        if ((sec === 10 || sec === 5) && !state.announced['t' + sec]) {
          state.announced['t' + sec] = true;
          announce(sec + '초 남았습니다');
        }
        if (state.timeLeftMs <= 0) {
          state.timeLeftMs = 0;
          renderHud();
          // 판정 중이면 입력 핸들러의 결과 확정을 우선한다
          if (state.locked) { timeoutPending = true; }
          else { finishOnce('lost-time'); return; }
        }
        renderHud();
      }
      rafId = requestAnimationFrame(step);
    });
  }

  function sendTile(index) {
    if (!state || state.locked) return;
    if (state.phase === 'READY') startPlaying();
    if (state.phase !== 'PLAYING') return;
    var stack = state.cells[index];
    if (!stack || !stack.length) return;
    if (state.tray.length >= TUNING.TRAY_SLOTS) return;

    state.locked = true;
    resolveSend(index).then(function () {
      state.locked = false;
      if (timeoutPending && state.phase === 'PLAYING') finishOnce('lost-time');
    });
  }

  function resolveSend(index) {
    var stack = state.cells[index];
    var dishId = stack.pop();
    var cellEl = el.board.children[index];
    var targetSlot = el.tray.children[state.tray.length];

    sfxSend();
    var flying = flyTile(cellEl, targetSlot, dishId);
    renderBoard(false);

    return flying.then(function () {
      state.tray.push({ dish: dishId, uid: ++uidSeq });
      state.tray = sortTray(state.tray);
      renderTray();

      var trip = findTriple(state.tray);
      if (!trip) {
        if (state.tray.length >= TUNING.TRAY_SLOTS) { finishOnce('lost-overflow'); }
        return null;
      }
      return clearTriple(trip);
    });
  }

  function clearTriple(trip) {
    sfxMatch();
    renderTray(trip.indices);
    var slotEl = el.tray.children[trip.indices[0]];
    var slotRect = slotEl ? slotEl.getBoundingClientRect() : null;

    return wait(TUNING.CLEAR_MS).then(function () {
      var keep = {};
      trip.indices.forEach(function (i) { keep[i] = true; });
      state.tray = state.tray.filter(function (_, i) { return !keep[i]; });
      state.cleared[trip.dish] = true;
      renderTray();

      // 콤보
      var now = performance.now();
      state.comboStep = now <= state.comboUntil ? state.comboStep + 1 : 0;
      state.comboUntil = now + TUNING.COMBO_WINDOW_MS;
      if (state.comboStep > state.maxComboStep) state.maxComboStep = state.comboStep;

      var pick = pickTicketForClear(state.tickets, state.dishes, state.cleared, trip.dish);
      var ticket = pick.ticket, promoted = pick.promoted;
      if (promoted) ticket.dish = trip.dish;

      var gained = awardCoins(ticket ? ticket.reward : TUNING.LOOSE_MATCH_COIN, state.comboStep);
      state.coins = Math.max(0, state.coins + gained);
      coinSparks(slotRect);
      renderHud();

      if (!ticket) {
        announce(BY_ID[trip.dish].name + ' 정리, ' + gained + '코인');
        return null;
      }

      state.ordersDone++;
      sfxTicket();
      announce(BY_ID[trip.dish].name + (promoted ? ' 선주문 처리' : ' 주문 완료') + ', ' + gained +
        '코인. 남은 주문 ' + (TUNING.TICKET_COUNT - state.ordersDone) + '장');

      // 승리는 여기서 즉시 확정한다(타이머 만료와 경쟁 시 입력 우선)
      if (state.ordersDone >= TUNING.TICKET_COUNT) { ticket.status = 'done'; renderTickets(); finishOnce('won'); return null; }

      if (promoted) {                       // 노출된 적 없는 티켓 — 도장 연출 없이 바로 마감
        ticket.status = 'done';
        revealTicket();
        renderTickets();
        return null;
      }

      ticket.status = 'stamping';
      renderTickets();
      return wait(TUNING.STAMP_MS).then(function () {
        ticket.status = 'done';
        revealTicket();
        renderTickets();
      });
    });
  }

  function finishOnce(result) {
    if (!state || state.phase === 'RESOLVING' || state.phase === 'WON' || state.phase === 'LOST') return;
    state.phase = 'RESOLVING';
    cancelAnimationFrame(rafId);

    var won = result === 'won';
    var bonus = 0;
    if (won) {
      bonus = Math.floor(Math.max(0, state.timeLeftMs) / 1000) * TUNING.TIME_BONUS_PER_SEC;
      state.coins += bonus;
    } else {
      sfxFail();
    }
    state.phase = won ? 'WON' : 'LOST';
    renderBoard(false);
    renderTray();
    renderHud();
    showResult(result, bonus);
  }

  function showResult(result, bonus) {
    var won = result === 'won';
    el.result.classList.toggle('lost', !won);
    el.resultBadge.textContent = won ? '주문 완료' : '영업 종료';
    el.resultTitle.textContent = won ? '오늘 주문 전부 처리!' : (result === 'lost-time' ? '시간이 다 됐어요' : '트레이가 넘쳤어요');
    el.resultLead.textContent = won
      ? '남은 시간 보너스 ' + bonus + '코인을 더했습니다.'
      : (result === 'lost-time' ? '제한 시간 안에 주문 5장을 처리하지 못했습니다.' : '트레이 6칸이 모두 찼는데 3개 매칭이 성립하지 않았습니다.');
    el.rCoins.textContent = String(state.coins);
    el.rOrders.textContent = state.ordersDone + ' / ' + TUNING.TICKET_COUNT;
    el.rTime.textContent = (Math.max(0, state.timeLeftMs) / 1000).toFixed(1) + '초';
    el.rCombo.textContent = '×' + comboMultiplier(state.maxComboStep).toFixed(1);
    el.result.hidden = false;
    announce(won ? '승리했습니다.' : '실패했습니다.');
    window.setTimeout(function () { el.resultTitle.focus(); }, 40);
  }

  function restart() {
    el.result.hidden = true;
    el.pause.hidden = true;
    el.result.classList.remove('lost');
    el.moreNote.hidden = true;
    el.moreBtn.disabled = false;
    cancelAnimationFrame(rafId);
    var keepMuted = state ? state.muted : loadMuted();
    newRound(0);
    state.muted = keepMuted;
    el.hint.hidden = false;
    renderAll();
    setFocusIndex(firstPlayableIndex(), true);
    announce('새 라운드를 시작합니다.');
  }

  function firstPlayableIndex() {
    for (var i = 0; i < CELL_COUNT; i++) if (state.cells[i].length) return i;
    return 0;
  }

  /* =========================================================================
   * 12. 입력
   * ====================================================================== */
  el.board.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.cell') : null;
    if (!btn || btn.disabled) return;
    setFocusIndex(Number(btn.dataset.index), false);
    sendTile(Number(btn.dataset.index));
  });

  el.board.addEventListener('keydown', function (e) {
    var dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (dir) {
      e.preventDefault();
      moveFocus(dir[0], dir[1]);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      var btn = el.board.children[state.focusIndex];
      if (btn && !btn.disabled) sendTile(state.focusIndex);
    }
  });

  function moveFocus(dx, dy) {
    var col = state.focusIndex % TUNING.BOARD_COLS;
    var row = Math.floor(state.focusIndex / TUNING.BOARD_COLS);
    // 방향으로 이동하며 선택 불가 칸은 건너뛴다. 없으면 제자리에 머문다.
    for (var step = 1; step <= Math.max(TUNING.BOARD_COLS, TUNING.BOARD_ROWS); step++) {
      var c = col + dx * step, r = row + dy * step;
      if (c < 0 || c >= TUNING.BOARD_COLS || r < 0 || r >= TUNING.BOARD_ROWS) break;
      var idx = r * TUNING.BOARD_COLS + c;
      if (!el.board.children[idx].disabled) { setFocusIndex(idx, true); return; }
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (k === 'r') { e.preventDefault(); restart(); }
    else if (k === 'm') { e.preventDefault(); toggleMute(); }
    else if (e.key === 'Tab' && !el.result.hidden) trapTab(e);
  });

  function trapTab(e) {
    var focusables = [el.replayBtn, el.moreBtn].filter(function (b) { return !b.disabled; });
    if (!focusables.length) return;
    var i = focusables.indexOf(document.activeElement);
    e.preventDefault();
    var next = e.shiftKey
      ? focusables[(i <= 0 ? focusables.length : i) - 1]
      : focusables[(i + 1) % focusables.length];
    next.focus();
  }

  function toggleMute() {
    state.muted = !state.muted;
    saveMuted(state.muted);
    renderHud();
    announce(state.muted ? '효과음을 껐습니다.' : '효과음을 켰습니다.');
  }

  el.muteBtn.addEventListener('click', toggleMute);
  el.replayBtn.addEventListener('click', restart);
  el.moreBtn.addEventListener('click', function () {
    // 팩 허브(루트 index.html)가 생긴 뒤로는 다른 7종과 같이 허브로 돌아간다.
    // 이 폴더만 따로 전달된 경우(허브 없음)를 대비해 안내 문구는 그대로 띄워 둔다.
    el.moreNote.hidden = false;
    el.moreBtn.disabled = true;
    announce('패키지 첫 화면으로 이동합니다.');
    window.location.href = '../../index.html';
  });

  el.resumeBtn.addEventListener('click', function () {
    el.pause.hidden = true;
    if (state.phase === 'PAUSED') {
      state.phase = 'PLAYING';
      state.lastNow = performance.now();
      loop();
    }
    setFocusIndex(state.focusIndex, true);
  });

  document.addEventListener('visibilitychange', function () {
    if (!state) return;
    if (document.hidden && state.phase === 'PLAYING') {
      state.phase = 'PAUSED';
      cancelAnimationFrame(rafId);
      el.pause.hidden = false;
    }
  });

  /* =========================================================================
   * 13. ?test=1 — 순수 함수 자동 검증 (100시드)
   * ====================================================================== */
  /**
   * DOM 없이 티켓 규칙만 돌리는 적대적 시뮬레이터.
   * 플레이어가 항상 "노출 티켓이 요구하지 않는 요리" 부터 소모하는 최악의 순서를 재현하고,
   * 그래도 주문 5장이 전부 처리 가능한지(= 라운드가 조용히 클리어 불가가 되지 않는지) 확인한다.
   */
  function simulateWorstCase(seed) {
    var rng = makeRng(seed);
    var dishIds = pickDishes(rng);
    var cleared = {}, ordersDone = 0, i;
    var tickets = TUNING.TICKET_REWARDS.map(function (r) {
      return { reward: r, dish: null, status: 'queued' };
    });
    tickets[0].dish = dishIds[0];

    function activeDishSet() {
      var m = {};
      tickets.forEach(function (t) { if (t.status === 'active') m[t.dish] = true; });
      return m;
    }
    function reveal() {
      for (var guard = 0; guard < TUNING.TICKET_COUNT; guard++) {
        var active = 0, next = null;
        for (i = 0; i < tickets.length; i++) {
          if (tickets[i].status === 'active') active++;
          else if (tickets[i].status === 'queued' && !next) next = tickets[i];
        }
        if (active >= TUNING.TICKET_VISIBLE || !next) return;
        if (!next.dish || cleared[next.dish]) {
          var taken = activeDishSet();
          var pool = dishIds.filter(function (id) { return !cleared[id] && !taken[id]; });
          if (!pool.length) return;
          next.dish = pool[0];
        }
        next.status = 'active';
      }
    }

    reveal();
    for (var step = 0; step < 24 && ordersDone < TUNING.TICKET_COUNT; step++) {
      var taken = activeDishSet();
      var spare = dishIds.filter(function (id) { return !cleared[id] && !taken[id]; });
      var rest = dishIds.filter(function (id) { return !cleared[id]; });
      var dish = spare.length ? spare[0] : rest[0];
      if (!dish) break;
      cleared[dish] = true;
      var pick = pickTicketForClear(tickets, dishIds, cleared, dish);
      if (pick.ticket) {
        if (pick.promoted) pick.ticket.dish = dish;
        pick.ticket.status = 'done';
        ordersDone++;
        reveal();
      }
    }
    return ordersDone;
  }

  function runTests() {
    var fails = [];
    function ok(cond, label) { if (!cond) fails.push(label); }

    for (var s = 1; s <= 100; s++) {
      var rng = makeRng(s * 2654435761);
      var dishes = pickDishes(rng);
      ok(dishes.length === TUNING.TILE_TYPES, 'seed ' + s + ': 요리 ' + dishes.length + '종');
      var groups = {};
      dishes.forEach(function (id) { groups[BY_ID[id].group] = (groups[BY_ID[id].group] || 0) + 1; });
      for (var g in groups) ok(groups[g] <= TUNING.MAX_PER_SILHOUETTE, 'seed ' + s + ': 실루엣 그룹 ' + g + ' 과다');
      var board = buildBoard(rng, dishes, dishes[0]);
      var problems = validateBoard(board);
      ok(problems.length === 0, 'seed ' + s + ': ' + problems.join(' / '));
    }

    // 시드 재현성
    var dr = pickDishes(makeRng(7));
    var b1 = buildBoard(makeRng(42), dr, dr[0]);
    var b2 = buildBoard(makeRng(42), dr, dr[0]);
    ok(JSON.stringify(b1.cells) === JSON.stringify(b2.cells), '동일 시드 재현 실패');

    // 최악 플레이(노출 티켓이 요구하지 않는 요리부터 소모)에서도 주문 5장을 모두 처리할 수 있어야 한다
    for (var w = 1; w <= 100; w++) {
      var done = simulateWorstCase(w * 40503);
      ok(done === TUNING.TICKET_COUNT, 'seed ' + w + ': 최악 플레이 주문 ' + done + '/' + TUNING.TICKET_COUNT);
    }

    // 트레이 정렬: 같은 요리 인접
    var tray = [{ dish: 'a' }, { dish: 'b' }, { dish: 'a' }, { dish: 'c' }, { dish: 'b' }];
    var sorted = sortTray(tray).map(function (t) { return t.dish; }).join('');
    ok(sorted === 'aabbc', '트레이 정렬 실패: ' + sorted);

    // 3매칭 탐지
    ok(findTriple([{ dish: 'a' }, { dish: 'a' }]) === null, '2장에서 매칭 오탐');
    var trip = findTriple([{ dish: 'a' }, { dish: 'b' }, { dish: 'a' }, { dish: 'a' }]);
    ok(trip && trip.dish === 'a' && trip.indices.length === 3, '3매칭 탐지 실패');

    // 콤보·코인
    ok(comboMultiplier(0) === 1.0 && comboMultiplier(1) === 1.2 && comboMultiplier(9) === 1.5, '콤보 상한 실패');
    ok(awardCoins(500, 2) === 750, '코인 산식 실패: ' + awardCoins(500, 2));
    ok(awardCoins(10, 0) === 10, '기본 보상 실패');
    ok(awardCoins(-100, 0) === 0, '코인 하한 실패');

    if (fails.length) {
      console.error('[order-tray] 검증 실패 ' + fails.length + '건');
      fails.forEach(function (f) { console.error(' - ' + f); });
    } else {
      console.log('[order-tray] 검증 통과 — 100시드 배치 + 규칙 단위 전부 정상');
    }
    return fails;
  }

  /* =========================================================================
   * 14. 부팅
   * ====================================================================== */
  newRound(0);
  renderAll();
  setFocusIndex(firstPlayableIndex(), false);

  window.OrderTray = {
    TUNING: TUNING,
    makeRng: makeRng,
    pickDishes: pickDishes,
    buildBoard: buildBoard,
    validateBoard: validateBoard,
    sortTray: sortTray,
    findTriple: findTriple,
    pickTicketForClear: pickTicketForClear,
    comboMultiplier: comboMultiplier,
    awardCoins: awardCoins,
    simulateWorstCase: simulateWorstCase,
    runTests: runTests
  };

  if (/[?&]test=1/.test(window.location.search)) runTests();
})();
