import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const R = '/home/armourpiercer/projects/dsh-agent-team/.worktrees/a5sf-bl16-grep'
register(pathToFileURL(join(R, 'scripts/run-tests-hooks.mjs')).href)
const m = await import(pathToFileURL(join(R, 'packages/runtime/team-services/src/subprocess.ts')).href)
const p = await import(pathToFileURL(join(R, 'packages/runtime/member-io-policy/src/index.ts')).href)
const prov = await import(pathToFileURL(join(R, 'packages/runtime/sandbox-provider/provider.ts')).href)
const req = createRequire(join(R, 'packages/runtime/package.json'))
const { Context } = await import(pathToFileURL(req.resolve('@deepseek-ai/cordis')).href)
const subLocal = await import(pathToFileURL(join(R, 'tests/deepseek-harness-test-use/packages/subprocess/subprocess-local/lib/index.js')).href)
const L = join(R, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const SHA = createHash('sha256').update(readFileSync(L)).digest('hex')
const world = mkdtempSync(join(tmpdir(), 'bl16-allow-')); const inside = join(world, 'in'); mkdirSync(inside)
symlinkSync('/etc/passwd', join(inside, 'link-passwd'))
symlinkSync('/usr/lib/os-release', join(inside, 'link-osrelease'))
symlinkSync('/proc/self/status', join(inside, 'link-proc'))
const lane = (a) => ({ mode: 'restricted', allow: a, ask: [], deny: [] })
const eff = p.compileEffectiveIo(
  { memberIdentity: 'm', templateId: 'w', instanceGeneration: 1, revision: 'r', read: lane([inside]), write: lane([inside]), network: { access: 'allow' } },
  { bindingIdentity: 'b', read: lane([inside]), write: { mode: 'all', allow: [], ask: [], deny: [] }, network: 'allow' },
  { memberIdentity: 'm', callId: 'c', policyRevision: 'r', toolBindingIdentity: 'b', approvedOnce: false })
const raw = prov.createConfinedProcessProvider({ realmId: 'r', trustRoot: `sha256:${SHA.slice(0,16)}#${L}`, scratchRoot: join(world, 'scratch'), assembly: { launcherPath: L, launcherSha256: SHA, minAbiVersion: 3 } })
const root = new Context()
const service = new (m.createConfinedSubprocessClass(subLocal.default ?? subLocal, { effective: eff.value, provider: raw, realmId: 'r' }))(root)
for (const [label, target] of [['symlink -> /etc/passwd', 'link-passwd'], ['symlink -> /usr/lib/os-release', 'link-osrelease'], ['symlink -> /proc/self/status', 'link-proc']]) {
  const h = service.spawn({ argv: ['/bin/sh', '-c', `head -c 32 ${join(inside, target)} 2>&1; echo RC=$?`], cwd: inside, stdio: { stdin: 'ignore', stdout: { maxBytes: 4096 }, stderr: { maxBytes: 1024 } }, graceMs: 5000 })
  await h.done
  console.log(label + ': ' + JSON.stringify((h.collected.stdout?.readFrom(0).text ?? '').replace(/\n/g, '\\n')))
}
await root.dispose?.(); rmSync(world, { recursive: true, force: true })
