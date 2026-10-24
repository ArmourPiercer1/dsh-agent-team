# A5M2-B-TEAM C2 — shortest real-Host window plan (first real tool leg). PREPARATION ONLY: nothing here is executed.

**Family choice, on facts:** this lane's **B-TEAM C2 driver** is the first candidate — it is the only family here
with a completed driver (`dev/agent-workflow/evidence/alpha5/live/a5m2-team-c2-runner.mjs`, live legs
`C-READINESS / C-BLUEPRINT-SOURCE-GATE / C-READINESS-BARRIER / C-CREATE-ONCE / C-ROOT-LIVE / C-READ-STATE /
C-TEAM-QUERY / C-LEDGER-PAGE / C-LEADER-MEMBERS`), an acceptance row (`…/a5m2-team-c2-kit.mjs`), and now a
**prepared, pinned install face** (`install-c8dd3f07b`, receipt
`…/A5M2-TEAM-C2-FIXTURE-PREP-RECEIPT.md`). G5 ships a test trio without a Host driver, so it cannot take a
Host window first. **No new harness is built**: the driver already exists and currently runs `--precheck`; the
window only flips its gated `--live` path on root's boot GO.

---

## 1) FIXED identities (all re-verified read-only this round)

| item | value |
|---|---|
| product commit | `699cc4fb7a27941b19c1550c42d45d45520535da` |
| product package | `dsh-agent-team-0.1.1-alpha.2.tgz`, sha256 `c8dd3f07b940efec03ec69173a3f98a9ded6106ccf725e0bda88efa74c754b0e`, 4,107,270 B, 1,837 entries |
| driver 40-SHA at submission | `a8e7c32539d2a18d3246d7dca0915aaf68e4c650` (branch `feat/a5m2-wire-team`; the driver + kit + this plan are at or below this commit) |
| Host runtime | `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` — measured this round: `git rev-parse HEAD` = that SHA, `--abbrev-ref` = `HEAD` (detached), `git status --porcelain` = 0 lines |
| blueprint source (live create) | `dev/agent-workflow/evidence/alpha5/natexe/runs/live-2026-10-18T03-32-07/blueprints-v3/a5nx-main.yaml` on the driver lane, 2,279 B, `schemaVersion: 3`, `blueprintId: team.a5nx-main`, `revision: "1"` (the driver converts the string revision to the positive safe integer the contract requires) |

## 2) SURFACES

* **Boot face**: the prepared installed face
  `/srv/workspace/dsh-plugins/dsh-agent-team/tests/homes/a5m2-sched-c2-dry-2026-10-23T22-56-05-203ZZ/install-c8dd3f07b`
  (450,547,174 B nominal; `dsh-agent-team 0.1.1-alpha.2` resolved from the `file:` tgz; adapter marker
  `A5_B_TEAM_ADAPTER_REVISION = 2` count 1 inside it). Read-only use: it is the module resolution root only —
  nothing is written into it during the window, and its lock/modes stay as left.
* **DSH_HOME = a NEW independent small HOME**, fresh temp world per `docs/TEST_METHODS.md:84-91`
  (`<line>-<UTC timestamp>`): `tests/homes/a5m2-team-c2-h1-<YYYYMMDD>T<HH-MM-SSZ>` created `mkdir`-only at window
  start (exists-⇒-throw, never a reused world). The install face's **parent dry world is NOT the DSH_HOME** and is
  not touched; the world's `profiles/ blueprints/ sessions/ storages/` are the only new state.
* **Never** the stable instance: `:3080` and its `DSH_HOME` stay out of reach
  (`docs/TEST_METHODS.md:14`). Measured now: the only listener in the range is `127.0.0.1:3080`.
* **PORT = 3180** (3180-family, free now). Exact check at window start, must print nothing:
  `ss -ltn | grep -E ':318[0-6]\b'` → this round: **EMPTY ⇒ 3180 free**.

## 3) BUDGET / TIMEOUT

* Fresh-HOME increment precedent: **≈117 KB/round** (`profiles` 3,483 + `blueprints` 3,185 + `sessions` 68,428 +
  `storages` 41,666 on `a5m2-c2-r17-20261023T15-03-57Z`).
* **This window's ceiling**: world increment **≤ 4 MiB** (`du -sb` of the new world at exit, 35× headroom over the
  precedent); no install, no pack, so no other new bytes are expected except launcher logs inside the world.
  Disk headroom measured `df -B1 --output=avail /` = 8,867,430,400 B; rule **keep ≥ 6 GiB**.
* **Hard wall-clock timeout for the window: 20 minutes** (`timeout 1200 …` on the driver process; the driver's
  per-RPC leg timeout stays 60 s).
* **One-window FIRST-ERROR-STOP discipline**: the first non-green leg ends the window — no leg skipping, no
  retry-to-green, no second attempt at a failed leg, and no proceeding past a leg whose answer was not read.
  Refusals that are the *expected* typed outcome of a negative control do not count as errors.

## 4) MINIMAL POSITIVE / NEGATIVE CONTROLS (real leader-tool surface)

Entry points are the **real leader tool surface** invoked over the authenticated RPC of the booted Host
(`team_*` as the Leader of the created team root), **explicitly not** any `p6t6`-internal module call used as a
tool entry — internal calls may only be read as assertions, never as the entry.

**Positives (shortest real chain, in order, each with a fresh `requestToken`):**
1. `team_list_templates` — the bound blueprint's templates (read, zero side effects).
2. `team_list_members` — the roster before any create (also the source of real `inst-…` instance ids).
3. `team_delegate` (create form: `delegationTemplateId` + `label` + self-contained `prompt`), **async default
   kept** (no `async` argument) — admits one work unit.
4. `team_collect` with the **same** request token — read-back to a terminal `succeeded` / `failed` /
   `unavailable` (a `running` answer is re-read, not re-delegated).
5. `team_archive_member` (`targetInstanceId` from step 2/3 real ids) — the durable archive commit.

Assertions per leg are on the returned result object: `status ∈ {executed, delivered, progress-recorded, …}`
with `requestToken` echoed; envelope law `status === 200 && body.result.ok === true`, payload at
`body.result.value`; three-state (ok / error / **unknown**) — an unreadable answer is `unknown`, never green.

**Negatives (typed refusals expected):**
* **N1 guard-blocked**: `team_archive_member` on an instance that carries a pending `leader-approval` control
  request → expect `status: "blocked"` with a closed `reason` and a `requestId`, and **zero side effects**
  (member state unchanged on re-read).
* **N2 bad addressing / token discipline**: `team_delegate` addressed by **template id/label in the instance
  slot** → expect `status: "rejected"` with the addressing `code`; and a `requestToken` reused for a *different*
  logical operation must not silently admit a second unit (`team_collect` on that token still reports one unit).
  Expected refusals are asserted on the returned typed value, never by catching.

## 5) CLEANUP + EXIT PROOF

* Host stopped by the driver's own teardown; **port proof**: `ss -ltn | grep -E ':3180\b'` prints nothing.
* **Lock release proof**: `tests/homes/a5m2-team-c2-h1-<stamp>.lock` removed/absent (world lock law
  `docs/TEST_METHODS.md:89`, content `{world,pid,kit,runStamp,at}`).
* World state per §7: temp world **retained as evidence** (never committed — homes carry launch tokens), deletion
  is an impact op needing a separate order; the install face and all `out-*`/`snap-*`/`install-*` surfaces left
  byte-as-left; `<home>.lock` of other worlds untouched.
* Zero writes outside: the new world (+ its `.lock`) and the driver's own evidence directory on the lane.
  Post-window read-backs: repo `git status --porcelain -uno` = 0 lines; the install face's `pnpm-lock.yaml`
  sha still `dad670ae…`; old face lock still `7faee42f…`.

## 6) NOT IN THIS WINDOW

No installs (the face is already prepared and pinned), no pack / re-pack, no clone, no new worktree, no repo
writes, no Host other than the one 3180 instance, no other family (G5/G6/Schedule/search stay out), no
full-matrix sweep — one chain of 5 positives + 2 negatives. `GAP-INITIAL-WORK-TOKEN` and `GAP-DURABLE-REPLAY`
stay named-open: their preimages are not produced by this window, so no leg claims them.

**Gate:** nothing above runs until root issues the boot GO for this exact identity set.
