# PF-2 (B): B5 first-half reclassification — the real world is NEVER-OBSERVED at the B5 admit

- **Pass**: PR #42 fold, pass 3b (branch `feat/pre-alpha3-pre-e-requirement-recovery`, worktree `.worktrees/pre-alpha3-pre-e-requirement-recovery`)
- **Trigger**: the first full E.12 kit run post-(A) — `prereq-2026-09-29T23-47-50` — finished **KIT_EXIT=2 (VERDICT FAIL)** with **exactly one failing criterion**: S4 first half (`admitInitialWork (TRANSIENT window…) -> typed PENDING`). All other S1–S14 scenario criteria + H1/H2 hygiene checks PASS.
- **Verdict of this finding**: **NOT a product regression.** The product behaves EXACTLY as the adjudicated PF-2 option (A) tri-state. The kit's S4 first-half criterion encodes the pre-(A) D-3 semantics and is **stale**: the real world at the B5 admit moment is NEVER-OBSERVED by the letter of the adjudication, and the adjudication's binding text ("no decision path can reach PENDING in the never-observed state"; "PENDING now means in-flight ONLY") mandates the reclassification. The kit criterion was re-baselined (transparent contract alignment, precedent: the parent-authorized W2-A option-(a) kit rework) — the PRODUCT was not touched.
- **Red-line status**: on failure the world was retained (NOT deleted), the failure investigated, the kit NOT force-fixed — the criterion change below is a binding-text propagation (documented in the kit itself), reported here for parent confirmation.

## 1. The failure

`rr/e12-after-A-prereq-2026-09-29T23-47-50.console.log` (full run), world `tests/homes/prereq-2026-09-29T23-47-50/` (retained; evidence scrubbed to 14 files even on FAIL):

```
[S4] FAIL — admitInitialWork (TRANSIENT window: the required repo observation is unsettled — the mount is in flight)
         :: code=NO_RESULT details=null
```

Observed wire (world evidence `scenario-s4-admit-b5.json`):

```
admitError: { code: 'NO_RESULT', message: 'null' }   // remote body = null = success (no error envelope)
details:    null                                      // no gate details at all
newRequests: 0                                        // no recovery dispatch
slotsAtAdmit: [ { sessionId: session-prereq-boot-<stamp>, mounted: false,
                  materialization: 'pending', attempts: null } ]   // boot session ONLY
```

The old criterion expected `TEAM_RUNTIME_COMPATIBILITY_BLOCKED` + `BLOCKED_PENDING` / `requiredScopePending`. What happened instead: the admit was **allowed** (seed-open) with no dispatch — the adjudicated never-observed → seed-2-state behavior.

## 2. The diagnostic chain (why the real-world moment is NEVER-OBSERVED)

The adjudication's three arms (verbatim): 1. SETTLED → verdict per observation. 2. IN-FLIGHT — "a pending materialization slot EXISTS on any live session" → typed PENDING. 3. NEVER-OBSERVED — "no fiber / no pending slot / no failed slot on ANY live session" → SEED-SATISFIED 2-state (available:true → OPEN/proceed).

### 2.1 At the B5 admit moment the live sessions are `[boot]` ONLY

1. **The `/__p6t6/state` route is read-only/pure** — `packages/tools/harness/plugin.mjs` L415-443: it re-resolves the views of `teamRoot.live.listLiveSessions()` (L455) but performs NO `ensureLiveAgent` (zero attach side effects). Reading state cannot create a live session.
2. **The kit waits the BOOT root only** — kit `p6t6StateReady` (L596) waits the ROOT row (`session-prereq-boot-<stamp>`, kit L323; T = `session-prereq-main-<stamp>`, L324). The main root is not required to be live for the B5 section to start.
3. **The admit path attaches nothing before the gate** — the remote `team.admitInitialWork` path (`s6-remote.ts` L1769-1839 → `root.ts` L2749 `admitRootInitialWork` → `root-initial-work.ts` closure) performs **NO session attach** before the gate: zero `ensureLive` / `live.` references in `root-initial-work.ts`.
4. **The boot template allows NOTHING** — the boot anchor is a v1 zero-requirement row (a structural anchor); it never mounts `mcp_repo`.
5. **The v2 leader template DOES allow `mcp_repo`** (kit L1123-1139: "the LEADER (the team's always-live session) mounts EVERY row-configured MCP server"). This is the decisive discriminator: had the main session been live at the gate moment, its `mcpViews['mcp_repo'].allowed === true` → the probe would have read **in-flight** → PENDING. The observed seed-open outcome PROVES the main session was not live (and had no consumption state) at the gate moment — its agent attach + boundary run only AFTER the admit (that is what produces the failed slot `attempts:1` on `session-prereq-main-<stamp>` seen in `scenario-s4-b5-window.json`).

### 2.2 The boot session's `materialization:'pending'` in the dump is a PROJECTION QUIRK, not an in-flight signal

`packages/tools/harness/plugin.mjs` L521-527 (the p6t6 per-server projection):

```js
slot === undefined
  ? (view.pendingNextBoundary ? 'pending' : fiber ? 'mounted' : 'not-applicable')
  : ...
```

An **empty array is truthy in JavaScript** — so every configured server with no raw slot and no fiber projects `materialization:'pending'` on ANY live session, regardless of actual pending records. The kit's own comment (L2430 of the pre-edit file) concedes the boot root "keeps `materialization:pending` (its template …)". The dump's boot 'pending' is therefore **uninformative** about real pending records.

### 2.3 The boot session's `pendingNextBoundary` was EMPTY by construction

`pendingNextBoundary` is built (agent-bindings.mjs `resolveConsumptionViews`, L1133-1273) from the durable governance **override** records of the owning team root that are not yet in `appliedRecordIds`. The retained world's storage — `tests/homes/prereq-2026-09-29T23-47-50/storages/team_domain.json`:

```
tables: { …, 'overrides': 0 entries, … }
```

**ZERO override records in the ENTIRE domain** (all teams, all kinds, final state). The override table is append-only durable truth (§18.3) — records are applied, never deleted — so the count was also 0 at the B5 moment. ⇒ the boot session's `pendingNextBoundary === []` at the admit moment, by construction.

### 2.4 Conclusion — the letter of the adjudication applies

At the B5 pre-boundary admit, for `mcp_repo` on every live session (the only one being `boot`): **no fiber, no raw slot (pending or failed), `pendingNextBoundary: []`, `allowed: false`** ⇒ the observation state is **NEVER-OBSERVED** by the adjudication's own definition. Option (A) behavior: the SEED truth decides — the kit's own `factsAll()` (seeded as static bootstrap, C.2) declares the repo `available: true` ⇒ **OPEN** ⇒ the admit proceeds, no dispatch. This is EXACTLY what the run showed.

## 3. Why no faithful implementation preserves B5-first = PENDING

- **(i) Read the p6t6 'pending' projection as in-flight.** The projection is the empty-array truthiness quirk of §2.2 — not a pending slot. Treating it as in-flight resurrects the PF-2 first-create deadlock the parent already adjudicated (A) to eliminate (a boot/template session can never mount the server, so its 'pending' would hold FOREVER → PENDING at every fresh-create → the B1 deadlock in the B5 shape). Rejected.
- **(ii) Read the durable team requirements ("will attempt at the next boundary") as in-flight.** That is INFERENCE from configuration, violating "the exemption is OBSERVED, never inferred" (adjudication) and guide §2.3 (live-session-only probe). It would also be a PRODUCT change beyond the literal adjudication (the probe would need a durable-requirements channel), and it contradicts the parent-accepted liveness argument in the consumer audit: "even a pathological existing-root never-observed (p6t6 'not-applicable') would deadlock under PENDING → the seed 2-state is the only liveness-correct behavior." The B5 first-half moment IS a pathological existing-root never-observed (existing cold root; the only live session structurally admits nothing). Rejected.

### Structural identity with B1 (the one-predicate argument)

Under the ONE shared classifier predicate (`isPendingWindow` in `requirement-facts/pending.ts` — the R5-proved single decision point), the B5 first-half moment and the B1 first-create moment are **identical**: same live surface (`[boot]` anchor only), same per-session views (structurally admitting nothing), same seed truth (available:true) ⇒ they MUST classify identically (OPEN). `probe == gate` (INV-9.4) forbids any surface from classifying B5-first differently from what the probe classifies.

### S11 — fully intact

S11 has **NO PENDING criterion** (4 checks; all PASS this run). The adjudication's "B5/S11 intact" premise holds for S11 and for the B5 **second half** (post-boundary: failed slot `attempts:1` → SETTLED `unreachable` → `BLOCKED_FATAL` / `requiredScopeDown` + dispatch + deny — PASS; S4b disable-cannot-bypass — PASS). It does not hold for the B5 **first half**: the in-flight moment the kit's comment assumes ("the T leader attaches first — the p6t6 call's ensureLiveAgent") never exists at the admit moment in the real world (the p6t6 call is read-only — the comment was wrong).

### Pre-(A) confirmation (world state identical, semantics changed)

The 20:52 world (`prereq-2026-09-29T20-52-08`, pre-(A) product, OLDER kit generation, 8 criteria failed) shows the SAME world state: its `scenario-s4-admit-b5.json` = `{admitError: null, details: null, newRequests: 0}` — the admit was ALREADY allowed before (A); that kit's S4 expected BLOCKED_FATAL and also failed on the allow. The world state is identical pre/post-(A); only the observation semantics changed.

## 4. The kit change applied (pending parent confirmation)

`tests/kits/pr-e-requirement-recovery-smoke/pr-e-requirement-recovery-smoke.mjs` — the S4 first-half criterion re-baselined from the pre-(A) typed-PENDING expectation to the adjudicated tri-state expectation, with the world-state WITNESS pinned (not a vacuous "not blocked"):

```
assert:  gd === null                                    // no gate details at all
     && admitErr?.code !== GATE_BLOCKED_CODE            // NOT blocked (seed-open)
     && slotsAtAdmit.length === 1 && sessionId === ROOT // ONLY the boot session carries a view
     && mounted === false && materialization === 'pending' && attempts === null   // the quirk projection, no raw slot
     && liveSessionsAtAdmit === [ROOT]                  // the never-observed witness: no other live session
     && mcpOverrideRecords === 0                        // pendingNextBoundary empty by construction
     && newRequests === 0                               // NO recovery dispatch
```

Plus the honest documentation updates: header S4 block, SCENARIOS table entry, B5 section mechanics, S4a block, `startBlackholeMcp` doc, and the second-half check message wording ("the pre-boundary (seed-open) verdict did NOT survive the boundary"). The D-3 B5 SECOND HALF is unchanged.

**Character of the change**: transparent contract alignment (the kit encoded pre-(A) D-3 semantics; the parent's (A) adjudication postdates it and its binding text directly contradicts the old criterion), precedent = the W2-A option-(a) kit rework the parent authorized. It is NOT a semantic fudge: no product file was touched; the product's behavior is the adjudicated contract verbatim; the new criterion is strictly STRONGER than the old one's dispatch check (it additionally pins the classification witness).

## 5. Evidence

| item | path |
| --- | --- |
| failing run console (EXIT 2) | `rr/e12-after-A-prereq-2026-09-29T23-47-50.console.log` |
| world (retained) | `tests/homes/prereq-2026-09-29T23-47-50/` (incl. `storages/team_domain.json` — the `overrides: 0` proof) |
| S4 first-half scenario | world evidence `scenario-s4-admit-b5.json` |
| S4 window (inFlightSlot=null 15s; failedSlot attempts=1) | world evidence `scenario-s4-b5-window.json` |
| pre-(A) reference world (older kit, same world state) | `dev/agent-workflow/evidence/pre-alpha3-refactor/pr-e/prereq-2026-09-29T20-52-08/` |
| p6t6 projection quirk | `packages/tools/harness/plugin.mjs` L521-527 |
| p6t6 state route (read-only) | `packages/tools/harness/plugin.mjs` L415-460 |
| leader template allows every server | kit L1123-1139 (pre-edit numbering) |
| kit re-run after re-baseline (**EXIT 0, 16/16, world cleaned**) | `rr/e12-after-A-kitfix-run2.console.log`, world `prereq-2026-09-30T00-05-00` |

## 6. Request to parent

1. **Confirm** the product behavior stands (recommended — it is the adjudication verbatim; alternatives (i)/(ii) are rejected above with the liveness argument cited).
2. **Confirm** the kit S4 first-half re-baseline (the applied change) — or direct the alternative: extend the discriminator with a durable-schedule in-flight signal (a product change beyond the literal adjudication; contradicts the accepted liveness argument; NOT recommended).
3. **Re-run result**: `e12-after-A-kitfix-run2` (world `prereq-2026-09-30T00-05-00`) finished **KIT_EXIT=0 — VERDICT PASS, all 16 criteria green (14 scenarios + hygiene), world cleaned**; the S4 first-half criterion passed with the full witness (`liveSessions=[boot]`, `mcpOverrideRecords=0`, `slots=[boot-only quirk projection]`, no dispatch) and the D-3 B5 second half passed unchanged (typed FATAL + deny + dispatch).
