# P2-T1 — pristine characterization harness

One-command self-test that boots the **pinned pristine upstream** DSH tree
(`deepseek-ai/deepseek-harness` @ `cd5ef8148158c3a752a658978873241fdf8e2bbc`,
v0.1.2-alpha.1) **through its public exports only**, exercises a probe
lifecycle against it, and proves the upstream tree is byte-clean afterwards.

This is the shared probe/test harness for all P2 seam characterization
(P2-T2..T6). It writes **no product runtime code**: it only mounts probe
plugins through the public composition seam, dumps the composed tree, and
asserts on observable behavior.

## Quick start

```
node tests/characterization/run.mjs
```

Requires: Node `^22.19 || >=24` (authored and verified on v24.20.0), a
pristine checkout of upstream at
`<team-repo>/references/deepseek-harness-test-use` with `pnpm install
--ignore-scripts` applied, and a built runtime closure (TEST_METHODS.md §2:
`DSH_CLIENT_COMMIT_HASH=cd5ef814 ESBUILD_WORKER_THREADS=1 node
scripts/build.ts` inside that tree).

Exit codes: `0` = all sections green, `1` = at least one failure, `2` =
usage or internal error. A full local run takes ~25 s and leaves the upstream
tree byte-clean, the port freed, and the dedicated test DSH_HOME in its
documented final state (see [Test instance / DSH_HOME policy](#test-instance--dsh_home-policy)).

## Layout

```
tests/characterization/
  run.mjs                     single entry point (the one command)
  spawn-probe.mjs             standalone spawn-mechanism probe (P1–P4, see below)
  lib/
    harness-core.mjs          config resolution, run context, probe-group discovery
    instance.mjs              DshInstance: start/stop/dumpConfig/mountRows + profile init
    public-surface.mjs        public-exports whitelist (C4b-equivalent resolver)
    private-import.mjs        private-import scanner (C4-equivalent, same 4 patterns as verify-zero-core)
    fixture.mjs               host-version fixture build/load/diff
    tree-clean.mjs            in-process git byte-clean capture (file-fd stdio)
    util.mjs                  walk / file-fd spawn / port checks / log helpers
  fixtures/
    host-version.json         generated: pinned SHA + per-package surface fingerprint
    scanner-controls.json     synthetic scanner positive controls (JSON ⇒ never scanned as source)
  probes/
    smoke/                    demo probe group (P2-T1's own negative-test chain)
      index.mjs               { name, description, async run(ctx) }
      plugins/good-host.js    GOOD probe: imports only the public surface
      plugins/negative-fixtures/bad-host.js
                              BAD probe: imports a non-declared subpath; MUST fail boot
    node_modules/@deepseek-ai/dsh-util-crypto
                              junction farm → pinned tree (gitignored, recreated idempotently)
```

`lib/`, `probes/<group>/index.mjs`, `run.mjs` and `spawn-probe.mjs` are the
**harness source** and are subject to the zero-core constraint (C4): no bare
third-party imports, no private upstream subpaths. Probe *payload* plugins
under `probes/<group>/plugins/` are the only place an import may deliberately
violate the whitelist — and only in a file that is never loaded by a passing
path (the negative fixtures).

## Sections

`run.mjs` runs these sections in order; each is individually re-runnable via
`--only <section>`:

| Section | What it proves |
|---|---|
| `preflight` | node version, trees present, port selection (3281 → backup 3291), DSH_HOME ready, **upstream tree pristine at start** (`git status --porcelain` empty), public surface builds (≥200 packages), probe-resolution links ready |
| `surface` | whitelist resolver works: key seam packages present, public root import admitted, a non-declared subpath (`/internal/random`) **not** admitted |
| `fixture` | `fixtures/host-version.json` matches the live tree (pinned `upstreamSha` + per-package name/version/exports fingerprint) — pin-drift protection. `--fixture-write` regenerates it, **on a clean tree only** |
| `static` | private-import negative test (C4-equivalent): harness source has zero bare/non-`node:` imports (harness mode); good probe passes the live whitelist; bad probe is **detected and rejected** (probe mode); synthetic positive controls from `fixtures/scanner-controls.json` are both flagged (regression guard against a vacuous scanner) |
| `lifecycle` | instance startable (boot marker), `--profile web --dump-config` shows the mounted row in the composed tree, instance stoppable (port freed) |
| `probes` | every discovered probe group (`probes/*/index.mjs`) runs its `run(ctx)` — including `smoke`'s full chain (below) |
| `byte-clean` | **upstream tree pristine after the run**: `git status --porcelain` empty, `git diff` empty, HEAD unchanged — captured in-process via file-fd git children, no shell involved |

### The smoke group (demo probe chain)

`挂载一行插件 → dump-config 出现 → 启动成功 → 负例行 → 启动失败 → 恢复 → 停止`:

1. static checks: good probe's imports all admitted; bad probe's non-declared
   subpath all rejected by the **live** surface;
2. mount the good row → `dump-config` contains it → **start succeeds** (boot
   marker) → stop;
3. mount the bad row → **start fails loudly**: the boot log contains
   `ERR_PACKAGE_PATH_NOT_EXPORTED` **and** names the mounted row id
   (`p2t1-smoke-probe-bad`) — attribution, not just a generic failure. The
   failed-boot log is persisted as evidence
   (`logs/instance-port<port>-negative.log`);
4. restore the good row → **recovery start succeeds** → stop.

Final state: the good row is left mounted (same policy as the G1 baseline).

## Configuration

CLI flags > `CH_*` environment variables > defaults:

| Flag | Env | Default | Meaning |
|---|---|---|---|
| `--host-tree <dir>` | `CH_HOST_TREE` | `<team-root>/references/deepseek-harness-test-use` | pinned pristine upstream tree |
| `--dsh-home <dir>` | `CH_DSH_HOME` | `<team-root>/references/.dsh-test-p2t1` | dedicated test DSH_HOME (never the shared `.dsh-test`) |
| `--port <n>` | `CH_PORT` | `3281` | primary instance port |
| `--backup-port <n>` | `CH_BACKUP_PORT` | `3291` | used if the primary is busy (3080/3180-range is forbidden) |
| `--report-dir <dir>` | `CH_REPORT_DIR` | `<harness>/.run-logs` | evidence output: `run-log.txt`, `summary.json`, `logs/…` |
| `--only <section>` | — | (all) | run a single section: `preflight\|surface\|fixture\|static\|lifecycle\|probes\|byte-clean` |
| `--fixture-write` | — | off | regenerate `fixtures/host-version.json` (refused unless the tree is byte-clean) |

`CH_CLIENT_COMMIT_HASH` (default `cd5ef814`) is forwarded to the instance so
its build/runtime commit assumptions match the pinned tree.

### Path resolution (`findTeamRoot`)

Defaults assume the canonical team-repo layout. The harness walks up from
`tests/characterization/` (at most three levels) to the first ancestor that
contains `references/deepseek-harness-test-use`. In the canonical single
checkout that is the repo root; when the harness runs from a task worktree
(`.worktrees/<task>/tests/characterization/`) the walk lands on the **main
repo root**, where `references/` actually lives (`references/` and
`.worktrees/` are gitignored, so worktrees never contain them).

## Spawn mechanism (why the harness spawns the way it does)

The workspace-write sandbox matrix (probed with `spawn-probe.mjs`, evidence in
`dev/agent-workflow/evidence/P2-T1/spawn-probe-*.log`):

| Probe | Mechanism | Verdict |
|---|---|---|
| P1 | child spawn, piped stdio (`stdio: 'pipe'`) | **DENIED** — `EPERM` (-4048); named pipes are closed in confined modes |
| P2 | child spawn, **file-fd stdio** (`fs.openSync` fd as stdio entry) | **OK** — works for `node` children |
| P3 | child spawn, `stdio: 'inherit'` | OK, but output is uncapturable by the harness |
| P4 | child spawn, file-fd stdio | **OK** — works for `git` children too |

**Conclusion: file-fd stdio is the mechanism.** One `node run.mjs` process
therefore drives the whole instance lifecycle (boot, dump-config, stop) **and**
runs the exact byte-clean git commands (`git status --porcelain`, `git diff`,
`git rev-parse HEAD`) in-process — no pwsh orchestration, no shell quoting,
no output it cannot read back. pwsh-level spawning remains a documented
fallback for manual work. (pwsh→node/git spawns are unrestricted in this
environment; the denial is specific to *node* children with piped stdio.)

## Test instance / DSH_HOME policy

- The instance runs against the pinned tree with a **dedicated** DSH_HOME
  `references/.dsh-test-p2t1` (P2-T1's own home). The G1 baseline's shared
  `references/.dsh-test` is **never touched**, and the stable development
  instance (`:3080`, `D:\deepseek-harness\`) is never affected.
- `references/` is gitignored, so the DSH_HOME and the junction farm do not
  dirty any tracked tree.
- After every green run the DSH_HOME is retained (not deleted) and its
  composition layer holds the **good probe row** — the same final state the
  G1 baseline established — so the next run starts from a known mount state.
- The instance is launched exactly as TEST_METHODS.md §2 prescribes:
  `node apps/cli/lib/bin.js web --port <port> --no-open` with `DSH_HOME` and
  `DSH_CLIENT_COMMIT_HASH` set; the machine-level boot proof is the printed
  marker `dsh web: http://127.0.0.1:<port>/?token=...` (emitted only after
  the full plugin tree loaded — any entry import/activation failure aborts
  boot).

## Probe resolution (junction farm)

Probe plugins are mounted as literal `file:///…` rows in
`$DSH_HOME/profiles/web/cordis.patch.yml` (the public composition seam:
top-level array of `{ id, name }` insert rows; `name` may be a file URL).
Node resolves their bare imports by walking up from the literal file
location, so `ensureProbeResolution` maintains an idempotent `node_modules`
junction farm under `probes/` pointing into the **pinned** tree (e.g.
`@deepseek-ai/dsh-util-crypto` → `<pinned>/packages/util/crypto`). The farm is
created on every run (Windows junction / POSIX dir-symlink) and is gitignored.
This is resolution plumbing only — no upstream file is modified or copied.

The farm also serves the **negative** path deliberately: the bad probe's
package *is* locatable (via the farm), so its failure surfaces at the
**exports boundary** (`ERR_PACKAGE_PATH_NOT_EXPORTED`) instead of a plain
module-not-found — which is exactly the whitelist violation being
characterized.

## Adding a probe group (for P2-T2..T5)

Create `probes/<group>/index.mjs` — nothing else changes; `run.mjs`
auto-discovers every `probes/*/index.mjs` (sorted by name):

```js
export default {
  name: 'my-group',
  description: 'one line: what this group characterizes',
  async run(ctx) {
    // ctx.config      resolved run config (hostTree, dshHome, port, …)
    // ctx.harnessRoot / ctx.probesRoot   absolute paths
    // ctx.surface     live public-exports whitelist (Map; see lib/public-surface.mjs)
    // ctx.instance    DshInstance: start()/stop()/dumpConfig()/mountRows()/resetPatchLayer()
    // ctx.check(bool, msg)   record a pass/fail; any failure fails the run
    // ctx.log(msg)           console + run log
    // ctx.pluginUrl(rel)     file URL for a file under this harness (mount rows)
    //
    // Typical shape: mount rows via ctx.instance.mountRows([...]) → start()
    // → assert on observable behavior (dump-config text, HTTP, boot log) →
    // stop() → restore previous mount state before returning.
  },
}
```

Rules: probe *payload* plugins go under `probes/<group>/plugins/`; only files
under `plugins/` may import upstream subpaths, and only whitelisted ones may
be loaded by a passing path (negative fixtures live under
`plugins/negative-fixtures/` and are never loaded by a passing path). The
group must end with the instance stopped and the composition layer restored.

## Host-version fixture

`fixtures/host-version.json` (schema `p2t1-host-version/1`) pins:

- `upstreamSha` — the pinned commit
  (`cd5ef8148158c3a752a658978873241fdf8e2bbc`);
- one entry per package (272): name, `version`, `form`
  (`unrestricted`/`root-only`/`map`/`invalid`), sorted `exportsKeys`, and
  `rootTarget`.

The `fixture` section fails the run if the live tree's SHA or surface
fingerprint drifts from the fixture — pin-drift protection for every later
probe group. Regenerate with `--fixture-write` **only on a byte-clean tree**
(the run refuses otherwise); commit the regenerated file with the task that
moves the pin.

## Zero-core self-check (external proof)

The harness source must pass P1-T5's `scripts/verify-zero-core.mjs` (C4).
Three documented invocations (all from the repo/worktree root, `--host` =
pinned tree):

```
node scripts/verify-zero-core.mjs --host <pinned-tree>                                  # host tree alone
node scripts/verify-zero-core.mjs --host <pinned-tree> --plugin tests/characterization/lib
node scripts/verify-zero-core.mjs --host <pinned-tree> --plugin tests/characterization
```

Expected results (verified locally, logs in the evidence dir as
`zero-core-selfcheck-{host,lib,fulltree}.log`):

1. host tree alone → `PASS (0 findings)`, exit 0 — pristine upstream is
   zero-core clean (its own `node-pty` patch is reported as INFO, not a
   finding);
2. harness core (`lib/`) → `PASS (0 findings)`, **exit 0** — the harness
   source passes C4;
3. full harness tree → exactly **one** finding: the intentional negative
   fixture `probes/smoke/plugins/negative-fixtures/bad-host.js`
   (`private-subpath` for `@deepseek-ai/dsh-util-crypto/internal/random`).
   That single finding is the positive control: it proves the C4 scanner
   detects the deliberate violation, and that *every other* harness file
   (including the `run.mjs` entry) is C4-clean.

`verify-zero-core` always skips `node_modules` (so the junction farm is never
scanned) and does not scan `.json` (so `fixtures/scanner-controls.json` —
which deliberately contains import-looking strings — is inert for both the
external scanner and the harness's own static section).

## Known limitations

- **Frontend bundle 404 in the sandbox** (TEST_METHODS §2.2): `GET /?token=…`
  returns 404 locally because the web bundle cannot be built in the sandbox
  (vite→esbuild spawn). This is a **known non-criterion**: the machine-level
  boot proof is the `dsh web: http://…` marker (full plugin tree loaded),
  which is what the harness asserts. In CI (no sandbox) the bundle builds and
  the endpoint serves normally.
- **CI not executed in this environment**: `.github/workflows/characterization.yml`
  declares the job; per the task brief it was not run here. The local
  equivalent command (`node tests/characterization/run.mjs` against the
  pinned tree) is all-green — see `dev/agent-workflow/evidence/P2-T1/`.
- **pwsh 5.1 log encoding**: `Tee-Object`/`>` write UTF-16LE here, so the
  harness writes its own UTF-8 logs (node-side); pwsh is used only to
  invoke, never to tee, the canonical runs.
