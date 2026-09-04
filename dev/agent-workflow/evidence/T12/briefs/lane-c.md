# T12 Lane C brief — Remote / Principal / wire boundary (template, SP3/SP4 slots filled at dispatch)

Status: PENDING-PROBES (SP3 remote mount, SP4 caller identity)
Worktree: D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\T12-C (branch task/T12-lane-c-remote-security, base 7d07330)
Deps: installed.

## Defects (plan refs)
1. T12-H4 (plan §8-C1) — unknown Error fail closed, BOTH error-mapping sites
   - files: packages/remote/src/handlers/dispatch.ts (createRemoteDispatcher, isRemoteContractError path L100-119) AND packages/runtime/src/plugin/s6-remote.ts.
   - rule: ONLY RemoteContractError or strictly allowlisted domain/backing errors may carry typed wire code/detail. Any plain Error (even with error.code='ENOENT', message containing /secret/path) -> `internal-error`; wire carries NO raw filesystem path / raw host error message / stack / arbitrary details. Server-side logging may keep details.
   - regression test: code=ENOENT + message containing /secret/path -> client response contains neither 'ENOENT' nor '/secret/path'.
2. T12-B4 (plan §8-C2) — trusted PrincipalContext
   - current: s6-principal.ts deriveAdmissionCaller/deriveMutationActor see only method + payload; caller/actor are payload CLAIMS (already validated against team state: bound rootSessionId, durable instance rows), but the AUTHORITY of the remote CALLER (host operator vs external browser) is not transport-derived.
   - new boundary: authority comes from transport/authenticated connection -> server PrincipalContext -> Remote handler. payload actor/caller = claimed identity for consistency check ONLY, never grants authority.
   - fail-closed: no authenticated principal -> external remote caller -> least privilege; NEVER default host operator.
   - plan note: B4 = MUST FIX OR Remote stays non-externally-exposed (then vertical slice cannot be full PASS).
   [SP4 SLOTS: what identity the transport provides to plugin handlers; honest design given that]
3. T12-M4 (plan §8-C3) — production Remote mount
   - current: root has remoteHandlerRegistration; host has NOT proven wiring a real connection/public transport into it.
   - target: shipped plugin host: public DSH remote/connection seam -> root.remoteHandlerRegistration -> installed Team remote methods.
   - gate: if no public mount seam exists -> CORE_SEAM_BLOCKER (do not patch DSH core, no private import, no fake ConnectionLike as production mount).
   [SP3 SLOTS: EXISTS(exact seam) / MISSING / AMBIGUOUS + registration shape]

## Owned files
- packages/runtime/src/plugin/s6-principal.ts
- packages/runtime/src/plugin/s6-remote.ts
- packages/runtime/src/plugin/host.ts
- packages/remote/src/handlers/dispatch.ts
- packages/runtime/test/* + packages/remote/test/* (new/updated targeted tests)
- packages/runtime/src/plugin/types.ts (ADDITIVE ONLY)
- packages/testkit/test/p4t6-session-event-scan.test.ts (pin update only: 543 + added files)
NOT: agent-bindings.mjs (Lane A), root.ts/handoff (Lane B), domain/storage/contracts, remote contracts catalog (packages/remote/src/contracts/*) — remote contract v1 is CLOSED/frozen: no new method, no new error code without a version-bump ruling (escalate to main agent instead).

## Constraints
- The 11 typed remote error codes + 23-method catalog are frozen (backend-contract-freeze.md). H4/B4 changes must be compatible: typed codes pass through; unknown -> internal-error. If a fix seems to require a new wire code or method: STOP, report BLOCKER, do not implement.
- s6-principal A32 semantics (server-side derivation, claims never trusted, human=bound rootSessionId, leader/member=durable instance row + root/leader match, ack requires acknowledgedBy=rootSid) must be PRESERVED and built upon.

## Chain / rules
- node scripts/run-tests.mjs runtime remote (both packages); tsc -p packages/runtime/tsconfig.json AND tsc -p packages/remote/tsconfig.json (separate args).
- No pnpm run/exec, no vitest CLI. NodeNext/.js ext, erasable TS, no node: imports in .ts.
- Stop rule 45min/defect -> BLOCKER, next defect.
- One commit per defect (T12-H4:, T12-B4:, T12-M4:).
- Evidence: t12c-final-chain.log, t12c-tsc.log (UTF-8) in dev/agent-workflow/evidence/T12/.

## Report format
"LANE C RESULT:" per defect FIXED(commit, tests, assertions)/BLOCKED(file, tried, why, seam verdict); CORE_SEAM_BLOCKER declarations if any; types.ts additive list; git diff --name-only; chain+tsc counts; concerns.
