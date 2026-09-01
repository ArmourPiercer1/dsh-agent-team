/**
 * legacy-fs-port.d.mts — the type surface of `legacy-fs-port.mjs` (the
 * live world module; loaded only through the dynamic `import()` in
 * `host.ts`).
 *
 * The `LegacyHomePort` type is the STRUCTURAL MIRROR declared in
 * `../types.js` (the frozen legacy package is never imported by the
 * tsc-checked sources — see the mirror docs there).
 */

import type { LegacyHomePort } from '../types.js'

/**
 * Build the read-only legacy home port over node:fs.
 * @param options - `homeRoot?: string` — optional root guard: when set,
 *   every path must stay under it (the production default keeps the
 *   reader on this instance's own home). Absent: the paths are used
 *   verbatim.
 */
export declare function buildLegacyHomePort(
  options?: { readonly homeRoot?: string },
): LegacyHomePort
