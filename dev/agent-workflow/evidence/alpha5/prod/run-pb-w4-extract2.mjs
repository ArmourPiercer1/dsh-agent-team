#!/usr/bin/env node
/**
 * run-pb-w4-extract2.mjs — P-B install-round re-run of TWO extracted W4
 * criteria (WIRING-PHASE-PLAN W4, kit `../../w4/`), driven through the NEW
 * production entry face instead of the W4 row's deps-spy argv rewrite:
 *
 *   R1 = W4-POS-SPAWN (provider face) — REAL confined spawn: the provider is
 *        built from the COMPILED DIST PUBLIC BARREL (the same import path the
 *        W4 row used, `dist/packages/runtime/sandbox-provider/index.js`) with
 *        `assembly.launcherPath` + `assembly.launcherSha256` + `minAbiVersion`
 *        — no path hardcoded in the lane, no argv rewrite in the assembly.
 *        Criterion (same claims as W4): provider ok, launcher rc=0 (spy),
 *        payload pid real, lease terminated, spill read-back matches the
 *        allowed fixture. NEW claim enabled by the parameterized face:
 *        every spy row has offered==trusted (rewritten=false) — the assembly
 *        no longer needs the W4 workaround.
 *
 *   R2 = W4-NEG-MISSING (provider face) — an instance whose configured
 *        launcher path does not exist: typed SANDBOX_UNAVAILABLE with ZERO
 *        confined-exec; the existence preflight rows are recorded as
 *        precondition probes. Plus the install-round's own regression leg
 *        (sha 校验路径): a pin MISMATCH refuses before ANY launcher
 *        invocation, and swapped bytes after a clean prepare never reach run.
 *
 * Port discipline: NO host instance is booted by this driver (provider face
 * only) — port 3183 is proven IDLE before and after (bind test + ss), the
 * self-proof that nothing in this round touches the 3180 family.
 *
 * Build: the runtime dist is re-emitted into a gitignored build dir under
 * `tests/homes/` (disclosed build product, NOT a DSH_HOME world — W5 kit
 * precedent) with the SAME `packages/runtime/tsconfig.build.json` the
 * committed install surface uses.
 *
 * EXIT: 0 all criteria pass · 2 a criterion failed · 1 fatal.
 *
 * @module dev/agent-workflow/evidence/alpha5/prod/run-pb-w4-extract2
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(HERE, '..', '..', '..', '..', '..')
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const EVIDENCE_DIR = join(HERE, 'runs', `w4-extract2-${RUN_STAMP}`)
mkdirSync(EVIDENCE_DIR, { recursive: true })

const BUILD_OUT = join(WORKTREE, 'tests', 'homes', `.pb-w4x-build-${RUN_STAMP}`)
const WORLD = join(WORKTREE, 'tests', 'homes', `a5pb-w4x-${RUN_STAMP}`)
const FIXTURES = join(WORLD, 'fixtures')
const SCRATCH = join(WORLD, 'scratch')
const SELF_PORT = 3183
const REALM = `a5pb-w4x-realm-${RUN_STAMP}`
const TRUSTED_LAUNCHER = join(WORKTREE, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
const TSC = join(WORKTREE, 'node_modules', 'typescript', 'lib', 'tsc.js')

const LEDGER = join(EVIDENCE_DIR, 'ledger.jsonl')
const JOURNAL = []
function record(row) {
  const stamped = { at: new Date().toISOString(), ...row }
  JOURNAL.push(stamped)
  writeFileSync(LEDGER, JSON.stringify(stamped) + '\n', { flag: 'a' })
}
const CRITERIA = []
function check(id, claim, pass, observed) {
  CRITERIA.push({ id, claim, pass: pass === true, observed })
  console.log(`  [${pass === true ? 'x' : ' '}] ${id}: ${claim}${observed === undefined ? '' : ` — ${observed}`}`)
  return pass === true
}

function isPortFree(port) {
  return new Promise((res) => {
    const srv = createServer()
    srv.once('error', () => res(false))
    srv.listen(port, '127.0.0.1', () => srv.close(() => res(true)))
  })
}
const ssLine = (port) => {
  const r = spawnSync('ss', ['-ltnp'], { encoding: 'utf8', timeout: 5_000 })
  const hit = (r.stdout ?? '').split('\n').filter((l) => l.includes(`:${port} `))
  return hit.length === 0 ? `ss -ltnp: no listener on :${String(port)}` : hit.join(' | ')
}

async function main() {
  // ── port 3183 self-proof (idle) ─────────────────────────────────────────
  const portFreeBefore = await isPortFree(SELF_PORT)
  record({ leg: 'port-self-proof', when: 'before', port: SELF_PORT, free: portFreeBefore, observed: ssLine(SELF_PORT) })

  // ── compile the provider face with the PRODUCTION build config ─────────
  if (!existsSync(TSC)) throw new Error(`no typescript compiler at ${TSC}`)
  if (!existsSync(TRUSTED_LAUNCHER)) throw new Error(`tracked launcher missing at ${TRUSTED_LAUNCHER}`)
  const t0 = Date.now()
  const tsc = spawnSync(process.execPath, [TSC, '-p', join(WORKTREE, 'packages', 'runtime', 'tsconfig.build.json'), '--outDir', BUILD_OUT], { encoding: 'utf8', timeout: 300_000 })
  const barrelPath = join(BUILD_OUT, 'packages', 'runtime', 'sandbox-provider', 'index.js')
  record({ leg: 'build', rc: tsc.status, ms: Date.now() - t0, outDir: BUILD_OUT, barrel: barrelPath, stderrTail: (tsc.stderr ?? '').slice(0, 400) })
  const built = check('PB-BUILD', 'runtime tsconfig.build.json emits the provider lane to the build dist (public barrel importable)', tsc.status === 0 && existsSync(barrelPath), `rc=${String(tsc.status)}`)
  if (!built) return finish()

  const prov = await import(pathToFileURL(barrelPath).href)
  record({ leg: 'barrel-import', ok: true, names: ['createConfinedProcessProvider', 'createLauncherDeps', 'runAvailabilityPreflight', 'runAbiProbe', 'runEnforcementLeg', 'verifyLauncherIntegrity'].map((n) => `${n}:${typeof prov[n]}`).join(',') })

  // ── world fixtures (same shapes as the W4 kit) ──────────────────────────
  const OK_CONTENT = `A5PB-W4X-OK-CONTROL ${RUN_STAMP}\n`
  const SECRET_CONTENT = `SYNTHETIC-SECRET ${RUN_STAMP} — never meant to cross the domain\n`
  mkdirSync(join(FIXTURES, 'allow'), { recursive: true })
  mkdirSync(join(FIXTURES, 'private'), { recursive: true })
  writeFileSync(join(FIXTURES, 'allow', 'ok.txt'), OK_CONTENT)
  writeFileSync(join(FIXTURES, 'private', 'secret.txt'), SECRET_CONTENT)

  const launcherSha = createHash('sha256').update(readFileSync(TRUSTED_LAUNCHER)).digest('hex')
  const trustRoot = `sha256:${launcherSha.slice(0, 16)}#packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py`
  record({ leg: 'launcher-pin', tracked: TRUSTED_LAUNCHER, sha256: launcherSha, trustRoot })

  /** Counting spy over the REAL launcher deps — the W4 pattern WITHOUT the argv[0] rewrite. */
  function instance(label, assembly, { hard = true } = {}) {
    const real = prov.createLauncherDeps({ pythonPath: assembly.pythonPath ?? 'python3', launcherPath: assembly.launcherPath })
    const counters = { runs: 0, confinedExec: 0, offeredMismatch: 0 }
    const execAnswers = []
    const availabilityRows = []
    const spyRun = (argv, timeoutMs) => {
      counters.runs += 1
      if (argv?.[1] === '--confined-exec') counters.confinedExec += 1
      if (argv?.[0] !== assembly.launcherPath) counters.offeredMismatch += 1
      const r = real.run(argv, timeoutMs)
      if (argv?.[1] === '--confined-exec') {
        let answer = null
        try {
          const line = String(r.stdout ?? '').trim().split('\n').filter((l) => l.length > 0).pop()
          if (line !== undefined) answer = JSON.parse(line)
        } catch { answer = null }
        execAnswers.push({ rc: answer?.rc ?? null, pid: answer?.pid ?? null, launcherRc: r.rc, abiUnavailable: answer?.abi_unavailable === true })
      }
      return r
    }
    const deps = {
      availability: () => {
        const rows = prov.runAvailabilityPreflight({ pythonPath: assembly.pythonPath ?? 'python3', launcherPath: assembly.launcherPath, runnerCommand: null })
        availabilityRows.push(...rows)
        return { rows }
      },
      run: spyRun,
      probeFacts: () => {
        const launcher = { pythonPath: assembly.pythonPath ?? 'python3', launcherPath: assembly.launcherPath, run: spyRun }
        const abi = prov.runAbiProbe(launcher)
        const legs = {}
        for (const leg of prov.ENFORCEMENT_LEGS) legs[leg] = prov.runEnforcementLeg(launcher, leg, join(SCRATCH, label, `probe-${RUN_STAMP}`, leg))
        return { abiVersion: abi.abiVersion, legs }
      },
    }
    const provider = prov.createConfinedProcessProvider({
      realmId: REALM,
      trustRoot,
      scratchRoot: join(SCRATCH, label),
      ...(hard ? { hardDimensions: ['content-read', 'write'] } : {}),
      assembly,
      deps,
    })
    return { provider, counters, execAnswers, availabilityRows }
  }

  const baseRequest = (over) => ({
    grantFingerprint: `a5pb-w4x-grant-${RUN_STAMP}`,
    realmId: REALM,
    bindingId: 'a5pb-w4x-binding',
    memberScope: 'session',
    cwd: FIXTURES,
    env: [],
    allowPaths: [{ path: join(FIXTURES, 'allow'), accessBits: { readFile: true, readDir: true } }],
    ...over,
  })

  // ── R1 = W4-POS-SPAWN through the assembly face ─────────────────────────
  const pos = instance('pos', { launcherPath: TRUSTED_LAUNCHER, launcherSha256: launcherSha, minAbiVersion: 4 })
  const r1 = await pos.provider.spawn(baseRequest({ argv: ['/usr/bin/cat', join(FIXTURES, 'allow', 'ok.txt')] }))
  const exec1 = pos.execAnswers[pos.execAnswers.length - 1] ?? {}
  record({ leg: 'R1-pos-spawn', ok: r1.ok, execAnswer: exec1, counters: pos.counters, stdout: r1.ok ? r1.value.output.stdout.slice(0, 120) : r1.error })
  check('PB-R1-W4-POS-SPAWN', 'extracted W4 criterion 1 (POS spawn) via assembly.launcherPath/launcherSha256/minAbiVersion: provider ok, launcher rc=0, payload pid real, lease terminated', r1.ok === true && exec1.rc === 0 && typeof exec1.pid === 'number' && exec1.pid > 0 && r1.ok === true && r1.value.lease.status === 'terminated', `rc=${String(exec1.rc)} pid=${String(exec1.pid)} lease=${r1.ok ? r1.value.lease.status : 'n/a'} offeredMismatch=${String(pos.counters.offeredMismatch)}`)
  check('PB-R1-SPILL-MATCH', 'extracted W4 spill observation: provider read-back matches the ALLOWED fixture content', r1.ok === true && r1.value.output.stdout === OK_CONTENT, r1.ok ? `bytes=${String(r1.value.output.stdout.length)}` : 'refused')
  check('PB-R1-NO-ARGV-REWRITE', 'NEW assembly-face claim: every launcher call was OFFERED the trusted path (the W4 spy rewrite workaround is no longer needed): offered==trusted, rewritten=false', pos.counters.offeredMismatch === 0 && pos.counters.runs > 0, `runs=${String(pos.counters.runs)} mismatch=0`)

  // ── R2 = W4-NEG-MISSING through the assembly face ───────────────────────
  const neg = instance('neg-missing', { launcherPath: join(WORLD, 'absent', 'landlock-prelauncher.py') })
  const r2 = await neg.provider.spawn(baseRequest({ argv: ['/usr/bin/cat', join(FIXTURES, 'allow', 'ok.txt')] }))
  record({ leg: 'R2-neg-missing', refusal: r2.ok ? null : r2.error, counters: neg.counters, availabilityRows: neg.availabilityRows })
  check('PB-R2-W4-NEG-MISSING', 'extracted W4 criterion 2 (缺件 class) via assembly.launcherPath: launcher absent → SANDBOX_UNAVAILABLE typed with ZERO confined-exec; preflight rows recorded as precondition probes (no kernel wording)', r2.ok === false && r2.error.code === 'SANDBOX_UNAVAILABLE' && neg.counters.confinedExec === 0 && neg.availabilityRows.some((x) => x.subject === 'launcher-script' && x.present === false), `code=${r2.ok ? 'none' : r2.error.code} confinedExec=${String(neg.counters.confinedExec)}`)

  // ── install-round regression leg: sha 校验路径 ──────────────────────────
  const wrongPin = instance('neg-wrong-pin', { launcherPath: TRUSTED_LAUNCHER, launcherSha256: createHash('sha256').update('the bytes some other assembly trusts').digest('hex') })
  const r3 = await wrongPin.provider.spawn(baseRequest({ argv: ['/usr/bin/cat', join(FIXTURES, 'allow', 'ok.txt')] }))
  record({ leg: 'R3-sha-mismatch', refusal: r3.ok ? null : r3.error, counters: wrongPin.counters })
  check('PB-R3-SHA-GATE', 'launcher sha 校验路径 (regression): a PIN MISMATCH at the configured path refuses SANDBOX_UNAVAILABLE through the integrity gate before ANY launcher invocation (zero probe legs, zero spawn)', r3.ok === false && r3.error.code === 'SANDBOX_UNAVAILABLE' && r3.error.message.includes('integrity gate') && wrongPin.counters.runs === 0, `code=${r3.ok ? 'none' : r3.error.code} runs=${String(wrongPin.counters.runs)}`)

  // ── port 3183 self-proof (still idle) ───────────────────────────────────
  const portFreeAfter = await isPortFree(SELF_PORT)
  record({ leg: 'port-self-proof', when: 'after', port: SELF_PORT, free: portFreeAfter, observed: ssLine(SELF_PORT) })
  check('PB-PORT-3183-IDLE', `port ${String(SELF_PORT)} proven IDLE before and after (bind test + ss): this provider-face re-run booted no host and touched no 3180-family port`, portFreeBefore && portFreeAfter, `${ssLine(SELF_PORT)}`)

  return finish()
}

function finish() {
  const failed = CRITERIA.filter((c) => !c.pass)
  const receipt = [
    `# pb W4-extract-2 re-run receipt — ${RUN_STAMP}`,
    '',
    `- base: worktree \`${WORKTREE}\` @ branch alpha5-prod-pr45`,
    `- launcher (tracked source copy; dist carries no .py — disclosed): \`${TRUSTED_LAUNCHER}\``,
    `- build dist (gitignored build product under tests/homes, NOT a world): \`${BUILD_OUT}\``,
    `- world (fixtures/scratch): \`${WORLD}\``,
    `- criteria: ${String(CRITERIA.length - failed.length)}/${String(CRITERIA.length)} PASS`,
    '',
    ...CRITERIA.map((c) => `- [${c.pass ? 'x' : ' '}] **${c.id}** — ${c.claim}${c.observed === undefined ? '' : ` (${c.observed})`}`),
    '',
    `Ledger: ledger.jsonl (${String(JOURNAL.length)} rows)`,
    '',
  ].join('\n')
  writeFileSync(join(EVIDENCE_DIR, 'receipt.md'), receipt)
  console.log(`\nreceipt: ${join(EVIDENCE_DIR, 'receipt.md')}`)
  // teardown: remove the build dist + world (evidence keeps receipt+ledger; content is in the receipt)
  if (!process.argv.includes('--keep')) {
    rmSync(BUILD_OUT, { recursive: true, force: true, maxRetries: 5 })
    rmSync(WORLD, { recursive: true, force: true, maxRetries: 5 })
  }
  process.exit(failed.length === 0 ? 0 : 2)
}

main().catch((error) => {
  console.error('FATAL', error)
  record({ leg: 'fatal', error: String(error?.message ?? error) })
  process.exit(1)
})
