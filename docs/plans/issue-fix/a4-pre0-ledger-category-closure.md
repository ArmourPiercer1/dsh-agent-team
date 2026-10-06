# Defect fix — an abandoned inline control request breaks the whole ledger read plane

**Found:** 2026-10-07, during the A4-PR0 code-surface survey (Alpha.4 governance round).
**Status:** Open — scheduled as `A4-PR0a`, a prerequisite of `A4-PR0`.
**Severity:** HIGH (hard failure of a read plane, reachable by a supported product action), scope of fix: small.
**Introduced by:** Alpha.3 inline-control abandonment (PR #57–#61 series, already on `master`). Not an Alpha.4 regression.

## 1. The defect

Abandoning an inline control request appends a real durable fact:

- `packages/runtime/control/service.ts:257` — `const FACT_ABANDONMENT = 'control-request-abandoned'`
- `packages/runtime/control/service.ts:1818-1826` — `putEntry({ …, factType: FACT_ABANDONMENT, … })` after `allocateSequence()`, i.e. a normal generation-bearing ledger entry on the TeamSession root.

The ledger projection fold classifies **every** entry of the root and fails closed when a fact type is unregistered:

- `packages/runtime/src/plugin/projection-source.ts:223-250` — `FACT_TYPE_CATEGORY` maps `control-request-recorded`, `control-decision-recorded`, `control-allow-consumed` and `artifact-read-granted` to `control`; **`control-request-abandoned` is absent** (verified: zero matches inside the map).
- `packages/runtime/src/plugin/projection-source.ts:762-768` — `for (const entry of rootEntries) { const category = FACT_TYPE_CATEGORY.get(entry.factType); if (category === undefined) throw … LEDGER_CATEGORY_UNKNOWN … "refusing to misclassify" }`, and `:403` runs this on **every** projection read.

**Consequence:** one abandoned inline request makes `team.getProjection` (and everything fed by that read port, `src/plugin/root.ts:2969`, per-member pass `:905-915`) throw for that Team — permanently, because the fact is append-only and the fold re-reads it on every call. This is the same shape as the recorded historical **H3 incident** (`packages/runtime/test/p8s6-remote-commands.test.ts:563-595`), which exists precisely because an unregistered-but-legal fact type once did this.

Client side is inconsistent in the same way: `packages/client/src/model/ledger-adapter.ts:748` has a `case 'control-request-abandoned':` renderer, while its category map (`:89-127`) does not carry the fact type — so the client renders the row but cannot categorise it.

## 2. Why it survived Alpha.3

- The three abandonment tests (`packages/runtime/test/control-inline-abandon.test.ts`, `control-abandon-without-resolve-envelope.test.ts`, `control-abandon-storage-fault.test.ts`) contain **zero** references to a projection read (verified per file), so the combination is simply untested.
- The lanes that would hit it end-to-end are the live-host / kit lanes, which this environment cannot run (no browser sandbox, no built host runtime — Alpha.4 plan A1.5 records the constraint).
- `git log -S "FACT_ABANDONMENT" -- packages/runtime/src/plugin/projection-source.ts` is empty: the category table was never touched when the fact was introduced.

**Disclosure of method:** this is a static read of the two code paths, confirmed by the absence of any test combining them. It has **not** been executed as a RED test yet — producing that RED test is the first step of the fix below, and until it exists this section is a strong static inference, not a reproduction.

## 3. Fix (test-first, in this order)

1. **RED** `packages/runtime/test/a4pre0-abandon-projection-closure.test.ts`: append an abandonment fact to a durable world, then read the projection through the production read port. Today this must fail with `TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN` naming the fact type; after the fix it must return a summary in which `sum(byCategory) === factCount` (assertion pattern: `packages/runtime/test/p8s7r2-disposed-history.test.ts:560-565`) and `pendingControlCount` unchanged.
2. **GREEN, minimal**: register `[FACT_ABANDONMENT, 'control']` in `FACT_TYPE_CATEGORY`. The category is `control`, not a new one — the eight frozen categories (`packages/contracts/src/projection/states.ts:224-243`) do not grow.
3. **Client symmetry**: add the fact type to the client category map (`packages/client/src/model/ledger-adapter.ts:89-127`) so the renderer at `:748` and the categoriser agree; add the leg to the client test that pins category behaviour.
4. **Kill the whole class, not just this instance**: add a closed-set guard test that derives the set of fact types **written in production** (the `factType:` literals passed to `putEntry`/ledger appends across `packages/runtime/**` production sources) and asserts every one of them is present in the host category map and, where the client categorises ledger rows, in the client map. A new fact type must then fail this test the moment it is introduced, instead of failing a customer's projection read. Precedent for a source-walking inventory test: `packages/runtime/test/permission-overlay-port-surface.test.ts:158-182`, `packages/testkit/test/rc2-kit-pin-hygiene.test.ts` — with the latter's lesson applied: **scope the walk to tracked sources** and skip `node_modules|dist|.tmp-fault`, so it cannot pick up retained DSH_HOME worlds (Alpha.4 plan A1.2.6).
5. Co-commit any `packages/runtime/dist/**` change (`pnpm build` + `build:composition` + `check:artifacts`), recompute the `p4t6` pin if `packages/**` file counts change (this PR adds test files, so it does), and record RED/GREEN receipts in `dev/agent-workflow/evidence/a4-pr0a/`.

## 4. Why it precedes A4-PR0

`A4-PR0` introduces the first new Alpha.4 fact type (`governance-proposal-recorded`) and the plan registers it in the same commit for exactly this reason (ADR A3-7). Landing the guard test first means PR0 is enforced by the invariant rather than by the implementer remembering it — and it turns "did you remember the category map?" from a review question into a failing test.

## 5. Not in scope

Root-causing why the projection fold throws instead of surfacing an unclassified row (the "refusing to misclassify" design is deliberate and fail-closed; it stays). Retro-scrubbing existing worlds. Any UI change beyond client category symmetry.

## Round-3 corrections to this document (ADR A5-16…A5-22)

Both round-3 lanes re-verified the defect independently — every citation in §2 lands exactly — and returned three corrections that are adopted here rather than left in a review file.

1. **The guard's derivation must resolve identifiers (ADR A5-16).** The first draft specified the closed set as "the `factType:` literals passed to appends". Production does not work that way: only six sites write inline literals, while `control/service.ts:257,1244,1515,2331`, `durable-mutation-store.ts:297`, `src/plugin/host.ts:2575`, `messaging/coordinator.ts:565`, `readiness/telemetry.ts:195` write through constants, `activity/facts.ts:187` writes through the `OP_TO_FACT_TYPE` table, and `requirements/facts.ts:333` takes the type as a typed parameter. A literal scan therefore passes on the very commit that contains this bug, and would have missed Alpha.4's two new fact types too. The guard now (i) resolves same-file and imported constant definitions plus table values, (ii) asserts **positively** that its derived set contains `control-request-abandoned`, `governance-proposal-recorded` and `control-escalation-recorded`, and (iii) is proven non-vacuous by mutation: delete the host registration for one step and watch the guard go red.
2. **A verified positive replaces inference.** An independent sweep of every production `factType` write in `packages/runtime/**` against the resolved `FACT_TYPE_CATEGORY` key set found `control-request-abandoned` to be the **only** unregistered production-written fact type (the other 19 all map). So the fix's green scope is one host entry plus the client entry, and this document's earlier framing — "static inference, RED test not yet produced" — is now supported by two independent reads of the same evidence. The RED test is still step 1: it converts this into an executed fact.
3. **`p4t6` authority belongs here (ADR A5-17).** This PR adds two test files under `packages/runtime/test/`, which moves the scannable-file inventory pinned at `packages/testkit/test/p4t6-session-event-scan.test.ts:1735-1736`. The plan previously granted that authority "starting with PR0", which would have made this PR unrunnable green; the grant now starts at A4-PR0a.
4. **Who owns the client map (ADR A5-22).** A PR that writes a fact type registers it in **both** category maps — the host map and the one-line client entry in `packages/client/src/model/ledger-adapter.ts:89-129` — because the guard asserts both and a writer that cannot touch the client map would be blocked by an invariant it did not create. PR6 keeps what is genuinely its own: the rendering/Events-visibility layer (`INTERNAL_FACT_TYPES`, `TeamLedger.tsx`) — and it is PR6 that owns the audit-gap disclosure of A5-20, not a one-line table entry.

Branch: `fix/a4-pr0a-ledger-category-closure` · Task body: `docs/plans/active/alpha4-permission-governance/alpha4-implementation-plan.md`, "Task 0a / A4-PR0a".

