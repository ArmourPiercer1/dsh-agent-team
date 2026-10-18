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
| bookings | `p4t6-session-event-scan.test.ts` (`SCANNED_PATHS_A5SRGP`, 1184 → 1187 on the lane base; re-measured to 1191 → 1194 on the master replay), `a5p4-lane-hygiene.test.ts` + `a5w-integration-wiring.test.ts` (third named confined-provider consumer), `a5p5-dormant-audit.test.ts` (names-only exception), `scripts/place-dist-glue.mjs` (src→dist placement). |

## The fixed argv — one measurement, one builder

```
<rg> --no-config --json --regexp=<P> [--glob=<inc>] --no-ignore-parent --no-ignore-global -- .
```

| token | provenance | why it is frozen |
| --- | --- | --- |
| `--no-config` | the host's own prefix (`runRipgrep` prepends it to any argv) | a `RIPGREP_CONFIG_PATH`, and through it a `--pre` program, never steers a governed search. |
| `--json --regexp=<P> [--glob=<inc>]` | the PUBLIC package root's `buildGrepCommand(parseGrepArgs(...))` — the row builds no rg syntax of its own | the lane's `globFilter` is the host's `--glob=` form; the lane's `pattern` never becomes a positional. |
| **(no `--no-messages`)** | round-2 measurement (`coverage-probe.mjs` A–J) — its ABSENCE is the law | the flag was in the argv in round 1 to keep the upward-discovery noise off a channel. Measured: it also erases the ONE line that separates "this tree has nothing to search" from "the kernel refused the walk" (leg G vs leg B: same completion record, same `stats.searches=0`, stderr emptied). The noise it was added for names an ABSOLUTE path and is separable by shape, so the flag costs the coverage signal and buys nothing. |
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
  `contextLines > 0`, `fixed_string`, `ignore_case`, unknown placement (including
  the lane's `realm-home`, which this row has no anchor law for), pattern/filter
  rejected by the host's own `parseGrepArgs`. A refusal costs zero processes and
  zero bytes (`execCount` proves it), and its prose is the table's, never a
  caller's (`V1-V6`).

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
the provider conf. Closing it is one line — `confined: confinedCfg` at the search
mount — and the shape to copy is the row right below it in the same file, the shell
backend, which already takes `confined`. The lines move per tree, so they are named
per tree: `:392` / `:394-401` on the pre-squash base, `:521` / `:529` on the master
replay base (`15481988`). The shipped-dist placement for this row
(`scripts/place-dist-glue.mjs`) is booked so the placement gate stays true once that
line lands. An earlier draft of this paragraph pointed at "the glob mount" as the
pattern, which was true on the lane branch and is not true on master: the glob row
is not production-wired there (see the replay section).

## Validation

Which tree: the captures and gate numbers in THIS section were taken in the lane
worktree (base = the integration tree `afd936ee`). The replay section at the end of
this file records the set re-run on master `15481988`, where the booked scanner
number moves.

* `packages/runtime/test/alpha5-search-backend.test.ts` — 40/40 green (round-1 head: 34/34), live legs
  on the REAL confined provider (Landlock child, real rg 15), worlds
  `tests/homes/a5srgp-*` created and destroyed inside the run
  (`destroyWorldVerified` re-appearance count asserted 0).
* neighbours (re-run after the round-2 row change, since the argv and the refusal
  set both moved): `alpha5-glue7-plane-backends` + `a5p4-lane-hygiene` +
  `a5w-integration-wiring` + `alpha5-glob-backend` + its adversarial file — 95/95;
  `packages/testkit` `p4t6-session-event-scan` 10/10 (count 1191 → 1194 after the
  booking); `packages/tools/a5p5-tools` `a5p5-dormant-audit` 7/7.
* typecheck: `pnpm -r run typecheck` green across all nine packages.
* lint: `npx eslint <the touched files>` clean (no repo-wide lint run), in both
  rounds.
* round-2 re-runs after the behaviour change: `alpha5-search-backend` +
  `alpha5-glue7-plane-backends` 56/56; `a5p4-lane-hygiene` + `a5w-integration-wiring`
  + both glob-row files 95/95; `p4t6-session-event-scan` 10/10 (no new package
  files, so the 1187 booking holds ON THAT TREE — master re-anchors it, see the replay
  section); `a5p5-dormant-audit` 7/7 — earned the hard
  way: a comment in shipped source naming the lane's tool package is an OFFENDER
  for that ledger, so the shipped prose cites `src/args.ts:148-149` without the
  package name.
* shipped-surface placement: `node scripts/place-dist-glue.mjs` placed
  `search-backend.mjs` + the rebuilt `plane-effect-backends.mjs` into
  `packages/runtime/dist` byte-identically (8 placements, the other 6 unchanged),
  and `node scripts/check-artifacts-committed.mjs` named exactly those two files
  as the drift to commit with the source (`verdict=stale … drift=2`), which the
  commit does.
* full-tree captures (`packages/runtime`, `npx vitest run`): round 1
  `logs-runtime-capture1.txt` / `logs-runtime-capture2.txt` (4603/4613,
  4602/4613); round 2, after the argv and verification changes,
  `logs-runtime-capture3.txt` / `logs-runtime-capture4.txt` — 4608/4619 in both,
  and the two failure-line sets are identical to each other (4613 → 4619 is this
  lane's +6 legs). The runtime share of the published red set —
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
  - `a3p3-governance-lane-hygiene` loses one leg (`:767`, a heavy source scan) to
    `Test timed out in 5000 ms` in every full-tree capture from round 1's second
    run onward — 6.9 s and 7.3 s against a 5 s default timeout in round 2's two
    captures, and 21/21 in isolation both before and after them. It is in BOTH
    round-2 captures, so it is not a one-run flake: it is a load-dependent leg
    with no explicit timeout. Disclosed rather than hidden; untouched, as it is
    outside this lane's ownership.
* tree hygiene: the provider scratch that confined runs leave at the runner cwd
  (`packages/runtime/{out,plans,probe-*}`, also recreated by the pre-existing
  `rc2-persona-probe` during these captures) is deleted, no `a5srgp-*` world
  remains under `tests/homes`, and `git status --ignored packages` afterwards
  shows only this lane's own files.


## Round 2 — the solo review's fix order (closed before the mount flip)

The solo review of the first head (`f0831531`) found no blocker but two gaps that
had to close before anyone flips the mount. Both are closed here, and both changed
behaviour, so both are measured in `probes/coverage-probe.mjs` first.

**① `fixed_string` and `ignore_case` were being DROPPED SILENTLY.** They are lane
vocabulary (`packages/tools/a5p5-tools/src/args.ts:148-149`), the grep(1) port this
row replaces honours them (`plane-effect-backends.mjs:120-122` pushes `-F` / `-i`),
and the host's public `buildGrepCommand` has no arm for either — so the row was
accepting a knob and answering a different question. That is the one thing this
row's own law forbids ("refused BY NAME, never reinterpreted"), so both are now
refused by name (`fixed-string-unsupported`, `ignore-case-unsupported`,
`a5srgp-refused/pre-execute`, zero children, zero spill) exactly like `multiline`
and `context`.

The refusal rather than the mapping, deliberately: `(?i)` IS answered by this
walker (leg `V6b` measures it finding what the case-sensitive pattern does not),
and a literal-mapping could be built by escaping metacharacters — but both are the
row inventing a mapping the host does not own, i.e. a semantic expansion of a
frozen argv whose whole value is that it is one measurement. The refusal costs zero
new semantics. When the host's vocabulary grows an arm, this row picks it up
through `buildGrepCommand` without changing. The capability delta against the port
is pinned from BOTH sides in `V6b` so nobody meets it as a surprise.

**② A directory target never re-checked the governed ROOT after its walk.** The row
re-checked its own anchor (view + inode), which is the arm that catches an object
removed under the walk; the shared law's `rootIdentity` arm is the one that catches
the governed ROOT being replaced underneath the anchor, and a directory target never
reached it (only a file target did, via its entry list). Post-walk the row now runs
BOTH arms for BOTH target kinds — the shared verifier with the file's own name, or
with the EMPTY list for a directory. Measurement decided the shape, not aesthetics:
leg `V11` records that the shared law's empty-list arm does NOT notice a removed
anchor (an unlinked directory keeps its inode and its `/proc/self/fd` view), and
leg `V11b` that the anchor-inode arm does not notice a swapped root. Each arm sees
what the other cannot.

**The hole that fell out of ②, closed.** Measuring the kernel-refused walk showed
`--no-messages` (present in round 1) emptied stderr on a walk the kernel refused
end to end, so an empty answer was indistinguishable from a refused one on every
channel the row can see. The flag is gone; the row now reads the CLASS of the
walker's permission errors — relative path ⇒ the walk's own coverage failed ⇒
`walker-permission-refused` (`undetermined`), absolute path ⇒ rg's upward discovery
of a parent `.git`, which appears on EVERY walk here and is not this answer's
business. Natively the same partial refusal is exit 2, which `search-core` maps to
`SEARCH_FAILED`: the row is re-pressing the host's verdict through the one channel
that survives this face, not inventing a stricter one.

New legs: `V6b`, `V11b`, `V11c` (the coverage law live, on a chmod-000 file),
`V11d` (the classifier, both classes), `V11e` (source law: coverage after
completion, before any record is trusted; both verification arms present),
`V11f` (shared-law refusals arrive in this row's vocabulary) — **34 → 40 legs**,
and `argv-law` / `argv-additions` now pin the ABSENCE of `--no-messages`.


## Replay on master `15481988` (`alpha5-srgp-pr2`) — two laws carried, every number re-measured

`#322` squashed into master, so a chain value from any earlier branch is a different
tree's ledger. Redone from `15481988` with `cherry-pick -x` of `c0b81cc3` + `559e4424`
plus this replay commit; the booked numbers were produced on the new tree, not
inherited.

| booking | earlier chain value | master replay | how it was obtained |
| --- | --- | --- | --- |
| p4t6 scanner total | lane 1184 -> 1187; pre-squash PR 1190 -> 1193 | **1191 -> 1194** | master's OWN `p4t6` file, run against this tree with the clause unbooked, read `expected 1194 to be 1191` — master's booked 1191 plus exactly this lane's three paths. Booking them by name ends the chain at 1194, the scanner total of this tree. |
| provider-consumer ledgers | equality list of offender paths (lane) | `NAMED_PROVIDER_MOUNTS` entry | master carries the stricter structure already, so the search row is booked as a mount: pinned public-face edge, deep imports refused, factory call counted. No number to copy, nothing to re-anchor. |
| `place-dist-glue` | glob + search copies (lane) | **search only** | see the placement law below. |

**Placement law (carried unchanged).** Master ships `glob-backend.mjs` as a DORMANT
file: `plane-effect-backends.mjs` still builds the glob row inline and imports nothing
from it, and master's own placement list has no glob entry. So the byte-copy list here
carries `search-backend.mjs` alone; a copy of a row no shipped file can reach would put
an unreachable row into the install surface. The comment inside the list states this so
the next reader does not "restore" it from a branch where the mount existed.

**CANDIDATE-A accounting (carried unchanged, line numbers re-measured).**
`team-tool-plane.mjs:494-499` on this tree states that the confined-rg glob candidate
**FAILED the security re-review for a name-class leak** — the `verify` -> launcher
string-`chdir` window plus the provider's `runtime_base '/'` READ_DIR grant, so outside
NAMES can surface (bytes never; re-review measured 3/10700) — that it ships NOTHING,
and that the glob integration waits for a `runtime_base` narrowing layer in its own
round. This search row rides THE SAME provider and launcher, so it does not claim that
exposure away; what it controls is its wire, and there the vocabulary is a closed table
of codes plus arithmetic, never a walker path and never the walker's sentence (leg
`V12`; the coverage law reads a stderr line's CLASS and discards the line). The
narrowing layer stays the face's own round and this PR does not preempt it.

Gates on the replay tree: `alpha5-search-backend` 40/40; neighbourhood six files
131/131 (`alpha5-glue7-plane-backends`, `a5p4-lane-hygiene`, `a5w-integration-wiring`,
both glob-row files); `p4t6-session-event-scan` 10/10; `a5p5-dormant-audit` 8/8;
`pnpm -r run typecheck` clean across nine packages; `place-dist-glue` 7 placements;
`check-artifacts-committed` ok (1746 compared, glue=7) and `check-artifacts-at-head`
verdict=ok drift=0. **All of those numbers were true of that commit and all of them
are superseded by the census round below** — the green set was not sufficient, which
is the point of that section.

## Census #330 caught a real integration red in this line (and the neighbourhood list was why)

`a5g6-install-face-render`, GLUE-6 LEG B, run 39114260882 — the single NEW RED on the
census — read:

```
Cannot find module './glob-backend.mjs' imported from
  .../packages/runtime/dist/packages/runtime/src/plugin/live/search-backend.mjs
```

The leg's title is about `render` returning `ContentBlock[]`, and that contract is
fine; what actually broke was the import underneath it, and it was this line that
broke it. The replay section above narrowed the byte-copy list to `search-backend.mjs`
alone after asking a question with a yes/no answer: *does the plane import the glob
row?* It does not. That question was aimed at the wrong importer. The shipped graph is

```
plane-effect-backends.mjs -> search-backend.mjs -> glob-backend.mjs
```

and this row's own delegation (`search-backend.mjs:186`, `openAnchoredWalkRoot` +
`verifyGlobResultsBeneath`) is exactly what makes the glob row's bytes load-bearing in
the install surface. Cutting the copy made the shipped search row unloadable, and the
lane's own suite could not see it: every leg in it imports the row from `src`, so the
dist face was never opened. The census opened it.

Two laws come out of this, both now pinned rather than asserted in prose:

* **A placement list closes over the graph, transitively.** "Nothing imports it" is
  only a finding when it was measured from every file the face already ships. The
  in-list comment in `scripts/place-dist-glue.mjs` now says so, with the census run id
  and the wrong question named, so the next reader does not narrow it again.
* **Leg `M4`** walks the shipped face from the placement list itself: every relative
  import of every placed live row must resolve to a file inside
  `packages/runtime/dist`, else the leg names the edge. It was written RED first, on
  the broken tree, and it named both facts (`glob-backend.mjs` listed but absent;
  `search-backend.mjs` imports a file that is not shipped). **Leg `M5`** pins the
  tripped edge as a fact — the row keeps its relative in-face import, and the list
  keeps its target — so neither half can drift silently.

**Neighbourhood lesson, recorded where it will be read:** a lane's neighbourhood is not
"the sibling rows' test files". It is every leg that touches the artefact this lane
changes, including the ones that load the SHIPPED FACE rather than source. This line
ran 131/131 across six files while the tree was red. The list is now seven files and
includes `a5g6-install-face-render.test.ts`.

Gates after the fix: `alpha5-search-backend` **42/42** (40 + `M4` + `M5`); neighbourhood
**seven files 138/138** (search, **`a5g6-install-face-render` 5/5**, glue7, lane-hygiene,
integration-wiring, both glob-row files); `p4t6-session-event-scan` 10/10 (no new package
files; the 1194 booking holds); `a5p5-dormant-audit` 8/8; `pnpm -r run typecheck` clean;
`place-dist-glue` **8** placements with `check-artifacts-committed` ok and
`check-artifacts-at-head` verdict=ok drift=0 (the compared surface grew by the one
restored byte-copy).
