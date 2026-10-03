/**
 * Ambient declarations for `tests/kits/rc2-real-host-smoke/fixture-invariants.mjs`
 * (same strict-mode reason as `tests/paths.d.mts` / `wire-shape.d.mts`).
 */

export declare const TEAM_TOOL_CATALOG: readonly string[]

export declare class FixtureInvariantError extends Error {
  readonly violations: FixtureViolation[]
  readonly exitCode: number
  constructor(violations: FixtureViolation[])
}

export interface FixtureViolation {
  readonly code: string
  readonly names: string[]
  readonly detail: string
}

export interface DeriveInput {
  surface?: readonly string[]
  managed?: readonly string[]
  safeUnmanaged?: readonly string[]
  teamCatalog?: readonly string[]
}

export interface FindViolationsInput {
  denyList?: readonly string[]
  teamCatalog?: readonly string[]
  leaderTeamTools?: readonly string[]
  managed?: readonly string[]
}

export interface BlueprintArgs {
  bpId: string
  leaderPersona: string
  workerPersona: string
}

export interface MaterializeInput extends DeriveInput, FindViolationsInput {
  blueprints?: Record<string, BlueprintArgs>
  onViolations?: ((violations: FixtureViolation[], ctx: { denyList: string[] }) => void) | null
  writeBlueprint: (name: string, yaml: string) => void
  renderBlueprint: (name: string, args: BlueprintArgs & { denyList: string[] }) => string
}

export declare function deriveBuiltinToolDeny(input?: DeriveInput): string[]
export declare function findFixtureViolations(input?: FindViolationsInput): FixtureViolation[]
export declare function materializeBcFixtures(input: MaterializeInput): { denyList: string[]; violations: never[] }
