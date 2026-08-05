# Interactive Game Pack

레퍼런스 영상에서 확인한 **요리 소재 플레이어블 광고 8종**의 실동작 프로토타입과 유형별 견적 자료.

- 공개 데모: https://alphaca-labs.github.io/interactive-game-pack/
- **견적 보고서: [`outputs/ESTIMATE_REPORT.md`](outputs/ESTIMATE_REPORT.md)** — 견적 · 제작 기간 · 4주 최대 수량 (고객 전달본)
- 레퍼런스: [PLAYABLE ADS BEST EXAMPLES January 2026](https://www.youtube.com/watch?v=xQH4X57HKQo) — 6초 구간 4종 · 1분 45초 이후 4종
- 메타데이터: [`games.json`](games.json) · 에셋 출처: [`ASSETS.md`](ASSETS.md)

## 게임 8종

| # | 게임 | 유형 | 구간 | 1판 | 진입점 |
|---|---|---|---|---|---|
| 1 | 오더 트레이 · Order Tray | B 보드상태 퍼즐 | 00:06 | 30~45초 | [`games/game-01`](games/game-01/index.html) |
| 2 | 퍼펙트 슬라이스 · Perfect Slice | C 물리·파티클 | 00:06 | 25~40초 | [`games/game-02`](games/game-02/index.html) |
| 3 | 플레이트 스택 · Plate Stack | B 보드상태 퍼즐 | 00:06 | 45~60초 | [`games/game-03`](games/game-03/index.html) |
| 4 | 윈터 팬트리 · Winter Pantry | A 탭 매칭 | 00:06 | 20~30초 | [`games/game-04`](games/game-04/index.html) |
| 5 | 픽셀 푸어 · Pixel Pour | C 물리·파티클 | 01:52 | 30~38초 | [`games/game-05`](games/game-05/index.html) |
| 6 | 러시 카운터 · Rush Counter | D 시뮬레이션 | 01:52 | 45초 | [`games/game-06`](games/game-06/index.html) |
| 7 | 키친 타이디 · Kitchen Tidy | A 탭 매칭 | 01:52 | 25~45초 | [`games/game-07`](games/game-07/index.html) |
| 8 | 디시 컬렉트 · Dish Collect | A 탭 매칭 | 01:52 | 30~45초 | [`games/game-08`](games/game-08/index.html) |

> 영상 02:45 이후에 재생되는 2종(과일 꼬치 정렬 · 회전초밥 경영)은 지정된 8종 범위 밖이라 제외했다.

## 유형별 견적 · 제작 기간 · 4주 최대 수량

1트랙 = 시니어 HTML5 개발 1인 + UI/아트 0.5인 + QA 0.5인. 4주 = 영업일 20일. **전 금액 VAT 별도.**

| 유형 | 해당 게임 | 1종 견적 | 1종 기간 | 4주·1트랙 | 4주·2트랙 |
|---|---|---|---|---|---|
| A 탭 매칭 | 4, 7, 8 | 450만 ~ 650만원 | 5~7 영업일 | 3종 | 6~7종 |
| B 보드상태 퍼즐 | 1, 3 | 650만 ~ 900만원 | 7~10 영업일 | 2종 | 4~5종 |
| C 물리·파티클 | 2, 5 | 900만 ~ 1,300만원 | 10~15 영업일 | 1~2종 | 3종 |
| D 시뮬레이션 | 6 | 1,200만 ~ 1,600만원 | 15~20 영업일 | 1종 | 2종 |

- 1종 범위: 1레벨 · 국문 UI · 사운드 옵션 · 승인 1회 · 광고 SDK 미포함.
- 공용 셸(부트·상태머신·HUD·사운드·접근성) 2일은 최초 1회만 발생하고 이후 종에서 재사용된다.
- 8종 전체 = **79.5 인일**. 4주 안에 8종을 모두 받으려면 **4트랙 병렬**이 필요하다.

## 실행

빌드도 설치도 없다. 저장소를 받아 `index.html` 을 열면 그대로 돌아간다.

```sh
open index.html            # file:// 로 직접 열어도 동작한다
python3 -m http.server 8080  # http 로 확인하려면
```

각 게임은 `?seed=<n>` 으로 같은 보드를 재현하고, `?test=1` 로 규칙 자동 검증을 돌린다.

## 공통 제작 스펙

- **런타임** — 순수 HTML · CSS · JavaScript. 프레임워크 · 번들러 · CDN 의존성 0건.
- **에셋** — 전량 자체 제작 인라인 SVG · CSS 도형. 외부 이미지 · 웹폰트 · 음원 라이선스 이슈 없음. 효과음은 Web Audio 합성.
- **입력** — 포인터 · 터치 · 키보드가 같은 판정 경로. 조작 타깃 최소 44×44px.
- **접근성** — 라이브 리전 · 포커스 이동 · `prefers-reduced-motion` 대응.
- **반응형** — 320×568 ~ 1440×900 가로 스크롤 없음. 세로 화면 우선.

## 검증

```sh
node scripts/check-hub.mjs      # 허브 ↔ games.json ↔ 디스크 일치 (63 checks)
node scripts/verify-pack.mjs    # 실제 Chrome 으로 허브 + 8개 진입점 + 허브 복귀 동선 (84 checks)
node scripts/capture-thumbs.mjs # 카드 썸네일 재생성 → assets/thumbs/
```

`check-hub.mjs` 가 막는 것은 "게임이 디스크에는 있는데 허브 목록에서 조용히 빠지는 것" 하나다.
디렉터리 이름 규약(`game-0N`)이 어긋나면 그 게임은 화면에서 사라지는데 빌드도 테스트도 아무 말을 하지 않는다.

`verify-pack.mjs` 의 **허브 복귀 검사**도 같은 종류의 조용한 실패를 막는다. 8종은 각자 독립 실행되지만
팩으로 묶인 이상 "다른 데모 보기" 는 허브로 돌아와야 하는데, 링크가 `<a href>` 인 타이틀과 JS 로 이동하는
타이틀이 섞여 있어 눈으로는 구분되지 않는다(실제로 game-01 이 이동하지 않고 안내 문구만 띄우고 있었다).

`capture-thumbs.mjs` 는 macOS 의 Chrome 과 `sips` 에 의존한다. 썸네일이 없어도 허브는 원래의 색 배경 카드로
정상 동작하므로 배포를 막지는 않는다.

## 문서

| 경로 | 내용 |
|---|---|
| [`outputs/ESTIMATE_REPORT.md`](outputs/ESTIMATE_REPORT.md) | 견적 · 제작 기간 · 4주 최대 수량 (고객 전달본) |
| [`outputs/research-brief.md`](outputs/research-brief.md) | 원본 영상 프레임 판독 결과와 8종 확정 근거 |
| `outputs/plans/*.md` | 타이틀별 기획서 |
| `outputs/workflow-stage-02-item-0N.md` | 타이틀별 구현 · 검증 보고 |
| [`ASSETS.md`](ASSETS.md) | 에셋 출처와 외부 요청 0건 계측 근거 |

원본 영상에서 추출한 프레임(`outputs/frames/`)은 제3자 저작물이라 저장소에서 제외했다(`.gitignore`).
