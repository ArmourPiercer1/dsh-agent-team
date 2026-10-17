/**
 * The SHIPPING v4 authoring→internal mapping tables (VNEXT-SCHEMA-ADR §1 B3
 * mapping laws, M-2 "mapping tables"). Pure data + pure composition over the
 * frozen DEFAULT-DENY engine (`field-mapping.ts`) — no I/O, no clock.
 *
 * Shape of the composition: the ENGINE owns each closed lane record (exact
 * cover both ways: every source leaf mapped, every map source present); a
 * thin WRAPPER owns the closed GROUPING (entry → core + three lanes +
 * execution), and it refuses with the SAME closed code vocabulary. A key the
 * tables do not name is therefore refused at every level — there is no
 * branch of this file that drops an unmapped field.
 *
 * Resource declarations: RESTRICTED lanes list concrete locators, so each
 * list item becomes one resource DECLARATION candidate
 * `{lane, disposition, locator, inferredKind, rights}` (the schema phase
 * stays ZERO-NORMALIZATION — B5/NRM-1: canonicalization to a canonical
 * ResourceRef is the trusted provider's step, and `parseResourceRef` stays
 * the single parser that turns one into a `ResourceRef`; test a5sr3 pins
 * every filesystem candidate through it). A mode-`all` lane declares NO
 * locator on purpose: emitting a synthesized realm-root locator would be a
 * migration INVENTING a resource; the mode flag alone carries the
 * declaration and the trusted assembly instantiates the realm.
 *
 * @module @dsh-agent-team/domain/vnext-field-mapping/v4-authoring-map
 */

import { declareFieldMapping, projectThroughMap, type FieldMap, type MappingRejection, type MappingResult } from './field-mapping.js'

export interface V4AuthoringMaps {
  readonly core: FieldMap
  readonly execution: FieldMap
  readonly rwByMode: Readonly<Record<'all' | 'restricted', FieldMap>>
  readonly networkByMode: Readonly<Record<'allow' | 'restricted' | 'deny', FieldMap>>
}

type Decl = { readonly ok: true; readonly map: FieldMap } | MappingRejection

function checked(label: string, decl: Decl, failures: string[]): FieldMap | null {
  if (decl.ok) return decl.map
  failures.push(`${label}: ${decl.code}`)
  return null
}

/**
 * Declare every v4 authoring map. Declaration-time law: a collision or a
 * malformed path here is a refusal of the WHOLE table set (partial tables
 * must never exist).
 */
export function declareV4AuthoringMaps(): { readonly ok: true; readonly maps: V4AuthoringMaps } | MappingRejection {
  const failures: string[] = []
  const core = checked('core', declareFieldMapping([
    { sourcePath: 'owner', targetKey: 'authoringOwner' },
    { sourcePath: 'name', targetKey: 'toolName' },
    { sourcePath: 'authorization', targetKey: 'authorization' },
  ]), failures)
  const execution = checked('execution', declareFieldMapping([
    { sourcePath: 'implementationOrigin', targetKey: 'implementationOrigin' },
    { sourcePath: 'executionBoundary', targetKey: 'executionBoundary' },
  ]), failures)
  const rwAll = checked('rw.all', declareFieldMapping([
    { sourcePath: 'mode', targetKey: 'mode' },
    { sourcePath: 'deny', targetKey: 'deny' },
  ]), failures)
  const rwRestricted = checked('rw.restricted', declareFieldMapping([
    { sourcePath: 'mode', targetKey: 'mode' },
    { sourcePath: 'allow', targetKey: 'allow' },
    { sourcePath: 'ask', targetKey: 'ask' },
    { sourcePath: 'deny', targetKey: 'deny' },
  ]), failures)
  const networkAllow = checked('network.allow', declareFieldMapping([{ sourcePath: 'mode', targetKey: 'mode' }]), failures)
  const networkRestricted = checked('network.restricted', declareFieldMapping([
    { sourcePath: 'mode', targetKey: 'mode' },
    { sourcePath: 'allow', targetKey: 'allow' },
    { sourcePath: 'ask', targetKey: 'ask' },
    { sourcePath: 'deny', targetKey: 'deny' },
    { sourcePath: 'default', targetKey: 'default' },
  ]), failures)
  const networkDeny = checked('network.deny', declareFieldMapping([
    { sourcePath: 'mode', targetKey: 'mode' },
    { sourcePath: 'default', targetKey: 'default' },
  ]), failures)
  if (core === null || execution === null || rwAll === null || rwRestricted === null || networkAllow === null || networkRestricted === null || networkDeny === null) {
    return { ok: false, code: 'invalid-path', detail: `v4 authoring tables refused at declaration: ${failures.join('; ')}`, fields: failures }
  }
  return {
    ok: true,
    maps: Object.freeze({
      core,
      execution,
      rwByMode: Object.freeze({ all: rwAll, restricted: rwRestricted }),
      networkByMode: Object.freeze({ allow: networkAllow, restricted: networkRestricted, deny: networkDeny }),
    }),
  }
}

function reject(code: MappingRejection['code'], detail: string, fields: readonly string[]): MappingRejection {
  return { ok: false, code, detail, fields }
}

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export interface V4ResourceDeclaration {
  readonly lane: 'read' | 'write' | 'network'
  readonly disposition: 'allow' | 'ask' | 'deny'
  readonly locator: string
  readonly inferredKind: 'workspace' | 'realm-home' | 'absolute-path' | 'network-destination'
  readonly rights: readonly string[]
  /** Schema phase emits DECLARATIONS; a canonical ResourceRef needs the trusted provider (zero-normalization law). */
  readonly canonical: false
}

const LANE_RIGHT: Record<V4ResourceDeclaration['lane'], readonly string[]> = Object.freeze({
  read: Object.freeze(['read']),
  write: Object.freeze(['write']),
  network: Object.freeze(['connect']),
})

function inferKind(lane: V4ResourceDeclaration['lane'], locator: string): V4ResourceDeclaration['inferredKind'] {
  if (lane === 'network') return 'network-destination'
  if (locator.startsWith('~/')) return 'realm-home'
  if (locator.startsWith('/') || /^[A-Za-z]:[\\/]/.test(locator)) return 'absolute-path'
  return 'workspace'
}

function declarationsFor(lane: V4ResourceDeclaration['lane'], projected: Readonly<Record<string, unknown>>): V4ResourceDeclaration[] {
  const out: V4ResourceDeclaration[] = []
  for (const disposition of ['allow', 'ask', 'deny'] as const) {
    const list = projected[disposition]
    if (!Array.isArray(list)) continue // mode:all lanes carry no locator lists BY LAW (see module header)
    for (const locator of list) {
      if (typeof locator !== 'string') continue
      out.push(Object.freeze({ lane, disposition, locator, inferredKind: inferKind(lane, locator), rights: LANE_RIGHT[lane], canonical: false as const }))
    }
  }
  return out
}

/**
 * Project one authoring `toolBindings` entry through the shipped v4 tables.
 * Default-deny at BOTH levels: the wrapper refuses keys outside the closed
 * grouping, the engine refuses keys outside each lane map, and every mapped
 * source must be PRESENT (no implicit defaults).
 */
export function projectV4ToolBindingAuthoring(maps: V4AuthoringMaps, entry: unknown): MappingResult {
  if (!isRec(entry)) return reject('unmapped-source-field', 'a toolBindings entry must be a record before any map applies', ['$'])
  const ENTRY_KEYS = ['owner', 'name', 'authorization', 'io', 'execution']
  for (const key of Object.keys(entry)) {
    if (!ENTRY_KEYS.includes(key)) return reject('unmapped-source-field', `entry key '${key}' has no v4 mapping and is never dropped silently`, [key])
  }
  const missing = ENTRY_KEYS.filter((key) => !Object.hasOwn(entry, key))
  if (missing.length > 0) return reject('missing-source-field', 'declared entries map with no implicit defaults', missing)

  const core = projectThroughMap(maps.core, { owner: entry['owner'], name: entry['name'], authorization: entry['authorization'] })
  if (!core.ok) return core
  const execution = projectThroughMap(maps.execution, entry['execution'])
  if (!execution.ok) return { ...execution, fields: execution.fields.map((f) => `execution.${f}`) }

  if (!isRec(entry['io'])) return reject('unmapped-source-field', 'io must be a record of the three closed lanes', ['io'])
  const io = entry['io']
  const IO_KEYS = ['read', 'write', 'network']
  for (const key of Object.keys(io)) {
    if (!IO_KEYS.includes(key)) return reject('unmapped-source-field', `io key '${key}' has no v4 mapping and is never dropped silently`, [`io.${key}`])
  }
  const ioMissing = IO_KEYS.filter((key) => !Object.hasOwn(io, key))
  if (ioMissing.length > 0) return reject('missing-source-field', 'all three io lanes are declared when io is declared', ioMissing.map((k) => `io.${k}`))

  const laneResults: Record<string, Readonly<Record<string, unknown>>> = {}
  for (const lane of ['read', 'write'] as const) {
    const laneValue = io[lane]
    if (!isRec(laneValue)) return reject('unmapped-source-field', `io.${lane} must be a record with an explicit mode`, [`io.${lane}`])
    const mode = laneValue['mode']
    if (mode !== 'all' && mode !== 'restricted') {
      // Default deny: no map exists for an undeclared mode value — the
      // table set is closed, so there is nothing to project through.
      return reject('unmapped-source-field', `mode '${String(mode)}' selects no declared rw variant`, [`io.${lane}.mode`])
    }
    const projected = projectThroughMap(maps.rwByMode[mode], laneValue)
    if (!projected.ok) return { ...projected, fields: projected.fields.map((f) => `io.${lane}.${f}`) }
    laneResults[lane] = projected.value
  }
  {
    const laneValue = io['network']
    if (!isRec(laneValue)) return reject('unmapped-source-field', 'io.network must be a record with an explicit mode', ['io.network'])
    const mode = laneValue['mode']
    if (mode !== 'allow' && mode !== 'restricted' && mode !== 'deny') {
      return reject('unmapped-source-field', `mode '${String(mode)}' selects no declared network variant`, ['io.network.mode'])
    }
    const projected = projectThroughMap(maps.networkByMode[mode], laneValue)
    if (!projected.ok) return { ...projected, fields: projected.fields.map((f) => `io.network.${f}`) }
    laneResults['network'] = projected.value
  }

  const resourceDeclarations = [
    ...declarationsFor('read', laneResults['read'] as Record<string, unknown>),
    ...declarationsFor('write', laneResults['write'] as Record<string, unknown>),
    ...declarationsFor('network', laneResults['network'] as Record<string, unknown>),
  ]

  return Object.freeze({
    ok: true as const,
    value: Object.freeze({
      ...core.value,
      io: Object.freeze({ read: laneResults['read'], write: laneResults['write'], network: laneResults['network'] }),
      execution: execution.value,
      resourceDeclarations: Object.freeze(resourceDeclarations),
    }),
  })
}
