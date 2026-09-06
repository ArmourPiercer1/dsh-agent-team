# D3 Result — D6 explicit ordinary-mode fallback ("以普通模式打开") (v2)

- task: D3 (Team D1-D6 repair v2, Wave D — D6 Team UI dedicated mode + restart)
- attempt: 1
- verdict: PASS
- blocker_type: none
- base: bdb6df8cc8b2de62bcd5e77f5006d6a83ec5c367 (D2 commit)
- branch: task/team-d1-d6-v2-D3
- worktree: .worktrees/team-d1-d6-v2-D3
- model_route: qiyuan-self/qwen3.8-27b (verified via runtime declaration "powered by the
  qwen3.8-27b model"; DSH_* env exposes only DSH_HOME/SESSION_ID/SESSION_JSONL/SHELL/WEB_URL,
  no route label — same verification method A3 used)
- client-only: yes (runtime/remote/src untouched; no host process started)
- elapsed_minutes: 25 (session start estimate 04:43, commit ~05:08; inside the 35-minute
  timebox — no DEFERRED)

## Requirements coverage (plan §12 D3 + A3 Q3/Q1)

1. CLIENT/UI — SAME root rows as the Team-mode entry:
   - persisted-roots picker rows: `packages/client/src/ui/TeamView.tsx` renders a
     `以普通模式打开` / `Open in ordinary mode` button (`data-team-ordinary-open-root`)
     beside the D2 Team-mode button, only when the `openOrdinaryMode` face is present
     (absent → the D2 surface is unchanged; pinned by the face-absence tests).
   - TeamView root/leader row: `packages/client/src/ui/TeamMembers.tsx` leader group row —
     the D2 `teamModeRow` now renders when EITHER face is present; the ordinary button
     (`data-team-ordinary-open`, `title` = the promise hint) shares the row with the D2
     button; both absent → the D1 surface (pinned).
2. SEMANTICS — the entry calls the EXISTING pure native open:
   - `packages/client/src/plugin/team-mount-core.ts`: `openOrdinaryMode(rootSessionId)` =
     `openSession(rootSessionId)` verbatim (seam 3, `ctx.sessions.open`) — open FIRST,
     mark AFTER, so a failed open leaves the prior mode mark. NO remote call, NO
     session/create-with-preset, NO ensure-live, NO list refresh.
   - copy pins the promise, never a tool-removal claim: zh `不执行 Team ensure，不保证
     team_* 工具` / en `No Team ensure is performed; team_* tools are not guaranteed`;
     tests assert the copy contains NO `移除`/`remov` (A3 Q1 caveat 2: a live Team agent
     is adopted as-is).
   - badge shows WHICH entry was used: `teamOpenMode` now reads
     `'team' | 'ordinary' | null`; the leader-row badge carries
     `data-open-mode={openMode}` and renders `Team 模式`/`Team mode` vs `普通模式`/
     `Ordinary mode`.
   - switching does not modify TeamDomain durable rows — pinned client-side by ZERO
     `team.*` carrier calls on the ordinary path (a repository write cannot ride a call
     that never happens); the host-side glue map (no `agents.resume` on the ordinary
     path) is covered by the D2 handler pins + D4 host acceptance.
   - idempotent: repeat ordinary entry = repeat pure native open, no duplicate
     registration surface (the ordinary path performs no `agents.resume`), mode stays
     `'ordinary'` (pinned).
3. STATE — the D2 per-root client-local open-mode map (`openModeByRoot`) gains the
   `'ordinary'` value; still client-local (no remote field), still reset on every
   session switch away (pinned: switch to a plain session → the root reads null).

## Changed files

- packages/client/src/plugin/team-mount-core.ts (mount face + map value + docs)
- packages/client/src/ui/TeamView.tsx (picker-row entry + `TeamViewInjected` faces)
- packages/client/src/ui/TeamMembers.tsx (leader-row entry + badge openMode + props)
- packages/client/src/ui/locales.ts (TeamKey + zh + en: openOrdinaryMode,
  openOrdinaryMode.hint, openMode.ordinary)
- packages/client/test/d3-open-ordinary-mode.test.ts (NEW, mount-level TDD spec, 11 tests)
- packages/client/test/d3-ordinary-mode-entry.client.spec.tsx (NEW, UI spec, 11 tests)
- packages/testkit/test/p4t6-session-event-scan.test.ts (coverage pin 629 → 630, +1 new
  `.ts` file; D3 record appended — the scan over the new file passes, zero denylist
  vocabulary)
- packages/client/composition-shim/client-bundle.js (REBUILT install-surface artifact,
  committed in this commit; 914453 B)
- dev/agent-workflow/evidence/team-d1-d6-repair-v2/D3/ (this result + transcripts)

## TDD red → green

- RED (red-d3.txt): mount suite failed to load (`Error: D3 mount test: openOrdinaryMode
  face missing` — the face did not exist); UI spec `Tests 7 failed | 4 passed (11)`
  (entry-render/copy/badge tests failed; null-badge + face-absence tests passed against
  the D2 surface, as designed).
- GREEN (green-d3-focused.txt): `test/d3-open-ordinary-mode.test.ts` 11/11 +
  `test/d3-ordinary-mode-entry.client.spec.tsx` 11/11 (22/22).
- One test-side fix after first green run: the mount fixture's `teamCalls` was a static
  snapshot of an empty array (made `teamCalls()` a live view over the log — otherwise
  the zero-team-call assertions passed vacuously). The semantic implementation was
  already correct.

## GREEN evidence

- D3 focused: `pnpm exec vitest run test/d3-open-ordinary-mode.test.ts
  test/d3-ordinary-mode-entry.client.spec.tsx` → 22 passed (2 files).
- D2 regression: `test/d2-open-team-mode.test.ts` 6/6, `test/d2-team-mode-entry.client.
  spec.tsx` 7/7, `test/client-plugin-mount.test.ts` 33/33 (the 4-fiber-effects pin is
  untouched — D3 adds no effects) — all green.
- Full client suite: `pnpm exec vitest run` (packages/client) → 578 tests, 577 passed,
  1 failed = the PRE-EXISTING `team-creation-panel.client.spec.tsx` "create happy path"
  race (same failure D1/D2 recorded; unrelated to D3 — D3 touches none of the
  creation-panel code).
- Client typecheck: `pnpm exec tsc -p tsconfig.json --noEmit` → exit 0 (after typing the
  two spec `querySelector` results as `HTMLButtonElement`).
- Root scan test: `pnpm exec vitest run packages/testkit/test/p4t6-session-event-scan.
  test.ts` → 10/10 with the bumped 630 pin.
- `git diff --check` → exit 0 (no whitespace errors).

## Install surface

- `pnpm build` (tsc -r, all 9 packages) → exit 0.
- `pnpm build:composition` (place-dist-glue + build-client-composition) → rebuilt
  `packages/client/composition-shim/client-bundle.js` (914453 B); first pass exited 1 at
  the freshness gate (content-drift on client-bundle.js vs the index — expected before
  staging).
- After staging the rebuilt artifact + the source changes:
  `node scripts/check-artifacts-committed.mjs` →
  `[check-artifacts-committed] OK: 1032 files; committed install-surface artifacts match
  the fresh build` (exit 0).
- Note: `pnpm build`'s byte-identical glue re-placement of
  `packages/runtime/dist/.../agent-bindings.mjs` produced a transient `M` (stat noise;
  blob hash verified identical to the index, `6276004d…`); the file is NOT part of this
  commit (content unchanged, client-only task).

## Remaining risks / notes

- "byte-identical TeamDomain / no durable writes" is pinned client-side (zero `team.*`
  carrier calls); the host-side glue map (no ordinary-path `agents.resume`) is covered
  by the D2 handler pins and will be re-confirmed by D4 host acceptance.
- The pre-existing client-suite failure (team-creation-panel create happy path race)
  remains; it predates D3 (recorded in D1/D2 evidence) and is outside D3's write scope.
- No push performed (repo discipline); commit is local on the task branch, ready for
  the main Agent's cherry-pick flow.
