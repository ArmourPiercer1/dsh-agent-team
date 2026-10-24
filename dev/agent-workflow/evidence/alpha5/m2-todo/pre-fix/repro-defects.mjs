// repro-defects.mjs — root-card three defects: PRE-FIX reproduction (module
// extracted VERBATIM from the root-reviewed commit 60449b0e1) vs POST-FIX
// contrast (current governed-families/todo.mjs). Run: node this file.
// Output is the 原文 CENTER asked for; exit 0 always (reporter, not a gate).
import { pathToFileURL } from 'node:url'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../../../../')
const TREE = join(REPO, 'tests/deepseek-harness-test-use')

const todo = (await import(pathToFileURL(join(TREE, 'packages/todo/tool-todo/lib/index.js')).href))
const PRE = (await import(pathToFileURL(join(HERE, 'todo.pre-fix.mjs')).href))
const POST = (await import(pathToFileURL(join(REPO, 'packages/runtime/src/plugin/live/governed-families/todo.mjs')).href))

const SES = 'ses-m2todo-1'
let seq = 0
function mount() {
  const events = []
  const tools = []
  todo.apply(
    { tools: { register: (t) => tools.push(t) }, sessionProjections: { register: () => {} } },
    { allowParallelInProgress: true },
  )
  const def = tools[0]
  // REAL Host runtime-face exec shape (core/agent runtime-types.d.ts:142-143 +
  // core/session types.d.ts:64-65): exec.agent.id + exec.agent.session.header.id
  const exec = {
    agent: {
      id: SES,
      session: {
        header: { id: SES },
        append: (type, data) => events.push({ type, count: events.length + 1, todos: data.todos.length }),
      },
    },
  }
  return { def, events, exec, tag: `m${++seq}` }
}

const line = (s) => console.log(s)

// ───────────────────────────── D1: identity vocabulary ─────────────────────
line('=== D1 身份形状：真实 Host 形 exec（agent.id + session.header.id） ===')
{
  const m = mount()
  const arm = PRE.createGovernedTodoArm({
    nativeDefinition: m.def, definitionIdentity: 'def#pre', providerId: 'dsh-agent-team',
    agentScopeKey: SES, trustedIdentities: [SES], allowParallelInProgress: true,
  })
  // host glue would hand the REAL exec (or a ctx carrying the real ids):
  const r = arm.classify({ todos: [{ content: 'x', status: 'pending' }] }, m.exec)
  line(`PRE-FIX  classify(real Host exec) => ok=${r.ok} code=${r.code}`)
  line(`         detail: ${r.detail}`)
}
{
  const m = mount()
  const arm = POST.createGovernedTodoArm({
    nativeDefinition: m.def, definitionIdentity: 'def#post', providerId: 'dsh-agent-team',
    memberAgentId: SES, sessionHeaderId: SES,
    bindingFacts: () => ({ bindingId: 'b-1', bindingRevision: 1, policyGeneration: 1, authorityGeneration: 1 }),
    allowParallelInProgress: true,
  })
  const ok = arm.classify({ todos: [{ content: 'x', status: 'pending' }] }, m.exec, 'call-d1')
  line(`POST-FIX classify(real Host exec) => ok=${ok.ok} fingerprint=${String(ok.operationFingerprint).slice(0, 12)}…`)
  const forged = arm.classify({ todos: [{ content: 'x', status: 'pending' }] }, { agent: { identity: SES, session: m.exec.agent.session } }, 'call-d1f')
  line(`POST-FIX classify(invented "identity" word) => ok=${forged.ok} code=${forged.code} (真实形状之外的词一律不可读，无 shim)`)
}

// ─────────────────── D2: same-tick cancel misreport (append=0 → claims COMMIT) ───────────────────
line('=== D2 同 tick cancel：报告与实际 append 计数的一致性 ===')
{
  const m = mount()
  const arm = PRE.createGovernedTodoArm({
    nativeDefinition: m.def, definitionIdentity: 'def#pre', providerId: 'dsh-agent-team',
    agentScopeKey: SES, trustedIdentities: [SES], allowParallelInProgress: true,
  })
  const c = arm.classify({ todos: [{ content: 'x', status: 'pending' }] }, { agentIdentity: SES, sessionIncarnation: SES })
  const p = arm.prepare(c.plan)
  // the OLD suite's exec: invented word `identity` (that is the exact shape
  // the old 18-leg suite passed with — the path the root measured)
  const legacyExec = { agent: { identity: SES, session: { append: (type, data) => m.events.push({ type, count: m.events.length + 1, todos: data.todos.length }) } } }
  const running = arm.execute(p.ticket, legacyExec)
  const z = arm.cancel(c.plan)
  line(`PRE-FIX  same-tick cancel => settled=${z.settled} | appendCount@report=${m.events.length}`)
  line(`         appendOutcome: ${z.appendOutcome}`)
  await running
  line(`PRE-FIX  after settle     => appendCount=${m.events.length}  ← 错报坐实（先称已提交、随后才 append）`)
}
{
  const m = mount()
  const arm = POST.createGovernedTodoArm({
    nativeDefinition: m.def, definitionIdentity: 'def#post', providerId: 'dsh-agent-team',
    memberAgentId: SES, sessionHeaderId: SES,
    bindingFacts: () => ({ bindingId: 'b-1', bindingRevision: 1, policyGeneration: 1, authorityGeneration: 1 }),
    allowParallelInProgress: true,
  })
  const c = arm.classify({ todos: [{ content: 'x', status: 'pending' }] }, m.exec, 'call-d2')
  const grant = { grantId: 'g-d2' }
  arm.prepare(c.plan, grant)
  const running = arm.execute(c.plan, { consumed: true, grant: { ...grant, callId: 'call-d2', parametersFingerprint: c.operationFingerprint, bindingId: 'b-1', bindingRevision: 1 } })
  const z = arm.cancel(c.plan)
  line(`POST-FIX same-tick cancel => settled=${z.settled} | appendCount@report=${m.events.length}`)
  const x = await running
  line(`POST-FIX execution result => code=${x.code} | appendCount@settle=${m.events.length}  ← 报告与计数一致（体从未进入）`)
}

// ─────────── D3: deferred mutable reads (post-approval replacement) ───────────
line('=== D3 批准期后替换：exec.agent 与 nativeDefinition.execute ===')
{
  const m = mount()
  const foreign = mount()
  const arm = PRE.createGovernedTodoArm({
    nativeDefinition: m.def, definitionIdentity: 'def#pre', providerId: 'dsh-agent-team',
    agentScopeKey: SES, trustedIdentities: [SES], allowParallelInProgress: true,
  })
  const c = arm.classify({ todos: [{ content: 'x', status: 'pending' }] }, { agentIdentity: SES, sessionIncarnation: SES }, )
  const p = arm.prepare(c.plan)
  // APPROVAL PASSED; now the live exec object gets its agent slot replaced by
  // a FOREIGN session (same identity word — the old check only reads the word):
  const hostile = { agent: { identity: SES, session: foreign.exec.agent.session } }
  await arm.execute(p.ticket, hostile)
  line(`PRE-FIX  exec.agent replaced post-approval => originalSession appends=${m.events.length}, FOREIGN appends=${foreign.events.length}  ← 落入 foreign session 坐实`)
}
{
  const m = mount()
  const spyMount = mount()
  const arm = PRE.createGovernedTodoArm({
    nativeDefinition: m.def, definitionIdentity: 'def#pre', providerId: 'dsh-agent-team',
    agentScopeKey: SES, trustedIdentities: [SES], allowParallelInProgress: true,
  })
  const c = arm.classify({ todos: [{ content: 'x', status: 'pending' }] }, { agentIdentity: SES, sessionIncarnation: SES })
  const p = arm.prepare(c.plan)
  const legacyExec = { agent: { identity: SES, session: { append: (type, data) => m.events.push({ type, todos: data.todos.length }) } } }
  const running = arm.execute(p.ticket, legacyExec)
  let spyCalled = false
  m.def.execute = async () => { spyCalled = true; return { replaced: true } } // property replacement post-approval
  await running
  line(`PRE-FIX  nativeDefinition.execute replaced post-approval => replacementRan=${spyCalled}, original appends=${m.events.length}  ← 落入 replacement body 坐实（延后按属性读）`)
  void spyMount
}
{
  const m = mount()
  const foreign = mount()
  const arm = POST.createGovernedTodoArm({
    nativeDefinition: m.def, definitionIdentity: 'def#post', providerId: 'dsh-agent-team',
    memberAgentId: SES, sessionHeaderId: SES,
    bindingFacts: () => ({ bindingId: 'b-1', bindingRevision: 1, policyGeneration: 1, authorityGeneration: 1 }),
    allowParallelInProgress: true,
  })
  const c = arm.classify({ todos: [{ content: 'x', status: 'pending' }] }, m.exec, 'call-d3')
  arm.prepare(c.plan, { grantId: 'g-d3' })
  // exec.agent replaced post-approval — the snapshot decides, not the object:
  m.exec.agent = foreign.exec.agent
  const grant = { grantId: 'g-d3', callId: 'call-d3', parametersFingerprint: c.operationFingerprint, bindingId: 'b-1', bindingRevision: 1 }
  const x = await arm.execute(c.plan, { consumed: true, grant })
  line(`POST-FIX exec.agent replaced post-approval => originalSession appends=${m.events.length}, FOREIGN appends=${foreign.events.length}, ok=${x.ok}  ← 快照定向：写入只落在分类时配对成功的会话`)
}
{
  const m = mount()
  const arm = POST.createGovernedTodoArm({
    nativeDefinition: m.def, definitionIdentity: 'def#post', providerId: 'dsh-agent-team',
    memberAgentId: SES, sessionHeaderId: SES,
    bindingFacts: () => ({ bindingId: 'b-1', bindingRevision: 1, policyGeneration: 1, authorityGeneration: 1 }),
    allowParallelInProgress: true,
  })
  const c = arm.classify({ todos: [{ content: 'x', status: 'pending' }] }, m.exec, 'call-d3b')
  arm.prepare(c.plan, { grantId: 'g-d3b' })
  let spyCalled = false
  m.def.execute = async () => { spyCalled = true; return { replaced: true } }
  const grant = { grantId: 'g-d3b', callId: 'call-d3b', parametersFingerprint: c.operationFingerprint, bindingId: 'b-1', bindingRevision: 1 }
  const x = await arm.execute(c.plan, { consumed: true, grant })
  line(`POST-FIX nativeDefinition.execute replaced post-approval => replacementRan=${spyCalled}, code=${x.code}, appends=${m.events.length}  ← 末端重核（捕获函数值 + definitionIdentity）typed 拒`)
}
line('=== repro done ===')
