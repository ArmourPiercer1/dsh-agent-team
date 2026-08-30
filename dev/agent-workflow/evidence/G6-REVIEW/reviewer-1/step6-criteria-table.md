G6-R1 step 6 — seven-criterion evidence table (reviewer 1)
All evidence self-verified in worktree D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G6-R1 on branch g6-review-r1.
Suite-level evidence from my reruns: full `node scripts/run-tests.mjs` = 1214 passed / 0 failed / 1214 total (exit 0);
targeted `node scripts/run-tests.mjs runtime tools testkit` = 560/560 (exit 0). E2E evidence: my harness rerun,
harness-output/summary.json (pass=true, failures=[], 7/7 scenarios, 60 live assertions, step4-e2e-postchecks.txt).

C1 — the same template can be instantiated N times simultaneously: PASS
  Live E2E: E1 (boot1, 14/14) — three concurrent `team_create_member` on the worker template, three distinct
  request tokens → all executed; "three distinct new instance ids" (inst-0j3weh1176s5 / inst-0i9xle4180qy /
  inst-0ijx73317qrd); every activation carries a distinct child session; "state after E1: six members total" /
  "four worker-template members (1 seed + 3 new)".
  Suites (my rerun, passing): packages/runtime/test/p6t1-parallel.test.ts — "two activated results with distinct
  instance ids and child Sessions", "five activated results, five COMMITTED operations, five members, five child
  Sessions", "the five P2 instance/operation/child-session ids are pairwise distinct".
  Structural: identity=(rootSessionId, instanceId) (inv 18); instanceId allocated under the team lock with
  collision check (provider.ts:656-664); per-template quota governs N (checks.ts:498-531).

C2 — every runtime action is instance-addressed: PASS
  Live E2E: E2 (boot1, 3/3) — label and template targets on follow-up/send-message → rejected status; "every
  rejection carries TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED"; "no side effect: member count unchanged (6)".
  Source: admission/resolve.ts:165-202 `resolveInstanceToken` — the only target-resolution path of the facade
  (router.ts step 2) rejects template-id / member-label / non-instance tokens with details.kind; never silently
  resolved (inv 19). tools/src/tools.ts:240-281 `executeGuarded` routes non-instance tokens straight to the facade
  where they live-reject — such a target "can never execute".
  Suites: packages/runtime/test/p6t2-addressing.test.ts (passing) — "5. label AND template addressing: facade
  ACTION_ADDRESSING_REJECTED (invariant 19), zero writes".

C3 — a persistent follow-up keeps the same Session: PASS
  Live E2E: E3 (boot1, 6/6) — two `team_follow_up` on the same persistent worker → "second follow-up executed on
  the SAME instance"; "the bound child session id is UNCHANGED across follow-ups"; "the admission sequences
  advance by one (monotonic per admission)"; "no new instance was created (six members)".
  Source: provider.ts:405-439 `continuedResult` (kind 'continued', read-only — no lock, no writes, no projection;
  the result carries the EXISTING member.childSessionId); delegation 'continue' short-circuit provider.ts:606-616.
  Suites: packages/runtime/test/p6t1-delegate.test.ts, p6t2-actions.test.ts (passing).
  Domain (pre-delta, unchanged): inv 24 pinned by t3-member-context-policy (persistent ⇒ continue).

C4 — fresh_per_delegation creates a new instance: PASS
  Live E2E: E4 (boot1, 5/5) — two `team_delegate` on the scout template (fresh_per_delegation) → "both delegates
  returned member-activated effects"; "two distinct NEW instance ids (not the seed, not each other)"; "each
  activation carries a distinct new child session"; "state after E4: three scout-template members (1 seed + 2 new)".
  Source: provider.ts:617-619 ('create' falls through to the full provisioning order — provider.ts:629-709, the
  same admit-once/quota/journal order as C1); effects.ts delegate effect → provider.
  Suites: packages/runtime/test/p6t1-delegate.test.ts (passing); domain t3-member-context-policy
  "fresh_per_delegation is instance CREATION, never a context reset" (pre-delta pin, unchanged).

C5 — messages / control requests / progress rows survive restart: PASS
  Live E2E: E5a (boot1, 11/11) + E5b (boot2, 13/13) — before restart: member→leader message delivered to the root
  bound session with durable fact+delivered sequences; progress rows seq 1,2; control request durably pending with
  the E5 correlation token. After restart (fresh boot2, same DSH_HOME): "nine members total" with "member id set
  UNCHANGED from boot 1"; "the boot-1 control request SURVIVED the restart as pending"; "the boot-1 progress rows
  (sequences 1 and 2) SURVIVED the restart"; "no pending delivery was skipped at recovery"; leader allow resolves;
  the guarded follow-up EXECUTES consuming the persisted allow; retry BLOCKED (allow-consumed); post-restart
  message + progress seq 3 continue the durable sequences.
  Suites (my rerun, passing): p6t1-recovery.test.ts (admit-once convergence; FAILED row fails loudly),
  p6t3-restart.test.ts (messaging restart recovery R3), p6t4-restart.test.ts (control durable decisions),
  p6t5-restart.test.ts — "keeps a pre-restart OPEN interval open until explicitly closed after the restart",
  "continues the durable TeamLedger global sequence (the counter survived)".
  Structural: inv 41 (TeamDomain = durable authority) — all three families are TeamLedger facts re-read fresh
  after restart (no in-process authority, inv 45).

C6 — a quota race does not over-create: PASS
  Live E2E: E6 (boot1, 6/6) — scout limit 4 with 3 members; three concurrent creates at ==limit → "exactly ONE of
  the three concurrent creates admitted"; "both over-limit creates rejected with
  TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES"; "state after E6: four scout members (== limit; never
  over-created)"; team limit 12 untouched (nine members total).
  Source: the quota check runs INSIDE the per-team lock on a fresh durable view (provider.ts:631-638) and the view
  counts in-flight PREPARED reservations (checks.ts:416-469, doc: counting only committed records "would let
  parallel activations over-create (the G6 quota-race gate)"); the reservation is the durable journal prepare
  (provider.ts:666-676) committed before the external child-session effect — a retry re-enters the admit-once
  convergence (no double admission), so the reservation cannot be double-counted as a second instance.
  Suites: p6t1-parallel.test.ts — "exactly two activations succeed", "exactly three fail QUOTA_MEMBER_MAX_INSTANCES
  (the binding fixture quota)", "the final durable state holds EXACTLY two members and two COMMITTED operations";
  p6t2-quota.test.ts — all four quota bounds at current+1>max (passing in my rerun).

C7 — the tool layer cannot bypass ActivationProvider/TeamRuntime: PASS
  Live E2E: E7 (static, 2/2) — "scan covers exactly the five committed tool-layer source files" (guard.ts,
  index.ts, tokens.ts, tools.ts, types.ts); "zero bypass violations (no direct durable-domain writes, no agent
  creation, no legacy vocabulary)".
  Source: tools/src/index.ts:1-19 package boundary; tools.ts imports only public package roots (no
  storage/repositories); every tool body routes through `ctx.options.teamRuntime.performAction` or the sanctioned
  satellites (tools.ts:390-583); member creation exists ONLY as the facade's create/delegate effects which call
  `activationProvider.activate` (effects.ts:403-445, invariant 26); guarded ops consult the control service's
  guard immediately before execution (tools.ts:251-281) with fail-closed semantics (guard.ts).
  Suites: test/p6t6-bypass-scan.test.ts (dynamic import + AST scan), test/p6t6-guard.test.ts (consultGuard
  semantics incl. the no-request deviation pin), test/p6t6-actions.test.ts (all actions execute through the
  facade, addressing rejections live) — all passing in my rerun.

SEVEN CRITERIA: 7/7 PASS. No HIGH or MED finding (two LOW informational notes, see findings.md).
