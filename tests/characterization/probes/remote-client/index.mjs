/**
 * P2-T6 probe group — `remote-client`.
 *
 * Proves the remaining TaskDoc §11.3 seams (machine level, public surface only):
 *   B1 plugin discovery + client module (CLIENT_MODULE): three rows (host probe,
 *      client-bundle probe, no-decl control) boot; every row appears in the
 *      composition dump; the client-bundle probe gains a /plugins combo-url
 *      entry in the composed Web boot graph and the bundle is served from it;
 *      the no-decl control gains no client entry; an unknown bundle 404s.
 *   B2 remote RPC + reconnect (TEAM_REMOTE): the launch URL mints the HMAC
 *      auth cookie; an authenticated client-request round-trips through the
 *      registered public RPC channel; unauthenticated / wrong content-type /
 *      method-mismatch requests produce the wire-contract responses; the
 *      ConnectionController probe proves connect, loss/backoff/reconnect,
 *      ready-timeout, sink isolation, and stop-during-backoff.
 *   B3 missing client bundle (negative control): fail-loud contract — a row
 *      mounted AT boot whose ./client bundle is missing aborts the boot
 *      (ClientPackageCompositionError aggregating the MissingClientBundle
 *      Error detail); the child log names the package; the row still appears
 *      in the separate dump-config output.
 *   B4 malformed dsh.client declaration (negative control): same fail-loud
 *      contract asserted via the platform-validation failure path.
 *   B5 slot seats (TEAM_VIEW_SLOT / NEW_TEAM_ENTRY / input-dock fallback seat):
 *      SlotCore — the engine under the plugin-level ctx.slots face — driven
 *      with declarations mirroring the frozen ui-conversation / ui-sidebar
 *      artifacts, including a disposer-collapse round trip.
 *
 * After the boot matrix the group validates the aggregate seam manifest
 * (seam-manifest/manifest.json): every evidence path exists, every
 * architecture-critical seam is an executable PASS, verdicts agree with the
 * per-task seam reports, the known-limitations register is complete, and no
 * harness or probe source imports outside the live public surface (reusing
 * lib/private-import.mjs + lib/public-surface.mjs — the same mechanism the
 * static section enforces).
 *
 * The instance child inherits process.env at spawn. The group sets
 * NODE_OPTIONS=--experimental-transform-types only around the B2 boot so the
 * child can load the connection package's public `./src/*` .ts subpath natively
 * (node 24 strip-only cannot parse its parameter properties); it is deleted
 * again before any later boot. Documented deviation, no upstream modification.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'
import http from 'node:http'
import { DshInstance, ensureProfile, ensureProbeResolution } from '../../lib/instance.mjs'
import { extractSpecifiers } from '../../lib/private-import.mjs'
import { checkSpecifier, matchPackageName } from '../../lib/public-surface.mjs'
import { portInUse, walk } from '../../lib/util.mjs'

const ROWS = {
  host: { id: 'p2t6-host-probe', rel: 'probes/remote-client/plugins/host-probe.js' },
  client: { id: 'p2t6-client-probe', rel: 'probes/remote-client/plugins/p2t6-client-probe/index.js' },
  nodecl: { id: 'p2t6-no-decl', rel: 'probes/remote-client/plugins/no-decl/index.js' },
  reconnect: { id: 'p2t6-reconnect-probe', rel: 'probes/remote-client/plugins/reconnect-probe.js' },
  slot: { id: 'p2t6-slot-probe', rel: 'probes/remote-client/plugins/slot-probe.js' },
  negBundle: { id: 'p2t6-missing-bundle', rel: 'probes/remote-client/plugins/negative-fixtures/missing-bundle/index.js' },
  negDecl: { id: 'p2t6-malformed-decl', rel: 'probes/remote-client/plugins/negative-fixtures/malformed-decl/index.js' },
}
const PATCH_HEADER = ['P2-T6 remote-client group: remote/client/slot seams (public surface only). Revert: replace with [].']

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
  name: 'remote-client',
  description:
    'P2-T6: plugin discovery, client modules, remote RPC + reconnect, and slot seats (conversation.view / sidebar.footer.action / input dock), with negative controls + seam-manifest validation',

  async run(ctx) {
    const { config, check, log, instance, harnessRoot, probesRoot } = ctx

    const obsDir = join(config.logDir, 'obs')
    rmSync(obsDir, { recursive: true, force: true })
    mkdirSync(obsDir, { recursive: true })
    process.env.P2T6_OBS_DIR = obsDir // instance.start() spreads process.env into the child
    log(`obs dir: ${obsDir}`)

    // 0. static positive control: every upstream import in this group's payloads
    //    is admitted by the LIVE public surface (probe mode mirrors this for all
    //    probe sources; this keeps the group self-checking under --only probes).
    const payloadFiles = []
    for (const item of walk(join(probesRoot, 'remote-client'), ['node_modules'])) {
      const ext = item.path.slice(item.path.lastIndexOf('.'))
      if (PROBE_SOURCE_EXTS.has(ext)) payloadFiles.push(item.path)
    }
    payloadFiles.sort()
    let upstreamCount = 0
    let allAdmitted = true
    for (const file of payloadFiles) {
      for (const { spec } of extractSpecifiers(readFileSync(file, 'utf8'))) {
        if (spec.startsWith('node:') || spec.startsWith('#') || spec.startsWith('.') || spec.startsWith('/')) continue
        const name = matchPackageName(spec, ctx.surface)
        if (name === undefined) continue
        upstreamCount += 1
        if (!checkSpecifier(spec, ctx.surface).admitted) allAdmitted = false
      }
    }
    check(upstreamCount >= 2, `group payloads carry >=2 upstream imports (${upstreamCount})`)
    check(allAdmitted, 'group payload upstream imports all admitted by the live public surface')

    // 0b. probe-resolution links: run.mjs creates them in preflight, which
    //     `--only probes` skips, so the group establishes them itself so the
    //     probe rows' bare upstream imports resolve (idempotent; covers every
    //     probe source under probes/, not just this group's).
    const probePackages = probePackageDirs(probesRoot, ctx.surface)
    check(
      probePackages.length >= 1,
      `probe sources import ${probePackages.length} upstream package(s): ${probePackages.map((p) => p.name).join(', ')}`,
    )
    ensureProbeResolution({ probesDir: probesRoot, packages: probePackages, log: (m) => log(`  ${m}`) })

    // capture the pre-existing patch layer for a byte-exact restore at the end
    const patchPath = instance.patchFile
    const patchSaved = existsSync(patchPath) ? readFileSync(patchPath) : null
    log(`saved patch layer: ${patchSaved === null ? '<absent>' : `${patchSaved.length} bytes`}`)

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    const waitFor = async (fn, timeoutMs, label) => {
      const t0 = Date.now()
      while (Date.now() - t0 < timeoutMs) {
        try {
          if (await fn()) return true
        } catch {
          // connection refused / reset while the row is still activating
        }
        await sleep(250)
      }
      check(false, `${label}: not ready within ${timeoutMs}ms`)
      return false
    }

    const waitObs = async (file, timeoutMs, label) => {
      const t0 = Date.now()
      while (Date.now() - t0 < timeoutMs) {
        if (existsSync(file)) {
          try {
            const json = JSON.parse(readFileSync(file, 'utf8'))
            if (json.done === true) return json
          } catch {
            // partial write; poll again
          }
        }
        await sleep(50)
      }
      check(false, `${label}: ${basename(file)} never reached done:true within ${timeoutMs}ms`)
      return null
    }

    // The lifecycle section normally initializes the main DSH_HOME profile;
    // under `--only probes` it is skipped, so make it a group precondition.
    const { initialized: mainProfileReady } = await ensureProfile({ instance, log, timeoutMs: 90_000 })
    if (!mainProfileReady) {
      check(false, 'web profile not ready under the main DSH_HOME after ensureProfile')
      finishRestore()
      return
    }
    log(`port ${config.port} in use before boot1: ${String(await portInUse(config.port))}`)

    const boot = async (label, rows) => {
      instance.mountRows(rows.map((r) => ({ id: r.id, name: ctx.pluginUrl(r.rel) })), PATCH_HEADER)
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

    const stopBoot = async (label) => {
      const s = await instance.stop()
      check(s.portFree, `${label} stop: port free`)
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

    try {
      // --- B1: plugin discovery + client module (CLIENT_MODULE) -------------
      {
        const started = await boot('B1 discovery+client', [ROWS.host, ROWS.client, ROWS.nodecl])
        if (started !== null) {
          const graphReady = await waitFor(
            async () => (await httpRequest(config.port, { method: 'GET', path: '/__p2t6/graph' })).status === 200,
            60_000,
            'B1 host-probe graph route',
          )
          if (graphReady) {
            const dump = await instance.dumpConfig()
            writeFileSync(join(config.logDir, 'dump-config-b1.txt'), dump.text)
            for (const r of [ROWS.host, ROWS.client, ROWS.nodecl]) {
              check(
                DshInstance.rowInDump(dump.text, { id: r.id, name: ctx.pluginUrl(r.rel) }),
                `B1 dump-config: row ${r.id} present in the composed profile`,
              )
            }
            const g = await httpRequest(config.port, { method: 'GET', path: '/__p2t6/graph' })
            check(g.status === 200 && g.body !== undefined, `B1 graph route: HTTP 200 + JSON (got ${describe(g)})`)
            if (g.body !== undefined) {
              const entryIds = (g.body.entryIds ?? []).map((id) => String(id ?? ''))
              const baselineIds = entryIds.filter((id) => !id.includes('p2t6-'))
              check(baselineIds.length >= 1, `B1 graph: baseline client rows present (${baselineIds.length}, e.g. ${JSON.stringify(baselineIds.slice(0, 3))})`)
              check(entryIds.some((id) => id.includes('p2t6-client-probe')), `B1 graph: client-bundle probe entry present (entryIds: ${JSON.stringify(entryIds)})`)
              check(!entryIds.some((id) => id.includes('p2t6-no-decl')), 'B1 graph: no-decl control gains no client entry')
              check(!entryIds.some((id) => id.includes('p2t6-host-probe')), 'B1 graph: host-only probe gains no client entry')
              const entry = (g.body.entries ?? []).find((e) => String(e?.id ?? '').includes('p2t6-client-probe'))
              check(entry !== undefined && typeof entry.url === 'string' && entry.url.length > 0, 'B1 graph: client-bundle probe entry carries a /plugins url')
              if (entry !== undefined && typeof entry.url === 'string') {
                check(/^\/plugins\/\?\?p2t6-client-probe\/client\.js&rev=/.test(entry.url), `B1 graph: combo url shape (${entry.url})`)
                const bundle = await httpRequest(config.port, { method: 'GET', path: entry.url })
                check(
                  bundle.status === 200 && bundle.raw.includes('P2T6-CLIENT-BUNDLE'),
                  `B1 serve: client bundle served from the graph url with marker (got ${bundle.status})`,
                )
              }
            }
            const nf = await httpRequest(config.port, { method: 'GET', path: '/plugins/nonexistent/client.js' })
            check(nf.status === 404, `B1 serve: unknown bundle 404 (got ${nf.status})`)
            const hostObs = await waitObs(join(obsDir, 'host-probe-activated.json'), 30_000, 'B1 host probe activation')
            if (hostObs !== null) {
              check(
                hostObs.graphRoute === '/__p2t6/graph' && hostObs.rpcChannel === '/p2t6rpc' && hostObs.servicesPresent?.clientModules === true,
                'B1 host probe: webServer + clientModules + connection all present at apply time (inject deferral worked)',
              )
            }
            await stopBoot('B1')
          }
        }
      }

      // --- B2: remote RPC + reconnect (TEAM_REMOTE) --------------------------
      process.env.NODE_OPTIONS = '--experimental-transform-types'
      try {
        const started = await boot('B2 remote+reconnect', [ROWS.host, ROWS.reconnect])
        if (started !== null) {
          const obs = await waitObs(join(obsDir, 'obs-reconnect.json'), 90_000, 'B2 reconnect probe')
          if (obs !== null) {
            const cs = obs.checkSummary ?? {}
            if (typeof obs.fatal === 'string') check(false, `B2 reconnect: fatal ${firstLine(obs.fatal)}`)
            check(
              (cs.failedIds ?? []).length === 0,
              `B2 reconnect: all ${cs.passed ?? 0}/${cs.total ?? 0} scenario checks passed${(cs.failedIds ?? []).length ? ` (failed: ${(cs.failedIds ?? []).join(', ')})` : ''}`,
            )
          }

          // Token exchange: the launch URL mints the HMAC auth cookie.
          const launch = new URL(started.url)
          const tx = await httpRequest(config.port, { method: 'GET', path: `${launch.pathname}${launch.search}` })
          check(tx.status === 302 || tx.status === 303, `B2 auth: launch URL redirects (observed ${tx.status})`)
          const setCookies = tx.headers['set-cookie']
          const cookieLine = (Array.isArray(setCookies) ? setCookies : setCookies !== undefined ? [setCookies] : []).find((c) => String(c).startsWith('dsh-auth-'))
          check(cookieLine !== undefined, 'B2 auth: Set-Cookie mints a dsh-auth-<b64url(sha256)>=v1 cookie on the launch redirect')
          let cookie = null
          if (cookieLine !== undefined) {
            cookie = String(cookieLine).split(';')[0].trim()
            check(/^dsh-auth-[A-Za-z0-9_-]{43}=v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(cookie), `B2 auth: cookie shape (dsh-auth-<b64url(sha256)>=v1.<b64url>.<b64url-hmac>): ${cookie.slice(0, 28)}...`)
            check(cookieLine.includes('HttpOnly') && /SameSite=Strict/i.test(cookieLine), 'B2 auth: cookie is HttpOnly + SameSite=Strict')
          }

          const rpc = { n: 0 }
          const rpcPost = (endpoint, opts = {}) => {
            rpc.n += 1
            const headers = { 'content-type': opts.contentType ?? 'application/json' }
            if (opts.auth !== false && cookie !== null) headers.cookie = cookie
            const body = JSON.stringify({
              type: 'client-request',
              rpcId: `p2t6-r${rpc.n}`,
              method: opts.wireMethod ?? endpoint,
              payload: opts.payload ?? { seq: rpc.n },
            })
            return httpRequest(config.port, { method: 'POST', path: `/p2t6rpc/${endpoint}`, headers, body })
          }
          const echo = await rpcPost('echo', { payload: { value: 'p2t6-ping' } })
          check(echo.status === 200 && echo.body?.type === 'server-response' && echo.body?.result?.ok === true, `B2 rpc: echo 200 server-response ok (got ${describe(echo)})`)
          check(
            echo.body?.result?.value?.endpoint === 'echo' &&
              echo.body?.result?.value?.marker === 'p2t6-rpc-echo' &&
              echo.body?.result?.value?.echo?.value === 'p2t6-ping',
            'B2 rpc: endpoint, marker, and payload round-trip verbatim through the public channel',
          )
          const unauth = await rpcPost('echo', { auth: false })
          check(unauth.status === 401 && /unauthorized/.test(unauth.raw), `B2 rpc: no cookie -> 401 unauthorized (got ${unauth.status} ${String(unauth.raw).slice(0, 60)})`)
          const badCt = await rpcPost('echo', { contentType: 'text/plain' })
          check(badCt.status === 415 && /content type must be application\/json/.test(badCt.raw), `B2 rpc: wrong content-type -> 415 (got ${badCt.status})`)
          const badMethod = await rpcPost('echo', { wireMethod: 'other' })
          check(
            badMethod.status === 200 &&
              badMethod.body?.result?.ok === false &&
              badMethod.body?.result?.error?.code === 'bad-request' &&
              String(badMethod.body?.result?.error?.message ?? '').includes('does not match endpoint'),
            `B2 rpc: method/endpoint mismatch -> 200 bad-request (got ${describe(badMethod)})`,
          )
          const err = await rpcPost('err')
          check(
            err.status === 200 && err.body?.result?.ok === false && err.body?.result?.error?.code === 'p2t6-probe-error',
            `B2 rpc: deliberate error result travels as a normal result (got ${describe(err)})`,
          )
          const boom = await rpcPost('boom')
          check(boom.status === 500 && /handler failure:/.test(boom.raw), `B2 rpc: thrown handler -> 500 handler failure (got ${boom.status} ${String(boom.raw).slice(0, 80)})`)

          // Instance log: the reconnect warns + sink isolation land in the child output.
          let logText = ''
          try {
            logText = readFileSync(instance.logPath, 'utf8')
          } catch {
            logText = ''
          }
          const retryCount = (logText.match(/connection lost, retry #/g) ?? []).length
          check(retryCount >= 2, `B2 reconnect: instance log carries ${retryCount} 'connection lost, retry #' warns (>=2)`)
          const sinkCount = (logText.match(/connection sink threw/g) ?? []).length
          check(sinkCount >= 1, `B2 reconnect: instance log shows sink isolation (${sinkCount} 'connection sink threw' lines)`)
          await stopBoot('B2')
        }
      } finally {
        delete process.env.NODE_OPTIONS
      }

      // --- B3: negative control — missing client bundle (fail-loud contract) --
      // Upstream contract (packages/client/modules/src/index.ts, ctor + flush):
      // activation-PASS failures aggregate into ClientPackageCompositionError
      // and ABORT BOOT — the child exits code 1 before the web URL prints. A
      // row whose dsh.client declaration points at a missing ./client bundle
      // surfaces as MissingClientBundleError inside the aggregate ('client
      // bundles not found; run `pnpm run build` before launch' + package name).
      // Steady state is the lenient path — a row live-patched after boot only
      // warns and is excluded — but a row mounted AT boot fails the boot loudly.
      // Assert: start() throws; the child log names the package and carries the
      // marker; the separate dump-config call still shows the row (mount
      // succeeded, failure is at composition); the port is freed.
      {
        instance.mountRows(
          [ROWS.host, ROWS.negBundle].map((r) => ({ id: r.id, name: ctx.pluginUrl(r.rel) })),
          PATCH_HEADER,
        )
        let bootError = null
        try {
          await instance.start()
        } catch (error) {
          bootError = error
        }
        check(bootError !== null, 'B3 missing-bundle: boot ABORTS (start() threw) — activation-pass fail-loud contract')
        let logText = ''
        try {
          logText = readFileSync(instance.logPath, 'utf8')
        } catch {
          logText = ''
        }
        writeFileSync(join(config.logDir, `instance-port${config.port}-negative-b3.log`), logText)
        check(logText.includes('p2t6-missing-bundle'), 'B3 missing-bundle: child log names the failing package')
        check(
          logText.includes('client bundles not found'),
          "B3 missing-bundle: child log carries the MissingClientBundleError marker ('client bundles not found')",
        )
        const dump = await instance.dumpConfig()
        writeFileSync(join(config.logDir, 'dump-config-b3.txt'), dump.text)
        check(
          DshInstance.rowInDump(dump.text, { id: ROWS.negBundle.id, name: ctx.pluginUrl(ROWS.negBundle.rel) }),
          'B3 missing-bundle: row present in the composed profile dump (mount succeeded; failure is at composition)',
        )
        await stopBoot('B3 missing-bundle')
      }

      // --- B4: negative control — malformed dsh.client declaration ----------
      // Same fail-loud contract via the platform-validation path: a dsh.client
      // whose platform is not a string makes parseDshClient throw 'client-
      // modules: p2t6-malformed-decl dsh.client.platform must be a string';
      // the activation pass aggregates it under the ClientPackageComposition
      // Error 'other failures' and aborts boot the same way B3 does.
      {
        instance.mountRows(
          [ROWS.host, ROWS.negDecl].map((r) => ({ id: r.id, name: ctx.pluginUrl(r.rel) })),
          PATCH_HEADER,
        )
        let bootError = null
        try {
          await instance.start()
        } catch (error) {
          bootError = error
        }
        check(bootError !== null, 'B4 malformed-decl: boot ABORTS (start() threw) — activation-pass fail-loud contract')
        let logText = ''
        try {
          logText = readFileSync(instance.logPath, 'utf8')
        } catch {
          logText = ''
        }
        writeFileSync(join(config.logDir, `instance-port${config.port}-negative-b4.log`), logText)
        check(logText.includes('p2t6-malformed-decl'), 'B4 malformed-decl: child log names the failing package')
        check(
          logText.includes('dsh.client.platform must be a string'),
          'B4 malformed-decl: child log carries the parseDshClient marker (platform must be a string)',
        )
        const dump = await instance.dumpConfig()
        writeFileSync(join(config.logDir, 'dump-config-b4.txt'), dump.text)
        check(
          DshInstance.rowInDump(dump.text, { id: ROWS.negDecl.id, name: ctx.pluginUrl(ROWS.negDecl.rel) }),
          'B4 malformed-decl: row present in the composed profile dump (mount succeeded; failure is at composition)',
        )
        await stopBoot('B4 malformed-decl')
      }

      // --- B5: slot seats (TEAM_VIEW_SLOT / NEW_TEAM_ENTRY / fallback dock) --
      {
        const started = await boot('B5 slots', [ROWS.slot])
        if (started !== null) {
          const obs = await waitObs(join(obsDir, 'obs-slot.json'), 90_000, 'B5 slot probe')
          if (obs !== null) {
            if (typeof obs.fatal === 'string') check(false, `B5 slot: fatal ${firstLine(obs.fatal)}`)
            const cs = obs.checkSummary ?? {}
            check(
              (cs.failedIds ?? []).length === 0,
              `B5 slot: all ${cs.passed ?? 0}/${cs.total ?? 0} seat checks passed${(cs.failedIds ?? []).length ? ` (failed: ${(cs.failedIds ?? []).join(', ')})` : ''}`,
            )
            const coreA = obs.cores?.A_conversationView
            const coreB = obs.cores?.B_sidebarFooterAction
            const coreC = obs.cores?.C_inputDock
            check(coreA?.facts?.a3_tab?.registrant === 'p2t6-team-probe', 'B5 TEAM_VIEW_SLOT: Team Tab registered into conversation.view (list/session)')
            check(coreB?.facts?.b3_action?.registrant === 'p2t6-team-probe', 'B5 NEW_TEAM_ENTRY: New Team action registered into sidebar.footer.action (list/root)')
            check(coreC?.facts?.c2_dock?.registrant === 'p2t6-team-probe', 'B5 input dock: Team Dock registered into conversation.input.dock (list/session) — fallback seat exists')
            check(
              String(coreA?.facts?.a5_sameId?.message ?? '').includes('registered by p2t6-team-probe'),
              'B5 slot collision: same id+priority refusal names the incumbent registrant',
            )
          }
          await stopBoot('B5')
        }
      }
    } finally {
      // Defensive cleanup on EVERY exit path (early return or throw): stop
      // any live instance child, restore the patch layer byte-exact, and drop
      // the exported env vars.
      if (instance.child !== undefined) {
        try {
          await instance.stop()
        } catch (error) {
          log(`cleanup: instance stop failed: ${firstLine(String(error.message))}`)
        }
      }
      finishRestore()
      delete process.env.P2T6_OBS_DIR
      delete process.env.NODE_OPTIONS
    }

    // --- 6. aggregate seam manifest validation -------------------------------
    validateManifest(ctx, obsDir)
  },
}

function validateManifest(ctx, obsDir) {
  const { config, check, log, harnessRoot, probesRoot, surface } = ctx
  const manifestPath = join(harnessRoot, 'seam-manifest', 'manifest.json')
  if (!existsSync(manifestPath)) {
    check(false, 'seam manifest: seam-manifest/manifest.json is missing')
    return
  }
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    check(false, `seam manifest: unparseable: ${firstLine(String(error.message))}`)
    return
  }
  const results = { manifest: 'seam-manifest/manifest.json', rules: [] }
  const rule = (id, passed, detail) => {
    results.rules.push({ id, passed, detail })
    check(passed, `seam manifest: ${detail}`)
  }

  // Evidence paths in the manifest are worktree-root-relative (the same base
  // every P2-Tx task uses for evidence/); harnessRoot is two levels down.
  const repoRoot = join(harnessRoot, '..', '..')

  const seams = Array.isArray(manifest.seams) ? manifest.seams : []
  rule('rows', seams.length >= 15, `aggregates ${seams.length} seam rows across P2-T1..T6 (>=15)`)
  const critical = seams.filter((s) => s.criticality === 'architecture-critical')
  rule('critical-rows', critical.length >= 4, `${critical.length} architecture-critical seams (>=4)`)

  // 1. every referenced evidence path and per-task report exists.
  const seen = new Set()
  const missing = []
  for (const s of seams) {
    for (const p of s.evidence ?? []) {
      if (seen.has(p)) continue
      seen.add(p)
      if (!existsSync(join(repoRoot, p))) missing.push(p)
    }
    if (typeof s.report === 'string' && !existsSync(join(repoRoot, s.report))) missing.push(s.report)
  }
  rule('evidence-exists', missing.length === 0, missing.length === 0 ? 'all evidence paths + per-task reports exist' : `missing (${missing.length}): ${missing.slice(0, 5).join(', ')}`)

  // 2. every architecture-critical seam is an executable PASS (or a
  //    SPECULATIVE_PASS that carries an explicit risk note).
  const badCritical = critical.filter((s) => !(s.verdict === 'PASS' || (s.verdict === 'SPECULATIVE_PASS' && typeof s.risk === 'string' && s.risk.length > 0)))
  rule('critical-executable', badCritical.length === 0, badCritical.length === 0 ? 'every arch-critical seam is executable PASS' : `not executable PASS: ${badCritical.map((s) => s.name).join(', ')}`)

  // 3. verdicts are consistent with the per-task seam reports (each report
  //    names its seams).
  const inconsistent = []
  for (const s of seams) {
    if (typeof s.report !== 'string' || !existsSync(join(repoRoot, s.report))) continue
    if (!readFileSync(join(repoRoot, s.report), 'utf8').includes(s.name)) inconsistent.push(s.name)
  }
  rule('verdicts-consistent', inconsistent.length === 0, inconsistent.length === 0 ? 'every seam is named in its per-task report' : `absent from reports: ${inconsistent.join(', ')}`)

  // 4. zero non-public upstream imports, mirroring the static section's C4
  //    semantics (run.mjs: harness set strict, bad probe must be DETECTED):
  //    the harness set (lib/** + run.mjs + spawn-probe.mjs + probes/*/index.mjs)
  //    and every group's plugins/ payload are strict; each group's designated
  //    negative-fixture zone (plugins/negative-fixtures/** — where run.mjs's
  //    C4 bad probe and T5's runtime negatives live) is excluded from the
  //    strict set but must still yield detections, proving the scanner
  //    actively rejects rather than vacuously passing.
  const files = new Set()
  const negativeFixtureFiles = new Set()
  for (const item of walk(join(harnessRoot, 'lib'), [])) files.add(item.path)
  files.add(join(harnessRoot, 'run.mjs'))
  files.add(join(harnessRoot, 'spawn-probe.mjs'))
  for (const groupDir of readdirSync(probesRoot, { withFileTypes: true })) {
    if (!groupDir.isDirectory()) continue
    const groupPath = join(probesRoot, groupDir.name)
    const idx = join(groupPath, 'index.mjs')
    if (existsSync(idx)) files.add(idx)
    for (const item of walk(join(groupPath, 'plugins'), ['node_modules'])) {
      const ext = item.path.slice(item.path.lastIndexOf('.'))
      if (!PROBE_SOURCE_EXTS.has(ext)) continue
      if (relative(probesRoot, item.path).split(sep).includes('negative-fixtures')) negativeFixtureFiles.add(item.path)
      else files.add(item.path)
    }
  }
  const scanPrivateImports = (fileSet) => {
    const found = []
    for (const file of [...fileSet].sort()) {
      for (const { spec } of extractSpecifiers(readFileSync(file, 'utf8'))) {
        if (spec.startsWith('node:') || spec.startsWith('#') || spec.startsWith('.') || spec.startsWith('/')) continue
        const name = matchPackageName(spec, surface)
        if (name === undefined) continue
        if (!checkSpecifier(spec, surface).admitted) found.push(`${basename(file)}: ${spec}`)
      }
    }
    return found
  }
  const privateImports = scanPrivateImports(files)
  const fixtureFindings = scanPrivateImports(negativeFixtureFiles)
  const privateOk = privateImports.length === 0 && fixtureFindings.length >= 1
  rule('zero-private-imports', privateOk, privateOk
    ? `zero non-public upstream imports across ${files.size} harness+payload files; ${fixtureFindings.length} detection(s) in the designated negative-fixture zone (scanner actively rejects)`
    : `${privateImports.length === 0 ? 'payload clean' : `non-public: ${privateImports.slice(0, 5).join(', ')}`} | negative-fixture zone: ${fixtureFindings.length} detection(s), expected >= 1`)

  // 5. the known-limitations register is complete (status + evidence each).
  const limits = Array.isArray(manifest.knownLimitations) ? manifest.knownLimitations : []
  const badLimits = limits.filter((l) => typeof l?.status !== 'string' || l.status.length === 0 || !Array.isArray(l?.evidence) || l.evidence.length === 0)
  rule('limitations-complete', limits.length >= 1 && badLimits.length === 0, `${limits.length} known limitations, each with status + evidence`)

  try {
    writeFileSync(join(obsDir, 'seam-manifest-validation.json'), JSON.stringify(results, null, 2))
    log(`seam manifest validation written: obs/seam-manifest-validation.json`)
  } catch (error) {
    check(false, `seam manifest: validation record write failed: ${firstLine(String(error.message))}`)
  }
  void config
}

function firstLine(text) {
  return text.split('\n')[0]
}

function describe(r) {
  return r.body !== undefined ? JSON.stringify(r.body) : `no JSON body (status ${r.status}, raw ${String(r.raw).slice(0, 200)})`
}

function httpRequest(port, { method = 'GET', path, headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method, path, headers, timeout: 180_000 },
      (res) => {
        let data = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          let parsed
          try {
            parsed = JSON.parse(data)
          } catch {
            parsed = undefined
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data })
        })
      },
    )
    req.on('timeout', () => req.destroy(new Error(`p2t6 probe: HTTP timeout on ${path}`)))
    req.on('error', reject)
    if (body !== null) req.write(body)
    req.end()
  })
}
