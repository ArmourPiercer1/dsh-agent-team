/**
 * Types only — the adapter's RESOLUTION RULES live in host-vite-adapter.mjs and
 * the ONE authority it calls (host-select.mjs). No pin/tree/mapping is repeated
 * here; the return type is intentionally `any` so these declarations never
 * become a second description of Vite's plugin contract.
 */
export interface HostVitePluginOptions {
  repoRoot: string
  mode?: 'legacy' | 'next'
  source?: boolean
  name?: string
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createHostVitePlugin(options: HostVitePluginOptions): any
