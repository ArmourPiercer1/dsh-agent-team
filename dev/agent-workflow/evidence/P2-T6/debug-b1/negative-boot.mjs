/**
 * Debug: what does the client-module scanner DO when a row's client bundle is
 * missing or its dsh.client declaration is malformed? (D1 showed boot SUCCEEDS
 * for both. This script boots host-probe + one negative row, persists the
 * child log before stop, dumps the composition, and reads the /__p2t6/graph
 * route to see whether the negative row makes it into the client-module graph.)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import http from 'node:http'
import { DshInstance } from '../../../../../tests/characterization/lib/instance.mjs'

const WORKTREE = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P2-T6'
const HARNESS = join(WORKTREE, 'tests/characterization')
const DEBUG = join(WORKTREE, 'dev/agent-workflow/evidence/P2-T6/debug-b1')
const logDir = join(DEBUG, 'negative-logs')
mkdirSync(logDir, { recursive: true })
const obsDir = join(DEBUG, 'neg-obs')
mkdirSync(obsDir, { recursive: true })
process.env.P2T6_OBS_DIR = obsDir

const instance = new DshInstance({
  hostTree: 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/deepseek-harness-test-use',
  dshHome: 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/.dsh-test-p2t6',
  port: 3401,
  clientCommitHash: 'cd5ef814',
  logDir,
})

const pluginUrl = (rel) => pathToFileURL(join(HARNESS, rel)).href
const HOST_PROBE = { id: 'p2t6-host-probe', name: pluginUrl('probes/remote-client/plugins/host-probe.js') }

const patchPath = instance.patchFile
const patchSaved = existsSync(patchPath) ? readFileSync(patchPath) : null

function getJson(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path }, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.setTimeout(10_000, () => { req.destroy(new Error('timeout')) })
  })
}

async function waitGraph(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      const r = await getJson(port, '/__p2t6/graph')
      if (r.status === 200) return r.body
    } catch { /* not yet */ }
    if (Date.now() > deadline) throw new Error('graph route never became ready')
    await new Promise((r) => setTimeout(r, 500))
  }
}

async function phase(label, negRow) {
  const rows = [HOST_PROBE, negRow]
  instance.mountRows(rows, [`P2-T6 ${label} negative boot. Revert: replace with [].`])
  console.log(`\n=== ${label}: booting (host-probe + ${negRow.id}) ===`)
  let started = null
  try {
    started = await instance.start({ timeoutMs: 60_000 })
    console.log(`BOOT OK: ${started.url}`)
  } catch (error) {
    console.log(`BOOT FAILED: ${String(error.message).split('\n')[0]}`)
  }
  // Persist the child log NOW (the next start() truncates it).
  let logText = ''
  try { logText = readFileSync(instance.logPath, 'utf8') } catch { logText = '<no log>' }
  writeFileSync(join(DEBUG, `${label}-child.log`), logText)
  console.log(`child log: ${label}-child.log (${logText.split('\n').length} lines)`)
  if (started !== null) {
    try {
      const graph = JSON.parse(await waitGraph(3401, 60_000))
      writeFileSync(join(DEBUG, `${label}-graph.json`), JSON.stringify(graph, null, 2))
      console.log(`graph entries: ${graph.entries?.map((e) => e.id).join(', ') ?? '<no entries>'}`)
      console.log(`graph has ${negRow.id}: ${JSON.stringify(graph).includes(negRow.id)}`)
    } catch (error) {
      console.log(`graph read failed: ${error.message}`)
    }
    const dump = await instance.dumpConfig()
    writeFileSync(join(DEBUG, `${label}-dump.txt`), dump.text)
  }
  if (instance.child !== undefined) {
    try { await instance.stop() } catch { /* already gone */ }
  }
  const lines = logText.split('\n').filter((l) => l.length > 0)
  console.log(`--- ${label} child log (non-empty lines: ${lines.length}) ---`)
  for (const l of lines.slice(0, 30)) console.log(l)
}

try {
  await phase('neg-b3', { id: 'p2t6-missing-bundle', name: pluginUrl('probes/remote-client/plugins/negative-fixtures/missing-bundle/index.js') })
  await phase('neg-b4', { id: 'p2t6-malformed-decl', name: pluginUrl('probes/remote-client/plugins/negative-fixtures/malformed-decl/index.js') })
} finally {
  if (instance.child !== undefined) {
    try { await instance.stop() } catch { /* already gone */ }
  }
  if (patchSaved === null) {
    if (existsSync(patchPath)) writeFileSync(patchPath, ['# P2-T6 debug negative boot. Revert: replace with [].', '[]', ''].join('\n'))
  } else {
    writeFileSync(patchPath, patchSaved)
  }
  console.log('\npatch restored')
}
