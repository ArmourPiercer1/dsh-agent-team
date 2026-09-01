/**
 * legacy-reader.mjs — the live-world re-export adapter for the frozen
 * legacy session reader entry points (`inspectLegacyTeam`,
 * `dispatchReaderAction`).
 *
 * Why a .mjs adapter: the frozen `packages/legacy` sources carry no
 * tsconfig and contain type-level defects that would fail this package's
 * tsc program the moment they were imported by a .ts/.d.mts file. A .mjs
 * file is outside the tsc program (`allowJs` is off), so this adapter
 * keeps the frozen package out of every type-checked surface while still
 * resolving the real functions in BOTH worlds:
 *
 * - sanctioned test chain: `scripts/run-tests-hooks.mjs` is a
 *   process-global resolve hook — the inner `index.js` specifier is
 *   rewritten to its `.ts` sibling and native type stripping executes it;
 * - live DSH world: the row loader's `.js` -> `.ts` rewrite applies to
 *   `.mjs` importers under `packages/` the same way.
 *
 * The type surface is declared by the sibling `legacy-reader.d.mts` over
 * the structural legacy mirrors in `../types.js`.
 */

import {
  inspectLegacyTeam,
  dispatchReaderAction,
} from '../../../../legacy/session-reader/index.js'

export { inspectLegacyTeam, dispatchReaderAction }
