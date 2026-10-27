/**
 * `a5p5-shell-effect-mapping` — the DECLARED→REQUESTED law for BOTH shell
 * rows (REVIEW-402 round-1 ruling 1).
 *
 * The process contribution declares `kinds: ['tool-invoke','process-spawn']`
 * while each shell row REQUESTS only the `tool-invoke(<class>)` arm — a
 * shape the bash row has carried since U6 PR3 (reviewed). The spawn
 * authority is not missing: under A2C-1 the class's `tool-invoke` arm IS
 * the spawn authority (the command is the authority key, hashed verbatim —
 * process-family/src/bash-normalizer.ts), and `process-spawn` is not a
 * requestable kind at all (the closed EFFECT_KINDS vocabulary). What was
 * missing was the EXPLICIT mapping — implicit is how the #390 real gap
 * slipped. This test is that explicitness, as a binding:
 *
 *   1. the exported `DECLARED_TO_REQUESTED` table is frozen and its image
 *      lies inside the requestable vocabulary (EFFECT_KINDS);
 *   2. the contribution's declared kinds are EXACTLY the table's domain;
 *   3. per ROW, the mapping lands in that row's ACTUAL requested effect
 *      set — bash through the plane's own `parseBashArgs` +
 *      `deriveToolEffectSet` (the very call a dispatch makes), pwsh through
 *      the executor's captured PA-edge call (a fake PA, zero Host);
 *   4. MUTATION CONTROL: an unmapped declared kind (planted 'network') and
 *      a removed table entry ('process-spawn' un-mapped) each go RED — the
 *      law is never vacuous.
 *
 * Nothing here moves admission: both executors' requested sets are read,
 * never rewritten.
 *
 * @module test/a5p5-shell-effect-mapping
 */
import { describe, expect, it } from 'vitest'

import { EFFECT_KINDS } from '../../../domain/tool-governance/src/index.js'
import { parseBashArgs } from '../src/args.js'
import { deriveToolEffectSet } from '../src/effects-schema.js'

// The lane .mjs faces arrive through the dynamic-import law the TS tests
// carry for un-declared lane modules (u6-pr3-kernel-flow / u74a pattern).
const {
  buildProcessShellContribution,
  DECLARED_TO_REQUESTED,
  createGovernedPwshExecutor,
} = await import(new URL('../../process-family/src/index.mjs', import.meta.url).href) as {
  buildProcessShellContribution: (input: Record<string, unknown>) => { effects: { kinds: readonly string[] } }
  DECLARED_TO_REQUESTED: Readonly<Record<string, string>>
  createGovernedPwshExecutor: (config: Record<string, unknown>) => (raw: unknown, corr: unknown) => Promise<unknown>
}

/** The law itself, as a judge: every declared kind must have a table entry,
 *  its mapped kind must be REQUESTABLE (EFFECT_KINDS), and it must be
 *  present in the row's actual requested kinds. Returns the findings. */
function mappingFindings(
  declared: readonly string[],
  table: Readonly<Record<string, string>>,
  requestedKinds: ReadonlySet<string>,
): string[] {
  const problems: string[] = []
  for (const kind of declared) {
    const mapped = table[kind]
    if (mapped === undefined) {
      problems.push(`declared kind '${kind}' has no DECLARED_TO_REQUESTED entry`)
      continue
    }
    if (!(EFFECT_KINDS as readonly string[]).includes(mapped)) problems.push(`mapped kind '${mapped}' is not requestable (absent from EFFECT_KINDS)`)
    if (!requestedKinds.has(mapped)) problems.push(`mapped kind '${mapped}' is absent from the row's requested set`)
  }
  return problems
}

function buildContribution() {
  const row = (name: string) => ({ name, parameters: { type: 'object' }, execute: async () => ({ text: '' }) })
  return buildProcessShellContribution({
    definition: row('team_bash'),
    cancelBoundary: 'a',
    pwsh: { definition: row('pwsh'), cancelBoundary: 'b' },
  })
}

describe('a5p5-shell-effect-mapping: the DECLARED→REQUESTED table', () => {
  it('the table is frozen and every mapped kind is requestable', () => {
    expect(Object.isFrozen(DECLARED_TO_REQUESTED)).toBe(true)
    for (const mapped of Object.values(DECLARED_TO_REQUESTED)) {
      expect(EFFECT_KINDS as readonly string[], `mapped kind ${mapped}`).toContain(mapped)
    }
  })
  it('the contribution declares EXACTLY the table domain (neither drifts)', () => {
    const declared = buildContribution().effects.kinds
    expect([...declared].sort()).toEqual(Object.keys(DECLARED_TO_REQUESTED).sort())
  })
})

describe('a5p5-shell-effect-mapping: per-row law over the ACTUAL requested sets', () => {
  it('bash: every declared kind maps into the plane-derived requested set of the bash row', () => {
    const parsed = parseBashArgs({ command: 'Set-Content -Path note.txt -Value hi' })
    if (parsed.ok !== true) throw new Error(`the plane refused its own golden bash args: ${JSON.stringify(parsed.problems)}`)
    const derived = deriveToolEffectSet('realm-u7f-map', parsed.value)
    if (derived.ok !== true) throw new Error(`derivation refused: ${JSON.stringify(derived.problems)}`)
    const requestedKinds = new Set(derived.value.effects.map((effect) => (effect as { kind: string }).kind))
    expect([...requestedKinds]).toEqual(['tool-invoke'])
    expect(mappingFindings(buildContribution().effects.kinds, DECLARED_TO_REQUESTED, requestedKinds)).toEqual([])
  })
  it('pwsh: every declared kind maps into the executor\'s ACTUAL PA-edge requested set', async () => {
    interface PaCall { requestedEffects: { effects?: readonly { kind?: string }[] } }
    const calls: PaCall[] = []
    const ex = createGovernedPwshExecutor({
      realmId: 'realm-u7f-map', templateId: 'tpl', instanceId: 'inst', callIdPrefix: 'u7fm',
      decide: () => ({ kind: 'allow' }),
      pa: async (call: PaCall) => { calls.push(call); return { kind: 'allow' } },
      policy: { default: 'allow', allow: [], ask: [], deny: [] },
      backend: {
        backendId: 'scripted',
        run: async () => ({ ok: true, outcome: { exitCode: 0, stdout: 'done', stderr: '', timedOut: false, cancelled: false, truncated: false } }),
      },
      observe: () => {},
    })
    const answer = await ex({ command: 'Get-Date', description: 'map law witness' }, {}) as { kind?: string }
    expect(answer.kind).toBe('ok')
    const call = calls[0]
    if (call === undefined) throw new Error('the pwsh PA edge was never entered')
    const effects = call.requestedEffects.effects
    if (effects === undefined) throw new Error('the PA call carries no requested effects array')
    const requestedKinds = new Set(effects.map((effect) => String(effect.kind)))
    expect([...requestedKinds]).toEqual(['tool-invoke'])
    expect(mappingFindings(buildContribution().effects.kinds, DECLARED_TO_REQUESTED, requestedKinds)).toEqual([])
  })
})

describe('a5p5-shell-effect-mapping: mutation controls (the law can fail)', () => {
  it('an UNMAPPED declared kind (planted network) goes RED', () => {
    const requestedKinds = new Set(['tool-invoke'])
    const planted = [...buildContribution().effects.kinds, 'network']
    const findings = mappingFindings(planted, DECLARED_TO_REQUESTED, requestedKinds)
    expect(findings).toEqual([expect.stringContaining('network')])
  })
  it('a REMOVED table entry (process-spawn un-mapped) goes RED', () => {
    const requestedKinds = new Set(['tool-invoke'])
    const stripped: Record<string, string> = { 'tool-invoke': 'tool-invoke' }
    const findings = mappingFindings(buildContribution().effects.kinds, stripped, requestedKinds)
    expect(findings).toEqual([expect.stringContaining('process-spawn')])
  })
})
