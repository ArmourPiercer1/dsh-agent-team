/**
 * file-seam — the FILE-BACKED StorageDomainSeam of the P4-T5
 * fault-injection testkit (ruling R22).
 *
 * This module is the ONLY testkit module allowed to touch `node:` builtins
 * (it is `.mjs`; the zero-`node:`-builtin rule for `.ts` files is absolute —
 * the adjacent `file-seam.d.mts` provides the type surface for tsc under
 * NodeNext, and the plain-node runner resolves this `.mjs` specifier
 * natively).
 *
 * What it is:
 *
 * - ONE JSON file per KvTable, in a scratch dir:
 *
 *     <scratch>/<domain>.meta.json          {"version": <n>}   (L1 domain stamp)
 *     <scratch>/<domain>/<table>.json       { <key>: <row> }   (one file per table)
 *     <scratch>/<domain>/<table>.json.<i>.<n>.tmp   (in-flight atomic write)
 *
 * - Durable writes are ATOMIC: the full next table document is written to a
 *   sibling `.tmp` file and then `fs.renameSync`'d over the target — so a
 *   crash mid-write leaves EITHER the old target OR the new target, never a
 *   torn target. The `.tmp` file is the crash-leftover that the fault
 *   injection deliberately preserves.
 *
 * - CRASH INJECTION is a seam-level ARMED FAULT:
 *   `armCrashAfterWrites(n)` arms a `CrashFault` so that the first `n`
 *   durable writes (by seam-wide `writeCount`) fully commit (tmp + rename)
 *   and EVERY later write crashes MID-ATOMIC-WRITE: the tmp file is written
 *   (the "new" bytes), the rename never happens (the target keeps the old
 *   bytes), and the in-memory rows are not advanced. The fault is STICKY
 *   until `clearCrash()` (mirrors the P4-T1 fake seam's
 *   `setCrashAfterWrites`). `CrashFault` is a distinct error with NO seam
 *   `code`, so the T1 repositories classify it as an unclassified
 *   `SEAM_FAILURE` — exactly the surface a real mid-write process death
 *   would present to the TeamDomain layer.
 *
 * - The CRASH = fault fires; the PROCESS-RESTART model is the test dropping
 *   the whole realm (all in-memory state: seam, domain, repositories,
 *   coordinator, adapter) and REOPENING a brand-new `FileStorageSeam` +
 *   repository stack over the SAME scratch dir. Durable files outlive the
 *   realm; the fresh stack rehydrates from them. TeamDomain touches the OS
 *   exclusively through the injected seam (no PID, no socket, no global
 *   state), so this file-backed realm restart is observationally equivalent
 *   to an OS process restart for every code path TeamDomain owns (see the
 *   P4-T5 fault-matrix report, process-equivalence section).
 *
 * Seam contract (mirrors `packages/storage/schema/seam.ts` 1:1):
 * `open` rejects with `already-open`, `version-mismatch` (detail
 * `{ found, expected }`), and `malformed-medium` (missing/undeclared/
 * unparseable table files); table ops reject with `closed` (closed domain),
 * `invalid-table` (undeclared table), and `missing-key` (update on absent
 * key).
 *
 * One documented deviation from the P4-T1 in-memory fake (unreachable in
 * the provisioning protocol, which only `update`s the bootstrapped ledger
 * counter key): a crash armed for an `update` whose key is missing throws
 * `CrashFault` without writing a tmp file (no bytes were about to be
 * written), instead of the fake's crash-before-missing-key ordering.
 *
 * @module fault-injection/file-seam
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
/** Per-test scratch base (workspace-internal; cleaned by the tests' finally blocks). */
const TEST_TMP_BASE = join(HERE, '..', 'test', '.tmp-fault')
/** Committed deterministic durable-store snapshots (the task card fixtures). */
const FIXTURES_BASE = join(HERE, 'fixtures')

/**
 * The distinct crash-injection error: the seam-level armed fault firing
 * mid-durable-write. It carries NO seam `code` on purpose, so the T1
 * repositories classify it through `normalizeSeamError` as an unclassified
 * `SEAM_FAILURE` — the same surface as the P4-T1 `FakeCrashError`.
 */
export class CrashFault extends Error {
  constructor(message) {
    super(message)
    this.name = 'CrashFault'
  }
}

/** One seam-level error (Error instance carrying a string `code`). */
function seamError(code, message, detail) {
  const error = new Error(message)
  error['code'] = code
  if (detail !== undefined) {
    error['detail'] = detail
    error['details'] = detail
  }
  return error
}

/** One JSON-file storage seam instance (fresh process per instance). */
let instanceCounter = 0

/**
 * One file-backed durable domain facility (implements the
 * `StorageDomainSeam` contract of `packages/storage/schema/seam.ts`).
 *
 * @param scratchDir - the scratch dir this seam owns (created lazily on
 *   first `open`; pass the result of {@link scratchDir}).
 */
export class FileStorageSeam {
  constructor(scratchDir) {
    if (typeof scratchDir !== 'string' || scratchDir.length === 0) {
      throw new TypeError('FileStorageSeam: scratchDir must be a non-empty string')
    }
    this.scratchDir = scratchDir
    this.instanceId = ++instanceCounter
    /** open (or recently closed) domain states: name -> state. */
    this.openDomains = new Map()
    /** Number of APPLIED (durable: tmp + rename) writes, seam-wide. */
    this.writeCount = 0
    /** Every applied write (the single-write-durability evidence). */
    this.writeLog = []
    /** Armed crash: the first `n` writes commit; every later write crashes. `null` = disarmed. */
    this.crashAfter = null
  }

  // ------------------------------------------------------- crash arming API

  /** Arm a sticky crash: the first `n` writes commit, every later write crashes mid-atomic-write. */
  armCrashAfterWrites(n) {
    if (!Number.isInteger(n) || n < 0) throw new TypeError('armCrashAfterWrites: n must be a non-negative integer')
    this.crashAfter = n
  }

  /** Disarm the armed crash. */
  clearCrash() {
    this.crashAfter = null
  }

  /** True when a crash is armed. */
  get crashArmed() {
    return this.crashAfter !== null
  }

  /** True when the NEXT durable write would fire the armed crash. */
  crashDue() {
    return this.crashAfter !== null && this.writeCount >= this.crashAfter
  }

  // ------------------------------------------------------------- layout API

  /** The durable dir of one domain (`<scratch>/<domain>`). */
  dirFor(domainName) {
    return join(this.scratchDir, domainName)
  }

  /** The durable file of one table (`<scratch>/<domain>/<table>.json`). */
  pathFor(domainName, table) {
    return join(this.scratchDir, domainName, `${table}.json`)
  }

  /** The L1 domain-stamp file (`<scratch>/<domain>.meta.json`). */
  metaPathFor(domainName) {
    return join(this.scratchDir, `${domainName}.meta.json`)
  }

  /** The in-flight tmp file name for the next write of one table. */
  tmpPathFor(state, table) {
    return join(this.scratchDir, state.spec.name, `${table}.json.${state.instanceId}.${this.writeCount + 1}.tmp`)
  }

  /** Delete the scratch dir (recursive, force — a no-op when absent). */
  destroy() {
    rmSync(this.scratchDir, { recursive: true, force: true })
  }

  // ----------------------------------------------------------- seam surface

  /**
   * Open (or re-open) the named domain from the scratch dir.
   * First open initializes the medium (meta stamp + one empty JSON file per
   * declared table) — that initialization is domain infrastructure, NOT a
   * KvTable write (it is excluded from `writeCount`/`writeLog`).
   * @param spec - the seam spec (`name`, `version`, `tables`).
   * @returns the open domain handle.
   * @throws seam errors `already-open`, `version-mismatch`, `malformed-medium`.
   */
  async open(spec) {
    if (
      spec === null ||
      typeof spec !== 'object' ||
      typeof spec.name !== 'string' ||
      !Number.isInteger(spec.version) ||
      !Array.isArray(spec.tables)
    ) {
      throw seamError('invalid-record', 'FileStorageSeam.open: malformed domain spec')
    }
    const name = spec.name
    const existing = this.openDomains.get(name)
    if (existing !== undefined && !existing.closed) {
      throw seamError('already-open', `domain '${name}' is already open`)
    }
    const domainDir = this.dirFor(name)
    const metaPath = this.metaPathFor(name)
    if (!existsSync(metaPath)) {
      // First open: initialize the medium. The meta write is atomic (tmp +
      // rename) but is infrastructure, not a KvTable durable write.
      mkdirSync(domainDir, { recursive: true })
      const metaText = JSON.stringify({ version: spec.version })
      const metaTmp = `${metaPath}.${this.instanceId}.0.tmp`
      writeFileSync(metaTmp, metaText, 'utf8')
      renameSync(metaTmp, metaPath)
      for (const table of spec.tables) {
        writeFileSync(this.pathFor(name, table), '{}', 'utf8')
      }
    }
    // Rehydrate from the medium (every open, including the first).
    const state = { spec, rows: new Map(), closed: false }
    const metaRaw = readFileSync(metaPath, 'utf8')
    let meta
    try {
      meta = JSON.parse(metaRaw)
    } catch (error) {
      throw seamError(
        'malformed-medium',
        `domain '${name}' meta file is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        { domain: name },
      )
    }
    if (meta === null || typeof meta !== 'object' || Array.isArray(meta) || typeof meta['version'] !== 'number') {
      throw seamError('malformed-medium', `domain '${name}' meta file is not a {"version": number} object`, { domain: name })
    }
    if (meta['version'] !== spec.version) {
      throw seamError(
        'version-mismatch',
        `domain '${name}' is persisted at schema version ${meta['version']}; open requested version ${spec.version}`,
        { found: meta['version'], expected: spec.version },
      )
    }
    const files = readdirSync(domainDir)
    const nonTmp = files.filter((file) => !file.endsWith('.tmp'))
    const declared = new Set(spec.tables.map((table) => `${table}.json`))
    for (const file of nonTmp) {
      if (!declared.has(file)) {
        throw seamError('malformed-medium', `domain '${name}' contains undeclared table file '${file}'`, {
          domain: name,
          found: [...nonTmp].sort(),
          declared: [...spec.tables],
        })
      }
    }
    for (const table of spec.tables) {
      const path = this.pathFor(name, table)
      if (!existsSync(path)) {
        throw seamError('malformed-medium', `domain '${name}' is missing table file '${table}.json'`, { domain: name, table })
      }
      const raw = readFileSync(path, 'utf8')
      let rows
      try {
        rows = JSON.parse(raw)
      } catch (error) {
        throw seamError(
          'malformed-medium',
          `table '${table}' of domain '${name}' is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
          { domain: name, table },
        )
      }
      if (rows === null || typeof rows !== 'object' || Array.isArray(rows)) {
        throw seamError('malformed-medium', `table '${table}' of domain '${name}' is not a JSON object of rows`, { domain: name, table })
      }
      state.rows.set(table, new Map(Object.entries(rows)))
    }
    this.openDomains.set(name, state)
    return this.makeHandle(state)
  }

  /** Close every domain this facility has open (state persists on the medium). */
  async closeAll() {
    for (const state of this.openDomains.values()) {
      state.closed = true
    }
    return undefined
  }

  // ------------------------------------------------------------- internals

  /** The one open domain handle (mirrors the public `Domain` shape). */
  makeHandle(state) {
    return {
      get name() {
        return state.spec.name
      },
      table: (tableName) => {
        if (state.closed) throw seamError('closed', `domain '${state.spec.name}' is closed`)
        if (!state.spec.tables.includes(tableName)) {
          throw seamError('invalid-table', `table '${tableName}' is not declared on '${state.spec.name}'`)
        }
        return this.makeTable(state, tableName)
      },
      close: () => {
        state.closed = true
        return Promise.resolve()
      },
    }
  }

  /** One table handle (mirrors the public `KvTable` shape, values `unknown`). */
  makeTable(state, tableName) {
    const name = state.spec.name
    const rowsOf = () => {
      const rows = state.rows.get(tableName)
      if (rows === undefined) throw seamError('invalid-table', `table '${tableName}' is not declared on '${name}'`)
      return rows
    }
    const checkOpen = () => {
      if (state.closed) throw seamError('closed', `domain '${name}' is closed`)
    }
    return {
      get: (key) => {
        checkOpen()
        return rowsOf().get(key)
      },
      entries: () => {
        checkOpen()
        return [...rowsOf().entries()][Symbol.iterator]()
      },
      keys: () => {
        checkOpen()
        return [...rowsOf().keys()][Symbol.iterator]()
      },
      get size() {
        checkOpen()
        return rowsOf().size
      },
      put: async (key, value) => {
        checkOpen()
        const nextRows = new Map(rowsOf())
        nextRows.set(key, value)
        this.durableWrite(state, tableName, key, 'put', nextRows)
      },
      delete: async (key) => {
        checkOpen()
        const rows = rowsOf()
        const existed = rows.has(key)
        if (!existed) return false // no-op delete performs no durable write (fake-seam parity)
        const nextRows = new Map(rows)
        nextRows.delete(key)
        this.durableWrite(state, tableName, key, 'delete', nextRows)
        return true
      },
      update: async (key, fn) => {
        checkOpen()
        const rows = rowsOf()
        if (this.crashDue()) {
          if (rows.has(key)) {
            const nextRows = new Map(rows)
            nextRows.set(key, fn(rows.get(key)))
            this.durableWrite(state, tableName, key, 'update', nextRows) // throws CrashFault (tmp left behind)
          }
          // crash takes precedence over missing-key (fake-seam ordering); no
          // bytes were about to be written, so no tmp file is left behind
          throw new CrashFault(
            `simulated crash: update of '${key}' on '${name}/${tableName}' (armed after ${this.crashAfter} committed writes)`,
          )
        }
        const current = rows.get(key)
        if (current === undefined) {
          throw seamError('missing-key', `key '${key}' is missing on table '${tableName}' of '${name}'`)
        }
        const next = fn(current)
        const nextRows = new Map(rows)
        nextRows.set(key, next)
        this.durableWrite(state, tableName, key, 'update', nextRows)
        return next // seam parity: update resolves to the UPDATED value
      },
    }
  }

  /**
   * One atomic durable write of the full next table document: tmp + rename.
   * When the armed crash is due: the tmp file IS written (the new bytes),
   * the rename never happens (the target keeps the old bytes), the in-memory
   * rows are NOT advanced, and a `CrashFault` is thrown — the crash-leftover
   * `.tmp` file remains for the (re)opening seam to ignore.
   */
  durableWrite(state, tableName, key, op, nextRows) {
    const target = this.pathFor(state.spec.name, tableName)
    const tmp = this.tmpPathFor(state, tableName)
    const document = JSON.stringify(Object.fromEntries(nextRows))
    writeFileSync(tmp, document, 'utf8')
    if (this.crashDue()) {
      throw new CrashFault(
        `simulated crash: durable write ${this.writeCount + 1} on '${state.spec.name}/${tableName}' key '${key}' (armed after ${this.crashAfter} committed writes); tmp file left behind, target untouched`,
      )
    }
    renameSync(tmp, target)
    state.rows.set(tableName, nextRows)
    this.writeCount += 1
    this.writeLog.push({ domain: state.spec.name, table: tableName, key, op })
  }
}

// ------------------------------------------------------- scratch file helpers

/**
 * One per-test scratch dir under `packages/testkit/test/.tmp-fault/<basename>`
 * (workspace-internal). NOT created here — the seam creates it lazily on
 * first open; delete it with {@link destroyDir} in the test's finally block.
 * @param basename - a plain `[a-z0-9._-]` name identifying the test block.
 */
export function scratchDir(basename) {
  if (typeof basename !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/i.test(basename)) {
    throw new TypeError('scratchDir: basename must be a plain non-empty identifier (no path separators)')
  }
  return join(TEST_TMP_BASE, basename)
}

/** Delete one dir (recursive, force — a no-op when absent). */
export function destroyDir(absDir) {
  rmSync(absDir, { recursive: true, force: true })
}

/** Read one UTF-8 text file (for corruption tampering and assertions). */
export function readText(absPath) {
  return readFileSync(absPath, 'utf8')
}

/**
 * Write one UTF-8 text file PLAIN (non-atomic) — the tamper helper. Parent
 * dirs are created. Use this to corrupt durable files, never for seam writes.
 */
export function writeText(absPath, text) {
  mkdirSync(dirname(absPath), { recursive: true })
  writeFileSync(absPath, text, 'utf8')
}

/** List the file names directly inside one dir. */
export function listFiles(absDir) {
  return readdirSync(absDir)
}

/** The absolute dir of one committed fixture snapshot (`fixtures/<name>`). */
export function fixtureDir(name) {
  return join(FIXTURES_BASE, name)
}

/**
 * Copy one committed fixture snapshot into a FRESH scratch dir (the fixture
 * is consumed, never mutated in place): returns the new scratch dir path.
 */
export function copyFixtureIntoScratch(fixtureName, scratchBaseName) {
  const src = fixtureDir(fixtureName)
  const dst = scratchDir(scratchBaseName)
  mkdirSync(dst, { recursive: true })
  const copy = (sourceDir, targetDir) => {
    for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const sub = join(targetDir, entry.name)
        mkdirSync(sub, { recursive: true })
        copy(join(sourceDir, entry.name), sub)
      } else if (entry.isFile()) {
        writeFileSync(join(targetDir, entry.name), readFileSync(join(sourceDir, entry.name)))
      }
    }
  }
  copy(src, dst)
  return dst
}
