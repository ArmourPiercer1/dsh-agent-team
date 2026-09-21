# vision-review.md — Vision Toolkit verdicts on the live screenshots, PR #28 (guide §9)

Tooling: DSH Vision Toolkit (`vision-skills`) — `vision_glance` (VLM QA)
on real screenshots of the live host, with `vision_crop` bands where the
VLM endpoint times out on the full 1827px images. Where the VLM flagged
an artifact of a crop boundary, the DOM geometry probe from the same
live page (`bsk evaluate`, read-only) is the authoritative measurement.
The PR #27 scenario verdicts live in the sibling evidence package on
branch `fix/team-tab-width-column`.

## 28-A — `28-A.png` (480×800 emulated viewport, narrowest tested)

VLM verdict on the full screenshot (840×1400 device px):
"4 个按钮，标签为「发送消息… / 恢复… / 归档 / 处置」；无裁切、无溢出、
无横向滚动条；单行排布且全部完整可见" — all four button boxes fully
rendered, rightmost 处置 leaves margin to the card edge, no horizontal
scrollbar.

DOM probe corroboration (same live page): at 640px and 480px, 4/4
buttons visible; `.actions` `scrollWidth == clientWidth` (213px),
`flex-wrap: wrap` armed; `document.scrollWidth == clientWidth` at both
widths.

**Verdict: PASS** — narrow width: every SETTLED-row action button
visible (wrap available, clip none).

## 28-B — `28-B.png` (「恢复…」 followup dialog)

VLM verdict on the dialog band (1000×700 device px): dialog card titled
「向 worker-a 发送任务」 with 任务内容 field and footer buttons; "大致
位于可见区域的中央位置，四周均被遮罩覆盖的空白区域所环绕" (centered,
surrounded by the masked area); background "模糊且变暗" (blurred +
dimmed mask); buttons 取消 / 发送 + × close icon top-right.

DOM probe corroboration: dialog rect center (522, 521) vs viewport
center (522, 520.5) — centered to <0.5px; Escape closed it with zero
command side effects (mock decision count and lifecycle unchanged).

**Verdict: PASS** — followup dialog renders, centered, cancellable
without effect.

## 28-C — `28-C.png` (「发送消息…」 message modal)

VLM verdict on the dialog band (1000×820 device px): title 「给
worker-a 发消息」; 主题（可选）textbox + 消息内容 textarea, "左右边缘和
上下边缘都完整地位于白色对话框卡片内部，没有溢出或超出卡片边框" (both
form controls fully inside the card); buttons 取消 / 发送消息 + × close;
centered with semi-transparent blurred mask.

DOM probe corroboration: dialog center (522, 521) == viewport center;
INPUT + TEXTAREA both `box-sizing: border-box`, width 332px, right edge
688 ≤ card right 712 (the supplemental border-box fix, visible).

**Verdict: PASS** — message modal renders; form controls respect the
card's content box.

## 28-D — `28-D.png` (「归档」 confirm modal)

VLM verdict on the dialog band (1000×700 device px): title 「归档该成员？」
+ body 「归档后，该成员将不再接收新的团队任务，直到恢复。」; buttons
取消 / 归档 + × close icon; "在页面中居中显示，背后有一层被调暗且模糊
处理的遮罩层" (centered, dimmed blurred mask).

DOM probe corroboration: dialog center (522, 521) == viewport center;
observe layer model `L1 modal cover=100%` (full-page mask); closed via
the explicit 「取消」 button → lifecycle stayed SETTLED, no archive fact
written, no model calls.

**Verdict: PASS** — confirm modal renders; closing without confirming
leaves the member SETTLED.

## 28-E — `28-E-pre.png` + `28-E.png` (ARCHIVED 「恢复」 direct)

VLM verdict on the before/after row pair (1300×340 device px each):
before — row state 「已归档 暂无动作」 with buttons 「恢复」 and 「处置」
(the 处置 label cut by the crop boundary); after — row state 「已结算
暂无动作」 with the four-button SETTLED set, and "图 2 中没有任何对话框、
弹出层或遮罩打开 … 符合『恢复操作直接生效、不弹出确认层』的预期" (no
dialog/popover/overlay anywhere; matches direct-effect expectation).

DOM probe corroboration (same live page): after the click
`[role=dialog]` count = 0; durable ledger gained the fact
`restore-member {caller: {kind:"human"}, from:"ARCHIVED", to:"SETTLED"}`
— direct human restore, no modal in between.

**Verdict: PASS** — ARCHIVED 「恢复」 is a direct action: no modal,
row → SETTLED.

**PR #28 overall: PASS (5/5 scenarios).**
