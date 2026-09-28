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
| `packages/legacy` | Reference-only empty slot; vNext never depends on legacy code (see `docs/migration`). |
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
- **Current master (alpha):** `0.1.1-alpha.2` (all 9 packages) at master @ `e22c659a`
  (PR #35 team-view-sync-complete merged, 2026-09-28); host pin
  `@deepseek-ai/dsh@0.1.7-rc.1` (root `peerDependencies`). `0.1.1-alpha.1`
  (frozen 2026-09-11) is superseded. No open PRs (2026-09-28).
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
- Push: origin/master updated through 2026-09-28 under per-round one-shot user
  push authorizations — PRs #16–#35 all merged (latest: PR #35
  team-view-sync-complete, merged @ `e22c659a`). **origin/master @ `e22c659a`**;
  **origin/stable @ `b0e5aeb4`** (0.1.0-rc.1 freeze, unchanged). Zero force-push
  on gated history; each push verified via ls-remote.
- Next: no open PRs, no in-flight task round (2026-09-28). Awaiting user
  direction: **G8-S (P9 proper line)** ruling (graph `blocked`, pending
  prototype outcome) and the registered follow-up backlog (per-PR `followups` in
  `graph.yaml`: c1/rc2 kit 0.1.7 re-adaptation, g5 real-host re-run,
  p6t1-parallel load flake, F-rc1 composer reconcile, P10 items). No further
  push without explicit authorization.
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
