/**
 * fact-ledger.mjs — the durable side of admission, and the reason "no replay" is a property rather
 * than a promise.
 *
 * An in-memory fact array answers nothing after a crash: it cannot tell the resumed process which
 * callIds were already admitted, so the host's retry of an in-flight step looks new and a refused
 * call can be re-admitted under the same identity. The ledger is the smallest thing that fixes
 * both: one append-only JSONL file, one line per record, `O_APPEND` so a crash truncates at worst a
 * partial last line (which `readAll` REFUSES rather than skipping — a half-written record must not
 * be read as authority).
 *
 * The identity rule is the load-bearing one: a callId may produce at most ONE admission record. A
 * second attempt is a replay, and a replay is refused before the tool body — never merged into the
 * first record, never silently treated as a fresh call. The replay refusal is itself recorded, with
 * `kind: 'replay-refusal'`, because "someone tried again" is a governance event that must survive
 * the process that saw it.
 *
 * @module packages/runtime/src/plugin/vnext/fact-ledger
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

export class LedgerError extends TypeError {
  constructor (code, message) {
    super(`fact-ledger: ${message}`)
    this.name = 'LedgerError'
    this.code = code
  }
}

/**
 * The record kinds this ledger accepts. An unknown kind is a schema error, not a new feature.
 *
 * ONE list, exported. There used to be two - an exported `LEDGER_KINDS` that named a `playback-refusal`
 * kind the writer never emitted and omitted `execution` entirely - so anyone validating against the
 * public list would reject the ledger's own execution records, and accept a kind it never writes.
 */
export const LEDGER_KINDS = Object.freeze(['invocation-authority', 'replay-refusal', 'execution'])
const KINDS = LEDGER_KINDS

/**
 * Open a ledger at `path`. The file is created on first append; its directory is created eagerly so
 * a missing parent fails here, at open time, rather than at the first admission under load.
 *
 * @param {object} input
 * @param {string} input.path - absolute file path of the JSONL ledger.
 * @param {() => string} [input.now] - injectable clock (tests pin it; the product uses the wall clock).
 */
export function openFactLedger ({ path, now = () => new Date().toISOString() }) {
  if (typeof path !== 'string' || path === '') throw new LedgerError('PATH_MISSING', 'a ledger needs a path')
  mkdirSync(dirname(path), { recursive: true })

  /** callId -> the admission record already written for it. This map IS the no-replay guarantee. */
  let admitted = new Map()
  /** callIds that already have an execution fact. Reset on load: `observe()` is the read side. */
  let executed = new Set()
  let loaded = false

  // `registry` is passed in so `readAll` can validate the file WITHOUT mutating the live
  // `admitted` map: the first attempt had readAll() register every record and then `has()` re-read
  // the same lines into the same map, which reported a corrupt ledger on a perfectly good file.
  const parseLine = (line, index, registry) => {
    let record
    try {
      record = JSON.parse(line)
    } catch {
      throw new LedgerError('LEDGER_TRUNCATED', `line ${index + 1} of ${path} is not valid JSON: a partially written record must not be read as authority`)
    }
    if (record === null || typeof record !== 'object' || typeof record.callId !== 'string' || record.callId === '') {
      throw new LedgerError('LEDGER_RECORD_INVALID', `line ${index + 1} of ${path} has no callId`)
    }
    if (!KINDS.includes(record.kind)) throw new LedgerError('LEDGER_RECORD_INVALID', `line ${index + 1} of ${path} has unknown kind ${JSON.stringify(record.kind)}`)
    if (record.kind === 'execution' && registry.get(`execution:${record.callId}`) === true) {
      throw new LedgerError('LEDGER_DUPLICATE_EXECUTION', `callId ${JSON.stringify(record.callId)} has two execution records on disk; the ledger cannot say which one happened`)
    }
    if (record.kind === 'invocation-authority') {
      if (registry.has(record.callId)) throw new LedgerError('LEDGER_DUPLICATE_AUTHORITY', `callId ${JSON.stringify(record.callId)} has two authority records on disk; the ledger is corrupt and cannot arbitrate`)
      registry.set(record.callId, record)
    }
    if (record.kind === 'execution') registry.set(`execution:${record.callId}`, true)
    return record
  }

  const load = () => {
    if (loaded) return
    // `loaded` is set only AFTER a successful parse: a failed read must leave the ledger unloaded so
    // the next call re-reads and fails again, instead of treating "I could not read it" as "empty".
    let text
    try {
      text = readFileSync(path, 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') {
        loaded = true
        return
      }
      throw error
    }
    // Parse into a THROWAWAY map and publish it only after the whole file parsed: a load that dies
    // on line 2 must not leave line 1's record in the live map, or the next append would report
    // LEDGER_DUPLICATE_AUTHORITY for a file it never managed to read.
    const registry = new Map()
    const ended = new Set()
    const lines = text.split('\n')
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]
      if (line.trim() === '') continue
      const record = parseLine(line, index, registry)
      if (record.kind === 'execution') ended.add(record.callId)
    }
    admitted = registry
    executed = ended
    loaded = true
  }

  const append = (record) => {
    load()
    if (record === null || typeof record !== 'object') throw new LedgerError('LEDGER_RECORD_INVALID', 'refusing to write a non-record')
    if (!KINDS.includes(record.kind)) throw new LedgerError('LEDGER_RECORD_INVALID', `refusing to write unknown kind ${JSON.stringify(record.kind)}`)
    if (record.kind === 'invocation-authority') {
      if (admitted.has(record.callId)) {
        throw new LedgerError('LEDGER_REPLAY', `callId ${JSON.stringify(record.callId)} was already admitted; a replay must be refused, not recorded twice`)
      }
      admitted.set(record.callId, record)
    }
    appendFileSync(path, `${JSON.stringify(record)}\n`, { encoding: 'utf8', flag: 'a' })
    return record
  }

  return {
    path,
    /** Write one admission record. Throws LEDGER_REPLAY for a callId already admitted. */
    recordAdmission (facts) {
      // `kind` and `at` are the LEDGER's, not the caller's: spreading the facts last let a malformed
      // caller record a different kind under this method and walk past the replay rule it was writing.
      return append({ ...facts, kind: 'invocation-authority', at: now() })
    },
    /** Record that a callId was attempted again. Never satisfies `has()`. */
    recordReplayRefusal ({ callId, toolName, reason }) {
      return append({ ...{ callId, toolName, reason }, kind: 'replay-refusal', at: now() })
    },
    /** Record how an execution ended (the ExecutionFact half). Not keyed uniquely: one call, one line. */
    recordExecution (facts) {
      if (admitted.has(facts.callId) === false) {
        throw new LedgerError('LEDGER_EXECUTION_UNBOUND', `execution for callId ${JSON.stringify(facts.callId)} has no admission record; an execution the ledger cannot join to an authority record is not writable`)
      }
      if (executed.has(facts.callId)) {
        // One call, one execution fact. A second one would make 'how did this call end' a question with
        // two answers on the same durable record, and the first is the one that happened.
        throw new LedgerError('LEDGER_DUPLICATE_EXECUTION', `callId ${JSON.stringify(facts.callId)} already has an execution record; a call ends once`)
      }
      executed.add(facts.callId)
      return append({ ...facts, kind: 'execution', at: now() })
    },
    /**
     * What the ledger can say about one callId. `UNKNOWN` is NOT "no record, therefore allowed":
     * it is the state of a call the durable side cannot answer for, and every consumer must treat
     * it as unproven rather than as permission.
     */
    observe (callId) {
      load()
      const admission = admitted.get(callId)
      if (admission === undefined) return Object.freeze({ callId, state: 'UNKNOWN', reason: 'no durable admission record for this callId' })
      return Object.freeze({ callId, state: 'KNOWN', admission })
    },
    /**
     * Whether the durable side can be trusted at all. A ledger that cannot read itself (a truncated
     * tail, two authority records for one callId) answers UNKNOWN for everything rather than a
     * partial truth: a half-readable authority record is worse than an admission of ignorance.
     */
    health () {
      try {
        load()
        return Object.freeze({ state: 'KNOWN', records: admitted.size })
      } catch (error) {
        return Object.freeze({ state: 'UNKNOWN', reason: error?.code ?? 'LEDGER_UNREADABLE', detail: error?.message ?? String(error) })
      }
    },
    /** True only for a callId with a durable ADMISSION record — replay refusals do not count. */
    has (callId) {
      load()
      return admitted.has(callId)
    },
    /** Every record, in append order, after a full re-read of the file. */
    readAll () {
      const records = []
      const text = (() => {
        try {
          return readFileSync(path, 'utf8')
        } catch (error) {
          if (error?.code === 'ENOENT') return ''
          throw error
        }
      })()
      const lines = text.split('\n')
      const registry = new Map()
      for (let index = 0; index < lines.length; index++) {
        if (lines[index].trim() === '') continue
        records.push(parseLine(lines[index], index, registry))
      }
      return records
    },
  }
}
