# P2-T2 compliance report

Task (TaskDoc §11.3, verbatim intent): prove setup ordering, fresh/cold
resume, and Root TeamDomain binding recoverable before the first
Team-sensitive step — fresh create; member resume; ordinary root cold resume;
ordering trace. CORE PATCH BUDGET = 0: all capability via external plugin +
public seams; missing public behavior ⇒ blocker, never an upstream patch.

## 1. Goal compliance

| Requirement | Status | Where proven |
| --- | --- | --- |
| (a) fresh create | PASS | `seam-report.md` Seam (a); `run/obs/obs-fresh-*.json` |
| (b) member resume (cold) | PASS | Seam (b); `run/obs/obs-resume-member-*.json` (`rootLive:false`, sidecar-only) |
| (c) ordinary root cold resume | PASS | Seam (c); `run/obs/obs-resume-root-*.json` + empty-home negative |
| (d) ordering trace | PASS | Seam (d); per-boot traces in every obs file, `traceValid` + subsequences |
| binding recoverable BEFORE first Team-sensitive step | PASS | `binding-attach`/`binding-recovered` strictly precede `first-team-step` in every scenario trace |
| "cold resume" = process death, state back from disk via public APIs | PASS | boot2/boot3 are new processes against the same (resp. empty) DSH_HOME; teardown is `instance.stop()` kill; no in-process handoff |
| "fresh" = new DSH_HOME or new session id | PASS | unique `p2t2-*-<8hex>` session ids per run; boot3 uses a brand-new scratch home |
| minimal Team-binding fixture via public APIs only | PASS | StorageDomain KV unit `p2t2_binding` v1 (`putRecord`/`loadAll`), json backend; `agents.create/resume`; `sessions.get`; no private imports (static positive control in the group cross-checks every probe import against `ctx.surface`) |
| ≥1 attributable negative control per seam, machine-readable, naming the probe row | PASS | `neg-late-binding` (`P2T2_ROOT_BINDING_MISSING`, names row + session), `neg-custom-event-cold` (`P2T2_CUSTOM_EVENT_COLD_READ_REFUSED`), empty-home `P2T2_RESUME_NOT_FOUND` |
| every critical ordering machine-provable | PASS | strict-seq / non-decreasing-ts traces + per-scenario ordered subsequence assertions in `index.mjs`; no narrative-only claims |
| else emit `CORE_SEAM_BLOCKER:ROOT_COLD_BINDING` | NOT EMITTED — not required | all four seams proved with the public sidecar authority; the flush-barrier observation is documented as a known limitation with fixture mitigation (§4), not a missing public behavior for the binding authority (KV durability is durable-on-resolve) |

## 2. Owned paths (committed on `task/P2-T2-agent-lifecycle` only)

| Path | Kind | Note |
| --- | --- | --- |
| `tests/characterization/probes/agent-lifecycle/index.mjs` | probe group | 3 boots + 6 scenarios + assertions |
| `tests/characterization/probes/agent-lifecycle/plugins/lifecycle-host.js` | host row plugin | trace recorder + scenario route + KV sidecar |
| `dev/agent-workflow/evidence/P2-T2/**` | evidence | canonical `run/`, dev iterations `dev-run-2..4/`, `manual/` diagnostics, this report pair |

Not touched: `run.mjs`, `spawn-probe.mjs`, `lib/**`, `fixtures/**`,
`probes/smoke/**`, `.github/**` (P2-T1-owned), and the entire pinned upstream
tree (read-only; byte-clean verified: empty porcelain + empty diff + HEAD
`cd5ef8148158c3a752a658978873241fdf8e2bbc` unchanged — see §5).

## 3. Public-surface usage (whitelist check)

Plugin imports: `@deepseek-ai/dsh-session` (root — `SessionId`), `node:fs`,
`node:path`, `node:timers/promises`. All admitted by the live `ctx.surface`
(static positive control in the group compares every probe import against
`ctx.surface` before any boot). Services consumed: `sessions`, `agents`,
`sessionPersistence` (presence guard only), `webServer` (route registration),
`storage` (json backend KV unit) — all declared in `export const inject`.
Events subscribed (public): `session/created`, `session/disposed`,
`session/event`, `agent/created`, `agent/session-start`. Event emitted:
`session/flush` (documented intent; observably not a barrier — §4.1).

Frozen-Architecture conformance (read-only quotes,
`docs/plans/active/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md`):
- L56 — Root Session log superseded; TeamDomain sidecar is the durable
  authority.
- L57 — child Session = first-person history only.
- L58 — 禁止新增 Team-specific DSH SessionEvent vocabulary.
- L1020 — TeamDomain over DSH StorageDomain.
- L1205 — Team binding authority in TeamDomain SessionBinding.

⇒ The fixture's binding authority is exactly the prescribed
StorageDomain/KV sidecar; no Team SessionEvent vocabulary is created or used
as authority (the `team/vnext/p2t2-probe-marker` event is used ONLY to
demonstrate the upstream read-side whitelist refusal, and is refused by the
pinned build on cold read — see §4.3).

## 4. Findings and known limitations

### 4.1 `session/flush` is not a durable publication barrier from a plugin row

A diagnostic scenario (kept out of the committed group; evidence
`manual/obs/obs-diag-commit-p2t2-diag-170e-.dsh-test-p2t2.json`) showed:
presets enqueued @…353937 → first awaited `ctx.emit('session/flush', session)`
resolved @…353940 with NO session directory on disk (`found:false`) → second
awaited flush @…353941 still `found:false` → final `session.jsonl.zstd` (363 B)
present at +303 ms (the write-behind's 200 ms auto window), stable at +2303 ms.
The auto timer was evidently not cancelled by the row's flush — asymmetric
cross-row delivery: this row receives their events, but its flush emit did not
reach/effect the coordinator's listener on this pinned build. The coordinator
comment (coordinator.ts:1206: "Callers use flush as the immediate durability
barrier") does not hold observably from a plugin row.

Impact: a process kill inside the 200 ms window leaves only the staging
`.tmp`; a cold read then reports "session not found" (this is exactly what
broke the dev-run-3 negative control — probe/late logs were killed
mid-publication). Mitigation in the fixture: `waitForDurable(sessionId)` —
bounded poll (100 ms cadence, 10 s deadline) for the FINAL
`session.jsonl.zstd` artifact, throwing `P2T2_DURABILITY_VERIFY_TIMEOUT` with
the last disk state on timeout — wired after every flush in
`fresh`/`prep-custom-event`, so every log that a later boot cold-reads is
provably on disk before the killing stop. Possible upstream generic seam
proposal (NOT required for this task's verdicts): expose a synchronous
per-session durability barrier on the `sessionPersistence` service (or make
the `session/flush` listener reachable/awaitable from sibling rows) so callers
other than the coordinator do not need filesystem observation.

### 4.2 jsonl write-behind `.tmp`/final commit semantics

`createCore` is pure lazy ("No artifact until the first append",
coordinator.ts:679); first `appendBatch` materializes via
`writeSyncedTempFile` (`<final>.<12hex>.tmp`, open `wx` + fsync) +
`publishNewFileWin32` = sync FFI `MoveFileExW(MOVEFILE_WRITE_THROUGH)`
(win32.ts:116) with `rejectExistingLog` making materialize
first-write-only; later appends open the final file `'a'` + fsync directly.
Cold `loadStored`→`findLog` sees ONLY the final name — a bare `.tmp` reads as
"session not found" (prepareCore:975
`SessionPersistenceNotFoundError`). No stale-tmp cleanup exists in `src/`
(grep-verified; `rm` only in tests). Combined with kill-teardown (the
write-behind's final drain disposer never runs on kill), this is the exact
window the §4.1 mitigation closes.

### 4.3 Session-event vocabulary whitelist (read-side fail-closed)

`KNOWN_SESSION_EVENT_TYPES` (known-event-types.ts) is enforced ONLY on read
paths (prepareCore:981 / load:965); the write path is deliberately permissive
(appendCore:714 comment: "The unknown-type guard is deliberately read-side
only: an append-time refusal would stall a live session's durability
mid-flight…"). The pinned build refuses a log containing an unknown type with
`SessionFormatUnsupportedError`:
`session "<id>" contains event type "<type>" (seq <n>) unknown to this
harness; refusing to interpret the log — it was likely written by a newer
harness (raw log: <path>)`. This is the machine-readable failure the
`neg-custom-event-cold` control asserts, and it independently proves that no
downstream Team SessionEvent vocabulary can be smuggled in as vNext session
authority: any such event makes the log unreadable by this build.

### 4.4 Activation-ordering race (fixture remedy + upstream observation)

`--patch` overlay rows activate asynchronously during boot at a varying point
relative to base-bundle activation; strict `ctx.get` returns only services
whose providing fiber is currently active (reflect.ts get() JSDoc).
Empirically: with an early apply (~942 ms after boot start) 0/20 expected
services were strict-visible; with apply at ~2951 ms all were present
(incl. `sessionPersistence`) — `manual/service-visibility.json` vs
`manual/service-visibility-2.json`. Remedy (fixture-side):
`export const inject = ['sessions','agents','sessionPersistence','webServer',
'storage']` — function plugins must named-export `name`/`inject`/`apply` with
no default export (packages/AGENTS.md; Post-mortem 0001: "Mixing the forms
makes the Loader discard the function plugin's namespace"), which defers row
activation until every required service is available (registry.ts
Plugin.Base.inject: "Services the plugin requires; it only loads while all
are available") — PLUS group-side `waitRouteReady` polling the scenario route
until the row answers (covers the boot-marker → row-active gap). Verified:
the `activate` trace entry records all five services visible.

### 4.5 Bugs found and fixed (fixture-side)

- Missing `await` on the first `agents.create` (dev-run-1) — fixed.
- Booted instances use buffered file-stdio, hiding child crashes; live-stdio
  spawn diagnostics used to root-cause (no fixture change needed).
- Stale `traceLength` in responses (captured before the scenario runs) — the
  obs file carries the real trace; assertions read the obs, not the
  response.
- dev-run-3 assertion bugs (this iteration's fixes): root-log equality
  (`4 === 3`) → `>=` (a cold resume appends an end-seed event; intact =
  never shrinks); resume order made root live before the member's
  sidecar-only proof → resume-member now runs FIRST in boot2.
- `AgentHandle.dispose` semantics (removes session + retires persistence) —
  the fixture NEVER disposes; teardown is process kill, matching the
  "cold resume" definition.

## 5. Hygiene (manually double-checked)

- Upstream pinned tree byte-clean: `git status --porcelain` empty,
  `git diff` empty, HEAD `cd5ef8148158c3a752a658978873241fdf8e2bbc`
  unchanged. (checked at: 2026-08-29T19:19:37Z, after the canonical run; the
  canonical byte-clean section re-verified the same at 19:18:02Z)
- Ports 3381/3391 freed after the final boot (verified via node net.connect
  probe). (checked at: 2026-08-29T19:19:37Z)
- Patch layer restored byte-exact to the P2-T1 smoke row (242 bytes, exact
  content re-read after the canonical run).
- Worktree git status: only the owned paths above are modified/untracked;
  `.scratch/` diagnostics removed before commit; patch layer restored
  byte-exact to the P2-T1 smoke row.
- No `git push`; no upstream modification; no patch-package/postinstall; no
  vendored modified copy; no legacy Team SessionEvent vocabulary as
  authority.

## 6. Attempts

Dev iterations (all internal debugging within the single allowed execution
window, no fresh task attempt was required):
- dev-run-2 — failed boot (activation-ordering race pre-`inject` fix;
  historical, kept for the audit trail).
- dev-run-3 — 4 check failures, all fixture-side; root-caused via the
  diag-commit experiment and jsonl source forensics (§4.1/§4.2 + two
  assertion bugs: log equality and boot2 scenario order).
- dev-run-4 — probes-only re-run after the fixture fixes: ALL GREEN
  (31/31 checks, exit 0), see `dev-run-4/run-log.txt`.

Canonical full harness run (all sections — preflight, surface, fixture,
static, lifecycle, probes (smoke + agent-lifecycle), byte-clean — all
groups): `run/run-log.txt`, `RESULT: PASS characterization self-test (all
sections green)`, exit 0.

Honest attempt count for the final answer: **1** (≤3 cap; every green
result above was produced inside attempt 1's internal-debugging allowance —
no second task execution was needed).
