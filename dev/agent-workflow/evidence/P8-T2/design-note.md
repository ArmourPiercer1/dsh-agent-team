# P8-T2 — Projection Service: design note

Task: **P8-T2 Projection Service** (dsh-agent-team vNext, TaskDoc §11.9, DevPlan §21).
Base: `48b3334fb1ed00e79929372ddd627db6e6162ccc` (int/P8-remote-projection tip).
Owned surface: `packages/runtime/projection/**` (new) + `packages/testkit/test/p4t6-session-event-scan.test.ts` (DEC-1 count update) + `dev/agent-workflow/evidence/P8-T2/`.

## 1. What the service does

`createProjectionService(domain, overlay, options)` returns a `ProjectionService` whose single method

```
project(teamSessionId): TeamProjectionDto
```

produces the **whole, frozen P8-T1 `TeamProjectionDto`** for one TeamSession from exactly two
inputs:

1. the **durable TeamDomain** — the whole-projection authority (invariant 41); and
2. an **optional live residency/activity overlay** (UI §24, DevPlan §21.2).

The DTO is produced by the frozen P8-T1 contract pipeline (`createTeamProjection` + the embedded
record parsers), consumed read-only from `../../contracts/src/index.js`. The service adds **no
second error vocabulary**: field-level and cross-field malformations surface as the P8-T1
`TeamContractError` (`MALFORMED_DTO`, field-specific codes, `LEGACY_MEMBER_ID_REJECTED`, …).

## 2. The §21.2 red line (by construction)

The service must **not** scan `Root + all child Session logs` to rebuild Team control truth.
This is enforced by construction, not by discipline:

- The durable port is `TeamDomainReadPort { readProjectionSource(teamSessionId): TeamDomainProjectionSource }`.
- `TeamDomainProjectionSource` is a **bounded view**: identity, blueprint ref, generation, root
  facts, template rows, member rows (durable), and a ledger *summary*. It carries **no session-log
  facts and exposes no log-read surface**. There is no `readChildLog` on the type, so the fold
  cannot reach a child log even in principle.
- The live port is `LiveResidencyOverlayPort { snapshot(): ReadonlyMap<InstanceId, MemberLiveActivityDto> }`.
  It is an **overlay**, keyed by instance id, and only fills the nullable `liveActivity` lane —
  it never mutates identity, generation, workspace, or the durable lanes.

Consequence: the projection's **complexity is a function of the durable team shape only**, never
of the (unbounded) child Session log volume. The P8-T2 fifty test proves this empirically: two
worlds over the same 50-member source, differing only in the backing store's `childLogVolume`
(0 vs 5,000,000), yield **byte-identical canonical JSON**, and the §21.2 trap counter stays 0.

## 3. Module layout

```
packages/runtime/projection/
  types.ts    — the two read ports + the durable projection source vocabulary
  errors.ts   — the closed service-level code: MEMBER_WORKSPACE_UNRESOLVED (+ ProjectionError, isProjectionError)
  ledger.ts   — the ledger-summary fold (entries stay durable; pagination is NOT part of the fold)
  fold.ts     — projectTeam(source, overlay, generatedAt): TeamProjectionDto   (PURE)
  service.ts  — createProjectionService(domain, overlay, options): ProjectionService
  index.ts    — barrel
```

`packages/runtime/src/index.ts` is left untouched (P7 modules are not re-exported there; the
projection is addressed by relative source path).

## 4. The pure fold

`projectTeam(source, overlay, generatedAt)` is a **pure function of three inputs** — no I/O, no
clock read, no global:

- `source` — the durable `TeamDomainProjectionSource` (carried verbatim: identity, blueprint,
  **generation**, root, templates, members, ledger summary);
- `overlay` — the **already-materialized** snapshot map (or `null` for a cold projection);
- `generatedAt` — the produced-at stamp (ISO-8601), **stamped by the service** (which injects the
  clock) so the fold stays pure and deterministic in tests.

The live lane is `overlay === null ? null : overlay.get(instanceId) ?? null` — **always the present
key**, `null` when there are no live facts. The durable lanes (including the durable `activity`
summary, when present) are **separate** from `liveActivity` and are never derived from it.

**`generation` comes only from the durable source.** The overlay never touches it, which is what
keeps downstream stale-overwrite detection (`isStaleTeamProjection`, keyed on
`teamSessionId` + `generation`) against the durable authority rather than ephemeral live state.

The leader / non-leader `childSessionId` rule is handled by the frozen contract: the row is passed
the key **only when the durable source carries it** (absent for the LeaderInstance — invariant 14;
present for every MemberInstance, **including ARCHIVED / DISPOSED** — invariants 23/24).

### The one service-level invariant: effective workspace

A projected member row **requires** a resolvable effective workspace, but a durable member row may
inherit the team default. The fold resolves

```
member.workspace ?? teamDefaultWorkspace ?? throw ProjectionError(MEMBER_WORKSPACE_UNRESOLVED, { instanceId, isLeader })
```

This is the **single** invariant the service resolves itself. It is a *service-level* error (a
closed `ProjectionErrorCode`), not a DTO field error — the DTO always sees a resolved value. Every
other field-level / cross-field invariant is delegated to the frozen P8-T1 pipeline.

## 5. Synchrony and testability

Both ports are **synchronous** (the fold is fully synchronous). This keeps the mandated test
scenarios free of `await` and matches the plain-node shim's top-level execution pattern:
scenarios run at module top level and capture into plain objects; the `it` bodies assert only over
the captured data. The overlay is materialized to a `ReadonlyMap` **by the service** (one
`snapshot()` per `project()`), and the fold consumes the map — so the fold is a pure data transform.

## 6. Test strategy (five mandated suites, mock-first per ruling R28)

The TeamDomain source port and the live overlay port are fakes (call recording + the §21.2 trap);
the service and the pure fold are real.

| Suite | Proves |
| --- | --- |
| `p8t2-cold` | **Cold projection** (durable-only): a valid frozen `TeamProjectionDto`; every `liveActivity` is `null`; identity/generation/root/templates/ledger equal the durable truth; the source is read exactly once; no log read; the overlay port is absent. |
| `p8t2-fifty` | **50 instances** (+ complexity guard): 51 rows, unique ids, non-leaders keep their childSessionId; and child-log volume (0 vs 5,000,000) yields **byte-identical** canonical projections with the §21.2 trap at 0. |
| `p8t2-overlay` | **Live overlay**: members present in the snapshot get exactly that live activity; absent members (leader + a worker) get `null`; the durable lane is untouched (durable skeleton byte-identical to the cold projection; only the live lane differs); one `snapshot()` per `project()`. |
| `p8t2-terminal` | **Terminal states**: ARCHIVED / DISPOSED rows are projected verbatim and **keep their durable childSessionId** (invariant 23); the cold service applies no live overlay; the ledger is durable and self-consistent (`totalEntries == sum of the 8 categories`). |
| `p8t2-negative` | **Never touches session logs** (trap stays 0 after a successful projection); **malformed inputs** are rejected by the frozen P8-T1 surface — unknown lifecycle, non-leader missing childSessionId, unknown admission → `isTeamContractError` + `MALFORMED_DTO`; **unresolvable workspace** → `ProjectionError(MEMBER_WORKSPACE_UNRESOLVED)`. |

Fixture ids were aligned to the frozen ID grammars (`instanceId` = `inst-<1..32 [a-z0-9]>`, so
worker ids are `inst-p8t2m<N>`); session / template / blueprint ids carry dashes, which their
grammars allow.

## 7. Acceptance

- **projection == durable truth**: every durable field (identity, blueprint ref, generation, root
  admission facts, template rows, member durable lanes, ledger summary) is carried verbatim from
  the TeamDomain; the overlay only fills the nullable `liveActivity` lane.
- **complexity independent of complete child logs**: the fold's input has no child-log field and
  no log-read surface; the fifty test's canonical-JSON equality across 0-vs-5,000,000 log volume
  (with the trap at 0) is the empirical proof.

## 8. Zero-core red lines held

No `node:` / upstream-private imports in any `.ts`; no legacy `SessionEvent` vocabulary (the p4t6
denylist scan still passes — count updated 428 → 440 for the 12 new files); no `packages/team`
copy; the projection depends on no SessionController Team mirror and no Session-log-derived Team
truth.
