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

/** The record kinds this ledger accepts. An unknown kind is a schema error, not a new feature. */
export const LEDGER_KINDS = Object.freeze(['invocation-authority', 'playback-refusal', 'playback-refusal/1'])

const KINDS = Object.freeze(['invocation-authority', 'replay-refusal', 'execution'])

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
  const admitted = new Map()
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
    if (record.kind === 'invocation-authority') {
      if (registry.has(record.callId)) throw new LedgerError('LEDGER_DUPLICATE_AUTHORITY', `callId ${JSON.stringify(record.callId)} has two authority records on disk; the ledger is corrupt and cannot arbitrate`)
      registry.set(record.callId, record)
    }
    return record
  }

  const load = () => {
    if (loaded) return
    loaded = true
    let text
    try {
      text = readFileSync(path, 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') return
      throw error
    }
    const lines = text.split('\n')
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]
      if (line.trim() === '') continue
      parseLine(line, index, admitted)
    }
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
      return append({ kind: 'invocation-authority', at: now(), ...facts })
    },
    /** Record that a callId was attempted again. Never satisfies `has()`. */
    recordReplayRefusal ({ callId, toolName, reason }) {
      return append({ kind: 'replay-refusal', at: now(), callId, toolName, reason })
    },
    /** Record how an execution ended (the ExecutionFact half). Not keyed uniquely: one call, one line. */
    recordExecution (facts) {
      if (admitted.has(facts.callId) === false) {
        throw new LedgerError('LEDGER_EXECUTION_UNBOUND', `execution for callId ${JSON.stringify(facts.callId)} has no admission record; an execution the ledger cannot join to an authority record is not writable`)
      }
      return append({ kind: 'execution', at: now(), ...facts })
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
