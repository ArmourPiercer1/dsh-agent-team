# FINAL STATIC GATE REPORT — F3 / F11 / F9 / T1.4 Repair Round

- **Candidate**: `int/repair-r1` @ `5bcb4b6` (post-static-supplement tip; includes `d7e5829` map refresh + `5bcb4b6` p4t6 pin)
- **Base**: `9b582a1` (`9b582a1c4e7195c0078b8f228565713efb85cdd8` = `origin/master`)
- **Date**: 2026-09-08 13:40 +08:00
- **Role**: planning / evidence consolidator (read-only + this evidence file only)
- **Inputs consolidated**:
  - Audit 1 — independent gate-readiness audit (verdict `READY-BUT-LIVE-INFRA-MISSING`)
  - Audit 2 — independent audit vs frozen contract, per-workstream diff inspection (verdict `READY-BUT-LIVE-INFRA-MISSING`)
  - Audit 3 — readiness verdict audit with fresh deterministic + partial live runs (verdict `READY-BUT-LIVE-INFRA-MISSING`)
  - In-repo evidence: `minimum-frozen-contract.md`, `adjudications.md`, `batch1-validation/REPORT.md`, `playwright-workflow/REPORT.md`, per-workstream dirs (`f3/`, `f3c/`, `f11/`, `f9/`, `f9u/`, `t14/`, `playwright-r1/`, `playwright-workflow/`), `tests/mock/evidence/F9-PLAYWRIGHT-ASSETS.md` (committed in `b34f96c`)
  - Live state re-verified by this consolidation (git, remote, checkouts, ports, one read-only :3080 probe)
- **Constraint honored**: no product code, no `docs/plans/active`, no `graph.yaml`, no `SESSION_ROUTER_LOG.md`, no push. This file is the only artifact written.

**Consolidated verdict (static): candidate is contract-complete and deterministic-green; the gate is NOT closed — live-matrix evidence is missing (environmental `TEST_INFRA_BLOCKER`, not a product defect). Push is NOT allowed at this time.** Rationale in §7.

---

## 1. Candidate commits

Range `9b582a1..97d4729`: **12 commits, 220 files, +20366/−1275** (re-verified by this consolidation: `rev-list --count` = 12; `diff --stat` = 220 files / +20366 / −1275 — exact match with all three audits).

Order on `int/repair-r1` (oldest first):

| # | SHA | Workstream | Content (one line) |
|---|---|---|---|
| 1 | `e72efd6` | F11-L | Count-based ledger completeness (INV-9.2) at all four client sites + shifted-base/nine-case tests |
| 2 | `1a19fd6` | F3-A | Work-chain 3-phase lock split (INV-9.1): `admitWorkLocked` / `deliverWork` (no chain) / `settleWorkLocked`; throw-after-settle N3; N6 Phase-C no signal; H3 overlap documented |
| 3 | `e59f831` | F3-B | Root initial-work lock scope (N1 sibling): gate+Phase A one acquisition, Phase B released across the root turn, Phase C fresh-read convergence |
| 4 | `4f6e4f9` | F3-C | Messaging coordinator private-chain split (H2): `prepareDeliveryLocked` → `submitDeliveryInput` (no chain) → `commitConfirmationLocked` + duplicate-confirmation convergence (R3 exactly-once preserved) |
| 5 | `31e0844` | F9-H | Remote v4 (`REMOTE_CONTRACT_VERSION_V4=4`, supported {1,2,3,4}, 27 methods, `REMOTE_V4_ONLY_METHODS=['team.resolveControl']`) + frozen closed params (no caller/role/actor, U3) + `deriveControlCaller` host-stamped human (assertTeamScoped first) + A25 control service wiring (unchanged) |
| 6 | `8e9e211` | T14-H (T1.4-B) | `intent.probe` = host row-config facts + caller `persona`-only (U5 strict; INV-9.4); same-world probe/admission; required→FATAL / optional→WARNING preserved |
| 7 | `64947dc` | F9U | The four gate-review UI supplements (frozen UI §26.1–§26.4): detail panel, external-policy two-line block, kind-aware Allow/Deny, served-version side-effect-free probe; 13 new locale keys (en/zh) |
| 8 | `566c1c7` | F9 evidence | `F9-PLAYWRIGHT-ASSETS.md` (selector/text table, re-run recipe, §9 split, compliance) |
| 9 | `e91cdf2` | evidence | Freeze repair contract + Playwright regression assets |
| 10 | `b34f96c` | F9 assets | Persistent Playwright F9 gate assets: `f9-check.mjs` (zero-model-turn modes + 23-assert offline selftest), `ui-gate.mjs` additive extension, gates `f9-g3-{pending,allow,deny}` / `f9-g4-policy`, deny-half prompts, V2 deps verbatim |
| 11 | `c46d385` | F9 fix | Self-caught §26.4 DOM/selector correction on the `f9-g4-policy` gate (the gate-review round's one asset correction) |
| 12 | `97d4729` | docs | Record F3/F11/F9/T1.4 repair validation (appends 9 lines to `SESSION_ROUTER_LOG.md` — the hunk Audit 3 quarantined; this consolidation relied on it for nothing) |

Remote state (re-verified by this consolidation, `git ls-remote --heads origin`):

- `origin/master` = `9b582a1` (the base itself) — the candidate history is **entirely local**.
- **No `origin/int/repair-r1` and no `origin/task/repair-r1-*`** → nothing has ever been pushed.
- Task branches `task/repair-r1-*` (f11-ledger, f3-lock-scope, f3-root-initial-work, f3-messaging-sibling, f9-human-control, f9-playwright-assets{,-refresh}, f9-ui-supplements, t14-host-facts) exist locally with worktrees, per the contract §7.2 branch table.

Contract conformance: all three audits independently confirmed the diff against `minimum-frozen-contract.md` §5–§6 + `adjudications.md` (U1–U7) with **zero contract violations found** (F3 three-phase split incl. N1/N3/N6/H2/H3/H5; F11 four count-domain sites; F9 v4 closed params / host-stamped human / v1–v3 byte-preservation / `control/types.ts` zero diff; T1.4 strict U5 merge on the same injected facts source as the admission gate).

---

## 2. Deterministic PASS matrix

All entries below were executed by the auditors (independent re-runs, not report-reading). "A1/A2/A3" = Audit 1 / 2 / 3. Count differences between audits are runner-scope differences (plain-node shim runner vs real vitest vs candidate-identical worktree); **no audit reports any product regression**.

| Surface | A1 | A2 | A3 | Consolidated |
|---|---|---|---|---|
| F3 focused: `f3a-lock-scope`, `f3b-root-initial-work-lock-scope`, `f3c-messaging-sibling` (+ root-initial, coordinator per scope) | 7/7 + 12/12 + 2/2 (node runner) | in 13-file focused set: 200/200 | 21/21 (f3a 6 + f3b 12 + f3c 2 + root-initial + coordinator, shim runner) | **PASS** (red-before-green evidence genuine: pre-fix deadlock/budget-exhaustion) |
| F3 non-regression (`p8s3`, `p8s5b`, `p8s3b`, `p6t5`, `tcm-m3`, `p6t3-*`) | 12/12, 26/26, 16/16, 18/18, 8/8, 5/5, 14/14 re-runs | in 13-file set: 200/200 | 143/143 (12 files) | **PASS** (H5 CR-8 fencing pins green) |
| F11 focused client (`team-ledger-store`, `ledger-adapter`, `team-ledger-model` + fixture suite) | green (per committed `f11/` evidence) | in 8-file client set: 118/118 | in client pure suites: 88/88 | **PASS** (92/92 committed in `f11/green-f11-focused.txt`; red-f11 pre-fix genuine, 12 failed on frontier-vs-total) |
| F9 host focused: `f9-remote-v4`, `f9-s6-resolve-control`, `f9-control-exactly-once`, `f9-remote-client-v4` | 36/36 + 14/14 + 8/8 + 5/5 | in 13-file set: 200/200 | in 32/32 focused (s6-principal, s6-remote, version/catalog, params, dispatch, control-service guard) | **PASS** |
| v1–v3 byte-preservation pins (`d1-remote-v3`, `tcm-m1-remote-v2`, `p8t3` round-trip/version-matrix, negative matrices) | preserved suites green | in 13-file set: 200/200 | p8t3 14/14 + version-matrix 16/16 fresh | **PASS** |
| T1.4 focused: `t14h-probe-merge` + T14 non-regression set | t14h 10/10 | in 13-file set: 200/200 | in 32/32 focused; `t14/focused.txt` 29/29 suites (committed) | **PASS** |
| Client full vitest (fresh detached worktree at `97d4729` / candidate-identical tree) | 639/640 | 639/640 (46 files, 640 tests) | 639/640 (`.worktrees/repair-r1-f9u`, `packages/client` byte-identical to candidate) | **PASS except 1 pre-existing baseline failure** (see §3.1); all 6 F9/F9U/F11 React specs green |
| Root vitest full (`packages/*/test/**/*.test.ts`, 252 files) | — (shim sweeps instead) | **2788/2789** — 1 fail = stale p4t6 pin (§3.2) | — | **PASS except §3.2** |
| Runtime full sweep (committed plain-node, 134/135 files) | bad set = exactly the 7 pre-existing shim-surface files | — | bad sets identical to pre-existing 7, no new | **PASS** (§3.3) |
| Remote full (shim) | — | — | 185 pass; only failures = 5 pre-existing `d1-remote-v3` `toBeDefined` shim-surface (§3.4) | **PASS** (strict improvement vs baseline 147p/6f → 185p/5f) |
| Typecheck `tsc 6.0.3 --noEmit` runtime / remote / client (+ all-9 build face per leaf evidence) | all exit 0 | all exit 0 | all exit 0 (fresh) | **PASS** |
| `f9-check.mjs selftest` (offline, 23 asserts incl. negative assertions) | 23 PASS / 0 FAIL, exit 0 | 23/23 PASS, exit 0 | 23/23 PASS (fresh) | **PASS** |
| Playwright asset syntax: `node --check` all mock scripts + JSON parse all gate/expected files | 11/11 scripts valid; 5 gate JSONs valid (assertions match implementation DOM/locales incl. `c46d385` self-caught fix) | all valid (6 files) | 8/8 gate scripts valid; `smoke-g1.json` valid (earlier "INVALID" = PowerShell ANSI codepage artifact, re-verified with `JSON.parse`) | **PASS** |
| Live wire-level (sandbox, zero model turns, real boot on 3181) | preflight 8/8; version-gate 5/5 (v1/v2/v3 exact `method-version-unsupported` echo; v4 → `CONTROL_REQUEST_NOT_FOUND` = port reached; spoofed `caller` → `malformed-params`/`unknown-field` pre-derivation) | same (committed `playwright-workflow/` + today's re-run per A3) | same | **PASS** (see §4 for what this does and does not close) |

Product-seam confirmations (all three audits, line-level): F3 phases exactly per contract in `work-execution.ts` / `root-initial-work.ts` / `messaging/coordinator.ts` / `router.ts`+`effects.ts` (no new lock maps, no coordinator bypass, no fire-and-forget, INV-9.1 doc adopted); F11 count-domain at all four sites + `TeamLedger.tsx` zero-rows companion, frozen tracker `push/ledger-page.ts` untouched; F9 closed dispatch vocabulary (7 `CONTROL_*` + `TEAM_REMOTE_TEAM_RESOLVE_CONTROL_UNAVAILABLE`, guard codes excluded), no try/catch in port body, `packages/runtime/control/` absent from diff; T1.4 `S6RemoteOptions.environmentFacts` = same injected source the admission gate consumes (single source of truth), `MALFORMED_DTO` preserved.

---

## 3. Known baseline failures (pre-existing at base; NOT regressions of this candidate)

1. **`team-creation-panel.client.spec.tsx` L453 — "create happy path" (TCM M4 timing race).** 1/640 in every client-full run (639/640). Byte-identical signature to the pre-existing baseline (D1-verified at `a6d1778`, re-confirmed at `9b582a1` by the F11 run-recipe); spec file has **zero diff** in this range. Out of scope per U7 (no scope expansion) — recorded, not fixed; carried in the risk ledger from G5.
2. **Stale `p4t6-session-event-scan` pin: 630 (re-verified at tip: lines 411–412 `filesScanned`/`files.length` = 630).** Red at base already (base clean tree carries 632 scannable files — 2 team-d1-d6-repair-v2 harness files never recorded) and this branch adds 10 scannable files (`control-surface.ts`, `f9-remote-client-v4`, `f9u-control-surface-model`, `f9-remote-v4`, `f3a`, `f3b`, `f3c`, `f9-control-exactly-once`, `f9-s6-resolve-control`, `t14h-probe-merge`) → clean head = **642** (Audit 2: on-disk scan = 642, exact match). This is the single red in Audit 2's 2789-test root vitest. **Test-only, not a gate exit criterion of any of the four workstreams — but the established pin-update discipline (precedent `9029c9a`: 606→607) requires the next supplement commit to move the pin to 642 with per-package increments + a note recording the 2 pre-existing base gaps.** The denylist audit (the other 9 p4t6 tests: zero violations, zero legacy symbols, quarantine pins, controls) passes.
3. **Seven pre-existing shim-surface failures in the plain-node full-runtime sweep** (shim matcher limitations, identical bad set before/after the candidate): `d1-member-base-tools`, `d1-s6-remote-v3`, `d1-team-ownership-index`, `d2-s6-ensure-root-live`, `d3-member-identity-context`, `d5-instance-contract`, `pbf-default-artifact-urls` (per `batch1-validation/REPORT.md` §known-limitations + Audit 3 re-run). `d5-instance-contract` additionally crashes a shared shim process on async `it` (pre-existing; verified byte-identical with F9 stashed; sweeps isolate one process per file).
4. **Five pre-existing `toBeDefined` shim-surface failures in `d1-remote-v3`** (remote full suite 147p/6f → 185p/5f; the 5 verified pre-date the candidate — 9 such usages).
5. **Client vitest layout dependency (pre-existing config quirk, document-only):** `packages/client/vitest.config.ts` computes `referencesRoot` 4 levels up, which resolves to the repo's `references/` only from a nested `.worktrees/<x>` checkout; from the main checkout 23 client files fail import resolution. Both configs unchanged by the branch. Documented workaround (nested worktree + `pnpm install --ignore-scripts` + `net use` stub, all reversible, nothing committed) is what Audits 2/3 used successfully. Consider a path-depth fix in a later non-gate task.

Carried risk-ledger item (not a candidate failure): `p6t1-parallel` concurrent-load flake (isolated 9/9 protocol, G4/G5 precedent).

---

## 4. Live Playwright blockers (the verdict driver)

The remaining acceptance surface is **live mock-world only**. All three audits converge on the same exact blockers (evidence: `playwright-workflow/REPORT.md` §1–§2, exact exit codes and verbatim outputs; `playwright-r1/` for the identical r1-round signature):

- **B1 — Model credentials absent (world-state blocker).** `tests/mock/.dsh-home-repair-r1/.credentials.yaml` has no `QIYUAN_SELF_API_KEY` ref → boot `keyConfigured=false` → **zero model turns possible** → no members ever created (durable domain: 2 team sessions, only `inst-leader` per root, **0 ledger rows / 0 control facts**) → no `user-approval` control request can exist (requests are created only by a member inside a model turn) → `f9-check pending` exits 2 and none of the four F9 ui-gate configs can produce its `varsFile`. T1.4's UI-create row likewise requires a model turn. Fix = user configures the key in the repair-r1 home (value never printed) — see §6.
- **B2 — Sandbox: node-initiated piped-stdio child spawn → EPERM.** `ui-gate.mjs` calls playwright-cli via `spawnSync(process.execPath, [cliJs, …])` with piped stdio → every invocation exits 2 at the CLI precheck (`[ui-gate] playwright-cli failed to run:`, `r.status=null`). Same boundary TEST_METHODS.md §5 documents for the main-agent sandbox; probe evidence in `playwright-workflow/probe-sandbox-and-cli.txt`.
- **B3 — Sandbox: playwright-cli cannot start a browser session (independent of B2).** Default daemon dir outside workspace → EPERM; with daemon dir redirected in-workspace the daemon spawn itself fails (`spawn EPERM` at `Session.startDaemon`, hard-coded `stdio: ["ignore","pipe",err]` in the global CLI package — not editable from this workspace); client↔daemon IPC uses named pipes (`\\.\pipe\pw-*`) which this sandbox boundary forbids. Net: **no browser can be launched from any process in a sandboxed session**; no UI result was fabricated. CLI itself healthy (v0.1.19), chromium binaries present.

**Blocked gate rows** (all require B1+B2/B3-resolution): G1 UI team-create (T1.4 `dtest-bp@1` team-B), G3 pending/allow/deny world-states (`f9-g3-*`), G4 policy world-state (`f9-g4-policy`), T4.1 allow+deny live halves, R-F3 `team_report_progress`-in-turn repeat (T2.6 canary/full), R-F11 live UI half (pagination to real tail, UI last row = seq 136), R-B7 kill transitions (boot#2/boot#3), R6 E2E full set, P5 checkpoint, and the U7 unchanged-fingerprint re-verifications (R-F2 / R-F5 / R-B7 / R-F4 / F7 / F10).

**What IS live-verified (host-side contract level, zero model turns, real boot on 3181):** `MOCKBOOT_READY` with rows mounted; preflight 8/8 PASS; `f9-check version-gate` 5/5 PASS (served-version gating + closed-param enforcement + control-port reachability + spoofed-field rejection). Offline selector↔product cross-verification (Audit 3, my own level in A3): every `data-ledger-*` / `data-resolve-*` / `data-external-policy*` attribute and the frozen en/zh §26.4 strings asserted by the four gate JSONs exist in `TeamLedger.tsx` / `locales.ts`.

**Port/instance hygiene (re-verified by this consolidation, 2026-09-08 13:40 +08:00):** 3181 / 3491 / 3492 **closed**; 3080 open (stable, expected); **3180 open** — an idle leftover test instance (PID 17244 per Audit 3; legitimate test port, not a red-line breach) should be stopped before the live round. Note: Audit 1 reported "no instances on 3180" — the two audits observed at different times; the current observed state (3180 open) is recorded here as authoritative for now.

---

## 5. Upstream / stable-instance compliance

| Red line | State (re-verified by this consolidation unless marked audit-verified) |
|---|---|
| **CORE PATCH BUDGET = 0** | Holds. `references/deepseek-harness-test-use` pristine @ `a66e4702047846cdaa10c66c9d3df3951f5ea70d` (0.1.2-rc.1), `git status --porcelain` **empty** (verified now; audits verified pre/post every run). No `patch-package` / `pnpm patch` / postinstall rewrite / `git apply` to upstream; all capability via plugin + public seams (audit-verified: no patch mechanism in diff) |
| **Stable instance :3080** | Alive and serving: `GET /` → **401** (the rc.1 boot-token gate; the pre-rc "200" check predates it) — probed read-only by this consolidation, plus audits' read-only probes. No launch/stop/rebuild/modify of `D:\deepseek-harness\`, :3080, or its DSH_HOME. Deployment checkout HEAD = `a66e4702`, porcelain clean (verified now) |
| **Legacy frozen fork** `references/deepseek-harness` | Unmoved (audit-verified: zero `references/` changes in range; frozen point `a3ab319927…` / tag `legacy-agent-team-pre-vnext`; never used as a task base) |
| **Frozen surfaces, zero diff in range** | `docs/plans/paused/` (four 20260829 docs), `docs/ROUTER_RULES.md`, `docs/TEST_METHODS.md`, `AGENTS.md`, `packages/contracts`, `references/`, `packages/runtime/control/` (incl. `control/types.ts` resolver roles), frozen push tracker `packages/remote/src/push/ledger-page.ts`, v1–v3 wire bytes (pin suites green) |
| **Mock-world isolation** | Verification only on 3181 + 3491/3492 with in-workspace scratch homes (`tests/mock/.dsh-home-repair-r1`); no instance ever on 3080; API key value never printed into evidence |
| **Baseline discrepancy (recorded, not a violation)** | TEST_METHODS.md §1 documents baseline `76fda72979`; the actual test-use + stable-deployment checkout carries `a66e4702` (same 0.1.2-rc.1 series; neither is an ancestor of the other). The repair contract records `a66e4702` as the host baseline **"unless the user re-rules"**; candidate evidence is consistently `a66e4702`. Disposition: **doc-alignment item** (R123 precedent: align TEST_METHODS.md §1 to `a66e4702`) **and a user ruling item** (Audit 2 F5): if the live round must run against `76fda72979` instead, the test-use checkout must first be moved in-place (upstream commit, pristine role preserved) and the live round re-baselined. Left to the user |
| **Candidate worktree dirt (pre-existing, not in candidate commits)** | 3 modified tracked logs `tests/mock/hosts/boot1/{dump-config.txt, dump-config-port3181.log, instance-port3181.log}` (from an earlier repair-r1-home first boot) + untracked evidence/scratch dirs (`.playwright-cli/`, `tests/mock/.dsh-home-repair-r1/`, earlier-round evidence). Restore-or-commit deliberately before any push (§6 step 0) |
| **Stale committed artifacts (findings, zero runtime impact)** | Audit 1: 4 stale runtime dist `.map` files (`packages/runtime/dist/…/plugin/{root,s6-remote}.{js,d.ts}.map`) — every `.js`/`.d.ts` byte-identical to a fresh pinned-tsc 6.0.3 build from candidate-tip sources; only the maps encode source positions offset from committed sources (last build ran from an intermediate working-tree state of `root.ts`/`s6-remote.ts`, comment/whitespace-level, zero codegen delta). Debug-tooling only, but the repo's own `scripts/check-artifacts-committed.mjs` category-C rebuild-drift gate would flag them → remediate by re-running the runtime build at the tip and re-committing the 4 maps (§6 step 1a) |

---

## 6. Exact next action (ordered)

**Step 0 — hygiene (non-gating, before anything else; main agent, no gate count):**
1. Restore (or deliberately commit with a boot-log note) the 3 pre-existing modified tracked logs under `tests/mock/hosts/boot1/`.
2. Stop the idle leftover test instance on `:3180` (PID 17244 per Audit 3 — verify identity first); confirm 3181/3491/3492 stay released.
3. (Optional doc-only, uncounted): record the nested-worktree client-vitest recipe in the run-recipe files (finding 5, §3).

**Step 1 — substantive supplements (gate-counted; 1 already consumed by `c46d385`, so these bring the count to 2 of the 3 allowed by ROUTER_RULES §4.3; a further substantive supplement after re-review would auto-escalate to 阻塞 §5):**
1a. Re-run the runtime build at the candidate tip and re-commit the 4 stale `.map` files (Audit 1 finding 1; category-C artifact gate would otherwise flag them).
1b. Update the `p4t6` scan pin 630 → **642** with per-package/per-file increments for the branch's 10 new files, recording the 2 pre-existing base gaps in the same pin note (Audit 2 finding F1; precedent `9029c9a`).
(Both are one small supplement commit on `int/repair-r1`; the p4t6 update is test-only, the map rebuild re-emits tracked build artifacts.)

**Step 2 — user ruling (external; blocks Step 3 only if the user re-rules the baseline):**
- Ruling A: align TEST_METHODS.md §1 baseline to `a66e4702` (recommended; R123-style doc alignment), OR
- Ruling B: live round against documented `76fda72979` → in-place test-use checkout move first + re-baseline (Audit 2 F5).
- User action (required for Step 3): configure `QIYUAN_SELF_API_KEY` in `tests/mock/.dsh-home-repair-r1/.credentials.yaml` (value must never be printed).

**Step 3 — live V2 round (the gate driver). In a session/environment with (i) the configured key and (ii) a usable playwright-cli browser daemon (no piped-stdio spawn EPERM, named-pipe IPC permitted), using `tests/mock/.dsh-home-repair-r1` + port 3181 (managed background boot job), run the persistent asset set per `tests/mock/evidence/F9-PLAYWRIGHT-ASSETS.md` re-run recipe + contract §8.13:**
1. `f9-check.mjs pending` → exit 0 with stable `ctrl-*` requestId → `ui-gate.mjs gates/f9-g3-pending.json` → PASS.
2. Host-side `team.resolveControl` (allow) → `f9-g3-allow.json` → PASS.
3. Deliver `t41-deny-req.md` request → `f9-check pending` (deny) → `f9-g3-deny.json` → PASS (`t41-deny-exec.md` acceptance: token `dtest-v2-req-ua-2`, "attempt once, report raw status verbatim").
4. boot#2 `MOCK_HARD_TOOLS=1` + policy-world request → `f9-g4-policy.json` → PASS (frozen §26.4 two-line block, plain "Denied" absent).
5. `f9-check.mjs consumed` + `f9-check.mjs policy` → PASS (exactly-once, `expectAbsent`).
6. T1.4 mock-model row: UI-create team-B on `dtest-bp@1` via the 3181 mock host (G1 gate row R-T14).
7. V2 3-boot matrix rows: R-F3 canary + full (repeat `team_report_progress` in-turn, delegate settles, durable progress complete), R-F11 both halves (pagination to real tail; UI last row = seq 136), R-B7 kill transitions, R-F2 / R-F5 / R-F4 / F7 / F10 unchanged-fingerprint re-verification (U7 default (b): any change ⇒ new finding, recorded not gate-fail), R6 E2E full set, P5 checkpoint.
8. **Post-flight compliance (must be re-confirmed and logged):** `:3080` still alive (401), test-use `git status --porcelain` empty, ports 3181/3491/3492 released, key value never printed, no leftover processes.

**Step 4 — full adversarial re-review (ROUTER_RULES §3.3.3):** 3 brand-new blind independent reviewers, re-reviewing the **entire gate** (not just the supplements), briefs per §3.1 (gate exit criteria + frozen docs + range + reproduction recipe only; **no prior-round verdicts, findings, or this report injected**; prior round stays in the execution log only). Reproduction floor per contract (unit suites + Batch-2 focused live rows + artifact audit of the full-matrix evidence — not a 3× full-matrix re-run). Gate passes only on 3× 通过/投机通过 (§3.3.1); any 投机通过 triggers the §6 risk-ledger entry.

**Step 5 — push (only if Step 4 passes):** the user's pre-authorized one-time pushes per `adjudications.md` ("Push #1 … after its gate; Push #2 … after its gate, no force-push"), executed by the main agent with SHA + evidence + execution-log lines committed first; `origin/int/repair-r1` is created then (it does not exist today).

---

## 7. Why push is NOT allowed at this time (ROUTER_RULES)

1. **The gate has not passed — §3.3.1.** Gate passage requires all 3 independent reviewers to give 通过 or 投机通过. The current gate-review round is not in that state: the prior round returned **3 × 补充内容** (recorded in `SESSION_ROUTER_LOG.md`), and the three fresh audits — while reporting **no 阻塞 and no contract violation** — unanimously classify the candidate as `READY-BUT-LIVE-INFRA-MISSING`: the gate's live acceptance rows (G3/G4 world-states, T4.1 live halves, R-F3/R-F11 live halves, T1.4 mock-model create, R-B7/R6 E2E/P5) are **gate exit criteria** and their evidence does not yet exist on the branch. "Deterministic green" is necessary, not sufficient, for this gate.
2. **The user's push authorizations are conditional on gate passage and have not yet been consumable — contract §6 red line 8 + `adjudications.md`.** The round's push red line is "no push except the two one-time user-authorized pushes (E2, H2)", and the adjudications bind each: Push #1 "for the completed Batch 1 **after its gate**", Push #2 "for completed Batch 2 **after its gate**". Neither GATE-1 nor GATE-2 has passed (the gate-review round is still in the 补充 + 重审 loop, §3.3.2), so neither one-time authorization is exercisable. AGENTS.md red line agrees: master/int pushes happen only after a Gate passes.
3. **Supplement accounting is at the edge — §4.3.** Substantive supplements already consumed on this gate: **1** (`c46d385`, the stale G4 asset correction requested by the gate round). Steps 1a+1b (map rebuild + p4t6 pin) would consume a **2nd**; after the mandatory re-review, any further substantive supplement would be the 3rd and, if reviewers still do not return all 通过/投机通过, auto-converts the state to **阻塞** (§5.1). Pushing now would freeze the artifact mid-supplement, making any later re-gated change a force-push of gated history — which is **forbidden** (§8.3: "gated 历史禁止 force-push").
4. **The active blocker is a gate-level `TEST_INFRA_BLOCKER` — §5.1.** The missing live rows are blocked by environment (B1 credentials + B2/B3 sandbox), and they block the gate's exit criteria, so per the blocker taxonomy the round is in **blocked-waiting-for-user/environment** state: the main agent "不得自行重试该 Gate" and certainly may not push around it; the blocker is recorded (router log, final section: "Current blocker: `TEST_INFRA_BLOCKER` … until then first-push gate is not closed") and resolution is a user/environment action (§6 step 2–3).
5. **Structural: the branch carries both batches and nothing is gated yet.** `int/repair-r1` stacks Batch 2 (`31e0844`, `8e9e211`, `64947dc` + assets) on top of Batch 1 (`e72efd6`, `1a19fd6`, `e59f831`, `4f6e4f9`) over `origin/master` = `9b582a1`. Pushing now would publish ungated Batch-1+Batch-2 history in one shot, bypassing the contract DAG (E2 after GATE-1 → Batch 2 on a pushed, reviewed base → H2 after GATE-2) and the ROUTER_RULES "Gate 过后才进 master/int" discipline. There is no user one-time authorization covering an ungated push (authorizations cover the two post-gate pushes only; the R124/R126/R130 precedent in `graph.yaml` confirms one-shot authorizations are consumed once and never implied).

**What WOULD allow push:** Step 1 (supplements landed) + Step 2 (key configured; baseline ruling) + Step 3 (live matrix green with post-flight compliance logged) + Step 4 (3 fresh blind reviewers all 通过/投机通过) → then the pre-authorized one-time push(es), no force-push, SHA+evidence+log committed first.

---

## 8. Cross-audit reconciliation notes (discrepancies found while consolidating)

All three audits agree on every substantive point; the following minor numeric discrepancies were resolved by direct verification or flagged as runner-scope:

1. **Committed `client-bundle.js` size**: Audit 1 quotes 954,229 B; commit `64947dc` records 959,026 B; the `playwright-workflow` boot (at `b34f96c`, pre-`c46d385`) served 954,324 B. **Direct verification at tip `97d4729`: `packages/client/composition-shim/client-bundle.js` = 959,026 bytes** (the two `dev/agent-workflow/evidence/**/client-bundle.js` copies are older 845,581 B evidence artifacts, unrelated). The committed tip bundle carries the F9U surface per Audits 1/3 (selector/locale greps).
2. **f3a test count**: 7 (Audit 1, node runner) vs 6 (Audit 3, shim runner, in a 21/21 combined F3 focused set). Runner-scope difference; both green.
3. **`:3180` occupancy**: Audit 1 "no instances on 3180"; Audit 3 observed idle PID 17244 on 3180. Different observation times; **current verified state: 3180 open** (idle leftover; cleanup in Step 0.2). 3181/3491/3492 closed now.
4. **Root full-suite surface**: Audits 1/3 use the plain-node shim sweeps (7 pre-existing bad files); Audit 2 ran real root vitest (2788/2789, 1 = p4t6 pin). Complementary, not contradictory: the union of reds is exactly the §3 baseline list.
5. **TEST_METHODS.md baseline `76fda72979` vs `a66e4702`**: Audit 3 calls it a stale R122 doc pin (alignment item); Audit 2 frames it as a user ruling item (F5). Both retained in §5/§6 step 2 — the doc line is stale either way, but the re-baseline decision belongs to the user.

---

## 9. Evidence index (paths cited by this report)

| Item | Path |
|---|---|
| Frozen contract + DAG + task packages | `dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/minimum-frozen-contract.md` |
| User adjudications U1–U7 + two push authorizations | `dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/adjudications.md` |
| Batch-1 integrated focused validation (committed) | `…/batch1-validation/REPORT.md` + `…/batch1-validation/*.txt` |
| Live wire-level run + exact blocker outputs (committed) | `…/playwright-workflow/REPORT.md` + `f9-{selftest,version-gate,pending}.txt`, `ui-gate-*.json`, `probe-sandbox-and-cli.txt`, `manual-playwright-probe.txt` |
| Earlier r1 live-round blocker signature | `…/playwright-r1/` (`f9-selftest.txt`, `preflight.txt`, `f9-version-gate.txt`, `f9-pending.txt`, `ui-smoke.txt`) |
| Per-workstream red/green/baseline evidence | `…/f3/`, `…/f3c/`, `…/f11/` (incl. `red-f11-focused.txt`, `run-recipe.md`), `…/f9/`, `…/f9u/`, `…/t14/` |
| Persistent Playwright asset doc (committed in branch) | `tests/mock/evidence/F9-PLAYWRIGHT-ASSETS.md` |
| Round state (append-only; NOT modified by this consolidation) | `dev/agent-workflow/SESSION_ROUTER_LOG.md` (final section: "Repair round F3/F11/F9/T1.4 — planning and implementation", incl. current `TEST_INFRA_BLOCKER` record) |
| The three input audits | provided in-task (verbatim); no in-repo copies were written by this consolidation |

**Safety attestation**: this consolidation performed read-only git/checkout/remote queries, one read-only `GET :3080` liveness probe, and port state checks; it wrote exactly one file (this report). No product code, no active plans, no graph.yaml, no router log, no push.
