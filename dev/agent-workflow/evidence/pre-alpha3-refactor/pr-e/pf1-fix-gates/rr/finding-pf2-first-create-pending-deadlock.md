# PF-2 (proposed) — D-3 first-create bootstrap deadlock: team-scope `mcpServer` required, no pre-existing live session mounting the server

**Status: STOP — new product-level finding, parent adjudication required.**
Discovered by the E.12 FRESH-world run `prereq-2026-09-29T23-18-42` (post-narrowing tree:
`bb7b9f0b` + uncommitted D-1/D-3/narrowing product + reworked kit), 2026-09-30.

## 1. What happened (exact reproduction)

World: fresh row host (port 3182), row `mcpServers` configured (`mcp_repo`/3492,
`mcp_leaderreq`/3491, `mcp_web`/3493 — the S1 supply axis PASSed: every mini-MCP
answers initialize), row `environmentFacts` seeds present (all four subjects
`available: true` — verified in the row dump, `instances/B1-CREATE/dump-config.txt`
L1264-1284), boot directive on the ZERO-REQUIREMENT v1 row anchor
(`team.prereq-anchor@1`, source verified in the retained world's
`blueprint_registry`: `schemaVersion: 1`, `requirements: []`, no capabilities).

Boot B1 (create phase) timeline (`instances/B1-CREATE`, `run.log`):
- `43.489` boot starts → `44.907` row ready (toolCount=13)
- `44.984` `intent.probe(T)` → **BLOCKED_FATAL**:
  `team.mcp.repo` FATAL `COMPLETE_REQUIREMENT_NOT_MET` ("complete:true requirement
  unmet: mcp_repo (structural FATAL, not downgradeable)"), same for
  `team.mcp.leaderreq` (`scenario-s1-probe.json`)
- `44.997` `team.create(T)` pre-consent → typed **PENDING** (expected `consentRequired`
  for `lead.mcp.signal` was superseded): `scenario-s1-t-create-pre-consent-refusal.json`

```json
{ "source": "creation-preflight", "outcome": "pending", "blockedScopes": [],
  "consentRequiredRequirementIds": [], "fixOrDisableRequirementIds": [],
  "fatalRequirementIds": [], "status": "BLOCKED_PENDING",
  "gateReason": "requiredScopePending",
  "recheck": "next-boundary-or-compatibility.reprobe",
  "pendingRequirementIds": ["team.mcp.repo", "team.mcp.leaderreq"] }
```

- B1b (post-consent resume boot): `team.create(T)` → **same typed PENDING** → kit
  `dieFatal` (a create failure at that point is unrecoverable under the kit's
  current expectations) → exit 1, world RETAINED.
  (`run.log`: "the creation preflight of ... is 'pending' — the durable Team bind
  is refused (zero durable effect; a required capability is not yet observed
  (materialization pending) — re-drive the creation at the next boundary (or run
  the compatibility reprobe); the block is recheckable, not a deadlock)")

Post-mortem hygiene: test-use pristine @ `46a7f68b09` (0 dirty, H1 pre-check
passed in-run), all run ports released (3182/3183/3491-3493/3497 free), no stray
processes, token-scrubbed evidence dir written by the kit's error path.

## 2. Root-cause chain (all steps verified in code)

1. **Live observation of the team-scope subjects is `unknown` at B1 — structurally.**
   The host's mcpServer probe is host-wide over LIVE sessions
   (`src/plugin/host.ts` L1816-1838): any live session with a mounted fiber →
   `reachable`; any live session with a `failed` materialization slot →
   `unreachable`; **nothing live for the subject → `unknown`**. At B1 the only
   live sessions are the row's boot-root (the zero-requirement anchor — its
   template allows no mcp server, so it materializes none — K10: "the boot root
   stays `pending`") — hence `unknown` for `mcp_repo`/`mcp_leaderreq`. This holds
   at ANY time before the first team create: the team-scope servers materialize
   ONLY at the leader boundary of an EXISTING team (the creation boundary's
   post-bind reconcile).
2. **The probe path drops the seed** (this pass's D-3 wiring,
   `src/plugin/s6-remote.ts` L2011-2027): `environmentFactsRead` (the full
   resolution) → `dropSeedFilledPendingFacts` removes the seed-filled facts of
   every REQUIRED requirement whose live observation is `unknown` (probeable
   scoping per the option-1 narrowing — `mcpServer` IS probeable: the host
   registers its probe port). Engine then reports the required facts MISSING →
   FATAL → `BLOCKED_FATAL`. This is the designed strict predictor of the gate's
   PENDING (INV-9.4 "complete the observation, not weaken the verdict"; the probe
   wire vocabulary is 2-state and cannot express PENDING).
3. **The creation preflight reclassifies to PENDING**
   (`requirements/creation-preflight.ts` L395-407, the D-3 overlay): the
   seed-filled base outcome (`consentRequired` / `proceed`) is beaten by
   `pendingFindings` = the team scope's `unknown`+required+probeable subjects —
   "a required capability that has not yet been observed admits nothing —
   fail-closed". Precedence: down-based outcomes first (none — no confirmed
   down), then pending beats consentRequired/proceed.
4. **The deadlock**: the PENDING recheck is `next-boundary-or-compatibility.reprobe`.
   Reprobe re-reads the SAME live state — the team-scope servers still never
   materialized, because the team does not exist, because the create is blocked.
   No state change is reachable from this world shape: **deterministic,
   structural liveness deadlock of the first create** (not a timing window).

## 3. Why this is a finding about the ADJUDICATED semantics, not the implementation

The implementation is faithful to the option-1 D-3 adjudication:
- required + probeable type + unsettled (`unknown`) observation → typed PENDING,
  never a seed-filled PASS (plan §C.3 禁止 false OPEN + E.3 + E.11#10);
- probeable = "probe port registered for the capability type" (the host registry —
  single source of truth; `mcpServer` probeable, `skill`/`tool`/`modelRoute`/
  `teamStructure`/`persona` not);
- the probe is the strict 2-state predictor (U5 nuance: strictly stricter than
  the gate = the documented safe direction).

The gap: the adjudication's PENDING rule was framed around the **transient
materialization window of an EXISTING team** (B5: in-flight reprobe after an
outage; S11: restart reset — in both, the team exists and the materialization
that settles the observation is already scheduled). It did not cover the
**pre-creation bootstrap state of a TEAM-SCOPE requirement**, which is
structurally unobservable before the team exists (no live session can host it) —
so "unsettled observation" there is not transient: it settles only AFTER the
verdict that would let it settle is granted. The product's own block message
("the block is recheckable, not a deadlock") is false for this state.

Scope of the gap (checked against the kit's 14 scenarios):
- affected: first create of a team with REQUIRED TEAM-SCOPE `mcpServer`
  requirements, on a host where NO live session (boot anchor or earlier team)
  allows + mounts those servers. The canonical production first-team scenario.
- unaffected: non-probeable required types (legacy seed-satisfied 2-state —
  deliberately preserved); `persona` (structurally observable pre-create via the
  substrate plan — preset-mounted, subject-matched — B9's world works);
  template-scope mcp requirements (cold member → `not-applicable`, never
  pending — E.11#1); second+ creates on a host where an earlier live session
  already mounts the server (host-wide probe → `reachable`).

## 4. Options for the parent (mutually exclusive first move)

**(A) Product exemption — first-create bootstrap state** (product change,
one-line-of-semantics, all existing invariants preserved): at the CREATION
preflight (the pre-bind evaluation) only, a required team-scope `mcpServer`
requirement whose live observation is `unknown` in the NEVER-observed state
(no live session holds a fiber, a pending slot, or a failed slot for the
subject — structurally not-yet-applicable: the team does not exist yet) is
SEED-SATISFIED (legacy 2-state, the documented known-gap treatment), instead of
PENDING. Rationale: the team-scope materialization that could settle the
observation is triggered BY the creation itself (post-bind reconcile at the
leader boundary) — pre-bind it is not a transient window, it is the
pre-applicability state. The post-creation boundary gate KEEPS the full D-3
(existing team + in-flight/failed → PENDING → FATAL: B5 unchanged; S11 restart
reset unchanged — an EXISTING team's restart has scheduled materialization, so
its pre-reconcile state is a genuine transient window). Concretely: the
`classifyScopeReadiness` pending partition (or the preflight overlay) exempts
team-scope subjects in the never-observed state at pre-bind;
`dropSeedFilledPendingFacts` gains the same exemption on the probe path.
PROBE-SIDE SUB-DECISION: `intent.probe` is blueprint-level (no rootSessionId
argument), so it cannot by itself distinguish the PRE-CREATE state from an
EXISTING team's post-restart never-observed state. (A1) the probe exempts all
never-observed team-scope unknowns: pre-create probe OPEN/seed-satisfied AND
post-restart probe OPEN until the boundary settles (a relaxation of S11's
"re-probed at the next boundary" intent — the kit's S11 assertion is slot-level
only and would still pass); (A2) the probe stays strict (FATAL for every
never-observed team-scope unknown) and the INV-9.4 probe==gate identity is
scoped to "same world, same applicability state" — the pre-create probe then
OVER-predicts (FATAL where the preflight now admits): the predictor invariant
holds in the safe (stricter) direction, which the U5 nuance already sanctions,
but S1's kit criterion would flip from OPEN to strict-FATAL for the pre-create
world; (A3) the probe gains an applicability hint (the host knows whether a
TeamSession row exists for the relevant root — a wiring change on the frozen
T1.4-B probe contract).
Risk: a narrow relaxation of "never a seed-filled PASS" for exactly the state
where the live truth is structurally unreachable pre-create — the seed there is
the only available information, which is precisely the documented known-gap
case the option-1 narrowing preserved for non-probeable types (same spirit,
different trigger: structural pre-applicability instead of missing probe port).

**(B) Kit-world realism — zero product change**: give the row anchor a leader
template that ALLOWS the row's mcp servers (realistic production composition:
the operator configured the servers for the row; the boot-root session mounts
them at boot). Then the host-wide probe is `reachable` at B1 (the anchor's
fiber) → probe OPEN, create unblocked; D-3 stays exactly as adjudicated. The
first-create gap then remains as a DOCUMENTED product limitation ("a first team
with team-scope mcpServer requirements needs some live session — e.g. the row
boot anchor — to allow + mount those servers, or the creation blocks PENDING"),
recorded in the contract docs. Kit work: anchor blueprint gains the mcp
capability (registry contentHash changes — S13's frozen hash is a DIFFERENT
blueprint, `team.mpr-anchor`, untouched); S1 waits for the anchor's mounts to
settle before the probe (`waitForMcpSlot`); re-verify every outage scenario
(B5/B6/B7/B8, S11, S14) against the extra anchor session carrying the same
server state (the probe aggregates across sessions: in-flight-anywhere+no-fiber
→ unknown; failed-anywhere → unreachable — the PENDING-admit/FATAL-delegate
dual assertion is preserved, but each scenario's slot assertions must be
re-checked for the added session rows).

**(C) Both**: (B) to get E.12 green this pass + (A) as a follow-up product
adjudication for the documented gap.

## 5. What is NOT the cause (ruled out)

- Not the PF-1 fix's scope bug (that fix's own reverse-red signature was "P1
  probe B1 'BLOCKED_FATAL' to be 'OPEN'" — the fix restored OPEN for
  configured+healthy servers; this run's FATAL is a different mechanism: the
  facts ARE resolved against the requested blueprint, they are DROPPED by the
  D-3 pending drop-filter because the live observation is unknown).
- Not the option-1 narrowing itself: the narrowing only REMOVED PENDING for
  non-probeable types; `mcpServer` is probeable, so the B1 PENDING fires
  identically with or without the narrowing (the pre-narrowing D-3 code would
  have PENDINGed B1b too — and additionally PENDINGed the non-probeable types,
  which the narrowing now correctly exempts).
- Not a race/timing: the observation is `unknown` at all times pre-create in
  this world shape (verified structurally in §2.1); no wait length changes it.
- Not a dist/staleness issue: the run used the post-narrowing rebuild (9/9,
  `pending.js` present in dist) and the post-narrowing typecheck (8/8 exit 0).

## 6. Evidence index

- Retained world: `tests/homes/prereq-2026-09-29T23-18-42/` (do not reuse —
  `assertFreshHome`; kept for inspection)
- Evidence dir (token-scrubbed by the kit's error path):
  `dev/agent-workflow/evidence/pre-alpha3-refactor/pr-e/prereq-2026-09-29T23-18-42/`
  (`scenario-s1-probe.json` — the FATAL wire; `scenario-s1-t-create-pre-consent-refusal.json`
  — the PENDING wire; `scenario-s1-b1-consent-grant.json`; `scenario-s13-*.json`;
  `instances/{profile-init,B1-CREATE,B1B-RESUME}/`; `run.log`; `mock.log`)
- Console log: `rr/e12-run-post-narrowing.console.log`
- This run's gates (already done, valid for the post-narrowing tree): build 9/9
  (`rr/build-post-narrowing.log`), typecheck via root script 8/8 exit 0
  (`rr/typecheck-post-narrowing.log`), p4t6 10/10 (886 events) re-verified
  2026-09-30T07:18Z.

## 7. State at STOP

- Branch `feat/pre-alpha3-pre-e-requirement-recovery` @ `bb7b9f0b` (origin
  `2de8f902`, FF-able); uncommitted: the 15 product files + `pending.ts` + the
  37-test suite + the kit + the p4t6 pin + the rr/ evidence set + both world
  evidence dirs (20:52 pre-PF-1 FAIL world, 23:18 post-narrowing FAIL world).
- NO commits made this segment; NO push; zero-touch :3080/:3180 held
  (pre-probes 401 in-run); test-use pristine; U5 untouched.
- Parent's continuation step 4 (E.12 EXIT 0) is BLOCKED on this adjudication;
  steps 5-7 (gates/commits/push/report) pending — the build+typecheck gates are
  already green for the current tree.
