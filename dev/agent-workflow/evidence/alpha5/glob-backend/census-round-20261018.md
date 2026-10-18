# census 同池交互轮 — 2026-10-18 (root order, #322 last gate)

Local reproduction of the CI census shape, at this lane's worktree:
`npx vitest run --reporter=json --outputFile.json=<f> --testTimeout=90000` (root config = the nine roots),
`.tmp-fault` cleared before each capture. Six cores here; the CI runner is smaller.

## 1. What the merge tree actually broke, by mechanism

| red | mechanism | fix |
| --- | --- | --- |
| `a5p4-lane-hygiene` law (4) DORMANT | the walk flags EVERY production file referencing `sandbox-provider` / `createConfinedProcessProvider`. At the merge tree two files offend: `plugin/live/plane-effect-backends.mjs` (glue lane — ALREADY red on the master side at `7ab56dbf`, measurable with `git grep -lE` at that commit) and `plugin/live/glob-backend.mjs` (this lane). | restated as law (4) NAMED MOUNTS: a booked list of files, each pinned to ONE import edge at the public face; an UNNAMED reference is still a red; a named row may not deep-import or grow a second edge. Live set is printed by the leg. |
| `a5w-integration-wiring` "provider factory … wired into no live glue" | the same dormancy law, second copy, walking `runtime/src`. | same named-mount restatement, same two names, public-face-only pin. |
| `a5p5-dormant-audit` "no shipped source outside the lane references a5p5-tools" | my OWN spec `runtime/test/alpha5-glob-backend.test.ts` names `packages/tools/a5p5-tools/src/register.ts` — leg P0 reads that TEXT to pin argv parity. A name, not an edge. | booked in `NAMES_ONLY_LEDGER_EXCEPTIONS` (5th entry) + a new form-pinning leg: exactly one line carries the path shape, it is the pinned `readFileSync(join(REPO, ...))`, and no import/require/from-specifier to the lane exists anywhere in the file. Same mechanism the GLUE-2/GLUE-5 rounds used. |

## 2. `a5lsp2-assembly` REAL legs — measured here, not reproduced

Green standalone, green in both full captures (572 files), and green when run while my
6600-walk storm is mid-flight in a second process. Their observation surfaces are
world-scoped (`sampleLaneProcesses(worldRoot)`: `cwd.startsWith(worldRoot)` or the
`a5lsp2-fixture` cmdline), so this lane's `a5glb-*` worlds and children are NOT visible to
them; pid reuse is ruled out by `pid_max = 4194304` against ~13k pids for the whole leg;
fd pressure is ruled out by direct `/proc/<pid>/fd` sampling during the storm (never above 40).
What is left is CPU: the leg's polls are bounded (`pollUntil(..., 8_000/10_000)`), and this
lane's race is the longest, most spawn-dense file in the pool (~4 min of launcher CPU).
Two courtesies are now in place, neither weakening a number:
  - `A5GLB_RACE_PACE_MS` (default 4 ms): a gap after every real walk, lowering the storm's
    duty cycle so a sibling's bounded poll gets room. Counters are byte-identical under it.
  - `A5GLB_RACE_WALKS` (default 6600): a scale dial. If a dialled value is used the LEG NAME
    says so, so a dialled census can never be quoted as the hard gate — the hard gate stays
    the lane run with no env set.

## 3. Both captures, in the open

- capture 1: 19 reds; capture 2: 18 reds; all 9 published ids hit in both captures; nothing in the published set went green by accident.
- reds present in capture 1 only (1): the testkit coverage leg `p4t6-session-event-scan` — position-dependent in-pool flake inside the testkit lane (its own fault-injection `test/.tmp-fault/` files move the scanned-file count the leg pins; the scanner itself names that race at `session-event-scan.mjs:224`). Observed rate here: 1/2. Not a this-lane file; nothing here is softened, the rate is quoted per the baseline's LOAD DISCIPLINE.
- zero reds in either capture from: `alpha5-glob-*`, `a5lsp2-*`, `a5p4-*`, `a5w-*`, `a5p5-*`.

### capture-2 identity minus the published nine (9, all worktree-provisioning)

- `packages/runtime/test/rc2-persona-probe.test.ts > PP1 the probe follows the host persona interface, not an invented one `
- `packages/runtime/test/rc2-persona-probe.test.ts > PP3 the harness residue is gone and stays gone no harness re-inlines a`
- `packages/runtime/test/rc2-persona-probe.test.ts > PP3 the harness residue is gone and stays gone no plugin source import`
- `packages/testkit/test/a4p7-merge-gate.test.ts > A4-PR7 §7.6 — the code merge gate, driven by real commands the compositi`
- `packages/testkit/test/plugin-dsh-compat.test.ts > F1 plugin DSH peer compatibility (real 0.2.0-rc.2 evaluator, test-use `
- `packages/testkit/test/plugin-dsh-compat.test.ts > F1 plugin DSH peer compatibility (real 0.2.0-rc.2 evaluator, test-use `
- `packages/testkit/test/plugin-dsh-compat.test.ts > F1 plugin DSH peer compatibility (real 0.2.0-rc.2 evaluator, test-use `
- `packages/testkit/test/plugin-dsh-compat.test.ts > F1 plugin DSH peer compatibility (real 0.2.0-rc.2 evaluator, test-use `
- `packages/testkit/test/plugin-dsh-compat.test.ts > F1 plugin DSH peer compatibility (real 0.2.0-rc.2 evaluator, test-use `

Causes, per file (measured from the failure text, not assumed):

- `packages/runtime/test/rc2-persona-probe.test.ts` — resolves the repo root by finding `tests/deepseek-harness-test-use`; this worktree does not carry that gitignored checkout, so the walk climbed to the PARENT checkout and read files there (measured: ENOENT on `/srv/.../dsh-agent-team/packages/runtime/root-binding/harness/persona-probe.mjs`, a MAIN-checkout path, not this worktree).
- `packages/testkit/test/plugin-dsh-compat.test.ts` — drives the REAL 0.2.0-rc.2 evaluator out of the test-use checkout; absent here it reads the parent checkout manifest (peer `0.1.7-rc.1`) — the published census ran with "pristine host built at @639ed01539".
- `packages/testkit/test/a4p7-merge-gate.test.ts` — the composition smoke arms REFUSE because `packages/client/dist/...` is not built in this worktree (the published capture states "client lane built"). Building it would write committed dist mirrors, which this lane must not dirty.

They are absent from the published baseline because the baseline tree is provisioned
("pristine host built at @639ed01539, client lane built"); none of them mentions an a5glb
path, and none is affected by this round's edits. Provisioning them here would mean either
cloning the 0.2.0-rc.2 host and building it, or building the client lane — the latter writes
COMMITTED dist mirrors, which this lane must not dirty, so the disclosure stands instead.

## 4. p4t6

No file-set change this round (the three law files were already booked in the ledger).
Suite 10/10 and `scanSessionEventVocabulary()` still measures **1184** paths — re-measured,
not assumed, after the law edits.

