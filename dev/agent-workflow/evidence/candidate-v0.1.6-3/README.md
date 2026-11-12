# C2-A — independent adjudication of `cand-v0.1.6-3`

This directory is the evidence of an **independent C2 adjudication** of the frozen candidate
`cand-v0.1.6-3`. The adjudicator did not author, patch, merge or move anything under test:
no product code, no host source, no candidate ref, no authority pointer, no Required-CI
configuration. Every number below was measured in this session, on the commit named here,
with the instrument named here.

The machine-readable record is [`C2-A.json`](C2-A.json); this README is the human
counterpart. Both were written against the same evidence directories that are checked in
beside them.

---

## 1. Frozen identity

| item | value |
| --- | --- |
| candidate | `cand-v0.1.6-3` |
| commit / SHA | `17a24e2c302cd991c3ba495ae29576b58a6c1069` |
| ref | `refs/heads/candidate/v0.1.6-3` (tip = the commit, frozen) |
| commit subject | `PD39-INBOX: the accepted-but-not-claimed window no longer strands on this tree — and the promise is narrowed to what is measured (#740)` |
| manifest | `dev/engineering/candidates/cand-v0.1.6-3.json` |
| manifest commit | `9aaa05408aefa19d985fdb7eda8860513f237d76` (`task/freeze-cand-3`, PR #742; **not** an ancestor of the candidate — by ruling D12 the manifest is frozen after the product commit) |
| manifest sha256 | `a613bd16942c9a329badfe7f1791273900e4d94896619545ac04576e299d920d` |
| manifest F0 `content_digest` | `sha256:06b2bad8ec565039600ee5faf33e8940e04dc7ffc689f6b42ee5eca5335c65d7` |
| host pin | `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` = `0.2.0-rc.2` |
| authority pointer | `as20261109r1`, `sha256:d85fdc1a78f055dc460799a6ff560daab541d0d7f96bb48294ff3dee76a398b3`, baseline `cb2e41483af8447700fb3c2a25c2686705320692` — **not moved** |
| measurement worktree | `.worktrees/c2a-cand3`, branch `task/c2a-cand3-20261113`, HEAD = the candidate |
| adjudicator | `c2a-cand3-20261113`; wrote no product code, merged nothing |

Identity was recomputed, not transcribed:

```
node scripts/verify-candidate.mjs --manifest dev/engineering/candidates/cand-v0.1.6-3.json \
  --record dev/agent-workflow/evidence/candidate-v0.1.6-3/C2-A.json
```

Verbatim last line (exit 0):

```
VERIFIED cand-v0.1.6-3 @ 17a24e2c302cd991c3ba495ae29576b58a6c1069 — PASS=147
```

147 PASS edges, zero MISMATCH/MISSING/REFUSED: the commit resolves; the ref tip equals the
commit; the F0 digest recomputes; every product tree digest matches; **all 124 judge/driver
files are pinned at this SHA**; the dependency pins (host, lockfile, package.json) match the
frozen host; candidate is an ancestor of `refs/remotes/origin/master`; product == candidate.
The record itself is accepted as `recordClass=CANDIDATE-C2 eligible=false candidateCommit=17a24e2c3…`.

---

## 2. What was measured, and how many times

Two fresh worlds per family, started from a fresh `DSH_HOME` under `tests/homes/`, on the
pinned pristine host, on ports inside the sanctioned ranges (never `:3080`). Every world was
torn down by path at the end of its run.

| family | instrument (sha256) | env | runs | ports | result |
| --- | --- | --- | --- | --- | --- |
| joint acceptance J01–J11 | `tests/kits/joint-acceptance-20261111/run-joint-acceptance.mjs` (`3a81857…`) | no `C1_A6_*` | 2 | 3185/3494, 3186/3495 | **11 PASS / 0 FAIL / 0 NOT_REACHED** each |
| A6 allow + deny + throw + self-leg | `tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs` (`78520f1…`) | `C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_EXEC_NEG=1 C1_A6_RECIPIENTS=1` | 2 | 3187/3496, 3188/3498 | **10 PASS** each |
| A6 exception (declared Leader exception) | same C1 kit | `… C1_A6_EXCEPTION=1` | 2 | 3187/3496, 3188/3498 | **8 PASS** each |
| A6 Stop before consumption | same C1 kit | `… C1_A6_STOP=1` | 2 | 3187/3496, 3188/3498 | **3 PASS** each |
| A6 Host crash after PA write | same C1 kit | `… C1_A6_CRASH=1` | 2 | 3187/3496, 3188/3498 | **3 PASS** each |
| A1 bash governance, 7 clauses | `tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs` (`25e717b…`) | native preset, host default `danger-full-access` | 1 (brief) | 3189/3499 | **7 PASS**, sandbox backend `full usable=true` |
| packaging: gates → pack → clean install → live → cold boot → upgrade → rollback | `tests/kits/packaging-v016/run-packaging-acceptance.mjs` (`41cd87f…`) | `--second-tarball 4e146e95…` | 2 | 3189/3499, 3190/3500 | **33/33 driver + 39/39 live** each |

Evidence directories: `joint-j-run1/`, `joint-j-run2/`, `a6-{allowdeny,exception,stop,crash}-run{1,2}/`,
`packaging-run{1,2}/run-{1,2}/`, `a1-bash-governance/`.

The packaging run builds the product from the frozen tree in the measurement worktree
(`pnpm -r run build` + composition build), verifies the committed `dist`/composition shim,
packs `dsh-agent-team-0.1.6.tgz` (`sha256:7a1d754c54db844556412f1d943c2eb022400a4f0f9cb397b7dc820896ed45ba`,
4,405,634 bytes, provenance commit = the candidate and product porcelain empty), installs it
with the **real pinned CLI** into a fresh profile, boots it, drives a real Team/Member/Goal/
approval/Stop/cold-boot chain, then installs a second same-version tarball over it and rolls
back. The second tarball is `4e146e9529ad215145bebc14ff6c54217f1a5765b1361bbb7664da3430a0730f`
(4,403,356 bytes), built in the helper worktree at `6ea7d8dd4679ed48d1fd6e7d92ba30ee311fabad`; its installed tree is
`sha256:ad889249…`, the first tree is `sha256:deba287d…`, and after rollback the installed host
entry is `187bc363dc816703a364ad1288dd575135892fb7ad644273a38bba86e7d612b6` — identical to the
packed one.

---

## 3. Two-run agreement

Agreement is on **verdicts and on detail**, with an explicit, auditable normalization list.
The comparators are adjudication-authored (not product code):

* `compare-a6-runs.mjs` (`44b2ba3…`) — parses `[ts] PASS/FAIL <id>: proposition — detail`; normalizes
  ISO timestamps, run stamps, `ctrl-/goal-/case-/inst-/session-` ids, `rpcId`, sequences,
  world/home paths, worktree paths, and a log-truncated `defaultWorkspace` path; then requires
  exact verdict agreement and reports every remaining detail difference.
* `compare-packaging-runs.mjs` (`76d78c8…`) — compares every driver and live check
  (id/ok/detail) plus the artifact digests that must be equal *because they are properties of
  the packed tree*; normalizes only per-world identifiers, ports, timestamps, run labels,
  world paths, and the blueprint content hash (which is a hash over a document that embeds the
  per-run label).

| pair | agreement file | verdicts | details | artifacts |
| --- | --- | --- | --- | --- |
| joint J01–J11 | `joint-j-agreement.json` (shipped comparator) | agree | agree | — |
| A6 allow/deny/throw/self | `a6-allowdeny-agreement.json` | agree | agree | — |
| A6 exception | `a6-exception-agreement.json` | agree | agree | — |
| A6 Stop | `a6-stop-agreement.json` | agree | agree | — |
| A6 crash | `a6-crash-agreement.json` | agree | agree | — |
| packaging | `packaging-agreement.json` | agree | agree | agree (tarball, packed/installed host entry, first/second/installed-after-swap trees, rollback entry) |

`n = 2` proves **existence and agreement**, not a rate. No probability is claimed anywhere.

The joint runs and the C1-kit runs were done on the same host pin and the same isolated
`tests/deepseek-harness-test-use` copy (see D2). Every check in the C1 kit is read back from
durable ledger rows, real files, process/`/proc` facts or typed RPC responses; the mock model
is a scripted oracle (see §7).

---

## 4. Durable rows behind the A6 claims

These are rows in `<DSH_HOME>/storages/team_domain.json#tables.ledger`, read after the run —
not driver booleans.

**Allow (A6-2/27, run 1)** — two legs, both durable:

| fact | sequence | requestId | key fields |
| --- | --- | --- | --- |
| `control-request-recorded` | 6 | `ctrl-0pb502c1a7mq1j02twh9q0ec` | `actionName=parameter-permission`, `reviewAuthority=leader` |
| `control-decision-recorded` | 8 | same | `decision=allow`, `decider={instanceId:inst-063lyal0vbga,kind:instance,role:member}` (Officer) |
| `control-request-recorded` | 10 | `ctrl-0kyf7ea1cyf2zt0cpuld00vu` | `actionName=team-tool-execute`, `reviewAuthority=leader` |
| `control-decision-recorded` | 11 | same | `decision=allow`, Officer instance |
| `control-allow-consumed` | 12 | same | consumption = 1 |
| `control-execution-result` | 13 | same | `outcome=succeeded`, `callId=team-inst-0to1j9z07phl-bash:hexec:3d1ae612-e485-4ccc-b18e-1856c680d1f4-1` |

The approved body wrote `c1-a6-allow-<stamp>.txt`; the file was read back and contains the
stamp. Two execution-result facts for the two legs; no pending leg at the end (A6-6).

**Deny (A6-28, run 1)** — `ctrl-1dgdt201m2d9vr0tvh3621dz` (`team-tool-execute`):
`control-decision-recorded` `decision=deny`, `decider={humanId:session-c1-smoke-a6-…,kind:human}`
(via remote resolve). **No** `control-allow-consumed`, **no** `control-execution-result`, and the
would-be target file does not exist (`fileExisted=false`).

**Throw (A6-29, run 1)** — `ctrl-10z0c231kai1cw1vh8x7d1a9` is allowed and consumed
(sequence 28), then `control-execution-result` **`outcome=failed`** (sequence 29) with
`a5p5-refused kind=backend-failed code=target-unresolvable`. The body threw; the terminal row is
`failed`, never `succeeded`.

**Exception (A6-10, run 1)** — the declared-Leader-exception invocation:
`ctrl-0en5rpl1t3e3oq0sup6nr1wo` (`team-tool-execute`, `reviewAuthority=leader`) is allowed with
`decider={instanceId:inst-leader,kind:instance,role:leader}` — the **Leader**, not the Officer —
and the mock corpus records `wakes=0`, `notifications=3` (the Leader notification path). The body
executed (`executed=true`).

**Stop before consumption (A6-11/12, run 1)** — human leg
`ctrl-1um4n5l12nk59e1n1ekt71fg` (`reviewAuthority=human-user`):
`control-decision-recorded decision=allow` at `18:11:35.613Z`, `session/cancel` at `18:11:35.639Z`
with **no** `control-allow-consumed` row, **no** `control-execution-result`, and the target file
empty/absent. The second allow was refused (`CONTROL_REQUEST_ALREADY_DECIDED`/abandoned). Both
boots.

**Crash after the PA request write (A6-13/14, run 1)** — `ctrl-0rvsaim0t08ned1i5m8940j9`
(`team-tool-execute`, `reviewAuthority=leader`) is on disk before the Host is SIGKILLed. After a
cold boot on the same `DSH_HOME` the row is still there, **no deny rewrite**, and a late human
allow is refused with `CONTROL_REQUEST_ABANDONED` ("the PA authority is undetermined; the
invocation is abandoned and no decision is written"); `decisionAfter=null`, no execution row
before or after the restart. Independently, the joint J10 crash arm shows both legs
(`ppConsumed=1 paConsumed=1`) settled as `control-execution-result outcome=unknown` plus
`control-request-abandoned reason=execution-outcome-unknown`, with `noDuplicate=true`,
`noReplay=true`, `noSilentAbsence=true`, `durableSurvived=true`.

**A1 (once)** — `A1-1` inside-write bytes on disk; `A1-2` outside-ceiling write refused by the
OS (`ENOENT` + `Read-only file system`) with zero bytes; `A1-3` `cd`+`export` persist across
calls in one Member; `A1-4` a second Member does not see the first Member's cwd/export;
`A1-5` sufficed/truncated/relayed tool refs all refused, PTY fd count unchanged, turn count
unchanged; `A1-6` host default is `danger-full-access` yet the Member's root write lands and the
outside-file is absent and the refusal is proven; `A1-7` the denied foreign-Member leg has
`decision=deny`, `executions=0`, `consumptions=0`, no bytes on disk. Rows:
`a1-ledger.json`, `a1-deny.json`, `a1-pty.json`, `a1-sandbox-backend.json`.

---

## 5. Deviations (all of them)

| # | deviation | reason | weakens the claim? |
| --- | --- | --- | --- |
| D1 | The manifest does not exist in the candidate tree; it was read from `task/freeze-cand-3` @ `9aaa05408` and placed (untracked, byte-identical) in the measurement worktree. | Ruling D12 freezes the manifest after the product commit; the freeze commit is not an ancestor of the candidate, so `git show` from the branch is the only source. | No — the manifest is a cite target, not product bytes; its F0 digest recomputes and matches. |
| D2 | The documented read-only baseline `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness` no longer exists in this environment. The pristine host was copied with `cp -a` from `tests/deepseek-harness-test-use` (detached at `639ed01539`, porcelain empty before and after every run, same commit, same bytes) into the measurement worktree. | The shared baseline is gone; a `clone --local --no-hardlinks` had no source. | No — it is the same commit and byte-identical (`git status --porcelain` empty), just an independent copy. |
| D3 | Under JOINT the driver calls `runJointScenario` and exits (`run-joint-acceptance.mjs:4508-4510`) before the legacy A6 section, so `C1_A6_*` flags are **ignored**. The A6 scenario arms are therefore driven by the shipped C1 kit the joint driver derives from, with the same Officer/plane flags, on the same host and SHA. | The joint kit's A6 section is dead code under JOINT; the C1 kit is its live instrument. | No for the A6 propositions (same instrument lineage, same flags, durable rows read back). One no-op joint run with the flags set is kept as `joint-j-run3-a6flags-ignored/` to document this. |
| D4 | One joint boot was started with `C1_A6_STICKY_STOP=1`. That flag swaps the mock Officer handler to answer `C1_A6_STICKY_STOP_PENDING`, which invalidates the base allow scenario: J02/J03/J04/J05/J06/J11 FAILed for instrument reasons, not product reasons. The run was killed mid-flight and the world removed by verified path. | Wrong invocation, caught immediately. | No — the evidence is quarantined as `joint-j-run1-INVALID-invocation-a6stickyflag/` and **no verdict in this record uses it**. |
| D5 | The packaging upgrade/rollback phase needs a same-version tarball from a different commit. It was built in a helper worktree `.worktrees/c2a-cand3-second` @ `6ea7d8dd4` (`pnpm install --frozen-lockfile`, `build`, `build:composition`, `pnpm pack`). | The lane requires a second artifact to install over the first and roll back. | No — the helper worktree contains no product edits; the lane's own UPG checks prove the swap was real (same version, different bytes, installed tree changed to the second tarball's tree and back). |
| D6 | Detail agreement required normalizing per-world identifiers and paths (rpc ids, control/instance/session/goal ids, timestamps, home/worktree paths, blueprint content hash over a run-labelled document, and a log-truncated `defaultWorkspace` path). | Two fresh worlds necessarily differ in ids, ports, timestamps and paths; the blueprint id itself embeds the run label. | No — the normalization list is in the agreement JSON and excludes every measured artifact digest and every verdict. |
| D7 | The manifest describes C2-A as "Alpha.5 governed, **A6 off**"; this adjudication brief scopes C2-A to the joint surface **including** the A6 arms. The measured composition is the joint one (memberIoCeilings + reviewRouting, plane takeover, governed realm). The "A6 off" variant was **not** measured. | The brief defines the scope; the manifest text is carried over from cand-v0.1.6-1. | **Yes, in the sense that this record cannot be cited as the manifest's literal "A6 off" C2-A.** It is a C2-A under the brief's scope. |
| D8 | J09 passes on the live review-latch path (durable `stopped-<hash>.json`, `wakes=13->13 markerStable=true secondAskLegs=1`). The Sticky Stop **no-latch** path (PD-40) was not exercised. | PD-40 is OPEN per the product-debt register; exercising it is a C2-B shape. | **Yes** — nothing here claims PD-40 is fixed. |

---

## 6. Manifest findings — reported as FAIL, not as notes

The frozen manifest's **identity values** all recompute (147/147). Two **text** fields are
stale from `cand-v0.1.6-1` (the same text is present in `cand-v0.1.6-2`):

1. `evidence.record_root` = `dev/agent-workflow/evidence/candidate-v0.1.6-1`, not
   `…/candidate-v0.1.6-3`. If followed literally, this candidate's C2 evidence would be filed
   under another candidate's root. The brief and this record use `candidate-v0.1.6-3`.
2. `immutability.acceptance_scopes[C2-A].description` still says "A6 off", while the brief's
   C2-A (and therefore this record) measures the joint A6-on surface.

The verifier does not read either field, so neither changes a recomputed edge. They are
recorded in `C2-A.json#manifestFindings` with `verdict: FAIL`. The manifest was **not** edited
(it is frozen); correcting it requires a new manifest commit.

---

## 7. Verdict, and what is deliberately **not** claimed

**Verdict: PASS for C2-A as scoped by the 2026-11-13 brief** — identity 147/147; joint 11/11
twice with full detail agreement; A6 allow/deny/throw/exception/Stop/crash twice each with
durable rows and detail agreement; packaging 33/33 driver + 39/39 live twice with artifact
identity equal; A1 7/7 with sandbox backend `full`.

**Candidate-level eligibility is NOT asserted** (`candidateClaimEligibility.eligible=false`):

* C2-B has not been run on this SHA. The precedent (cand-v0.1.6-1) asserts no candidate-level
  eligibility while C2-B is not PASS; that discipline is kept here.
* The two manifest text defects in §6 are open FAILs. Product surface is green; eligibility is
  withheld until C2-B passes and the manifest text is corrected by a new manifest commit.

This adjudication does **not** prove, and this record does not claim:

* **Stability, rate, probability.** Two runs are two existences that agree, not a percentage.
  The A6-12 Stop race that failed 4/6 in the earlier cand-1 adjudication is not re-measured as
  a rate here; the two runs observed here both pass (existence), and the earlier 4/6 is not
  contradicted or confirmed by n=2.
* **Real vendor-model behaviour.** The model transport is the in-tree deterministic mock
  (scripted oracle). Every durable row, process, file, install, boot and side effect is real;
  the *model* is not.
* **OS network isolation.** Not measured; every subordinate DEV-LIVE record says
  `osLevelNetworkIsolationClaimed: false`.
* **An upgrade protocol or data migration.** The product has none; what was measured is
  install-over-then-back at the same version (UPG-1/2/3, RBK-1/2/3).
* **The manifest's literal "A6 off" C2-A** (D7), the **Sticky Stop no-latch path / PD-40**
  (D8), **PD-43's relayed-turn finding**, **A6-26 accepted-not-claimed Inbox arm**, and the
  **A6-on + governed Goal-authorisation conjunction** — all C2-B shapes, unrun here.
* **Q7 / V@B / Required-CI status.** Not measured, not touched, not moved.
* **Anything repo-wide.** The measurement worktree is the only writable tree besides
  `tests/homes/` and this evidence directory; no other worktree, no `:3080`, no shared
  baseline was read or written.

---

## 8. Reproduce

From the measurement worktree (`.worktrees/c2a-cand3`, HEAD = candidate, host copy at
`tests/deepseek-harness-test-use`, `pnpm` 11.7.0 / Node v24.21.0):

```bash
# identity + record acceptance
node scripts/verify-candidate.mjs \
  --manifest dev/engineering/candidates/cand-v0.1.6-3.json \
  --record  dev/agent-workflow/evidence/candidate-v0.1.6-3/C2-A.json

# joint pair (no C1_A6_* flags; JOINT ignores them)
node tests/kits/joint-acceptance-20261111/run-joint-acceptance.mjs \
  --worktree "$PWD" --testuse "$PWD/tests/deepseek-harness-test-use" \
  --host-port 3185 --mock-port 3494 \
  --evidence-dir "$PWD/dev/agent-workflow/evidence/candidate-v0.1.6-3/joint-j-run1"

# A6 pairs
C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_EXEC_NEG=1 C1_A6_RECIPIENTS=1 \
  node tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs \
  --worktree "$PWD" --testuse "$PWD/tests/deepseek-harness-test-use" \
  --host-port 3185 --mock-port 3494 \
  --evidence-dir "$PWD/dev/agent-workflow/evidence/candidate-v0.1.6-3/a6-allowdeny-run1"
# …swap C1_A6_EXCEPTION=1 / C1_A6_STOP=1 / C1_A6_CRASH=1 for the other three scenarios

# A1 once
node tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs \
  --worktree "$PWD" --testuse "$PWD/tests/deepseek-harness-test-use" \
  --host-port 3189 --mock-port 3499 \
  --evidence-dir "$PWD/dev/agent-workflow/evidence/candidate-v0.1.6-3/a1-bash-governance"

# packaging pair (second tarball needed for upgrade/rollback)
node tests/kits/packaging-v016/run-packaging-acceptance.mjs --run 1 \
  --worktree "$PWD" --testuse "$PWD/tests/deepseek-harness-test-use" \
  --host-port 3189 --mock-port 3499 \
  --second-tarball /…/.worktrees/c2a-cand3-second/.artifacts/tmp/pack-b/dsh-agent-team-0.1.6.tgz \
  --second-commit 6ea7d8dd4679ed48d1fd6e7d92ba30ee311fabad \
  --evidence-dir "$PWD/dev/agent-workflow/evidence/candidate-v0.1.6-3/packaging-run1"

# agreement
node dev/agent-workflow/evidence/candidate-v0.1.6-3/compare-a6-runs.mjs \
  dev/agent-workflow/evidence/candidate-v0.1.6-3/a6-stop-run1 \
  dev/agent-workflow/evidence/candidate-v0.1.6-3/a6-stop-run2 \
  dev/agent-workflow/evidence/candidate-v0.1.6-3/a6-stop-agreement.json
node dev/agent-workflow/evidence/candidate-v0.1.6-3/compare-packaging-runs.mjs \
  …/packaging-run1/run-1 …/packaging-run2/run-2 …/packaging-agreement.json
```

Subordinate kit records keep their own class: every one of them is **DEV-LIVE**
(`osLevelNetworkIsolationClaimed: false`) and is never cited here as a candidate claim.
Only `C2-A.json` carries `recordClass: CANDIDATE-C2`, bound to
`17a24e2c302cd991c3ba495ae29576b58a6c1069`, with `eligible=false`.
