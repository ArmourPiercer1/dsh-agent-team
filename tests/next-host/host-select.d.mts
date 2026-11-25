/**
 * Types only. The authority is host-select.mjs; this file repeats no pin, no
 * tree path and no specifier mapping.
 */
export type HostMode = 'legacy' | 'next'

export interface HostPin {
  host: HostMode
  version: string
  sha: string
  clientCommitHash: string
  tag: string | null
  tree: string
}

export interface HostResolution {
  file: string
  parsed: { packageName: string; subpath: string | null }
}

export class HostSelectionError extends Error {
  code: 'HOST_SELECTOR_UNKNOWN' | 'HOST_MODULE_UNRESOLVED' | 'HOST_RESOLUTION_ESCAPED'
}

export function testHostMode(env?: NodeJS.ProcessEnv): HostMode
export function selectedHostTree(repoRoot: string, mode?: HostMode): string
export function selectedHostResolveRoot(repoRoot: string, mode?: HostMode): string
export function selectedHostPin(repoRoot: string, mode?: HostMode): HostPin
export function isInsideSelectedHost(file: string, repoRoot: string, mode?: HostMode): boolean
export function parseHostSpecifier(spec: string): { packageName: string; subpath: string | null } | null
export function createHostResolver(repoRoot: string, mode?: HostMode): {
  mode: HostMode
  repoRoot: string
  resolveRoot: string
  hostTree: string
  defaultResolutionIsSelectedHost: boolean
  isHostInternal(importerPath: string): boolean
  resolveForImporter(spec: string, importerPath?: string): HostResolution | null
  resolveSourceForImporter(spec: string): (HostResolution & { built: string }) | null
}
