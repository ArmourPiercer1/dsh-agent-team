/**
 * world.mjs — the governed MOUNT for one corpus vector.
 *
 * Each vector gets its own mount of the OLD PATH this lane baselines: the
 * governed family body, built through the family descriptor's public
 * `build(cap)` seam with the plane's own capability keys (`decide`, `pa`,
 * `logBackend`, `policy`), an injected UI interaction port or an injected
 * durable agent-state store, and NOTHING else. No plane, no boot, no port, no
 * DSH_HOME.
 *
 * The mount is deliberately NOT wrapped in a helper that could quietly widen
 * it: the vector table names the lane verdict, the PA verdict, the port face
 * and the execution-origin arm, and this module wires exactly those.
 *
 * Effects are corroborated from a source the row does not own:
 *   - UI: the port's recorded requests (a delivery logged by the harness) plus
 *     an independent `stat` of every anchored path;
 *   - agent-state: the durable store's OWN record (`stateOf`) and its write
 *     ledger, read back after the call.
 *
 * @module tests/ute-g1-uistate/lib/world
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { REPO_ROOT } from './paths.mjs'

const sha = (text) => createHash('sha256').update(text).digest('hex')

/** The plane's closed presentation face (team-tool-plane.mjs:146-152). */
export const PRESENTATION_FACE = Object.freeze({
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: { text: { type: 'string', required: true } },
  },
})

/** Corpus fixture facts, materialized once per capture. */
export const FIXTURE = Object.freeze({
  report: 'inside/report.md',
  second: 'inside/second.md',
  absent: 'inside/absent.md',
  oversized: 'inside/oversized.md',
  directory: 'inside/folder',
  outside: 'outside/secret.md',
  largeBytes: 1024 * 1024 + 1,
})

const fixtures = new Map()

/**
 * Materialize (once) the world fixture tree and return its absolute root.
 * The tree is created under `.artifacts/` (gitignored) and removed by
 * `disposeFixtures()`; every path the corpus names is a fixture fact, never a
 * host fact.
 */
export function fixtureRoot() {
  if (fixtures.has('root')) return fixtures.get('root')
  const base = mkdtempSync(join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-uistate-fixture-'))
  const root = join(base, 'world')
  mkdirSync(join(root, 'inside', 'folder'), { recursive: true })
  // The out-of-lane tree is a SIBLING of the governed root: an absolute path
  // there is genuinely outside every allow subtree, not a lexical trick.
  mkdirSync(join(base, 'outside'), { recursive: true })
  writeFileSync(join(root, FIXTURE.report), '# quarterly report\n')
  writeFileSync(join(root, FIXTURE.second), '# appendix\n')
  writeFileSync(join(base, FIXTURE.outside), '# out of lane secret\n')
  writeFileSync(join(root, FIXTURE.oversized), 'x'.repeat(FIXTURE.largeBytes))
  fixtures.set('root', root)
  return root
}

/** The absolute out-of-lane fixture path (a sibling of the governed root). */
export function outsidePath() {
  return join(dirname(fixtureRoot()), FIXTURE.outside)
}

/** Remove the fixture tree (called by the capture after the last vector). */
export function disposeFixtures() {
  const root = fixtures.get('root')
  fixtures.delete('root')
  if (root !== undefined) rmSync(root, { recursive: true, force: true })
}

/** Path redaction: absolute fixture/store roots become world tokens. */
export function normalizer(rootDir) {
  const storeRoot = join(rootDir, 'state')
  const base = dirname(rootDir)
  return (text) => String(text)
    .split(storeRoot).join('<state>')
    .split(rootDir).join('<world>')
    .split(base).join('<fixture>')
    .split(REPO_ROOT).join('<repo>')
    .replace(/goal-\d{4}-\d{2}-\d{2}T[\d:.]+Z-(\d+)/g, 'goal-<minted>-$1')
    .replace(/plane-agent-state:[0-9a-f-]{36}:/g, 'plane-agent-state:<nonce>:')
    .replace(/plane-ask:[0-9a-f-]{36}-/g, 'plane-ask:<nonce>-')
    .replace(/plan-ask:[0-9a-f-]{36}-/g, 'plan-ask:<nonce>-')
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\b/g, '<iso>')
}

/** A digest of a normalized JSON value. */
export function digest(value) {
  return sha(JSON.stringify(value)).slice(0, 12)
}

/** The fixture-relative form of an absolute world path. */
function worldPath(rootDir, absolute) {
  const root = String(rootDir)
  return String(absolute).startsWith(`${root}/`) ? String(absolute).slice(root.length + 1) : String(absolute)
}

/* ────────────────────────────── UI arm ───────────────────────────────── */

/**
 * The interaction port the vector injects. `calls` is the harness's own
 * record: it is written by the port, never by the row, so a row that claims an
 * effect it did not perform is visible.
 */
function buildPort(vector, normalise) {
  const calls = []
  const answer = vector.portAnswer ?? []
  const port = {
    calls,
    async ask(request) {
      calls.push({ face: 'ask', request })
      if (vector.port === 'throw') throw new Error('caller is not live')
      if (vector.port === 'abort') throw new Error('aborted by the caller')
      return { answers: answer }
    },
    async askTimed(request, callId, timeoutMs) {
      calls.push({ face: 'askTimed', request, timeoutMs })
      if (vector.port === 'pending') return { pending: true, callId, answers: answer }
      return { answers: answer }
    },
    async present(request) {
      calls.push({ face: 'present', request })
      if (vector.port === 'throw') throw new Error('the presentation face is unavailable')
      if (vector.port === 'abort') throw new Error('aborted by the caller')
      if (vector.port === 'no-turn') return { files: request.files }
      return { turn: 7, files: request.files }
    },
  }
  return port
}

const decideOf = (vector) => (vector.decide === 'deny'
  ? () => ({ kind: 'deny', code: 'template-deny-lane' })
  : () => ({ kind: 'allow' }))

/**
 * The PA edge the vector injects. `calls` counts admissions, which is how the
 * corpus claims "zero PA consumption" for pre-edge refusals.
 */
function buildPa(vector) {
  const calls = []
  return {
    calls,
    pa: async (call) => {
      calls.push({ callId: call.callId, fingerprint: call.fingerprint ?? call.parametersFingerprint })
      if (vector.pa === 'deny') return { kind: 'deny', code: 'ADMISSION_DENIED', detail: 'the admission edge denied this call' }
      if (vector.pa === 'cancelled') return { kind: 'allow', cancelled: true }
      return { kind: 'allow' }
    },
  }
}

const policyOf = (vector) => Object.freeze({
  default: vector.policy === 'default-deny' ? 'deny' : 'allow',
  rules: Object.freeze([]),
})

/**
 * Run one UI vector through the governed body.
 * @returns {Promise<{record: object, notes: string[]}>}
 */
async function runUiVector(vector, rootDir) {
  // A negative control may widen the governed root to the fixture BASE; that is
  // how the out-of-lane fixture becomes in-lane and the anchor guard is shown
  // to be load-bearing.
  const governedRoot = vector.rootDir === 'base' ? dirname(rootDir) : rootDir
  const normalise = normalizer(governedRoot)
  const port = buildPort(vector, normalise)
  const { calls: paCalls, pa } = buildPa(vector)
  const decide = decideOf(vector)
  const uiFamily = (await import(pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'families', 'ui.mjs')).href)).familyAssembly
  const built = uiFamily.build({
    realmId: 'realm-ute3-uistate',
    planeConfig: { uiFamilyEnabled: true, uiTimedQuestions: vector.timed === true },
    permissionPolicy: policyOf(vector),
    decide,
    pa,
    logBackend: () => () => {},
    fsInstance: { rootDir: governedRoot },
    injected: vector.port === 'absent' ? {} : { uiInteraction: port },
  })
  const definition = built.definitions.find((candidate) => candidate.name === vector.member)
  if (definition === undefined) throw new Error(`the ui mount registered no ${vector.member} row (definitions: ${built.definitions.map((d) => d.name).join(',')})`)
  const signal = vector.port === 'abort' ? AbortSignal.abort(new Error('caller cancelled')) : new AbortController().signal
  // A vector may address a fixture OUTSIDE the governed root; the corpus names
  // it symbolically so the table carries no host path.
  const args = vector.fixturePath === undefined
    ? vector.args
    : JSON.parse(JSON.stringify(vector.args).split('<outside>').join(outsidePath()))
  const outcome = await settle(() => definition.execute(args, {
    token: vector.token ?? { id: `${vector.id}-token` },
    ...(signal === undefined ? {} : { signal }),
    ...(vector.agent === null ? {} : { agent: { id: vector.agent ?? 'agent-ute3-a' } }),
  }))
  const effects = uiEffects(vector, governedRoot, port, outcome, normalise)
  return {
    record: {
      ...envelope(outcome),
      effects,
      facts: {
        portCalls: port.calls.length,
        paCalls: paCalls.length,
      },
    },
    // The refusal sentence is evidence, so it is recorded NORMALIZED: the
    // disposable fixture root must never leak into a committed transcript.
    notes: outcome.kind === 'refused' ? [normalise(outcome.text)] : [],
  }
}

/** Independent corroboration for a UI call: the port's own log + a fresh stat. */
function uiEffects(vector, rootDir, port, outcome, normalise) {
  const parts = []
  const published = port.calls.filter((call) => call.face === 'present')
  for (const call of published) {
    for (const file of call.request.files ?? []) {
      const target = typeof file.path === 'string' ? file.path : ''
      const rel = worldPath(rootDir, target)
      let fact = 'absent'
      try {
        const info = statSync(target)
        fact = `${info.isFile() ? 'file' : 'other'}:${String(info.size)}`
      } catch { /* the fixture decides; an absent target is a fact */ }
      parts.push(`@published:${rel}:${fact}`)
    }
  }
  const asked = port.calls.filter((call) => call.face !== 'present')
  for (const call of asked) parts.push(`@ask:${digest(JSON.parse(normalise(JSON.stringify(call.request))))}:${call.face}`)
  if (outcome.kind === 'ok') parts.push(`@result:${digest(JSON.parse(normalise(JSON.stringify(outcome.value))))}`)
  else if (outcome.kind === 'cancelled') parts.push('@result:cancelled')
  else parts.push(`@refused:${outcome.code}`)
  // The refused-class is part of the observation (admission vs io vs schema).
  if (outcome.kind === 'refused') parts.push(`@class:${outcome.refusalClass}`)
  if (outcome.kind === 'refused' && outcome.sideEffectPossible === true) parts.push('@side-effect-possible')
  return parts.join(';')
}

/* ───────────────────────── agent-state arm ───────────────────────────── */

const SEED_GOAL = Object.freeze({
  goalId: 'goal-seed-1',
  objective: 'Ship the seeded objective',
  phase: 'active',
  revision: 1,
  roundsStarted: 1,
  maxGoalRounds: 5,
  armed: true,
})

/**
 * Run one agent-state vector through the governed body and its durable store.
 * @returns {Promise<{record: object, notes: string[]}>}
 */
async function runStateVector(vector, rootDir) {
  const normalise = normalizer(rootDir)
  const { calls: paCalls, pa } = buildPa(vector)
  const decide = decideOf(vector)
  const storeRoot = join(rootDir, 'state', vector.id)
  mkdirSync(storeRoot, { recursive: true })
  const family = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'agent-state-family', 'src', 'index.mjs')).href)
  const tasks = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'families', 'agent-state.mjs')).href)
  const agentId = vector.agent === null ? null : (vector.agent ?? 'agent-ute3-a')
  const scope = agentId === null ? null : `agent:${agentId}`
  // The execution-origin arm is a MOUNT fact in production (the store's
  // armProvider); the vector names it, the harness resolves it.
  const seed = { ...SEED_GOAL, ...(vector.seedGoal ?? {}) }
  const arm = vector.arm === undefined ? 'direct-human' : vector.arm
  const armProvider = () => (arm === 'goal-round'
    ? { kind: 'goal-round', goalId: seed.goalId, revision: seed.revision, round: seed.roundsStarted }
    : { kind: arm })
  const durableStore = family.createFsStateStore({
    rootDir: storeRoot,
    anchorDir: rootDir,
    realmId: 'realm-ute3-uistate',
    armProvider,
  })
  // A negative control faults the ONE write method the vector exercises; the
  // row must answer AGENT_STATE_STORE_FAULT, which is how the store witness is
  // shown to be load-bearing rather than decorative.
  const store = vector.storeFault === true ? faultedStore(durableStore) : durableStore
  // Durable preconditions are PLANTED through the store's own scenario seam
  // (seedGoal / seedPlanMode) so they are real state, not a mocked read.
  if (vector.seedGoal !== undefined && scope !== null) await store.seedGoal(scope, seed)
  if (vector.seedGoalCrossScope === true) await store.seedGoal('agent:agent-ute3-other', seed)
  if (vector.seedPlanMode === true && scope !== null) await store.seedPlanMode(scope, true)
  const built = tasks.familyAssembly.build({
    realmId: 'realm-ute3-uistate',
    planeConfig: { agentStateEnabled: true },
    permissionPolicy: policyOf(vector),
    decide,
    pa,
    logBackend: () => () => {},
    presentationFace: PRESENTATION_FACE,
    injected: { agentState: store },
    hostService: () => undefined,
  })
  if (built?.refused !== undefined) throw new Error(`the agent-state mount refused: ${built.refused.code}: ${built.refused.message}`)
  const definition = built.definitions.find((candidate) => candidate.name === vector.member)
  if (definition === undefined) throw new Error(`the agent-state mount registered no ${vector.member} row`)
  const outcome = await settle(() => definition.execute(vector.args, {
    token: vector.token ?? { id: `${vector.id}-token` },
    ...(agentId === null ? {} : { agent: { id: agentId } }),
  }))
  const record = scope === null ? null : await store.stateOf(scope)
  const durable = record === null || record === undefined
    ? { goal: null, todos: null, planMode: null }
    : { goal: record.goal ?? null, todos: record.todos ?? null, planMode: record.planMode ?? null }
  const effects = stateEffects(durable, store, normalise, scope)
  return {
    record: {
      ...envelope(outcome),
      effects,
      facts: {
        paCalls: paCalls.length,
        durableWrites: store.log.writes.length,
        storeAttempts: store.log.attempts.length,
        storeReads: store.log.reads.length,
      },
    },
    // The refusal sentence is evidence, so it is recorded NORMALIZED: the
    // disposable fixture root must never leak into a committed transcript.
    notes: outcome.kind === 'refused' ? [normalise(outcome.text)] : [],
  }
}

/** Wrap a store so its mutation legs throw (the fault-injection control). */
function faultedStore(store) {
  const fault = () => { throw new Error('injected store fault') }
  return {
    ...store,
    name: store.name,
    log: store.log,
    stateOf: store.stateOf,
    armFor: store.armFor,
    readGoal: store.readGoal,
    readTodos: store.readTodos,
    readPlanMode: store.readPlanMode,
    applyGoal: fault,
    applyTodos: fault,
    applyPlanModeExit: fault,
  }
}

/** Independent corroboration: the durable record + the store's write ledger. */
function stateEffects(durable, store, normalise, scope) {
  const parts = []
  const record = normalise(JSON.stringify(durable))
  parts.push(`@record:${digest(JSON.parse(record))}`)
  for (const write of store.log.writes) {
    parts.push(`@write:${normalise(write.op)}:${normalise(write.key)}:${normalise(write.applyId)}`)
  }
  for (const attempt of store.log.attempts) {
    parts.push(`@attempt:${attempt.op}:${attempt.outcome}:${attempt.code ?? '-'}`)
  }
  parts.push(`@ledger:reads=${String(store.log.reads.length)},writes=${String(store.log.writes.length)},attempts=${String(store.log.attempts.length)}`)
  parts.push(`@scope:${scope === null ? '-' : 'agent'}`)
  return parts.join(';')
}

/* ───────────────────────────── envelope ──────────────────────────────── */

/**
 * Call one row and normalize its outcome. UI rows THROW their typed refusal;
 * agent-state rows RETURN a `{text}` envelope whose refusal is a stable
 * `refused: <CODE> — …` line. Both shapes are the shipped ones; the envelope
 * keeps that difference visible rather than flattening it.
 */
async function settle(call) {
  try {
    const value = await call()
    if (value !== null && typeof value === 'object' && value.cancelled === true) return { kind: 'cancelled', value }
    if (value !== null && typeof value === 'object' && typeof value.text === 'string' && /^refused: /.test(value.text)) {
      const code = value.text.slice('refused: '.length).split(' — ')[0]
      return { kind: 'refused', code, refusalClass: 'envelope', text: value.text }
    }
    return { kind: 'ok', value }
  } catch (error) {
    const text = String(error?.message ?? error)
    const match = /^refused-(\w+) ([A-Za-z0-9_:-]+) — /.exec(text)
    if (match !== null) return { kind: 'refused', refusalClass: match[1], code: match[2], text }
    return { kind: 'threw', refusalClass: 'unclassified', code: 'UNCLASSIFIED_THROW', text }
  }
}

/** Map an outcome onto the recorded envelope (outcome + typed code). */
function envelope(outcome) {
  if (outcome.kind === 'ok') return { outcome: 'allow', code: '-', cancelled: false }
  if (outcome.kind === 'cancelled') return { outcome: 'cancelled', code: 'CANCELLED', cancelled: true }
  return { outcome: 'deny', code: outcome.code, cancelled: false }
}

/* ─────────────────────────────── entry ──────────────────────────────── */

/**
 * Run one corpus vector.
 * @param {object} vector
 * @returns {Promise<object>} the recorded row (pre-classification).
 */
export async function runVector(vector) {
  const rootDir = fixtureRoot()
  const { record, notes } = vector.family === 'ui'
    ? await runUiVector(vector, rootDir)
    : await runStateVector(vector, rootDir)
  return { id: vector.id, entry: vector.member, ...record, notes }
}
