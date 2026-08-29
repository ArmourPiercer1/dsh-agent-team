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

Details live in `docs/plans/active` (Detailed Architecture, §4–§14) — this section is
a pointer summary, not the authority:

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

## Commands

| Command | Effect |
|---|---|
| `pnpm install` | Install the workspace (public npm registry only). |
| `pnpm build` | Build every package (`tsc` → `packages/*/dist`). |
| `pnpm typecheck` | Type-check every package (no emit). |
| `pnpm lint` | ESLint (flat config, minimal rule set) over the workspace. |
| `pnpm test` | Run all package unit tests (Vitest, workspace aggregation). |
| `pnpm smoke:composition` | Verify the built empty plugin entries satisfy the public Cordis plugin shape (plain node, no harness). |

Toolchain: Node `^22.19.0 || >=24.0.0`, pnpm `11.7.0` (aligned with the DSH host
toolchain). The test runner is Vitest 4 pinned to the rolldown-based **vite 8**
line via `overrides.vite` in `pnpm-workspace.yaml` — its config loading and TS
transforms run in-process (no child-process spawns), which keeps the test
pipeline deterministic across restricted and normal environments.

## Empty plugin (skeleton)

- Host half: `packages/runtime/src/plugin/host.ts` (built → `packages/runtime/dist/plugin/host.js`)
- Client half: `packages/client/src/plugin/client.ts` (built → `packages/client/dist/plugin/client.js`)

Both are fresh plain modules following the public Cordis composition plugin shape —
a stable named `name` export plus a side-effect-free `apply(ctx, config?)` entrypoint —
and bind no services, tools, timers, or listeners yet. They are verified by
`scripts/composition-smoke.mjs` (fixture basis for the P1-T5 zero-core check) and by
the package unit tests.

## Provenance & discipline

- Provenance evidence (file/commit manifests, mixed-hunk report):
  `dev/agent-workflow/evidence/provenance/`.
- Legacy is reference-only: `docs/migration/` (reuse map, behavior inventory).
- Task graph, gates, and the package-boundary rule: Task Decomposition §11 in the
  `docs/plans/active` plan set (local, gitignored).
