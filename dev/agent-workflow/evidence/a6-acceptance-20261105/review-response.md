# Independent review response — Alpha.6 E2E delta

Reviewer verdict: **BLOCK**, two P1s, no P0. Reviewer was read-only at
`8ea3a0517`; this response is bound to the follow-up code at `996427e3f` and the
integration merge that contains it.

## P1-1 — Leader fallback bypassed an authored hold — FIXED

`packages/runtime/alpha6/notifier.ts` now permits the legacy Leader notification
only when ALL hold:

- the route is `unroutable` (never `hold`);
- the row is a durable `leader-approval` with `reviewAuthority === 'leader'`;
- the row has no `operationToolOwner` / `operationToolName` (the legacy
  `parameter-permission` shape).

A policied `hold` throws the same "no Officer wake and no Leader fallback" error
as every other non-recipient route. Regression tests added:

- `never lets an authored hold become a Leader decision` (A6 ordinary row with
  tool owner/name → throws, zero Leader notifications);
- `delivers an UNROUTABLE legacy guard row to the Leader, not an A6 ordinary
  ask` (legacy shape → Leader notified).

## P1-2 — per-root routing did not reach the router — FIXED

`Alpha6RootRouterInput` now accepts `routingForRoot`, returning the request
root's frozen v5 `routing` + `leaderTemplateId`. `route(requestId, root)` uses
that policy for `blueprintReviewPolicyFrom`, the Officer/Leader template
selection and the category lookup. `routingForRoot === undefined` keeps the
single-root/test behavior; an explicit `null` returns
`hold('config-invalid', no frozen v5 review routing is resolvable for root ...)`.

`root-composition.ts` exposes the resolver from the same `blueprintSourceForRoot`
parse used by the facts port; `src/plugin/root.ts` threads it into the router and
uses the request root for the category callback.

Regression tests added:

- child root with a divergent `officerTemplateId` routes to the **child**
  Officer, not the boot Officer / a hold;
- an unresolvable child root holds `config-invalid`.

## P2-1 — `routingForRoot` null reused boot routing — FIXED

`assigned-officer-facts.ts` now distinguishes `undefined` (no per-root resolver;
use boot routing) from `null` (this root is refused). Test added:
`refuses a root when routingForRoot explicitly answers null`.

## P2-2 — no tests for the authority wire — FIXED

`a5w-vseam-pa-verifier-seam-c1.test.ts` now covers the verifier directly:

- a member-principal PA allow carrying durable `reviewerAuthority: 'leader'`
  passes the all-Effects verifier;
- the same manifest/decider without the evidence stays fail-closed
  (`pa-authority-drift`).

The landing presenter and `requestedEffect: 'allow'` remain evidenced by the
real-Host ledger (seq 8/9 and 11/12); the new test pins the security-critical
verifier branch. The real Host E2E was rerun after these fixes at `c26a9a00`:
6/6 criteria, one execution, 2/2/2 consumption, pending 0.

## P2-3 — gate evidence — ADDRESSED

A full `--full` gate is rerun at code HEAD `c26a9a00`; `gate.md` binds
the result and keeps the earlier census-flake disclosure. The pre-existing
`a6-pr1-lane-hygiene` `readFileSync` race is disclosed, not hidden; no assertion
was changed to obtain a green.

## P3 items

- `notifier.ts` non-route fallback now resolves `request.rootSessionId`, not the
  boot root.
- The ARC-A override reason for `pa-control-bridge.ts` now says the allow effect
  is inside the `a6:true` branch and the landing presenter is gated by durable
  decision evidence (fallback reproduces the old decider rung).
- The `32`-id cap / newline limitation is left as-is: ids are server-minted;
  documented as theoretical, no authority impact.
- A6-5 wording is scoped in the acceptance matrix: `leaderWakes=0` counts review
  wakes, not the separate legacy guard notification.
