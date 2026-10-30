# CLASSIFICATION — u7r3-s1ask: is threading the per-call carrier Agent into the EXISTING port binding a 中心接口变更?

> **Dated banner (real UTC 2026-10-30T14:15Z, lane `u7r3-s1ask`, seat: delegated subagent on the
> harness-reported model qwen3.8-flash-next, disclosed; ROUTER_RULES §0.2 — independence =
> independent sessions, not a model identity).**
> Authority for what the Host *is*: pristine `tests/deepseek-harness-test-use` @
> `639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2; read-only, never edited).
> Authority for what we are: branch `task/u7r3-s1ask-20261030` @ `e2f14c71bd65e3671ed72bffe9b7092db8d1b3b8`
> (origin/master tip at spawn), worktree `.worktrees/u7r3-s1ask`.
> **This STEP 0 is gating: written BEFORE any code change. ZERO boots, ZERO starts.**
> Path note: the lane brief cites `docs/USER-RULING-20261031.md`; the file's tracked home at the
> base is `dev/agent-workflow/gates/USER-RULING-20261031.md` (the `docs/` path does not exist on
> master). Cited below by its tracked path; `:24` resolves there as analyzed below.

## VERDICT: **NO — this is NOT a 中心接口变更 under USER-RULING-20261031 §一.2 (`:24`).**
The change proceeds as an ordinary implementation PR (lane-owned), i.e. exactly the shape the
foundation memo `dev/agent-workflow/evidence/u7r3-o2memo-20261030/O2-A-ask-port-agent-binding.md`
classifies as **S1** — and the memo's own governance section (e) is explicit: *"S1 and S3 are
lane-owned changes … S2 is a centre decision"*. This lane implements **S1 only**.

## The governed line, verbatim (`dev/agent-workflow/gates/USER-RULING-20261031.md:24`, §一.2 六问裁决 item 2 「接线权威」)

> 显式测试 Home 可继续用 DSH_HOME；**正式生产 Home 必须从可信 Host 配置或公开接口获得**。允许研究
> 最小 `homePath` Center Interface，但**修改中心接口之前必须完成独立安全审查**；不得修改 Host 私有
> 接口；不得为了让正式 Home 可写而删除 `~/.dsh` 防护。优先复用 Host 现有公开配置/服务接口；仅当证明
> 接口确实不足才新增最小中心 capability。

Extracted as a law (the reading O2-A §(d)/§(e) applies to this exact question — USER-RULING-20261031
§一.2, `:24`): **(L1)** independent security review is required *before modifying a centre
interface*; **(L2)** Host private interfaces must not be modified; **(L3)** the public/reuse path
comes first; **(L4)** a new minimal centre capability is added *only when existing interfaces are
proven insufficient*.

## Clause-by-clause: why this change touches none of L1–L4

**L1 (centre-interface modification triggers review).** The centre interfaces of this repo are the
closed, enumerated contracts: the family-facing capability set `CAPABILITY_KEYS`
(`packages/runtime/src/plugin/live/family-assembly.mjs:60-74`, enforced closed by
`makeFamilyCapabilities` `:83-92` `FAMILY_CAPABILITY_UNKNOWN`), the contribution/definition shapes,
and `packages/contracts`. This lane changes **none of them** — verified at the base, each byte-equal
before and after this lane's diff:

1. **No new public surface.** No key enters `CAPABILITY_KEYS`; no key enters/leaves
   `FORBIDDEN_CAPABILITY_KEYS`; the plane's `familyCapabilities(...)` mint
   (`team-tool-plane.mjs:1610-1632`) and `mount(agentCtx)` (`:2039-2048`) are untouched; no
   contracts/schema/DTO changes; no new plane config key.
2. **The two surfaces this lane threads between are BOTH already public and already frozen:**
   - Host: `ToolExecutionInput.agent?: Agent` — *"The agent on whose behalf the call runs (set by
     the agent loop)"* — `tests/deepseek-harness-test-use/packages/core/tools/src/index.ts:339`
     @ the pin, with `ToolExecution extends ToolExecutionInput` (`:393`) making it live on the
     definition-owned `execute(raw, exec)` carrier. The Host's OWN ask tool reads exactly this
     field (`packages/interaction/tool-ask-user/src/index.ts:107`). This lane reads it the same
     way; it adds nothing to the Host and requests nothing from it.
   - Our lane: `createUserQuestionsPort(userQuestions, { agent })` — the second-arg binding at
     `packages/tools/ui-family/src/ui-interaction-port.mjs:83-94` — **exists today, is documented
     as the Agent seam (`:73-79` "the mount's OWN live agent, resolved lazily when the mount has
     one"), and is passed nothing by any production caller** (`packages/tools/families/ui.mjs:82`
     calls it one-argument). Wiring an existing, documented, unused parameter to its documented
     input is not a signature change: the adapter, the port contract (`ask/askTimed/present`), and
     the fail-closed laws at `:84-86` are byte-equal.
3. **What changes is behavior WITHIN existing contracts:** governed ask rows whose per-call carrier
   HAS an Agent (every real agent-loop dispatch sets one, per the quoted Host doc) will deliver the
   question to that row's own carrier Agent via the Host's already-public scoped arm
   (`packages/interaction/user-questions/src/index.ts:322-330`, `scopeTarget(agent, agent)`) instead
   of structurally landing on the unscoped arm's `NO_PROVIDER` (`:318-324`). No contract field,
   enum member, schema, or trust boundary changes shape; the observable difference is precisely the
   documented semantics of the existing seam becoming reachable. This is the definition of
   "behavior change within existing contracts", the complement of what `:24` governs.

**L2 (no Host private interface).** Everything read (`ToolExecutionInput.agent`,
`ctx.get('userQuestions')`, `ask(request)`'s public `request.agent` arm) is public surface at the
pin; `core patch budget = 0` honored — the Host tree is untouched (and this lane boots nothing).

**L3 (public/reuse path first).** This change IS the reuse-first path: an already-public carrier +
an already-public service + an already-existing adapter seam. It is the answer to the ruling's
"优先复用" clause; S2 (one new `CAPABILITY_KEYS` key = a genuine centre change requiring the §一.2
security review) is *avoided*, not performed. The STATE_HOME precedent runs the same way
(`state-home/PRODUCTION-HOME-DESIGN.md` (g): the `homePath` centre capability was retired once a
public path was proven).

**L4 (new centre capability only when proven insufficient).** This lane adds **zero** centre
capability. Nothing is "proven insufficient" here because nothing centre-level is even used: O2-A
§(c)/(d) demonstrates the needed faces all exist. If S1 is refused at review on ownership grounds,
the ranked fallback is S3 (trusted-mount binding — also zero new surface), and S2 only with its
security review attached; this lane claims nothing beyond S1.

## In-repo precedent that per-call carriers of this kind are lane data, not centre surface

The agent-control family already transports `exec.agent` exactly this way — `spawn-row.mjs:41-43`
(*"The DISPATCH-provided caller identity (native callingAgent law): trusted transport data — the
model cannot express or restate it"*) and `agent-control-executor.mjs:174`; siblings
`fork-row.mjs:40`, `workflow-row.mjs:34`, `list-agents-row.mjs:24`, `list-models-row.mjs:28`. No
centre review accompanied those (they are row-transport within a reviewed family lane); this lane
matches their shape verbatim, including the falsy-carrier law (`agent === null || agent ===
undefined` → the field is not carried at all).

## Failure laws the classification depends on staying UNCHANGED (implemented + tested in this PR)

- Carrier absent (`exec.agent` nullish) → NOT silently dropped into a new unscoped-success path:
  the adapter's documented arm stands (`ui-interaction-port.mjs:73-79` — "A mount without a live
  root agent leaves it off — the service then answers its own typed CALLER_NOT_LIVE /
  DELEGATED_CALLER refusal, which the row surfaces verbatim"), the Host answers `NO_PROVIDER`
  (`user-questions/src/index.ts:318-324`), and the row answers the SAME typed
  `UI_INTERACTION_PORT_FAILED` refusal (`ask-executor.mjs:196-198`) as today. Regression-tested.
- Falsy/unknown agent → the service's own ownership law answers verbatim
  (`assertLiveRoot` → `CALLER_NOT_LIVE` / `DELEGATED_CALLER`; never second-guessed, never a
  synthesized success).
- Injected-port arm (`cap.injected.uiInteraction`, the kit/C1 seam `ui.mjs:78-80`) is untouched —
  unscoped legacy behavior for that arm byte-equal; all 41 C1 legs of
  `packages/runtime/test/u7-f-ui-c1.test.ts` ride it and must stay green unchanged.
- The port gate stays BEFORE any authority force (`ask-executor.mjs:110-119`: zero PA consumption
  on absent face); `present` keeps no face through this adapter (`ui-interaction-port.mjs:33-40`,
  O2-B is a different gap); `agent` never rides any observation line, `callId`, or ledger string
  (correlation discipline `packages/tools/a5p5-tools/src/register.ts:202-209,238`).
- Per-call resolution stays lazy — no mount-time capture of the Agent (`ui.mjs:77-78` lazy-seam law).

## Scope this classification authorizes the lane to implement (and nothing more)

1. `packages/tools/ui-family/src/ask-row.mjs` — read `exec?.agent` in the execute transport, carry
   it on `corr` (spawn-row pattern verbatim, falsy-carrier law included).
2. `packages/tools/ui-family/src/ask-executor.mjs` — pass `corr.agent` into the existing lazy
   `portRef` call (`:113`); docblock updated. No reordering of the ordering law.
3. `packages/tools/families/ui.mjs` — `portRef(agent)` passes the carrier into the EXISTING
   second-arg binding: `createUserQuestionsPort(service, { agent: () => agent })`. Injected arm
   unchanged; present executor's zero-arg call site unchanged (service arm then behaves byte-equal
   for it via the adapter's `live === undefined` drop).
4. Unit tests in `packages/tools/test/` (C1, no boot): scoped call shape reaches the service with
   the carrier; absent carrier → typed `UI_INTERACTION_PORT_FAILED` refusal unchanged; falsy/unknown
   carrier → typed refusal via the service's verbatim law; injected arm byte-equal (no binding,
   C1 legs unchanged); no path answers unscoped when a carrier is expected.

Not in scope (this lane claims nothing about them): the ledger `L4-positive` cell (stays
`DISCLOSED` until a real-Host positive arm lands — live f4 re-run is a SEPARATE boot leg, OWED, not
this lane), matrix/backlog files, `present`/O2-B, `CAPABILITY_KEYS`, any Host change.
