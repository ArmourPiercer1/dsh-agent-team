import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const REPO_ROOT = '/home/armourpiercer/projects/dsh-agent-team/.worktrees/a5sf-bl16-grep'
const BASELINE = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)
const confinedModule = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'subprocess.ts')).href)
const policy = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'member-io-policy', 'src', 'index.ts')).href)
const providerModule = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'sandbox-provider', 'provider.ts')).href)
const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const subprocessLocal = await import(pathToFileURL(join(BASELINE, 'packages', 'subprocess', 'subprocess-local', 'lib', 'index.js')).href)
const LAUNCHER = join(REPO_ROOT, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const I = { teamId: 't', memberInstanceId: 'm', templateId: 'worker', instanceGeneration: 1 }
const lane = (allow) => ({ mode: 'restricted', allow, ask: [], deny: [] })
const eff = policy.compileEffectiveIo(
  { memberIdentity: 'm', templateId: 'worker', instanceGeneration: 1, revision: 'r', read: lane([join(tmpdir(), 'x')]), write: lane([join(tmpdir(), 'x')]), network: { access: 'allow' } },
  { bindingIdentity: 'b', read: lane([join(tmpdir(), 'x')]), write: { mode: 'all', allow: [], ask: [], deny: [] }, network: 'allow' },
  { memberIdentity: 'm', callId: 'c', policyRevision: 'r', toolBindingIdentity: 'b', approvedOnce: false })
const world = mkdtempSync(join(tmpdir(), 'bl16-proc-'))
const inside = join(world, 'inside'); mkdirSync(inside, { recursive: true })
// rebuild the effective lane now that `inside` exists
const eff2 = policy.compileEffectiveIo(
  { memberIdentity: 'm', templateId: 'worker', instanceGeneration: 1, revision: 'r', read: lane([inside]), write: lane([inside]), network: { access: 'allow' } },
  { bindingIdentity: 'b', read: lane([inside]), write: { mode: 'all', allow: [], ask: [], deny: [] }, network: 'allow' },
  { memberIdentity: 'm', callId: 'c', policyRevision: 'r', toolBindingIdentity: 'b', approvedOnce: false })
assert.equal(eff2.ok, true)
const raw = providerModule.createConfinedProcessProvider({ realmId: 'r-proc', trustRoot: `sha256:${LAUNCHER_SHA.slice(0,16)}#${LAUNCHER}`, scratchRoot: join(world, 'scratch'), assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 } })
const root = new Context()
const service = new (confinedModule.createConfinedSubprocessClass(subprocessLocal.default ?? subprocessLocal, { effective: eff2.value, provider: raw, realmId: 'r-proc' }))(root)
const h = service.spawn({ argv: ['/bin/sh', '-c', `echo "own=${process.env.Review_Leak_Secret ?? '<unset>'}"; echo '--- ppid environ ---'; tr "\\0" "\\n" < /proc/$PPID/environ | grep -E 'Review_Leak_Secret|DSH_|API_KEY' | head -5; echo '--- node pid environ ---'; for p in $(ls /proc | grep -E '^[0-9]+$'); do if grep -qa 'node' /proc/$p/cmdline 2>/dev/null; then tr "\\0" "\\n" < /proc/$p/environ 2>/dev/null | grep -E 'Review_Leak_Secret|API_KEY' | head -3; fi; done`], cwd: inside, stdio: { stdin: 'ignore', stdout: { maxBytes: 1<<20 }, stderr: { maxBytes: 1<<16 } }, graceMs: 8000 })
await h.done
console.log('STDOUT:\n' + (h.collected.stdout?.readFrom(0).text ?? ''))
console.log('STDERR:\n' + (h.collected.stderr?.readFrom(0).text ?? ''))
await root.dispose?.(); rmSync(world, { recursive: true, force: true })
