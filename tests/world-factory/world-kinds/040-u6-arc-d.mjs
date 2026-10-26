/**
 * u6-arc-d — U6 PR6 C2: the ADVERSARIAL World. It mounts the PR5 probe FAMILY
 * unchanged (zero new family code is the claim) through the same lane
 * assembly URL.
 *
 * Migrated verbatim from lib/world-factory.mjs at origin/master 88107ad71. The
 * row reads its own U6ARCD_* names, and it RE-PINS the two U6ARC_* seam URLs
 * the PR5 family itself resolves — both spellings, one truth. Since every
 * kind's envKeys are cleared on every boot and only the active kind's env is
 * applied, those two keys are declared HERE as well as in u6-arc-a.
 */
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export default {
  option: 'u6ArcD',
  probe: {
    src: resolve(import.meta.dirname, '..', 'canary', 'u6-arc-d-probe-host.mjs'),
    rowId: 'u6-arc-d-probe-host',
    fileName: 'u6-arc-d-probe-host.mjs',
  },
  paths: {
    u6arcdLedgerPath: ['home', 'u6arcd-probe-ledger.jsonl'],
    u6arcdMarkerDir: ['workspace', 'u6arcd-markers'],
  },
  ledgerRows: { u6arcdLedgerRows: 'u6arcdLedgerPath' },
  envKeys: ['U6ARCD_LEDGER', 'U6ARCD_MARKER_DIR', 'U6ARCD_WORLD', 'U6ARCD_ASSEMBLY_URL', 'U6ARCD_CENTER_URL', 'U6ARCD_CONTRACTS_URL', 'U6ARC_CENTER_URL', 'U6ARC_CONTRACTS_URL'],
  env: ({ world, factory }) => ({
    U6ARCD_LEDGER: world.u6arcdLedgerPath,
    U6ARCD_MARKER_DIR: world.u6arcdMarkerDir,
    U6ARCD_WORLD: world.id,
    U6ARCD_ASSEMBLY_URL: pathToFileURL(join(factory.repoRoot, 'tests', 'u6-arc-a-probe-family', 'src', 'probe-assembly.mjs')).href,
    U6ARCD_CENTER_URL: pathToFileURL(join(factory.repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'governance-center', 'index.js')).href,
    U6ARCD_CONTRACTS_URL: pathToFileURL(join(factory.repoRoot, 'packages', 'runtime', 'dist', 'packages', 'contracts', 'src', 'index.js')).href,
    U6ARC_CENTER_URL: pathToFileURL(join(factory.repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'governance-center', 'index.js')).href,
    U6ARC_CONTRACTS_URL: pathToFileURL(join(factory.repoRoot, 'packages', 'runtime', 'dist', 'packages', 'contracts', 'src', 'index.js')).href,
  }),
  patchHeader: [
    'U6-arc-d World: canary + adversarial probe row (mounts the PR5',
    'probe FAMILY unchanged — zero new family code is the claim) +',
    'the production Team row, p6t6 observer and preset declarations,',
    'one public profile-patch layer.',
  ],
}
