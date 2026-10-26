export interface InventoryToolRow {
  name: string
  definition_identity: string | null
  schema_digest: string
  identity_vs_global: string
  change_seq: number | null
  source_class?: string
  unresolved?: boolean
}
export interface InventoryScope {
  scope_id: string
  kind: string
  team_lane: boolean
  team_lane_signal?: string
  agent_label?: string | null
  tools: InventoryToolRow[]
}
export interface ObservedInventory {
  schema: string
  world: {
    kind: string
    host_sha: string
    boot_id?: string
    world_id?: string
    captured_utc?: string
    source_ledger?: string
  }
  scopes: InventoryScope[]
  snapshot_digest?: string
  full_digest?: string
}
export declare const OBSERVED_SCHEMA: string
export declare function digestEligibleView(inventory: ObservedInventory): unknown
export declare function inventoryViolations(inv: unknown): string[]
export declare function withDigests(inventory: ObservedInventory): ObservedInventory & { snapshot_digest: string; full_digest: string }
export declare function observedNames(inventory: ObservedInventory): Set<string>
export declare function findRow(inventory: ObservedInventory, name: string): { scope: InventoryScope; tool: InventoryToolRow } | null
