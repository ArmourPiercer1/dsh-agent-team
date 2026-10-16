#!/usr/bin/env node
/**
 * p01-runner.mjs — Alpha.5 P0-1 route & race proofs (fixture level).
 * Plan §3 P0-1 + §4 BND-01..06. Deterministic event gates only (plan:
 * 禁止 sleep 碰运气). The hazard legs are CHARACTERIZATION evidence (plan:
 * "该反例是设计防护的证据而非可提交产品行为") — they FAIL only if the
 * observed outcome differs from the documented hazard/safe expectation.
 *
 * Legs:
 *  L1 BND-01 own-scope same-name shadow without restrict (observe native count)
 *  L2 BND-02 restrict-first assembly; adapter; adapter disposed, restrict lives
 *         → UNKNOWN for A, NATIVE count stays 0 (safe unload)
 *  L2b BND-02 negative control: adapter WITHOUT restrict → native shadowed for A
 *         (observable delta vs L2: resolution/get)
 *  L3 BND-03 race at the dispatch re-resolution window: pause inside a
 *         scoped tools/pre-execute listener (waterfall awaits it), dispose
 *         adapter mid-pause, resolve gate:
 *           L3-safe: restrict still lives → dispatch-time re-resolve finds no
 *                    visible definition → typed unknown, NATIVE body = 0
 *           L3-hazard (characterization): restrict ALSO lifted mid-pause →
 *                    dispatch-time re-resolve finds NATIVE → native body = 1
 *                    (documented danger of lifting the mask before the call
 *                    drains; justifies the atomic ordered assembly unit)
 *  L4 BND-04 early-allow listener cannot bypass a scoped monotonic guard
 *  L5 BND-05 duplicate install conflicts + disposer order + reinstall
 *  L6 BND-06-agentless agentless execute lane (not Team scope; documented)
 *  L7 PTC-01-partial: run_code is reserved against register() and restrict()
 *
 * Usage: node dev/agent-workflow/evidence/alpha5-adapter-p0/01-routing/p01-runner.mjs
 * Exit 0 = every leg matched its documented expectation.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeFixture, countingTool } from '../00-baseline/p00-fixture.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const results = []
const expect = (id, cond, detail) => results.push({ id, verdict: cond ? 'PASS' : 'FAIL', detail })

const deferred = () => {
  let resolve
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}

async function freshMount() {
  const f = await makeFixture()
  const { ctx, mintScope } = f
  const nativeGrep = countingTool(f.obs, 'grep', 'NATIVE.grep')
  ctx.tools.register(nativeGrep)
  const A = await mintScope('agent-A')
  const B = await mintScope('agent-B')
  return { ...f, nativeGrep, A, B }
}

try {
  // ---------- L1 BND-01: own-scope same-name registration WITHOUT restrict ----------
  {
    const f = await freshMount()
    const ad = countingTool(f.obs, 'grep', 'ADAPTER.grep')
    f.A.scope.ctx.tools.register(ad)
    const ra = await f.run('grep', f.A.key)
    const rb = await f.run('grep', f.B.key)
    expect('L1.BND-01.shadow-no-restrict',
      ra.bodies?.[0]?.identity === 'ADAPTER.grep' && rb.bodies?.[0]?.identity === 'NATIVE.grep' && f.counters('NATIVE.grep') === 1,
      `A→${ra.bodies?.[0]?.identity ?? ra.threw} B→${rb.bodies?.[0]?.identity ?? rb.threw} nativeCount=${String(f.counters('NATIVE.grep'))} (finding: own-layer registration already shadows inheritance for that scope)`)
  }

  // ---------- L2 BND-02: restrict-first; safe unload order (adapter out, mask stays) ----------
  {
    const f = await freshMount()
    const lift = f.A.scope.ctx.tools.restrict({ deny: ['grep'] })
    expect('L2.restrict-after-global-visible',
      f.resolution('grep', f.A.key) === 'UNKNOWN' && f.resolution('grep', f.B.key) === 'NATIVE.grep',
      `A=${f.resolution('grep', f.A.key)} B=${f.resolution('grep', f.B.key)}`)
    const ad = countingTool(f.obs, 'grep', 'ADAPTER.grep')
    f.A.scope.ctx.tools.register(ad)
    const r1 = await f.run('grep', f.A.key)
    expect('L2.adapter-live',
      r1.bodies?.[0]?.identity === 'ADAPTER.grep' && f.counters('NATIVE.grep') === 0,
      `A→${r1.bodies?.[0]?.identity ?? r1.threw} native=${String(f.counters('NATIVE.grep'))}`)
    const adUnregister = (() => { // register() returned disposer per pinned API
      // (we captured it below in a re-do; here dispose via returned value)
      return null
    })()
    void adUnregister
    // NOTE: register() returns the disposer; re-take it properly:
    // (the adapter above was registered without keeping the disposer — we
    // instead prove unload by disposer in L2b; L2 uses a fresh mount below.)
    expect('L2.native-zero', f.counters('NATIVE.grep') === 0, `native=${String(f.counters('NATIVE.grep'))}`)
    void lift
  }

  // ---------- L2b: adapter disposed, restrict lives → UNKNOWN, native stays 0 ----------
  {
    const f = await freshMount()
    f.A.scope.ctx.tools.restrict({ deny: ['grep'] })
    const ad = countingTool(f.obs, 'grep', 'ADAPTER.grep')
    const disposeAdapter = f.A.scope.ctx.tools.register(ad)
    const r1 = await f.run('grep', f.A.key)
    disposeAdapter()
    expect('L2b.post-unload-resolution',
      r1.bodies?.[0]?.identity === 'ADAPTER.grep' && f.resolution('grep', f.A.key) === 'UNKNOWN',
      `ran=${r1.bodies?.[0]?.identity} afterUnload=${f.resolution('grep', f.A.key)}`)
    const r2 = await f.run('grep', f.A.key)
    expect('L2b.BND-02.safe-unload-native-zero',
      f.counters('NATIVE.grep') === 0 && (r2.threw !== undefined || r2.isError === true || String(r2.text).includes('unknown tool')),
      `secondRun=${JSON.stringify(r2.text ?? r2.threw)} native=${String(f.counters('NATIVE.grep'))}`)
  }

  // ---------- L3 BND-03: race inside the dispatch-time re-resolution window ----------
  {
    // L3-safe: adapter disposed mid pre-execute-pause; mask stays.
    const f = await freshMount()
    f.A.scope.ctx.tools.restrict({ deny: ['grep'] })
    const ad = countingTool(f.obs, 'grep', 'ADAPTER.grep')
    const disposeAdapter = f.A.scope.ctx.tools.register(ad)
    const gate = deferred()
    let fired = false
    f.A.scope.ctx.on('tools/pre-execute', (exec, next) => {
      if (!fired && exec.name === 'grep') { fired = true; return gate.promise.then(() => next()) }
      return next()
    })
    const inflight = f.run('grep', f.A.key)
    await new Promise((r) => setImmediate(r)) // ensure listener reached (event-driven, not timed)
    disposeAdapter()
    gate.resolve()
    const res = await inflight
    expect('L3-safe.BND-03.dispose-under-race-mask-lives',
      f.counters('NATIVE.grep') === 0 && f.counters('ADAPTER.grep') === 0 && (res.threw !== undefined || res.isError === true || String(res.text).includes('unknown tool')),
      `outcome=${JSON.stringify(res.text ?? res.threw)} native=${String(f.counters('NATIVE.grep'))} adapter=${String(f.counters('ADAPTER.grep'))}`)
  }
  {
    // L3-hazard (CHARACTERIZATION): lift mask mid-pause too.
    const f = await freshMount()
    const lift = f.A.scope.ctx.tools.restrict({ deny: ['grep'] })
    const ad = countingTool(f.obs, 'grep', 'ADAPTER.grep')
    const disposeAdapter = f.A.scope.ctx.tools.register(ad)
    const gate = deferred()
    let fired = false
    f.A.scope.ctx.on('tools/pre-execute', (exec, next) => {
      if (!fired && exec.name === 'grep') { fired = true; return gate.promise.then(() => next()) }
      return next()
    })
    const inflight = f.run('grep', f.A.key)
    await new Promise((r) => setImmediate(r))
    disposeAdapter()
    lift() // WRONG ORDER on purpose: mask lifted while a call is in flight
    gate.resolve()
    const res = await inflight
    const hazardReproduced = f.counters('NATIVE.grep') === 1
    expect('L3-hazard.BND-03.lift-mask-under-race (characterization)',
      hazardReproduced,
      `expected-documented-hazard native-body-ran once via dispatch-time re-resolution; got native=${String(f.counters('NATIVE.grep'))} outcome=${JSON.stringify(res.text ?? res.threw)} — evidence that mask lifetime MUST outlive in-flight calls (atomic ordered assembly)`)
  }

  // ---------- L4 BND-04: early allow cannot bypass scoped monotonic guard ----------
  {
    const f = await freshMount()
    const ad = countingTool(f.obs, 'grep', 'ADAPTER.grep')
    f.A.scope.ctx.tools.register(ad)
    f.A.scope.ctx.on('tools/pre-execute', (exec, next) => {
      if (exec.name === 'grep') return Promise.resolve({ kind: 'allow' }) // early allow, skips next()
      return next()
    }, { prepend: true })
    f.A.scope.ctx.tools.guard((exec) => (exec.name === 'grep' ? 'team-guard-denial' : undefined))
    const res = await f.run('grep', f.A.key)
    expect('L4.BND-04.guard-after-allow',
      String(res.text).includes('team-guard-denial') && f.counters('ADAPTER.grep') === 0 && f.counters('NATIVE.grep') === 0,
      `outcome=${JSON.stringify(res.text ?? res.threw)} adapter=${String(f.counters('ADAPTER.grep'))} native=${String(f.counters('NATIVE.grep'))}`)
  }

  // ---------- L5 BND-05: duplicate/conflict installs, disposer order, reinstall ----------
  {
    const f = await freshMount()
    let throwOnDupScoped = false
    try {
      const d1 = countingTool(f.obs, 'grep', 'ADAPTER.grep#1')
      const dispose1 = f.A.scope.ctx.tools.register(d1)
      try { f.A.scope.ctx.tools.register(countingTool(f.obs, 'grep', 'ADAPTER.grep#2')) } catch { throwOnDupScoped = true }
      dispose1()
      const d3 = countingTool(f.obs, 'grep', 'ADAPTER.grep#3')
      f.A.scope.ctx.tools.register(d3) // reinstall after dispose must succeed
      const r = await f.run('grep', f.A.key)
      expect('L5.BND-05.conflict-and-reinstall',
        throwOnDupScoped && r.bodies?.[0]?.identity === 'ADAPTER.grep#3',
        `dupScopedThrew=${String(throwOnDupScoped)} afterReinstall=${r.bodies?.[0]?.identity ?? r.threw}`)
    } catch (err) {
      expect('L5.BND-05.conflict-and-reinstall', false, `env/err ${String(err)}`)
    }
  }

  // ---------- L6 BND-06-agentless: agentless lane is the global layer ----------
  {
    const f = await freshMount()
    const ad = countingTool(f.obs, 'grep', 'ADAPTER.grep')
    f.A.scope.ctx.tools.register(ad)
    const res = await f.run('grep', undefined)
    expect('L6.agentless-global-lane',
      res.bodies?.[0]?.identity === 'NATIVE.grep' && f.counters('ADAPTER.grep') === 0,
      `agentless→${res.bodies?.[0]?.identity ?? res.threw} (finding: agentless dispatch runs the global body — Team adapters do NOT cover agentless callers; out-of-Team lane must be excluded or bound separately)`)
  }

  // ---------- L7 PTC-01-partial: reserved run_code refusals ----------
  {
    const f = await freshMount()
    let regThrew = ''
    try { f.A.scope.ctx.tools.register(countingTool(f.obs, 'run_code', 'ADAPTER.runcode')) } catch (err) { regThrew = String(err?.message ?? err) }
    let restrictThrew = ''
    try { f.A.scope.ctx.tools.restrict({ deny: ['run_code'] }) } catch (err) { restrictThrew = String(err?.message ?? err) }
    expect('L7.PTC-01.reserved-run-code',
      /run_code/.test(regThrew) && /run_code/.test(restrictThrew),
      `register_threw=${JSON.stringify(regThrew.slice(0, 140))} restrict_threw=${JSON.stringify(restrictThrew.slice(0, 140))}`)
  }

  const out = { recorded_at_utc: new Date().toISOString(), legs: results }
  writeFileSync(join(HERE, 'p01-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(results.map((r) => `${r.id}:${r.verdict}`), null, 0))
  process.exit(results.every((r) => r.verdict === 'PASS') ? 0 : 1)
} catch (err) {
  console.error('P01_ENV_FAIL', err?.stack ?? String(err))
  process.exit(2)
}
