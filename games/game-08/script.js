(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const els = {
    app: $("#app"),
    timeStat: $("#time-stat"),
    time: $("#time-value"),
    score: $("#score-value"),
    progress: $("#progress-value"),
    mute: $("#mute-button"),
    courseKicker: $("#course-kicker"),
    courseName: $("#course-name"),
    plateWrap: $("#plate-wrap"),
    plateMark: $("#plate-mark"),
    platedItems: $("#plated-items"),
    servedDots: $("#served-dots"),
    nextCard: $("#next-card"),
    nextIcon: $("#next-icon"),
    nextName: $("#next-name"),
    needs: $("#needs-list"),
    combo: $("#combo-badge"),
    messageBar: $("#message-bar"),
    statusMessage: $("#status-message"),
    resume: $("#resume-button"),
    board: $("#ingredient-board"),
    hint: $("#hint-button"),
    hintState: $("#hint-state"),
    startScreen: $("#start-screen"),
    startButton: $("#start-button"),
    comfort: $("#comfort-mode"),
    resultScreen: $("#result-screen"),
    resultCard: $("#result-screen .result-card"),
    resultKicker: $("#result-kicker"),
    resultTitle: $("#result-title"),
    resultCopy: $("#result-copy"),
    resultPlates: $("#result-plates"),
    resultScore: $("#result-score"),
    resultTime: $("#result-time"),
    resultProgress: $("#result-progress"),
    resultMisses: $("#result-misses"),
    replay: $("#replay-button"),
    announcer: $("#announcer"),
    testBadge: $("#test-badge"),
  };

  const INGREDIENTS = {
    bacon: { name: "베이컨", color: "#f06e62" },
    butter: { name: "버터", color: "#ffd55f" },
    cream: { name: "생크림", color: "#f7efe5" },
    coffee: { name: "커피", color: "#8a4b35" },
    cookie: { name: "초코쿠키", color: "#a05b3a" },
    teabag: { name: "티백", color: "#89bc72" },
    popcorn: { name: "팝콘", color: "#ffe68e" },
    cupcake: { name: "컵케이크", color: "#f28a91" },
    steak: { name: "스테이크", color: "#d9514e" },
    spinach: { name: "시금치", color: "#5ca75e" },
    patty: { name: "패티", color: "#8a5237" },
    tea: { name: "홍차", color: "#cf734b" },
    yogurt: { name: "요거트", color: "#82b9df" },
    takeaway: { name: "테이크아웃 컵", color: "#e8ac62" },
  };

  const RECIPE_TEMPLATES = [
    {
      id: "brunch",
      name: "베이컨 브런치",
      kicker: "오늘의 첫 접시",
      hero: "bacon",
      need: { bacon: 2, butter: 2, cream: 1 },
    },
    {
      id: "cafe",
      name: "카페 세트",
      kicker: "향긋한 두 번째",
      hero: "coffee",
      need: { coffee: 2, cookie: 2, teabag: 1 },
    },
    {
      id: "movie",
      name: "팝콘 박스",
      kicker: "바삭한 세 번째",
      hero: "popcorn",
      need: { popcorn: 3, cupcake: 2 },
    },
    {
      id: "dinner",
      name: "스테이크 플레이트",
      kicker: "마지막 메인 요리",
      hero: "steak",
      need: { steak: 2, spinach: 2, butter: 1 },
    },
  ];

  const ICON_PATHS = {
    bacon: `
      <path d="M11 18C17 12 19 11 28 13s12 0 18-5l7 10c-7 7-12 8-22 6s-12 0-18 5L7 41c8-6 13-7 23-4s15 1 22-5l6 10c-9 8-17 10-29 6S14 47 6 53L1 41c7-6 11-14 10-23Z" fill="#f26762" stroke="#913c3a" stroke-width="2.3"/>
      <path d="M13 22c8-7 13-6 21-4s12 0 17-5M9 42c8-6 14-6 23-3s13 2 20-3" fill="none" stroke="#ffd1bd" stroke-width="5" stroke-linecap="round"/>`,
    butter: `
      <path d="m10 24 26-13 19 10-27 14-18-11Z" fill="#fff3a4" stroke="#a56e2a" stroke-width="2"/>
      <path d="M10 24v22l18 9V35l-18-11Z" fill="#f6bf42" stroke="#a56e2a" stroke-width="2"/>
      <path d="m28 35 27-14v21L28 55V35Z" fill="#ffd95e" stroke="#a56e2a" stroke-width="2"/>
      <path d="m38 21 7 4" stroke="#fff8c7" stroke-width="3" stroke-linecap="round"/>`,
    cream: `
      <path d="M13 31h38l-4 23H17l-4-23Z" fill="#89bdd9" stroke="#315e72" stroke-width="2.2"/>
      <path d="M9 31h46c0 5-4 8-9 8H18c-5 0-9-3-9-8Z" fill="#d3eff6" stroke="#315e72" stroke-width="2.2"/>
      <path d="M20 30c-3-7 5-9 8-7-1-8 11-9 13-3 7-2 11 5 7 10H20Z" fill="#fffdf4" stroke="#b9a995" stroke-width="1.8"/>
      <path d="M27 24c4 1 9 0 12-3" fill="none" stroke="#dfcdb9" stroke-width="2" stroke-linecap="round"/>`,
    coffee: `
      <ellipse cx="30" cy="18" rx="20" ry="8" fill="#e8f2f0" stroke="#486b74" stroke-width="2"/>
      <path d="M10 18v25c0 8 39 8 40 0V18" fill="#dcebed" stroke="#486b74" stroke-width="2"/>
      <ellipse cx="30" cy="18" rx="16" ry="5.5" fill="#75402c"/>
      <path d="M50 25c14-3 15 16 1 17" fill="none" stroke="#486b74" stroke-width="5"/>
      <path d="M23 8c-5-5 4-6 0-11M36 8c-5-5 4-6 0-11" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2.5" stroke-linecap="round"/>`,
    cookie: `
      <path d="M51 19c-6 1-10-3-9-9-5 2-10 1-13-3C17 7 7 17 7 30c0 14 11 25 25 25 13 0 23-10 24-23-5 0-8-5-5-13Z" fill="#c57948" stroke="#784029" stroke-width="2.5"/>
      <g fill="#5b3326"><circle cx="21" cy="20" r="3"/><circle cx="35" cy="30" r="3.5"/><circle cx="20" cy="42" r="3"/><circle cx="44" cy="43" r="2.5"/></g>`,
    teabag: `
      <path d="M18 12h27l8 12-7 30H17L10 25l8-13Z" fill="#f4e5bc" stroke="#6b774d" stroke-width="2.2"/>
      <path d="M19 12 30 3l11 9" fill="none" stroke="#6b774d" stroke-width="2"/>
      <path d="M18 31c9-5 20-5 29 0v17H18V31Z" fill="#8dc273"/>
      <path d="M25 35c5-1 9 2 11 8-6 1-10-2-11-8Zm12-2c-1 5-4 8-8 9" fill="#dff2b8" stroke="#39714d" stroke-width="1.5"/>`,
    popcorn: `
      <path d="m13 22 38 0-5 34H19l-6-34Z" fill="#f25d55" stroke="#8c3b37" stroke-width="2.2"/>
      <path d="M22 23h8l2 32h-8l-2-32Zm17 0h7l-3 32h-8l4-32Z" fill="#fff3da"/>
      <g fill="#ffe688" stroke="#b37a32" stroke-width="1.4"><circle cx="18" cy="21" r="8"/><circle cx="29" cy="17" r="9"/><circle cx="42" cy="19" r="9"/><circle cx="51" cy="24" r="7"/><circle cx="34" cy="26" r="8"/><circle cx="21" cy="27" r="7"/></g>
      <g fill="#fff5be"><circle cx="28" cy="14" r="3"/><circle cx="42" cy="16" r="3"/><circle cx="18" cy="19" r="2.5"/></g>`,
    cupcake: `
      <path d="M13 30h38l-5 27H18l-5-27Z" fill="#75b9d4" stroke="#365d70" stroke-width="2.2"/>
      <path d="m19 34 3 20m8-20 1 21m10-21-3 20" stroke="#d9f1ef" stroke-width="3"/>
      <path d="M13 31c-4-8 4-13 10-10-1-8 11-11 16-4 7-4 15 2 13 10 5 0 7 8 1 10H16c-4 0-6-3-3-6Z" fill="#f6ddd2" stroke="#9b625e" stroke-width="2"/>
      <circle cx="33" cy="12" r="5" fill="#ef5e57" stroke="#9b3837" stroke-width="1.5"/>`,
    steak: `
      <path d="M7 34C8 20 23 6 38 8c12 2 21 13 19 26-3 16-19 24-34 21C13 53 6 45 7 34Z" fill="#d9504d" stroke="#85302f" stroke-width="2.5"/>
      <path d="M14 35c1-9 10-19 21-20 9-1 16 7 15 16-1 12-13 18-24 17-8-1-13-6-12-13Z" fill="#f5947b"/>
      <ellipse cx="34" cy="31" rx="10" ry="8" fill="#f8d3b1" stroke="#9b5546" stroke-width="2"/>
      <path d="m15 25 8 5m21 8 7 4" stroke="#7f302f" stroke-width="2"/>`,
    spinach: `
      <path d="M32 55c1-18 1-31 0-45" stroke="#366d40" stroke-width="3"/>
      <path d="M30 39C13 43 5 32 10 19c13-1 23 6 20 20Z" fill="#65ad62" stroke="#356d40" stroke-width="2"/>
      <path d="M34 31c17 2 24-10 18-21-12 1-20 9-18 21Z" fill="#7dc56f" stroke="#356d40" stroke-width="2"/>
      <path d="M31 49c-13 5-22-3-21-13 10-3 18 2 21 13Zm3-9c13 4 21-4 19-14-10-2-17 4-19 14Z" fill="#4d9758" stroke="#356d40" stroke-width="2"/>
      <path d="m15 24 15 12m18-20L35 28" stroke="#c8eaa3" stroke-width="1.5"/>`,
    patty: `
      <ellipse cx="32" cy="35" rx="26" ry="19" fill="#8d5137" stroke="#553426" stroke-width="2.5"/>
      <path d="M13 27c10-6 28-6 38 1M12 38c11 6 29 6 40-1" fill="none" stroke="#c18154" stroke-width="3" stroke-linecap="round"/>
      <path d="m21 18 4 7m14-8-3 7m-16 19 5-5m17 6-5-6" stroke="#5d3829" stroke-width="2"/>`,
    tea: `
      <path d="M11 22h39l-5 26c-2 9-27 9-29 0l-5-26Z" fill="#f5e8d0" stroke="#775641" stroke-width="2.2"/>
      <ellipse cx="30.5" cy="22" rx="19.5" ry="6" fill="#b96743" stroke="#775641" stroke-width="2"/>
      <path d="M50 27c13-2 13 16-1 16" fill="none" stroke="#775641" stroke-width="4"/>
      <path d="M18 54h31" stroke="#775641" stroke-width="3" stroke-linecap="round"/>
      <path d="M28 8c-4-4 3-6 0-10m10 10c-4-4 3-6 0-10" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2.2" stroke-linecap="round"/>`,
    yogurt: `
      <path d="M14 21h37l-4 35H19l-5-35Z" fill="#83bade" stroke="#3c6681" stroke-width="2.2"/>
      <path d="M10 18h45v8H10z" fill="#e9f5f6" stroke="#3c6681" stroke-width="2" rx="3"/>
      <path d="M22 34c6-5 14-5 21 0v13c-7 4-14 4-21 0V34Z" fill="#fff"/>
      <circle cx="33" cy="40" r="5" fill="#ef6766"/><path d="m33 35 3-4" stroke="#47764d" stroke-width="2"/>`,
    takeaway: `
      <path d="M16 17h34l-5 40H21l-5-40Z" fill="#e9aa5d" stroke="#805236" stroke-width="2.2"/>
      <path d="M13 13h40v8H13z" fill="#fff6dc" stroke="#805236" stroke-width="2" rx="2"/>
      <path d="m37 13 4-13" stroke="#6b8062" stroke-width="3"/>
      <path d="M20 31h27l-2 15H22l-2-15Z" fill="#f9e3ad"/>
      <path d="M27 38c4-4 8-4 13 0-4 5-9 5-13 0Z" fill="#7da266"/>`,
  };

  function iconSvg(type, extraClass = "") {
    const name = INGREDIENTS[type]?.name || "재료";
    return `<svg class="ingredient-icon ${extraClass}" viewBox="0 0 64 64" aria-hidden="true" focusable="false" data-icon="${type}"><title>${name}</title>${ICON_PATHS[type]}</svg>`;
  }

  function hashSeed(value) {
    const input = String(value ?? "dish-collect");
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0 || 1;
  }

  function mulberry32(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, random) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function cloneRecipes() {
    return RECIPE_TEMPLATES.map((recipe) => ({
      ...recipe,
      need: { ...recipe.need },
      original: { ...recipe.need },
      plated: [],
    }));
  }

  function createRound(seed, friendly = false) {
    const numericSeed = hashSeed(seed);
    const random = mulberry32(numericSeed);
    const recipes = cloneRecipes();
    const required = [];
    const requiredTotals = {};

    recipes.forEach((recipe, recipeIndex) => {
      Object.entries(recipe.need).forEach(([type, amount]) => {
        requiredTotals[type] = (requiredTotals[type] || 0) + amount;
        for (let i = 0; i < amount; i += 1) required.push({ type, recipeIndex, required: true });
      });
    });

    const distractors = [];
    const tileTotals = { ...requiredTotals };
    const types = Object.keys(INGREDIENTS);
    while (distractors.length < 16) {
      const candidates = types.filter((type) => (tileTotals[type] || 0) < (requiredTotals[type] || 0) + 2);
      const type = candidates[Math.floor(random() * candidates.length)];
      distractors.push({ type, recipeIndex: -1, required: false });
      tileTotals[type] = (tileTotals[type] || 0) + 1;
    }

    const firstRecipeTiles = shuffle(required.filter((item) => item.recipeIndex === 0), random);
    const remainingTiles = shuffle(required.filter((item) => item.recipeIndex !== 0).concat(distractors), random);
    const allPositions = Array.from({ length: 48 }, (_, index) => index);
    let placements;

    if (friendly) {
      const topPositions = shuffle(allPositions.filter((position) => position < 24), random).slice(0, 5);
      const openPositions = shuffle(allPositions.filter((position) => !topPositions.includes(position)), random).slice(0, 31);
      placements = firstRecipeTiles.map((item, index) => ({ ...item, position: topPositions[index] }))
        .concat(remainingTiles.map((item, index) => ({ ...item, position: openPositions[index] })));
    } else {
      const positions = shuffle(allPositions, random).slice(0, 36);
      placements = shuffle(required.concat(distractors), random)
        .map((item, index) => ({ ...item, position: positions[index] }));
    }

    const tiles = placements.map((item, index) => ({
      id: `tile-${numericSeed}-${index}`,
      type: item.type,
      col: item.position % 6,
      row: Math.floor(item.position / 6),
      position: item.position,
      status: "board",
      sourceRecipe: item.recipeIndex,
    }));

    return { seed: numericSeed, recipes, tiles, requiredTotals };
  }

  function classifyType(gameState, type) {
    const current = gameState.recipes[gameState.currentRecipe];
    if (!current) return "hard";
    if ((current.need[type] || 0) > 0) return "correct";
    if ((current.original[type] || 0) > 0) return "soft";
    const neededLater = gameState.recipes.slice(gameState.currentRecipe + 1)
      .some((recipe) => (recipe.need[type] || 0) > 0);
    return neededLater ? "soft" : "hard";
  }

  const params = new URLSearchParams(window.location.search);
  const requestedSeed = params.get("seed");
  const baseSeed = requestedSeed || `${Date.now()}-${Math.random()}`;

  let state;
  let timerId = 0;
  let actionToken = 0;
  let audioContext = null;
  let liveMessageTimer = 0;

  function freshState(seed, friendly) {
    const round = createRound(seed, friendly);
    return {
      phase: "ready",
      seed: round.seed,
      runCount: 0,
      recipes: round.recipes,
      tiles: round.tiles,
      currentRecipe: 0,
      completed: 0,
      remainingMs: 40000,
      elapsedMs: 0,
      lastTick: performance.now(),
      lastCollectAt: performance.now(),
      score: 0,
      combo: 0,
      hintPenalty: 0,
      hintUses: 0,
      hintTileId: null,
      introHint: true,
      missSoft: 0,
      missHard: 0,
      missCooldownTileId: null,
      missCooldownUntil: 0,
      message: "접시에 필요한 재료를 찾아 탭하세요.",
      messageTone: "neutral",
      muted: false,
      comfort: false,
      paused: false,
      ended: false,
      focusTileId: round.tiles.slice().sort((a, b) => a.position - b.position)[0]?.id || null,
      lastSecondShown: 40,
    };
  }

  state = freshState(baseSeed, true);

  function currentRecipe() {
    return state.recipes[state.currentRecipe];
  }

  function remainingForRecipe(recipe = currentRecipe()) {
    return recipe ? Object.values(recipe.need).reduce((sum, amount) => sum + amount, 0) : 0;
  }

  function displayedScore() {
    return Math.max(0, state.score - state.hintPenalty);
  }

  function isPlayingPhase() {
    return ["playing", "collecting", "serving"].includes(state.phase) && !state.ended;
  }

  function setMessage(message, tone = "neutral", announce = true) {
    state.message = message;
    state.messageTone = tone;
    els.statusMessage.textContent = message;
    els.messageBar.classList.toggle("is-good", tone === "good");
    els.messageBar.classList.toggle("is-miss", tone === "miss");
    if (announce) announceMessage(message);
  }

  function announceMessage(message) {
    window.clearTimeout(liveMessageTimer);
    els.announcer.textContent = "";
    liveMessageTimer = window.setTimeout(() => {
      els.announcer.textContent = message;
    }, 25);
  }

  function renderHeader() {
    const seconds = state.comfort ? "∞" : Math.max(0, Math.ceil(state.remainingMs / 1000));
    els.time.textContent = seconds;
    els.score.textContent = displayedScore().toLocaleString("ko-KR");
    els.progress.textContent = `${state.completed}/4`;
    els.timeStat.classList.toggle("is-warning", !state.comfort && state.remainingMs <= 10000 && isPlayingPhase());
    els.mute.setAttribute("aria-pressed", String(state.muted));
    els.mute.setAttribute("aria-label", state.muted ? "소리 켜기" : "소리 끄기");
  }

  function renderRecipe() {
    const recipe = currentRecipe();
    if (!recipe) return;
    els.courseKicker.textContent = recipe.kicker;
    els.courseName.textContent = recipe.name;
    els.combo.textContent = `COMBO ×${state.combo}`;
    els.combo.setAttribute("aria-label", `콤보 ${state.combo}`);
    els.combo.classList.toggle("is-hot", state.combo >= 3);
    els.plateMark.textContent = recipe.id.toUpperCase();

    els.needs.innerHTML = Object.entries(recipe.original).map(([type, originalAmount]) => {
      const amount = recipe.need[type] || 0;
      const complete = amount === 0;
      return `
        <li class="need${complete ? " is-complete" : ""}" aria-label="${INGREDIENTS[type].name} ${complete ? "완료" : `${amount}개 남음`}">
          <span class="need__icon">${iconSvg(type)}</span>
          <span class="need__text"><span>${INGREDIENTS[type].name}</span><strong>${complete ? "✓ 완료" : `${amount} / ${originalAmount}`}</strong></span>
        </li>`;
    }).join("");

    els.platedItems.innerHTML = recipe.plated.map((type) => `<span class="plated-item">${iconSvg(type)}</span>`).join("");
    els.plateMark.hidden = recipe.plated.length > 0;

    const nextRecipe = state.recipes[state.currentRecipe + 1];
    els.nextCard.hidden = !nextRecipe;
    if (nextRecipe) {
      els.nextName.textContent = nextRecipe.name;
      els.nextIcon.innerHTML = iconSvg(nextRecipe.hero);
      els.nextCard.setAttribute("aria-label", `다음 요리 ${nextRecipe.name}`);
    }

    els.servedDots.innerHTML = state.recipes.map((item, index) => (
      `<span class="served-dot${index < state.completed ? " is-done" : ""}" aria-hidden="true">${index < state.completed ? "✓" : index + 1}</span>`
    )).join("");
    els.servedDots.setAttribute("aria-label", `완성한 접시 ${state.completed}개`);
  }

  function tileAccessibilityLabel(tile) {
    const verdict = classifyType(state, tile.type);
    const status = verdict === "correct" ? "지금 필요함" : verdict === "soft" ? "지금은 기다리기" : "현재 주문에 없음";
    return `${INGREDIENTS[tile.type].name}, ${tile.row + 1}행 ${tile.col + 1}열, ${status}`;
  }

  function renderBoard(restoreFocus = false) {
    const hadBoardFocus = restoreFocus || els.board.contains(document.activeElement);
    const activeFocusId = document.activeElement?.dataset?.tileId || state.focusTileId;
    const tilesByPosition = new Map(state.tiles.filter((tile) => tile.status === "board").map((tile) => [tile.position, tile]));
    const introTypes = new Set(Object.entries(currentRecipe()?.need || {}).filter(([, count]) => count > 0).map(([type]) => type));
    let introCount = 0;

    els.board.innerHTML = Array.from({ length: 48 }, (_, position) => {
      const row = Math.floor(position / 6);
      const col = position % 6;
      const tile = tilesByPosition.get(position);
      if (!tile) return `<span class="board-cell" role="gridcell" aria-label="빈 칸, ${row + 1}행 ${col + 1}열"></span>`;
      const verdict = classifyType(state, tile.type);
      const intro = state.introHint && introTypes.has(tile.type) && introCount++ < 2;
      const classes = ["board-cell"];
      if (verdict === "correct") classes.push("is-needed");
      if (tile.id === state.hintTileId) classes.push("is-hinted");
      if (intro) classes.push("is-intro-hint");
      return `
        <button
          class="${classes.join(" ")}"
          type="button"
          role="gridcell"
          data-tile-id="${tile.id}"
          data-row="${tile.row}"
          data-col="${tile.col}"
          tabindex="${tile.id === activeFocusId || (!activeFocusId && tile.id === state.focusTileId) ? "0" : "-1"}"
          aria-label="${tileAccessibilityLabel(tile)}"
        >${iconSvg(tile.type)}</button>`;
    }).join("");

    const buttons = [...els.board.querySelectorAll("button[data-tile-id]")];
    if (!buttons.some((button) => button.tabIndex === 0) && buttons[0]) {
      buttons[0].tabIndex = 0;
      state.focusTileId = buttons[0].dataset.tileId;
    }
    if (hadBoardFocus) {
      const target = els.board.querySelector(`[data-tile-id="${state.focusTileId}"]`) || buttons[0];
      target?.focus({ preventScroll: true });
    }
  }

  function renderHint() {
    const waitingMs = Math.max(0, 6000 - (performance.now() - state.lastCollectAt));
    const available = state.phase === "playing" && !state.paused && waitingMs <= 0;
    els.hint.disabled = !available;
    els.hintState.textContent = available ? "필요한 타일 표시 · -75점" : `${Math.ceil(waitingMs / 1000)}초 뒤 사용 가능`;
  }

  function render(options = {}) {
    renderHeader();
    renderRecipe();
    setMessage(state.message, state.messageTone, false);
    els.resume.hidden = !state.paused;
    renderBoard(Boolean(options.restoreFocus));
    renderHint();
  }

  function ensureAudio() {
    if (audioContext) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    audioContext = new AudioCtor();
  }

  function sound(kind) {
    if (state.muted) return;
    ensureAudio();
    if (!audioContext) return;
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    const patterns = {
      collect: [[660, 0, 0.06], [880, 0.045, 0.08]],
      serve: [[523, 0, 0.08], [659, 0.08, 0.09], [784, 0.17, 0.14]],
      miss: [[180, 0, 0.11]],
      win: [[523, 0, 0.09], [659, 0.09, 0.09], [784, 0.18, 0.1], [1047, 0.29, 0.22]],
      lose: [[310, 0, 0.12], [246, 0.12, 0.2]],
      hint: [[880, 0, 0.08], [1175, 0.07, 0.12]],
    };
    const now = audioContext.currentTime;
    (patterns[kind] || []).forEach(([frequency, offset, duration]) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = kind === "miss" ? "square" : "sine";
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.11, now + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + duration + 0.02);
    });
  }

  function animateFlight(source, type) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !source) return;
    const activeTokens = document.querySelectorAll(".fly-token");
    if (activeTokens.length >= 12) activeTokens[0].remove();
    const from = source.getBoundingClientRect();
    const to = els.plateWrap.getBoundingClientRect();
    const token = document.createElement("div");
    token.className = "fly-token";
    token.innerHTML = iconSvg(type);
    token.style.left = `${from.left + from.width / 2 - 24}px`;
    token.style.top = `${from.top + from.height / 2 - 24}px`;
    document.body.appendChild(token);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const animation = token.animate([
      { opacity: 1, transform: "translate(0, 0) scale(0.82) rotate(0deg)" },
      { opacity: 1, offset: 0.45, transform: `translate(${dx * 0.45}px, ${dy * 0.3 - 35}px) scale(1.08) rotate(10deg)` },
      { opacity: 0.25, transform: `translate(${dx}px, ${dy}px) scale(0.45) rotate(24deg)` },
    ], { duration: 300, easing: "cubic-bezier(.2,.7,.25,1)" });
    animation.addEventListener("finish", () => token.remove(), { once: true });
  }

  function chooseNextFocus(collectedTile) {
    const remaining = state.tiles.filter((tile) => tile.status === "board" && tile.id !== collectedTile.id);
    if (!remaining.length) return null;
    const sameRow = remaining.filter((tile) => tile.row === collectedTile.row)
      .sort((a, b) => Math.abs(a.col - collectedTile.col) - Math.abs(b.col - collectedTile.col));
    const later = remaining.filter((tile) => tile.position > collectedTile.position).sort((a, b) => a.position - b.position);
    return (sameRow[0] || later[0] || remaining.sort((a, b) => a.position - b.position)[0]).id;
  }

  function addPenalty(ms) {
    if (state.comfort) return;
    state.remainingMs = Math.max(0, state.remainingMs - ms);
    els.timeStat.classList.remove("is-penalty");
    void els.timeStat.offsetWidth;
    els.timeStat.classList.add("is-penalty");
  }

  function collect(tileId, sourceElement = null) {
    if (state.phase !== "playing" || state.paused || state.ended) return;
    const tile = state.tiles.find((item) => item.id === tileId);
    if (!tile || tile.status !== "board") return;
    if (state.missCooldownTileId === tileId && performance.now() < state.missCooldownUntil) return;
    state.introHint = false;
    const verdict = classifyType(state, tile.type);

    if (verdict !== "correct") {
      state.combo = 0;
      state.missCooldownTileId = tile.id;
      state.missCooldownUntil = performance.now() + 250;
      if (verdict === "soft") {
        state.missSoft += 1;
        addPenalty(1000);
        setMessage(`${INGREDIENTS[tile.type].name}은 다음 요리에서 필요해요${state.comfort ? " — 그대로 두었어요." : " — 1초 감소!"}`, "miss");
      } else {
        state.missHard += 1;
        addPenalty(3000);
        setMessage(`${INGREDIENTS[tile.type].name}은 남은 주문에 없어요${state.comfort ? " — 타일은 유지돼요." : " — 3초 감소!"}`, "miss");
      }
      sound("miss");
      render({ restoreFocus: true });
      const refreshed = els.board.querySelector(`[data-tile-id="${tile.id}"]`);
      refreshed?.classList.add("is-miss");
      if (state.remainingMs <= 0 && !state.comfort) finishOnce("lost-time");
      return;
    }

    const token = ++actionToken;
    state.phase = "collecting";
    state.lastCollectAt = performance.now();
    state.combo += 1;
    const comboBonus = state.combo >= 3 ? Math.min(50, 10 * (state.combo - 2)) : 0;
    state.score += 20 + comboBonus;
    currentRecipe().need[tile.type] -= 1;
    currentRecipe().plated.push(tile.type);
    state.focusTileId = chooseNextFocus(tile);
    animateFlight(sourceElement, tile.type);
    sourceElement?.classList.add("is-collecting");
    sound("collect");
    setMessage(comboBonus ? `${INGREDIENTS[tile.type].name} 수집! 콤보 보너스 +${comboBonus}` : `${INGREDIENTS[tile.type].name}을 접시에 담았어요.`, "good");

    window.setTimeout(() => {
      if (token !== actionToken || state.ended) return;
      tile.status = "collected";
      const recipeDone = remainingForRecipe() === 0;
      if (!recipeDone) {
        state.phase = "playing";
        render({ restoreFocus: true });
        if (state.remainingMs <= 0 && !state.comfort) finishOnce("lost-time");
        return;
      }
      serveCurrentRecipe(token);
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 20 : 200);
  }

  function serveCurrentRecipe(token) {
    if (token !== actionToken || state.ended) return;
    state.phase = "serving";
    state.score += 100;
    state.completed += 1;
    setMessage(`${currentRecipe().name} 완성! 접시를 서빙합니다.`, "good");
    sound("serve");
    render();
    els.plateWrap.querySelector(".plate")?.animate([
      { transform: "scale(1) rotate(0)" },
      { transform: "scale(1.08) rotate(-2deg)" },
      { transform: "scale(1) rotate(0)" },
    ], { duration: 320, easing: "ease-out" });

    window.setTimeout(() => {
      if (token !== actionToken || state.ended) return;
      if (state.completed >= state.recipes.length) {
        finishOnce("won");
        return;
      }
      state.currentRecipe += 1;
      state.phase = "playing";
      state.lastCollectAt = performance.now();
      setMessage(`새 주문: ${currentRecipe().name}. 필요한 재료를 골라주세요.`, "neutral");
      render();
      announceMessage(`${state.completed}번째 접시 완성. 다음 요리는 ${currentRecipe().name}입니다.`);
      if (state.remainingMs <= 0 && !state.comfort) finishOnce("lost-time");
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 40 : 430);
  }

  function tick() {
    if (!isPlayingPhase() || state.paused) return;
    const now = performance.now();
    const delta = Math.min(250, Math.max(0, now - state.lastTick));
    state.lastTick = now;
    state.elapsedMs += delta;
    if (!state.comfort) state.remainingMs = Math.max(0, state.remainingMs - delta);

    const second = state.comfort ? Infinity : Math.ceil(state.remainingMs / 1000);
    if (second !== state.lastSecondShown) {
      state.lastSecondShown = second;
      renderHeader();
      if (second === 10 || second === 5) announceMessage(`${second}초 남았습니다.`);
    }
    renderHint();

    if (!state.comfort && state.remainingMs <= 0 && state.phase === "playing") finishOnce("lost-time");
  }

  function startTimer() {
    window.clearInterval(timerId);
    state.lastTick = performance.now();
    timerId = window.setInterval(tick, 100);
  }

  function startGame() {
    ensureAudio();
    state.comfort = els.comfort.checked;
    state.phase = "playing";
    state.lastTick = performance.now();
    state.lastCollectAt = performance.now();
    state.message = state.comfort
      ? "여유 모드: 시간 걱정 없이 필요한 재료를 골라보세요."
      : "접시에 필요한 재료를 찾아 탭하세요.";
    els.startScreen.hidden = true;
    render();
    startTimer();
    announceMessage(`${state.comfort ? "여유 모드로 " : ""}게임 시작. 첫 요리는 ${currentRecipe().name}입니다.`);
    window.setTimeout(() => els.board.querySelector("button[data-tile-id]")?.focus({ preventScroll: true }), 100);
  }

  function replayGame() {
    actionToken += 1;
    const nextRun = (state.runCount || 0) + 1;
    const muted = state.muted;
    const comfort = state.comfort;
    state = freshState(`${baseSeed}-replay-${nextRun}-${Date.now()}`, false);
    state.runCount = nextRun;
    state.muted = muted;
    state.comfort = comfort;
    state.phase = "playing";
    state.message = comfort
      ? "여유 모드 새 주문이에요. 천천히 골라보세요."
      : "새 보드가 준비됐어요. 첫 재료를 찾아보세요.";
    els.resultScreen.hidden = true;
    render();
    startTimer();
    announceMessage(`새 게임 시작. 첫 요리는 ${currentRecipe().name}입니다.`);
    window.setTimeout(() => els.board.querySelector("button[data-tile-id]")?.focus({ preventScroll: true }), 80);
  }

  function finishOnce(result) {
    if (state.ended) return false;
    state.ended = true;
    state.phase = result;
    actionToken += 1;
    window.clearInterval(timerId);
    if (result === "won" && !state.comfort) state.score += Math.floor(state.remainingMs / 1000) * 10;
    renderHeader();
    const won = result === "won";
    els.resultCard.classList.toggle("is-failed", !won);
    els.resultKicker.textContent = won ? "ORDER COMPLETE" : "KITCHEN CLOSED";
    els.resultTitle.textContent = won ? "네 접시 완성!" : "시간이 다 됐어요";
    els.resultCopy.textContent = won
      ? "하늘 주방의 오늘 주문을 모두 완성했어요."
      : `시간 안에 네 접시를 못 채웠어요. ${currentRecipe()?.name || "현재 요리"}부터 다시 도전해보세요.`;
    els.resultScore.textContent = displayedScore().toLocaleString("ko-KR");
    els.resultTime.textContent = state.comfort ? "연습" : `${(state.elapsedMs / 1000).toFixed(1)}초`;
    els.resultProgress.textContent = `${state.completed}/4`;
    els.resultMisses.textContent = `${state.missSoft + state.missHard}회`;
    const shownRecipes = won ? state.recipes : state.recipes.slice(0, Math.max(1, state.completed));
    els.resultPlates.innerHTML = shownRecipes.map((recipe, index) => (
      `<span class="mini-plate" style="--tilt:${index % 2 ? 5 : -5}deg">${iconSvg(recipe.hero)}</span>`
    )).join("");
    els.resultScreen.hidden = false;
    sound(won ? "win" : "lose");
    window.setTimeout(() => els.resultTitle.focus(), 60);
    return true;
  }

  function useHint() {
    if (els.hint.disabled || state.phase !== "playing") return;
    const recipe = currentRecipe();
    const target = state.tiles
      .filter((tile) => tile.status === "board" && (recipe.need[tile.type] || 0) > 0)
      .sort((a, b) => a.position - b.position)[0];
    if (!target) return;
    state.hintUses += 1;
    state.hintPenalty += 75;
    state.hintTileId = target.id;
    state.lastCollectAt = performance.now();
    setMessage(`${INGREDIENTS[target.type].name} 타일을 굵게 표시했어요.`, "good");
    sound("hint");
    render();
    const token = actionToken;
    window.setTimeout(() => {
      if (token !== actionToken || state.hintTileId !== target.id || state.ended) return;
      state.hintTileId = null;
      render();
    }, 1400);
  }

  function moveBoardFocus(currentButton, key) {
    const current = state.tiles.find((tile) => tile.id === currentButton.dataset.tileId);
    if (!current) return;
    const direction = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    }[key];
    if (!direction) return;
    const [dx, dy] = direction;
    const candidates = state.tiles.filter((tile) => {
      if (tile.status !== "board" || tile.id === current.id) return false;
      if (dx < 0) return tile.col < current.col;
      if (dx > 0) return tile.col > current.col;
      if (dy < 0) return tile.row < current.row;
      return tile.row > current.row;
    }).sort((a, b) => {
      const primaryA = dx ? Math.abs(a.col - current.col) : Math.abs(a.row - current.row);
      const primaryB = dx ? Math.abs(b.col - current.col) : Math.abs(b.row - current.row);
      const secondaryA = dx ? Math.abs(a.row - current.row) : Math.abs(a.col - current.col);
      const secondaryB = dx ? Math.abs(b.row - current.row) : Math.abs(b.col - current.col);
      return primaryA - primaryB || secondaryA - secondaryB;
    });
    const next = candidates[0];
    if (!next) return;
    state.focusTileId = next.id;
    els.board.querySelectorAll("button[data-tile-id]").forEach((button) => {
      button.tabIndex = button.dataset.tileId === next.id ? 0 : -1;
    });
    els.board.querySelector(`[data-tile-id="${next.id}"]`)?.focus();
  }

  function toggleMute() {
    state.muted = !state.muted;
    renderHeader();
    if (!state.muted) sound("collect");
  }

  function handleVisibility() {
    if (!isPlayingPhase()) return;
    if (document.hidden) {
      tick();
      state.paused = true;
      return;
    }
    state.paused = true;
    state.message = "주방이 잠시 멈췄어요. 준비되면 계속하세요.";
    state.messageTone = "neutral";
    render();
    announceMessage("게임이 일시정지되었습니다. 계속하기 버튼을 눌러주세요.");
  }

  function resumeGame() {
    if (!state.paused || state.ended) return;
    state.paused = false;
    state.lastTick = performance.now();
    setMessage("다시 시작! 필요한 재료를 이어서 찾아보세요.", "neutral");
    render();
    els.board.querySelector(`[data-tile-id="${state.focusTileId}"]`)?.focus();
  }

  function trapResultFocus(event) {
    if (event.key !== "Tab" || els.resultScreen.hidden) return;
    const focusables = [...els.resultScreen.querySelectorAll("button, a[href], [tabindex]:not([tabindex='-1'])")]
      .filter((element) => !element.hidden && !element.disabled);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === els.resultTitle)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  els.startButton.addEventListener("click", startGame);
  els.replay.addEventListener("click", replayGame);
  els.mute.addEventListener("click", toggleMute);
  els.hint.addEventListener("click", useHint);
  els.resume.addEventListener("click", resumeGame);
  els.resultScreen.addEventListener("keydown", trapResultFocus);
  els.board.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tile-id]");
    if (button) collect(button.dataset.tileId, button);
  });
  els.board.addEventListener("focusin", (event) => {
    const button = event.target.closest("button[data-tile-id]");
    if (!button) return;
    state.focusTileId = button.dataset.tileId;
    els.board.querySelectorAll("button[data-tile-id]").forEach((item) => {
      item.tabIndex = item === button ? 0 : -1;
    });
  });
  els.board.addEventListener("keydown", (event) => {
    const button = event.target.closest("button[data-tile-id]");
    if (!button) return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      moveBoardFocus(button, event.key);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      toggleMute();
    } else if (event.key.toLowerCase() === "h" && !els.hint.disabled) {
      event.preventDefault();
      useHint();
    } else if (event.key.toLowerCase() === "r" && !els.resultScreen.hidden) {
      event.preventDefault();
      replayGame();
    }
  });
  document.addEventListener("visibilitychange", handleVisibility);

  function runSelfTests() {
    const errors = [];
    const check = (condition, message) => {
      if (!condition) errors.push(message);
      console.assert(condition, `[Dish Collect] ${message}`);
    };

    for (let seed = 1; seed <= 100; seed += 1) {
      const round = createRound(seed);
      check(round.tiles.length === 36, `seed ${seed}: 타일 36개`);
      check(new Set(round.tiles.map((tile) => tile.position)).size === 36, `seed ${seed}: 좌표 중복 없음`);
      const totalNeed = round.recipes.reduce((sum, recipe) => sum + Object.values(recipe.need).reduce((a, b) => a + b, 0), 0);
      check(totalNeed === 20, `seed ${seed}: 요구 재료 20개`);
      const supply = round.tiles.reduce((totals, tile) => {
        totals[tile.type] = (totals[tile.type] || 0) + 1;
        return totals;
      }, {});
      Object.entries(round.requiredTotals).forEach(([type, required]) => {
        check((supply[type] || 0) >= required, `seed ${seed}: ${type} 공급 불변식`);
      });
    }

    const sample = createRound("classification");
    const mock = { recipes: sample.recipes, currentRecipe: 0 };
    check(classifyType(mock, "bacon") === "correct", "현재 필요 재료는 정답");
    check(classifyType(mock, "coffee") === "soft", "이후 필요 재료는 소프트 미스");
    check(classifyType(mock, "yogurt") === "hard", "미사용 재료는 하드 미스");
    mock.recipes[0].need.bacon = 0;
    check(classifyType(mock, "bacon") === "soft", "소진된 현재 재료는 소프트 미스");

    requestAnimationFrame(() => {
      const rects = [...els.board.querySelectorAll("button[data-tile-id]")].map((button) => button.getBoundingClientRect());
      const targetsValid = rects.every((rect) => rect.width >= 44 && rect.height >= 44);
      check(targetsValid, "모든 조작 타일 44×44px 이상");
      els.testBadge.hidden = false;
      els.testBadge.textContent = errors.length ? `SELF TEST · ${errors.length} FAIL` : "SELF TEST · PASS";
      els.testBadge.classList.toggle("is-failed", errors.length > 0);
      console.info(`[Dish Collect] self test: ${errors.length ? `${errors.length} failed` : "PASS"}`);
    });
    return { passed: errors.length === 0, errors };
  }

  window.__DISH_COLLECT_TEST__ = {
    createRound,
    classifyType,
    runSelfTests,
    getState: () => JSON.parse(JSON.stringify(state)),
    collectByType(type) {
      const tile = state.tiles.find((item) => item.status === "board" && item.type === type);
      if (tile) collect(tile.id, els.board.querySelector(`[data-tile-id="${tile.id}"]`));
      return Boolean(tile);
    },
    finishOnce,
  };

  render();
  if (params.get("test") === "1") runSelfTests();
})();
