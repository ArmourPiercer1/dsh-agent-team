# G5 Gate Review Report — Reviewer 1 (Round 2)

**Gate:** G5 (Phase 5 — Agent Binding / Member Lifecycle Substrate), round 2
**Target:** `int/P5` @ `9f5bd12647e4ba8da35f19c31782e5e21384848c`, base `602590db1bb79ca45f505af636b13e331a209be4` (master after G4)
**Reviewer:** blind gate reviewer 1 of 3 (independent leaf session; phases 1–3 of my own review)
**Worktree:** `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G5-R1` (detached @ 9f5bd12)
**Method:** phase 1 = code/diff analysis; phase 2 = fresh execution (leg2 + tsc + real-instance harness); phase 3 (this report) = disk-truth cross-check and re-verification of load-bearing evidence before ruling.

## VERDICT: 投机通过 (speculative pass)

All 8 G5 criteria (DevPlan §18.6, verified verbatim at DevPlan line 2408–2419) PASS on my own evidence, and my chain is green (leg2 929/929 re-run by me in phase 3; direct tsc 4/4 exit 0 re-run by me in phase 3; real-instance harness pass=true from my phase-2 run, disk-verified in phase 3). Zero-core, private-import, and owned-boundary checks are clean, and the P5 invariants compose. The verdict is 投机通过 rather than 通过 because of two concrete, non-structural LOW findings (below) and one managed residual risk: I1A is inherently timing-dependent (kill inside the durable-write window); my run observed the window (420 ms) and the convergent replay passed, and the deterministic barrier ordering is pinned by unit tests S12/S13, but cross-machine timing variance cannot be fully excluded. Per ROUTER_RULES §3.2, the results support that this residual risk is controllable; per §3.3 the gate passes if all 3 reviewers end in {通过, 投机通过}.

## 1. Frozen-doc integrity (phase 3, my own)

Direct SHA-256 of the 4 frozen docs in the main worktree (bytes as-is, CRLF) — all 4 **MATCH** the expected values, and the `frozen_docs` section of `dev/agent-workflow/evidence/provenance/file-manifest.json` (lines 44–47, the one sanctioned exception to blindness) carries the identical 4 hashes:

| doc | sha256 | result |
| --- | --- | --- |
| Architecture_20260829 | 030dfb8e…870c53 | MATCH |
| UI_Design_20260829 | 3ef3ab69…c4981e | MATCH |
| Development_Plan_20260829 | a05d237f…881d0f | MATCH |
| Task_Decomposition_and_Review_Method_20260829 | 2b457cc0…7e888a3 | MATCH |

**frozenDocCheck = ok (match).**

## 2. Chain status (my own evidence)

| leg | result | source |
| --- | --- | --- |
| leg2 (`node scripts/run-tests.mjs`, all 9 packages) | **929 passed / 0 failed / 929 total** (1371 ms, RESULT PASS) | phase-3 re-run by me; matches phase-2 run (1338 ms) and on-disk capture `g5-r1-leg2-output.txt` |
| tsc (direct `node node_modules/typescript/bin/tsc -p <pkg>/tsconfig.json`, noEmit) | **contracts 0, domain 0, storage 0, runtime 0** — zero diagnostics | phase-3 re-run by me; matches phase-2 empty captures `g5-r1-tsc-*.txt` |
| real-instance harness (`node packages/runtime/member-residency/harness/run.mjs --report-dir g5-review-harness-output`) | **process exit 0, summary `pass: true`, `failures: []`**, 6 boots + 1 by-design expected-fail boot, wall ≈17 s, `build.required=false` | phase-2 run by me (single serial run); disk-verified in phase 3. Not re-run in phase 3 by design: the harness is serial-only and wipes/recreates the shared `references/.dsh-test-p5t6` DSH_HOME per run; the on-disk artifacts are my phase-2 execution record |

**Disk-truth cross-check:** the embedded phase-2 JSON and the on-disk `g5-review-harness-output/summary.json` agree exactly on every field I compared (pass, failures, rowMounted 6/6, ports + releases, stable3080 before/after, pristine before/after, all 9 scenario blocks, i1.a/b/c, members). **No discrepancy.**

## 3. Criteria → evidence → PASS/FAIL (all re-verified against the cited file:line in phase 3)

| # | criterion (DevPlan §18.6) | evidence (my own verification) | verdict |
| --- | --- | --- | --- |
| C1 | Root fresh bind | `root-binding/fresh-root.ts`: crash-safe ORDERING — TeamSession record put **before** the team-root binding put (a crash between writes leaves a binding-less record that a re-run completes); generation-1 + blueprintId/revision/contentHash identity validation; every step fail-closed and the binder is never run unless durable state is consistent. `test/p5t5-fresh-root.test.ts:102-120` (S1: writeCalls = [putTeamSession, putSessionBinding], all three slots installed, admitted, durable truth on the real P4 repositories), `:331-338` (invalid generation → zero writes, zero surface calls). Real instance: boot 1 on :3180, **S1 pass, 15/15 assertions, http 200** (summary.json) | **PASS** |
| C2 | Root cold bind | `root-binding/cold-root.ts`: restore-only path — NO slot `apply`, NO `installOverlay` (wholesale `restoreScope`), admission re-decided, zero durable writes, defensive fail-closed post-check (`cold-root.ts:91-96`). `test/p5t5-cold-root.test.ts:112-130` (S2: restoreCount=1, installCount=0, per-slot applied [0,0,0], `wrote:false`, admitted, durable state re-read not rewritten), `:335-339` (restoreScope fault → BINDER_OVERLAY_FAILED, no scope-restored event). Real instance: boot 2 on :3181 = process restart on the SAME DSH_HOME, **S2 pass, 11/11, http 200** | **PASS** |
| C3 | Member fresh create setup | `member-residency/fresh-member.ts:177-186`: child-Session durability barrier (`ensureDurable`) awaited **unconditionally, before the first durable write, on every path** (fresh write, convergent replay, idempotent re-run) — the I1A fix; rejection propagates with zero durable writes. Identity is the derived `(instanceId, childSessionId)` and the only identity used (invariants 18/19/23/24); record put then binding put; spec-identity mismatch "can never be re-pointed". `test/p5t6-fresh-member.test.ts:749-772` (S1 derived identity + record before binding), `:1032-1047` (S12: order = barrier→putMemberInstance→putSessionBinding; barrier unconditional on re-run and replay), `:1051-1057` (S13: barrier rejection → zero writes, binder never runs). `identity.ts` deterministic FNV-1a/base36 mirror, byte-identical to storage `deterministicToken` over the corpus (`test/p5t6-cold-member.test.ts:631-636`, 0 mismatches). Real instance: boot 3 **M1 pass 11/11** + I1a crash: real OS process killed inside the window (`windowObserved=true`, `windowWaitMs=420`, `stateAtKill={recordWritten:true, bindingWritten:false}`) | **PASS** |
| C4 | Member cold resume setup | `member-residency/cold-member.ts`: ZERO durable writes by construction (write port never consulted); absent record → `noopReason:'absent'` zero-effect; child binding verified; binder cold path = one `restoreScope(member scope)` + admission re-decided; NO slot apply/installOverlay. `test/p5t6-cold-member.test.ts:489-513` (C1 canonical: restoreScope once with full member scope, `wrote:false`, admitted), C2–C7 (zero fresh-time side effects; absent no-op; orphan record → RECORD_CONFLICT; DISPOSED → BINDER_MEMBER_DISPOSED; mismatched binding conflict; rejecting cold guard writes nothing). Real instance: boot 4 **M2 pass 9/9** + **I1A pass 5/5** (convergent replay of the crashed member B: binding-only write, no duplicate row) | **PASS** |
| C5 | ordinary Agent unaffected | `agent-setup/binder/binder.ts:247-257`: step 1 read-only session-kind resolution — unbound or `ordinary` → successful no-effect no-op (`noopReason:'ordinary'`); a kind mismatch fails closed with BINDER_TARGET_KIND_MISMATCH (`:270`, `:288`). `test/p5t1-ordinary-noop.test.ts` green; `test/p5t5-cold-root.test.ts` S4 (ordinary + unbound: no binding row, no surface call, no record, no event); idempotent rebind = no-op (`binder.ts:338`). Real instance: boot 3 **M5 pass 6/6** (ordinary invariance + negative follow-up UNAUTHORIZED probe); unit E6: zero subagent channels on any injected handle (`test/p5t6-evict-readmit.test.ts:444-449`) | **PASS** |
| C6 | persona semantics correct | `agent-setup/persona/adapter.ts:165-167`: `resolveSubstrate` ALWAYS queries the preset seam with `rootSessionId` — a member inherits the ROOT substrate (no per-member selector); `:184-206` scoped identity (leader → getLeaderPersona, member → getMemberPersona(root, templateId), deep-frozen, `personaOrigin:'blueprint'`). complete:true preset → structural FATAL: TeamPersonaOverlayError thrown from slot apply **before** admission/other slots, reusing the frozen contracts-v1 code verbatim — `test/p5t2-persona-complete-fatal.test.ts:74-154` (outer BINDER_OVERLAY_FAILED with details.origin='persona'; inner cause code === `TeamContractErrorCode.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT`; zero work effects: model/capability not applied, no admission; retry identical; fresh member fails identically — member inherits the root conflict). absent persona → admitted, no scoped identity, no-op rebind (p5t2-persona-no-persona green); cold-restored identity equals fresh, once (p5t2-persona-cold-bind green) | **PASS** |
| C7 | model future-boundary mutation correct | `agent-setup/model/overlay.ts:152-156`: `beginRequest` resolves `source.current()` and captures an **immutable copy at request time** (in-flight keeps the capture; the next request resolves afresh; `undefined` carried losslessly, never defaulted); `:125-129` install ratchet: residency drop clears dead captures, the installed marker persists (drop = restart boundary). `test/p5t3-future-boundary.test.ts:75` — DevPlan §18.4 frozen sequence verbatim: request N = A; concurrent override → B; N remains A; N+1 uses B; `:92-93` install performs NO resolution (nothing pre-resolved can go stale); slot fault → BINDER_OVERLAY_FAILED, no admission. `test/p5t3-restart.test.ts:54-77` (same-process drop: first request after uses CURRENT source B, no stale A; dead handle keeps its own capture) and `:141+` (full restart: fresh runtime, zero in-flight state, first request uses durable CURRENT source B) | **PASS** |
| C8 | runtime residency can be dropped without deleting Member | `member-residency/evict.ts:30-45`: SETTLED lifecycle gate (else LIFECYCLE_CONFLICT with the actual lifecycle) + child-binding consistency check; `:131-135`: `dropResidency` is the **ONLY effect** — the handle may be absent, reported `residencyDropped:false`, NOT an error (DevPlan §18.5). No record deletion/transition, no binding deletion, no slot apply/installOverlay/events, ZERO durable writes (write port not even consulted). `test/p5t6-evict-readmit.test.ts:353-371` (E1: dropped, every durable record intact, zero writes, no surface event), `:374-381` (E2: handle absent succeeds), E3 non-SETTLED fail-closed, E4 MEMBER_NOT_FOUND zero effects, E5 re-admit after evict = cold path, twice, zero writes, no row duplication. Real instance: boot 4 **M3 pass 8/8** + **M4 pass 6/6** | **PASS** |

## 4. Findings (severity)

1. **LOW (cosmetic):** `packages/runtime/member-residency/README.md:5` mislabels "P5-T3 root binding" — root binding is **P5-T5** (P5-T3 is the model task). Task-number typo in prose of a module README; no behavioral impact; fixable in a later doc pass.
2. **LOW (operational):** the T6 harness mini-MCP band 3491–3495 reuses the P2-T4 band (the T5 harness deliberately uses 3481–3485 to avoid overlap). Serial execution, the port pre-check, and the post-run release assertions (`harness/run.mjs:796-798`) make a live conflict unlikely; the band was verified free before and after my phase-2 run and no contention was observed. Noted for future concurrent harness use.
3. **INFO (managed residual risk):** I1A is the only timing-dependent harness scenario (kill inside the durable-write window; up to 90 s observation). My run observed the window (`windowObserved=true`, 420 ms) and the convergent replay passed (I1A 5/5); the deterministic barrier ordering is additionally pinned by units S12/S13. Cross-machine/load timing variance cannot be fully excluded — this is the principal reason the verdict is 投机通过 rather than 通过. The risk is controllable: the code path is unconditionally ordered and fail-closed, and both deterministic units and the observed real-instance window agree.

No HIGH/CRITICAL findings. No invariant violations. No core-seam breach.

## 5. Harness rerun summary (my phase-2 run; disk-verified in phase 3)

Single serial run, `references/.dsh-test-p5t6` DSH_HOME wiped+recreated, fixed ports 3180/3181/3491–3495, process exit 0, final line "P5-T6 harness PASS". All boots mounted their row via the public patch seam (rowMounted 6/6); every boot's stop settled with `killed=true, portFree=true`.

| scenario | boot | port | result | assertions | http |
| --- | --- | --- | --- | --- | --- |
| S1 root fresh bind | 1 | 3180 | pass | 15 | 200 |
| S2 root cold bind (restart, same DSH_HOME) | 2 | 3181 | pass | 11 | 200 |
| M1 member fresh create (A) | 3 | 3180 | pass | 11 | 200 |
| M5 ordinary invariance + negative probe | 3 | 3180 | pass | 6 | 200 |
| M2 member cold resume (A) | 4 | 3181 | pass | 9 | 200 |
| I1A convergent replay of crashed member B (kill in window) | 4 | 3181 | pass | 5 | 200 |
| M3 evict SETTLED residency | 4 | 3181 | pass | 8 | 200 |
| M4 re-admit (cold) after evict | 4 | 3181 | pass | 6 | 200 |
| I1C record-loss replay (member A record deleted pre-boot) | 5 | 3180 | pass | 6 | 200 |
| I1B version-stamp corrupted (by-design expected-fail boot 6) | 6 | 3181 | correctly counted: `setupFailureCode=SCHEMA_VERSION_MISMATCH` == expectedCode, `fileUnchangedAfterFailedBoot=true` (no silent migration) | — | — |

77 scenario assertions, all green; `failures: []`; `i1.a.windowObserved=true`; ports released odd/even/mcp all true.

## 6. Boundary, zero-core, and invariant re-verification (phase 3, my own)

- **Worktree state:** HEAD = 9f5bd12647e4ba8da35f19c31782e5e21384848c; **no tracked file modified**. `git status` shows 7 untracked entries, all my own phase-2 review artifacts (6 tee'd capture `g5-r1-*.txt` files + `g5-review-harness-output/`), exactly as the phase-2 brief sanctioned. The delivered tree is pristine at 9f5bd12.
- **Upstream test-use tree:** git-clean @ cd5ef8148158c3a752a658978873241fdf8e2bbc in my own check and per the harness pristine before/after (status+diff empty). No patch/postinstall/corepack machinery; no `references/` files in the delta.
- **Delta scope (base 602590d → head 9f5bd12):** 349 files total; 277 under `dev/agent-workflow/` (process documentation — out of review subject per ROUTER_RULES §3.1.3); **zero** files outside `packages/` + `dev/`; 72 under `packages/`. Runtime delta is entirely inside the six owned surfaces (`agent-setup/{binder,persona,preset,model,capability}`, `root-binding`, `member-residency` incl. their `harness/` dirs) + their `test/p5t*` unit files + `tsconfig.json`. **Exactly 2 cross-task touches, both recognized patterns and verified by full diff:** (a) `packages/runtime/tsconfig.json` `rootDir "." → "../.."` noEmit typecheck glue, zero production code; (b) `packages/testkit/test/p4t6-session-event-scan.test.ts` — the only testkit delta file — coverage-count pin 190→258 with per-task breakdown comments only (scanner logic untouched; the pinned suite passes in my re-run).
- **Zero-core:** clean (upstream pristine, all capability via public seams; the harness resolves upstream packages from the test-use tree for its boots).
- **Private imports:** zero `@deepseek-ai/*` imports in the product `.ts` files (all seams injected). Harness `.mjs` files use exactly 6 distinct upstream packages, all bare root specifiers, each export verified in the upstream package's main entry (public root export): `installModelSelection` (dsh-agent lib/index.js:272, exported :795), `SessionId` (dsh-session), `scopeOf` (dsh-scope lib/index.js:312, exported :357), `PERSONA_SECTION` (dsh-system-prompt :56), `defineDomain`/`domainTable` (dsh-storage-domain, exported :435), `@deepseek-ai/dsh-mcp-client` (root namespace). No subpath/private imports; no `@deepseek-ai/cordis`.
- **Tooling compliance (my own greps over `packages/**/*.ts`):** zero `from 'node:'` imports (TS2591 rule holds); zero disallowed unit matchers — the surface is limited to toBe/toEqual/toBeGreaterThan/toThrow (+.not).
- **Invariants (all hold in code + tests):** #8/#9 (one Root / one TeamSession; TeamSessionId=RootSessionId), #10 (immutable blueprint snapshot — mismatched blueprintId/revision/contentHash fail closed), #18/#19 (composite (rootSessionId, instanceId) identity; never a label/legacy memberId), #21 (Member is not a continuable subagent — no subagent channel, negative probe green), #23/#24 (one durable child Session per MemberInstance, never re-pointed), #30/#31 (model mutates at the request boundary; in-flight invariant; tools/skills/MCP future-only via the G2 fail-closed gate `capability/resolve.ts:103-113` — seam not G2 → `effective:[]`, `failClosed:'seam-not-g2'`, intersection not even consulted), #41 (TeamDomain sole durable control-plane authority; binder holds a read-only handle; fresh writes only via write ports; cold/evict carry zero write-port calls), #42 (no new Team SessionEvent vocabulary — only `agent-setup/*` names; p4t6 denylist scanner clean across the delta with coverage pin 258), #45 (in-process registry is not the durable authority — evict drops only the live handle), #46 (crash-window idempotent retry — record-before-binding + unconditional barrier + convergent replay), #48 (complete:true preset structural FATAL before any work, frozen code reused verbatim).

## 7. Self-checks (phase 3, all by me)

| check | result |
| --- | --- |
| frozen docs SHA-256 (direct) + file-manifest cross-check | 4/4 MATCH / identical |
| worktree HEAD / tracked-clean | 9f5bd126 / clean (7 untracked = my own phase-2 artifacts) |
| upstream test-use pristine @ cd5ef81 | clean (my git check + harness before/after) |
| ports 3180/3181/3491–3495 free (before phase-2 run; re-verified in phase 3) | ALL FREE |
| stable instance :3080 (never started/stopped/written; read-only GET probe) | HTTP 200 before and after |
| leg2 re-run (phase 3) | 929/929 PASS |
| tsc re-run ×4 (phase 3) | all exit 0, zero diagnostics |
| disk summary.json vs embedded phase-2 JSON | exact agreement, **no discrepancy** |
| delta boundaries / cross-task touches / tsconfig + p4t6 diffs | as verified in §6 |
| upstream public-export spot check (6 packages) | all verified in main entries |
| `node:` imports / matcher surface greps | zero / compliant |

## 8. Blindness-compliance statement

Across all three phases I did NOT read `dev/agent-workflow/SESSION_ROUTER_LOG.md`, `dev/agent-workflow/graph.yaml`, or any file under `dev/agent-workflow/evidence/**` — **except** `dev/agent-workflow/evidence/provenance/file-manifest.json`, the one explicitly sanctioned exception, which I consulted only to cross-check the frozen-doc hashes (lines 44–47). My judgment rests solely on: the four frozen docs (hash-verified), `docs/ROUTER_RULES.md` and `docs/TEST_METHODS.md` in my worktree, the delivered code and git history (base 602590d → head 9f5bd12), and my own fresh test runs (leg2 re-run, tsc re-run, phase-2 real-instance harness with its on-disk artifacts). I did not consult, wait for, or receive input from any other reviewer or agent.

## 9. Rationale (summary)

All eight G5 criteria of DevPlan §18.6 pass on multi-layer evidence: 929/929 units (re-run by me), 4/4 clean direct tsc (re-run by me), and a real-instance harness of 6 boots / 9 scenarios / 77 assertions all green with the I1B expected-failure boot correctly accounted for and the I1A crash window actually observed (420 ms) and replayed convergently. The chain is green on my own evidence; zero-core is clean (upstream pristine before/after), private imports are clean (six upstream packages, bare root specifiers, every export verified in the upstream main entry, zero upstream imports in product code), and the owned boundaries hold with exactly two recognized cross-task touches. The P5 invariants compose and the legacy-vocabulary negative control is clean. What keeps this from a plain 通过: two concrete non-structural LOW findings (README task-number typo; MCP port-band reuse, mitigated by serial execution and release assertions) and the I1A timing-window residual whose deterministic core is pinned by S12/S13 but whose real-world observation is load-dependent — controllable, not fully excludable, hence 投机通过 per ROUTER_RULES §3.2.
