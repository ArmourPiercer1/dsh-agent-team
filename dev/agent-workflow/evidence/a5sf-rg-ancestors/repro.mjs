#!/usr/bin/env node
/**
 * a5sf-rg-ancestors/repro.mjs — the BOOT-FREE reproduction of the live
 * search-lane row-1 finding, and the GREEN arm of the repair.
 *
 * THE FINDING (measured live, `a5sf-search-live` run 2026-11-04T20-17-23-485Z,
 * `live:search-row1-grep-in-lane-allowed`, judged FAIL /
 * `ROW1_CLAUSE_FAILED`, failed `resultNotError`, `matchReturned`,
 * `fileNamed`):
 *
 *   Error: grep search failed (exit 2): rg:
 *   …/.worktrees/a5sf-search-live2/.git: Permission denied (os error 13)
 *
 * The lane admitted the search root and denied `.git` — correctly. The
 * confined `rg` walked ABOVE the search root for VCS/ancestor ignore
 * discovery, tried to read the worktree's `.git` FILE, was denied by the OS
 * profile, and ripgrep treats that denial as fatal (`exit 2`). The tool
 * therefore reported a search failure for a search whose answer was present
 * on stdout.
 *
 * WHAT THIS SCRIPT IS: the smallest host-free composition that shows the
 * same bytes. It is NOT the live Host and claims nothing about the Host. It
 * builds a temp tree that IS a git worktree on disk (a `.git` FILE pointing
 * at a gitdir, the layout `git worktree add` writes), gives the confined
 * face a lane that admits ONLY `…/lane/inside`, and launches the packaged
 * ripgrep through the SHIPPED confined `subprocess` Provider (the Landlock
 * profile the product builds), exactly as the Member's `grep` does.
 *
 * ARMS
 *   A1  the worktree, lane = the search root only, `grep` argv:
 *       RED   exit 2, stderr `rg: <wt>/.git: Permission denied (os error 13)`
 *       GREEN exit 0, the match record, the two ignore-discovery flags in the
 *             executed argv, and the ONE allow fact carrying the disclosure.
 *   A1M the mutation control: the same request with the two flags STRIPPED at
 *       the provider boundary must be RED (exit 2 + the same stderr).
 *   A2  an explicit `.git` search root is refused at ADMISSION (one typed
 *       deny fact, zero processes) — the lane still denies `.git`.
 *   A2K the kernel still denies a direct `.git` read (raw provider, admission
 *       bypassed): `Permission denied`.
 *   A3  lane = the worktree ROOT: ordinary `.gitignore` semantics survive
 *       (the ignored file is absent, no flags in argv).
 *   A3M the mutation control: FORCING the flags onto that same lane makes the
 *       ignored file appear — the reason the flags are conditional.
 *
 * Usage: node repro.mjs red|green
 *   red   — expect the pre-fix behaviour (A1/A1M exit 2 with the .git denial)
 *   green — expect the post-fix behaviour (A1 exit 0 + flags + one fact)
 * Exit code 0 iff every arm has the expected outcome.
 */
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const EXPECT = process.argv[2] ?? 'red'
if (EXPECT !== 'red' && EXPECT !== 'green') {
  console.error(`usage: node repro.mjs red|green (got ${JSON.stringify(EXPECT)})`)
  process.exit(2)
}

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..')
const DIST = join(REPO, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const load = async (rel) => import(pathToFileURL(join(DIST, rel)).href)
const { compileEffectiveIo } = await load('member-io-policy/src/index.js')
const { createConfinedProcessProvider } = await load('sandbox-provider/provider.js')
const { createConfinedSubprocessClass } = await load('team-services/src/subprocess.js')

/** The packaged ripgrep the pinned search module resolves, via its own package. */
function packagedRg() {
  const searchLib = realpathSync(join(REPO, 'node_modules', '@deepseek-ai', 'dsh-tool-fs-search', 'lib', 'index.js'))
  const rgPath = createRequire(searchLib)('@vscode/ripgrep').rgPath
  if (!existsSync(rgPath)) throw new Error(`packaged rg is missing: ${rgPath}`)
  return rgPath
}

const IDENTITY = Object.freeze({ teamId: 'team-rg-anc', memberInstanceId: 'member-rg-anc', templateId: 'worker', instanceGeneration: 1 })
const lane = (allow) => Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
const ceiling = (read, write) => Object.freeze({
  memberIdentity: IDENTITY.memberInstanceId,
  templateId: IDENTITY.templateId,
  instanceGeneration: IDENTITY.instanceGeneration,
  revision: 'a5sf-rg-anc:v1',
  read,
  write,
  network: Object.freeze({ access: 'allow' }),
})

/** The ONE product compiler: effective = ceiling ∩ restriction (no re-derivation). */
function effective(read) {
  const compiled = compileEffectiveIo(
    ceiling(read, read),
    { bindingIdentity: 'dsh.search/grep', read: lane(read.allow), write: lane(read.allow), network: 'allow' },
    {
      memberIdentity: IDENTITY.memberInstanceId,
      callId: 'call-rg-anc',
      policyRevision: 'a5sf-rg-anc:v1',
      toolBindingIdentity: 'dsh.search/grep',
      approvedOnce: false,
    },
  )
  if (!compiled.ok) throw new Error(`compileEffectiveIo refused: ${JSON.stringify(compiled)}`)
  return compiled.value
}

class BaseSubprocess {
  spawn() { throw new Error('base subprocess must never run') }
  async spawnTerminal() { throw new Error('base spawnTerminal must never run') }
}

function world() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'a5sf-rg-anc-')))
  // A REAL git worktree layout: `.git` is a FILE pointing at the worktree's
  // gitdir (this is what makes rg read a `.git` file rather than stat a dir,
  // which is why a kernel denial of that read is fatal to the walk).
  const gitdir = join(root, 'main', '.git', 'worktrees', 'wt1')
  mkdirSync(gitdir, { recursive: true })
  const wt = join(root, 'repo-wt')
  const inside = join(wt, 'lane', 'inside')
  mkdirSync(inside, { recursive: true })
  writeFileSync(join(wt, '.git'), `gitdir: ${gitdir}\n`, 'utf8')
  writeFileSync(join(wt, '.gitignore'), 'ignored.md\n', 'utf8')
  writeFileSync(join(inside, 'needle.txt'), 'A5SF_RG_ANC_NEEDLE\n', 'utf8')
  writeFileSync(join(inside, 'ignored.md'), 'A5SF_RG_ANC_NEEDLE ignored-but-present\n', 'utf8')
  return { root, wt, inside }
}

/** A provider wrapper that edits the argv AT the provider boundary (mutation
 *  instrumentation only; it decides nothing about the lane). */
function argvMutatingProvider(inner, mutate) {
  return {
    async spawnStreaming(request, streaming) {
      const argv = mutate([...request.argv])
      return inner.spawnStreaming({ ...request, argv }, streaming)
    },
  }
}

async function confinedRun({ root, policy, rg, searchRoot, pattern = 'A5SF_RG_ANC_NEEDLE', mutateArgv }) {
  const facts = []
  const counts = { spawns: 0 }
  const osProvider = createConfinedProcessProvider({
    realmId: 'realm-rg-anc',
    trustRoot: 'git:a5sf:rg-anc',
    scratchRoot: root,
  })
  const probe = await osProvider.probe()
  const contentRead = probe.ok && probe.value.find((row) => row.dimension === 'content-read')?.level
  if (contentRead !== 'enforced') throw new Error(`content-read is not enforced on this host: ${JSON.stringify(probe)}`)
  const execute = mutateArgv === undefined ? osProvider : argvMutatingProvider(osProvider, mutateArgv)
  const counted = {
    async spawnStreaming(request, streaming) {
      counts.spawns += 1
      const argv = mutateArgv === undefined ? [...request.argv] : mutateArgv([...request.argv])
      counts.argv = argv
      return execute.spawnStreaming({ ...request, argv }, streaming)
    },
  }
  const Confined = createConfinedSubprocessClass(BaseSubprocess, {
    effective: policy,
    provider: counted,
    realmId: 'realm-rg-anc',
    onGuardConsult: (fact) => facts.push(fact),
  })
  const handle = new Confined({}).spawn({
    argv: [rg, '--no-config', '--json', `--regexp=${pattern}`, '--', searchRoot],
    cwd: dirname(searchRoot),
    stdio: { stdin: 'ignore', stdout: { maxBytes: 1 << 20 }, stderr: { maxBytes: 1 << 20 } },
    graceMs: 10_000,
  })
  let exit = null
  let doneError = null
  try {
    exit = await handle.done
  } catch (error) {
    doneError = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  }
  return {
    exit,
    doneError,
    stdout: String(handle.collected.stdout?.readFrom(0).text ?? ''),
    stderr: String(handle.collected.stderr?.readFrom(0).text ?? ''),
    facts: facts.map((fact) => ({
      method: fact.method,
      locator: fact.locator,
      decision: fact.decision,
      decidedBy: fact.decidedBy,
      ...(fact.annotations === undefined ? {} : { annotations: fact.annotations }),
    })),
    spawns: counts.spawns,
    argv: counts.argv ?? [],
  }
}

async function rawRead({ root, policy, path }) {
  const osProvider = createConfinedProcessProvider({ realmId: 'realm-rg-anc-raw', trustRoot: 'git:a5sf:rg-anc', scratchRoot: root })
  const { confinedSpawnAllowPaths } = await load('team-services/src/subprocess.js')
  const { compileExecutionProfile } = await load('team-sandbox/src/profile.js')
  const profile = compileExecutionProfile(policy)
  if (!profile.ok) throw new Error(`profile refused: ${JSON.stringify(profile)}`)
  const spawned = await osProvider.spawnStreaming({
    grantFingerprint: 'rg-anc-raw',
    realmId: 'realm-rg-anc-raw',
    bindingId: 'dsh.search/grep',
    memberScope: IDENTITY.memberInstanceId,
    argv: ['/bin/sh', '-c', `cat '${path}' 2>&1; echo RC=$?`],
    cwd: dirname(path),
    env: [],
    allowPaths: confinedSpawnAllowPaths(profile.value.allowPaths, '/bin/sh'),
    exitPassthrough: true,
  }, { graceMs: 10_000 })
  if (!spawned.ok) throw new Error(`raw provider refused: ${JSON.stringify(spawned.error)}`)
  const chunks = []
  const consume = async (stream) => { for await (const chunk of stream) chunks.push(Buffer.from(chunk)) }
  await Promise.all([consume(spawned.value.stdout), consume(spawned.value.stderr), spawned.value.exited])
  return Buffer.concat(chunks).toString('utf8')
}

const results = []
function record(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${JSON.stringify(detail)}`)
}

async function main() {
  const rg = packagedRg()
  const w = world()
  try {
    console.log(`REPRO content-read=enforced rg=${rg} world=${w.root} expect=${EXPECT}`)

    // A1 — the row-1 shape.
    const a1 = await confinedRun({ root: w.root, policy: effective(lane([w.inside])), rg, searchRoot: w.inside })
    const a1HasFlags = a1.argv.includes('--no-ignore-parent') && a1.argv.includes('--no-ignore-vcs')
    const a1Stderr = a1.stderr.includes(`${w.wt}/.git: Permission denied (os error 13)`)
    if (EXPECT === 'red') {
      record('A1', a1.exit?.exitCode === 2 && a1Stderr && !a1HasFlags, { exit: a1.exit, stderr: a1.stderr, argv: a1.argv })
    } else {
      const allow = a1.facts.filter((fact) => fact.decision === 'allow')
      const disclosed = allow.length === 1
        && Array.isArray(allow[0]?.annotations)
        && allow[0].annotations.some((note) => note.includes('--no-ignore-vcs'))
        && allow[0].annotations.some((note) => note.includes('.gitignore'))
      record('A1', a1.exit?.exitCode === 0 && a1.stderr === '' && a1.stdout.includes('A5SF_RG_ANC_NEEDLE')
        && a1HasFlags && a1.spawns === 1 && allow.length === 1 && disclosed,
      { exit: a1.exit, stderr: a1.stderr, argv: a1.argv, facts: a1.facts, spawns: a1.spawns, matches: a1.stdout.split('\n').filter((line) => line.includes('"type":"match"')).length })
    }

    // A1M — remove the two flags at the provider boundary: must go RED.
    const a1m = await confinedRun({
      root: w.root,
      policy: effective(lane([w.inside])),
      rg,
      searchRoot: w.inside,
      mutateArgv: (argv) => argv.filter((token) => token !== '--no-ignore-parent' && token !== '--no-ignore-vcs'),
    })
    record('A1M (flags stripped => RED)', a1m.exit?.exitCode === 2 && a1m.stderr.includes(`${w.wt}/.git: Permission denied (os error 13)`),
      { exit: a1m.exit, stderr: a1m.stderr, argv: a1m.argv })

    // A2 — an explicit `.git` search root is still refused at ADMISSION.
    const a2 = await confinedRun({ root: w.root, policy: effective(lane([w.inside])), rg, searchRoot: join(w.wt, '.git') })
    record('A2 (.git root refused at admission)',
      a2.doneError !== null && a2.spawns === 0 && a2.facts.length === 1
        && a2.facts[0].decision === 'deny' && a2.facts[0].decidedBy === 'IO_READ_DENIED'
        && a2.facts[0].locator === join(w.wt, '.git'),
      { doneError: a2.doneError, spawns: a2.spawns, facts: a2.facts })

    // A2K — the kernel still denies a direct `.git` read (raw provider).
    const a2k = await rawRead({ root: w.root, policy: effective(lane([w.inside])), path: join(w.wt, '.git') })
    record('A2K (.git still kernel-denied)', /Permission denied|EACCES/.test(a2k) && !a2k.includes('gitdir:'),
      { output: a2k })

    // A3 — lane includes the worktree ROOT: ordinary .gitignore semantics.
    const a3 = await confinedRun({ root: w.root, policy: effective(lane([w.wt])), rg, searchRoot: w.inside })
    const a3HasFlags = a3.argv.includes('--no-ignore-parent') || a3.argv.includes('--no-ignore-vcs')
    const a3IgnoredAbsent = !a3.stdout.includes('ignored-but-present')
    const a3Allow = a3.facts.filter((fact) => fact.decision === 'allow')
    record('A3 (lane-inclusive root keeps .gitignore)',
      a3.exit?.exitCode === 0 && !a3HasFlags && a3IgnoredAbsent && a3Allow.length === 1 && a3Allow[0].annotations === undefined,
      { exit: a3.exit, argv: a3.argv, ignoredAbsent: a3IgnoredAbsent, facts: a3.facts })

    // A3M — forcing the flags onto that lane makes the ignored file appear.
    const a3m = await confinedRun({
      root: w.root,
      policy: effective(lane([w.wt])),
      rg,
      searchRoot: w.inside,
      mutateArgv: (argv) => {
        const at = argv.indexOf('--')
        return [...argv.slice(0, at), '--no-ignore-parent', '--no-ignore-vcs', ...argv.slice(at)]
      },
    })
    record('A3M (unconditional flags => .gitignore lost, RED for A3)',
      a3m.exit?.exitCode === 0 && a3m.stdout.includes('ignored-but-present'),
      { exit: a3m.exit, argv: a3m.argv, ignoredAppeared: a3m.stdout.includes('ignored-but-present') })
  } finally {
    rmSync(w.root, { recursive: true, force: true })
  }
  const failed = results.filter((row) => !row.ok)
  console.log(`\n${results.length - failed.length}/${results.length} arms matched the '${EXPECT}' expectation`)
  if (failed.length > 0) process.exit(1)
}

await main()
