// Repro of ClientModuleRegistry.locatePkgJson's exact resolveSync call.
// Mirrors vendor/loader/src/internal.ts ModuleLoader.fromInternal() +
// packages/client/modules/src/index.ts locatePkgJson (v2 branch).
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HOME = 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/.dsh-test-s8-2026-09-03T12-35-22'
const BASE_URL = pathToFileURL(join(HOME, 'profiles', 'web')).href + '/'
// Root the require inside the test-use tree so pnpm can find node-addon-require-builtin.
const REQ = createRequire('D:/AgentDev/dsh-plugins/dsh-agent-team/references/deepseek-harness-test-use/vendor/loader/src/internal.ts')

let raw
try {
  const breq = REQ('node-addon-require-builtin')
  raw = breq.requireBuiltin('internal/modules/esm/loader').getOrInitializeCascadedLoader()
  console.log('internal loader: OK (v2 =', raw !== undefined, ')')
} catch (e) {
  console.log('internal loader: UNAVAILABLE ->', e.message)
  process.exit(2)
}
const internal = Object.assign(raw, { version: 'v2' })

function locate(loaderName, baseUrl) {
  // exact copy of the v2 branch + nearestPackage walk
  const pathLike = loaderName.startsWith('.') || loaderName.startsWith('file:') || loaderName.startsWith('/')
  const internal2 = internal
  let moduleUrl
  try {
    moduleUrl = internal2.resolveSync(baseUrl, { specifier: loaderName, attributes: {} }).url
  } catch (e) {
    console.log(`  resolveSync THREW: ${e.message}`)
    return 'SWALLOWED -> undefined (permanently not a client row)'
  }
  console.log(`  resolveSync -> ${moduleUrl}`)
  if (!moduleUrl.startsWith('file:')) return 'not file: -> undefined'
  let dir = dirname(fileURLToPath(moduleUrl))
  while (true) {
    const candidate = join(dir, 'package.json')
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, 'utf8'))
      return `package.json found: name=${pkg.name} dsh.client=${JSON.stringify(pkg.dsh?.client)} exports.client=${JSON.stringify(pkg.exports?.['./client'])}`
    }
    const parent = dirname(dir)
    if (parent === dir) return 'walked to filesystem root: no package.json'
    dir = parent
  }
}

console.log(`baseUrl = ${BASE_URL}`)
console.log('CASE 1: relative name (current shim row)')
console.log('  ' + locate('../../s8-client-row/index.js', BASE_URL))

const ABS = pathToFileURL(join(HOME, 's8-client-row', 'index.js')).href
console.log('CASE 2: absolute file: URL (candidate fix)')
console.log('  ' + locate(ABS, BASE_URL))

console.log('CASE 3: sanity — bare specifier of an installed client pkg')
console.log('  ' + locate('@deepseek-ai/dsh-client-ui-sidebar', BASE_URL))
