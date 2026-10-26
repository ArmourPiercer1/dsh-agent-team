/**
 * u6-arc-a — U6 PR5 C2: the ARC-A probe-FAMILY World (a NEW family with ZERO
 * center diff, mounted on the real Host through the lane's own assembly).
 *
 * Migrated verbatim from lib/world-factory.mjs at origin/master 88107ad71.
 * The three *_URL names are the lane's seam-override law: on the HOST they
 * point at the SHIPPED dist faces; the vitest world leaves them unset and the
 * lane resolves the repo TS sources.
 */
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export default {
  option: 'u6ArcA',
  probe: {
    src: resolve(import.meta.dirname, '..', 'canary', 'u6-arc-a-probe-host.mjs'),
    rowId: 'u6-arc-a-probe-host',
    fileName: 'u6-arc-a-probe-host.mjs',
  },
  paths: {
    u6arcaLedgerPath: ['home', 'u6arca-probe-ledger.jsonl'],
    u6arcaMarkerDir: ['workspace', 'u6arca-markers'],
  },
  ledgerRows: { u6arcaLedgerRows: 'u6arcaLedgerPath' },
  envKeys: ['U6ARC_LEDGER', 'U6ARC_MARKER_DIR', 'U6ARC_WORLD', 'U6ARC_ASSEMBLY_URL', 'U6ARC_CENTER_URL', 'U6ARC_CONTRACTS_URL'],
  env: ({ world, factory }) => ({
    U6ARC_LEDGER: world.u6arcaLedgerPath,
    U6ARC_MARKER_DIR: world.u6arcaMarkerDir,
    U6ARC_WORLD: world.id,
    U6ARC_ASSEMBLY_URL: pathToFileURL(join(factory.repoRoot, 'tests', 'u6-arc-a-probe-family', 'src', 'probe-assembly.mjs')).href,
    U6ARC_CENTER_URL: pathToFileURL(join(factory.repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'governance-center', 'index.js')).href,
    U6ARC_CONTRACTS_URL: pathToFileURL(join(factory.repoRoot, 'packages', 'runtime', 'dist', 'packages', 'contracts', 'src', 'index.js')).href,
  }),
  patchHeader: [
    'U6-arc-a World: canary + probe-FAMILY row (the ARC-A lane, zero',
    'center diff) + the production Team row, p6t6 observer and preset',
    'declarations, one public profile-patch layer.',
  ],
}
