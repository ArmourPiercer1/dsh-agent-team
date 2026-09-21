# browser-run.md — live-browser session log, PR #28 (guide §9)

Real Chromium Agent Window driven by the installed `browser-skill`
(browser_* tools + the bsk CLI on the same daemon). No jsdom/RTL
substitution. Companion to the PR #27 session log committed on branch
`fix/team-tab-width-column`.

## Run history (five worlds)

1. **World 1 (aborted)** `liveui-mmanddialogs-2026-09-21T16-04-06` —
   kit `run-mmanddialogs-2026-09-21T16-04-06.aborted-missing-teamEnvelope/`.
   The inline blueprint shipped **without a `teamEnvelope` field**; the
   runtime admission layer fails closed (`envelope.ts`: "an absent
   `teamEnvelope` = the empty set"), so both `team_delegate` calls were
   rejected `TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS` and the drive chain
   dead-ended (`LIVEUI_EXTRACT_FAIL`). Run aborted, world removed,
   logs token-scrubbed and retained for the record.
2. **World 2 (the round-1 evidence run)**
   `liveui-mmanddialogs-2026-09-21T16-09-22` — kit
   `run-mmanddialogs-2026-09-21T16-09-22/`. Kit fixed: the blueprint now
   carries `teamEnvelope.allow` = the full closed mutation-op vocabulary
   (`assign-task, create-member, send-message, report-progress,
   request-control, resolve-control, archive-member, restore-member,
   dispose-member`), `deny: []`. (The fix went into the kit in both
   worktrees; the kit is evidence tooling, not plugin source.)
3. **World 3 (aborted)** `liveui-mmanddialogs-2026-09-21T16-54-33` —
   kit `…16-54-33.aborted-mock-ordering/`. Kit bug: the mock scripted
   the second `team_delegate` BEFORE the first work-admission decision
   → the runtime had no admitted work to settle → drive timeout. Kit
   fixed (mock decision order now matches the durable admission order).
4. **World 4 (aborted for an envelope bug, kept for the predicate
   proof)** `liveui-mmanddialogs-2026-09-21T16-57-49` — kit
   `…16-57-49.aborted-progress-envelope/`. Kit bug (measured from the
   member's durable transcript, multi-frame zstd decode): a member
   caller's envelope is `teamEnvelope ∩ <its template's
   memberEnvelopes entry>` (fail-closed), and the blueprint shipped
   `memberEnvelopes: []` → the member's `team_report_progress` was
   rejected `TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS` with
   `inBounds: []`. Kit fixed: the worker template now carries
   `memberEnvelopes: [{… allow: [report-progress], deny: []}]`. The
   run's `summary.json` still proves the drive predicate: `verdict:
   PASS`, `drive: {sent: true, done: true}` — the predicate's ordered
   subsequence (`SETTLED → SETTLED → ARCHIVED` on one instance) is the
   runtime's durable schema.
5. **World 5 (aborted)** `liveui-mmanddialogs-2026-09-21T17-06-39` —
   kit `…17-06-39.aborted-bootstrap-race/`. Kit bug: the kit's own
   explicit `session/create(team-root)` landed between the plugin
   bootstrap's existence check and its create → `bootstrap FAILED:
   SessionAlreadyExistsError` → the team runtime never wired the root
   session's team tools → drive timeout. Kit fixed: the kit **never
   creates** the root session anymore — the SESS step waits for the
   plugin bootstrap's durable commit (bootPhase `create-or-open` on the
   host row owns it) and fails closed on `bootstrap FAILED`.
6. **World 6 (pre-CSS-fix, superseded)**
   `liveui-mmanddialogs-2026-09-21T17-14-58` — kit
   `…17-14-58.superseded-pre-row-fix/`. First run at the merged head
   `bf80c96`: drive PASS in ~2s (9 mock decisions, 13 ledger facts
   incl. `activity-progress-recorded` with the long
   `lastAction`), UI 恢复 re-verified. The 28-A2 forced-wrap
   investigation ran on THIS world and measured the layout bug (below)
   → the world's bundle is pre-fix, so this run is the bug record, not
   the final evidence.
7. **World 7 (FINAL)** `liveui-mmanddialogs-2026-09-21T17-45-17` — kit
   `run-mmanddialogs-2026-09-21T17-45-17/`, at the final product head
   `3acb7bc` (border-box fix + regenerated bundle). Drive
   sent+done in ~2s, 9 mock decisions, 13 ledger facts; UI 恢复
   re-verified (direct, human caller); **28-A2 PASS** (below).
   `summary.json`: `verdict: PASS`,
   `drive: {sent: true, done: true}`, 13/13 criteria, zero-touch
   401==401, test-use byte-clean, port released.

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

## Supplemental round (2026-09-22) — the forced wrap (28-A2) and the row box-model bug

### Run 6 (pre-fix tree, head `bf80c96`) — the wrap investigation

Drive PASS in ~2s (9 mock decisions; 13 durable ledger facts incl. the
`activity-progress-recorded` fact with the long `lastAction` from the
member's `team_report_progress` — the envelope fix from run 4 worked).
UI 恢复 click on the ARCHIVED row re-verified the direct-restore
semantics (fact: `restore-member`, human caller).

The guide's 28-A2 scenario requires a REAL wrap: the SETTLED row's
`.actions` available width < the 4-button single-line intrinsic
(213px), with ≥1 button genuinely on line 2. Two recipe dead-ends
measured first:

- **Long-text row recipe (dead):** the row's `currentAction` slot is
  structurally always empty in production — the durable v1 record
  carries no per-row `activity` (`projection-source.ts`: absent for
  every row), the live overlay sets only `residency` +
  `lastActivityAt`, and the client fallback chain
  (`projection-adapter.ts`) therefore always resolves to
  `暂无动作`. The progress fact feeds only the 活动与进度 panel (and the
  团队事件 list) — it cannot widen the row.
- **Block-only wrap (insufficient):** at 480px the ROW-level
  `flex-wrap` moves the whole `.actions` block to line 2 (contained,
  no clip — which is why round-1 28-A passed at 480px) but the buttons
  themselves stay on one line inside the block → `wrapped=false`.

The measurement that found the bug (computed-style probe, 1044-class
window): `.instanceRow` is a DIV with `width:100%` + `padding:
6px 10px 6px 18px` and **content-box** sizing → its border box =
parent content + 28px → the row overflows the group (which has
`overflow:hidden`); the `.actions` cluster, pinned
`justify-content:flex-end` to the row's content right edge, sits 18px
PAST the card's right edge:

| pre-fix @ default window (1044 class) | value |
| --- | --- |
| group card | x 350 → 964 |
| row | x 350 → 992 (**+28px overflow**; computed `box-sizing: content-box`, width 613.714px + 28px padding) |
| actions | x 769 → 982 (213, one line) — right edge 18px past the card |
| 处置 (trailing button) | x 943 → 982 — **18px clipped** (only 「处」 visible; screenshot in the pre-fix run dir) |
| worker group header `+` | content-box DIV row, 20px overflow — `+` right 423 vs card right 413 → **10px clipped** at all widths (the leader header is a `<button>` = already border-box via the #28 form-control rule, so only the worker header was affected) |

Consequence: the §1 acceptance (`wrapped===true` AND 4/4 fully visible
AND contained) was unsatisfiable at **every** viewport width — at the
widths where the buttons wrap, the shrunk `.actions` box right edge
still lands 18px past the card and clips the wrapped line's last
button. Per the guide ("if the wrap reveals a layout bug → minimal CSS
fix, then repeat"): **`box-sizing: border-box` on `.instanceRow` and
`.groupRow`** (commit `3acb7bc`, source + regenerated
`client-bundle.js` same commit; 2 lines + comments, no layout
restructure).

### Run 7 (FINAL, head `3acb7bc`) — session

Host `http://127.0.0.1:3181`, mock 3491, control 3492; auth via boot
token (303 + cookie); beta modal dismissed (继续). Team tab: leader
group (team-mode row) + worker group. `POST /drive` → done in ~2s
(`drive: {sent, done}`, 9 mock decisions, 12 lifecycle-ledger facts).
Reload for a fresh UI. Member row **已归档** with [「恢复」,「处置」]:
clicked 「恢复」 → **no dialog** (0 `[role=dialog]`), row flipped to
**已结算** with the 4-button cluster, durable fact seq 13
`restore-member` `{caller: {kind: "human", humanId: "team-root"},
from: "ARCHIVED", to: "SETTLED", steps: ["commit-restore"]}` — 28-E
re-verified at the final head.

### 28-A2 — forced real action-button wrap (guide §5.4)

The exact guide geometry probe (rows by `data-status='settled'`, group
via `row.closest('[data-member-group]')`, actions
`[data-member-action-button]` rects; `wrapped =
new Set(rounded button tops).size > 1`; `contained = a.left >=
g.left-1 && a.right <= g.right+1`):

**Default window (outer 1044×900; probe viewport 976×754) — post-fix:**

| measure | pre-fix (run 6, measured) | post-fix (run 7, measured) |
| --- | --- | --- |
| row | 350→992 (642) = card + **28px** | 204→818 (614) = **card box exactly** |
| group | 350→964 | 204→818 |
| actions | 769→982, `contained=false` | 595→808 (213, one line), **`contained=true`** (808 ≤ 818, 10px inside) |
| 处置 | 943→982, **18px clipped** | 769→808, **fully visible** |
| worker header `+` | 10px clipped | fully visible (zoom pass) |
| `wrapped` / doc hscroll | false / none | false / none |

Screenshot: `28-A-postfix-1044.png`.

**360×800 emulated viewport (CDP `bsk emulate --width 360 --height 800
--mobile`) — the wrap:**

| measure | value | acceptance |
| --- | --- | --- |
| `wrapped` (distinct button-top count) | **true** — line 1 tops y=408, line 2 y=433 | ≥1 button on line 2 ✓ |
| line 1 | 发送消息… (160→230, 69px), 恢复… (236→283, 47px) | — |
| line 2 | 归档 (199→238, 39px), 处置 (244→283, 39px) | — |
| buttons fully visible | 4/4, right edges ≤ 283 < card right 293 | 4/4 visible ✓ |
| `.actions` | 131→283 (152), `scrollWidth 152 == clientWidth 152` | `scrollWidth <= clientWidth` ✓ |
| `contained` (actions vs group) | 131 ≥ 113-1 and 283 ≤ 293+1 → **true** | within group right edge ✓ |
| document hscroll | `scrollWidth 360 == clientWidth 360`, none | no hscroll ✓ |
| overlap | line gaps 6px (230→236, 238→244), no crossing | no overlap ✓ |
| row vs card | row 113→293 == group 113→293 (border-box fix in effect) | — |

Screenshot: `28-A2-actions-wrapped.png`. Vision Toolkit (guide §5.4's
four questions + collision + hscroll) — see `vision-review.md`:
**6/6 PASS**, plus a zoomed-region pass confirming every button's
right border is fully drawn inside the card with a visible gap (and
the worker header's `+` unclipped).

**28-A2: PASS.**

**PR #28 real-browser verdict: PASS (28-A, 28-A′, 28-A2, 28-B, 28-C,
28-D, 28-E)** — see `vision-review.md` for the Vision Toolkit
per-scenario verdicts.
