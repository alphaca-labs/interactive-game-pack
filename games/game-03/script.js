/* 플레이트 스택 — games/game-03/script.js
 *
 * 기획 기준: outputs/plans/plate-stack.md
 * 외부 의존성 0, 네트워크 요청 0. file:// 직접 실행을 전제로 한다.
 *
 * 구조
 *   1) CONFIG / 데이터
 *   2) 시드 RNG
 *   3) 순수 규칙 엔진 — pick / resolve / isLost / isCleared
 *      DOM 을 모르는 함수라 보드 생성 검증기와 게임 본체가 같은 코드를 쓴다.
 *   4) 보드 생성 — 역방향 생성 + 자체 검증
 *   5) 게임 컨트롤러 (렌더 · 입력 · 타이머 · 연출 · 오디오)
 *   6) ?test=1 자체 검증 러너
 */
(function () {
  'use strict';

  /* ── 1) CONFIG / 데이터 ─────────────────────────── */

  var CONFIG = {
    COLUMNS: 6,
    COLUMN_HEIGHT: 4,
    TRAY_SIZE: 3,
    ACTIVE_ORDERS: 2,
    ORDER_SIZE: 3,
    ROUND_MS: 60000,
    MOVE_MS: 220,
    COIN_TABLE: [40, 80, 120, 200, 300],
    COMBO: [1.0, 1.2, 1.5],
    TIME_BONUS_PER_SEC: 5,
    MAX_ORDERS_PER_DISH: 3,
    GEN_ATTEMPTS: 20,
    FALLBACK_SEED: 20260806
  };

  CONFIG.TOTAL_PLATES = CONFIG.COLUMNS * CONFIG.COLUMN_HEIGHT;              // 24
  CONFIG.ORDER_COUNT = CONFIG.TOTAL_PLATES / CONFIG.ORDER_SIZE;             // 8

  var DISHES = [
    { id: 'salmon',  name: '연어초밥',  symbol: 'dish-salmon' },
    { id: 'onigiri', name: '주먹밥',    symbol: 'dish-onigiri' },
    { id: 'ebi',     name: '새우튀김',  symbol: 'dish-ebi' },
    { id: 'maki',    name: '마끼',      symbol: 'dish-maki' },
    { id: 'udon',    name: '우동',      symbol: 'dish-udon' },
    { id: 'gyudon',  name: '규동',      symbol: 'dish-gyudon' }
  ];

  var DISH_BY_ID = {};
  DISHES.forEach(function (d) { DISH_BY_ID[d.id] = d; });

  function dishName(id) { return DISH_BY_ID[id] ? DISH_BY_ID[id].name : id; }
  function dishSymbol(id) { return DISH_BY_ID[id] ? DISH_BY_ID[id].symbol : 'coin'; }

  /* ── 2) 시드 RNG ────────────────────────────────── */

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickFrom(rng, list) { return list[Math.floor(rng() * list.length) % list.length]; }

  /* ── 3) 순수 규칙 엔진 ──────────────────────────── */

  function makeState(columns, orders) {
    return {
      columns: columns.map(function (c) { return c.slice(); }),
      tray: new Array(CONFIG.TRAY_SIZE).fill(null),
      active: orders.slice(0, CONFIG.ACTIVE_ORDERS).map(cloneOrder),
      queue: orders.slice(CONFIG.ACTIVE_ORDERS).map(cloneOrder),
      coins: 0,
      combo: 0,
      served: 0
    };
  }

  function cloneOrder(o) {
    return o ? { id: o.id, dish: o.dish, coin: o.coin, filled: o.filled || 0 } : null;
  }

  function cloneState(s) {
    return {
      columns: s.columns.map(function (c) { return c.slice(); }),
      tray: s.tray.slice(),
      active: s.active.map(cloneOrder),
      queue: s.queue.map(cloneOrder),
      coins: s.coins,
      combo: s.combo,
      served: s.served
    };
  }

  function trayUsed(s) {
    var n = 0;
    for (var i = 0; i < s.tray.length; i++) if (s.tray[i]) n++;
    return n;
  }

  /* 활성 주문이 지금 이 요리를 받아줄 수 있는가 = 탭 즉시 직행 여부.
   * 해소 패스는 매 픽 뒤 고정점까지 돌기 때문에, 대기 상태의 트레이에는
   * "활성 주문이 받아줄 수 있는 접시"가 절대 남아 있지 않다.
   * 따라서 이 판정만으로 직행 여부가 정확히 결정된다. */
  function wantsDish(s, dish) {
    for (var i = 0; i < s.active.length; i++) {
      var o = s.active[i];
      if (o && o.dish === dish && o.filled < CONFIG.ORDER_SIZE) return true;
    }
    return false;
  }

  /* 트레이 → 활성 주문으로 옮길 수 있는 접시를 더 이상 없을 때까지 옮긴다.
   * 주문이 완료되면 대기열의 다음 주문이 그 자리에 들어오고, 그 주문에 대해서도 다시 판정한다. */
  function resolve(state) {
    var events = [];
    var progressed = true;
    var guard = 0;
    while (progressed) {
      progressed = false;
      if (++guard > CONFIG.TOTAL_PLATES + CONFIG.ORDER_COUNT + 4) break; // 이론상 도달 불가
      for (var s = 0; s < state.tray.length; s++) {
        var dish = state.tray[s];
        if (!dish) continue;
        for (var a = 0; a < state.active.length; a++) {
          var order = state.active[a];
          if (!order || order.dish !== dish || order.filled >= CONFIG.ORDER_SIZE) continue;
          order.filled += 1;
          state.tray[s] = null;
          events.push({ type: 'fill', card: a, orderId: order.id, from: s, pip: order.filled - 1 });
          progressed = true;
          if (order.filled >= CONFIG.ORDER_SIZE) {
            var gain = Math.round(order.coin * CONFIG.COMBO[state.combo]);
            state.coins += gain;
            state.served += 1;
            events.push({ type: 'complete', card: a, orderId: order.id, gain: gain, dish: order.dish });
            state.active[a] = state.queue.length ? state.queue.shift() : null;
          }
          break;
        }
      }
    }
    return events;
  }

  /* 컬럼 최상단 1장을 집는다. 접시는 항상 트레이를 거쳐 해소 패스로 주문에 충전된다.
   * 반환: null(무효한 픽) 또는 { state, dish, direct, slot, events } */
  function pick(state, columnIndex) {
    var col = state.columns[columnIndex];
    if (!col || col.length === 0) return null;
    var next = cloneState(state);
    var dish = next.columns[columnIndex].pop();
    var slot = next.tray.indexOf(null);
    if (slot < 0) return null; // 대기 상태에서 트레이가 꽉 차 있으면 이미 실패했어야 한다.
    var direct = wantsDish(next, dish);
    next.combo = direct ? Math.min(next.combo + 1, CONFIG.COMBO.length - 1) : 0;
    next.tray[slot] = dish;
    var events = resolve(next);
    return { state: next, dish: dish, direct: direct, slot: slot, events: events };
  }

  function isLost(state) {
    for (var i = 0; i < state.tray.length; i++) if (!state.tray[i]) return false;
    return true;
  }

  function isCleared(state) {
    for (var c = 0; c < state.columns.length; c++) if (state.columns[c].length) return false;
    return true;
  }

  function platesLeft(state) {
    var n = 0;
    for (var c = 0; c < state.columns.length; c++) n += state.columns[c].length;
    return n;
  }

  /* ── 4) 보드 생성 — 역방향 생성 + 자체 검증 ─────── */

  function buildOrders(rng) {
    var used = {};
    var orders = [];
    for (var i = 0; i < CONFIG.ORDER_COUNT; i++) {
      var pool = DISHES.filter(function (d) { return (used[d.id] || 0) < CONFIG.MAX_ORDERS_PER_DISH; });
      // 아직 안 쓰인 요리를 살짝 우대해 6종이 고르게 등장하도록 한다.
      var fresh = pool.filter(function (d) { return !used[d.id]; });
      var chosen = (fresh.length && rng() < 0.62) ? pickFrom(rng, fresh) : pickFrom(rng, pool);
      used[chosen.id] = (used[chosen.id] || 0) + 1;
      orders.push({
        id: i,
        dish: chosen.id,
        coin: CONFIG.COIN_TABLE[i % CONFIG.COIN_TABLE.length],
        filled: 0
      });
    }
    return orders;
  }

  /* 실제 규칙 엔진으로 정방향 시뮬레이션하며 정답 픽 시퀀스 P 를 만든다.
   * - 활성 주문이 요구하는 요리(직행)는 언제나 후보로 존재한다.
   *   (활성 주문이 k장 더 필요하면 그 요리는 보드에 최소 k장 남아 있다 → 교착 없음)
   * - 단조로움을 없애려고 "지금 필요 없는 접시"를 끼워 넣되,
   *   트레이 점유가 2를 넘지 않는 범위에서만 허용한다. */
  function buildSequence(rng, orders) {
    var remaining = {};
    orders.forEach(function (o) { remaining[o.dish] = (remaining[o.dish] || 0) + CONFIG.ORDER_SIZE; });

    var sim = makeState([], orders);
    var seq = [];

    for (var step = 0; step < CONFIG.TOTAL_PLATES; step++) {
      var directs = [];
      var stores = [];
      Object.keys(remaining).forEach(function (dish) {
        if (remaining[dish] <= 0) return;
        if (wantsDish(sim, dish)) directs.push(dish); else stores.push(dish);
      });
      if (!directs.length) return null;

      var used = trayUsed(sim);
      var chosen;
      if (stores.length && used <= CONFIG.TRAY_SIZE - 2 && rng() < 0.34) {
        chosen = pickFrom(rng, stores);           // 보관 → 해소 후에도 트레이 ≤ 2 유지
      } else {
        chosen = pickFrom(rng, directs);
      }

      var direct = wantsDish(sim, chosen);
      sim.combo = direct ? Math.min(sim.combo + 1, CONFIG.COMBO.length - 1) : 0;
      var slot = sim.tray.indexOf(null);
      if (slot < 0) return null;
      sim.tray[slot] = chosen;
      resolve(sim);
      if (isLost(sim)) return null;

      remaining[chosen] -= 1;
      seq.push(chosen);
    }
    return seq;
  }

  /* P 를 역순으로 쌓으면 역순 push = 정방향 pop 이라
   * 각 컬럼 안에서 인덱스가 작은 접시가 항상 위에 온다 → P 는 반드시 유효한 수순이다. */
  function layoutColumns(rng, seq) {
    var columns = [];
    for (var c = 0; c < CONFIG.COLUMNS; c++) columns.push([]);
    var colOfStep = new Array(seq.length);

    for (var i = seq.length - 1; i >= 0; i--) {
      var open = [];
      for (var k = 0; k < CONFIG.COLUMNS; k++) {
        if (columns[k].length < CONFIG.COLUMN_HEIGHT) open.push(k);
      }
      if (!open.length) return null;
      var col = open[Math.floor(rng() * open.length) % open.length];
      columns[col].push(seq[i]);
      colOfStep[i] = col;
    }
    for (var h = 0; h < CONFIG.COLUMNS; h++) {
      if (columns[h].length !== CONFIG.COLUMN_HEIGHT) return null;
    }
    return { columns: columns, colOfStep: colOfStep };
  }

  /* 안전망: 생성한 정답 수순을 규칙 엔진에 그대로 돌려 실제로 클리어되는지 확인한다. */
  function replay(columns, orders, colOfStep) {
    var st = makeState(columns, orders);
    for (var i = 0; i < colOfStep.length; i++) {
      var r = pick(st, colOfStep[i]);
      if (!r) return { ok: false, reason: 'invalid-pick@' + i };
      st = r.state;
      if (isCleared(st)) break;
      if (isLost(st)) return { ok: false, reason: 'tray-blocked@' + i };
    }
    if (!isCleared(st)) return { ok: false, reason: 'not-cleared' };
    if (trayUsed(st) !== 0) return { ok: false, reason: 'tray-residue' };
    if (st.served !== CONFIG.ORDER_COUNT) return { ok: false, reason: 'served=' + st.served };
    return { ok: true, state: st };
  }

  function attemptBoard(seed) {
    var rng = mulberry32(seed);
    var orders = buildOrders(rng);
    var seq = buildSequence(rng, orders);
    if (!seq || seq.length !== CONFIG.TOTAL_PLATES) return null;
    var laid = layoutColumns(rng, seq);
    if (!laid) return null;
    var check = replay(laid.columns, orders, laid.colOfStep);
    if (!check.ok) return null;
    return { seed: seed, columns: laid.columns, orders: orders, solution: laid.colOfStep };
  }

  function generateBoard(seed) {
    for (var i = 0; i < CONFIG.GEN_ATTEMPTS; i++) {
      var board = attemptBoard((seed + i * 0x9E3779B1) >>> 0);
      if (board) { board.attempts = i + 1; return board; }
    }
    // 여기 오면 생성 로직 자체의 회귀다. 검증된 고정 시드로 폴백한다.
    var fallback = attemptBoard(CONFIG.FALLBACK_SEED);
    if (fallback) { fallback.attempts = CONFIG.GEN_ATTEMPTS + 1; fallback.fallback = true; return fallback; }
    return null;
  }

  /* ── 5) 게임 컨트롤러 ───────────────────────────── */

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    shell: $('shell'), board: $('board'), tray: $('tray'), trayWrap: null,
    trayFree: $('trayFree'), orders: $('orders'),
    queueStrip: $('queueStrip'), queueList: $('queueList'), queueMore: $('queueMore'),
    timer: $('timer'), timerRing: $('timerRing'), timerNum: $('timerNum'),
    coinsNum: $('coinsNum'), comboTag: $('comboTag'), muteBtn: $('muteBtn'),
    status: $('status'), primaryBtn: $('primaryBtn'), hudSub: $('hudSub'),
    result: $('result'), resultCard: $('resultCard'), resultReason: $('resultReason'),
    resCoins: $('resCoins'), resServed: $('resServed'), resBonus: $('resBonus'), resBest: $('resBest'),
    againBtn: $('againBtn'), live: $('live'), fx: $('fx')
  };
  el.trayWrap = el.tray ? el.tray.parentElement : null;

  var RING_LEN = 2 * Math.PI * 18;

  var game = {
    phase: 'intro',            // intro | playing | moving | result
    state: null,
    board: null,
    roundId: 0,
    seed: 0,
    startedAt: 0,
    remainingMs: CONFIG.ROUND_MS,
    focusCol: 0,
    inputMode: 'pointer',
    muted: true,
    locked: false,
    culprit: -1,
    failReason: '',
    warned: {},
    rafId: 0,
    best: 0
  };

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* sessionStorage 는 file:// 에서 예외를 던질 수 있다. 실패하면 메모리 값만 쓴다. */
  function readBest() {
    try {
      var v = window.sessionStorage.getItem('plate-stack:best');
      return v ? (parseInt(v, 10) || 0) : 0;
    } catch (e) { return 0; }
  }
  function writeBest(v) {
    try { window.sessionStorage.setItem('plate-stack:best', String(v)); } catch (e) { /* 무시 */ }
  }

  function announce(msg) {
    if (!el.live) return;
    el.live.textContent = '';
    // 같은 문구 연속 갱신도 읽히도록 한 프레임 뒤에 넣는다.
    window.requestAnimationFrame(function () { el.live.textContent = msg; });
  }

  function setStatus(msg, alert) {
    if (!el.status) return;
    el.status.textContent = msg;
    el.status.classList.toggle('is-alert', !!alert);
  }

  /* ── DOM 1회 생성 ── */

  var colEls = [];

  function buildBoardDom() {
    el.board.innerHTML = '';
    colEls = [];
    for (var c = 0; c < CONFIG.COLUMNS; c++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'col';
      btn.dataset.col = String(c);
      btn.tabIndex = c === 0 ? 0 : -1;
      var stack = document.createElement('span');
      stack.className = 'col-stack';
      stack.style.display = 'contents';
      var badge = document.createElement('span');
      badge.className = 'col-badge';
      btn.appendChild(stack);
      btn.appendChild(badge);
      el.board.appendChild(btn);
      colEls.push({ btn: btn, stack: stack, badge: badge, rendered: '' });
    }
  }

  function svgUse(symbolId, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#' +
      symbolId + '"></use></svg>';
  }

  /* ── 렌더 ── */

  function render(opts) {
    opts = opts || {};
    var s = game.state;
    if (!s) return;

    // 타이머
    var secs = Math.max(0, Math.ceil(game.remainingMs / 1000));
    el.timerNum.textContent = String(secs);
    var ratio = Math.max(0, Math.min(1, game.remainingMs / CONFIG.ROUND_MS));
    el.timerRing.style.strokeDasharray = RING_LEN.toFixed(1);
    el.timerRing.style.strokeDashoffset = (RING_LEN * (1 - ratio)).toFixed(1);
    el.timer.classList.toggle('is-urgent', secs <= 10 && game.phase !== 'intro');

    // 코인·콤보
    el.coinsNum.textContent = String(s.coins);
    var mult = CONFIG.COMBO[s.combo];
    if (s.combo > 0) {
      el.comboTag.hidden = false;
      el.comboTag.textContent = '×' + mult.toFixed(1);
    } else {
      el.comboTag.hidden = true;
    }

    // 주문 카드
    for (var a = 0; a < CONFIG.ACTIVE_ORDERS; a++) {
      var card = el.orders.querySelector('[data-card="' + a + '"]');
      var order = s.active[a];
      var nameEl = card.querySelector('[data-role="name"]');
      var iconEl = card.querySelector('.order-name .ico use');
      var coinEl = card.querySelector('[data-role="coin"]');
      var pips = card.querySelectorAll('[data-pip]');
      if (order) {
        card.classList.remove('is-empty');
        nameEl.textContent = dishName(order.dish);
        iconEl.setAttribute('href', '#' + dishSymbol(order.dish));
        coinEl.textContent = String(order.coin);
        for (var p = 0; p < pips.length; p++) {
          pips[p].classList.toggle('is-on', p < order.filled);
          pips[p].classList.remove('is-arriving');
        }
        card.setAttribute('aria-label',
          dishName(order.dish) + ' ' + CONFIG.ORDER_SIZE + '개 중 ' + order.filled + '개 완료, ' + order.coin + '코인');
      } else {
        card.classList.add('is-empty');
        nameEl.textContent = '대기 없음';
        coinEl.textContent = '0';
        for (var q = 0; q < pips.length; q++) { pips[q].classList.remove('is-on', 'is-arriving'); }
        card.setAttribute('aria-label', '주문 없음');
      }
    }
    // 대기열 미리보기 — 지금 필요 없는 접시를 "왜" 보관하는지가 선택이 되려면 다음 주문이 보여야 한다.
    var preview = s.queue.slice(0, 3);
    var qHtml = '';
    preview.forEach(function (o) {
      qHtml += '<li>' + svgUse(dishSymbol(o.dish)) + '<span>' + dishName(o.dish) + '</span></li>';
    });
    el.queueList.innerHTML = qHtml;
    var restCount = s.queue.length - preview.length;
    el.queueMore.textContent = restCount > 0 ? '+' + restCount : (s.queue.length ? '' : '없음');
    el.queueStrip.setAttribute('aria-label', s.queue.length
      ? '대기 손님 ' + s.queue.length + '명, 다음 주문 ' + preview.map(function (o) { return dishName(o.dish); }).join(', ')
      : '대기 손님 없음');

    // 보관대
    var free = CONFIG.TRAY_SIZE - trayUsed(s);
    el.trayFree.textContent = free + '칸 남음';
    for (var t = 0; t < CONFIG.TRAY_SIZE; t++) {
      var slotEl = el.tray.querySelector('[data-slot="' + t + '"]');
      var dish = s.tray[t];
      slotEl.classList.toggle('is-filled', !!dish);
      slotEl.classList.remove('is-arriving');
      if (dish) {
        slotEl.innerHTML = svgUse(dishSymbol(dish));
        slotEl.setAttribute('aria-label', '보관대 ' + (t + 1) + '번, ' + dishName(dish));
      } else {
        slotEl.innerHTML = '';
        slotEl.setAttribute('aria-label', '보관대 ' + (t + 1) + '번, 비어 있음');
      }
    }
    el.trayWrap.classList.toggle('is-warning', free === 1 && game.phase !== 'result');
    el.trayWrap.classList.toggle('is-blocked', free === 0);

    // 보드
    for (var c = 0; c < CONFIG.COLUMNS; c++) {
      var col = s.columns[c];
      var ref = colEls[c];
      var key = col.join('|');
      if (ref.rendered !== key || opts.force) {
        ref.rendered = key;
        var html = '';
        if (col.length) {
          html += '<span class="plate-top">' + svgUse(dishSymbol(col[col.length - 1])) + '</span>';
          for (var u = col.length - 2; u >= 0; u--) {
            html += '<span class="plate-under">' + svgUse(dishSymbol(col[u])) + '</span>';
          }
        }
        ref.stack.innerHTML = html;
        ref.badge.textContent = col.length ? String(col.length) : '';
      }
      var empty = col.length === 0;
      ref.btn.classList.toggle('is-empty', empty);
      // 막힌 이유를 짚는 강조다. 클리어·시간 종료에는 붙이지 않는다.
      ref.btn.classList.toggle('is-culprit',
        game.culprit === c && game.phase === 'result' && game.failReason === 'tray');
      ref.btn.setAttribute('aria-disabled', (empty || game.locked || game.phase === 'result') ? 'true' : 'false');
      // 아래 접시는 화면에서 보이므로 접근성 이름에도 같은 정보를 담는다.
      var label;
      if (empty) {
        label = (c + 1) + '번 줄, 비어 있음';
      } else {
        label = (c + 1) + '번 줄, 맨 위 ' + dishName(col[col.length - 1]);
        if (col.length > 1) {
          var under = [];
          for (var d = col.length - 2; d >= 0; d--) under.push(dishName(col[d]));
          label += ', 아래로 ' + under.join(' 다음 ');
        }
        label += ', 남은 ' + col.length + '장';
      }
      ref.btn.setAttribute('aria-label', label);
    }
  }

  /* ── 라운드 시작 ── */

  function newRound(seed) {
    game.roundId += 1;
    game.seed = seed >>> 0;
    var board = generateBoard(game.seed);
    if (!board) {
      setStatus('보드를 만들지 못했습니다. 다시 하기를 눌러 주세요.', true);
      return false;
    }
    game.board = board;
    game.state = makeState(board.columns, board.orders);
    game.remainingMs = CONFIG.ROUND_MS;
    game.phase = 'intro';
    game.locked = false;
    game.culprit = -1;
    game.failReason = '';
    game.warned = {};
    game.focusCol = 0;
    updateFocusRoving();
    el.result.hidden = true;
    el.primaryBtn.textContent = '시작';
    el.primaryBtn.hidden = false;
    setStatus('맨 위 접시를 탭해 주문을 채우세요. 시작을 누르면 60초가 흘러갑니다.');
    render({ force: true });
    return true;
  }

  function startRound() {
    if (game.phase !== 'intro') return;
    game.phase = 'playing';
    game.startedAt = now();
    el.primaryBtn.textContent = '다시 하기';
    setStatus(game.inputMode === 'keyboard'
      ? '방향키로 줄을 옮기고 Enter 로 집으세요.'
      : '맨 위 접시를 탭해 주문을 채우세요.');
    announce('게임 시작. 60초.');
    tick();
  }

  function restart() {
    stopTimer();
    var seed = (Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
    if (newRound(seed)) startRound();
  }

  function now() {
    return (window.performance && window.performance.now) ? window.performance.now() : Date.now();
  }

  /* ── 타이머 ── */

  function tick() {
    stopTimer();
    var myRound = game.roundId;
    var startedAt = game.startedAt;
    var total = CONFIG.ROUND_MS;

    function loop() {
      if (game.roundId !== myRound) return;                 // 오래된 콜백 차단
      if (game.phase !== 'playing' && game.phase !== 'moving') return;
      var elapsed = now() - startedAt;
      game.remainingMs = Math.max(0, total - elapsed);
      var secs = Math.ceil(game.remainingMs / 1000);
      if ((secs === 10 || secs === 5) && !game.warned[secs]) {
        game.warned[secs] = true;
        announce(secs + '초 남았습니다.');
      }
      render();
      if (game.remainingMs <= 0) {
        finishRound(false, 'time');
        return;
      }
      game.rafId = window.requestAnimationFrame(loop);
    }
    game.rafId = window.requestAnimationFrame(loop);
  }

  function stopTimer() {
    if (game.rafId) { window.cancelAnimationFrame(game.rafId); game.rafId = 0; }
  }

  /* ── 픽 처리 ── */

  function handlePick(columnIndex) {
    if (game.phase === 'intro') { startRound(); }
    if (game.phase !== 'playing' || game.locked) return;
    var s = game.state;
    if (!s.columns[columnIndex] || !s.columns[columnIndex].length) return;

    var topEl = colEls[columnIndex].btn.querySelector('.plate-top');
    var startRect = topEl ? topEl.getBoundingClientRect() : null;

    var preActive = s.active.map(cloneOrder);
    var result = pick(s, columnIndex);
    if (!result) return;

    game.state = result.state;
    game.culprit = columnIndex;
    game.locked = true;
    game.phase = 'moving';

    // 목적지: 직행이면 채워진 주문 칸, 아니면 보관대 슬롯
    var destCard = -1, destPip = -1;
    if (result.direct) {
      for (var a = 0; a < preActive.length; a++) {
        var o = preActive[a];
        if (o && o.dish === result.dish && o.filled < CONFIG.ORDER_SIZE) { destCard = a; destPip = o.filled; break; }
      }
    }

    render();

    var destEl = null;
    if (destCard >= 0) {
      destEl = el.orders.querySelector('[data-card="' + destCard + '"] [data-pip="' + destPip + '"]');
      if (!destEl) destEl = el.orders.querySelector('[data-card="' + destCard + '"]');
    } else {
      destEl = el.tray.querySelector('[data-slot="' + result.slot + '"]');
    }
    if (destEl) destEl.classList.add('is-arriving');

    playSound(result.direct ? 'serve' : 'store');
    result.events.forEach(function (ev) {
      if (ev.type === 'complete') {
        var card = el.orders.querySelector('[data-card="' + ev.card + '"]');
        if (card) {
          card.classList.remove('is-complete');
          void card.offsetWidth;
          card.classList.add('is-complete');
          spawnCoins(card);
        }
      }
    });

    var completed = result.events.filter(function (e) { return e.type === 'complete'; });
    if (completed.length) {
      var gained = completed.reduce(function (n, e) { return n + e.gain; }, 0);
      playSound('complete');
      announce('주문 완료, ' + gained + '코인 획득.');
    } else if (result.direct) {
      announce(dishName(result.dish) + ' 서빙.');
    } else {
      announce(dishName(result.dish) + ' 보관대로.');
    }

    flyPlate(startRect, destEl, result.dish, function () {
      if (destEl) destEl.classList.remove('is-arriving');
      finishMove(result);
    });
  }

  function finishMove(result) {
    game.locked = false;
    if (game.phase !== 'moving') return;
    game.phase = 'playing';

    var s = game.state;
    if (isCleared(s)) { finishRound(true, 'cleared'); return; }
    if (isLost(s)) { finishRound(false, 'tray'); return; }

    var free = CONFIG.TRAY_SIZE - trayUsed(s);
    if (free === 1) announce('보관대 1칸 남음. 주의하세요.');

    setStatus(game.inputMode === 'keyboard'
      ? '방향키로 줄을 옮기고 Enter 로 집으세요. 남은 접시 ' + platesLeft(s) + '장.'
      : '남은 접시 ' + platesLeft(s) + '장, 보관대 ' + free + '칸 남음.');
    render();
  }

  /* ── 라운드 종료 (한 번만) ── */

  function finishRound(cleared, reason) {
    if (game.phase === 'result') return;
    stopTimer();
    game.phase = 'result';
    game.locked = true;
    game.failReason = cleared ? '' : reason;

    var s = game.state;
    var bonus = 0;
    if (cleared) {
      bonus = Math.ceil(game.remainingMs / 1000) * CONFIG.TIME_BONUS_PER_SEC;
      s.coins += bonus;
    }
    if (s.coins > game.best) { game.best = s.coins; writeBest(game.best); }

    var title = cleared ? '전부 서빙 완료!' : '라운드 종료';
    var msg;
    if (cleared) {
      msg = '접시 24장을 모두 비웠습니다. 남은 시간 보너스 ' + bonus + '코인.';
      playSound('win');
    } else if (reason === 'tray') {
      msg = '보관대가 가득 찼어요. 강조된 줄에서 집은 접시가 마지막으로 자리를 막았습니다.';
      playSound('fail');
    } else {
      msg = '시간이 다 됐어요. 접시 ' + platesLeft(s) + '장이 남았습니다.';
      playSound('fail');
    }

    $('resultTitle').textContent = title;
    el.resultReason.textContent = msg;
    el.resCoins.textContent = String(s.coins);
    el.resServed.textContent = s.served + '명';
    el.resBonus.textContent = String(bonus);
    el.resBest.textContent = String(game.best);
    el.result.hidden = false;
    el.primaryBtn.hidden = true;
    setStatus(msg, !cleared);
    announce(title + ' ' + msg + ' 획득 코인 ' + s.coins + '.');
    render({ force: true });
    window.setTimeout(function () { if (el.resultCard) el.resultCard.focus(); }, 30);
  }

  /* ── 연출 ── */

  function flyPlate(startRect, destEl, dish, done) {
    var finished = false;
    function finish() { if (finished) return; finished = true; done(); }

    if (reducedMotion() || !startRect || !destEl || !el.fx) {
      window.setTimeout(finish, reducedMotion() ? 60 : 0);
      return;
    }
    var endRect = destEl.getBoundingClientRect();
    var fxRect = el.fx.getBoundingClientRect();
    if (!startRect.width || !endRect.width) { finish(); return; }

    var node = document.createElement('div');
    node.className = 'fly';
    node.style.width = startRect.width + 'px';
    node.style.height = startRect.height + 'px';
    node.style.left = (startRect.left - fxRect.left) + 'px';
    node.style.top = (startRect.top - fxRect.top) + 'px';
    node.innerHTML = svgUse(dishSymbol(dish));
    el.fx.appendChild(node);

    var dx = (endRect.left + endRect.width / 2) - (startRect.left + startRect.width / 2);
    var dy = (endRect.top + endRect.height / 2) - (startRect.top + startRect.height / 2);
    var scale = Math.max(0.3, Math.min(1, endRect.width / Math.max(1, startRect.width)));

    var cleanup = function () { if (node.parentNode) node.parentNode.removeChild(node); finish(); };

    if (typeof node.animate === 'function') {
      var anim = node.animate([
        { transform: 'translate(0,0) scale(1)' },
        { transform: 'translate(' + (dx * 0.5) + 'px,' + (dy * 0.5 - 26) + 'px) scale(' + ((1 + scale) / 2).toFixed(3) + ')', offset: 0.55 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + scale.toFixed(3) + ')' }
      ], { duration: CONFIG.MOVE_MS, easing: 'cubic-bezier(.3,.8,.4,1)', fill: 'forwards' });
      anim.onfinish = cleanup;
      anim.oncancel = cleanup;
    }
    // WAAPI 미지원·탭 전환으로 콜백이 안 오는 경우의 안전망
    window.setTimeout(cleanup, CONFIG.MOVE_MS + 160);
  }

  var coinPool = [];
  function spawnCoins(anchor) {
    if (reducedMotion() || !el.fx || !anchor) return;
    var fxRect = el.fx.getBoundingClientRect();
    var r = anchor.getBoundingClientRect();
    for (var i = 0; i < 4; i++) {
      var node = coinPool.pop();
      if (!node) {
        node = document.createElement('div');
        node.className = 'pop';
        node.innerHTML = svgUse('coin');
      }
      node.style.left = (r.left - fxRect.left + r.width / 2 - 10) + 'px';
      node.style.top = (r.top - fxRect.top + r.height / 2 - 10) + 'px';
      el.fx.appendChild(node);
      (function (n, idx) {
        var dx = (idx - 1.5) * 16;
        var release = function () {
          if (n.parentNode) n.parentNode.removeChild(n);
          if (coinPool.length < 6) coinPool.push(n);
        };
        if (typeof n.animate === 'function') {
          var a = n.animate([
            { transform: 'translate(0,0) scale(.6)', opacity: 0 },
            { transform: 'translate(' + dx * 0.6 + 'px,-14px) scale(1)', opacity: 1, offset: 0.35 },
            { transform: 'translate(' + dx + 'px,-38px) scale(.85)', opacity: 0 }
          ], { duration: 320, easing: 'ease-out' });
          a.onfinish = release;
          a.oncancel = release;
        }
        window.setTimeout(release, 420);
      })(node, i);
    }
  }

  /* ── 오디오 (기본 음소거, 사용자가 켠 뒤에만 절차 생성) ── */

  var audioCtx = null;

  function ensureAudio() {
    if (game.muted) return null;
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      try { audioCtx = new Ctx(); } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended' && audioCtx.resume) { try { audioCtx.resume(); } catch (e) { /* 무시 */ } }
    return audioCtx;
  }

  var TONES = {
    store: [[330, 0.06]],
    serve: [[523, 0.05], [659, 0.06]],
    complete: [[523, 0.06], [659, 0.06], [784, 0.1]],
    win: [[523, 0.08], [659, 0.08], [784, 0.08], [1046, 0.16]],
    fail: [[196, 0.22]]
  };

  function playSound(kind) {
    var ctx = ensureAudio();
    if (!ctx || !TONES[kind]) return;
    var t = ctx.currentTime;
    TONES[kind].forEach(function (pair) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = kind === 'fail' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(pair[0], t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + pair[1]);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + pair[1] + 0.02);
      t += pair[1];
    });
  }

  /* ── 입력 ── */

  function updateFocusRoving() {
    for (var c = 0; c < colEls.length; c++) {
      colEls[c].btn.tabIndex = (c === game.focusCol) ? 0 : -1;
    }
  }

  function moveFocus(next) {
    game.focusCol = (next + CONFIG.COLUMNS) % CONFIG.COLUMNS;
    updateFocusRoving();
    colEls[game.focusCol].btn.focus();
  }

  function setInputMode(mode) {
    if (game.inputMode === mode) return;
    game.inputMode = mode;
    if (game.phase === 'playing') {
      setStatus(mode === 'keyboard'
        ? '방향키로 줄을 옮기고 Enter 로 집으세요. 남은 접시 ' + platesLeft(game.state) + '장.'
        : '남은 접시 ' + platesLeft(game.state) + '장.');
    }
    el.hudSub.textContent = mode === 'keyboard' ? '방향키 이동, Enter 로 집기' : '맨 위 접시만 집을 수 있어요';
  }

  function wireInput() {
    el.board.addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('.col') : null;
      if (!btn) return;
      var idx = parseInt(btn.dataset.col, 10);
      if (isNaN(idx)) return;
      game.focusCol = idx;
      updateFocusRoving();
      handlePick(idx);
    });

    el.board.addEventListener('pointerdown', function () { setInputMode('pointer'); });

    el.board.addEventListener('keydown', function (ev) {
      var key = ev.key;
      if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End') {
        setInputMode('keyboard');
        ev.preventDefault();
        if (key === 'ArrowLeft') moveFocus(game.focusCol - 1);
        else if (key === 'ArrowRight') moveFocus(game.focusCol + 1);
        else if (key === 'Home') moveFocus(0);
        else moveFocus(CONFIG.COLUMNS - 1);
      } else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
        setInputMode('keyboard');
      }
    });

    el.primaryBtn.addEventListener('click', function () {
      if (game.phase === 'intro') startRound();
      else restart();
    });

    el.againBtn.addEventListener('click', function () { restart(); });

    el.muteBtn.addEventListener('click', function () {
      game.muted = !game.muted;
      el.muteBtn.setAttribute('aria-pressed', String(!game.muted));
      el.muteBtn.textContent = game.muted ? '소리 켜기' : '소리 끄기';
      if (!game.muted) { ensureAudio(); playSound('store'); }
    });

    window.addEventListener('resize', function () { render({ force: true }); });
    window.addEventListener('orientationchange', function () { render({ force: true }); });
  }

  /* ── 6) ?test=1 자체 검증 ───────────────────────── */

  function runSelfTest(count) {
    var lines = [];
    var fails = 0;
    var attemptsTotal = 0;
    var fallbacks = 0;
    var t0 = now();

    for (var i = 0; i < count; i++) {
      var seed = (0xA5F1 + i * 2654435761) >>> 0;
      var board = generateBoard(seed);
      if (!board) { fails++; lines.push('seed ' + seed + ' → 생성 실패'); continue; }
      attemptsTotal += board.attempts;
      if (board.fallback) fallbacks++;

      // 컬럼 높이 불변
      var heightOk = board.columns.length === CONFIG.COLUMNS &&
        board.columns.every(function (c) { return c.length === CONFIG.COLUMN_HEIGHT; });
      // 정답 수순 재생 → 클리어
      var rp = replay(board.columns, board.orders, board.solution);
      if (!heightOk || !rp.ok) {
        fails++;
        lines.push('seed ' + seed + ' → ' + (heightOk ? '' : 'height ') + (rp.ok ? '' : rp.reason));
      }
    }

    // 경계값: 트레이가 해소 없이 3칸 차면 즉시 패배 판정
    var lossCase = makeState([['salmon'], ['onigiri'], ['ebi'], ['maki'], [], []],
      [{ id: 0, dish: 'udon', coin: 40, filled: 0 }, { id: 1, dish: 'gyudon', coin: 80, filled: 0 }]);
    var st = lossCase;
    var lostAt = -1;
    for (var k = 0; k < 4; k++) {
      var r = pick(st, k);
      if (!r) { lostAt = -2; break; }
      st = r.state;
      if (isLost(st)) { lostAt = k; break; }
    }
    var lossOk = lostAt === 2; // 3장째에 트레이가 막힌다
    if (!lossOk) { fails++; lines.push('트레이 막힘 경계값 실패 (lostAt=' + lostAt + ')'); }

    // 무효 픽은 상태를 바꾸지 않는다
    var emptyPick = pick(makeState([[], [], [], [], [], []], []), 0);
    var invalidOk = emptyPick === null;
    if (!invalidOk) { fails++; lines.push('빈 컬럼 픽이 null 이 아님'); }

    var ms = Math.round(now() - t0);
    lines.unshift(
      '플레이트 스택 자체 검증\n' +
      '시드 ' + count + '개 · 실패 ' + fails + '건 · ' + ms + 'ms\n' +
      '평균 생성 시도 ' + (attemptsTotal / Math.max(1, count)).toFixed(2) + '회 · 폴백 ' + fallbacks + '건\n' +
      '트레이 막힘 경계값 ' + (lossOk ? 'OK' : 'FAIL') + ' · 무효 픽 ' + (invalidOk ? 'OK' : 'FAIL') + '\n' +
      '판정: ' + (fails === 0 ? 'PASS' : 'FAIL')
    );

    var text = lines.join('\n');
    var pre = document.createElement('pre');
    pre.className = 'testout';
    pre.textContent = text;
    document.body.appendChild(pre);
    (fails === 0 ? console.log : console.error)(text);
    return { pass: fails === 0, fails: fails, text: text };
  }

  /* ── 초기화 ── */

  function init() {
    if (!el.board) return;
    buildBoardDom();
    wireInput();
    game.best = readBest();
    game.muted = true;
    el.muteBtn.textContent = '소리 켜기';
    el.muteBtn.setAttribute('aria-pressed', 'false');

    var seed = (Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
    var params = null;
    try { params = new URLSearchParams(window.location.search); } catch (e) { params = null; }
    if (params && params.get('seed')) {
      var forced = parseInt(params.get('seed'), 10);
      if (!isNaN(forced)) seed = forced >>> 0;
    }
    newRound(seed);

    if (params && params.get('test')) {
      var n = parseInt(params.get('test'), 10);
      runSelfTest(n > 1 ? n : 500);
    }
  }

  // 자동화 검증용 최소 표면 (게임 동작에는 쓰이지 않는다)
  window.PlateStack = {
    CONFIG: CONFIG,
    DISHES: DISHES,
    mulberry32: mulberry32,
    makeState: makeState,
    pick: pick,
    resolve: resolve,
    isLost: isLost,
    isCleared: isCleared,
    generateBoard: generateBoard,
    replay: replay,
    runSelfTest: runSelfTest,
    // QA 재현용 스냅샷. 게임 로직은 이 함수를 호출하지 않는다.
    debug: function () {
      return {
        phase: game.phase,
        locked: game.locked,
        seed: game.seed,
        solution: game.board ? game.board.solution.slice() : null,
        coins: game.state ? game.state.coins : 0,
        served: game.state ? game.state.served : 0,
        platesLeft: game.state ? platesLeft(game.state) : 0
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
