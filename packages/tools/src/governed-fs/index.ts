/**
 * Bounded READ pilot — the ToolDefinition face.
 *
 * Contract parity (schema/output/errors/cancel) against the native read tool:
 * host 0.2.0-rc.2 `packages/fs/tool-fs/src/read.ts` — parameters
 * `{file_path, offset?, limit?}` (:79-83), structured outcome
 * `{path, offset, lines[{number,text}], totalLines}` (:153-158), the
 * model-facing envelope and window law of `read-render.ts` (:69-98, :152-169,
 * ported verbatim below with citations), arg law of `read.ts parseReadArgs`
 * (:47-60). Shape parity here is SPEC-LEVEL (golden vectors in tests); the
 * two-mount live parity is booked at pilot acceptance (kit stage), per
 * B-READ-PILOT-DESIGN §5.
 *
 * Policy DELIBERATELY diverges from native (that is the pilot's point):
 * dirfd-chain O_NOFOLLOW walk, nlink>1 reject, admission-bound per call,
 * arbitrary-tree profiles fail closed.
 *
 * @module evidence-governed-fs
 */
import { createHash } from 'node:crypto'
import { GovernedFsError } from './errors.js'
import { closeHandle, FLAGS_SUPPORTED, openVerifiedChain, readFdBytes, recheckHandleIdentity, verifyCallAdmission, verifyLiveAdmission, type AdmissionExpectation, type AdmissionLiveState, type CallAdmission, type DirIdentity, type GovernedReadCaps, type OpenObserver } from './read-body.js'

export { GovernedFsError } from './errors.js'
export * from './read-body.js'

/** Default caps: line/byte law mirrors tool-fs read-render defaults (READ_LIMIT 2000). */
export interface GovernedReadConfig {
  readonly rootDir: string
  /** BLOCK ④ — pinned identity of the trusted root dir (dev+ino). */
  readonly rootIdentity: DirIdentity
  /** 'pinned-trusted-root' is the ONLY published profile (PoC3 fail-closed). */
  readonly ioProfile: 'pinned-trusted-root' | 'arbitrary-tree'
  readonly maxSizeBytes?: number
  readonly rejectHardlinks?: boolean
  readonly lineLimit?: number
  readonly maxLineLength?: number
  readonly maxBytes?: number
  readonly observer?: OpenObserver
  /** BLOCK ② — CURRENT live policy view, re-read at the effect boundary. */
  readonly liveAdmission: () => AdmissionLiveState
  /**
   * TEST-ONLY seam (BLOCK ③ determinism): runs synchronously AFTER the
   * verified chain is built and BEFORE the effect-boundary recheck, so a
   * retarget/revoke injected here is caught by the recheck without racing.
   */
  readonly effectBoundarySeam?: () => void
  /** Assembles the expectation for THIS call from the caller's binding layer. */
  expectationFor (filePath: string, offset: number, limit: number): AdmissionExpectation
}

const DEFAULT_CAPS = { lineLimit: 2000, maxLineLength: 2000, maxBytes: 50 * 1024, maxSizeBytes: 16 * 1024 * 1024 }

/** PR1-style fingerprint over the canonical call parameters (caller uses the same). */
/**
 * BLOCK ⑤ (root review @f13707e8): RUNTIME validation of every outcome against
 * the NATIVE output schema shape (additionalProperties:false semantics) —
 * the outcome object itself is checked, not a widened cast.
 */
export function validateNativeOutputShape (value: unknown): void {
  const shapeError = (msg: string): never => { throw new GovernedFsError('GOV_SCHEMA_REJECT', `read outcome violates the native output schema: ${msg}`) }
  if (value === null || typeof value !== 'object') shapeError('not an object')
  const v = value as Record<string, unknown>
  const keys = Object.keys(v).sort().join(',')
  if (keys !== 'lines,offset,path,totalLines') shapeError(`unexpected key set "${keys}" (native allows exactly offset/lines/path/totalLines)`)
  if (typeof v.path !== 'string') shapeError('path must be a string')
  if (!Number.isInteger(v.offset)) shapeError('offset must be an integer')
  if (!Number.isInteger(v.totalLines)) shapeError('totalLines must be an integer')
  if (!Array.isArray(v.lines)) shapeError('lines must be an array')
  for (const l of v.lines as unknown[]) {
    if (l === null || typeof l !== 'object') shapeError('line entry must be an object')
    const e = l as Record<string, unknown>
    const lks = Object.keys(e).sort().join(',')
    if (lks !== 'number,text') shapeError(`line entry key set "${lks}" (native allows exactly number/text)`)
    if (!Number.isInteger(e.number) || typeof e.text !== 'string') shapeError('line entry types')
  }
}

export function fingerprintParameters (canonicalLocator: string, offset: number, limit: number): string {
  return createHash('sha256').update(`governed-read/v1\u0000${canonicalLocator}\u0000${String(offset)}\u0000${String(limit)}`).digest('hex')
}

// ── window + envelope (ported law, host read-render.ts:66-169) ──────────────
interface WindowLine { number: number, text: string }
interface WindowAccumulator { lines: WindowLine[], totalLines: number, outputBytes: number, truncatedByBytes: boolean }

function truncateLine (line: string, maxLineLength: number): string {
  return line.length > maxLineLength ? `${line.substring(0, maxLineLength)}... (line truncated to ${String(maxLineLength)} chars)` : line
}

function buildWindow (text: string, request: { offset: number, limit: number, maxLineLength: number, maxBytes: number }, displayPath: string): { lines: WindowLine[], totalLines: number, truncatedByBytes: boolean } {
  const acc: WindowAccumulator = { lines: [], totalLines: 0, outputBytes: 0, truncatedByBytes: false }
  // Same scan as buildWindow(): split on '\n'; the trailing fragment flushes only when non-empty; '\r' stripped.
  let startPos = 0
  for (;;) {
    const nl = text.indexOf('\n', startPos)
    const raw = nl === -1 ? text.slice(startPos) : text.slice(startPos, nl)
    if (nl !== -1 || raw.length > 0) consumeLine(acc, raw.endsWith('\r') ? raw.slice(0, -1) : raw, request)
    if (nl === -1) break
    startPos = nl + 1
  }
  // finish(): out-of-range offset throws unless empty-file offset 1 (read-render.ts:96-98).
  if (!acc.truncatedByBytes && request.offset > acc.totalLines && !(acc.totalLines === 0 && request.offset === 1)) {
    throw new GovernedFsError('GOV_NOT_FOUND', `offset ${String(request.offset)} is out of range for "${displayPath}" (${String(acc.totalLines)} lines)`)
  }
  return { lines: acc.lines, totalLines: acc.totalLines, truncatedByBytes: acc.truncatedByBytes }
}

function consumeLine (acc: WindowAccumulator, rawLine: string, request: { offset: number, limit: number, maxLineLength: number, maxBytes: number }): void {
  acc.totalLines += 1
  if (acc.truncatedByBytes || acc.totalLines < request.offset || acc.lines.length >= request.limit) return
  const text = truncateLine(rawLine, request.maxLineLength)
  const bytes = Buffer.byteLength(text, 'utf8') + (acc.lines.length > 0 ? 1 : 0)
  if (acc.outputBytes + bytes > request.maxBytes) {
    acc.truncatedByBytes = true
    return
  }
  acc.outputBytes += bytes
  acc.lines.push({ number: acc.totalLines, text })
}

function formatReadOutput (displayPath: string, outcome: { offset: number, lines: WindowLine[], totalLines: number, truncatedByBytes?: true }): string {
  const endLine = outcome.lines.at(-1)?.number ?? Math.max(0, outcome.offset - 1)
  let footer: string
  if (outcome.truncatedByBytes === true) {
    footer = `(Output capped. Showing lines ${String(outcome.offset)}-${String(endLine)}. Use offset=${String(endLine + 1)} to continue.)`
  } else if (endLine < outcome.totalLines) {
    footer = `(Showing lines ${String(outcome.offset)}-${String(endLine)} of ${String(outcome.totalLines)}. Use offset=${String(endLine + 1)} to continue.)`
  } else {
    footer = `(End of file - total ${String(outcome.totalLines)} lines)`
  }
  const body = outcome.lines.length > 0
    ? `${outcome.lines.map((line) => `${String(line.number)}: ${line.text}`).join('\n')}\n\n${footer}`
    : footer
  return `<path>${displayPath}</path>\n<type>file</type>\n<content>\n${body}\n</content>`
}

// ── args law (ported from read.ts parseReadArgs :47-60) ──────────────────────
const ALLOWED_FIELDS = new Set(['file_path', 'offset', 'limit'])

function parseReadArgs (args: Record<string, unknown>, maxLimit: number): { filePath: string, offset: number, limit: number } {
  for (const key of Object.keys(args)) {
    if (!ALLOWED_FIELDS.has(key)) throw new GovernedFsError('GOV_FIELD_UNSUPPORTED', `read pilot does not accept field "${key}" (refused, not stripped)`)
  }
  const filePath = args.file_path
  // native law: a value that is entirely blank rejects; otherwise the raw
  // string rides VERBATIM (root review ⑥ — in-name whitespace is legal).
  if (typeof filePath !== 'string' || filePath.trim().length === 0) throw new GovernedFsError('GOV_BAD_ARGS', 'file_path must be a non-empty string')
  const posInt = (v: unknown, name: string, dflt: number): number => {
    if (v === undefined) return dflt
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < 1) throw new GovernedFsError('GOV_BAD_ARGS', `${name} must be a positive integer`)
    return v
  }
  const offset = posInt(args.offset, 'offset', 1)
  const limit = posInt(args.limit, 'limit', maxLimit)
  if (limit > maxLimit) throw new GovernedFsError('GOV_BAD_ARGS', `limit must be less than or equal to ${String(maxLimit)}`)
  return { filePath, offset, limit }
}

// ── the definition ───────────────────────────────────────────────────────────
export interface GovernedReadOutcome {
  path: string
  offset: number
  lines: WindowLine[]
  totalLines: number
}

export interface GovernedToolExec {
  signal?: AbortSignal
  /** SUPPLIED PER CALL — the definition stores nothing between calls. */
  admissionBinding?: CallAdmission
}

export interface GovernedReadDefinition {
  readonly name: 'read'
  readonly pilot: 'a5-read-pilot'
  readonly description: string
  readonly parameters: Record<string, unknown>
  readonly output: { schema: Record<string, unknown>, render (args: unknown, value: unknown): { type: 'text', text: string }[] }
  execute (args: Record<string, unknown>, exec?: GovernedToolExec): Promise<GovernedReadOutcome>
}

/**
 * Pilot fork of the native `read` ToolDefinition. Registration shape matches
 * the structural definition face (packages/tools/src/types.ts
 * TeamToolDefinition); mounting is pilot-side (profile row / test harness) —
 * production assembly is untouched (root release-order constraint ①).
 */
export function createGovernedReadDefinition (config: GovernedReadConfig): GovernedReadDefinition {
  // PoC3 law: the arbitrary mutable-tree profile is NOT published
  // (controlled-fs ARBITRARY_TREE_PROFILE_PUBLISHED=false) — fail closed HERE.
  // BLOCK ⑧ — a platform missing any resolve-law flag is unsupported, loudly.
  if (!FLAGS_SUPPORTED) {
    throw new GovernedFsError('GOV_PROFILE_UNSUPPORTED', 'this platform lacks O_NOFOLLOW/O_DIRECTORY/O_NONBLOCK; the pilot refuses to run with defaulted (0) flags')
  }
  if (config.ioProfile !== 'pinned-trusted-root') {
    throw new GovernedFsError('GOV_PROFILE_UNSUPPORTED', 'io profile "arbitrary-tree" is not published; the governed read pilot refuses to serve it (PoC3 fail-closed)')
  }
  const caps: GovernedReadCaps = {
    rootDir: config.rootDir,
    expectedRootIdentity: config.rootIdentity,
    maxSizeBytes: config.maxSizeBytes ?? DEFAULT_CAPS.maxSizeBytes,
    rejectHardlinks: config.rejectHardlinks ?? true,
  }
  const lineLimit = config.lineLimit ?? DEFAULT_CAPS.lineLimit

  return {
    name: 'read',
    pilot: 'a5-read-pilot',
    description: 'Read a UTF-8 text file and return line-numbered content.',
    parameters: {
      file_path: { type: 'string', required: true, description: 'Path to read, resolved by the filesystem backend.' },
      offset: { type: 'number', description: '1-based first line to return. Defaults to 1.' },
      limit: { type: 'number', description: `Maximum number of lines to return. Defaults to ${String(lineLimit)}.` },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          offset: { type: 'integer', required: true },
          lines: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: { number: { type: 'integer', required: true }, text: { type: 'string', required: true } } } },
          totalLines: { type: 'integer', required: true },
        },
      },
      render (args: unknown, value: unknown) {
        // native law (read.ts render): parse args, DERIVE truncatedByBytes —
        // the flag never rides on the outcome object (BLOCK ⑤).
        const input = parseReadArgs((args ?? {}) as Record<string, unknown>, lineLimit)
        const v = value as GovernedReadOutcome
        const endLine = v.lines.at(-1)?.number ?? Math.max(0, v.offset - 1)
        const truncatedByBytes = v.lines.length < input.limit && endLine < v.totalLines
        return [{ type: 'text' as const, text: formatReadOutput(v.path, { offset: v.offset, lines: v.lines, totalLines: v.totalLines, ...(truncatedByBytes ? { truncatedByBytes: true as const } : {}) }) }]
      },
    },
    async execute (args: Record<string, unknown>, exec?: GovernedToolExec): Promise<GovernedReadOutcome> {
      const signal = exec?.signal
      if (signal?.aborted === true) throw new GovernedFsError('GOV_ABORTED', 'read refused: execution signal already aborted')
      const input = parseReadArgs(args, lineLimit)
      const expectation = config.expectationFor(input.filePath, input.offset, input.limit)
      // per-call admission BEFORE any filesystem touch (T-L7 law).
      verifyCallAdmission(expectation, exec?.admissionBinding)
      const handle = openVerifiedChain(caps.rootDir, input.filePath, caps, signal, config.observer)
      try {
        // BLOCK ③ determinism seam: retarget/revoke injected here is caught
        // by the effect-boundary recheck below (synchronous, non-racing).
        config.effectBoundarySeam?.()
        // BLOCK ② — re-read CURRENT policy state at the effect boundary.
        verifyLiveAdmission(exec?.admissionBinding as CallAdmission, config.liveAdmission())
        // BLOCK ③ — verified handle must still match the directory entry.
        recheckHandleIdentity(handle, config.observer)
        const bytes = readFdBytes(handle, signal, config.observer)
        const text = bytes.toString('utf8')
        const window = buildWindow(text, { offset: input.offset, limit: input.limit, maxLineLength: config.maxLineLength ?? DEFAULT_CAPS.maxLineLength, maxBytes: config.maxBytes ?? DEFAULT_CAPS.maxBytes }, expectation.canonicalLocator)
        const outcome: GovernedReadOutcome = { path: expectation.canonicalLocator, offset: input.offset, lines: window.lines, totalLines: window.totalLines }
        validateNativeOutputShape(outcome)
        return outcome
      } finally {
        closeHandle(handle)
      }
    },
  }
}
