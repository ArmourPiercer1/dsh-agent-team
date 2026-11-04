import { createHash } from 'node:crypto'
import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const R = '/home/armourpiercer/projects/dsh-agent-team/.worktrees/a5sf-bl16-grep'
const RG = '/home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use/node_modules/.pnpm/@vscode+ripgrep-linux-x64@1.18.0/node_modules/@vscode/ripgrep-linux-x64/bin/rg'
register(pathToFileURL(join(R, 'scripts/run-tests-hooks.mjs')).href)
const m = await import(pathToFileURL(join(R, 'packages/runtime/team-services/src/subprocess.ts')).href)
const p = await import(pathToFileURL(join(R, 'packages/runtime/member-io-policy/src/index.ts')).href)
const prov = await import(pathToFileURL(join(R, 'packages/runtime/sandbox-provider/provider.ts')).href)
const req = createRequire(join(R, 'packages/runtime/package.json'))
const { Context } = await import(pathToFileURL(req.resolve('@deepseek-ai/cordis')).href)
const subLocal = await import(pathToFileURL(join(R, 'tests/deepseek-harness-test-use/packages/subprocess/subprocess-local/lib/index.js')).href)
const L = join(R, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const SHA = createHash('sha256').update(readFileSync(L)).digest('hex')

const world = mkdtempSync(join(tmpdir(), 'bl16-bypass-'))
const inside = join(world, 'in'); mkdirSync(inside)
const outside = join(world, 'out'); mkdirSync(outside)
writeFileSync(join(outside, 'secret.txt'), 'OUTSIDE-SECRET-MUST-NOT-LEAK\n')
const hostname = readFileSync('/etc/hostname', 'utf8').trim()
writeFileSync(join(inside, 'hit.txt'), `host=${hostname}\nINSIDE\n`)
writeFileSync(join(inside, 'rg'), '#!/bin/sh\necho RG-NAMED-SCRIPT-EXECUTED\ngrep root: /etc/passwd | head -1\n')
chmodSync(join(inside, 'rg'), 0o755)
writeFileSync(join(inside, 'rgrc'), '--pre=/bin/sh\n')
writeFileSync(join(inside, '--no-config'), '')
writeFileSync(join(inside, 'evil.sh'), 'echo PRE-EXECUTED\ncat /etc/hostname\n')
writeFileSync(join(inside, 'run.sh'), '#!/bin/sh\necho SHEBANG-RAN\n')
chmodSync(join(inside, 'run.sh'), 0o755)
symlinkSync('/etc/passwd', join(inside, 'link-passwd'))
const sink = join(world, 'sink.jsonl')

const lane = (a) => ({ mode: 'restricted', allow: a, ask: [], deny: [] })
const eff = p.compileEffectiveIo(
  { memberIdentity: 'm', templateId: 'w', instanceGeneration: 1, revision: 'r1', read: lane([inside]), write: lane([inside]), network: { access: 'allow' } },
  { bindingIdentity: 'b', read: lane([inside]), write: { mode: 'all', allow: [], ask: [], deny: [] }, network: 'allow' },
  { memberIdentity: 'm', callId: 'c', policyRevision: 'r1', toolBindingIdentity: 'b', approvedOnce: false })
const raw = prov.createConfinedProcessProvider({ realmId: 'r', trustRoot: `sha256:${SHA.slice(0,16)}#${L}`, scratchRoot: join(world, 'scratch'), assembly: { launcherPath: L, launcherSha256: SHA, minAbiVersion: 3 } })
const root = new Context()
const service = new (m.createConfinedSubprocessClass(subLocal.default ?? subLocal, {
  effective: eff.value, provider: raw, realmId: 'r',
  onGuardConsult: (fact) => appendFileSync(sink, `${JSON.stringify(fact)}\n`),
}))(root)

function facts() { try { return readFileSync(sink, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) } catch { return [] } }
async function run(label, argv, expect = 'any', env) {
  const before = facts().length
  let syncThrow
  let h
  try { h = service.spawn({ argv, cwd: inside, stdio: { stdin: 'ignore', stdout: { maxBytes: 1 << 20 }, stderr: { maxBytes: 1 << 16 } }, graceMs: 5000, ...(env ? { env } : {}) }) }
  catch (e) { syncThrow = `${e.name}/${e.code ?? ''}: ${String(e.message).slice(0, 120)}` }
  let done = 'resolved'
  if (h) { try { await h.done } catch (e) { done = `rejected ${e.name}/${e.code ?? ''}` } }
  const out = h?.collected?.stdout?.readFrom(0).text ?? ''
  const f = facts().slice(before)
  console.log(`${label}\n  argv0=${argv[0]} syncThrow=${syncThrow ?? 'no'} done=${done} facts=${f.length}${f.length ? ` [${f.map((x) => `${x.decision}/${x.decidedBy}/${x.locator}`).join(' | ')}]` : ''}\n  out=${JSON.stringify(out.replace(/\n/g, '\\n').slice(0, 220))}`)
}

console.log(`hostname=${hostname}`)
await run('A1 rg -f /etc/hostname (undeclared pattern file, kernel-allowed /etc)', [RG, '--no-config', '--json', '-f', '/etc/hostname', '--', inside])
await run('A2 rg --file=/etc/hostname', [RG, '--no-config', '--json', '--file=/etc/hostname', '--', inside])
await run('A3 rg -L (follow) over in-lane symlink -> /etc/passwd', [RG, '--no-config', '--json', '-L', '--regexp=root:', '--', inside])
await run('A4 shell script NAMED rg (program-dir grant)', [join(inside, 'rg'), '--no-config', '--', inside])
await run('A5 shebang script, name not in allow-list', [join(inside, 'run.sh'), '--no-config'])
await run('A6 env sh -c id', ['/usr/bin/env', 'sh', '-c', 'id'])
await run('A7 /bin/sh -c cat /etc/passwd', ['/bin/sh', '-c', 'cat /etc/passwd'])
await run('A8 bare name rg (no absolute path)', ['rg', '--no-config', '--', inside])
await run('A9 rg --search-zip=true', [RG, '--no-config', '--search-zip=true', '--', inside])
await run('A10 rg --pre=/bin/cat', [RG, '--no-config', '--pre=/bin/cat', '--', inside])
await run('A11 rg --glob=../out/* (escape attempt)', [RG, '--no-config', '--json', '--glob=../out/*', '--regexp=OUTSIDE', '--', inside])
await run('B1 rg --no-config after -- (existing lane file named --no-config) + RIPGREP_CONFIG_PATH -> config --pre=/bin/sh runs a script', [RG, '--json', '--regexp=PRE-EXECUTED', '--', inside, '--no-config'], 'any', { RIPGREP_CONFIG_PATH: join(inside, 'rgrc') })
await run('A12 rg declared root = outside', [RG, '--no-config', '--json', '--regexp=OUTSIDE', '--', outside])
await root.dispose?.()
rmSync(world, { recursive: true, force: true })
