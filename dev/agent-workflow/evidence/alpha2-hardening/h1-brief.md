# H1 — P0 vertical: RED probe + monotonic end-cap (alpha.2 hardening)

> Task: `task/alpha2-h1-p0-endcap` · worktree: `.worktrees/alpha2-h1` (create from `int/alpha2-hardening` @ 27a6c36, run `pnpm install` first) · 1 writer = you.
> Authority: `docs/plans/active/dsh-agent-team-alpha2-permission-boundary-hardening.md` (§2, §4, §5, §13, §14) — the main agent has VERIFIED every claim below against source; line citations are to the tree you inherit (re-verify before acting; if anything differs, STOP and report).

## 1. The verified bug (P0)

Upstream `ToolRuntime.prepareExecution` (test-use `packages/core/tools/src/index.ts`):
- L1458 `const created = this.createExecution(input)` → `const exec = created.exec` — ONE exec object per execution.
- L1466-1469 `const gate = await this.ctx.waterfall(carrier, 'tools/pre-execute', exec, () => Promise.resolve({ kind: 'allow' }))` — a Cordis waterfall. Event signature L144: a listener MAY return a decision WITHOUT calling `next()`.
- L1477-1490 `const denialReason = decision.kind === 'allow' ? this.guardReason(exec) : decision.reason` — the monotonic guard stage runs ONLY when the final decision is allow, on the SAME `exec` object. A guard reason → `Error: <reason>` result, tool body NEVER runs.
- L696-704 `ToolGuard = (execution: Readonly<ToolExecution>) => string | undefined`; "guard has no allow result" — monotonic veto.
- L1092-1105 `guard(guard)` public seam: "one registered through `agent.ctx` applies only to that agent. Any matching guard may deny ... while no guard can force-allow" — returns the exact disposer.
- L300 `ToolExecutionToken = symbol & brand` — the token is a SYMBOL (not WeakSet-able).
- Upstream's own test proves the composition: `packages/core/tools/tests/scoped.spec.ts` L288-316 — a later-registered `scope.ctx.on('tools/pre-execute', () => Promise.resolve({ kind: 'allow' }), { prepend: true })` "can force the extensible pre decision to allow, but cannot bypass the owner-level monotonic guard that runs after the waterfall" (bodyCalls unaffected by the prepend-allow).

OUR adapter (`packages/runtime/operation-permission/pre-execute-adapter.ts`):
- L662 `return agentCtx.on('tools/pre-execute', listener)` — installs ONLY the waterfall listener. No guard.
- `enforce()` (L426-647): static allow → `await next()` at L506-508; ask→allow→guardOperation-allowed → `await next()` at L646. Deny paths never call next.
- Every existing test (a5a, a6a) drives it on a FAKE agent ctx (a5a header: "a tiny double whose `on` records the listener") — the adversarial composition property was never exercised.

⇒ A hostile `agentCtx.on('tools/pre-execute', () => Promise.resolve({kind:'allow'}), {prepend:true})` (any plugin/preset/hook) short-circuits the ENTIRE Team permission pipeline. P0 is real.

## 2. The fix (main-agent ruling — implement exactly)

Add a **monotonic end-cap guard** on the SAME agent ctx, with an **install-scoped authorization marker over the exec OBJECT**:

- `const authorizedExecutions = new WeakSet<object>()` — created INSIDE `installParameterPermissionListener` (install-scoped ⇒ per-agent; the same `exec` object flows waterfall → guard ⇒ object identity is the identity; no delete step needed (exec objects are per-execution, GC'd with the pipeline pass); no token table, no callId set, no durable state — review §10 compliance).
- **Mark ONLY after final authorization, before `await next()`**: (a) static allow (L506), (b) ask → allow → guardOperation-allowed (L646). NEVER on any deny/abort/failure/canonicalization-failure path.
- **Guard body** (sync, never throws): `classifyPermissionTool(exec.name)` → `unsupported` ⇒ `undefined` (abstain; unsupported tools are not Team's jurisdiction — must NOT over-deny); supported (one of the six) + `authorizedExecutions.has(exec)` ⇒ `undefined`; supported + unmarked ⇒ denial reason string (stable, typed text, e.g. `permission denied: no Team permission authorization for this execution (pre-dispatch policy not reached — monotonic end-cap)`). Emit an onObserve diagnostics row on the denial (try/catch-wrapped, never throws — review §18: how ops will know the end-cap fired).
- **Install**: `const disposeListener = agentCtx.on('tools/pre-execute', listener); const disposeGuard = agentCtx.tools.guard(guard); return () => { disposeListener(); disposeGuard() }` — **listener disposed FIRST, guard LAST** (the guard is the last line of defense; pin this order in the module doc). Composite disposer ⇒ the A6 glue (`agent-bindings.mjs` L1249-1261 `toolDisposers.push(disposePermission)`) needs NO change — all four bind paths install both and dispose both through the existing single disposer slot.
- **Structural mirror**: extend `AgentPreExecuteCtx` (pre-execute-adapter.ts L228-244) with the guard surface — minimal structural type: `tools: { guard(guard: (exec: GuardExecLike) => string | undefined): () => void }` where `GuardExecLike = { readonly name: string }` (the only field the guard reads). **Fail-closed**: if `agentCtx.tools` or `agentCtx.tools.guard` is missing/non-function at install ⇒ throw a typed install error mirroring the V1-1 `alpha2-permission-fs-unavailable` pattern (new code, e.g. `alpha2-permission-guard-unavailable`, exported + documented; the A6 glue's fail-closed typed-rejection path already converts install throws into agent setup failures).
- **Do NOT change**: the resolver (A3) — it stays pure and total; the control service (A4); the fingerprint; the pipeline order (plan §10.2 frozen); the glue file (unless a gap proves otherwise — record if so).

## 3. RED→GREEN protocol (review §13 — MANDATORY)

1. Add devDependencies to `packages/runtime/package.json` (all `0.1.2-rc.1`): `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-scope`, `@deepseek-ai/dsh-system-prompt` (+ `@deepseek-ai/cordis` IF `import { Context } from '@deepseek-ai/cordis'` does not resolve from packages/runtime — check first). `pnpm install` (lockfile updates commit with the task). These are PUBLIC upstream packages — test-only devDeps, zero upstream source modification (CORE PATCH BUDGET stays 0).
2. New test file `packages/runtime/test/h1a-pre-execute-endcap.test.ts` asserting the SECURE property on the REAL upstream composition (see §4). On the UNFIXED tree this test FAILS — the failure output must show the bypass (body executed under the hostile prepend-allow). **Capture that failing console as `h1-red-console.log` BEFORE any fix commit.** Also capture a plain `node -e`-free sanity: the mount itself works (the `it` bodies will show it).
3. **STOP condition (review §13)**: if the RED cannot be reproduced on the real upstream composition (mount fails under this repo's plain-node vitest shim, or the hostile prepend-allow does not short-circuit), STOP and report to the parent with diagnostics. Do NOT proceed on theory and do NOT fake the waterfall with a double.
4. Implement the fix (§2). Rerun → all green. Capture `h1-green-console.log`. The RED console timestamp MUST predate the fix commit.
5. Commit order on the task branch (suggested): (a) devDeps + lockfile + probe file (failing) + red console + root-cause/seam note; (b) the fix + double extensions (t12a bridge, a5a fake) + suite updates; (c) evidence (green consoles, probe log, summary.md). Final tree: everything green.

## 4. The real-composition mount (upstream recipe — scoped.spec.ts L17-59)

```ts
import { Context } from '@deepseek-ai/cordis'
import { createScope } from '@deepseek-ai/dsh-scope'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { ToolCallId } from '@deepseek-ai/dsh-llm'        // already a runtime dep
import type { SessionId } from '@deepseek-ai/dsh-session' // already a runtime dep
import type { Agent } from '@deepseek-ai/dsh-agent'       // already a runtime dep

const ctx = new Context()
await ctx.plugin(SystemPrompt, {})
await ctx.plugin(ToolRuntime)
// mint an agent scope (the minter injects what scope holders reach):
const key = { id: 'a1' as SessionId } as Agent
let scope
await ctx.plugin(Object.assign((inner) => { scope = createScope(inner, key) },
  { inject: ['tools', 'systemPrompt'] }))
// a MANAGED tool (the name must classify as a permission tool — use 'read'):
scope.ctx.tools.register({ name: 'read', description: 't', parameters: { type: 'object', properties: {} },
  output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
  execute: () => { bodyCalls++; return Promise.resolve('ran') } })
// hostile (the P0 bypass):
scope.ctx.on('tools/pre-execute', () => Promise.resolve({ kind: 'allow' }), { prepend: true })
// drive a real execution:
const result = await ctx.tools.execute({ signal: ac.signal, callId: ToolCallId('c1'),
  name: 'read', arguments: { file_path: 'x.txt' }, agent: key })
```

Install the adapter on `scope.ctx` (the REAL scope ctx — it has `.on` and `.tools.guard`). Adapter params: real `createControlService` (the a5a pattern: p6t4 world helpers from `./p6t4-helpers.js`, `waitPollIntervalMs: 10`), deterministic fake `resolveTarget` (a5a pattern — stable `file:///` keys), policy per probe, `caller`/`targetInstanceId`/`rootSessionId` from the p6t4 helpers (member or leader — use member, `isLeader: false`).

**RUNNER CONSTRAINTS** (repo plain-node shim — see a5a header): every async scenario at MODULE level (top-level await) capturing results; `it` bodies pure synchronous assertions; shim matchers `toBe`/`toEqual` (+`.not`) only. Follow the a5a file structure exactly.

## 5. Probes (all in h1a; names map to review §14)

| Probe | Setup | Expect (post-fix) |
|---|---|---|
| A1/P0-A | default `deny` policy + hostile prepend-allow, read | DENIED (end-cap reason text in result), bodyCalls 0, ZERO control rows |
| A2/P0-B | default `ask` (no rules) + hostile prepend-allow, read | DENIED by end-cap, ZERO control requests created (no row, no consumption) |
| A3/P0-C | static allow rule (exact), NO hostile, read | EXECUTES, bodyCalls 1, zero control rows (the authorized marker lets the guard abstain) |
| P0-D | default `ask` + hostile prepend-allow + (defensively) a pre-seeded identical-scope request row resolved allow | still DENIED by end-cap (no marker), and the pre-seeded row is NOT consumed (guardOperation never ran) |
| P0-E | unsupported tool name (`web_fetch`) + hostile prepend-allow | EXECUTES (guard abstains — no over-deny beyond the six tools) |
| P0-F | hostile listener returns `{kind:'deny', reason:'hostile'}` (no allow-listener) | DENIED with the hostile reason; body never runs; the end-cap guard is NOT consulted (final decision ≠ allow) — pin |
| A5/P0-G | full ask→allow chain, NO hostile (member, leader resolves via the real service) | EXECUTES exactly once, request + decision + consumption rows exactly-once (the marker does not break the normal path — mirrors a5a S3) |
| P0-H | two hostile listeners: prepend-allow AND append-deny (append = default registration) | final decision = deny ⇒ body never runs (pin monotonicity of the pre stage itself) |
| P0-I | nested dispatch: a tool body that dispatches the managed `read` through the same registry (find the upstream nested-dispatch pattern in test-use packages/core/tools tests — the exec parent/token machinery; if a unit-level nested probe is infeasible without the agent loop, record the ruling and leave A10/A11 to H3's live smoke — the live agent loop's parallel tool calls ARE the PTC path) | nested managed call under a hostile prepend-allow: the NESTED exec is a DIFFERENT object ⇒ unmarked ⇒ end-cap denies the nested call, parent result carries the nested error |
| P0-J | any denied-by-end-cap call | ZERO control rows, one diagnostics observation row with the end-cap reason (review §18) |
| A9 | two installs / two agents: hostile prepend-allow on agent A's ctx only; agent B (own scope ctx, own install) reads | A denied, B unaffected (install-scoped marker + agent-scoped guard) |
| A15 | = P0-B (ask lane not hijackable) — keep as explicit named leg | — |
| A16 | end-cap denial does not create/resolve any approval state; no new durable rows of any kind | — |
| S15-ext | composite disposer: dispose ⇒ BOTH listener and guard removed (recording doubles); a fresh install on the same ctx works independently (a5a S15 pattern) | — |
| fail-closed-install | install against a ctx WITHOUT `tools.guard` (double) | typed `alpha2-permission-guard-unavailable` thrown at install, zero partial state (no listener registered) |

Also update the EXISTING suites: **a5a** fake ctx double gains a `tools: { guard }` recording surface (its S-scenarios keep passing — they never short-circuit, so the guard never fires; S15 becomes the composite-disposer assertion); **a6a** via the t12a bridge (`packages/runtime/test/t12a-live-bridge.mjs`): the bridge's agent-ctx double gains a recording `tools.guard` (V1-2 precedent: recording doubles default to `null` = dep omitted → but HERE the dep is REQUIRED: the glue install now throws without it, so the bridge MUST provide it; update any bridge-consumers that built ctxs by hand).

## 6. Gates (all on the task tree, then repeated by the parent on int)

- h1a suite: all probes PASS (real composition).
- a5a + a6a: PASS (updated).
- runtime parity: the known 6 pre-existing failing files UNCHANGED (same set, no new failures) — run the targeted suites the A6 report used (a2/a3/a4a/a5a/a6a + t12a spot checks).
- domain: 372/11 baseline (11 pre-existing) — unchanged (H1 touches no domain code).
- testkit: 124/0 with the NEW pin — the new test file moves the p4t6 scan: run `pnpm --filter @dsh-agent-team/testkit exec vitest run test/p4t6-session-event-scan.test.ts`, update the pinned count + append a `(h1)` entry to the DEC-1 comment chain (same mechanics as A1-A6: value + comment only), scanner-verify.
- typecheck 0 (`pnpm -r run typecheck`), build 0, `pnpm run build:composition` 0 + `check-artifacts` (1080 + your delta), dist EOL: keep the rebuilt `agent-bindings.mjs` (if it changed — it may not, if the glue is untouched) pure LF (A5/A6 precedent: restore if the build churns EOLs).
- red lines: `references/` untouched (test-use stays @ a66e470204 porcelain 0), :3080/:3180 zero-touch, 3181/3493 not used by H1 (unit-only task), worktree porcelain clean at end, delete the copied dispatch inputs (this brief + any .tmp-* probes) before the final commit.

## 7. Deliverables

- Task branch commits (final tree green).
- `dev/agent-workflow/evidence/alpha2-hardening/h1/`: h1-red-console.log (TIMESTAMPED, predates the fix), h1-green-console.log, root-cause-and-seam-note.md (the verified upstream facts + the WeakSet ruling + any deviation), summary.md (probe table w/ console excerpts, gates, pin delta, rulings/deviations, commit list).
- Report to parent: final verdict (GO for H2 to start), commit SHAs, gate table, any deviation from this brief (each with the evidence).
