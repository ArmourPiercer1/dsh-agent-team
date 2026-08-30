# P7-T5 — Start Team from Here (one-shot handoff, no live link) — run log

## Identity
- Task: P7-T5 (vNext team-mode program, P7 first wave).
- Branch / worktree: `task/P7-T5-handoff-start-from-here` @ `.worktrees/P7-T5`.
- Base HEAD: `1d0c8d09e25262bfd7570df53f6e8cc192c69a44` (P7 kickoff; clean tree verified before start).
- Card goal: "实现 source canonical surface freeze→one-shot summary/handoff→new TeamIntent/Root；无 live link".
- Owned paths: `packages/runtime/handoff*` (+ `packages/runtime/test/p7t5-*`, + this evidence dir, + p4t6 scan-test count maintenance ONLY per DEC-1).
- Frozen spec (read verbatim before implementation): DevPlan §20.5 (`ordinary Session A → freeze canonical surface → one-shot summary → new TeamIntent → new Root B`; "B 不获得 A live history/search") + Arch §34.2/§34.3/§34.4 (+ §7.2 TeamIntent optional handoff provenance).
- Allowed deps: public session query/read surface + Team creation (both injected as ports; no private APIs).

## Protocol compliance
- Frozen docs SHA-256 re-verified 4/4 (main-tree copies) before implementation.
- Canonical chain only: `pnpm install --ignore-scripts` → `node scripts/run-tests.mjs` → direct `node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json` ×5. No pnpm run/exec, no vitest CLI, no tsx/esbuild/vite.
- No `node:` imports in `.ts`; NodeNext + `.js` extensions; erasable TS only; test-shim matcher set only.
- CORE PATCH BUDGET 0 honored; no upstream source/private API; no legacy Team SessionEvent vocabulary; no push; no subagents; no real DSH instance (unit/integration level only — real-instance E2E belongs to P7-T7).

## Attempt ledger (3/3 counted)
| Attempt | State | Tests | tsc ×5 |
| --- | --- | --- | --- |
| 1 (pre-change baseline) | base HEAD, clean tree | 1214/1214 PASS | 5/5 exit 0 |
| 2 (post-change) | +12 new files, p4t6 count 330→342 | 1247/1247 PASS (+33) | 5/5 exit 0 |
| 3 (second consecutive) | unchanged | 1247/1247 PASS | 5/5 exit 0 |

New tests: 7 + 4 + 6 + 11 + 5 = 33.

## Implementation — `packages/runtime/handoff/`
- `types.ts` — port/record contracts: `SourceCanonicalSurface` (frozen, lossless-JSON), `HandoffSummary`, `HandoffSourceSurfacePort` (EXACTLY ONE read per operation), `HandoffSummarizerPort`, `HandoffTeamCreationPort` (idempotent per `intentToken`; models the P6-T1 ActivationProvider public entry), `HandoffContext` (frozen, sourced, `contextToken = handoff-ctx-<requestToken>`), `HandoffTeamIntent` (optional `handoff` provenance per Arch §7.2; `intentToken = handoff-intent-<requestToken>`), `StartTeamFromHereRequest`, `HandoffOperationState` (completed / completed-without-handoff / canceled / awaiting-decision / creation-failed), `HANDOFF_DECISION_OPTIONS` closed triad.
- `errors.ts` — closed error-code vocabulary (8 codes) + `HandoffError` + `isHandoffError` type guard.
- `service.ts` — `createHandoffService(ports)`:
  - `startTeamFromHere(request)`: validate → `HANDOFF_REQUEST_MALFORMED` (`parseSessionId`; token non-empty ≤255 without control chars; staged must be a lossless-JSON record else `{}`). Operation identity `(sourceSessionId, requestToken)` per §18.2 — same key = same op: stored terminal/awaiting states replay with `replayed:true` (no re-read / re-create); `creation-failed` re-drives creation ONLY under the same `intentToken`; fresh op reads the canonical surface exactly once, then detach+deep-freeze (`canonicalJsonStringify` asserts lossless JSON first, so a non-JSON surface fails loudly → `HANDOFF_SOURCE_SURFACE_UNAVAILABLE`, no trace left); then summarize (throw or non-JSON → `awaiting-decision` with the explicit retry / continue-without-handoff / cancel triad, Arch §34.4 — never silently pretend success, no team created); then create (success → `completed` + frozen `HandoffContext`; failure → `creation-failed`, context retained).
  - `resolveHandoffDecision(ref, decision)`: retry re-summarizes the FROZEN snapshot (no re-read); continue-without-handoff creates with `intent.handoff` omitted (executable form of "B 不获得 A live history/search" at intent construction); cancel → `canceled`. Decisions are one-shot: already-finalized → `HANDOFF_OPERATION_ALREADY_FINALIZED`; `creation-failed` → `HANDOFF_OPERATION_NOT_DECIDABLE`; unknown ref → `HANDOFF_OPERATION_UNKNOWN`.
  - `querySourceHistoryFromTarget(contextToken, query)`: target-side guard; after argument validation ALWAYS throws `HANDOFF_SOURCE_HISTORY_ACCESS_DENIED` (details `{contextToken, mode}`); never touches the source-surface port. `sourceSessionId` stays provenance/navigation metadata — NOT a read grant (Arch §34.3).
- `index.ts` — public barrel.
- In-memory op registry (`Map` keyed `sourceSessionId\0requestToken`; in-flight promise coalescing): invariant 41 — TeamDomain is the only durable boundary; the module persists nothing.
- NO MemberInstance/TeamSession creation path in the module — team creation is DELEGATED to the injected `HandoffTeamCreationPort`; statically enforced by the p7t5 no-creation scan (R1–R7).

## Tests — `packages/runtime/test/` (33 new)
- `p7t5-helpers.ts` — shared fakes: mutable source surface (returned by reference so mutation is observable), deterministic summarizer, idempotent fake team creation, fixed clock.
- `p7t5-snapshot-once.test.ts` (7) — read/summarize/create each exactly once at first completion; deep-freeze proof (`Object.isFrozen` + mutation throws); provenance + `intent.handoff` on the recorded creation call; same-token replay = same context reference, counters unchanged; fresh-token isolation (own read/create, own `contextToken`); non-JSON surface fails before summary/create and leaves no trace (repair + same token = fresh op).
- `p7t5-source-mutate.test.ts` (4) — frozen context equals the pre-mutation deep copy and diverges from the live oracle after mutation; replay after mutation returns the same frozen context with no re-read; positive control: fresh token snapshots the mutated surface.
- `p7t5-target-inspect.test.ts` (6) — mandatory negative test: target-perspective `history-read` AND `search` of the source → `HANDOFF_SOURCE_HISTORY_ACCESS_DENIED` with details; unknown/empty token rejected; guard never touches the source port (counters unchanged); context structurally non-callable + remote-safe JSON.
- `p7t5-failure-before-root-create.test.ts` (11) — summarizer failure → `awaiting-decision` with the exact triad and zero creations; decision validation (malformed option / unknown op); retry-after-recovery completes (reads still 1, summaries 2, creations 1, provenance present); continue-without-handoff → `completed-without-handoff`, `intent.handoff` undefined; cancel one-shot (second decision → ALREADY_FINALIZED); creation failure explicit (`creation-failed`, context frozen) with idempotent re-invocation under the same `intentToken`; non-JSON summary → `awaiting-decision`; source-read failure → zero side effects; 8 malformed-request cases → `HANDOFF_REQUEST_MALFORMED` with zero port calls.
- `p7t5-no-creation-scan.{mjs,d.mts,test.ts}` (5) — static scan of `packages/runtime/handoff/*.ts`: R1 no `storage` specifier, R2 no `activation`/`root-binding` specifier, R3 no `.repositories.` text, R4 no creation-call text, R5 no `node:` imports, R6 relative-only specifiers, R7 no dynamic loading. Pinned file list (the 4 module files); zero violations on real source; positive control (synthetic source violating all 7 rules, rule set asserted) and negative control (clean relative-only source).

## Scans & static evidence
- p4t6 whole-tree legacy-Team-SessionEvent scan: count maintained 330 → 342 (+12 P7-T5 files, DEC-1 union entry). Scanner `.mjs` byte-identical; none of the 12 new files carry denylist vocabulary (the scan test itself runs in every suite pass).
- p7t5 no-creation scan: 0 violations over the 4 module files (runs on every test pass).
- Specifier self-scan (ad-hoc, evidence-only): v1 raw-text regex FALSE-POSITIVED on the synthetic sample string literals inside the scan test (`node:fs` "violation" originating from DATA, not code); v2 parses via the TypeScript 6.0.3 AST and reads only real import/export declarations → `SPECIFIER SELF-SCAN: PASS` (`.ts`/`.d.mts`: `vitest` + intra-repo relative only; `.mjs`: + `node:fs/path/url` per repo convention; zero dynamic `import()` / `require()`).
- Zero-core: `node scripts/verify-zero-core.mjs --host <references/deepseek-harness-test-use> --json` → `RESULT PASS`, findings 0 (P6-T4 invocation precedent).

## Design rulings (scoping deviations, all recorded)
1. Team creation delegated via injected `HandoffTeamCreationPort` modeling the P6-T1 ActivationProvider public entry: wave-1 scope is unit-level with port injection (ruling R28 mock-first); the handoff module itself owns no creation path (statically enforced).
2. Op registry is an in-memory, process-lifetime `Map` — invariant 41 (TeamDomain = only durable boundary); nothing persisted.
3. `querySourceHistoryFromTarget` is an unconditional deny guard — the executable form of Arch §34.3 (B cannot `history_read(A)` / search A); it exists on the service so the prohibition is testable, not merely documented.
4. `assertQuery` fix during implementation: first draft used `mode !== 'history-read' || mode !== 'search'` (always true — the denied path was unreachable); corrected to `&&`. Caught by the mandatory negative test before attempt 2.
5. `errors.ts` JSDoc reworded to avoid the literal `import(` text (would have false-positived R7 of the self-scan).

## Evidence files
| File | Note |
| --- | --- |
| `pnpm-install.txt` | canonical install log (rewritten UTF-16 → UTF-8 no BOM) |
| `baseline-tests-attempt1.txt` | attempt 1: 1214/1214 PASS (rewritten UTF-16 → UTF-8 no BOM) |
| `tsc-baseline-attempt1.txt` | attempt 1: tsc ×5 exit 0 (rewritten UTF-16 → UTF-8 no BOM) |
| `tests-attempt2.txt` / `tests-attempt3.txt` | 1247/1247 PASS each |
| `tsc-attempt{2,3}-{contracts,domain,storage,runtime,testkit}.txt` | 0 bytes by design: tsc emits no output on a clean compile; exit 0 verified at run time |
| `zero-core.txt` | `RESULT PASS`, findings 0 |
| `self-scan-specifiers.mjs` | ad-hoc AST-based self-scan (v2; v1 false positive documented above) |
| `self-scan-specifiers.txt` | `SPECIFIER SELF-SCAN: PASS` (typescript 6.0.3) |
| `run-log.md` | this file |

## Git
- Single commit on `task/P7-T5-handoff-start-from-here` covering owned paths only: 12 new package files + p4t6 scan-test count maintenance + this evidence dir.
- No push (router protocol: master pushes happen only by the main agent after gates).
