# P7-T7 design note — legacy Team Session read-only reader + G7 gate

Task: P7-T7 (R48). Deliverable A: `packages/legacy/session-reader/**` — a
best-effort, strictly read-only reader for OLD (legacy) Team Session metadata
on disk. Deliverable B: in-process integrated suites
(`packages/legacy/test/p7t7-*.test.ts`) covering all nine G7 criteria.
Deliverable C: real-instance E2E (`packages/legacy/session-reader/e2e/**`) +
this evidence directory (G7 report, chain logs).

## 1. Architecture

The reader is **pure TypeScript** (NodeNext, erasable syntax, zero-core: no
`node:` imports in any `.ts`). All filesystem access flows through one
injected read-only port:

```
LegacyHomePort = {
  listDir(path: string): readonly LegacyHomeEntry[] | undefined
  readFile(path: string): string | undefined
}
```

- `undefined` from either method = "absent" (the reader degrades, never
  throws, for absent metadata — the mandated best-effort contract).
- A port that THROWS is re-typed into `LEGACY_READER_PORT_FAILURE` (a real
  I/O fault is not "absent").
- The real-FS implementation of this port exists ONLY in the e2e layer
  (`e2e/fs-seam.mjs`, `.mjs` qualifies for `node:` imports) and in the
  in-process tests (in-memory home tree behind a recording port).

Files (all under `packages/legacy/session-reader/`):

| file | role |
| --- | --- |
| `types.ts` | closed view contracts: request, roster member/warning, session evidence, team metadata, legacy view, native-fallback view, the `LegacyTeamInspection` union |
| `errors.ts` | `LEGACY_READER_ERROR_CODES` (`LEGACY_READER_INVALID_REQUEST`, `LEGACY_READER_MUTATION_REJECTED`, `LEGACY_READER_PORT_FAILURE`), `LegacyReaderError` (`.code`, `.details`), `isLegacyReaderError` guard |
| `format.ts` | on-disk format primitives ported verbatim from the frozen fork (`encodeSegment`/`decodeSegment`/`projectKey`), lenient header parsing, `classifyLegacyLogLine` (header / legacy-team-event / other / unreadable), lenient roster parse with the closed `ROSTER_WARNING_REASONS` vocabulary |
| `inspect.ts` | `inspectLegacyTeam(port, request)` (scan roster → scan sessions → leader selection → member child set → degradation gate → deep freeze) and `dispatchReaderAction(port, action, request)` — the single public entry: `inspect` is the ONLY action with an entry; every other verb is rejected with `LEGACY_READER_MUTATION_REJECTED` (mutate/resume/restore are permanently unavailable) |
| `index.ts` | closed re-export face |

Event vocabulary: recognition is **exclusively** via
`LEGACY_TEAM_SESSION_EVENT_NAMES` / `isLegacyTeamSessionEventName` from
`packages/contracts` (the frozen v1 quarantine vocabulary). No new code —
including tests and the e2e fixtures — writes the five legacy event names as
quoted literals (p4t6 denylist; the e2e `run.mjs` assembles fixture event
names through a `teamEventName(suffix)` helper for exactly this reason).

## 2. Locked design decisions

1. **Lenient, best-effort parsing everywhere** (mandate: DevPlan §20.6
   "best-effort inspect old Team metadata"; a degraded view is never an
   error). Every defect degrades to typed, closed-vocabulary output:
   roster defects → `rosterWarnings`; undecodable log lines →
   `unreadableLineCount`; missing `.jsonl` / zstd-only logs →
   `logDecodable: false` with zeroed counts.
2. **Own-suffix seed boundary for team-event counting**: a line with
   numeric `seq < header.seedLength` is a forked-ancestor fact and is not
   counted for the session; lines without a readable `seq` are TOLERATED
   (counted) — best-effort never asserts the absence of Team facts.
3. **Degradation gate** (required behavior, not a blocker): the view
   degrades to `native-fallback` (`reason: 'no-legacy-metadata'`,
   `degradedTo: 'native-chat-trajectory'`, `native` = the plain session
   evidence list) iff there are **no roster members AND no team session
   anywhere** (team session = evidence with `teamEventTotal > 0`). Native
   chat sessions therefore never block the legacy view, and a legacy team
   never fails to be recognized because of unrelated native traffic.
4. **Leader selection**: argmax over UNBOUND team-fact sessions
   (`teamEventTotal` desc, `createdAt` asc with missing last, effective id
   asc; effective id = header id else directory id). The session carrying
   the bound mark is a member, never the leader (bound ⇒ team-fact
   sessions still rank, but a bound session that also has other team
   facts is excluded from leadership — the mark says "this log belongs to
   a member"). `teamId := leaderSessionId` (the legacy writer carried no
   separate team id on disk).
5. **Member child session ids**: union of (a) sessions with a bound mark
   and (b) subagent-origin sessions whose `parentSession` points at the
   leader — minus the leader itself, sorted.
6. **Roster sources**: `<dshHome>/teammates/*.md` (home) then
   `<workspaceCwd>/.dsh/teammates/*.md` (workspace); workspace wins per
   member id (last-wins dedup); no-id members append after id'd ones.
   `workspaceCwd` absent → home source only.
7. **Mutation rejection is total**: `dispatchReaderAction` is the only
   entry; non-string/empty action → `LEGACY_READER_INVALID_REQUEST`;
   any other string (including `resume`, `restore`, `mutate`, `fork`,
   case/whitespace variants) → `LEGACY_READER_MUTATION_REJECTED` with
   `details.action` echoing the rejected verb. There is no other code path
   that touches the home; the in-process M3 no-op battery and the e2e L2
   byte-identical snapshot prove read-only behavior.
8. **Immutability**: the returned view is deep-frozen (`deepFreeze`); the
   port is read-only by interface; no timers, no handlers, no state
   persists between calls (the reader is a pure function of
   `(port, request)`).

## 3. Documented deviations (vs the frozen legacy behavior)

| # | deviation | reason |
| --- | --- | --- |
| D1 | **Lenient roster parse** instead of the legacy all-or-nothing parser (the frozen parser dropped a whole file on a missing `id`, bad `role`, or unsupported `schemaVersion`) | best-effort mandate (D1); each defect is recorded as a `ROSTER_WARNING_REASONS` entry (FRONTMATTER_MISSING / SCHEMA_VERSION_MISMATCH / ID_MISSING / ROLE_INVALID / NAME_MISSING / DESCRIPTION_MISSING / FILE_UNREADABLE) and the remaining fields are still reported |
| D2 | **Lenient header recognition** (header = the first non-empty line, any subset of fields accepted; missing fields simply absent) instead of fail-closed validation | a partially damaged header must still yield what is readable; undecodable first line → `headerPresent: false` with event counting from line 0 |
| D3 | **No legacy leader-demotion applied**: the reader reports the legacy leader evidence as-is; it does not rewrite it to the vNext object model (TeamBlueprint→TeamSession+TeamDomain→MemberInstance) | read-only inspection scope; vNext semantics are the runtime packages' concern (the integrated suites prove the G7 criteria on the real runtime objects separately) |
| D4 | **Seq-less team-event lines are tolerated** (counted) | see locked decision 2 — absence is never asserted |

## 4. G7 integrated suites (deliverable B)

Each G7 criterion (DevPlan §20.7) is exercised against the REAL runtime
modules (compatibility / lifecycle / fork-reconciliation / handoff-service
worlds from the P7-T1..T5 helpers) with the legacy reader threaded through
as an isolated observer (`inspectLegacyTeam` + `assertOnlyReadOps` + home
snapshot identity) so the suites prove both the criterion AND that the
reader never perturbs the world:

| criterion (verbatim) | suite / scenario |
| --- | --- |
| `warning/fatal admission semantics` | `p7t7-integrated-drift-ack.test.ts` S1 (web-down → NEW_ACTIVATION warning → admit BLOCKED_WARNING → ack → DEGRADED_ACKNOWLEDGED → admit OK; skill-base-down → fatal → BLOCKED_FATAL) |
| `ack fingerprint invalidation` | `p7t7-integrated-drift-ack.test.ts` S2 (stale ack rejected after capability-generation bump → CAPABILITY_GENERATION_CHANGE probe) |
| `human override precedence` | `p7t7-integrated-override-admission.test.ts` (member grant → instanceOverlay/leader grant → templateOverlay → human override m-human wins with full `overriddenLower` chain; beta follows team scope) |
| `lifecycle quiescence` | `p7t7-integrated-lifecycle-restore.test.ts` S4 (archive RUNNING: step order incl. DRAIN before WAIT_QUIESCENCE before COMMIT; clock kinds; residency drop; durable ARCHIVED) |
| `Restore does not create/resume Agent` | `p7t7-integrated-lifecycle-restore.test.ts` S5 (restore ARCHIVED: exactly `[COMMIT_RESTORE]`, zero live contact, `resumeAgentCalls === 0`, `createAgentCalls === 0`) |
| `Root fork exact semantics` | `p7t7-integrated-fork-handoff.test.ts` S6 (root fork reconciled: durable writes = team_sessions + session_bindings only, childBinding kind `team-root`, memberCount 0, blueprint snapshot exact) |
| `Member fork ordinary semantics` | `p7t7-integrated-fork-handoff.test.ts` S7 (member fork: 0 durable writes, no child binding/team session, parent membership intact) |
| `handoff one-shot/no-live-link` | `p7t7-integrated-fork-handoff.test.ts` S8 (startTeamFromHere: one source read + one summarize + one creation intent; context deep-frozen; post-handoff source mutation invisible to the context (oracle diverges); same-token replay returns the SAME context reference without re-reads; fresh token re-reads with a new `handoff-ctx-…` token) |
| `legacy old Team cannot mutate/resume` | `p7t7-mutation-reject.test.ts` M1-M4 (dispatch surface rejects 10 verbs + case/whitespace variants + malformed inputs; fresh-port battery proves zero side effects; the port face is exactly `{listDir, readFile}`) |

## 5. Real-instance E2E (deliverable C)

Modeled on the P5-T5/P6-T6 real-instance harness pattern:

- **Host**: a REAL DSH web instance booted from the pristine test-use tree
  (`references/deepseek-harness-test-use`, pin `cd5ef814`) on port 3180
  with a FRESH workspace-internal `DSH_HOME`
  (`references/.dsh-test-p7t7`, removed per run).
- **Seam**: the single row `p7t7-legacy-session-reader`
  (`e2e/plugin.mjs`, Cordis function-plugin protocol: named exports
  `name`/`inject: ['webServer']`/`apply`) is mounted ONLY through the
  public `cordis.patch.yml` profile patch layer; `dump-config` proves the
  mount (`DshInstance.rowInDump`).
- **Row duties**: register the ts-loader resolve hook (consumes the
  WORKTREE's session-reader TypeScript via native type-stripping — no
  bundling/prebuild); build the real-FS read-only home port over the
  host's `DSH_HOME`; start its own mini MCP endpoint (127.0.0.1, ports
  3491-3495 first free) exposing the ONE public tool
  `p7t7_legacy_read {action, projectDir?, workspaceCwd?}`; register two
  host web routes (`GET /__p7t7/health`, `POST /__p7t7/run`) with
  effect-cleanup on row stop.
- **Scenarios** (each driven by a full MCP client round-trip
  initialize → initialized → tools/call):
  - **L1** — planted legacy fixtures (2 roster files with a workspace
    overlay, leader session: header + 2 team events + 1 non-team event,
    bound member child: subagent lineage + bound mark) → assert the full
    legacy view: status/leaderSelection/leader/teamId, roster overlay
    (workspace wins per id), member child ids, per-session evidence
    counts (eventCount vs teamEventTotal vs non-team events), and a
    byte-identical fixture snapshot after the call (read-only proof).
  - **L2** — `resume` / `restore` / `mutate` actions → each returns
    `isError` with code `LEGACY_READER_MUTATION_REJECTED` and the
    `details.action` echo; the `inspect` control still succeeds; snapshot
    byte-identical.
  - **L3** — driver wipes all roster sources + the legacy session project
    and plants a native-only session project → the view degrades to
    `native-fallback` / `no-legacy-metadata` /
    `native-chat-trajectory`; the native list carries the planted session
    (header present, zero team events); snapshot identical.
- **Preroll/postroll**: pristine test-use git state captured before and
  after (byte-clean proof), stable `:3080` instance probed before and
  after (untouched proof), boot + mini-MCP ports released after stop,
  build chain runs ONLY if farm lib artifacts are missing (TEST_METHODS
  §2 bypass chain; the run recorded `build.required=false`).
