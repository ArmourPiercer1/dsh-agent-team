# E1Result — TaskResult

- **task**: E1 (Team D1-D6 repair v2, plan §14 — D4-A2 design-only follow-up: "Agent/tool-originated team mutation → live client invalidation")
- **attempt**: 1
- **elapsed**: ~35 min (started 2026-07-21 06:31 local; timebox 35 min reached — deliverables complete within budget, verdict PASS)
- **base sha**: `e72796c286a25f4b69579146c94f8d31b5130e93`
- **head sha**: (see commit of this file — single atomic commit on branch `task/team-d1-d6-v2-E1`)
- **worktree**: `.worktrees/team-d1-d6-v2-E1`
- **branch**: `task/team-d1-d6-v2-E1`
- **changed files (design docs only — no product code, no tests, no remote methods)**:
  - `dev/agent-workflow/evidence/team-d1-d6-repair-v2/E1/E1-design.md` (full design, 9 sections, all public-seam claims cited to upstream @ `76fda729799fe9b3848dbe2c211d4b231032b81e`)
  - `dev/agent-workflow/evidence/team-d1-d6-repair-v2/E1/E1Result.md` (this file)
- **verdict**: **PASS** — all six plan-§14 dimensions designed and frozen: signal, owner, wire, generation semantics, reconnect/duplicate/out-of-order, compatibility/versioning, plus the focused test matrix (T1–T12, spec only).
- **blocker**: none (`none`). No CONTRACT_CHANGE_REQUEST, no CORE_SEAM_BLOCKER: the recommended wire is proven buildable on the existing public surface with zero upstream change and zero contract change.

## Model route (evidence)

Runtime system prompt: "You are a coding agent powered by the qwen3.8-27b model".
`C:\Users\user\.dsh\settings.yaml`: `agent-default-model: provider: qiyuan-self / model: qwen3.8-27b`.
**Route = `qiyuan-self/qwen3.8-27b`** (same verification method as B3).

## References pristine verification

`references/deepseek-harness-test-use`:
- **Before** (task start): `git status --porcelain` = empty; `git rev-parse HEAD` = `76fda729799fe9b3848dbe2c211d4b231032b81e` (0.1.2-rc.1).
- **After** (post-write, pre-commit): re-verified — `git status --porcelain` = empty; `git rev-parse HEAD` = `76fda729799fe9b3848dbe2c211d4b231032b81e`.
- Upstream checkout used strictly read-only (no writes, no worktrees, no index changes).

## Recommended wire (one sentence)

**Option (c1)**: consume the existing, already-forwarded upstream event **`api-session/status`** through the public client-plugin seam **`ctx.remote.$on('api-session/status', ...)`** (Typert Gateway forwarded-event stream, stock in every served web composition; `upstream: packages/api/gateway/src/client/index.ts:211-216`, `upstream: packages/api/remotes/src/remote-events.ts:23`, `upstream: packages/api/session-controller/src/index.ts:151-152`) as the D4-A2 trigger, feeding the EXISTING generation-gated single-flight `pullProjection` — **no new wire, no new remote method, no contract version bump, no polling, no upstream change**; host side needs only the override-lane stamp hook (Hook C).

## Design summary (3–6 sentences)

D4-A1 already pulls after every existing UI mutation callback; the residual gap is mutations committed **by agents out-of-band from the browser** (the seven mutating `team_*` tools: create/delegate/follow-up/send/report/request/resolve) plus one host-side blind spot found by this task: `override.set`/`override.reset` durably writes the `overrides` repo (which IS projection content, `root.ts:1406-1420`) but commits no ledger fact, so the generation stamp never advances and D4-A1's post-mutation pull is discarded as `duplicate` — a confirmed no-op. The design freezes the **generation stamp itself as the single invalidation signal** with the storage write chain as its sole owner (three hooks: existing ledger-hook A, existing compatibility-hook B, and a new override-hook C — one repo method, no duplicated signals), and freezes the **staleness bound** as "≤ the remaining duration of the mutating agent turn" via the stock `api-session/status` event as trigger. Reconnect/duplicate/out-of-order are inherited from the frozen pull/verdict machinery (rebaseline effect + per-generation `$events` pump reopen + single-flight + strictly-greater verdicts; the S1-A one-lag window stays an accepted, R60-adjudicated residual). Compatibility is backward-safe in both directions (old client + fixed host: higher generation only makes frames more applicable; new client without the event: fail-soft no-op), with **zero** remote-contract impact (the 26-method catalog is unchanged; v4 explicitly not introduced). The D1 `listRoots` v3 wire row already carries `generation` (`team-ownership-index.ts:145-157, 353-358`), so no future contract change is needed there either. A 12-test focused matrix (T1–T12, layers S/H/R/C/M/U) is specified as the acceptance contract for the future implementation task, including T6 — the designated verification that member agents actually emit `api-session/status` with `agent.id` = member child session id.

## Top open questions (from E1-design.md §9)

1. **Q1 (owner: user, before implementation task opens)** — is turn-boundary latency acceptable as the frozen staleness bound? Default YES for v2. If NO: escalation = plugin-owned `@Remote({mode:'stream'})` changes stream (public seam proven, no upstream change) — but that is a NEW push surface, prohibited by plan §14 without explicit user approval; `session/follow`-based derivation is the intermediate alternative.
2. **Q2 (owner: future task, resolved by test T6 on the pinned upstream SHA)** — do subagent-owned member agents emit `agent/status` with `agent.id` = the member's child session id? Negative case handled by design (trigger set shrinks to root-session events; documented, not silent).
3. **Q3 (separate task, outside D4-A2)** — `compatibility.ack` UI-disabled wire gap (B3 input): enabling the action + callback is new UI; it plugs into the same `pullProjection` and needs nothing from this design.

## Remaining risks (carried forward)

- **Turn-boundary trigger granularity** — staleness bounded by turn end, not per mutation (accepted; Q1).
- **`agent.id` ↔ session-id binding for member sessions** is an upstream-behavior assumption, pinned by T6 before the client wiring is accepted (Q2).
- **Override stamp fix changes the visible generation sequence** (one extra increment per state-changing override write); no client consumes exact values (strictly-greater compare only) — low risk, pinned by T1–T5.
- **B3 pre-existing failure** `team-creation-panel.test.tsx` (35/36) is unrelated to this design and stays a separate remediation task.
- **Plugin-owned typert artifact build step** (for the rejected c2 alternative) is unverified at design time — recorded so the future task doesn't assume it.

## Non-goals honored (plan §14)

Design-only: no product code, no tests implemented, no remote methods added, no contract version bump, no upstream change (CORE PATCH BUDGET = 0 maintained), no composition change. Only the two E1 evidence files were written; all writes inside the worktree.
