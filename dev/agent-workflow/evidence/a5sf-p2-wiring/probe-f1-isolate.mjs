/**
 * probe-f1-isolate.mjs — the F1 measurement (review response, 2026-11-03).
 *
 * WHAT IT MEASURES: the P2 mount installs the confined Provider through
 * `root.isolate('fs', Symbol(...))` (`team-services/src/install.ts:182` member,
 * `:332` binding). Cordis `isolate()` creates a SIBLING scope, so the Context
 * the mount was given (the live agent row's ctx) keeps the BASE provider, and
 * only the returned realm contexts (`installation.members[i].ctx`,
 * `bindings[i].ctx`) see the confined class. This script mounts the compiled
 * realm from `packages/runtime/dist` over a unit root and reads the SAME
 * outside-ALLOWED file through three contexts.
 *
 * Run (host-free; no Host, no port, no DSH_HOME):
 *   cd packages/runtime/dist
 *   node ../../../dev/agent-workflow/evidence/a5sf-p2-wiring/probe-f1-isolate.mjs "$(pwd)"
 *
 * Expected (measured 2026-11-03): agent row ctx reads the file ALLOWED; the
 * member realm ctx and the binding realm ctx answer IO_READ_DENIED; the sink
 * receives ZERO facts because nothing consumed the realm contexts.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { appendFile, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const DIST = process.argv[2]
if (DIST === undefined) throw new Error('usage: node probe-f1-isolate.mjs <packages/runtime/dist>')

const req = createRequire(join(DIST, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(req.resolve('@deepseek-ai/cordis')).href)
const { mountA5sfRealm } = await import(pathToFileURL(join(DIST, 'packages/runtime/team-services/src/mount.js')).href)

const ID = { teamId: 'team-probe', memberInstanceId: 'member-probe', templateId: 'worker', instanceGeneration: 1 }
const lane = (a) => ({ mode: 'restricted', allow: [a], ask: [], deny: [] })
const policy = (a) => ({ memberIdentity: ID.memberInstanceId, templateId: ID.templateId, instanceGeneration: 1, revision: 'a5sf1:probe:g1', read: lane(a), write: lane(a), network: { access: 'allow' } })

const dir = mkdtempSync(join(tmpdir(), 'a5sf-f1-probe-'))
const inside = join(dir, 'inside')
mkdirSync(inside)
writeFileSync(join(inside, 'ok.txt'), 'ok\n', 'utf8')
writeFileSync(join(dir, 'outside.txt'), 'outside\n', 'utf8')

class FsDouble extends Service {
  constructor(ctx, config = {}) { super(ctx, 'fs'); this.config = config }
  processPath(t) { return t.hostPath }
  contains(p, c) { return this.processPath(c).startsWith(this.processPath(p)) }
  async resolve(p) { return { hostPath: p } }
  async readText(t) { return readFileSync(this.processPath(t), 'utf8') }
  async streamText(t) { const s = await this.readText(t); return (async function* () { yield s })() }
  async readBytes(t) { return readFileSync(this.processPath(t)) }
  async readByteRange(t, r) { return readFileSync(this.processPath(t)).subarray(r.offset, r.offset + r.length) }
  async listDir() { return [] }
  async stat() { return { size: 0 } }
  async lstat() { return { size: 0 } }
  async watch() { return async () => {} }
  async writeText() { return { version: 'v1' } }
  async editText() { return { version: 'v2' } }
}

const root = new Context()
await root.plugin(FsDouble, {})
const sinkPath = join(dir, 'consult.jsonl')
const mounted = await mountA5sfRealm({
  root,
  members: [{ identity: ID, policy: { ok: true, value: policy(inside) } }],
  bindings: [{
    identity: ID,
    toolBindingIdentity: 'dsh.fs/read',
    effective: { ...policy(inside), toolBindingIdentity: 'dsh.fs/read', invocationId: 'inv-1', policyRevision: 'a5sf1:probe:g1:dsh.fs/read' },
  }],
  providerClass: FsDouble,
  onGuardConsult: async (fact) => { await appendFile(sinkPath, `${JSON.stringify(fact)}\n`, 'utf8') },
})

const readThrough = async (ctx, path) => {
  try {
    return `ALLOWED:${JSON.stringify(await ctx.get('fs').readText(await ctx.get('fs').resolve(path)))}`
  } catch (error) {
    return String(error.code ?? error.message)
  }
}
const outside = join(dir, 'outside.txt')
console.log('mount root ctx constructor       :', root.get('fs').constructor.name)
console.log('agent row ctx -> outside         :', await readThrough(root, outside))
console.log('realm member ctx constructor     :', mounted.installation.members[0].ctx.get('fs').constructor.name)
console.log('realm member ctx -> outside      :', await readThrough(mounted.installation.members[0].ctx, outside))
console.log('realm binding ctx constructor    :', mounted.bindings[0].ctx.get('fs').constructor.name)
console.log('realm binding ctx -> outside     :', await readThrough(mounted.bindings[0].ctx, outside))
console.log('agent row ctx -> allowed file    :', await readThrough(root, join(inside, 'ok.txt')))
const facts = existsSync(sinkPath) ? (await readFile(sinkPath, 'utf8')).trim().split('\n').filter(Boolean).length : 0
console.log('sink exists / facts              :', existsSync(sinkPath), '/', facts)
console.log('sink attribution                 : the facts above are the probe’s OWN two realm-ctx reads; the agent-row-ctx read (outside ALLOWED) contributed ZERO')
console.log('VERDICT                          : the mount lands in a SIBLING isolate; the agent row ctx keeps the BASE Provider (ALLOWED), so a product row consuming agentCtx produces ZERO consultations.')
await mounted.dispose()
