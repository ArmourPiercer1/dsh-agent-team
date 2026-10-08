# RULING (coordinator, 2026-10-08 round 45): W8 — a corrupt control leg with no `approvalCaseId`

Review item 2 asked for an independent ruling rather than a silent close. This is that ruling. It is
grounded in the code, not in the review's paraphrase.

## The mechanism, as it actually reads

`packages/runtime/control/service.ts`, `loadControlState`, lines 1452-1463:

```ts
const payload = parseRequestPayload(entry.payload)
if (payload !== undefined) requests.push({ entry, payload })
else if (isPlainObject(entry.payload) && typeof entry.payload['approvalCaseId'] === 'string') {
  corruptLegs.push({ entry, payload: entry.payload })
}
```

A `FACT_REQUEST` row that the strict parser refuses is filed into `corruptLegs` **only when its payload
carries a string `approvalCaseId`**. Otherwise it is dropped: the read plane never reports it, the guard
never sees it, and `guardOperation` returns `no-request`, which `packages/tools/src/guard.ts` maps to
"proceed". That is the whole of W8, and it is one condition, not a policy debate.

Why that condition is wrong, in one sentence: **the filing gate depends on the one field that the
candidacy test right next door explicitly refuses to rely on.** `corruptLegCouldGovern` compares
*members* (subject/targetInstanceId, actionName, toolName, correlation, operationFingerprint) and its
doc comment says why — "the case identity of a leg whose members are damaged is precisely what cannot be
recomputed, which is why this compares members instead of hashing them". A row can only be judged by the
case id if it survived the parser; a row that did not survive is exactly the case where the case id is
missing, damaged, or the thing that broke. Filing-on-case-id therefore excludes, by construction, the
population the guard was built for.

## RULING 5-A — filing must not depend on the case id (implement, no policy cost)

File every refused `FACT_REQUEST` whose payload is an inspectable plain object, regardless of
`approvalCaseId`. Candidacy stays where it already is, in the member algebra, which already yields the
three honest outcomes:

| what the damaged row still discloses | verdict | consequence |
| --- | --- | --- |
| members agree with this call | candidate | blocked, fail closed |
| some member positively disagrees | not a candidate | legitimate `no-request` — the anti-freeze direction |
| no member at all | see 5-B | — |

The scope filter `entry.rootSessionId !== root` (line 1451) already bounds the blast radius to one
Team's root, and a row that names a *different* scope is still ruled out by the existing algebra, so this
part cannot freeze a Team whose rows are merely damaged-but-scoped. **W8's current assertion survives
only for the disagreeing-members case**; the agreeing case must flip to blocked, and the test must be
revised as a named behaviour change, not quietly edited.

Wording matters for the record: this is not "W8 was passing wrongly and is now fixed". W8 pinned the
behaviour the code had, honestly, and disclosed it as residual. What changes is the code's rule.

## RULING 5-B — a row that discloses no scope member at all (needs the human, not me)

A row that is an inspectable object but names no member is **unattributable**: it cannot be ruled out of
any call, so the member algebra returns "candidate" for every call in that root. Strict fail-closed
reading: block, because Alpha.4's premise is that an unreadable control record must never *reduce*
enforcement. The cost is real and should not be pretend-away: one corrupted byte would silently brick a
Team's approvals, surfacing as `no-request`-shaped refusals that look like missing state.

Options, both defensible:

1. **Block the hot path** and surface an explicit `control.unattributable-leg` fault on the read plane,
   so the failure is attributed to storage rather than to the caller. Strictest; accepts a Team-wide
   outage as the price of never enforcing less.
2. **Fail certification, not execution**: keep `proceed`, but count unattributable legs and make the
   governance/certification plane refuse to sign a Team green while the count is non-zero — the same
   shape as the compatibility plane's warning-plus-acknowledgement (`确认警告`) that the acceptance world
   now renders. Cheaper operationally; accepts that a damaged ledger can execute one more call.

**I am not choosing here.** This is a safety-versus-availability trade about a human's Team, and the
Alpha.4 record is better for saying so than for picking quietly. Recommendation for the human: option 1,
because the failure mode it accepts (a Team that cannot proceed until an operator looks) is recoverable
and observable, while the failure mode of option 2 (an authority decision made from a ledger we know is
corrupt) is neither. Option 2's acknowledgement UI already exists, which makes it the cheaper one — that
is the argument for it, and it is not strong enough for me to spend it on my own authority.

## Sequencing

5-A is a small, mechanical change in the same file as F1 (`control/service.ts`), so it goes to the **F1
lane after F1 lands** rather than to a second writer in the same file — one writer per file set. 5-B
stays open pending the human's decision, and is recorded in `post_alpha4_backlog` so it survives this
session.
