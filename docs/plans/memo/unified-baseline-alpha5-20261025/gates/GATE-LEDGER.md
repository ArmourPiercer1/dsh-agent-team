# GATE-LEDGER — U4/U5/U6 gate verdicts, evidence, carried risks, timeline correction

> Versioned by FIX-D (2026-10-26, external-audit finding D3). Before this file, the G1-F/G3 verdicts and
> their risk ledgers existed only in **untracked local evidence** (`dev/agent-workflow/evidence/u4u5-gates-20261025/`
> and the review directories), so from a cold clone the gates between PR #367's router-log entry and U6 PR1
> looked unrecorded. This ledger is the tracked index; the verdict/review records themselves are the tracked
> copies in this directory. Vocabulary per `docs/ROUTER_RULES.md` §3.2 (通过 / 投机通过 / 补充内容 / 阻塞);
> 投机通过 triggers the §6 risk-ledger duty — the carried risks are recorded below and in the verdict records.

## Ledger

| gate | verdict | date (UTC) | reviewer model | tracked evidence | local / other evidence | carried risks |
| --- | --- | --- | --- | --- | --- | --- |
| G1-I (S1 feasibility baseline) | PASS (追认, per closeout ruling) | 2026-10-25 (closeout 10:04Z–10:17Z rulings) | main agent 追认; S1 line reviewed in-lane | `dev/agent-workflow/SESSION_ROUTER_LOG.md` (2026-10-25 U0–U3 closeout entry) | `dev/agent-workflow/evidence/s1-*` (untracked local; index `dev/agent-workflow/evidence/s1-frozen-refs-index.md`) | none carried by this line |
| G1-F round 1 | 补充内容 (gate暂不通过 → 补充+重审) | 2026-10-25 | gpt-6.1-sol (independent session, not in implementation) | [G1-F-REVIEW-R1.md](./G1-F-REVIEW-R1.md) | `dev/agent-workflow/evidence/u4-g1-f-review-r1/` | 14 findings → user ruling Option B (run group PoCs + oracle/H0 fixes, then final review) |
| G1-F round 2 (final) | **投机通过 → GATE PASS** | 2026-10-25 ~15:1xZ (source record rounds the minute: `2026-10-25T15:1xZ`) | gpt-6.1-sol | [G1-F-G3-REVIEW-R2.md](./G1-F-G3-REVIEW-R2.md), [GATE-VERDICTS.md](./GATE-VERDICTS.md) | `dev/agent-workflow/evidence/u4-h0-20261025/`, `u4-g1f-sup-a-20261025/`, `u4-g1f-sup-b-20261025/`, `u4-g1f-sup-c-20261025/`, `u4-obligations-20261025/`, `u4u5-gates-20261025/` | R-G1F-1..6 in [GATE-VERDICTS.md](./GATE-VERDICTS.md); the 10 center conditions versioned at [../u6/conditions.md](../u6/conditions.md) (R-G1F-3 → U6 condition set) |
| G2 (single current authority switchover) round 1 | 补充内容 | 2026-10-25 | gpt-6.1-sol (per closeout entry) | [G2-REVIEW-R1.md](./G2-REVIEW-R1.md) | `dev/agent-workflow/evidence/u2-g2-review-r1/`, `s2-*` candidate dirs | 6 "missing for switchover" items → implemented before R2 |
| G2 round 2 (final, PR #365) | **通过 → GATE PASS** | 2026-10-25 (snapshot `as20261025r1` published 10:48:40Z) | gpt-6.1-sol | [G2-REVIEW-R2.md](./G2-REVIEW-R2.md), `dev/agent-workflow/SESSION_ROUTER_LOG.md` (U2/G2 entry) | pointer/snapshot in-tree: `dev/engineering/current-authority.json` → `dev/engineering/authority-snapshots/as20261025r1.json` | none open for G2 itself |
| G3 (world-factory / test infra, PR #368) | **投机通过 → GATE PASS** | 2026-10-25 ~15:1xZ (same verdict record) | gpt-6.1-sol | [G1-F-G3-REVIEW-R2.md](./G1-F-G3-REVIEW-R2.md) (G3 section), [GATE-VERDICTS.md](./GATE-VERDICTS.md) | `dev/agent-workflow/evidence/u5-g3-20261025/` (untracked local; `FINDINGS-request-extension.md` now tracked there); PR #368 merged @ `f7fbc0f67` | R-G3-1 **live abnormal-kill crash-reclaim = SKIP — OPEN until FIX-T's live run**; R-G3-2 evidence re-bind on first U6 C2 run; R-G3-3 Windows cleanup ENV_BLOCK; R-G3-4 fresh-home request-extension → backlog |
| Remediation gate R1 (audit 2026-10-26: FIX-D #370, FIX-K #371, FIX-T #372) | **投机通过 → GATE PASS** (merge + conditional U6 enforcing resume) | 2026-10-25 ~18:4xZ | gpt-6.1-sol (independent session) | [REMEDIATION-REVIEW-R1.md](./REMEDIATION-REVIEW-R1.md) | `dev/agent-workflow/evidence/remediation-review-r1/`, `u6-fixk-20261026/`, `u5-fixt-20261026/`, `u6-fixd-20261026/` | R-REM-1 = R-G3-1 narrowed: factory-side crash reclaim LIVE-PASSED; `other-world-unaffected` FAIL ×3 (supervisor sequencing, fixed forward, unrun) — does not block single-World U6 C2; R-REM-2 #373 resumes only after rebase onto merged FIX-K API (scopeKey on every call, enforcing only with lifecycle port, one-shot presentation burn, revoke/generation/source revalidation, no name-only authority) + targeted suites; R-REM-3 shadow-ledger cap-hit evidence in a U6 C2 run |
| U6 PR2 review R1 (read family enforcing) | 阻塞 → 5 blockers fixed (B1 lifecycle fallback, B2 CI-05 native fallback, B3 suite pin, B4 golden path classes, B5 independent oracle) | 2026-10-26 | gpt-6.1-sol (independent) | [U6-PR2-REVIEW-R1.md](./U6-PR2-REVIEW-R1.md) | `dev/agent-workflow/evidence/u6-pr2-review-r1/` | closed by the B1–B5 fix round |
| U6 PR2 review R2 (final) | **通过 → merge PR #373** (0 findings) | 2026-10-26 | gpt-6.1-sol (independent) | [U6-PR2-REVIEW-R2.md](./U6-PR2-REVIEW-R2.md) | PR #373 merged @ `cd54f3b7c`; `dev/agent-workflow/evidence/u6-pr2-review-r2/` | R-U6P2-1 offline install mirror missing `@deepseek-ai/dsh@0.2.0-rc.2` tarball (workaround disclosed); R-U6P2-2 full-suite receipts carry the pre-existing p6t3 baseline reds; R-U6P2-3 earlier C2 boot-budget overage disclosed |
| U6 PR3 review R1 (bash/process, ARC-B) | 补充内容 → sole addition = authorized-positive C2 fixture; closed on forensic disclosure after 4-boot budget | 2026-10-26 | gpt-6.1-sol (independent) | [U6-PR3-REVIEW-R1.md](./U6-PR3-REVIEW-R1.md) | PR #375 merged @ `8337e52cf`; `dev/agent-workflow/evidence/u6-pr3-20261026/` | R-U6P3-1 **governed-bash positive effect NOT live-proven**: ask row birth/persistence/leader-notification/pending-block ARE measured live (u6prc9 `request-created` + notifTurns 0→21); resolve→consume-once→spawn→replay refused carried to **U7** because (a) the runner's control seams targeted the boot team `session-u6proc-root-*` not the governed team `session-u6proc-team-*` (test wiring), and (b) a lane-scoped ask grant is **not representable in blueprint data** (leader resolves without `callerMember`, resolve.ts:246-267; envelope.ts:113-115), so team-root `request-control` necessarily arms the leader lane. R-U6P3-2 `proc:exec-door-fail-closed` deliberately pinned FAIL for the boot-4 leader-arming observation; R-U6P3-3 BL-01 closed at the production seam (not at the live suite). |
| U6 PR4 review R1 (Jobs bridge, ARC-C) | 补充内容 → (1) CI-05 fail-closed for unattributed job ids on governed mounts, (2) authorized boot 7 | 2026-10-26 | gpt-6.1-sol (independent) | [U6-PR4-REVIEW-R1.md](./U6-PR4-REVIEW-R1.md) | `dev/agent-workflow/evidence/u6-pr4-review-r1/` | closed by the fix round (ci05GovernedGatewayRow; boot 7 run) |
| U6 PR4 review R2 (final) | **投机通过 → merge PR #377**; §10.6 ruling **G4-CORE-PASS / BRIDGE-BLOCKED** (not CORE BLOCKER) | 2026-10-26 | gpt-6.1-sol (independent) | [U6-PR4-REVIEW-R2.md](./U6-PR4-REVIEW-R2.md) | PR #377 merged @ `269be49e4`; `dev/agent-workflow/evidence/u6-pr4-20261026/` (7 boots) | R-U6P4-1 **creation-lane attribution producer absent** (no Team-owned seam at this pin) ⇒ under CI-05 no governed job is manageable live; R-U6P4-2 **Team-lane stall** in the u6-jobs World since boot 5 (harness: boot 4→7 changed only tests/world-factory files) + ctl ring-read race (one-line spacer); R-U6P4-3 Jobs effect legs (birth/management/fence/cancel) never measured positive live. BRIDGE-BLOCKED does NOT unlock full G4 / S5 / release |

U6 entry rule as run: U6 required G1-F PASS + G2 PASS + G3 PASS → OPEN after the round-2 verdicts
(`dev/agent-workflow/evidence/u6-prep-20261025/U6-SLICE-PLAN.md` entry gates; versioned at
[../u6/U6-SLICE-PLAN.md](../u6/U6-SLICE-PLAN.md)).

## Timeline correction (explicit — external-audit finding D3)

1. The router-log entry shipped with **PR #367** (2026-10-25 U0–U3 closeout entry,
   `dev/agent-workflow/SESSION_ROUTER_LOG.md`) recorded **"G1-F NOT_PASSED（H0 = UNPROVEN/NEEDS-RULING）⇒ U4 起步"**
   — accurate at the time it was written (round 1 had ruled 补充内容; the closeout entry words it NOT_PASSED).
2. **Later on 2026-10-25 (~15:1xZ)** G1-F was re-ruled **投机通过 (round 2, final)** — recorded only in the
   local evidence file `dev/agent-workflow/evidence/u4u5-gates-20261025/GATE-VERDICTS.md` — **before U6 PR1
   (PR #369) started**. G3 was ruled 投机通过 in the same record.
3. That record was **never committed**. So from the repository alone, no committed artifact said G1-F passed
   at any point between the PR #367 entry and U6 PR1: from the repo the gate looked **skipped**, and the log's
   latest statement still read NOT_PASSED. An **external audit flagged this** as a gate-traceability failure.
   (This is a recording failure, not a ruling forgery: the round-2 review report and the verdict record
   predate PR #369 and are copied into this directory unchanged.)
4. **After the audit**, U6 PR2 was halted, and remediation was required **before any enforcement flip**:
   **FIX-K** (kernel safety K1–K5 — see [../u6/U6-SLICE-PLAN.md](../u6/U6-SLICE-PLAN.md) amendment A-1),
   **FIX-T** (G3 crash-reclaim live run), **FIX-D** (this package: documentation authority + gate traceability).
5. **G3's live crash-reclaim SKIP (R-G3-1) stays an open risk until FIX-T's live run**; until then the kernel
   and any dependent acceptance must not treat reclaim as exercised.

## Machine-authority note (D1 cross-reference)

The machine authority pointer still resolves `active_plan` to
`docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md` (snapshot `as20261025r1`). Making
PR #364's plan the machine `active_plan` is blocked by the frozen snapshot schema + ci-pr-gate Q2 prefix law
(`active_plan` must live under `docs/plans/active/`); see
`dev/agent-workflow/evidence/u6-fixd-20261026/BLOCKED-D1.md` for the refusals and the two compliant unblock
paths. The user ruling (PR #364 = sole implementation plan) is recorded in `AGENTS.md` and the closeout log
entry; this ledger records the gate side.

**Update 2026-10-26 (main agent, BLOCKED-D1 resolved via path 2):** the main agent (user-delegated
authority, user ruling 2026-10-25 "PR #364 = sole implementation plan") placed the carrier
`docs/plans/active/unified-baseline-alpha5/current-implementation-plan.md` (Q6 carriers, links to the #364
plan, copies no plan content), published snapshot `as20261026r1`
(`sha256:93692d7aeb3b097c3b3467e0a9207f1da5f05c2c1cb324c74d25168b1516a4d4`, supersedes `as20261025r1`)
with the existing publisher and moved the pointer with `switch-authority.mjs` (byte precondition =
previous pointer `sha256:5356e8de…725ee`). No schema or Q2 change. Rollback = `git revert` of this commit.

**Update 2026-10-26 (remediation gate):** finding A of the external audit (U6 started while the repo record
still read G1-F NOT_PASSED) is closed administratively by this tracked ledger (G1-F round 2 = 投机通过, row
above) and the remediation gate row. Merges: #370 (FIX-D) → `8ce8513cd`, #371 (FIX-K) next, #372 (FIX-T) after
CI on the updated head. Draft #373 stays halted until the R-REM-2 conditions are met on a rebased head.

**Update 2026-10-26 (U6 PR2/PR3 gate records):** PR #373 (read family, first enforcing slice) merged after a
阻塞→fix→通过 cycle; PR #375 (process/bash family, ARC-B) merged with its positive-effect leg formally carried
to U7 (R-U6P3-1): the governed-bash ask row is proven to exist and block live, but resolving it and observing
the real spawn requires (a) runner control seams pointed at the governed team session and (b) a lane-scoped
ask-grant design that blueprint data cannot express. No product semantic change was made to obtain either.
