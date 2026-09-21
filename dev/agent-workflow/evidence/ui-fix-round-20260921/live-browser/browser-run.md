# browser-run.md — live-browser session log, PR #28 (guide §9)

Real Chromium Agent Window driven by the installed `browser-skill`
(browser_* tools + the bsk CLI on the same daemon). No jsdom/RTL
substitution. Companion to the PR #27 session log committed on branch
`fix/team-tab-width-column`.

## Run history (two worlds)

1. **World 1 (aborted)** `liveui-mmanddialogs-2026-09-21T16-04-06` —
   kit `run-mmanddialogs-2026-09-21T16-04-06.aborted-missing-teamEnvelope/`.
   The inline blueprint shipped **without a `teamEnvelope` field**; the
   runtime admission layer fails closed (`envelope.ts`: "an absent
   `teamEnvelope` = the empty set"), so both `team_delegate` calls were
   rejected `TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS` and the drive chain
   dead-ended (`LIVEUI_EXTRACT_FAIL`). Run aborted, world removed,
   logs token-scrubbed and retained for the record.
2. **World 2 (the evidence run)** `liveui-mmanddialogs-2026-09-21T16-09-22` —
   kit `run-mmanddialogs-2026-09-21T16-09-22/`. Kit fixed: the blueprint
   now carries `teamEnvelope.allow` = the full closed mutation-op
   vocabulary (`assign-task, create-member, send-message,
   report-progress, request-control, resolve-control, archive-member,
   restore-member, dispose-member`), `deny: []`. (The fix went into the
   kit in both worktrees; the kit is evidence tooling, not plugin
   source.)

## World 2 session

Host `http://127.0.0.1:3181`, mock 3491, control 3492; auth via boot
token (303 + cookie). Session `team-root` un-blanked with one mock NOOP
probe turn (the Web UI hides zero-turn `blank: true` sessions from the
sidebar list — a UI listing detail, not a team defect), then
`POST /drive` ran the scripted leader chain (mock decisions, from the
kit log): `team_delegate → WORK_DONE_A` (instance
`inst-19ze2gq0ux9r` RUNNING→**SETTLED**), `team_delegate → WORK_DONE`
(same instance RUNNING→**SETTLED**), `team_archive_member`
(SETTLED→**ARCHIVED**), final text `LIVEUI-TEAM-DONE`.

**Runtime shape note (drives the scenario order below):** `team_delegate`
targets a *template* and resolves to the template's existing live
instance — the runtime admitted the second work on the **same** instance
(`inst-19ze2gq0ux9r`) instead of creating a second one (see the
`member-lifecycle-changed` facts in 团队事件: two `delegate` facts, both
`targetInstanceId: inst-19ze2gq0ux9r`). The world therefore contains
**one** member that walked ARCHIVED via a full lifecycle, rather than the
kit's nominal two-member end state (worker-a SETTLED + worker-b
ARCHIVED). All five guide scenarios are still fully coverable: the single
ARCHIVED member serves 28-E, and after the direct restore it is the
SETTLED member for 28-A/B/C/D. Scenario execution order was therefore
**E → A → B → C → D** (the guide's listed order assumes two members and
cannot be followed literally in a one-member world).

## Scenarios (world 2, branch head 14a6b25)

### 28-E — ARCHIVED 「恢复」 → NO modal, direct restore (executed first)

UI state: 成员组 shows the member row `worker · 0 活跃` with instance row
**已归档 暂无动作** and buttons **[「恢复」, 「处置」]** (「恢复」 without
ellipsis — the direct-action affordance per §23.4). Screenshot:
`28-E-pre.png`. Clicked 「恢复」.

Immediate verification (real page):
- DOM: `document.querySelectorAll('[role=dialog]')` → **0** (no modal
  opened; the two host overlay-layer containers are the app's permanent
  portal infrastructure, empty).
- Row flipped in place to **已结算** with the 4-button SETTLED set
  [「发送消息…」「恢复…」「归档」「处置」].
- Durable ledger: new fact `restore-member`
  `{action: "restore-member", caller: {kind: "human", humanId:
  "team-root"}, from: "ARCHIVED", to: "SETTLED", steps:
  ["commit-restore"]}` — a **human** caller (not the leader), exactly the
  direct-restore semantics the existing spec test pins.
- Screenshot after: `28-E.png`.

**28-E: PASS** — no dialog, direct effect.

### 28-A — narrow width: all SETTLED-row action buttons visible

Emulated per-tab viewports on the live tab: 640×800 and 480×800.

DOM probes (real page, `.actions` cluster of the SETTLED row):

| viewport | visible buttons | cluster | overflow | document |
| --- | --- | --- | --- | --- |
| 640×800 | 4/4 — 发送消息…(69px) 恢复…(47px) 归档(39px) 处置(39px), one line y=357 | scrollW 213 == clientW 213, `flex-wrap: wrap` armed | none | `scrollWidth 640 == clientWidth 640` |
| 480×800 | 4/4, one line (x 131..344) | scrollW 213 == clientW 213 | none | `scrollWidth 480 == clientWidth 480` |

No clipping, no horizontal scrollbar at either width; the wrap safety net
stays armed for sub-213px cluster space. Screenshot (480px, the
narrowest tested): `28-A.png`.

**28-A: PASS.**

### 28-B — SETTLED 「恢复…」 → followup dialog, centered

Clicked 「恢复…」 on the SETTLED row (default 1044×1041 window).

DOM probe (real page): `[role=dialog]` present — rect x=332 y=417
w=380 h=206 → center **(522, 521)** vs viewport center **(522, 520.5)**:
centered to <0.5px. Title 「向 worker-a 发送任务」, text field, footer
[「取消」「发送」], header × close, masked parent. Screenshot: `28-B.png`.
Closed with **Escape** → dialog count 0, `mockDecisions` unchanged (9),
lifecycle unchanged → Escape = cancel, **no command ran**.

**28-B: PASS.**

### 28-C — 「发送消息…」 message modal renders

Clicked 「发送消息…」。 DOM probe: `[role=dialog]` — title 「给
worker-a 发消息」, center **(522, 521)** == viewport center, fields:
INPUT + TEXTAREA, **both `box-sizing: border-box`** (the supplemental
form-control fix), width 332px each, right edge 688 ≤ card right 712
(fields stay inside the card — the pre-fix content-box math overflowed
by the padding). Footer [「取消」「发送消息」]. Screenshot: `28-C.png`.
Closed with Escape → no message sent (mock decision count unchanged).

**28-C: PASS.**

### 28-D — 「归档」 confirm modal (closed WITHOUT confirming)

Clicked 「归档」. DOM probe: `[role=dialog]` — title 「归档该成员？」,
body 「归档后，该成员将不再接收新的团队任务，直到恢复。」, footer
[「取消」「归档」], header × close, center (522, 521) == viewport center.
Observe confirmed the modal layer: `L1 modal cover=100%` (mask covers the
whole page). Screenshot: `28-D.png`. Closed by clicking the explicit
**「取消」** button → dialog count 0, lifecycle **still SETTLED**,
`ledgerFacts` unchanged (no archive fact), `mockDecisions` unchanged —
**no confirmation executed**.

**28-D: PASS.**

**PR #28 real-browser verdict: PASS (28-A, 28-B, 28-C, 28-D, 28-E)** —
see `vision-review.md` for the Vision Toolkit per-scenario verdicts.
