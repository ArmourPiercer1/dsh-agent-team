# P2-T6 — Compliance Report

Task: **P2-T6 — Remote/client/additive UI seams + G2 audit** (TaskDoc §11.3).
Branch `task/P2-T6-remote-client`, worktree `.worktrees/P2-T6`, base
`484e735689fa1d337a89d573710da4ec449e7766` (int/P2-seam-characterization).
CORE PATCH BUDGET = 0 — respected: zero upstream modifications, zero patches, zero
vendored copies.

## 1. Goal compliance (card L1034-1047)

| card requirement | status | where |
| --- | --- | --- |
| 目标: 验证 external Remote、dsh.client、conversation.view、New Team additive entry 等 | done | seam-report.md seams 1-5 |
| 目标: 汇总 seam manifest | done | `tests/characterization/seam-manifest/manifest.json` (26 rows, P2-T1..T6) |
| 必须测试: plugin discovery | done | B1 (+ no-decl control) |
| 必须测试: view slot | done | B5 core A (conversation.view) |
| 必须测试: sidebar/action | done | B5 core B (sidebar.footer.action) |
| 必须测试: reconnect basic | done | B2 R1-R5 (obs-reconnect.json) |
| 必须测试: 全 seam manifest validation | done | in-group `validateManifest` (7 rules, seam-manifest-validation.json) |
| 验收: architecture-critical seams 全部 executable | done | manifest rule `critical-executable`; 5/5 arch-critical PASS |
| 验收: G2 criterion 有证据 | done | g2-pre-audit.md (6/6 criterion → evidence → PASS) |
| 实现要点: UI 非关键 seat 可使用已冻结 fallback | applied | input dock → frozen fallback seat `conversation.input.dock` (recorded) |
| 实现要点: 关键入口无 seam 则 blocker | n/a | every critical entry has a public seam → zero blockers |

## 2. Owned-path discipline

Committed (ONLY) under:

| owned path | content |
| --- | --- |
| `tests/characterization/probes/remote-client/**` (incl. `plugins/`) | group module `index.mjs`; payloads: `host-probe.js`, `slot-probe.js`, `reconnect-probe.js`, `p2t6-client-probe/`, `no-decl/`, `negative-fixtures/{missing-bundle,malformed-decl}/` |
| `tests/characterization/seam-manifest/manifest.json` | aggregate seam manifest + known-limitations register |
| `dev/agent-workflow/evidence/P2-T6/**` | this report, seam-report.md, g2-pre-audit.md, `run/**` (canonical run artifacts: run-log.txt, logs/obs/*.json, dump-config-b1.txt, negative logs) |

Nothing outside these paths was written by this task. Upstream
(`references/deepseek-harness-test-use`) read-only: byte-clean asserted by the
harness after every run and re-verified manually (`git status --porcelain` empty,
`git diff` empty, HEAD `cd5ef814…` unchanged).

Path wording note: card L1037 writes the owned probe path as
`tests/characterization/remote-client/**` (draft-era wording). The harness layout
frozen by P2-T1 places every probe group under `tests/characterization/probes/<group>/`
(all five pre-existing groups, T2-T5 included, live there); this task follows that
established convention (`probes/remote-client/**`) — same scope, established location.

## 3. Dependency usage (public surface only)

| dependency | import | public? |
| --- | --- | --- |
| `@deepseek-ai/dsh-client-ui-slots` | named export `SlotCore` from `.` (`lib/index.js`) | yes — declared export, built JS |
| `@deepseek-ai/dsh-client-connection` | `{ConnectionController}` from `./src/client/connection.ts` | yes — package `exports["./src/*"]`; runtime flag deviation L6-1 (see §4) |
| harness `lib/**` (instance/private-import/public-surface/util) | relative in-root imports in the group module | in-repo, zero-core |
| node: builtins | fs/path/http | n/a |

The group module itself imports **no** upstream package (static-scanned in harness
mode; the junction farm + live-surface admission enforce payload imports at scan time
and at runtime resolution).

## 4. Attempt ledger

Canonical executions of the full harness: **cap 3**. Debug executions use
`--only probes` and are logged separately (they do not consume the cap).

| # | kind | command (abridged) | result | notes |
| --- | --- | --- | --- | --- |
| D1 | debug | `node tests/characterization/run.mjs --only probes --port 3401 --backup-port 3411 --dsh-home …/.dsh-test-p2t6 --report-dir …/evidence/P2-T6/run` | FAIL (7 failures) | first debug iteration; fixed: host-probe non-exported `inject` (boot crash), slot A9/A12 expectations, zero-private-imports sweep (negative-fixture-zone exclusion + positive control) |
| D2 | debug | same as D1 | FAIL (3 failures, all remote-client B1 region) | client-bundle probe missing from the boot graph with zero diagnostics; root cause later identified as the flat `"dsh.client"` fixture form (deviation 4) |
| — | manual repro | `debug-b1/manual-boot.mjs` ×2, `debug-b1/negative-boot.mjs` ×2 (flat-form era) | observations | booted B1 rows + negative rows; persisted child logs/dumps/graphs; led to the live-patch experiment |
| — | manual repro | `debug-b1/live-patch.mjs` ×5 (3 script-crash runs without boot, 2 full boots) | observations | live patch recomposition works mechanically (entriesDebug 149→150, fiber active, event delivered) while the graph stayed empty → `/__p2t6/diag` showed `resolveMeta → null` |
| — | manual repro | `debug-b1/negative-boot.mjs` re-run (fixed nested fixtures) ×1 (2 phases) | both boots aborted, code=1 | neg-b3 log: `client bundles not found … package: p2t6-missing-bundle`; neg-b4 log: `dsh.client.platform must be a string`; fail-loud-at-boot contract confirmed |
| — | manual repro | `debug-b1/dump-negative.mjs` ×1 | dumpConfig ok after composition failure, row present in dump (both negative rows) | B3/B4 assertion design: separate dump-config call survives the aborted boot |
| D3 | debug | same as D1 | FAIL (1 failure: B2 cookie-shape regex) | after fixture-form fix: B1/B3/B4/B5 fully green; cookie name is b64url(sha256) (43 chars), not 64-hex — regex corrected per `packages/client/connection/src/browser-auth.ts` |
| D3b | debug | same as D1 | **PASS (all sections green)** | remote-client group fully green (B1-B5); cookie fix confirmed |
| C1 | canonical | `node tests/characterization/run.mjs --port 3401 --backup-port 3411 --dsh-home …/.dsh-test-p2t6 --report-dir …/evidence/P2-T6/run` | **PASS (all sections green, exit 0)** — 2026-08-29T21:37:44Z→21:39:11Z, canonical attempt 1/3 | all 6 groups + preflight/surface/fixture/static/lifecycle/byte-clean; remote-client group fully green (B1–B5 incl. negative boots B3/B4, fail-loud markers + dump-config survive checks); byte-clean 3× PASS (porcelain empty, diff empty, HEAD unchanged `cd5ef814…`); artifacts in `run/` (run-log.txt 409 lines, logs/obs/*, dump-config-b1/b3/b4.txt, instance-port3401-negative-b3/b4.log) |
| B1 | bare | `node tests/characterization/run.mjs` + `CH_PORT=3401 CH_BACKUP_PORT=3411 CH_DSH_HOME=…/.dsh-test-p2t6` (no CH_REPORT_DIR, no CLI flags) | **PASS (all sections green, exit 0)** — 2026-08-29T21:42:30Z→21:43:57Z | README Quickstart / CI single-command contract; bare-mode logDir fallback `tests/characterization/.run-logs/` (gitignored, int commit 2679316) exercised; console tee'd to `debug-b1/bare-run-console.log`; all 7 sections green, zero FAIL, byte-clean 3× PASS (HEAD unchanged `cd5ef814…`); side effect: preset-persona-model group rewrote its committed P2-T3 observation JSONs (run-specific session ids) — restored to committed state post-run, matching the T4/T5 precedent (their commits carry no T3 observation updates) |

**Documented deviations** (none touch upstream):
1. `NODE_OPTIONS=--experimental-transform-types` set around the B2 boot only (deleted
   in `finally` before any later boot): the public `./src/*.ts` subpath of
   `dsh-client-connection` carries parameter properties that node 24 strip-only cannot
   parse. L6-1 in the manifest register.
2. Bare run uses CH_* env (CH_PORT/CH_BACKUP_PORT/CH_DSH_HOME) so it shares this task's
   fixed ports/DSH_HOME instead of the harness defaults 3281/3291 — required by this
   program's port policy (L1-4); CH_REPORT_DIR intentionally unset to exercise the
   bare-mode fallback path (harness T2 self-heal, commit 2679316).
3. Ports 3401/3411 (task-fixed), never 3281/3291/3381-3394/3080/3180.
4. **Fixture-form bug post-mortem (self-inflicted, fixed before any canonical run)**:
   all three client probe fixtures (`p2t6-client-probe`, `negative-fixtures/missing-bundle`,
   `negative-fixtures/malformed-decl`) originally declared a **flat** top-level
   `"dsh.client"` key. The registry reads the **nested** `pkg.dsh.client`, so
   `resolveMeta` returned null silently (no throw, no log) and the rows were excluded
   from the client-module graph with zero diagnostics. Consequences: D1/D2 misread the
   seam as "boot succeeds, broken rows silently excluded" and B3/B4 were (wrongly)
   rewritten to assert that contract. Root-caused this session via the live-patch
   experiment + `/__p2t6/diag` (registry `resolveMeta → null`) and confirmed against
   the canonical shape in `packages/client/modules/package.json`. Fix: fixtures
   rewritten to the nested form; B3/B4 rewritten to assert the true
   **fail-loud-at-boot** contract (activation-pass failures aggregate into
   `ClientPackageCompositionError`; child exits code 1 before the web URL prints; the
   separate dump-config call still lists the row). No upstream defect — the flat form
   is simply a misdeclaration, and its silence is recorded as limitation L6-4.

## 5. Known-limitations register (aggregated P2-T1..T6)

Single source of truth: `manifest.knownLimitations` (24 entries, each with status +
evidence; machine-checked by rule `limitations-complete` on every run).

- P2-T1: L1-1 frontend bundle 404 in sandbox; L1-2 CI not local; L1-3 fixture regen
  only on byte-clean tree; L1-4 port policy.
- P2-T2: L2-1 session/flush not a durable publication barrier (mitigated); L2-2 jsonl
  write-behind .tmp semantics; L2-3 event-vocab whitelist read-side fail-closed only.
- P2-T3: L3-1 sqlite residue (T3 DSH_HOME); L3-2 leftover preset p2t3-scope; L3-3 patch
  layer ends reset+[]; **L3-4 P2-T1 latent defect `resetPatchLayer` array→writeFileSync
  (reported; worked around by groups writing the file directly — note: since the int
  integration commit 4f70960 the harness method is fixed, later groups may call it
  directly)**; L3-5 loader apply-order race (mitigated by named-export inject);
  L3-6 deterministic instance log name.
- P2-T4: L4-1 no DEEPSEEK_API_KEY (all 20 cells model-independent); L4-2 MCP
  streamable-http only; L4-3 aux port 3491 transient.
- P2-T5: L5-F1..F4 (interrupt no-op on absent target; child detach race by design;
  live store process-scoped; trace vs listDescendants semantics).
- P2-T6: L6-1 transform-types flag deviation (B2-scoped); L6-2 browser rendering out of
  machine-level scope; L6-3 deterministic log name (negative logs persist until
  rewritten); L6-4 flat top-level `"dsh.client"` key silently ignored by the registry
  (reads nested `pkg.dsh.client`) — misdeclared rows vanish with zero diagnostics.

## 6. Bugs / findings carried forward

1. **T2 discovery (pre-existing)**: bare-command (no `--report-dir`) runs of the
   agent-lifecycle / storage-fork-descendants groups originally lost their observation
   directory; fixed in int by commit 2679316 (fallback to `DSH_HOME/characterization-obs`).
   This task's group deliberately does **not** mutate `config.reportDir`; it uses
   `join(config.logDir, 'obs')`, which is always defined.
2. **T3-reported latent defect (fixed in int 4f70960, carried as L3-4)**:
   `lib/instance.mjs` `resetPatchLayer` passed an array to `writeFileSync`. This task
   still captures/restores the patch file directly via the `patchFile` getter (byte-
   exact), so it is immune either way.
3. **ConnectionController restart dedupe** (observation, not a bug): `lastState`
   persists across stop/start — restart refires `onConnected` without a state event.
   Recorded in seam-report.md §Contract observations.
4. **Client bundle 404 in sandbox** (L1-1, carried from T1): `GET /?token=…` still
   404s for index.html in this sandbox; the B2 cookie exchange asserts on the
   **redirect + Set-Cookie** of the launch URL, which is the machine-level proof.

## 7. Manual double-check (final)

- upstream `git status --porcelain` → empty; `git diff` → empty; HEAD
  `cd5ef8148158c3a752a658978873241fdf8e2bbc` unchanged — **verified 2026-08-29T21:45Z
  (post-B1, post-T3-observation-restore): all three checks pass**
- ports 3401/3411 freed after the last run (net.connect probe) — **verified
  2026-08-29T21:45Z: both free**
- worktree `git status --porcelain` → only owned paths staged/committed — **verified
  2026-08-29T21:45Z: exactly `dev/agent-workflow/evidence/P2-T6/`,
  `tests/characterization/probes/remote-client/`, `tests/characterization/seam-manifest/`
  (all new/untracked on this branch); the full-harness side effect on committed
  P2-T3 observation JSONs was restored to its committed state (T4/T5 precedent)**
- no push performed (cherry-pick -x to int is the main agent's job) — (confirmed)
