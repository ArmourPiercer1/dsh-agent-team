# browser-run.md — live-browser session log (guide §9)

Real Chromium Agent Window driven by the installed `browser-skill`
(browser_* tools + the bsk CLI on the same daemon). No jsdom/RTL
substitution anywhere in this round.

Environment notes (deviations from the happy path, all logged):

- The first Agent Window session (`bvvm`) was closed by the user
  mid-run ("浏览器似乎没有正确启动") — the bsk daemon log records
  `session removed: user closed Agent Window` at 15:38:06. A second
  session (`qkco`) was started and did the 27-A capture.
- The bsk daemon's **full-page screenshot** path hangs indefinitely on
  this page (4 attempts × 30s RPC timeouts; the daemon keeps the
  session busy afterwards). **Viewport-only captures** (bsk CLI
  `screenshot` without `--full-page`) and **scoped element captures**
  work reliably. All evidence screenshots here are viewport captures.
- The guide lists DOM-evaluate geometry probes as optional (「可以用」).
  The plugin's injected browser_* tools intentionally expose no
  arbitrary eval; the bsk CLI on the same daemon does
  (`bsk evaluate`), and was used for the geometry probes below
  (read-only `getComputedStyle` / `getBoundingClientRect` — no
  mutation).
- The DSH Web UI hides `blank: true` sessions (a session with zero
  turns) from the sidebar list — verified against the host
  `session/list` response. The boot-created `team-root` session was
  therefore given one mock-driven NOOP probe turn (no team tools
  involved) before it appeared in the list. This is a UI listing
  detail, not a team defect.
- Session `team-root` was pre-created by the team boot
  (`bootPhase: create-or-open`); the kit's explicit `session/create`
  adoption then returned `agent-preset/conflict` ("records no agent
  preset and cannot be adopted") — expected for an already-existing
  root session; the prompt path (which drives all scenarios) works.

## PR #27 — branch `fix/team-tab-width-column` @ a45b088 (world run-bwidthcolumn-2026-09-21T15-36-43)

Host `http://127.0.0.1:3181`, mock 3491, control 3492; auth via boot
token (303 + cookie). Session `team-root` opened → tabs
对话/轨迹/**团队** present (the 团队 tab renders for every session;
this one is the bound team root) → 团队 tab activated.

Host axis (measured live): `--dsh-chat-content-width:
clamp(680px, calc(<hostBody>px * .64), 920px)` set by the host on its
content container (inherited by the team view).

### 27-A — default/wide window, axis cap active (2140×1048 viewport)

DOM probe (real page, post-fix build):

| element | box-sizing | total box | content | position |
| --- | --- | --- | --- | --- |
| host viewArea | content-box | 1850px @ x=280 | — | viewport minus 280px sidebar |
| TeamView `.body` | **border-box** | **968px** @ x=721 | 920px | **centered**: column center 1205.0 = viewArea center 1205.0 |
| section title (H3) / `.section` | content-box | 920px @ x=745 | 920px | exactly the axis value |

axis resolved = 920px (the clamp max); column total = 920 + 48px
horizontal padding = 968px border-box = `max-width:
calc(var(--dsh-chat-content-width, 100%) + 48px)` exactly as written.
Document: `scrollWidth 2140 == clientWidth 2140` → no horizontal
overflow. Screenshot: `27-A.png` (viewport). `27-A-default-window.png`
retained as the first capture (default 1044px window, axis min clamp).

### 27-B — narrow host width (default 1044×1041 Agent Window)

axis resolved = 680px (the clamp **min**: 1044·0.64 = 668 < 680).

| element | measured |
| --- | --- |
| TeamView `.body` | **border-box**, 728px @ x=293, `max-width: 728px` (= 680+48) |
| centering | viewArea 280..1044 (764px); column 293..1021 → margins 13px left / 23px right (sidebar-adjacent container; column centered in the available area) |
| document | `scrollWidth 1044 == clientWidth 1044` → no overflow |

The column **followed the axis down** from 920→680 (wide→narrow)
while staying a single centered column. Screenshot: `27-B.png`.

### 27-C — small viewport (640×800 emulated, per-tab CDP)

axis resolved = 680px (min clamp; host body 584px) → wanted column
728px, but the container is only 574px wide:

| element | measured |
| --- | --- |
| TeamView `.body` | **border-box**, clamped to **574px** @ x=56 (width:100% of container) — total box ≤ container |
| content region | 526px (574 − 48 padding); section title box = 526px @ x=80 (the +24 padding offset) — titles and cards share the column exactly |
| document | `scrollWidth 640 == clientWidth 640` → **no horizontal overflow** (this is the case the pre-fix content-box math overflowed by the full 48px padding) |

Screenshot: `27-C.png`.

**PR #27 real-browser verdict: PASS (27-A, 27-B, 27-C)** — see
`vision-review.md` for the Vision Toolkit per-scenario verdicts.

(The PR #28 scenarios were run in a separate world on branch
`fix/member-command-dialogs`; their session log lives in that branch's
evidence package in the same directory.)
