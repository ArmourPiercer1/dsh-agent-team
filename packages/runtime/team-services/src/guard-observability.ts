/**
 * Alpha.5 P2 seam — mechanically observable guard consultations, and a plain
 * file transport so a DIFFERENT process can read what the installing process
 * actually consulted.
 *
 * WHY THIS EXISTS: `installToolBindingRealm` builds the confined Provider's
 * guard closure itself and never returns it (`install.ts:293` at the base of
 * this package), so from outside the module "the guard was consulted for this
 * call" was an inference from the base Provider having run, not an observation.
 * An in-process callback alone could not fix that for a C2 suite: the suite
 * runs in its own process, the Host in another. This module therefore owns
 * exactly three things, and nothing else:
 *
 *   1. {@link observeGuard} — an additive wrapper around the ONE guard the
 *      confined Provider already calls. It records the guard's OWN decision
 *      (the typed `TeamIoDenial` code, or allow) BEFORE the Provider delegates,
 *      then rethrows the original refusal. It never decides anything: no
 *      locator algebra, no policy re-evaluation, no second oracle.
 *   2. {@link createGuardConsultFileSink} / {@link readGuardConsultFile} — an
 *      append-only JSONL transport (and its strict reader). The file is
 *      EVIDENCE TRANSPORT, NOT AUTHORITY: it carries facts the installing
 *      process reported; it grants nothing and is not a ledger.
 *   3. PD-19 {@link attachGuardToolCallAttribution} — an ATTRIBUTION-ONLY
 *      carrier that names the `tools/execute` dispatch a consultation happened
 *      inside, so the fact carries `tool` + `callId` instead of only a
 *      timestamp and a locator. It is not a policy input and cannot admit,
 *      refuse, select or reorder anything.
 *
 * FAIL-CLOSED ON THE TRANSPORT: when an observer/sink is supplied and a
 * consultation record cannot be written, the observed call is REFUSED with
 * {@link GuardObservationError} — carrying both the decision the guard made
 * and the transport failure. An unrecorded allow never reaches the Provider,
 * and an unrecorded refusal is never silently swapped for an allow. The
 * DEFAULT path (no observer) is untouched: `install.ts` uses the original
 * guard object and the original class when no observer is passed.
 *
 * @module @dsh-agent-team/runtime/team-services/guard-observability
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { appendFile, readFile } from 'node:fs/promises'
import type { FsGuard } from './fs.js'
import { TeamIoDenial, type TeamIoDenialCode } from './types.js'

/** The one record schema. A reader that does not know it must fail loud. */
export const GUARD_CONSULT_SCHEMA = 'a5sf-guard-consult/1'

/** `decidedBy` for an admitted consultation (refusals carry the denial code). */
export const GUARD_ALLOW_DECIDED_BY = 'ALLOW'

/** Closed transport-refusal vocabulary (this module; not the install codes). */
export const GUARD_CONSULT_TRANSPORT_CODES = Object.freeze([
  /** the sink was created without a usable file path */
  'SINK_PATH_REQUIRED',
  /** the file is not valid JSONL of {@link GUARD_CONSULT_SCHEMA} records */
  'CONSULT_FILE_INVALID',
] as const)

export type GuardConsultTransportCode = (typeof GUARD_CONSULT_TRANSPORT_CODES)[number]

/** Which realm the consultation came from (the same guard shape enforces both). */
export type GuardConsultRealm = 'member' | 'binding'

/**
 * The lane the guard's own typed outcome maps to. Two values are direct
 * (`allow`, `*_DENIED` ⇒ `deny`); `IO_POLICY_UNSUPPORTED` is the guard's
 * "cannot prove admission" refusal and is the `ask` lane, the same mapping the
 * R3 chain recorder uses (`tests/world-factory/lib/a5sf-evidence.mjs`). So is
 * `IO_ASK_REQUIRES_APPROVAL` (A5-DUAL-PLANE-01): the guard PROVED the lane's
 * disposition is `ask` and refused because no approval can be consumed here —
 * the fact must report `ask` (not `deny`) so the three-way comparison sees the
 * lane the author declared while the effect still shows a refusal. It is a
 * MAPPING of the guard's own code, not a new decision.
 */
export type GuardConsultDecision = 'allow' | 'deny' | 'ask'

/** One consultation, exactly as the installing process saw it. */
export interface GuardConsultFact {
  /** {@link GUARD_CONSULT_SCHEMA}; makes an alien line fail loud, not parse. */
  readonly schema: typeof GUARD_CONSULT_SCHEMA
  readonly realm: GuardConsultRealm
  readonly memberIdentity: string
  /** The compiled tool binding, or `null` for the Member ceiling realm. */
  readonly toolBindingIdentity: string | null
  readonly policyRevision: string
  /** The Provider method that asked the guard (e.g. `readText`). */
  readonly method: string
  /** The provider-resolved host path the guard was asked about. */
  readonly locator: string
  readonly decision: GuardConsultDecision
  /** `ALLOW`, or the guard's own `TeamIoDenial` code for a refusal. */
  readonly decidedBy: string
  /** 1-based per observed guard (per realm); file order is the cross-realm order. */
  readonly sequence: number
  readonly observedAt: string
  /**
   * PD-19 (additive): the NATIVE tool whose dispatch asked this guard, as the
   * registry's own `ToolExecution.name` (`read`, `grep`, `bash`, …), or `null`
   * when the consultation did not happen inside a tool dispatch (a direct
   * Provider call, a host-side service read, or a fact written before this
   * field existed).
   *
   * ATTRIBUTION ONLY. The guard never reads these fields and the decision is
   * computed exactly as before; they name the call the decision belongs to so a
   * reader can join this fact to the tool-call record instead of inferring the
   * join from time and locator. Absent on pre-PD-19 facts — an old sink/reader
   * pair stays valid.
   */
  readonly tool?: string | null
  /**
   * PD-19 (additive): the registry-owned tool-call identity
   * (`ToolExecution.callId`) of the dispatch that produced this consultation, or
   * `null` when there was no tool dispatch in scope. Same attribution-only law
   * as {@link GuardConsultFact.tool}: it is never an admission input and never
   * widens, selects or reorders a policy.
   */
  readonly callId?: string | null
  /**
   * OPTIONAL, additive: what the consulting face did to the request BEYOND the
   * lane decision (BL-16: the confined `spawn` face records that it disabled
   * rg's ancestor/VCS ignore discovery, and exactly which semantics that
   * removed). The guard's decision is unchanged and the fact count is
   * unchanged — this is the recorded answer to "why did my grep behave this
   * way", not a second decision.
   */
  readonly annotations?: readonly string[]
}

/** What a caller may hand `install*`/`mount*` to observe consultations. */
export type GuardConsultObserver = (fact: GuardConsultFact) => void | Promise<void>

/** The realm identity an observed guard records on every fact. */
export interface GuardConsultContext {
  readonly realm: GuardConsultRealm
  readonly memberIdentity: string
  readonly toolBindingIdentity: string | null
  readonly policyRevision: string
}

/**
 * PD-19 — the TOOL-CALL identity a consultation happened inside, taken from the
 * registry's own dispatch (`@deepseek-ai/dsh-tools` `ToolExecution`). This is
 * the join key the fact was missing: `tool` is the model-visible native tool
 * name and `callId` is the registry-owned per-call id.
 *
 * This type is ATTRIBUTION ONLY. It is not a policy input, not a capability,
 * not a second invocation binder, and it never selects a Provider or a lane.
 */
export interface GuardToolCallAttribution {
  readonly tool: string
  readonly callId: string
}

/**
 * The minimal public event surface {@link attachGuardToolCallAttribution}
 * needs. `@deepseek-ai/cordis`' `Context` satisfies it structurally; it is
 * spelled out here so this module does not import the tool runtime (and cannot
 * grow a dependency on it).
 */
export interface GuardToolCallEventContext {
  on(
    event: 'tools/execute',
    listener: (
      exec: Readonly<{ name?: unknown; callId?: unknown }>,
      next: () => Promise<unknown>,
    ) => Promise<unknown>,
  ): unknown
}

/**
 * The ONE ambient carrier of the current tool dispatch. It exists because the
 * confined Provider's guard is called from INSIDE the tool body, where the
 * registry's `ToolExecution` is not passed down. The `tools/execute` waterfall
 * is the public seam that sees the call identity; {@link attachGuardToolCallAttribution}
 * runs `next()` inside this store so every guard consultation reached from the
 * body can name its call.
 *
 * WHY THIS IS NOT A SECOND POLICY SOURCE: nothing in the admission path reads
 * it. `observeGuard` copies the store into the FACT it was already writing;
 * `createMemberFsGuard` / `createMemberSubprocessGuard` / the web and terminal
 * guards never look at it. An empty store means the fact records `null`, never
 * a guessed id.
 */
const TOOL_CALL_ATTRIBUTION = new AsyncLocalStorage<GuardToolCallAttribution>()

/** The tool call this async context is running under, if any. */
export function currentGuardToolCallAttribution(): GuardToolCallAttribution | undefined {
  return TOOL_CALL_ATTRIBUTION.getStore()
}

/**
 * Wrap every `tools/execute` dispatch in this context so guard consultations
 * made by the tool body are attributed to that dispatch.
 *
 * The listener is deliberately inert with respect to the waterfall: it calls
 * `next()` exactly once and returns its value untouched, never mutates `exec`
 * (not even `exec.signal`), and never throws on its own. A dispatch without a
 * usable `name`/`callId` runs unattributed — the honest `null`, never a
 * synthetic id.
 *
 * @returns an idempotent detach function.
 */
export function attachGuardToolCallAttribution(ctx: GuardToolCallEventContext): () => void {
  const subscription = ctx.on('tools/execute', (exec, next) => {
    const tool = nonBlankString(exec?.name)
    const callId = nonBlankString(exec?.callId)
    if (tool === undefined || callId === undefined) return next()
    return TOOL_CALL_ATTRIBUTION.run(Object.freeze({ tool, callId }), () => next())
  })
  let detached = false
  const detach = (): void => {
    if (detached) return
    detached = true
    if (typeof subscription === 'function') subscription()
  }
  return detach
}

/** `value` when it is a non-blank string, else `undefined` (never fabricates). */
function nonBlankString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

/** A consultation that could not be transported. The call is refused. */
export class GuardObservationError extends Error {
  readonly code = 'GUARD_OBSERVATION_FAILED' as const
  /** The record the observer refused to accept (the decision is NOT lost). */
  readonly fact: GuardConsultFact
  readonly decision: GuardConsultDecision
  readonly decidedBy: string
  /** The guard's original refusal, when the decision was a refusal. */
  readonly denial: TeamIoDenial | null

  constructor(fact: GuardConsultFact, cause: unknown, denial: TeamIoDenial | null) {
    super(
      `GUARD_OBSERVATION_FAILED: the guard's '${fact.decision}' decision for ${fact.method}(${fact.locator}) could not be recorded (${cause instanceof Error ? cause.message : String(cause)}); the call was refused so an unrecorded decision never becomes an effect`,
      { cause },
    )
    this.name = 'GuardObservationError'
    this.fact = fact
    this.decision = fact.decision
    this.decidedBy = fact.decidedBy
    this.denial = denial
  }
}

/** A malformed sink path or a malformed consultation file. */
export class GuardConsultTransportError extends Error {
  readonly code: GuardConsultTransportCode
  readonly detail: string

  constructor(code: GuardConsultTransportCode, detail: string) {
    super(`${code}: ${detail}`)
    this.name = 'GuardConsultTransportError'
    this.code = code
    this.detail = detail
  }
}

/** Map a guard refusal code to the lane it reports (see the type's doc). */
function laneOfRefusal(code: TeamIoDenialCode): GuardConsultDecision {
  return code === 'IO_POLICY_UNSUPPORTED' || code === 'IO_ASK_REQUIRES_APPROVAL' ? 'ask' : 'deny'
}

/**
 * Wrap ONE guard so every consultation is reported to `observer` before the
 * confined Provider delegates. The returned guard performs the SAME admission
 * call as the guard it wraps; it only adds the report and the fail-closed
 * transport rule.
 *
 * A non-`TeamIoDenial` error is NOT a decision (a resolver fault outside the
 * guard's vocabulary): it is rethrown unrecorded rather than labelled.
 */
export function observeGuard(
  guard: FsGuard,
  observer: GuardConsultObserver,
  context: GuardConsultContext,
): FsGuard {
  let sequence = 0
  return async function observedGuard(method: string, hostPath: string, annotations?: readonly string[]): Promise<void> {
    // PD-19: the dispatch this consultation belongs to, read ONCE at entry from
    // the async context the `tools/execute` waterfall established. Reading it is
    // the only thing attribution does here — `guard(method, hostPath, …)` below
    // is the same call, on the same inputs, as before this field existed.
    const attribution = TOOL_CALL_ATTRIBUTION.getStore()
    let decision: GuardConsultDecision
    let decidedBy: string
    let denial: TeamIoDenial | null = null
    try {
      await guard(method, hostPath, annotations)
      decision = 'allow'
      decidedBy = GUARD_ALLOW_DECIDED_BY
    } catch (error) {
      if (!(error instanceof TeamIoDenial)) throw error
      decision = laneOfRefusal(error.code)
      decidedBy = error.code
      denial = error
    }

    sequence += 1
    const fact: GuardConsultFact = Object.freeze({
      schema: GUARD_CONSULT_SCHEMA,
      realm: context.realm,
      memberIdentity: context.memberIdentity,
      toolBindingIdentity: context.toolBindingIdentity,
      policyRevision: context.policyRevision,
      method,
      locator: hostPath,
      decision,
      decidedBy,
      sequence,
      observedAt: new Date().toISOString(),
      // PD-19: always present, `null` when there was no tool dispatch in scope.
      // An explicit null is the honest "this fact cannot be attributed", and it
      // keeps the absence recordable instead of silently omitting the question.
      tool: attribution?.tool ?? null,
      callId: attribution?.callId ?? null,
      // The key is absent (not `undefined`) when there is nothing to say, so an
      // unannotated fact is byte-identical to the previous schema.
      //
      // A3 (BL-16 row-1 follow-up): annotations describe the INVOCATION that
      // ran — "rg ran with --no-ignore-parent --no-ignore-vcs … .git was not
      // read". Only an ALLOW fact may make that claim: a `deny` (or `ask`) is
      // decided BEFORE the confined Provider is called, so no process exists
      // and the fact is the refusal itself. Attaching the notes to a deny made
      // a denied directory root's fact assert an execution that never happened.
      ...(annotations === undefined || annotations.length === 0 || decision !== 'allow'
        ? {}
        : { annotations: Object.freeze([...annotations]) }),
    })

    try {
      await observer(fact)
    } catch (error) {
      // Fail closed: the decision was made but could not be transported, so the
      // call must not proceed. Both halves are on the thrown error.
      throw new GuardObservationError(fact, error, denial)
    }

    if (denial !== null) throw denial
  }
}

/** The file sink a caller hands to {@link observeGuard}. */
export interface GuardConsultFileSink {
  readonly path: string
  record(fact: GuardConsultFact): Promise<void>
}

/** Options for {@link createGuardConsultFileSink}. */
export interface GuardConsultFileSinkOptions {
  /** Append-only JSONL path. The parent directory must already exist. */
  readonly path: string
}

/**
 * A plain append-only JSONL sink. Writes are serialised so the file order is
 * the consultation order. The sink owns NO counter and NO ledger: each line is
 * the fact it was handed, verbatim, plus the schema the fact already carries.
 * A write failure rejects (the guard then refuses the call).
 */
export function createGuardConsultFileSink(options: GuardConsultFileSinkOptions): GuardConsultFileSink {
  const path = options?.path
  if (typeof path !== 'string' || path.trim() === '') {
    throw new GuardConsultTransportError('SINK_PATH_REQUIRED', 'a guard-consult file sink needs a non-blank file path')
  }
  let tail: Promise<unknown> = Promise.resolve()
  return Object.freeze({
    path,
    record(fact: GuardConsultFact): Promise<void> {
      const line = `${JSON.stringify(fact)}\n`
      // Serialise appends: line N+1 is written after line N settled, so the
      // file order is the observation order even with concurrent calls.
      const write = tail.then(() => appendFile(path, line, { encoding: 'utf8', flag: 'a' }))
      tail = write.then(
        () => undefined,
        () => undefined,
      )
      return write
    },
  })
}

/** Read + validate an append-only consultation file. Missing file rejects. */
export async function readGuardConsultFile(path: string): Promise<GuardConsultFact[]> {
  const text = await readFile(path, 'utf8')
  const lines = text.split('\n')
  const facts: GuardConsultFact[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line === undefined || line.trim() === '') continue
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch (error) {
      throw new GuardConsultTransportError(
        'CONSULT_FILE_INVALID',
        `line ${String(index + 1)} of '${path}' is not JSON (${error instanceof Error ? error.message : String(error)})`,
      )
    }
    facts.push(assertFact(parsed, path, index + 1))
  }
  return facts
}

/** Validate one parsed line as a {@link GuardConsultFact}. */
function assertFact(value: unknown, path: string, line: number): GuardConsultFact {
  const invalid = (detail: string): GuardConsultTransportError =>
    new GuardConsultTransportError('CONSULT_FILE_INVALID', `line ${String(line)} of '${path}': ${detail}`)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw invalid('a consultation record must be a JSON object')
  }
  const record = value as Record<string, unknown>
  if (record.schema !== GUARD_CONSULT_SCHEMA) {
    throw invalid(`schema is ${JSON.stringify(record.schema)}, expected '${GUARD_CONSULT_SCHEMA}'`)
  }
  for (const key of ['realm', 'memberIdentity', 'policyRevision', 'method', 'locator', 'decision', 'decidedBy', 'observedAt'] as const) {
    if (typeof record[key] !== 'string') throw invalid(`'${key}' must be a string`)
  }
  if (record.realm !== 'member' && record.realm !== 'binding') throw invalid(`realm is ${JSON.stringify(record.realm)}`)
  const decision = record.decision
  if (decision !== 'allow' && decision !== 'deny' && decision !== 'ask') {
    throw invalid(`decision is ${JSON.stringify(decision)}`)
  }
  const toolBindingIdentity = record.toolBindingIdentity
  if (toolBindingIdentity !== null && typeof toolBindingIdentity !== 'string') {
    throw invalid(`'toolBindingIdentity' must be a string or null`)
  }
  if (!Number.isInteger(record.sequence) || (record.sequence as number) < 1) {
    throw invalid(`'sequence' must be a positive integer`)
  }
  // PD-19 additive attribution: a pre-PD-19 fact omits both keys, and the
  // previous schema must stay VALID. When present, each is a non-blank string
  // or an explicit null (the emitter's "no tool dispatch in scope").
  for (const key of ['tool', 'callId'] as const) {
    const value = record[key]
    if (value === undefined || value === null) continue
    if (typeof value !== 'string' || value.trim() === '') {
      throw invalid(`'${key}' must be a non-blank string or null when present`)
    }
  }
  // Additive optional field: when present it must be a non-empty array of
  // non-empty strings. Its ABSENCE is the previous schema, so old sinks read
  // unchanged.
  if (record.annotations !== undefined) {
    const annotations = record.annotations
    if (!Array.isArray(annotations) || annotations.length === 0
      || annotations.some((note) => typeof note !== 'string' || note.trim() === '')) {
      throw invalid('\'annotations\' must be a non-empty array of non-empty strings when present')
    }
  }
  return value as GuardConsultFact
}
