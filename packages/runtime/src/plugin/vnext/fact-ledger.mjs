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
 * DURABILITY POLICY (SEC-01, 2026-11-25) — "durable" means the append is on stable storage before
 * `record()` returns, not merely in the kernel page cache:
 *
 *   - every append is one `open(O_APPEND) → write → fsync(file) → close` sequence, so the record is
 *     made durable BEFORE it can be observed by `has()`/`observe()` or reported to a caller;
 *   - when the append creates the file, the containing DIRECTORY is fsync'd as well, so the name is
 *     stable and not just the inode's bytes (a file may survive while its directory entry does not);
 *   - the cost is bounded and explicit: one file fsync per record, plus ONE directory fsync for the
 *     first record ever written. There is no batching window and therefore no window in which a
 *     returned fact is not durable — `record()` is the authority boundary. (A group-commit policy
 *     would trade that bound for throughput; this ledger is on the admission path of a governed
 *     call, not a hot telemetry path, so the simpler bound is the one chosen.)
 *   - failure is CLOSED, never silent. If the write or the fsync fails, the append is rolled back to
 *     its pre-append length (best effort) so an un-fsynced line cannot linger as a readable authority
 *     record, the ledger does NOT register the callId in memory, and `record()` throws
 *     `LEDGER_NOT_DURABLE`. A directory fsync that cannot be issued throws
 *     `LEDGER_DIRECTORY_NOT_DURABLE`. No code path treats a refused fsync as success.
 *
 * Scope of the claim: this makes a RETURNED fact survive a machine crash on a platform whose
 * `node:fs`/filesystem supports `fsync` (the measured Linux/CI target). It does not make the product
 * survive a filesystem that lies about fsync, and it does not cover a fact whose `record()` never
 * returned (that call is refused by the caller; see the authority boundary in `centre-install.mjs`).
 *
 * The identity rule is the load-bearing one: a callId may produce at most ONE admission record. A
 * second attempt is a replay, and a replay is refused before the tool body — never merged into the
 * first record, never silently treated as a fresh call. The replay refusal is itself recorded, with
 * `kind: 'replay-refusal'`, because "someone tried again" is a governance event that must survive
 * the process that saw it.
 *
 * @module packages/runtime/src/plugin/vnext/fact-ledger
 */

import { closeSync, fstatSync, fsyncSync, ftruncateSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * The seven syscalls the durable append needs, as one injectable seam.
 *
 * The product never passes this object: `openFactLedger` defaults to the real `node:fs` calls below.
 * The seam exists so an arm can make `fsync` fail on an otherwise real file and assert the ledger
 * refuses the fact instead of reporting a successful write (SEC-01 arm d). It is deliberately a
 * narrow record of functions, not a filesystem mock: every value is the real syscall wrapper.
 */
export const DEFAULT_LEDGER_IO = Object.freeze({
  open: (path, flags) => openSync(path, flags),
  write: (fd, data) => writeSync(fd, data),
  fsync: (fd) => fsyncSync(fd),
  size: (fd) => fstatSync(fd).size,
  truncate: (fd, length) => ftruncateSync(fd, length),
  close: (fd) => closeSync(fd),
  unlink: (path) => unlinkSync(path),
})

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
 * @param {object} [input.io] - the durable-append syscall seam (defaults to `DEFAULT_LEDGER_IO`; tests
 *   inject it only to make `fsync` refuse, never to bypass durability).
 */
export function openFactLedger ({ path, now = () => new Date().toISOString(), io = DEFAULT_LEDGER_IO }) {
  if (typeof path !== 'string' || path === '') throw new LedgerError('PATH_MISSING', 'a ledger needs a path')
  if (io === null || typeof io !== 'object' || typeof io.fsync !== 'function') {
    throw new LedgerError('IO_MISSING', 'a ledger needs a durable-append seam with a real fsync; a ledger that cannot fsync is not a ledger')
  }
  mkdirSync(dirname(path), { recursive: true })

  /** callId -> the admission record already written for it. This map IS the no-replay guarantee. */
  let admitted = new Map()
  /** callIds that already have an execution fact. Reset on load: `observe()` is the read side. */
  let executed = new Set()
  let loaded = false
  /**
   * Whether the file existed when the ledger last looked. It decides whether the append that creates
   * it must also fsync the containing directory. It is set only AFTER that directory fsync succeeds.
   */
  let fileExisted = false

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
        fileExisted = false
        loaded = true
        return
      }
      throw error
    }
    fileExisted = true
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

  /**
   * Make the containing directory's entry for `path` durable. Only needed for the append that
   * CREATES the file: `fsync(file)` stabilises the inode's bytes, not the name that reaches it.
   * Failure is a refusal, never a "probably fine": without a stable name the record is not
   * discoverable after a machine crash, so the caller must not treat it as authority.
   */
  const fsyncDirectory = () => {
    const directory = dirname(path)
    let fd
    try {
      fd = io.open(directory, 'r')
    } catch (error) {
      throw new LedgerError('LEDGER_DIRECTORY_NOT_DURABLE', `the directory ${JSON.stringify(directory)} could not be opened for fsync (${error?.code ?? error?.message}); a file whose name is not durable is not a durable record`)
    }
    let failure
    try {
      io.fsync(fd)
    } catch (error) {
      failure = error
    }
    try {
      io.close(fd)
    } catch (error) {
      failure ??= error
    }
    if (failure !== undefined) {
      throw new LedgerError('LEDGER_DIRECTORY_NOT_DURABLE', `the directory ${JSON.stringify(directory)} could not be fsync'd (${failure?.code ?? failure?.message}); a file whose name is not durable is not a durable record`)
    }
  }

  /**
   * Append one line and do not return until it is on stable storage.
   *
   * The write and the fsync are one step by contract: a caller that sees a return has a durable
   * record, and a caller that sees a throw has neither a durable record nor an in-memory one. The
   * rollback truncates the un-durable bytes back to the pre-append length (the ledger is
   * append-only for SUCCESSFUL appends; a failed append must not leave a readable record that was
   * never acknowledged), so a later reader cannot mistake it for authority either.
   */
  const appendDurably = (line) => {
    let fd
    try {
      // `O_APPEND`: one write is one append, so concurrent writers cannot interleave inside a line.
      fd = io.open(path, 'a')
    } catch (error) {
      throw new LedgerError('LEDGER_UNWRITABLE', `${path} could not be opened for append (${error?.code ?? error?.message}); the call is refused rather than run on a fact that cannot be written`)
    }
    let sizeBefore
    try {
      sizeBefore = io.size(fd)
    } catch (error) {
      try { io.close(fd) } catch { /* the throw below is the contract; closing a failed descriptor is best-effort */ }
      throw new LedgerError('LEDGER_UNWRITABLE', `${path} could not be sized before append (${error?.code ?? error?.message})`)
    }
    let failure
    try {
      io.write(fd, line)
      io.fsync(fd)
    } catch (error) {
      failure = error
    }
    if (failure !== undefined) {
      // Roll the un-durable line back BEFORE closing, so the bytes never become a readable record.
      // The truncation is what removes the line from the file image; its own fsync is attempted but
      // is not allowed to turn a successful rollback into a second, different failure — the append
      // is refused either way, and a refused append is never authority.
      let repaired = false
      try {
        io.truncate(fd, sizeBefore)
        repaired = true
        try { io.fsync(fd) } catch { /* rollback fsync is best-effort; the append is refused anyway */ }
      } catch { /* the rollback itself failed; handled as LEDGER_UNRECOVERABLE below */ }
      try { io.close(fd) } catch { /* the refusal below is the contract; close is best-effort */ }
      if (!repaired) {
        throw new LedgerError('LEDGER_UNRECOVERABLE', `${path} could not make the append durable (${failure?.code ?? failure?.message}) AND could not roll it back; the ledger's authority is unknown, so every fact is refused`)
      }
      throw new LedgerError('LEDGER_NOT_DURABLE', `${path} could not make the append durable (${failure?.code ?? failure?.message}); an un-fsynced fact is not authority, so the call is refused`)
    }
    try {
      io.close(fd)
    } catch (error) {
      // The bytes ARE durable; the descriptor state is not provable. Refuse the fact so no caller
      // reports an admission the ledger cannot vouch for, and let the retry meet the durable line.
      throw new LedgerError('LEDGER_CLOSE_FAILED', `${path} was fsync'd but its descriptor could not be closed (${error?.code ?? error?.message}); the fact is not reported as recorded`)
    }
    if (!fileExisted) {
      try {
        fsyncDirectory()
      } catch (error) {
        // The name is not durable: remove the bytes so no reader treats the inode as reachable
        // authority, then report the refusal. Best effort; the throw is the contract.
        try { io.unlink(path) } catch { /* best-effort; the throw below refuses the fact either way */ }
        throw error
      }
      fileExisted = true
    }
  }

  const append = (record) => {
    load()
    if (record === null || typeof record !== 'object') throw new LedgerError('LEDGER_RECORD_INVALID', 'refusing to write a non-record')
    if (!KINDS.includes(record.kind)) throw new LedgerError('LEDGER_RECORD_INVALID', `refusing to write unknown kind ${JSON.stringify(record.kind)}`)
    if (record.kind === 'invocation-authority' && admitted.has(record.callId)) {
      throw new LedgerError('LEDGER_REPLAY', `callId ${JSON.stringify(record.callId)} was already admitted; a replay must be refused, not recorded twice`)
    }
    // The durable append comes FIRST. Registering the callId in memory before the fsync would make an
    // un-durable fact answer `has()`/`observe()` as KNOWN — exactly the authority a refused fsync must
    // not grant (SEC-01 arm b).
    appendDurably(`${JSON.stringify(record)}\n`)
    if (record.kind === 'invocation-authority') admitted.set(record.callId, record)
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
      // Same ordering as `append`: the durable write happens first, so a failed fsync cannot make a
      // non-durable execution fact answer `readAll()`/recovery as terminal evidence.
      const record = append({ ...facts, kind: 'execution', at: now() })
      executed.add(facts.callId)
      return record
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
