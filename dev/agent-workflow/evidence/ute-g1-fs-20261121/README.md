# UTE G1 FS — PR B2 new-path evidence (2026-11-21)

Base: `origin/master 6a5d45d30` (route-C repair #802 and refusal protocol #800 included).
Host under test: pinned `tests/deepseek-harness-next` 0.2.2-rc.5 @
`9c2670d3bce5275e0d1610272958121af87787bb`.

| file | producer | verdict |
| --- | --- | --- |
| `new-path-run.txt` | `node tests/ute-g1-fs/run-prototype.mjs` | `PROTOTYPE-VERDICT GREEN vectors=16 failed=0` — every corpus vector prints `NEW-PATH-VECTOR <id> PASS` |
| `negative-controls.txt` | `node tests/ute-g1-fs/negative-controls.mjs` | `NC-VERDICT GREEN controls=13 failed=0` (adds `NC-IMAGE-OBSERVER`) |
| `lane-suite.txt` | `node --test tests/ute-g1-fs/lane-suite.test.mjs` | 4/4 tests, completeness assertion, `newPathPending` presence is a failure |
| `retirement-gate.txt` | `node scripts/ute-retirement-gate.mjs --all` | exit 1, ONLY `UTE_SEMANTIC_DIFFERENCES_UNRESOLVED`, `unit=4/4`, `state=NOT_RETIREABLE` |

`new-path-run.txt` and `negative-controls.txt` are the evidence paths named by
`dev/agent-workflow/ledgers/ute-retirement.json`. The ledger's
`semanticDifferencesResolved` term and the family `state` are unchanged.

The `read_image` effect cell is `@result:<mediaType>:<w>x<h>|present|<bytes>|<sha256>|blocks=<shape>`,
where the digest is over the bytes the REAL `LocalAttachmentStore` received,
not the tool's reported metadata and not the path. A refusal records
`@result:none|absent|-|-|-`.

`node scripts/check-append-only-log.mjs` is not present on this base (PR #805 is
still open). The identical script from the `guard-append-log-20261120` worktree
was run against this branch and reported `verdict=pass ... appended 14 line(s)`:
this PR appends the B2 execution-log entry and changes no historical bytes.
