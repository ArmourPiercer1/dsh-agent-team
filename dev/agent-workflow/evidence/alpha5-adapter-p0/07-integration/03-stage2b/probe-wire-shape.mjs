#!/usr/bin/env node
/**
 * probe-wire-shape.mjs — one-turn probe: what does a model request's message
 * array look like AFTER a tool result (roles + positions)? Prints a compact
 * dump and writes wire-capture.json. Boots the same world shape as the kit
 * (port 3186 for the probe; ephemeral mock).
 */
import { spawn } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { mkdirSync, readFileSync, rmSync, writeFileSync, openSync, closeSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startMockModel } from '../../../../../../packages/tools/harness/mock-deepseek.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../../../tests/kits/_shared/preset-seam.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../../tests/paths.mjs'

const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(KIT_DIR, '..', '..', '..', '..', '..', '..')
const TESTUSE = join(WORKTREE, 'tests', 'deepseek-harness-test-use')
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_NAME = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'host.js')).href
const GLUE_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
const SEAM_URL = pathToFileURL(join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const S = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const HOME = join(WORKTREE, 'tests', 'homes', `a5p0-probe-${S}`)
const WORKSPACE = join(HOME, 'workspace')
const BP_DIR = join(KIT_DIR, `probe-blueprints-${S}`)
const PORT = 3185
const ROOT = `session-probe-root-${S}`
const MK = `PROBEMK_${S}`
const SEED = join(WORKSPACE, `seed-${S}.txt`)

function yamlScalar(v) { return typeof v === 'string' ? JSON.stringify(v) : String(v) }
function lines(v, ind) {
  if (Array.isArray(v)) return v.flatMap((it) => item(it, ind))
  return Object.entries(v).flatMap(([k, x]) => emit(k, x, ind))
}
function emit(k, v, ind) {
  const pad = '  '.repeat(ind)
  if (v !== null && typeof v === 'object') {
    const empty = Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0
    if (empty) return [`${pad}${k}: ${Array.isArray(v) ? '[]' : '{}'}`]
    return [`${pad}${k}:`, ...lines(v, ind + 1)]
  }
  return [`${pad}${k}: ${yamlScalar(v)}`]
}
function item(it, ind) {
  const pad = '  '.repeat(ind)
  if (it === null || typeof it !== 'object') return [`${pad}- ${yamlScalar(it)}`]
  const es = Object.entries(it)
  const [fk, fv] = es[0]
  const fl = emit(fk, fv, ind + 1)
  return [`${pad}- ${fl[0].slice((ind + 1) * 2)}`, ...fl.slice(1), ...es.slice(1).flatMap(([k, v]) => emit(k, v, ind + 1))]
}
const BP = ['---', 'schemaVersion: 3', 'blueprintId: team.probe-anchor', 'revision: "1"', 'leader:', '  templateId: leader', `  persona: "probe ${MK}"`, 'members:', '  - templateId: worker', '    persona: "probe worker"', 'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', ''].join('\n')

mkdirSync(WORKSPACE, { recursive: true })
mkdirSync(BP_DIR, { recursive: true })
writeFileSync(SEED, `PROBE-CONTENT-${S}\n`)
writeFileSync(join(BP_DIR, 'anchor.yaml'), BP)
writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({ boot: 1, phase: 'create', reportDir: KIT_DIR, runStamp: S, rootSessionId: ROOT }))
writeFileSync(join(HOME, 'a5p0-adapter-directive.json'), JSON.stringify({ nativeName: 'read', armToken: 'x', disposeToken: 'y', adapterMark: 'z', markerFile: join(KIT_DIR, 'probe-marker.log'), logFile: join(KIT_DIR, 'probe-plugin.log') }))
mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
const y = [
  '- insert:',
  ...item({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: { rootSessionId: ROOT, bootPhase: 'create', blueprintSource: BP, blueprintDir: BP_DIR, rootPresetId: 'probe-smoke', seedMembers: [], generation: 1, staticModel: { provider: 'deepseek-official', model: 'probe-model' }, deniedSelection: null, mcpServers: [], mcpServer: null, environmentFacts: [
    { domain: 'tool', subject: 'web', available: true, generation: 1 },
    { domain: 'skill', subject: 'base', available: true, generation: 1 },
    { domain: 'persona', subject: 'standard', available: true, generation: 1 },
  ], externalPolicyFacts: { hard: {}, capabilityExists: {} }, glueUrl: GLUE_URL, seamUrl: SEAM_URL } }, 2),
  ...item(presetDeclarationRow({ id: 'probe-smoke', displayName: 'probe', description: 'probe', plugins: smokePresetPlugins({ personaText: 'probe {{model}}', cwdSuffix: 'cwd {{cwd}}', bashDescription: 'bash' }) }), 2),
  '',
].join('\n')
writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), y)

let mode = 0
let captured = false
const mock = await startMockModel({ port: 0, decide: ({ req }) => {
  const msgs = (req && req.messages) ?? (req && req.body && req.body.messages) ?? []
  try { appendFileSync(join(KIT_DIR, 'probe-reqs.log'), `seq=${req && req.seq} n=${msgs.length} roles=${msgs.map(m=>m.role).join(',')} head=${String(typeof msgs[0]?.content === 'string' ? msgs[0].content : JSON.stringify(msgs[0]?.content ?? '')).slice(0,90)}\n`) } catch { /* */ }
  const first = msgs[0]
  const firstText = typeof first?.content === 'string' ? first.content : JSON.stringify(first?.content ?? '')
  if (firstText.includes('session title')) return { kind: 'text', content: 'probe title' }
  const hasToolResult = msgs.some((m) => m.role === 'tool' || (m.tool_call_id ?? null) !== null)
  const isTurn = msgs.some((m) => m.role === 'user' && (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')).includes(MK))
  if (isTurn && !hasToolResult && mode === 0) {
    mode = 1
    return { kind: 'tool-call', toolCalls: [{ id: 'probe-call-1', name: 'read', arguments: { file_path: SEED } }] }
  }
  if (mode === 1 && msgs.length >= 3 && !captured) {
    captured = true
    writeFileSync(join(KIT_DIR, 'wire-capture.json'), JSON.stringify(msgs.map((m, i) => ({
      i, role: m.role, keys: Object.keys(m), contentBlocks: Array.isArray(m.content) ? m.content.map((b) => (b && b.type) ?? typeof b) : typeof m.content,
      contentDump: JSON.stringify(m.content ?? null).slice(0, 700), toolCallId: m.tool_call_id ?? null, toolCallId2: m.toolUseId ?? null, toolCallId3: m.tool_use_id ?? null, toolCallsRaw: JSON.stringify(m.tool_calls ?? m.toolCalls ?? null).slice(0, 400),
    })), null, 2))
    return { kind: 'text', content: 'PROBE_DONE' }
  }
  return { kind: 'text', content: 'PROBE_NOOP' }
}, log: () => {} })

const logPath = join(KIT_DIR, `probe-instance-${S}.log`)
const fd = openSync(logPath, 'a')
const child = spawn(process.execPath, [join(TESTUSE, 'apps/cli/lib/bin.js'), 'web', '--port', String(PORT), '--no-open'], {
  cwd: WORKSPACE, stdio: ['ignore', fd, fd],
  env: { ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH, DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`, DEEPSEEK_API_KEY: 'probe-key' },
})
closeSync(fd)
let line = null
for (let i = 0; i < 160; i += 1) {
  await new Promise((r) => setTimeout(r, 300))
  try { const m = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/.exec(readFileSync(logPath, 'utf8')); if (m !== null) { line = m; break } } catch { /* */ }
  if (child.exitCode !== null) break
}
if (line === null) { console.log('BOOT FAILED'); try { process.kill(child.pid) } catch { /* */ } process.exit(1) }
const origin = `http://127.0.0.1:${line[1]}`
const res = await fetch(`${origin}/?token=${line[2]}`, { redirect: 'manual' })
const cookie = res.headers.get('set-cookie').split(';', 1)[0]
await new Promise((r) => setTimeout(r, 3000))
await fetch(`${origin}/api/session/prompt`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ type: 'client-request', rpcId: 'p1', method: 'session/prompt', payload: { args: { request: { requestId: 'p1', sessionId: ROOT, mode: 'queue', content: [{ type: 'text', text: MK }] } } } }) })
for (let i = 0; i < 200; i += 1) {
  await new Promise((r) => setTimeout(r, 300))
  if (captured || mode === 1 && mock.requests.length >= 12) break
}
console.log('requests:', mock.requests.length)
try { console.log(readFileSync(join(KIT_DIR, 'wire-capture.json'), 'utf8').slice(0, 4000)) } catch { console.log('NO CAPTURE') }
try { process.kill(child.pid) } catch { /* */ }
await mock.close()
rmSync(HOME, { recursive: true, force: true })
console.log('PROBE_DONE (world removed)')
process.exit(0)
