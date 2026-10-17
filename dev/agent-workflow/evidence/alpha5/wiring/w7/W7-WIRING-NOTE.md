# W7 wiring note — jobs-gateway public face into live test sessions (alpha5-wire-pr7)

Task card (WIRING-PHASE-PLAN lane W7): *jobs 身份/lease 经 jobs-gateway 公开面装配；两
member 同宿主隔离实测（互不可见+lease 互斥+revocation）；pinned absent-anchor（job_start）
不因此改变*. Kit: `tests/kits/a5-w7-jobs-wiring/` (see its README for the full criteria
table and disclosures).

## Baseline / pin

- branch `alpha5-wire-pr7`, base `master@62cc2b87`, one-shot worktree `.worktrees/a5-w7`
- Host `tests/deepseek-harness-test-use` @ `639ed01539` (0.2.0-rc.2), porcelain 0 pre/post
  (W0b/W10c); port **3184** (IF-2); world `tests/homes/a5w7-<stamp>` (IF-3, removed +
  verified); `:3080` read-only probed, never operated (W10a).

## Assembly (IF-1) — public seams only, zero shared-file edits (IF-5)

profile-patch rows: production `dsh-agent-team` row (this worktree's built dist) + p6t6
observer + `a5w7-jobs-plugin.mjs` (plain row, `inject=['webServer','teamRoot']`,
`webServer.register` exact routes). The gateway is consumed through the lane's PUBLIC
BARREL. **Compile-path disclosure:** the lane is not yet in `packages/runtime/tsconfig*.json`
(shared, GLUE-owned per IF-5 and Lane F README checklist #1); the kit compiles the
UNMODIFIED sources with the repo strict base via a kit-local project
(`tsconfig.lane.json` → `node_modules/.a5w7-jobs-build`, gitignored) — which doubles as
the lane's **first tsc run** (review-LaneF condition 2 satisfied: tsc exit 0, W0a).
**GLUE queue item:** add `jobs-gateway` to the runtime tsconfig include; the kit then
switches to `packages/runtime/dist` and `tsconfig.lane.json` retires.

## 隔离三件 (the three isolation items), live

| item | leg | result |
| --- | --- | --- |
| 互不可见 (mutual invisibility, list comparison) | W4a/W4b/W4c | PASS — member A visible = exactly {w7-a-1,w7-a-2}; B = exactly {w7-b-3,w7-b-4,w7-pin-1}; boot-root leader (second real session) sees nothing; swapped-root viewer = different owner, refused; cross-scope refusal is the static detail, leaks no identity (`isolation-comparison.json`) |
| lease 互斥 (A holds ⇒ B refused) | W3b + W7a | PASS — B re-admitting A's live jobId = `owner-mismatch` + `gateway-admit-owner-claim-conflict` alarm; after drain, new admissions refused from the first instant (`gateway-not-active`) |
| revocation 后恢复 | W5a/W5b | PASS — withdrawn Definition ⇒ ONLY the jobs whose own (scope,name) moved become cancel-requested (neighbour-safe both ways); after the Definition returns the new admission pins v2 and settles while the old job stays pinned to the execution-time identity v1 (`revocation-leg.json`) |

Supporting: identity value-pin over host facts (W3a/W3c), settle-at-ACTIVE + drain +
self-counted-zero release to RELEASED (W6), and the cooperative-abort shape (W7b):
`dispatcher-call-terminated-after-body-start` records the plane's outcome
(`terminated-after-start`, `sideEffectPossible: true`) while the cross-boundary settle is
REFUSED, the token stays outstanding, and after giveUp the release refuses FOREVER — the
jobs face mirrors the plane and offers no termination guarantee of its own (G-g is OPEN,
PENDING-GATES register; W9 self-scan passes).

## ③ pinned absent-anchor — unchanged, PROBE-GATED where public face is missing

- `job_start` grep over the whole host tree: **0 hits pre AND post**
  (`anchor-host-grep-pre/post.json`; reproduction is the grep itself).
- Live roster (production `teamRoot.tools.tools`, read through the public facade): no
  job-start-shaped name; this kit registers **no host tool** and fakes no host Jobs face.
- Consequence, disclosed rather than papered over: the pinned Host gives a third-party
  row no public seam to move another scope's Definition mid-session, so the live W5 leg
  drives the gateway's law against a **row-local definition store** (labelled in every
  response), and the host-registry-shaped rebind chain stays **PROBE-GATED at
  fixture-level** — owned by `packages/runtime/test/a5p7-mcp-rebind-chain.test.ts`
  (6/6, verified against the stack/fixture). The absent-anchor fact does not move
  because of this wiring.

## Runs

- `run-RED/` — `--without-row` control: 22 criteria, **9 pass / 13 fail** (exit 2); every
  failure is an op-leg 404 naming what the wiring owes; discipline legs pass on merit.
- `run-GREEN/` — same kit with the row mounted: **22/22 PASS (exit 0)**, `run-receipt.md`
  carries the criteria verbatim.
- `red-console.log` / `green-console.log` — console transcripts of the two runs.

## Claim caliber (not stretched)

Fixture-level law re-verified on a LIVE assembly in a LIVE Host process with HOST-derived
member identities — not a whole-chain claim (INTERFACES integration rule; Lane F house
style). Lease handle never crosses the Web/Jobs face (review-LaneF condition 3; kit
routes expose state + call ids only). No new event/error names (IF-6): the kit consumes
the six plane names verbatim; nothing emits new §5 codes.
