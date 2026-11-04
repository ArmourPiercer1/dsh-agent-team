// Reviewer probe: with a subprocess face declared, does the Member ctx still
// resolve the CONFINED fs (no widening), and are the root services untouched?
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { register } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
const R = '/home/armourpiercer/projects/dsh-agent-team/.worktrees/a5sf-bl16-grep'
register(pathToFileURL(join(R, 'scripts/run-tests-hooks.mjs')).href)
const install = await import(pathToFileURL(join(R, 'packages/runtime/team-services/src/install.ts')).href)
const req = createRequire(join(R, 'packages/runtime/package.json'))
const { Context, Service } = await import(pathToFileURL(req.resolve('@deepseek-ai/cordis')).href)
const world = mkdtempSync(join(tmpdir(), 'bl16-iso-')); const inside = join(world, 'in'); const outside = join(world, 'out'); mkdirSync(inside); mkdirSync(outside)
writeFileSync(join(inside, 'ok.txt'), 'IN'); writeFileSync(join(outside, 'secret.txt'), 'OUT')
class BaseFs extends Service {
  constructor(ctx, config = {}) { super(ctx, 'fs'); this.config = config }
  processPath(t) { return t.hostPath } contains(a,b){return String(this.processPath(b)).startsWith(String(this.processPath(a)))}
  async resolve(p){return {hostPath:p, displayPath:p}} async readText(t){return readFileSync(this.processPath(t),'utf8')}
  async streamText(t){const s=await this.readText(t);return (async function*(){yield s})()}
  async readBytes(t){return readFileSync(this.processPath(t))} async readByteRange(t){return readFileSync(this.processPath(t))}
  async listDir(){return []} async stat(t){return {type:'file',size:1,mtimeMs:0,mode:0o644}} async lstat(t){return this.stat(t)}
  async watch(){return ()=>undefined} async writeText(t,c){writeFileSync(this.processPath(t),String(c));return {version:'v1'}}
  async editText(t,e){writeFileSync(this.processPath(t),String(e.newString));return {version:'v2'}}
}
class BaseSub extends Service { constructor(ctx, cfg={}){super(ctx,'subprocess');this.config=cfg} spawn(){throw new Error('BASE_SPAWN')} async spawnTerminal(){throw new Error('BASE_TERM')} }
const root = new Context(); await root.plugin(BaseFs, {}); await root.plugin(BaseSub, {})
const baseFs = root.get('fs'); const baseSub = root.get('subprocess')
async function rootFsReadsOutside() { try { const t = await root.get('fs').readText({ hostPath: join(outside, 'secret.txt') }); return 'ALLOWED:' + t } catch (e) { return 'REFUSED:' + (e?.code ?? e?.name ?? e) } }
function rootSubSpawn() { try { root.get('subprocess').spawn({ argv: ['/bin/true'] }); return 'SPAWNED' } catch (e) { return 'THREW:' + String(e?.message ?? e) } }
console.log('PRE root fs outside read:', await rootFsReadsOutside(), '| root subprocess spawn:', rootSubSpawn())
const identity = { teamId: 't', memberInstanceId: 'm1', templateId: 'w', instanceGeneration: 1 }
const lane = (a) => ({ mode: 'restricted', allow: a, ask: [], deny: [] })
const memberPolicy = { memberIdentity: 'm1', templateId: 'w', instanceGeneration: 1, revision: 'r', read: lane([inside]), write: lane([inside]), network: { access: 'allow' } }
const provider = { async spawnStreaming(){ throw new Error('not used') } }
const inst = await install.installMemberIoProviders({ root, members: [{ identity, policy: { ok: true, value: memberPolicy } }], providerClass: BaseFs,
  subprocess: { effective: { ...memberPolicy, policyRevision: 'r', toolBindingIdentity: null }, provider, realmId: 'realm-x' } })
const m = inst.members[0]
console.log('member fs is confined:', m.fs !== baseFs, '| ctx fs is confined:', m.ctx.get('fs') !== baseFs)
console.log('ctx subprocess is confined:', m.ctx.get('subprocess') !== baseSub, '| subprocess surface present:', m.subprocess !== undefined)
console.log('root fs identity equal:', root.get('fs') === baseFs, '| root subprocess identity equal:', root.get('subprocess') === baseSub)
console.log('POST root fs outside read:', await rootFsReadsOutside(), '| root subprocess spawn:', rootSubSpawn())
try { await m.fs.readText({ hostPath: join(outside, 'secret.txt') }); console.log('OUT-OF-LANE FS READ: ALLOWED (BAD)') }
catch (e) { console.log('out-of-lane fs read refused:', e?.code ?? e?.name) }
await inst.dispose()
try { const r = m.ctx.get('subprocess').spawn({ argv: ['/bin/true'] }); console.log('member ctx subprocess after dispose: SPAWNED', r !== undefined) } catch (e) { console.log('member ctx subprocess after dispose THREW:', String(e?.message ?? e)) }
rmSync(world, { recursive: true, force: true })
