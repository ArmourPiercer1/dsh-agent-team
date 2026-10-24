/**
 * Type surface for the B-SUBAGENT spawn-side PRODUCTION WIRING. The row
 * types (Plan/ClassifyResult/Row/Definition/Registration) are OWNED by
 * subagent-spawn-adapters.d.mts and travel unchanged through
 * `wiring.definitions` / `wiring.familyRegistrations`; this file declares
 * only what the wiring LAYER adds.
 */
export type SpawnWiringCodes = Readonly<Record<
  | 'INPUT_INVALID'
  | 'ADMISSION_ABSENT'
  | 'CALL_IDENTITY_ABSENT'
  | 'CALL_CANCELLED'
  | 'PLACEMENT_ABSENT'
  | 'EFFECTS_UNPARSABLE'
  | 'ADMIT_PROOF_ABSENT'
  | 'PA_ANSWER_UNRECOGNIZED',
  string
>>

export type SpawnWiringInput = Readonly<{
  providerId?: string
  realmId: string
  captured: Record<string, Readonly<{ native: object; definitionIdentity: string }>>
  liveNative: (name: string) => unknown
  spawnDelegates: Record<string, (args: never, exec: never) => Promise<unknown>>
  liveSpawnDelegates: () => Record<string, (args: never, exec: never) => Promise<unknown>>
  placementFeed: (name: string) => Readonly<{ definitionIdentity?: string; realmId?: string }> | undefined
  paAdmit: (request: Readonly<Record<string, unknown>>) => Promise<unknown>
  observe?: (row: unknown) => void
}>

/** The adapter assembly value (see subagent-spawn-adapters.d.mts for the
 *  member types); declared structurally here because the wiring result
 *  forwards it whole. `rows` stays the minimal consumed surface. */
export type SpawnWiringValue = Readonly<{
  familyId: 'B-SUBAGENT'
  adapterRevision: number
  wiringRevision: number
  providerId: string
  realmId: string
  mountNames: readonly string[]
  definitions: readonly Readonly<Record<string, unknown>>[]
  declared: readonly Readonly<{ name: string; recordIndex: number; status: string; reason: string }>[]
  rowOf: (name: string) => unknown
  admitOnly: (name: string, exec: Readonly<Record<string, unknown>> | undefined) => Promise<Readonly<{ ok: true; name: string }>>
  drain: () => Readonly<{ event: string }>
  inFlight: () => Readonly<{ dispatches: number; refuses: number }>
  familyRegistrations: () => readonly Readonly<{
    name: string
    recordIndex: number
    definitionIdentity: string
    entry: Readonly<{ familyId: string; adapterRevision: number; providerIdentity: string }>
  }>[]
  wiringCodes: SpawnWiringCodes
  namedGaps: Readonly<Record<string, string>>
}>

export type SpawnWiringResult =
  | Readonly<{ ok: true; wiring: SpawnWiringValue }>
  | Readonly<{ ok: false; code: string; message: string }>

export declare const A5_B_SPAWN_WIRING_REVISION: number
export declare const A5_B_SPAWN_WIRING_CODES: SpawnWiringCodes
export declare function createSubagentSpawnWiring(input?: SpawnWiringInput): SpawnWiringResult
