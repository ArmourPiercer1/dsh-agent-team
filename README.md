# dsh-agent-team

Authoritative repository of the **DSH Agent Team vNext** plugin set.

**Positioning.** This repo implements DSH Team-mode as an external plugin over the
*public* DSH surface only. **CORE PATCH BUDGET = 0**: no upstream source modification,
no private/internal API imports, no `patch-package` / `pnpm patch` / postinstall
rewrites, no vendored modified upstream copies, no Team patches applied to the host
tree. Team control-plane facts are never carried as DSH SessionEvents.

The legacy fork (frozen at tag `legacy-agent-team-pre-vnext`) is a *read-only
reference* for behavior and provenance — see `docs/migration/` — and is **not a
dependency** of any package in this repo.

## 9-package layout (frozen)

The TaskDoc §11 package-boundary rule freezes this layout; a 10th production package
must not be created without a separate architecture decision.

| Package | Responsibility (one line) |
|---|---|
| `packages/contracts` | Frozen cross-package contract vocabulary: TeamBlueprint / TeamSession / MemberInstance record shapes and payload DTOs with `templateId` / `instanceId` addressing. |
| `packages/domain` | Pure domain logic: Blueprint completeness validation (exactly one complete LeaderTemplate), policy / quota / compatibility / admission rules — no I/O, no DSH imports. |
| `packages/storage` | TeamDomain — the Team-owned durable sidecar and the **sole persistent control-plane authority**, built over the public DSH StorageDomain seam. |
| `packages/runtime` | Runtime orchestration: Binder / Activation / Projection, MemberInstance lifecycle, and the host half of the dsh-agent-team Cordis plugin. |
| `packages/tools` | Model-callable team tools (roster, progress, messaging) redesigned against the contracts; state flows through TeamDomain, never SessionEvent writes. |
| `packages/remote` | Team remote: durable, replayable projection feeds for external consumers and the Web UI. |
| `packages/client` | Browser half: dsh-agent-team Cordis client plugin and Team UI, on the public client surface only. |
| `packages/legacy` | Frozen legacy session inspection: the read-only `session-reader` (legacy Team session files → inspection facts), built separately into the runtime dist mirror (`tsconfig.build.json`, noCheck) and loaded unconditionally by the host at plugin apply (fail-closed `TEAM_PLUGIN_GLUE_UNAVAILABLE`). No other legacy code lives here; vNext never depends on legacy team logic (see `docs/migration`). |
| `packages/testkit` | Test infrastructure: fault-injection / restart fixtures, golden fixtures, shared assertions — never imported by production packages. |

## vNext object model (summary)

Details live in the frozen Detailed Architecture doc (`docs/plans/paused/`, local,
gitignored) — this section is a pointer summary, not the authority:

- A **TeamBlueprint** must contain **exactly one complete LeaderTemplate** (plus member
  templates / policy / quota definitions); a blueprint that only defines teammates is
  structurally invalid.
- A blueprint revision instantiates a **TeamSession** with `id = RootSessionId` (no
  separate Team UUID; 0-or-1 TeamSession per root session) bound to an immutable
  blueprint snapshot.
- **TeamDomain** is the sole persistent control-plane authority: a Team-owned durable
  sidecar store. There are **no Team SessionEvents** — team facts never flow through
  the DSH SessionEvent vocabulary.
- A **MemberInstance**'s runtime identity is the pair `(rootSessionId, instanceId)`;
  `templateId` / `label` are not identity.
- An **AgentPreset** whose effective persona is `complete: true` is a structural
  **FATAL** for Team (no "continue anyway").
- Member lifecycle: `CREATED / RUNNING / SETTLED / ARCHIVED / DISPOSED`;
  **Restore = ARCHIVED → SETTLED** — it restores durable availability only: it does not
  resume the Agent, start a turn, or call a model. New work re-enters RUNNING.

## Release status

- **Current RC baseline:** `0.1.0-rc.1` (`origin/stable` @ `b0e5aeb4`, unchanged). This release freezes the manually tested and Playwright-validated Team vNext product as the baseline for future work.
- **Current master (alpha):** `0.1.1-alpha.2` (all 9 packages) at master @
  `31ad828d` (2026-10-01 re-verified = origin/master) — the pre-Alpha.3 refactor
  series (PR-0 #37 + A #38 + B #39 + C #40 + D #41 + E #42 + w1a #43 + F15 #44 +
  F #45) is fully merged on master via series-closure merge `533dfcbb`
  (2026-09-30) + bookkeeping `5e1832a3` + skill sync `31ad828d`. Host pin
  `@deepseek-ai/dsh@0.1.7-rc.1` (root `peerDependencies`). `0.1.1-alpha.1`
  (frozen 2026-09-11) is superseded.
  **Superseded (2026-10-01 handoff closure):** the 2026-09-28 lines "master @
  `e22c659a`" and "Open PR = **PR #22**" — PR #22 is CLOSED as superseded
  (plan §8.6; the persona kind-matching semantics re-landed inside PR-E #42 of
  the pre-alpha3 series), and the series-closure merges moved master to
  `31ad828d`. **Superseded (2026-10-01 07:07Z):** master has since advanced via
  three user-authorized single-HEAD merges — #47 (E+G) → merge commit
  `2bfbca12c0b4b7260e8bc9b5b05cd339189c74e4` (06:24Z), then #46 (A) → merge commit
  `8e18819c4e589f685b99a86769251565ee4fc7ec` (07:07Z), then #48 (I+J) → merge commit
  `621fdba1f9feaf7dc192f8c8e89e2b9c848881b7` (08:07Z, = origin/master); each
  prechecked (head/base unchanged, MERGEABLE/CLEAN) + expectedHeadOid-guarded with
  reviewed-commit inclusion verified (15/15 for #48). Open work as of 2026-10-01:
  three fix lines (#47/#46/#48 MERGED; #49 B/C/D/H final batch in flight [external residual P2 + bounded C matrix + seriality + sync onto 621fdba1]; F = PR #50, external confirmed 1 residual P1 [first-mount pending window] — repro+fix in flight, then sync onto 621fdba1
  HEADs under final-HEAD review) + the unpublished F fix branch
  (`fix/mcp-target-materialization`) for the independently confirmed findings
  A–J (5 P1 + 5 P2) from the 2026-10-01 external review of the merged series — see
  `dev/agent-workflow/evidence/pre-alpha3-refactor/closure/final-series-report.md`.
  **Superseded (2026-10-01 closure-complete):** master has since advanced via the
  #49 authorized merge `26c48c87ff8687464636839d16e5303c275a202a` and the #50 authorized
  merge `c19af1954239c6b3933e708fd9bdb0d50dbe1ea4` (**= current origin/master**, user
  independently re-verified) — all five finding-fix PRs #46–#50 merged, each on an
  external-final-delta PASS + per-HEAD explicit user instruction + expectedHeadOid guard.
  Post-merge battery on c19af195 (independent ports; :3080/:3180 zero-touch): F15 10/10,
  pr-c PASS, pr-d 38/40 (2 host-bash side-effect legs environment-blocked, split-recorded),
  prf tracked t1 E.12 16/16 EXIT=0 / t2+t3 20 PASS + 1 G6 (environment-blocked) EXIT=2,
  zero-core bookends PASS. **DoD #20 = PARTIAL — 剩余环境验收 gate 需用户环境动作** *[2026-10-02 superseded: (a)(b)(c) all closed with recorded non-blocking constraints — see the 2026-10-02 CURRENT block below]*
  (host-bash side-effect legs: user self-installed landlock-run + restarted the DSH
  backend on 2026-10-01; an independent environment session performs the real
  verification — the main session has stopped environment probing; browser-rendering
  dimension: no browser binaries in this environment). Test-infra PR #51 (tracked kit
  fixes + tracked-run evidence) = **MERGED 2026-10-01 12:27:37Z (user-authorized guarded
  SQUASH)**: final HEAD `4757112c7153b12ed9a81f31699bb39d69c51fa7` → mergeSHA `427219e443ece4d57ac8558f13850c5f42ff8330`
  (base c19af195; external final delta PASS @ 509751ad + external exact-HEAD review PASS @ 4757112c;
  internal 3-review PASS @ 4757112c — delta re-review after the R3-F1 liveToken redaction fix;
  credential values from the 509751ad era remain in the fork branch history — NOT claimed
  cleared/invalidated). See
  `dev/agent-workflow/evidence/pre-alpha3-refactor/closure/final-series-report.md` and
  `…/realhost-battery-post-merge/` (battery logs + namespace-sandbox-diagnostics §1-9).
- **Pre-1.0 branch policy:** `master` carries ongoing alpha development; `stable` tracks only release-candidate baselines and RC-qualified fixes. Do not merge unqualified alpha work from `master` directly into `stable`.
- **Product foundation:** the full vNext product (P0–P9 + T12 vertical +
  upstream-0.1.2-rc.1 compat + fresh-machine install chain, 1284 files / +85,679)
  landed on master. Before this merge, master carried the docs/evidence lineage
  while the product lived on the int/task branches; the gate for the closure
  passed **3/3 (final blind round, 4 rounds × 3 independent reviewers, 12 verdicts
  archived)** @ `d23c606`; master @ `4233816` includes the bookkeeping commit.
- Backend (P0–P8-S): complete — production composition, operation fencing,
  projection/remote principal closure; G8 round-2 3/3 通过; T12 Production Vertical
  Closure **VERDICT = GO** (re-stamped @ `c455c43`).
- P9 UI (legacy reuse): **P9_VERDICT = GO** (S9 independent review, audited tip
  `0738b45`; DoD 15/15; reuse audit 47/47 confirmed). Post-GO trial defects closed in
  P9-F1 (`d199d4d6`) + P9-F2 (`dc056d5`); production-host browser vertical S1–S9 all
  green.
- Fresh-machine installability (verified in the R125 gate): clone → `pnpm install`
  → `pnpm build` → `pnpm build:composition` → mount per **`docs/INSTALL.md`** →
  `dsh web`. Proven end-to-end on clean-clone-equivalent trees (registry-only
  dependencies, 0 external junctions, byte-identical install surface) and on a fresh
  production-world boot (S8-READY + full browser vertical, zero failures).
  Since plugin-bundle-form, the root manifest declares `dsh.bundle` + `dsh.client`
  (machine-agnostic bundle layer, no file:// rows):
  `pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team`
  installs and registers in ONE command — **no `allowBuilds` whitelist needed**:
  the install-surface build artifacts are committed prebuilt and the package
  declares no lifecycle scripts (plugin-prebuilt-artifacts, R131; `docs/INSTALL.md`
   §2). Commits ≤ `e832d73` still need the one-time `allowBuilds` key (INSTALL.md
   §6 troubleshooting); clone + mount remains the offline / manual path (§3).
- Test baseline: upstream 0.1.7-rc.1 @ `46a7f68b09` (test-use runtime checkout,
  from the 2026-09-24 host upgrade round; canonical pin = `tests/paths.mjs`).
  The characterization fixture/CI pin remains 0.1.5-rc.2 @ `fb2c4b9e` — an
  intentional deferral per the upgrade plan U3 (see `docs/TEST_METHODS.md`
  §1/§4.2). History: 0.1.2-rc.1 @ `76fda72979` (2026-09-04, R122) →
  0.1.5-rc.2 @ `fb2c4b9e` (2026-09-17, rc2-repair) → 0.1.7-rc.1 (2026-09-24).
- Push: origin/master updated through 2026-10-01 under per-round one-shot user
  push authorizations — PRs #16–#21 and #23–#35 merged, then the pre-alpha3
  series PRs #37–#45 merged (latest: PR #45 (PR-F) merged @ `365f635c`,
  2026-09-30); **PR #22 CLOSED as superseded (2026-09-30, plan §8.6)**.
  2026-10-02 CURRENT — **origin/master = `3262fbc88cecf5b389e4ed83e3c5d5613779f106`** (2026-10-01 23:13:34Z = PR #56 guarded SQUASH @ approved head `284169779ec3be4a113fc2c4c47d7be9ff742ee1`; tree `f889abbb…` == pre-merge simulation; 36 files == reviewed diff; frozen blobs css `35d884486d18…` / client-bundle `38b136f8fc76…` byte-equal to the reviewed head) ← `57c044e3a91be24e8b119ded29cfc890a273eae1` (23:13:05Z = PR #54 guarded SQUASH @ `ac603c28c5ce77ce5830b8bac27be1626ad319e4` = reviewed source `034b7418…` + evidence-only import [non-evidence diff = 0]; tree `40ad8743…` == simulation; 63 files == reviewed diff) ← `d8953d6a…` (#57–#59) ← `1385f1ee…` (#53). Post-merge `check-artifacts-committed` = **OK 1392 files, real rc=0 (pipefail)**. **Browser lane CLOSED (2026-10-02): stage-2 LIVE run-7** (dedicated env session, MEMBER_MODE=1, real member perspective `session-team-child-6a296fb…`): observer **40/40**; kit **VERDICT PASS 16/16 criteria (59 PASS / 0 FAIL)**; runner=0 kit=0 paired=0; signals=0; runtime-restore proof captured; tested carrier `e63da125…`/tree `da83b95b…` is **local acceptance-carrier environment evidence, never pushed — not a remote-review object**; raw kept at carrier `dev/agent-workflow/evidence/pre-alpha3-refactor/pr-e/stage2-live-2026-10-01T22-46-27/`; tracked import = `ac603c28` (semantics in its `IMPORT-MANIFEST.md`). Semantics kept exact: observer only observed and **never clicked Allow/Deny** (`decisions[]` untouched); the marker = observation claim, **never HumanAllow**; the scripted `team.resolveControl` = a separate pre-planned kit step executed AFTER marker verification. Recorded constraints kept: DoD-20 **E4 remains historical unit/E2E — no new browser run of E4 and none claimed**; full-suite pre-existing baseline failures stand (not re-run this round; **no all-green claim**); (A) legacy control requests lacking payload+digest fields = accepted limitation; (B) backend-frozen-context hardening = deferred (no normally-reachable trigger), non-blocking. **DoD #20 (b) real-browser-rendering dimension = CLOSED** ((a) closed via landlock acceptance; (c) PR-B gate-meaning closed with #53). PR #52 (this branch) = **no merge authority** — this closure delta awaits parent doc review; PR #60 = **no merge authority** (sole writer implementing the ruled fix batch). Superseded 14:30Z snapshot, kept as history: origin/master was `1385f1ee060830bb0f550860d4bd81901c319063` (2026-10-01 14:30:21Z = PR #53 guarded SQUASH @ approved head `4200c4b6`, tree-identity verified; test-infra only); browser lane then: Chromium-1228 + headless-shell present under `tests/homes/.playwright-browsers/`; two sandbox:true probes failed (observed: AppArmor unprivileged_userns DENIED CAP_SYS_ADMIN); official-Chrome install lane in progress with no result claimed; real UI rendering pending. The line below is the 12:27Z snapshot, kept as history:
  **origin/master = `427219e443ece4d57ac8558f13850c5f42ff8330`** (2026-10-01 12:27Z = PR #51 guarded SQUASH; history: `31ad828d` → 07:07Z `8e18819c…` (#47+#46) → 08:07Z `621fdba1…` (#48) → 10:0xZ `26c48c87…` (#49) → 11:02Z `c19af195…` (#50) → 12:27Z `427219e4…` (#51));
  **origin/stable @ `b0e5aeb4`** (0.1.0-rc.1 freeze, unchanged). Zero force-push
  on gated history; each push verified via ls-remote.
- [HISTORY — 2026-10-01 morning snapshot; superseded 12:3xZ — see CURRENT block below] Next (2026-10-01 handoff closure round): five fix PRs for findings
  A–J (5 P1 + 5 P2) confirmed by the 2026-10-01 independent external review of
  the merged series — `fix/persona-kind-preflight` (A) /
  `fix/control-authz-boundary` (B, C, D, H) / `fix/effective-policy-reset-fallback`
  (E, G) / `fix/mcp-target-materialization` (F) / `fix/runtime-template-consent`
  (I, J), all base `31ad828d`, plus the handoff-closure branch carrying the
  final DoD-20 series report — **NONE merged, NO auto-merge; merging waits
  exclusively on the user's explicit per-HEAD instruction after external review
  passes a specific HEAD**. **CURRENT (2026-10-01 12:3xZ, post-PR#51-merge):** all five fix PRs MERGED (#46 @ `8e18819c…` / #47 @ `2bfbca12…` / #48 @ `621fdba1…` / #49 @ `26c48c87…` / #50 @ `c19af195…`) + **test-infra PR #51 MERGED @ `427219e443ece4d57ac8558f13850c5f42ff8330`** (2026-10-01 12:27:37Z, user-authorized guarded SQUASH of final HEAD `4757112c7153b12ed9a81f31699bb39d69c51fa7`; internal 3-review PASS @ 4757112c (delta re-review) + external final delta PASS @ 509751ad + external exact-HEAD review PASS @ 4757112c + user per-HEAD authorization; final tree == approved head verified empty; credential values from the 509751ad era remain in the fork branch history — NOT claimed cleared/invalidated) + **closure PR #52 DRAFT published** (`task/pre-alpha3-handoff-closure`, docs/evidence-only; **NO merge authorization** — user's independent review + internal 3-review in progress; external exact-HEAD review @ a9bf52b4 = 4 doc-accuracy BLOCKs, closed by this bounded revision). [Superseded, 2026-09-28:] no in-flight task round;
  open PR = **PR #22** awaiting review/merge ruling. Still awaiting user
  direction: **G8-S (P9 proper
  line)** ruling (graph `blocked`, pending prototype outcome) and the
  registered follow-up backlog (per-PR `followups` in `graph.yaml`: c1/rc2 kit
  0.1.7 re-adaptation, g5 real-host re-run, p6t1-parallel load flake, F-rc1
  composer reconcile, P10 items). No further push without explicit
  authorization.
- Details, pending items and evidence pointers: **`docs/STATUS.md`**.

## Commands

| Command | Effect |
|---|---|
| `pnpm install` | Install the workspace (public npm registry only). |
| `pnpm build` | Build every package (`tsc` → `packages/*/dist`). |
| `pnpm setup` | Fresh-clone build chain: every package (`tsc`) + glue placement + client composition + install-surface artifact freshness check. |
| `pnpm check:artifacts` | Verify the committed install-surface artifacts match a fresh build (source changes affecting them must ship rebuilt artifacts in the same commit). |
| `pnpm typecheck` | Type-check every package (no emit). |
| `pnpm lint` | ESLint (flat config, minimal rule set) over the workspace. |
| `pnpm test` | Run all package unit tests (Vitest, workspace aggregation). |
| `pnpm test:node` | Plain-node test runner (`scripts/run-tests.mjs`) — the sanctioned in-sandbox chain (no child-process spawns). |
| `pnpm smoke:composition` | Verify the built plugin entries against the public Cordis plugin shape (production-dist degenerate-ctx contract pin; plain node, no harness). |

Toolchain: Node `^22.19.0 || >=24.0.0`, pnpm `11.7.0` (aligned with the DSH host
toolchain). The test runner is Vitest 4 pinned to the rolldown-based **vite 8**
line via `overrides.vite` in `pnpm-workspace.yaml` — its config loading and TS
transforms run in-process (no child-process spawns), which keeps the test
pipeline deterministic across restricted and normal environments.

## Plugin entries (production form)

- Host half: `packages/runtime/src/plugin/host.ts` (built → `packages/runtime/dist/packages/runtime/src/plugin/host.js`)
  — the production root binding (P8-S5 A01–A34 topology, P8-S6 completion): provides
  `teamRoot`, registers the `/team-remote` handler set (frozen Remote v1 catalog,
  facade-only command routing), the projection live overlay and server-side principal
  derivation (claims never trusted), and the Team operation fencing (P8-S5B shared
  per-team coordinator).
- Client half: `packages/client/src/plugin/client.ts` (built → `packages/client/dist/packages/client/src/plugin/client.js`)
  — the Team UI (P9, legacy reuse): registers `conversation.view` (Team tab),
  `conversation.input.dock`, `settings.section`, and the global New Team entry at
  `sidebar.footer.action`.

Both are plain modules following the public Cordis composition plugin shape — a stable
named `name` export plus a side-effect-free `apply(ctx, config?)` entrypoint. They are
verified by `scripts/composition-smoke.mjs` (production-dist degenerate-ctx contract
pin; fixture basis for the P1-T5 zero-core check), the package unit tests, and the S8
production-host vertical (real browser, port 3180).

## Provenance & discipline

- Provenance evidence (file/commit manifests, mixed-hunk report):
  `dev/agent-workflow/evidence/provenance/`.
- Legacy is reference-only: `docs/migration/` (reuse map, behavior inventory).
- Task graph, gates, and the package-boundary rule: Task Decomposition §11 in the frozen
  plan set (`docs/plans/paused/`, local, gitignored).
- Current status, pending items and evidence pointers: **`docs/STATUS.md`** (snapshot;
  authority = `dev/agent-workflow/graph.yaml` + `SESSION_ROUTER_LOG.md`).
- Pre-release Git branch and RC promotion policy: **`docs/BRANCHING.md`**.
