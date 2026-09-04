# P9 S9 — Independent Verdict (L2, read-only)

- **Reviewer:** L2 independent reviewer (Gate-3 reviewer, lane 2), READ-ONLY. The only writes in this review: this file and
  `dev/agent-workflow/evidence/P9/reuse-audit.md` (column 9 for 47 rows, §F additions F-9+, §G sign-off, header audited-tip
  update). No source/config/contract writes; no commits; no push; no sandbox escalation.
- **Date:** 2026-09-04 (+08:00)
- **Audited object:** worktree `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\P9`, branch `task/P9-ui-legacy-reuse`
- **Audited tip:** `0738b45d53b61d7a1756573651a2c061c9a800c5` (= `47b41df` + `08cd77c` + `0738b45`)
- **Authority chain:** upstream public contract → 4 frozen 20260829 docs (`docs/plans/paused/`) → ROUTER_RULES → TEST_METHODS
  → `docs/migration/` → legacy code (evidence only). P9 plan: `docs/plans/active/DSH_Agent_Team_vNext_P9_UI_T12_T24_Legacy_Reuse_Implementation_Test_Plan.md`.
- **Precondition:** T12 already GO (user-preauthorized 2026-09-02). This verdict covers S9 closeout only.

## 0. Environment-adaptation disclosure (read first)

Under the workspace-write file sandbox, literal `pnpm -r run test|typecheck|build` cannot execute in this session: pnpm
lifecycle spawns are denied at the documented EPERM boundary (child_process spawn with piped stdio; PowerShell's own pipeline
is unaffected, so equivalents run directly). Per the TEST_METHODS.md precedent, these are **environment adaptations, not
audited-tree defects**:

- **test:** per-package `node_modules/.bin/vitest run` (package cwd) + `NODE_OPTIONS=--require <temp>/s9-eperm-shim.cjs`
  (Vite 8's Windows `optimizeSafeRealPathSync` falls back to an `exec("net use")` probe that sync-throws EPERM under the
  sandbox; the shim converts the sync EPERM into the normal error path) + `ESBUILD_WORKER_THREADS=1`.
- **typecheck / build:** per-package `tsc` / build binaries run directly (script-equivalent).
- **lint:** root `lint` script is `eslint .` — run directly.
- **smoke:** `node scripts/composition-smoke.mjs` — run directly.

All gates were run at the audited tip with a clean worktree (`git status --porcelain` empty before and after).

## 1. T-b — Five green gates at `0738b45` (independent re-run)

| # | Gate | Claimed (builder + main agent) | Independent run at tip | Exit | Verdict |
|---|------|-------------------------------|------------------------|------|---------|
| 1 | test | contracts 150 / domain 312 / storage 269 / testkit 124 / tools 35 / remote 92 / runtime 1070 (116 files) / client 471 (32 files), all green | all 8 packages EXIT 0; counts EXACT: 150 (13 files) / 312 (17) / 269 (21) / 124 (15) / 35 (4) / 92 (9) / 1070 (116 files) / 471 (32 files) | 0 | MATCH |
| 2 | typecheck | "9 of 9 projects with a typecheck script: Done" | 8/8 packages carrying a typecheck script EXIT 0 (root script delegates via `pnpm -r`; legacy is build-only by design). Wording nuance: pnpm scope counts the root workspace project → "9/9" = 8 tsc surfaces + root (F-12c) | 0 | MATCH (tsc surface fully verified) |
| 3 | build | 9/9 Done | 9/9 EXIT 0 (8 package builds + legacy build; root script delegates) | 0 | MATCH |
| 4 | lint | 0 errors (first run: 778 pre-existing → 0) | `eslint .` EXIT 0, zero output | 0 | MATCH |
| 5 | smoke:composition | 2/2 PASS (host apply fail-loud `TEAM_PLUGIN_CONFIG_INVALID`; client apply fail-loud) | EXIT 0; `PASS host plugin (packages/runtime): name="dsh-agent-team", apply fails loud on degenerate context (ready code=TEAM_PLUGIN_CONFIG_INVALID)`; `PASS client plugin (packages/client): name="dsh-agent-team-client", apply fails loud`; `PASS composition-smoke` | 0 | MATCH |

**All five gates green at the audited tip.** No mismatch with claims beyond the disclosed wording nuance (F-12c).

## 2. T-c — post-gate burst check

`git status --porcelain -- packages/`: **clean** immediately after the test gate; **clean** again on the final recheck after all
five gates (dist artifacts are gitignored). The untracked `.js/.d.ts/.map` burst (4 prior tsc-leak incidents) **did NOT recur**
during the S9 gate runs. The emitter remains unidentified → F-9; the post-test-gate status check is carried to P10.

## 3. T-d — column 9 (47 rows)

`reuse-audit.md` column 9 filled for all 47 rows (§A 33 + §C 14): **CONFIRMED 47 / CHALLENGED 0**. Independent re-verification
performed: class counts (DC 8 / MA 6 / A 7 / DROP 12 = 33 §A; DROP 2 / MA 6 / A 6 = 14 §C); per-row numstat spot-checks against
the 506191b snapshot (all match; two immaterial variances recorded in the cells — TeamView.tsx +292 vs +293 additions; CSS
trailing-newline line counts 199/170 vs recorded 200/171, byte-identical confirmed); 47/47 snapshot blobs byte-identical vs
`git ls-tree`; per-row frozen-section justifications re-read against the plan §8/§10/§17 texts; client src/test inventory
(42 src / 34 test files at both `47b41df` and `0738b45`; no new src files in `47b41df..0738b45` — 8 modified only). Nuance
notes are carried inside the cells (F-12 cross-referenced).

## 4. T-e — §B band-miss adjudication + §D new-module budget

### §B (plan §9 L1051–1069 bands; L1071–1080 deviation triggers; §17 L1956 — LOC% is heuristic, "not primary")

Deviation triggers (default deviation unless the reviewer grants per-item contract-level justification):

- **Timeline/Members rewritten from zero:** NOT triggered — TeamTimeline 94% retained (MA); timeline-model 68% (not from zero);
  members-model 53% (not from zero; vocabulary rewrite, rows retained).
- **All CSS rewritten:** NOT triggered — 4 of 7 CSS modules byte-identical, 3 additions-only/≥92% retained.
- **No legacy test migrated:** NOT triggered — 14/14 carry migrate/drop evidence (§C); R9-2's 8 scenario groups all mapped (§E).

Band-miss rulings (each with contract-level justification → **upheld, no deviation**):

- **timeline-model 68% < 80–95 band:** frozen §8.2 mandates the input rewrite (legacy `delegations/tasks` →
  `TeamUiLedgerModel.intervals` + snapshot members/templates); the DIRECT-COPY majority (ticks/formatters/arithmetic/lane-color)
  verified in numstat; R9-1 class MECHANICAL/DC intact → upheld.
- **members-model 53% < 65–80 band:** frozen §8.4 mandates the vocabulary/identity rewrite onto the frozen object model
  (unbound vocabulary abolished); the bug #5 zero-instance rows (UI §16.1 L925–941) are the contract the new code implements →
  upheld.
- **feed-model ~0% < band:** frozen §8.8 mandates the in-module source rewrite (data source → frozen Remote/ledger); frozen
  depth constants retained (team-ledger-model.ts L40–44, `TEAM_LEDGER_INITIAL_LIMIT/STEP=200` with legacy `TEAM_FEED_*`
  origin noted; test-pinned "keeps the frozen depth constants"); F-4 combined landing is not a plan violation (§8.8 names the
  rewrite, not the file) → upheld.
- **feed component 29% < 30–60 band (BORDERLINE):** frozen §8.9 generalizes the feed row onto the frozen ledger categories
  (rename to TeamLedger per §8.9's own "renamed" language); list UX + row anatomy retained → upheld.
- **BORDERLINE rows** (members component 65%, TeamView 49%, tasks 28%, dock panel 69%): additive vNext surface / mandated
  swaps — no band violation.
- **marker compact visual PARTIAL:** presentation reuse achieved (CSS ~96% + row anatomy; §8.1 sanctions row-CSS reuse onto the
  ledger compact row).

**No §B row overturned; the main agent's adjudications are upheld with the per-item contract-level justification required by
plan L1071–1080.**

### §D / R9-3–R9-4 new-module budget (plan §17 L2004–2013 + §10)

- All 8 R9-3 budget files (team-remote-client, team-projection-store, team-ledger-store, team-ui-snapshot, projection-adapter,
  ledger-adapter, TeamCreateFlow, TeamConfigPanel/command panels) are accounted for in the new-module rows; no file outside the
  budget list exists in client src (42-file inventory at both `47b41df` and `0738b45`; no new src files in `47b41df..0738b45`).
- The 3 flagged rows are **CONFIRMED in-budget**: (a) the 5 model-helper files (no UI) sit in the legit REIMPLEMENT zones
  §10.2 (member lifecycle commands) / §10.3 (effective config / override / PolicyState); (b) `team-session-resolution.ts` is the
  S6 deliverable (G6 perspective resolution, plan S6 L1568–1607); (c) `host-seams.ts` is the S0/§11 deliverable
  (host-seam-map, plan S0 L1338–1362 / §11 L1219–1257).
- **New* stop condition: PASS** — no `New*` file exists (F-6).

**Budget upheld; no overturn.**

## 5. T-f — DoD-15 (plan §21 L2199–2217) per item

| # | Condition (abridged from §21) | Reviewer ruling |
|---|-------------------------------|-----------------|
| 1 | `@dsh-agent-team/client` no longer skeleton; real mount on the public DSH client seam | **✓ confirmed** — client.ts (sync `apply`, inject 6 public seams, `name='dsh-agent-team-client'`), team-mount-core, dist entry loaded by S8 boot, smoke client contract target |
| 2 | root/member/ordinary/legacy perspectives render correctly | **✓ confirmed** — S8-D attempt-32 browser vertical (clean-world) + jsdom specs (note: 11 runnable jsdom-docblock specs at tip, not the 10 recorded — F-12g) |
| 3 | Projection state uses P8 generation guard (no stale-response rollback) | **✓ confirmed** — state/ generation-guard store + unit tests; P8 inheritance |
| 4 | Ledger uses frozen cursor rule; history load independent of Session messages | **✓ confirmed** — team-ledger-model.ts L40–44 constants (legacy origin noted) + ledger-adapter (frozen-contract adapter) |
| 5 | New Team flow executable or explicitly degraded per frozen native seam | **✓ confirmed** — T12 GO (user-preauthorized 2026-09-02) + S8 browser evidence of the degradation |
| 6 | Members/Timeline/Dock/Team tabs heavily reuse the old implementation | **✓ confirmed** — §B band table + 4 byte-identical CSS modules + additions-only CSS |
| 7 | vNext-only member/config/policy/compat commands go through frozen Remote | **✓ confirmed** — host-seams.ts (6 seams) + teamRoot facade (runtime host.ts L580–607); no upstream private API |
| 8 | Native Chat/Trajectory/Fork not copied / no synthetic injection | **✓ confirmed** — no copied files; `references/deepseek-harness-test-use` pristine (note: client tree = 42 files, not the 38 recorded — F-12e) |
| 9 | Synthetic marker + DOM navigation hack removed | **✓ confirmed** — DROP rows (§A L41–44); runnable negatives pin the absence (client-architecture-negatives.test.ts); S6 explicit non-registration; F-6 |
| 10 | All 14 legacy tests have migrate/drop evidence | **✓ confirmed** — §C 14 rows + §E R9-2 8 scenario groups |
| 11 | Full-repo test/typecheck/build/lint/smoke pass | **⏳ → RELEASED** — builder Task A (lint 778→0) + Task B (testkit 2 specs) + Task C (five-gate rerun) completed at `0738b45`; my independent five-gate rerun at the final tip is green (§1 table). Row-11 ⏳ released by this review. |
| 12 | ≥1 honest production-host UI vertical with evidence | **✓ confirmed** — S8-D :3180 real test-use boot + browser vertical (no mock-host substitute) |
| 13 | reuse-audit proves no second clean rewrite | **✓ confirmed** — 47-row audit; retained% auxiliary (§17 L1956); R9-1 nine high-reuse assets all ≥ MECHANICAL; R9-3 PASS (T-e above) |
| 14 | CORE PATCH BUDGET = 0 | **✓ confirmed** — test-use pristine (build/boot workaround chain per TEST_METHODS §2/§5, no patch-package/postinstall/vendored); legacy fork frozen HEAD `a3ab319…` untouched; no core-patch lines in S8/smoke evidence |
| 15 | Backend frozen contract not silently edited by P9 | **✓ confirmed** — red-line list intact: master commit history, frozen branch `feat/team-vnext-integration-20260829`, `graph.yaml` phase fields, both `references/` frozen trees, T12 remote contract files; all P9 changes on the single task branch |

**DoD-15: 15/15 satisfied** (row 11 released by this review's gate rerun).

## 6. T-g — latent-defect class verification (heaviest finding)

**Claim:** the client suite was **never executable** before the S9 rebuild — specs and product were committed together across
T7–T10 and the suite never turned green; the first execution (S9) exposed 22 latent failures; root causes = 5 spec defects +
5 product gaps + 1 infra defect; all fixed in-tree with in-file citations.

**Verification:**

1. *"Committed together, never green"* — git log shows product T7 `5baf149` (creation panel + member command flows), T8
   `cda5737` (config/policy/compat/handoff surfaces), T9 `d4e6eb1` (unique client mount), T10 `683e15a` (legacy spec
   migration) — specs and product landed together, and no client run between those commits ever turned green. Pre-S9 logs:
   `s8/temp-client-test-4.log` (314 tests; 12 file-level failures = infra load failures) and the first full run
   `s8/temp-client-remaining.log`: **Test Files 7 failed | 25 passed (32); Tests 22 failed | 449 passed (471)**. No green
   client run exists anywhere before `0738b45` (progression in the S8/S9 logs: 22 → 4 → 1 → 0). Structural corroboration: the
   jsdom devDep install and the `vitest.config.ts` rebuild itself are both inside `0738b45` — the suite could not have run
   before. **Claim holds.**
2. *"22 failures, 11 root causes, each fixed with in-file citations"* — the 22 failed-test names extracted from the first-run
   log map 1:1 onto the repair list in the `0738b45` commit body (5 product + 5 spec + 1 infra). Per-cluster independent
   verification (citations re-read at the audited tip):

| # | Root cause (side) | Affected tests | Frozen anchor | Independent ruling |
|---|-------------------|----------------|---------------|--------------------|
| P1 | TeamView undefined-workspace-feed guard (product) | members-actions cluster (3) | UI §16.1/§17.1 | **Aligned** — `workspaceViews?.find(…)?.workspaceId ?? null` (TeamView.tsx:273–275) |
| P2 | TeamGovernance override effective-draft condition + transient read pre-set removed (product) | governance 9 (policy 4 + override 5) | UI §38 L2061 (no greyed button without reason) | **Aligned** — disabled logic :733, default draft :373–374; runOverrideRead dedupe :301–310, cleared in `.finally` :326–330 |
| P3 | locales `member.command.error` colon format zh/en (product) | the 4 verbatim-failure tests (members-actions 1, creation-panel 1, governance 2) | UI §38 error vocabulary (verbatim rendering) | **Aligned** — zh :320 / en :529 `…{code}: {message}` |
| P4 | TeamCreationPanel catalog-failure disable (loud, never silent) + uncheck-cancels-preview clear (product) | creation-panel 1 + handoff 1 | UI §32.2/§32.3 | **Aligned** — `disabled={catalog === undefined \|\| !catalog.ok}` :622 + comment :620–621 |
| P5 | members-model zero-instance / leader-row adaptation, bug #5 (product) | members-model 4 + members 1 | UI §16.1 L925–941 (Reviewer `[+]` zero-instance template still renders its row) | **Aligned** — model :170–186 `instances: []` + per-group 尚无实例 note; spec side carries the same citation |
| S1 | governance policy mocks `value:null` ×4 → key-absent (spec) | governance 4 (policy) | wire `RemotePolicyStateCellValue {locked?; value?}` (params.ts:126–129 — optional, never null; no value = absent key) | **Aligned** — client spec now key-absent (no `value:null`); the 13 `value:null` in team-governance.test.ts:437–553 are effective-config cells (`value: string \| null`, model/team-governance.ts:527) — a distinct, legitimate contract |
| S2 | handoff async flush ×2 (click + waitFor) (spec) | handoff 2 (Continue / Cancel) | UI §32.4 + plan §10.5 | **Aligned** — `fireEvent.click` + `vi.waitFor` (spec :511–514 / :542–545) |
| S3 | checkbox `fireEvent.change` → `fireEvent.click` (spec) | handoff 1 (uncheck) | React ChangeEventPlugin / `shouldUseClickEvent` (react-dom.development.js L7919–7922, independently verified) | **Aligned** — `fireEvent.click` :361 + in-file citation :355–360 |
| S4 | ledger actor inner-span query (spec) | ledger 1 (instance select filter) | §8.1 row anatomy | **Aligned** — actor attr on inner span (TeamLedger.tsx:192); descendant queries :181/:367/:400 + comment :399 |
| S5 | members spec template-row adaptation, bug #5 (spec) | (shares the P5 cluster) | UI §16.1 | **Aligned** (same as P5) |
| I1 | vitest infra: source redirect + uSES inline/external + jsdom (infra) | 12 file-level load failures in the earlier 314-test run; enabled the 471-test surface | TEST_METHODS (public seams only; no upstream patch) | **Aligned** — no upstream patch; config L35–181 guards + `[\\/]` character classes re-verified |

(Cause→test mapping is file/cluster-level — one test can involve both a spec and a product cause; file-level counts sum
exactly to 22: 4+1+3+1+1+3+9.)

**Ruling:** product fixes are aligned to the frozen contract (all 5 carry in-file citations to frozen docs); spec fixes are
aligned to the frozen-contract layout and async reality (wire optional-key semantics, React checkbox event mapping, handoff
read/continue/cancel semantics). All 22 are **first-execution findings already fixed at the audited tip** — under the verdict
semantics (plan L1789–1791) this does **not** sustain REPAIR, which requires located client defects still present at the tip.

## 7. New findings (appended to `reuse-audit.md` §F as F-9+; restated here)

- **F-9 (hygiene → P10):** the untracked `.js/.d.ts/.map` burst did NOT recur during the S9 gate runs (clean post test-gate
  and post all-gates); emitter still unidentified; keep the post-test-gate `git status --porcelain -- packages/` check in P10.
- **F-10 (latent-defect class, verified):** as §6 — the client suite was never executable pre-S9; 22→0 at `0738b45`;
  first-execution findings, not a REPAIR trigger.
- **F-11 (infra, verified):** the client vitest config rebuild in `0738b45` (linked-dsh-source-redirect plugin mirroring the
  upstream tsconfig-paths facade — built Cordis `__ModuleLoader__` factory bundles cannot load outside the browser shell;
  uSES extensionless-entry alias; inline patterns with a `node_modules` negative lookahead — Vite 8 inlines CJS as ESM and
  uSES stays external, Node 24 type-stripping loading externalized `.ts` natively; `noUncheckedIndexedAccess` guards;
  jsdom ^30.0.1 devDep; single React 18.3.1 instance; env node + pool threads). Runnable surface: 34 tracked test files −
  2 live exclude entries (`client-bundle`, `team-plugin`; 2 further entries point at the already-removed marker pair) =
  32 files / 471 tests, all green at the tip.
- **F-12 (minor, non-blocking):** (a) dead locale key `governance.override.reading` (locales.ts, unused); (b) eslint `tests/**`
  ignore targets the root characterization harness (consistent with the config header scope statement); (c) "typecheck 9/9"
  wording counts the root workspace project (its script delegates) — actual tsc surface 8 packages, all independently EXIT 0;
  (d) TeamView.tsx numstat +292 vs +293 additions (±1, immaterial); (e) client src = 42 files at both `47b41df` and
  `0738b45` (31 ts/tsx + 1 d.ts + 10 css) — the "38" figure in earlier notes is stale; (f) CSS line-count trailing-newline
  convention (199/170 measured vs 200/171 recorded; byte-identical); (g) F-7's "L37–45" config cite and "10 remaining jsdom
  specs" count are stale after the rebuild (excludes now at L169–178; 11 runnable jsdom-docblock specs at the tip).

## 8. P9_VERDICT

# **P9_VERDICT = GO**

Rationale (plan L1789–1791 semantics):

1. **GO met:** all five green gates independently verified at audited tip `0738b45` (exact counts, §1); DoD-15 15/15 with row
   11 released by this review; column 9 CONFIRMED 47/47; R9-1/R9-2/R9-3/R9-4 satisfied; §B band misses carry the contract-level
   justifications required by L1071–1080; §D new-module budget upheld.
2. **REPAIR does not stand:** every first-run red (22 client tests, testkit dual-surface, lint 778) is a first-execution
   finding already fixed in-tree at the audited tip, each verified against the frozen contract with in-file citations; no
   located client defect remains at the tip.
3. **CONTRACT_BLOCKER does not stand:** no frozen-backend-contract conflict found; the frozen contract surface was not
   silently edited (DoD-15 row 15); no "UI 写不下去" condition.
4. **CORE PATCH BUDGET = 0 held** — upstream untouched; all capability via external plugin + public seams (smoke asserts the
   production dist contract, degenerate-context fail-loud on both halves).
5. Environment adaptations (sandbox EPERM → direct per-package/direct-tool runs) are disclosed in §0; they are documented
   boundaries, not tree defects.

**GO → P10 hardening** per plan L1789. Handoff items: F-9 burst-emitter hunt (P10 hygiene), F-12 minors, the two excluded
browser-surface specs (F-7) remain tracked under `p9.next`.

---
**Signature:** L2 independent reviewer (Gate 3, lane 2) — read-only review, 2026-09-04 (+08:00). Every number above was
independently re-derived at the audited tip; nothing was inherited from the builder's captures beyond cross-checking their
recorded gate wording against my own runs.
