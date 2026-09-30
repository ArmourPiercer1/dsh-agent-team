# PF-2 consumer audit (C-1..C-10) — the tri-state is ONE predicate, no fourth surface

Date: 2026-09-30 (pass 3b, (A) adjudication). Method: exhaustive grep over
`packages/runtime` (product `.ts` only, excluding tests/dist) for
`classifyScopeReadiness(`, `dropSeedFilledPendingFacts`, `PENDING_BLOCK |
BLOCKED_PENDING | requiredScopePending`, `.pending` readers, and
`observationState` readers. Every PENDING decision surface in the product is
enumerated below; each either INHERITS the shared predicate or is a pure
producer/transport of the state.

## Producers (write `observationState`)

- **C-1 `src/plugin/host.ts` L1904-1913 — the host probe discriminator**
  (the shared per-blueprint feed source's probe port). Per live session:
  fiber for the subject → `reachable` (early return); raw slot failed →
  `unreachable`; raw slot non-failed → in-flight; no slot →
  `live.resolveConsumptionViews(sessionId)` (the public port p6t6 itself
  uses): `mcpViews[subject].allowed === true` OR
  `pendingNextBoundary.length > 0` → in-flight (a template-granted or
  record-pending server WILL mount at the next boundary = p6t6 `pending`
  projection); view absent / allowed false → contributes nothing
  (structurally not applicable — the B1 anchor template allows nothing →
  never-observed). View resolution FAILURE → in-flight (fail-closed: the
  exemption is never inferred from doubt). Final: `unknown` + EXPLICIT
  `in-flight` / `never-observed`.
- **C-2 `readiness/provider.ts` L155-195 — the registry probe
  normalization** (bare string verdict → no state; structured →
  `assertProbeVerdict` + the settled-with-state check throws
  `MALFORMED_DTO` INSIDE the try → fail-soft `unknown` + `PROBE_REJECTED`:
  a malformed outcome can NEVER grant the exemption).

## Transport (pass-through only)

- **C-3 `readiness/types.ts`** — the `CapabilityObservation` DTO: state is
  closed-set asserted, defined only with the `unknown` verdict
  (settled + state → `MALFORMED_DTO`).
- **C-4 `requirement-facts/provider.ts` L290 (mcp branch) / L353 (default
  branch)** — the feed provider writes `RequirementObservation.observationState`
  ONLY when it is exactly `'never-observed'`. In-flight / absent are NEVER
  written (ABSENT = the in-flight conservative default — the legacy doubles
  and every existing test keep the full D-3 semantics).

## The decider (ONE choke point)

- **C-5 `requirement-facts/pending.ts` L168-173 `isPendingWindow(obs) =
  isProbeable(obs) && obs.observationState !== 'never-observed'`** — the
  single classifier predicate. Consumed at exactly three sites in the same
  module: the fold (`classifyScopeReadiness` → `state.unknown`), the pending
  partition (`classifyScopeReadiness` → `.pending`), and
  `dropSeedFilledPendingFacts` (the probe's feed filter).

## Decision surfaces (PENDING is emitted only here — all inherit C-5)

- **C-6 `admission/requirement-gate.ts`** L510 → L515 → L647 (the typed
  PENDING block at the next boundary). EXISTING-ROOT context.
- **C-7 `activation/provider.ts`** L789/L796 → L826/L854/L939-940 → L808
  (the step-6 PENDING). EXISTING-ROOT context.
- **C-8 `requirements/creation-preflight.ts`** L356/L368 → L381/L403/
  L413-416 → L430 (the `pending` preflight outcome). PRE-CREATION surface 1.
- **C-9 `src/plugin/root.ts`** L1349-1390 (the team.create wire: maps
  `PreflightResult` → the typed PENDING details). Consumes C-8's result —
  NO independent observation read (inherits).
- **C-10 `src/plugin/s6-remote.ts`** L2036 (the probe drop-filter). PRE-CREATION
  surface 2.

## Verification results

1. **Exhaustive**: greps A–E (call sites, PENDING emitters, `.pending`
   readers, `observationState` readers) show no product file beyond C-1..C-10
   touches the state, the classifier or the pending partition. The other
   `'pending'` literals in the product are unrelated vocabularies: the
   control-request lifecycle (`control/service.ts`), `remoteMountState`
   (`host.ts` L474/1299/2219), `MATERIALIZATION_STATES.pending`
   (`readiness/status.ts`) and `PREFLIGHT_OUTCOMES.pending`
   (`requirements/types.ts` L365).
2. **No fourth surface exists** → no additional predicate application was
   needed (the adjudication's "if a fourth surface exists, apply the same
   feed-level predicate and report" branch is reported NEGATIVE).
3. **Liveness argument (why no decision path can PENDING in a
   never-observed state)**: the gate (C-6) and activation (C-7) require an
   EXISTING root session — in an existing-root context the team-scope servers
   materialize at the leader boundary of the existing team (slot
   infrastructure always exists) → the observation is in-flight (pending
   slot / unapplied record / template-granted) or settled (fiber / failed
   slot); never-observed is structurally unreachable there. Template scope
   follows the same argument per member session (no member session → the
   COLD exemption, a separate unchanged mechanism, E.11 #1). The pre-creation
   surfaces (C-8..C-10) are exactly where never-observed arises (a fresh
   host) — the exemption applies there uniformly. Even in the pathological
   existing-root never-observed case (a live member session where the server
   is structurally not granted — the p6t6 `not-applicable` projection),
   PENDING would be a deadlock (nothing can settle the observation) — the
   seed-satisfied 2-state is the only liveness-correct behavior, so the
   uniform predicate is safe there too.
4. **Choke-point proof**: the R5 reverse cycle (see `reverse-reds.md`) —
   reverting the ONE predicate line removed the exemption from C-6..C-10
   SIMULTANEOUSLY (X1/X2/X3 red across preflight + probe at once) and
   restoring it returned 42/42 green. One line, every surface — INV-9.4
   (probe == gate) holds BY CONSTRUCTION.
