# A4-PR6 review round 1 — the six review fixes

Review verdict at `173326b7`: DO NOT MERGE — two wire-reachable blockers
inside 6.A invisible to any test, plus four named gaps. All six fixed
ADDITIVELY (fix commits on top; the nine original stage commits were
never rewritten). No push.

## Commits

| Fix | Commit | Law shipped |
| --- | --- | --- |
| 1 | `1c7c76f8` | EVERY Team-start entrance runs the governance gate: `team.create` (wire), handoff `startTeamFromHere`, boot-create, boot-resume. One shared exported arm mapper (`governanceStartRefusal` in `s6-remote.ts`) — entrances carry, never re-derive; handoff passes refusals through untouched (`isGovernanceStartRefusal` on `error.detail.reason`). Replaced the occurrence-count site law with behavioural per-entrance tests (`a4p6-start-gate-entrances.test.ts`, 6 tests: refusal lands typed, ZERO agent starts, bootCount 0, the minted binding stays NOT LIVE, replay refused, open-world completes with exactly ONE gate consultation). |
| 2 | `3f12bf3f` | An UNREADABLE authority document can never OPEN the start gate. The docs adapter consumed `permissionEnvelope`, whose abstention value is the zero-authority `{rules:[]}` with the `ok` flag dropped: an UNKNOWN binding / canonicalization fault / binding drift compared `consistent` and the gate opened. New three-state `permissionEnvelopeState` (`PermissionEnvelopeStateRead`) preserves `ok`; the exported `buildGovernanceWarningDocs` maps `unavailable` to `{stage:'unreadable'}` → the closed `authority-document-unreadable` corrupt arm. Lane polarity untouched (abstained EXPANSION reads still mean zero authority). |
| 3 | `3f12bf3f` | Production `contains` can reach `undetermined`. The warning lane inherited the plane-shaped `fsContainsKeys`: absent seam THREW (escaped `runGate` unmapped), `=== true` coerced every non-true answer to a fabricated `false`. New exported `buildGovernanceWarningContains`: never throws; `undefined` for absent seam / throwing provider / throwing backend lookup / non-boolean; `true|false` only for real answers. The plane keeps its own throw law (different site, documented). Composition legs run the REAL `createGovernanceWarningService` over the REAL host adapters (`a4p6-governance-warning-host-adapter.test.ts`, 7 tests). |
| 4 | `3af6d82d` | `control-request-abandoned` (pre-alpha3 PR-D close fact, plan:1031 rendering decision) joined `INTERNAL_FACT_TYPES`. It sat in neither `FACT_ROW_KIND` nor the internal set: `?? 'unknown'` made a generic row JSON-dump the payload — the shape §6.C's renderer law forbids. Decision recorded: the skip, not a family — its surface is the paired control chain (`adaptControlAbandonDraft`, PR #56 uniformity). |
| 5 | `472701c6` | `REMOTE_GOVERNANCE_WRITING_METHODS` += `team.resolveControl` + `compatibility.ack`, and the A1-2 law pinned REVERSE (routed-to-a-decider-derivation ⇒ enumerated, with a non-vacuity guard). The member negative is now DRIVEN: `a4p6-driven-principal-act.test.ts` (6 tests) runs the production dispatcher with the REAL `createServerPrincipalDerivation` — the caller reaching the warning plane is the invariant-9 identity of the addressed root; a swapped context is typed per call with zero plane calls; foreign root and `asRole` smuggling die before the plane. The aggregation suite's stub principal (`humanCaller('human-a4p6-wire')` — while its test title claimed "the DERIVED caller") is replaced by the real derivation; its allow leg now asserts `callerId === P6T4_ROOT`. |
| 6 | `472701c6` | The s6 `intervention.act` lane validates the plane receipt against `REMOTE_INTERVENTION_ACT_OUTCOMES` like the generic dispatcher (internal-error / `port-contract`); pre-fix a non-vocabulary receipt minted a wire value the v8 contract never closed. Plus the NAMED §11.5 test (W9 in the aggregation suite): a ceiling-narrowed leg takes its durable allow through the wire act (real derivation, real control service) — the refusal lands at CONSUMPTION: `request-pending` before, allow EXACTLY ONCE after (guard reads durable rows; writes `control-allow-consumed`), `allow-consumed` second. |

## Captures (this directory, `red-captures/`)

- `6r-red-entrances.txt` — all six entrance legs RED before fix 1.
- `6r-green-entrances.txt` — 6/6 after.
- `6r-red-enumeration-reverse.txt` — the reverse A1-2 law RED before the enum join (`compatibility.ack` routed-but-unenumerated).
- `6r-mutation-2-leader-collapse.txt` — reverting the unreadable mapping to the zero-claim collapse reddens exactly the two fix-2 legs.
- `6r-mutation-3-contains-plane-shape.txt` — restoring the plane-shaped contains CRASHES the suite at module load: the escaping throw is the bug itself.
- `6r-mutation-4-abandon-unknown.txt` — deleting the INTERNAL entry reddens exactly the fix-4 spec (`expected [ { kind: 'unknown', ... } ] to have a length of +0`).
- `6r-mutation-6-unvalidated-receipt.txt` — reverting the receipt guard ships `{"outcome":"approved"}` to the wire.

## Fix-1 follow-up (commit `a4140137`; found by the FULL-suite gate, not by any round test — disclosed with that admission)

The fix-1 boot gate sat BEFORE `bindFresh` ("fail closed before the durable
mint"). That position is structurally unable to answer its own question: the
governance documents resolve through the addressed team's TeamSession row +
bound snapshot, which `bindFresh` mints. The round-1 gate made that newly
VISIBLE — 18 boot-heavy suites (bp1-freeze-barrier, the production-startup
family, t12b1/b2/b6, team-session-startup-fence, …) began failing closed with
`authority-document-unreadable` because the gate read a team that did not
exist yet. Before the round, the same worlds were SILENTLY OPENING the gate
with the conflation fix 2 removed — fix 1 + fix 2 together exposed the
ordering flaw (capture: `red-captures/6r-red-boot-order.txt`).

Fix: the `createAndStartTeam` gate moved to AFTER the fresh-root commit,
BEFORE the agent start — the position the wire lane had pinned from the
start (bind → gate → start). The refused create/handoff/boot now leaves the
FULL atomic chokepoint commit (row + snapshot + team-root binding, one
commit) with ZERO agent effect — durable NOT-LIVE, exactly the state of a
stopped team; every re-entry (boot resume, `team.ensureRootLive`, replay)
re-runs the SAME gate and re-refuses. W1/W3 updated accordingly (their
binding-absence assertion pinned the wrong order, not a shipped law).

## No-new-mutes ruling (parent, post-report): the six entrances mutes are GONE

The parent's gate verified the round but caught what the report did not
say: `a4p6-start-gate-entrances.test.ts` carried SIX
`eslint-disable-next-line @typescript-eslint/no-explicit-any` mutes —
and "zero new lint identities" and "six mutes" are the SAME fact: the
mutes were exactly what kept the identity gate green, i.e. a gate closed
by silencing it. Fixed at the source; no exception adjudicated because
none was needed — all six type cleanly:

- the gate double now declares `service: GovernanceWarningService` (the
  production port interface — the double faking a seam compiles against
  the seam; port drift reddens the FILE, not a lint rule), outcomes
  typed `GovernanceStartOutcome`;
- `root: TeamProductionRoot` (the real return type of the production
  root factory);
- the stub glue gets a NARROW LOCAL STRUCTURAL TYPE (`StubGlue = {
  __t1: { bootCount, rootAgentStarts } }` — the exact shape the file
  reads) and enters the root as `as unknown as TeamAgentBindings` (the
  sanctioned partial-double cast — no `any`, no identity);
- `rejectionDetails: unknown` (used only through `JSON.stringify`).

The file now contains ZERO `eslint-disable` and ZERO `any`; full-tree
lint re-extracted at the new head: 128 occurrences, ZERO new identities
vs the 160-baseline — now honestly derived. Pre-existing mutes elsewhere
are baseline debt, untouched. Second disclosure folded in: the fix-1
round's "eslint clean on every touched file" claim had MISSED this file
entirely — a second reason the mutes were load-bearing.

## PR-body paragraph (the parent's plain-words demand)

> Fixing the unreadable-document path is what revealed that a whole
> entrance had never been gated: the boot gate had been positioned
> BEFORE `bindFresh` — a position structurally unable to read the
> governance documents it was judging, because those documents resolve
> through the durable row `bindFresh` itself mints. With the
> unreadable-document fix correct, 18 boot worlds failed fail-closed
> with `authority-document-unreadable`; before the review round those
> same worlds had been silently OPENING the gate — the pre-round boot
> path was not a weak gate, it was a no-op. The ordering law is now
> pinned: the start gate runs POST-fresh-root-commit, PRE-agent-start,
> at every entrance; a refused create leaves the atomic chokepoint
> commit (row + snapshot + team-root binding) as a durable NOT-LIVE team
> with zero agent effect, and every re-entry (boot resume,
> `team.ensureRootLive`, handoff replay) re-runs the SAME gate and
> re-refuses. The full-suite closure gate caught this; the round tests
> did not.

## Disclosures (this round)

- Boot-path ruling: gate + disclose (the reviewer permitted either); `boot.create`
  and `boot.resume` run the SAME closure as the wire entrances; the refused-boot
  law (post-follow-up) is pinned in W3/W4: typed refusal, `bootCount === 0`, zero
  agent effect on a durable NOT-LIVE team (full chokepoint commit, re-gated).
- `handoff/service.ts` extension (its `createOnly` catch passes the three
  governance refusal reasons through untouched) — handoff was not in PR6's
  original Files list; disclosed as a fix-round edit.
- p4t6: three review-round specs joined `SCANNED_PATHS_A4PR6`; the PR6
  own-advancing-total tie moved with them (sanctioned form).
- One message-only amend: the fix-4 tip commit's MESSAGE was garbled by a
  shell-quoting slip seconds after creation (backtick command substitution);
  the tip was message-amended to repair it — tree identical, no pushed or
  reviewed history rewritten. Noted again here for the record.
- Observation law honored: exactly ONE gate consultation per start operation
  (runGate mints a durable observation per non-consistent pass; W2 pins the
  single consultation on the open world).
