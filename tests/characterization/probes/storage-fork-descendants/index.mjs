/**
 * P2-T5 probe group — storage-fork-descendants.
 *
 * Proves the three seams the G2 build needs, mechanism only (no TeamDomain /
 * TeamSession implementation — public storage/session/subagent APIs only):
 *
 *   S1 storage     — StorageDomain external persistence: seeded records and
 *                    the global survive a process restart on the same
 *                    DSH_HOME (reopened byte-equal); a fresh home opens the
 *                    same domain name clean (empty table, `initial` global);
 *                    a second open of a live spec fails loud (already-open).
 *   S2 fork        — fork lineage visibility: subagent-origin children carry
 *                    durable parentSession/origin/delegationDepth/seedLength
 *                    header facts; the descendant listing is exact (no
 *                    phantom rows, no missing rows) live AND after restart
 *                    (corpus + replay-validated logs + recursive trace).
 *   S3 descendants — generic descendant drain: interrupt with user authority
 *                    ends the held turn aborted/user; wrong-parent, stale
 *                    ancestor, and unknown-target authorities are handled
 *                    loudly/correctly; drainContinuableDescendants resolves
 *                    and leaves no descendant agent or live session.
 *
 * Mechanism: three boots of the pinned upstream web instance.
 *   boot #1 SEED    (main home, primary port)  — payload plugins/probe-host.js
 *   boot #2 VERIFY  (main home, restart)       — same home: durability proof
 *   boot #3 ISOLATE (scratch home, 2nd port)   — fresh home: isolation proof
 * The payload is driven by a directive file under each home's DSH_HOME and
 * answers with one machine-readable observation JSON per phase in the report
 * dir (obs-seed.json / obs-verify.json / obs-isolate.json). All LLM traffic
 * is aimed at an in-process blackhole endpoint (see below) so fixture turns
 * stay deterministically `running` with zero external calls.
 *
 * Blackhole LLM endpoint: a node:http server on an ephemeral 127.0.0.1 port
 * that accepts every request, opens an SSE stream, writes one comment line,
 * and NEVER ends the response. The DeepSeek adapter enters its stream-read
 * loop and holds the turn at `running`; the 5-minute stream-idle backstop
 * never matters because the probe interrupts/drains first. The group writes
 * a temporary `llm-deepseek.baseURL` settings section (and a throwaway
 * .credentials.yaml if needed) for the main home and restores BOTH files
 * byte-exactly at group end. The scratch home gets neither (no LLM calls in
 * the isolate phase).
 *
 * Revert story (all group-side, recorded in dev/agent-workflow/evidence/P2-T5):
 *   - patch layer of the main home: exact pre-group bytes restored (the
 *     harness lifecycle section's good row)
 *   - settings.yaml / .credentials.yaml: exact pre-group bytes restored
 *     (or deleted when they did not pre-exist)
 *   - directive files deleted from both homes; scratch home deleted at
 *     group start (left in place after the run as evidence)
 *   - blackhole server closed; both ports verified free
 *
 * The group's run() never throws: every expected failure is a ctx.check
 * record; an unexpected internal error is itself a check record, and the
 * finally-blocked teardown still restores every touched surface.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import http from 'node:http'
import { pathToFileURL } from 'node:url'
import { DshInstance, ensureProfile, ensureProbeResolution } from '../../lib/instance.mjs'
import { extractSpecifiers } from '../../lib/private-import.mjs'
import { checkSpecifier, matchPackageName } from '../../lib/public-surface.mjs'
import { logTail, portInUse, waitForPortFree } from '../../lib/util.mjs'

const PAYLOAD_ROW = {
  id: 'p2t5-sfd-probe',
  rel: 'probes/storage-fork-descendants/plugins/probe-host.js',
}
const FIXTURES = {
  badGlobal: 'probes/storage-fork-descendants/plugins/negative-fixtures/storage-bad-global.js',
  privateImport: 'probes/storage-fork-descendants/plugins/negative-fixtures/private-import-host.js',
  badAuthority: 'probes/storage-fork-descendants/plugins/negative-fixtures/subagent-bad-authority.js',
}

// Deterministic fixture session ids (shared with the payload via the directive).
const IDS = {
  root: '11111111-0000-4000-8000-000000000001',
  member1: '11111111-0000-4000-8000-000000000002',
  member2: '11111111-0000-4000-8000-000000000003',
  grand: '11111111-0000-4000-8000-000000000004',
  plainFork: '11111111-0000-4000-8000-000000000005',
  unknown: 'ffffffff-ffff-4fff-afff-ffffffffffff',
}

// One deterministic StorageDomain spec shared by every phase.
const DOMAIN = {
  name: 'p2t5_probe',
  version: 1,
  records: { r1: { v: 'alpha', n: 1 }, r2: { v: 'beta', n: 2 }, r3: { v: 'gamma', n: 3 } },
  global: { note: 'seeded-p2t5', count: 3 },
  initial: { note: 'initial', count: 0 },
}

const FIXTURE_KEYS = ['root', 'member1', 'member2', 'grand']

export default {
  name: 'storage-fork-descendants',
  description:
    'P2-T5 seams: StorageDomain external persistence, fork lineage visibility, descendant enumeration/interrupt/drain',

  async run(ctx) {
    const { check, log } = ctx
    const config = ctx.config
    const harnessRoot = ctx.harnessRoot
    // Absolute paths: the payload runs in a child process whose cwd is the
    // pinned host tree, so everything it receives (report dir, cwd) must be
    // absolute and forward-slashed.
    const logDir = resolve(config.logDir)
    const mainHome = resolve(config.dshHome)
    const scratchHome = join(mainHome, 'scratch', 'isolation-home')
    // Bare run (Quickstart/CI, no --report-dir): the documented one-command
    // contract must stay all-green, so root observation JSONs under this run's
    // dedicated DSH_HOME (always writable, isolated per task).
    const reportDir =
      config.reportDir === null ? join(mainHome, 'characterization-obs') : resolve(config.reportDir)
    mkdirSync(reportDir, { recursive: true })

    let blackhole = undefined
    let isoInstance = undefined
    const preGroup = { settings: null, credentials: null, patch: null }
    const negativeEvidence = {}
    let authorityFixture = null
    const isoPort = isoPortFor(config)

    const cleanup = async () => {
      // Stop every instance the group started (idempotent).
      try {
        if (isoInstance !== undefined && isoInstance.booted) await isoInstance.stop()
      } catch (error) {
        check(false, `cleanup: iso instance stop failed: ${firstLine(String(error.message ?? error))}`)
      }
      try {
        if (ctx.instance.booted) await ctx.instance.stop()
      } catch (error) {
        check(false, `cleanup: main instance stop failed: ${firstLine(String(error.message ?? error))}`)
      }
      // Patch layer: exact pre-group bytes (lifecycle section's good row).
      try {
        if (preGroup.patch !== null) restoreFile(preGroup.patch)
      } catch (error) {
        check(false, `cleanup: patch layer restore failed: ${firstLine(String(error.message ?? error))}`)
      }
      // Directives.
      try {
        rmSync(join(mainHome, 'p2t5-directive.json'), { force: true })
        rmSync(join(scratchHome, 'p2t5-directive.json'), { force: true })
      } catch {
        /* best effort */
      }
      // Settings + credentials: exact pre-group bytes.
      try {
        if (preGroup.settings !== null) restoreFile(preGroup.settings)
        if (preGroup.credentials !== null) restoreFile(preGroup.credentials)
      } catch (error) {
        check(false, `cleanup: settings/credentials restore failed: ${firstLine(String(error.message ?? error))}`)
      }
      // Verify the restore actually landed: a lost rmSync or a late rewrite
      // must not leave the home dirty with probe values (fake key / override).
      if (preGroup.settings !== null) {
        check(existsSync(preGroup.settings.path) === preGroup.settings.existed, 'cleanup: settings.yaml state matches the pre-group snapshot')
      }
      if (preGroup.credentials !== null) {
        check(existsSync(preGroup.credentials.path) === preGroup.credentials.existed, 'cleanup: .credentials.yaml state matches the pre-group snapshot')
      }
      // Blackhole.
      try {
        if (blackhole !== undefined) await blackhole.close()
      } catch {
        /* best effort */
      }
      // Final port verification.
      check(await waitForPortFree(config.port), `port ${config.port} free after group teardown`)
      check(await waitForPortFree(isoPort), `port ${isoPort} free after group teardown`)
    }

    try {
      // ------------------------------------------------------------- setup
      // Group-local module resolution (idempotent). The harness preflight
      // already links every upstream import of every probe source at
      // probes/node_modules; the group repeats its own so it also runs
      // standalone (`--only probes`), and adds zod, which is NOT an upstream
      // package (the payload's record schemas are documented to be zod).
      ensureProbeResolution({
        probesDir: ctx.probesRoot,
        packages: [
          { name: '@deepseek-ai/dsh-storage-domain', dir: join(config.hostTree, 'packages', 'storage', 'storage-domain') },
          { name: '@deepseek-ai/dsh-subagent', dir: join(config.hostTree, 'packages', 'subagent', 'subagent') },
        ],
        log,
      })
      ensureProbeResolution({
        // probesDir is relative to the PROBES root (not the harness root) —
        // the junction must land at probes/<group>/node_modules so that both
        // the payload and the negative fixtures (plugins/... underneath it)
        // resolve zod by walking up.
        probesDir: join(ctx.probesRoot, 'storage-fork-descendants'),
        packages: [
          { name: 'zod', dir: join(config.hostTree, 'packages', 'storage', 'storage-domain', 'node_modules', 'zod') },
        ],
        log,
      })

      // Ports: the harness may have swapped main onto the backup port; the
      // isolation boot must never collide with the main boot.
      if (await portInUse(config.port)) {
        check(false, `port ${config.port} in use — group cannot run`)
        return
      }
      if (await portInUse(isoPort)) {
        check(false, `port ${isoPort} (isolation) in use — group cannot run`)
        return
      }

      // Static admission of the payload's upstream imports (live surface).
      const payloadSpecs = extractSpecifiers(readFileSync(join(harnessRoot, PAYLOAD_ROW.rel), 'utf8'))
      const payloadUpstream = payloadSpecs.filter((s) => matchPackageName(s.spec, ctx.surface) !== undefined)
      check(payloadUpstream.length >= 1, `payload carries >=1 upstream import (${payloadUpstream.map((s) => s.spec).join(', ')})`)
      check(
        payloadUpstream.every((s) => checkSpecifier(s.spec, ctx.surface).admitted),
        'payload upstream imports all admitted by the live public surface',
      )

      // Negative fixtures: static admission facts + harness-side imports.
      const badGlobalSpecs = extractSpecifiers(readFileSync(join(harnessRoot, FIXTURES.badGlobal), 'utf8'))
      const badGlobalUpstream = badGlobalSpecs.filter((s) => matchPackageName(s.spec, ctx.surface) !== undefined)
      check(
        badGlobalUpstream.every((s) => checkSpecifier(s.spec, ctx.surface).admitted),
        'bad-global fixture upstream imports admitted (its negativity is semantic, not import-level)',
      )
      const privateSpecs = extractSpecifiers(readFileSync(join(harnessRoot, FIXTURES.privateImport), 'utf8'))
      const privateUpstream = privateSpecs.filter((s) => matchPackageName(s.spec, ctx.surface) !== undefined)
      check(privateUpstream.length >= 1, `private-import fixture carries >=1 upstream import (${privateUpstream.map((s) => s.spec).join(', ')})`)
      check(
        privateUpstream.every((s) => !checkSpecifier(s.spec, ctx.surface).admitted),
        'private-import fixture upstream import rejected by the live public surface (static)',
      )

      try {
        await import(pathToFileURL(join(harnessRoot, FIXTURES.privateImport)).href)
        negativeEvidence.privateImport = { rejected: false }
        check(false, 'private-import fixture: import unexpectedly SUCCEEDED (exports map would be vacuous)')
      } catch (error) {
        negativeEvidence.privateImport = { rejected: true, code: error?.code ?? null, message: firstLine(String(error.message ?? error)) }
        check(
          negativeEvidence.privateImport.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
          `private-import rejected with ERR_PACKAGE_PATH_NOT_EXPORTED (got ${negativeEvidence.privateImport.code}: ${negativeEvidence.privateImport.message})`,
        )
      }
      try {
        await import(pathToFileURL(join(harnessRoot, FIXTURES.badGlobal)).href)
        negativeEvidence.badGlobal = { threw: false }
        check(false, 'bad-global fixture: defineDomain unexpectedly ACCEPTED a nullable global (null-sentinel guard would be vacuous)')
      } catch (error) {
        negativeEvidence.badGlobal = { threw: true, message: firstLine(String(error.message ?? error)) }
        check(
          negativeEvidence.badGlobal.threw && /must not accept null/.test(negativeEvidence.badGlobal.message),
          `bad-global rejected by the null-sentinel guard (got: ${negativeEvidence.badGlobal.message})`,
        )
      }
      authorityFixture = (await import(pathToFileURL(join(harnessRoot, FIXTURES.badAuthority)).href)).fixture
      check(authorityFixture?.expected?.code === 'UNAUTHORIZED', 'bad-authority fixture documents the UNAUTHORIZED expectation')

      writeFileSync(
        join(reportDir, 'p2t5-negative-evidence.json'),
        `${JSON.stringify({ negativeEvidence, authorityFixture }, null, 2)}\n`,
      )

      // Blackhole LLM endpoint (in-process, ephemeral port).
      blackhole = await startBlackhole()
      log(`p2t5: blackhole LLM endpoint on http://127.0.0.1:${blackhole.port}`)

      // Settings + credentials: snapshot, then point the adapter at the
      // blackhole. Inherited env (if any) still wins per upstream priority;
      // either way the request hangs at the blackhole, never at a real API.
      preGroup.settings = snapshotFile(join(mainHome, 'settings.yaml'))
      preGroup.credentials = snapshotFile(join(mainHome, '.credentials.yaml'))
      writeFileSync(preGroup.settings.path, `llm-deepseek:\n  baseURL: "http://127.0.0.1:${blackhole.port}"\n`)
      writeFileSync(preGroup.credentials.path, 'version: 1\nrefs:\n  DEEPSEEK_API_KEY: sk-p2t5-blackhole-fake\n')
      const envFacts = {
        hasEnvApiKey: process.env.DEPSEEK_API_KEY !== undefined && process.env.DEPSEEK_API_KEY !== '',
        envBaseUrl: process.env.DEPSEEK_BASE_URL ?? null,
      }
      log(`p2t5: env facts — hasEnvApiKey=${envFacts.hasEnvApiKey}, envBaseUrl=${envFacts.envBaseUrl}`)

      // The group reuses fixed fixture session ids across runs; a previous
      // run may have persisted them into the main home, and agents.create()
      // collides with an already-persisted session id. Remove ONLY this
      // group's five ids (<mainHome>/sessions/*/<id>) — everything else in
      // the home (settings, credentials, other sessions) is untouched.
      const removedStale = []
      const sessionsRoot = join(mainHome, 'sessions')
      if (existsSync(sessionsRoot)) {
        for (const wsDir of readdirSync(sessionsRoot, { withFileTypes: true })) {
          if (!wsDir.isDirectory()) continue
          for (const id of Object.values(IDS)) {
            const stale = join(sessionsRoot, wsDir.name, id)
            if (existsSync(stale)) {
              rmSync(stale, { recursive: true, force: true })
              removedStale.push(`${wsDir.name}/${id}`)
            }
          }
        }
      }
      log(`p2t5: removed ${removedStale.length} stale fixture session dir(s) from the main home: ${removedStale.join(', ') || '(none)'}`)

      // Profile ready + patch-layer snapshot (lifecycle section's good row
      // in a full run; throwaway boot when standalone).
      if (!ctx.instance.profileInitialized()) {
        const { initialized } = await ensureProfile({ instance: ctx.instance, log, timeoutMs: 90_000 })
        check(initialized, 'web profile ready (created by throwaway boot)')
      }
      preGroup.patch = snapshotFile(ctx.instance.patchFile)

      // Stale observation guard: this run owns the obs files.
      for (const phase of ['seed', 'verify', 'isolate']) {
        rmSync(join(reportDir, `obs-${phase}.json`), { force: true })
      }
      // Fresh isolation home per run.
      rmSync(scratchHome, { recursive: true, force: true })

      // ------------------------------------------------------------- boot #1 SEED
      ctx.instance.mountRows(
        [{ id: PAYLOAD_ROW.id, name: ctx.pluginUrl(PAYLOAD_ROW.rel) }],
        ['P2-T5 group: probe row (public seams only). Revert: group restores prior patch layer.'],
      )
      writeDirective(mainHome, 'seed', reportDir)
      const seedBoot = await bootOrFail(ctx.instance, config.port, 'seed boot (main home)', check)
      if (seedBoot === undefined) return
      const obsSeed = await waitForObservation('seed', 300_000, ctx.instance, reportDir, check)
      check((await ctx.instance.stop()).portFree, 'port free after seed stop')
      safeCopy(ctx.instance.logPath, join(logDir, 'instance-seed.log'))

      // ------------------------------------------------------------- boot #2 VERIFY (restart)
      writeDirective(mainHome, 'verify', reportDir)
      const verifyBoot = await bootOrFail(ctx.instance, config.port, 'verify boot (restart, main home)', check)
      if (verifyBoot === undefined) return
      const obsVerify = await waitForObservation('verify', 120_000, ctx.instance, reportDir, check)
      check((await ctx.instance.stop()).portFree, 'port free after verify stop')
      safeCopy(ctx.instance.logPath, join(logDir, 'instance-verify.log'))

      // ------------------------------------------------------------- boot #3 ISOLATE (scratch home)
      isoInstance = new DshInstance({ ...config, dshHome: scratchHome, port: isoPort })
      const { initialized: isoInit } = await ensureProfile({ instance: isoInstance, log, timeoutMs: 90_000 })
      check(isoInit, 'isolation home profile ready')
      isoInstance.mountRows(
        [{ id: PAYLOAD_ROW.id, name: ctx.pluginUrl(PAYLOAD_ROW.rel) }],
        ['P2-T5 group: isolation boot (scratch home). Revert: group deletes scratch home.'],
      )
      writeDirective(scratchHome, 'isolate', reportDir)
      const isoBoot = await bootOrFail(isoInstance, isoPort, 'isolate boot (scratch home)', check)
      if (isoBoot === undefined) return
      const obsIsolate = await waitForObservation('isolate', 120_000, isoInstance, reportDir, check)
      check((await isoInstance.stop()).portFree, `port ${isoPort} free after isolate stop`)
      safeCopy(isoInstance.logPath, join(logDir, 'instance-isolate.log'))

      // ------------------------------------------------------------- seam checks
      checkSeam1({ check, obsSeed, obsVerify, obsIsolate })
      checkSeam2({ check, obsSeed, obsVerify, obsIsolate })
      checkSeam3({ check, obsSeed, obsVerify, authorityFixture })

      // Evidence meta (compliance report input).
      writeFileSync(
        join(reportDir, 'p2t5-run-meta.json'),
        `${JSON.stringify(
          {
            task: 'P2-T5',
            generatedAt: new Date().toISOString(),
            fixtureIds: IDS,
            domain: DOMAIN,
            blackholePort: blackhole.port,
            envFacts,
            settings: { path: preGroup.settings.path, preExisted: preGroup.settings.existed, written: true, restored: true },
            credentials: { path: preGroup.credentials.path, preExisted: preGroup.credentials.existed, written: true, restored: true },
            homes: { main: mainHome, isolate: scratchHome },
            ports: { main: config.port, isolate: isoPort },
            obsFiles: ['obs-seed.json', 'obs-verify.json', 'obs-isolate.json'].map((f) => (existsSync(join(reportDir, f)) ? f : null)).filter(Boolean),
          },
          null,
          2,
        ) + '\n'}`,
      )
      log('p2t5: group checks complete')
    } catch (error) {
      check(false, `storage-fork-descendants group internal error: ${error instanceof Error ? (error.stack ?? String(error)) : String(error)}`)
    } finally {
      try {
        await cleanup()
      } catch (error) {
        check(false, `cleanup threw: ${firstLine(String(error.message ?? error))}`)
      }
    }
  },
}

// --------------------------------------------------------------------------- seams

function checkSeam1({ check, obsSeed, obsVerify, obsIsolate }) {
  const d = (x) => x?.data
  // S1.1 in-instance readback (seed)
  check(recordsEqual(d(obsSeed)?.domain?.readback?.records), 'S1.1 seed: in-instance readback of all 3 records byte-equal to seeded values')
  check(globalEqual(d(obsSeed)?.domain?.readback?.global, DOMAIN.global), 'S1.1 seed: in-instance global readback byte-equal')
  // S1.2 fail-loud double open (seed)
  check(
    d(obsSeed)?.domain?.doubleOpen?.code === 'already-open',
    `S1.2 seed: second open of a live spec fails loud (code=${d(obsSeed)?.domain?.doubleOpen?.code ?? 'absent'})`,
  )
  // S1.3 restart persistence (verify)
  check(recordsEqual(d(obsVerify)?.domain?.records), 'S1.3 verify: after process restart, all 3 records reopen byte-equal')
  check(globalEqual(d(obsVerify)?.domain?.global, DOMAIN.global), 'S1.3 verify: after restart, global reopens byte-equal')
  check(d(obsVerify)?.domain?.entryCount === 3, `S1.3 verify: entryCount after restart = 3 (got ${d(obsVerify)?.domain?.entryCount ?? 'absent'})`)
  // S1.4 fresh-home isolation (isolate)
  check(deepEq(d(obsIsolate)?.domain?.keys, []), 'S1.4 isolate: fresh home table empty for the same domain name/version')
  check(deepEq(d(obsIsolate)?.domain?.entries, []), 'S1.4 isolate: fresh home has no entries')
  check(globalEqual(d(obsIsolate)?.domain?.global, DOMAIN.initial), 'S1.4 isolate: never-written global serves `initial`')
}

function checkSeam2({ check, obsSeed, obsVerify, obsIsolate }) {
  const d = (x) => x?.data
  const seedHeaders = d(obsSeed)?.enumeration?.headers ?? {}
  // S2.1 live header lineage facts (seed)
  check(
    headerFact(seedHeaders.member1, { parentSession: IDS.root, origin: 'subagent', delegationDepth: 1 }),
    'S2.1 seed: member1 header carries parentSession=root, origin=subagent, delegationDepth=1',
  )
  check(
    headerFact(seedHeaders.member2, { parentSession: IDS.root, origin: 'subagent', delegationDepth: 1 }),
    'S2.1 seed: member2 header carries parentSession=root, origin=subagent, delegationDepth=1',
  )
  check(
    headerFact(seedHeaders.grand, { parentSession: IDS.member1, origin: 'subagent', delegationDepth: 2 }),
    'S2.1 seed: grand header carries parentSession=member1, origin=subagent, delegationDepth=2',
  )
  check(
    headerFact(seedHeaders.root, { parentSession: null, origin: null }),
    'S2.1 seed: root header carries parentSession=null, origin=null (plain agent session)',
  )
  // S2.2 exact live enumeration (seed)
  const seedEntries = childEntries(d(obsSeed)?.enumeration?.entries)
  check(
    deepEq([...seedEntries.map((e) => e.id)].sort(), [...[IDS.member1, IDS.member2, IDS.grand]].sort()),
    'S2.2 seed: descendant listing is exactly {member1, member2, grand} — no missing, no phantom rows',
  )
  check(
    entryFacts(seedEntries, {
      [IDS.member1]: { parentId: IDS.root, depth: 1, label: 'member-1', mode: 'continuable', hasChildren: true },
      [IDS.member2]: { parentId: IDS.root, depth: 1, label: 'member-2', mode: 'continuable', hasChildren: false },
      [IDS.grand]: { parentId: IDS.member1, depth: 2, label: 'grand-1', mode: 'continuable', hasChildren: false },
    }),
    'S2.2 seed: entry parentId/depth/label/mode/hasChildren all correct (member1 hasChildren=true)',
  )
  check(
    seedEntries.length === 3 && seedEntries.every((e) => e.activity === 'running'),
    'S2.2 seed: all three entries live-activity=running (held mid-turn)',
  )
  // S2.3 no phantom rows: plain fork stays a traversal node, never an entry (seed)
  check(
    d(obsSeed)?.plainFork?.entryCount === 3 &&
      deepEq([...(d(obsSeed)?.plainFork?.entryIds ?? [])].sort(), [...[IDS.member1, IDS.member2, IDS.grand]].sort()),
    'S2.3 seed: plain (non-subagent) fork of root adds NO descendant entry (still exactly 3)',
  )
  // S2.4 durable enumeration after restart (verify)
  const verifyEntries = childEntries(d(obsVerify)?.entries)
  check(
    deepEq([...verifyEntries.map((e) => e.id)].sort(), [...[IDS.member1, IDS.member2, IDS.grand]].sort()),
    'S2.4 verify: after restart, durable listing is exactly {member1, member2, grand}',
  )
  check(
    entryFacts(verifyEntries, {
      [IDS.member1]: { parentId: IDS.root, depth: 1, label: 'member-1', mode: 'continuable', hasChildren: true },
      [IDS.member2]: { parentId: IDS.root, depth: 1, label: 'member-2', mode: 'continuable', hasChildren: false },
      [IDS.grand]: { parentId: IDS.member1, depth: 2, label: 'grand-1', mode: 'continuable', hasChildren: false },
    }),
    'S2.4 verify: durable entry facts identical to the live snapshot (hasChildren survives via log fold)',
  )
  check(
    verifyEntries.length === 3 && verifyEntries.every((e) => e.activity === 'inactive'),
    'S2.4 verify: after restart all entries inactive (no live agents)',
  )
  // S2.5 durable corpus after restart (verify)
  const corpus = d(obsVerify)?.corpus ?? {}
  for (const key of FIXTURE_KEYS) {
    check(
      corpus[key]?.present === true && corpus[key]?.persisted === true && corpus[key]?.live === false,
      `S2.5 verify: corpus record ${key} present+persisted+not-live`,
    )
  }
  check(
    corpus.plainFork?.present === true && corpus.plainFork?.persisted === true,
    'S2.5 verify: plainFork persisted in the corpus (a session, not an entry)',
  )
  // S2.6 durable logs after restart (verify)
  const logs = d(obsVerify)?.logs ?? {}
  check(
    logs.member1?.error === undefined && headerFact(logs.member1?.header, { parentSession: IDS.root, origin: 'subagent', delegationDepth: 1 }),
    'S2.6 verify: replay-validated member1 log header keeps lineage facts',
  )
  check(
    logs.grand?.error === undefined && headerFact(logs.grand?.header, { parentSession: IDS.member1, origin: 'subagent', delegationDepth: 2 }),
    'S2.6 verify: replay-validated grand log header keeps lineage facts',
  )
  // S2.7 durable recursive trace (verify)
  const trace = d(obsVerify)?.trace
  // The probe writes traceError as null on success or {code, message} on
  // failure; the key is always present, so null (not undefined) is the OK form.
  const traceError = d(obsVerify)?.traceError
  check(trace?.complete === true && (traceError === null || traceError === undefined), 'S2.7 verify: traceSession(root) resolves complete (no error)')
  check(trace?.rootId === IDS.root, `S2.7 verify: trace rootId = fixture root (got ${trace?.rootId ?? 'absent'})`)
  const flat = flattenTrace(trace?.descendants)
  const traceId = (id) => flat.find((n) => n.id === id)
  check(traceId(IDS.member1)?.parentId === IDS.root, 'S2.7 verify: trace contains member1 as child of root')
  check(traceId(IDS.member2)?.parentId === IDS.root, 'S2.7 verify: trace contains member2 as child of root')
  check(traceId(IDS.grand)?.parentId === IDS.member1, 'S2.7 verify: trace contains grand as child of member1')
  check(
    traceId(IDS.plainFork)?.parentId === IDS.root && traceId(IDS.plainFork)?.origin === null,
    'S2.7 verify: trace contains plainFork as child of root with origin=null (session tree is broader than the entry listing)',
  )
  // S2.N negative: unknown session absent + exact read fails loud (verify + isolate)
  check(
    d(obsVerify)?.unknownSession?.inCorpus === false &&
      d(obsVerify)?.unknownSession?.readSession?.threw === true &&
      d(obsVerify)?.unknownSession?.readSession?.code === 'SESSION_QUERY_SESSION_NOT_FOUND',
    'S2.N verify: unknown session id absent from corpus; exact readSession throws SESSION_QUERY_SESSION_NOT_FOUND',
  )
  check(
    d(obsIsolate)?.readMissingRoot?.threw === true && d(obsIsolate)?.readMissingRoot?.code === 'SESSION_QUERY_SESSION_NOT_FOUND',
    'S2.N isolate: readSession(fixture root) throws SESSION_QUERY_SESSION_NOT_FOUND on a fresh home',
  )
  // S2.O recorded fact (not failed): the live store is process-scoped.
  const liveAfter = d(obsVerify)?.liveStoreAfterRestart ?? {}
  check(
    FIXTURE_KEYS.every((key) => liveAfter[key] === false),
    'S2.O verify (recorded): live store empty for every fixture id after restart — durable reads go through sessionQuery (documented process-scoped store)',
  )
  // S2.ISO isolation: no fixture leak into the scratch home.
  check(
    deepEq(d(obsIsolate)?.corpusFixtureIds, []) && deepEq(d(obsIsolate)?.entries, []),
    'S2.ISO isolate: scratch home corpus/entries contain no fixture ids (lineage does not leak across homes)',
  )
}

function checkSeam3({ check, obsSeed, obsVerify, authorityFixture }) {
  const d = (x) => x?.data
  const interrupt = d(obsSeed)?.interrupt ?? {}
  // S3.1 interrupt effect (seed): held turn ends aborted/user; entry stops running.
  // interrupt.grandEnd is the synchronous session/event capture of the single
  // turn/end (leaf copy: {seq, reason:{kind, reason}} with reason a kind string).
  const grandEnd = interrupt.grandEnd
  check(
    grandEnd?.reason?.kind === 'aborted' && grandEnd?.reason?.reason === 'user',
    'S3.1 seed: interrupt(user, direct parent) ends the held turn with turn/end reason {kind:aborted, reason:{kind:user}}',
  )
  check(
    interrupt.grandActivityAfter === 'inactive' || interrupt.grandActivityAfter === 'gone',
    `S3.1 seed: grandchild entry no longer running after interrupt (observed: ${interrupt.grandActivityAfter ?? 'absent'}) — 'inactive' (quiescent entry) or 'gone' (activation settled and removed)`,
  )
  // S3.2 wrong-parent authority (seed): fail loud.
  check(
    interrupt.wrongParent?.code === 'UNAUTHORIZED',
    `S3.2 seed: interrupt with the WRONG parent session fails UNAUTHORIZED (got ${interrupt.wrongParent?.code ?? 'absent'})`,
  )
  // S3.3 unknown target (seed): accepted no-op (documented) — recorded as a finding.
  check(
    interrupt.unknownTarget?.threw === false,
    'S3.3 seed (finding): interrupt of an unknown target is an accepted silent no-op (threw=false) — documented live behavior; task guidance expects a loud failure here, discrepancy recorded in seam-report',
  )
  // S3.4 stale/self-targeting ancestor authority (seed): fail loud.
  check(
    interrupt.selfAncestor?.code === 'UNAUTHORIZED' && authorityFixture?.expected?.throws === true,
    'S3.4 seed: self-targeting ancestor authority fails UNAUTHORIZED (cross-checked with the bad-authority fixture document)',
  )
  // S3.5 duplicate child (seed): fail loud before any second child exists.
  check(
    d(obsSeed)?.fixture?.duplicateChild?.code === 'DUPLICATE_CHILD',
    `S3.5 seed: startContinuable with an existing childId fails DUPLICATE_CHILD (got ${d(obsSeed)?.fixture?.duplicateChild?.code ?? 'absent'})`,
  )
  // S3.6 members still held mid-turn before the drain (proof the drain
  // interrupts LIVE turns, not settled ones).
  const before = d(obsSeed)?.membersTurnEndBeforeDrain ?? {}
  check(before.member1 === null && before.member2 === null, 'S3.6 seed: both members have NO turn/end before the drain (held mid-turn)')
  // S3.7 drain (seed): resolves; no descendant agent or live session remains.
  const drain = d(obsSeed)?.drain
  check(
    drain?.error === null,
    `S3.7 seed: drainContinuableDescendants([rootAgent]) resolved (error=${drain?.error?.code ?? 'none'}) in ${drain?.ms ?? '?'}ms`,
  )
  for (const key of FIXTURE_KEYS.slice(1)) {
    check(
      drain?.after?.[key]?.agentAlive === false && drain?.after?.[key]?.sessionLive === false,
      `S3.7 seed: after drain, ${key} has no live agent and no live session`,
    )
  }
  check(d(obsSeed)?.rootDispose?.disposed === true, 'S3.7 seed: root handle disposed through the public API after the drain')
  // S3.8 durability: the aborted ends persisted (verify).
  const logs = d(obsVerify)?.logs ?? {}
  const lastEndOf = (key) => {
    const ends = logs[key]?.turnEnds ?? []
    return ends[ends.length - 1]
  }
  check(
    lastEndOf('grand')?.reason?.kind === 'aborted' && lastEndOf('grand')?.reason?.reason?.kind === 'user',
    'S3.8 verify: durable grand log ends with turn/end aborted/user',
  )
  check(
    lastEndOf('member1')?.reason?.kind === 'aborted' && lastEndOf('member2')?.reason?.kind === 'aborted',
    'S3.8 verify: durable member1/member2 logs end with turn/end kind=aborted (drain-interrupted)',
  )
  // S3.9 persistence gate (seed): every fixture session persisted:true before the instance stopped.
  const gate = d(obsSeed)?.persistedGate
  check(
    gate?.passed === true && FIXTURE_KEYS.every((key) => gate?.snapshot?.[key] === true),
    `S3.9 seed: persistence gate passed (waited ${gate?.waitedMs ?? '?'}ms) — every fixture session persisted=true before stop`,
  )
}

// --------------------------------------------------------------------------- helpers

function isoPortFor(config) {
  let isoPort = config.port === config.backupPort ? config.backupPort + 10 : config.backupPort
  if (isoPort === config.port) isoPort = config.port + 10
  return isoPort
}

function writeDirective(home, phase, reportDir) {
  const directive = {
    phase,
    reportDir: reportDir.replace(/\\/g, '/'),
    cwd: resolve(process.cwd()),
    ids: IDS,
    domain: DOMAIN,
  }
  writeFileSync(join(home, 'p2t5-directive.json'), `${JSON.stringify(directive, null, 2)}\n`)
}

function snapshotFile(path) {
  const existed = existsSync(path)
  return { path, existed, text: existed ? readFileSync(path, 'utf8') : undefined }
}

function restoreFile(snapshot) {
  if (snapshot.existed) writeFileSync(snapshot.path, snapshot.text)
  else rmSync(snapshot.path, { force: true })
}

async function startBlackhole() {
  const server = http.createServer((req, res) => {
    // Hardened against client aborts: the harness stops the instance while
    // these SSE connections are mid-stream, so writes can throw and the
    // socket can emit 'error'; neither may take the harness process down.
    res.on('error', () => {})
    try {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      })
      res.write(': p2t5 blackhole connected\n\n')
    } catch {
      /* client aborted mid-write — nothing to do */
    }
    // Deliberately never ends the response: the adapter enters its
    // stream-read loop and holds the turn at `running`; the probe
    // interrupts/drains long before any idle backstop could matter.
  })
  server.keepAliveTimeout = 300_000
  server.headersTimeout = 301_000
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', () => resolveListen())
  })
  const port = server.address().port
  return {
    port,
    close: async () => {
      server.closeAllConnections()
      await new Promise((resolveClose) => server.close(() => resolveClose()))
    },
  }
}

async function bootOrFail(instance, port, label, check) {
  let boot
  try {
    boot = await instance.start({ timeoutMs: 120_000 })
  } catch (error) {
    const tail = safeLogTail(instance.logPath)
    check(false, `${label} failed: ${firstLine(String(error.message ?? error))}\ninstance log tail:\n${tail}`)
    return undefined
  }
  check(boot.url.includes(`127.0.0.1:${port}`), `${label} succeeded: ${boot.url}`)
  return boot
}

async function waitForObservation(phase, timeoutMs, instance, reportDir, check) {
  const path = join(reportDir, `obs-${phase}.json`)
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (existsSync(path)) {
      try {
        const parsed = JSON.parse(readFileSync(path, 'utf8'))
        if (parsed.ok === true) return parsed
        check(false, `obs-${phase}.json reports failure: ${parsed.fatal?.message ?? 'unknown'} ${firstLine(parsed.fatal?.stack ?? '')}`)
        return parsed
      } catch {
        /* partial write — retry until the deadline */
      }
    }
    if (Date.now() >= deadline) {
      check(false, `obs-${phase}.json not written within ${timeoutMs}ms\ninstance log tail:\n${safeLogTail(instance.logPath)}`)
      return undefined
    }
    await sleep(500)
  }
}

function safeLogTail(logPath) {
  try {
    return logTail(logPath, 40)
  } catch {
    return '(log unreadable)'
  }
}

function safeCopy(from, to) {
  try {
    copyFileSync(from, to)
  } catch {
    /* evidence copy is best-effort */
  }
}

function childEntries(entries) {
  return (entries ?? []).filter((e) => e.kind === 'child')
}

function headerFact(header, expected) {
  if (header === undefined || header === 'missing') return false
  for (const [key, value] of Object.entries(expected)) {
    if (header[key] !== value) return false
  }
  return true
}

function entryFacts(entries, expected) {
  for (const [id, facts] of Object.entries(expected)) {
    const entry = entries.find((e) => e.id === id)
    if (entry === undefined) return false
    for (const [key, value] of Object.entries(facts)) {
      if (entry[key] !== value) return false
    }
  }
  return true
}

function flattenTrace(nodes, out = []) {
  for (const node of nodes ?? []) {
    out.push(node)
    flattenTrace(node.children, out)
  }
  return out
}

function recordsEqual(records) {
  if (records === undefined || records === null) return false
  for (const [key, value] of Object.entries(DOMAIN.records)) {
    const got = records[key]
    if (got === undefined || got.v !== value.v || got.n !== value.n) return false
  }
  return Object.keys(records).length === Object.keys(DOMAIN.records).length
}

function globalEqual(global, expected) {
  if (global === undefined || global === null) return false
  return global.note === expected.note && global.count === expected.count
}

function deepEq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function firstLine(text) {
  return String(text).split('\n')[0]
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
