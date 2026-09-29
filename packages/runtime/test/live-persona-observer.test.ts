/**
 * pre-alpha3 PR-E / review fix F14 — the LIVE persona observer
 * (`createProductionPersonaObserver`): the REAL production observer over the
 * DSH public `agentPresets` seam (guide §5 B: "若 public seam 不足:
 * unresolved → fail closed. 不能继续 shipped-state guess.").
 *
 * The seam is CLOSABLE with verified public services (no
 * CORE_SEAM_BLOCKER):
 *
 * - `compositionInventory()` — the live presence/enablement of each row
 *   (mounted presets: evaluated booleans + fiberState; unmounted presets:
 *   the declared `!!js` rows surface as `'conditional'`);
 * - `readDocument(presetId)` — the effective declared composition YAML
 *   (the js-yaml `entryListSchema` dump; the persona row's
 *   `config.complete` flag decides standard vs complete).
 *
 * The cases (guide §5 C — the PR #22 donor regression set + the seam
 * failure modes):
 *
 * - ptc → standard (the plain team composition);
 * - minimal → complete (the web-bundle complete preset);
 * - bare → absent (no persona row);
 * - dynamic `!!js` disable → unresolved (typed conditional);
 * - the host preset service fails → typed unresolved (NEVER a `standard`
 *   guess, never a throw);
 * - a broken preset → typed unresolved;
 * - an unknown preset → typed unresolved;
 * - an inconsistent document (the inventory says enabled, the document
 *   contradicts) → typed unresolved;
 * - preflight == actual mount: the kind the preflight observes is the kind
 *   the mount performs (R7: a minimal root observes complete, not the
 *   legacy standard guess — the persona adapter's `complete` fatal is the
 *   mount-side consequence of the same observation).
 * @module @dsh-agent-team/runtime/test/live-persona-observer.test
 */

import { describe, expect, it } from 'vitest'
import {
  createProductionPersonaObserver,
  PERSONA_PLUGIN_MODULE_NAME,
  type AgentPresetPersonaSeam,
} from '../agent-setup/preset/index.js'

// --- the effective-declared-composition documents ----------------------------
// The exact YAML shapes the registry `readDocument` dumps (js-yaml
// entryListSchema: JSON schema + the `tag:yaml.org,2002:js` scalar tag).

const STANDARD_DOC = [
  '- id: agent-persona',
  `  name: '${PERSONA_PLUGIN_MODULE_NAME}'`,
  '  config:',
  '    suffix: Your working directory is {{cwd}}.',
  '    prefix: You are a coding agent powered by the {{model}} model.',
  '- id: tool-bash',
  "  name: '@deepseek-ai/dsh-terminal-bash'",
].join('\n')

const MINIMAL_DOC = [
  '- id: agent-persona',
  `  name: '${PERSONA_PLUGIN_MODULE_NAME}'`,
  '  config:',
  '    prefix: You are a helpful software engineer assistant.',
  '    complete: true',
  '    includeRuntimeContext: false',
  '- id: persistent-shell',
  '  name: cordis:group',
  '  group: true',
  '  isolate:',
  '    terminals: true',
  '  config:',
  '    - id: terminal-bash',
  "      name: '@deepseek-ai/dsh-terminal-bash'",
].join('\n')

const BARE_DOC = ['- id: tool-bash', "  name: '@deepseek-ai/dsh-terminal-bash'"].join('\n')

const DYNAMIC_DOC = [
  '- id: agent-persona',
  `  name: '${PERSONA_PLUGIN_MODULE_NAME}'`,
  `  disabled: !!js process.platform === 'win32'`,
  '  config:',
  '    prefix: x',
].join('\n')

// --- the seam doubles ---------------------------------------------------------

/**
 * The live service's composition entries (the real `AgentPresetComposition`
 * shape — `isDefault` / `name` ride along; the seam narrows them to the
 * mirror contract at the `seamOf` boundary, exactly as the production
 * mirror in host.ts does).
 */
interface ServiceCompositionEntry {
  readonly id: string
  readonly isDefault?: boolean
  readonly broken?: string
  readonly rows: readonly ReturnType<typeof row>[]
}

interface SeamWorld {
  readonly inventory: readonly ServiceCompositionEntry[]
  readonly documents: Record<string, string>
}

function seamOf(world: SeamWorld): AgentPresetPersonaSeam {
  return {
    compositionInventory: async () => world.inventory,
    readDocument: async (presetId: string) => {
      const document = world.documents[presetId]
      if (document === undefined) throw new Error(`unknown preset '${presetId}'`)
      return document
    },
  }
}

function row(entryId: string, moduleName: string, enabled: boolean | 'conditional', condition?: string) {
  return { entryId, moduleName, enabled, ...(condition !== undefined ? { condition } : {}) }
}

const PERSONA_ROW = row('agent-persona', PERSONA_PLUGIN_MODULE_NAME, true)

// --- the donor regression set (guide §5 C / PR #22) ---------------------------

describe('guide §5 C — the donor regression set (the PR #22 cases, live)', () => {
  it('ptc (the plain team composition) → standard (composable)', async () => {
    const observer = createProductionPersonaObserver(
      seamOf({
        inventory: [{ id: 'ptc', isDefault: true, rows: [PERSONA_ROW, row('tool-bash', '@deepseek-ai/dsh-terminal-bash', true)] }],
        documents: { ptc: STANDARD_DOC },
      }),
    )
    const observation = await observer.observe('ptc')
    expect(observation.kind).toBe('standard')
    expect(observation.source).toBe('composition-text')
  })

  it('minimal (the web-bundle complete preset) → complete (NOT the legacy standard guess)', async () => {
    const observer = createProductionPersonaObserver(
      seamOf({
        inventory: [{ id: 'minimal', isDefault: false, rows: [PERSONA_ROW, row('terminal-bash', '@deepseek-ai/dsh-terminal-bash', true)] }],
        documents: { minimal: MINIMAL_DOC },
      }),
    )
    const observation = await observer.observe('minimal')
    expect(observation.kind).toBe('complete')
    expect(observation.source).toBe('composition-text')
  })

  it('bare (no persona row) → absent', async () => {
    const observer = createProductionPersonaObserver(
      seamOf({
        inventory: [{ id: 'bare', isDefault: false, rows: [row('tool-bash', '@deepseek-ai/dsh-terminal-bash', true)] }],
        documents: { bare: BARE_DOC },
      }),
    )
    const observation = await observer.observe('bare')
    expect(observation.kind).toBe('absent')
    expect(observation.source).toBe('effective-composition')
  })

  it('a dynamic !!js disable → unresolved (typed — the mount-side expression is not evaluatable offline)', async () => {
    const observer = createProductionPersonaObserver(
      seamOf({
        inventory: [
          // The UNMOUNTED preset: the !!js row surfaces as 'conditional'.
          {
            id: 'dynamic',
            isDefault: false,
            rows: [row('agent-persona', PERSONA_PLUGIN_MODULE_NAME, 'conditional', "process.platform === 'win32'")],
          },
        ],
        documents: { dynamic: DYNAMIC_DOC },
      }),
    )
    const observation = await observer.observe('dynamic')
    expect(observation.kind).toBe('unresolved')
    expect(observation.source).toBe('effective-composition')
    expect(observation.reason).toContain('!!js')
  })

  it('a group-nested persona row (complete) → complete', async () => {
    const groupNestedDoc = [
      '- id: persistent-shell',
      '  name: cordis:group',
      '  group: true',
      '  config:',
      '    - id: agent-persona',
      `      name: '${PERSONA_PLUGIN_MODULE_NAME}'`,
      '      config:',
      '        prefix: x',
      '        complete: true',
    ].join('\n')
    const observer = createProductionPersonaObserver(
      seamOf({
        inventory: [{ id: 'nested', isDefault: false, rows: [row('agent-persona', PERSONA_PLUGIN_MODULE_NAME, true)] }],
        documents: { nested: groupNestedDoc },
      }),
    )
    const observation = await observer.observe('nested')
    expect(observation.kind).toBe('complete')
  })

  it('a literally disabled persona row → absent (nothing mounts)', async () => {
    const observer = createProductionPersonaObserver(
      seamOf({
        inventory: [{ id: 'off', isDefault: false, rows: [row('agent-persona', PERSONA_PLUGIN_MODULE_NAME, false)] }],
        documents: { off: [STANDARD_DOC, '  # (the inventory row is enabled:false — the loader disabled it)'].join('\n') },
      }),
    )
    const observation = await observer.observe('off')
    expect(observation.kind).toBe('absent')
    expect(observation.source).toBe('effective-composition')
  })
})

describe('guide §5 B — the seam failure modes (typed unresolved, never a standard guess, never a throw)', () => {
  it('the host preset service rejects (compositionInventory) → typed unresolved, source none', async () => {
    const observer = createProductionPersonaObserver({
      compositionInventory: async () => {
        throw new Error('agentPresets service unavailable')
      },
      readDocument: async () => '',
    })
    const observation = await observer.observe('ptc')
    expect(observation.kind).toBe('unresolved')
    expect(observation.source).toBe('none')
    expect(observation.reason).toContain('agentPresets service unavailable')
  })

  it('readDocument rejects → typed unresolved, source none', async () => {
    const observer = createProductionPersonaObserver({
      compositionInventory: async () => [{ id: 'ptc', isDefault: true, rows: [PERSONA_ROW] }],
      readDocument: async (presetId: string) => {
        throw new Error(`readDocument('${presetId}') rejected (preset store unavailable)`)
      },
    })
    const observation = await observer.observe('ptc')
    expect(observation.kind).toBe('unresolved')
    expect(observation.source).toBe('none')
    expect(observation.reason).toContain('readDocument')
  })

  it('a broken preset (rows unreadable) → typed unresolved carrying the diagnostic', async () => {
    const observer = createProductionPersonaObserver(
      seamOf({
        inventory: [{ id: 'broken', isDefault: false, broken: 'composition rows could not be read (yaml error at line 12)', rows: [] }],
        documents: { broken: BARE_DOC },
      }),
    )
    const observation = await observer.observe('broken')
    expect(observation.kind).toBe('unresolved')
    expect(observation.source).toBe('none')
    expect(observation.reason).toContain('could not be read')
  })

  it('an unknown preset (not in the live inventory) → typed unresolved', async () => {
    const observer = createProductionPersonaObserver(
      seamOf({
        inventory: [{ id: 'ptc', isDefault: true, rows: [PERSONA_ROW] }],
        documents: { ptc: STANDARD_DOC },
      }),
    )
    const observation = await observer.observe('never-mounted')
    expect(observation.kind).toBe('unresolved')
    expect(observation.source).toBe('none')
    expect(observation.reason).toContain("never-mounted")
  })

  it('an inconsistent document (inventory enabled but the document contradicts) → typed unresolved', async () => {
    // The inventory row says the persona is enabled, but the declared
    // document literally disables it (only a literal disable in the
    // document is an inconsistency — a !!js disable there is expected:
    // the mount evaluated it).
    const contradictoryDoc = [
      '- id: agent-persona',
      `  name: '${PERSONA_PLUGIN_MODULE_NAME}'`,
      '  disabled: true',
      '  config:',
      '    prefix: x',
    ].join('\n')
    const observer = createProductionPersonaObserver(
      seamOf({
        inventory: [{ id: 'ptc', isDefault: true, rows: [PERSONA_ROW] }],
        documents: { ptc: contradictoryDoc },
      }),
    )
    const observation = await observer.observe('ptc')
    expect(observation.kind).toBe('unresolved')
    expect(observation.source).toBe('composition-text')
    expect(observation.reason).toContain('inconsistent')
  })
})

describe('guide §5 C — preflight == actual mount (R7: the observed kind is the mounted kind)', () => {
  /**
   * The mount side (the persona adapter, agent-setup/persona/adapter.ts):
   * `absent` → no persona install (no error); `standard` → the scoped
   * identity install; `complete` → FATAL
   * `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT`. The mount performs exactly the
   * observation the preflight observed (same object, same kind) — this
   * helper models that execution and the test asserts the equality.
   */
  function mountKind(observation: { kind: 'absent' | 'standard' | 'complete' | 'unresolved' }): 'no-persona' | 'identity-installed' | 'fatal-conflict' | 'not-executable' {
    if (observation.kind === 'absent') return 'no-persona'
    if (observation.kind === 'standard') return 'identity-installed'
    if (observation.kind === 'complete') return 'fatal-conflict'
    return 'not-executable'
  }

  it('a standard root: the preflight observes standard and the mount installs the identity', async () => {
    const observer = createProductionPersonaObserver(
      seamOf({
        inventory: [{ id: 'ptc', isDefault: true, rows: [PERSONA_ROW] }],
        documents: { ptc: STANDARD_DOC },
      }),
    )
    const observed = await observer.observe('ptc')
    expect(mountKind(observed)).toBe('identity-installed')
    expect(observed.kind).toBe('standard')
  })

  it('a minimal root (R7): the preflight observes COMPLETE — the mount would fatal, the legacy standard guess is gone', async () => {
    const observer = createProductionPersonaObserver(
      seamOf({
        inventory: [{ id: 'minimal', isDefault: true, rows: [PERSONA_ROW] }],
        documents: { minimal: MINIMAL_DOC },
      }),
    )
    const observed = await observer.observe('minimal')
    // The observation the preflight carries is the same kind the mount
    // performs: complete → the §13.5 structural conflict is caught BEFORE
    // any member work (and the bind-time slot fails closed on it).
    expect(mountKind(observed)).toBe('fatal-conflict')
    expect(observed.kind).toBe('complete')
    expect(observed.kind).not.toBe('standard')
  })

  it('an unresolved observation is NOT executable (the bind rolls back, the retry re-probes)', async () => {
    const observer = createProductionPersonaObserver({
      compositionInventory: async () => {
        throw new Error('host down')
      },
      readDocument: async () => '',
    })
    const observed = await observer.observe('anything')
    expect(mountKind(observed)).toBe('not-executable')
  })
})
