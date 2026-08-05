/**
 * 공통 진입점 렌더러.
 *
 * 데이터는 games.json 과 같은 내용을 인라인으로 들고 있다. fetch 로 읽지 않는 이유는
 * 8종 게임과 같은 조건(file:// 직접 열기 · 네트워크 요청 0건)을 허브에도 그대로 걸기 위해서다.
 * games.json 을 고치면 아래 GAMES · BANDS 도 같이 고친다 (검증: scripts/check-hub.mjs).
 */
(function () {
  "use strict";

  var GAMES = [
    {
      index: 1,
      dir: "game-01",
      slug: "order-tray",
      title: "오더 트레이",
      titleEn: "Order Tray",
      group: "six-second",
      sourceTimestamp: "00:06",
      band: "B",
      bandLabel: "보드상태 퍼즐",
      session: "30~45초",
      summary:
        "ORDERS 티켓이 요구하는 요리를 4×4 보드에서 골라 트레이로 보낸다. 같은 요리 3개가 모이면 주문 완료, 트레이가 가득 차면 실패.",
      controls: ["탭 · 터치", "방향키 + Enter"],
    },
    {
      index: 2,
      dir: "game-02",
      slug: "perfect-slice",
      title: "퍼펙트 슬라이스",
      titleEn: "Perfect Slice",
      group: "six-second",
      sourceTimestamp: "00:06",
      band: "C",
      bandLabel: "물리 · 파티클",
      session: "25~40초",
      summary: "25초 안에 오이를 5번 잘라 6조각으로 만든다. 조각 두께의 표준편차가 그대로 점수가 된다.",
      controls: ["드래그 · 터치", "방향키 + Space"],
    },
    {
      index: 3,
      dir: "game-03",
      slug: "plate-stack",
      title: "플레이트 스택",
      titleEn: "Plate Stack",
      group: "six-second",
      sourceTimestamp: "00:06",
      band: "B",
      bandLabel: "보드상태 퍼즐",
      session: "45~60초",
      summary: "6줄로 쌓인 접시 중 맨 위 한 장만 집어 손님 2명의 주문을 채우는 60초 퍼즐. 보관대 3칸이 막히면 실패.",
      controls: ["탭 · 터치", "←/→ + Enter"],
    },
    {
      index: 4,
      dir: "game-04",
      slug: "winter-pantry",
      title: "윈터 팬트리",
      titleEn: "Winter Pantry",
      group: "six-second",
      sourceTimestamp: "00:06",
      band: "A",
      bandLabel: "탭 매칭",
      session: "20~30초",
      summary: "30초 안에 5×4 선반에서 목표 재료 5개를 찾아 탭한다. 오답은 −2초 · −50점, 연속 정답은 콤보 배수.",
      controls: ["탭 · 터치", "방향키 + Enter"],
    },
    {
      index: 5,
      dir: "game-05",
      slug: "pixel-pour",
      title: "픽셀 푸어",
      titleEn: "Pixel Pour",
      group: "after-1m45",
      sourceTimestamp: "01:52",
      band: "C",
      bandLabel: "물리 · 파티클",
      session: "30~38초",
      summary: "하단 색 배치를 같은 색 레인으로 보내면 16×16 픽셀 도안이 채워진다. 38초 안에 진행률 100% 달성이 목표.",
      controls: ["드래그 · 탭", "방향키 · 숫자키 1–6"],
    },
    {
      index: 6,
      dir: "game-06",
      slug: "rush-counter",
      title: "러시 카운터",
      titleEn: "Rush Counter",
      group: "after-1m45",
      sourceTimestamp: "01:52",
      band: "D",
      bandLabel: "시뮬레이션",
      session: "45초",
      summary: "버거 · 감자 · 음료를 조리해 대기 손님에게 서빙하고, 바닥에 쌓인 현금을 수거해 45초 안에 목표 금액을 채운다.",
      controls: ["탭 · 터치", "1/2/3 · Space · C"],
    },
    {
      index: 7,
      dir: "game-07",
      slug: "kitchen-tidy",
      title: "키친 타이디",
      titleEn: "Kitchen Tidy",
      group: "after-1m45",
      sourceTimestamp: "01:52",
      band: "A",
      bandLabel: "탭 매칭",
      session: "25~45초",
      summary:
        "바닥에 흩어진 조리도구 24개(8종×3개)를 7칸 바구니에 모은다. 같은 종류 3개가 모이면 정리, 35초 안에 8세트를 비우면 성공.",
      controls: ["탭 · 터치", "Tab · 방향키 + Enter"],
    },
    {
      index: 8,
      dir: "game-08",
      slug: "dish-collect",
      title: "디시 컬렉트",
      titleEn: "Dish Collect",
      group: "after-1m45",
      sourceTimestamp: "01:52",
      band: "A",
      bandLabel: "탭 매칭",
      session: "30~45초",
      summary: "상단 목표 접시가 요구하는 재료를 하단 보드에서 찾아 탭해 수집한다. 접시 하나를 완성할 때마다 다음 요리로 교체된다.",
      controls: ["탭 · 터치", "방향키 + Enter"],
    },
  ];

  var BANDS = [
    { type: "A", label: "탭 매칭", items: [4, 7, 8], quote: "450만 ~ 650만원", days: "5~7 영업일", one: "3종", two: "6~7종" },
    { type: "B", label: "보드상태 퍼즐", items: [1, 3], quote: "650만 ~ 900만원", days: "7~10 영업일", one: "2종", two: "4~5종" },
    { type: "C", label: "물리 · 파티클", items: [2, 5], quote: "900만 ~ 1,300만원", days: "10~15 영업일", one: "1~2종", two: "3종" },
    { type: "D", label: "시뮬레이션", items: [6], quote: "1,200만 ~ 1,600만원", days: "15~20 영업일", one: "1종", two: "2종" },
  ];

  var GROUP_LABEL = { "six-second": "6초 구간", "after-1m45": "1분 45초 이후" };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function thumb(game) {
    // 게임별 썸네일도 외부 이미지 없이 만든다 — 번호 + 유형 색으로 구분한다.
    var box = el("div", "card__thumb band-" + game.band);
    box.setAttribute("aria-hidden", "true");
    box.appendChild(el("span", "card__num", String(game.index).padStart(2, "0")));
    box.appendChild(el("span", "card__band", game.band));
    return box;
  }

  function card(game) {
    var li = el("li", "card");
    li.dataset.group = game.group;

    var link = el("a", "card__link");
    link.href = "games/" + game.dir + "/index.html";
    link.setAttribute("aria-label", game.title + " 플레이 — " + game.bandLabel + " 유형, 1판 " + game.session);

    link.appendChild(thumb(game));

    var body = el("div", "card__body");

    var meta = el("p", "card__meta");
    meta.appendChild(el("span", "tag tag--band", game.bandLabel));
    meta.appendChild(el("span", "tag", GROUP_LABEL[game.group] + " · " + game.sourceTimestamp));
    body.appendChild(meta);

    var h3 = el("h3", "card__title");
    h3.appendChild(document.createTextNode(game.title));
    h3.appendChild(el("span", "card__title-en", game.titleEn));
    body.appendChild(h3);

    body.appendChild(el("p", "card__summary", game.summary));

    var foot = el("p", "card__foot");
    foot.appendChild(el("span", "card__session", "1판 " + game.session));
    foot.appendChild(el("span", "card__controls", game.controls.join(" · ")));
    body.appendChild(foot);

    body.appendChild(el("span", "card__cta", "플레이하기"));

    link.appendChild(body);
    li.appendChild(link);
    return li;
  }

  function renderGames() {
    var grid = document.getElementById("game-grid");
    if (!grid) return;
    var frag = document.createDocumentFragment();
    GAMES.forEach(function (game) {
      frag.appendChild(card(game));
    });
    grid.appendChild(frag);
  }

  function renderEstimate() {
    var body = document.getElementById("estimate-body");
    if (!body) return;
    BANDS.forEach(function (band) {
      var tr = el("tr");

      var th = el("th");
      th.scope = "row";
      th.appendChild(el("span", "band-pill band-" + band.type, band.type));
      th.appendChild(el("span", "band-name", band.label));
      tr.appendChild(th);

      var names = band.items
        .map(function (index) {
          var found = GAMES.filter(function (g) {
            return g.index === index;
          })[0];
          return found ? found.title : String(index);
        })
        .join(", ");

      [names, band.quote, band.days, band.one, band.two].forEach(function (value, i) {
        var td = el("td", i === 0 ? "cell-names" : null, value);
        if (i >= 3) td.className = "cell-count";
        tr.appendChild(td);
      });

      body.appendChild(tr);
    });
  }

  function wireFilters() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll(".chip[data-filter]"));
    var grid = document.getElementById("game-grid");
    if (!buttons.length || !grid) return;

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var filter = button.dataset.filter;
        buttons.forEach(function (other) {
          var active = other === button;
          other.classList.toggle("is-active", active);
          other.setAttribute("aria-pressed", active ? "true" : "false");
        });
        Array.prototype.slice.call(grid.children).forEach(function (item) {
          item.hidden = filter !== "all" && item.dataset.group !== filter;
        });
      });
    });
  }

  renderGames();
  renderEstimate();
  wireFilters();
})();
