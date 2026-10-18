# A5-SRGP — the plane's search row at rg parity (PR5 "原生等价层")

* lane: search rg-parity writer (`alpha5-srgp`), base `alpha5-int-mnt @ afd936ee`,
  one-time worktree `.worktrees/a5srgp`
* requirement: `docs/plans/memo/alpha5-tool-io-governance/alpha5-s0-pr0-pr8-implementation-plan.md`
  **:33** `| **PR5** | `grep/glob` R3 + Bash/Pwsh Tool Adapter + 原生等价层 | … |`
  and **:132** "`grep/glob` 真实固定 rg 版行为回归（原生 vs Team 的结构化 value、
  meta/render、错误、binary、ignore/hidden/VCS、路径、溢出 Spill、本机/并发/
  Cancel/timeout）"
* walker baseline (resolved by the host's public `resolveRgPath()`, never a path
  literal in production code): **ripgrep 15.0.0 (rev 3a612f88b8), features
  `+pcre2`**, from `@vscode/ripgrep-linux-x64@1.18.0`
* host: 0.2.0-rc.2 @ `639ed01539`; launcher
  `packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py`
  (abi 4, `sha256:0049965daacae5bd…`)
* the glob row (`packages/runtime/src/plugin/live/glob-backend.mjs`, #322) is the
  law template: same anchor, same confined provider face, same refusal
  discipline, same "the public package root is the only rg vocabulary" rule.

## What shipped

| path | role |
| --- | --- |
| `packages/runtime/src/plugin/live/search-backend.mjs` | NEW production live row `a5srgp-anchored-confined-rg-grep`: the governed search body. |
| `packages/runtime/test/alpha5-search-harness.ts` | fixture + HAND-WRITTEN native oracle + typed faces (reuses the glob harness's world/provider helpers). |
| `packages/runtime/test/alpha5-search-backend.test.ts` | 34 legs: R1–R5 RED control, argv law, P-series parity, V-series anchor/refusal, M-series mount. |
| `packages/runtime/src/plugin/live/plane-effect-backends.mjs` | search row + assembly ONLY: the factory delegates to the new row where a confined provider exists, keeps the grep(1) port where none does. Glob / shell / read rows untouched. |
| `dev/agent-workflow/evidence/alpha5/srgp/**` | this README, `probes/**` (the measurements), `parity-table.json` (the suite's own parity witness). |
| bookings | `p4t6-session-event-scan.test.ts` (`SCANNED_PATHS_A5SRGP`, 1184 → 1187), `a5p4-lane-hygiene.test.ts` + `a5w-integration-wiring.test.ts` (third named confined-provider consumer), `a5p5-dormant-audit.test.ts` (names-only exception), `scripts/place-dist-glue.mjs` (src→dist placement). |

## The fixed argv — one measurement, one builder

```
<rg> --no-config --json --regexp=<P> [--glob=<inc>] --no-messages --no-ignore-parent --no-ignore-global -- .
```

| token | provenance | why it is frozen |
| --- | --- | --- |
| `--no-config` | the host's own prefix (`runRipgrep` prepends it to any argv) | a `RIPGREP_CONFIG_PATH`, and through it a `--pre` program, never steers a governed search. |
| `--json --regexp=<P> [--glob=<inc>]` | the PUBLIC package root's `buildGrepCommand(parseGrepArgs(...))` — the row builds no rg syntax of its own | the lane's `globFilter` is the host's `--glob=` form; the lane's `pattern` never becomes a positional. |
| `--no-messages` | addition (probe F/D series) | walking a root that is not its own git root, rg prints `…/.git: Permission denied (os error 13)` on EVERY walk — an OUTSIDE path name on a channel. It silences that class only: a walk ripgrep refuses to start still emits nothing on stdout, and a no-match filter still ends with a summary (`P10`). |
| `--no-ignore-parent`, `--no-ignore-global` | addition (probe Q series) | the confined child cannot read the parent's ignore files anyway; pinning the flags makes the row's ignore law the walker's DEFAULT rather than an accident of whichever parents happen to be readable. Selection-neutral in measurement, so it cannot widen anything. |
| `-- .` (or the file's own basename) | addition — load-bearing | inside the confine fd 0 is a socket, and rg 15's stdin heuristic then "chooses to search stdin", answering **exit 0 with zero records and zero stderr**. An explicit search element is the only thing that makes the walk happen (`dot-arg-probe` D1 vs D3). Second belt: `child.stdin.end()` right after spawn. Suite leg `explicit-path-is-load-bearing`. |

The row's three modes are ONE protocol: `content`, `files_with_matches` and
`count` all read the same `--json` record stream (`parseGrepMatches`), with the
lane's projections applied afterwards. Measured reason (probe
`binary-and-mode-probe.mjs`, legs N5/N6/N14): the plain `-l`/`-c` protocols are
newline-framed and cannot represent a newline in a file name; `-c`'s per-path
counts equal the per-path match-record counts, so the projection is not an
approximation.

## The three facts about this execution face (each pinned by a leg)

1. **There is no payload exit code to read.** The pre-launcher supervises the
   child, records its rc in its own bookkeeping and
   `sys.exit(0)`s regardless (`landlock-prelauncher.py:496`); through
   `spawnStreaming`, `/bin/sh -c 'exit 7'` settles `{ code: 0 }`. A row that
   treated `exit 0` as "the walker succeeded" would trust a walk that never
   started. Leg `P8b` measures all three cases (child exit 7 → face 0; a
   completed rg walk → face 0 + `summary`; a refused pattern → face 0 + no
   bytes). **This is a provider-face fact worth the plane lane's attention: any
   row on this face that reports a payload exit status is reporting the
   launcher's.**
2. **Completion is provable from the protocol.** A `--json` walk that runs to
   completion always ends with a `summary` record (measured: matches, zero
   matches, absent target, no-match filter); a walk ripgrep refused to start
   produces ZERO bytes. So the row's error law is: no summary ⇒ typed refusal,
   classified by the host's own rule (`/regex parse error|error parsing glob/i`
   ⇒ `walker-invalid-pattern`, else `walker-error`), carried as a CODE plus byte
   counts. The walker's sentence is enumeration data: internal face only (A8).
3. **Zero records is not evidence of an empty tree.** The same silent-zero shape
   comes from the stdin heuristic (above) and from a launcher exec failure —
   hence the explicit path, the completion law, and `launcher code ≠ 0` being
   its own refusal class.

## Parity witness

`parity-table.json` is written by the suite itself (`A5SRGP_EVIDENCE_DIR=…`) with
byte-stable content: the fixed argv, the rg baseline, the launcher pin, and one
row per parity leg carrying the native exit code, both counts, the row's verdict
and the comparison THAT LEG asserted (P4's comparison is deliberately not a set
equality — it is "absent here, present in the `--no-ignore --hidden` control").
9 of 9 legs `match: true`:

| leg | class | native fact | row answer |
| --- | --- | --- | --- |
| P1 | content rows | 9 records, exit 0 | 9 rows, identical `(path, line, text)`, anchored spelling, one spill write |
| P2 | `files_with_matches` | native `-l` oracle | projection equal, modulo the plain form's split of the newline-named file |
| P3 | `count` | native `-c` oracle (`src/twice.ts:2`) | projection equal (per-path record counts) |
| P4 | ignore / hidden / VCS | control finds `ignored/drop.ts`, `node_modules/pkg/index.ts`, `.hidden.ts`, `dotdir/.secret.log`, `.git/config`, `.svn/entries` with `--no-ignore --hidden` | none of them in the answer; every included file in it |
| P5 | binary | no `match` record for a NUL-bearing line (`--text` proves the token is there) | same absence — and it is the walker's law, not a fixture gap |
| P8 | error | `(` ⇒ exit 2, zero bytes | `walker-invalid-pattern`, `undetermined`, zero spill, walker words absent from the wire |
| P9 | empty | exit 1 + summary | success with `totalMatches: 0`, zero spill bytes |
| P10 | include filter | `*.ts` honored; `*.md` ⇒ exit 1 + summary | same, both arms |
| P11 | overflow / Spill | 129 records | `maxResults: 5` ⇒ 5 inline + `truncated: true` + `totalMatches: 129`, ONE spill write carrying every admitted row; tiny `maxJsonBytes` ⇒ `output-too-large` with zero spill; `timeoutMs: 1` ⇒ cancelled settlement with zero spill |

Disclosed deltas (measured, not smoothed): the native **plain-text** oracles
cannot carry `newline<LF>name.ts` and print it as two entries; the row's VALUE is
a structured array so it carries the whole name (`P7`), while its line-framed
SPILL TEXT inherits the same ambiguity (+1 line, pinned in `P1`/`P11`) — nothing
parses that render back, and the grep control has the same property plus the
worse one of splitting the entry in its own outcome (`R5`).

## The RED control (why the change is real)

Legs R1–R5 pin the SHIPPED grep(1) row, unchanged, as the fact it is: its argv
form (including the `-rIn` + spliced `-rl` quirk), the fact that it finds
`ignored/drop.ts`, `node_modules/pkg/index.ts`, `.hidden.ts`, `.git/config`,
`.svn/entries`, that `-C 1` arrives as matches whose `path` is a whole grep line
and whose `text` is empty, that `multiline` was already refused by name, and that
one newline-named file becomes two entries (`newline`, `name.ts`). R3 is the
mangling the rg row refuses to reproduce; `contextLines` is refused by name
because ripgrep answers `-C n` with a distinct `context` record (probe N9) that
the lane's `SearchMatchLine` has no arm for.

## Anchor and refusal law (inherited, not forked)

* the walk root is opened by `openAnchoredWalkRoot` **imported from
  `glob-backend.mjs`** — component-wise `O_NOFOLLOW | O_DIRECTORY` opens from the
  governed root, `/proc/self/fd/<n>` re-reads, pinned anchor identity; refusals
  coming out of that shared law are re-wrapped through this row's own table so
  only this row's codes and prose reach the wire.
* post-walk: `verifyGlobResultsBeneath` (same shared law) plus
  `verifyAnchorStillGoverned` before a single byte is presented — an anchor that
  vanished or drifted mid-walk is `exec-time-escape` / `anchor-drift` /
  `anchor-unverifiable`, never an empty answer (`V11` measures the vanished case).
* paths presented: the anchored absolute spelling under the governed root,
  produced by ONE function after admission (single producer), with `..`-bearing
  or outside records refused (`P6`).
* exactly ONE `io.sink.write` in the module, after the verdict, of all admitted
  rows; the stdout data handler touches no channel (leg `source-law` checks the
  source, not just the behaviour).
* closed code/family table: `a5srgp-refused/pre-execute | walker | verification |
  transport`, every code enumerated, `detail` always the table's own prose,
  counts integers only. Grammar swept over a battery of malformed calls (`V9`),
  `run()` never throws (`V10`), and the audit line carries codes and arithmetic
  only — no path, no row, no walker words, no token (`V12`).
* refused BY NAME before any process exists: non-grep tool, `multiline`,
  `contextLines > 0`, unknown placement (including the lane's `realm-home`, which
  this row has no anchor law for), pattern/filter rejected by the host's own
  `parseGrepArgs`. A refusal costs zero processes and zero bytes (`execCount`
  proves it).

## Mount story and the one gap

`createAnchoredSearchBackend({ realmId, rootDir, observe, confined, … })`
delegates to the rg row when `confined` is present and keeps the grep(1) port
when it is not — the fsInstance-only mount (legs G1/G1b/G2/G9 of
`alpha5-glue7-plane-backends.test.ts`) must not lose its search row, and the
retired port stays as the disclosed control. The delegation is covered by legs
M1–M3 (rg answer through the plane factory; grep answer without a provider;
face keys identical to the plane contract).

**Gap for the integration owner (outside this lane's ownership):** the mount in
`packages/runtime/src/plugin/live/team-tool-plane.mjs` still calls
`createAnchoredSearchBackend({ realmId, rootDir: fsInstance.rootDir, observe: … })`
without `confined`, exactly as it did before — so in production today the search
row is STILL the grep port while the rg row is mounted only where a caller passes
the provider conf (which is how the glob row is mounted, ~`:407`). Closing it is
one line (`confined: confinedCfg` at the search mount, the glob mount is the
pattern), and the shipped-dist placement for this row
(`scripts/place-dist-glue.mjs`) is booked so the placement gate stays true once
that line lands.

## Validation

* `packages/runtime/test/alpha5-search-backend.test.ts` — 34/34 green, live legs
  on the REAL confined provider (Landlock child, real rg 15), worlds
  `tests/homes/a5srgp-*` created and destroyed inside the run
  (`destroyWorldVerified` re-appearance count asserted 0).
* neighbours: `alpha5-glue7-plane-backends` + `a5p4-lane-hygiene` +
  `a5w-integration-wiring` 38/38; `alpha5-glob-backend` + adversarial 57/57;
  `packages/testkit` `p4t6-session-event-scan` 10/10 (count 1191 → 1194 after the
  booking); `packages/tools/a5p5-tools` `a5p5-dormant-audit` 7/7.
* typecheck: `pnpm -r run typecheck` green across all nine packages.
* lint: `npx eslint <the nine touched files>` clean (no repo-wide lint run).
* shipped-surface placement: `node scripts/place-dist-glue.mjs` placed
  `search-backend.mjs` + the rebuilt `plane-effect-backends.mjs` into
  `packages/runtime/dist` byte-identically (8 placements, the other 6 unchanged),
  and `node scripts/check-artifacts-committed.mjs` named exactly those two files
  as the drift to commit with the source (`verdict=stale … drift=2`), which the
  commit does.
* full-tree captures (`packages/runtime`, `npx vitest run`, twice —
  `logs-runtime-capture1.txt`, `logs-runtime-capture2.txt`):
  4603/4613 and 4602/4613. The runtime share of the published red set —
  `p6t3-mediation` ×5 and `p6t3-restart` ×2 — is present and identical in both.
  Three differences from a naive "same nine" comparison, all measured and none
  produced by this lane:
  - `rc2-persona-probe` ×3 and the collection of `a4pr0a-fact-type-closed-set`
    fail in a one-time worktree because `findTestRepoRoot`
    (`tests/paths.mjs`) looks for `tests/deepseek-harness-test-use`, which is
    gitignored and NOT provisioned in `.worktrees/a5srgp`; the walk therefore
    climbs out of the worktree and pins REPO_ROOT to the MAIN checkout, and both
    suites then measure THAT tree (the persona probe `ENOENT`s
    `/srv/workspace/dsh-plugins/dsh-agent-team/packages/runtime/root-binding/harness/persona-probe.mjs`;
    the a4pr0a guard throws `FACT_TYPE_CATEGORY block not found` against the main
    checkout's `projection-source.ts`, which carries 3 occurrences against this
    branch's 4). Both fail IDENTICALLY with this lane's production edit stashed,
    so neither is caused here. The fix is provisioning, not code: clone the
    pristine baseline into this worktree as the sibling lanes did
    (`TEST_METHODS` §2; ~3 GB, and this host is at 95 % with 5.8 G free, so this
    lane did not do it).
  - capture 2 additionally lost `a3p3-governance-lane-hygiene` to
    `Test timed out in 5000 ms` at `:767` (a heavy source-scan leg under full
    parallel load; the capture ran while other jobs were live). It passes 21/21
    twice in isolation. Recorded rather than hidden: that leg has no explicit
    timeout, so its red is load-dependent.
* tree hygiene: the provider scratch that confined runs leave at the runner cwd
  (`packages/runtime/{out,plans,probe-*}`, also recreated by the pre-existing
  `rc2-persona-probe` during these captures) is deleted, no `a5srgp-*` world
  remains under `tests/homes`, and `git status --ignored packages` afterwards
  shows only this lane's own files.
