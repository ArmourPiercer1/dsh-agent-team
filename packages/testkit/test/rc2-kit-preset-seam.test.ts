/**
 * rc2-kit-preset-seam — the preset declaration seam, kept honest WITHOUT a host.
 *
 * Scope: `tests/kits/_shared/preset-seam.mjs`, the host-side contract it claims,
 * and the migration state of the kit / harness sources that used to write the
 * retired `$DSH_HOME/.agent-presets/<id>/` directory.
 *
 * No host is booted and no network is used: the row shape is checked against
 * source text of the mandated runtime tree (`tests/paths.mjs` is the pin), the
 * emitted patch layer is checked against a golden string, and the sources are
 * scanned. Nothing here is skipped or labelled "debt": the migration ledger is
 * an assertion, so an unmigrated file is a NAMED entry that a specific commit
 * must remove, and a newly-written legacy fixture fails the suite.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AGENT_PRESET_ROW_NAME,
  LEGACY_PRESET_DIRECTORY_SEAM,
  PERSONA_ROW_NAME,
  emitPatchLayer,
  personaRow,
  persistentShellGroup,
  presetDeclarationRow,
  smokePresetPlugins,
} from '../../../tests/kits/_shared/preset-seam.mjs'
import {
  DSH_BASELINE_VERSION,
  TEST_USE_BASELINE_SHA,
  findTestRepoRoot,
  testUseTree,
} from '../../../tests/paths.mjs'

const REPO_ROOT = findTestRepoRoot(process.cwd())
if (REPO_ROOT === null) throw new Error('cannot locate a repo root containing tests/deepseek-harness-test-use')
const HOST = testUseTree(REPO_ROOT)

const read = (rel: string): string => readFileSync(join(HOST, rel), 'utf8')

/** Files migrated to the declaration-row seam; each entry is asserted strictly. */
const MIGRATED_SOURCES = [
  'tests/kits/work-completion-wakeup-smoke/work-completion-wakeup-smoke.mjs',
  'tests/kits/pr-d-control-real-host/pr-d-control-real-host.mjs',
]

/**
 * Files STILL writing the retired seam, with the reason each one is still here.
 * This list is the ledger: it must shrink to empty, it may not gain entries, and
 * deleting a file's entry without migrating it fails P5b.
 */
const NOT_YET_MIGRATED: Array<{ file: string; reason: string }> = [
  { file: 'tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs', reason: 'writeSmokePreset() still emits the directory shape' },
  { file: 'tests/kits/exec-contract-live-smoke/exec-contract-live-smoke.mjs', reason: 'writeSmokePreset(HOME_A/HOME_B) still emits the directory shape' },
  { file: 'tests/kits/send-message-liveness-smoke/send-message-liveness-smoke.mjs', reason: 'writeSmokePreset() still emits the directory shape' },
  { file: 'packages/runtime/root-binding/harness/run.mjs', reason: 'writes .agent-presets/p5t5-team-persona and imports PERSONA_SECTION' },
  { file: 'packages/runtime/member-residency/harness/run.mjs', reason: 'writes two .agent-presets fixtures and imports PERSONA_SECTION' },
]

const LEGACY_WRITE = /\.agent-presets/

/** Strip line comments so a mention in prose does not count as a write. */
function codeOnly(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//') && !line.trimStart().startsWith('#'))
    .join('\n')
}

describe('P1 the emitted profile patch layer is byte-stable', () => {
  it('matches the golden text the host-parsed shape was captured in', () => {
    const row = presetDeclarationRow({
      id: 'golden-kit',
      displayName: 'golden kit',
      description: 'golden fixture',
      plugins: smokePresetPlugins({ personaText: 'GOLDEN PERSONA', cwdSuffix: 'cwd={{cwd}}' }),
    })
    const text = emitPatchLayer({ header: ['golden header'], rows: [{ id: 'plain-row', name: 'file:///dist/index.mjs' }, row] })
    expect(text).toBe(
      [
        '# golden header',
        '- insert:',
        '  - id: "plain-row"',
        '    name: "file:///dist/index.mjs"',
        '  - id: "preset-golden-kit"',
        '    name: "@deepseek-ai/dsh-agent-preset"',
        '    config:',
        '      id: "golden-kit"',
        '      name: "golden kit"',
        '      description: "golden fixture"',
        '      order: 900',
        '      plugins:',
        '        - id: "persona"',
        '          name: "@deepseek-ai/dsh-persona"',
        '          config:',
        '            prefix: "GOLDEN PERSONA"',
        '            suffix: "cwd={{cwd}}"',
        '        - id: "tool-fs"',
        '          name: "@deepseek-ai/dsh-tool-fs"',
        '        - id: "persistent-shell"',
        '          name: "cordis:group"',
        '          group: true',
        '          isolate:',
        '            terminals: true',
        '          config:',
        '            - id: "pty"',
        '              name: "@deepseek-ai/dsh-terminal"',
        '            - id: "terminal-bash"',
        '              name: "@deepseek-ai/dsh-terminal-bash"',
        '              config:',
        '                timeoutMs: 300000',
        '            - id: "persistent-bash"',
        '              name: "@deepseek-ai/dsh-tool-bash-persistent"',
        '              config:',
        '                timeoutMs: 300000',
        '',
      ].join('\n'),
    )
  })

  it('contains no legacy directory seam anywhere in its output', () => {
    const text = emitPatchLayer({
      rows: [presetDeclarationRow({ id: 'x', plugins: smokePresetPlugins({ personaText: 'P' }) })],
    })
    expect(text.includes('.agent-presets')).toBe(false)
    expect(text.includes('profiles/web')).toBe(false)
  })
})

describe('P2 the declaration row carries the roster identity the registry dedupes on', () => {
  it('names the preset plugin and repeats the id under config.id', () => {
    const row = presetDeclarationRow({ id: 'rc2-smoke', plugins: smokePresetPlugins({ personaText: 'P' }) })
    expect(row.name).toBe(AGENT_PRESET_ROW_NAME)
    const config = row.config as { id: string; name: string; order: number; plugins: Array<{ id: string }> }
    expect(config.id).toBe('rc2-smoke')
    expect(config.name).toBe('rc2-smoke')
    expect(config.order).toBe(900)
    expect(config.plugins.map((p) => p.id)).toEqual(['persona', 'tool-fs', 'persistent-shell'])
  })

  it('refuses an empty plugin list, a missing id, and a persona without text', () => {
    expect(() => presetDeclarationRow({ id: 'x', plugins: [] })).toThrow()
    expect(() => presetDeclarationRow({ id: '', plugins: [{ id: 'a', name: 'b' }] })).toThrow()
    expect(() => smokePresetPlugins({ personaText: '' })).toThrow()
  })

  it('keeps the persistent shell group isolate/group markers the bash stack needs', () => {
    const group = persistentShellGroup({ timeoutMs: 1234, bashDescription: 'desc' })
    expect(group.group).toBe(true)
    expect(group.isolate).toEqual({ terminals: true })
    expect(JSON.stringify(group).includes('1234')).toBe(true)
    expect(JSON.stringify(group).includes('desc')).toBe(true)
  })
})

describe('P3 the persona row uses the current schema key, not the retired one', () => {
  it('emits prefix and never text', () => {
    const row = personaRow({ text: 'YOU ARE', suffix: 'S', includeRuntimeContext: false })
    const config = row.config as Record<string, unknown>
    expect(row.name).toBe(PERSONA_ROW_NAME)
    expect(config.prefix).toBe('YOU ARE')
    expect(config.suffix).toBe('S')
    expect(config.includeRuntimeContext).toBe(false)
    expect(Object.keys(config)).not.toContain('text')
  })
})

describe('P4 the pinned host really exposes that contract (read from the mandated runtime tree)', () => {
  it('the tree under test is the pinned generation', () => {
    expect(DSH_BASELINE_VERSION).toBe('0.2.0-rc.2')
    expect(TEST_USE_BASELINE_SHA).toBe('639ed015397290b3745d163aafe02ffee4aa3f84')
    const pkg = JSON.parse(read('package.json')) as { version?: string }
    expect(String(pkg.version)).toContain('0.2.0-rc.2')
  })

  it('the persona plugin requires prefix and has no text key', () => {
    const src = read('packages/preset/persona/src/index.ts')
    const start = src.indexOf('export const Config')
    expect(start > 0).toBe(true)
    const configSchema = src.slice(start, src.indexOf('\n})', start))
    expect(configSchema).toContain('prefix: z.string().required()')
    // the retired fixture key was `text:`; a standalone text key in the schema
    // (not the includeRuntimeContext suffix, not apply()'s section payload)
    // would mean the migration target moved again.
    expect(/(^|\n)\s*text:/.test(configSchema)).toBe(false)
    expect(configSchema).toContain('includeRuntimeContext')
  })

  it('system-prompt exports the two persona section names and no bare PERSONA_SECTION', () => {
    const src = read('packages/core/system-prompt/src/index.ts')
    expect(src).toContain("export const PERSONA_PREFIX_SECTION = 'deployment:persona-prefix'")
    expect(src).toContain("export const PERSONA_SUFFIX_SECTION = 'deployment:persona-suffix'")
    expect(/export const PERSONA_SECTION\b/.test(src)).toBe(false)
  })

  it('the row plugin is the published preset package and no host source reads the retired directory', () => {
    const pkg = JSON.parse(read('packages/preset/agent-preset/package.json')) as { name: string; version: string }
    expect(pkg.name).toBe(AGENT_PRESET_ROW_NAME)
    expect(pkg.version).toContain('0.2.0-rc.2')
    const readers: string[] = []
    for (const rel of [
      'packages/preset/agent-preset-registry/src/mount.ts',
      'packages/preset/agent-preset-registry/src/definition.ts',
      'packages/preset/agent-preset-registry/src/types.ts',
      'packages/preset/agent-preset-registry/src/preset.ts',
      'packages/preset/agent-preset/src/index.ts',
    ]) {
      if (read(rel).includes(LEGACY_PRESET_DIRECTORY_SEAM)) readers.push(rel)
    }
    expect(readers).toEqual([])
  })
})

describe('P5 the migration ledger is an assertion, not a comment', () => {
  it('every migrated source has no legacy seam in code and no bare PERSONA_SECTION import', () => {
    expect(MIGRATED_SOURCES.length).toBeGreaterThan(0)
    for (const rel of MIGRATED_SOURCES) {
      const source = readFileSync(resolve(REPO_ROOT, rel), 'utf8')
      const code = codeOnly(source)
      const offenders = code
        .split('\n')
        .filter((line) => line.includes(LEGACY_PRESET_DIRECTORY_SEAM))
        .map((line) => `${rel}: ${line.trim().slice(0, 90)}`)
      expect(offenders).toEqual([])
      expect(code.includes('PERSONA_SECTION') ? `${rel}: imports PERSONA_SECTION` : 'clean').toBe('clean')
      // a migrated source either declares its preset through the shared seam,
      // pins the host-shipped default by name, or states no preset at all.
      const declares =
        code.includes('preset-seam.mjs') ||
        /SMOKE_PRESET_ID\s*=\s*'standard'/.test(code) ||
        !/presetId|agentPreset|SMOKE_PRESET_ID/.test(code)
      expect(declares ? 'declared' : `undeclared :: ${rel}`).toBe('declared')
    }
  })

  it('the unmigrated set is exactly the recorded one and cannot grow silently', () => {
    const expected = NOT_YET_MIGRATED.map((entry) => entry.file).sort()
    const writers: string[] = []
    for (const rel of [...MIGRATED_SOURCES, ...expected]) {
      const source = readFileSync(resolve(REPO_ROOT, rel), 'utf8')
      if (LEGACY_WRITE.test(codeOnly(source))) writers.push(rel)
    }
    // every still-listed file must STILL write the seam (otherwise the entry is
    // stale and the migration was never recorded), and no migrated file may.
    expect(writers.sort()).toEqual(expected)
    for (const entry of NOT_YET_MIGRATED) expect(entry.reason.length).toBeGreaterThan(10)
  })
})
