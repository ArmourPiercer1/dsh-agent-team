# Corrections — both directions

**Date:** 2026-11-21. **Scope:** `dev/agent-workflow/evidence/ute3-review-20261121/`.
This file exists because an honest review record has to correct the reviewer as well as
the author. Sources: [`REVIEW.md`](./REVIEW.md) (round 1),
[`VERIFICATION-2.md`](./VERIFICATION-2.md) §3 (the reviewer's own corrections to round
1), and [`REMEDIATION.md`](./REMEDIATION.md).

## Corrections to our remediation record

1. **B8 — “nonexistent control” was wrong; the finding is withdrawn.**
   The round-1 review said the cited FS `unconfined-fs` mutation “does not exist
   anywhere”. It does:
   `tests/ute-g1-fs/product-route-image.test.mjs:268`
   (`test('MUTATION unconfined-fs: …')`), it is collected by the census CI argv
   (`.github/workflows/census-runtime.yml:434`), and it does exactly what the release
   request originally said — “lane denial → 70-byte allow”
   (`UTE3-ROUTE-C-MUTATION unconfined-fs confined=deny/0B mutant=allow/70B`).
   The original citation was accurate. The replacement with `NC-MEMBER read_image` /
   `widen-read-lane-image` is also accurate but was unnecessary. `REMEDIATION.md`'s B8
   row now records the finding as **reviewer error, withdrawn**, and the release request
   keeps the accurate `unconfined-fs` citation.
2. **B4/F5 — the 87-file set was not the whole surface.** Round 1 accepted the 87 body
   files; round 2 correctly found the shared generated barrel/manifest/declaration
   (`packages/tools/families/{index.mjs,manifest.json,index.d.mts}`) omitted. §6.1 of the
   release request now states **87 + 3 = 90** and why deleting only the 87 breaks the
   import graph.
3. **Absolute-path cleanup was partial.** The first fix's verification grep listed only
   the ledger-cited new-path files and therefore missed
   `ute3-search-b1-20261120/{README.md,lane-suite.txt}` and
   `ute3-search-b2-20261120/lane-suite.txt`. All three are now redacted, together with
   the rest of the UTE-G1 evidence set — see [`HOST-PATH-AUDIT.md`](./HOST-PATH-AUDIT.md).

## Corrections the reviewer made to its own round-1 review

1. **`contradicts` count: 7, not 68.** `REVIEW.md` said “all 68 `contradicts` strings are
   absent”. The ledger has **7** `contradicts` entries at both
   `2b69193fac66f5b89fb2010ca398de3f5b2ecdb5` and `c25cb576fbb8524f53d718082b4e3f2c9ecd44cc`,
   and all 7 are absent. The 237 `expect` count in that review was correct.
2. **ui/agent-state names served: 6 of 7, not 5.** `REVIEW.md` wrote “5 of 7 names
   served”. The composition probe's `PROBE-DISPOSITION` lines show `present` plus **all
   five** agent-state names served on the shipped preset (6 of 7);
   `ask_user_question` is the exception (PD-25). The remediation's “6 of 7” was correct;
   the review undercounted by one.

Both corrections are recorded here rather than by editing the reviewers' files:
`REVIEW.md` and `VERIFICATION-2.md` stay verbatim as the record of what each round
actually claimed.
