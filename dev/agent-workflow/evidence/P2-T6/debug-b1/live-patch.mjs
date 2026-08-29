/**
 * Decisive CLIENT_MODULE experiment: does a client-package row mounted LIVE
 * (patchReload: live) into $DSH_HOME/profiles/web/cordis.patch.yml after boot
 * enter the client-modules graph and serve its bundle?
 *
 * Steps:
 *  1. boot with ONLY the host-probe row; capture graph (expect no p2t6-client-probe)
 *  2. rewrite the patch file WHILE RUNNING to add the p2t6-client-probe row
 *  3. poll /__p2t6/graph up to 90s for the entry
 *  4. if present: GET the combo URL, expect 200 + P2T6-CLIENT-BUNDLE marker
 *  5. persist before/after graphs, combo body, child log; restore patch byte-exact
 *
 * Debug artifact for P2-T6 (not part of the group).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import http from 'node:http'
import { DshInstance } from '../../../../../tests/characterization/lib/instance.mjs'

const WORKTREE = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P2-T6'
const HARNESS = join(WORKTREE, 'tests/characterization')
const DEBUG = join(WORKTREE, 'dev/agent-workflow/evidence/P2-T6/debug-b1')
const logDir = join(DEBUG, 'logs')
mkdirSync(logDir, { recursive: true })
mkdirSync(join(DEBUG, 'obs'), { recursive: true })
process.env.P2T6_OBS_DIR = join(DEBUG, 'obs')

const PORT = 3401

function httpRequest(path, { method = 'GET', body = undefined } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: PORT, method, path, headers: { 'content-type': 'application/json' } },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }))
      },
    )
    req.on('error', reject)
    if (body !== undefined) req.write(body)
    req.end()
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const instance = new DshInstance({
  hostTree: 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/deepseek-harness-test-use',
  dshHome: 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/.dsh-test-p2t6',
  port: PORT,
  clientCommitHash: 'cd5ef814',
  logDir,
})

const pluginUrl = (rel) => pathToFileURL(join(HARNESS, rel)).href
const ROWS_HOST = { id: 'p2t6-host-probe', name: pluginUrl('probes/remote-client/plugins/host-probe.js') }
const ROWS_CLIENT = { id: 'p2t6-client-probe', name: pluginUrl('probes/remote-client/plugins/p2t6-client-probe/index.js') }

const patchPath = instance.patchFile
const patchSaved = existsSync(patchPath) ? readFileSync(patchPath) : null

async function fetchGraph(label) {
  const res = await httpRequest('/__p2t6/graph')
  const doc = JSON.parse(res.body)
  writeFileSync(join(DEBUG, `${label}.json`), JSON.stringify({ label, fetchedAt: new Date().toISOString(), doc }, null, 2))
  return doc
}

let started = false
try {
  instance.mountRows([ROWS_HOST], ['p2t6 live-patch debug: host-probe only'])
  await instance.start({ timeoutMs: 90_000 })
  started = true
  console.log('BOOT OK (host-probe only)')

  // Step 1: wait for the graph route, capture the "before" state.
  let before = null
  const t0 = Date.now()
  while (Date.now() - t0 < 60_000) {
    try {
      before = await fetchGraph('live-before')
      break
    } catch {
      await sleep(1000)
    }
  }
  if (before === undefined || before.fatal !== undefined) throw new Error('graph route never answered: ' + JSON.stringify(before)?.slice(0, 400))
  const beforeIds = before.entryIds ?? []
  console.log(`BEFORE graph: rev=${before.rev} entries=${beforeIds.length} p2t6-client-probe present=${beforeIds.includes('p2t6-client-probe')}`)
  const hostEntry = (before.entriesDebug ?? []).filter((e) => String(e.name ?? '').startsWith('p2t6'))
  console.log('BEFORE entriesDebug p2t6 subset:', JSON.stringify(hostEntry))
  const evBefore = before.eventsDebug ?? {}
  console.log('BEFORE eventsDebug: total=', evBefore.total, ' p2t6=', JSON.stringify(evBefore.p2t6))

  if (beforeIds.includes('p2t6-client-probe')) {
    console.log('UNEXPECTED: client-probe row already in graph without being mounted (check patch restore)')
  }

  // Step 2: live-edit the patch file while the instance is running.
  const editAt = Date.now()
  instance.mountRows([ROWS_HOST, ROWS_CLIENT], ['p2t6 live-patch debug: host-probe + client-probe (LIVE EDIT)'])
  console.log(`LIVE EDIT at ${new Date(editAt).toISOString()} (added p2t6-client-probe row)`)

  // Step 3: poll for the entry to appear.
  let after = null
  let appearedAtMs = null
  const pollEnd = editAt + 90_000
  while (Date.now() < pollEnd) {
    try {
      const probe = await httpRequest('/__p2t6/graph')
      const doc = JSON.parse(probe.body)
      const ids = doc.entryIds ?? []
      if (ids.includes('p2t6-client-probe')) {
        appearedAtMs = Date.now() - editAt
        after = await fetchGraph('live-after')
        break
      }
    } catch {
      /* route may be briefly unavailable during recomposition; keep polling */
    }
    await sleep(2000)
  }

  // Diagnostic: compare loader views + replay the registry's flush for the row.
  try {
    const diag = await httpRequest('/__p2t6/diag')
    writeFileSync(join(DEBUG, 'live-diag.json'), JSON.stringify({ label: 'live-diag', fetchedAt: new Date().toISOString(), status: diag.status, doc: JSON.parse(diag.body) }, null, 2))
    const d = JSON.parse(diag.body)
    console.log('DIAG loaderSameObject:', d.loaderSameObject, ' myLoaderTotal:', d.myLoaderTotal, ' cmLoaderTotal:', d.cmLoaderTotal)
    console.log('DIAG myLoaderP2t6:', JSON.stringify(d.myLoaderP2t6))
    console.log('DIAG cmLoaderP2t6:', JSON.stringify(d.cmLoaderP2t6))
    console.log('DIAG dirty:', JSON.stringify(d.dirty), ' flushErrors:', JSON.stringify(d.flushErrors), ' flushThrew:', d.flushThrew)
    console.log('DIAG graphHasClientProbe:', d.graphHasClientProbe, ' revBefore:', d.composedRevBefore, ' revAfter:', d.composedRevAfter)
    console.log('DIAG tableKeysAfter:', JSON.stringify(d.tableKeysAfter))
  } catch (error) {
    console.log('DIAG fetch failed:', String(error))
  }

  if (after !== null) {
    const entry = (after.entries ?? []).find((e) => e.id === 'p2t6-client-probe')
    console.log(`APPEARED after ${appearedAtMs}ms; rev=${after.rev} entries=${(after.entryIds ?? []).length}`)
    console.log('combo entry:', JSON.stringify(entry))
    // Step 4: fetch the combo bundle.
    try {
      const combo = await httpRequest(entry.url)
      const head = combo.body.slice(0, 300)
      writeFileSync(join(DEBUG, 'live-combo.txt'), combo.body)
      console.log(`COMBO GET ${entry.url} -> ${combo.status} (${combo.body.length} bytes) marker=${combo.body.includes('P2T6-CLIENT-BUNDLE')}`)
      console.log('combo head:', JSON.stringify(head))
    } catch (error) {
      console.log('COMBO GET FAILED:', String(error))
    }
    const evAfter = after.eventsDebug ?? {}
    console.log('AFTER eventsDebug: total=', evAfter.total, ' p2t6=', JSON.stringify(evAfter.p2t6))
  } else {
    console.log('NOT PRESENT after 90s of polling')
    // Capture the final state for blocker evidence (includes eventsDebug).
    try {
      after = await fetchGraph('live-final')
    } catch (error) {
      console.log('final graph fetch failed:', String(error))
    }
    if (after !== null) {
      const evAfter = after.eventsDebug ?? {}
      console.log('FINAL eventsDebug: total=', evAfter.total, ' p2t6=', JSON.stringify(evAfter.p2t6))
      console.log('FINAL entriesDebug p2t6 subset:', JSON.stringify((after.entriesDebug ?? []).filter((e) => String(e.name ?? '').startsWith('p2t6'))))
    }
  }

  // Persist the child log before stop (deterministic log file, single boot).
  const logText = readFileSync(instance.logPath, 'utf8')
  writeFileSync(join(DEBUG, 'live-child.log'), logText)
  const interesting = logText.split('\n').filter((l) => /p2t6|client[- ]module|recompos|patch/i.test(l))
  console.log(`--- child log: ${logText.length} bytes, ${interesting.length} matching lines (first 20) ---`)
  for (const line of interesting.slice(0, 20)) console.log(line)

  const stop = await instance.stop({ timeoutMs: 15_000 })
  console.log('STOP', JSON.stringify(stop))
} catch (error) {
  console.log('EXCEPTION:', String(error))
  console.log(String(error.stack ?? '').split('\n').slice(0, 6).join('\n'))
  try {
    if (instance.child !== undefined) writeFileSync(join(DEBUG, 'live-child-fail.log'), readFileSync(instance.logPath, 'utf8'))
  } catch {
    /* ignore */
  }
  try {
    if (started) await instance.stop({ timeoutMs: 15_000 }).catch(() => ({}))
  } catch {
    /* ignore */
  }
} finally {
  if (patchSaved === null) {
    if (existsSync(patchPath)) rmSync(patchPath)
  } else {
    writeFileSync(patchPath, patchSaved)
  }
  console.log('patch file restored byte-exact')
}
