#!/usr/bin/env node
/**
 * 공통 진입점 무결성 검사.
 *
 * 막으려는 실패는 하나다 — "게임이 디스크에는 있는데 허브 목록에서 조용히 빠지는 것".
 * stage-02 item-03 에서 실제로 재현된 블로커(games/plate-stack ↔ games/game-03 불일치)가 그 형태였다.
 * 그래서 디스크 · games.json · app.js 인라인 데이터 · 디렉터리별 game.json 네 벌이
 * 서로 일치하는지 전수로 대조한다.
 *
 * game.json 을 네 번째 근거로 세우는 이유: 이름 규약(game-NN)을 통일해도 다음 팩에서 같은
 * 갈림이 재발한다. 목록의 근거를 «이름» 이 아니라 각 디렉터리가 스스로 신고하는 매니페스트로
 * 옮겨 두면, 통합 단계가 규칙을 가정하지 않고 글롭만으로 목록을 만들 수 있다.
 *
 * 사용: node scripts/check-hub.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const checks = [];

function ok(label) {
  checks.push(label);
}
function fail(label) {
  failures.push(label);
}
function expect(condition, label) {
  condition ? ok(label) : fail(label);
}

// ── 1. 디스크의 게임 디렉터리 ──────────────────────────────
const gamesDir = join(root, "games");
const dirsOnDisk = readdirSync(gamesDir)
  .filter((name) => statSync(join(gamesDir, name)).isDirectory())
  .sort();

expect(dirsOnDisk.length === 8, `게임 디렉터리 8개 (실제 ${dirsOnDisk.length}: ${dirsOnDisk.join(", ")})`);
expect(
  dirsOnDisk.every((name) => /^game-0[1-8]$/.test(name)),
  `디렉터리 이름이 전부 game-0N 규약 (${dirsOnDisk.join(", ")})`,
);

// ── 2. games.json ─────────────────────────────────────────
const meta = JSON.parse(readFileSync(join(root, "games.json"), "utf8"));
const metaDirs = meta.games.map((g) => g.dir).sort();

expect(meta.games.length === 8, `games.json 항목 8개 (실제 ${meta.games.length})`);
expect(
  JSON.stringify(metaDirs) === JSON.stringify(dirsOnDisk),
  `games.json 의 dir 집합 = 디스크 집합\n    disk: ${dirsOnDisk.join(", ")}\n    json: ${metaDirs.join(", ")}`,
);
expect(
  meta.games.every((g, i) => g.index === i + 1),
  "games.json index 가 1..8 연속",
);

// ── 3. app.js 인라인 데이터 ────────────────────────────────
const appSource = readFileSync(join(root, "app.js"), "utf8");
const appDirs = [...appSource.matchAll(/dir:\s*"(game-\d+)"/g)].map((m) => m[1]).sort();

expect(appDirs.length === 8, `app.js 카드 8개 (실제 ${appDirs.length})`);
expect(
  JSON.stringify(appDirs) === JSON.stringify(dirsOnDisk),
  `app.js 의 dir 집합 = 디스크 집합\n    disk: ${dirsOnDisk.join(", ")}\n    app : ${appDirs.join(", ")}`,
);

for (const game of meta.games) {
  const slugInApp = new RegExp(`slug:\\s*"${game.slug}"`).test(appSource);
  expect(slugInApp, `app.js 에 slug ${game.slug} 존재`);
}

// ── 3-b. 디렉터리별 game.json 매니페스트 ───────────────────
// 통합·배포가 «이름 규칙» 대신 이걸 글롭해서 목록을 만들 수 있어야 한다.
// 그러려면 (a) 8개 전부에 있고 (b) games.json 과 어긋나지 않고 (c) entry 규칙이 한 가지여야 한다.
const REQUIRED_MANIFEST_KEYS = ["index", "dir", "slug", "title", "entry"];
for (const dir of dirsOnDisk) {
  const manifestPath = join(gamesDir, dir, "game.json");
  if (!existsSync(manifestPath)) {
    fail(`${dir}: game.json 존재 (통합 단계가 글롭할 매니페스트)`);
    continue;
  }
  ok(`${dir}: game.json 존재`);

  let manifest = null;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`${dir}: game.json 파싱 (${error.message})`);
    continue;
  }

  const missingKeys = REQUIRED_MANIFEST_KEYS.filter((key) => manifest[key] === undefined);
  expect(missingKeys.length === 0, `${dir}: game.json 필수 키 완비${missingKeys.length ? ` (누락: ${missingKeys.join(", ")})` : ""}`);

  // entry 는 «디렉터리 상대» 하나로 고정한다. 루트 상대로 적으면 글롭해서 이어 붙이는 쪽이
  // games/<dir>/games/<dir>/index.html 을 만든다 — 실제로 3개가 서로 다른 규칙이었다.
  expect(
    typeof manifest.entry === "string" && !manifest.entry.includes("/"),
    `${dir}: game.json entry 가 디렉터리 상대 경로 (실제 "${manifest.entry}")`,
  );
  expect(
    existsSync(join(gamesDir, dir, manifest.entry ?? "")),
    `${dir}: game.json entry 가 가리키는 파일 존재`,
  );
  expect(manifest.dir === dir, `${dir}: game.json dir 이 디렉터리명과 일치 (실제 "${manifest.dir}")`);

  const fromMeta = meta.games.find((g) => g.dir === dir);
  if (!fromMeta) continue;
  for (const key of ["index", "slug", "title"]) {
    expect(
      manifest[key] === fromMeta[key],
      `${dir}: game.json ${key} = games.json (${JSON.stringify(manifest[key])} vs ${JSON.stringify(fromMeta[key])})`,
    );
  }
  if (manifest.plan) {
    expect(existsSync(join(root, manifest.plan)), `${dir}: game.json plan 문서 존재 (${manifest.plan})`);
  }
}

// ── 4. 진입점 파일이 실제로 있는가 ─────────────────────────
for (const game of meta.games) {
  const entry = join(root, game.entry);
  expect(existsSync(entry), `진입점 파일 존재: ${game.entry}`);
  if (!existsSync(entry)) continue;

  const html = readFileSync(entry, "utf8");
  // 상대 경로만 쓰는지 — 절대 경로는 Pages 하위 경로에서 404 가 된다.
  const absolute = [...html.matchAll(/(?:href|src)="(\/[^/][^"]*)"/g)].map((m) => m[1]);
  expect(absolute.length === 0, `${game.dir}: 루트 절대경로 참조 0건${absolute.length ? ` (${absolute.join(", ")})` : ""}`);

  // 외부 네트워크 요청이 없어야 한다(오프라인 · file:// 실행 보장).
  const external = [...html.matchAll(/(?:href|src)="(https?:)?\/\/[^"]*"/g)].map((m) => m[0]);
  expect(external.length === 0, `${game.dir}: 외부 리소스 참조 0건${external.length ? ` (${external.join(", ")})` : ""}`);

  // 허브 링크가 가리키는 파일 옆에 실제 css/js 가 있는지.
  for (const ref of [...html.matchAll(/(?:href|src)="([^":]+\.(?:css|js))"/g)].map((m) => m[1])) {
    expect(existsSync(join(dirname(entry), ref)), `${game.dir}: 참조한 ${ref} 존재`);
  }
}

// ── 5. 허브 자체 ───────────────────────────────────────────
const indexHtml = readFileSync(join(root, "index.html"), "utf8");
for (const asset of ["style.css", "app.js", "games.json"]) {
  expect(indexHtml.includes(asset), `index.html 이 ${asset} 를 참조`);
  expect(existsSync(join(root, asset)), `${asset} 존재`);
}
expect(!/(?:href|src)="\//.test(indexHtml), "index.html: 루트 절대경로 참조 0건 (Pages 하위 경로 대응)");
expect(existsSync(join(root, ".nojekyll")), ".nojekyll 존재 (Pages 가 _ 로 시작하는 경로를 지우지 않도록)");

// ── 결과 ───────────────────────────────────────────────────
for (const label of checks) console.log(`  ok  ${label}`);
for (const label of failures) console.error(`FAIL  ${label}`);
console.log(`\n${checks.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
