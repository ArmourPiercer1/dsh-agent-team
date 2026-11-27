/**
 * host-version-guard.mjs — the false-green guard for EVERY vitest worker.
 *
 * THE RISK THIS CLOSES. In round 116 the Vite population could be *selected*
 * for rc.5 (`TEAM_TEST_HOST=next`) while Vite still imported the repo's rc.2
 * install: the process was "rc.5-selected" and the modules were rc.2, and the
 * suites were green. A green run is only rc.5 coverage if the module the
 * runner actually loaded is the selected host's.
 *
 * HOW IT PROVES IT. This file is a `setupFiles` entry of both vitest configs.
 * It imports `@deepseek-ai/dsh-tools/package.json` — a BARE host specifier, so
 * the import goes through the SAME shared adapter (`host-vite-adapter.mjs` →
 * `host-select.mjs`) that resolves every other host import in the run — and
 * compares the version it read with the pin `selectedHostPin()` derives from
 * the ONE selector. A mismatch throws before any test body runs, so a green
 * suite can never be quoted as coverage of a host it did not load.
 *
 * It also prints one machine-greppable `HOST-VERSION-GUARD` line per worker
 * with the selector, the resolved version and the pin, so the per-suite
 * evidence in a round log carries the measured version rather than a stated
 * one.
 *
 * Inert with the variable unset: the adapter resolves the repo's rc.2 install
 * and the pin IS rc.2, so the guard passes exactly as it did before this file
 * existed.
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import dshTools from '@deepseek-ai/dsh-tools/package.json' with { type: 'json' }

import { selectedHostPin, testHostMode } from './host-select.mjs'

// NOT `new URL('../..', import.meta.url)`: Vite rewrites that asset-URL pattern
// to an http dev URL, which is not a filesystem path.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const mode = testHostMode()
const pin = selectedHostPin(repoRoot, mode)
const resolved = dshTools.version

if (resolved !== pin.version) {
  throw new Error(
    `HOST-VERSION-GUARD FAIL: ${dshTools.name} resolved to ${resolved} but the selected host (${mode}) is pinned at ${pin.version}. `
    + `The runner imported another host generation — a green run here is NOT coverage of ${pin.version}.`,
  )
}

console.log(`HOST-VERSION-GUARD ok host=${mode} resolved=${resolved} pin=${pin.version} tree=${pin.tree}`)
