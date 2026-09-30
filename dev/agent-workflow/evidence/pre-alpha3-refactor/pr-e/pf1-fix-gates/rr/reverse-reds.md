# Reverse-verification reds — D-1 + D-3 (2026-09-30, pass 3b)

Method: for each fix, a surgical scratch-revert disabled ONLY that fix
(inline `false /* RR-* */` guards / bypass), the new suite
`packages/runtime/test/requirement-d1-d3-decision-scoping.test.ts` (37
tests) was run, the RED tests + lines captured, and the fix restored
byte-exact. `md5sum -c` against `orig.md5` confirms all four product files
byte-identical after every cycle; a final green run (37/37) closes the
record. All line numbers refer to the test file at the time of capture
(the test file was not edited during the cycles).

Test file: `packages/runtime/test/requirement-d1-d3-decision-scoping.test.ts`

## 1. D-1 revert — per-blueprint feed seam disabled (activation/provider.ts)
The step-6 feed selection was forced to the legacy boot-scoped
`environmentFacts` thunk (the D-3 full-resolution read ports were left
active — isolation).
- RED: **D1b** — L1181 `expect(D.d1b.thrown).toBe(false)` — the provider
  fell back to the boot-scoped (B0, zero-requirement) feed → the healthy
  target world FATALs step 6 (the PF-1 signature at the provider).
- Stays green (as expected): D1a (the pre-fix wiring witness is the
  fallback itself), D1c (the per-root PROBER uses its own facts port —
  a different seam), D3a–d (their read ports take precedence over the
  feed seam).

## 2. D-3 gate rule revert — PENDING throw disabled (admission/requirement-gate.ts L621)
- RED: **C1** — L1097 `expect(D.c1.thrown).toBe(true)` — the gate allowed
  the seeded live-unknown (the false OPEN returns).
- RED: **C3** — L1115 `expect(D.c3a.thrown).toBe(true)` — the recheck's
  first half (PENDING before the observation completes) never blocks.
- RED: **C4** — L1127 (via `expectPendingDetails`, L949) — the no-seed
  unknown is not reclassified: the legacy `BLOCKED_FATAL`/
  `requiredScopeDown` category stands instead of `BLOCKED_PENDING`.
- RED: **C7** — L1153 `expect(D.c7.thrown).toBe(true)` — the resuming
  worker (slot pending) is not PENDING-blocked (the kit B5 first half,
  unit level).
- Stays green: C2 (legacy witness), C5 (down precedence), C6 (cold
  exemption), C8 (failed-slot down FATAL).

## 3. D-3 provider PENDING revert — the three `throwPending` sites disabled (activation/provider.ts)
- RED: **D3a** — L1206 `expect(D.d3a.thrown).toBe(true)` — the seeded
  live-unknown admission is no longer blocked (false OPEN at the provider).
- RED: **D3b** — L1219 (via `expectPendingDetails`, L949) — the no-seed
  unknown keeps the FATAL category instead of the typed PENDING
  reclassification.
- RED: **D3c** — L1223 `expect(D.d3c.thrown).toBe(true)` — the v2
  resuming worker's trailing PENDING (the engine PASS voided) never
  throws.
- Stays green: D3d (the COLD worker exemption is the classifier's
  materialization axis, independent of the throw sites).

## 4. D-3 preflight overlay revert — `applyPendingOverlay` bypassed (requirements/creation-preflight.ts L317)
- RED: **E1** — L1239 `expect(D.e1.outcome).toBe(PREFLIGHT_OUTCOMES.pending)`
  — got `proceed` (the seeded false OPEN at creation returns).
- RED: **E2** — L1247 — got `fatal` (the no-seed reclassification is gone).
- RED: **E4** — L1258 — got `consentRequired` (the pending >
  consentRequired precedence is gone).
- RED: **E6** — L1268 — got `fixOrDisable` (the v2 template reclassification
  is gone).
- Stays green: E3 (down precedence keeps the actionable FATAL), E5 (the
  disabled template is resolved → proceed either way).

## 5. D-3 probe drop-filter revert — `dropSeedFilledPendingFacts` bypassed (src/plugin/s6-remote.ts)
- RED: **F1** — L1277 `expect(D.f1.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)`
  — got `OPEN` (the seed-filled false OPEN at the probe returns).
- RED: **F4** — L1313 `expect(repoFixed.outcome).toBe('FATAL')` — got
  `PASS` (the required live-unknown mcp fact is no longer dropped).
- Stays green: F2 (the healthy world is OPEN either way), F3 (the legacy
  wiring witness is OPEN either way).

## Restoration
`md5sum -c rr/orig.md5` → all four files OK:
- packages/runtime/activation/provider.ts
- packages/runtime/admission/requirement-gate.ts
- packages/runtime/requirements/creation-preflight.ts
- packages/runtime/src/plugin/s6-remote.ts

Final green run: 37/37 (Test Files 1 passed).

---

# Reverse-verification reds — RE-RUN after the D-3 probeable narrowing (2026-09-30, pass 3b option 1)

Context: the parent adjudicated OPTION 1 (narrow D-3 PENDING to
probeable required types — the host's probe-port registry as the single
source of truth; absent = probeable default). The changed path is the
classifier + drop-filter (`requirement-facts/pending.ts`); the four D-3
decision sites (gate / provider / preflight / probe) consume it. Per the
adjudication, the D-3 gate/provider/preflight/probe revert cycles were
re-run on the NARROWED tree (the D-1 cycle is untouched — its seam does
not pass through the classifier). Same method: surgical inline `false
/* RR-* */` guard, run the 37-test suite, capture REDs, restore
byte-exact (`md5sum -c` against `orig-after-narrowing.md5`).

The test file gained a doc-comment block in its header (the probeable
scoping note — doc comments only, ZERO assertion changes), so the
red-assertion lines shifted +18 vs the original capture.

## R1. D-3 gate rule revert (admission/requirement-gate.ts L621 → `false /* RR-D3GATE */ && ...`)
- RED: **C1** — L1115 `expect(D.c1.thrown).toBe(true)` (seeded live-unknown mcp → gate PENDING).
- RED: **C3** — L1133 `expect(D.c3a.thrown).toBe(true)` (recheck first half).
- RED: **C4** — via `expectPendingDetails` (L966) inside the C4 `it` (L1141): the no-seed unknown kept the legacy FATAL instead of the typed PENDING reclassification.
- RED: **C7** — L1171 `expect(D.c7.thrown).toBe(true)` (resuming worker, slot pending — the kit B5 first half).
- Stays green: C2 (healthy PASS), C5 (cold not-applicable — the classifier exemption), C6 (down precedence), C8 (failed slot → typed down-category FATAL).
- Identical red set to the original cycle #2 (C1/C3/C4/C7).

## R2. D-3 provider revert (activation/provider.ts 3 sites → `false /* RR-D3PROV */ && ...`)
- RED: **D3a** — L1224 `expect(D.d3a.thrown).toBe(true)` (seeded live-unknown → false OPEN at the provider).
- RED: **D3b** — L1235 `expect(D.d3b.thrown).toBe(true)` (no-seed FATAL category kept instead of PENDING).
- RED: **D3c** — L1241 `expect(D.d3c.thrown).toBe(true)` (v2 resuming worker — engine PASS not voided).
- Stays green: D3d (the cold-member not-applicable exemption is classifier-side — untouched).
- Identical red set to the original cycle #3 (D3a/D3b/D3c).

## R3. D-3 preflight revert (requirements/creation-preflight.ts L317 → `if (true /* RR-D3PF */) return base`)
- RED: **E1** — L1257 `expect(D.e1.outcome).toBe(PREFLIGHT_OUTCOMES.pending)` — got `proceed` (the seeded false OPEN at creation).
- RED: **E2** — L1265 `expect(D.e2.outcome).toBe(PREFLIGHT_OUTCOMES.pending)` — got `fatal`.
- RED: **E4** — L1276 `expect(D.e4.outcome).toBe(PREFLIGHT_OUTCOMES.pending)` — got `consentRequired`.
- RED: **E6** — L1286 `expect(D.e6.outcome).toBe(PREFLIGHT_OUTCOMES.pending)` — got `fixOrDisable`.
- Stays green: E3 (down precedence), E5 (disabled-template exclusion).
- Identical red set to the original cycle #4 (E1/E2/E4/E6).

## R4. D-3 probe drop-filter revert (src/plugin/s6-remote.ts L2023 → `hostFacts = resolution.environmentFacts /* RR-D3PROBE */`)
- RED: **F1** — L1295 `expect(D.f1.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)` — got `OPEN` (the seed-filled false OPEN at the probe).
- RED: **F4** — L1331 `expect(repoFixed.outcome).toBe('FATAL')` — got `PASS` (the required live-unknown mcp fact no longer dropped).
- Stays green: F2 (healthy OPEN), F3 (legacy-wiring witness OPEN).
- Identical red set to the original cycle #5 (F1/F4).

## Restoration (post-narrowing re-run)
`md5sum -c rr/orig-after-narrowing.md5` → all four files OK:
- packages/runtime/admission/requirement-gate.ts
- packages/runtime/activation/provider.ts
- packages/runtime/requirements/creation-preflight.ts
- packages/runtime/src/plugin/s6-remote.ts

Final green run: 37/37 (Test Files 1 passed); runtime `tsc --noEmit` = 0.
The narrowing changes NO red set: every D-3 decision site still turns
exactly its tests red when disabled — and the mcpServer subjects of this
suite stay probeable (the readiness doubles predate the `hasProbe` query
→ the documented conservative default), so the suite is green UNCHANGED
as the adjudication required.

## R5. PF-2 tri-state revert (requirement-facts/pending.ts `isPendingWindow` → `return isProbeable(observation)` — the ONE-predicate exemption removed; 2026-09-30)
The (A) adjudication routes every decision path through the single
classifier predicate `isPendingWindow = isProbeable && observationState
!== 'never-observed'`. Reverting that ONE line removes the first-create
bootstrap exemption from the gate, the activation step, the creation
preflight AND the probe drop-filter simultaneously (the shared-source
design the adjudication required).
- RED: **X1** — `expect(D.x1.outcome).toBe(PREFLIGHT_OUTCOMES.proceed)` — got `pending` (THE PF-2 deadlock: a fresh-host first create PENDING-blocked).
- RED: **X2** — `expect(D.x2.status).toBe(COMPATIBILITY_STATUS.OPEN)` — got `BLOCKED_FATAL` (the probe/gate divergence — INV-9.4 violation: the probe drops the seed-filled fact while the exempted gate world would proceed).
- RED: **X3** — `expect(D.x3aPreflight.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)` — got `pending` (the seed's truth — available:false — overwritten by PENDING).
- Stays green: **X4** (IN-FLIGHT explicit state → PENDING at preflight + gate — B5 preserved), **X5** (settled pins).
- Stays green: ALL 37 pre-existing tests (A1–A5, B1–B4, C1–C8, D1a–D1c, D3a–D3d, E1–E6, F1–F4 + D guards) — the readiness doubles carry NO observationState (absent = the in-flight conservative default), so the full pre-(A) D-3 semantics stand byte-identically. Confirms the "zero world-construction changes" prediction of the (A) design.
- Red run: `rr/x-reverse-reds-run.log` (3 failed | 39 passed, EXIT=1).
- Restoration: predicate restored byte-exact (md5
  `d0723e5b3845daf24783ee31014c2a90 packages/runtime/requirement-facts/pending.ts`);
  runtime `tsc --noEmit` = 0; final green run `rr/x-reverse-restored-run.log`
  (42/42, Test Files 1 passed).
