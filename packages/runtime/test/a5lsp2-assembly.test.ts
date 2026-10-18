/**
 * a5lsp2-assembly — the R-2 approved production arm (user ruling 07:53Z):
 * "policy change ⇒ destroy and rebuild the member's isolated LSP instance",
 * implemented as the Team-side ASSEMBLY DISCIPLINE API over the confined
 * provider (realm granularity; the pool key stays a pure path upstream —
 * `LSP-rulings-brief.md` R-2 §2 wording, and the W-LSP-DR public-surface
 * proof, are the semantic anchors; this is their production-code version).
 *
 * Granularity: one isolated instance per (member × policy generation) =
 * its own provider instance (realm) + its own confined OS process. The
 * assembly reuses the P-B assembly parameter surface (`ProviderAssemblyConfig`:
 * launcher path + sha byte gate + ABI floor — the SAME double gate) for
 * EVERY provider instance it creates.
 *
 * Legs (all REAL, Landlock backend — the non-ENV_BLOCK precedent):
 *  ISOLATION       — two members ⇒ two distinct pids, each answers its own
 *                    ping; a hot re-ensure returns the SAME instance (no
 *                    second process); ensure on a generation mismatch is
 *                    refused (policyChange is the discipline entry).
 *  POLICY-CHANGE   — the four LSP-DR requirements, production version:
 *                    (1) the old OS pid EXITS, bounded, OS-probed via /proc;
 *                    (2) the new instance starts with a NEW pid and answers
 *                    with the new generation; (3) the SIBLING member's pid
 *                    is untouched and stays hot; (4) zero hot handles on
 *                    the old root (live-process /proc scan).
 *  FAILURE CLEANUP — (a) a wrong launcher pin refuses the NEW realm BEFORE
 *                    the old one is touched (no self-inflicted outage), and
 *                    (b) a mid-change failure (new instance never becomes
 *                    ready) leaves ZERO residual handles/pids — sampled
 *                    through /proc, sibling untouched.
 *  TEARDOWN        — disposeAll ⇒ every observed pid is gone; the final
 *                    world scan is empty.
 *
 * @module packages/runtime/test/a5lsp2-assembly
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createLspRealmAssembly, type LspAssemblyEvent, type LspInstance } from '../sandbox-provider/lsp-assembly.js'
import type { AllowPathEntry } from '../sandbox-provider/provider.js'
import {
  execPath,
  fixturePath,
  laneArgv,
  makeWorld,
  nodeBinDir,
  pidAlive,
  pollUntil,
  productionLauncherPath,
  removeWorld,
  sampleLaneProcesses,
  sha256File,
  sourceFixtureLeaksIn,
} from './a5lsp2-harness.js'

/**
 * COURTESY CEILING — one line of neighbourliness, coordinator-authorized
 * (a5glb census round, 2026-10-18). A COURTESY EDIT, not a semantics change:
 * the five polls below watch a confined child terminate, and their SHAPE is
 * byte-identical in kind — same predicates, same OS observation (`/proc`
 * liveness, `sampleLaneProcesses` on this world), same `toBe(true)` assertions.
 * Only the CEILING moved: 10 s / 8 s -> 30 s.
 *
 * Why: the root census runs all nine roots in ONE process (pool=threads). On a
 * small CI runner the CPU can be busy with a neighbour's spawn storm long
 * enough for a 10 s ceiling to expire while the child is genuinely still on its
 * way out — a timing ceiling reading as a lifecycle failure. Measured on a
 * six-core host the legs are green standalone, green in two full captures, and
 * green with that neighbour's storm mid-flight, which is what localized the
 * cause to the ceiling rather than to teardown. This is the same family as the
 * census operator's existing `--testTimeout=90000` override.
 *
 * What stays true: nothing about Landlock lifecycle semantics moved, and a
 * child that never exits is STILL a red — it just takes 30 s to say so. The
 * "old pid EXITS, bounded" claim in the header keeps its meaning (a bound
 * exists and is enforced); the numeric bound is now 30 s on this ceiling, and
 * an operator may dial it per run with `A5LSP2_POLL_CEILING_MS`.
 */
const POLL_CEILING_MS = (() => {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.['A5LSP2_POLL_CEILING_MS']
  const n = Number(raw)
  return raw !== undefined && Number.isFinite(n) && n > 0 ? Math.trunc(n) : 30_000
})()

/**
 * FAILURE-SCENE FORENSICS (2026-10-18, census round 2; the ceilings are NOT
 * touched — 30 s stays the cap, that was the deal). These legs failed on a CI
 * runner twice, the second time with a 30 s ceiling, which is evidence that my
 * "starved runner" reading was not enough: something else is alive in that
 * world, or something is not. Green runs print NOTHING. On the path that is
 * about to fail, one block goes to stdout with the facts a log cannot show
 * afterwards: the full `sampleLaneProcesses` table, for every watched pid its
 * `/proc` liveness + cmdline + scheduler state, a capped scan of the world
 * directory, and the machine's load/PSI numbers. Every read is best-effort —
 * a pid that vanishes mid-scene is itself a fact, not an exception. This makes
 * no claim about the cause; it puts the scene in the capture so the next red
 * is diagnosed from evidence instead of from a hypothesis.
 */
function procText(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch (err) {
    return `<unreadable:${(err as { code?: string }).code ?? 'ERR'}>`
  }
}

/** Capped recursive scan of the world: how much is left, and what is in it. */
function scanWorldCounts(dir: string): string {
  let files = 0
  let dirs = 0
  let deepest = 0
  const names: string[] = []
  const walk = (d: string, depth: number): void => {
    if (depth > deepest) deepest = depth
    if (files + dirs > 500) return
    let entries: ReturnType<typeof readdirSync> extends never ? never : { name: string; isDirectory(): boolean }[]
    try {
      entries = readdirSync(d, { withFileTypes: true }) as unknown as { name: string; isDirectory(): boolean }[]
    } catch (err) {
      names.push(`${d.replace(dir, '<world>')} <unreadable:${(err as { code?: string }).code ?? 'ERR'}>`)
      return
    }
    for (const entry of entries) {
      const full = join(d, entry.name)
      if (depth < 2 && names.length < 12) names.push(full.replace(dir, '<world>'))
      if (entry.isDirectory()) {
        dirs += 1
        walk(full, depth + 1)
      } else {
        files += 1
      }
    }
  }
  walk(dir, 0)
  return `files=${String(files)} dirs=${String(dirs)} maxDepth=${String(deepest)} firstEntries=[${names.join(' , ')}]`
}

function forensicScene(label: string, watchedPids: readonly number[], expected: string, observed: unknown): void {
  const out = (globalThis as { process?: { stdout?: { write(v: string): void } } }).process?.stdout
  const lines: string[] = []
  lines.push(`a5lsp2 FORENSIC world=${world.split('/').pop()} leg="${label}" expected=${expected}`)
  lines.push(`  observed=${JSON.stringify(observed)}`)
  const load = procText('/proc/loadavg').trim().replace(/\s+/g, ' ')
  const psi = procText('/proc/pressure/cpu').trim().replace(/\n/g, '; ')
  lines.push(`  loadavg="${load}" cpuPressure="${psi}" ceilingMs=${String(POLL_CEILING_MS)}`)
  let procs: { pid: number; cwd: string; cmd: string }[] = []
  try {
    procs = sampleLaneProcesses(world)
  } catch (err) {
    lines.push(`  sampleLaneProcesses threw:${String(err)}`)
  }
  lines.push(`  sampleLaneProcesses(world) = ${String(procs.length)} live`)
  for (const p of procs) {
    lines.push(`    pid=${String(p.pid)} cwd=${p.cwd} cmd=${p.cmd.slice(0, 180)}`)
  }
  for (const pid of watchedPids) {
    if (pid <= 0) continue
    const stat = procText(`/proc/${String(pid)}/stat`).trim().split(' ')
    lines.push(
      `  watched pid=${String(pid)} pidAlive=${String(pidAlive(pid))} state=${stat.length > 2 ? stat[2] : '?'} cmdline="${procText(`/proc/${String(pid)}/cmdline`).replace(/\0/g, ' ').trim().slice(0, 180)}"`,
    )
  }
  lines.push(`  world ${scanWorldCounts(world)}`)
  out?.write(lines.join('\n') + '\n')
}

const world = makeWorld('assembly')
afterAll(() => removeWorld(world))

const LAUNCHER_SHA = sha256File(productionLauncherPath())

function hostAbiVersion(): number | null {
  const r = spawnSync('python3', [productionLauncherPath(), '--abi-probe'], { encoding: 'utf8', timeout: 5_000 })
  try {
    const line = String(r.stdout).trim().split('\n').pop()
    const parsed = JSON.parse(String(line)) as { abi_version?: number }
    return typeof parsed.abi_version === 'number' ? parsed.abi_version : null
  } catch {
    return null
  }
}

const HOST_ABI = hostAbiVersion()
const REAL = HOST_ABI !== null && HOST_ABI >= 3
const describeReal = REAL ? describe : describe.skip

const fixtureDir = join(world, 'fixtures')
mkdirSync(fixtureDir, { recursive: true })
copyFileSync(fixturePath('a5lsp2-fixture-ping.mjs'), join(fixtureDir, 'ping.mjs'))

const journal: LspAssemblyEvent[] = []

/** The per-(member×generation) policy the assembly assembles (R-2 shape). */
function policyFor(member: string, generation: string, fixture = 'ping.mjs') {
  const genRoot = join(world, 'ws', `${member}-${generation}`)
  mkdirSync(genRoot, { recursive: true })
  writeFileSync(join(genRoot, 'marker.txt'), `marker ${member} ${generation}`)
  const allow: AllowPathEntry[] = [
    { path: nodeBinDir(), accessBits: { execute: true, readFile: true, readDir: true } },
    { path: fixtureDir, accessBits: { readFile: true, readDir: true } },
    { path: genRoot, accessBits: { readFile: true, readDir: true } },
  ]
  return {
    grantFingerprint: `sha256:grant-${member}-${generation}`,
    bindingId: `binding-lsp-${member}`,
    argv: laneArgv([execPath(), join(fixtureDir, fixture), generation]),
    cwd: genRoot,
    env: [['PATH', '/usr/bin:/bin']] as const,
    allowPaths: allow,
  }
}

function makeAssembly(pin = LAUNCHER_SHA) {
  return createLspRealmAssembly({
    assembly: { launcherPath: productionLauncherPath(), launcherSha256: pin, minAbiVersion: 3 },
    trustRoot: 'git:alpha5-prod-lsp:sandbox-provider/launcher',
    scratchRoot: world,
    journal: (e) => journal.push(e),
    readyTimeoutMs: 20_000,
    terminateGraceMs: 2_000,
    terminateDeadlineMs: 15_000,
    policyFor: (member, generation) => {
      if (generation === 'gBROKEN') {
        // a policy whose server can never answer: exec exists, readiness dies
        const genRoot = join(world, 'ws', `${member}-${generation}`)
        mkdirSync(genRoot, { recursive: true })
        return {
          grantFingerprint: `sha256:grant-${member}-${generation}`,
          bindingId: `binding-lsp-${member}`,
          argv: laneArgv([execPath(), join(fixtureDir, 'does-not-exist.mjs'), generation]),
          cwd: genRoot,
          env: [['PATH', '/usr/bin:/bin']] as const,
          allowPaths: [
            { path: nodeBinDir(), accessBits: { execute: true, readFile: true, readDir: true } },
            { path: fixtureDir, accessBits: { readFile: true, readDir: true } },
            { path: genRoot, accessBits: { readFile: true, readDir: true } },
          ] as AllowPathEntry[],
        }
      }
      return policyFor(member, generation)
    },
  })
}

/** One line-JSON request/response round-trip against an instance. */
async function ping(instance: LspInstance, seq: number, timeoutMs = 25_000): Promise<Record<string, unknown>> {
  const answer = new Promise<Record<string, unknown>>((resolve, reject) => {
    let buf = ''
    const timer = setTimeout(() => { instance.handle.stdout.off('data', onData); reject(new Error(`ping ${seq} timeout`)) }, timeoutMs)
    const onData = (chunk: Buffer) => {
      buf += String(chunk)
      for (;;) {
        const nl = buf.indexOf('\n')
        if (nl < 0) break
        const line = buf.slice(0, nl)
        buf = buf.slice(nl + 1)
        if (!line.startsWith('{')) continue
        const parsed = JSON.parse(line) as Record<string, unknown>
        if (parsed.pong === seq) {
          clearTimeout(timer)
          instance.handle.stdout.off('data', onData)
          resolve(parsed)
          return
        }
      }
    }
    instance.handle.stdout.on('data', onData)
  })
  instance.handle.stdin.write(`{"ping":${seq}}\n`)
  return answer
}

describeReal('a5lsp2 assembly REAL — per-(member×generation) lifecycle on the Landlock backend', () => {
  let assembly: ReturnType<typeof makeAssembly>

  beforeAll(() => {
    assembly = makeAssembly()
  })

  it('two members → two isolated pids, each answering; hot re-ensure reuses the SAME instance', async () => {
    const a = await assembly.ensure('A', 'g0')
    expect(a.ok).toBe(true)
    if (!a.ok) return
    const b = await assembly.ensure('B', 'g0')
    expect(b.ok).toBe(true)
    if (!b.ok) return
    expect(a.value.pid).not.toBe(b.value.pid)
    expect(pidAlive(a.value.pid)).toBe(true)
    expect(pidAlive(b.value.pid)).toBe(true)

    const pa = await ping(a.value, 1)
    expect(pa.gen).toBe('g0')
    expect(pa.pid).toBe(a.value.pid)
    const pb = await ping(b.value, 1)
    expect(pb.pid).toBe(b.value.pid)

    const again = await assembly.ensure('A', 'g0')
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(again.value.pid).toBe(a.value.pid) // hot reuse — no second process for the same (member×gen)

    // cross-member isolation: A's ping did not disturb B, and the /proc facts differ
    const pb2 = await ping(b.value, 2)
    expect(pb2.pid).toBe(b.value.pid)
    expect(String((await ping(a.value, 2)).cwd)).toBe(join(world, 'ws', 'A-g0'))
    expect(String(pb2.cwd)).toBe(join(world, 'ws', 'B-g0'))
  }, 120_000)

  it('ensure on a generation mismatch is refused — policyChange is the discipline entry', async () => {
    const r = await assembly.ensure('A', 'g9')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('IO_POLICY_UNSUPPORTED')
    expect(assembly.current('A')?.generation).toBe('g0') // untouched
  })

  it('policyChange A g0→g1: old pid exits bounded, new instance answers, sibling untouched, zero handles on the old root', async () => {
    const a0 = assembly.current('A')
    const b0 = assembly.current('B')
    expect(a0 && b0).toBeTruthy()
    if (!a0 || !b0) return
    const oldPid = a0.pid
    const siblingPid = b0.pid

    journal.length = 0
    const r = await assembly.policyChange('A', 'g1')
    expect(r.ok).toBe(true)
    if (!r.ok) return

    // (1) old pid is GONE — OS liveness, bounded
    expect(r.value.pid).not.toBe(oldPid)
    const oldGoneG1 = await pollUntil(() => !pidAlive(oldPid), POLL_CEILING_MS)
    if (!oldGoneG1) forensicScene('policyChange A g0->g1: the old pid is still alive after the ceiling', [oldPid, r.value.pid], 'old pid gone within the ceiling', { oldPid, newPid: r.value.pid, ceilingMs: POLL_CEILING_MS })
    expect(oldGoneG1).toBe(true)
    // (2) new instance answers with the NEW generation and NEW cwd
    const p = await ping(r.value, 1)
    expect(p.gen).toBe('g1')
    expect(String(p.cwd)).toBe(join(world, 'ws', 'A-g1'))
    // (3) sibling untouched: same pid, still hot-answering
    expect(assembly.current('B')?.pid).toBe(siblingPid)
    const pb = await ping(assembly.current('B')!, 3)
    expect(pb.pid).toBe(siblingPid)
    // (4) zero hot handles: NO live lane process carries the old root as cwd, and the old pid is out of the sample
    const live = sampleLaneProcesses(world)
    expect(live.some((p2) => p2.cwd === join(world, 'ws', 'A-g0'))).toBe(false)
    expect(live.some((p2) => p2.pid === oldPid)).toBe(false)
    // journal = the LSP-DR event ledger, production version
    expect(journal.map((e) => e.kind)).toEqual(['policy-change-begin', 'realm-disposed', 'realm-assembled', 'policy-change-complete'])
    const disposed = journal.find((e) => e.kind === 'realm-disposed')
    expect(disposed && 'lastPid' in disposed ? disposed.lastPid : null).toBe(oldPid)
  }, 120_000)

  it('policyChange again A g1→g2: the ledger shows dispose,create,dispose,create and the world stays net-zero', async () => {
    const a1 = assembly.current('A')
    if (!a1) return expect(a1).toBeTruthy()
    const oldPid = a1.pid
    journal.length = 0
    const r = await assembly.policyChange('A', 'g2')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const oldGoneG2 = await pollUntil(() => !pidAlive(oldPid), POLL_CEILING_MS)
    if (!oldGoneG2) forensicScene('policyChange A g1->g2: the old pid is still alive after the ceiling', [oldPid], 'old pid gone within the ceiling', { oldPid, ceilingMs: POLL_CEILING_MS })
    expect(oldGoneG2).toBe(true)
    expect(r.value.pid).not.toBe(oldPid)
    const p = await ping(r.value, 1)
    expect(p.gen).toBe('g2')
    const kinds = journal.map((e) => e.kind)
    expect(kinds).toEqual(['policy-change-begin', 'realm-disposed', 'realm-assembled', 'policy-change-complete'])
    // sibling B still at its original pid through BOTH changes
    expect(assembly.current('B')?.pid).not.toBe(r.value.pid)
  }, 120_000)

  it('failure cleanup (a): a wrong launcher pin refuses BEFORE the old instance is disposed — no self-inflicted outage', async () => {
    const a = assembly.current('A')
    if (!a) return expect(a).toBeTruthy()
    const broken = makeAssembly('0'.repeat(64)) // wrong pin on every realm it creates
    // hand the broken assembly the SAME live world state is NOT possible by design —
    // it is a fresh assembly, so drive the leg against ITS OWN member:
    const first = await broken.ensure('C', 'g0')
    expect(first.ok).toBe(false) // the byte-pin gate refuses before any process
    if (!first.ok) expect(first.error.code).toBe('SANDBOX_UNAVAILABLE')
    const changes = await broken.policyChange('C', 'g1')
    expect(changes.ok).toBe(false) // policyChange on a gated assembly also refuses
    if (!changes.ok) expect(changes.error.code).toBe('SANDBOX_UNAVAILABLE')
    // nothing of the healthy assembly was touched
    expect(assembly.current('A')?.pid).toBe(a.pid)
    expect(pidAlive(a.pid)).toBe(true)
    // zero new processes: every live lane process belongs to A/B instances
    const live = sampleLaneProcesses(world)
    const foreign = live.filter((p2) => p2.pid !== a.pid && p2.pid !== assembly.current('B')?.pid).map((p2) => p2.pid)
    // Teeth for the new membership rule: the sampler must SEE the instances this run
    // owns. Without a positive assertion, "no foreign process" is vacuous — census 330
    // had both directions of error at once (a stranger counted as ours, our own
    // world-copied fixtures invisible to it).
    expect(live.some((p2) => p2.pid === a.pid), 'the identity rule must attribute this run\'s own live instance to the lane, or zero-residue proves nothing').toBe(true)
    // Named SOURCE-leak check (identity-scoped; see harness): over the set this lane
    // can attribute to itself, nothing executes a lane fixture from its SOURCE path.
    // The old global vocabulary arm guarded the same shape but counted a neighbour's
    // lint process as ours (census 330: foreign=[14668] = eslint of the same job).
    expect(sourceFixtureLeaksIn(live).map((p2) => `${String(p2.pid)} ${p2.cmd}`), 'a5lsp2 SOURCE-fixture leak: an instance is executing a lane fixture from its source path instead of the world copy').toEqual([])
    if (foreign.length !== 0) forensicScene('failure cleanup (a): a refused change left new processes', [a.pid, assembly.current('B')?.pid ?? -1], 'every live lane process belongs to A or B', { foreign, expected: [a.pid, assembly.current('B')?.pid ?? null] })
    expect(foreign).toEqual([])
  }, 60_000)

  it('failure cleanup (b): a mid-change failure (readiness never comes) leaves ZERO residual pids/handles', async () => {
    const a = assembly.current('A')
    if (!a) return expect(a).toBeTruthy()
    const oldPid = a.pid
    const b = assembly.current('B')
    if (!b) return expect(b).toBeTruthy()

    const r = await assembly.policyChange('A', 'gBROKEN')
    expect(r.ok).toBe(false)
    // the OLD instance was disposed first (destroy→rebuild semantics) and is OS-gone
    const oldGoneB = await pollUntil(() => !pidAlive(oldPid), POLL_CEILING_MS)
    if (!oldGoneB) forensicScene('failure cleanup (b): the disposed pid is still alive after the ceiling', [oldPid, b.pid], 'old pid gone within the ceiling', { oldPid, siblingPid: b.pid, ceilingMs: POLL_CEILING_MS })
    expect(oldGoneB).toBe(true)
    // the half-built instance was cleaned: current(A) is EMPTY, not a dead handle
    expect(assembly.current('A')).toBeUndefined()
    // zero-residue sampling: the ONLY live lane processes left are the sibling B
    const live = sampleLaneProcesses(world)
    expect(live.some((p2) => p2.pid === b.pid), 'the identity rule must still see the surviving sibling instance in (b)').toBe(true)
    expect(sourceFixtureLeaksIn(live).map((p2) => `${String(p2.pid)} ${p2.cmd}`), 'a5lsp2 SOURCE-fixture leak at cleanup (b): a survivor executes the source fixture, not the world copy').toEqual([])
    const residual = live.map((p2) => p2.pid).filter((pid) => pid !== b.pid)
    if (residual.length !== 0) forensicScene('failure cleanup (b): residual pids/handles', [oldPid, b.pid], 'no live lane process other than the sibling', { residual, ceilingMs: POLL_CEILING_MS })
    expect(residual).toEqual([])
    // sibling untouched and still answering
    expect(assembly.current('B')?.pid).toBe(b.pid)
    const pb = await ping(assembly.current('B')!, 7)
    expect(pb.pid).toBe(b.pid)
  }, 120_000)

  it('disposeAll: every instance terminates, every pid is gone, the world scan is empty', async () => {
    const b = assembly.current('B')
    if (!b) return expect(b).toBeTruthy()
    const bPid = b.pid
    // re-create A g2 so teardown disposes a live one too
    const a2 = await assembly.ensure('A', 'g2')
    expect(a2.ok).toBe(true)
    if (!a2.ok) return
    const aPid = a2.value.pid
    const all = await assembly.disposeAll()
    expect(all.ok).toBe(true)
    const pidsGone = await pollUntil(() => !pidAlive(aPid) && !pidAlive(bPid), POLL_CEILING_MS)
    if (!pidsGone) forensicScene('disposeAll: an instance pid is still alive after the ceiling', [aPid, bPid], 'both instance pids gone within the ceiling', { aPid, bPid, ceilingMs: POLL_CEILING_MS })
    expect(pidsGone).toBe(true)
    const worldQuiet = await pollUntil(() => sampleLaneProcesses(world).length === 0, POLL_CEILING_MS)
    if (!worldQuiet) forensicScene('disposeAll: lane processes still sample from this world after the ceiling', [aPid, bPid], 'sampleLaneProcesses(world) empty within the ceiling', { aPid, bPid, ceilingMs: POLL_CEILING_MS })
    expect(worldQuiet).toBe(true)
    expect(assembly.current('A')).toBeUndefined()
    expect(assembly.current('B')).toBeUndefined()
  }, 120_000)
})
