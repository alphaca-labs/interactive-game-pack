/* Pixel Pour — 항목 5/8, 유형 C 물리/파티클
 * 외부 의존성·네트워크 요청 0건. ?seed=<정수>로 라운드 재현,
 * ?test=1로 레시피·배치 불변식 자동 검증. */
(function () {
  'use strict';

  var CONFIG = {
    ROUND_SECONDS: 38,
    GRID_SIZE: 16,
    VISIBLE_BATCHES: 3,
    TOTAL_BATCHES: 15,
    WRONG_PENALTY_SECONDS: 2,
    WRONG_PENALTY_SCORE: 75,
    RESPONSE_FAST_MS: 1200,
    RESPONSE_OK_MS: 2000,
    PARTICLE_MS: 430,
    MAX_PARTICLES: 96,
    WIN_DELAY_MS: 920
  };

  var PALETTE = [
    { id: 0, name: '산딸기', color: '#e85d5d', symbol: '○', shape: '원' },
    { id: 1, name: '귤빛', color: '#ef983c', symbol: '▲', shape: '삼각' },
    { id: 2, name: '민들레', color: '#f1c84a', symbol: '+', shape: '더하기' },
    { id: 3, name: '초원', color: '#3f9e73', symbol: '◆', shape: '마름모' },
    { id: 4, name: '호수', color: '#4385d1', symbol: '≋', shape: '물결' },
    { id: 5, name: '포도', color: '#815ac0', symbol: '★', shape: '별' }
  ];

  // 108개 셀을 [24, 24, 18, 14, 14, 14]로 배색하면
  // 색별 배치 수 [3, 3, 3, 2, 2, 2] = 정확히 15개가 된다.
  var COLOR_TARGETS = [24, 24, 18, 14, 14, 14];

  var RECIPES = [
    { id: 'mug', name: '김 나는 머그컵', mask: buildMugMask },
    { id: 'cupcake', name: '체리 컵케이크', mask: buildCupcakeMask }
  ];

  var el = {
    shell: document.getElementById('gameShell'),
    score: document.getElementById('scoreValue'),
    scoreBox: document.querySelector('.score'),
    clock: document.getElementById('clock'),
    clockHand: document.getElementById('clockHand'),
    time: document.getElementById('timeValue'),
    sound: document.getElementById('soundButton'),
    artTitle: document.getElementById('artTitle'),
    combo: document.getElementById('comboValue'),
    canvasFrame: document.getElementById('canvasFrame'),
    canvas: document.getElementById('artCanvas'),
    progress: document.getElementById('artProgress'),
    progressText: document.getElementById('progressText'),
    lanes: document.getElementById('lanes'),
    remaining: document.getElementById('remainingValue'),
    batchZone: document.getElementById('batchZone'),
    batches: document.getElementById('batches'),
    feedback: document.getElementById('feedback'),
    live: document.getElementById('liveRegion'),
    ghost: document.getElementById('dragGhost'),
    result: document.getElementById('result'),
    resultKicker: document.getElementById('resultKicker'),
    resultCanvas: document.getElementById('resultCanvas'),
    resultTitle: document.getElementById('resultTitle'),
    resultCopy: document.getElementById('resultCopy'),
    finalScore: document.getElementById('finalScore'),
    finalCombo: document.getElementById('finalCombo'),
    finalAccuracy: document.getElementById('finalAccuracy'),
    replay: document.getElementById('replayButton'),
    more: document.getElementById('moreButton')
  };

  var ctx = el.canvas && el.canvas.getContext ? el.canvas.getContext('2d') : null;
  var resultCtx = el.resultCanvas && el.resultCanvas.getContext ? el.resultCanvas.getContext('2d') : null;
  var state = null;
  var pointer = null;
  var rafId = 0;
  var roundNumber = 0;
  var audioContext = null;
  var finishTimer = 0;

  function key(x, y) { return x + ',' + y; }

  function addRow(target, y, fromX, toX) {
    for (var x = fromX; x <= toX; x++) target.push({ x: x, y: y });
  }

  function buildMugMask() {
    var cells = [
      { x: 6, y: 1 }, { x: 9, y: 1 },
      { x: 6, y: 2 }, { x: 9, y: 2 },
      { x: 5, y: 3 }, { x: 6, y: 3 }, { x: 9, y: 3 }, { x: 10, y: 3 },
      { x: 5, y: 4 }, { x: 9, y: 4 }, { x: 10, y: 4 },
      { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 9, y: 5 }
    ];
    for (var y = 6; y <= 12; y++) addRow(cells, y, 3, 11); // 컵 몸체 63
    [[12, 7], [13, 7], [13, 8], [14, 8], [13, 9], [14, 9], [13, 10], [14, 10], [12, 11], [13, 11]]
      .forEach(function (p) { cells.push({ x: p[0], y: p[1] }); }); // 손잡이 10
    addRow(cells, 13, 2, 13);
    addRow(cells, 14, 4, 11); // 받침 20
    return cells;
  }

  function buildCupcakeMask() {
    var cells = [
      { x: 9, y: 0 }, { x: 10, y: 0 },
      { x: 7, y: 1 }, { x: 8, y: 1 }
    ];
    addRow(cells, 2, 6, 9);
    addRow(cells, 3, 6, 9); // 체리 12
    addRow(cells, 4, 5, 10);
    addRow(cells, 5, 4, 11);
    addRow(cells, 6, 3, 12);
    addRow(cells, 7, 2, 13);
    addRow(cells, 8, 3, 12); // 크림 46
    addRow(cells, 9, 3, 12);
    addRow(cells, 10, 4, 11);
    addRow(cells, 11, 4, 11);
    addRow(cells, 12, 4, 11);
    addRow(cells, 13, 4, 11);
    addRow(cells, 14, 4, 11); // 포장지 50
    return cells;
  }

  function preferredColor(cell, recipeId) {
    if (recipeId === 'mug') {
      if (cell.y <= 5) return 1;
      if (cell.y >= 13) return 3;
      if (cell.x >= 12) return 4;
      if (cell.y === 6 || cell.y === 12 || cell.x === 3 || cell.x === 11) return 5;
      return (cell.x + cell.y) % 3 === 0 ? 2 : ((cell.x + cell.y) % 2 ? 0 : 4);
    }
    if (cell.y <= 3) return 0;
    if (cell.y <= 8) return [2, 1, 0][(cell.x + cell.y) % 3];
    return [5, 4, 3][cell.x % 3];
  }

  function colorizeMask(mask, recipeId) {
    var remaining = COLOR_TARGETS.slice();
    return mask.map(function (cell) {
      var preferred = preferredColor(cell, recipeId);
      var colorId = preferred;
      if (remaining[colorId] <= 0) {
        colorId = 0;
        for (var i = 1; i < remaining.length; i++) {
          if (remaining[i] > remaining[colorId]) colorId = i;
        }
      }
      remaining[colorId]--;
      return { index: cell.y * CONFIG.GRID_SIZE + cell.x, x: cell.x, y: cell.y, colorId: colorId };
    });
  }

  function makeRng(seed) {
    var value = (seed >>> 0) || 1;
    return function () {
      value ^= value << 13; value >>>= 0;
      value ^= value >>> 17;
      value ^= value << 5; value >>>= 0;
      return value / 4294967296;
    };
  }

  function shuffle(input, rng) {
    var output = input.slice();
    for (var i = output.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var swap = output[i]; output[i] = output[j]; output[j] = swap;
    }
    return output;
  }

  function partition(total) {
    var parts = Math.ceil(total / 8);
    var base = Math.floor(total / parts);
    var extra = total % parts;
    var output = [];
    for (var i = 0; i < parts; i++) output.push(base + (i < extra ? 1 : 0));
    return output;
  }

  function createBatches(cells, rng) {
    var batches = [];
    PALETTE.forEach(function (palette) {
      var matching = shuffle(cells.filter(function (cell) {
        return cell.colorId === palette.id;
      }), rng);
      var sizes = partition(matching.length);
      var cursor = 0;
      sizes.forEach(function (size, partIndex) {
        batches.push({
          id: palette.id + '-' + partIndex + '-' + Math.floor(rng() * 100000),
          colorId: palette.id,
          cells: matching.slice(cursor, cursor + size),
          exposedAt: 0
        });
        cursor += size;
      });
    });
    return shuffle(batches, rng);
  }

  function readSeed() {
    try {
      var match = /[?&]seed=(-?\d+)/.exec(window.location.search);
      if (match) return parseInt(match[1], 10) >>> 0;
    } catch (error) { /* file://에서도 계속 실행 */ }
    return 0;
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function readMuted() {
    try { return window.localStorage.getItem('pixel-pour:muted') === '1'; }
    catch (error) { return false; }
  }

  function saveMuted(value) {
    try { window.localStorage.setItem('pixel-pour:muted', value ? '1' : '0'); }
    catch (error) { /* 저장 실패는 플레이를 막지 않는다 */ }
  }

  function newRound() {
    window.clearTimeout(finishTimer);
    cancelAnimationFrame(rafId);
    rafId = 0;
    pointer = null;
    el.ghost.classList.remove('show');
    el.result.hidden = true;

    var recipeIndex = roundNumber % RECIPES.length;
    var recipe = RECIPES[recipeIndex];
    var seedParam = readSeed();
    var seed = seedParam || ((Date.now() + roundNumber * 2654435761) >>> 0) || 1;
    var rng = makeRng(seed);
    var cells = colorizeMask(recipe.mask(), recipe.id);
    var batches = createBatches(cells, rng);
    var now = performance.now();
    batches.slice(0, CONFIG.VISIBLE_BATCHES).forEach(function (batch) { batch.exposedAt = now; });

    state = {
      phase: 'READY',
      recipe: recipe,
      seed: seed,
      cells: cells,
      completed: new Set(),
      batches: batches.slice(0, CONFIG.VISIBLE_BATCHES),
      queue: batches.slice(CONFIG.VISIBLE_BATCHES),
      selectedId: null,
      keyboardLane: null,
      remainingSeconds: CONFIG.ROUND_SECONDS,
      endAt: 0,
      pausedAt: 0,
      score: 0,
      combo: 0,
      maxCombo: 0,
      correct: 0,
      wrong: 0,
      particles: [],
      celebrateAt: 0,
      timeoutPending: false,
      timeoutGraceAt: 0,
      muted: readMuted()
    };

    roundNumber++;
    renderLanes();
    renderBatches(false);
    syncAll();
    setFeedback('펠릿을 잡아 같은 색·문양 스테이션으로 옮기세요.');
    drawCanvas(performance.now());
    el.sound.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
    el.artTitle.textContent = recipe.name;
  }

  function renderLanes() {
    el.lanes.innerHTML = PALETTE.map(function (palette, index) {
      return '<button class="lane" type="button" data-lane="' + index + '" ' +
        'style="--lane-color:' + palette.color + '" aria-label="' + palette.name + '색 ' + palette.shape + ' 레인, 0퍼센트 완성">' +
        '<span class="symbol" aria-hidden="true">' + palette.symbol + '</span>' +
        '<span class="lane-name">' + palette.name + '</span>' +
        '<span class="lane-percent">0%</span></button>';
    }).join('');
  }

  function pelletsMarkup(batch) {
    var palette = PALETTE[batch.colorId];
    var pellets = '';
    for (var i = 0; i < batch.cells.length; i++) pellets += '<span class="pellet"></span>';
    return '<span class="batch-pellets" aria-hidden="true">' + pellets + '</span>' +
      '<span class="batch-meta"><span class="batch-mark" aria-hidden="true">' + palette.symbol + '</span>' +
      '<span class="batch-count">' + batch.cells.length + '개</span></span>';
  }

  function renderBatches(animateLast) {
    el.batches.innerHTML = state.batches.map(function (batch, index) {
      var palette = PALETTE[batch.colorId];
      var selected = batch.id === state.selectedId;
      return '<button class="batch' + (selected ? ' is-selected' : '') + (animateLast && index === state.batches.length - 1 ? ' is-new' : '') + '" ' +
        'type="button" data-batch="' + batch.id + '" style="--batch-color:' + palette.color + '" ' +
        'aria-pressed="' + (selected ? 'true' : 'false') + '" aria-label="' + palette.name + '색 ' + palette.shape + ' 펠릿 ' + batch.cells.length + '개">' +
        pelletsMarkup(batch) + '</button>';
    }).join('');
  }

  function startRound() {
    if (state.phase !== 'READY') return;
    state.phase = 'PLAYING';
    state.endAt = performance.now() + state.remainingSeconds * 1000;
    ensureAnimation();
  }

  function findBatch(id) {
    for (var i = 0; i < state.batches.length; i++) {
      if (state.batches[i].id === id) return state.batches[i];
    }
    return null;
  }

  function selectBatch(id, announce) {
    if (!state || (state.phase !== 'READY' && state.phase !== 'PLAYING')) return false;
    var batch = findBatch(id);
    if (!batch) return false;
    initAudio();
    startRound();
    state.selectedId = id;
    state.keyboardLane = batch.colorId;
    renderBatches(false);
    highlightLane(batch.colorId);
    if (announce) {
      var palette = PALETTE[batch.colorId];
      setFeedback(palette.name + '색 ' + palette.shape + ' 펠릿을 집었습니다. 같은 문양에 놓으세요.');
      announceLive(palette.name + '색 ' + palette.shape + ' 펠릿 ' + batch.cells.length + '개 선택');
      playTone('pick');
    }
    return true;
  }

  function cancelSelection(message) {
    state.selectedId = null;
    state.keyboardLane = null;
    clearLaneHighlights();
    renderBatches(false);
    if (message) setFeedback(message);
    if (state.timeoutPending) finishRound(false);
  }

  function highlightLane(index) {
    clearLaneHighlights();
    var lane = el.lanes.querySelector('[data-lane="' + index + '"]');
    if (lane) lane.classList.add('is-target');
  }

  function clearLaneHighlights() {
    Array.prototype.forEach.call(el.lanes.querySelectorAll('.lane'), function (lane) {
      lane.classList.remove('is-target');
    });
  }

  function dropSelected(laneIndex) {
    if (!state.selectedId || (state.phase !== 'PLAYING' && state.phase !== 'READY')) return;
    var batch = findBatch(state.selectedId);
    if (!batch) return;
    var lane = el.lanes.querySelector('[data-lane="' + laneIndex + '"]');

    if (batch.colorId === laneIndex) {
      acceptBatch(batch, lane);
    } else {
      rejectBatch(batch, lane);
    }
  }

  function responseBonus(batch) {
    var elapsed = performance.now() - batch.exposedAt;
    if (elapsed <= CONFIG.RESPONSE_FAST_MS) return 50;
    if (elapsed <= CONFIG.RESPONSE_OK_MS) return 25;
    return 0;
  }

  function acceptBatch(batch, lane) {
    var bonus = responseBonus(batch);
    state.combo = Math.min(10, state.combo + 1);
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    var multiplier = 1 + (state.combo - 1) * .1;
    var earned = Math.round(100 * multiplier) + bonus;
    state.score += earned;
    state.correct++;
    batch.cells.forEach(function (cell) { state.completed.add(cell.index); });
    state.particles = state.particles.concat(makeParticles(batch, lane)).slice(-CONFIG.MAX_PARTICLES);

    var oldIndex = state.batches.indexOf(batch);
    state.batches.splice(oldIndex, 1);
    if (state.queue.length) {
      var replacement = state.queue.shift();
      replacement.exposedAt = performance.now();
      state.batches.push(replacement);
    }
    state.selectedId = null;
    state.keyboardLane = null;
    laneFlash(lane, 'is-correct');
    playTone('correct', state.combo);
    syncAll();
    renderBatches(true);
    drawCanvas(performance.now());
    ensureAnimation();

    var percent = completionPercent();
    setFeedback('좋아요! +' + earned + '점 · 작품 ' + percent + '% 완성', 'good');
    announceLive('정답, ' + percent + '퍼센트 완성, 콤보 ' + state.combo);

    if (state.batches.length === 0 && state.queue.length === 0) {
      state.score += Math.ceil(state.remainingSeconds) * 20;
      syncAll();
      finishRound(true);
    } else if (state.timeoutPending) {
      finishRound(false);
    }
  }

  function rejectBatch(batch, lane) {
    state.score = Math.max(0, state.score - CONFIG.WRONG_PENALTY_SCORE);
    state.combo = 0;
    state.wrong++;
    state.remainingSeconds = Math.max(0, state.remainingSeconds - CONFIG.WRONG_PENALTY_SECONDS);
    if (state.endAt) state.endAt -= CONFIG.WRONG_PENALTY_SECONDS * 1000;
    state.selectedId = null;
    state.keyboardLane = null;
    laneFlash(lane, 'is-wrong');
    playTone('wrong');
    clearLaneHighlights();
    renderBatches(false);
    syncAll();
    setFeedback('문양이 달라요. 2초 감소 — 펠릿은 그대로 남아 있어요.', 'bad');
    announceLive('오답, 2초 감소. ' + PALETTE[batch.colorId].shape + ' 문양을 찾으세요.');
    if (state.remainingSeconds <= 0 || state.timeoutPending) finishRound(false);
  }

  function laneFlash(lane, className) {
    if (!lane) return;
    lane.classList.remove(className);
    void lane.offsetWidth;
    lane.classList.add(className);
    window.setTimeout(function () { lane.classList.remove(className); }, 300);
  }

  function completionPercent() {
    return Math.round(state.completed.size / state.cells.length * 100);
  }

  function colorPercent(colorId) {
    var total = 0;
    var done = 0;
    state.cells.forEach(function (cell) {
      if (cell.colorId === colorId) {
        total++;
        if (state.completed.has(cell.index)) done++;
      }
    });
    return total ? Math.round(done / total * 100) : 0;
  }

  function syncAll() {
    if (!state) return;
    var percent = completionPercent();
    el.score.textContent = state.score.toLocaleString('ko-KR');
    el.scoreBox.classList.remove('bump');
    void el.scoreBox.offsetWidth;
    if (state.score) el.scoreBox.classList.add('bump');
    el.combo.innerHTML = 'COMBO <strong>×' + state.combo + '</strong>';
    el.combo.setAttribute('aria-label', '현재 콤보 ' + state.combo);
    el.combo.classList.toggle('hot', state.combo >= 3);
    el.progress.value = percent;
    el.progress.textContent = percent + '%';
    el.progressText.textContent = percent + '%';
    el.remaining.textContent = state.batches.length + state.queue.length;
    el.canvas.setAttribute('aria-label', state.recipe.name + ', ' + percent + '퍼센트 완성');
    updateClock();

    Array.prototype.forEach.call(el.lanes.querySelectorAll('.lane'), function (lane) {
      var colorId = Number(lane.getAttribute('data-lane'));
      var lanePercent = colorPercent(colorId);
      lane.querySelector('.lane-percent').textContent = lanePercent + '%';
      lane.setAttribute('aria-label', PALETTE[colorId].name + '색 ' + PALETTE[colorId].shape + ' 레인, ' + lanePercent + '퍼센트 완성');
    });
  }

  function updateClock() {
    var value = Math.max(0, state.remainingSeconds);
    var rounded = Math.ceil(value);
    var ratio = value / CONFIG.ROUND_SECONDS;
    el.time.textContent = rounded;
    el.clockHand.style.strokeDashoffset = String(113.1 * (1 - ratio));
    el.clock.classList.toggle('urgent', value <= 8 && state.phase === 'PLAYING');
    el.clock.setAttribute('aria-label', '남은 시간 ' + rounded + '초');
  }

  function setFeedback(message, kind) {
    el.feedback.textContent = message;
    el.feedback.className = 'feedback' + (kind ? ' ' + kind : '');
  }

  function announceLive(message) {
    el.live.textContent = '';
    window.setTimeout(function () { el.live.textContent = message; }, 10);
  }

  function makeParticles(batch, lane) {
    if (reducedMotion() || !lane) return [];
    var laneRect = lane.getBoundingClientRect();
    var canvasRect = el.canvas.getBoundingClientRect();
    var scaleX = el.canvas.width / canvasRect.width;
    var scaleY = el.canvas.height / canvasRect.height;
    var startX = ((laneRect.left + laneRect.width / 2) - canvasRect.left) * scaleX;
    var startY = ((laneRect.top + laneRect.height / 2) - canvasRect.top) * scaleY;
    var now = performance.now();
    return batch.cells.map(function (cell, index) {
      return {
        colorId: batch.colorId,
        startX: startX,
        startY: startY,
        endX: (cell.x + .5) * el.canvas.width / CONFIG.GRID_SIZE,
        endY: (cell.y + .5) * el.canvas.height / CONFIG.GRID_SIZE,
        startedAt: now + index * 18,
        duration: CONFIG.PARTICLE_MS + (index % 3) * 45,
        bend: (index % 2 ? 1 : -1) * (34 + index * 5)
      };
    });
  }

  function drawCanvas(now, targetCtx, targetCanvas, forceComplete) {
    var drawingContext = targetCtx || ctx;
    var drawingCanvas = targetCanvas || el.canvas;
    if (!drawingContext || !state) return;
    var size = drawingCanvas.width;
    var unit = size / CONFIG.GRID_SIZE;
    drawingContext.clearRect(0, 0, size, drawingCanvas.height);
    drawingContext.fillStyle = '#f8efd9';
    drawingContext.fillRect(0, 0, size, drawingCanvas.height);

    drawingContext.strokeStyle = 'rgba(32,42,68,.055)';
    drawingContext.lineWidth = 1;
    for (var grid = 1; grid < CONFIG.GRID_SIZE; grid++) {
      drawingContext.beginPath();
      drawingContext.moveTo(grid * unit, 0);
      drawingContext.lineTo(grid * unit, size);
      drawingContext.stroke();
      drawingContext.beginPath();
      drawingContext.moveTo(0, grid * unit);
      drawingContext.lineTo(size, grid * unit);
      drawingContext.stroke();
    }

    state.cells.forEach(function (cell) {
      var completed = forceComplete || state.completed.has(cell.index);
      var inset = Math.max(1, unit * .07);
      if (completed) {
        drawingContext.fillStyle = PALETTE[cell.colorId].color;
        drawingContext.fillRect(cell.x * unit + inset, cell.y * unit + inset, unit - inset * 2, unit - inset * 2);
        drawingContext.fillStyle = 'rgba(255,255,255,.16)';
        drawingContext.fillRect(cell.x * unit + inset, cell.y * unit + inset, unit - inset * 2, Math.max(1, unit * .11));
      } else {
        drawingContext.fillStyle = 'rgba(32,42,68,.045)';
        drawingContext.fillRect(cell.x * unit + inset, cell.y * unit + inset, unit - inset * 2, unit - inset * 2);
        drawingContext.strokeStyle = 'rgba(32,42,68,.18)';
        drawingContext.lineWidth = Math.max(1, unit * .04);
        drawingContext.strokeRect(cell.x * unit + inset * 1.5, cell.y * unit + inset * 1.5, unit - inset * 3, unit - inset * 3);
      }
    });

    if (!targetCtx) drawParticles(now, drawingContext);

    if (!targetCtx && state.celebrateAt) {
      var elapsed = now - state.celebrateAt;
      if (elapsed < 900 && !reducedMotion()) {
        var sweepX = (elapsed / 900) * (size * 1.7) - size * .35;
        drawingContext.save();
        drawingContext.globalAlpha = .34 * (1 - elapsed / 900);
        drawingContext.translate(sweepX, 0);
        drawingContext.rotate(-.18);
        drawingContext.fillStyle = '#fff';
        drawingContext.fillRect(-size * .08, -size * .1, size * .16, size * 1.3);
        drawingContext.restore();
      }
    }
  }

  function drawParticles(now, drawingContext) {
    var active = [];
    state.particles.forEach(function (particle) {
      var t = (now - particle.startedAt) / particle.duration;
      if (t < 0) { active.push(particle); return; }
      if (t >= 1) return;
      active.push(particle);
      var eased = 1 - Math.pow(1 - t, 3);
      var x = particle.startX + (particle.endX - particle.startX) * eased + Math.sin(Math.PI * eased) * particle.bend;
      var y = particle.startY + (particle.endY - particle.startY) * eased - Math.sin(Math.PI * eased) * 80;
      var pixel = Math.max(5, el.canvas.width / 45) * (1 - t * .25);
      drawingContext.fillStyle = PALETTE[particle.colorId].color;
      drawingContext.fillRect(Math.round(x - pixel / 2), Math.round(y - pixel / 2), pixel, pixel);
      drawingContext.strokeStyle = '#202a44';
      drawingContext.lineWidth = 2;
      drawingContext.strokeRect(Math.round(x - pixel / 2), Math.round(y - pixel / 2), pixel, pixel);
    });
    state.particles = active;
  }

  function ensureAnimation() {
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function tick(now) {
    rafId = 0;
    if (!state) return;
    if (state.phase === 'PLAYING') {
      state.remainingSeconds = Math.max(0, (state.endAt - now) / 1000);
      updateClock();
      if (state.remainingSeconds <= 0) {
        if (pointer && (!state.timeoutGraceAt || now < state.timeoutGraceAt)) {
          if (!state.timeoutPending) state.timeoutGraceAt = now + 450;
          state.timeoutPending = true;
          setFeedback('마지막으로 집은 펠릿까지 판정할게요!', 'bad');
        } else {
          finishRound(false);
        }
      }
    }

    if (state.particles.length || state.celebrateAt) drawCanvas(now);
    var celebrating = state.celebrateAt && now - state.celebrateAt < 900;
    if (state.phase === 'PLAYING' || state.particles.length || celebrating) ensureAnimation();
  }

  function finishRound(won) {
    if (!state || state.phase === 'WIN' || state.phase === 'FAIL' || state.phase === 'RESULT') return;
    state.phase = won ? 'WIN' : 'FAIL';
    state.timeoutPending = false;
    state.selectedId = null;
    pointer = null;
    el.ghost.classList.remove('show');
    clearLaneHighlights();
    renderBatches(false);
    if (won) {
      state.celebrateAt = performance.now();
      playTone('win');
      drawCanvas(performance.now());
      ensureAnimation();
    } else {
      playTone('fail');
    }
    finishTimer = window.setTimeout(function () { showResult(won); }, won ? CONFIG.WIN_DELAY_MS : 240);
  }

  function showResult(won) {
    state.phase = 'RESULT';
    var attempts = state.correct + state.wrong;
    var accuracy = attempts ? Math.round(state.correct / attempts * 100) : 0;
    el.resultKicker.textContent = won ? '작품 완성' : '시간 종료';
    el.resultTitle.textContent = won ? '픽셀이 모두 모였어요!' : '조금만 더 채워 볼까요?';
    el.resultCopy.textContent = won
      ? state.recipe.name + '을 정확한 색과 문양으로 완성했습니다.'
      : state.recipe.name + '이 ' + completionPercent() + '% 완성됐어요. 다음 작품에서 다시 도전해 보세요.';
    el.finalScore.textContent = state.score.toLocaleString('ko-KR');
    el.finalCombo.textContent = '×' + state.maxCombo;
    el.finalAccuracy.textContent = accuracy + '%';
    drawCanvas(performance.now(), resultCtx, el.resultCanvas, won);
    el.result.hidden = false;
    el.resultTitle.focus();
    announceLive(won ? '작품 완성. 최종 점수 ' + state.score : '시간 종료. 작품 ' + completionPercent() + '퍼센트 완성');
  }

  function initAudio() {
    if (state.muted || audioContext) return;
    try {
      var AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      audioContext = new AudioCtor();
      if (audioContext.state === 'suspended') audioContext.resume().catch(function () {});
    } catch (error) { audioContext = null; }
  }

  function tone(frequency, offset, duration, type, volume) {
    if (!audioContext || state.muted) return;
    try {
      var start = audioContext.currentTime + offset;
      var oscillator = audioContext.createOscillator();
      var gain = audioContext.createGain();
      oscillator.type = type || 'square';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume || .025, start + .008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + .02);
    } catch (error) { /* 오디오는 선택적 보상 */ }
  }

  function playTone(kind, combo) {
    if (state.muted) return;
    initAudio();
    if (!audioContext) return;
    if (kind === 'pick') tone(260, 0, .045, 'square', .018);
    if (kind === 'correct') {
      tone(420 + (combo || 0) * 22, 0, .09, 'square', .026);
      tone(630 + (combo || 0) * 24, .075, .12, 'triangle', .03);
    }
    if (kind === 'wrong') { tone(145, 0, .14, 'sawtooth', .025); tone(108, .08, .12, 'square', .018); }
    if (kind === 'win') { tone(440, 0, .16, 'square', .03); tone(660, .13, .18, 'square', .03); tone(880, .28, .26, 'triangle', .035); }
    if (kind === 'fail') { tone(220, 0, .16, 'triangle', .022); tone(165, .13, .24, 'triangle', .02); }
  }

  function laneAtPoint(clientX, clientY) {
    var lanes = el.lanes.querySelectorAll('.lane');
    for (var i = 0; i < lanes.length; i++) {
      var rect = lanes[i].getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) return Number(lanes[i].dataset.lane);
    }
    return null;
  }

  el.batches.addEventListener('pointerdown', function (event) {
    var button = event.target.closest('.batch');
    if (!button || event.button > 0) return;
    var id = button.dataset.batch;
    if (!selectBatch(id, true)) return;
    pointer = {
      id: id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      button: button,
      laneIndex: null
    };
    try { button.setPointerCapture(event.pointerId); } catch (error) { /* 일부 브라우저 */ }
  });

  document.addEventListener('pointermove', function (event) {
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    var distance = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
    if (!pointer.dragging && distance >= 8) {
      pointer.dragging = true;
      pointer.button.classList.add('is-dragging');
      el.ghost.classList.add('show');
    }
    if (!pointer.dragging) return;
    event.preventDefault();
    var batch = findBatch(pointer.id);
    if (!batch) return;
    el.ghost.style.setProperty('--ghost-color', PALETTE[batch.colorId].color);
    el.ghost.textContent = PALETTE[batch.colorId].symbol;
    el.ghost.style.left = event.clientX + 'px';
    el.ghost.style.top = event.clientY + 'px';
    pointer.laneIndex = laneAtPoint(event.clientX, event.clientY);
    if (pointer.laneIndex === null) clearLaneHighlights();
    else highlightLane(pointer.laneIndex);
  }, { passive: false });

  function releasePointer(event, cancelled) {
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    var current = pointer;
    pointer = null;
    current.button.classList.remove('is-dragging');
    el.ghost.classList.remove('show');
    if (cancelled) {
      cancelSelection('이동을 취소했습니다. 점수와 시간은 그대로예요.');
      return;
    }
    if (current.dragging) {
      var laneIndex = laneAtPoint(event.clientX, event.clientY);
      if (laneIndex === null) cancelSelection('스테이션 밖에 놓았습니다. 다시 골라 주세요.');
      else dropSelected(laneIndex);
    } else if (state.timeoutPending) {
      cancelSelection('시간이 끝났어요.');
    }
  }

  document.addEventListener('pointerup', function (event) { releasePointer(event, false); });
  document.addEventListener('pointercancel', function (event) { releasePointer(event, true); });

  el.batches.addEventListener('keydown', function (event) {
    var button = event.target.closest('.batch');
    if (!button) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectBatch(button.dataset.batch, true);
      var lane = el.lanes.querySelector('[data-lane="' + state.keyboardLane + '"]');
      if (lane) lane.focus();
    }
  });

  el.lanes.addEventListener('click', function (event) {
    var lane = event.target.closest('.lane');
    if (!lane || !state.selectedId) return;
    dropSelected(Number(lane.dataset.lane));
  });

  document.addEventListener('keydown', function (event) {
    if (!state || !state.selectedId || state.phase === 'RESULT') return;
    if (/^[1-6]$/.test(event.key)) {
      event.preventDefault();
      dropSelected(Number(event.key) - 1);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelSelection('선택을 취소했습니다.');
      return;
    }
    var deltas = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
    if (Object.prototype.hasOwnProperty.call(deltas, event.key)) {
      event.preventDefault();
      var current = state.keyboardLane === null ? 0 : state.keyboardLane;
      var next = current + deltas[event.key];
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        var rowStart = Math.floor(current / 3) * 3;
        next = rowStart + ((next - rowStart + 3) % 3);
      } else {
        next = (next + 6) % 6;
      }
      state.keyboardLane = next;
      highlightLane(next);
      var lane = el.lanes.querySelector('[data-lane="' + next + '"]');
      if (lane) lane.focus();
    }
  });

  el.sound.addEventListener('click', function () {
    state.muted = !state.muted;
    saveMuted(state.muted);
    el.sound.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
    el.sound.querySelector('.sound-label').textContent = state.muted ? '꺼짐' : '소리';
    if (!state.muted) { initAudio(); playTone('pick'); }
    announceLive(state.muted ? '효과음 꺼짐' : '효과음 켜짐');
  });

  el.replay.addEventListener('click', function () { newRound(); });
  el.more.addEventListener('click', function () {
    if (document.referrer && window.history.length > 1) window.history.back();
    else window.location.href = '../../index.html';
  });

  document.addEventListener('visibilitychange', function () {
    if (!state) return;
    if (document.hidden && state.phase === 'PLAYING') {
      state.phase = 'PAUSED';
      state.pausedAt = performance.now();
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (!document.hidden && state.phase === 'PAUSED') {
      var pauseDuration = performance.now() - state.pausedAt;
      state.endAt += pauseDuration;
      state.phase = 'PLAYING';
      ensureAnimation();
      announceLive('게임 재개, 남은 시간 ' + Math.ceil(state.remainingSeconds) + '초');
    }
  });

  window.addEventListener('resize', function () {
    if (state) drawCanvas(performance.now());
  });

  function runInvariantTests() {
    var failures = [];
    RECIPES.forEach(function (recipe, recipeIndex) {
      var mask = recipe.mask();
      var unique = new Set(mask.map(function (cell) { return key(cell.x, cell.y); }));
      if (mask.length !== 108) failures.push(recipe.id + ': 셀 수 ' + mask.length);
      if (unique.size !== mask.length) failures.push(recipe.id + ': 중복 셀');
      mask.forEach(function (cell) {
        if (cell.x < 0 || cell.x >= 16 || cell.y < 0 || cell.y >= 16) failures.push(recipe.id + ': 범위 밖 셀');
      });
      var cells = colorizeMask(mask, recipe.id);
      var counts = PALETTE.map(function (palette) {
        return cells.filter(function (cell) { return cell.colorId === palette.id; }).length;
      });
      if (counts.join(',') !== COLOR_TARGETS.join(',')) failures.push(recipe.id + ': 색상 수 ' + counts.join(','));
      var batches = createBatches(cells, makeRng(100 + recipeIndex));
      if (batches.length !== CONFIG.TOTAL_BATCHES) failures.push(recipe.id + ': 배치 수 ' + batches.length);
      var batchedCells = [];
      batches.forEach(function (batch) {
        if (batch.cells.length < 6 || batch.cells.length > 8) failures.push(recipe.id + ': 배치 크기 ' + batch.cells.length);
        batch.cells.forEach(function (cell) {
          batchedCells.push(cell.index);
          if (cell.colorId !== batch.colorId) failures.push(recipe.id + ': 색 혼합 배치');
        });
      });
      if (new Set(batchedCells).size !== cells.length || batchedCells.length !== cells.length) failures.push(recipe.id + ': 배치 셀 누락/중복');
    });
    console.assert(failures.length === 0, 'Pixel Pour invariant tests failed:', failures);
    if (!failures.length) console.info('Pixel Pour tests: 2 recipes / 216 cells / 30 batches passed.');
    return failures;
  }

  if (!ctx) {
    setFeedback('이 브라우저에서는 Canvas를 사용할 수 없습니다.', 'bad');
    return;
  }

  newRound();
  try {
    if (/[?&]test=1(?:&|$)/.test(window.location.search)) runInvariantTests();
  } catch (error) {
    console.error('Pixel Pour test runner error', error);
  }
}());
