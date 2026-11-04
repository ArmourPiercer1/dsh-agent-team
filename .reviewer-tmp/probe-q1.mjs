// Reviewer-written probe (independent of the author's arms): does the OS layer
// hold for symlink / nested .. / hardlink / runtime-base reads?
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, linkSync, writeFileSync, existsSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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
const IDENTITY = Object.freeze({ teamId: 'team-q1', memberInstanceId: 'member-q1', templateId: 'worker', instanceGeneration: 1 })
const REVISION = 'a5sf1:q1:probe'
const BINDING = 'dsh.search/grep'
const lane = (allow) => ({ mode: 'restricted', allow: [...allow], ask: [], deny: [] })
const ceilingOf = (read, write) => ({ memberIdentity: IDENTITY.memberInstanceId, templateId: 'worker', instanceGeneration: 1, revision: REVISION, read: lane(read), write: lane(write), network: { access: 'allow' } })
const effectiveOf = (read, write, restrictionRead) => {
  const out = policy.compileEffectiveIo(ceilingOf(read, write), { bindingIdentity: BINDING, read: lane(restrictionRead), write: lane(read), network: 'allow' }, {
    memberIdentity: IDENTITY.memberInstanceId, callId: 'q1', policyRevision: REVISION, toolBindingIdentity: BINDING, approvedOnce: false })
  assert.equal(out.ok, true, JSON.stringify(out))
  return out.value
}

const world = mkdtempSync(join(tmpdir(), 'bl16-q1-'))
const inside = join(world, 'inside')
const outside = join(world, 'outside')
mkdirSync(inside, { recursive: true }); mkdirSync(outside, { recursive: true })
writeFileSync(join(inside, 'needle.txt'), 'INSIDE-NEEDLE\n')
writeFileSync(join(outside, 'secret.txt'), 'OUTSIDE-SECRET-MUST-NOT-LEAK\n')
// a) file symlink inside lane -> outside file
symlinkSync(join(outside, 'secret.txt'), join(inside, 'link-file'))
// b) dir symlink inside lane -> outside dir
symlinkSync(outside, join(inside, 'link-dir'))
// c) hardlink inside lane -> outside file (created OUTSIDE the sandbox)
linkSync(join(outside, 'secret.txt'), join(inside, 'hard-inside'))
// d) hardlink inside lane -> /etc/passwd (outside lane, same-uid readable)
try { linkSync('/etc/passwd', join(inside, 'hard-etc')) } catch (e) { console.log('hardlink /etc failed:', e.code) }

const effective = effectiveOf([inside], [inside], [inside])
const realmId = 'realm-q1'
const raw = providerModule.createConfinedProcessProvider({
  realmId, trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
  scratchRoot: join(world, 'scratch'),
  assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
})
const root = new Context()
// base class is used only as a constructor; do NOT register it on this ctx
const service = new (confinedModule.createConfinedSubprocessClass(subprocessLocal.default ?? subprocessLocal, {
  effective, provider: raw, realmId, bindingId: BINDING, memberScope: IDENTITY.memberInstanceId,
}))(root)

async function run(label, body, argv0 = '/bin/sh') {
  const argv = argv0 === '/bin/sh' ? ['/bin/sh', '-c', body] : [argv0, ...body]
  const h = service.spawn({ argv, cwd: inside, stdio: { stdin: 'ignore', stdout: { maxBytes: 1 << 20 }, stderr: { maxBytes: 1 << 16 } }, graceMs: 5000 })
  try { await h.done } catch (e) { console.log(`${label}: DONE REJECTED ${e?.code ?? e}`) }
  const text = h.collected.stdout?.readFrom(0).text ?? ''
  const err = h.collected.stderr?.readFrom(0).text ?? ''
  const leaked = text.includes('OUTSIDE-SECRET-MUST-NOT-LEAK')
  console.log(`${label}: leaked=${leaked} stdout=${JSON.stringify(text.replace(/\n/g, '\\n').slice(0, 220))} stderr=${JSON.stringify(err.replace(/\n/g, '\\n').slice(0, 120))}`)
  return { text, err, leaked }
}

console.log('--- kernel arms (cwd in-lane, argv names only sh) ---')
await run('A in-lane control  cat inside/needle', `cat ${join(inside, 'needle.txt')} 2>&1; echo RC=$?`)
await run('B direct outside    cat outside/secret', `cat ${join(outside, 'secret.txt')} 2>&1; echo RC=$?`)
await run('C symlink FILE      cat inside/link-file', `cat ${join(inside, 'link-file')} 2>&1; echo RC=$?`)
await run('D symlink DIR       cat inside/link-dir/secret', `cat ${join(inside, 'link-dir', 'secret.txt')} 2>&1; echo RC=$?`)
await run('E nested ..         cat inside/../outside/secret', `cat ${inside}/../outside/secret.txt 2>&1; echo RC=$?`)
await run('F hardlink (pre)    cat inside/hard-inside', `cat ${join(inside, 'hard-inside')} 2>&1; echo RC=$?`)
await run('G hardlink (child)  ln then cat', `ln ${join(outside, 'secret.txt')} ${join(inside, 'hard-child')} 2>&1; echo LN=$?; cat ${join(inside, 'hard-child')} 2>&1; echo RC=$?`)
await run('H /etc/passwd (README says kernel-refused)', `head -c 40 /etc/passwd 2>&1; echo RC=$?`)
await run('I /usr read        head /usr/share/dict/words? -> /usr/lib/os-release', `head -c 40 /usr/lib/os-release 2>&1; echo RC=$?`)
await run('J /proc/self/status', `head -c 40 /proc/self/status 2>&1; echo RC=$?`)
await run('K /etc via symlink inside', `ln -s /etc/passwd ${join(inside, 'link-etc')} 2>&1; cat ${join(inside, 'link-etc')} 2>&1 | head -c 40; echo RC=$?`)

// rg arms: does the real search follow a symlink/hardlink inside the declared root?
import { createRequire as cr } from 'node:module'
const rgPath = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'node_modules', '.pnpm', '@vscode+ripgrep-linux-x64@1.18.0', 'node_modules', '@vscode', 'ripgrep-linux-x64', 'bin', 'rg')
console.log('rg exists:', existsSync(rgPath), rgPath)
async function rgArm(label, extra, rootPath = inside) {
  const h = service.spawn({ argv: [rgPath, '--json', '-n', ...extra, 'OUTSIDE-SECRET', '--', rootPath], cwd: inside, stdio: { stdin: 'ignore', stdout: { maxBytes: 1 << 20 }, stderr: { maxBytes: 1 << 16 } }, graceMs: 5000 })
  try { await h.done } catch (e) { console.log(`${label}: DONE REJECTED ${e?.code ?? e}`) }
  const text = h.collected.stdout?.readFrom(0).text ?? ''
  const err = h.collected.stderr?.readFrom(0).text ?? ''
  console.log(`${label}: leaked=${text.includes('OUTSIDE-SECRET')} stdout=${JSON.stringify(text.slice(0, 160))} stderr=${JSON.stringify(err.slice(0, 120))}`)
}
console.log('--- rg arms (declared root = inside, which holds a symlink + hardlink) ---')
try { await rgArm('RG default (no follow)', []) } catch (e) { console.log('RG arm threw:', e?.code ?? e, e?.message) }
try { await rgArm('RG --follow', ['--follow']) } catch (e) { console.log('RG follow threw:', e?.code ?? e, e?.message) }
try { await rgArm('RG root = symlink dir (declared root is a symlink)', [], join(inside, 'link-dir')) } catch (e) { console.log('RG symlink-root threw:', e?.code ?? e, e?.message) }

// admission arm: declared root is a symlink to outside -> should refuse before spawn
console.log('--- admission arms (readIntentsOf + guard, no provider call) ---')
const guard = confinedModule.createMemberSubprocessGuard(effective)
for (const [label, target] of [
  ['root=symlink-dir', join(inside, 'link-dir')],
  ['root=symlink-file', join(inside, 'link-file')],
  ['root=hardlink', join(inside, 'hard-inside')],
  ['root=outside', outside],
]) {
  const spec = { argv: [rgPath, 'x', '--', target], cwd: inside }
  const intents = confinedModule.readIntentsOf(spec)
  let decision = 'ALLOW'
  for (const i of intents) { try { await guard('spawn', i) } catch (e) { decision = `${e.code}` } }
  console.log(`${label}: intents=${JSON.stringify(intents)} decision=${decision}`)
}

await root.dispose?.()
rmSync(world, { recursive: true, force: true })
