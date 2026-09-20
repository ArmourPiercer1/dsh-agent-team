/**
 * Persona KIND derivation from a preset's composition text (the
 * persona-requirement-preset-id fix, direction B): the host resolves the
 * effective-persona kind of a preset id — no persona data exists on the
 * roster seam, so the preset's own `dsh-persona` row config (the upstream
 * plugin's PUBLIC `complete?: boolean` flag) is the authoritative
 * observation. Mapping: no effective row => absent; effective row with
 * `config.complete: true` => complete; any other effective row =>
 * standard. Conservative corners: a `!!js`-conditional disabled row is
 * treated as enabled (a conditionally-disabled complete persona still
 * classifies complete — fail-safe for the §13.5 gate); multiple persona
 * rows classify complete when any effective one is complete.
 *
 * Authority: Architecture §13.5; bug report
 * docs/issues/team-persona-requirement-preset-id-bug-report.md; the
 * shipped preset compositions (upstream test-use checkout:
 * packages/preset/agent-presets/presets/{standard,minimal,ptc,cordis}/
 * agent.cordis.yml — the fixture blocks below mirror their persona rows
 * verbatim).
 */

import { describe, expect, it } from 'vitest'

import { PERSONA_KINDS } from '../../domain/compatibility/src/index.js'
import {
  DSH_PERSONA_MODULE,
  PRESET_PERSONA_KINDS,
  PresetPersonaCompositionError,
  presetPersonaKindOfComposition,
} from '../agent-setup/preset/index.js'

/** The shipped `standard` preset's persona row (verbatim shape) + a !!js conditional elsewhere. */
const STANDARD_COMPOSITION = [
  '- id: persona',
  `  name: '${DSH_PERSONA_MODULE}'`,
  '  config:',
  '    suffix: Your working directory is {{cwd}}.',
  '    prefix: >-',
  '      You are a coding agent powered by the {{model}} model.',
  '',
  '- id: tool-bash',
  "  name: '@deepseek-ai/dsh-tool-bash'",
  "  disabled: !!js process.platform === 'win32'",
  '',
  '- id: tool-fs',
  "  name: '@deepseek-ai/dsh-tool-fs'",
  '',
].join('\n')

/** The shipped `minimal` preset's persona row (complete:true — the §13.5 fixture). */
const MINIMAL_COMPOSITION = [
  '- id: persona',
  `  name: '${DSH_PERSONA_MODULE}'`,
  '  config:',
  '    prefix: You are a helpful software engineer assistant.',
  '    complete: true',
  '    includeRuntimeContext: false',
  '',
].join('\n')

/** No persona row at all. */
const NO_PERSONA_COMPOSITION = [
  '- id: tool-fs',
  "  name: '@deepseek-ai/dsh-tool-fs'",
  '',
].join('\n')

/** The persona row exists but is literally disabled. */
const DISABLED_PERSONA_COMPOSITION = [
  '- id: persona',
  `  name: '${DSH_PERSONA_MODULE}'`,
  '  disabled: true',
  '  config:',
  '    complete: true',
  '',
].join('\n')

/** A persona row disabled by a `!!js` expression (unevaluable) that IS complete. */
const CONDITIONAL_COMPLETE_COMPOSITION = [
  '- id: persona',
  `  name: '${DSH_PERSONA_MODULE}'`,
  "  disabled: !!js process.env.DSH_NO_PERSONA === '1'",
  '  config:',
  '    complete: true',
  '',
].join('\n')

/** The persona row nested in a GROUP row (config = the nested row list). */
const GROUPED_PERSONA_COMPOSITION = [
  '- name: cordis:group',
  '  group: true',
  '  config:',
  '    - id: persona',
  `      name: '${DSH_PERSONA_MODULE}'`,
  '      config:',
  '        prefix: group persona',
  '',
].join('\n')

/** A persona row nested in a LITERALLY DISABLED group. */
const DISABLED_GROUP_PERSONA_COMPOSITION = [
  '- name: cordis:group',
  '  group: true',
  '  disabled: true',
  '  config:',
  '    - id: persona',
  `      name: '${DSH_PERSONA_MODULE}'`,
  '      config:',
  '        complete: true',
  '',
].join('\n')

/** Two effective persona rows, one complete — the conservative answer. */
const DUPLICATE_PERSONA_COMPOSITION = [
  '- id: persona-a',
  `  name: '${DSH_PERSONA_MODULE}'`,
  '  config:',
  '    prefix: a',
  '- id: persona-b',
  `  name: '${DSH_PERSONA_MODULE}'`,
  '  config:',
  '    complete: true',
  '',
].join('\n')

describe('presetPersonaKindOfComposition: the three-state mapping', () => {
  it('a composable persona row (prefix/suffix, no complete flag) => standard', () => {
    expect(presetPersonaKindOfComposition(STANDARD_COMPOSITION)).toBe(PRESET_PERSONA_KINDS.standard)
  })

  it('a complete:true persona row => complete (the §13.5 fixture)', () => {
    expect(presetPersonaKindOfComposition(MINIMAL_COMPOSITION)).toBe(PRESET_PERSONA_KINDS.complete)
  })

  it('no persona row => absent', () => {
    expect(presetPersonaKindOfComposition(NO_PERSONA_COMPOSITION)).toBe(PRESET_PERSONA_KINDS.absent)
  })

  it('a literally disabled persona row => absent (a disabled complete row is not a complete persona)', () => {
    expect(presetPersonaKindOfComposition(DISABLED_PERSONA_COMPOSITION)).toBe(PRESET_PERSONA_KINDS.absent)
  })

  it('a !!js-conditionally disabled COMPLETE persona row => complete (conservative: fail-safe for the §13.5 gate)', () => {
    expect(presetPersonaKindOfComposition(CONDITIONAL_COMPLETE_COMPOSITION)).toBe(PRESET_PERSONA_KINDS.complete)
  })

  it('a persona row nested in a group row is found', () => {
    expect(presetPersonaKindOfComposition(GROUPED_PERSONA_COMPOSITION)).toBe(PRESET_PERSONA_KINDS.standard)
  })

  it('a persona row inside a literally disabled group => absent', () => {
    expect(presetPersonaKindOfComposition(DISABLED_GROUP_PERSONA_COMPOSITION)).toBe(PRESET_PERSONA_KINDS.absent)
  })

  it('two effective persona rows, one complete => complete (conservative)', () => {
    expect(presetPersonaKindOfComposition(DUPLICATE_PERSONA_COMPOSITION)).toBe(PRESET_PERSONA_KINDS.complete)
  })

  it('a !!js tag elsewhere in the file does not disturb the parse (the shipped standard preset shape)', () => {
    // The standard fixture carries the !!js conditional on tool-bash AND a
    // composable persona row — the kind is unaffected by the foreign tag.
    expect(presetPersonaKindOfComposition(STANDARD_COMPOSITION)).toBe(PRESET_PERSONA_KINDS.standard)
  })
})

describe('presetPersonaKindOfComposition: fail loud, never a silent guess', () => {
  it('unparseable YAML => PresetPersonaCompositionError', () => {
    expect(() => presetPersonaKindOfComposition('persona: [unclosed')).toThrow(PresetPersonaCompositionError)
  })

  it('a non-list root => PresetPersonaCompositionError', () => {
    expect(() => presetPersonaKindOfComposition('persona: true\n')).toThrow(PresetPersonaCompositionError)
  })

  it('an empty document (null root) => PresetPersonaCompositionError', () => {
    expect(() => presetPersonaKindOfComposition('')).toThrow(PresetPersonaCompositionError)
  })
})

describe('presetPersonaKindOfComposition: vocabulary coherence', () => {
  it('the runtime three-state and the domain closed kind vocabulary carry identical values', () => {
    expect(PRESET_PERSONA_KINDS.absent).toBe(PERSONA_KINDS.absent)
    expect(PRESET_PERSONA_KINDS.standard).toBe(PERSONA_KINDS.standard)
    expect(PRESET_PERSONA_KINDS.complete).toBe(PERSONA_KINDS.complete)
    expect(Object.values(PRESET_PERSONA_KINDS).sort()).toEqual(Object.values(PERSONA_KINDS).sort())
  })

  it('every derived kind is a member of the closed vocabulary', () => {
    const compositions = [
      STANDARD_COMPOSITION,
      MINIMAL_COMPOSITION,
      NO_PERSONA_COMPOSITION,
      DISABLED_PERSONA_COMPOSITION,
      CONDITIONAL_COMPLETE_COMPOSITION,
      GROUPED_PERSONA_COMPOSITION,
      DISABLED_GROUP_PERSONA_COMPOSITION,
      DUPLICATE_PERSONA_COMPOSITION,
    ]
    for (const composition of compositions) {
      expect(Object.values(PRESET_PERSONA_KINDS)).toContain(presetPersonaKindOfComposition(composition))
    }
  })
})
