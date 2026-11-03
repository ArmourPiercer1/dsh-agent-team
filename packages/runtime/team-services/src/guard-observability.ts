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
 * exactly two things, and nothing else:
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
 * R3 chain recorder uses (`tests/world-factory/lib/a5sf-evidence.mjs`). It is a
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
  return code === 'IO_POLICY_UNSUPPORTED' ? 'ask' : 'deny'
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
  return async function observedGuard(method: string, hostPath: string): Promise<void> {
    let decision: GuardConsultDecision
    let decidedBy: string
    let denial: TeamIoDenial | null = null
    try {
      await guard(method, hostPath)
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
  return value as GuardConsultFact
}
