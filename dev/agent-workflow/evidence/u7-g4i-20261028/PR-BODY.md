## G4-I candidate/dependency packet (partial; no gate verdict)

Frozen inputSnapshotDigest: authority sha256:93692d7aeb3b097c3b3467e0a9207f1da5f05c2c1cb324c74d25168b1516a4d4; Team e6589ef5fbbc0dd599e629d5cf82b8f5579aecdd; Host 639ed015397290b3745d163aafe02ffee4aa3f84.

Owned changes: evidence/u7-g4i-20261028 only. No packages product edit, no upstream patch, no ledger edit, no new canonical authority writer.

Packet: CANDIDATE.md, DEPENDENCY-EQUIVALENCE.md, G4-CLOSURE-INDEX.md, exact conservative dependency lists/stats and source/dist pin inventory. All five available historical C2 receipt closures AFFECTED; G3 #421 absent from frozen candidate. Not a G4 verdict.

Live: four starts consumed; two discarded overlay attempts count against budget, clean unchanged ARC-A PASS 10/10 on frozen SHA, unchanged Jobs interrupted during late allocation change. AC-1/tbash/ARC-D remain unrebound. Missing runner-composed profile/config and trusted-source/world-oracle digests explicitly null/PARTIAL, not fabricated. Native sandbox ENV_BLOCK independently observed (bwrap user namespaces denied). No fifth start.

Tests: family boundaries/definitions/index, p4t6, ARC-D twin matrix, tool acceptance, run manifest PASS; ci-pr-gate PASS 7/0 (default census delegation disclosed); git diff --check. Evidence <=1MiB/file. Capacity: bounded small evidence files, no raw large logs committed. No product defect proved; no release/gate claim. Rollback: revert this evidence-only commit; runtime worlds use owned cleanup and test-use remains pristine.
