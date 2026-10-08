import io, sys

p = 'SCENARIOS.md'
s = io.open(p, encoding='utf-8').read()
R = []
add = R.append

# --- row 1 ---------------------------------------------------------------------------------------
add(("a retired version is migration-required` — the state is derived",
     "a retired version is migration-required exactly when the domain set says so` — the state is derived"))
# --- row 4 ---------------------------------------------------------------------------------------
add(("grantCeiling never exceeds either binding document (meet over both)",
     "grantCeiling never exceeds either binding document (meet over the approval plane only)"))
# --- row 5 ---------------------------------------------------------------------------------------
add(("A2c7 G13/A3 — the PURE resolver", "A2C-7 G13/A3 — the PURE resolver"))
add(("containsOperation=true matches; false never matches; rootKey…`",
     "containsOperation=true matches; false never matches; rootKey is NEVER consulted`"))
# --- row 6: G10 (title has inner backticks -> double-backtick span, full title) -------------------
add(("`packages/runtime/test/a2c7-subtree-matcher.test.ts > A2C-7 G5-G10 — the REAL pinned backend (the authority is the real `FileSystem.contains()`) > G10 junction retarget — the H4 fresh-decision proof: one install, the a…`",
     "``packages/runtime/test/a2c7-subtree-matcher.test.ts > A2C-7 G5-G10 — the REAL pinned backend (the authority is the real `FileSystem.contains()`) > G10 junction retarget — the H4 fresh-decision proof: one install, the authority FOLLOWS the new target on the next decision (no install-time freeze)``"))
# --- row 8 ---------------------------------------------------------------------------------------
add(("- `… > closes the escalating leg with a deny carrying reason `escalated`` and",
     "- `packages/runtime/test/a4p3-approval-escalation.test.ts > an escalation closes the current leg and raises the next one (A5-5, A1-10) > closes the escalating leg with a deny carrying reason `escalated`` and"))
# --- row 9: disambiguate the a4-surface citation --------------------------------------------------
add(("(spec 11.6; plan 6.D:651; the PR #11…` (11 legs)",
     "(spec 11.6; plan 6.D:651; the PR #118 recorded-half gets its rendered half) > THE TELLING: after the escalate terminates the case, intervention.list carries the case as a TERMINAL authority-unavailable item — informational, zero legal actions, nothing held, no-resolver named` (11 legs in the group)"))
# --- row 12 --------------------------------------------------------------------------------------
add(("S1: revoke revealing a STATIC allow refuses under an empty envelope, with ZERO`",
     "S1: revoke revealing a STATIC allow refuses under an empty envelope, with ZERO write`"))
# --- row 13 --------------------------------------------------------------------------------------
add(("unavailability beats undetermined beats insufficient, across the whole batch",
     "unavailable beats undetermined beats insufficient, across the whole batch"))
# --- row 14: preflight / single-shot / a1-14 / GROUP E --------------------------------------------
add(("> B1: a capability unavailable at preflight writes NO` (case), `> B4: with the capability available an `ask` still op…`, `> B5: a faulting external facts probe fails closed th…`, `> B7: the preflight is ADDITIVE — the last-mile ext…`.",
     "> B1: a capability unavailable at preflight writes NO control request and answers in the capability family`, ``> B4: with the capability available an `ask` still opens the durable approval case (permission is not swallowed)``, ``> B5: a faulting external facts probe fails closed through the capability family with zero rows``, `> B7: the preflight is ADDITIVE — the last-mile external recheck is retained (two probes per allowed call)`."))
add(("> C1: authority drift after the allow — no execution, n…`, `> C2: the capability vanishing after the allow is executi…` (last-mile), `> C3: the exact invocation consumes the allow exactly onc…`, `> C4: a failed tool body does not refund the allow — th…` (no reuse), `> C5: every terminal state the adapter reports is a membe…`, `> C6: the recheck comparison — equal is covered, a rise…`.",
     "> C1: authority drift after the allow — no execution, no consumption, no rewritten verdict`, `> C2: the capability vanishing after the allow is execution-unavailable, not a permission loss` (last-mile), `> C3: the exact invocation consumes the allow exactly once, and a replay is refused`, `> C4: a failed tool body does not refund the allow — the retry needs its own approval` (no reuse), `> C5: every terminal state the adapter reports is a member of the frozen vocabulary`, `> C6: the recheck comparison — equal is covered, a rise is stale, unknown is not confirmed`."))
add(("> A1: an authority rise after the allow refuses` and `> A2: an undetermined fresh ceiling refuses and`, `> A3: the persisted authority point is the auth…` (the persisted exact scope, not \"same toolName\"), `> A5/A6: a re-confirmed allow runs the recheck …`.",
     "> A1: an authority rise after the allow refuses with ZERO consumption, and the unspent allow still authorizes once`, `> A2: an undetermined fresh ceiling refuses and consumes nothing`, `> A3: the persisted authority point is the authorized point` (the persisted exact scope, not \"same toolName\"), `> A4: an operation case with no authority point is refused at the write AND un consumable from disk`, `> A5/A6: a re-confirmed allow runs the recheck once and consumes exactly once`."))
add(("`… > A4-PR7 7.0 P group — the production revalidation port over documents > P1: fresh documents that no longer narrow the poin…`, `> P2: a narrowing that moved UP the ladder strands t…`, `> P3: no v3 documents is `undetermined`, never \"\"co…`, `> P4: a reader that throws refuses by name; no fault…`, `> P5: the port asks the durable row's question and r…`.",
     "``packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts > A4-PR7 7.0 P group — the production revalidation port over documents > P1: fresh documents that no longer narrow the point permit the consumption``, `> P2: a narrowing that moved UP the ladder strands the allow, and costs nothing`, ``> P3: no v3 documents is `undetermined`, never \"covered\"``, `> P4: a reader that throws refuses by name; no fault escapes as a generic failure`, `> P5: the port asks the durable row's question and refuses unanswerable ones`."))
add(("Wired-in reality: `packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts > GROUP E - why a shell narrowing was invisible to the ASK: three laws, one gap (RULING 4; closed at the ASK by GROUP F, at consumption by the a1-14 S group)` legs name the consumption-point closure,",
     "Wired-in reality: `packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts > GROUP E - why a shell narrowing was invisible to the ASK: three laws, one gap (RULING 4; closed at the ASK by GROUP F, at consumption by the a1-14 S group) > a fingerprint rule against an exact target is a DECISIVE non-coverage, never undetermined` names the gap the §7.0 re-check closes,"))
# --- row 15 --------------------------------------------------------------------------------------
add(("> the SAME mutation at a moved base is a FRESH ask (A1-9 …)`",
     "> the SAME mutation at a moved base is a FRESH ask (A1-9 recovery); the allowed-at-old-base case never commits`"))
add(("> lifecycle drift: an archived target answers mutation-stale (never a…)`",
     "> lifecycle drift: an archived target answers mutation-stale (never a lifecycle throw, never a commit)`"))
add(("- Ceiling drift (the fifth arm §21.6 implies): `… > drift after approval -> mutation-stale with ZERO writes > the ceiling NARROWS after approval (required now above approved) ->…`.",
     "- Ceiling drift (the fifth arm §21.6 implies): `packages/runtime/test/a4p5-permission-mutation-inline-commit.test.ts > drift after approval -> mutation-stale with ZERO writes > the ceiling NARROWS after approval (required now above approved) -> stale`."))
# --- row 16 --------------------------------------------------------------------------------------
add(("folds count/time, never a` — the dedup clause",
     "folds count/time, never a second warning` — the dedup clause"))
add(("- `… > 6.A acknowledgement plane > acknowledging binds the fingerprint",
     "- `packages/runtime/test/a4p6-governance-warning-service.test.ts > 6.A acknowledgement plane > acknowledging binds the fingerprint"))
add(("no approval-case entry (the lane sp…)`",
     "no approval-case entry (the lane split)`"))
add(("- Fail-closed arms: `> 6.A fail-closed arms + bridge window > corrupt authority document: blocked, NOT acknowledgeable`",
     "- Fail-closed arms: `packages/runtime/test/a4p6-governance-warning-service.test.ts > 6.A fail-closed arms + bridge window > corrupt authority document: blocked, NOT acknowledgeable`"))
# --- row 19 --------------------------------------------------------------------------------------
add(("no source outside intervention/** imports the intervention …`",
     "no source outside intervention/** imports the intervention lane`"))

bad = []
for old, new in R:
    n = s.count(old)
    if n != 1:
        bad.append((n, old[:80]))
        continue
    s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('applied %d of %d' % (len(R) - len(bad), len(R)))
for n, o in bad:
    print('  NOT-UNIQUE(%d): %s' % (n, o))
