(function () {
  'use strict';

  var CONFIG = {
    durationMs: 45000,
    targetCash: 160,
    maxMisses: 3,
    maxInventory: 2,
    basePatienceMs: 12000,
    rushPatienceMs: 10000,
    stations: {
      burger: { name: '버거', verb: '굽기', cookMs: 3200, graceMs: 3000, value: 20 },
      fries:  { name: '감자', verb: '튀기기', cookMs: 2500, graceMs: 3500, value: 15 },
      drink:  { name: '음료', verb: '따르기', cookMs: 1200, graceMs: 5000, value: 10 }
    }
  };

  var FOOD_IDS = ['burger', 'fries', 'drink'];
  var SKINS = ['#b96f4e', '#dc9c70', '#8e573f', '#e5b28c'];
  var SHIRTS = ['#4b8190', '#cf604d', '#637a48', '#77639a', '#d09137'];
  var FACE_NAMES = ['도윤', '하린', '민준', '서아', '지호', '나윤', '유준', '소율'];

  var el = {
    gameShell: document.getElementById('gameShell'),
    muteButton: document.getElementById('muteButton'),
    pauseButton: document.getElementById('pauseButton'),
    bankedCash: document.getElementById('bankedCash'), cashFill: document.getElementById('cashFill'), cashMeter: document.getElementById('cashMeter'),
    timerCard: document.getElementById('timerCard'), timerRing: document.getElementById('timerRing'), timeValue: document.getElementById('timeValue'),
    missMarks: document.getElementById('missMarks'),
    queueCount: document.getElementById('queueCount'), queueFigures: document.getElementById('queueFigures'),
    customerStage: document.getElementById('customerStage'), activeCustomer: document.getElementById('activeCustomer'),
    orderNumber: document.getElementById('orderNumber'), patienceText: document.getElementById('patienceText'), orderItems: document.getElementById('orderItems'), patienceFill: document.getElementById('patienceFill'),
    inventory: document.getElementById('inventory'), inventoryBurger: document.getElementById('inventoryBurger'), inventoryFries: document.getElementById('inventoryFries'), inventoryDrink: document.getElementById('inventoryDrink'),
    serveButton: document.getElementById('serveButton'), serveHint: document.getElementById('serveHint'),
    cashButton: document.getElementById('cashButton'), pendingCash: document.getElementById('pendingCash'), bundleCount: document.getElementById('bundleCount'),
    stations: Array.prototype.slice.call(document.querySelectorAll('.station')),
    statusStrip: document.getElementById('statusStrip'), statusText: document.getElementById('statusText'), liveRegion: document.getElementById('liveRegion'),
    fxLayer: document.getElementById('fxLayer'),
    introOverlay: document.getElementById('introOverlay'), startButton: document.getElementById('startButton'),
    pauseOverlay: document.getElementById('pauseOverlay'), resumeButton: document.getElementById('resumeButton'),
    resultOverlay: document.getElementById('resultOverlay'), resultTicket: document.getElementById('resultTicket'), resultStars: document.getElementById('resultStars'), resultKicker: document.getElementById('resultKicker'), resultTitle: document.getElementById('resultTitle'), resultLead: document.getElementById('resultLead'),
    resultCash: document.getElementById('resultCash'), resultServed: document.getElementById('resultServed'), resultStreak: document.getElementById('resultStreak'), resultPending: document.getElementById('resultPending'), restartButton: document.getElementById('restartButton')
  };

  var state = null;
  var rafId = 0;
  var lastFrame = 0;
  var customerSeq = 0;
  var actionLocks = Object.create(null);
  var audioContext = null;
  var lastLiveText = '';

  function makeRng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function getSeed() {
    var match;
    try { match = /[?&]seed=(-?\d+)/.exec(location.search); } catch (ignore) { match = null; }
    return match ? (parseInt(match[1], 10) >>> 0) || 1 : ((Date.now() ^ 0x9e3779b9) >>> 0) || 1;
  }

  function readStored(key, fallback) {
    try {
      var value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (ignore) { return fallback; }
  }

  function writeStored(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (ignore) { /* storage is optional */ }
  }

  function freshStation(id) {
    return { id: id, status: 'idle', elapsed: 0, remaining: 0 };
  }

  function newState(seed) {
    var muted = readStored('rushCounter.muted', '0') === '1';
    var rng = makeRng(seed);
    state = {
      phase: 'ready', paused: false, seed: seed, rng: rng,
      remainingMs: CONFIG.durationMs,
      stations: { burger: freshStation('burger'), fries: freshStation('fries'), drink: freshStation('drink') },
      inventory: { burger: 0, fries: 0, drink: 0 },
      customers: [],
      bankedCash: 0, pendingCash: 0, bundles: 0,
      served: 0, missed: 0, wasted: 0, streak: 0, bestStreak: 0,
      muted: muted, tutorial: true, result: null,
      transitionMs: 0, transitionType: '',
      lastAnnouncedSecond: 45
    };
    customerSeq = 0;
    state.customers = [createCustomer(true), createCustomer(false), createCustomer(false)];
    renderAll();
  }

  function createCustomer(isFirst) {
    customerSeq += 1;
    var elapsed = state ? CONFIG.durationMs - state.remainingMs : 0;
    var order = isFirst ? ['burger', 'drink'] : createOrder(state.rng, elapsed);
    var patience = elapsed >= 30000 ? CONFIG.rushPatienceMs : CONFIG.basePatienceMs;
    return {
      id: customerSeq,
      name: FACE_NAMES[(customerSeq - 1) % FACE_NAMES.length],
      order: order,
      patienceMs: patience,
      maxPatienceMs: patience,
      skin: SKINS[Math.floor(state.rng() * SKINS.length)],
      shirt: SHIRTS[Math.floor(state.rng() * SHIRTS.length)],
      settled: false
    };
  }

  function weightedSize(rng, elapsedMs) {
    var roll = rng();
    if (elapsedMs < 12000) return roll < .60 ? 1 : 2;
    if (elapsedMs < 30000) return roll < .25 ? 1 : roll < .85 ? 2 : 3;
    return roll < .10 ? 1 : roll < .65 ? 2 : 3;
  }

  function createOrder(rng, elapsedMs) {
    var size = weightedSize(rng, elapsedMs);
    var pool = FOOD_IDS.slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    return pool.slice(0, size);
  }

  function canServe(inventory, order) {
    return order.every(function (food) { return inventory[food] > 0; });
  }

  function calculatePayout(order, patienceRatio, newStreak) {
    var base = order.reduce(function (sum, food) { return sum + CONFIG.stations[food].value; }, 0);
    var speed = Math.max(1, Math.ceil(Math.max(0, Math.min(1, patienceRatio)) * 5));
    var streak = Math.min(Math.max(newStreak - 1, 0) * 3, 9);
    return { base: base, speed: speed, streak: streak, total: base + speed + streak };
  }

  function currentCustomer() { return state && state.customers[0]; }

  function startFromIntro() {
    el.introOverlay.hidden = true;
    newState(getSeed());
    setStatus('버거와 음료 조리대를 탭해 첫 주문을 준비하세요.', 'neutral', true);
    el.stations[0].focus();
  }

  function beginShift() {
    if (state.phase !== 'ready') return;
    state.phase = 'playing';
    state.tutorial = false;
    el.stations.forEach(function (node) { node.classList.remove('tutorial-pulse'); });
    lastFrame = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
    setStatus('주문을 보며 세 조리대를 동시에 돌리세요!', 'neutral', true);
  }

  function lockAction(key) {
    var now = performance.now();
    if ((actionLocks[key] || 0) > now) return false;
    actionLocks[key] = now + 120;
    return true;
  }

  function dispatchAction(action, payload) {
    if (!state || state.paused || state.phase === 'won' || state.phase === 'lost' || state.phase === 'resolving') return;
    if (!lockAction(action + ':' + (payload || ''))) return;
    ensureAudio();
    if (action === 'station') handleStation(payload);
    if (action === 'serve') serveCustomer();
    if (action === 'cash') collectCash();
  }

  function handleStation(id) {
    var station = state.stations[id];
    var config = CONFIG.stations[id];
    if (!station) return;
    if (state.phase === 'ready') beginShift();
    if (state.phase !== 'playing') return;

    if (station.status === 'idle') {
      station.status = 'cooking'; station.elapsed = 0; station.remaining = config.cookMs;
      tone('start');
      setStatus(config.name + ' 조리를 시작했어요.', 'neutral');
    } else if (station.status === 'cooking') {
      setStatus(config.name + '는 아직 조리 중이에요.', 'neutral');
    } else if (station.status === 'ready') {
      if (state.inventory[id] >= CONFIG.maxInventory) {
        setStatus(config.name + ' 보관대가 가득 찼어요.', 'bad', true);
        tone('deny');
      } else {
        state.inventory[id] += 1;
        station.status = 'idle'; station.elapsed = 0; station.remaining = 0;
        tone('pickup');
        setStatus(config.name + ' 1개를 보관했어요.', 'good', true);
      }
    } else if (station.status === 'wasted') {
      station.status = 'idle'; station.elapsed = 0; station.remaining = 0;
      state.bankedCash = Math.max(0, state.bankedCash - 3);
      state.streak = 0;
      tone('waste');
      setStatus('상한 ' + config.name + '를 치웠어요. 수거 매출 -3.', 'bad', true);
    }
    renderAll();
  }

  function serveCustomer() {
    if (state.phase !== 'playing' || state.transitionMs > 0) return;
    var customer = currentCustomer();
    if (!customer || customer.settled || !canServe(state.inventory, customer.order)) {
      setStatus(missingText(customer), 'bad', true);
      tone('deny');
      return;
    }
    customer.settled = true;
    customer.order.forEach(function (food) { state.inventory[food] -= 1; });
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    var payout = calculatePayout(customer.order, customer.patienceMs / customer.maxPatienceMs, state.streak);
    state.pendingCash += payout.total;
    state.bundles += 1;
    state.served += 1;
    state.transitionMs = 600;
    state.transitionType = 'served';
    el.customerStage.classList.add('exiting');
    tone('serve');
    setStatus(customer.name + ' 손님 서빙 완료! ' + payout.total + '코인이 계산대에 쌓였어요.', 'good', true);
    renderAll();
  }

  function collectCash() {
    if (state.phase !== 'playing' || state.pendingCash <= 0) return;
    var amount = state.pendingCash;
    state.bankedCash += amount;
    state.pendingCash = 0;
    state.bundles = 0;
    playCashFx(amount);
    tone('cash');
    setStatus(amount + '코인 수거! 총 ' + state.bankedCash + '코인.', 'good', true);
    renderAll();
    if (state.bankedCash >= CONFIG.targetCash) finish('won', 'target');
  }

  function missingText(customer) {
    if (!customer) return '다음 손님이 들어오는 중이에요.';
    var missing = customer.order.filter(function (food) { return state.inventory[food] < 1; });
    if (!missing.length) return '서빙할 수 있어요!';
    return missing.map(function (food) { return CONFIG.stations[food].name; }).join(' · ') + ' 필요';
  }

  function frame(now) {
    if (!state || state.paused || state.phase !== 'playing') return;
    var delta = Math.min(Math.max(now - lastFrame, 0), 100);
    lastFrame = now;
    update(delta);
    renderDynamic();
    if (state.phase === 'playing') rafId = requestAnimationFrame(frame);
  }

  function update(delta) {
    FOOD_IDS.forEach(function (id) { advanceStation(state.stations[id], delta); });

    if (state.transitionMs > 0) {
      state.transitionMs -= delta;
      if (state.transitionMs <= 0) completeCustomerTransition();
    } else {
      var customer = currentCustomer();
      if (customer && !customer.settled) {
        customer.patienceMs = Math.max(0, customer.patienceMs - delta);
        if (customer.patienceMs <= 0) missCustomer();
      }
    }

    state.remainingMs = Math.max(0, state.remainingMs - delta);

    var sec = Math.ceil(state.remainingMs / 1000);
    if (sec <= 5 && sec !== state.lastAnnouncedSecond) {
      state.lastAnnouncedSecond = sec;
      if (sec === 5 || sec === 3 || sec === 1) { announce(sec + '초 남았습니다.'); tone('tick'); }
    }

    if (state.missed >= CONFIG.maxMisses) finish('lost', 'missed');
    else if (state.remainingMs <= 0) finish('lost', 'timeout');
  }

  function advanceStation(station, delta) {
    var config = CONFIG.stations[station.id];
    if (station.status === 'cooking') {
      station.elapsed += delta;
      station.remaining = Math.max(0, config.cookMs - station.elapsed);
      if (station.elapsed >= config.cookMs) {
        station.status = 'ready'; station.elapsed = 0; station.remaining = config.graceMs;
        setStatus(config.name + ' 준비 완료! 한 번 더 탭해 보관하세요.', 'good', true);
        tone('ready');
      }
    } else if (station.status === 'ready') {
      station.elapsed += delta;
      station.remaining = Math.max(0, config.graceMs - station.elapsed);
      if (station.elapsed >= config.graceMs) {
        station.status = 'wasted'; station.elapsed = config.graceMs; station.remaining = 0;
        state.streak = 0; state.wasted += 1;
        setStatus(config.name + '가 상했어요. 조리대를 탭해 치우세요.', 'bad', true);
        tone('waste');
      }
    }
  }

  function missCustomer() {
    var customer = currentCustomer();
    if (!customer || customer.settled) return;
    customer.settled = true;
    state.missed += 1;
    state.streak = 0;
    state.transitionMs = 600;
    state.transitionType = 'missed';
    el.customerStage.classList.add('exiting');
    tone('waste');
    setStatus(customer.name + ' 손님이 떠났어요. 놓침 ' + state.missed + '/3.', 'bad', true);
  }

  function completeCustomerTransition() {
    state.customers.shift();
    state.customers.push(createCustomer(false));
    state.transitionMs = 0;
    state.transitionType = '';
    el.customerStage.classList.remove('exiting');
    el.customerStage.classList.add('entering');
    window.setTimeout(function () { el.customerStage.classList.remove('entering'); }, 330);
    renderAll();
  }

  function finish(result, reason) {
    if (!state || state.phase === 'won' || state.phase === 'lost' || state.phase === 'resolving') return;
    state.phase = 'resolving';
    state.result = { type: result, reason: reason };
    cancelAnimationFrame(rafId);
    renderAll();
    window.setTimeout(function () {
      if (!state || state.phase !== 'resolving') return;
      state.phase = result;
      showResult();
    }, 420);
  }

  function starCount() {
    if (state.bankedCash < CONFIG.targetCash) return 0;
    var stars = 1;
    if (state.remainingMs >= 8000) stars = 2;
    if (state.remainingMs >= 15000 && state.missed === 0) stars = 3;
    return stars;
  }

  function showResult() {
    var won = state.phase === 'won';
    var stars = starCount();
    el.resultOverlay.classList.toggle('lost', !won);
    el.resultTicket.textContent = won ? 'SHIFT COMPLETE' : 'SHIFT CLOSED';
    el.resultKicker.textContent = won ? '오늘의 매출' : state.result.reason === 'missed' ? '손님 3명 이탈' : '영업 종료';
    el.resultTitle.textContent = won ? '러시 성공!' : '한 번 더 도전!';
    el.resultLead.textContent = won ? '요리부터 계산대까지 완벽하게 챙겼어요.' : (state.pendingCash ? '계산대의 미수거 현금도 잊지 마세요.' : '병렬 조리로 시간을 더 아껴보세요.');
    Array.prototype.forEach.call(el.resultStars.children, function (node, index) { node.classList.toggle('earned', index < stars); });
    el.resultStars.setAttribute('aria-label', '별 ' + stars + '개');
    el.resultCash.textContent = state.bankedCash;
    el.resultServed.textContent = state.served;
    el.resultStreak.textContent = state.bestStreak;
    el.resultPending.textContent = state.pendingCash;
    if (state.bankedCash > Number(readStored('rushCounter.best', '0'))) writeStored('rushCounter.best', state.bankedCash);
    el.resultOverlay.hidden = false;
    tone(won ? 'win' : 'lose');
    el.restartButton.focus();
  }

  function restart() {
    el.resultOverlay.hidden = true;
    newState(getSeed() + customerSeq + 1);
    setStatus('첫 조리대를 누르면 45초 시프트가 시작돼요.', 'neutral', true);
    el.stations[0].focus();
  }

  function togglePause(force) {
    if (!state || (state.phase !== 'playing' && state.phase !== 'ready')) return;
    var shouldPause = typeof force === 'boolean' ? force : !state.paused;
    if (shouldPause === state.paused) return;
    state.paused = shouldPause;
    if (shouldPause) {
      cancelAnimationFrame(rafId);
      el.pauseOverlay.hidden = false;
      el.resumeButton.focus();
      announce('게임이 일시정지되었습니다.');
    } else {
      el.pauseOverlay.hidden = true;
      lastFrame = performance.now();
      if (state.phase === 'playing') rafId = requestAnimationFrame(frame);
      el.pauseButton.focus();
      announce('게임을 계속합니다.');
    }
  }

  function foodArt(food) {
    return '<span class="mini-food ' + food + '-art" aria-hidden="true"><i></i><b></b><em></em></span>';
  }

  function renderAll() {
    if (!state) return;
    el.muteButton.setAttribute('aria-pressed', String(state.muted));
    el.muteButton.setAttribute('aria-label', state.muted ? '소리 켜기' : '소리 끄기');
    renderCustomer();
    renderInventory();
    renderStations();
    renderDynamic();
  }

  function renderCustomer() {
    var customer = currentCustomer();
    if (!customer) return;
    el.activeCustomer.style.setProperty('--customer-color', customer.shirt);
    el.activeCustomer.querySelector('.customer-head').style.background = customer.skin;
    Array.prototype.forEach.call(el.activeCustomer.querySelectorAll('.ear'), function (ear) { ear.style.background = customer.skin; });
    el.orderNumber.textContent = String(customer.id).padStart(2, '0');
    el.orderItems.innerHTML = customer.order.map(function (food) {
      var done = state.inventory[food] > 0;
      return '<span class="order-food' + (done ? ' done' : '') + '">' + foodArt(food) + '<span>' + CONFIG.stations[food].name + '</span></span>';
    }).join('');
    el.queueCount.textContent = '대기 ' + Math.max(0, state.customers.length - 1);
    el.queueFigures.innerHTML = state.customers.slice(1).map(function (c) { return '<i class="queue-figure" style="--skin:' + c.skin + ';--shirt:' + c.shirt + '"></i>'; }).join('');
  }

  function renderInventory() {
    el.inventoryBurger.textContent = state.inventory.burger + '/2';
    el.inventoryFries.textContent = state.inventory.fries + '/2';
    el.inventoryDrink.textContent = state.inventory.drink + '/2';
    FOOD_IDS.forEach(function (food) {
      var node = el.inventory.querySelector('[data-food="' + food + '"]');
      node.classList.toggle('has-stock', state.inventory[food] > 0);
    });
    var customer = currentCustomer();
    var ready = !!customer && !customer.settled && canServe(state.inventory, customer.order) && state.phase === 'playing' && state.transitionMs <= 0;
    el.serveButton.disabled = !ready;
    el.serveHint.textContent = ready ? '주문 준비 완료 — 지금 서빙하세요!' : missingText(customer);
    el.cashButton.disabled = state.pendingCash <= 0 || state.phase !== 'playing';
    el.pendingCash.textContent = state.pendingCash > 0 ? state.pendingCash + '코인 수거' : '현금 없음';
    el.bundleCount.textContent = state.pendingCash > 0 ? state.bundles + '건 대기 · C' : '계산대 · C';
  }

  function renderStations() {
    el.stations.forEach(function (node) {
      var id = node.getAttribute('data-station');
      var station = state.stations[id];
      var config = CONFIG.stations[id];
      var statusNode = node.querySelector('.station-status');
      var progress = 0;
      var text = '탭해서 ' + config.verb;
      if (station.status === 'cooking') {
        progress = station.elapsed / config.cookMs * 100;
        text = '조리 중 · ' + (station.remaining / 1000).toFixed(1) + '초';
      } else if (station.status === 'ready') {
        progress = 100;
        text = '준비 완료 · 다시 탭';
      } else if (station.status === 'wasted') {
        progress = 100;
        text = '폐기 · 탭해서 청소';
      }
      node.dataset.state = station.status;
      node.style.setProperty('--progress', Math.max(0, Math.min(100, progress)) + '%');
      statusNode.textContent = text;
      node.setAttribute('aria-label', config.name + ', ' + text + ', 보관 ' + state.inventory[id] + '개');
    });
  }

  function renderDynamic() {
    if (!state) return;
    var remaining = Math.ceil(state.remainingMs / 1000);
    el.timeValue.textContent = remaining;
    el.timerRing.style.strokeDashoffset = String(132 * (1 - state.remainingMs / CONFIG.durationMs));
    el.timerCard.classList.toggle('urgent', state.remainingMs <= 5000 && state.phase === 'playing');
    el.timerCard.setAttribute('aria-label', '남은 시간 ' + remaining + '초');
    el.bankedCash.textContent = state.bankedCash;
    el.cashFill.style.width = Math.min(100, state.bankedCash / CONFIG.targetCash * 100) + '%';
    Array.prototype.forEach.call(el.missMarks.children, function (node, index) { node.classList.toggle('lost', index < state.missed); });
    el.missMarks.setAttribute('aria-label', '놓친 손님 ' + state.missed + '명, 최대 3명');

    var customer = currentCustomer();
    if (customer) {
      var ratio = Math.max(0, customer.patienceMs / customer.maxPatienceMs);
      el.patienceFill.style.width = ratio * 100 + '%';
      el.patienceFill.style.background = ratio < .3 ? 'var(--tomato)' : ratio < .55 ? 'var(--mustard)' : 'var(--mint)';
      el.patienceText.textContent = (customer.patienceMs / 1000).toFixed(1) + '초';
    }
    renderStations();
    renderInventory();
  }

  function setStatus(text, toneName, speak) {
    el.statusText.textContent = text;
    el.statusStrip.classList.toggle('good', toneName === 'good');
    el.statusStrip.classList.toggle('bad', toneName === 'bad');
    if (speak) announce(text);
  }

  function announce(text) {
    if (text === lastLiveText) return;
    lastLiveText = text;
    el.liveRegion.textContent = '';
    window.setTimeout(function () { el.liveRegion.textContent = text; }, 20);
  }

  function ensureAudio() {
    if (!state || state.muted || audioContext) return;
    try {
      var AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) {
        audioContext = new AudioCtor();
        if (audioContext.state === 'suspended' && audioContext.resume) audioContext.resume();
      }
    } catch (ignore) { audioContext = null; }
  }

  function tone(type) {
    if (!state || state.muted) return;
    ensureAudio();
    if (!audioContext) return;
    var map = {
      start: [[180, .045, 0]], pickup: [[420, .05, 0], [610, .06, .045]], ready: [[520, .05, 0], [740, .07, .05]],
      deny: [[155, .07, 0]], serve: [[660, .06, 0], [880, .09, .05]], cash: [[520, .05, 0], [700, .05, .05], [960, .09, .1]],
      waste: [[170, .08, 0], [120, .1, .07]], tick: [[760, .035, 0]], win: [[520, .08, 0], [660, .08, .08], [920, .14, .16]], lose: [[260, .1, 0], [190, .16, .1]]
    };
    (map[type] || []).forEach(function (note) {
      var osc = audioContext.createOscillator();
      var gain = audioContext.createGain();
      var at = audioContext.currentTime + note[2];
      osc.type = type === 'cash' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(note[0], at);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(.055, at + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, at + note[1]);
      osc.connect(gain); gain.connect(audioContext.destination);
      osc.start(at); osc.stop(at + note[1] + .02);
    });
  }

  function playCashFx(amount) {
    var rect = el.cashButton.getBoundingClientRect();
    var bill = document.createElement('i');
    bill.className = 'cash-fly';
    bill.textContent = '+' + amount;
    bill.style.left = (rect.left + rect.width / 2 - 21) + 'px';
    bill.style.top = (rect.top + 8) + 'px';
    el.fxLayer.appendChild(bill);
    window.setTimeout(function () { bill.remove(); }, 520);
    el.cashMeter.classList.remove('bump');
    void el.cashMeter.offsetWidth;
    el.cashMeter.classList.add('bump');
    window.setTimeout(function () { el.cashMeter.classList.remove('bump'); }, 320);
  }

  function toggleMute() {
    if (!state) {
      var current = readStored('rushCounter.muted', '0') === '1';
      writeStored('rushCounter.muted', current ? '0' : '1');
      return;
    }
    state.muted = !state.muted;
    writeStored('rushCounter.muted', state.muted ? '1' : '0');
    renderAll();
    if (!state.muted) tone('pickup');
  }

  function onKeydown(event) {
    var key = event.key.toLowerCase();
    var openOverlay = !el.resultOverlay.hidden ? el.resultOverlay : !el.pauseOverlay.hidden ? el.pauseOverlay : !el.introOverlay.hidden ? el.introOverlay : null;
    if (key === 'tab' && openOverlay) {
      var focusable = Array.prototype.slice.call(openOverlay.querySelectorAll('button:not([disabled])'));
      if (focusable.length) {
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      return;
    }
    if (el.introOverlay && !el.introOverlay.hidden) {
      if (key === 'enter' || key === ' ') { event.preventDefault(); el.startButton.click(); }
      return;
    }
    if (el.resultOverlay && !el.resultOverlay.hidden) {
      if (key === 'r') { event.preventDefault(); restart(); }
      return;
    }
    if (key === 'p' || key === 'escape') { event.preventDefault(); togglePause(); return; }
    if (state && state.paused) return;
    if (key === '1' || key === '2' || key === '3') {
      event.preventDefault(); dispatchAction('station', FOOD_IDS[Number(key) - 1]);
    } else if (key === 'c' || key === '4') {
      event.preventDefault(); dispatchAction('cash');
    } else if (key === ' ' && !/button/i.test(document.activeElement.tagName)) {
      event.preventDefault(); dispatchAction('serve');
    }
  }

  function bindEvents() {
    el.startButton.addEventListener('click', startFromIntro);
    el.restartButton.addEventListener('click', restart);
    el.resumeButton.addEventListener('click', function () { togglePause(false); });
    el.pauseButton.addEventListener('click', function () { togglePause(); });
    el.muteButton.addEventListener('click', toggleMute);
    el.stations.forEach(function (node) { node.addEventListener('click', function () { dispatchAction('station', node.getAttribute('data-station')); }); });
    el.serveButton.addEventListener('click', function () { dispatchAction('serve'); });
    el.cashButton.addEventListener('click', function () { dispatchAction('cash'); });
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('visibilitychange', function () { if (document.hidden && state && state.phase === 'playing') togglePause(true); });
  }

  function runSelfTests() {
    var problems = [];
    function check(condition, label) { if (!condition) problems.push(label); }
    var a = makeRng(6), b = makeRng(6);
    check(a() === b() && a() === b(), 'seeded RNG reproducibility');
    check(canServe({ burger: 1, fries: 0, drink: 1 }, ['burger', 'drink']), 'canServe positive');
    check(!canServe({ burger: 1, fries: 0, drink: 0 }, ['burger', 'drink']), 'canServe missing food');
    var payout = calculatePayout(['burger', 'drink'], 1, 2);
    check(payout.base === 30 && payout.speed === 5 && payout.streak === 3 && payout.total === 38, 'payout ledger');
    check(calculatePayout(['fries'], 0, 9).streak === 9, 'streak cap');
    var rng = makeRng(9);
    for (var i = 0; i < 40; i++) {
      var order = createOrder(rng, i * 1100);
      check(order.length >= 1 && order.length <= 3, 'order size');
      check(new Set(order).size === order.length, 'order uniqueness');
    }
    if (problems.length) console.error('[Rush Counter self-test] FAIL', problems);
    else console.info('[Rush Counter self-test] PASS — 86 assertions');
    return { pass: problems.length === 0, problems: problems };
  }

  bindEvents();
  newState(getSeed());
  el.introOverlay.hidden = false;
  el.startButton.focus();

  try { if (/[?&]test=1(?:&|$)/.test(location.search)) runSelfTests(); } catch (ignore) { /* URL may be unavailable */ }

  window.__rushCounter = {
    config: CONFIG,
    start: startFromIntro,
    action: dispatchAction,
    pause: togglePause,
    restart: restart,
    test: runSelfTests,
    advance: function (milliseconds) {
      if (!/[?&]test=1(?:&|$)/.test(location.search) || !state || state.phase !== 'playing') return false;
      update(Math.max(0, Math.min(Number(milliseconds) || 0, 10000)));
      renderDynamic();
      return true;
    },
    snapshot: function () {
      return state ? JSON.parse(JSON.stringify({ phase: state.phase, remainingMs: state.remainingMs, stations: state.stations, inventory: state.inventory, order: currentCustomer() && currentCustomer().order, bankedCash: state.bankedCash, pendingCash: state.pendingCash, served: state.served, missed: state.missed, wasted: state.wasted, streak: state.streak })) : null;
    }
  };
}());
