/**
 * Debug: after a negative row aborts `dsh web` boot (client-module
 * composition failure), does the separate `dump-config` CLI call still
 * succeed and show the mounted row? (B3/B4 need this assertion.)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DshInstance } from '../../../../../tests/characterization/lib/instance.mjs'

const WORKTREE = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P2-T6'
const HARNESS = join(WORKTREE, 'tests/characterization')
const DEBUG = join(WORKTREE, 'dev/agent-workflow/evidence/P2-T6/debug-b1')

const instance = new DshInstance({
  hostTree: 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/deepseek-harness-test-use',
  dshHome: 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/.dsh-test-p2t6',
  port: 3401,
  clientCommitHash: 'cd5ef814',
  logDir: join(DEBUG, 'negative-logs'),
})

const pluginUrl = (rel) => pathToFileURL(join(HARNESS, rel)).href
const patchPath = instance.patchFile
const patchSaved = existsSync(patchPath) ? readFileSync(patchPath) : null

const NEG = [
  { id: 'p2t6-missing-bundle', rel: 'probes/remote-client/plugins/negative-fixtures/missing-bundle/index.js' },
  { id: 'p2t6-malformed-decl', rel: 'probes/remote-client/plugins/negative-fixtures/malformed-decl/index.js' },
]

try {
  for (const row of NEG) {
    instance.mountRows([{ id: row.id, name: pluginUrl(row.rel) }], [
      `P2-T6 dump-negative probe (${row.id}). Revert: replace with [].`,
    ])
    let out = '<no output>'
    let ok = true
    try {
      const dump = await instance.dumpConfig()
      out = dump.text
      writeFileSync(join(DEBUG, `dump-negative-${row.id}.txt`), dump.text)
    } catch (error) {
      ok = false
      out = String(error.message)
    }
    const inDump = ok ? DshInstance.rowInDump(out, { id: row.id, name: pluginUrl(row.rel) }) : false
    console.log(`\n=== ${row.id} ===`)
    console.log(`dumpConfig ok: ${ok}`)
    console.log(`row in dump: ${inDump}`)
    console.log(`dump length: ${out.length}`)
  }
} finally {
  if (instance.child !== undefined) {
    try { await instance.stop() } catch { /* not running */ }
  }
  if (patchSaved === null) {
    if (existsSync(patchPath)) writeFileSync(patchPath, ['# P2-T6 debug negative boot. Revert: replace with [].', '[]', ''].join('\n'))
  } else {
    writeFileSync(patchPath, patchSaved)
  }
  console.log('\npatch restored')
}
