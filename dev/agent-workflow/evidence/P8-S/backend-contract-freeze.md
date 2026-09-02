# Backend Contract Freeze — P8-S closure (S7-FREEZE, R83, 2026-09-02)

**Status: FROZEN.** This document is the **sole backend contract reference for P9
(UI) and P10 (hardening)**. It was authored by the main agent from the closed
coverage matrix (`ui-backend-coverage-matrix.md`, 216 rows), the contract
sources at int tip `4441852` (int/P8-S-backend-closure, post S7-R4), and the
recorded main-agent rulings (R80/R81/R82 in `SESSION_ROUTER_LOG.md`). Any P9
surface that is not listed here as available, native-proven, or
client-local is **not backed** and must not be assumed. Any change to a listed
contract is a contract change (version bump / CONTRACT_CHANGE_REQUEST), never
a silent edit.

Baseline: int tip `4441852` — fresh + dist chains **2091/2091**, tsc 8/8,
p4t6 scan pin **543**, live 17/17 (104/104 assertions), test-use pristine
`cd5ef814`.

---

## 1. Projection DTO & version track

The projection family carries its **own `schemaVersion` track** (independent
of the package-wide `TEAM_CONTRACT_SCHEMA_VERSION`):

- **v1 (frozen, P8-T1)** — `TeamProjectionDto`: whole read-only view of one
  TeamSession (top-level fields `TEAM_PROJECTION_FIELDS`; member rows
  `MEMBER_PROJECTION_FIELDS`; root facts; templates; ledger summary).
  `PROJECTION_SCHEMA_VERSION = 1`.
- **v2 (ACTIVE, additive, S7-R2)** — `PROJECTION_SCHEMA_VERSION_V2 = 2`,
  `SUPPORTED_PROJECTION_SCHEMA_VERSIONS = [1, 2]`. v1 records stay parseable
  byte-identically; every v2 addition is **DURATIONAL-optional** (absent,
  never own-undefined), so the default projection is byte-identical to v1:
  - top-level: `TEAM_PROJECTION_FIELDS_V2 = v1 + [disposedHistory]` (key
    ABSENT iff the team has zero DISPOSED members — D14 digest,
    `projection/disposed-history.ts`).
  - member rows: `MEMBER_PROJECTION_FIELDS_V2 = v1 + [modelState]`
    (`projection/model-state.ts`; `availability` REQUIRED:
    `available` | `unavailable`; closed layer/origin value sets; length caps
    512/128/512).
  - effective-config resolved view (`projection/effective-config.ts`, BQ-08):
    closed entry fields `['value','source','state']` (v1 core) +
    `EFFECTIVE_CONFIG_ENTRY_FIELDS_V2` adds the DURATIONAL-optional
    `suppressed`, `unavailable`, `deniedBy`, `effectiveFrom`, `locked`.
  - Producers: the **production projection service stamps `schemaVersion: 2`**;
    root facts report the **durable** `policyState` (durable-mutation-store
    ledger fact, R2-1); workspace provenance lane resolved per member (R2-4);
    `isResuming` derivation on the live-residency overlay (R2-5; 24-key
    `TeamAgentBindings`).
- No new error codes in either version: shared closed set
  (`MALFORMED_DTO` / `SCHEMA_VERSION_MISMATCH` /
  `SCHEMA_VERSION_UNSUPPORTED`).
- Read port bound surface (pinned, p8s6-projection C2.3): exactly four
  repositories — `teamSessions.get`, `compatibility.get`,
  `memberInstances.list`, `ledger.list` — and no other domain channel.
- TeamSession record (contracts v1 family, additive): `handoffSourceSessionId?`
  (S7-R4, BQ-16 / Architecture §34) — one-shot handoff provenance on teams
  created through Start-Team-from-Here; optional, written once at creation,
  surfaced via `rootFacts` (NOT a top-level projection key by design).

## 2. Remote contract v1 — CLOSED surface

Seam channel `/team-remote`, one dotted method per endpoint
(`packages/remote/src/handlers/register.ts`). **9 categories / 23 methods**
(`packages/remote/src/contracts/catalog.ts`, header: v1 CLOSED). Adding a
method or category is a remote contract change (version bump), never a silent
edit. R80 ruling: additive optional *params* on existing methods are allowed
with a main-agent ruling; new methods/categories are not.

### Query methods (10 — read-only, zero durable writes)
| method | contract |
| --- | --- |
| `catalog.list` / `catalog.get` | blueprint catalog discovery (pre-creation) |
| `intent.probe` | pre-creation compatibility probe (Architecture §7 TeamIntent) |
| `team.getProjection` | whole `TeamProjectionDto` (v2-stamped in production) |
| `team.getLedgerPage` | durable ledger page (see §6) |
| `override.get` | current autonomy-override view |
| `policyState.get` | durable PolicyState (R2-1: the durable fact, not a default) |
| `compatibility.get` | durable environment-compatibility state |
| `handoff.prepare` | **read-only** source-surface summary; zero durable writes, no team creation (handler head doc, `handlers/handoff.ts`) |
| `legacy.inspect` | read-only legacy Team inspection (DevPlan §20.6 degradation) |

### Command methods (13)
| method | contract |
| --- | --- |
| `team.create` | team creation; **optional additive param `initialWork`** (R1, R80 ruling, plan BC-03) — absent ⇒ ABSENT from the parsed record; non-record ⇒ existing malformed-params `field=initialWork reason=invalid-value`; no new error codes |
| `member.create` / `member.send` / `member.followup` | member ops; facade-only (A33) — zero writes on malformed (pinned) |
| `member.archive` / `member.restore` / `member.dispose` | member lifecycle (frozen Architecture §29 FSM: CREATED→RUNNING→SETTLED→ARCHIVED(only from SETTLED)→SETTLED(Restore); any→DISPOSED terminal; **no CREATED→ARCHIVED edge** — R80 I08 NAWR basis) |
| `override.set` / `override.reset` | explicit human overrides |
| `policyState.set` | PolicyState transition; owns a durable `policy-state-transitioned` ledger fact, settled asynchronously (admission never blocked by the scheduled write — R2-1) |
| `compatibility.ack` / `compatibility.reprobe` | ack requires `acknowledgedBy` = rootSid (A32); reprobe re-runs the probe |
| `handoff.create` | `startTeamFromHere`; **idempotent by `(sourceSessionId, requestToken)`** (BC-22 retry is carried by this idempotency — verified, p8s7r4-bc22-idempotency). `querySourceHistoryFromTarget` is **deliberately NOT exposed** (Architecture §34.3: the new team cannot read the source's history). Decisions (continue-without-handoff / cancel, BC-23/BC-24) are **client-side** in-process `resolveHandoffDecision` — NO backend mutation, NO remote decision method exists (verified, p8s7r4-bc23-24) |

### Remote error semantics (closed typed set, 11 codes)
`TEAM_REMOTE_CATALOG_REVISION_MALFORMED`, `TEAM_REMOTE_COMPATIBILITY_STATE_ABSENT`,
`TEAM_REMOTE_COMPATIBILITY_STATE_MALFORMED`, `TEAM_REMOTE_FOREIGN_TEAM`,
`TEAM_REMOTE_LEDGER_ENTRY_MALFORMED`, `TEAM_REMOTE_LEDGER_PAGE_REJECTED`,
`TEAM_REMOTE_LEGACY_HOME_UNAVAILABLE`, `TEAM_REMOTE_OVERRIDE_TARGET_REQUIRED`,
`TEAM_REMOTE_POLICY_STATE_UNKNOWN`, `TEAM_REMOTE_PRINCIPAL_INVALID`,
`TEAM_REMOTE_TEAM_CREATE_BLUEPRINT_MISMATCH`.
Param-level validation uses the existing closed malformed-params set with
`field` / `reason` details (R1 extended the accepted fields, not the codes).
The facade passes `TEAM_RUNTIME_REQUEST_MALFORMED` through the typed-error
invariant with **zero writes** (pinned in p8s6-remote-commands C4.4/C4.5).

## 3. Principal derivation (A32, `plugin/s6-principal.ts`)

Server-side derived; the external caller **cannot self-claim** kind/role:
- `human` = the bound `rootSessionId` (the host-known principal of the
  connected client; client claims are never trusted — same channel as
  governanceAuthority);
- `leader` / `member` principals require the durable instance row **plus**
  root/leader match;
- foreign-team access → `TEAM_REMOTE_FOREIGN_TEAM`; invalid principal →
  `TEAM_REMOTE_PRINCIPAL_INVALID`.

## 4. Generation / reconnect (BS-02 permissive form — R80)

The backend obligation is the **invalidation signal + pull** pair, not a full
push payload:
- generation stamp on the durable row (G8-S1 supplement) is the invalidation
  signal;
- `team.getProjection` is the resync pull; a stale frame is rejected
  (`pull.ts:90`); frame verdicts via `decideFrameVerdict`;
- a live push *transport* is **not a P8-S backend requirement** — it is a P9
  client-transport decision (carry-over ⑧). P9 must not assume pushed full
  payloads; sequence/generation invalidation + pull is the contract.

## 5. Ledger pagination (P8-T4, `push/ledger-page.ts`)

Cursor contract on `team.getLedgerPage`:
- page = entries with `sequence > afterSequence`, sliced to `limit`;
- `nextAfterSequence` = last included sequence **IFF** more entries exist;
- invariants (enforced): every entry strictly after the anchor; page never
  exceeds `limit`; a cursor-bearing page is a FULL page and the cursor equals
  the last included sequence; an empty page has no cursor;
- only the tracker's CURRENT anchor may advance the cursor — a stale anchor
  that violates the invariants yields `TEAM_REMOTE_LEDGER_PAGE_REJECTED`.

## 6. Native DSH surfaces assumed by P9 (NATIVE_PROVEN, 14 rows)

P9 may rely on the native DSH surfaces (no Team backend surface needed):
- ND-01 workspace picker / source-session workspace metadata (UI-B04, UI-P03);
- ND-04 native Chat — root first-person (UI-O01), member child (UI-O02),
  legacy session (UI-R03), frozen-surfaces remain usable (UI-S02);
- ND-05 native Trajectory (UI-O03, UI-O04, UI-R04); actual relay received by
  an Agent appears natively with attribution (UI-L03, proven p6t3);
- ND-07 native fork — root (UI-Q01) and member child (UI-Q05);
- ND-08 root ordinary model control (UI-H11).
Plus the **public `remote.agentPresets` seam** (R1, ND-02): package public
export + client mount + `ui-agent-preset` public inject — P9 consumes presets
through this public seam; no private import, no Team-owned adapter (R1
verdict: no adapter was needed).

## 7. Client-local-only state (CLIENT_LOCAL, 5 rows)

UI-only state with NO backend surface (P9 owns it entirely):
- UI-B01 — New Team creation flow state (CL-05);
- UI-M17 — filter by category (client filter over loaded pages — documented;
  no server-side filter, plan par:350-354);
- UI-M18 — filter instance/template (same documented client-filter form);
- UI-N09 — zoom/pan/hover (CL-03);
- UI-Q08 — fork notice dismissal (CL-07).

## 8. Matrix closure state (S7 end)

216 fixed rows (plan §26): **148 COVERED / 49 PARTIAL→repaired or
documented / 0 MISSING / 14 NATIVE_PROVEN / 5 CLIENT_LOCAL / 0
NOT_APPLICABLE_WITH_REASON** (see `ui-backend-coverage-matrix.md` addendum,
R83). Repairs delivered in S7: R1 (B05/B07/ND-02), R2 (29 rows: BQ-08/10/11
views, durable PolicyState, F11/F12, D14), R4 (13 rows: handoff production
wiring, BQ-16/17/18 reads, BC-22/23/24 verification). Closure arithmetic
(verified against the matrix on disk, R83): the 49 MAP-time PARTIAL rows =
R80 reclassifications 4 (A07/S06/S07→COVERED, I08→NAWR) + R1 3 + R2 29 +
R4 13; every PARTIAL row is now resolved. Residuals are
documented design boundaries or P10 hardening candidates (R2 residual (g):
W2 `lifecycle !== 'CREATED'` over-approximation — MINOR, P10 tightening
candidate; (f): glue-marker in-chain untestable — known test-infra limit).

## 9. Known carry-overs into P9/P10 (NOT contract gaps)

- live push transport absent (BS-02 permissive form suffices; P9
  client-transport decision) — carry-over ⑧;
- R2 residual (g)/(f) above; `capabilityValuesOf` drops unspecified-scope
  allow decisions (observable only via the R2-2 view); R2-3 parse-order
  nuance unpinned (multi-field-malformed only);
- rpcId number-vs-string seam/wire gap (`packages/remote/src/push/types.ts:46,56`)
  — relevant when the production client transport binds the host seam;
- `packages/legacy/tsconfig.build.json` tracked build config under frozen
  legacy (build plumbing only, F1 accepted);
- p6t1-parallel flake (~1-in-3, known baseline, frozen code).
