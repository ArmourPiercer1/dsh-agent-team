# test-infra-fixture-param — fixture parameterization + launch-token log redaction

Branch `task/test-infra-fixture-parameterization` · base `origin/master` = `427219e443ece4d57ac8558f13850c5f42ff8330`
Head at the time of this record: `984b910c80319bb0efb051089483e56e9fb8a285`
Draft PR: https://github.com/ArmourPiercer1/dsh-agent-team/pull/53 (no merge authorization)
Worktree: `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/test-infra-fixture-param` (sole writer)
Test runtime: `tests/deepseek-harness-test-use` @ `46a7f68b0922371ce714b668b90e377d8e799f4`, porcelain 0 before and after every run.

## 1. What changed (4 files, +223 / −16, zero product code)

```
tests/characterization/lib/instance.mjs                        |  23 +++-
tests/kits/model-preference-routing-smoke/model-preference-routing-smoke.mjs | 11 +-
tests/kits/pr-b-effective-policy-smoke/pr-b-effective-policy-smoke.mjs       | 146 +++++++--
tests/kits/team-view-sync-complete-e2e/browser-smoke-host.mjs  |  59 +++++++-
```

Commit `8f3e3018` — parameterization of the seed-fixture constants in the three real-host kits
(`--seed-world`, `--seed-blueprint-dir`, `--t1`, `--worker-instance` in pr-b; `--seed-world`, `--t1` in
browser-smoke-host; `rootT1` published into the mpr summary) + the launch-token LOG redaction.
Commit `984b910c` — the completed pin: `--expert-instance` / `--control-instance`, the pre-boot durable-store
ID USE GUARD, `controlId` capture in the mpr kit, and value-less flags becoming usage fatals.

**Assertions are byte-identical to the base.** Everything below changed only constant *origins*, pre-flight
validation, header documentation and one logged string. C1–C6, the profile/world shape guards
(`members: []`, `policyStates: []`, `mcpServers: []`), the T-PS embedded-blueprint step, the R1–R8 + H1/H2
legs, all criteria names and tallies are untouched (`git diff origin/master...HEAD` shows no `-` line
inside any assertion body).

## 2. Generated fixture identity (the new seed world)

| field | value |
| --- | --- |
| world | `tests/homes/mpr-2026-10-01T13-21-34` (gitignored, kept on disk, never `git add`ed) |
| `rootT1` | `session-mpr-t1-mpr-2026-10-01T13-21-34` |
| `wCreate` (worker, C1/C6) | `inst-1722vhu1h1z1` |
| `expertId` (expert, C2/C5) | `inst-1qazuqc1ylx9` |
| `controlId` (control, C4) | `inst-0e84f9t1xgok` |
| `wDeleg` (the other worker) | `inst-0iin89s0dvix` |

Durable-store verification (`durable-store-identity-check.py`, output below) — the five `member_instances`
rows of T1 in `tests/homes/mpr-2026-10-01T13-21-34/storages/team_domain.json`:

```
instanceId=inst-0e84f9t1xgok template=control  label=w-control  lifecycle=SETTLED
instanceId=inst-1qazuqc1ylx9 template=expert   label=expert-pre lifecycle=SETTLED
instanceId=inst-leader       template=leader   label=leader     lifecycle=None
instanceId=inst-0iin89s0dvix template=worker   label=w-deleg    lifecycle=SETTLED
instanceId=inst-1722vhu1h1z1 template=worker   label=w-create   lifecycle=SETTLED
```

This is the `expertId` semantics check the ruling asked for: the id the mpr kit captures at R5
(`team_create_member(delegationTemplateId='expert')` → `value.effect.instanceId`, kit line 1293) is the same
`MemberInstance` identity pr-b's C2/C5 address by `targetInstanceId`, and it is SETTLED in the durable store.
The mpr blueprint declares **no** `capabilities` on the `expert` template (only the leader declares
`capabilities.teamTools/mcp`), which is exactly pr-b's C2 precondition ("expert → no initial MCP grant").
`controlId` likewise resolves to template `control`, SETTLED. pr-b now enforces this mapping itself
(`ID USE GUARD`, §4) instead of trusting a literal.

## 3. Real runs — verbatim results

### 3.1 run #1 — environment-setup diagnosis (kept, NOT a result)

```
$ cd .worktrees/test-infra-fixture-param
$ node tests/kits/model-preference-routing-smoke/model-preference-routing-smoke.mjs
exit 1
FATAL: p6t6 readiness not reached in 300000ms (want root=session-mpr-boot-mpr-2026-10-01T13-08-04 phase=create; last state=null)
criteria R1..R8, H1, H2 : 0 checks each (never reached)
```

Cause, proven rather than assumed — this worktree had no module resolution, so the *production row* could not
be imported (`tests/homes/mpr-2026-10-01T13-08-04/logs/instance-port3181.log`):

```
dsh: warning: 2 entries did not activate
dsh-agent-team (file:///…/.worktrees/test-infra-fixture-param/packages/runtime/dist/packages/runtime/src/plugin/host.js): failed to import
p6t6-team-tools (file:///…/packages/tools/harness/plugin.mjs): pending (waiting for service: teamRoot)
```

Direct reproduction: `Cannot find package 'yaml' imported from …/packages/runtime/dist/packages/domain/blueprint/src/parse.js`.
The kit failed closed exactly as designed (readiness gate → typed fatal, no assertion touched). The hollow
world `tests/homes/mpr-2026-10-01T13-08-04` was left in place as diagnosis material; the kit's own run
directory `dev/agent-workflow/evidence/model-preference-routing/real-host/mpr-2026-10-01T13-08-04/`
is likewise untouched and uncommitted.

### 3.2 run #2 — mpr kit, after provisioning: **exit 0**

```
$ cd .worktrees/test-infra-fixture-param
$ node tests/kits/model-preference-routing-smoke/model-preference-routing-smoke.mjs
exit 0 · fatal: null · pass: true
R1 R2 R3 R4 R5 R6 R7 R8 H1 H2 : all pass · run.log: 39 PASS lines / 0 FAIL lines
host 3181 · mock 3496 (:3080/:3180 read-only probes only: 401 / unreachable, pre == post)
worktree HEAD 984b910c… · test-use pristine @ 46a7f68b09
retained world: tests/homes/mpr-2026-10-01T13-21-34
```

Console capture: `run-mpr-console.log`. Redacted evidence copy: `run-mpr-2026-10-01T13-21-34/`
(44 files, 2 redactions — see §6). The redaction repair is visible in it:
`profile: throwaway boot OK: http://127.0.0.1:3181/?token=REDACTED` immediately followed by
`profile initialized by the throwaway boot` → `host 1 up: http://127.0.0.1:3181 (token cookie acquired)`,
i.e. the log is clean and readiness/authentication are unaffected.

### 3.3 run #3 — pr-b kit fed the six real ids: **exit 2 (5/6 criteria)**

```
$ node tests/kits/pr-b-effective-policy-smoke/pr-b-effective-policy-smoke.mjs \
    --seed-world mpr-2026-10-01T13-21-34 \
    --seed-blueprint-dir /srv/workspace/dsh-plugins/dsh-agent-team/tests/homes/mpr-2026-10-01T13-21-34/blueprints \
    --t1 session-mpr-t1-mpr-2026-10-01T13-21-34 \
    --worker-instance inst-1722vhu1h1z1 \
    --expert-instance inst-1qazuqc1ylx9 \
    --control-instance inst-0e84f9t1xgok
exit 2 · fatal=none · world tests/homes/prb-ep-2026-10-01T13-22-22 (retained, non-zero exit)
host 3182 · mock 3497 · mini-MCP 3491/3492 · stable probes 3080=401 / 3180=unreachable, identical pre and post

  C1 PASS  model override -> next request            [wire body.model=prb-c1-model (override ovr-model-inst-1722vhu1h1z1-g0 gen=1)]
  C2 PASS  MCP override -> next request              [wire mcp__ tools=["mcp__prb-mcp-a__ping"] (override ovr-mcp-inst-1qazuqc1ylx9-g0)]
  C3 FAIL  PolicyState switch -> next request        [see §5 — pre-existing contract drift]
  C4 PASS  mutation || concurrent request            [concurrent followup OK; winner=ovr-model-inst-0e84f9t1xgok-g0 gen=1; next-boundary model=prb-c4-model]
  C5 PASS  restart (same DSH_HOME) still governs     [post-restart model=prb-c1-model mcp=["mcp__prb-mcp-a__ping"] T-C3 ps=prb-c3-strict]
  C6 PASS  inspect-config parity                     [route=deepseek-official/prb-c1-model (state=pending-next-boundary) == wire body.model=prb-c1-model]
```

What this proves for the parameterization itself: all six identities came out of a freshly generated world,
were consumed by the kit through the new flags, and C1/C2/C4/C5/C6 passed on them — including the C4 mutation
against the regenerated control member and the C5 same-home restart. No override id was guessed.
Console capture: `run-pr-b-console.log`; redacted copy: `run-pr-b-2026-10-01T13-22-22-c3/` (7 files, 6 redactions).

## 4. The ID USE GUARD and why it is a strengthening

pr-b `prepareWorld()` now refuses to boot unless every member identity it was handed is a real
`MemberInstance` of T1 in the **copied durable store** whose `templateId` is the one the criteria address:

```
--worker-instance  → templateId 'worker'   (C1/C6)
--expert-instance  → templateId 'expert'   (C2/C5)
--control-instance → templateId 'control'  (C4)
```

Missing row or template mismatch ⇒ `dieFatal('instance-type-mismatch: …')` naming the flag, the id, the real
template/label/lifecycle and the criteria it feeds — before the mock, the mini-MCP servers or the host start.
Rows are read from `storages/team_domain.json` → `tables.member_instances` (`MemberInstanceRecordDto` v1:
`rootSessionId` + `instanceId` + `templateId`; keys are `memberIdentityKey({rootSessionId, instanceId})`).
The defaults get the same check, so a stale default against a foreign world now fails loudly instead of
running a criterion against the wrong member.

## 5. C3 — recorded contract drift, left failing (decision item, not fixed here)

The failing sub-leg is `legC3Structural` (kit line ~1035): it creates its own team bound to the kit's own
per-team blueprint `team.prb-ps` (which declares `focus`) and asserts that `policyState.set(focus)` is
**rejected**, because the closed set is the boot blueprint's `{default, strict}` (the kit's comments cite
`s6-remote.ts:2689`). The host **accepted** it, and on the current contract that is correct behavior:

> pre-alpha3 W1 fix-A (F11): the closed set is the ADDRESSED team's bound Blueprint … a BOUND ref **NEVER**
> consults the host boot Blueprint (on a multi-team host the boot team's policyStates are not the addressed
> team's — the Remote precheck world must equal the Governance world)
> — `packages/runtime/src/plugin/s6-remote.ts`, `policyState.read` / `policyState.switchState`

Provenance:

* the F11 rule landed in `3b7039e8` (2026-09-30 11:05, *pre-alpha3 PR-F increment 1 — F.2 + F.3 + F11 re-land*),
  and `git merge-base --is-ancestor 3b7039e8 427219e4` confirms it is inside this branch's base;
* the kit's `C3-structural` text was last written in `10add920` (2026-09-29) and has not been revalidated since;
* every historical green pr-b run in the repo is stamped 2026-09-28 (`host-smoke-2026-09-28T2x-…-c3`), i.e. pre-F11;
* `legC3Structural` uses **none** of the six seed identities — it mints its own team from its own blueprint —
  so the outcome is independent of this PR's parameterization and would be identical with the old defaults.

Per the task's hard constraints the leg, its expectation and its comments are left byte-identical and the
criterion is reported as FAIL with its raw wire evidence (`run-pr-b-2026-10-01T13-22-22-c3/summary.json`,
`api-transcript.json`). Two options for the coordinator, deliberately not chosen here:

1. revalidate `legC3Structural` against the F11 contract (closed set = addressed team's bound Blueprint) —
   an alignment to the authoritative production contract, to be documented as revalidation, not weakening;
2. keep the historical expectation and mark the leg known-stale pending product-owner review.

## 6. Evidence handling and redaction

Every file in `run-mpr-…/` and `run-pr-b-…/` is an **independent redaction copy** produced by
`copy-redact-evidence.mjs` (this directory): credential *values* only are replaced by markers
(`?token=REDACTED`, `lt-v1-REDACTED`, `sk-REDACTED`, `Bearer REDACTED`, `REDACTED-ENDPOINT`, PEM/JWT shapes),
while fields, results, exit codes, counts, paths, ids and timestamps are preserved byte-for-byte.
`COPY-MANIFEST.json` in each copy lists every file with its byte count and redaction count.

The exception that justifies the rule: the pr-b kit's own run directory contains a **raw launch token** the
kit's self-scrubber missed — `host-smoke-2026-10-01T13-22-22-c3/logs/instance-port3182.log` line
`dsh web: http://127.0.0.1:3182/?token=<raw>` (the upstream banner, a different emitter than the repaired
line). The committed copy has it as `?token=REDACTED`. The original run directories therefore stay
**untracked** in the worktree and are not part of the branch; only the redacted copies are.
Private token-bearing operational files (world profiles, instance logs, `.credentials.yaml`) exist only
inside the gitignored `tests/homes/<world>`.

Scans: every added line of the branch-vs-base diff *and* of the working diff was checked for
`?token=<value>`, `lt-v1-<hex>`, `sk-…`, `gh*`, `xox*`, `AKIA`, JWT, PEM, `Bearer …` and the two known
endpoints → **zero hits**; the evidence directory was re-scanned after copying → zero hits. The only
token-shaped strings anywhere in the committed evidence are `REDACTED` markers; `redaction-check.mjs`
assembles its fixture token at runtime so the file itself contains no credential-shaped literal.

## 7. Validation without booting anything

`probe-rejections.log` — 31 validation cases across pr-b and browser-smoke-host, each `exit 1`, each a
specific fatal, **zero** boot/mock/listen lines in the whole log. Covers empty values, whitespace, `.` and
`..` escapes, world names containing separators, absolute paths outside the homes root, two **symlink
escapes** (a homes symlink to `tests/deepseek-harness-test-use` and one to `/etc`, both caught by realpath
containment), non-existent worlds, `--t1` shape violations, `--worker-instance` / `--expert-instance` /
`--control-instance` shape violations, and the new missing-value / flag-as-value fatals.

`probe-prb-accept.log` — the override actually reaching the kit: with `--seed-world` pointing at a probe
fixture the kit logs `world copied: …/tests/homes/paramprobe-empty -> …/tests/homes/prb-ep-<stamp>` and then
fails honestly on the hollow fixture (`ENOENT …/profiles/web/cordis.patch.yml`) *before* the mock, the
mini-MCP servers or the host start.

The browser lane was verified the same way, deliberately without booting the smoke host: the kit logged
`world=…/tests/homes/tvs-smoke-<stamp> (seed from …/tests/homes/paramprobe-browser)` and
`commit binding: worktree HEAD=8f3e3018… porcelain='' bundle=1147053B …`, then stopped at the hollow seed.
`--t1` wiring is proven at module scope by the accept/reject asymmetry (a valid value runs, an invalid one
dies before the first log line) plus the single consumer site `t1: T1` in the `smoke-host.json` write; the
file itself is only produced after a boot, which this lane must not perform. Scoping choice, recorded.

## 8. Literal-identity audit after the change (ruling item 2)

pr-b: `mpr-2026-09-27T08-35-52` ×3, `/home/user/…` blueprint dir, `session-mpr-t1-…`, `inst-1p8kqfl09bhr`,
`inst-04eix3v0rhrj`, `inst-0f6c37a0hpcj` — all **defaults, reachable only when the flag is absent**;
`STALE_WT_SEG='async-default-contract'` / `THIS_WT_SEG` (profile retarget segments, not identities — with a
world generated in this worktree the retarget is a verified no-op because the profile rows already point
here); `BOOT_BLUEPRINT='team.mpr-anchor'`, `team.prb-ps`, `team.prb-c3`, `ps-` / `session-prb-ps-<stamp>` /
`session-prb-c3-<stamp>` (kit-minted roots and structural blueprint ids of the kit's own construction).
mpr kit: **no** literal instance id, session root or world path at all (it mints `RUN_STAMP`-derived ids).
browser-smoke-host: the two defaults plus `T1_MEMBER_SESSION='session-team-child-796…'` and
`T1_MEMBER_INSTANCE='inst-17legoh0ti27'` — the latter pair is the same class of member coupling as pr-b's
and would need the same treatment; it is **out of this PR's authorized target list**, so it is listed here
rather than silently left as if benign.

## 9. Disclosed incident

While re-running a probe, its cleanup step used `find <evidence> -newermt '-10 minutes' -exec rm -rf {} +`.
In a freshly checked-out worktree that predicate also matched **87 tracked historical evidence files**
(`dev/agent-workflow/evidence/pre-alpha3-refactor/pr-b/host-smoke-2026-09-28*` and
`…/team-view-sync-complete/wp9b-browser-smoke-2026-09-28*`), because checkout gives tracked files a fresh mtime.
Restored immediately with `git restore dev/agent-workflow/evidence/` and verified:
`git status --porcelain` empty, `git diff HEAD` empty, and on-disk file counts equal to the tracked counts
(42 pr-b files, 127 team-view-sync files). No commit in this branch contains the deletion and no historical
evidence is modified. Every cleanup after that uses only the literal paths the run itself created — visible
in the probe scripts' explicit `rm -rf` lists.

## 10. Housekeeping state at this checkpoint

* kept on disk, untracked, never added: `tests/homes/mpr-2026-10-01T13-21-34` (the new fixture world),
  `tests/homes/mpr-2026-10-01T13-08-04` (run #1 diagnosis), `tests/homes/prb-ep-2026-10-01T13-22-22`
  (pr-b's retained non-zero-exit world), the kits' own run directories, and the 4 module-resolution links;
* ports 3181–3186 / 3491–3500 all free, no kit process alive; `:3080` untouched apart from read-only GETs;
* `tests/deepseek-harness-test-use` still pristine at the pinned baseline, porcelain 0;
* the frozen PR #52 worktree used read-only: 0 tracked-diff lines before and after;
* environment provisioning and its revert command: `environment-facts.txt` (including the corrected note
  that the links are **untracked**, not ignored, and the corrected reason no product delta can enter).
