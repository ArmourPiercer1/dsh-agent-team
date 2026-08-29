/**
 * Characterization harness — shared core + probe group framework.
 *
 * P2-T2..T5 add their probe groups as sibling directories of probes/smoke/
 * (agent-lifecycle/ preset-persona-model/ capabilities/ storage-fork-
 * descendants/ remote-client/): each group is one directory with an
 * index.mjs that default-exports `{ name, description, async run(ctx) }`.
 * run.mjs auto-discovers every group, so later tasks add a directory and do
 * not touch the core. The ctx object is the whole shared surface a group
 * may use:
 *
 *   ctx.config          resolved run config (hostTree, dshHome, port, ...)
 *   ctx.harnessRoot     tests/characterization/ absolute path
 *   ctx.probesRoot      tests/characterization/probes/ absolute path
 *   ctx.surface         the live public-exports whitelist (Map, see lib/)
 *   ctx.instance        the DshInstance (start/stop/dumpConfig/mountRows)
 *   ctx.log(msg)        append to the run log (console + report file)
 *   ctx.pluginUrl(rel)  file URL of a file under this harness
 *   ctx.check(bool, msg)  record a pass/fail; failures fail the run
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DshInstance } from './instance.mjs'

const here = dirname(fileURLToPath(import.meta.url))
export const harnessRoot = resolve(here, '..')

/**
 * Resolve the run configuration: CLI flags > CH_* env > defaults.
 * Defaults assume the canonical team-repo layout (this harness lives at
 * <team-repo>/tests/characterization/ and the pinned tree at
 * <team-repo>/references/deepseek-harness-test-use with the dedicated
 * DSH_HOME at <team-repo>/references/.dsh-test-p2t1 — P2-T1's own home; the
 * shared .dsh-test of the G1 baseline is never touched).
 */
export function resolveConfig(argv) {
  const args = parseArgs(argv)
  const teamRoot = findTeamRoot()
  const config = {
    fixtureWrite: Boolean(args['fixture-write']),
    only: args.only,
    hostTree: args['host-tree'] ?? process.env.CH_HOST_TREE ?? join(teamRoot, 'references', 'deepseek-harness-test-use'),
    dshHome: args['dsh-home'] ?? process.env.CH_DSH_HOME ?? join(teamRoot, 'references', '.dsh-test-p2t1'),
    port: Number(args.port ?? process.env.CH_PORT ?? 3281),
    backupPort: Number(args['backup-port'] ?? process.env.CH_BACKUP_PORT ?? 3291),
    reportDir: args['report-dir'] ?? process.env.CH_REPORT_DIR ?? null,
    surface: undefined, // filled by run.mjs after building the whitelist
  }
  config.logDir = config.reportDir === null ? join(harnessRoot, '.run-logs') : join(config.reportDir, 'logs')
  config.fixturePath = join(harnessRoot, 'fixtures', 'host-version.json')
  return { config, args }
}

/**
 * The team root the defaults point at: the nearest ancestor of the harness
 * (walking up at most three levels) that contains the pinned upstream tree
 * under references/. In the canonical single-checkout layout that is
 * <repo-root>; when the harness is run from a task worktree
 * (<repo-root>/.worktrees/<task>) it is the main repo root — where the
 * gitignored references/ lives. Explicit --host-tree/--dsh-home (or CH_*
 * env) always win.
 */
function findTeamRoot() {
  let dir = resolve(harnessRoot, '..', '..')
  for (let i = 0; i < 3; i += 1) {
    if (existsSync(join(dir, 'references', 'deepseek-harness-test-use'))) return dir
    dir = resolve(dir, '..')
  }
  return resolve(harnessRoot, '..', '..')
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--fixture-write') out['fixture-write'] = true
    else if (arg === '--only') out.only = argv[++i]
    else if (arg === '--host-tree') out['host-tree'] = argv[++i]
    else if (arg === '--dsh-home') out['dsh-home'] = argv[++i]
    else if (arg === '--port') out.port = argv[++i]
    else if (arg === '--backup-port') out['backup-port'] = argv[++i]
    else if (arg === '--report-dir') out['report-dir'] = argv[++i]
    else out._.push(arg)
  }
  return out
}

/** Create the ctx object handed to every probe group and self-test section. */
export function createHarnessContext(config) {
  mkdirSync(config.logDir, { recursive: true })
  const reportLinePath = config.reportDir === null ? null : join(config.reportDir, 'run-log.txt')
  if (reportLinePath !== null) writeFileSync(reportLinePath, '', { flag: 'w' }) // fresh log per invocation (evidence hygiene)
  const failures = []
  const ctx = {
    config,
    harnessRoot,
    probesRoot: join(harnessRoot, 'probes'),
    surface: config.surface,
    instance: new DshInstance(config),
    failures,
    log(message) {
      const line = `[${new Date().toISOString()}] ${message}`
      console.log(line)
      if (reportLinePath !== null) appendFileSync(reportLinePath, `${line}\n`)
    },
    pluginUrl(relativePath) {
      return pathToFileURL(join(harnessRoot, relativePath)).href
    },
    check(passed, message) {
      if (passed) {
        ctx.log(`  PASS ${message}`)
      } else {
        ctx.log(`  FAIL ${message}`)
        failures.push(message)
      }
      return passed
    },
  }
  return ctx
}

/**
 * Discover probe groups: every directory under probes/ containing an
 * index.mjs is a group, sorted by name for deterministic order.
 */
export async function discoverProbeGroups(probesRoot) {
  const groups = []
  if (!existsSync(probesRoot)) return groups
  for (const entry of readdirSync(probesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue
    const index = join(probesRoot, entry.name, 'index.mjs')
    if (!existsSync(index)) continue
    // Windows: import() needs a file:// URL, not a raw path.
    const module = await import(pathToFileURL(index).href)
    groups.push({ name: entry.name, dir: join(probesRoot, entry.name), module })
  }
  return groups.sort((a, b) => (a.name < b.name ? -1 : 1))
}
