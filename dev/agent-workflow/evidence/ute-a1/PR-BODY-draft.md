# feat(ute-vnext): A1 cut + centre (draft; not for merge)

Draft candidate for the UTE vNext A1/B floor on top of the frozen A0 contract
(`master @ a19d1df01`, PR #821). **Not for merge, not a release, not a deployment.**

## What this branch is

- **A1 cut** — 146 legacy files and 52 dist artifacts retired, `agent-bindings.mjs` and `root.ts`
  replaced wholesale; no legacy Plane/Family Body/Kernel/PA Bridge wrapped as an internal component and
  no legacy fallback. Closure gate: `prodRefs=0 distResiduals=0 dupNames=0`.
- **The centre** — one admission authority: identity/IPC binding, `EffectiveIO ⊆ AgentCeiling ∩
  ToolRestriction` on three axes that are never merged, `InvocationAuthorityFacts` /
  `DurableAdmission` / `ExecutionFact`, Control allow/ask/deny with a post-approval recheck, one-shot
  grants, Stop priority, real FS enforcement through the confined provider, durable facts, UNKNOWN, and
  crash recovery that never replays.
- **The wiring** — native DSH `ToolsService` definitions and dispatch only. An unwired controlled call
  is **explicitly refused** (`ADMISSION_AXIS_UNSUPPORTED`, `NETWORK_DENY`, `ADMISSION_TOOL_UNBOUND`),
  never forwarded.

## Why it is a draft

Every capability row in `dev/agent-workflow/evidence/ute-a1/CAPABILITY-MATRIX-C.md` is MECHANISM or
UNPROVEN; **none is PRODUCT-PROVEN**, because no arm here has booted a real host process. Closing that
is step D, not this PR. Two contract questions are escalated rather than worked around:

- `CONTRACT-CHANGE-REQUEST-process-lane.md` — subprocess/PTY/PTC have no single-source process-lane
  declaration, so the three families stay explicitly refused.
- `CONTRACT-CHANGE-REQUEST-settlement-recheck.md` — the frozen settlement contract has **no legal state**
  for "admitted as allow, then refused before the body"; the centre reports `SETTLEMENT_CONTRACT_GAP`
  rather than fabricate a Stop or claim UNKNOWN certainty.

## The 16 migrated capability suites are now RUN, not assumed (rounds 30-32)

`migrated-entry-imports.json` said `missing: []` — every file imports the new entry — and that was read as
"migration done". Nothing had ever executed them. They run from the main worktree's vitest install (this
worktree's `.bin` points at a deleted sibling), and the first execution found **8 failures**, one a live
`ReferenceError` (`resolvePaMount`) on the authority-generation publish path.

Now **237/238**, with the population declared in `tests/checks/eb3-ute-migrated-suites.txt`:

```
EB3-LAYER layer=ci-integration verdict=FAIL suites=15 files=15 describes=76 passed=237 failed=1
```

(The 16th bookkeeping entry is `t12a-live-bridge.mjs`, a helper with no tests — the token runner refuses a
list longer than its report, which is how the census found that out about itself.) The leg is **not bound
to a Required layer yet**: its population is red, and binding it would need the exemption this project
forbids. Fix the one red → it goes green → the leg goes in.

## Two capability gaps found by running them (both escalated, neither papered over)

1. **The durable Alpha.4 permission overlay has no decision-side effect** (E3). The retired entry
   consulted it per call through a pre-execute adapter; the cut retired the adapter with the execution
   route, so the centre judges only the COMPILED binding lanes and a `grantInstance` deny persisted after
   bind changes nothing at execution time.
2. **Admission was conditional on the realm.** A member with `centreStatePath` but no confined-provider
   realm ran unmediated and unreported. Fixed for the rows that ASKED (they are now refused with
   `MEMBER_CENTRE_UNWIRED`); rows that never asked remain outside the centre and face the owner ruling in
   `ESCALATION-realmless-admission.md` (admit against the compiled ceiling vs refuse).

## E3 is GREEN, and the migrated suites are a Required leg (rounds 48-50)

The last red was not a wiring gap: **E3's world was pre-cut** (v3 document, no v4 `memberIoCeilings`, no
realm, no `centreStatePath`), so no centre installed and no ALLOW lane existed for its control — measured
with instrumentation, four facts with file:line. The assertion was right; the fixture was stale. It was
rebuilt on the v4 contract, and the centre got a real durable-overlay provider
(`overlay-decision.mjs`: async prepare keyed on the overlay generation, sync `decide` over the frozen
`resolveOperationPermission` — the async/sync split was one of the four measured facts).

```
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0
EB3-CI-REQUIRED pass workflows=10 findings=0
```

G8's "flake" was also mislabelled: `bothFulfilled === false` was the retired `resolvePaMount`
`ReferenceError` **on the delivery path**, the same defect fixed for the f15 legs; the re-runs that cleared
it all came after that fix. It is now reproduced deterministically, and the arm awaits the world's own
`resumeGate` promise instead of polling a 3 s wall clock.

**Still not PRODUCT-PROVEN**: no host boot line. Overlay `ask`/`allow` are outside the port; subtree
matching is implemented but unexercised by the E3 probe. The realm-less admission ruling is open.

## B stage, first slice: the ask path is REAL (round 51)

Before this, every `ask` was a hard refusal: no approval binder was wired at all (`ADMISSION_ASK_UNWIRED`).
Now an `ask` becomes a durable Control request, its decision is recorded, the **post-approval recheck** runs
(lane AND policy generation), and a **one-shot** grant is minted and consumed exactly once — over the
EXISTING `ControlService.awaitControlDecision` bridge, not a second one. Host-native asks are preserved
(the host's own prompt is a legitimate approval authority).

Controls, all node:test in the `ute-vnext-a1` leg (119 pass): ADM-46 three wirings; ADM-47 deny ⇒ no
execution + durable fact + REFUSED settlement; ADM-48 expired distinct from denied; ADM-49 fault; ADM-50
over the REAL durable ControlService (one request, one durable allow, spend counted once across the host's
double guard consultation, replay refused); ADM-51 real service deny; ADM-52 generation drift after
approval; ADM-53 incomplete identity refuses before asking a reviewer; ADM-54 supply-chain pin; ADM-55
aborted vs abandoned.

**Not proven:** no host boot (a member ask surfacing in a real leader's `team_list_pending_control` is not
exercised); the durable allow is `inline` and therefore not a guard token (`control/service.ts:4278-4290`),
so exactly-once rests on the binder grant + ledger replay refusal; `stale-denied` and the abort/abandon
distinction are proven at mapping level only; the grant binds member+call+tool+revision but not the locator.

## The adversarial centre review (round 28)

No P0, seven P1. Six are fixed on this branch; the seventh is the settlement gap above. They were all
in the product composition, not the mechanism — which is the useful part of the finding:

| finding | state |
| --- | --- |
| settlement recorded the lane's raw answer, then overruled it | fixed — settles the enforced decision, fact keeps `decision` + `laneDecision` |
| shared settlement dir turned another member's live execution UNKNOWN | fixed — per member |
| post-approval recheck consulted a frozen binding | fixed — live resolver (ADM-37) |
| realm disposer registered twice → close started it before the tombstone | fixed — ordering |
| throwing ledger/settlement escaped instead of refusing | fixed — three deny codes (ADM-38) |
| per-call memo served any dispatch with the same callId | fixed — memo serves one execution (ADM-38) |
| admitted-then-refused has no settlement state | **escalated** |

## Verification on this HEAD

| gate | result |
| --- | --- |
| `dispatch-tests --leg ute-vnext-a1` | `suites=6 files=6 exit=0` (42 admission arms, 36 fs-slice, 7 reader, 6 template-binding, …) |
| `test-catalog --max-uncollected 41 --max-excluded 7` | `tests=888 refused=0 findings=0` |
| `ute-p0-assets --check` | `pass modules=37 files=180 lines=69512 cut=cut(148/148)` |
| `ute-cut-closure --check` | `pass deleted=148 prodRefs=0 distResiduals=0 dupNames=0` |
| `ute-a1-window --check` | `pass branch=vnext/a1-cut red=0/0` |
| `eb3-ci-required` | `pass workflows=10 findings=0` |
| `docs-sync --check` | `findings=0 blocking=0` |
| `place-dist-glue` | `done (26 placement(s))` |

## Limits stated plainly (not claims)

- No real host boot, no multi-agent concurrency, no revocation-under-load, no Stop-under-load: all
  step D. Nothing here is a statement about a running product.
- `host.service` capabilities (Goal/Todo, Team Skill, Subagent) are bound and recorded, but their I/O
  is the **host's** — a skill file read by the host skill service is outside the member's fs ceiling.
  This is a limit, not a confinement claim.
- No approval binder is wired in the product, so every ask lane is a hard refusal today (fail-closed,
  and the record says so).
- Local environment: no `tsc`, no vitest, no product boot; the pinned rc.2 host is built, the rc.5 host
  is present but not installed (see `NEXT-HOST-RC5-FEASIBILITY.md`).
- The two giant files are being decomposed by ownership, not by line count; `agent-bindings.mjs` is
  4,499 lines from 5,301 and the progress table is append-only in `DECOMPOSITION-PLAN.md`.

## Not done here

Candidate must not auto-merge. No release, no deploy, no version bump. `master` is untouched.
