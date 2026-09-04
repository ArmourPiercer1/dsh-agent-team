// INSTRUUMENTED COPY of .worktrees/T12-V/packages/runtime/src/plugin/upstream-resolver.mjs
// (original is builder-owned; this copy only ADDS logging and hardcodes the
//  original file's resolver-file candidates so discovery candidates match the
//  real boot exactly). Used by t12v-hook-debug.mjs.
import { appendFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve as pathResolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RESULT = 'D:\\AgentDev\\dsh-plugins\\dsh-agent-team\\dev\\agent-workflow\\evidence\\T12\\t12v-hook-debug-results.txt'
const log = (m) => { appendFile(RESULT, m + '\n').catch(() => {}) }

// ORIGINAL file location (for candidate computation parity):
const RESOLVER_FILE = 'D:\\AgentDev\\dsh-plugins\\dsh-agent-team\\.worktrees\\T12-V\\packages\\runtime\\src\\plugin\\upstream-resolver.mjs'

function candidateFromArgv() {
  const entry = process.argv[1]
  if (typeof entry !== 'string' || entry.length === 0) return null
  const abs = isAbsolute(entry) ? entry : pathResolve(process.cwd(), entry)
  return dirname(dirname(dirname(abs)))
}

function candidatesFromResolverFile() {
  const worktree = dirname(dirname(dirname(dirname(RESOLVER_FILE))))
  const mainRepo = dirname(dirname(worktree))
  return [worktree, mainRepo].map((base) => join(base, 'references', 'deepseek-harness-test-use'))
}

let cachedCheckout = null
let discoveryDone = false

function discoverCheckout() {
  if (discoveryDone) return cachedCheckout
  discoveryDone = true
  log('[hook] discoverCheckout: argv1=' + JSON.stringify(process.argv[1]) + ' cwd=' + process.cwd())
  const candidates = [candidateFromArgv(), ...candidatesFromResolverFile()].filter(
    (candidate) => candidate !== null && candidate !== undefined,
  )
  for (const candidate of candidates) {
    const check = join(candidate, 'apps', 'cli', 'node_modules', '@deepseek-ai')
    const ok = existsSync(check)
    log('[hook] candidate ' + candidate + ' -> ' + check + ' exists=' + ok)
    if (ok) { cachedCheckout = candidate; break }
  }
  log('[hook] discovered checkout=' + JSON.stringify(cachedCheckout))
  return cachedCheckout
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@deepseek-ai/')) {
    log('[hook] resolve @deepseek-ai specifier: ' + specifier + ' parent=' + (context && context.parentURL))
    const checkout = discoverCheckout()
    if (checkout !== null) {
      const parent = pathToFileURL(join(checkout, 'apps', 'cli', 'lib', '__resolver__.js'))
      log('[hook] redirecting to parent ' + parent.href)
      return nextResolve(specifier, { ...context, parentURL: parent.href })
    }
    log('[hook] no checkout found -> passthrough (will likely fail)')
  }
  return nextResolve(specifier, context)
}
