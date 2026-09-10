# A5 — `tools/pre-execute` enforcement adapter — task report (alpha.2, plan §10)

Task branch: `task/alpha2-a5-pre-execute` (worktree `.worktrees/alpha2-a5`)
Base: `f8ed516` (A1+A2+A3+A4 merged; worktree clean at start, single writer)
Commit: this report ships in the single task commit on the branch —
**A5 alpha.2: the tools/pre-execute enforcement adapter (static parameter-aware permission policy, synchronous through the durable Control plane; 39-test spec; p4t6 pin 663→665; dist rebuilt)** (SHA visible via `git log` on the branch; cherry-pick to int uses `-x`).

## 1. Deliverables

| Path | Kind | Note |
| --- | --- | --- |
| `packages/runtime/operation-permission/pre-execute-adapter.ts` | NEW (source) | The adapter (659→662 lines incl. docs) |
| `packages/runtime/operation-permission/index.ts` | EDITED | Barrel: A5 export block + module-doc surface line |
| `packages/runtime/test/a5a-pre-execute.test.ts` | NEW (test) | 39 tests over the 15 mandated scenarios |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | EDITED | Pin 663→665 + DEC-1 comment entry (f) (A5); scanner `.mjs` byte-unchanged |
| `packages/runtime/dist/**` | REBUILT | Committed (artifact check passes) |
| `dev/agent-workflow/evidence/alpha2-permission/a5/*` | NEW (evidence) | This report + baseline/after logs |

## 2. Adapter — what it is

One agent-scoped `tools/pre-execute` waterfall listener, installed per agent by
`installParameterPermissionListener(agentCtx, params)` and disposing via the
`ctx.on` return (returned verbatim). The frozen pipeline (plan §10.2):

```
classifyPermissionTool(exec.name)        (A2)
  ├ unsupported → return await next()    (pass-through: zero control rows,
  │                                the resolver is never called)
  └ file / tool-level →
      canonicalizeOperation(...)         (A2 — any OperationPermissionError
  ↓                                 → deny, never next())
      resolveOperationPermission(...)    (A3 — pure static decision)
      ├ allow → return await next()
      ├ deny  → deny (provenance in the reason)
      └ ask →
          pre-aborted signal? → deny WITHOUT a request row (R3)
          requestControl(...)          (A4 — durable row; kind =
  ↓                                 isLeader ? user-approval : leader-approval)
          awaitControlDecision(signal) (A4 — synchronous wait bridge)
          ├ CONTROL_WAIT_ABORTED → deny "the approval wait was cancelled"
          ├ CONTROL_WAIT_CLOSED → deny (message)
          ├ decision deny/stale-denied → deny "the approval was denied"
          └ decision allow →
              guardOperation(exact scope + fingerprint)   (A4 — check-and-reserve)
              ├ allowed → return await next()
              └ blocked → deny (no-request = consistency anomaly, R5)
```

Properties pinned by the spec:
- **NEVER returns `ask`** (upstream routes a final 'ask' to the native approval
  service — a second approval path; the listener resolves asks internally).
- **Fail closed / zero-effect invariant** (plan §10.3): every non-allow outcome
  returns before `next()` is awaited — the tool body is never invoked.
- **Seam-injected**: no upstream imports; `AgentPreExecuteCtx` / `PreExecuteExec`
  are minimal structural mirrors of the cordis `Context` / `ToolExecution`
  surface the A6 glue passes (plain `.mjs` glue, structural satisfaction).
- **No module-level mutable state**; each install owns its rule-canonicalization
  cache in a closure (R2).

### Export surface (verbatim, `packages/runtime/operation-permission/pre-execute-adapter.ts`)

```ts
export type PreToolDecisionLike =
  | { readonly kind: 'allow' }
  | { readonly kind: 'deny'; readonly reason: string }
  | { readonly kind: 'ask'; readonly reason?: string }

export interface PreExecuteExec {
  readonly callId: string
  readonly name: string
  readonly arguments: unknown
  readonly signal: ControlWaitSignal
}

export interface AgentPreExecuteCtx {
  on(
    event: string,
    listener: (
      exec: PreExecuteExec,
      next: () => Promise<PreToolDecisionLike>,
    ) => Promise<PreToolDecisionLike>,
  ): () => void
}

export interface InstallParameterPermissionListenerParams {
  readonly policy: TemplatePermissionPolicy
  readonly resolveTarget: PathTargetResolver
  readonly controlService: ControlService
  readonly rootSessionId: string
  readonly caller: ActionCaller
  readonly targetInstanceId: string
  readonly isLeader: boolean
  readonly onObserve?: (observation: Record<string, unknown>) => void
}

export function installParameterPermissionListener(
  agentCtx: AgentPreExecuteCtx,
  params: InstallParameterPermissionListenerParams,
): () => void
```

### Barrel addition (verbatim, appended to `packages/runtime/operation-permission/index.ts`)

```ts
export {
  installParameterPermissionListener,
} from './pre-execute-adapter.js'
export type {
  AgentPreExecuteCtx,
  InstallParameterPermissionListenerParams,
  PreExecuteExec,
  PreToolDecisionLike,
} from './pre-execute-adapter.js'
```

(`tsconfig.build.json` already included the `operation-permission` directory —
no build-wiring change.)

## 3. Design rulings (documented in the adapter module doc)

- **R1 — signal threading**: the resolver type takes `(path)` only; the per-call
  `exec.signal` is NOT threaded into path resolution. The glue closure captures
  the session cwd at install; a per-call abort during a fast identity read is a
  documented residual (zero-effect invariant unaffected — the pipeline's own
  pre-dispatch cancellation checks still apply).
- **R2 — lazy rule canonicalization**: `exact` rules are canonicalized per
  decision (once per distinct rule path, install-owned `Map`, successes only —
  failures retried, rule treated non-matching for that decision). Fail-closed
  end-to-end: a rule on an unresolvable path addresses a path that is equally
  unresolvable for any operation, which fails its own canonicalization first.
  Same-tool filter; `bash` exact rules never canonicalized (inert by A3).
  Same injected resolver ⇒ same cwd basis as operations.
- **R3 — pre-aborted signal**: checked at the top of the ask branch → deny
  WITHOUT a request row (no orphan pending request for a call that will never
  execute). Static allow/deny unaffected (they never wait). Abort between
  `requestControl` and the wait (or mid-wait) → typed `CONTROL_WAIT_ABORTED` →
  deny; the durable row stays pending (cancellation never decides — alpha.2).
- **R4 — `waitPollIntervalMsHint` DROPPED**: A4 already injects the poll cadence
  at service construction (`ControlServiceOptions.waitPollIntervalMs`); the
  adapter receives the service fully constructed. Tests construct with
  `waitPollIntervalMs: 10`.
- **R5 — guard `no-request` fails closed** with the diagnostic
  "consistency anomaly — the request was just created". Deliberately does NOT
  reuse the team-tools SD-GUARD no-request-proceeds mapping
  (`packages/tools/src/guard.ts` — a different consumer where no-request is the
  ordinary leader-autonomy fall-through).

## 4. §10.5 recon — guard-side re-probe of external policy facts

**Finding: NO guard-side patch is needed for the current deployment. NO
`packages/runtime/control/` change was made; NO `teamHardDeny` introduced.**

Evidence (post-A4 line numbers, `packages/runtime/control/service.ts`):

1. The ONLY external-policy await on the decision path is in
   `resolveControl` (L1037–1070): when `decision === 'allow'` and the
   capability domain is present (explicit, or derived `'tools'` from
   `toolName`, L1040–1042), the service calls
   `await options.externalPolicyFacts()` (L1044); a hard-cell denial writes a
   durable deny row FIRST (L1049–1057) and then throws
   `CONTROL_EXTERNAL_POLICY_DENIED` (L1058–1067). A denial therefore settles
   as an ordinary durable `deny` — the A5 wait bridge maps it to
   "the approval was denied" with no special handling.
2. `guardOperation` (L1109–1262) re-checks: team exists, target durable +
   live, exact-scope request match, decision value, consumption, and the
   decision's frozen scope snapshot — but it does **not** call
   `options.externalPolicyFacts()` (no reference in the guard path). Its
   authority is the durable allow already vetted at decision time.
3. **Adjacency argument**: in the A5 pipeline the statements between the
   decision settling and the guard consult are (a) the wait bridge's own
   durable-ledger reads (liveness only — it never re-probes facts) and (b) the
   synchronous decision mapping. There is no external await strictly between
   decision settle and `guardOperation`. For the current deployment (static
   facts provider — the world port `makeExternalPolicyFacts()`, the glue's
   wired port) the facts cannot change inside that window, so the guard's
   verdict is consistent with the decision-time external check.
4. **Documented residual** (not a current-deployment gap): if the external
   facts provider were dynamic and changed strictly between the
   `resolveControl` probe and the `guardOperation` consult, the guard would not
   re-probe and the new denial would not block the in-flight operation (the
   durable allow stands). The minimal guard-side re-probe patch is therefore
   DEFERRABLE to a dynamic-facts deployment; introducing it now would touch
   `control/` (A4 frozen surface) for a window that is empty today.

## 5. Tests — `packages/runtime/test/a5a-pre-execute.test.ts` (39 tests)

World: the REAL A4 control service over the REAL P6-T4 durable world
(`createP6T4World`, hand-built service with `waitPollIntervalMs: 10` — R4).
Agent ctx: a tiny double whose `on` records the listener and returns a tracked
disposer. Resolver: deterministic fake (`file:///` keys; trivial normalization
that equates `./`, doubled slashes, backslashes — different spellings, one
identity). Runner constraints honored (plain-node shim: module-level async
scenarios, synchronous `it` bodies, toBe/toEqual/.not only).

15-scenario map (scenario → what it pins):

| # | Scenario | Pin |
| --- | --- | --- |
| S1 | allow executes (default deny + exact allow `read fileA`, op path `./fileA.txt` — different spelling, same key) | next once; ZERO control rows; exercises the R2 rule-canonicalization cache |
| S2 | static deny (exact deny rule `write denied.txt`) | deny with provenance ("deny rule 0"); next never; no control row |
| S3 | full ask→allow (member, default ask) | durable `leader-approval` row (toolName/correlation=callId/fingerprint `sha256:`/summary `write fileC.txt`/target); the listener is PAUSED (unsettled) when the row is visible and before the resolve; leader allow → allow, next once; the consumption row exists (exactly-once); diagnostics rows emitted (canonicalized → decision → request-created → decision-arrived → guard-verdict) |
| S4 | ask→deny (member) | leader deny → "the approval was denied"; next never; row kind `leader-approval` |
| S5 | exactly-once / allow-once | second identical call (same file+content, NEW callId) → NEW request (distinct requestId, same fingerprint); direct guard under the OLD scope → blocked `allow-consumed`; new request resolved deny → zero second execution |
| S6 | fingerprint mismatch | approved `write(fileC,'payload-1')`; new `write(fileC,'payload-2')` (new callId) → NEW request, DIFFERENT fingerprint; the old decision's frozen scope is bound to the old fingerprint; guard under the NEW scope (new corr + new fp) → blocked `request-pending` (the old allow cannot authorize the new op); the new allow authorizes exactly the new op (next once; second consumption row) |
| S7 | routing | member ask rows are `leader-approval` (S3/S4); leader ask row is `user-approval` (target = leader instance) |
| S8 | member self-approval forbidden | member resolving its own `leader-approval` request → `CONTROL_RESOLVER_NOT_AUTHORIZED` (details: role `member`, allowedRoles `['leader','human']`); the request STAYS pending (no decision row) and the waiting listener keeps waiting; the later leader allow unblocks it (next once) |
| S9 | leader self-approval on user-approval forbidden | leader resolving its own `user-approval` request → `CONTROL_RESOLVER_NOT_AUTHORIZED` (role `leader`, allowedRoles `['human']`); stays pending; the human allow unblocks the listener |
| S10 | cancellation | abort the exec signal while the wait is pending → deny "the approval wait was cancelled"; next never; no unhandled rejection (the run process completes cleanly); the durable request STAYS pending, no decision row |
| S11 | unsupported tool pass-through (`web_fetch`) | next called (allow); ZERO control rows; the fake resolver NOT called (call-count delta 0) |
| S12 | bash tool-level | ask lane `[bash any]` → `leader-approval` request carrying the CONSTANT bash fingerprint (pinned against A2 `canonicalizeOperation` directly); allow → executes (next once); a different command string (new callId) carries the SAME constant fingerprint; its deny → zero execution. bash with NO rule + default deny → static deny, next never, no request row |
| S13 | canonicalization failure | resolver throws for a path → deny with the closed reason `resolver-threw` (A2 message), next never, no request; malformed arguments (write without `file_path`) → deny with `file-path-missing`, the resolver NOT called (validation precedes I/O), no request |
| S14 | pre-aborted signal (R3) | signal already aborted + a policy that would ask → deny "the approval wait was cancelled (the call was already aborted)"; NO request row created; next never |
| S15 | disposer | the install returns the `ctx.on` disposer VERBATIM (identity check); it removes the listener (count 1→0; a trigger after dispose finds no listener); a second install on the SAME double works independently (exactly one listener, next once) |

## 6. Gates — exact commands, baseline vs after

All commands from the worktree root `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\alpha2-a5`.

| Gate | Command | Baseline | After |
| --- | --- | --- | --- |
| runtime suite | `node scripts/run-tests.mjs runtime` | a2 30 PASS; a3 28 PASS; a4a 28 PASS; FAIL d1-member-base-tools 3/6, d1-s6-remote-v3 6/14, d1-team-ownership-index 5/16, d2-s6-ensure-root-live 5/10, d3-member-identity-context 1/5, d5-instance-contract 2/9 + plain-node process abort at `d5-instance-contract.test.ts:109` (`toHaveLength` shim gap — runner prints no final summary line; file-level comparison is the contract) | IDENTICAL + **a5a-pre-execute 39 PASS** — the only delta in the file-level diff (zero NEW failures); same abort, same position |
| typecheck | `pnpm typecheck` (full repo) | — (package-level `pnpm --filter @dsh-agent-team/runtime typecheck` used during iteration) | EXIT=0, every package "Done" |
| build | `pnpm build` | — | EXIT=0 (log: after-build.log) |
| composition build | `pnpm build:composition` | — | EXIT=0 (log: after-build-composition.log) |
| artifact check | `node scripts/check-artifacts-committed.mjs` | — | PASS (rebuilt dist committed; see commit) |
| testkit suite (pin) | `node scripts/run-tests.mjs testkit` | 124/0 | 124/0 (pin 663→665, entry (f) A5) |
| scanner verification | `scanSessionEventVocabulary()` via node one-liner | 663 files, 15 frozen-quarantine hits | **665 files, same 15 hits, 0 payload symbols, 0 declaration merges**; the two new files appear in the scan list; scanner `.mjs` byte-unchanged (`git status` clean for it) |
| install | `pnpm install --ignore-scripts` | — | "Already up to date" (no dependency changes) |

Evidence logs: `dev/agent-workflow/evidence/alpha2-permission/a5/`
(`baseline-runtime-runtests.log`, `after-runtime-runtests.log`,
`after-typecheck.log`, `after-build.log`, `after-build-composition.log`,
`after-testkit-runtests.log`).

## 7. Red-line status

| Red line | Status |
| --- | --- |
| CORE PATCH BUDGET = 0 (no `references/**` edits) | KEPT — zero changes under `references/` |
| No new dependencies | KEPT — `pnpm install --ignore-scripts` → "Already up to date"; no `package.json` change |
| Do NOT touch `root.ts` / `agent-bindings.mjs` / `host.ts` (A6 territory) | KEPT — `git status` shows none of them |
| Compose A2/A3/A4 frozen APIs only | KEPT — the adapter imports only `canonicalizeOperation`/`classifyPermissionTool` (A2), `resolveOperationPermission` (A3), `createControlService` + the control vocabulary/types (A4); no re-implementation of their logic |
| No `teamHardDeny` introduced | KEPT — no such identifier anywhere in the diff (§10.5: no control/ change) |
| `packages/runtime/control/` unchanged | KEPT — recon only (findings in §4) |
| Transient dev scripts deleted | KEPT — `.tmp-a5a-run.mjs` (single-file iteration runner) removed before commit |
| No push | KEPT — local commit only |
| Scanner `.mjs` byte-unchanged | KEPT — verified via `git status` / diff |
| Working tree ends clean | KEPT — verified at commit time |

## 8. Deviations from the brief

1. **R4**: the brief's optional `waitPollIntervalMsHint` install parameter was
   DROPPED (documented in the adapter module doc) — the poll cadence is
   A4-injected at service construction; the adapter takes the service fully
   constructed. The test constructs its service with `waitPollIntervalMs: 10`.
2. **S14 wording**: the pre-abort deny reason is the exact frozen string
   `"the approval wait was cancelled (the call was already aborted)"` (the
   brief's "(documented R3 choice)" — the no-row preference is implemented).
3. **R5 wording**: the no-request consistency-anomaly deny reason is
   `"permission denied: the last-mile guard found no request (consistency
   anomaly — the request was just created)"`.
4. **Extra surface**: `onObserve` (small structured diagnostics rows at five
   pipeline points) — the brief's optional `onObserve?` hook; a throwing hook
   never affects the decision.
5. No other deviations: the frozen pipeline, the closed reason vocabulary
   (deny/abort/default-provenance), the `actionName 'parameter-permission'`
   scopes, the `isLeader` routing bit, and the callId-correlation convention
   are all as specified.

## 9. A6 handoff notes (for the glue task)

- Install per agent lifecycle (fresh root / fresh member / cold resume) with
  `caller = { kind: 'instance', instanceId }`, `targetInstanceId` = the same
  instance id, `isLeader` = leader instance only; store the returned disposer
  in the lifecycle disposer list (plan §11.2/§11.3).
- The `resolveTarget` closure: `ctx.fs.resolve(path, { cwd: sessionCwd })`
  unbranding `FsTarget.targetKey` → `{ key, display }`; session cwd =
  `exec.agent.session.header.cwd` captured at install (R1).
- The listener NEVER returns 'ask'; the A6 glue's own pre-execute listeners
  (if any) chain through `next()` exactly as the upstream waterfall expects.
