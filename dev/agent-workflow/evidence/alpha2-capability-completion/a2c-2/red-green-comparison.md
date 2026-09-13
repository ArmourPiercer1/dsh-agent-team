# A2C-2 — RED → GREEN comparison

Protocol: the RED probe file was run on the PRE-FIX tree (tracked
source edits stashed via `git stash push`; the untracked test file
stayed; the untracked `permission-coverage.ts` stayed on disk but was
UNREFERENCED — the stashed `index.ts` does not export it, so it never
loads). The file had to LOAD on base (every imported symbol exists at
base; the post-fix API is reached only through the `op` namespace
object with presence guards).

## RED (pre-fix tree) — `red-run.log`

`npx vitest run packages/runtime/test/a2c2-permission-coverage.test.ts`
on base `b96faf3` with the stash applied:

- The file LOADS (no transform/import error) — 3 tests collected.
- **3 failed (3)** — each probe fails at the FIRST post-fix gate leg:
  | Probe | Pre-fix characterization legs (PASS on base) | First failing assertion (RED) |
  | --- | --- | --- |
  | P1 unknown tool under default=deny | `surfaceHasUnknown: true` (the capability layer alone never removes it), `vocabularyKind: 'unsupported'` (the A2 canonical vocabulary does not know it) | `expect(p1.gatePresent).toBe(true)` → `false` (the evaluator does not exist) |
  | P2 default=deny does not auto-remove | `surfaceHasWebFetch: true` (the REAL default-deny listener install changes nothing on the surface), `bodyCalls: 1` + `resultText: 'ok'` (the unsupported pass-through ran the tool body) | `expect(p2.gatePresent).toBe(true)` → `false` |
  | P3 grep/subagent/web_fetch escape the vocabulary | `managedSet = [bash, edit, lsp, pwsh, read, read_image, write]` (the 7-name vocabulary), `inVocabulary = [false, false, false]`, `classifyKinds = ['unsupported' ×3]` | `expect(p3.gatePresent).toBe(true)` → `false` |

The RED evidence documents the plan §7.6 gap exactly: on the base tree
a strict (capabilities.permissions) agent's final surface can carry
sensitive/unknown tools that (a) are not removed by any capability
layer, (b) are not known to the A2 canonical vocabulary, and
(c) are never checked at setup — the unsupported ones even pass
through the runtime pipeline to the body.

## GREEN (post-fix tree) — `green-run.log`

Same command on the branch tree (stash popped, verified):

- **18 passed (18)** — the 3 RED probes' gate legs now pass (the
  evaluator exists and classifies as asserted), plus the 15 GREEN
  scenarios (G1-G9 six-class matrix + precedence + determinism, F1-F3
  FATAL lanes + typed error shape + real-seam enumeration + the
  hidden-sensitive lane, S1-S3 real-seam MCP delta + the strict-mode
  condition + the lifecycle identity invariant).

## Delta

- RED: 3/3 failed (all at the `gatePresent` first post-fix leg).
- GREEN: 18/18 passed.
- The stable characterization legs of P1-P3 PASS on BOTH trees — they
  are gap documentation, not fix assertions; only the gate legs moved
  (red → green), which is exactly the RED-first contract: the same
  file, same probes, the fix is what changes the outcome.
