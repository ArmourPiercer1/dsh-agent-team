# A5-SRGP probes — the measurements the search row is built from

Every fixed decision in `packages/runtime/src/plugin/live/search-backend.mjs`
(trailing `-- .`, the three `--no-*` additions, the completion law instead of an
exit-code law, the projection of `-l`/`-c` from `--json`) comes from a leg here,
run against the SAME ripgrep the plane ships:

```
ripgrep 15.0.0 (rev 3a612f88b8)   features:+pcre2
node_modules/.pnpm/@vscode+ripgrep-linux-x64@1.18.0/…/bin/rg   (resolved by the host's public resolveRgPath())
```

Host under test: 0.2.0-rc.2 @ `639ed01539`; launcher
`packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py`
(abi 4, `sha256:0049965daacae5bd…`). Native legs run rg with
`stdio: ['ignore', 'pipe', 'pipe']` — the host's own `runRipgrep` passes
`stdin: 'ignore'`, and without it rg searches an EMPTY stdin and answers zero
(same class as S3 below; measured first as `searches: 1, bytes_searched: 0`).

## Files

| file | what it settles |
| --- | --- |
| `rg-measure.mjs` → `rg-measure-table.txt`, `rg-measurements.json` | the N-series (native) behaviour matrix over a fixture carrying every parity class: ignore / hidden / VCS / binary / CRLF / spaced / unicode / newline-in-name / forged-record body / escape-symlink, plus the `-l`, `-c`, `-C`, `-F`, `-i`, `-U`, invalid-regex and include-filter arms, and the grep(1) port's own answer (N20) as the control. |
| `confined-stdin-probe.mjs` | S1–S5: what fd 0 IS inside the confined child and what rg does with it. |
| `dot-arg-probe.mjs` | D1–D6: the explicit-path law — the same argv with and without `-- .`, natively and inside the confine. |
| `parent-ignore-probe.mjs` | Q-series: whether `--no-ignore-parent` / `--no-ignore-global` change the SELECTION when the parent ignore/VCS machinery is unreadable anyway. |
| `row-form-probe.mjs` → `row-form-run1.txt`, `row-form-measurements.json` | the row's exact argv, run natively and through the real confined provider, byte-for-byte (this is where the launcher's exit-code blindness and the `--no-messages` need were pinned). |
| `parity-probe.mjs` → `parity-measurements.json` | native-vs-confined parity of the row form before the row existed (the row had to reproduce these numbers, not new ones). |
| `binary-and-mode-probe.mjs` | the binary law (`--json` emits no match record for a NUL-bearing line; `--text` proves the token is there) and the `-l`/`-c`/`--json` projection equality. |
| `row-selfcheck.mjs` | a one-shot end-to-end smoke of the finished row through the real provider (kept because it is the shortest reproduction of the stdin and exit-code traps). |

## INVALID LEGS — read before quoting this directory

`rg-measure-table.txt` legs **C1 … C10** (the first confined batch) and
`row-form-run1.txt` legs **C1 … C6** are INVALID as behaviour measurements:
the probe passed the argv WITHOUT the binary at `argv[0]`, so the pre-launcher
executed a flag (`--no-config`) and every leg "succeeded" with exit 0, zero
stdout and zero stderr. They are kept, uncommented, because the silent
`exit 0 / no bytes` shape they produced is the same shape the row refuses on
(the completion law), and because "every confined leg answered 0" is exactly the
observation that should not be smoothed over. The corrected confined legs are
`row-form-probe.mjs` (`<rg>` at `argv[0]`), `dot-arg-probe.mjs`,
`binary-and-mode-probe.mjs` and `parity-probe.mjs`, plus the suite legs in
`packages/runtime/test/alpha5-search-backend.test.ts`, which is the authoritative
reproduction (it re-measures all of this in-repo, on a pinned fixture).

## Facts these probes established (each re-pinned by a suite leg)

1. **`-- .` is load-bearing.** Inside the confine fd 0 is a socket; rg 15 logs
   `is_socket=true … is_stdin_readable=true` and its heuristic "chose to search
   stdin", which for a socket yields **exit 0 with ZERO records and ZERO
   stderr** (`dot-arg-probe` D3 vs D1: 2 matches with `-- .`, `searches: 1,
   bytes_searched: 0` without). The row therefore always passes an explicit
   search element, and `child.stdin.end()` as a second belt. Suite leg:
   `explicit-path-is-load-bearing`.
2. **The confined face carries NO payload exit code.** The pre-launcher
   supervises the child, writes its rc to its own `exit.json`, and
   `sys.exit(0)`s regardless (`landlock-prelauncher.py:496`); through
   `spawnStreaming`, `/bin/sh -c 'exit 7'` settles `{ code: 0 }`. So
   `exit.code ∈ {0,1}` can never be the walker's verdict here. Suite leg:
   `P8b`.
3. **Completion is provable from the protocol instead.** A `--json` walk that
   runs to completion always ends with a `summary` record (measured on a
   zero-match walk, on an absent target, and on an include filter that matches
   nothing — all exit 1 WITH a summary); a walk ripgrep refuses to start emits
   ZERO bytes and puts the reason on stderr (invalid regex: `stderrBytes: 61`,
   stdout empty — and `--no-messages` does not suppress that message). Suite
   legs: `P8`, `P8b`, `P9`, `P10`.
4. **`--no-messages` silences only the upward-discovery noise.** Walking a root
   that is not its own git root, rg prints
   `rg: …/.worktrees/a5srgp/.git: Permission denied (os error 13)` — an OUTSIDE
   path name on a channel — on every walk; the flag removes it and changes no
   answer (D/F series). `--no-ignore-parent` / `--no-ignore-global` are
   selection-neutral here (Q-series) and are carried so the row's ignore law is
   the walker's DEFAULT, not an accident of this filesystem's parents.
5. **The plain-text oracles cannot carry the fixture's newline-named file.**
   `-l`/`-c` print it as two lines (`newline`, `name.ts:1`); `--json` carries it
   as ONE record with the true path (N5/N6 vs N14). The row projects `-l`/`-c`
   from `--json`, so its answer is the whole name; the grep(1) control splits it
   like the plain oracles (suite legs `R5`, `P2`, `P3`, `P7`).
6. **The ignore / hidden / VCS gap is the delta.** Row form: 5 matches on the
   rich fixture with `ignored/`, `node_modules/`, `.hidden.ts`, `dotdir/`,
   `.git/`, `.svn/` all absent; `--no-ignore` adds the two ignored files,
   `--no-ignore --hidden` reaches 11; the shipped grep(1) port found 12–15 lines
   including `.git/config` and the hidden files (N20). Suite legs: `R2`, `P4`.
7. **Binary law.** A NUL-bearing line yields no `match` record (rg skips the
   file); `--text` proves the token is inside, so the absence is the walker's
   law and not a fixture accident. grep `-I` agrees on this one class.
   Suite leg: `P5`.
8. **A symlinked file argument leaks natively.** With the escape symlink as the
   search argument the native run prints the OUTSIDE file's content (exit 0,
   `A5SRGP-TOK OUTSIDE`); the confined run cannot read it (permission denied +
   exit 2 natively-shaped, zero records through this face). The row refuses the
   target by name BEFORE the spawn, so the difference is never exercised.
   Suite legs: `V6/V7`.

Residue disclosure (and a finding for whoever owns `rc2-persona-probe`): the
confined provider writes its `out/plan-*` + `plans/plan-*.json` bookkeeping and
its `probe-*` fixture trees wherever the RUNNER's cwd is, and the earliest
probes here ran with `cwd = packages/runtime`, so that is where they landed.
Measured again in this round from a clean tree: running the EXISTING suite
`packages/runtime/test/rc2-persona-probe.test.ts` (untouched by this lane)
recreated `packages/runtime/{out,plans,probe-mvdau*}` at 04:02 within its own
run — so any full-tree `vitest run` from `packages/runtime` leaves this litter,
independently of this lane. Nothing here changed that behaviour (out of
ownership); this lane deleted its own copies twice and verified the tree after:
`git status --ignored packages` shows only the three lane files (plus the
pre-existing `packages/testkit/test/.tmp-fault/`, which the scanner skips by its
own documented rule). The `p4t6` scanner moving by exactly +3 — this lane's
three files — is the arithmetic witness that no other scannable residue is left.
Later probes and every suite leg keep their worlds under
`tests/homes/a5srgp-*` and destroy them (`TEST_METHODS` §7); none of them
depends on `out/`/`plans/` living inside the package.
