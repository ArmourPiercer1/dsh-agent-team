# alpha5 glob-backend — the anchored confined-rg GLOB row (a5glb)

Writer lane: **`alpha5-glob-backend`** (disposable worktree `.worktrees/a5glb-backend`),
base = master **`382e5fb6f872e75937d389e96c5059f2945af8e5`** (fetch-verified at branch
creation). Worlds: `tests/homes/a5glb-*` (TEST_METHODS §5/§7), all self-removed by the
suites (`afterAll` → `destroyWorld`, and the `afterAll` *asserts* the worlds are gone — a
leaked world fails the run); **no retained world** on this lane. The harness also runs an
age-guarded **start sweep** of this lane's own `a5glb-*` leftovers (>20 min old, so a
sibling suite's fresh world is never touched — house precedent
`alpha5-glue7-backend` `07580728`); what it swept is published in
`parity-table.json → startSweepOfStaleWorlds` rather than hidden. Port family untouched —
this lane needs no server, and `:3080` was never contacted.

Closes the glob gap the plan names (`docs/plans/memo/alpha5-tool-io-governance/
alpha5-s0-pr0-pr8-implementation-plan.md` `:33` glob row, `:128` named dependency物,
`:132` native-vs-Team parity 判据, `:136` typed-shape law) **inside my own new files
only** — no plane / agent-bindings / install.ts / p4t6 / `plane-effect-backends.mjs`
edit. Integration is the glue writer's call; the mount contract is in §6 below.

## 1. Files this lane owns (the whole diff)

| path | kind |
| --- | --- |
| `packages/runtime/src/plugin/live/glob-backend.mjs` | NEW — `createAnchoredGlobBackend` + the anchor/verify law |
| `packages/runtime/test/alpha5-glob-harness.ts` | NEW — fixture tree, hand-written native oracle, TS faces |
| `packages/runtime/test/alpha5-glob-backend.test.ts` | NEW — RED pin + rg PARITY + LIVE + typed-shape + fixture hygiene (33 legs) |
| `packages/runtime/test/alpha5-glob-backend-adversarial.test.ts` | NEW — anchoring under attack, ≥5000-iter race (8 legs) |
| `packages/runtime/package.json` + `pnpm-lock.yaml` | `@deepseek-ai/dsh-tool-fs-search@0.2.0-rc.2` registered **in the same stroke** (`:128`) |
| `dev/agent-workflow/evidence/alpha5/glob-backend/` | this README + `parity-table.json` + `adversarial-counters.json` + `red-capture.txt` |

`plane-effect-backends.mjs` (the same-dir reference) is **not modified** — read only.

## 2. The anchoring law (self-contained, following the controlled-fs 道律 — NOT "只 realpath")

`realpath` before the spawn is the shape this lane refuses to ship: between the check and
the walk the tree can move. The row's law, in the order it runs:

- **A1 open-time handle, per component.** The governed root AND every component of the
  target are opened `O_RDONLY | O_DIRECTORY | O_NOFOLLOW` from the *root's own verified
  fd view*. A symlink component fails the open (`ELOOP`/`ENOTDIR`) and is refused —
  `symlink-alias` (an `lstat` only *names* the reason; the failed open is the verdict).
  Missing → `target-unresolvable`, non-directory → `not-a-directory`, and **the root path
  itself being a symlink → `root-symlink-alias`** (leg A3: `realpath(rootDir)` alone walks
  the outside tree the moment the root is swapped).
- **A2 exec-time re-read.** Every opened fd is re-read through
  `/proc/self/fd/<n>` (`fdPath`), canonicalised *without* following links
  (`canonicalOrSelf`, per-component `realpathSync` with `lstat` so a trailing symlink is
  kept visible) and required to sit **beneath the root's own anchor** — else
  `exec-time-escape` / `anchor-unverifiable`. This is the C-FS lane's
  `verifyOpenedHandle` shape, re-implemented here rather than imported.
- **A3 the handle stays open for the whole call.** The walk-root fd is carried on the
  anchor, closed only in a `finally`, and its `{dev, ino}` (plus the root's `{dev, ino}`)
  is re-checked at result time — a tree renamed/exiled/swapped mid-flight settles as
  `anchor-drift` / `root-drift`, never as an answer (leg A6).
- **A4 result-side verification.** Every path the walker emitted is proven to be a real,
  non-symlink **file** inside the anchor (same component law). One bad entry refuses the
  WHOLE walk — `walk-contaminated` / `walk-unverifiable` — instead of silently dropping a
  row. A `..`-crossing or absolute entry cannot be presented.

**Disclosed residua (no overclaim).**
1. `/proc/self/fd/<n>` re-resolves **by path**, not by inode pin, so an attacker who swaps
   a component *between* the re-read and the walker's own traversal is stopped by A1+A2
   (the walker's cwd/argv never name it) but the pin is not an `openat2(RESOLVE_BENEATH)`
   — the host exposes no such face to a plugin, and this lane invents none. What is proven
   is: what the row *accepts and presents* was opened, re-read and verified beneath the
   governed root.
2. A filename carrying a newline ends **typed** (`walk-unverifiable`, leg S3): the argv is
   the host's, so `--null` is not silently added.
3. A walk whose entries cross an escaping symlink is **refused whole** — a deliberate
   divergence from native rg, disclosed in §4.
4. No network claim: the confined request carries no network profile, and the row does not
   assert more than the provider's probe reported.

## 3. live 腿 — the real rg inside the existing confined provider

The row calls the provider's **public face only**
(`packages/runtime/sandbox-provider/index.js` → `createConfinedProcessProvider`,
`.probe()`, `.spawnStreaming(SpawnRequest)`); no private deep-link, no host edit.
Measured on this host (Leg L1 / `parity-table.json` row `L1 confine probe`):
**Landlock ABI v4, `content-read = enforced`**; a confined walk takes ≈45 ms and moves
`execCount()` with the closed stage trace `probe → prepare → execute → terminate` (L2).

Two **measurements that changed the design** (both are legs, not prose):

- **L3 — the confine guards BYTES, not NAMES.** Inside a confined child,
  `cat <outside>/secret.txt` → `Permission denied`, but `ls <outside>` **succeeds**.
  So "the sandbox is the backstop" only covers content; path-name disclosure is the row's
  own responsibility — which is exactly why A4 exists and why a realpath-only row is not
  enough. (Worth the plane's attention: the same asymmetry applies to every row that
  reports paths.)
- **L3b — a `/proc/self/fd/N` child cwd does not work here.** Passing the verified dir
  fd's magic link as the spawn `cwd` yields exit 0 with **zero rows and zero stderr**
  through this provider, while the identical argv from the anchored *path* cwd walks fine.
  A silently-empty answer is worse than a refusal, so this row passes the anchored path as
  `cwd` (argv carries no search path at all) and puts its trust in A1–A4.

## 4. rg PARITY 判据 (`:132`) — native vs Team, same parameters

The native side is invoked with the **hand-written** argv in the harness, and leg **P0**
pins that spelling to the host's public `buildGlobCommand` — so a parity match cannot be
true by construction. Fixed fixture tree (17 files, frozen mtimes; VCS stores;
`.gitignore`d subtree; a hidden dotdir; a `node_modules` copy). Full numbers:
[`parity-table.json`](parity-table.json) — **17 rows, 16 exact order-matches, 1 disclosed
divergence** (`L3b`, which is a measurement of an alternative design, not a walk).

| class (leg) | native | Team | verdict |
| --- | --- | --- | --- |
| basic `**/*.ts` (P1) | 6 | 6 | same paths, **same modification-time order** |
| hidden (P2 / P2b) | 6 / 18 | 6 | dotfiles + `dotdir/.secret.log` in on both sides; control legs show `--hidden` is what admits hidden entries when no positive glob names them |
| ignore (P3) | 6 | 6 | governed argv is `--no-ignore`: `ignored/drop.ts`, `node_modules/...` present; control leg (`--no-ignore` off) hides both |
| VCS (P4) | 12 | 12 | all six `GLOB_VCS_EXCLUDES` stores out on both sides; without the negations native leaks `.git/config` |
| subtree target (P5) | 3 | 3 | sub-directory walk, presented root-relative |
| absolute target inside the root (P6) | 1 | 1 | `absolute-path` placement, same order |
| sort stability (P7) | 6 | 6 | identical order across three re-runs; order is mtime, not name |
| sort tie (P7b) | 2 | 2 | equal mtimes: same set, and OUR order never moves between runs (rg's tie order is unspecified — we do not claim it) |
| empty (P8) | exit 1 | 0 rows | typed empty shape; native exit 1 is NOT an error |
| illegal pattern (P9) | exit 2 | `undetermined / rg-walker-error` | carries rg's own words (`error parsing glob`), never a fake-empty list |
| over-cap (P10) | 105 | **100 inline (`GLOB_MAX_RESULTS`) with `totalMatches = 105`, `truncated: true`** | the full 105 match native when the assembly raises the ceiling to 105 |
| sink bytes (P11) | — | — | `io.sink` received **byte-identical** native stdout |
| escaping symlink (S1) | 8 | 8 | rg neither follows nor lists it (so parity holds); A4's teeth are proven separately against a hostile entry list (`../outside/secret.txt`, absolute, an in-tree escaping symlink) |

## 5. 对抗腿 (`adversarial-counters.json`)

`rename → symlink` swap race against the anchored path, attacker flipping it every
iteration between a real directory and a symlink onto the outside canary
(`real`/`link` both observed):

- **A4 — 5000 iterations: 2500 anchors accepted / 2500 refused, 0 hostile entries
  accepted, 0 leaks.** The leak detector is not a verdict check: every accepted entry is
  *read back* and compared against the canary, and every refused state is counted.
- **A5 — 120 REAL confined-rg walks under the same swap**: 60 `symlink-alias` refusals,
  the other 60 answering only with `live/…` entries that read back as the inside marker.
  (The loop against the real child is bounded at 120 because a confined spawn measures
  ≈45 ms here; the law itself is exercised 5000× in A4.)
- **A1/A2** mid-segment and last-segment symlink escapes refused **before any process
  exists** (`execCount()` does not move); **A3** root swapped to a symlink → refused;
  **A6** anchor exiled out of the governed root mid-flight → `anchor-drift`, never an
  answer; **A7** no pattern (`../..`, `**/outside/**`, `/etc/**`, `**/leak.ts`) ever
  presents a path outside the root; **A8** publishes the counters.

## 6. 集成契约 (for the glue writer — nothing here edits the plane)

Export signature (`packages/runtime/src/plugin/live/glob-backend.mjs`, plain `.mjs`, node
imports only):

```js
export function createAnchoredGlobBackend(options: {
  realmId: string,                      // confined provider realm
  rootDir: string,                      // the GOVERNED root (workspace root of the plane)
  confined: {                           // same conf the plane already carries for the shell row
    trustRoot: string, scratchRoot: string,
    assembly: { launcherPath: string, launcherSha256: string, minAbiVersion: number },
    runnerCommand?: [string, ...string[]],
  },
  maxResults?: number,                  // default GLOB_MAX_RESULTS (host public root)
  timeoutMs?: number,                   // default GLOB_WALK_TIMEOUT_MS (60_000)
  observe?: (line: string) => void,     // the row's own log lines (echo style is the plane's)
}): {
  backendId: 'a5glb-anchored-confined-rg-glob',
  run(call, io): Promise<BackendResult>, // never throws; closed triad denied|hidden|undetermined
  execCount(): number,                   // pre-execute refusals never move it
  lastStageTrace: readonly string[],     // probe → prepare → execute → terminate
  lastRuns: readonly { pid, exit, ms, rows, truncated, code }[],
}
// also exported for review/verification: GLOB_BACKEND_ID, GLOB_WALK_TIMEOUT_MS,
// GLOB_MAX_RESULTS_CEILING, GLOB_MAX_WALK_BYTES, globIsBeneath, openAnchoredWalkRoot,
// verifyGlobResultsBeneath, globArgv, parseWalkOutput
```

`run()` returns the lane's own outcome shape
`{ ok: true, outcome: { outputMode: 'files_with_matches', matches: [], counts: {}, files, totalMatches, truncated }, settlement: { kind: 'completed' | 'cancelled' } }`
— i.e. what `formatGlobOutput` in the host package consumes. **`formatGlobOutput` is
intentionally not called here** (spill-bound and rendering stay single-owned by the plane,
the same ruling the glue lane disclosed); `toWorkdirRelative` remains available if the
integrator prefers presentation to move. `parseGlobArgs` IS reused as a second validation
gate, and `resolveRgPath` as the binary locator — both from the host package's public root.

Mount line (the plane **already** accepts this input; `register.ts:118` falls back to
`searchBackend` when it is absent — that fallback is exactly what leg R1 pins):

```js
// where the plane assembly is built (glue writer's file, one line):
backends: {
  glob: createAnchoredGlobBackend({
    realmId, rootDir: <the same governed root the fs row uses>,
    confined: <the same confined conf the shell row uses>,
    observe: (line) => { stdoutEcho(`[team-tool-plane] ${line}`) },
  }),
}
```

One mount must be chosen: the `alpha5-glue7-backend` lane carries its own inline
`createAnchoredGlobBackend` (`backendId 'a5g7-confined-rg-glob'`) inside
`plane-effect-backends.mjs`. Two rows for one verb is not a merge state; the reviewer's
gap list for that row (no parity table, no result-side verification, its race leg at 200
iterations, one failure class outside the closed triad) is in the parent's report of
this lane.

## 7. Reproduction

```bash
cd .worktrees/a5glb-backend
pnpm install --offline --ignore-scripts --store-dir ../../.pnpm-store-a5g7   # or the shared store
npx vitest run packages/runtime/test/alpha5-glob-backend.test.ts \
               packages/runtime/test/alpha5-glob-backend-adversarial.test.ts
# regenerate the evidence artifacts (proven byte-stable: identical across two runs,
# no timestamps, no per-run world paths — the only `a5glb` string in them is the backend id):
A5GLB_EVIDENCE_DIR=$PWD/dev/agent-workflow/evidence/alpha5/glob-backend \
  npx vitest run packages/runtime/test/alpha5-glob-backend.test.ts \
                 packages/runtime/test/alpha5-glob-backend-adversarial.test.ts
pnpm -r run typecheck && npx eslint packages/runtime/src/plugin/live/glob-backend.mjs packages/runtime/test/alpha5-glob-*.ts
```

Leg **H1** is the fixture-hygiene law itself (a stale `a5glb-*` world is swept, a world
created microseconds earlier survives — a first draft of the sweep got the age parsing
wrong and swept a live sibling's world, so both halves are now pinned, not just noted).

`red-capture.txt` is the pre-row state, captured verbatim off the shipped plane (the
`R1` leg keeps that text pinned forever, so the RED face stays checkable after the row
lands). The suites need this host's Landlock (probe enforces it); on a host without it
the live/adversarial-real legs fail loudly — the row refuses, it never fakes.

Last recorded run on this host: **41/41 legs green** (33 row + 8 adversarial),
`pnpm -r run typecheck` exit 0 across all 9 packages, `eslint` clean on all four new
files, `parity-table.json` + `adversarial-counters.json` byte-identical across two
consecutive runs, zero leftover `tests/homes/a5glb-*` worlds.

## 8. Dependency registration (`:128`, same stroke)

`@deepseek-ai/dsh-tool-fs-search": "0.2.0-rc.2"` added to
`packages/runtime/package.json` with `pnpm-lock.yaml` in the same commit
(`version: 0.2.0-rc.2(dd915b1c3d0ea66ee534758c47dc32c7)`), OPTIONAL_ONLY BFS carries
`@vscode/ripgrep` → the measured binary is **ripgrep 15.0.0 (rev 3a612f88b8)**
(`@vscode/ripgrep-linux-x64@1.18.0`, 5 728 032 bytes), resolved through the package's own
`resolveRgPath()` and never hardcoded.
