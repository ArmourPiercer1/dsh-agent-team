/**
 * vnext-fs-slice.test.mjs — A1's vertical slice, on the REAL host tool runtime.
 *
 * THE CLAIM UNDER TEST, in the owner's terms: a member's native `read` must be served by THAT
 * member's provider, with no Team-authored tool body anywhere in the path. Everything below is
 * the pinned baseline's own code: the real `@deepseek-ai/dsh-tools` registry, the real
 * `@deepseek-ai/dsh-tool-fs` module (loaded from the pinned tree's built `lib/`), the real
 * `LocalFileSystem`, and Cordis' own scopes and isolation.
 *
 * WHAT EACH ASSERTION BUYS
 *   identity     the `read` the agent resolves is a DIFFERENT definition object from the one its
 *                preset scope installed — the mount took effect — while `execute` is the SAME
 *                FUNCTION SOURCE, which is what "the host's body, not a Team copy" means when a
 *                module builds a definition per apply(). A wrapper would fail the second check.
 *   inside       a path inside the member's ceiling reads, one provider call, correct bytes.
 *   outside      a path outside it is refused, and the refusal comes from the member's provider:
 *                its own counters show no successful read of that path, and the file's bytes
 *                never appear in the tool result.
 *   negative     the SAME world with the realm mount removed lets the outside read succeed. This
 *                is the control that makes the three assertions above falsifiable: if the arm
 *                could not fail, it would not be evidence.
 *
 * NOT PROVEN HERE, deliberately: approval, Stop, settlement, or any second member. Those are B.
 * This slice is one member, one face, one provider — the smallest thing that can be wrong.
 *
 * Run: node --test packages/runtime/test/vnext-fs-slice.test.mjs
 * Requires the pinned tree to be built (docs/TEST_METHODS.md §1).
 */

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { after, before, test } from 'node:test'
import { register } from 'node:module'
import { hostNativeSpecs, mountHostModules } from '../src/plugin/vnext/realm-lane.mjs'
import { instrumentedFileSystemClass, loadFsContractSeams } from '../../../tests/world-factory/lib/a5sf-fs-contract-world.mjs'

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))

// The admission point is TypeScript importing product packages with `.js` specifiers; the repo's
// hooks resolve those to `.ts`. Register them BEFORE the dynamic import (a static import would be
// hoisted above the registration).
register(pathToFileURL(fileURLToPath(new URL('../../../scripts/run-tests-hooks.mjs', import.meta.url))).href)
const { installAdmissionPoint } = await import('../src/plugin/vnext/admission-port.mjs')
const { installExecutionFacts } = await import('../src/plugin/vnext/execution-facts.mjs')
const { openFactLedger } = await import('../src/plugin/vnext/fact-ledger.mjs')

const IDENTITY = Object.freeze({
  teamId: 'team-vnext-slice',
  memberInstanceId: 'member-vnext-slice',
  templateId: 'worker',
  instanceGeneration: 1,
})

const lane = (allow) => Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })

/** Build one world. `mountRealm: false` is the negative control, not a second composition. */
async function buildWorld ({ mountRealm, dir, admission, durable, askPath, observation }) {
  const seams = await loadFsContractSeams(REPO_ROOT)
  const { Context, ToolRuntime, SystemPrompt, LocalFileSystem, createScope, bindScopeParent, nativeToolModules, row } = seams

  const inside = join(dir, 'inside')
  const outside = join(dir, 'outside')
  mkdirSync(inside, { recursive: true })
  mkdirSync(outside, { recursive: true })
  const insideFile = join(inside, 'doc.txt')
  const outsideFile = join(outside, 'secret.txt')
  writeFileSync(insideFile, 'alpha beta\n', 'utf8')
  writeFileSync(outsideFile, 'SECRET-NOT-FOR-MEMBER\n', 'utf8')

  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  // The composition's provider: what a member would resolve if nothing confined it.
  await root.plugin(LocalFileSystem, { cwd: dir, diffBasisMaxBytes: 10 * 1024 * 1024 })
  // The two states of the observation policy. The product default in A1/B is OFF, which in this
  // host means "the plugin is not mounted" - the policy has no config switch, so absence IS the
  // off state and the two arms differ by exactly this plugin.
  if (observation === 'on') await root.plugin(seams.observationPolicy)

  // The PRESET topology: the standing scope installs the host's tool module. This is the
  // definition the member would inherit — the thing the realm mount must replace, not rename.
  const standingKey = {}
  const standing = createScope(root, standingKey)
  await standing.ctx.plugin(nativeToolModules)

  const agentKey = {
    session: {
      header: { cwd: inside },
      requestHeader: () => ({ config: { provider: 'mock-provider', model: 'mock-model' } }),
    },
    options: {},
  }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  const presetRead = root.get('tools').get('read', agentKey)

  const fsInstances = []
  let realm
  if (mountRealm) {
    const InstrumentedFs = instrumentedFileSystemClass(LocalFileSystem, fsInstances)
    realm = await row.mountMemberA5sfRealm({
      root: agent.ctx,
      a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: join(dir, 'guard-consult.jsonl') }),
      provider: () => ({
        compiledFor: () => ({
          members: [{
            identity: IDENTITY,
            policy: {
              ok: true,
              value: Object.freeze({
                memberIdentity: IDENTITY.memberInstanceId,
                templateId: IDENTITY.templateId,
                instanceGeneration: IDENTITY.instanceGeneration,
                revision: 'rev-vnext-slice',
                read: lane([inside]),
                write: lane([inside]),
                network: Object.freeze({ access: 'allow' }),
              }),
            },
            config: { cwd: dir, diffBasisMaxBytes: 10 * 1024 * 1024 },
          }],
          providerClass: InstrumentedFs,
        }),
      }),
      member: {
        sessionId: 'session-vnext-slice',
        instanceId: IDENTITY.memberInstanceId,
        teamRootSessionId: 'team-root-vnext-slice',
        templateId: IDENTITY.templateId,
      },
    })
    assert.notEqual(realm, undefined, 'the configured row must mount a realm')
    const specs = hostNativeSpecs([{
      url: '@deepseek-ai/dsh-tool-fs',
      module: nativeToolModules,
      // `read_image` is deliberately NOT declared: the pinned tool-fs registers it from a
      // deferred child that injects `attachments`, which this minimal world does not mount, so
      // the name is an ABSENT OPTIONAL CAPABILITY (mount.ts settle rule) rather than a missing
      // mount. Declaring it here would ask the lane to prove something this world cannot provide.
      expectedTools: ['read', 'write', 'edit'],
    }])
    await mountHostModules({ realm, root: agent.ctx, scope: agentKey, specs })
  }

  // THE ADMISSION POINT, installed on the agent scope exactly as product wiring will install it.
  // `admission: 'bound'` resolves the member's binding; `admission: 'unbound'` models a controlled
  // call the centre has NOT been wired for, which must be refused rather than forwarded.
  let facts = []
  let executions = []
  let disposeAdmission
  let disposeExecutions
  // `durable` = the ledger path. When present every admission/execution record goes to disk and a
  // SECOND world built on the same path stands in for the resumed process.
  const ledger = durable === undefined ? undefined : openFactLedger({ path: durable })
  if (mountRealm && admission !== undefined) {
    const lanes = {
      read: { mode: 'restricted', allow: [inside], ask: askPath === undefined ? [] : [askPath], deny: [] },
      write: { mode: 'restricted', allow: [inside], ask: [], deny: [] },
    }
    const binding = {
      agentId: 'agent-vnext-slice',
      sessionId: 'session-vnext-slice',
      instanceGeneration: IDENTITY.instanceGeneration,
      read: lanes.read,
      write: lanes.write,
      definitionSource: '@deepseek-ai/dsh-tool-fs',
      policyGeneration: 'rev-vnext-slice',
      blueprintRevision: 'bp-vnext-slice',
      owner: 'team-root-vnext-slice',
    }
    disposeAdmission = installAdmissionPoint({
      ctx: agent.ctx,
      resolveBinding: () => (admission === 'bound' ? binding : undefined),
      record: (record) => {
        facts.push(record)
        if (ledger !== undefined) ledger.recordAdmission(record)
      },
      ...(ledger === undefined ? {} : { isReplay: (callId) => ledger.has(callId), recordReplay: (input) => ledger.recordReplayRefusal(input) }),
    })
    disposeExecutions = installExecutionFacts({
      ctx: agent.ctx,
      record: (fact) => {
        executions.push(fact)
        if (ledger !== undefined) ledger.recordExecution(fact)
      },
      admissionOf: (callId) => facts.find((entry) => entry.callId === callId),
    })
  }

  const dispatch = async (name, args, callId) => {
    const settled = await root.get('tools').execute({
      signal: new AbortController().signal,
      callId,
      name,
      arguments: args,
      agent: agentKey,
    })
    const text = Array.isArray(settled.content)
      ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
      : ''
    return { isError: settled.isError === true, text, errorMessage: settled.error?.message }
  }

  return {
    dir,
    ledger,
    schemas: () => root.get('tools').schemas(agentKey),
    definitionOf: (name) => root.get('tools').get(name, agentKey),
    facts: () => facts,
    executions: () => executions,
    inside,
    outside,
    insideFile,
    outsideFile,
    presetRead,
    resolvedRead: root.get('tools').get('read', agentKey),
    resolvedDefinitions: Object.fromEntries(['read', 'write', 'edit'].map((name) => [name, root.get('tools').get(name, agentKey)])),
    realm,
    fsInstances,
    dispatch,
    async dispose () {
      if (typeof disposeExecutions === 'function') disposeExecutions()
      if (typeof disposeAdmission === 'function') disposeAdmission()
      if (realm !== undefined) await realm.dispose()
      await root.dispose?.()
    },
  }
}

let dir
before(() => { dir = mkdtempSync(join(tmpdir(), 'vnext-fs-slice-')) })
after(() => { rmSync(dir, { recursive: true, force: true }) })

test('SLICE-1 — the member resolves the host module mounted on its own realm, by identity and by body', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'identity') })
  try {
    assert.notEqual(world.resolvedRead, undefined, 'the member must resolve `read`')
    assert.notEqual(world.resolvedRead, world.presetRead, 'the mount must CHANGE the definition the member resolves; an unchanged definition means the body would run on the inherited provider')
    // A module that builds a definition per apply() gives a different OBJECT per scope; the
    // BODY is what must be the host's. A Team wrapper would differ here even with the same name.
    assert.equal(
      String(world.resolvedRead.execute),
      String(world.presetRead.execute),
      'the mounted definition must be the host module\'s own body, not a Team-authored one',
    )
  } finally {
    await world.dispose()
  }
})

test('SLICE-2 — inside the ceiling the member read succeeds through its provider', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'inside') })
  try {
    assert.equal(statSync(world.insideFile).size, 11)
    const result = await world.dispatch('read', { file_path: world.insideFile }, 'slice-inside')
    assert.equal(result.isError, false, `an in-ceiling read must succeed: ${result.text}`)
    assert.match(result.text, /alpha beta/u)
    const member = world.realm.installation.members[0].fs
    assert.equal(member.calls.readText + member.calls.streamText, 1, 'exactly one read reached the member provider')
  } finally {
    await world.dispose()
  }
})

test('SLICE-3 — outside the ceiling the member read is refused by ITS provider, and the bytes never arrive', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'outside') })
  try {
    const result = await world.dispatch('read', { file_path: world.outsideFile }, 'slice-outside')
    assert.equal(result.isError, true, `an out-of-ceiling read must fail: ${result.text}`)
    assert.doesNotMatch(result.text, /SECRET-NOT-FOR-MEMBER/u, 'the refusal must not carry the file it refused to read')
    const member = world.realm.installation.members[0].fs
    assert.equal(member.calls.readText, 0, 'the member provider must not have completed a buffered read of an out-of-ceiling path')
    // The refusal must come from the MEMBER'S OWN LANE, and it must refuse before the underlying
    // filesystem is touched at all: a refusal that read the file and then withheld it would be a
    // disclosure bug wearing a passing test.
    assert.match(String(result.errorMessage), /outside every allow subtree/u, `the refusal must name the member lane, not a caller above it: ${String(result.errorMessage)}`)
    assert.equal(member.calls.stat + member.calls.lstat + member.calls.readText + member.calls.streamText, 0, 'the confined provider must refuse BEFORE the real filesystem is reached')
    assert.ok(world.fsInstances.length >= 1, 'the confined provider instance is the only provider the member reached')
  } finally {
    await world.dispose()
  }
})

test('SLICE-5 — write: inside the ceiling the member writes through its provider, and the bytes land', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'write-inside') })
  try {
    const target = join(world.inside, 'written.txt')
    const result = await world.dispatch('write', { file_path: target, content: 'WRITTEN-BY-MEMBER\n' }, 'slice-write-inside')
    assert.equal(result.isError, false, `an in-ceiling write must succeed: ${result.text} ${String(result.errorMessage)}`)
    assert.equal(readFileSync(target, 'utf8'), 'WRITTEN-BY-MEMBER\n', 'the write must reach the member\'s filesystem')
    const member = world.realm.installation.members[0].fs
    assert.equal(member.calls.writeText, 1, 'exactly one write reached the member provider')
  } finally {
    await world.dispose()
  }
})

test('SLICE-6 — write: outside the ceiling it is refused before the filesystem is touched', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'write-outside') })
  try {
    const target = join(world.outside, 'forbidden.txt')
    const result = await world.dispatch('write', { file_path: target, content: 'ESCAPED\n' }, 'slice-write-outside')
    assert.equal(result.isError, true, `an out-of-ceiling write must fail: ${result.text}`)
    assert.match(String(result.errorMessage), /outside every allow subtree/u)
    assert.equal(existsSync(target), false, 'the refused write must not have created the file')
    const member = world.realm.installation.members[0].fs
    assert.equal(member.calls.writeText + member.calls.editText, 0, 'the member provider must not have been asked to write')
  } finally {
    await world.dispose()
  }
})

test('SLICE-7 — the admission point allows an in-ceiling call and records exactly one allow fact', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'adm-allow'), admission: 'bound' })
  try {
    const result = await world.dispatch('read', { file_path: world.insideFile }, 'adm-allow')
    assert.equal(result.isError, false, `the bound in-ceiling read must succeed: ${result.text} ${String(result.errorMessage)}`)
    const facts = world.facts()
    assert.equal(facts.length, 1, 'one call, one fact')
    assert.equal(facts[0].callId, 'adm-allow')
    assert.equal(facts[0].decision, 'allow')
    assert.equal(facts[0].axis, 'fs.read')
    assert.equal(facts[0].locator, world.insideFile)
    assert.equal(facts[0].policyGeneration, 'rev-vnext-slice')
    assert.equal(facts[0].definitionSource, '@deepseek-ai/dsh-tool-fs')
  } finally {
    await world.dispose()
  }
})

test('SLICE-8 — the admission point refuses an out-of-ceiling call BEFORE the body, and records why', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'adm-deny'), admission: 'bound' })
  try {
    const member = world.realm.installation.members[0].fs
    const result = await world.dispatch('read', { file_path: world.outsideFile }, 'adm-deny')
    assert.equal(result.isError, true, `the guard must refuse: ${result.text}`)
    assert.match(String(result.errorMessage), /outside the binding's fs\.read lane/u, 'the refusal must name the lane the binding compiled, not a generic denial')
    assert.equal(member.calls.stat + member.calls.readText + member.calls.streamText, 0, 'a guard refusal must precede the body, so the provider is never reached')
    const facts = world.facts()
    assert.equal(facts.length, 1)
    assert.equal(facts[0].decision, 'deny')
    assert.equal(facts[0].refusalCode, 'LANE_DENY')
    assert.equal(facts[0].locator, world.outsideFile)
  } finally {
    await world.dispose()
  }
})

test('SLICE-9 — UNWIRED: with no binding the same in-ceiling call is refused, and it never reaches the provider', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'adm-unbound'), admission: 'unbound' })
  try {
    const member = world.realm.installation.members[0].fs
    const result = await world.dispatch('read', { file_path: world.insideFile }, 'adm-unbound')
    assert.equal(result.isError, true, `an unbound controlled call must be refused: ${result.text}`)
    assert.match(String(result.errorMessage), /ADMISSION_NO_BINDING/u)
    assert.equal(member.calls.readText + member.calls.streamText, 0, 'the refusal must come before any execution')
    const facts = world.facts()
    assert.equal(facts.length, 1)
    assert.equal(facts[0].refusalCode, 'ADMISSION_NO_BINDING')
    assert.equal(facts[0].agentId, '', 'the record must not invent an identity the binding did not supply')
  } finally {
    await world.dispose()
  }
})

test('SLICE-10 — one execution, one canonical fact, with provenance kept apart from outcome', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'exec-facts'), admission: 'bound' })
  try {
    const allowed = await world.dispatch('read', { file_path: world.insideFile }, 'exec-allow')
    assert.equal(allowed.isError, false, `the allowed read must succeed: ${allowed.text}`)
    const denied = await world.dispatch('read', { file_path: world.outsideFile }, 'exec-deny')
    assert.equal(denied.isError, true, 'the second read must be refused')
    const executions = world.executions()
    assert.equal(executions.length, 2, `two calls must produce two facts, got ${JSON.stringify(executions)}`)
    const byId = Object.fromEntries(executions.map((fact) => [fact.callId, fact]))
    assert.equal(byId['exec-allow'].outcome, 'completed')
    assert.equal(byId['exec-allow'].isError, false)
    assert.equal(byId['exec-deny'].outcome, 'admission-refusal', 'a governed refusal is NOT a tool failure; merging the two makes a refusal look like a broken tool')
    assert.equal(byId['exec-deny'].refusalCode, 'LANE_DENY')
    assert.equal(byId['exec-deny'].errorMessage, undefined, 'a refusal carries its code, not a body error')
  } finally {
    await world.dispose()
  }
})

test('SLICE-11 — a duplicate callId is a REFUSAL, not a merge (UTE-15)', async () => {
  // A fake observer context: this arm is about the fact ledger's own rule, so it needs no host.
  let listener
  const record = []
  const dispose = installExecutionFacts({ ctx: { on: (name, fn) => { if (name === 'tools/result') listener = fn; return () => { listener = undefined } } }, record: (fact) => record.push(fact) })
  assert.equal(typeof listener, 'function')
  const exec = { callId: 'dup-1', name: 'read', agent: { id: 'agent-1' }, turn: 1, step: 1 }
  listener(exec, { isError: false })
  assert.equal(record.length, 1)
  assert.throws(() => listener(exec, { isError: false }), (error) => error.code === 'EXECUTION_FACT_DUPLICATE', 'a second fact for one callId is a replay and must be refused')
  assert.equal(record.length, 1, 'the refused duplicate must not have been written')
  assert.throws(() => listener({ name: 'read' }, { isError: false }), (error) => error.code === 'CALL_ID_MISSING')
  dispose()
})

test('SLICE-12 — the ledger is durable: a SECOND world on the same file reads both decisions back', async () => {
  const ledgerPath = join(dir, 'durable', 'facts.jsonl')
  const first = await buildWorld({ mountRealm: true, dir: join(dir, 'durable-w1'), admission: 'bound', durable: ledgerPath })
  try {
    const allowed = await first.dispatch('read', { file_path: first.insideFile }, 'dur-allow')
    assert.equal(allowed.isError, false, `the allowed read must succeed: ${allowed.text}`)
    const denied = await first.dispatch('read', { file_path: first.outsideFile }, 'dur-deny')
    assert.equal(denied.isError, true)
  } finally {
    await first.dispose()
  }

  // A fresh ledger instance = the resumed process: nothing is carried in memory between them.
  const reopened = openFactLedger({ path: ledgerPath })
  const records = reopened.readAll()
  const admissions = records.filter((record) => record.kind === 'invocation-authority')
  const executions = records.filter((record) => record.kind === 'execution')
  assert.equal(admissions.length, 2, `two calls, two durable authority records: ${JSON.stringify(records)}`)
  assert.equal(executions.length, 2, 'two calls, two durable execution records')
  assert.equal(reopened.has('dur-allow'), true)
  assert.equal(reopened.has('dur-deny'), true, 'a REFUSED call is admitted-and-decided; it must be on disk too')
  const denial = admissions.find((record) => record.callId === 'dur-deny')
  assert.equal(denial.decision, 'deny')
  assert.equal(denial.refusalCode, 'LANE_DENY')
  assert.equal(executions.find((record) => record.callId === 'dur-deny').outcome, 'admission-refusal')
})

test('SLICE-13 — NO REPLAY: after a restart the same callId is refused, not re-judged', async () => {
  const ledgerPath = join(dir, 'replay', 'facts.jsonl')
  const first = await buildWorld({ mountRealm: true, dir: join(dir, 'replay-w1'), admission: 'bound', durable: ledgerPath })
  try {
    const allowed = await first.dispatch('read', { file_path: first.insideFile }, 'replay-1')
    assert.equal(allowed.isError, false, `the first call must succeed: ${allowed.text}`)
  } finally {
    await first.dispose()
  }
  const second = await buildWorld({ mountRealm: true, dir: join(dir, 'replay-w2'), admission: 'bound', durable: ledgerPath })
  try {
    const member = second.realm.installation.members[0].fs
    const replay = await second.dispatch('read', { file_path: second.insideFile }, 'replay-1')
    assert.equal(replay.isError, true, `a replay must be refused: ${replay.text}`)
    assert.match(String(replay.errorMessage), /ADMISSION_REPLAY/u)
    assert.equal(member.calls.readText + member.calls.streamText, 0, 'the replay refusal must precede any execution')
    const records = second.ledger.readAll()
    const replays = records.filter((record) => record.kind === 'replay-refusal')
    assert.equal(replays.length, 1, 'the replay attempt must itself be durable')
    assert.equal(replays[0].callId, 'replay-1')
    assert.equal(records.filter((record) => record.kind === 'invocation-authority').length, 1, 'the first decision must NOT be overwritten by the replay')
  } finally {
    await second.dispose()
  }
})

test('SLICE-14 — the ledger refuses to read its own corruption rather than guessing', async () => {
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const base = join(dir, 'ledger-rules')
  mkdirSync(base, { recursive: true })

  // A crash mid-append leaves a partial line. Treating it as absent would silently drop an
  // admission record; treating it as valid would mis-parse. It is refused by name.
  const truncated = join(base, 'truncated.jsonl')
  writeFileSync(truncated, '{"kind":"invocation-authority","callId":"t-1","decision":"allow"}\n{"kind":"invoc')
  assert.throws(() => openFactLedger({ path: truncated }).readAll(), (error) => error.code === 'LEDGER_TRUNCATED')

  // Two authority records for one callId: the file cannot arbitrate, so it refuses to.
  const dup = join(base, 'dup.jsonl')
  writeFileSync(dup, [
    JSON.stringify({ kind: 'invocation-authority', callId: 'd-1', decision: 'allow' }),
    JSON.stringify({ kind: 'invocation-authority', callId: 'd-1', decision: 'deny' }),
    '',
  ].join('\n'))
  assert.throws(() => openFactLedger({ path: dup }).readAll(), (error) => error.code === 'LEDGER_DUPLICATE_AUTHORITY')

  // An execution record for a callId the ledger never admitted is not writable: the two halves of
  // the record must join, and a join with nothing on the other side is a defect, not a new fact.
  const ledger = openFactLedger({ path: join(base, 'join.jsonl') })
  assert.throws(() => ledger.recordExecution({ callId: 'never-admitted', outcome: 'completed' }), (error) => error.code === 'LEDGER_EXECUTION_UNBOUND')
  ledger.recordAdmission({ callId: 'ok-1', decision: 'allow' })
  ledger.recordExecution({ callId: 'ok-1', outcome: 'completed' })
  assert.throws(() => ledger.recordAdmission({ callId: 'ok-1', decision: 'allow' }), (error) => error.code === 'LEDGER_REPLAY')
})

test('SLICE-15 — ONE native registration per name: the model-visible catalogue has no duplicate', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'catalog'), admission: 'bound' })
  try {
    const schemas = world.schemas()
    const names = schemas.map((schema) => schema.name)
    assert.deepEqual([...new Set(names)], names, `the model-visible catalogue must not contain a name twice: ${JSON.stringify(names)}`)
    for (const name of ['read', 'write', 'edit']) {
      assert.equal(names.filter((entry) => entry === name).length, 1, `exactly one ${name} must be visible to the agent`)
      // The one visible definition must be the member's own mounted one, not the preset's: a name
      // present once while dispatch resolves the inherited body would be the old defect wearing a
      // single entry.
      assert.equal(world.definitionOf(name), world.resolvedDefinitions[name], `${name} must dispatch to the member-mounted definition`)
    }
  } finally {
    await world.dispose()
  }
})

test('SLICE-16 — an ASK is refused as ADMISSION_ASK_UNWIRED, never executed and never silently allowed', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'ask'), admission: 'bound', askPath: join(dir, 'ask', 'asked') })
  try {
    const member = world.realm.installation.members[0].fs
    const askedFile = join(dir, 'ask', 'asked', 'report.txt')
    mkdirSync(join(dir, 'ask', 'asked'), { recursive: true })
    writeFileSync(askedFile, 'asked\n')
    const result = await world.dispatch('read', { file_path: askedFile }, 'ask-1')
    assert.equal(result.isError, true, `an ask must not run until Control can adjudicate it: ${result.text}`)
    assert.match(String(result.errorMessage), /ADMISSION_ASK_UNWIRED/u)
    assert.equal(member.calls.readText + member.calls.streamText, 0, 'an unadjudicated ask must not reach the provider')
    const facts = world.facts()
    assert.equal(facts.length, 1)
    assert.equal(facts[0].decision, 'ask', 'the record must say ask, not deny: the difference is who refused')
    assert.match(String(facts[0].reason), /requires approval/u)
  } finally {
    await world.dispose()
  }
})

test('SLICE-17 — observation policy OFF: an overwrite needs no prior read (the product default)', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'obs-off') })
  try {
    const overwrite = await world.dispatch('write', { file_path: world.insideFile, content: 'rewritten without reading\n' }, 'obs-off-1')
    assert.equal(overwrite.isError, false, `with the policy absent an overwrite is unconditional: ${overwrite.text}`)
    assert.equal(readFileSync(world.insideFile, 'utf8'), 'rewritten without reading\n')
  } finally {
    await world.dispose()
  }
})

test('SLICE-18 — observation policy ON: the same overwrite is refused until the file was observed', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'obs-on'), observation: 'on' })
  try {
    const unobserved = await world.dispatch('write', { file_path: world.insideFile, content: 'blind overwrite\n' }, 'obs-on-1')
    assert.equal(unobserved.isError, true, `an unobserved overwrite must be refused: ${unobserved.text}`)
    assert.match(String(unobserved.errorMessage), /has not been read/u, 'the refusal must be the observation policy\'s own no-clobber rule, not an unrelated failure')
    assert.equal(readFileSync(world.insideFile, 'utf8'), 'alpha beta\n', 'a refused overwrite must not change the file')

    const observed = await world.dispatch('read', { file_path: world.insideFile }, 'obs-on-2')
    assert.equal(observed.isError, false, `the observation read must succeed: ${observed.text} ${String(observed.errorMessage)}`)
    const afterRead = await world.dispatch('write', { file_path: world.insideFile, content: 'observed overwrite\n' }, 'obs-on-3')
    assert.equal(afterRead.isError, false, `after the observation the same write must land: ${afterRead.text} ${String(afterRead.errorMessage)}`)
    assert.equal(readFileSync(world.insideFile, 'utf8'), 'observed overwrite\n')
  } finally {
    await world.dispose()
  }
})

test('SLICE-19 — observation policy ON: a version that moved under the member is refused, not clobbered', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'obs-stale'), observation: 'on' })
  try {
    const observed = await world.dispatch('read', { file_path: world.insideFile }, 'obs-stale-1')
    assert.equal(observed.isError, false, `the observation must succeed: ${observed.text} ${String(observed.errorMessage)}`)
    // The change the member cannot see: another writer between the read and the write.
    writeFileSync(world.insideFile, 'changed by someone else\n', 'utf8')
    const stale = await world.dispatch('write', { file_path: world.insideFile, content: 'member overwrite\n' }, 'obs-stale-2')
    assert.equal(stale.isError, true, `a stale version must be refused: ${stale.text}`)
    assert.match(String(stale.errorMessage), /changed since|not been read|version/iu, 'the refusal must be about freshness, not about the lane')
    assert.equal(readFileSync(world.insideFile, 'utf8'), 'changed by someone else\n', 'the other writer\'s bytes must survive')
  } finally {
    await world.dispose()
  }
})

test('SLICE-4 — NEGATIVE CONTROL: without the realm mount the same outside read SUCCEEDS', async () => {
  const world = await buildWorld({ mountRealm: false, dir: join(dir, 'control') })
  try {
    assert.equal(world.resolvedRead, world.presetRead, 'with no mount the member resolves the preset definition')
    const result = await world.dispatch('read', { file_path: world.outsideFile }, 'control-outside')
    assert.equal(result.isError, false, `the control must be able to read what SLICE-3 refuses, or SLICE-3 proves nothing: ${result.text}`)
    assert.match(result.text, /SECRET-NOT-FOR-MEMBER/u)
  } finally {
    await world.dispose()
  }
})
