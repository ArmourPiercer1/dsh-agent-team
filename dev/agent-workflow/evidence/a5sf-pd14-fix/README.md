# PD14-FIX — the World's Team workspace is the World's workspace

**Row**: [PD-14 (SANDBOX-ROOT)](../../../../docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md)
in `PRODUCT-DEBT-REGISTER.md` — *a Member session's sandbox root is the pinned host checkout, not
the World workspace*.

**Branch**: `task/a5sf-pd14-sandbox-root-20261111` · **base**: `origin/master` @ `c91c72bca`
(PD-13's merge) · **record class**: none of the `DEV-LIVE`/`CANDIDATE-C2` classes apply — this lane
**ran zero Hosts** (see §7). `CORE PATCH BUDGET = 0`: no upstream file was read for writing, no
`packages/**` source changed.

---

## 1. The finding and the layer that owns it

PD-14 measured `executor.workspaceRoot = <main checkout>/tests/deepseek-harness-test-use` where the
run's `expectedWorkspaceRoot` was `…/tests/homes/<world>/workspace`, with the child's `bwrap` argv
binding the pinned tree **read-write**. Two fixture attempts (boots 6–7) proved a `sandbox-policy`
override row is not a fix.

The chain that produces that value has five links; the first four were read out of the tree, the
fifth is the one the live lanes photographed:

| # | link | where | owner |
| --- | --- | --- | --- |
| 1 | the Host process is launched with `cwd = <pinned checkout>` | `tests/characterization/lib/instance.mjs` (`spawn(process.execPath, ['apps/cli/lib/bin.js', …], { cwd: hostTree })` — the CLI entry is a *relative* path, so the launch directory has always been the runtime tree) | **fixture** |
| 2 | the Team's effective workspace defaults to the launch directory | `packages/runtime/src/plugin/host.ts#withDefaultWorkspace` (`config.defaultWorkspace ?? launchCwd`), documented in the root `cordis.patch.yml` lines 10–24 | product (intended) |
| 3 | every Member session's `meta.cwd` is that value | `packages/runtime/src/plugin/live/agent-bindings.mjs` §T12-M1 (`request.workspace ?? config.defaultWorkspace`) → `session.header.cwd` | product (intended) |
| 4 | the sandbox root is `session.header.cwd ?? config.workspaceRoot` | `tests/deepseek-harness-test-use/packages/sandbox/sandbox-policy/src/index.ts` (`resolve()`) | upstream (untouchable) |
| 5 | the child is `bwrap … --bind <root> <root>` | `@deepseek-ai/dsh-sandbox-local` (`bwrapProfileArgs`) | upstream (untouchable) |

**Decision: the fix is the fixture layer, and only the fixture layer.**

Evidence for each of the two alternatives, and against them:

- **Against a product change (link 2/3).** For a real operator, link 1 *is* their project directory:
  `dsh` launched from `~/work/app` gives the Team `~/work/app` as its workspace, which is exactly the
  answer a user expects. The row contract says so in its own words and names the override
  (`cordis.patch.yml` lines 10–24: "when the row carries no defaultWorkspace, defaults the team
  workspace to the directory the operator launched the host from … use that to … set
  `defaultWorkspace`"). Changing that default would alter what **real users** get, and PD-14 measured
  nothing about real users — it measured a World that launched the Host from its *program's source
  tree*. A product change here would be preference, not evidence.
- **Against a `sandbox-policy` row override (the register's negative result).** PD-14's boots 6–7
  already measured it: a config row needs `name` restated (or the plugin is disabled) and *still*
  loses to the session cwd, because link 4 prefers `session.header.cwd`. Not a fix.
- **For the fixture layer.** The World already knows the right answer — `TestWorld.workspaceDir =
  <home>/workspace`, and `tests/world-factory/lib/world-factory.mjs`'s own header calls the workspace
  "the session cwd". Its *root* session even sets it explicitly (`apiSessionCreate(…,
  world.workspaceDir, …)`). Only the Team's own children were left on link 1. And the repo had
  already solved this once: `tests/world-factory/lib/u6-arc-d-assembly.mjs#teamRowConfig` declares
  `defaultWorkspace: workspaceDir`, with a test whose message is *"native edit must run in the World
  workspace, not the Host launch tree"* (`u6-arc-d.test.mjs`). Twelve other assemblies did not. The
  defect is a **fixture omission**, and the honest fix makes it a law instead of a key each assembly
  may forget.

## 2. What the fix is

Two files, both test infrastructure:

- `tests/world-factory/lib/team-workspace.mjs` — `bindTeamDefaultWorkspace(rows, world)`: pure, no
  I/O. It binds every Team-shaped row whose config declares no `defaultWorkspace` to the World's own
  `workspaceDir`, keeps (and validates) a declaration a World *did* make, and **refuses** a
  declaration that points into the pinned host checkout (`TEAM_WORKSPACE_ON_HOST_TREE`) or outside the
  World's owned home (`TEAM_WORKSPACE_OUTSIDE_WORLD`). The module header carries the five-link chain
  above so the next reader finds the reason, not a magic key.
- `tests/world-factory/lib/world-factory.mjs` — `TestWorld.#teamWorkspaceRows()`, called at the ONE
  point where a World's patch-layer rows are composed and written (`startHost`, both composition
  branches). The binding report is kept on the World as `teamWorkspaceBinding` so a run record can
  cite it instead of inferring it.

Everything downstream is unchanged product code: the host entry, the glue, the pinned policy and the
pinned backend do exactly what they did.

## 3. The pin and its flip

`tests/world-factory/a5sf-pd14-sandbox-root.test.mjs` (host-free: in-process Cordis roots plus the
**pinned** sandbox backend; no boot, no DSH_HOME, no port, no `:3080`). The pin's pre/post switch is
explicit in the file: the arm applies the fixture law **iff the tree has it** — the pre-fix tree does
not, so the pre-fix shape stands.

- `pin-before.log` — the tree without the two fixture files: **P0 PASSES**. A Team row that declares
  no workspace, launched from the pinned tree, resolves the Member's session cwd *and* the pinned
  policy's `workspaceRoot` to the host checkout.
- `pin-after.log` — the fixed tree: **P0 FAILS**, and the failure names both paths
  (`expected <pinned checkout>`, `actual <…/homes/a5sf-pd14-pin-…/workspace>`).

## 4. What the other arms prove

| arm | claim | witness |
| --- | --- | --- |
| D1 | the Team's effective workspace and the resolved `workspaceRoot` are the World workspace, not the host checkout | the pinned `SandboxPolicyService.resolve({session})` — the **provider's own answer**, not a config read-back |
| D2 | the Member's child is **read-write bound at the World workspace and at no point of the host checkout** | the pinned backend's argv (`--bind <world ws> <world ws>`, and the host tree absent from the argv) **plus** the child's own `pwd` and its own `/proc/self/mountinfo`: exactly one mount at the World workspace, options contain `rw`; **zero** mounts at or under the pinned checkout |
| D3 | the write boundary is the World workspace | inside the same child: a write under the World workspace succeeds (`IN-ROOT-WRITTEN`), a write to a sibling outside it is refused by the OS (`Read-only file system`, `OUTSIDE-REFUSED`) and leaves the sibling clean |
| F1 | **disclosure** — the host checkout is still READABLE from the child | `test -r <pinned>/package.json` → `HOST-READABLE`. The profile is `--ro-bind / /`; this row moves the **write** boundary, and the suite says so out loud |
| C1 | **negative control (product)**: a `sandbox-policy` row that *does* configure a root still wins where it should | a second, independent policy service configured with an explicit `workspaceRoot`: `resolve()` (no session) returns it; a session cwd still outranks it. The fix hard-codes no path |
| C2 | **negative control (fixture)**: a World that *declares* its Team workspace keeps it | the binder reports `bound: []`, `declared: [{id, defaultWorkspace}]`, and the resolved root follows the declaration |
| C3 | the law refuses a World that declares the **pinned checkout** (or a subdirectory of it) as its Team workspace | `TEAM_WORKSPACE_ON_HOST_TREE` |
| C4 | the law refuses a workspace outside the World's owned home, and a relative one | `TEAM_WORKSPACE_OUTSIDE_WORLD`, `TEAM_WORKSPACE_NOT_ABSOLUTE` |
| S1 | surface neutral | non-Team rows untouched, input rows not mutated, the emitted patch layer keeps every row and carries the World workspace |
| S2 | locus | `startHost` routes its rows through `#teamWorkspaceRows`, which calls the shared law (not a local copy) |
| Z1 | the pinned checkout stays pristine | `git -C <pinned> status --porcelain` is empty after every arm (every child above runs `printf`/`test` only, and none of them targets the pinned tree) |

The two observation arms spawn the real pinned backend; nothing in this suite writes to the pinned
tree.

## 5. The observed root, before and after

| | before | after |
| --- | --- | --- |
| Team `defaultWorkspace` | `<pinned checkout>` (launch dir) | `<home>/workspace` |
| Member `session.header.cwd` | `<pinned checkout>` | `<home>/workspace` |
| `sandboxPolicy.workspaceRoot` (provider's own answer) | `<pinned checkout>` | `<home>/workspace` |
| child `pwd` | `<pinned checkout>` | `<home>/workspace` |
| mount table: read-write mount | `--bind <pinned checkout> <pinned checkout>` | one `rw` mount at `<home>/workspace`, **no** mount at/under the pinned checkout |
| pinned tree porcelain | empty (commands were `printf` only) | empty (Z1) |

Mechanism of observation: the pinned policy service's `resolve()` (D1), the pinned backend's own argv
(D2), and the child's own stdout (`pwd`, `/proc/self/mountinfo`, a refused write) — never a config
value read back.

## 6. Blast radius

- **Worlds that change behaviour**: every World that mounts the production Team row through
  `TestWorld.startHost` **without** declaring a Team workspace — i.e. every assembly except
  `u6-arc-d` (which already declared `workspaceDir` and is therefore a no-op, and whose own test
  keeps asserting the declaration). Enumerated from the tree: `u6-arc-a`, `u6-fs`, `u6-jobs`,
  `u6-proc`, `u7-census`, `u7-fsmut`, `u7-fui`, `u7-pwsh`, `u7-tbash`, `u7astore`, `u7f-web`,
  `u7fa`, `u7fagentb`, `u7r3-uif4`. For each, the change is one field: the Team's effective workspace
  (and therefore every Member session's `cwd` and its sandbox root) moves from the pinned checkout to
  `<home>/workspace`. Their own fixtures already address workspace files by absolute path under
  `workspaceDir`, so no arm's locator moves.
- **An existing arm that pinned the WRONG root**: `u7-fsmut`'s `ctlTruth` oracle walked
  `[home, runtimeTree]` because "for member sessions that is the factory's pristine hostTree (the
  runtime checkout), NOT the world home". That was PD-14 observed from the assertion side. It is
  **annotated as such and left intact** (§ the dated note in `u7-fsmut-assembly.mjs`): after this fix
  the ctl file lands in the World home, the same walk finds it there, and the stray-file deletion in
  the host tree simply never fires because nothing is written there.
- **The FS dev-live driver's inert home patch** (PD-14's `SANDBOX-ROOT` §5 negative result): the
  driver writes `<home>/cordis.patch.yml`, which the host never reads (it reads
  `<home>/profiles/<profile>/cordis.patch.yml`). Verified by reading
  `dev/agent-workflow/evidence/a5sf-fs-devlive/driver/run-boot.mjs` in this worktree, exactly as
  PD-14 recorded — the inert write is **still inert** and is *not* the same correction: that driver
  mounts its production Team row through the same `TestWorld.startHost`, so it now inherits the
  binding; its inert home patch needs no edit to be correct (it is dead code that this fix does not
  make live). It is not fixed here because it is a *different* defect (a patch written to a path the
  host ignores) and its owner lane owns that file.
- **Tests that depended on the host-checkout root**: exactly one, `u7-fsmut`'s oracle comment/walk
  (above). No test asserts `defaultWorkspace === hostTree`; the closest is `u6-arc-d.test.mjs`, which
  asserts the opposite ("not the Host launch tree").
- **Non-Team rows and non-Team Worlds**: untouched (S1, and the binder only matches Team-shaped
  configs).
- **Real users**: unchanged — no `packages/**` file changed, and the shipped row still defaults to
  the operator's launch directory. (`cordis.patch.yml`'s documented override is the knob this fix
  uses; it is not new.)

## 7. Boots

**Zero.** The fix touches no product path, so no `DEV-LIVE` boot was manufactured to make the PR look
stronger; the fixture-level observation (§5) plus the real pinned backend's real child (§4 D2/D3) is
what this lane claims. No ledger rows were written, `:3080` was never touched, no port in the `3180`
family was bound, and `tests/homes/` scratch directories created by the suite are removed by its
`after()` hook.

## 8. Gates

`dev/agent-workflow/evidence/a5sf-pd14-fix/gate-a5sf.log` is the exact output of
`node --test tests/world-factory/a5sf-*.test.mjs`; `gates.md` records the rest.

## 9. Residuals (disclosed, not claimed away)

1. **Fixture-only.** The shipped product still roots a Team at the directory the operator launched
   `dsh` from. If that directory is not a workspace (a service manager launching from `/`, a
   `systemd` unit with no `WorkingDirectory`), a real Member's shell is rooted there. PD-14 measured
   a World, not a user; this lane does not change product behaviour, and that product question is
   **not** closed by this PR. It belongs to a separate row if the owner wants it.
2. **The read boundary is not moved.** `--ro-bind / /` means the pinned checkout stays *readable* at
   its absolute path from inside a Member's child (F1). Only the read-write root moved.
3. **`config.workspaceRoot` is now unreachable for Team sessions** (link 4 prefers the session cwd,
   which every Team session now has). That is the pinned resolver's documented precedence, exercised
   by C1 for the sessions that *do* lack a cwd (agentless calls). Nothing in the product relied on a
   Team session *without* a cwd.
4. **The twelve assemblies were not booted.** Their change is one config field on a documented
   contract, and the emitted patch layer is asserted for a synthetic World (S1); a per-World boot is
   the World owners' next boot, not this lane's.
