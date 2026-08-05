/* 퍼펙트 슬라이스 — 독립 실행 게임 로직.
 * 외부 의존성·네트워크 요청 없음. 정규화 좌표(0..1)가 단일 진실 공급원이다. */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ config */

  var CONFIG = {
    TOTAL_CUTS: 5,          // 5회 절단 → 6조각
    MIN_GAP: 0.045,         // 기존 경계에서 이 거리 미만이면 무효
    ROUND_MS: 25000,
    CUT_ANIM_MS: 280,
    CUT_ANIM_MS_REDUCED: 80,
    SUCCESS_SCORE: 65,
    DEV_TOLERANCE: 0.60,    // 정규화 표준편차가 이 값이면 0점
    KEY_STEP: 0.015,
    KEY_STEP_BIG: 0.05,
    VB_W: 600,              // SVG viewBox 폭 = 오이 전체 길이
    VB_H: 190,
    SEP_PLAY: 4,            // 조각 간 기본 이격(user unit)
    SEP_JUDGE: 10,          // 판정 시 이격
    NUDGE: 6,
    BEST_KEY: 'perfect-slice-best-v1'
  };

  var GRADES = [
    { min: 90, label: '완벽한 칼질', desc: '조각 두께가 거의 완벽하게 맞았습니다.' },
    { min: 80, label: '셰프급', desc: '주방에서 바로 쓸 수 있는 칼질입니다.' },
    { min: 65, label: '좋아요', desc: '균등하게 잘 나눴습니다. 조금만 더 다듬어 보세요.' },
    { min: 0, label: '한 번 더', desc: '조각 두께 편차가 큽니다. 가이드 간격을 노려 보세요.' }
  ];

  /* --------------------------------------------------------------------- dom */

  var $ = function (id) { return document.getElementById(id); };

  var dom = {
    shell: $('shell'),
    timer: $('timer'),
    timerRing: $('timerRing'),
    timerNum: $('timerNum'),
    timerText: $('timerText'),
    cutsNum: $('cutsNum'),
    cutsLabel: $('cutsLabel'),
    muteBtn: $('muteBtn'),
    board: document.querySelector('.board'),
    cukeWrap: $('cukeWrap'),
    cukeSvg: $('cukeSvg'),
    pieces: $('pieces'),
    particles: $('particles'),
    guides: $('guides'),
    aim: $('aim'),
    knife: $('knife'),
    sticker: $('sticker'),
    stickerCap: $('stickerCap'),
    hint: $('hint'),
    scoreValue: $('scoreValue'),
    primaryBtn: $('primaryBtn'),
    result: $('result'),
    resultGrade: $('resultGrade'),
    resultTitle: $('resultTitle'),
    resultScore: $('resultScore'),
    resultDesc: $('resultDesc'),
    bestScore: $('bestScore'),
    retryBtn: $('retryBtn'),
    live: $('live')
  };

  var RING_C = 2 * Math.PI * 16;
  dom.timerRing.style.strokeDasharray = RING_C.toFixed(2);

  var reduceMotionQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  function reducedMotion() { return !!reduceMotionQuery.matches; }

  /* ------------------------------------------------------------------- state */

  var state = {
    phase: 'intro',          // intro | playing | cutting | result
    cuts: [],
    knifeX: 0.5,
    timeRemainingMs: CONFIG.ROUND_MS,
    deadline: 0,
    result: null,
    inputMode: 'pointer',
    muted: true,
    roundId: 0,
    finished: false,
    activePointer: null,
    announcedAt: {}
  };

  var rafId = 0;
  var cutTimer = 0;
  var nudgeTimer = 0;
  var countUpRaf = 0;
  var best = readBest();

  /* ---------------------------------------------------------- pure game math */

  function boundaries(cuts) { return [0].concat(cuts, [1]); }

  function deriveSegments(cuts) {
    var b = boundaries(cuts);
    var out = [];
    for (var i = 0; i < b.length - 1; i++) out.push({ start: b[i], end: b[i + 1], width: b[i + 1] - b[i] });
    return out;
  }

  function calculateScore(cuts) {
    var segs = deriveSegments(cuts);
    var n = segs.length;
    if (n < 2) return 0;
    var mu = 1 / n;
    var sum = 0;
    for (var i = 0; i < n; i++) sum += Math.pow(segs[i].width - mu, 2);
    var d = Math.sqrt(sum / n) / mu;
    var raw = 1 - d / CONFIG.DEV_TOLERANCE;
    return Math.round(100 * Math.min(1, Math.max(0, raw)));
  }

  function isValidCut(x, cuts) {
    if (!(x > 0 && x < 1)) return false;
    var b = boundaries(cuts);
    for (var i = 0; i < b.length; i++) {
      if (Math.abs(x - b[i]) < CONFIG.MIN_GAP) return false;
    }
    return true;
  }

  function gradeFor(score) {
    for (var i = 0; i < GRADES.length; i++) {
      if (score >= GRADES[i].min) return GRADES[i];
    }
    return GRADES[GRADES.length - 1];
  }

  /* ---------------------------------------------------------------- storage */

  function readBest() {
    try {
      var v = window.sessionStorage.getItem(CONFIG.BEST_KEY);
      var n = parseInt(v, 10);
      return isFinite(n) && n >= 0 && n <= 100 ? n : 0;
    } catch (e) { return 0; }
  }

  function writeBest(v) {
    best = v;
    try { window.sessionStorage.setItem(CONFIG.BEST_KEY, String(v)); } catch (e) { /* file:// 등 */ }
  }

  /* ------------------------------------------------------------------ render */

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var XLINK_NS = 'http://www.w3.org/1999/xlink';

  function el(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) node.setAttribute(k, attrs[k]);
    return node;
  }

  var clipSeq = 0;

  function renderPieces(spread) {
    var segs = deriveSegments(state.cuts);
    var n = segs.length;
    var sep = typeof spread === 'number' ? spread : CONFIG.SEP_PLAY;
    clipSeq++;

    var frag = document.createDocumentFragment();
    var defs = el('defs', {});
    frag.appendChild(defs);

    for (var i = 0; i < n; i++) {
      var s = segs[i];
      var x0 = s.start * CONFIG.VB_W;
      var w = s.width * CONFIG.VB_W;
      var clipId = 'psClip-' + clipSeq + '-' + i;

      var clip = el('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
      clip.appendChild(el('rect', { x: x0, y: 0, width: w, height: CONFIG.VB_H }));
      defs.appendChild(clip);

      var g = el('g', { class: 'piece' });
      g.dataset.index = String(i);

      var inner = el('g', { 'clip-path': 'url(#' + clipId + ')' });
      var use = el('use', {});
      use.setAttribute('href', '#psCukeArt');
      use.setAttributeNS(XLINK_NS, 'xlink:href', '#psCukeArt');
      inner.appendChild(use);
      g.appendChild(inner);

      if (i > 0) g.appendChild(el('rect', { class: 'cut-face', x: x0, y: 28, width: 5, height: 132, rx: 2.5 }));
      if (i < n - 1) g.appendChild(el('rect', { class: 'cut-face', x: x0 + w - 5, y: 28, width: 5, height: 132, rx: 2.5 }));

      g.style.transform = 'translate(' + ((i - (n - 1) / 2) * sep).toFixed(2) + 'px, 0px)';
      frag.appendChild(g);
    }

    dom.pieces.textContent = '';
    dom.pieces.appendChild(frag);
    dom.pieces.__sep = sep;
  }

  function pieceTransform(i, n, sep, extraX, rotDeg) {
    var base = (i - (n - 1) / 2) * sep + (extraX || 0);
    return 'translate(' + base.toFixed(2) + 'px, 0px) rotate(' + (rotDeg || 0).toFixed(2) + 'deg)';
  }

  function nudgeAround(cutIndex) {
    if (reducedMotion()) return;
    var groups = dom.pieces.querySelectorAll('.piece');
    var n = groups.length;
    var sep = dom.pieces.__sep || CONFIG.SEP_PLAY;
    var left = cutIndex;
    var right = cutIndex + 1;

    if (groups[left]) groups[left].style.transform = pieceTransform(left, n, sep, -CONFIG.NUDGE, -1.5);
    if (groups[right]) groups[right].style.transform = pieceTransform(right, n, sep, CONFIG.NUDGE, 1.5);

    clearTimeout(nudgeTimer);
    var id = state.roundId;
    nudgeTimer = setTimeout(function () {
      if (state.roundId !== id) return;
      if (groups[left]) groups[left].style.transform = pieceTransform(left, n, sep, 0, 0);
      if (groups[right]) groups[right].style.transform = pieceTransform(right, n, sep, 0, 0);
    }, 130);
  }

  function spreadPieces() {
    var groups = dom.pieces.querySelectorAll('.piece');
    var n = groups.length;
    for (var i = 0; i < n; i++) {
      groups[i].style.transform = pieceTransform(i, n, CONFIG.SEP_JUDGE, 0, 0);
    }
    dom.pieces.__sep = CONFIG.SEP_JUDGE;
  }

  function renderGuides() {
    dom.guides.textContent = '';
    for (var i = 1; i < CONFIG.TOTAL_CUTS + 1; i++) {
      var d = document.createElement('div');
      d.className = 'guide';
      d.style.left = (100 * i / (CONFIG.TOTAL_CUTS + 1)) + '%';
      dom.guides.appendChild(d);
    }
  }

  function renderKnife() {
    var pct = state.knifeX * 100;
    dom.knife.style.left = pct + '%';
    dom.aim.style.left = pct + '%';
    dom.knife.setAttribute('aria-valuenow', String(Math.round(pct)));
    dom.knife.setAttribute('aria-valuetext',
      Math.round(pct) + '퍼센트 지점, 남은 칼질 ' + (CONFIG.TOTAL_CUTS - state.cuts.length) + '회');
  }

  function renderHud() {
    var remain = CONFIG.TOTAL_CUTS - state.cuts.length;
    dom.cutsNum.textContent = String(remain);
    dom.cutsLabel.setAttribute('aria-label', '남은 칼질 ' + remain + '회');
  }

  function renderTimer() {
    var ms = Math.max(0, state.timeRemainingMs);
    var secs = Math.ceil(ms / 1000);
    dom.timerNum.textContent = String(secs);
    dom.timerText.textContent = '남은 시간 ' + secs + '초';
    var ratio = ms / CONFIG.ROUND_MS;
    dom.timerRing.style.strokeDashoffset = (RING_C * (1 - ratio)).toFixed(2);
    dom.timer.dataset.level = secs <= 5 ? 'crit' : (secs <= 10 ? 'warn' : 'ok');
  }

  function setPhase(p) {
    state.phase = p;
    dom.shell.dataset.phase = p;
  }

  function setHint(text, tone) {
    dom.hint.textContent = text;
    if (tone) dom.hint.dataset.tone = tone; else dom.hint.removeAttribute('data-tone');
  }

  function announce(text) { dom.live.textContent = text; }

  /* --------------------------------------------------------------- particles */

  var POOL_SIZE = 10;
  var pool = [];

  function buildPool() {
    for (var i = 0; i < POOL_SIZE; i++) {
      var c = el('circle', { class: 'particle', cx: 0, cy: 0, r: 4 });
      dom.particles.appendChild(c);
      pool.push(c);
    }
  }

  function burst(x01) {
    if (reducedMotion() || typeof pool[0].animate !== 'function') return;
    var cx = x01 * CONFIG.VB_W;
    for (var i = 0; i < 6; i++) {
      var p = pool[i];
      var dx = (Math.random() * 2 - 1) * 46;
      var dy = -(24 + Math.random() * 46);
      var r = 2.5 + Math.random() * 3;
      p.setAttribute('cx', cx.toFixed(1));
      p.setAttribute('cy', '94');
      p.setAttribute('r', r.toFixed(1));
      p.animate(
        [
          { transform: 'translate(0px, 0px)', opacity: 0.95 },
          { transform: 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px)', opacity: 0 }
        ],
        { duration: 380 + Math.random() * 160, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'none' }
      );
    }
  }

  /* ------------------------------------------------------------------- audio */

  var audio = { ctx: null };

  function ensureAudio() {
    if (audio.ctx) return audio.ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { audio.ctx = new AC(); } catch (e) { audio.ctx = null; }
    return audio.ctx;
  }

  function playCut() {
    if (state.muted) return;
    var ctx = ensureAudio();
    if (!ctx) return;
    var dur = 0.12;
    var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.5);
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 1.1;
    var gain = ctx.createGain();
    gain.gain.value = 0.28;
    src.connect(bp).connect(gain).connect(ctx.destination);
    src.start();
  }

  function playTone(freq, at, dur, vol) {
    var ctx = audio.ctx;
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
    g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(ctx.currentTime + at);
    osc.stop(ctx.currentTime + at + dur + 0.02);
  }

  function playOutcome(success) {
    if (state.muted) return;
    if (!ensureAudio()) return;
    if (success) { playTone(660, 0, 0.16, 0.22); playTone(990, 0.14, 0.24, 0.2); }
    else { playTone(200, 0, 0.3, 0.2); }
  }

  /* ----------------------------------------------------------------- rounds */

  function clearRoundTimers() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (countUpRaf) { cancelAnimationFrame(countUpRaf); countUpRaf = 0; }
    clearTimeout(cutTimer);
    clearTimeout(nudgeTimer);
  }

  function resetRound(startImmediately) {
    state.roundId++;
    clearRoundTimers();

    state.cuts = [];
    state.knifeX = 0.5;
    state.timeRemainingMs = CONFIG.ROUND_MS;
    state.result = null;
    state.finished = false;
    state.activePointer = null;
    state.announcedAt = {};

    dom.result.hidden = true;
    dom.result.removeAttribute('data-success');
    dom.scoreValue.textContent = '—';
    dom.sticker.dataset.state = 'idle';
    dom.stickerCap.textContent = '심사';
    dom.knife.removeAttribute('data-chop');
    dom.knife.removeAttribute('data-invalid');
    dom.knife.removeAttribute('data-touch');

    renderPieces(CONFIG.SEP_PLAY);
    renderKnife();
    renderHud();
    renderTimer();

    if (startImmediately) startRound();
    else {
      setPhase('intro');
      dom.primaryBtn.textContent = '시작';
      dom.primaryBtn.hidden = false;
      setHint('5번 잘라 6조각을 똑같이 만들어 보세요.');
      announce('준비되었습니다. 시작 버튼을 누르세요.');
    }
  }

  function startRound() {
    setPhase('playing');
    dom.primaryBtn.textContent = '다시 시작';
    dom.primaryBtn.hidden = false;
    setHint(state.inputMode === 'keyboard'
      ? '방향키로 옮기고 스페이스로 자르세요.'
      : '칼을 좌우로 끌었다 놓으면 잘립니다.');
    state.deadline = performance.now() + CONFIG.ROUND_MS;
    state.timeRemainingMs = CONFIG.ROUND_MS;
    renderTimer();
    announce('시작. 25초 안에 5번 자르세요.');
    tickStart();
  }

  function tickStart() {
    var id = state.roundId;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function loop(now) {
      if (state.roundId !== id) return;
      state.timeRemainingMs = state.deadline - now;
      renderTimer();

      var secs = Math.ceil(Math.max(0, state.timeRemainingMs) / 1000);
      if ((secs === 10 || secs === 5) && !state.announcedAt[secs]) {
        state.announcedAt[secs] = true;
        announce(secs + '초 남았습니다.');
      }

      if (state.timeRemainingMs <= 0) {
        state.timeRemainingMs = 0;
        renderTimer();
        finishRound('time');
        return;
      }
      rafId = requestAnimationFrame(loop);
    });
  }

  function commitCut(x) {
    if (state.phase !== 'playing' || state.finished) return;

    if (!isValidCut(x, state.cuts)) {
      setHint('조금 더 안쪽으로 — 기존 절단선과 너무 가깝습니다.', 'bad');
      announce('무효 절단입니다. 남은 칼질은 그대로입니다.');
      dom.knife.setAttribute('data-invalid', 'true');
      setTimeout(function () { dom.knife.removeAttribute('data-invalid'); }, 260);
      return;
    }

    setPhase('cutting');
    state.cuts.push(x);
    state.cuts.sort(function (a, b) { return a - b; });
    var cutIndex = state.cuts.indexOf(x);

    // 마지막 칼질이 들어온 순간 타이머를 멈춘다.
    // (절단 연출 280ms 동안 시간이 0이 되어 완주가 시간 종료로 뒤집히는 경쟁 조건 차단)
    if (state.cuts.length >= CONFIG.TOTAL_CUTS && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    renderPieces(CONFIG.SEP_PLAY);
    nudgeAround(cutIndex);
    burst(x);
    playCut();
    renderHud();
    renderKnife();

    dom.knife.setAttribute('data-chop', 'true');
    var remain = CONFIG.TOTAL_CUTS - state.cuts.length;
    setHint(remain > 0 ? '좋아요. 남은 칼질 ' + remain + '회.' : '마지막 칼질! 결과를 확인하세요.');
    announce('절단 성공. 남은 칼질 ' + remain + '회.');

    var id = state.roundId;
    var wait = reducedMotion() ? CONFIG.CUT_ANIM_MS_REDUCED : CONFIG.CUT_ANIM_MS;
    clearTimeout(cutTimer);
    cutTimer = setTimeout(function () {
      if (state.roundId !== id || state.finished) return;
      dom.knife.removeAttribute('data-chop');
      if (state.cuts.length >= CONFIG.TOTAL_CUTS) finishRound('done');
      else setPhase('playing');
    }, wait);
  }

  function countUp(target) {
    if (reducedMotion()) { dom.resultScore.textContent = String(target); dom.scoreValue.textContent = target + '점'; return; }
    var id = state.roundId;
    var start = performance.now();
    var dur = 500;
    if (countUpRaf) cancelAnimationFrame(countUpRaf);
    countUpRaf = requestAnimationFrame(function step(now) {
      if (state.roundId !== id) return;
      var t = Math.min(1, (now - start) / dur);
      var v = Math.round(target * (1 - Math.pow(1 - t, 3)));
      dom.resultScore.textContent = String(v);
      dom.scoreValue.textContent = v + '점';
      if (t < 1) countUpRaf = requestAnimationFrame(step);
    });
  }

  function finishRound(reason) {
    if (state.finished) return;
    state.finished = true;
    clearRoundTimers();
    setPhase('result');
    dom.knife.removeAttribute('data-chop');
    dom.knife.removeAttribute('data-touch');
    dom.primaryBtn.hidden = true;

    var score = calculateScore(state.cuts);
    var success = reason === 'done' && score >= CONFIG.SUCCESS_SCORE;
    var grade = gradeFor(score);
    var pieces = state.cuts.length + 1;

    state.result = { score: score, grade: grade.label, success: success, reason: reason };
    spreadPieces();

    dom.result.dataset.success = success ? 'true' : 'false';
    dom.sticker.dataset.state = success ? 'good' : 'bad';
    dom.stickerCap.textContent = success ? '합격' : '재도전';

    if (reason === 'time') {
      dom.resultGrade.textContent = '시간 종료';
      dom.resultTitle.textContent = '시간이 다 됐어요';
      dom.resultDesc.textContent = '6조각 중 ' + pieces + '조각까지 나눴습니다. 남은 칼질 '
        + (CONFIG.TOTAL_CUTS - state.cuts.length) + '회를 채우지 못했습니다.';
      setHint('시간이 다 됐어요. 다시 자르기를 눌러 재도전하세요.', 'bad');
    } else {
      dom.resultGrade.textContent = grade.label;
      dom.resultTitle.textContent = success ? '성공!' : '재도전';
      dom.resultDesc.textContent = grade.desc;
      setHint(success ? '성공! 균등하게 잘 나눴습니다.' : '아쉽네요. 다시 도전해 보세요.', success ? null : 'bad');
    }

    if (score > best) writeBest(score);
    dom.bestScore.textContent = String(best);

    dom.resultScore.textContent = '0';
    dom.result.hidden = false;
    countUp(score);
    playOutcome(success);

    announce((reason === 'time' ? '시간 종료. ' : '') + '정확도 ' + score + '점, '
      + (reason === 'time' ? '실패' : grade.label) + '. 최고 점수 ' + best + '점.');

    dom.retryBtn.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------ input */

  function xFromClient(clientX) {
    var rect = dom.cukeWrap.getBoundingClientRect();
    if (rect.width <= 0) return state.knifeX;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  function setKnife(x) {
    state.knifeX = Math.min(1, Math.max(0, x));
    renderKnife();
  }

  dom.board.addEventListener('pointerdown', function (e) {
    if (state.phase !== 'playing') return;
    if (state.activePointer !== null) return;      // 첫 포인터만 인정
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    state.activePointer = e.pointerId;
    state.inputMode = 'pointer';
    if (e.pointerType === 'touch') dom.knife.setAttribute('data-touch', 'true');
    try { dom.board.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    setKnife(xFromClient(e.clientX));
    e.preventDefault();
  });

  dom.board.addEventListener('pointermove', function (e) {
    if (state.activePointer !== e.pointerId) return;
    setKnife(xFromClient(e.clientX));
    e.preventDefault();
  });

  dom.board.addEventListener('pointerup', function (e) {
    if (state.activePointer !== e.pointerId) return;
    state.activePointer = null;
    dom.knife.removeAttribute('data-touch');
    try { dom.board.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    setKnife(xFromClient(e.clientX));
    commitCut(state.knifeX);
    e.preventDefault();
  });

  function cancelPointer(e) {
    if (state.activePointer !== e.pointerId) return;
    state.activePointer = null;
    dom.knife.removeAttribute('data-touch');
  }

  dom.board.addEventListener('pointercancel', cancelPointer);
  dom.board.addEventListener('lostpointercapture', function (e) {
    if (state.activePointer === e.pointerId) state.activePointer = null;
  });

  window.addEventListener('blur', function () {
    state.activePointer = null;
    dom.knife.removeAttribute('data-touch');
  });

  dom.knife.addEventListener('keydown', function (e) {
    var step = e.shiftKey ? CONFIG.KEY_STEP_BIG : CONFIG.KEY_STEP;
    var handled = true;
    switch (e.key) {
      case 'ArrowLeft': case 'Left': setKnife(state.knifeX - step); break;
      case 'ArrowRight': case 'Right': setKnife(state.knifeX + step); break;
      case 'Home': setKnife(0); break;
      case 'End': setKnife(1); break;
      case ' ': case 'Spacebar': case 'Enter':
        if (state.phase === 'intro') startRound();
        else commitCut(state.knifeX);
        break;
      default: handled = false;
    }
    if (handled) {
      state.inputMode = 'keyboard';
      e.preventDefault();
    }
  });

  dom.primaryBtn.addEventListener('click', function () {
    if (state.phase === 'intro') startRound();
    else resetRound(true);
  });

  dom.retryBtn.addEventListener('click', function () {
    resetRound(true);
    dom.knife.focus({ preventScroll: true });
  });

  dom.muteBtn.addEventListener('click', function () {
    state.muted = !state.muted;
    dom.muteBtn.setAttribute('aria-pressed', state.muted ? 'false' : 'true');
    dom.muteBtn.textContent = state.muted ? '소리 켜기' : '소리 끄기';
    if (!state.muted) {
      var ctx = ensureAudio();
      if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume();
      playTone(880, 0, 0.1, 0.15);
    }
    announce(state.muted ? '소리가 꺼졌습니다.' : '소리가 켜졌습니다.');
  });

  /* -------------------------------------------------------------------- boot */

  buildPool();
  renderGuides();
  dom.bestScore.textContent = String(best);
  resetRound(false);

  // 디버그/검증용 순수 함수 노출 (DOM 비의존)
  window.PerfectSlice = {
    calculateScore: calculateScore,
    deriveSegments: deriveSegments,
    isValidCut: isValidCut,
    gradeFor: gradeFor,
    CONFIG: CONFIG
  };
})();
