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
