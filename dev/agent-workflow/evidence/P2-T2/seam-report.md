# P2-T2 seam report — Agent create/resume/cold Root seam

Task: prove setup ordering, fresh/cold resume, and that the Root TeamDomain
binding is recoverable BEFORE the first Team-sensitive step — every critical
ordering machine-provable, from public APIs only, against the pinned upstream
tree (`references/deepseek-harness-test-use`, HEAD
`cd5ef8148158c3a752a658978873241fdf8e2bbc`).

Fixture: one host-row plugin (`plugins/lifecycle-host.js`, probe id
`p2t2-agent-lifecycle`, mounted through the web profile `--patch` layer) that
(1) records a per-boot ordering trace `[{seq, ts, phase, ...}]` from `ctx.on`
subscribers to public events plus its own lifecycle markers, (2) exposes a
single exact-match route `/__p2t2/run?scenario=...`, and (3) holds the Root
TeamDomain binding in a DSH StorageDomain KV sidecar (unit `p2t2_binding` v1,
table `roots`, json backend) — the sidecar being the binding authority per the
frozen Architecture (Root Session log superseded; TeamDomain sidecar is the
durable authority). No Team-specific DSH SessionEvent vocabulary is used for
authority.

Boots: boot1 (fresh + in-boot negative controls) → boot2 (same DSH_HOME, NEW
process: resume-member, resume-root, neg-custom-event-cold) → boot3 (scratch
empty DSH_HOME: resume-root must be rejected). Teardown is process kill
(`instance.stop`); agents are never disposed (dispose retires the session).

Canonical evidence (this run): `run/run-log.txt`, `run/obs/*.json`.

## Seam (a) — fresh create

- **Criterion.** A fresh Root (and a member under it) can be created; the Root
  TeamDomain binding is attached and resolvable BEFORE the first
  Team-sensitive step of both the root and the member; session logs become
  durable.
- **Public mechanism.** `agents.create({sessionId, meta})` → `sessions`
  store entry + `session/created` + `agent/created` + `agent/session-start`
  (source `startup`); binding via StorageDomain `KvUnit`
  `putRecord('roots', rootId, {marker})` (durable-on-resolve) and
  `loadAll()`; durability verified on disk as the final
  `session.jsonl.zstd` artifact (see "Known limitations" for why the awaited
  `session/flush` event is not relied on as the barrier).
- **Positive evidence.** `obs/obs-fresh-*.json`: trace subsequence
  (strict seq, non-decreasing ts)
  `activate → run-start(fresh) → event:session/created(root) →
  event:agent/created(root) → event:agent/session-start(root, startup) →
  binding-attach(root) → first-team-step(root, role=root) →
  event:session/created(member) → event:agent/created(member) →
  event:agent/session-start(member, startup) → first-team-step(member,
  role=member) → durable(root, verified on disk) → durable(member, verified
  on disk) → run-end(fresh)`; response marker
  `P2T2-ROOT-MARKER-<rootId>` round-trips through `loadAll`.
  Canonical values (suffix `c7d2eede`): root log 3 events, member log 3
  events; on-disk verification `durable(root) waitMs=182 size=312` and
  `durable(member) waitMs=199 size=326` (final `session.jsonl.zstd` present
  before boot1 stop); `binding-attach` (seq 10) strictly precedes
  `first-team-step` root (seq 11) and member (seq 18).
- **Negative control.** `neg-late-binding` (same boot, same public path): a
  session is created and its first Team-sensitive step runs BEFORE any
  attach; it MUST fail. Machine-readable failure naming the probe row and the
  session: `P2T2_ROOT_BINDING_MISSING` +
  `...no binding record in the p2t2_binding sidecar... (attach missing or not
  durable)` for `p2t2-late-<suffix>`; after a late attach the same step
  succeeds (`afterLateBinding: true`). Observed:
  `first-team-step-failed` strictly between `run-start` and `binding-attach`
  in the trace.
- **Verdict.** PASS — ROOT-TEAMDOMAIN-BINDING-ORDER (fresh leg).

## Seam (b) — member resume

- **Criterion.** After a process death, an ordinary member session resumes and
  its first Team-sensitive step recovers the Root binding WITHOUT the root
  session being live — i.e. from the sidecar alone.
- **Public mechanism.** `agents.resume({resumeSessionId})` →
  `sessionPersistence.prepare` (cold load of `session.jsonl.zstd`) →
  `agent/session-start` (source `resume`); root id from the member's
  `session.header.parentSession`; binding resolved from the sidecar
  (`loadAll`), root liveness checked with `sessions.get(rootId)` — the
  session store is in-memory per process (cold process ⇒ root not live).
- **Positive evidence.** boot2 runs resume-member FIRST (deliberately, while
  the root is not live). `obs/obs-resume-member-*.json`: trace subsequence
  `activate → run-start(resume-member) → event:agent/session-start(member,
  resume) → binding-recovered(member, rootId, via=sidecar-only,
  rootLive=false) → first-team-step(member, role=member) → run-end`;
  response `rootLive: false`, marker matches the fresh-run marker.
  Canonical values (suffix `c7d2eede`): `binding-recovered(member, rootId,
  marker, rootLive=false, via="sidecar-only")` at seq 7, immediately followed
  by `first-team-step(member, role=member, source=resume, rootLive=false)` at
  seq 8 — the sidecar resolves the binding while the root is provably NOT
  live in this fresh process.
- **Negative control.** Ordering negative (boot2): if the root had been made
  live first, `rootLive` would be `true` and the sidecar-only claim would be
  unprovable — the group asserts `rootLive === false`; a `true` result fails
  the run. (The boot1 `neg-late-binding` control additionally proves the
  step fails pre-attach on the same code path.)
- **Verdict.** PASS — MEMBER-RESUME-SIDECAR-ONLY (canonical: `rootLive=false`,
  `via=sidecar-only`, marker round-trip, 6/6 subsequence).

## Seam (c) — ordinary root cold resume

- **Criterion.** After a process death, the Root session itself resumes; the
  bound value is recoverable BEFORE the first Team-sensitive step; the log is
  intact across the death.
- **Public mechanism.** `agents.resume({resumeSessionId})` for the root id;
  binding recovered from the sidecar (`loadAll`), compared against the
  fresh-run marker; `agent/session-start` source `resume`; log length from
  the resumed session (a cold resume appends an end-seed event, so the intact
  invariant is `resumedLength >= freshLength`).
- **Positive evidence.** boot2, second scenario. `obs/obs-resume-root-*.json`:
  trace subsequence `run-start(resume-root) → event:agent/session-start(root,
  resume) → binding-recovered(root, marker) → first-team-step(root, role=root)
  → run-end`; response marker equals the fresh-run marker; source `resume`;
  log length grew only by the resume's own appended events.
  Canonical values (suffix `c7d2eede`): `binding-recovered(root, marker,
  rootLive=true)` at seq 14 (root is live only because this very scenario
  just resumed it), `first-team-step(root, role=root, source=resume)` at
  seq 15, and the group check
  `resume-root: root log intact across the process death (resumed length 4
  >= fresh length 3)`.
- **Negative control.** boot3 (scratch EMPTY DSH_HOME, same public path):
  `resume-root` for the boot1 root id must be rejected —
  `SessionPersistenceNotFoundError` → group code `P2T2_RESUME_NOT_FOUND`
  (`obs/obs-resume-root-*-empty-home.json` shows `resume-rejected` with
  `errorName: SessionPersistenceNotFoundError`). Proves the boot2 recovery
  came from the shared home's durable state, not from process-local memory.
- **Verdict.** PASS — ROOT-COLD-BINDING (canonical: marker round-trip,
  source `resume`, log `4 >= 3` intact, 5/5 subsequence; empty-home negative
  `P2T2_RESUME_NOT_FOUND` attributable).

## Seam (d) — ordering trace

- **Criterion.** The critical ordering is machine-provable, not narrative:
  boot complete → create/resume → binding attach/recover → first
  Team-sensitive step, in that order, in every boot; and on cold resume the
  bound value is present BEFORE the first Team-sensitive step.
- **Public mechanism.** A per-boot in-plugin trace with strict-increasing
  `seq` and non-decreasing `ts`; event phases come from `ctx.on` subscribers
  to public events (`session/created`, `session/event`, `agent/created`,
  `agent/session-start`), lifecycle phases are recorded at the exact
  call-site. The group asserts `traceValid` (seq strictly increasing, ts
  non-decreasing) and per-scenario ordered subsequences on each obs file.
- **Positive evidence.** Every scenario obs file in `run/obs/` carries the
  full trace; all subsequence assertions in `index.mjs` pass (see
  `run/run-log.txt` PASS lines). The `activate` entry records that all five
  injected services (`sessions`, `agents`, `sessionPersistence`, `webServer`,
  `storage`) were visible at apply time — the trace therefore starts only
  after spine readiness.
  Canonical run: all 7 obs files carry a `traceValid`-verified trace; the
  asserted subsequences matched in full — fresh 14/14, resume-member 6/6,
  resume-root 5/5 (plus neg-late-binding 6/6 in boot1 and the readiness
  negative); the `activate` entry records
  `services={sessions:true, agents:true, sessionPersistence:true,
  webServer:true, storage:true}` in every boot.
- **Negative control.** The trace format is self-checking: `traceValid` fails
  on any seq gap or ts regression; a missing or out-of-order phase fails the
  subsequence assertion with the matched `i/N` position. Additionally, the
  boot1 readiness probe records a benign `scenario-error` entry, proving the
  route rejects unknown scenarios (dispatch miss ⇒ `P2T2_UNEXPECTED_ERROR`),
  so a silent no-op cannot masquerade as a pass.
- **Verdict.** PASS — ORDERING-TRACE (canonical: all traces `traceValid`;
  subsequences matched 14/14, 6/6, 5/5, 6/6; `activate` records all five
  injected services visible in every boot).

## Downstream-vocabulary negative control (fixture hygiene)

- **Criterion.** No Team-specific DSH SessionEvent vocabulary may serve as
  vNext authority. The fixture also documents what happens if a downstream
  (future/newer) event type lands in a session log: the WRITE path is
  permissive, the READ path is fail-closed.
- **Positive evidence (of the mechanism's limits).** boot1
  `prep-custom-event` appends `team/vnext/p2t2-probe-marker` to a probe
  session's log and the durable final file is verified on disk
  (`obs/obs-prep-custom-event-*.json`).
- **Negative control.** boot2 `neg-custom-event-cold` cold-resumes that
  session: upstream refuses the log with
  `SessionFormatUnsupportedError` — message
  `session "<probeId>" contains event type "team/vnext/p2t2-probe-marker"
  (seq <n>) unknown to this harness; refusing to interpret the log — it was
  likely written by a newer harness (raw log: <path>)` → group code
  `P2T2_CUSTOM_EVENT_COLD_READ_REFUSED`. Machine-readable, names the session
  and the event type.
- **Verdict.** PASS — no legacy/Team SessionEvent vocabulary is used as
  authority anywhere in this fixture; the sidecar (StorageDomain KV) is the
  sole binding authority, per the frozen Architecture.

## Known limitations (recorded, not blockers)

1. **Awaited `session/flush` from a plugin row is not observably a
   synchronous durability barrier** on this pinned build. A diagnostic
   scenario (evidence `manual/obs/obs-diag-commit-*.json`) shows two awaited
   `ctx.emit('session/flush', session)` resolving with NO session directory
   on disk; the final `session.jsonl.zstd` appears only after the jsonl
   write-behind's 200 ms window (observed +303 ms). The coordinator comment
   "Callers use flush as the immediate durability barrier" (coordinator.ts:1206)
   does not hold observably from a sibling row. The fixture mitigates this
   with bounded on-disk verification (`waitForDurable`, final-file poll,
   10 s deadline, `P2T2_DURABILITY_VERIFY_TIMEOUT` on timeout). This affects
   the session LOG, not the sidecar binding (KV `putRecord` is
   durable-on-resolve).
2. **jsonl commit semantics + kill-teardown gap.** The first append
   materializes via a synced `.tmp` + `MoveFileExW(MOVEFILE_WRITE_THROUGH)`
   publish; later appends write the final file directly. A process kill inside
   the 200 ms window leaves only the `.tmp`, which a cold read cannot see
   (`findLog` matches the final name only ⇒ "session not found"). No stale-tmp
   cleanup exists in `src/`. This is why the fixture verifies the final file
   on disk before stopping each boot.
3. **KV attach latency.** One `putRecord` took ~205 ms in a contended boot
   (neg-late-binding `binding-attach` gap in dev-run-3) — observed, not
   asserted; the KV contract (durable-on-resolve) is unaffected.
4. **Activation-ordering race (fixture remedy, upstream observation).**
   `--patch` overlay rows activate asynchronously during boot; a strict
   `ctx.get` before the row's fiber activates returns undefined. The fixture
   declares `export const inject = ['sessions','agents',
   'sessionPersistence','webServer','storage']` (function-plugin named
   exports, no default export — Post-mortem 0001 / packages/AGENTS.md) so the
   Loader defers activation until all services are visible, and the group
   polls the scenario route (`waitRouteReady`) until the row answers.
   Evidence: `manual/service-visibility.json` (0/20 services strict-visible
   when apply ran at ~942 ms) vs `manual/service-visibility-2.json` (all
   present, incl. `sessionPersistence`, when apply ran at ~2951 ms).
