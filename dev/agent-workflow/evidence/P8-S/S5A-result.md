# P8-S5A TaskResult — production composition (S5, attempt 2/3)

## Verdict
**PASS** — the shipped production entry truly assembles the backend (A01–A29
wired and reachable through one root); the S6 seams (A30–A34) are explicit,
named, typed, fail-closed install-once slots; the harness is a pure consumer
mounting the production plugin over public seams; the entry is host-loadable
by plain Node with zero TS tooling. No R1–R6 fencing was in scope.

## Evidence (all in this worktree; final commit on `task/P8-S5-production-composition`)
- Base: `24c4f182b4a82bec8b2f07ff90885b5607501970` (chain 1903/1903, tsc 8/8 at base) → final `the branch tip at task completion (SHA in the task summary; a commit cannot contain its own SHA, per the P6-T4 precedent)`
- **T1** `packages/runtime/test/p8s5a-production-assembly.test.ts` — 7 scenarios PASS:
  production root assembles A01–A29 (fresh create, fresh member, root resume,
  resume no-reseed, cold rehydration, loud failure contract, stop semantics);
  A30–A34 fail closed pre-install, install idempotent-once, activate on install.
- **T2** `packages/runtime/test/p8s5a-host-loadability.test.ts` — 3 tests PASS
  (plain-Node import of the built entry; name/apply/validate shape) +
  `tsc -p packages/runtime/tsconfig.build.json` dist build + `node --check`
  on `dist/packages/runtime/src/plugin/host.js` + plain-Node import smoke
  printing `{name, apply, validate, inject}`.
- **T3** live regression — 17/17 scenarios (E1–E7, W1/W2/W3/W5/W7, M1–M5)
  through the harness MOUNTING the production plugin (no hand-built graph);
  fresh home `references/.dsh-test-p8s5a`; reports + per-boot logs in
  `dev/agent-workflow/evidence/P8-S/S5A-live/` (live attempt history:
   attempt 1 all-404s to (u); attempt 3 W1 leader-seed gap to (v); attempt 4
   W3/E1 fresh-create glue gap to (w), E5a harness fatal to 44-site detail null-safety,
   E1 concurrent-create rejection to (x); full-run W2 av pin to (y); final run 17/17 — attempt-1 failure
   artifacts preserved as `attempt1-*`, the W1 diagnosis as `W1-attempt3-debug.json`).
- **T4** full chain — `1913/1913` PASS (1903 baseline + 10 new S5A tests; final run log preserved in this evidence dir as `tc-s5a-final-chain.log`); tsc typecheck 8/8 exit 0.
- **T5** frozen regions — `git diff BASE..HEAD -- packages/contracts
  packages/remote` EMPTY; test-use byte-clean @ `cd5ef814` (preflight +
  postflight, asserted by the harness itself); p4t6 pins unchanged in
  content (515 files scanned, 21 legacy, 15 event strings) — this task added
  no scanned files, only content edits; core patch budget 0.

## Wiring decisions (a)–(t) as recorded in-session
(a) A28 handoff assembled with 3 fail-closed ports (frozen scenarios never
hand off); (b) A22 MutationService with an ephemeral Map store + StepClock
fixed 0; (c) persona promptSurface = recording Map; (d) capability facet
seams all `available:false`; (e) `domain.consumption` attached via a spread
facade over the closure-based TeamDomain; (f) presetSeam reports
`{presetId:'dsh-agent-team', personaKind:'standard'}`; (g) policyReader:
allow→`{kind:'allow',items:[]}`, deny→`{kind:'deny'}`, non-CapabilityName
keys skipped, `readTemplatePolicy→{}`; (h) LEGACY: separate noCheck pre-build
into the runtime dist mirror + local frozen type snapshot + injected
`legacyInspect` + dynamic import by computed URL (legacy stays zero-import
from src); (i) upstream-resolver hook for bare `@deepseek-ai/*` specifiers
(unresolvable from worktree files; links only exist under
`apps/cli/node_modules`); (j) `node-min.d.ts` local ambient declarations
instead of @types/node (not installed; `packages/runtime/tsconfig.json` not
owned); (k) row config carries `glueUrl`/`seamUrl` (row config = the entry's
only input channel); (l) superseded by (u); (m) `packages/node_modules`
junction build step for the dist mirror's one bare third-party import
(`yaml` — pnpm per-package placement unreachable from the dist geometry; the
junction is pnpm's own Windows mechanism); (n) TS 6.0.3 never-call narrowing
quirk — function declarations only, documented in-code; (o) baseline
`runtime.test.ts` skeleton contract replaced (owned-path evolution, not
frozen-test weakening) — extended again by (u); (p) validate-before-register
apply order (a broken row must not arm the upstream resolver hook) —
preserved under (u): validation is the first statement of `bootstrap()`;
(q) test-suite TLA restructure forced by the frozen plain-node shim (p8s3
precedent); (r) cross-module-instance `instanceof` trap → duck-typed
`TeamPluginError` checks (`name` + `code`); (s) resume boot is LIVE-ONLY in
both phases (exact parity with the previous harness — the frozen seed defines
member rows WITHOUT child `team-member` bindings); cold nodes A06/A09 stay
assembled and are T1-proven by direct invocation against consistent worlds;
(t) T1.4 cold-member evidence uses the fresh member; the root cold path is
proven against the seeded world (the `team-root` binding IS seeded).

## (u) Failure-channel redesign (attempt-1 incident)
Attempt 1 booted all four instances to raw 404s: the observability row had
lost its `inject` declaration, applied before the host `webServer` existed,
threw synchronously, and **Cordis `_reload` absorbed the rejection into its
own logger** (invisible to the harness — the only diagnostic was the row's
own `setup-failure.json`). Fix, now T1-proven:
- production row declares `inject = ['agents','storageDomain','sessionPersistence']`
  and **never rejects apply**: it provides the `teamRoot` facade
  synchronously (before the first await) and EVERY setup failure (config
  validation, missing services, glue/seam/legacy import, domain open, boot)
  rejects the facade's `ready` — the single observable failure channel;
- `sessionPersistence` is injected (its stock provider row is independent ⇒
  waiting can only delay, never deadlock) AND passed to the glue as a lazy
  per-call accessor → stable `TEAM_PLUGIN_SERVICE_MISSING` instead of a
  TypeError if a call ever races the provider;
- observability row declares `inject = ['webServer','teamRoot']`, parks
  until the facade exists, maps the `ready` rejection to
  `setup-failure.json` + the failure health route, and its row-stop backstop
  tolerates a stop before settlement;
- new stable code `TEAM_PLUGIN_NOT_READY` guards facade getters read before
  `ready` settles.

## (v) Leader seed row restored (attempt-3 W1 diagnosis)
Attempt 3's W1 recorded exactly TWO seeded member rows (worker/scout): the
S5A move of the seed INTO the production root had dropped the previous
harness's third put (the leader row — `inst-leader`,
`childSessionId=rootSessionId`), and the delegate rejected on the
`team-work-admitted` fact commit
(`TEAM_RUNTIME_DURABLE_WRITE_FAILED` / `RECORD_INVALID`, sequence 1 — the
work-fact commit validates the caller instance `inst-leader` against the
domain, whose row was absent). Fix: `seedBootWorld()` now seeds the FULL
frozen seed structurally — the leader row from the frozen constant
(`LEADER_INSTANCE_ID`), the worker/scout pairs from the row config — with
exact BASE_SHA shape (RUNNING av1, epoch-0 `createdAt`) and idempotent
skip. The contracts union factory routes that shape to the v1 member path
exactly as in the P6-T6 era (a v2 LeaderInstance record would reject
`childSessionId`/`lifecycle` fail-closed). T1.1/T1.5 seeded-world member
counts updated 2→3; fresh-world counts untouched. Companion driver
robustness: the W1 detail expressions are now null-safe
(`JSON.stringify(x ?? null)`) so future check failures are RECORDED as
per-scenario JSON instead of crashing the harness (attempt-3 fatal) —
check semantics untouched.

## Seed design rationale
The frozen scenario contract encodes P6-T6-era seed state (worker/scout
RUNNING av1; leader as a v1 MemberInstance with `childSessionId=rootSessionId`).
Production fresh paths write CREATED av1 and a v2 leader record — every
durable transition bumps `activityVersion` — so no legitimate fresh-path
sequence can reproduce RUNNING av1. The boot seed is therefore performed by
the production root via the SAME repository puts the previous harness used,
moved INTO the production plugin so the harness stays a pure consumer —
INCLUDING the leader row, which the S5A move had dropped and (v) restored
as a structural put from the frozen constant, so the production root owns
the complete three-row frozen seed.
A05/A06/A08/A09 remain fully assembled and are T1-proven by direct invocation
against the test domain (dormant in the boot flow).

## (w) Fresh-child instanceIdHint glue fix (attempt-4 W3/E1 diagnosis)
The frozen activation flow creates the child session (provider step 13)
BEFORE the MemberInstance commit (step 15 — the documented crash-window
ordering: the child artifact is durable before the member row is written,
activation/adapter.ts). The glue's eager consumption resolution
(`agentSetup` → `resolveConsumptionViews` → `instanceIdForSession` domain
row scan) therefore threw `p6t6 consumption: no team instance for session`
for every FRESH create (W3 delegates, E1/E2/E6 creates all cascaded from
it). The old BASE_SHA glue is byte-identical in this region — the path
evidently never ran live in the previous harness lineage (P8-S4B live
criteria were M1–M5 only). Fix (glue-only, `live/agent-bindings.mjs`):
`childFactory.createChildSession(request)` threads the allocated
`instanceId` as a hint through `agentSetup(sessionId, instanceIdHint)` into
`resolveConsumptionViews(sessionId, instanceIdHint)` — the hint is used
ONLY when no consumption state exists yet and carries exactly the value
step 15 commits moments later; the domain lookup stays authoritative for
boot, request-boundary, and projection callers. Verified live: W3 fully
PASS (two distinct fresh scouts SETTLED av3, five members), E1 2/3 creates
execute (the residual rejection → (x)).

## (x) Compatibility state race — boot-time initial probe (attempt-4 E1
residual)
E1's three concurrent creates raced on the frozen compatibility chain: the
new-work gate (admission/gate.ts L94) and activation step 6
(activation/provider.ts L629) each create their OWN authority per
consultation; each authority owns its prober; each prober owns its
promise-chain lock (compatibility/probe.ts L209 — "one durable writer per
prober") and replaces state with a NON-ATOMIC delete + put +
advanceGeneration (L247-250). Three concurrent first-work consultations
therefore run three concurrent inline re-probes (trigger 5, DevPlan §20.1)
whose replacements interleave, and a post-probe re-read can land in another
probe's delete → put gap and observe no state → `no-state-after-reprobe` →
invariant-50 fail-closed (one create rejected
TEAM_RUNTIME_COMPATIBILITY_BLOCKED while the other two executed). The
hazard is internal to the frozen runtime (no shared-authority port exists
to inject) and is only reachable in the S5A world because the production
assembly uses the real storage seam (file I/O widens the replacement
window) under the frozen E1 concurrency contract. S5A-owned resolution (no
frozen code touched, no test weakened): the production root's boot phase
establishes the initial compatibility state BEFORE any work can arrive —
idempotent (`repos.compatibility.get(rootSid) === undefined` guard), using
the assembled A14/A15 prober with the frozen trigger whose contract
covers the first-ever evaluation (`PROBE_TRIGGERS.
STALE_GENERATION_BEFORE_NEW_WORK`, compatibility/types.ts). The
first-work consultations then find a fresh durable state (the SAME
`environmentFacts` thunk feeds the root's prober and the runtime facade ⇒
identical fingerprint) and skip the inline re-probe entirely, so concurrent
probes never coexist in the frozen scenarios. Cost: the probe's frozen
`replaceState` advances the teamSessions generation, so the seeded root
row is generation 2 after a create boot (T1.1/T1.5 expectations updated
1→2; resume boots see the existing row, skip the probe, and keep 2).
Verified live: E1 14/14 (all three concurrent creates admitted), then the
full 17/17 run.

## (y) W2 activityVersion arithmetic fix (full-run W2 diagnosis)
W2's final check pinned P8-S3-era arithmetic ("row SETTLED at
activityVersion 8 ... admit av6->av7, settle av7->av8"), but under the
combined P8-S3+P8-S4B scenario contract the boot-1 worker chain includes
the P8-S4B M1/M2 real worker follow-ups: seed av1 -> W1 settle av2 -> W5
admit+settle av4 -> W7 admit+settle av6 -> M1 follow-up av8 -> M2
follow-up av10 (M4 is mutation+ping only, no work round). W2's own
follow-up therefore settles at av12, not av8 — verified against the
durable ledger (W1.json av2, W5.json av4, W7.json av6, W2 pre-state
av10, W2 final av12; every value is accounted for by a recorded
work-admitted effect). The av pin is derived bookkeeping, not a frozen
semantic: W2's criteria (persistent follow-up on the SAME child session
across the restart, no new session, durable-CAS re-admission, SETTLED)
are all preserved — only the arithmetic was corrected (av8 -> av12,
"admit av10->av11, settle av11->av12"). The W scenarios were never
live-run in the P8-S4B era (M1-M5 only), so the stale pin had never been
exposed to the combined contract before.

## Pre-existing baseline flake observed: p6t1-parallel (NOT introduced by S5A)
The first T4 full-chain run failed on the frozen baseline test
`packages/runtime/test/p6t1-parallel.test.ts`: P3 saw
`ACTIVATION_COMPATIBILITY_BLOCKED_FATAL (reprobe-failed)` where a QUOTA
rejection was expected; a gauge run (runtime suite x3: PASS, PASS, FAIL)
reproduced a P2 variant of the same race (~1 in 3 on the runtime subset; the
official T4 run recorded above passed 1913/1913). Mechanism, all in frozen
code S5A never touched: the P6-T1 world seeds NO compatibility state, so N
parallel activations each create their own step-6 authority + prober (gate.ts
L94, provider.ts L629); per-prober locks (probe.ts L209) do not serialize
across probers; `replaceState` (probe.ts L247) is a non-atomic delete+put;
wall-clock `computedAt` makes concurrent first-work probe records differ in
bytes, and `CompatibilityRepository.put` raises RECORD_DUPLICATE when one put
lands in another probe's delete->put gap, so the probe rejects and the
activation fails closed (invariant 50, reprobe-failed). S5A's production
world is immune via the boot-time initial probe (decision (x)); the P6-T1
test world constructs the provider directly (no production root/boot), so
(x) cannot reach it. Fixing the race requires frozen compatibility/storage
changes, i.e. an architecture decision outside S5A scope: flagged for
architect awareness, not patched here, and not an S5A blocker.

## Blockers
None (the p6t1-parallel baseline flake above is pre-existing, documented, and out of S5A scope). No CORE_SEAM_BLOCKER / CONTRACT_CHANGE_REQUEST / ARCHITECTURE_DECISION_REQUIRED.
