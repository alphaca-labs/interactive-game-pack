#!/usr/bin/env node
/**
 * `games/<dir>/game.json` 매니페스트를 games.json(SSOT)에서 재생성한다.
 *
 * 막으려는 실패: 통합·배포 단계가 디렉터리 «이름 규칙» 을 가정해 링크를 만드는 것.
 * 규약을 번호식으로 통일해도 다음 팩에서 같은 갈림이 재발하므로, 목록의 근거를
 * 이름이 아니라 각 디렉터리가 스스로 신고하는 매니페스트로 옮긴다.
 *
 * 매니페스트 계약(필수): index · dir · slug · title · entry.
 *  - `entry` 는 **디렉터리 상대 경로**다(`index.html`). 루트 상대(`games/game-03/index.html`)로
 *    적으면 글롭해서 이어 붙이는 쪽이 `games/game-03/games/game-03/index.html` 을 만든다 —
 *    실제로 8개 중 3개가 서로 다른 규칙으로 적혀 있었다.
 *  - 견적은 games.json 의 typeBands 에서 유형별로 끌어온다(항목별로 다시 적지 않는다).
 * 각 게임이 스스로 채운 확장 필드(assets · queryParams · shortcuts · qa · runtime ...)는
 * 덮어쓰지 않고 그대로 보존한다.
 *
 * 사용: node scripts/sync-game-manifests.mjs [--check]
 *   --check 를 주면 파일을 쓰지 않고 «재생성 결과와 다른가» 만 보고한다(CI/검사용).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

const meta = JSON.parse(readFileSync(join(root, "games.json"), "utf8"));

/** games.json 이 소유하는 핵심 필드. 매니페스트에서 이 값들이 어긋나면 재생성이 정답이다. */
const OWNED_KEYS = [
  "index", "dir", "slug", "title", "titleEn", "entry",
  "type", "group", "sourceTimestamp", "sessionSeconds", "summary", "estimate", "plan",
];

function bandOf(index) {
  const band = meta.typeBands.find((b) => b.items.includes(index));
  if (!band) throw new Error(`games.json typeBands 에 항목 ${index} 가 없습니다.`);
  return band;
}

const changed = [];
for (const game of meta.games) {
  const band = bandOf(game.index);
  const manifestPath = join(root, "games", game.dir, "game.json");
  const previous = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : {};
  // 확장 필드는 게임이 소유한다 — 여기서 지우지 않는다.
  const extras = Object.fromEntries(
    Object.entries(previous).filter(([key]) => !OWNED_KEYS.includes(key)),
  );
  const planPath = `outputs/plans/${game.slug}.md`;
  const next = {
    index: game.index,
    dir: game.dir,
    slug: game.slug,
    title: game.title,
    titleEn: game.titleEn,
    // ⛔ 루트 상대 경로로 되돌리지 마라 — 글롭해서 `games/<dir>/` 에 이어 붙이는 쪽이 깨진다.
    entry: "index.html",
    type: `${band.type} — ${band.label}`,
    group: game.group,
    sourceTimestamp: game.sourceTimestamp,
    sessionSeconds: game.sessionSeconds,
    summary: game.summary,
    estimate: {
      quoteKrw: band.quoteKrwPerTitle,
      businessDays: band.businessDaysPerTitle,
      note: `${meta.estimateAssumptions.track} · ${meta.estimateAssumptions.scopePerTitle} · ${meta.estimateAssumptions.vat}`,
    },
    plan: existsSync(join(root, planPath)) ? planPath : null,
    ...extras,
  };

  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  const current = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : null;
  if (current === serialized) continue;
  changed.push(`games/${game.dir}/game.json`);
  if (!checkOnly) writeFileSync(manifestPath, serialized);
}

if (changed.length === 0) {
  console.log("game.json 8개가 games.json 과 일치합니다.");
  process.exit(0);
}
if (checkOnly) {
  console.error(`games.json 과 어긋난 매니페스트 ${changed.length}건:\n  ${changed.join("\n  ")}`);
  console.error("`node scripts/sync-game-manifests.mjs` 로 재생성하세요.");
  process.exit(1);
}
console.log(`매니페스트 ${changed.length}건 재생성:\n  ${changed.join("\n  ")}`);
