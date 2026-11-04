// Reviewer instrumentation: order of guard consult vs provider call, and where
// the refusal surfaces (sync throw vs handle.done).
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { register } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
register(pathToFileURL('/home/armourpiercer/projects/dsh-agent-team/.worktrees/a5sf-bl16-grep/scripts/run-tests-hooks.mjs').href)
const R = '/home/armourpiercer/projects/dsh-agent-team/.worktrees/a5sf-bl16-grep'
const m = await import(pathToFileURL(join(R, 'packages/runtime/team-services/src/subprocess.ts')).href)
const p = await import(pathToFileURL(join(R, 'packages/runtime/member-io-policy/src/index.ts')).href)
const world = mkdtempSync(join(tmpdir(), 'bl16-order-')); const inside = join(world, 'in'); const outside = join(world, 'out'); mkdirSync(inside); mkdirSync(outside)
const lane = (a) => ({ mode: 'restricted', allow: a, ask: [], deny: [] })
const eff = p.compileEffectiveIo(
  { memberIdentity: 'm', templateId: 'w', instanceGeneration: 1, revision: 'r', read: lane([inside]), write: lane([inside]), network: { access: 'allow' } },
  { bindingIdentity: 'b', read: lane([inside]), write: { mode: 'all', allow: [], ask: [], deny: [] }, network: 'allow' },
  { memberIdentity: 'm', callId: 'c', policyRevision: 'r', toolBindingIdentity: 'b', approvedOnce: false })
assert.equal(eff.ok, true)
const order = []
let providerCalls = 0
const provider = { async spawnStreaming() { providerCalls += 1; order.push('PROVIDER'); throw new Error('should never be reached for a refused arm') } }
const facts = []
class Base { constructor() {} spawn() { throw new Error('base') } async spawnTerminal() { throw new Error('base') } }
const C = m.createConfinedSubprocessClass(Base, { effective: eff.value, provider, onGuardConsult: (f) => { facts.push(f); order.push('FACT:' + f.decision) } })
const spec = { argv: ['/usr/bin/rg', '--no-config', '--json', '--regexp=x', '--', outside], cwd: inside, stdio: { stdin: 'ignore', stdout: { maxBytes: 1024 }, stderr: { maxBytes: 64 } }, graceMs: 1000 }
let threwSync = false; let handle
try { handle = new C({}).spawn(spec) } catch (e) { threwSync = true; console.log('SYNC THROW:', e?.code) }
console.log('spawn returned handle:', handle !== undefined, 'syncThrow:', threwSync)
let rejected = false
try { await handle.done } catch (e) { rejected = true; console.log('DONE REJECTED:', e?.name, e?.code, '|', e?.detail) }
console.log('providerCalls:', providerCalls, 'facts:', facts.length, facts[0] && { method: facts[0].method, decision: facts[0].decision, decidedBy: facts[0].decidedBy, locator: facts[0].locator, realm: facts[0].realm, toolBindingIdentity: facts[0].toolBindingIdentity }, 'order:', order)
rmSync(world, { recursive: true, force: true })
