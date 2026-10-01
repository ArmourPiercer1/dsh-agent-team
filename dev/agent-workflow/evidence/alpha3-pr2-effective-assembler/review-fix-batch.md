# Review fix batch — the coverage-completeness BLOCK (+ two hygiene items)

Externally found (PR #58 delta review @ `0bb4da3a8aab7852e393b93c6395d5f0e7d34147`).
One P1 BLOCK confirmed, two non-blocking items included because each was a few
lines. Forward-only: this is a NEW commit on the branch, not a rewrite.

## STEP 1 — the confirmed defect, on facts before any fix

`validateOverlayViews` validated every view (index is an index, in range, not
repeated, lane equals the durable effect) but never asked the opposite question:
**does every snapshot rule have a view?** Overlay lanes are built exclusively
from the supplied views, so a short view list is a truncated reading of a durable
FULL snapshot — the omitted rows silently stop applying. It fails in the unsafe
direction: dropping a `deny` row makes a lower layer answer `allow` while the
decision still reports the overlay as the authority it read.

Reproduced through the PUBLIC API on the committed blob, before touching
anything (`review-red-raw.txt`; module reverted to `0bb4da3a` via
`git stash push -- <module>` so the run is honest):

| Probe (all PR1-LEGAL snapshots) | Behaviour at `0bb4da3a` |
| --- | --- |
| snapshot `[write, fskey:/workspace/a.txt, deny]`, `views = []`, Template allows the same key | `RETURNED decision=allow win=template` — the durable deny vanished |
| snapshot `[write, a.txt, allow]` + `[write, a.txt#row-2, deny]`, only the `allow` view supplied | `RETURNED decision=allow source=rule win=overlay overlayRuleCount=1` |
| same 2-rule snapshot, both views supplied (control) | `decision=deny win=overlay` (correct) |

On the coordinator's fixture correction: PR1's `parseState` rejects a repeated
`(operation, resource)` **pair** —
`packages/storage/schema/permission-overlay.ts:404-412`,
`const pair = \`${operation}\u0000${resource}\`` with
`problem: 'duplicate-rule-pair'` — so an identical-key allow+deny snapshot is
indeed unconstructible and was NOT used as a regression. Both probes above use
distinct carrier resources (which is exactly the legal shape PR1 permits, and
the reason the view layer exists at all: the caller's canonicalization may map
several carrier rows onto one canonical rule). The empty-views probe needs no
such construction at all and is the one that matters.

Verdict: **CONFIRMED**, not refuted. No invariant elsewhere makes a partial view
list impossible — `EffectivePermissionOverlayLayer.rules` is caller-supplied by
contract (it is the caller's canonicalization of PR3 carrier text), and nothing
cross-checked its cardinality against `snapshot.state.rules`.

## STEP 2 — the fix

One coverage assertion at the end of `validateOverlayViews`
(`permission-assembler.ts`), typed like every other refusal:

```
EFFECTIVE_PERMISSION_OVERLAY_RULE_REFERENCE_INVALID / 'overlay-rule-view-incomplete'
details: { snapshotId, generation, snapshotRuleCount, viewCount, missingRuleIndexes: number[] }
```

* `views.length === snapshot.state.rules.length`, checked AFTER the per-view
  checks. Because out-of-range and duplicate indices already throw, an
  equal-length list of unique in-range indices is a **bijection** onto the
  durable rows: "exactly the snapshot's rule rows, no more, no less".
* **The `0` views for `0` rules exception:** the assertion is exact, not
  "non-empty". A snapshot that legitimately carries no rules is still read in
  full by no views, and the layer stays present with its authority for the audit
  trail (pinned by its own leg).
* `missingRuleIndexes` names the omitted rows, so a caller repairs the view
  without diffing the snapshot by hand.
* No new authority hook, no API widening, no new import, no wiring.

The refusal is also load-bearing in the shipped artifacts, not just in source:
`shipped-dist-review-fix-raw.txt` runs the rebuilt committed `dist` module —
`views=[]` → `overlay-rule-view-incomplete missing=[0]`, full view →
`decision=deny win=overlay`.

## The two non-blocking items in the same commit

1. **Order-normalization false conflict** (confirmed at the source, same module):
   the same-generation idempotency check compared `JSON.stringify(existing.views)`
   with `JSON.stringify(views)` — the raw arrays — while the lane contents are
   normalized to the snapshot's declaration order later, before the matcher. So
   the SAME canonical mapping handed over in reverse order looked like two
   irreconcilable interpretations of one authority (`overlay-authority-view-mismatch`).
   Fixed by comparing a canonical key (`canonicalViewKey`, sorted by the unique
   `ruleIndex`) — content-sensitive, order-insensitive. Two legs: reverse order ⇒
   no conflict and a byte-identical policy; a genuinely remapped row ⇒ still the
   same typed conflict as before.
2. **Frozen exported vocabulary**: `as const` is a type-level promise only, and
   `EFFECTIVE_PERMISSION_LAYERS` / `EFFECTIVE_PERMISSION_LOOKUP_ORDER` ARE the
   ADR §4 order — one consumer calling `.sort()`/`.reverse()` on them would have
   silently inverted the precedence for every other caller in the process, with
   no error anywhere. `Object.freeze` on the three exported arrays plus the
   error-code table; one leg asserts frozenness and that the values are unchanged
   after a attempted in-place `sort()`.

Not touched, by instruction: the lowest-declared-default reading stays as-is
(no ADR conflict; documented in the module header).

## Evidence

| File | What it is |
| --- | --- |
| `review-red-raw.txt` | the 4 new legs failing against the module at `0bb4da3a` (`Tests 4 failed | 61 passed (65)`), captured with the fix stashed |
| `review-green-raw.txt` | the same set green (`Tests 75 passed (75)`, incl. the P4-T6 scanner) |
| `mutation-probes-review-fix-raw.txt` | M8 coverage assertion removed → 2 legs; M9 raw-array view comparison back → 1 leg; M10 vocabulary unfrozen → 1 leg; control restored → green |
| `shipped-dist-review-fix-raw.txt` | the rebuilt committed `dist` module, same three observations |

Mutation probes matter here specifically: a coverage check can be satisfied by a
wrong comparison (e.g. comparing `views.length` to the *view's* own max index),
so each fix was re-broken to confirm its legs are the ones that fail.
