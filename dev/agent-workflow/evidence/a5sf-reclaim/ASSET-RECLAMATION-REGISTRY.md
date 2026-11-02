# Alpha.5 asset reclamation registry (R1–R5)

> Dated 2026-11-02. Companion to `docs/plans/memo/alpha5-sandbox-first-20261101/TRANSITION-PLAN.md` §6.
> Sources are `master` (`8067f631f3`) paths; the SHA column is the last commit that touched the
> asset (`git log -1 --format=%h -- <path>`), recorded so a later reviewer can diff the exact
> source that was classified.

## 0. Classification rules

| Class | Meaning | Allowed use |
|---|---|---|
| **A — reuse as-is** | The module's responsibility is unchanged by Sandbox-First. | Import/call directly; no interface change. |
| **B — reuse mechanism, adapt interface** | The correctness mechanism survives; its inputs/outputs are tied to a retired model (EffectSet, Family, caps files). | Extract the mechanism behind the NEW interface; never let the old model back in as the price of reuse. |
| **C — experience only** | Implementation is superseded; only tests/evidence/failure cases are valuable. | Regression inputs, oracles, documented failure modes. Never counted as new-architecture acceptance. |

Two hard rules for every row:
1. **Historical green ≠ new acceptance.** A passed old test is evidence about the old executor, not
   about the new Provider/OS backend. Each reclaimed asset needs its own acceptance evidence in the
   new lane before it counts toward a Gate.
2. **Reclaim never weakens a new invariant.** If reuse would require weakening the two-axis ceiling,
   the native-tool boundary or the single-authority rule, the asset is NOT reclaimed (it is retired
   or rebuilt). This is the "second migration destroys the new architecture" failure the user
   explicitly warned about.

## 1. Registry

| id | Asset (path @ SHA) | Class | New role / interface | Owner | Retirement condition of the old form | Acceptance evidence required |
|---|---|---|---|---|---|---|
| R1-a | `packages/runtime/control/service.ts` @ `929fc4af2` | **A** | The only approval/authority service. Consumed by `InvocationAuthority.approvedOnce` (P1-02/P1-04) as an INPUT; never re-implemented. | Governance | never (stays) | P1-04 `approvedOnce` no-widening test; a real Control→Invocation round-trip in P2 |
| R1-b | `packages/runtime/tool-admission` @ `a26b6039f` | **B** | Keep: one-logical-approval-case, replay-proof one-shot grant, pre-execute consume, final guard, bounded clock checks, identity+generation checks. Drop: `RequestedEffectSet` as admission input; re-point at native ToolDefinition identity + `toolBindingIdentity`. | Governance | when the new Invocation Binder + Alpha.4 control path covers every managed native call (P2 exit) | P1-04 single-use/revocation/epoch tests; P2 native-call replay negative control |
| R1-c | `packages/runtime/src/plugin/live/pa-mount-registry.mjs` @ `929fc4af2` | **B** | Keep as reference for: never trust a tool name, require a real ACTIVE binding, old disposer must not clear a newer mount, permission facts re-read from current authority. Adapt to native ToolDefinition registration identity. | Native Integrator | when member-service install (P1-05) + trust registry (P1-04) carry the same facts | P1-05 isolation tests; P2 late-mount/replace negative control |
| R1-d | `packages/runtime/src/plugin/live/approval-entry-binder.mjs` @ `5e27df4b2` | **B** | Keep the "one approval entry point, no duplicate registration" mechanism; interface becomes the native tools/execute pipeline. | Native Integrator | P2 wiring | duplicate-entry negative control under the native pipeline |
| R1-e | `packages/runtime/effective-policy` @ `8525b9519` | **B** | Mechanism only: policy revision identity + generation comparison. The two-axis ceiling itself is P1-02 (`member-io-policy`); do not resurrect a second policy computation. | Policy | when nothing imports it outside legacy paths | P1-02/P1-04 revision tests; grep proof of single computation |
| R2-a | `scripts/current-authority.mjs` / `publish-authority.mjs` / `switch-authority.mjs` + `dev/engineering/authority-snapshots` @ `bd30dfd07` | **A** | The only machine authority. The Authority Migration PR uses `publish` then `switch`, never a hand edit. | Authority Writer | never | migration PR dry-run + rollback run |
| R2-b | `tests/world-factory` @ `df92b3447`, `tests/paths.mjs`, `tests/homes` protocol | **A** | The only test-world/launcher factory; P2 suites extend it, no second launcher. | Test/Security | never | P2 suite runs against the pristine host pin |
| R2-c | `.github/workflows` (four-layer CI, post-merge re-verification, collected-test gate) @ `8067f631f` | **A** | Same pipeline; new gates add suites, not a parallel CI. | Engineering | never | green PR pipeline incl. C2 evidence on the merge candidate |
| R2-d | `docs/ROUTER_RULES.md` @ `fdf1716c2`, `docs/TEST_METHODS.md` @ `f94550436`, `AGENTS.md` @ `0edd8549c` | **A** (content updated only by the migration PR) | Execution protocol, test constraints, red lines. New plan's discipline rides on these. | Authority Writer | never | migration PR review |
| R2-e | `docs/scripts` (`docs:probe`, `docs:sync`), Agent Notes/contracts index | **A** | Documentation integrity; four independent state axes (Decision / Implementation / Verification / Release). | Engineering | never | docs probe green after the migration |
| R2-f | dynamic tool census / registry (`source-driven tool baseline`) | **B** | Keep the "dynamic from trusted source, fixed snapshot per verification" mechanism; the accepted set becomes `ToolDefinition source + Provider/Backend + binding + I/O axis + oracle + status`. Do NOT freeze the old 93-tool list as the new universe. | Engineering | when the census is re-pointed at native sources | census re-run showing native sources |
| R3-a | `packages/runtime/tool-dispatch` (closed-world guard) @ master | **B** | Keep the monotonic end-cap idea; the native pipeline already provides `tools.guard`, so prefer the native seam and keep this only where it is load-bearing. | Governance | P2 integration decision | cross-plane evidence chain test (R3-b) |
| R3-b | cross-plane evidence chain (`member → definition → callId → policyRevision → approval → provider/OS → side effect → settle`) | **new work (R3)** | One audit row per managed call; missing middle evidence is a FAIL, never substituted by "tool registered" or "approval succeeded". | Test/Security | n/a | P2: one real call with the full chain, one negative control with a missing field |
| R4-a | `packages/runtime/sandbox-provider` (launcher/probe/lease/FD/network) @ `d5de74974` | **B/C** | Reused by P1-07 behind the new profile compiler; keep launcher, process-tree, lease, cancellation; its old EffectSet/`network: restricted` conclusions are NOT inherited. | OS | when P1-07's runner is the only entry | P1-07 evidence (real positive/negative FS); independent OS oracle in P2 |
| R4-b | `packages/runtime/controlled-fs` path/version checks @ `053d9ae36` | **B** | Selectively reuse path/version verification; the `nlink===1` rule stays retired for the Member data plane (P1-03) and intact for the control plane. Do not copy old FS tool behavior. | Service | P1-07 exit | P1-03 hardlink/symlink tests |
| R4-c | `packages/runtime/governance-center` registry/lifecycle @ `a7cbc5bec` | **C/B** | Keep invariants + tests (generation, drain/tombstone, duplicate mount); do NOT reintroduce a FamilyAssembly contributor model just to run the Kernel. | Governance | P2/P3 decision | invariant tests ported to the new entry points |
| R5-a | `packages/tools/fs-family` @ `edefd724f` | **C** | Golden vectors + failure cases → native `read`/`write`/`edit` regression inputs. | Test/Security | retire the business body after P2 native parity | native parity + negative controls |
| R5-b | `packages/tools/process-family` @ `a023f8172` | **C** | Keep reusable OS infrastructure only; no PTY/Bash business state machine is copied. | OS | after P1-08/P2 wiring | real PTY receipts |
| R5-c | `packages/tools/search-family` @ `1ac446f8b` | **C** | Functional regression + failure samples for native `glob`/`grep` over controlled subprocess. | Test/Security | after P2 search row | native search oracle |
| R5-d | `packages/tools/web-family` @ `f42a92023` | **C** | Not an execution path. Old admission-only ≠ network hard ceiling; old passes are not network evidence. | Service | after a network ceiling exists (future round) | explicit UNSUPPORTED until then |
| R5-e | `packages/tools/a5p5-tools` full EffectSet @ `a023f8172` | **C** | Only pure functions/safety properties that survive review; the new product does not require per-effect modeling. | Engineering | delete after no importer remains | grep proof of no new importer |
| R5-f | `packages/tools/families/*` + `family-assembly` `family-body/named-bridge` @ `1e51e1a70` | **retire** | Not a default integration path anymore: native `ToolDefinition` + Service/OS is the only path. Historical tests may stay isolated in the legacy world. | Native Integrator | after P3 native coverage | native coverage report |
| R5-g | old all-tool coverage matrix PASS states | **C** | Index of history only; never carries into G2–G4. | Engineering | never | n/a |

## 2. R1–R5 work packages folded into P1–P3 (user request)

| R | Deliverable | Where | Status in this branch |
|---|---|---|---|
| **R1** approval/governance takeover | No second permission computation; binder consumes `approvedOnce`; single-use/revocation/no-widening proven | P1-02/P1-04 | **done at unit level** (`a5sf-member-policy`, `a5sf-invocation`). Remaining: real Control→Binder round-trip in P2. |
| **R2** engineering baseline inheritance | No second authority / second launcher; pointer untouched; CI unchanged | before/with P1 | **verified**: pointer digest unchanged in branch; `current-authority.mjs` still the only reader; no new launcher. Migration itself is the separate PR. |
| **R3** native tool wiring + audit reuse | trusted binding + mount lifecycle + one-call evidence chain | P1-04/P1-05/P2/P3-00 | mechanism ready (P1-04 registry, P1-05 install); chain test is P2. |
| **R4** generic execution infrastructure extraction | launcher/process-tree/cancel/release, no tool business code; re-probe backends | P1-07/P2 | **done at P1-07 unit+real-OS level**; backend re-probe recorded (this host enforces FS, network unsupported). |
| **R5** historical test asset conversion | golden vectors/regressions/negative controls become new inputs; old green not counted | P2–P3 | not started (P2). |

## 3. Retirement sequence (safe order, no big-bang delete)

1. **Freeze** the legacy executors as isolated historical test worlds; add a grep gate that no new
   code imports `families/family-body` or the self-built family executors.
2. **Prove** native parity per tool family (P2): output equivalence + negative I/O controls.
3. **Switch** the default path to native + Service/OS; keep the legacy path only behind an explicit,
   named historical flag.
4. **Delete** a family body only after its regression suite lives in the native lane and a release
   gate has passed without it.
5. Never delete evidence; move it to `dev/agent-workflow/evidence/` with its source SHA.

## 4. Anti-patterns this registry forbids

- Re-introducing `RequestedEffectSet` because the old admission kernel wants it.
- Re-registering every native tool through `FamilyAssembly` to reuse the GovernanceKernel.
- Claiming network hard ceiling from `web-family` admission-only history.
- Counting an old matrix PASS as a G2–G4 PASS.
- Creating a second authority pointer, a second test launcher, or a second policy compiler "to keep
  the old pipeline working".
