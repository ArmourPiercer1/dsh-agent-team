/**
 * P2-T2 probe group — `agent-lifecycle`.
 *
 * Proves the TaskDoc §11.3 seams: (a) fresh create, (b) member resume,
 * (c) ordinary root cold resume, (d) the ordering trace — setup ordering
 * and fresh/cold recovery of the Root TeamDomain binding BEFORE the first
 * Team-sensitive step, all machine-provable from public APIs.
 *
 * Boots (main DSH_HOME unless noted):
 *   boot1 fresh         fresh scenario + prep-custom-event + neg-late-binding
 *   boot2 cold resume   same DSH_HOME, NEW process: resume-member (root NOT
 *                       yet live → sidecar-only proof), resume-root,
 *                       neg-custom-event-cold
 *   boot3 empty home    scratch DSH_HOME (under the report dir): resume-root
 *                       must be rejected with P2T2_RESUME_NOT_FOUND
 *
 * The plugin never disposes agent handles (dispose retires the session);
 * process kill (instance.stop) is the teardown. The pre-existing patch layer
 * is captured before boot1 and restored byte-exact after boot3.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import http from 'node:http'
import { DshInstance, ensureProfile, ensureProbeResolution } from '../../lib/instance.mjs'
import { extractSpecifiers } from '../../lib/private-import.mjs'
import { checkSpecifier, matchPackageName } from '../../lib/public-surface.mjs'
import { portInUse, walk } from '../../lib/util.mjs'

const ROW = {
  id: 'p2t2-agent-lifecycle',
  rel: 'probes/agent-lifecycle/plugins/lifecycle-host.js',
}
const PATCH_HEADER = ['P2-T2 agent-lifecycle group: Root TeamDomain binding seam (public APIs only). Revert: replace with [].']
const CUSTOM_EVENT_TYPE = 'team/vnext/p2t2-probe-marker'

const PROBE_SOURCE_EXTS = new Set(['.js', '.mjs', '.cjs'])

/** Every probe plugin source file under probes/ (skips node_modules links). Mirrors run.mjs. */
function probeSourceFiles(probesRoot) {
  const out = []
  for (const item of walk(probesRoot, ['node_modules'])) {
    const ext = item.path.slice(item.path.lastIndexOf('.'))
    if (PROBE_SOURCE_EXTS.has(ext)) out.push(item.path)
  }
  return out.sort()
}

/** Upstream package names the probe sources import (mirrors run.mjs probePackageDirs). */
function probePackageDirs(probesRoot, surface) {
  const names = new Set()
  for (const file of probeSourceFiles(probesRoot)) {
    for (const { spec } of extractSpecifiers(readFileSync(file, 'utf8'))) {
      if (spec.startsWith('node:') || spec.startsWith('#') || spec.startsWith('.') || spec.startsWith('/')) continue
      const name = matchPackageName(spec, surface)
      if (name !== undefined) names.add(name)
    }
  }
  return [...names].map((name) => ({ name, dir: surface.get(name).dir }))
}

export default {
  name: 'agent-lifecycle',
  description:
    'P2-T2: setup ordering + fresh/member/root-cold resume of the Root TeamDomain binding (storage-sidecar), with negative controls',

  async run(ctx) {
    const { config, check, log, instance } = ctx

    if (config.reportDir === null) {
      check(false, 'agent-lifecycle requires --report-dir (obs + scratch evidence live under the report dir)')
      return
    }

    // 0. static positive control: every upstream import admitted by the LIVE surface
    const pluginText = readFileSync(join(ctx.harnessRoot, ROW.rel), 'utf8')
    const upstream = extractSpecifiers(pluginText).filter((s) => matchPackageName(s.spec, ctx.surface) !== undefined)
    check(upstream.length >= 1, `probe carries >=1 upstream import (${upstream.map((s) => s.spec).join(', ') || 'none'})`)
    check(
      upstream.every((s) => checkSpecifier(s.spec, ctx.surface).admitted),
      'probe upstream imports all admitted by the live public surface',
    )

    // 0b. probe-resolution links: run.mjs creates them in preflight, which
    //     `--only probes` skips, so the group establishes them itself so the
    //     probe rows' bare upstream imports resolve (idempotent; covers every
    //     probe source under probes/, not just this group's).
    const probePackages = probePackageDirs(ctx.probesRoot, ctx.surface)
    check(
      probePackages.length >= 1,
      `probe sources import ${probePackages.length} upstream package(s): ${probePackages.map((p) => p.name).join(', ')}`,
    )
    ensureProbeResolution({ probesDir: ctx.probesRoot, packages: probePackages, log: (m) => log(`  ${m}`) })

    const obsDir = join(config.reportDir, 'obs')
    mkdirSync(obsDir, { recursive: true })
    process.env.P2T2_OBS_DIR = obsDir // instance.start() spreads process.env into the child
    log(`obs dir: ${obsDir}`)

    const suffix = randomBytes(4).toString('hex')
    const rootId = `p2t2-root-${suffix}`
    const memberId = `p2t2-member-${suffix}`
    const lateId = `p2t2-late-${suffix}`
    const probeId = `p2t2-probe-${suffix}`
    const rootMarker = `P2T2-ROOT-MARKER-${rootId}`
    const markerQs = `marker=${encodeURIComponent(rootMarker)}`
    log(`session ids: root=${rootId} member=${memberId} late=${lateId} probe=${probeId}`)

    // capture the pre-existing patch layer for a byte-exact restore at the end
    const patchPath = instance.patchFile
    const patchSaved = existsSync(patchPath) ? readFileSync(patchPath) : null
    log(`saved patch layer: ${patchSaved === null ? '<absent>' : `${patchSaved.length} bytes`}`)

    const call = (query) => httpCall(config.port, `/__p2t2/run?${query}`)
    const boot = async (label) => {
      instance.mountRows([{ id: ROW.id, name: ctx.pluginUrl(ROW.rel) }], PATCH_HEADER)
      let started
      try {
        started = await instance.start()
      } catch (error) {
        check(false, `${label}: boot failed: ${firstLine(String(error.message))} (instance log: ${instance.logPath})`)
        return null
      }
      check(started.url.startsWith(`http://127.0.0.1:${config.port}/`), `${label}: boot ok on port ${config.port} (${started.url})`)
      return started
    }

    // The probe row declares `inject` for its five required services, so the
    // Loader may activate it a beat AFTER the web server starts listening
    // (the boot marker). Poll the scenario route until the row is active.
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const waitRouteReady = async (label) => {
      const deadline = Date.now() + 60_000
      for (;;) {
        try {
          const r = await call('scenario=__readiness__')
          if (r.status === 200 && r.body && r.body.probe === ROW.id) {
            log(`${label}: scenario route ready`)
            return true
          }
        } catch {
          // connection refused / reset while the row is still activating
        }
        if (Date.now() >= deadline) {
          check(false, `${label}: scenario route never became ready within 60s`)
          return false
        }
        await sleep(400)
      }
    }

    // try/finally wraps every boot so a failing group never leaves a live
    // child (cascading into the sibling probe group) or a clobbered patch
    // layer; the try body keeps its original indentation (intentional).
    let scratch = null
    try {
    // --- boot 1: fresh + in-boot negative controls --------------------------
    // The lifecycle section normally initializes the main DSH_HOME profile;
    // under `--only probes` it is skipped, so make it a group precondition.
    const { initialized: mainProfileReady } = await ensureProfile({ instance, log, timeoutMs: 90_000 })
    if (!mainProfileReady) {
      check(false, 'web profile not ready under the main DSH_HOME after ensureProfile')
      return
    }
    log(`port ${config.port} in use before boot1: ${String(await portInUse(config.port))}`)
    if ((await boot('boot1 fresh')) === null) return
    if (!(await waitRouteReady('boot1 fresh'))) return

    let freshRootLogLength = null
    {
      const r = await call(`scenario=fresh&rootId=${rootId}&memberId=${memberId}`)
      check(r.status === 200 && r.body && r.body.ok === true, `fresh: HTTP 200 + ok (got ${describe(r)})`)
      const obs = readObs(r, check, 'fresh')
      if (obs) {
        check(traceValid(obs.trace), 'fresh: trace is a strict-seq, non-decreasing-ts ordering record')
        assertSubsequence(
          obs.trace,
          [
            ['activate', {}],
            ['run-start', { scenario: 'fresh' }],
            ['event:session/created', { sessionId: rootId }],
            ['event:agent/created', { sessionId: rootId }],
            ['event:agent/session-start', { sessionId: rootId, source: 'startup' }],
            ['binding-attach', { sessionId: rootId }],
            ['first-team-step', { sessionId: rootId, role: 'root' }],
            ['event:session/created', { sessionId: memberId }],
            ['event:agent/created', { sessionId: memberId }],
            ['event:agent/session-start', { sessionId: memberId, source: 'startup' }],
            ['first-team-step', { sessionId: memberId, role: 'member' }],
            ['durable', { sessionId: rootId }],
            ['durable', { sessionId: memberId }],
            ['run-end', { scenario: 'fresh' }],
          ],
          check,
          'fresh',
        )
        check(r.body.marker === rootMarker, `fresh: response carries the root marker (${String(r.body.marker)})`)
        freshRootLogLength = obs.rootLogLength
        check(typeof freshRootLogLength === 'number' && freshRootLogLength >= 0, `fresh: root session log length recorded (${freshRootLogLength})`)
      }
    }
    {
      const r = await call(`scenario=prep-custom-event&probeId=${probeId}`)
      check(r.status === 200 && r.body && r.body.ok === true, 'prep-custom-event: downstream session event appended + flushed (got ' + describe(r) + ')')
    }
    {
      const r = await call(`scenario=neg-late-binding&lateId=${lateId}`)
      check(
        r.status === 200 && r.body && r.body.ok === false && r.body.code === 'P2T2_ROOT_BINDING_MISSING' && r.body.sessionId === lateId,
        `neg-late-binding: first Team step before attach fails with P2T2_ROOT_BINDING_MISSING (got ${describe(r)})`,
      )
      check(
        typeof r.body?.error === 'string' && r.body.error.includes(ROW.id) && r.body.error.includes(lateId),
        'neg-late-binding: the machine-readable failure names the probe row and the session',
      )
      const obs = readObs(r, check, 'neg-late-binding')
      if (obs) {
        assertSubsequence(
          obs.trace,
          [
            ['run-start', { scenario: 'neg-late-binding' }],
            ['event:session/created', { sessionId: lateId }],
            ['first-team-step-failed', { sessionId: lateId }],
            ['binding-attach', { sessionId: lateId }],
            ['first-team-step', { sessionId: lateId, afterLateBinding: true }],
            ['run-end', { scenario: 'neg-late-binding' }],
          ],
          check,
          'neg-late-binding',
        )
        const failed = obs.trace.find((e) => e.phase === 'first-team-step-failed')
        check(
          failed !== undefined && failed.violation && failed.violation.code === 'P2T2_ROOT_BINDING_MISSING' && typeof failed.violation.message === 'string',
          'neg-late-binding: the failed step carries a machine-readable violation {code,message}',
        )
      }
    }
    {
      const s = await instance.stop()
      check(s.portFree, 'boot1 stop: port free')
    }

    // --- boot 2: cold resume (same DSH_HOME, new process) -------------------
    if ((await boot('boot2 cold resume')) === null) return
    if (!(await waitRouteReady('boot2 cold resume'))) return

    // Order matters: resume-member runs FIRST, while the root session is NOT
    // live yet (the session store keeps only in-process sessions — a cold
    // process holds none). Its first Team-sensitive step must therefore
    // resolve the binding from the sidecar alone; rootLive === false proves
    // sidecar-only authority. resume-root then runs second.
    {
      const r = await call(`scenario=resume-member&memberId=${memberId}&rootId=${rootId}&${markerQs}`)
      check(r.status === 200 && r.body && r.body.ok === true, `resume-member: cold resume ok (got ${describe(r)})`)
      const obs = readObs(r, check, 'resume-member')
      if (obs) {
        check(traceValid(obs.trace), 'resume-member: trace valid (strict seq, non-decreasing ts)')
        assertSubsequence(
          obs.trace,
          [
            ['activate', {}],
            ['run-start', { scenario: 'resume-member' }],
            ['event:agent/session-start', { sessionId: memberId, source: 'resume' }],
            ['binding-recovered', { sessionId: memberId, rootId }],
            ['first-team-step', { sessionId: memberId, role: 'member' }],
            ['run-end', { scenario: 'resume-member' }],
          ],
          check,
          'resume-member',
        )
        check(r.body.marker === rootMarker, `resume-member: root binding recovered via sidecar (${String(r.body.marker)})`)
        check(
          r.body.rootLive === false,
          `resume-member: root session is NOT live after the cold restart; the binding came from the sidecar alone (rootLive=${String(r.body.rootLive)})`,
        )
      }
    }
    {
      const r = await call(`scenario=resume-root&rootId=${rootId}&${markerQs}`)
      check(r.status === 200 && r.body && r.body.ok === true, `resume-root: cold resume ok (got ${describe(r)})`)
      const obs = readObs(r, check, 'resume-root')
      if (obs) {
        check(traceValid(obs.trace), 'resume-root: trace valid (strict seq, non-decreasing ts)')
        assertSubsequence(
          obs.trace,
          [
            ['run-start', { scenario: 'resume-root' }],
            ['event:agent/session-start', { sessionId: rootId, source: 'resume' }],
            ['binding-recovered', { sessionId: rootId }],
            ['first-team-step', { sessionId: rootId, role: 'root' }],
            ['run-end', { scenario: 'resume-root' }],
          ],
          check,
          'resume-root',
        )
        check(r.body.marker === rootMarker, `resume-root: bound value recovered BEFORE the first Team step (${String(r.body.marker)})`)
        check(r.body.source === 'resume', `resume-root: session-start source is 'resume' (${String(r.body.source)})`)
        // A cold resume APPENDS an end-seed event to the log, so the intact
        // invariant is "never shrinks": fresh length <= resumed length.
        check(
          freshRootLogLength !== null && obs.rootLogLength >= freshRootLogLength,
          `resume-root: root log intact across the process death (resumed length ${String(obs.rootLogLength)} >= fresh length ${String(freshRootLogLength)})`,
        )
      }
    }
    {
      const r = await call(`scenario=neg-custom-event-cold&probeId=${probeId}`)
      check(
        r.status === 200 && r.body && r.body.ok === false && r.body.code === 'P2T2_CUSTOM_EVENT_COLD_READ_REFUSED' && r.body.sessionId === probeId,
        `neg-custom-event-cold: the cold read path refuses the downstream event type (got ${describe(r)})`,
      )
      check(
        typeof r.body?.error === 'string' &&
          r.body.error.includes('unknown to this harness') &&
          r.body.error.includes(probeId) &&
          r.body.error.includes(CUSTOM_EVENT_TYPE),
        'neg-custom-event-cold: the upstream refusal names the whitelist, the session and the event type',
      )
    }
    {
      const s = await instance.stop()
      check(s.portFree, 'boot2 stop: port free')
    }

    // --- boot 3: negative control — empty DSH_HOME (scratch) ----------------
    {
      const scratchHome = join(config.reportDir, 'scratch', 'empty-home')
      scratch = new DshInstance({
        hostTree: config.hostTree,
        dshHome: scratchHome,
        port: config.port,
        clientCommitHash: config.clientCommitHash,
        logDir: join(config.reportDir, 'logs-scratch'),
      })
      await ensureProfile({ instance: scratch, log, timeoutMs: 90_000 })
      scratch.mountRows([{ id: ROW.id, name: ctx.pluginUrl(ROW.rel) }], PATCH_HEADER)
      let started
      try {
        started = await scratch.start()
      } catch (error) {
        check(false, `boot3 empty-home: boot failed: ${firstLine(String(error.message))} (log: ${scratch.logPath})`)
        return
      }
      check(started.url.startsWith(`http://127.0.0.1:${config.port}/`), 'boot3 empty-home: boot ok')
      if (!(await waitRouteReady('boot3 empty-home'))) return
      const r = await call(`scenario=resume-root&rootId=${rootId}&${markerQs}`)
      check(
        r.status === 200 && r.body && r.body.ok === false && r.body.code === 'P2T2_RESUME_NOT_FOUND' && r.body.sessionId === rootId,
        `neg-empty-home: resume on an empty DSH_HOME is rejected with P2T2_RESUME_NOT_FOUND (got ${describe(r)})`,
      )
      const obs = readObs(r, check, 'neg-empty-home')
      if (obs) {
        const rejected = obs.trace.find((e) => e.phase === 'resume-rejected')
        check(
          rejected !== undefined && (String(rejected.errorMessage ?? '').includes(rootId) || rejected.sessionIdField === rootId),
          'neg-empty-home: the rejection is attributable (names the session id)',
        )
      }
      const s = await scratch.stop()
      check(s.portFree, 'boot3 stop: port free')
    }

    } finally {
      // Defensive cleanup on EVERY exit path (early return or throw): stop
      // any live instance child, then restore the patch layer byte-exact.
      for (const inst of [scratch, instance]) {
        if (inst !== null && inst.child !== undefined) {
          try {
            await inst.stop()
          } catch (error) {
            log(`cleanup: instance stop failed: ${firstLine(String(error.message))}`)
          }
        }
      }
      finishRestore()
    }

    // byte-exact restore of the pre-existing patch layer
    function finishRestore() {
      if (patchSaved === null) {
        if (existsSync(patchPath)) rmSync(patchPath)
      } else {
        writeFileSync(patchPath, patchSaved)
      }
      log(`patch layer restored (${patchSaved === null ? 'removed' : 'byte-exact'})`)
    }
  },
}

function firstLine(text) {
  return text.split('\n')[0]
}

function describe(r) {
  return r.body ? JSON.stringify(r.body) : `no JSON body (status ${r.status}, raw ${String(r.raw).slice(0, 200)})`
}

function httpCall(port, pathAndQuery) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathAndQuery, timeout: 180_000 }, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        let body
        try {
          body = JSON.parse(data)
        } catch {
          body = undefined
        }
        resolve({ status: res.statusCode, body, raw: data })
      })
    })
    req.on('timeout', () => req.destroy(new Error(`p2t2 probe: HTTP timeout on ${pathAndQuery}`)))
    req.on('error', reject)
  })
}

function readObs(r, check, label) {
  if (!r.body || typeof r.body.obsFile !== 'string') {
    check(false, `${label}: response has no obsFile`)
    return null
  }
  try {
    return JSON.parse(readFileSync(r.body.obsFile, 'utf8'))
  } catch (error) {
    check(false, `${label}: cannot read obs file ${r.body.obsFile}: ${firstLine(String(error.message))}`)
    return null
  }
}

function traceValid(trace) {
  if (!Array.isArray(trace) || trace.length === 0) return false
  for (let i = 0; i < trace.length; i += 1) {
    const e = trace[i]
    if (typeof e.seq !== 'number' || typeof e.ts !== 'number' || typeof e.phase !== 'string') return false
    if (i > 0 && (e.seq !== trace[i - 1].seq + 1 || e.ts < trace[i - 1].ts)) return false
  }
  return true
}

/** Assert that the expected (phase, detail-subset) entries appear, in order. */
function assertSubsequence(trace, expected, check, label) {
  let i = 0
  for (const entry of trace) {
    if (i >= expected.length) break
    const [phase, detail] = expected[i]
    if (entry.phase === phase && Object.entries(detail).every(([k, v]) => JSON.stringify(entry[k]) === JSON.stringify(v))) i += 1
  }
  check(
    i === expected.length,
    `${label}: ordering subsequence violated (matched ${i}/${expected.length} of [${expected.map((e) => e[0]).join(' -> ')}]; trace: ${trace
      .map((e) => `${e.phase}[${e.sessionId ?? ''}${e.source ? `:${e.source}` : ''}]`)
      .join(' ')})`,
  )
}
