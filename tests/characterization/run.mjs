#!/usr/bin/env node
/**
 * P2-T1 — pristine characterization harness, single entry point.
 *
 * One command runs the whole self-test against the pinned pristine upstream
 * tree (TEST_METHODS §1/§2):
 *
 *   node tests/characterization/run.mjs [--report-dir <dir>]
 *                                       [--host-tree <dir>] [--dsh-home <dir>]
 *                                       [--port <n>] [--backup-port <n>]
 *                                       [--only <section>] [--fixture-write]
 *
 * Sections (all must pass; exit 0 = all green, 1 = any failure, 2 = usage or
 * internal error):
 *   preflight   node version, tree present, port selection, DSH_HOME ready,
 *               test-use tree PRISTINE at start (git status --porcelain
 *               empty), probe-resolution links ready
 *   surface     public exports whitelist builds; key seam packages present;
 *               positive/negative subpath admission spot checks
 *   fixture     fixtures/host-version.json consistent with the live tree
 *               (pinned SHA + per-package surface fingerprint = pin-drift
 *               protection); --fixture-write regenerates it (clean tree only)
 *   static      private-import negative test (C4-equivalent): harness source
 *               has zero bare/non-node: imports; the good probe passes the
 *               live whitelist; the bad probe is DETECTED and rejected
 *   lifecycle   instance startable (boot marker), dump-config shows the
 *               mounted row in the composed tree, instance stoppable (port
 *               freed)
 *   probes      every discovered probe group runs (smoke = the full chain
 *               incl. the runtime private-import rejection + recovery)
 *   byte-clean  test-use tree still pristine after everything (git status
 *               --porcelain empty + git diff empty + HEAD unchanged)
 *
 * Sandbox note: every child process (DSH instance, dump-config, git) is
 * spawned with FILE-FD stdio — an fs.openSync() fd as the stdio entry — the
 * only spawn mechanism the workspace-write sandbox allows (spawn-probe.mjs
 * P1: piped-stdio spawn → EPERM; P2/P4: file-fd spawn of node and git works).
 * One `node run.mjs` therefore drives the instance lifecycle AND the exact
 * git byte-clean commands in-process.
 *
 * Allowed imports of the harness itself: node: builtins only — enforced by
 * the strict static scan below and independently by scripts/verify-zero-core
 * .mjs C4 over the harness source (exit 0 required; see README and evidence).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { relative, sep, join } from 'node:path'
import {
  createHarnessContext,
  discoverProbeGroups,
  harnessRoot,
  resolveConfig,
} from './lib/harness-core.mjs'
import { buildFixture, diffSurface, loadFixture, writeFixture } from './lib/fixture.mjs'
import { DshInstance, ensureProfile, ensureProbeResolution } from './lib/instance.mjs'
import { extractSpecifiers, scanDirectory, scanFileSpecifiers } from './lib/private-import.mjs'
import { buildPublicSurface, checkSpecifier, matchPackageName } from './lib/public-surface.mjs'
import { captureGitState } from './lib/tree-clean.mjs'
import { portInUse, walk } from './lib/util.mjs'

const SECTIONS = ['preflight', 'surface', 'fixture', 'static', 'lifecycle', 'probes', 'byte-clean']
const PROBE_SOURCE_EXTS = new Set(['.js', '.mjs', '.cjs'])

function usage() {
  console.error('usage: node tests/characterization/run.mjs [options]')
  console.error('  --host-tree <dir>      pinned upstream tree (default: <team>/references/deepseek-harness-test-use)')
  console.error('  --dsh-home <dir>       dedicated DSH_HOME (default: <team>/references/.dsh-test-p2t1)')
  console.error('  --port <n>             primary port (default 3281)')
  console.error('  --backup-port <n>      fallback port (default 3291)')
  console.error('  --report-dir <dir>     evidence directory for logs + summary.json')
  console.error(`  --only <section>       run a single section: ${SECTIONS.join('|')}`)
  console.error('  --fixture-write        regenerate fixtures/host-version.json from the live tree (deliberate pin move only)')
  process.exit(2)
}

/** Every probe plugin source file under probes/ (skips node_modules links). */
function probeSourceFiles(probesRoot) {
  const out = []
  for (const item of walk(probesRoot, ['node_modules'])) {
    const ext = item.path.slice(item.path.lastIndexOf('.'))
    if (PROBE_SOURCE_EXTS.has(ext)) out.push(item.path)
  }
  return out.sort()
}

/** Upstream package names the probe sources import (for resolution links). */
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

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) usage()
  const { config, args } = resolveConfig(argv)
  if (args._.length > 0) {
    console.error(`unknown argument(s): ${args._.join(' ')}`)
    usage()
  }
  if (config.only !== undefined && !SECTIONS.includes(config.only)) {
    console.error(`unknown section: ${config.only}`)
    usage()
  }
  // The client commit hash the launch chain needs (TEST_METHODS §2). Pinned
  // with the fixture; overridable for a future pin move.
  config.clientCommitHash = process.env.CH_CLIENT_COMMIT_HASH ?? 'cd5ef814'

  // Port selection happens BEFORE the harness context: DshInstance fixes its
  // log path from config.port at construction time.
  if (await portInUse(config.port)) {
    console.log(`[pre] port ${config.port} busy — falling back to backup port ${config.backupPort}`)
    config.port = config.backupPort
  }
  if (config.reportDir !== null) mkdirSync(config.reportDir, { recursive: true })
  const ctx = createHarnessContext(config)
  const { log, check } = ctx
  const cfg = config

  log(`harness root : ${harnessRoot}`)
  log(`host tree    : ${cfg.hostTree}`)
  log(`dsh home     : ${cfg.dshHome}`)
  log(`client hash  : ${cfg.clientCommitHash}`)
  log(`port         : ${cfg.port} (backup ${cfg.backupPort})`)
  log(`node         : ${process.version} (pid ${process.pid})`)

  // ---------------------------------------------------------------- preflight
  if (cfg.only === undefined || cfg.only === 'preflight') {
    log('=== section: preflight ===')
    check(existsSync(join(cfg.hostTree, 'apps', 'cli', 'lib', 'bin.js')), 'built upstream CLI entry present (apps/cli/lib/bin.js)')
    check(existsSync(join(harnessRoot, 'probes', 'smoke', 'plugins', 'good-host.js')), 'good probe plugin present')
    check(existsSync(join(harnessRoot, 'probes', 'smoke', 'plugins', 'negative-fixtures', 'bad-host.js')), 'bad probe plugin present')
    check(!(await portInUse(cfg.port)), `port ${cfg.port} free at start`)
    mkdirSync(cfg.dshHome, { recursive: true })
    const startState = await captureGitState(cfg.hostTree, cfg.logDir)
    ctx.gitStart = startState
    if (startState.errors.length > 0) {
      check(false, `git snapshot unavailable: ${startState.errors.join('; ')}`)
    } else {
      check(startState.statusEmpty, 'test-use tree PRISTINE at start (git status --porcelain empty)')
      log(`  (HEAD=${startState.head} via ${startState.headSource})`)
    }
    // Public surface (whitelist) — built once here and shared by every later
    // section; probe resolution links need the package dirs from it.
    const surface = buildPublicSurface(cfg.hostTree)
    cfg.surface = surface
    ctx.surface = surface
    check(surface.size >= 200, `public surface built over ${surface.size} packages (>=200 for the pinned monorepo)`)
    const probePackages = probePackageDirs(ctx.probesRoot, surface)
    check(probePackages.length >= 1, `probe sources import ${probePackages.length} upstream package(s): ${probePackages.map((p) => p.name).join(', ')}`)
    ensureProbeResolution({ probesDir: ctx.probesRoot, packages: probePackages, log: (m) => log(`  ${m}`) })
  }

  // ------------------------------------------------------------------- surface
  if (cfg.only === undefined || cfg.only === 'surface') {
    log('=== section: surface ===')
    const surface = ctx.surface ?? buildPublicSurface(cfg.hostTree)
    ctx.surface = surface
    cfg.surface = surface
    for (const name of ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-util-crypto']) {
      check(surface.has(name), `whitelist contains key seam package ${name}`)
    }
    check(checkSpecifier('@deepseek-ai/dsh-util-crypto', surface).admitted, 'public root of @deepseek-ai/dsh-util-crypto admitted')
    const privateCheck = checkSpecifier('@deepseek-ai/dsh-util-crypto/internal/random', surface)
    check(!privateCheck.admitted, `private subpath ./internal/random NOT admitted (${privateCheck.reason})`)
  }

  // ------------------------------------------------------------------- fixture
  if (cfg.only === undefined || cfg.only === 'fixture') {
    log('=== section: fixture ===')
    const surface = ctx.surface ?? buildPublicSurface(cfg.hostTree)
    ctx.surface = surface
    const state = ctx.gitStart ?? (await captureGitState(cfg.hostTree, cfg.logDir))
    if (cfg.fixtureWrite) {
      if (state.errors.length > 0 || !state.statusEmpty) {
        check(false, 'fixture regeneration refused: tree not pristine (clean it first — a fixture must fingerprint a pristine pin)')
      } else {
        const fixture = buildFixture({ upstreamSha: state.head, hostTree: cfg.hostTree })
        writeFixture(cfg.fixturePath, fixture)
        check(true, `fixture regenerated: ${cfg.fixturePath} (sha=${state.head}, ${fixture.packageCount} packages)`)
      }
    } else {
      let fixture
      try {
        fixture = loadFixture(cfg.fixturePath)
      } catch (error) {
        check(false, `fixture unreadable: ${error.message}`)
      }
      if (fixture !== undefined) {
        check(
          state.head !== undefined && state.head === fixture.upstreamSha,
          `pinned SHA matches live HEAD (fixture=${fixture.upstreamSha}, live=${state.head ?? 'unknown'} [via ${state.headSource}])`,
        )
        const drift = diffSurface(fixture, surface)
        if (drift.length > 0) {
          for (const line of drift.slice(0, 20)) log(`  drift: ${line}`)
          check(false, `public surface drifted from fixture (${drift.length} lines; first 20 shown)`)
        } else {
          check(true, `public surface matches fixture (${fixture.packageCount} packages, schema ${fixture.schema})`)
        }
      }
    }
  }

  // -------------------------------------------------------------------- static
  if (cfg.only === undefined || cfg.only === 'static') {
    log('=== section: static (private-import negative test) ===')
    const surface = ctx.surface ?? buildPublicSurface(cfg.hostTree)
    ctx.surface = surface
    // (a) harness code: strict — only node: builtins + in-root relative files.
    //     Scanned set: lib/**, run.mjs, spawn-probe.mjs, and every probe
    //     group's index.mjs (the plugins/ trees are scanned in probe mode).
    const harnessFindings = []
    for (const f of scanDirectory(join(harnessRoot, 'lib'), { mode: 'harness', surface })) harnessFindings.push(f)
    for (const file of [join(harnessRoot, 'run.mjs'), join(harnessRoot, 'spawn-probe.mjs')]) {
      for (const f of scanFileSpecifiers(file, readFileSync(file, 'utf8'), { mode: 'harness', surface, root: harnessRoot, rootLabel: 'harness' })) {
        harnessFindings.push({ ...f, file })
      }
    }
    const probesRoot = ctx.probesRoot
    for (const item of walk(probesRoot, ['node_modules'])) {
      const rel = relative(probesRoot, item.path)
      const parts = rel.split(sep)
      if (parts.length !== 2 || parts[1] !== 'index.mjs') continue
      for (const f of scanFileSpecifiers(item.path, readFileSync(item.path, 'utf8'), { mode: 'harness', surface, root: harnessRoot, rootLabel: 'harness' })) {
        harnessFindings.push({ ...f, file: item.path })
      }
    }
    if (harnessFindings.length > 0) {
      for (const f of harnessFindings.slice(0, 10)) log(`  finding ${f.code} ${f.file}:${f.line} "${f.spec}"`)
      check(false, `harness source has ${harnessFindings.length} forbidden import finding(s) (zero-core constraint)`)
    } else {
      check(true, 'harness source (lib/ + run.mjs + spawn-probe.mjs + probes/*/index.mjs) has zero bare/third-party/private imports')
    }
    // (b) probe plugins: C4 semantics — the good passes, the bad is DETECTED.
    const pluginsRoot = join(probesRoot, 'smoke', 'plugins')
    const allProbeFindings = scanDirectory(pluginsRoot, { mode: 'probe', surface })
    const goodFile = join(pluginsRoot, 'good-host.js')
    const badFile = join(pluginsRoot, 'negative-fixtures', 'bad-host.js')
    const goodFindings = allProbeFindings.filter((f) => f.file === goodFile)
    const badFindings = allProbeFindings.filter((f) => f.file === badFile)
    check(goodFindings.length === 0, `scanner: good probe PASSES (0 findings in ${relative(harnessRoot, goodFile)})`)
    check(badFindings.length >= 1, `scanner: bad probe DETECTED + REJECTED (${badFindings.length} finding(s): ${badFindings.map((f) => f.code).join(', ')})`)
    for (const f of badFindings) log(`  rejected: ${f.code} "${f.spec}" — ${f.detail}`)
    for (const f of allProbeFindings.filter((x) => x.file !== goodFile && x.file !== badFile)) log(`  (other probe finding: ${f.code} ${f.file}:${f.line})`)
    // (c) Scanner positive controls: synthetic sources (from
    //     fixtures/scanner-controls.json — kept out of scanned source files
    //     so neither this scan nor verify-zero-core C4 can self-match the
    //     literals) must be flagged in both modes. A scanner that passes
    //     everything is a scanner that checks nothing (regression guard for
    //     the P2-T1 vacuous-scan bug class).
    let controls
    try {
      controls = JSON.parse(readFileSync(join(harnessRoot, 'fixtures', 'scanner-controls.json'), 'utf8'))
    } catch (error) {
      check(false, `scanner controls fixture unreadable: ${error.message}`)
    }
    if (controls !== undefined) {
      const bareControl = scanFileSpecifiers('<synthetic-bare>', controls.bareHarness, {
        mode: 'harness',
        surface,
        root: harnessRoot,
        rootLabel: 'synthetic',
      })
      check(
        bareControl.some((f) => f.code === 'bare-import-in-harness'),
        'scanner positive control: synthetic bare import FLAGGED in harness mode',
      )
      const privateControl = scanFileSpecifiers('<synthetic-private>', controls.privateSubpath, {
        mode: 'probe',
        surface,
        root: harnessRoot,
        rootLabel: 'synthetic',
      })
      check(
        privateControl.some((f) => f.code === 'private-subpath-import'),
        'scanner positive control: synthetic private subpath FLAGGED in probe mode',
      )
    }
  }

  // ----------------------------------------------------------------- lifecycle
  if (cfg.only === undefined || cfg.only === 'lifecycle') {
    log('=== section: lifecycle ===')
    if (ctx.surface === undefined) {
      ctx.surface = buildPublicSurface(cfg.hostTree)
    }
    const { initialized, created } = await ensureProfile({ instance: ctx.instance, log, timeoutMs: 90_000 })
    check(initialized, `web profile ready under dedicated DSH_HOME${created ? ' (created by throwaway boot)' : ' (already initialized)'}`)
    const goodRow = { id: 'p2t1-smoke-probe', name: ctx.pluginUrl('probes/smoke/plugins/good-host.js') }
    ctx.instance.mountRows([goodRow], ['P2-T1 lifecycle section: good probe row. Revert: replace with [].'])
    const dump = await ctx.instance.dumpConfig()
    writeFileSync(join(cfg.logDir, 'dump-config-lifecycle.txt'), dump.text)
    check(DshInstance.rowInDump(dump.text, goodRow), 'dump-config: mounted row present in the composed profile tree (public seam carries it)')
    const boot = await ctx.instance.start()
    check(boot.url.startsWith(`http://127.0.0.1:${cfg.port}/?token=`), `instance started: ${boot.url}`)
    const stop = await ctx.instance.stop()
    check(stop.portFree, 'instance stopped, port freed')
  }

  // -------------------------------------------------------------------- probes
  if (cfg.only === undefined || cfg.only === 'probes') {
    log('=== section: probes ===')
    if (ctx.surface === undefined) {
      ctx.surface = buildPublicSurface(cfg.hostTree)
    }
    const groups = await discoverProbeGroups(ctx.probesRoot)
    check(groups.length >= 1, `probe groups discovered: ${groups.map((g) => g.name).join(', ') || '(none)'}`)
    for (const group of groups) {
      const impl = group.module?.default
      if (impl === undefined || typeof impl.run !== 'function') {
        check(false, `probe group ${group.name}: index.mjs must default-export { name, run(ctx) }`)
        continue
      }
      log(`--- probe group: ${group.name} — ${impl.description ?? ''}`)
      try {
        await impl.run(ctx)
      } catch (error) {
        check(false, `probe group ${group.name} threw: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  // --------------------------------------------------------------- byte-clean
  if (cfg.only === undefined || cfg.only === 'byte-clean') {
    log('=== section: byte-clean ===')
    const endState = await captureGitState(cfg.hostTree, cfg.logDir)
    if (endState.errors.length > 0) {
      check(false, `git snapshot unavailable: ${endState.errors.join('; ')}`)
    } else {
      check(endState.statusEmpty, 'test-use tree byte-clean after run (git status --porcelain empty)')
      check(endState.diffEmpty, 'test-use tree byte-clean after run (git diff empty)')
      const startHead = ctx.gitStart?.head
      check(startHead === undefined || startHead === endState.head, `HEAD unchanged (start=${startHead ?? 'n/a'}, end=${endState.head})`)
    }
    writeFileSync(
      join(cfg.logDir, 'git-state-after.json'),
      `${JSON.stringify(
        { statusEmpty: endState.statusEmpty, diffEmpty: endState.diffEmpty, head: endState.head, headSource: endState.headSource },
        null,
        2,
      )}\n`,
    )
  }

  // ------------------------------------------------------------------ summary
  const summary = {
    ok: ctx.failures.length === 0,
    failures: ctx.failures,
    sections: cfg.only === undefined ? SECTIONS : [cfg.only],
    port: cfg.port,
    hostTree: cfg.hostTree,
    dshHome: cfg.dshHome,
    node: process.version,
    finishedAt: new Date().toISOString(),
  }
  if (cfg.reportDir !== null) writeFileSync(join(cfg.reportDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  log('')
  if (summary.ok) {
    log('RESULT: PASS characterization self-test (all sections green)')
    return 0
  }
  log(`RESULT: FAIL characterization self-test (${summary.failures.length} failure(s))`)
  for (const f of summary.failures) log(`  - ${f}`)
  return 1
}

main().then(
  (code) => {
    process.exitCode = code
  },
  (error) => {
    console.error(`harness internal error: ${error instanceof Error ? error.stack : String(error)}`)
    process.exitCode = 2
  },
)
