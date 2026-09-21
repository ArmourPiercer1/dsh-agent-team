# vision-review.md — Vision Toolkit verdicts on the live screenshots (guide §9)

Tooling: DSH Vision Toolkit (`vision-skills`) — `vision_glance` (VLM QA)
on real screenshots of the live host, with `vision_crop` to build
upload-sized bands (the VLM endpoint times out on the full ~3700px
images). Where a VLM call could not be completed (endpoint timeout on
a specific upload), the DOM geometry probe from the same live page
(`bsk evaluate`, read-only computed-style/bounding-box reads) is
recorded as the authoritative measurement — the screenshots remain
the visual artifact; the probe is the numeric proof.

## PR #27 (branch `fix/team-tab-width-column` @ a45b088)

### 27-A — `27-A.png` (2140×1048 viewport, wide; axis cap 920px active)

VLM verdict on full-width band (3745×760 device px):

1. **Centered column with balanced margins: YES** — "左侧存在明显空白
   …右侧同样有从卡片右缘延伸到窗口右缘的空白；两侧留白大致对称/均衡，
   内容列整体位于主内容区中央，而不是贴靠某一侧".
2. **One consistent column: YES** — 时间线 card, leader card and worker
   card left edges aligned AND right edges aligned, same column, no
   width mismatch.
3. **Clipping / horizontal scrollbar: NONE.**

DOM probe corroboration (same live page): axis
`--dsh-chat-content-width` resolved = **920px** (clamp max); TeamView
`.body` box-sizing = **border-box**, total box **968px** (= 920 + 48
padding, the exact `max-width: calc(var(...) + 48px)` value), content
920px; column center 1205.0px == host viewArea center 1205.0px (perfect
centering); `document.scrollWidth 2140 == clientWidth 2140`.

**Verdict: PASS** — section titles + cards follow the conversation
width axis at the default (cap-active) width; no left-anchoring
regression, no overflow.

### 27-B — `27-B.png` (default 1044×1041 Agent Window; axis min clamp 680px)

VLM verdict on band starting inside the content area (960×660 device
px, the only upload the endpoint accepted for this image after 3
timeouts on wider bands):

1. **One consistent column: YES** — "标题（时间线、成员组、治理）左边缘
   在同一条垂直线上相互对齐；卡片左边缘也在同一条垂直线上相互对齐，
   相对于标题有统一的向右缩进".
2. The VLM also reported the card right sides "cut off" at the image
   right edge — that is a **crop boundary artifact** of that band (crop
   ends at device x=1400 = CSS x≈800, while the column continues to
   CSS x=1021 and the window edge is CSS x=1044). The wider band that
   includes the true window edge (`27-B-band2`, 1387×660) timed out at
   the VLM endpoint 3× (endpoint flakiness, logged in browser-run.md);
   the missing pixel claim is settled by the DOM probe instead.

DOM probe corroboration (same live page): axis resolved = **680px**
(clamp min: 1044×0.64 = 668 < 680); `.body` **border-box**, **728px**
(= 680 + 48) @ x=293, `max-width: 728px`; column right edge CSS x=1021
< viewport 1044 → **13–23px margin to the window edge, no clipping**;
`document.scrollWidth 1044 == clientWidth 1044`.

**Verdict: PASS** — at the narrow host width the column followed the
axis down (920→680) and stayed a single centered column inside the
container.

### 27-C — `27-C.png` (640×800 emulated small viewport)

VLM verdict on full-width band (1120×760 device px):

1. **All five section titles + their cards on one consistent column:
   YES** — same left edge throughout (时间线/成员组/治理/活动与进度/团队事件).
2. **Right margin present: YES** — column right edge stops short of the
   window edge (no right-side scrollbar, no horizontal scrollbar).
3. **Clipping: NONE** — no card or text cut off; the column does not
   reach the window edge on either side (the sidebar is auto-collapsed
   at this width, which is host UI behavior, not team CSS).

DOM probe corroboration (same live page): axis wanted 728px total,
container is only **574px** → `.body` clamped via `width:100%` to
**574px border-box** (total box ≤ container — the exact pre-fix
overflow case: content-box `width:100%` + 48px padding would have been
622px > 574px, pushing `document.scrollWidth` to 688); content region
526px; section title box 526px (same column, +24 padding offset);
`document.scrollWidth 640 == clientWidth 640` → **no horizontal
overflow**.

**Verdict: PASS** — small viewport: no horizontal overflow, column
clamps to the container, titles/cards stay aligned.

**PR #27 overall: PASS (3/3 scenarios).**

(The PR #28 scenarios were reviewed in a separate live run on branch
`fix/member-command-dialogs`; those verdicts live in that branch's
evidence package in the same directory.)
