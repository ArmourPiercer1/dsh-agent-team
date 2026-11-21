/**
 * scenario.mjs — one execution of one corpus vector against the old path.
 *
 * The harness only creates the fixture, dispatches the vector's steps through
 * the path's own `dispatch` and serializes the witnesses. It decides no lane,
 * no policy and no refusal.
 *
 * @module tests/ute-g1-process/lib/scenario
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

import {
  classifyProcessRefusal,
  effectsCell,
  normalizeText,
  parseProcessRecord,
  processEffects,
  sha256Of,
  snapshotTree,
} from './effect-oracle.mjs'
import { CORPUS, PROCESS_DSH_ENV, PROCESS_SECRET, PROCESS_SECRET_ENV } from './corpus.mjs'
import { REPO_ROOT, mountRouteCWorld } from './world.mjs'

/** The reviewed TSV fixture's columns, in order. */
export const ROW_HEADER = Object.freeze(['id', 'entry', 'lane_read', 'lane_write', 'outcome', 'refusal', 'codes', 'effects', 'facts', 'leaks'])

/** Resolve a world-relative token to an absolute host path. */
export function worldPath(root, token) {
  return join(root, ...token.split('/'))
}

/** Create the world directories every vector may address. */
export function makeWorldDirs(root) {
  for (const rel of ['inside', 'inside/bound', 'outside']) {
    mkdirSync(join(root, ...rel.split('/')), { recursive: true })
  }
}

/**
 * Apply the vector's fixture pre-state with plain node fs (NOT the provider):
 * this is the world before the invocation, not an effect under test.
 */
export function applySetup(root, setup) {
  for (const op of setup) {
    const absolute = worldPath(root, op.path)
    if (op.op === 'writeFile') {
      mkdirSync(dirname(absolute), { recursive: true })
      if (op.base64 !== undefined) writeFileSync(absolute, Buffer.from(op.base64, 'base64'))
      else writeFileSync(absolute, op.content, 'utf8')
    } else if (op.op === 'mkdir') {
      mkdirSync(absolute, { recursive: true })
    } else {
      throw new Error(`unknown setup op '${op.op}'`)
    }
  }
}

/** Materialize a step's `workdir` token into an absolute path. */
export function materializeArgs(root, args) {
  const out = {}
  for (const [key, value] of Object.entries(args)) {
    out[key] = key === 'workdir' && typeof value === 'string' && !value.startsWith('/') ? worldPath(root, value) : value
  }
  return out
}

/** Apply a negative control's argument patch AFTER materialization. */
function patched(args, patch) {
  return patch === undefined ? args : { ...args, ...patch }
}

/** An already-aborted signal (the corpus's cancellation arm). */
function abortedSignal() {
  const controller = new AbortController()
  controller.abort()
  return controller.signal
}

/**
 * The ambient environment names the scrub vector plants. They exist ONLY for
 * the duration of one dispatch: the ambient parent environment is the input,
 * so the vector is about the FACE's scrub, not about this process's config.
 */
const PLANTED_ENV = Object.freeze({
  [PROCESS_SECRET_ENV]: PROCESS_SECRET,
  [PROCESS_DSH_ENV]: `${PROCESS_SECRET}_DSH`,
})

/** Make the message locale deterministic for the two OS-denial vectors. */
function withPlantedEnvironment(body) {
  const saved = new Map()
  const planted = { ...PLANTED_ENV, LC_ALL: 'C', LANGUAGE: '' }
  for (const [key, value] of Object.entries(planted)) {
    saved.set(key, process.env[key])
    process.env[key] = value
  }
  try {
    return body()
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

/**
 * Run one vector's steps through the path's dispatch.
 * @param {object} input
 * @param {string} input.root
 * @param {readonly object[]} input.steps
 * @param {(name: string, args: object, options?: {signal?: AbortSignal}) => Promise<object>} input.dispatch
 * @returns {Promise<{outcome: 'allow'|'deny', text: string, value: object|undefined}>}
 */
export async function runSteps({ root, steps, dispatch }) {
  const texts = []
  let value
  let outcome = 'allow'
  for (const step of steps) {
    const options = step.abort === true ? { signal: abortedSignal() } : undefined
    const settled = await dispatch(step.tool, materializeArgs(root, step.args), options)
    texts.push(settled.text ?? '')
    value = settled.value
    outcome = settled.isError === true ? 'deny' : 'allow'
  }
  return { outcome, text: texts.join('\n'), value }
}

/**
 * Build one normalized record: the tuple the fixture stores and the harness
 * grades. Every effect comes from a witness (the child's record + the tree +
 * the guard facts).
 */
export function makeRecord({ vector, root, outcome, text, facts, providerCalls, baseCalls, treeBefore, code }) {
  const record = outcome === 'allow' ? parseProcessRecord(text) : null
  const stdout = record === null ? '' : normalizeText(record.stdout, root)
  const stderr = record === null ? '' : normalizeText(record.stderr, root)
  const treeAfter = snapshotTree(root)
  const refusal = outcome === 'deny'
    ? classifyProcessRefusal({ text, code, facts }).value
    : null
  const denialCategory = outcome === 'deny'
    ? classifyProcessRefusal({ text, code, facts }).category
    : null
  return {
    id: vector.id,
    entry: vector.entry,
    laneRead: vector.lane.read.join(','),
    laneWrite: vector.lane.write.join(','),
    outcome,
    refusal: outcome === 'deny' ? denialCategory : null,
    codes: code === undefined || code === null ? '-' : String(code),
    effects: processEffects({ record, stdout, stderr, treeBefore, treeAfter }),
    facts: {
      confined: providerCalls,
      allowFacts: facts.filter((fact) => fact?.decision === 'allow').length,
      denyFacts: facts.filter((fact) => String(fact?.decision ?? '') !== 'allow').length,
      baseCalls,
    },
    // The haystack is the WHOLE model-facing text, not just the parsed channels:
    // an inherited (un-shadowed) definition answers prose, and a leak there is
    // exactly what the confinement-witness control must be able to see.
    leaks: [PROCESS_SECRET].filter((token) => `${normalizeText(text, root)}\n${stdout}\n${stderr}`.includes(token)),
    // The claim-check witnesses (not part of the graded TSV cell).
    observed: { record, stdout, stderr, treeBefore, treeAfter, text: normalizeText(text, root) },
  }
}

/** Serialize one record as its TSV row. */
export function recordToRow(record) {
  return [
    record.id,
    record.entry,
    record.laneRead,
    record.laneWrite,
    record.outcome,
    record.refusal ?? '-',
    record.codes ?? '-',
    effectsCell(record.effects),
    `confined=${record.facts.confined},allow=${record.facts.allowFacts},deny=${record.facts.denyFacts},base=${record.facts.baseCalls}`,
    (record.leaks ?? []).join(',') || '-',
  ].join('\t')
}

/** Parse one TSV row back into the record shape the comparator grades. */
export function rowToRecord(line) {
  const cells = line.split('\t')
  const byName = new Map(ROW_HEADER.map((name, index) => [name, cells[index]]))
  const effects = (byName.get('effects') ?? '-') === '-' ? [] : byName.get('effects').split(';').map((entry) => {
    const [path, present, bytes, sha256, mode] = entry.split('|')
    return {
      path,
      exists: present === 'present',
      bytes: bytes === '-' ? null : Number(bytes),
      sha256: sha256 === '-' ? null : sha256,
      mode: mode === '-' ? null : mode,
    }
  })
  const facts = {}
  for (const part of (byName.get('facts') ?? '').split(',')) {
    const index = part.indexOf('=')
    if (index > 0) facts[part.slice(0, index)] = Number(part.slice(index + 1))
  }
  return {
    id: byName.get('id'),
    entry: byName.get('entry'),
    laneRead: byName.get('lane_read'),
    laneWrite: byName.get('lane_write'),
    outcome: byName.get('outcome'),
    refusal: byName.get('refusal') === '-' ? null : byName.get('refusal'),
    codes: byName.get('codes'),
    effects,
    facts: { confined: facts.confined ?? 0, allowFacts: facts.allow ?? 0, denyFacts: facts.deny ?? 0, baseCalls: facts.base ?? 0 },
    leaks: (byName.get('leaks') ?? '-') === '-' ? [] : byName.get('leaks').split(','),
  }
}

/**
 * Check one captured record against its corpus DESIGN CLAIM.
 * @returns {string[]} problems (empty = the claim holds)
 */
export function checkClaim(record, vector) {
  const problems = []
  const expect = vector.expect
  const observed = record.observed
  const where = vector.id
  if (record.outcome !== expect.outcome) problems.push(`${where}: outcome=${record.outcome}, claim=${expect.outcome}`)
  if (expect.outcome === 'deny') {
    if (record.refusal !== expect.refusal) problems.push(`${where}: refusal=${JSON.stringify(record.refusal)}, claim=${JSON.stringify(expect.refusal)}`)
    if (expect.noSpawn === true && record.facts.confined !== 0) problems.push(`${where}: the refusal spawned ${String(record.facts.confined)} confined process(es), claim=0`)
  }
  if (expect.outcome === 'allow') {
    const child = observed.record
    if (child === null) problems.push(`${where}: the allow arm answered no parseable confined record`)
    else {
      if (expect.exit !== undefined && child.exitCode !== expect.exit) problems.push(`${where}: exitCode=${JSON.stringify(child.exitCode)}, claim=${JSON.stringify(expect.exit)}`)
      if (expect.timedOut !== undefined && child.timedOut !== expect.timedOut) problems.push(`${where}: timedOut=${String(child.timedOut)}, claim=${String(expect.timedOut)}`)
      if (expect.stdout !== undefined && observed.stdout !== expect.stdout) problems.push(`${where}: stdout=${JSON.stringify(observed.stdout.slice(0, 160))}, claim=${JSON.stringify(expect.stdout.slice(0, 160))}`)
      if (expect.stderr !== undefined && observed.stderr !== expect.stderr) problems.push(`${where}: stderr=${JSON.stringify(observed.stderr.slice(0, 160))}, claim=${JSON.stringify(expect.stderr.slice(0, 160))}`)
      if (expect.stdoutBytes !== undefined && Buffer.byteLength(observed.stdout) !== expect.stdoutBytes) {
        problems.push(`${where}: stdout is ${String(Buffer.byteLength(observed.stdout))} bytes, claim=${String(expect.stdoutBytes)}`)
      }
      if (expect.stdoutEndsWith !== undefined && !observed.stdout.endsWith(expect.stdoutEndsWith)) {
        problems.push(`${where}: stdout does not end with ${JSON.stringify(expect.stdoutEndsWith)} (the tail was not the retained window)`)
      }
      if (expect.stderrContains !== undefined && !observed.stderr.toLowerCase().includes(expect.stderrContains.toLowerCase())) {
        problems.push(`${where}: stderr does not contain ${JSON.stringify(expect.stderrContains)}: ${JSON.stringify(observed.stderr.slice(0, 160))}`)
      }
    }
  }
  if (expect.fsUnchanged === true && observed.treeBefore.digest !== observed.treeAfter.digest) {
    problems.push(`${where}: the fixture tree CHANGED (${observed.treeBefore.digest.slice(0, 12)} -> ${observed.treeAfter.digest.slice(0, 12)})`)
  }
  if ((record.leaks ?? []).length > 0) problems.push(`${where}: the secret token reached the model-facing text`)
  return problems
}

/**
 * Capture one vector: fresh fixture, planted environment, product route-C
 * world, the vector's steps, and the witnesses.
 * @param {object} vector
 * @param {object} [overrides] - negative-control only (see lib/world).
 * @returns {Promise<object>}
 */
export async function captureVector(vector, overrides = {}) {
  const fixtureRoot = join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-process', `w-${vector.id}-${Math.random().toString(36).slice(2, 8)}`)
  mkdirSync(fixtureRoot, { recursive: true })
  const readRoots = vector.lane.read.map((token) => worldPath(fixtureRoot, token))
  const writeRoots = vector.lane.write.map((token) => worldPath(fixtureRoot, token))
  const laneExtraRoots = (overrides.laneExtraTokens ?? []).map((token) => worldPath(fixtureRoot, token))
  const worldOverrides = { ...overrides, laneExtraRoots }
  try {
    makeWorldDirs(fixtureRoot)
    applySetup(fixtureRoot, vector.setup)
    const treeBefore = snapshotTree(fixtureRoot)
    const world = await mountRouteCWorld({
      label: vector.id.toLowerCase(),
      fixtureRoot,
      cwd: worldPath(fixtureRoot, vector.cwd),
      readRoots,
      writeRoots,
      overrides: worldOverrides,
    })
    try {
      const steps = overrides.argsPatch === undefined
        ? vector.steps
        : vector.steps.map((step) => ({ ...step, args: patched(step.args, overrides.argsPatch) }))
      const { outcome, text, value } = await withPlantedEnvironment(() => runSteps({
        root: fixtureRoot,
        steps,
        dispatch: world.dispatch,
      }))
      const code = /(?:^|Error: )([A-Z][A-Z0-9_]+):/u.exec(String(text ?? ''))?.[1]
      const record = makeRecord({
        vector,
        root: fixtureRoot,
        outcome,
        text,
        value,
        facts: await world.facts(),
        providerCalls: world.providerCalls().length,
        baseCalls: world.baseCalls(),
        treeBefore,
        code,
      })
      // The absent-file claim is corroborated on the filesystem, not inferred
      // from an empty stdout.
      if (outcome === 'allow' && vector.expect.absentFile !== undefined) {
        if (existsSync(worldPath(fixtureRoot, vector.expect.absentFile))) {
          record.observed.absentFilePresent = true
        }
      }
      record.__fixtureRoot = fixtureRoot
      return record
    } finally {
      await world.dispose()
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true })
  }
}

/**
 * Capture the whole corpus (optionally a subset).
 * @param {{only?: readonly string[]}} [options]
 * @returns {Promise<object[]>}
 */
export async function captureCorpus({ only } = {}) {
  const vectors = only === undefined ? CORPUS : CORPUS.filter((vector) => only.includes(vector.id))
  const records = []
  for (const vector of vectors) records.push(await captureVector(vector))
  return records
}
