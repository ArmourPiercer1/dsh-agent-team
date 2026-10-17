# a5-w7-jobs-wiring — the PR7 jobs-gateway public face, assembled into a live test session

Alpha.5 **W7** wiring kit (lane task card: *jobs 身份/lease 经 jobs-gateway 公开面装配；
两 member 同宿主隔离实测*). It answers one question with evidence: **does the Lane F
(PR7) gateway's public face behave — identity, lease, two-member isolation — when it is
assembled into a REAL test session on the pinned Host, rather than as a DORMANT fixture?**

Pinned Host: DSH `0.2.0-rc.2` @ the `tests/paths.mjs` pin (never restated here). The
test tree stays a pristine upstream checkout (W10c re-asserts porcelain-clean). Worlds
live in `tests/homes/a5w7-<stamp>` and are removed and verified at teardown. Port
**3184** (WIRING-PHASE-PLAN IF-2). The stable instance `:3080` is probed read-only and
asserted unchanged. Mock model only, no real key. Credentials redacted at capture.

## The assembly under test (IF-1, public seams only)

* the **profile-patch seam** mounts, side by side: the production `dsh-agent-team` row
  (this worktree's built `dist`), the p6t6 observer row, and **`a5w7-jobs-plugin.mjs`**
  — a plain plugin row in the accepted p6t6 shape (`inject = ['webServer','teamRoot']`,
  exact-path routes through the public `webServer.register` seam);
* the row consumes the lane through its **PUBLIC BARREL**
  (`packages/runtime/jobs-gateway/index.ts`), zero lane-source edits, zero shared-file
  edits (IF-5);
* **compile path (disclosed):** at base the lane is not in `packages/runtime/tsconfig*.json`
  — those are shared files whose sole writer is GLUE (IF-5; Lane F README checklist #1).
  `tsconfig.lane.json` is a KIT-LOCAL project that compiles the unmodified sources into
  `node_modules/.a5w7-jobs-build/` (gitignored) for the plain-Node load path, and it is
  the lane's **first tsc run** (review-LaneF condition 2 — the lane had never entered
  tsc). When GLUE lands the build include, the kit switches to the repo dist and this
  file retires;
* member identities are **host facts**: the two members are durable `MemberInstance`
  rows with host-generated `inst-…` ids and distinct child sessions, created over the
  public `/team-remote` path by a scripted leader (mock model), read back through the
  production assembly's own repositories.

## What the legs book (criteria ids in `run-receipt.md`)

| group | claim (one line) |
| --- | --- |
| W0 | unmodified lane compiles under the repo strict base (first tsc pass) and the barrel imports; `job_start` is ZERO in the host tree pre-run |
| W1 | host boots on :3184, all three rows live, the gateway is ASSEMBLED from the public barrel in-process |
| W2 | two durable host members, distinct ids, distinct child sessions — two live sessions, one host |
| W3 | identity: canonical key = lane math over host facts; value pin survives caller mutation; B taking A's live jobId = `owner-mismatch` + alarm; A re-admit = `duplicate-job` |
| W4 | two-member isolation: each viewer's list is EXACTLY its own jobs (verbatim comparison in `isolation-comparison.json`); the boot-root leader (a second real session) sees nothing; a same-instanceId/different-root viewer is a different owner; the cross-scope refusal is the static detail and leaks no identity |
| W5 | revocation → recovery on the live gateway: only the jobs whose own `(scope,name)` moved become cancel-requested (neighbour-safe); the returning Definition admits under the new identity while the old job stays pinned to the execution-time one |
| W6 | leases settle while ACTIVE; drain at self-counted zero reaches RELEASED |
| W7 | lease mutex + cooperative abort: A holds ⇒ B refused; drain refuses new admissions from the first instant; an outcome across the boundary is recorded while the settle is refused; after giveUp the release refuses FOREVER |
| W8 | the `job_start` anchor stays absent: 0 hits pre AND post, no job-start-shaped name in the live roster; the kit adds no host tool |
| W9 | the kit's own files cite G-g OPEN-only and never claim a termination guarantee |
| W10 | :3080 unchanged; no raw token in any artifact; world + build dir gone; pinned tree porcelain-clean |

## Disclosed boundaries (asserted, not glossed)

* **Definition identity source (W5).** The gateway's C-BIND re-read targets a
  **row-local definition store**, labelled in every response. The pinned Host gives a
  third-party row no public seam to move another scope's Definition mid-session, and no
  host-side Jobs face at all — the `job_start` anchor is absent across the whole tree
  (re-measured W0b/W8; reproduction: `grep -rn job_start <test-use tree>` → 0, plus the
  live roster dump in `anchor-runtime-roster.json`). That dimension is therefore
  **PROBE-GATED at fixture level**: the host-registry-shaped rebind chain is owned by
  `packages/runtime/test/a5p7-mcp-rebind-chain.test.ts` (6/6, verified against the
  stack/fixture — cited, not booked here). This kit registers NO host tool and fakes no
  host Jobs capability; the absent-anchor fact does not move because of the wiring.
* **G-g is OPEN** (PENDING-GATES register) and is cited as OPEN only. Abort propagation
  is **cooperative**: the dispatch plane decides what happened; the jobs face mirrors the
  plane's event faces and offers **no termination guarantee of its own** — which is
  exactly what W7b measures (outcome recorded across the boundary, lease settle refused,
  release refuses forever after giveUp).
* **Lease handle never crosses the face** (review-LaneF condition 3): the routes expose
  owner-scoped projections, typed refusals, and the window's STATE + outstanding call
  ids — no `lease` object, no `end`, no `acquire`; window lifecycle moves only through
  the assembly's own teardown action.
* **Claim caliber:** fixture-level law re-verified on a live assembly in a live Host
  process — NOT a whole-chain claim (INTERFACES integration rule, Lane F house style).

## Run

```bash
node tests/kits/a5-w7-jobs-wiring/a5w7-kit.mjs \
  --evidence-dir dev/agent-workflow/evidence/alpha5/wiring/w7/run-<n>
```

Exit codes: `0` every criterion passed · `2` a criterion failed · `1` fatal. The run
writes its own `run-receipt.md` next to the artifacts (baseline, port, world
disposition, anchor counts, criteria verbatim).
