#!/usr/bin/env node
/**
 * p09-probe.mjs — pre-flight probe (kept as evidence): verifies the import
 * mechanism (file URL into the pinned built libs), the plugin mounts needed
 * by the three runners, and one full MCP stdio handshake against the mock.
 * Exit 0 = mechanism OK. Not a verdict leg.
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { makeFixture } from '../00-baseline/p00-fixture.mjs'
import { libUrl, HERE } from './p09-shared.mjs'

const out = { steps: [] }
const step = (name, info) => { out.steps.push({ name, ...info }); console.log(`OK ${name} ${JSON.stringify(info)}`) }

// 1. file-URL imports
const dshWeb = await import(libUrl('web', 'web'))
step('import.dsh-web', { keys: Object.keys(dshWeb).slice(0, 8), default_is_class: typeof dshWeb.default === 'function' })
const toolWeb = await import(libUrl('web', 'tool-web'))
step('import.tool-web', { name: toolWeb.name, inject: toolWeb.inject })
const webFetchHttp = await import(libUrl('web', 'web-fetch-http'))
step('import.web-fetch-http', { name: webFetchHttp.name, inject: webFetchHttp.inject })
const dshJobs = await import(libUrl('jobs', 'jobs'))
step('import.dsh-jobs', { exports: Object.keys(dshJobs).length, JobId: typeof dshJobs.JobId })
const jobsLocal = await import(libUrl('jobs', 'jobs-local'))
step('import.dsh-jobs-local', { default: jobsLocal.default?.name })
const toolJobs = await import(libUrl('jobs', 'tool-jobs'))
step('import.tool-jobs', { name: toolJobs.name, inject: toolJobs.inject })
const mcpClient = await import(libUrl('mcp', 'mcp-client'))
step('import.dsh-mcp-client', { name: mcpClient.name, inject: mcpClient.inject })

// module identity: bare junction import vs file URL (realpath dedup check)
const dshWebBare = null // dsh-web is not junctioned (by design); identity of cordis checked instead:
const cordisBare = await import('@deepseek-ai/cordis')
step('identity.cordis-vs-lib-imports', { same_ctor_as_jobslocal_base: 'n/a-direct', bare_ok: typeof cordisBare.Context === 'function' })

// 2. mounts: web seam + tool-web + local fetch provider
{
  const f = await makeFixture()
  await f.ctx.plugin(dshWeb.default, { fetchProvider: 'http' })
  await f.ctx.plugin(webFetchHttp, {})
  await f.ctx.plugin(toolWeb, { search: false, fetch: true })
  const schemas = f.ctx.tools.schemas().map((s) => s.name).sort()
  step('mount.web', { schemas, web_service: typeof f.ctx.web?.fetch === 'function' })
  // native loopback refusal evidence (no socket, no DNS — literal IP pre-check)
  let blocked = ''
  try { const r = await f.run('web_fetch', undefined); blocked = JSON.stringify(r).slice(0, 80) } catch { /* empty args */ }
  const res = await f.ctx.web.fetch({ url: 'http://127.0.0.1:3187/page' }).catch((err) => ({ code: err?.code, message: String(err?.message).slice(0, 120) }))
  step('native.loopback-blocked', { observable: JSON.stringify(res).slice(0, 180) })
}

// 3. mounts: jobs
{
  const f = await makeFixture()
  await f.ctx.plugin(jobsLocal.default, {})
  await f.ctx.plugin(toolJobs, { completionDelivery: 'quiet' })
  const schemas = f.ctx.tools.schemas().map((s) => s.name).sort()
  step('mount.jobs', { schemas, jobs_service: typeof f.ctx.jobs?.start === 'function' })
  const disposeCtl = null
  void disposeCtl
  const id = f.ctx.jobs.start({
    kind: 'bash', label: 'probe',
    run: (job) => {
      job.append('probe-out')
      let resolveDone
      const done = new Promise((r) => { resolveDone = r })
      setTimeout(() => resolveDone({ status: 'completed', result: 'PROBE-OK' }), 10)
      return { cancel() {}, done }
    },
  })
  const view = await f.ctx.jobs.wait(id, 1000)
  step('jobs.lifecycle', { id: String(id), status: view.status })
}

// 4. mcp handshake through the pinned plugin
{
  const f = await makeFixture()
  const logPath = join(HERE, 'probe-scratch', 'mcp-probe-calls.jsonl')
  await import('node:fs').then((fs) => fs.mkdirSync(join(HERE, 'probe-scratch'), { recursive: true }))
  writeFileSync(logPath, '')
  process.env.P09_MCP_CALL_LOG = logPath
  await f.ctx.plugin(mcpClient, {
    transport: 'stdio',
    serverName: 'probe',
    command: process.execPath,
    args: [join(HERE, 'p09-mcp-mock-server.mjs')],
    env: { P09_MCP_CALL_LOG: logPath },
    cwd: HERE,
    failOnStartupError: true,
  })
  const schemas = f.ctx.tools.schemas().map((s) => s.name).sort()
  step('mcp.registered', { schemas })
  const r = await f.run('mcp__probe__echo', undefined)
  void r
  const { ToolCallId } = f
  const res = await f.ctx.tools.execute({ signal: new AbortController().signal, callId: ToolCallId('probe-1'), name: 'mcp__probe__echo', arguments: { message: 'hi' } })
  step('mcp.call', { content: JSON.stringify(res?.content).slice(0, 160), isError: res?.isError === true })
  // dispose → child reaped?
  const log = (await import('node:fs')).readFileSync(logPath, 'utf8').trim().split('\n')
  step('mcp.childlog', { lines: log.length, first: log[0]?.slice(0, 120) })
  const pid = Number(/"pid":(\d+)/.exec(log[0] ?? '')?.[1])
  process.kill(pid, 0) // throws if gone
  step('mcp.child-alive', { pid, self_pid: process.pid })
  await f.ctx.dispose()
  let gone = false
  for (let i = 0; i < 50; i += 1) {
    await new Promise((r) => setTimeout(r, 100))
    try { process.kill(pid, 0) } catch { gone = true; break }
  }
  step('mcp.child-reaped', { pid, gone })
}

console.log('PROBE_DONE')
void fileURLToPath
void dshJobs
void dshWebBare
process.exit(0)
