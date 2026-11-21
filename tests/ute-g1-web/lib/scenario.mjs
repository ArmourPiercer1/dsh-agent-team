/**
 * scenario.mjs — one execution of one corpus vector against the old path.
 *
 * The harness dispatches the vector's steps through the world's own `dispatch`
 * (the host registry's real model-call path) and serializes the witnesses. It
 * decides no lane, no bound and no refusal; the corpus declares them.
 *
 * @module tests/ute-g1-web/lib/scenario
 */
import {
  buildEffects,
  classifyWebRefusal,
  codesOf,
  normalizeText,
  servedBytes,
} from './effect-oracle.mjs'

/** Materialize `<origin>` placeholders and normalize the declared URLs. */
export function materializeArgs(origin, args) {
  const out = {}
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') out[key] = value.split('<origin>').join(origin)
    else if (Array.isArray(value)) out[key] = value.map((item) => (typeof item === 'string' ? item.split('<origin>').join(origin) : item))
    else out[key] = value
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
 * Run one vector's steps through the world's dispatch.
 *
 * @param {{origin: string, steps: readonly object[], dispatch: Function}} input
 * @returns {Promise<{outcome: 'allow'|'deny', text: string, value: object|undefined}>}
 */
export async function runSteps({ origin, steps, dispatch }) {
  const texts = []
  let value
  let outcome = 'allow'
  for (const step of steps) {
    if (step.tool === undefined) throw new Error('every step must name a tool')
    const options = step.abort === true ? { signal: abortedSignal() } : undefined
    const settled = await dispatch(step.tool, materializeArgs(origin, step.args), options)
    texts.push(settled.text ?? '')
    value = settled.value
    outcome = settled.isError === true ? 'deny' : 'allow'
  }
  return { outcome, text: texts.join('\n'), value }
}

/**
 * Build one normalized record from measured witnesses.
 *
 * @param {object} input
 * @param {object} input.vector - the corpus vector.
 * @param {string} input.origin - the live fixture origin.
 * @param {'allow'|'deny'} input.outcome
 * @param {string} input.text - the raw model-facing text.
 * @param {object|undefined} input.value - the admitted tool value.
 * @param {readonly object[]} input.facts - the guard facts.
 * @param {readonly object[]} input.requests - the fixture's arrival log.
 * @param {object} input.stats - `{fetches, searches}` from the composition provider.
 * @param {object} input.network - the socket witness snapshot.
 * @param {number} input.hostWebCalls - the inherited-service tripwire counter.
 * @returns {object} the record.
 */
export function makeRecord({ vector, origin, outcome, text, value, facts, requests, stats, network, hostWebCalls }) {
  const normalizedText = normalizeText(text, origin)
  const normalizedRequests = requests.map((entry) => ({
    method: entry.method,
    path: entry.path,
    bytesWritten: entry.bytesWritten,
  }))
  const refusal = classifyWebRefusal({ outcome, text: normalizedText, facts })
  const decisionCounts = { allow: 0, deny: 0 }
  for (const fact of Array.isArray(facts) ? facts : []) {
    if (fact?.decision === 'allow') decisionCounts.allow += 1
    if (fact?.decision === 'deny') decisionCounts.deny += 1
  }
  const normalizedValue = value === undefined || value === null ? undefined : JSON.parse(
    JSON.stringify(value).split(origin).join('<origin>'),
  )
  return {
    id: vector.id,
    entry: vector.entry,
    network: vector.network,
    outcome,
    refusal,
    codes: codesOf({ outcome, text: normalizedText, facts }),
    effects: buildEffects({
      outcome,
      value: normalizedValue,
      requests: normalizedRequests,
      bytes: servedBytes(normalizedRequests),
      sorted: vector.concurrent === true,
      normalizedText,
    }),
    facts: {
      fetches: stats.fetches,
      searches: stats.searches,
      allowFacts: decisionCounts.allow,
      denyFacts: decisionCounts.deny,
      hostWeb: hostWebCalls,
    },
    text: normalizedText,
    net: {
      loopback: network.loopback > 0 ? 'yes' : 'no',
      external: network.external,
    },
  }
}

/** TSV header and serialization. */
export const ROW_HEADER = Object.freeze(['id', 'entry', 'network', 'outcome', 'refusal', 'codes', 'effects', 'facts', 'text', 'net'])

/** One text cell: newlines escaped, tabs removed (the row is TSV). */
export function textCell(text) {
  return String(text).split('\t').join(' ').split('\n').join('\\n')
}

/** Unescape a text cell. */
export function textOfCell(cell) {
  return String(cell).split('\\n').join('\n')
}

/** Serialize a record to one TSV line (no absolute paths, no machine state). */
export function recordToRow(record) {
  return [
    record.id,
    record.entry,
    record.network,
    record.outcome,
    record.refusal ?? '-',
    record.codes.length === 0 ? '-' : record.codes.join(','),
    record.effects.map((effect) => [effect.path, effect.exists ? 'present' : 'absent', effect.bytes ?? '-', effect.sha256 ?? '-', effect.mode ?? '-'].join('|')).join(';'),
    `fetches=${record.facts.fetches},searches=${record.facts.searches},allow=${record.facts.allowFacts},deny=${record.facts.denyFacts},hostweb=${record.facts.hostWeb}`,
    textCell(record.text),
    `loopback=${record.net.loopback},external=${record.net.external}`,
  ].join('\t')
}

/** Parse one TSV line back into a comparable record. */
export function rowToRecord(line) {
  const [id, entry, network, outcome, refusal, codes, effects, factsCell, text, netCell] = line.split('\t')
  const facts = {}
  for (const part of String(factsCell).split(',')) {
    const [key, value] = part.split('=')
    facts[key] = Number(value)
  }
  const net = {}
  for (const part of String(netCell).split(',')) {
    const [key, value] = part.split('=')
    net[key] = key === 'external' ? Number(value) : value
  }
  return {
    id,
    entry,
    network,
    outcome,
    refusal: refusal === '-' ? null : refusal,
    codes: codes === '-' ? [] : codes.split(','),
    effects: effects === '-' ? [] : effects.split(';').map((part) => {
      const [path, existence, bytes, sha256, mode] = part.split('|')
      return {
        path,
        exists: existence === 'present',
        bytes: bytes === '-' ? null : Number(bytes),
        sha256: sha256 === '-' ? null : sha256,
        mode: mode === '-' ? null : mode,
      }
    }),
    facts: {
      fetches: facts.fetches,
      searches: facts.searches,
      allowFacts: facts.allow,
      denyFacts: facts.deny,
      hostWeb: facts.hostweb,
    },
    text: textOfCell(text),
    net: { loopback: net.loopback, external: net.external },
  }
}
