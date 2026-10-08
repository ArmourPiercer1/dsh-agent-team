| file | reddened legs | refused on MY law | refused on the classification's own law |
| --- | --- | --- | --- |
| `packages/runtime/test/a3p3-permission-mutation-authority.test.ts` | 13 | 13 | 0 |
| `packages/runtime/test/a3p3-revoke-reveal-semantics.test.ts` | 12 | 9 | 3 |
| `packages/runtime/test/a3p4-permission-lifecycle-e2e.test.ts` | 16 | 16 | 0 |
| `packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts` | 2 | 2 | 0 |
| `packages/runtime/test/a3p4-pr7-entry-exec-contract-regression.test.ts` | 11 | 11 | 0 |

TOTAL legs: 54  (attribution total 51 on my law)


<details><summary><code>packages/runtime/test/a3p3-permission-mutation-authority.test.ts</code> — 13 legs</summary>

| leg (:line) | drives in body | attribution |
| --- | --- | --- |
| a stale expectedGeneration is a typed conflict with NO partial write (:L564) | 3 | mine |
| creates NO permanent priority: the Leader recovers by tightening without any env… (:L521) | 3 | mine |
| may exceed the Leader envelope and records Human provenance (:L502) | 1 | mine |
| a MALFORMED envelope refuses a change-mutation that rises NOTHING (parse precede… (:L469) | 2 | mine |
| a maxEffect ceiling is a CEILING: ask covers deny->ask but never ask->allow (:L387) | 2 | mine |
| exact envelope rules do not cover wider matchers; subtree roots cover what they … (:L411) | 3 | mine |
| TIGHTENINGS need NO expansion authority: all three, with an EMPTY envelope (:L317) | 4 | mine |
| a from-absence GRANT is an expansion measured from the DECLARED-NONE deny fallba… (:L294) | 2 | mine |
| an ask->allow expansion covered by maximumEffect=allow commits a new snapshot (:L258) | 2 | mine |
| a nested-subtree grant is covered only by a subtree envelope root the containmen… (:L843) | 1 | mine |
| an exec expansion is covered ONLY by the identical fingerprint (no subtree, no a… (:L732) | 3 | mine |
| every state-changing mutation appends exactly ONE FULL snapshot; the no-op write… (:L608) | 3 | mine |
| revoke_permission produces the unified snapshot WITHOUT the addressed pairs and … (:L657) | 2 | mine |

</details>

<details><summary><code>packages/runtime/test/a3p3-revoke-reveal-semantics.test.ts</code> — 12 legs</summary>

| leg (:line) | drives in body | attribution |
| --- | --- | --- |
| (f) nested exception: a non-rising child region cannot rescue the rising residua… (:L655) | 2 | mine |
| S6: subtree-deny removal revealing a STATIC allow under its root is refused at e… (:L537) | 6 | mine |
| S6d: fallback-ASK region (no rule below, declared ask fallback): subtree-deny re… (:L596) | 6 | mine |
| S1b: the same revoke passes ONLY with allow-ceiling coverage of the WHOLE matche… (:L270) | 3 | mine |
| S3: deny->ASK reveal is expansion VERBATIM (ADR §6): refused without ceiling, ac… (:L283) | 6 | mine |
| B1 (BUG2): exact ask under an overlay-matching subtree allow is a TIGHTENING — a… (:L444) | 3 | mine |
| S7b: the same revoke with envelope coverage of the removed matcher (ceiling allo… (:L424) | 5 | mine |
| X1 CANONICAL (parent fixture): subtree(R)=allow + exact(R/file)=deny; DECLARED-N… (:L755) | 5 | classification |
| X1p: the SAME revoke WITH the predicate is the decidable deny->allow reveal — EX… (:L779) | 5 | mine |
| X2 EQUAL-SUBTREE REWRITE (parent addition): subtree(R)=deny updated to ask with … (:L801) | 3 | classification |
| X3 STATIC subtree allow exposed by revoking the overlay subtree deny, NO predica… (:L845) | 3 | classification |
| X4 GATE SPECIFICITY: EXACT-ONLY context with NO predicate flows NORMALLY — decid… (:L889) | 4 | mine |

</details>

<details><summary><code>packages/runtime/test/a3p4-permission-lifecycle-e2e.test.ts</code> — 16 legs</summary>

| leg (:line) | drives in body | attribution |
| --- | --- | --- |
| grant_instance appends generation 1 through the ONE authority and `latest` reads… (:L373) | 0 | mine |
| the effective answer is `allow` from the overlay layer, and a different key is u… (:L402) | 0 | mine |
| the overlay layer overrides a static DENY of the same pair (layer precedence, ne… (:L442) | 0 | mine |
| a subtree grant answers for a DESCENDANT key through the per-decision verdict (:L477) | 0 | mine |
| an UNJUDGED subtree rule keeps the frozen lane asymmetry (a deny is never droppe… (:L602) | 0 | mine |
| the SAME Leader mutation commits once the lane supplies the containment predicat… (:L539) | 0 | mine |
| an exec grant answers its OWN fingerprint and no other (design §6 isolation) (:L629) | 0 | mine |
| renewing the same desired state is a NO-OP (no snapshot, no generation bump) (:L725) | 0 | mine |
| revoke appends generation 2, leaves generation 1 byte-identical, and the decisio… (:L674) | 0 | mine |
| a MemberInstance created AFTER the grants has zero permissions (:L952) | 0 | mine |
| no static facts from the decision site = UNKNOWN, typed, no decision (:L1054) | 0 | mine |
| ARCHIVED: execution is refused, the overlay stays the retained authority (:L740) | 0 | mine |
| DISPOSED: execution is refused, and a mutation against a terminal instance is re… (:L770) | 0 | mine |
| a GENUINE rule change at restore time is one ordinary mutation through the autho… (:L889) | 0 | mine |
| restore performs NO permission write even when a grant was already standing (the… (:L924) | 0 | mine |
| revoked during ARCHIVE stays revoked after restore (no replay, no resurrection) (:L830) | 0 | mine |

</details>

<details><summary><code>packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts</code> — 2 legs</summary>

| leg (:line) | drives in body | attribution |
| --- | --- | --- |
| a LEADER exact grant inside the injected envelope COMMITS at the assembled root … (:L364) | 1 | mine |
| R5-tool — the REAL team_grant_permission/team_revoke_permission surface: grant c… (:L1711) | 0 | mine |

</details>

<details><summary><code>packages/runtime/test/a3p4-pr7-entry-exec-contract-regression.test.ts</code> — 11 legs</summary>

| leg (:line) | drives in body | attribution |
| --- | --- | --- |
| a tool call addressed to Team B canonicalizes at B’s durable default workspace —… (:L883) | 0 | mine |
| exec intent → server canonicalization → durable exact-fingerprint row → pre-exec… (:L499) | 0 | mine |
| file class through the real tool: grant → REAL pre-execute ALLOW on write; revok… (:L605) | 0 | mine |
| tool: ghost → INSTANCE_UNKNOWN rejected zero-write; DISPOSED → TARGET_TERMINAL; … (:L825) | 0 | mine |
| file class through the real router → pre-execute ALLOW; absent/revoke → DENY (:L703) | 0 | mine |
| operator exec-intent grant through the real router → pre-execute ALLOW; router r… (:L656) | 0 | mine |
| reason is REQUIRED at the wire (item 4): absent → typed malformed on field reaso… (:L786) | 0 | mine |
| replay: a rule-set-equal re-grant no-ops (changed:false); the SAME mutationId wi… (:L961) | 0 | mine |
| Leader claim → NOT the §7 exemption: the row records leader provenance, and expa… (:L1065) | 0 | mine |
| RPC-position symmetry of the ARCHIVED law: human claim over an ARCHIVED target c… (:L1198) | 0 | mine |
| legitimate Human claim → legal mutation; the durable row records the human prove… (:L1023) | 0 | mine |

</details>

### legs whose OWN drive (a single mutation in the body) is the refused one

- a3p3-permission-mutation-authority.test.ts:L502 may exceed the Leader envelope and records Human provenance
- a3p3-permission-mutation-authority.test.ts:L843 a nested-subtree grant is covered only by a subtree envelope
- a3p4-pr4-production-entry-regression.test.ts:L364 a LEADER exact grant inside the injected envelope COMMITS at

count: 3
