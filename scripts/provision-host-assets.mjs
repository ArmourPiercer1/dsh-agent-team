#!/usr/bin/env node
/**
 * provision-host-assets.mjs — operator/CI CLI for the PINNED PUBLISHED package
 * transport of the Host's native sandbox assets (docs/TEST_METHODS.md §9).
 *
 *   node scripts/provision-host-assets.mjs --from-package @scope/name@EXACT_VERSION
 *
 * WHY (measured 2026-11-16; docs/plans/memo/host-assets-20261116/README.md).
 * The gitignored native assets (`bin/landlock-run`, `bin/glibc/system.node`) are
 * NOT carried by a fresh clone, and a hosted runner's own host build produces
 * DIFFERENT bytes for them (measured `bin/glibc/system.node` = `dfa6d586…` on the
 * runner vs the committed pin `54a9c25c…`). The committed sha256 pin is the
 * standard; the runner's build is not. The published package happens to carry
 * EXACTLY the pinned bytes, so this CLI fetches that tarball, verifies it against
 * the registry's published `dist.integrity` (sha512) AND the tarball sha256 the
 * manifest pins, verifies every installed file's sha256/length/mode, and only
 * then installs them into the runtime tree.
 *
 * It is a THIN wrapper over `provisionHostSandboxAssetsFromPackage()`: the
 * transport's refusals are typed and the CLI only prints them. Plain `node`,
 * no pnpm install of the package, no repo dependency — tarball only.
 *
 * One machine-greppable line, always:
 *   HOST-ASSETS-PROVISIONED package=… version=… tarballSha256=… … receipt=…
 *   HOST-ASSETS-REFUSED code=… detail=…
 * Exit 0 = installed and receipt written · 1 = refused (typed, fail closed).
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  HostSandboxAssetError,
  provisionHostSandboxAssetsFromPackage,
  readHostSandboxAssetManifest,
} from '../tests/world-factory/lib/host-sandbox-assets.mjs'
import { findTestRepoRoot, testUseTree } from '../tests/paths.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** The Team tree this CLI lives in (manifest + default destination lookup root). */
const TEAM_TREE = resolve(HERE, '..')

const usage = () => {
  console.log([
    'usage: node scripts/provision-host-assets.mjs --from-package [@scope/name@EXACT_VERSION] [options]',
    '',
    '  --from-package [spec]  provision from the pinned published package; the spec may be',
    '                         omitted, in which case the manifest\'s pinned package@version is used.',
    '                         Only an EXACT version is accepted (no ranges, no tags, no `latest`).',
    '  --runtime-tree <path>  destination runtime checkout (default: <this tree>/tests/deepseek-harness-test-use)',
    '  --receipt <path>       receipt file (default: <repo>/.artifacts/tmp/host-assets/provision-receipt.json)',
    '  --manifest             print the pinned manifest and exit',
    '  --help                 this text',
    '',
    'exit 0 = provisioned (receipt written) · 1 = refused (typed code on the HOST-ASSETS-REFUSED line)',
  ].join('\n'))
}

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? null : args[i + 1] ?? null
}
/** `--from-package` takes an OPTIONAL value; the next token is the spec only when it is not an option. */
const fromPackageValue = () => {
  const i = args.indexOf('--from-package')
  if (i === -1) return { present: false, spec: null }
  const next = args[i + 1] ?? null
  return { present: true, spec: next !== null && !next.startsWith('--') ? next : null }
}

if (args.includes('--help') || args.includes('-h')) {
  usage()
  process.exit(0)
}

try {
  if (args.includes('--manifest')) {
    const m = readHostSandboxAssetManifest({ repoRoot: TEAM_TREE })
    console.log(JSON.stringify(m, null, 2))
    process.exit(0)
  }
  const fromPackage = fromPackageValue()
  if (!fromPackage.present) {
    throw new HostSandboxAssetError('USAGE', 'nothing to do: pass --from-package [@scope/name@EXACT_VERSION] (see --help); this CLI only provisions the pinned published package')
  }
  const runtimeTree = resolve(opt('runtime-tree') ?? testUseTree(findTestRepoRoot(TEAM_TREE) ?? TEAM_TREE))
  const receipt = await provisionHostSandboxAssetsFromPackage({
    runtimeTree,
    spec: fromPackage.spec ?? undefined,
    repoRoot: TEAM_TREE,
    receiptPath: opt('receipt') ?? undefined,
  })
  console.log([
    'HOST-ASSETS-PROVISIONED',
    `package=${receipt.package.name}`,
    `version=${receipt.package.version}`,
    `tarballSha256=${receipt.package.tarballSha256}`,
    `distIntegrity=${receipt.package.distIntegrity}`,
    `files=${String(receipt.files.length)}`,
    `host=${receipt.host.sha}`,
    `manifestDigest=${receipt.manifest.digest}`,
    `utc=${receipt.at}`,
    `receipt=${receipt.receiptPath}`,
  ].join(' '))
  process.exit(0)
} catch (error) {
  const code = error instanceof HostSandboxAssetError ? error.code : 'UNEXPECTED'
  const detail = String(error?.message ?? error).replace(/\s+/gu, ' ').slice(0, 400)
  console.error(`HOST-ASSETS-REFUSED code=${code} detail=${detail}`)
  process.exit(1)
}
