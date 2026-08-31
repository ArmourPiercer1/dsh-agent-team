# P8-T1 design note — projection contract v1 (TeamProjectionDto)

Task: P8-T1 (R50) — freeze the TeamProjection DTO v1.
Owned path: `packages/contracts/src/projection/**` (+ the projection export
block in `packages/contracts/src/index.ts`, the four must-test suites +
fixtures under `packages/contracts/test/`, and the p4t6 scanned-file count
update in `packages/testkit/test/p4t6-session-event-scan.test.ts`).
Output: projection contract v1 (frozen, version-stamped, lossless-JSON).
Must-tests: serialization; generation monotonic; nullable live overlay.
Acceptance: the DTO leaks no TeamDomain storage internals and no
SessionController Team mirror.

## 1. Module layout (`packages/contracts/src/projection/`)

- `common.ts` — shared field primitives: `assertNonNegativeInteger`,
  `parseOpaqueField` (label-like string with max length + control-char
  rejection), and `toRecord` (the single documented lossless-JSON cast used
  by the `create*` factory paths; see §3.3).
- `schema.ts` — the projection's OWN schema-version track, frozen at `1`
  (see §3.1). Reuses the shared closed error codes
  `SCHEMA_VERSION_MISMATCH` / `SCHEMA_VERSION_UNSUPPORTED`; introduces no
  new codes.
- `states.ts` — the closed state vocabularies: admission (Architecture §28,
  four states), residency (UI §24, three states), template kinds
  (Architecture §6.1), context policies (invariant 29), the closed P6-T2
  progress set, and the eight ledger categories (UI §27.4). Each is an
  `as const` object (or fixed array) + `_VALUES` + guard + field parser.
  The MemberInstance lifecycle vocabulary (Architecture §29) is NOT
  re-declared: it is the P3-T1 `MemberLifecycleState`, re-exported by the
  barrel.
- `effective-config.ts` — the four frozen lanes (UI §18.2 example):
  `model` / `workspace` / `permissions` / `autonomy`. Entry =
  `{value: string | null, source, state}`; `permissions` is a map of
  label-validated names to entries (may be empty) (see §3.4).
- `compatibility.ts` — `CompatibilitySummaryDto`: status + probeGeneration
  + the two fingerprints + warning/fatal/ack counts, with the frozen
  invariant `acknowledgedWarningCount <= warningCount` (reason
  `ACKNOWLEDGED_COUNT_EXCEEDS_WARNING_COUNT`).
- `activity.ts` — `ActivityIntervalSummary` (correlation + openedAt),
  the durable `MemberActivitySummaryDto` (all seven fields DURATIONAL-
  optional, absent-key), and the non-durable `MemberLiveActivityDto`
  (residency required; the other four optional).
- `template.ts` — `TemplateProjectionDto`: kind, templateId, displayName,
  description?, contextPolicy, instanceQuota? (member-only).
- `root.ts` — `TeamRootProjectionDto`: identity + admission view. NO
  lifecycle field (Architecture §8.6); `policyState` is an opaque
  label-validated name (policy states are blueprint-defined);
  `handoffSourceSessionId` absent-key for a fresh session
  (Architecture §34.1).
- `member.ts` — `MemberProjectionDto`: the unified row for the
  LeaderInstance and every MemberInstance (invariant 14). Shape encodes
  invariant 14: the leader row (instanceId `inst-leader`) must NOT carry
  `childSessionId`; every other row MUST (reason
  `LEADER_INSTANCE_MUST_NOT_CARRY_CHILD_SESSION`). `liveActivity` is an
  always-present nullable key; `activity` is an absent-key durable fact.
- `ledger.ts` — `LedgerSummaryDto` only (never the entries, UI §27):
  latestSequence, totalEntries, `byCategory` (all eight categories as
  keys, zero counts explicit), pendingControlCount; invariant
  `totalEntries === sum(byCategory)` (reason `TOTAL_ENTRIES_MISMATCH`).
- `projection.ts` — `TeamProjectionDto` + the frozen cross-invariants
  (reasons: `ROOT_TEAM_SESSION_MISMATCH`, `LEADER_TEMPLATE_MISSING`,
  `LEADER_TEMPLATE_NOT_UNIQUE`, `TEMPLATE_ID_DUPLICATE`,
  `INSTANCE_ID_DUPLICATE`, `LEADER_INSTANCE_DUPLICATE`,
  `LEADER_TEMPLATE_MISMATCH`, `UNKNOWN_MEMBER_TEMPLATE`,
  `LEADER_INSTANCE_MISSING`) + `parseTeamProjection` /
  `createTeamProjection` / `serializeTeamProjection` /
  `deserializeTeamProjection` / `isStaleTeamProjection`.
- `index.ts` — the family barrel; also re-exports the two P3-T1 values the
  family embeds (`MemberLifecycleState` vocabulary, `BlueprintSnapshotRef`
  type) so a projection consumer reads one module.

Every record follows the house pipeline: `assertPlainRecord` →
`assertNoLegacyFields` → `assertNoUnknownFields` → `assertFieldPresent` →
field parsers → `deepFreeze`; `create*` builds a plain record (optional
keys conditional) and runs the SAME `validateX(record)`; `serialize` =
`canonicalJsonStringify`; `deserialize` = `JSON.parse` wrapped in
`MALFORMED_DTO`.

## 2. Card + DevPlan §21 mapping

- "Root/Template/Instance DTOs" → `root.ts` / `template.ts` / `member.ts`
  (the instance row unifies LeaderInstance and MemberInstance, invariant
  14; the record DTO `MemberInstanceRecord` (P3-T1) is the durable
  producer, the projection row is the rendered view).
- "lifecycle" → embedded P3-T1 `MemberLifecycleState` on the member row;
  the root deliberately has none (§8.6).
- "effective-config" → `effective-config.ts` (UI §18.2).
- "activity" → durable summary + live overlay (`activity.ts`).
- "ledger-summary" → `ledger.ts` (summary only; Events = TeamLedger,
  UI §27).
- "generation DTO" → the whole-projection `generation` stamp + the frozen
  stale guard `isStaleTeamProjection` (DevPlan §21.4).
- DevPlan §21.2 source rule: the projection is produced from TeamDomain
  (invariant 41) + an optional live overlay and MUST NOT scan Root+child
  Session logs. The DTO enforces the negative surface: it carries no
  session-log facts, and the acceptance tests assert it leaks no storage
  internals and no SessionController Team mirror (see §4).
- Invariant 9: `teamSessionId` IS the root session id — the top-level id
  is `parseTeamSessionId`-validated (RootSessionId brand) and must equal
  `root.teamSessionId` (`ROOT_TEAM_SESSION_MISMATCH`).
- Invariant 10: exactly one bound blueprint snapshot, embedded as an
  immutable ref (reusing `BlueprintSnapshotRef`).

## 3. Design decisions and deviations (recorded per AGENTS.md)

1. **Own schema-version track.** The projection family stamps
   `PROJECTION_SCHEMA_VERSION = 1` instead of re-stamping the package-wide
   `TEAM_CONTRACT_SCHEMA_VERSION` (P3-T1 freeze). The three record families
   (TeamSessionRecord, MemberInstanceRecord, TeamProjection) evolve
   independently; a projection-shape change must not bump the TeamDomain
   record stamp, and vice versa. The CHANGELOG.md freeze rule governs
   bumps in either direction. The shared closed error codes are reused; no
   new codes are introduced.
2. **Leader encoded in the projection shape.** The P3-T1 record DTO leaves
   leader/member shape rules to the producer; the projection is the
   rendered view and validates them: the leader row is identified by
   `instanceId = LEADER_INSTANCE_ID` (`'inst-leader'`, invariant 14), must
   reference the single leader template, and must not carry
   `childSessionId`; every other row must carry one. Exactly one leader
   template (invariant 13) and exactly one leader row
   (`LEADER_INSTANCE_MISSING` / `LEADER_INSTANCE_DUPLICATE`) are enforced
   at the top-level parse.
3. **`toRecord` single-cast trust point.** `create*` factories receive
   typed inputs and build the plain record through ONE documented
   lossless-JSON cast (`toRecord` in `common.ts`) — TS interfaces without
   index signatures are not assignable to `RemoteSafeRecord`, and a
   field-by-field re-listing would duplicate the closed-shape source of
   truth. The cast is immediately re-validated by the SAME `validateX`
   pipeline the parse path uses, so a factory can never bypass any check
   (exercised by `p8t1-projection-serialization` "the create factory still
   rejects a corrupt input").
4. **`permissions` lane is a map.** Unlike the three direct lanes,
   `permissions` maps label-validated permission names to entries (the map
   may be empty): the UI §18.2 view is per-permission, and the lane value
   set is per-name, not per-lane. Keys are label-validated with the same
   discipline as `policyState`; the closed-value discipline applies to
   each entry.
5. **Durable absent-key vs live null.** Durable optional facts
   (`activity`, `defaultWorkspace`, `handoffSourceSessionId`,
   `lastProbedAt`, template `description`/`instanceQuota`, member
   `groupId`) follow the DURATIONAL-optional discipline: ABSENT key when
   the fact does not exist, never an own `undefined` key. The live overlay
   is different by design: `liveActivity` is ALWAYS a present key because
   its presence is the render signal, and its value is `null` (live source
   has no facts) or a `MemberLiveActivityDto`. The overlay suite asserts
   the durable bytes are byte-identical after stripping the key from both
   serializations.
6. **`isStaleTeamProjection` is a per-team guard.** A projection is only
   comparable with the projection of the SAME `teamSessionId`; a different
   team returns `false` (not stale, not comparable) because the client
   keys projections by `teamSessionId`. Same team: `incoming.generation <=
   current.generation` is stale (equal stamp is rejected — no re-apply).
7. **No CHANGELOG edit.** `packages/contracts/CHANGELOG.md` is not an
   owned path of P8-T1 (the freeze rule it carries already covers the new
   schema track; the track's freeze is documented in `schema.ts` JSDoc).
8. **Dependency interpretation.** The card's "allowed deps
   contracts/domain only" is read as the whole-P8 constraint: the
   projection module family imports ONLY the contracts package's own
   modules (no cross-package imports, no cycle) and stays dependency-free
   like the rest of `packages/contracts`.

## 4. Acceptance verification (no leakage)

Two independent layers in `p8t1-projection-negative.test.ts`:

1. **Field surface**: the union of all eleven frozen `*_FIELDS` constants
   (96 names) is asserted disjoint from storage-internals markers
   (`tableName`, `storageDomain`, `storagePath`, `filePath`, `journal`,
   `journalOffset`, `cursor`, `sql`, `query`, `connection`, `offset`) and
   from SessionController Team-mirror markers (`ctx`, `controller`,
   `mirror`, `roster`). Note: `'team'` is deliberately NOT a marker — it is
   the legitimate frozen ledger-category value of UI §27.4 (a byCategory
   key), and matching it would conflate a frozen vNext vocabulary with a
   mirror-shape leak.
2. **Wire bytes**: the canonical serialized JSON of a full projection is
   asserted to contain none of those quoted field tokens.

## 5. Test plan and results

- `p8t1-projection-fixtures.ts` — plain unbranded raw fixtures (the parse
  pipeline sees untrusted values) + raw builders with override slots.
- `p8t1-projection-serialization.test.ts` (11 tests) — parse→serialize→
  parse lossless round-trip; canonical bytes independent of key insertion
  order; deterministic bytes; unknown top-level field; legacy `memberId`
  (`LEGACY_MEMBER_ID_REJECTED`); non-plain containers; invalid JSON text;
  deep-freeze; create factory = same pipeline (identical bytes + still
  rejects).
- `p8t1-projection-generation.test.ts` (8 tests) — generation 1 first
  stamp; 0/negative/fractional/string/null rejected; strict ordering of a
  monotonic sequence; the stale guard matrix (lower/equal/higher;
  different team not comparable).
- `p8t1-projection-overlay.test.ts` (8 tests) — `liveActivity` always
  present; null value exact; residency required + closed three-state set;
  unknown live field rejected; durable bytes independent of the overlay;
  durable `activity` absent-key discipline.
- `p8t1-projection-negative.test.ts` (23 tests) — the two acceptance
  layers (§4); every frozen `*_FIELDS` constant pinned to its exact
  closed set; root has no `lifecycle`; closed vocabularies pinned
  (admission, lifecycle = P3-T1 five states, ledger = UI §27.4 eight,
  progress = P6-T2 set); closed shapes at top and member level; all ten
  cross-invariant reason paths; `totalEntries` sum invariant;
  `byCategory` closed key set; schema-version codes (2 → MISMATCH, 0 / 0.5
  → UNSUPPORTED).

New tests: 50 (11 serialization + 8 generation + 8 overlay + 23
negative).

Chain (all sanctioned commands, worktree `task/P8-T1-projection-dto`,
proof in `attempt1-baseline.log` / `attempt1-post.log`):

- baseline: 1588/1588 passed, 0 failed; tsc contracts/domain/storage/
  runtime/testkit all exit 0.
- post: 1638/1638 passed, 0 failed (1588 + 50); tsc contracts/domain/
  storage/runtime/testkit all exit 0.
- p4t6 denylist scan: 411 → 428 files scanned (17 new: 12 module .ts under
  `contracts/src/projection` + 5 unit-test .ts under `contracts/test`);
  the scanner's measured count matches the arithmetic; the suite is green,
  so the new files are denylist-clean.

## 6. Discrepancies and notes

- At baseline, `master` (`d8971c6`) is one commit ahead of the assigned
  base `959e363` (the R50 kickoff commit, touching
  `dev/agent-workflow/` only). The worktree branches from the assigned
  base per the brief; the owned paths are untouched by the kickoff commit,
  so there is no content conflict to record.
- No push, no main-worktree writes, no references/ or
  `D:\deepseek-harness\` or :3080-instance access from this task.
- Zero-core red lines held: no `node:` imports in the new `.ts`, no
  upstream imports, no legacy Team SessionEvent vocabulary (the scanner
  proves it), no class/Date/Map/Set/undefined values in DTO data.
