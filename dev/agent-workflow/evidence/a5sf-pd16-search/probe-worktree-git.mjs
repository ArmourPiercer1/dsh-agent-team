#!/usr/bin/env node
/**
 * probe-worktree-git.mjs — the measurement behind the BL-16 containment
 * correction PD-16 needed (host-free: real Landlock launcher + packaged rg, no
 * boot, no DSH_HOME, no port).
 *
 * WHY IT EXISTS. `laneSafeSearchArgv` decides whether an `rg` invocation must be
 * made lane-self-contained (`--no-ignore-parent --no-ignore-vcs`). Its rule was
 * "the walk stops at the first in-lane `.git`; nothing above can be read". The
 * first PD-16 live boot falsified that: the SEARCH face runs `rg` for a governed
 * Member whose workspace sits under `.worktrees/<task>/`, where the worktree
 * root carries a `.git` FILE (a `gitdir:` pointer). rg OPENS that file; the
 * confined kernel denies the open; rg exits 2 even though the match is already
 * on stdout. Each row below isolates one ancestor marker class and runs the
 * shipped argv and the lane-safe argv against the SAME lane:
 *
 *   valid-ws-git__parent-git-file  → plain exit 2 (fatal), flags exit 0  ← the bug
 *   valid-ws-git__high-git-dir     → plain exit 0 (a `.git` DIR above is only stat'ed)
 *   valid-ws-git__parent-gitignore → plain exit 0 (a denied `.gitignore` open is tolerated)
 *   empty-ws-git__high-git-dir     → plain exit 0 (an incomplete `.git` does not stop rg)
 *
 * The fix pinned by `packages/runtime/test/a5sf-confined-subprocess.test.ts`
 * (PD-16 arms) is the rule these four rows imply: a `.git` ends the walk only if
 * it carries `HEAD` (a repository root) or is a worktree pointer FILE, and above
 * a repository root the first `.git` FILE must be readable too.
 *
 * Run: node dev/agent-workflow/evidence/a5sf-pd16-search/probe-worktree-git.mjs
 */
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)
const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { createConfinedProcessProvider } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'sandbox-provider', 'index.ts')).href)
const { confinedSpawnAllowPaths } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'subprocess.ts')).href)
const { resolveRgPath } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tool-fs-search')).href)
const LAUNCHER = join(REPO_ROOT, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const RG = await resolveRgPath()

async function run(workspace, extra) {
  const provider = createConfinedProcessProvider({
    realmId: 'probe', trustRoot: `sha256:${SHA.slice(0, 16)}#${LAUNCHER}`,
    scratchRoot: join(workspace, '..', 'scratch'),
    assembly: { launcherPath: LAUNCHER, launcherSha256: SHA, minAbiVersion: 3 },
  })
  const out = []; const err = []
  const spawned = await provider.spawnStreaming({
    grantFingerprint: `probe:${String(Date.now())}`, realmId: 'probe', bindingId: 'probe', memberScope: 'm',
    argv: [RG, '--no-config', '--json', ...extra, '--regexp=NEEDLE', '--', workspace],
    cwd: workspace, env: [['PATH', '/usr/local/bin:/usr/bin:/bin']],
    allowPaths: confinedSpawnAllowPaths([{ path: workspace, accessBits: { execute: true, readFile: true, readDir: true } }], RG, []),
    exitPassthrough: true,
  }, {})
  if (!spawned.ok) return { error: spawned.error.code }
  const h = spawned.value
  h.stdout.on('data', (c) => out.push(Buffer.from(c).toString()))
  h.stderr.on('data', (c) => err.push(Buffer.from(c).toString()))
  const exit = await h.exited
  await h.terminate().catch(() => undefined)
  return { code: exit.code, matches: ((out.join('')).match(/"type":"match"/g) ?? []).length, stderr: err.join('').trim().slice(0, 160) }
}

const FLAGS = ['--no-ignore-parent', '--no-ignore-vcs']
async function world(label, build) {
  const root = mkdtempSync(join(tmpdir(), `probe2-${label}-`))
  const workspace = join(root, 'deep', 'a', 'b', 'workspace')
  mkdirSync(workspace, { recursive: true })
  writeFileSync(join(workspace, 'in.txt'), 'NEEDLE\n')
  writeFileSync(join(workspace, '.gitignore'), 'ignored.txt\n')
  writeFileSync(join(workspace, 'ignored.txt'), 'NEEDLE ignored\n')
  build(workspace, root)
  console.log(`\n### ${label}`)
  console.log('  plain ', JSON.stringify(await run(workspace, [])))
  console.log('  flags ', JSON.stringify(await run(workspace, FLAGS)))
}
const validGit = (ws) => {
  mkdirSync(join(ws, '.git', 'objects'), { recursive: true })
  mkdirSync(join(ws, '.git', 'refs', 'heads'), { recursive: true })
  writeFileSync(join(ws, '.git', 'HEAD'), 'ref: refs/heads/main\n')
  writeFileSync(join(ws, '.git', 'config'), '[core]\n\trepositoryformatversion = 0\n')
}
const emptyGit = (ws) => { mkdirSync(join(ws, '.git'), { recursive: true }) }

await world('valid-ws-git__parent-git-file', (ws, root) => {
  validGit(ws)
  mkdirSync(join(root, 'deep', '.gitdir'), { recursive: true })
  writeFileSync(join(root, 'deep', '.gitdir', 'HEAD'), 'x\n')
  writeFileSync(join(root, 'deep', 'a', 'b', '.git'), `gitdir: ${join(root, 'deep', '.gitdir')}\n`)
})
await world('valid-ws-git__high-git-dir', (ws, root) => {
  validGit(ws)
  mkdirSync(join(root, 'deep', '.git', 'objects'), { recursive: true })
  writeFileSync(join(root, 'deep', '.git', 'HEAD'), 'ref: refs/heads/main\n')
})
await world('valid-ws-git__parent-gitignore', (ws, root) => {
  validGit(ws)
  writeFileSync(join(root, 'deep', 'a', 'b', '.gitignore'), '*.tmp\n')
})
await world('empty-ws-git__high-git-dir', (ws, root) => {
  emptyGit(ws)
  mkdirSync(join(root, 'deep', '.git', 'objects'), { recursive: true })
  writeFileSync(join(root, 'deep', '.git', 'HEAD'), 'ref: refs/heads/main\n')
})
