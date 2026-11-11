CANDIDATE-C2

# Packaged acceptance — frozen candidate `cand-v0.1.6-2`

Author lane record (this is **not** an independent adjudication; the independent C2 for this
candidate is a separate session). Date: 2026-11-11. Scope: the packaged (tarball) path only —
`pnpm pack` → real `dsh plugin add` into a fresh `DSH_HOME` → one real Host → Team → Member →
human approval → Goal → Stop → collection → cold recovery.

## 0. Frozen identity (what was measured)

| field | value |
| --- | --- |
| candidate id | `cand-v0.1.6-2` |
| candidate ref | `refs/heads/candidate/v0.1.6-2` |
| candidate commit | `bb3c158eb1f76f8db429da01e9a4c5a0e118ca90` (`A6-STOP-FENCE … (#710)`) |
| manifest | `dev/engineering/candidates/cand-v0.1.6-2.json` @ master `cbf1c1df6` (`CANDIDATE-V016-2: freeze … (#711)`) |
| manifest content digest | `sha256:ef2c7e705ccdf9b2272cfe3b77f348274464ed39bbb5c5dabdf52a85a052ad8d` |
| host pin | `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (DSH `0.2.0-rc.2`, from `tests/paths.mjs`) |
| measurement worktree | `.worktrees/pack-accept` at `bb3c158eb` on `task/pack-accept-20261111` |
| packed artifact | `dsh-agent-team-0.1.6.tgz`, **4 363 426 bytes**, **sha256 `2cc63ee134cd3471e21e09120156b9c64fe3e340f45eef570dd0b4c5a1955692`**, 2 107 tar members (identical in both runs) |
| installed host entry | `…/dist/packages/runtime/src/plugin/host.js`, sha256 `b0211497…32ed` — byte-identical packed vs installed in both runs |
| install command | `dsh plugin --profile web add <abs path>/dsh-agent-team-0.1.6.tgz` (exit 0, version `0.1.6`) |

`candidate/v0.1.6-2` and the authority pointer were **not** moved; nothing was tagged or
merged. No `packages/**` product file was touched by this record.

### Disclosed deviation — the manifest is read from master

`dev/engineering/candidates/cand-v0.1.6-2.json` and `scripts/verify-candidate.mjs` do not
exist at the candidate commit (they landed at `cbf1c1df6` on master). The identity above is
read from `origin/master` and cross-checked against the candidate commit it names
(`candidate_commit == bb3c158eb… == the worktree HEAD`). This is a tooling-availability
deviation, not a candidate-tree deviation; same pattern C2-1 disclosed.

## 1. Instruments

| instrument | source | sha256 | runs |
| --- | --- | --- | --- |
| packaged acceptance driver | `tests/kits/v016-packaged-acceptance/run-packaged-acceptance.mjs` (this commit) | `aceac722a17a54a68947d7793f2f197c7773a6d4c9df06859f80ab33aec8e6fd` | both |
| model transport | `packages/tools/harness/mock-deepseek.mjs` (in-tree deterministic **scripted oracle**) | tracked, unmodified | both |
| installer | pristine host `apps/cli/lib/bin.js` (`dsh plugin … add`) | from the host pin | both |
| Host | pristine host `dsh web --port 1400x --no-open` against a fresh `DSH_HOME` | from the host pin | both |

Every run gets a fresh World under `tests/homes/`; the World is torn down by identity
(`tests/homes` count 0 after the runs). Ports `1400x/1407x`, loopback only; the
adjudicator's `1302x–1307x` and `:3080` were never contacted.

### What the oracle decides, and what stays real

The mock decides **which tool the Leader/Officer/Member calls** (a scripted oracle). It does
not decide whether the product works. Real in every run: the packed tarball, the install,
the profile/lock, the Host process, the durable `team_domain.json` ledger and member rows,
the session records, the HTTP responses, the human `team.resolveControl` / `session/cancel` /
`goals/pause` RPCs (the exact ones the GUI buttons issue), and the on-disk side effects.
There is **no DOM click** — no headless browser was available; the RPC is the button's
wire call, disclosed rather than simulated.

## 2. Command sequence (both runs)

```
git worktree add .worktrees/pack-accept -b task/pack-accept-20261111 origin/candidate/v0.1.6-2
cd .worktrees/pack-accept
node tests/kits/v016-packaged-acceptance/run-packaged-acceptance.mjs --run 1 --port 14001 --mock-port 14071
node tests/kits/v016-packaged-acceptance/run-packaged-acceptance.mjs --run 2 --port 14002 --mock-port 14072
```

Driver steps, in order: identity → `pnpm pack` → real CLI install → boot → `team.create`
(saved v5 blueprint, runtime-created acceptance Team) → Leader creates Officer/Worker/Goal
Member and delegates → governed `bash` ask → human approval → Goal (host rounds + edit) →
Stop (allow then `session/cancel`) → `team_collect` → SIGKILL → cold boot on the same
`DSH_HOME` → teardown. Exit codes: 0 = all checks passed, 2 = a check failed, 1 = fatal
(environment/pack/install/boot).

## 3. Agreement table (field → run 1 → run 2 → agree?)

| field | run 1 | run 2 | agree |
| --- | --- | --- | --- |
| driver exit code | 0 | 0 | ✔ |
| checks passed | 37/37 | 37/37 | ✔ |
| tarball sha256 / bytes / members | `2cc63ee1…5692` / 4 363 426 / 2 107 | same | ✔ |
| installed host entry == packed | `b0211497…32ed` | `b0211497…32ed` | ✔ |
| profile lock integrity | `sha512-ZSD/fN52…5EvQ==` | same | ✔ |
| profile resolves by package name (no worktree refs) | true / `[]` | true / `[]` | ✔ |
| `team.create` v5 admission | 200, hash `sha256:289c1e70…fc83` | 200, hash `sha256:6f15e5a0…7d44` | ✔ (hash differs with the World path; the blueprint body is identical) |
| Member / Officer / Goal Member durable rows | 3/3 | 3/3 | ✔ |
| approval: permission leg decision | `allow` (human) | `allow` (human) | ✔ |
| approval: plane leg `reviewAuthority` | `human-user` | `human-user` | ✔ |
| approval: Officer escalation fact | present | present | ✔ |
| approval: human-leg decision / decider | `allow` / `human` | `allow` / `human` | ✔ |
| approval: human-leg consumptions | 1 | 1 | ✔ |
| approval: execution results | 1 (`succeeded`) | 1 (`succeeded`) | ✔ |
| approval: body executed once (marker file) | `V016PACK_R1_ARM1_EXECUTED` | `V016PACK_R2_ARM1_EXECUTED` | ✔ (marker is per-run by design) |
| Goal phase / revision / rounds | `paused` / 3 / 3 | `paused` / 3 / 3 | ✔ |
| Goal update | revision 1→3 | revision 1→3 | ✔ |
| Stop: `session/cancel` admitted | `{"accepted":true}` | `{"accepted":true}` | ✔ |
| Stop: plane-leg decision | `allow` (human) | `allow` (human) | ✔ |
| Stop: plane-leg consumptions / executions | 0 / 0 | 0 / 0 | ✔ |
| Stop: side-effect file | absent | absent | ✔ |
| Stop: late allow | refused `CONTROL_REQUEST_DECIDED` | refused `CONTROL_REQUEST_DECIDED` | ✔ |
| Stop: terminal shape | `already-decided` | `already-decided` | ✔ (not forced — see §6 F-6) |
| collection: durable result carries the member marker | true | true | ✔ |
| crash: SIGKILL then cold boot on same `DSH_HOME` | ok | ok | ✔ |
| recovery: Team + Member lifecycle | present / `SETTLED` | present / `SETTLED` | ✔ |
| recovery: Goal phase / revision / rounds (durable fold) | `paused` / 3 / 3 | `paused` / 3 / 3 | ✔ |
| recovery: per-leg consumption facts | 1,1,1,0 | 1,1,1,0 | ✔ |
| recovery: collected member result | same marker | same marker | ✔ |
| recovery: no resurrected turn (records/mock deltas) | 0 / 0 | 0 / 0 | ✔ |
| host checkout clean after | `porcelain=""` | `porcelain=""` | ✔ |

`n=2` agreeing is an **existence-plus-agreement** proof, not a stability or rate claim.

## 4. Decisive evidence per step (files inside `run-<n>/`)

- **Pack / install (identity of the artifact).** `summary.json#tarball` (name, bytes,
  sha256, 2 107 members, the five required members present), `pack/members.txt`,
  `install/install.txt`, `install/profile-package.json`, `install/pnpm-lock.yaml`,
  `install/installed-package.json`. Decisive fields: `tarball.sha256`,
  `install.installedHostEntrySha256 == tarball.hostEntrySha256`,
  `install.lockIntegrity`, `install.bundleRowUsesPackageName = true`,
  `install.worktreeRefsInProfile = []`.
- **Boot.** `boot/boot-1.json` (pid, command, redacted URL, auth status), `boot/instance.log`,
  `boot/mock-requests.json`.
- **Team / Member.** `flow/team-create.json`, `flow/team-before-leader.json`, `flow/member.json`,
  `ledger/*.json`. Decisive: the durable `team_sessions` row, the `blueprint_registry` row
  with its `contentHash`, three `member_instances` rows (`worker`, `officer`, `goal`) each
  bound to a live child session.
- **Human approval (two real legs).** `flow/approval-permission-discovery.json`,
  `flow/approval-permission-allow.json`, `flow/approval-human-discovery.json`,
  `flow/approval-human-allow.json`, `flow/approval-facts.json`. Decisive: the plane leg's
  frozen `reviewAuthority=human-user`; `control-escalation-recorded` for that
  `approvalCaseId` with `escalatedBy` = the Officer instance; `control-decision-recorded`
  `{decision: allow, decider:{kind: human}}`; exactly one `control-allow-consumed`;
  exactly one `control-execution-result` (`succeeded`); the marker file body.
- **Goal.** `flow/goal-create-prompt.json`, `flow/goal-pause-before-update.json`,
  `flow/goal-update-prompt.json`, `flow/goal.json`. Decisive: `roundsStarted >= 2` from the
  Host's own round driver, `revision` advanced by the Member's `update_goal`, phase `paused`.
- **Stop.** `flow/stop-permission-discovery.json`, `flow/stop-permission-allow.json`,
  `flow/stop-human-discovery.json`, `flow/stop-human-allow.json`, `flow/stop-cancel.json`,
  `flow/stop-late-allow.json`, `flow/stop.json`. Decisive: cancellation admitted **after**
  the human allow; **zero** consumptions, **zero** execution results, **no** side-effect
  file for the governed plane leg; the late re-allow refused.
- **Collection.** `flow/pre-crash-collect.json`, `flow/post-restart-collect.json`. Decisive:
  `memberResult.requestToken = v016pack_r<n>-delegate-work` with the member's marker.
- **Cold recovery.** `flow/cold-pre-crash.json`, `flow/cold-recovery.json`,
  `flow/cold-goal-durable.json`, `boot/boot-2.json`. Decisive: after a real SIGKILL and a
  cold boot on the same `DSH_HOME` — the Team and Member rows, the collected result, the
  Goal folded from the session's own `goal/change` records (phase/revision/rounds
  unchanged), the per-leg consumption facts (1,1,1,0), and zero new session records / zero
  new mock requests over a 20 s quiet window.

## 5. Packaged vs worktree — what changed

1. **The boot composition is not the acceptance composition.** Alpha.6 routing is composed
   **per root**, and the boot root's notifier needs the Officer to be a boot seed member.
   The driver therefore boots, then creates the acceptance Team at runtime over
   `team.create` (contract v1 so `initialWork` is honoured). The *whole flow* still runs
   through the installed tarball; nothing reads `packages/**` from the worktree.
2. **The governed plane is required for an approved member shell to execute.** Without
   `teamToolPlane` (and the shipped landlock launcher, which the tarball carries), the
   approved call dies at the dispatch binding gate — see F-4. The plane's launcher path and
   sha come from the **installed** package, not the worktree.
3. **The v5/A6 route and the A5 governed-realm preset are disjoint on this candidate** —
   F-1.
4. The tarball is recorded by identity, never committed (4.3 MB binary; see `.gitignore`).

## 6. Findings (reported, not worked around)

- **F-1 — `memberIoCeilings` cannot travel through the v5 product path.**
  `derivedMembersOf` (`packages/runtime/team-services/src/product-assembly.ts:724`) refuses
  `bound.schemaVersion !== 4` with `MEMBER_POLICY_WITHOUT_BLUEPRINT`. A v5 blueprint (the
  only route that can produce a durable human approval at all) can therefore never carry
  the A5 governed-realm ceilings; the two acceptance routes are disjoint on this candidate.
  This driver takes the v5/A6 route and says so.
- **F-2 — “declared ask lane” and “Goal tools on one Member” are mutually exclusive.**
  The A2C-2 coverage gate (`operation-permission/permission-coverage.ts`) is fatal for any
  tool outside the managed vocabulary on an agent that declares
  `capabilities.permissions`. A Member that declares the `bash` ask lane must therefore
  also declare `builtinToolDeny` for the 19 unmanaged names — which removes `create_goal`/
  `update_goal`. The Goal arm consequently runs on a third Member without `capabilities`.
  Not hidden: the packaged artifact cannot, on this candidate, demonstrate “one Member that
  both asks for shell and owns a Goal”.
- **F-3 — the Alpha.6 Officer hop does not engage for the *permission* leg.** The
  pre-execute adapter builds its case leg without `blueprintContentHash`/
  `blueprintRevision` (`pre-execute-adapter.ts:1905` → `control/service.ts:5590`), so
  `resolveAssignedOfficer` (`assigned-officer-facts.ts`) refuses it and the wake goes to the
  Leader. The Officer hop engages only for the **plane** leg (`team-tool-execute`, built by
  the PA bridge with the hash). Recorded as a limitation of the candidate, not bridged by
  the driver.
- **F-4 — an approved body does not execute without a tool binding.** With only the
  permission lane (no plane), the human allow is consumed and the dispatch is then refused:
  `team tool guard: the Tool Binding for "bash" cannot be verified at dispatch time (no
  fallback to the native body)`. Consequence worth stating plainly: **a human allow can be
  consumed with no execution**, because consumption precedes the dispatch binding check.
- **F-5 — the second governed ask on the same root is not Officer-routable.** On the Stop
  arm the Officer's `team_resolve_control{decision:'escalate'}` is refused with
  `CONTROL_RESOLVER_NOT_AUTHORIZED … the trusted review-facts port produced no facts for
  this leg`; the human resolves that plane leg directly. The fence assertions are
  unaffected (the leg is a real governed leg), and the refusal is recorded per run
  (`flow/stop-human-discovery.json#escalated=false`).
- **F-6 — the Stop terminal shape is not forced to agree.** Both runs ended
  `already-decided` with **no** `control-request-abandoned` row (the A6-12 family can also
  end in an abandonment row, e.g. reason `invocation-cancelled-before-consumption`, as the
  worktree boot recorded on a different candidate revision). What is agreed and asserted is
  the decisive part: no consumption, no execution, no side effect, late allow refused. No
  “0/∞” claim is made.

## 7. What this record does not prove

- Not a stability proof: two agreeing runs are existence-plus-agreement.
- Not a real-vendor-model claim: the model transport is the in-tree scripted mock (same
  oracle class C2-B used). The ordinary-install claim with the same mock is
  `../v016-acceptance/install-flow.mjs` (n=1).
- No GUI click, no browser: approvals/Stop are the exact RPCs the buttons issue.
- No Alpha.5 per-tool I/O matrix (C2-A) and no V@B claim.
- The installed profile is `web` (the same profile shape the GUI uses) but the GUI itself
  was not rendered; `:3080` was never touched.

## 8. Scratch hygiene

Worlds are created under `tests/homes/` and deleted by identity; `tests/homes` is empty
after both runs. The packed tarballs stay in the run dirs only during a run and are ignored
by `dev/agent-workflow/evidence/v016-packaged-acceptance/.gitignore` (identity is recorded
instead). The pristine host checkout was byte-clean before and after both runs
(`HYG-1`).
