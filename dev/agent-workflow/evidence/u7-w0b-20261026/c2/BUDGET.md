# u7-w0b S6 — live C2 boot budget (cap ≤ 6 host boots)

Ledger (machine): `c2/boot-ledger.jsonl` — the runner appends one line per
`startHost()` BEFORE the spawn and refuses to start once it holds
`--max-host-starts` entries (passed as 6 on every invocation, so the cap is
enforced by the runner across all runs, not by this note).

Declared plan (one boot per suite, the suites' own design budgets):

| # | Suite | Runner | Planned boots |
| --- | --- | --- | --- |
| 1 | u6-arc-a | u5-canary-runner --suite u6-arc-a | 1 |
| 2 | u6-arc-d | u5-canary-runner --suite u6-arc-d | 1 |
| 3 | u7-fs-mut | u5-canary-runner --suite u7-fs-mut | 1 |
| 4 | u74a | u7-4a-jobs-suite.mjs (main run) | 1 |
| — | reserve | one re-run if an ENV failure needs it | 2 |

Host: pristine `tests/deepseek-harness-test-use` @ 639ed01539 (porcelain empty,
checked before and by the runner's assertHostBase). Ports: the #397 bands
(world hosts 3181–3199 then 13000–13049; mocks 3491–3500 then 13050–13099),
leased by the factory. :3080 and ~/.dsh untouched.

## Actuals (6 / 6 boots used — `boot-ledger.jsonl` has exactly 6 lines)

| Boot | Tree | Suite | Result |
| --- | --- | --- | --- |
| 1 | branch 150c0bcac | u6-arc-a | **PASS 10/10** |
| 2 | branch 150c0bcac | u6-arc-d | FAIL 11/12 — every case `team.create failed: status=401 body=null`; the host log shows the boot reached `remote mount: MOUNTED` but no plane placement / census line (the session never reached a team) |
| 3 | **master 21f3f5b08** (control, detached worktree, removed after) | u6-arc-d | FAIL 1/12 — `arcd:ci03-native-parity` only (11/12 PASS) |
| 4 | branch 150c0bcac (rerun) | u6-arc-d | FAIL 1/12 — `arcd:ci03-native-parity` only (11/12 PASS) — **same case, same evidence shape as master** |
| 5 | branch 150c0bcac | u7-fs-mut | **PASS 8/8** |
| 6 | branch 150c0bcac | u74a (u7-4a-jobs main run) | **PASS 12/12** |

Reserve use: boots 3 and 4 were the two reserve boots, spent to separate an
environment failure from a regression on boot 2 rather than re-running blind.

**u6-arc-d reading.** Boot 2's 401 at `/team-remote/team.create` happened after
a 200 discovery prompt, with the plane never placing; the same branch bytes
then reached all twelve cases on boot 4, and an offline mount of the exact
arc-d plane config on this tree succeeds. No product file differs between
boots 2 and 4. Recorded as an unexplained one-off transport-level 401 (not
re-diagnosed further — budget exhausted); it is NOT claimed as a pass.

The arc-d verdict that matters is boot 4 vs boot 3: **identical** — 11/12 PASS
with the single FAIL `arcd:ci03-native-parity` on both, same evidence fields
(`nativeEvidence.contentMatches:false`, `pairEvidence.pairDeny.present:false`,
`pairLift` present). That case fails on master at 21f3f5b08 as well, so it is
pre-existing on master and not introduced here (last recorded PASS of this
suite: u6-pr6 run arc-d1 at 2026-10-26T08:30Z). Flagged for the arc-d owner.

Result vs merged master: arc-a PASS, fs-mut PASS, u74a PASS, arc-d equal to
master (11/12, same failing case). Post-run: :3080 status 401 unchanged
(runner probes pre/post on every run), pristine host porcelain empty, no
leftover host processes, launch tokens redacted in the committed logs.
