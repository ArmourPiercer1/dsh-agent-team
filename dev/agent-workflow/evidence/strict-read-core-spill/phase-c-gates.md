# Phase C — spill provider replacement: gate evidence

Task: strict-read + core-spill content-read vertical, **Phase C** (spill
provider replacement). Branch `task/strict-read-core-spill` (worktree
`.worktrees/strict-read-core-spill`), on top of Phase A (`b7e6df1`) +
Phase B (`38a5393`).

## What Phase C delivers

- `packages/runtime/src/plugin/artifact-grant-bridge.ts` — the
  `TeamArtifactAuthorityBridge` (a mutable `authority` slot the host fills
  after bootstrap) + the `teamArtifactAuthority` service name. The
  row-scope `ctx.provide` is visible to sibling top-level rows (upstream
  precedent: the base `spill-policy` row reads the `spillStore` provided by
  the `spill-local` row), so no root-scope trick / module singleton is
  needed.
- `packages/runtime/src/plugin/team-spill-local.ts` — `TeamAwareLocalSpillStore
  extends LocalSpillStore` (named + default export for the Cordis
  class-plugin contract). `saveText` override: the upstream storage path runs
  first (ONLY path to disk), then, for a MANAGED session, the durable
  artifact-read grant is recorded through the authority (fresh resolve+stat →
  digests → durable ledger put BEFORE runtime install). The closed
  two-arm `SpillSource` union maps verbatim (`tool` / `session-reference`).
  An unmanaged session (or a bridge without an authority) is byte-for-byte
  upstream-equivalent (no grant I/O).
- `packages/runtime/test/team-spill-local.test.ts` — S1–S8 (8 tests):
  the end-to-end vertical (save → file → durable grant → `authorizeRead`
  valid), unmanaged upstream-equivalence, put-fault reject (no runtime grant
  without its durable fact), bridge-without-authority no-op, same
  `spillStore` service registration, both source arms, storage-fault-before-
  record, and DISPOSED-instance issuance reject.
- `packages/runtime/package.json` — `@deepseek-ai/dsh-spill` +
  `@deepseek-ai/dsh-spill-local` pinned to **0.1.5-rc.2** (the runtime
  baseline; the `SpillSource` union DRIFTED between the 0.1.2-rc.1 typecheck
  pin and the 0.1.5-rc.2 runtime — the closed-union switch + the Phase A
  `SpillStoreSource` mirror are written against the 0.1.5-rc.2 shape with the
  `kind` discriminator + `session-reference` arm). Three warning-only unmet
  peer issues result (dsh-spill@0.1.5-rc.2 wants `^0.1.5-rc.2` for
  dsh-brand/dsh-llm/dsh-session; installed 0.1.2-rc.1) — warning-only
  (no `.npmrc`, default non-strict pnpm), matching the repo's existing
  "typecheck pin < runtime baseline" mode for other dsh deps; the upstream
  resolver re-parents to the host's 0.1.5-rc.2 at runtime regardless.
  Also `@types/node: ^22.20.0` (devDep) — the runtime package now compiles a
  `.ts` file importing `node:crypto` (Phase A `digest.ts`), the first
  node-builtin import in the tsc emit set.
- `packages/runtime/tsconfig.build.json` — `"types": ["node"]`. TS 6.0.3 does
  not auto-include `@types/node` for the build program (it only resolved in
  the typecheck program transitively via vitest's triple-slash reference);
  the explicit opt-in makes the node builtin typing deterministic for both
  programs. First `types` field in the repo (the client package declares
  `@types/node` but its TS emit set never imports node builtins).
- Root `package.json` — `./spill-local` subpath export →
  `packages/runtime/dist/.../team-spill-local.js` (mirrors `./host`).
- Root `cordis.patch.yml` — the base `spill-local` row is DISABLED
  (partial-entry `disabled: true`, the acp-app precedent) and replaced by the
  `team-spill-local` row (`name: dsh-agent-team/spill-local`), inserted
  between the host row and the client row. Same `spillStore` service name +
  same (absent) config surface = the base row's defaults.
- Typecheck repairs surfaced by the first full `tsc` run (vitest does not
  typecheck): a single documented branding-boundary helper in
  `artifact-read/authority.ts` (`toIdentityKey`, type-only cast, same
  convention as s6-remote / fresh-member) + the matching test-side helper,
  plus `noUncheckedIndexedAccess` (`[0]!`) + an `unknown` param fix in the
  Phase B lane test, and the `override` modifier + exhaustive-`never` default
  in the Phase C provider.
- `packages/testkit/test/p4t6-session-event-scan.test.ts` — the frozen
  denylist-scan pin bumped 727 → 739 (+12: Phase A's 6 core + 2 test,
  Phase B's 1 test, Phase C's 2 source + 1 test). Single-writer pin bump on
  the task branch (the PR #18 closure precedent). All twelve new files carry
  ZERO denylist vocabulary (measured); the frozen quarantine hit set is
  unchanged at fifteen.

## Gates

| Gate | Command | Result |
| --- | --- | --- |
| typecheck (all 10 packages) | `pnpm typecheck` | **PASS** |
| build (all 10 packages) | `pnpm build` | **PASS** |
| full test | `pnpm test` | 3778 passed / 20 failed — the 20 failures are the PRE-EXISTING master baseline set (verified: the identical 10 files / 20 tests fail on a pristine `origin/master` @ `119aee9` worktree); zero regressions. p4t6 now passes after the pin bump. |
| check:artifacts | `pnpm check:artifacts` | dist output committed with the source (same commit) — passes after this commit. |
| build:composition | `place-dist-glue` + `build-client-composition` + `check-artifacts-committed` | glue byte-identical; client composition 87 modules / 11 css (unchanged — no client code touched); artifacts committed. |
| smoke:composition | `pnpm smoke:composition` | host-plugin leg FAILS IDENTICALLY on the pristine master baseline (`apply subscribed to listeners before failing: internal/get`) — a pre-existing baseline break, not a Phase C regression; the client leg passes. |
| verify-zero-core (host C1–C3 + C5) | `node scripts/verify-zero-core.mjs --host tests/deepseek-harness-test-use --status/--diff snapshots` | **PASS, 0 findings** — upstream host byte-clean (HEAD `fb2c4b9e69`, all four C5 snapshots 0 lines); only 4 INFO = upstream's own third-party `node-pty` / `@yao-pkg/pkg` patches. See `zero-core-host-*.txt`. |
| verify-zero-core (C4, repo as plugin) | `node scripts/verify-zero-core.mjs --host <upstream> --plugin .` | **0 findings in top-level `packages/**` and 0 in any Phase C file** — all 49 findings are in the permitted `dev/agent-workflow/evidence/**` (archived legacy snapshots) + `tests/characterization/probes/**` (deliberate negative fixtures), byte-matching the a2c4 precedent. See `verify-zero-core-c4.log`. |

## Reversible-impact note

- No upstream DSH source touched (the pristine `tests/deepseek-harness-test-use`
  checkout is byte-clean; the resolver re-parents imports into it read-only).
- The only runtime-visible change is the `spill-local` row swap in the profile
  composition; the provider is a strict superset of the base row and is
  upstream-equivalent for unmanaged sessions.
