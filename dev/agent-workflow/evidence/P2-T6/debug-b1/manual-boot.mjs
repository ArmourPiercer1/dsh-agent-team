/**
 * Manual repro of the B1 boot failure (debug artifact, not part of the group).
 * Mounts the B1 rows, boots, and dumps the child log on failure so the crash
 * is visible (the deterministic instance log gets truncated by the next boot).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DshInstance } from '../../../../../tests/characterization/lib/instance.mjs'

const WORKTREE = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P2-T6'
const HARNESS = join(WORKTREE, 'tests/characterization')
const DEBUG = join(WORKTREE, 'dev/agent-workflow/evidence/P2-T6/debug-b1')
const logDir = join(DEBUG, 'logs')
mkdirSync(logDir, { recursive: true })
mkdirSync(join(DEBUG, 'obs'), { recursive: true })
process.env.P2T6_OBS_DIR = join(DEBUG, 'obs')

const instance = new DshInstance({
  hostTree: 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/deepseek-harness-test-use',
  dshHome: 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/.dsh-test-p2t6',
  port: 3401,
  clientCommitHash: 'cd5ef814',
  logDir,
})

const pluginUrl = (rel) => pathToFileURL(join(HARNESS, rel)).href
const rows = [
  { id: 'p2t6-host-probe', name: pluginUrl('probes/remote-client/plugins/host-probe.js') },
  { id: 'p2t6-client-probe', name: pluginUrl('probes/remote-client/plugins/p2t6-client-probe/index.js') },
  { id: 'p2t6-no-decl', name: pluginUrl('probes/remote-client/plugins/no-decl/index.js') },
]

const patchPath = instance.patchFile
const patchSaved = existsSync(patchPath) ? readFileSync(patchPath) : null

try {
  instance.mountRows(rows, ['P2-T6 debug-b1 manual repro. Revert: replace with [].'])
  console.log('booting B1 rows...')
  try {
    const started = await instance.start({ timeoutMs: 60_000 })
    console.log('BOOT OK:', started.url)
    // Fetch the graph route (poll up to 60s) and persist the diagnostics.
    const http = await import('node:http')
    const getJson = (port, path) => new Promise((resolve, reject) => {
      const req = http.get({ host: '127.0.0.1', port, path }, (res) => {
        let data = ''
        res.on('data', (c) => { data += c })
        res.on('end', () => resolve({ status: res.statusCode, body: data }))
      })
      req.on('error', reject)
      req.setTimeout(10_000, () => req.destroy(new Error('timeout')))
    })
    const deadline = Date.now() + 60_000
    let graphText = null
    for (;;) {
      try {
        const r = await getJson(3401, '/__p2t6/graph')
        if (r.status === 200) { graphText = r.body; break }
      } catch { /* not yet */ }
      if (Date.now() > deadline) break
      await new Promise((r) => setTimeout(r, 500))
    }
    if (graphText !== null) {
      writeFileSync(join(DEBUG, 'b1-graph.json'), graphText)
      const g = JSON.parse(graphText)
      console.log('graph entries:', (g.entryIds ?? []).length)
      console.log('graph has p2t6-client-probe:', JSON.stringify(g.entries ?? g.entryIds ?? []).includes('p2t6-client-probe'))
      const dbg = (g.entriesDebug ?? []).filter((e) => JSON.stringify(e).includes('p2t6') || e.error)
      console.log('entriesDebug (p2t6/errors):', JSON.stringify(dbg, null, 1))
      const noFiber = (g.entriesDebug ?? []).filter((e) => e.fiber === false).length
      const noBase = (g.entriesDebug ?? []).filter((e) => e.baseUrl === null).length
      console.log(`entriesDebug: total=${(g.entriesDebug ?? []).length} fiber=false: ${noFiber} baseUrl=null: ${noBase}`)
    } else {
      console.log('graph route never became ready')
    }
    await instance.stop()
  } catch (error) {
    console.log('BOOT FAILED:', String(error.message).split('\n')[0])
  }
} finally {
  if (instance.child !== undefined) {
    try { await instance.stop() } catch { /* already gone */ }
  }
  if (patchSaved === null) {
    if (existsSync(patchPath)) rmSync(patchPath)
  } else {
    writeFileSync(patchPath, patchSaved)
  }
}

const logText = readFileSync(instance.logPath, 'utf8')
writeFileSync(join(DEBUG, 'b1-child.log'), logText)
console.log('--- child log tail (last 80 lines) ---')
console.log(logText.split('\n').slice(-80).join('\n'))
