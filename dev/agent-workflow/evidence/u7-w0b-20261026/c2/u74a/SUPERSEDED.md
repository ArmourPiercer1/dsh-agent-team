# u74a run 1 record — superseded by run 2 (PR #400 R1)

`u7w0b-u74a-1.u74a-run-record.json` (boot 6) was a finalized RUN (overall/cases/teamSha:
`PASS 12 150c0bcac3e0114efc3bf09d0f009326d3ba5bb5`) but its runner built `bindings` without `authority`, so the EB3 RUN rule
(strict for records a PR adds) refuses it as fresh evidence. It was NOT hand-stamped.
The runner was fixed (shared `readAuthorityBinding`) and the suite RE-RUN on one
coordinator-granted extra boot (boot 7): `../u74a-r2/u7w0b-u74a-2.u74a-run-record.json`,
PASS 12/12, authority bound to `as20261026r1`.

The run-1 record file is removed from the tree as superseded; its exact bytes remain in git
history: `git show 490a4f483:dev/agent-workflow/evidence/u7-w0b-20261026/c2/u74a/u7w0b-u74a-1.u74a-run-record.json` — sha256 `5d70690a2dc087e887c22b6ae2cf9807f697b3a8dac199f7288949c822de05d8`. Its host log and
`u74a-evidence` digest stay here unchanged (they are not RUN records).
