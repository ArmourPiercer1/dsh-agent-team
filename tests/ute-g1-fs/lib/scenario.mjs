/**
 * scenario.mjs — one execution of one corpus vector, shared by both paths.
 *
 * The harness only does fixture setup, step dispatch and effect capture. Every
 * tool step goes through the path's own dispatch function; nothing here decides
 * a lane, a version or a refusal.
 *
 * @module tests/ute-g1-fs/lib/scenario
 */
import { chmodSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { dirname, join } from 'node:path'

import { classifyRefusal, codesOf, effectsCell, findLeaks, snapshotAll } from './effect-oracle.mjs'

/**
 * Resolve a world-relative token to an absolute host path.
 * `bound` and `observe` are nested under `inside` in BOTH worlds (the legacy
 * world's fixture layout), so the SAME token map works for both.
 * @param {string} root
 * @param {string} token
 * @returns {string}
 */
export function worldPath(root, token) {
  return join(root, ...token.split('/'))
}

/** Resolve a vector's lane tokens to absolute roots. */
export function resolveLane(root, lane) {
  return {
    read: lane.read.map((token) => worldPath(root, token)),
    write: lane.write.map((token) => worldPath(root, token)),
  }
}

/** Create the three world directories both paths expect. */
export function makeWorldDirs(root) {
  for (const rel of ['inside', 'inside/bound', 'inside/observe', 'outside']) {
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
      // `base64` is for binary fixtures (an image must be a real decodable PNG,
      // not text with a .png name); text fixtures keep the utf8 default.
      if (op.base64 !== undefined) writeFileSync(absolute, Buffer.from(op.base64, 'base64'))
      else writeFileSync(absolute, op.content, 'utf8')
      if (op.mode !== undefined) chmodSync(absolute, op.mode)
    } else if (op.op === 'symlink') {
      mkdirSync(dirname(absolute), { recursive: true })
      symlinkSync(worldPath(root, op.target), absolute)
    } else if (op.op === 'mkdir') {
      mkdirSync(absolute, { recursive: true })
    } else {
      throw new Error(`unknown setup op '${op.op}'`)
    }
  }
}

/** Materialize a tool step's `file_path` token into an absolute path. */
export function materializeArgs(root, args) {
  const out = {}
  for (const [key, value] of Object.entries(args)) {
    out[key] = key.endsWith('_path') && typeof value === 'string' ? worldPath(root, value) : value
  }
  return out
}

/**
 * Run one vector's steps.
 * @param {object} input
 * @param {string} input.root - world root.
 * @param {readonly object[]} input.steps - corpus steps.
 * @param {(name: string, args: object, options?: {signal?: AbortSignal}) => Promise<{isError: boolean, text: string, codes?: string[], resultEffects?: object[]}>} input.dispatch
 * @returns {Promise<{outcome: 'allow'|'deny', text: string, codes: string[], resultEffects: object[]}>}
 */
export async function runSteps({ root, steps, dispatch }) {
  const texts = []
  const codes = []
  const resultEffects = []
  let outcome = 'allow'
  for (const step of steps) {
    if (step.tool !== undefined) {
      // A cancellation arm is expressed by a PRE-ABORTED signal: the path's own
      // registry decides what a cancelled call looks like, this harness only
      // hands it the signal. Nothing here times a mid-read abort.
      const options = step.abort === true ? { signal: abortedSignal() } : undefined
      const settled = await dispatch(step.tool, materializeArgs(root, step.args), options)
      texts.push(settled.text ?? '')
      codes.push(...(settled.codes ?? []), ...codesOf(settled.text))
      resultEffects.push(...(settled.resultEffects ?? []))
      outcome = settled.isError === true ? 'deny' : 'allow'
    } else if (step.op === 'externalWrite') {
      writeFileSync(worldPath(root, step.path), step.content, 'utf8')
    } else {
      throw new Error(`unknown step op '${step.op}'`)
    }
  }
  return { outcome, text: texts.join('\n'), codes: [...new Set(codes)], resultEffects }
}

/** An already-aborted signal (the corpus's cancellation arm). */
function abortedSignal() {
  const controller = new AbortController()
  controller.abort()
  return controller.signal
}

/**
 * Build one normalized record: the tuple the fixture stores and the comparison
 * harness grades.
 */
export function makeRecord({ vector, root, outcome, text, codes, resultEffects = [] }) {
  // File effects are always snapshotted from the world. A tool whose result is
  // not a file effect (read_image's committed attachment) contributes a
  // synthetic `@result:…` entry built by the caller from what the STORE
  // received — merged here so both paths serialize one comparable effect cell.
  const effects = resultEffects.length === 0
    ? snapshotAll(root, vector.effects)
    : [...snapshotAll(root, vector.effects), ...resultEffects].sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
  const { refusal } = classifyRefusal(codes, text)
  return {
    id: vector.id,
    entry: vector.entry,
    laneRead: vector.lane.read.join(','),
    laneWrite: vector.lane.write.join(','),
    outcome,
    refusal: outcome === 'allow' ? null : (refusal ?? 'other'),
    codes,
    effects,
    leaks: findLeaks(text, vector.leaks),
  }
}

/** TSV header and serialization. */
export const ROW_HEADER = ['id', 'entry', 'lane_read', 'lane_write', 'outcome', 'refusal', 'codes', 'effects', 'leaks']

/** Serialize a record to one TSV line (no absolute paths, no machine state). */
export function recordToRow(record) {
  return [
    record.id,
    record.entry,
    record.laneRead,
    record.laneWrite,
    record.outcome,
    record.refusal ?? '-',
    record.codes.length === 0 ? '-' : record.codes.join(','),
    effectsCell(record.effects),
    record.leaks.length === 0 ? '-' : record.leaks.join(','),
  ].join('\t')
}

/** Parse one TSV line back into a comparable record. */
export function rowToRecord(line) {
  const [id, entry, laneRead, laneWrite, outcome, refusal, codes, effects, leaks] = line.split('\t')
  return {
    id,
    entry,
    laneRead,
    laneWrite,
    outcome,
    refusal: refusal === '-' ? null : refusal,
    codes: codes === '-' ? [] : codes.split(','),
    effects: effects === '-' ? [] : effects.split(';').map((part) => {
      const [path, existence, bytes, sha256, mode] = part.split('|')
      return { path, exists: existence === 'present', bytes: bytes === '-' ? null : Number(bytes), sha256: sha256 === '-' ? null : sha256, mode: mode === '-' ? null : mode }
    }),
    leaks: leaks === '-' ? [] : leaks.split(','),
  }
}
