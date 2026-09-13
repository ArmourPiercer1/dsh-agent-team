# multi-MCP Task C — Phase 1 RED evidence (A-only int tip)

- **Base**: `4ad989d` (int/multi-mcp-quick-fix @ M1 bookkeeping = A merged `71deaa8`+`06427a7`, p4t6 pin 701, B ABSENT)
- **Date**: 2026-09-12 (session time 18:27 UTC-local)
- **Command**:
  `pnpm vitest run packages/runtime/test/multi-mcp-wiring.test.ts packages/runtime/test/t4a-capability-wiring.test.ts packages/runtime/test/t12a-h1-nullable-mcp.test.ts packages/runtime/test/t12a-b3-external-deny.test.ts packages/runtime/test/p8s4b-mcp-facet.test.ts`
- **Raw log**: `red-focused-run.log` (this directory)

## Totals

| file | tests | passed | failed |
| --- | --- | --- | --- |
| multi-mcp-wiring.test.ts (NEW) | 47 | 14 | 33 |
| t4a-capability-wiring.test.ts | 27 | 27 | 0 |
| t12a-h1-nullable-mcp.test.ts (migrated) | 7 | 6 | 1 |
| t12a-b3-external-deny.test.ts (minimal adapt) | 4 | 4 | 0 |
| p8s4b-mcp-facet.test.ts (untouched) | 11 | 11 | 0 |
| **total** | **96** | **62** | **34** |

## RED purity adjudication (contract I7: must be class (a) old single-value
behavior or class (b) old state shape ONLY)

**(a) — old runtime single-value behavior (reads only `config.mcpServer`,
ignores `mcpServers`; mounts nothing in every multi-form world): 23 failures**

| case | observed RED shape |
| --- | --- |
| 6.1 leader {A,B} / e1 {A} / e2 {B} | `[]` vs expected set (nothing mounted — old code: `mcpServer: null` ⇒ `mcpView: null` ⇒ `mcpMountAllowed: false`) |
| 6.5 member mounts A / does NOT mount B (toEqual [A]) / legacy leader {A,B} | `[]` vs expected (same cause: multi-form config invisible to old runtime) |
| 6.6 initial {A,B} / after narrowing A-disposed-B-remains / sibling {A,B} | `[]` (no boot mounts; the instance override boundary is a no-op — old `prepareAgentForRequest` skips reconcile when `mcpView === null`) |
| 6.7a boot fails / A rolled back / B leaves nothing (fiber-exists leg) | boot RESOLVED (`w6BootError === undefined`); `w6FiberA/B === undefined` (no fiber ever created) |
| 6.7b boot {A} / boundary fails / A already removed | boot mounted `[]`; boundary RESOLVED; no A fiber |
| 6.8 case 1 A mounts / case 2 boot names B / case 2 A rolled back | `w7aLive === []`; `w7bBootError === undefined` (nothing selected, nothing can fail); no A fiber |
| 6.9 create {A}/{B} / cold resume same sets | `[]` both phases (the resume machinery itself passes — see below) |
| 6.10 close() A / B disposed exactly once | `disposeCount === 0` (nothing mounted ⇒ nothing to dispose) |
| 6.11 final surface / proven delta / classification | surface `[]` (no mount ⇒ no mcp tools registered); delta `[]` (pre `[]` — the strict pre-MCP snapshot EXISTS on the old state and is `[]`); verdict `ok` with zero tools |

**(b) — old singular state shape (`mcpView`/`mcpFiber`/`mcpActivationError`;
per-server `mcpViews`/`mcpFibers`/`mcpActivationErrors` absent): 10 failures**

| case | observed RED shape |
| --- | --- |
| 6.1 leader `mcpFibers` keys / leader `mcpViews` keys / e3 views+fibers | `state.mcpFibers === undefined` → `stateFiberKeys` fallback `[]`; `stateViewKeys` fallback `[]` vs expected `[A,B]`/`[A,B,C]` |
| 6.2 legacy per-server state keys | `[]` vs `[t12a-mini-mcp]` (the legacy MOUNT itself passes — C7 behavior intact) |
| 6.5 member state fibers/views | `[]` vs `[A]`/`[A,B]` |
| 6.6 member state after narrowing | `[]` vs `[B]` |
| 6.7a activation error recorded / 6.7b activation error recorded | `state.mcpActivationErrors === undefined` |
| h1 H1-4 control (configured server view EXISTS) | `views.mcpViews === undefined` → `Object.keys({}) === []` vs `[t12a-mini-mcp]` (old views carry the singular `mcpView`) |

**Passes on RED (the predicted legacy/zero-MCP controls — 14 in
multi-mcp-wiring + h1 6/7 + t4a 27/27 + t12a-b3 4/4 + p8s4b 11/11):**

- 6.1 e3 deny → zero mounts / zero fibers (deny lane produces the zero set on BOTH runtimes);
- 6.2 legacy single-server MOUNTS (leader + legacy member) — C7 regression pin holds pre-B;
- 6.3 all four zero-MCP assertions (zero fibers, `mcpViews ?? {} === {}`, `mcpFibers` empty) — canonical `mcpServers: []` world;
- 6.4 both duplicate-identity cases (A's `mcpSupplyValidationIssue` rejects; `configuredMcpServers` passes caller-validated input through — A merged, stable);
- 6.5 "no B fiber object exists on the member ctx" (vacuous-true pre-B; meaningful post-B);
- 6.7b "B left no partial fiber and the live state is empty" + 6.8 case 2 "no partial newly-mounted set" (vacuous-true pre-B; meaningful post-B);
- 6.9 "the resume re-bound every session (resumes, never re-creates)" (pre-existing resume machinery);
- 6.11 "the setup succeeds (no coverage failure on the second mcp tool)" (RED: empty surface ⇒ coverage passes trivially; GREEN: real dual-mount surface must also pass);
- h1 H1-1/H1-2/H1-3 both spellings (zero-MCP behavior identical pre/post B by construction);
- t4a 27/27 (bridge modification is behavior-preserving for legacy single-server worlds — verified against the modified bridge);
- t12a-b3 4/4 (the minimal `mcpViews?.[server]` adaptation is shape-defensive: RED old shape degrades to `undefined` ⇒ B3-4 passes; resolver-semantics regression intact);
- p8s4b 11/11 (untouched — resolver pure-function regression intact).

## Verdict

**RED PURE.** Every one of the 34 failures classifies as (a) or (b). No
failure implicates the A config contract (A merged — the 6.4 helper cases
and the legacy/zero worlds pass), no unexpected crash shape, no test-own
bug. The GREEN expectation surface matches the main agent's independent
post-B focused run (111/113 with only the old-file H1-2/B3-4 single-value
assertions failing — both superseded by this branch's migrations).

## Notes for the GREEN phase

- 6.4 and the zero/legacy controls must STILL pass on the B-inclusive tip
  (they are runtime-agnostic pins); any failure there on GREEN is a B
  regression to escalate, not an assertion to loosen.
- W8 resume world uses a fresh fake DSH_HOME (`.tmp-mm-w8-resume-home`) and
  removes it; the p6t6 scratch dir (`packages/testkit/test/.tmp-fault/
  multi-mcp-wiring`) is destroyed at file end via `destroyP6T1World`
  (a crashed mid-file run leaks it — known, cleaned manually on rerun).
