/**
 * scenario.mjs — one execution of one corpus vector against the old path.
 *
 * The harness only creates the fixture, dispatches the vector's steps through
 * the path's own `dispatch` and serializes the witnesses. It decides no lane,
 * no policy and no refusal.
 *
 * @module tests/ute-g1-search/lib/scenario
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { dirname, join } from 'node:path'

import {
  canonicalMatches,
  classifySearchRefusal,
  corroborateMatches,
  codesOf,
  effectsCell,
  findLeaks,
  matchDigest,
  renderedGlobCount,
  retentionOf,
  snapshotTree,
} from './effect-oracle.mjs'
import { SEARCH_SECRET } from './corpus.mjs'

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

/** Materialize a step's `path` token into an absolute path. */
export function materializeArgs(root, args) {
  const out = {}
  for (const [key, value] of Object.entries(args)) {
    out[key] = key === 'path' && typeof value === 'string' ? worldPath(root, value) : value
  }
  return out
}

/** An already-aborted signal (the corpus's cancellation arm). */
function abortedSignal() {
  const controller = new AbortController()
  controller.abort()
  return controller.signal
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
    if (step.tool === undefined) throw new Error(`unknown step op '${step.op}'`)
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
 * grades. Every effect comes from a witness (match set + tree + facts).
 */
export function makeRecord({ vector, fixtureRoot, cwdAbs, readRoots, outcome, text, value, facts, providerCalls, baseCalls, treeBefore, allowEscapedMatches = false }) {
  const matches = canonicalMatches(vector.entry, value, cwdAbs)
  // The matches are corroborated against the tree BEFORE they can become an
  // effect; a fabricated/again-escaped path throws instead of being recorded.
  if (outcome === 'allow' && allowEscapedMatches !== true) corroborateMatches(matches, cwdAbs)
  const treeAfter = snapshotTree(fixtureRoot)
  const retention = retentionOf(text)
  // grep states its retention in a header; glob's text is the list itself, so
  // its presented count is measured from the rendered lines instead.
  const rendered = vector.entry === 'glob'
    ? (outcome === 'allow' ? renderedGlobCount(text) : null)
    : retention.rendered
  const refusal = classifySearchRefusal({ outcome, text, facts, readRoots })
  const uniquePaths = [...new Set(matches.map((match) => match.path))]
  const effects = []
  if (outcome === 'allow') {
    effects.push({
      path: `@matches:${vector.entry}`,
      exists: true,
      bytes: matches.length,
      sha256: matchDigest(matches),
      mode: `retained=${rendered === null ? 'unknown' : rendered},paths=${uniquePaths.length},keys=${uniquePaths.slice(0, 8).join('+') || '-'}`,
    })
  } else {
    effects.push({
      path: `@matches:${vector.entry}`,
      exists: false,
      bytes: null,
      sha256: null,
      mode: 'no-match-observation',
    })
  }
  effects.push({
    path: '@fs:tree',
    exists: true,
    bytes: treeAfter.files,
    sha256: treeAfter.digest,
    mode: treeAfter.digest === treeBefore.digest ? 'unchanged' : 'CHANGED',
  })
  const decisionCounts = { allow: 0, deny: 0 }
  for (const fact of Array.isArray(facts) ? facts : []) {
    if (fact?.decision === 'allow') decisionCounts.allow += 1
    if (fact?.decision === 'deny') decisionCounts.deny += 1
  }
  return {
    id: vector.id,
    entry: vector.entry,
    laneRead: vector.lane.read.join(','),
    laneWrite: vector.lane.write.join(','),
    outcome,
    refusal,
    codes: codesOf(text, facts),
    effects,
    facts: {
      confined: providerCalls,
      allowFacts: decisionCounts.allow,
      denyFacts: decisionCounts.deny,
      baseCalls,
    },
    leaks: findLeaks(text, matches, [SEARCH_SECRET]),
  }
}

/** TSV header and serialization. */
export const ROW_HEADER = Object.freeze(['id', 'entry', 'lane_read', 'lane_write', 'outcome', 'refusal', 'codes', 'effects', 'facts', 'leaks'])

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
    `confined=${record.facts.confined},allow=${record.facts.allowFacts},deny=${record.facts.denyFacts},base=${record.facts.baseCalls}`,
    record.leaks.length === 0 ? '-' : record.leaks.join(','),
  ].join('\t')
}

/** Parse one TSV line back into a comparable record. */
export function rowToRecord(line) {
  const [id, entry, laneRead, laneWrite, outcome, refusal, codes, effects, factsCell, leaks] = line.split('\t')
  // Normalize the `facts` cell back into the RECORD shape (the row spells
  // `allow`/`deny`/`base`, the record carries the explicit *Facts/*Calls names).
  const cell = {}
  for (const part of factsCell.split(',')) {
    const [key, value] = part.split('=')
    cell[key] = Number(value)
  }
  const facts = {
    confined: cell.confined,
    allowFacts: cell.allow,
    denyFacts: cell.deny,
    baseCalls: cell.base,
  }
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
    facts,
    leaks: leaks === '-' ? [] : leaks.split(','),
  }
}
