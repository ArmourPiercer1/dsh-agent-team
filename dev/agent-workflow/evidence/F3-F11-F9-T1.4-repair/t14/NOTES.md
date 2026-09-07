# T14-H (repair-r1, T1.4-B) — evidence notes

**Task:** T1.4-B host-completed pre-creation probe — `intent.probe` merges
the authoritative host row-config environment facts with the caller's
persona facts (U5/T1-B strict; the shared v4 semantic record's entry 2
per CF2; INV-9.4: "complete the observation, never weaken the verdict").

**Branch/worktree:** `task/repair-r1-t14-host-facts` in
`.worktrees/repair-r1-t14`, from `int/repair-r1` @ `4f6e4f9`.
Execution 1/3 (cap). No push.

## The T1.4 bug (two-worlds mismatch)

The UI `intent.probe` (host `s6-remote.ts`) evaluated the CLIENT persona
facts only, while the post-creation admission gate saw the row-config
facts: the same blueprint, different worlds. A blueprint with a required
non-persona requirement (mock repro `dtest-bp`: `persona/standard` +
`mcp/dtest-mini`, both required; the row config carries all four facts
available) could pass the gate after creation yet was structurally
BLOCKED in the create panel (FATAL before the team existed) — and the
inverse spoof direction (a caller self-attesting capabilities) was
unpoliced at the wire.

## The fix (host-side only; packages/runtime; wire shape UNCHANGED)

1. `packages/runtime/src/plugin/s6-remote.ts`
   - New `S6RemoteOptions.environmentFacts?: () => Promise<readonly
     EnvironmentFact[]>` — the authoritative host row-config facts;
     absent → empty capability world (fail-closed; a caller claim can
     never substitute for a host fact).
   - New exported pure helper `mergeProbeEnvironmentFacts(hostFacts,
     callerFacts)` — strict U5 merge: the caller contributes ONLY the
     `persona` domain (the selected preset is the explicit user intent;
     the row's persona fact is the deployment default and yields to the
     selection — divergence against a required persona makes the probe
     STRICTER than the gate, the documented safe direction); every other
     domain is host-only (caller capability claims DISCARDED — the
     fact-forgery hole closed; CR-4: a claim is input, never
     authority). No duplicate (domain, subject) pair is ever created
     across the two halves.
   - `intent.probe` port: the caller list is validated with the EXACT
     frozen engine parser first (`parseEnvironmentFacts` — malformed
     caller facts still fail loud MALFORMED_DTO, byte-identical to
     pre-T1.4 wire validation), then
     `evaluateCompatibility({requirements, environmentFacts:
     mergeProbeEnvironmentFacts(hostFacts, callerFacts)})`.
     Required → FATAL (no downgrade to WARNING, no Continue-anyway),
     optional → WARNING + the explicit ack path, persona mismatch →
     TEAM_PERSONA_COMPLETE_PRESET_CONFLICT: all preserved
     (Architecture §27.2, invariant 47, compatibility red line).
   - The intent port's doc comment now carries the T1.4-B/INV-9.4/U5/
     CF2-entry-2 semantics (per §5.2 of the frozen contract).
2. `packages/runtime/src/plugin/root.ts` — the production root passes
   its EXISTING fresh-read `environmentFacts` thunk (defined once,
   `config.environmentFacts.map(...)`) into the S6 surfaces — the same
   source the prober / authority / activation / runtime gate wiring
   already consumes (one thunk, zero new fact sources: the probe and
   the gate cannot diverge).

## Scope & boundaries (frozen)

- File scope: `packages/runtime` only (src `s6-remote.ts` + `root.ts`;
  the new test; the tracked `dist` rebuild of the same two modules).
  Client/UI unchanged (`intentEnvironmentFacts()` already sends exactly
  the selected-preset persona fact or `[]`; the panel already renders
  OPEN / BLOCKED_WARNING+ack / BLOCKED_FATAL).
- **No contract version record on this branch — deliberate.** The
  branch carries v1–v3 only; the v4 machinery is owned by the separate
  V4 leaf (`task/repair-r1-v4-catalog`, unmerged). The wire shape is
  UNCHANGED (same v1 `intent.probe` method, same params, same result),
  so "shared v4 semantic version record only if required by existing
  contract machinery" is NOT triggered here: the record rides the
  shared v4 (CF2 entry 2) when the V4 leaf lands. Integration order
  V4 → F9-H → T14-H stays conflict-free (this diff is local to the
  intent-port region).
- Locked surface (TaskDoc §3.7): compatibility engine domains untouched
  — the engine, its parser, and its result shapes are unmodified.
- Untouched (delegation): upstream, `docs/plans/active/`,
  `dev/agent-workflow/graph.yaml`, `SESSION_ROUTER_LOG.md`, F9 source.

## Persistent test (the T14-H package §8.10, ⊕ scenarios)

`packages/runtime/test/t14h-probe-merge.test.ts` (10 tests) — fixture
blueprint `t14h-bp` rev 1 (YAML frontmatter; `persona/standard`
required + `mcp/dtest-mini` required — the mock `dtest-bp` shape — plus
one OPTIONAL `tool/web` for the WARNING/ack lane), real
`createBlueprintCatalog`, driven through the real production
`createS6RemotePorts` (the same `as unknown as S6RemoteOptions`
trip-wiring pattern as tcm-g1/p8t3):

| # | scenario | expected |
|---|---|---|
| T1 | required MCP PRESENT in row facts + caller selects the row preset | OPEN (the T1.4 repro — pre-fix FATAL) |
| T2 | required MCP ABSENT from row facts | BLOCKED_FATAL `COMPLETE_REQUIREMENT_NOT_MET` (fail-closed; NO downgrade) |
| T3 | optional tool absent | BLOCKED_WARNING + never default-acknowledged (`acknowledgement` MISSING) + the §27.3 ack path unchanged: an ack bound to the result's exact mismatch/environment fingerprints re-evaluates to DEGRADED_ACKNOWLEDGED / VALID |
| T4a | divergent preset selection vs row default | BLOCKED_FATAL `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` (the row default does not rescue; probe stricter than gate) |
| T4b | no preset selected (empty caller facts) | FATAL (empty persona world; fail-closed; identical to pre-fix pure-caller) |
| T5a | caller CLAIMS the unavailable required MCP available | still FATAL (host wins) |
| T5b | caller CLAIMS the available required MCP unavailable | still OPEN (host wins both ways) |
| T5c | caller CLAIMS an absent optional tool available | still WARNING (no fabricated capabilities) |
| T6 | probe/gate parity (Architecture §7.4 predictor property) on real durable P6-T1 worlds: OPEN world → probe OPEN ⇔ gate admits; required skill unavailable → probe FATAL(`req-skill-base`) ⇔ gate `TEAM_RUNTIME_COMPATIBILITY_BLOCKED` with `details.status` BLOCKED_FATAL + `blockingRequirementIds` [`req-skill-base`]; optional tool unavailable → probe WARNING(`req-tool-web`) ⇔ gate blocks with the SAME requirement | same verdicts both sides |
| T7 | malformed caller fact (missing `available`) | loud `MALFORMED_DTO` TeamContractError (frozen parser, exactly as pre-T1.4) |

Pattern: module-level top-level await (the shim's `it` is synchronous),
matchers restricted to the audited shim surface (`toBe`/`toEqual` +
`.not`).

## Evidence files (this directory)

- `run-file.mjs` — per-file plain-node runner (copied from `f3c/`;
  vitest cannot boot in the spawn-restricted sandbox: vite 8
  `windowsSafeRealPathSync` exec EPERM — see TEST_METHODS.md §5).
- `red-before-green.txt` — the NEW suite run against the PRE-FIX source
  (`git stash push` of the two source files; the test file is new/untracked
  so it stays): **7/10 red** — T1 (the repro: BLOCKED_FATAL ≠ OPEN), T3
  (BLOCKED_FATAL ≠ BLOCKED_WARNING), T4a capability lane (host facts
  invisible pre-fix), T5a (spoof honored pre-fix: BLOCKED_WARNING), T5b
  (denial honored pre-fix: BLOCKED_FATAL), T5c (claim fabricated the
  optional capability AND the required MCP was invisible: BLOCKED_FATAL),
  T6 (probe BLOCKED_FATAL while the gate admits — the parity break
  itself). **3/10 green pre-fix** (the preserved semantics, pinned): T2
  (fail-closed FATAL either way), T4b (empty persona world FATAL either
  way), T7 (wire MALFORMED_DTO either way). Then `git stash pop`.
- `postimpl-focused.txt` — the NEW suite after the fix: **PASS (10 tests)**.
- `focused.txt` (+ `focused-part1.txt` / `focused-part2.txt` raw) — the
  29-suite focused non-regression set (T14-H + every S6/remote suite +
  production assembly + admission/gate + the F3 suites + compatibility
  ack/drift): **29/29 PASS** (`run-file: all named files pass` ×2).
- `postimpl-full-runtime.txt` — FULL runtime package sweep, ONE NODE
  PROCESS PER TEST FILE via `sweep-driver.mjs` (the
  `d5-instance-contract` top-level `toHaveLength` crash kills any shared
  process — same house rule as F3-C's `full-sweep.ps1`; the .ps1 twins
  are kept as the F3-C-style recipe, but in this session `pwsh` was not
  on PATH for child processes, so the Node driver was the working
  runner: same one-process-per-file isolation, children on inherited
  stdio — the sandbox-allowed spawn form). Result:
  **`SUMMARY: files=137 ok=130 bad=7`** — the bad set is EXACTLY the
  7 known pre-existing shim-surface reds (`d1-member-base-tools`,
  `d1-s6-remote-v3`, `d1-team-ownership-index`,
  `d2-s6-ensure-root-live`, `d3-member-identity-context`,
  `d5-instance-contract`, `pbf-default-artifact-urls` — all
  `toContain`/`toBeUndefined`/`toBeDefined`/`toBeInstanceOf`/
  `toHaveLength`/`async it` shim-surface gaps, identical to their
  pre-T1.4 failures): **zero regressions**. 137 = 136 pre-existing
  suites + the new `t14h-probe-merge`.
- `focused-sweep.ps1` / `full-sweep.ps1` — the F3-C-style recipe twins
  (kept for parity; `full-sweep.ps1` is the documented one-process-per-file
  reference; `sweep-driver.mjs` performed the actual run here).

## Commands (exact)

- focused: `node dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/t14/run-file.mjs <files...>`
  from the worktree root (two halves: the S6/remote set, then the
  assembly/gate/F3/compat set — raw outputs `focused-part1/2.txt`).
- full sweep: `node dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/t14/sweep-driver.mjs`
  (one `run-file.mjs` process per suite, sequential, continues past the
  known top-level crash).
- typecheck: `pnpm run typecheck` in `packages/runtime`
  (`tsc -p tsconfig.json`) → **exit 0**.
- build: `pnpm run build` in `packages/runtime`
  (`tsc -p tsconfig.build.json`) → **exit 0**; the tracked `dist`
  rebuild touched exactly the changed modules (`root.js`/`.d.ts`/`.map`,
  `s6-remote.js`/`.d.ts`/`.map` + maps) — rebuilt in the SAME commit.
  (The repo-root `pnpm -r run build` is unusable in the spawn-restricted
  sandbox — pnpm's recursive lifecycle spawns EPERM; the single-package
  build is the F3-leaf house procedure and sufficient: no other
  package's source changed.)
- node v24.20.0, pnpm v11.7.0.

## Return

- head SHA: (see commit)
- tests: T14-H 10/10 green (7 red pre-fix); focused 29/29; full sweep
  130/137 with the 7 bad = the known pre-existing shim-surface reds.
- evidence: this directory.
- blockers: none.
