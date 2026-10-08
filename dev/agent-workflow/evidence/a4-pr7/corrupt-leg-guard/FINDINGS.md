# A4 corrupt control leg — FINDINGS

**Verdict: CONFIRMED, fixed, and handed back unmerged on `fix-a4-corrupt-leg-guard` @ `70075deb`
(base `606a0be7`).** A control record that cannot be parsed used to *reduce* what the governance
guard could see, and the one verdict it produced — `no-request` — is the one verdict the tool plane
executes on. The headline is not "an unreadable approval": it is that **a durable, recorded human
DENY did not stop the call** (W2), and on the runtime facade below it the operation was then
admitted (W10). No privilege-escalation claim is made anywhere in this file; see §5 for why this is
not reachable through the API, and §3 for exactly which plane each number was measured on.

---

## 1. The indictment, verbatim from base

`dev/agent-workflow/evidence/a4-pr7/corrupt-leg-guard/RED-base-transcript.log` (base `606a0be7`,
7 RED / 4 GREEN, verdicts read only through the real `consultGuard()` in
`packages/tools/src/guard.ts` over a real durable `P6T4` ledger and a real `ControlService`):

```
 FAIL  packages/tools/test/a4-corrupt-leg-guard.test.ts > … > W2: a durable DENY survives the
        corruption of the leg it refuses (zero side effects)
AssertionError: expected { proceed: true } to deeply equal { proceed: false, …(2) }

- Expected
+ Received

  {
-   "proceed": false,
-   "reason": "authority-scope-unbound",
-   "requestId": "req-a4cl-w2",
+   "proceed": true,
  }
```

Same shape for W1 (no decision at all), W3 (a durable ALLOW over an unreadable point — executed,
and *not* burned), W4/W4b (damage in a non-authority member: the hole is the **corrupt-leg class**,
not `authorityScope`), W5 (the producer answers `no-request`: `expected 'no-request' not to be
'no-request'`), and W10 (below).

W10 drove the **runtime facade** — a registered guarded work tool (`team_follow_up`) over the real
P6-T2 `TeamRuntime`, with a spy counting whether the facade was reached:

```
 FAIL  … > W10: the TOOL-plane claim, named — a corrupt leg plus a durable DENY never reaches the facade
AssertionError: facade said: {"status":"executed","action":"follow-up","rootSessionId":"session-root-p6t1",
"callerRole":"leader","targetInstanceId":"inst-p6t2seedw01","effect":{"kind":"work-admitted",
"instanceId":"inst-p6t2seedw01","fromLifecycle":"RUNNING","lifecycleCommitted":false,"sequence":3},
"requestToken":"tok-a4cl-w10"}: expected 'executed' to be 'blocked'
```

So the deeper plane did **not** catch it either — in that harness, for that call. What the facade
still enforced (and what this does **not** dispute) is its own envelope/authority/admission checking:
the caller here was the Leader, whose envelope permits `follow-up`. What was overridden is the
**control-plane refusal**, which is precisely the constraint Alpha.4 exists to make real. The
operation whose approval nobody could read was admitted as work, with zero consumption written.

At tip the same ledger yields `status: 'blocked'`, `reason: 'authority-scope-unbound'` /
`'authority-undetermined'`, `facadeReached: 0`, `consumptions: 0`.

## 2. The mechanism: one token, opposite polarity across a seam

`guardOperation` returns `{ allowed: false, reason: 'no-request' }` — a **refusal** — and
`packages/tools/src/guard.ts:80-82` maps `no-request` to `{ proceed: true }`. The runtime plane
refused; the tool plane translated that refusal into a green light. Neither side is wrong in
isolation (`no-request` is the documented leader-autonomy path, SD-GUARD's deviation), and that is
exactly why the inversion survived: nobody had written down which side owns the polarity.

The invariant this lane now pins (W5 at the producer, W6 at the seam, and a new doc comment on
`CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST`):

> **`no-request` must mean "there is nothing to guard", never "I could not read what guards this
> call."** A producer that cannot tell the two apart must not emit it.

Chain of causation, all at base: `parseRequestPayload` refuses the row (`control/service.ts:663-664`,
`:824-825`) → `loadControlState` files it in `ControlState.corruptLegs` when it names an
`approvalCaseId` (`:1331-1345`) → `guardOperation` consults `requests` / `decisions` /
`consumptions` / `abandonments` and **never** `corruptLegs` → zero matches → `no-request` → proceed.

## 3. Which plane each claim lives on (read this before quoting any number)

* `packages/tools/src/tools.ts:336-364 executeGuarded()` consults the guard **only** for an
  instance-shaped `targetInstanceId` (`INSTANCE_ID_PATTERN`) and, on proceed, does nothing but call
  the runtime facade. So: a **template/team-shaped target never reaches this guard at all** — by
  design, and stated as such by the A1-14 work ("team + target resolution (INSTANCE subjects ONLY …
  NEVER killed by the instance stale validator)"). That is a *different reason for the same
  observable outcome* and must not be conflated with the corrupt-record path.
* W1–W9 answer **"did the tool-plane guard stop this call?"** — complete and sufficient as stated.
* W10 adds the **facade** answer for one shape (`executed` / `work-admitted`), which is a claim
  about the P6-T2 durable-world `TeamRuntime`, not about a booted host with host policy, the
  pre-execute adapter and a model in front of it. A live-host end-to-end "the unauthorized operation
  completed" claim is **not** made and **not** established here.
* Different scope, different lane: `packages/runtime/operation-permission/pre-execute-adapter.ts:2004`
  passes `operationFingerprint` + `authorityScope` and blocks on `!verdict.allowed` — so in that lane
  `no-request` already denies. The tools lane sends **no** fingerprint, which is why W10 seeds a
  fingerprint-less, lane-shaped row and refuses it as `authority-undetermined`; a corrupt row that
  *does* carry a fingerprint is not that lane's gate under the scope-key law — and neither is a clean
  one (§8).

## 4. Vocabulary: two existing members, nothing minted (coordinator ruling)

Ruling, verbatim: *"**Vocabulary: reuse the two existing members. Do NOT mint
`governing-leg-corrupt`.** … Minting would also drag in the frozen-set pass, Remote/UI mapping and
vocabulary census churn for zero semantic gain, and your legs assert the constants anyway."*
`CONTROL_GUARD_BLOCK_REASONS` therefore stays at 13 members; the Remote/UI mapping and the vocabulary
census are untouched; every new leg asserts the constant, never the string.

| Cell | When it fires | Reason (existing member) | Pinned by |
| --- | --- | --- | --- |
| C1 | Operation-case leg (readable non-empty `operationFingerprint`, non-mutation `kind`) whose authority point **cannot be read** — key absent **or** present-and-refused by `parseAuthorityScopeField` | `authority-scope-unbound` | `a4-corrupt-leg-guard.test.ts` **W1**, **W2**, **W3**, **W4**; `a4p3-approval-case.test.ts` "refuses to authorize on a row the case read refuses… (A2-9)" (re-pinned, §7); readable-row sibling already pinned by `a4p7-a1-14-consumption-revalidation.test.ts` leg **A4** |
| C2 | Leg damaged **elsewhere** with a readable point; or `kind` unreadable; or `kind === 'envelope-mutation'`; or no readable fingerprint (not an operation case by the identity law) | `authority-undetermined` | `a4-corrupt-leg-guard.test.ts` **W4b**, **W10** |
| C3 | Both corrupt classes at the producer: the verdict is never `no-request` | (negation of `no-request`) | **W5** |
| C4 | No control rows at all — the legitimate path, behaviourally identical | `no-request` ⇒ proceed | **W6**, **W8**, `p6t6-guard.test.ts` (a), `a4a-control-exact-scope.test.ts` |

Why neither name is a stretch, in the vocabulary's own words (`packages/runtime/control/types.ts`):

* `authority-scope-unbound` — *"the durable row is an operation case that carries NO authority point …
  This is the CORRUPT row of A2-9's rule, caught at the one place where being wrong means executing:
  `packages/tools/guard.ts` blocks on every reason but `no-request`, so naming this (rather than
  dropping the row to `no-request`) is what keeps a corrupt authority row from executing."* The
  corrupt leg is the case that sentence was written for, and it never reached it.
* `authority-undetermined` — *"'Could not confirm' is not 'confirmed' — and an unreadable document is
  never an empty one (ADR A5-16)."*

*One correction for the record:* the review message attributed the first sentence to
`AUTHORITY_UNDETERMINED` at `types.ts:1294`. It is in `AUTHORITY_SCOPE_UNBOUND`'s doc block
(`types.ts:1296-1304`); `AUTHORITY_UNDETERMINED` sits at `:1290-1296` and carries the
unreadable-document law. The mapping is unchanged; the attribution now matches the file.

## 5. Exposure: fail-closed-on-damage, not an agent-smuggled request

The malformed row is **not producible through the production request path**, and that absence is
machine-supported rather than merely grepped:

1. `packages/runtime/control/service.ts` is the only writer of `control-request-recorded`
   (`FACT_REQUEST`, `putEntry`), and the request boundary validates the authority point before
   writing (`service.ts:1798-1806`).
2. `packages/runtime/test/a4pr0a-fact-type-closed-set.test.ts` *derives* every fact type production
   can write (resolving constants, tables and the durable-fact funnel) and **pins every dynamic write
   site it cannot resolve** in `PINNED_UNRESOLVED` (6 entries). Only one is a real dynamic append —
   `packages/storage/operations/journal.ts::row.intent.type` — and its sole producer
   (`packages/storage/provisioning/coordinator.ts resolveRequest`) hardcodes `PROVISION_INTENT_TYPE`
   = `provision-member-instance`, which is the very value that file's `C1b` residual names. No
   wire/tool/migration/import path appends a control row.
3. The fault-injection kit writers, projection source, ledger adapters and the remote surface are
   readers; the action-router funnel's callers all write literal/constant types.

So the reachable triggers are: storage damage, a hand-edited / migrated / externally imported ledger,
or a future reader–writer version skew. **Severity does not upgrade**, and the honest justification
for the fix is purely fail-closed-on-damage, as ruled: *a governance guard whose view of the
constraints shrinks when storage degrades is a guard whose guarantees are conditional on the storage
being well-formed.*

## 6. The fix, and what it deliberately does not touch

`packages/runtime/control/service.ts`: two pure module-level helpers (`corruptLegCouldGovern`,
`corruptLegVerdictOf`) plus one `corruptLeg` lookup after `loadControlState`, consulted at exactly
the three places where the guard would otherwise **proceed** — the `matching.length === 0` return,
the inline-allow `no-request` fallback, and immediately before the `control-allow-consumed` write.

* **Class-wide**, per the ruling that "the veto must be class-wide, every corrupt leg that could
  govern this call, whatever field broke" — the test never inspects `authorityScope` to decide
  *whether* to refuse, only *which* existing name to print.
* **Agreement over what can still be read**, member by member (`scopeKey`'s own member set): a member
  the row discloses that **disagrees** is evidence it governs a *different* call, and this one stays a
  legitimate `no-request`; a member the row does not disclose (absent where allowed, unreadable where
  not) is evidence about nothing, and the conservative reading of evidence-about-nothing is that the
  leg may still govern. There is no cheaper honest test, because the case identity of a leg whose
  members are damaged is exactly what cannot be recomputed. (`rootSessionId` is not one of the
  compared members because it cannot disagree: `corruptLegs` is produced by `loadControlState(root)`
  inside the per-team lock, so every candidate is already the same Team as the call.)
* **Refusals keep their reasons.** Every pre-existing block verdict is byte-identical; the veto can
  only replace a would-be proceed. At the consumption point it runs *after* the external hard recheck
  and after the A1-14 authority recheck, so those two names still win where they apply (disclosed
  ordering choice: on a ledger that is both externally denied and damaged, the operator sees
  `external-policy`).
* **Zero side effects**: a refusal writes nothing, so an allow that cannot be verified is *not*
  burned — the same zero-effect discipline as the two rechecks above it.
* **The reporting routes that already read `corruptLegs` are untouched** and still answer:
  `buildApprovalCaseState` names the typed problem (W9: `chain-broken`, `requestSequence > 0`) and
  `findApprovalCaseByIdentity` remains the only frozen fingerprint→case-id route. They cover
  *reporting*, never enforcement — which is why the guard route needed its own refusal, and why the
  coordinator's "is `corruptLegs` dead?" framing was wrong in both directions.

## 7. A2-9 acceptance assertion re-pinned (coordinator ruling, on the record here)

`packages/runtime/test/a4p3-approval-case.test.ts`, leg *"refuses to authorize on a row the case read
refuses, even with a durable allow (A2-9)"*. What it asserted at base `606a0be7`, verbatim:

```ts
    // The row is corrupt (no ordinal), the case names that corruption, and the
    // guard does not see the row at all: no allow, and — decisively — no
    // consumption fact, so nothing is burned on a row nobody can read.
    …
    expect(verdict.reason).toBe('no-request')
    expect(corrupt.consumptionsOfUnusable).toBe(0)
```

That is a **false green at the seam that mattered**: `no-request` is precisely what `consultGuard`
proceeds on, so the leg was asserting the defect — an unreadable governing leg plus a durable allow,
answered "nothing to guard" — while reading as a refusal. Ruling, verbatim: *"**The re-pin of
`a4p3-approval-case.test.ts:693` is approved**, and I checked the thing that would have made it
expensive: **no spec, plan or ADR text pins `no-request` for corrupt legs** — `grep -rn "no-request"
docs/plans/active/alpha4-permission-governance/*.md` returns **zero hits**, so no document moves and
no plan erratum is needed."* Independent confirmation of that grep: 0 hits in
`docs/plans/active/alpha4-permission-governance/` (this lane re-ran it).

Conditions met: constant asserted (not string); `allowed: false` kept; `consumptionsOfUnusable === 0`
kept; `expect(` count non-decreasing (84 → 86, +1 for the typed reason, +1 naming the damaged row);
the comment block carries the verbatim old text and why it was false. The leg's *stated law* is now
actually true, and the refusal additionally names the damaged row
(`requestId: 'req-raw-unusable-ordinal'`).

## 8. Disclosed boundaries — what still gets through, and why it stays

1. **A corrupt row that names no `approvalCaseId` never enters `corruptLegs`** (the state loader
   requires the id), so it still yields `no-request` ⇒ proceed. Pinned as **W8** and by
   `a4a-control-exact-scope.test.ts:1017-1021`. Deliberately out of scope: a row with no case
   identity is a pre-A4 legacy shape, and extending the veto to it changes a family of legacy
   fixtures with no case to report against. One line, if the stage ever wants it: relax the
   `approvalCaseId` gate in the corrupt-leg filing and W8 flips.
2. **A corrupt leg that carries an `operationFingerprint` is invisible to the tools lane** (which
   sends none) — but so is a *clean* one: that is `scopeKey`'s documented law, not corruption
   behaviour, and the lane that does send fingerprints (`pre-execute-adapter.ts:2004`) fails closed on
   any non-allowed verdict.
3. **The guard is conditional by shape** (§3): non-instance targets never consult it.
4. **Ordering at the consumption point**: `external-policy` and the A1-14 reasons outrank the new
   refusal (see §6).
5. **Load caveat on my first census**: the first nine-root run showed 2 merge-gate legs red because my
   own mutation experiments were mutating `control/service.ts` in the same worktree while that census
   ran. Self-inflicted, disclosed, and disproved by a solo merge-gate run at tip (29/29). Rule taken
   away: never share a worktree between a mutation sweep and a census.

## 9. Separate finding — two parse policies for one fact (client lane, backlog 14)

Measured by `dev/agent-workflow/evidence/a4-pr7/corrupt-leg-guard/client-view.instrument.test.ts`
(run with `npx vitest run --config dev/agent-workflow/evidence/a4-pr7/corrupt-leg-guard/evidence-runner.config.mts`; deliberately **outside**
`packages/**` so the client lane keeps file and census ownership — nothing under
`packages/client/**` was touched by this lane):

* `grep -rn authorityScope packages/client/src` → **zero hits**. `adaptControlRequestDraft` drops a
  row *only* when `requestId` / `actionName` are broken.
* So for the same ledger the operator's view keeps the approval: `controls.length === 1`, a defined
  `renderMode`, the correlation carried, and `pendingControlByInstance['inst-worker'] === 1` — i.e.
  **the UI invites a decision on a row the enforcement plane cannot read**. After an `allow` is
  recorded the chain still pairs and the pending count clears, while the guard plane writes zero
  consumptions: the approval is unspendable and nobody is told.
* The compound is therefore the *inverse* of the original hypothesis: not "the operator sees no
  approval while the guard also sees none", but **"the operator sees a normal, decidable approval
  while enforcement has dropped it."** Two independent parse policies for one fact, guaranteed to
  disagree.
* Additionally measured: the UI chain carries **no case identity at all** —
  `grep -rn approvalCaseId packages/client/src` is empty, so `approvalCaseId` is not representable in
  the view. The operator cannot even see which case they are deciding.

Reported, not fixed: no client behaviour was changed here, and nothing in the guard fix alters it.

## 10. Receipts

`FINAL-BATTERY.txt` (same directory) carries the instrument run: both-direction regressions, the
three-mutant counterfactual with reachability (`COUNTERFACTUAL.txt`), the nine-root identity census,
the derived p4t6 total with both endpoints measured, `expect(` base→tip counts, artifacts/blueprint/
lint/typecheck verdicts and the merge gate. Branch handed back **unmerged**.
