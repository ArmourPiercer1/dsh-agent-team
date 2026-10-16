/**
 * `AssuranceContract` — one of THREE independent dimensions (design §2.1,
 * S0 matrix §3): `implementationOrigin` (DSH native / Team trusted extension
 * / standalone runner / remote Provider), `executionBoundary` (trusted Host /
 * confined subprocess / delegated remote), and the per-dimension `assurance`
 * record. The retired `native/custom/shadow-run` "safety level" triple is a
 * FORBIDDEN old usage (matrix §3); this file cannot express it.
 *
 * THE DERIVATION LAW (design §1.4, verbatim): "Assurance 从有效 Policy 推导
 * 所需执行能力，不是可放宽权限的第二组开关。Provider 必须完整兑现其声称支持
 * 的维度." This module therefore answers CAPABILITY questions
 * ({@link assuranceSatisfies}) and never grants anything:
 *
 *  - `hard`          — the guarantee must be OS/Provider-ENFORCED → only
 *                      `enforced` satisfies it;
 *  - `authoritative` — an enforced guarantee or an honest author-trusted one
 *                      (same-process trusted mediation, design §3.6) counts;
 *  - `partial`, `unsupported`, `untested` NEVER satisfy either — the
 *                      no-overclaim law (design §5: never infer "strict
 *                      Profile green" from "Landlock READ_FILE blocks").
 *
 * Purity: no `node:*`, no I/O.
 *
 * @module @dsh-agent-team/domain/tool-governance/assurance
 */

import {
  closeRecordKeys,
  finish,
  isRecord,
  type ParseResult,
  type ProblemSink,
} from './parse-util.js'

/** `implementationOrigin` values (design §2.1, verbatim). */
export const IMPLEMENTATION_ORIGINS = ['dsh-native', 'team-trusted-extension', 'standalone-runner', 'remote-provider'] as const

/** One implementation origin. */
export type ImplementationOrigin = (typeof IMPLEMENTATION_ORIGINS)[number]

/** `executionBoundary` values (design §2.1, verbatim three). */
export const EXECUTION_BOUNDARIES = ['trusted-host', 'confined-subprocess', 'delegated-remote'] as const

/** One execution boundary. */
export type ExecutionBoundary = (typeof EXECUTION_BOUNDARIES)[number]

/** The per-dimension assurance levels (design §2.1, verbatim five). */
export const ASSURANCE_LEVELS = ['enforced', 'author-trusted', 'partial', 'unsupported', 'untested'] as const

/** One assurance level. */
export type AssuranceLevel = (typeof ASSURANCE_LEVELS)[number]

/** The dimensions the assurance record must state (design §2.1 list). */
export const ASSURANCE_DIMENSIONS = [
  'content-read',
  'directory-metadata',
  'write',
  'alias',
  'network-destination',
  'inherit-cancel',
] as const

/** One assurance dimension. */
export type AssuranceDimension = (typeof ASSURANCE_DIMENSIONS)[number]

/** How much a consumer demands of one dimension. */
export type AssuranceRequirement = 'hard' | 'authoritative'

/**
 * The per-dimension record of design §2.1 (verbatim): "逐项记录机制、作用
 * Realm、可信根、证据与 enforced | author-trusted | partial | unsupported |
 * untested". EVERY field is stated on EVERY dimension — a bare level with no
 * mechanism, no realm, no trust root and no evidence is exactly the
 * overclaim §1.4 refuses. `mechanism`/`trustRoot`/`evidence` are REQUIRED
 * keys whose VALUE may be `null`: the honest way to state "none exists"
 * (an `untested` dimension has no evidence — it must SAY so, not omit the
 * field, and never fabricate a non-null). `realmId` is a required non-empty
 * string: an assurance claim holds in a NAMED Realm and travels to no other
 * (Realm 不可混淆). M-2 of the PR0 review; PR3/PR4 evidence rows land IN
 * these fields, they do not redefine them.
 */
export interface AssuranceDimensionRecord {
  readonly level: AssuranceLevel
  readonly mechanism: string | null
  readonly realmId: string
  readonly trustRoot: string | null
  readonly evidence: string | null
}

/** The three-dimension contract of one bound tool/provider. */
export interface AssuranceContract {
  readonly implementationOrigin: ImplementationOrigin
  readonly executionBoundary: ExecutionBoundary
  readonly assurance: Readonly<Record<AssuranceDimension, AssuranceDimensionRecord>>
}

function parseNullableString(raw: unknown, path: string, problems: ProblemSink): string | null | undefined {
  if (raw === null) return null
  if (typeof raw !== 'string') {
    problems.push({ code: 'field-type', path, detail: 'must be a non-empty string or an explicit null ("none", stated)' })
    return undefined
  }
  if (raw.trim().length === 0) {
    problems.push({ code: 'empty-string', path, detail: 'state null for "none" — a blank string claims nothing and proves nothing' })
    return undefined
  }
  return raw
}

function parseDimensionRecord(raw: unknown, dimension: AssuranceDimension, problems: ProblemSink): AssuranceDimensionRecord | undefined {
  const path = `$.assurance.${dimension}`
  if (!isRecord(raw)) {
    problems.push({ code: 'not-a-record', path, detail: 'each dimension records level + mechanism + realmId + trustRoot + evidence (design §2.1)' })
    return undefined
  }
  closeRecordKeys(raw, ['level', 'mechanism', 'realmId', 'trustRoot', 'evidence'], path, problems)
  const levelRaw = raw['level']
  let level: AssuranceLevel | undefined
  if (levelRaw === undefined) {
    problems.push({ code: 'missing-field', path: `${path}.level`, detail: 'the dimension must state its level' })
  } else if (typeof levelRaw !== 'string' || !(ASSURANCE_LEVELS as readonly string[]).includes(levelRaw)) {
    problems.push({ code: 'value-outside-closed-set', path: `${path}.level`, detail: `assurance level must be one of ${ASSURANCE_LEVELS.join(' | ')}` })
  } else {
    level = levelRaw as AssuranceLevel
  }
  const mechanism = parseNullableString(raw['mechanism'], `${path}.mechanism`, problems)
  const realmIdRaw = raw['realmId']
  let realmId: string | undefined
  if (realmIdRaw === undefined || realmIdRaw === null) {
    problems.push({ code: 'missing-field', path: `${path}.realmId`, detail: 'an assurance claim names the Realm it holds in (作用 Realm) — it holds in no other' })
  } else if (typeof realmIdRaw !== 'string' || realmIdRaw.trim().length === 0) {
    problems.push({ code: 'field-type', path: `${path}.realmId`, detail: '`realmId` must be a non-empty string' })
  } else {
    realmId = realmIdRaw
  }
  const trustRoot = parseNullableString(raw['trustRoot'], `${path}.trustRoot`, problems)
  const evidence = parseNullableString(raw['evidence'], `${path}.evidence`, problems)
  if (level === undefined || mechanism === undefined || realmId === undefined || trustRoot === undefined || evidence === undefined) {
    return undefined
  }
  return { level, mechanism, realmId, trustRoot, evidence }
}

/**
 * Strict parse: the record must state EVERY dimension (a missing one is a
 * refusal, never an implicit `untested`), each as a full §2.1 record, and the
 * two origin/boundary fields from their closed sets.
 */
export function parseAssuranceContract(raw: unknown): ParseResult<AssuranceContract> {
  const problems: ProblemSink = []
  if (!isRecord(raw)) {
    return { ok: false, problems: [{ code: 'not-a-record', path: '$', detail: 'an AssuranceContract must be a record' }] }
  }
  closeRecordKeys(raw, ['implementationOrigin', 'executionBoundary', 'assurance'], '$', problems)
  const originRaw = raw['implementationOrigin']
  if (typeof originRaw !== 'string' || !(IMPLEMENTATION_ORIGINS as readonly string[]).includes(originRaw)) {
    problems.push({ code: 'value-outside-closed-set', path: '$.implementationOrigin', detail: `implementationOrigin must be one of ${IMPLEMENTATION_ORIGINS.join(' | ')}` })
  }
  const boundaryRaw = raw['executionBoundary']
  if (typeof boundaryRaw !== 'string' || !(EXECUTION_BOUNDARIES as readonly string[]).includes(boundaryRaw)) {
    problems.push({ code: 'value-outside-closed-set', path: '$.executionBoundary', detail: `executionBoundary must be one of ${EXECUTION_BOUNDARIES.join(' | ')}` })
  }
  const assuranceRaw = raw['assurance']
  let assurance: Record<AssuranceDimension, AssuranceDimensionRecord> | undefined
  if (!isRecord(assuranceRaw)) {
    problems.push({ code: 'field-type', path: '$.assurance', detail: '`assurance` must be a record over every dimension' })
  } else {
    closeRecordKeys(assuranceRaw, ASSURANCE_DIMENSIONS, '$.assurance', problems)
    const built = {} as Record<AssuranceDimension, AssuranceDimensionRecord>
    let complete = true
    for (const dimension of ASSURANCE_DIMENSIONS) {
      const entry = assuranceRaw[dimension]
      if (entry === undefined) {
        problems.push({ code: 'missing-field', path: `$.assurance.${dimension}`, detail: `the Provider must state dimension '${dimension}' (design §1.4: 完整兑现其声称支持的维度)` })
        complete = false
        continue
      }
      const record = parseDimensionRecord(entry, dimension, problems)
      if (record === undefined) {
        complete = false
        continue
      }
      built[dimension] = record
    }
    if (complete) assurance = built
  }
  return finish(problems, () => ({
    implementationOrigin: originRaw as ImplementationOrigin,
    executionBoundary: boundaryRaw as ExecutionBoundary,
    assurance: assurance as Record<AssuranceDimension, AssuranceDimensionRecord>,
  }))
}

/**
 * Does the contract actually carry the demanded capability per dimension?
 * Reports every failing dimension (collected, never the first). Reads the
 * LEVEL only — the mechanism/trustRoot/evidence fields are what a reviewer
 * (or PR3/PR4's evidence gate) checks the level claim against; the
 * derivation law keeps this a capability question, never a grant.
 */
export function assuranceSatisfies(
  contract: AssuranceContract,
  required: Readonly<Partial<Record<AssuranceDimension, AssuranceRequirement>>>,
): { readonly ok: boolean; readonly failing: readonly AssuranceDimension[] } {
  const failing: AssuranceDimension[] = []
  for (const dimension of ASSURANCE_DIMENSIONS) {
    const demand = required[dimension]
    if (demand === undefined) continue
    const level = contract.assurance[dimension].level
    const satisfied = demand === 'hard' ? level === 'enforced' : level === 'enforced' || level === 'author-trusted'
    if (!satisfied) failing.push(dimension)
  }
  return { ok: failing.length === 0, failing }
}
