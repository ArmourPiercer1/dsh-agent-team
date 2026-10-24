# A5M2 B-SEARCH vertical slice (team_grep / team_glob) — lane a5m2-bsearch-team

Card: CENTER 2026-10-25 (root 新纪律: M0 无主行分配). "B-SEARCH team 双名归你
(team_grep, team_glob 2 records; 自家 grep/glob 已并 fs 线, 8e62 已签, 勿动其
字节; team_grep/team_glob 表内无行 = 未接线无主)". FP-E +1 预报告先行 (已报).

Baseline: origin/feat/a5m2-integration @ bc3ee2e47bebbd836ab723593ced3c3cc9f6bbbf
(= the 8e62 REAL-GAP signed merge). Lane branch: feat/a5m2-bsearch-team
(worktree .worktrees/a5m2-bsearch-team; 1 task = 1 branch = 1 worktree = 1 writer).

## Read-only measurement (program step 1, 先核后写)

- 639 真面 @ 639ed015397290b3745d163aafe02ffee4aa3f84 (tests/deepseek-harness-test-use,
  rev-parse verified, zero writes): grep = packages/fs/tool-fs-search/src/grep.ts:285-340
  (parameters {pattern required string; path? string; include? string}, output
  {matches:[{path,lineNumber,line}]}, rg caps via runRipgrep); glob = glob.ts:296-353
  ({pattern required; path?}, output {root, paths}). team_grep/team_glob DO NOT EXIST
  on the host face (repo-wide grep at the baseline: zero hits) — they are plane-side
  alias names (team-tool-plane.mjs:136 DEFAULT_PLANE_NAMES).
- M0 索引 (read-only, zero writes): docs/plans/active/alpha5-tool-io-governance/
  m0-closure-v3/M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json records 7 (team_grep) and
  8 (team_glob): scope=alias, family=B-SEARCH, mountCondition=always,
  onMountObligation=FULL_GOVERNANCE, provider=CONFINED_PROCESS_RG,
  recordEffectDeltaFromInventory=['read-subtree'], executionEvidence=NOT_RUN
  (copied honestly; NOT re-run and NOT claimed).
- 表态 measured: PA_FAMILY_TARGET_RULES at int = 14 families, NO 'B-SEARCH' row
  (表内无行确认). Plane consumer 实读: the alias rows ride the a5p5 lane pipeline
  (decide + lane PA, NO durable family block — no familyId anywhere on that path);
  the durable-claim families all mount via closed-key + injected-arm gates
  (todo/write/image/g1/terminal/subagent-control law).
- Signed bodies located for REUSE (bytes untouched, zero edits): search-backend.mjs
  ("the effect body the governed tool plane's team_grep row needs", 1125 lines,
  anchored confined rg), glob-backend.mjs, plane-effect-backends.mjs (lexicalAnchor,
  createAnchoredSearchBackend/GlobBackend), a5p5 runToolCall (lease/render/cancel law).

## The slice (what landed)

1. FP-E +1: PA_FAMILY_TARGET_RULES['B-SEARCH'] (control/types.ts, entry-scoped diff,
   inserted after B-WRITE). 11 shared leaves + operation-leaf variant (by:
   team-grep-content-search adds include nullableString / team-glob-path-match adds
   nothing). Zero new kinds, zero new grammar; three-state nullableString discipline
   for the optional face parameters.
2. Arm: packages/runtime/src/plugin/live/governed-families/search.mjs
   (A5_B_SEARCH_FAMILY_ID='B-SEARCH', A5_B_SEARCH_ADAPTER_REVISION=1, census names
   pinned to M0 recordIndex 7/8). classify = closed measured face law + team-family
   caller law (write arm readIdentity verbatim) + imported anchor law (lexicalAnchor).
   delegate = plan re-tie + body identity recheck + the SIGNED lane parse/pipeline/
   backend route (re-implements no search law).
3. Mount: team-tool-plane.mjs gate searchEnabled + backends.searchGoverned
   (pairing both directions, census validation with imported law, one-name-one-
   placement; row body = disclosed clone of the g1 shared vertical; teardown
   dispose; ledger row `search: [team_grep, team_glob]`).
4. Author spec: test/a5m2-bsearch-team-c1.test.ts — 27 legs, INCLUDING the REQUIRED
   real-new-mint→same-validator accept legs (real arm mints, real published
   validator accepts; key-set equality both names; synthetic claims appear ONLY in
   labeled validator-side refusal legs).

## Disclosed DELTAs (reported, not silently shipped)

1. The plane row body is a CLONE of the committed g1 row body (token ledger, fix-4
   authority leg, classify→walk→open→edge→consumedProof→delegate, settle law),
   adapted: correlation prefix plane-bsearch:, family block ALWAYS present (the g1
   body's B-INSPECT-only conditionality was that round's enablement scope).
2. runToolCall is entered with `pa` DELIBERATELY ABSENT: the ONE durable PA walk is
   the plane funnel's open/edge pair, already spent with consumedProof in hand; a
   second edge would be double consumption. The a5p5 deps comment scopes
   pa-absence to pre-M1 kit rows — this row is not pre-M1, it is PRE-WALKED upstream.
3. TWO disclosed face→lane transcriptions (the lane parser is the published execute
   path, entered UNMODIFIED): include->glob; the mode-less 639 face whose output is
   content matches carries the lane-required explicit output_mode:'content'.
4. Slot takeover: a durable row name EQUAL to a lane alias placement excludes the
   alias row from the defs placement (one name, one placement; the same-layer
   duplicate would fail the assembly at register). Zero durable mount = zero
   filtering (spec-pinned byte-equality across builds for the untouched class).
5. Census re-anchor (B-PTC precedent, pins refreshed by the adding lane):
   a5m2-family-rules-c1 (fifteen families + B-SEARCH carrier), a5m2-schedule-wiring
   :464, a5m2-team-wiring-c1 :500. No other lane's entry bytes touched; the 8e62 fs
   line bytes (search-backend/glob-backend/plane-effect-backends/a5p5) untouched;
   M0 index untouched.

## Gates (raw)

- test/a5m2-bsearch-team-c1.test.ts: 27 passed (27).
- Battery: family-rules-c1 + schedule-wiring + team-wiring-c1 + a5-globoff-key +
  a5int-r3-mount-integration + a5m2-g3-plane-mount-c1 + a5b2 + a5b3 =
  8 files passed, 137 passed (137).
- Second slice (seam-enforcement, g6-session-query-wiring, g2-wire, readimg,
  g1-wire, g5-goal-wiring): reds = a5m2-g1-wire-c1 (2) + a5m2-g2-wire-c1 (5) —
  IDENTICAL to the clean baseline bc3ee2e47 (same files, same names, same counts;
  baseline re-run recorded). ZERO self-caused reds.
- tsc (packages/runtime): 106 errors = baseline 106 (clean bc3ee2e47 count), ZERO
  in any changed/new file.
- eslint changed files: 0 problems.

## Tier (honesty)

接线未测 (mount code exists and is spec-green at the author level; no live-Host
wiring round, no install, no Host placement was performed). NOT C2; table passage
proves the type gate ONLY. executionEvidence of the M0 rows stays NOT_RUN until a
wiring round with a real PA seat + confined provider runs.
