/**
 * registries.test.mjs — u7-w0 (2026-10-26) C1 controls for the two
 * drop-in registries of the world-factory harness:
 *   tests/world-factory/world-kinds/<NNN>-<kind>.mjs  (lib/world-kinds.mjs)
 *   tests/world-factory/suites/<NNN>-<suite>.mjs      (lib/suites.mjs)
 * ZERO Host boots, ZERO ports bound: every case loads modules, plants temp
 * directories, or creates (never boots) a World under a temp repo root.
 *
 * Run: node --test tests/world-factory/registries.test.mjs
 *
 * What is pinned:
 *   - the shipped registries carry exactly the kinds / suites that were
 *     hand-wired at origin/master 88107ad71 (names, case lists, request
 *     budgets) — the byte-level equivalence receipts live in
 *     dev/agent-workflow/evidence/u7-w0-20261026/{world-kinds-equivalence,
 *     suites-before-after,suites-body-diff}.txt;
 *   - enumeration is DETERMINISTIC and ordered by the file-name prefix;
 *   - RED-first: a REMOVED kind module makes its createWorld option a typed
 *     refusal (before u7-w0 an unknown option was silently dropped and a
 *     plain canary World booted in its place); a REMOVED suite module makes
 *     `--suite <name>` refuse; duplicates, mis-named files, missing fields,
 *     clashing options/members, non-owned paths and undeclared env keys all
 *     refuse at load time;
 *   - the kind laws the factory states once: mutual exclusion, the {rows}
 *     shape, the owned-path guard over every kind path.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyKindEnv, CORE_WORLD_OPTIONS, loadWorldKinds, WORLD_KINDS_DIR } from './lib/world-kinds.mjs'
import { loadSuites, SUITES_DIR } from './lib/suites.mjs'
import { TestWorldFactory, WORLD_KIND_OPTIONS } from './lib/world-factory.mjs'

const tmp = (label) => mkdtempSync(join(tmpdir(), `u7w0-reg-${label}-`))

/**
 * A mutable copy of a shipped registry directory. Suite and kind modules
 * import `../lib/*.mjs` / `../canary/*` RELATIVELY, so the copy must sit beside
 * the shipped directory (a sibling `.tmp-u7w0-*` dir, removed in `finally`;
 * `.tmp-*` is the repo's sanctioned scratch prefix — gitignored and outside lint).
 */
function plantedCopy(src, label) {
  const dir = mkdtempSync(join(src, '..', `.tmp-u7w0-${label}-`))
  for (const name of readdirSync(src)) cpSync(join(src, name), join(dir, name))
  return dir
}
function plantedKinds(label) {
  const dir = plantedCopy(WORLD_KINDS_DIR, label)
  return { parent: dir, dir }
}

// ── world kinds ─────────────────────────────────────────────────────────────

test('world kinds: the eight hand-wired kinds (7 at 88107ad71 + u7AgentControl from U7-F), in prefix order, deterministic', async () => {
  const a = await loadWorldKinds()
  const b = await loadWorldKinds()
  assert.deepEqual(a.map((k) => k.option), ['u6Fs', 'u6Proc', 'u6ArcA', 'u6ArcD', 'u6Jobs', 'u7Census', 'u7FsMut', 'u7AgentControl'])
  assert.deepEqual(a.map((k) => k.file), b.map((k) => k.file))
  assert.deepEqual(a.map((k) => k.file), [...a.map((k) => k.file)].sort())
  assert.deepEqual(WORLD_KIND_OPTIONS, a.map((k) => k.option))
})

test('world kinds RED-first: a REMOVED kind module turns its option into a typed refusal (was: silently a plain World)', async () => {
  const root = tmp('kind-removed')
  try {
    const factory = new TestWorldFactory({ repoRoot: root, evidenceRoot: join(root, 'ev'), hostTree: root, leaseRoot: join(root, 'leases') })
    // positive: a registered kind creates fine
    const ok = await factory.createWorld({ line: 'regok', u7FsMut: { rows: [] } })
    assert.equal(ok.activeKind?.option, 'u7FsMut')
    // the removed kind (simulated: an option no module declares) refuses by name
    await assert.rejects(() => factory.createWorld({ line: 'reggone', u7Pwsh: { rows: [] } }), /unknown world option\(s\): u7Pwsh/)
    // and the loader, with the module actually deleted, no longer declares it
    const { parent, dir } = plantedKinds('kind-removed-dir')
    try {
      rmSync(join(dir, '070-u7-fs-mut.mjs'))
      const kinds = await loadWorldKinds(dir)
      assert.equal(kinds.some((k) => k.option === 'u7FsMut'), false)
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('world kinds: mutual exclusion, the {rows} shape and the core-option set are enforced once, for every kind', async () => {
  const root = tmp('kind-laws')
  try {
    const factory = new TestWorldFactory({ repoRoot: root, evidenceRoot: join(root, 'ev'), hostTree: root, leaseRoot: join(root, 'leases') })
    for (const option of WORLD_KIND_OPTIONS) {
      await assert.rejects(() => factory.createWorld({ line: 'regx', [option]: 'yes' }), new RegExp(`invalid ${option}`))
      await assert.rejects(() => factory.createWorld({ line: 'regx', [option]: { nope: true } }), new RegExp(`invalid ${option}`))
    }
    const [first, second] = WORLD_KIND_OPTIONS
    await assert.rejects(() => factory.createWorld({ line: 'regx', [first]: { rows: [] }, [second]: { rows: [] } }), /mutually exclusive/)
    assert.deepEqual(CORE_WORLD_OPTIONS, ['line', 'visible', 'badMount', 'restartIndex', 'extContributors', 'centerAssembly'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('world kinds: the owned-path guard covers every kind path (a kind path pointed outside the home refuses the boot)', async () => {
  const root = tmp('kind-owned')
  try {
    const factory = new TestWorldFactory({ repoRoot: root, evidenceRoot: join(root, 'ev'), hostTree: root, leaseRoot: join(root, 'leases') })
    const world = await factory.createWorld({ line: 'regown', u6Fs: { rows: [] } })
    assert.ok(world.u6fsLedgerPath.startsWith(world.home), 'kind ledger path is inside the home')
    assert.ok(world.u6fsMarkerDir.startsWith(world.workspaceDir), 'kind marker dir is inside the workspace')
    assert.equal(typeof world.u6fsLedgerRows, 'function')
    world.u6arcdLedgerPath = join(tmpdir(), 'u7w0-escaped-kind-ledger.jsonl')
    await assert.rejects(world.startHost(), /u6arcdLedgerPath escapes the owned home/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('world kinds: env — every kind key is cleared on every boot, only the active kind sets its own', async () => {
  const kinds = await loadWorldKinds()
  const env = { U6FS_LEDGER: 'stale', U6ARCD_WORLD: 'stale', U7C_BOOT_ID: 'stale', UNRELATED: 'keep' }
  const arcA = kinds.find((k) => k.option === 'u6ArcA')
  const world = { id: 'w', u6arcaLedgerPath: '/h/l', u6arcaMarkerDir: '/h/m' }
  applyKindEnv({ kinds, activeKind: arcA, world, factory: { repoRoot: '/r' }, env })
  assert.equal(env.U6FS_LEDGER, undefined)
  assert.equal(env.U6ARCD_WORLD, undefined)
  assert.equal(env.U7C_BOOT_ID, undefined)
  assert.equal(env.UNRELATED, 'keep')
  assert.equal(env.U6ARC_WORLD, 'w')
  applyKindEnv({ kinds, activeKind: null, world, factory: { repoRoot: '/r' }, env })
  assert.equal(Object.keys(env).filter((k) => /^U6|^U7C_/.test(k)).length, 0, 'a plain World clears every kind key')
})

test('world kinds RED-first: malformed / clashing modules refuse at load time', async () => {
  const cases = [
    ['bad-name.mjs', 'export default { option: "x" }\n', /<NNN>-<kind>\.mjs/],
    ['080-dup-option.mjs', 'export default { option: "u6Fs", probe: null, paths: {}, ledgerRows: {}, envKeys: [], env: () => ({}), patchHeader: ["h"] }\n', /already declared/],
    ['080-core-clash.mjs', 'export default { option: "line", probe: null, paths: {}, ledgerRows: {}, envKeys: [], env: () => ({}), patchHeader: ["h"] }\n', /already declared/],
    ['080-escape.mjs', 'export default { option: "u7Esc", probe: null, paths: { escLedger: ["/tmp", "x.jsonl"] }, ledgerRows: {}, envKeys: [], env: () => ({}), patchHeader: ["h"] }\n', /owned paths only/],
    ['080-dup-member.mjs', 'export default { option: "u7Dup", probe: null, paths: { u6fsLedgerPath: ["home", "x.jsonl"] }, ledgerRows: {}, envKeys: [], env: () => ({}), patchHeader: ["h"] }\n', /already declared by another kind/],
    ['080-no-header.mjs', 'export default { option: "u7NoHdr", probe: null, paths: {}, ledgerRows: {}, envKeys: [], env: () => ({}), patchHeader: [] }\n', /patchHeader/],
    ['080-bad-env.mjs', 'export default { option: "u7BadEnv", probe: null, paths: {}, ledgerRows: {}, envKeys: ["lower"], env: () => ({}), patchHeader: ["h"] }\n', /envKeys/],
  ]
  for (const [file, text, expected] of cases) {
    const { parent, dir } = plantedKinds('kind-bad')
    try {
      writeFileSync(join(dir, file), text)
      await assert.rejects(() => loadWorldKinds(dir), expected, file)
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
  }
  // an env value whose key the kind does not declare would never be cleared: refused at apply time
  const rogue = { option: 'u7Rogue', envKeys: ['U7R_A'], env: () => ({ U7R_A: '1', U7R_B: '2' }), file: '090-rogue.mjs' }
  assert.throws(() => applyKindEnv({ kinds: [rogue], activeKind: rogue, world: {}, factory: {}, env: {} }), /U7R_B, which its envKeys do not declare/)
})

test('a new World kind is ONE file: dropping it in registers the option, nothing else is edited', async () => {
  const { parent, dir } = plantedKinds('kind-new')
  try {
    writeFileSync(join(dir, '080-u7-pwsh.mjs'), [
      'export default {',
      "  option: 'u7Pwsh', probe: null,",
      "  paths: { u7pwshLedgerPath: ['home', 'u7pwsh-ledger.jsonl'] }, ledgerRows: { u7pwshLedgerRows: 'u7pwshLedgerPath' },",
      "  envKeys: ['U7PWSH_LEDGER'], env: ({ world }) => ({ U7PWSH_LEDGER: world.u7pwshLedgerPath }),",
      "  patchHeader: ['U7 pwsh World (u7-w0 registry control).'],",
      '}',
      '',
    ].join('\n'))
    const kinds = await loadWorldKinds(dir)
    assert.equal(kinds.at(-1)?.option, 'u7Pwsh')
    assert.equal(kinds.length, 9) // 8 shipped (u7AgentControl joined at U7-F) + the planted one
  } finally {
    rmSync(parent, { recursive: true, force: true })
  }
})

test('world kinds RED-first (review R1 F-1): a stray entry — other extension, subdirectory, dotfile — refuses BY NAME', async () => {
  for (const [label, plant, named] of [
    ['x.txt', (d) => writeFileSync(join(d, 'x.txt'), 'hidden kind'), 'x.txt'],
    ['sub/y.mjs', (d) => { mkdirSync(join(d, 'sub')); writeFileSync(join(d, 'sub', 'y.mjs'), 'export default {}\n') }, 'sub/'],
    ['.hidden', (d) => writeFileSync(join(d, '.080-hidden.mjs'), 'export default {}\n'), '.080-hidden.mjs'],
  ]) {
    const { parent, dir } = plantedKinds('kind-stray')
    try {
      plant(dir)
      await assert.rejects(() => loadWorldKinds(dir), (e) => /stray-entry/.test(e.message) && e.message.includes(named), label)
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
  }
})

// ── suites ──────────────────────────────────────────────────────────────────

test('suites RED-first (review R1 F-1): a stray entry — other extension, subdirectory, dotfile — refuses BY NAME', async () => {
  for (const [label, plant, named] of [
    ['x.txt', (d) => writeFileSync(join(d, 'x.txt'), 'hidden suite'), 'x.txt'],
    ['sub/y.mjs', (d) => { mkdirSync(join(d, 'sub')); writeFileSync(join(d, 'sub', 'y.mjs'), 'export default {}\n') }, 'sub/'],
    ['.hidden', (d) => writeFileSync(join(d, '.070-hidden.mjs'), 'export default {}\n'), '.070-hidden.mjs'],
  ]) {
    const dir = plantedCopy(SUITES_DIR, 'suite-stray')
    try {
      plant(dir)
      await assert.rejects(() => loadSuites({ dir }), (e) => /stray-entry/.test(e.message) && e.message.includes(named), label)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

test('suites: the seven hand-wired lane suites (6 at 88107ad71 + u7-agent-control from U7-F), prefix order, budgets as the old ternary', async () => {
  const a = await loadSuites()
  const b = await loadSuites()
  assert.deepEqual(a.map((s) => [s.suite, s.totalRequests]), [
    ['u6-fs', 80], ['u6-proc', 130], ['u6-jobs', 100], ['u6-arc-a', 90], ['u6-arc-d', 90], ['u7-fs-mut', 80], ['u7-agent-control', 60],
  ])
  assert.deepEqual(a.map((s) => s.file), b.map((s) => s.file))
  const { SUITE_CASES } = await import('./u5-canary-runner.mjs')
  for (const s of a) assert.deepEqual([...SUITE_CASES[s.suite]], [...s.cases], `SUITE_CASES carries the collected ${s.suite}`)
  assert.deepEqual(Object.keys(SUITE_CASES).sort(), ['core', 'core-restart', 'crash-victim', 'negatives', 'u6-arc-a', 'u6-arc-d', 'u6-fs', 'u6-jobs', 'u6-proc', 'u6-shadow', 'u7-agent-control', 'u7-fs-mut'])
})

test('suites RED-first: a REMOVED suite module makes the loader drop it (and --suite refuse it)', async () => {
  const dir = plantedCopy(SUITES_DIR, 'suite-removed')
  try {
    rmSync(join(dir, '060-u7-fs-mut.mjs'))
    const suites = await loadSuites({ dir })
    assert.equal(suites.some((s) => s.suite === 'u7-fs-mut'), false)
    // the runner's own refusal law over the collected map (shipped dir has it; a name nobody declares refuses)
    const { parseArgs } = await import('./u5-canary-runner.mjs')
    assert.throws(() => parseArgs(['--suite', 'u7-pwsh', '--evidence', '/tmp/ev']), /unknown suite: u7-pwsh/)
    assert.equal(parseArgs(['--suite', 'u7-fs-mut', '--evidence', '/tmp/ev']).suite, 'u7-fs-mut')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('suites RED-first: malformed / clashing suite modules refuse at load time', async () => {
  const good = (name, extra = '') => `export default { suite: '${name}', cases: ['a:x'], totalRequests: 10, run: async () => {}${extra} }\n`
  const cases = [
    ['bad-name.mjs', good('bad-name'), /<NNN>-<suite>\.mjs/],
    ['070-mismatch.mjs', good('other'), /must equal the file's name part/],
    ['070-u6-fs.mjs', good('u6-fs'), /already declared/],
    ['070-core.mjs', good('core'), /already declared/],
    ['070-nocases.mjs', "export default { suite: 'nocases', cases: [], totalRequests: 10, run: async () => {} }\n", /non-empty list/],
    ['070-dupcase.mjs', "export default { suite: 'dupcase', cases: ['a', 'a'], totalRequests: 10, run: async () => {} }\n", /listed twice/],
    ['070-nobudget.mjs', "export default { suite: 'nobudget', cases: ['a'], run: async () => {} }\n", /totalRequests/],
    ['070-norun.mjs', "export default { suite: 'norun', cases: ['a'], totalRequests: 10 }\n", /run must be a function/],
  ]
  for (const [file, text, expected] of cases) {
    const dir = plantedCopy(SUITES_DIR, 'suite-bad')
    try {
      writeFileSync(join(dir, file), text)
      await assert.rejects(() => loadSuites({ dir, reserved: ['core'] }), expected, file)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})
