# PD-35 — STOP-OUTCOME: the re-read after `goals/pause` now decides the result, and only `paused` means "stopped"

Lane `PD35-STOP-OUTCOME`. Branch `task/pd35-stop-classify-20261116`, worktree
`.worktrees/pd35-stop-classify`, base `origin/master` = **`87484ded1`** (Preview GO).
This is a **client result-classification fix only**: no Goal service, no Agent Runtime,
no Team identity model, no new `disarm`, and the four-RPC control sequence
(`goals/get → goals/pause → session/cancel → goals/get`) is unchanged — the E2E arm
compares that exact array.

## 1. What the external review found (and the maintainer's verification)

An independent external review of the Preview-GO tree (`master = 87484ded1`) reported a
verified P1: in `packages/client/src/model/member-stop.ts`, `stopMember()` performs the
durable re-read (`observedPhase`) after `goals.pause` and then returns `kind:'stopped'`
**whatever that read returned**. Three different situations were collapsed into one
success:

| Situation after the pause | Old result | What the UI rendered |
| --- | --- | --- |
| re-read `paused` | `stopped` | `已停止：目标 phase=paused …` (correct) |
| re-read `active` (or any non-`paused`) | `stopped` | `已停止：目标 phase=active …` — self-contradictory |
| re-read failed / no value | `stopped` | `已停止：目标 phase=<pause phase> …` — invented |

The maintainer's复核 conclusion, recorded in the register row: **审查准确 —
`observedPhase` 被采集但未参与分类，测试固化了该行为**. The old test
`reports the phase it actually observed on the second read (never smooths "active")`
allowed `observedPhase='active'` and still asserted `kind==='stopped'`; it pinned the
defect rather than the contract, and it has been replaced.

## 2. What changed (client verdict and display only)

`MemberStopOutcome` now has three pause-written results, classified by the **last read
alone**:

| Result kind | Condition | UI copy (zh) |
| --- | --- | --- |
| `stopped` | re-read confirms `paused` | `已停止：目标 phase=paused（rev {revision}），回合中止={cancel}` |
| `pause-contradicted` | pause written, re-read is non-`paused` (`observedPhase` is that phase) | `暂停已写入（rev {revision}），但最新读取仍是 {phase}：未确认停止，请重试或核对；回合中止={cancel}` |
| `pause-unverified` | pause written, re-read refused / threw / returned no goal (`observedPhase=undefined`) | `暂停已写入（rev {revision}），但未能确认最终状态（重读失败）；请重试或核对；回合中止={cancel}` |

The `cancel` outcome remains a **field** on all three results (a detach is not a failed
stop). `undefined` is never normalised to `paused` or `active` (the report's §4.5 rule:
a missing observation is unknown, not a phase). The English dictionary carries the same
two new keys (`member.stop.contradicted`, `member.stop.unverified`).

Files: `packages/client/src/model/member-stop.ts` (classification),
`packages/client/src/ui/TeamMembers.tsx` (`stopNote`), `packages/client/src/ui/locales.ts`
(zh + en), tests `packages/client/test/member-stop-model.test.ts` and
`packages/client/test/team-member-stop.client.spec.tsx` (jsdom, real component). The
mount-level wiring test's fake `goals.get` now answers the post-pause durable state, so
its `stopped` assertion is still meaningful.

## 3. Why this needs no boot

There is **no Host behaviour change**: no Goal service method, no goal-round driver, no
activation/disarm path, no Team lifecycle, no permission surface. The change is a pure
client model + copy verdict over the same public RPC replies, verified host-free:

- model suite: sequence, three classifications, cancel-as-field, negatives;
- component suite (jsdom): the three user-visible sentences, and `已停止` is absent for
  the two unconfirmed results;
- mount suite: the face still reaches `goals`/`session` with the same four-call order.

The existing live evidence for the mechanism (PD-34, `a5sf-pd34-member-stop/`, and the
PD-33 S1c arm) is unchanged and remains the live measurement of the four RPCs; this lane
adds no RUN record and claims no `V@B`.

## 4. Backstops

- `pnpm --filter @dsh-agent-team/client test` (model + component + mount);
- `pnpm -r typecheck`, eslint on the touched files;
- `check:artifacts:head` — the committed client bundle is rebuilt in this PR; the drift
  list IS this classification/copy change (no unrelated generated code);
- `check-artifacts-committed`, `doc-checks`/`docs:probe`, register contiguity
  (`a5sf-debt-register.test.mjs`), `ci-pr-gate --only state-freshness`,
  `eb3-evidence-guard`, `eb3-run-manifest`.

## 5. Docs alignment

`docs/PREVIEW-STOP-SEMANTICS.md` §2/§2.2 and
`docs/plans/active/alpha5-sandbox-first/PREVIEW-READINESS-2026-11-15.md` §4.1/§4.4 now
describe the three results. The readiness report keeps its verdict and dates; an
append-only dated correction records that §4.1 previously disagreed with the
implementation and was fixed by this PR.
