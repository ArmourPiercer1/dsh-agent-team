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

## Status (2026-09-05)

- **Product is now on `master`**: `int/P9-master-product-closure` fast-forwarded into
  master (R125, 2026-09-05) — the full vNext product (P0–P9 + T12 vertical +
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
- Test baseline: upstream 0.1.2-rc.1 @ `76fda72979` (in-place update 2026-09-04;
  in-repo compat adaptation only, CORE PATCH BUDGET = 0 held — R122, five gates green).
- Push: origin updated 2026-09-05 (R126, user-authorized) — **master @ `4233816`**
  (full product + closure) and `int/P9-master-product-closure` @ `4233816`
  (fast-forward/new, zero force-push, verified via ls-remote); the R124 refs
  (master @ `a733e9f` lineage + 5 task/int branches) unchanged.
- Next: P10 hardening + G8-S/P8-S8 ruling awaiting user direction (no further
  push without explicit authorization).
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

- Host half: `packages/runtime/src/plugin/host.ts` (built → `packages/runtime/dist/plugin/host.js`)
  — the production root binding (P8-S5 A01–A34 topology, P8-S6 completion): provides
  `teamRoot`, registers the `/team-remote` handler set (frozen Remote v1 catalog,
  facade-only command routing), the projection live overlay and server-side principal
  derivation (claims never trusted), and the Team operation fencing (P8-S5B shared
  per-team coordinator).
- Client half: `packages/client/src/plugin/client.ts` (built → `packages/client/dist/plugin/client.js`)
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
