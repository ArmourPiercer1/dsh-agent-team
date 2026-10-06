/**
 * rc2-persona-probe — the harness persona reader against the host's REAL
 * persona interface, plus two ledgers that refuse to let the residue come back.
 *
 * Background, because the shape of the bug is the lesson: four harness files and
 * one production module referenced a persona section named `deployment:persona`
 * / an export named `PERSONA_SECTION`. Neither has ever existed upstream —
 * checked at 0.1.5-rc.2 `fb2c4b9e69`, 0.1.7-rc.1 `46a7f68b09` and the pinned
 * 0.2.0-rc.2 `639ed01539`, all of which name `deployment:persona-prefix` and
 * `deployment:persona-suffix`. This is therefore NOT "0.2 got stricter": it is a
 * name our own T12-M2 commit invented (`ef331e7d`), and the harnesses that used
 * it could never have linked against any pinned host.
 *
 * The two slots are distinct positions in the prompt (prefix before first-party
 * guidance, suffix after it), so the reader keeps them apart: `personaText` is
 * the prefix text, `personaSuffixText` is reported separately, and nothing is
 * concatenated to resurrect a single "persona section" that never existed.
 *
 * Pure unit tests: no host boot, no fs writes, no clock.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PERSONA_PREFIX_SECTION, PERSONA_SUFFIX_SECTION } from '@deepseek-ai/dsh-system-prompt'
import {
  PERSONA_PROBE_KINDS,
  readPersonaSections,
} from '../root-binding/harness/persona-probe.mjs'
import { findTestRepoRoot, testUseTree } from '../../../tests/paths.mjs'

const REPO_ROOT = findTestRepoRoot(process.cwd())
if (REPO_ROOT === null) throw new Error('no repo root with tests/deepseek-harness-test-use')
const HOST = testUseTree(REPO_ROOT)
const pluginFile = (rel: string): string => readFileSync(join(REPO_ROOT, rel), 'utf8')
const hostFile = (rel: string): string => readFileSync(join(HOST, rel), 'utf8')

describe('PP1 the probe follows the host persona interface, not an invented one', () => {
  it('the host exports the two slots and never a bare persona section', () => {
    expect(PERSONA_PREFIX_SECTION).toBe('deployment:persona-prefix')
    expect(PERSONA_SUFFIX_SECTION).toBe('deployment:persona-suffix')
    const src = hostFile('packages/core/system-prompt/src/index.ts')
    expect(src).toContain("export const PERSONA_PREFIX_SECTION = 'deployment:persona-prefix'")
    expect(src).toContain("export const PERSONA_SUFFIX_SECTION = 'deployment:persona-suffix'")
    expect(/export const PERSONA_SECTION\b/.test(src)).toBe(false)
  })

  it('the persona row really has prefix / suffix / complete / includeRuntimeContext', () => {
    const src = hostFile('packages/preset/persona/src/index.ts')
    const start = src.indexOf('export const Config')
    expect(start).toBeGreaterThan(-1)
    const block = src.slice(start, src.indexOf('\n})', start))
    expect(block).toContain("prefix: z.string().required()")
    expect(block).toContain("suffix: z.string().default('')")
    expect(block).toContain("complete: z.boolean().default(false)")
    expect(block).toContain("includeRuntimeContext: z.boolean().default(true)")
    // Anchored at a key start: "includeRuntimeContext: z.boolean()" ends in the
    // letters "text:", so an unanchored scan sees a `text` key that is not there.
    expect(/(^|\n)\s*text:\s*z\./.test(block)).toBe(false)
    // One section per slot — this is why reading only one of them is incomplete
    // and joining them would be wrong.
    expect(src).toContain(`name: PERSONA_PREFIX_SECTION`)
    expect(src).toContain(`name: PERSONA_SUFFIX_SECTION`)
    expect(src).toContain('suppressRuntimeContext')
  })

  it('the probe names the slots by the host constants, with no private literals', () => {
    const src = pluginFile('packages/runtime/root-binding/harness/persona-probe.mjs')
    expect(src).toContain("import { PERSONA_PREFIX_SECTION, PERSONA_SUFFIX_SECTION } from '@deepseek-ai/dsh-system-prompt'")
    // A hardcoded copy would drift the moment upstream renames a slot.
    expect(/['"]deployment:persona(-prefix|-suffix)?['"]/.test(src.split('*/').pop() ?? '')).toBe(false)
  })
})

describe('PP2 the probe reports each slot separately', () => {
  const PREFIX = { name: PERSONA_PREFIX_SECTION, text: 'You are the leader.' }
  const SUFFIX = { name: PERSONA_SUFFIX_SECTION, text: 'Answer in Chinese.' }

  it('prefix only — the shape every persona this plugin declares produces', () => {
    const r = readPersonaSections({ sections: [PREFIX, { name: 'tools', text: '…' }] })
    expect(r.personaKind).toBe('standard')
    expect(r.personaText).toBe('You are the leader.')
    expect(r.personaSuffixText).toBeNull()
    expect(r.sectionNames).toEqual([PERSONA_PREFIX_SECTION, 'tools'])
  })

  it('prefix and suffix are never merged into one persona text', () => {
    const r = readPersonaSections({ sections: [PREFIX, { name: 'guidance', text: '…' }, SUFFIX] })
    expect(r.personaText).toBe('You are the leader.')
    expect(r.personaSuffixText).toBe('Answer in Chinese.')
    expect(r.personaText).not.toContain('Chinese')
    expect(r.personaKind).toBe('standard')
  })

  it('no persona slot at all', () => {
    const r = readPersonaSections({ sections: [{ name: 'tools', text: '…' }] })
    expect(r.personaKind).toBe('absent')
    expect(r.personaText).toBeNull()
    expect(r.personaSuffixText).toBeNull()
  })

  it('a lone prefix section is a complete persona, because that is what complete:true yields', () => {
    expect(readPersonaSections({ sections: [PREFIX] }).personaKind).toBe('complete')
    // The old proxy was `sections.length === 1` — a lone NON-persona section is
    // not a complete persona, and a lone suffix is not either.
    expect(readPersonaSections({ sections: [{ name: 'tools', text: '…' }] }).personaKind).toBe('absent')
    expect(readPersonaSections({ sections: [SUFFIX] }).personaKind).toBe('standard')
  })

  it('an empty or malformed assembly reads as absent rather than throwing', () => {
    expect(readPersonaSections({}).personaKind).toBe('absent')
    expect(readPersonaSections({ sections: [] }).personaKind).toBe('absent')
    expect(readPersonaSections(undefined as never).personaKind).toBe('absent')
    expect(readPersonaSections({ sections: [{}] } as never).personaKind).toBe('absent')
  })

  it('the kind vocabulary is closed and matches the harness contract', () => {
    expect([...PERSONA_PROBE_KINDS]).toEqual(['absent', 'standard', 'complete'])
  })
})

describe('PP3 the harness residue is gone and stays gone', () => {
  /**
   * Historical record (the archive this round must not launder away): these four
   * files imported the non-existent `PERSONA_SECTION` at `4b94810f` and earlier.
   * They are named so the guard can be checked against a concrete past; the
   * assertion below is that NONE of them — and nothing else under packages/ —
   * still does it.
   */
  const ONCE_IMPORTED_PERSONA_SECTION = [
    'packages/runtime/root-binding/harness/plugin.mjs',
    'packages/runtime/root-binding/harness/slots.mjs',
    'packages/runtime/member-residency/harness/plugin.mjs',
    'packages/runtime/member-residency/harness/slots-t6.mjs',
  ]

  it('no plugin source imports the invented PERSONA_SECTION export', () => {
    const offenders = ONCE_IMPORTED_PERSONA_SECTION
      .filter((rel) => /import\s*\{[^}]*\bPERSONA_SECTION\b/.test(pluginFile(rel)))
    expect(offenders).toEqual([])
    for (const rel of ONCE_IMPORTED_PERSONA_SECTION) {
      expect(pluginFile(rel)).toContain('readPersonaSections')
    }
  })

  it('no harness re-inlines a persona lookup on the assembly', () => {
    // The point of the shared probe: one reader, so the slot rule cannot drift
    // per call site the way six wire-shape oracles just did in the rc2 kit.
    const inlined = ONCE_IMPORTED_PERSONA_SECTION
      .map((rel) => ({ rel, hits: (pluginFile(rel).match(/sections\.find\(/g) ?? []).length }))
      .filter((entry) => entry.hits > 0)
    expect(inlined).toEqual([])
  })
})

describe('PP4 open ledger: production still registers the invented persona name', () => {
  /**
   * NOT fixed here, and not silently accepted either.
   *
   * `packages/runtime/src/plugin/live/agent-bindings.mjs` installs the team
   * persona with `systemPrompt.section({ name: 'deployment:persona', order: 0, text })`.
   * That slot name is not the persona slot in any pinned host, so the section is
   * added alongside the deployment persona instead of shadowing it. Observed in
   * the bounded rc2 run (evidence 08 run): the leader request's system prompt
   * opened with the shipped "You are an AI agent powered by DeepSeek Harness."
   * persona and carried the team persona after it — both in one prompt. Our own
   * comments at agent-bindings.mjs and plugin/types.ts describe that section as
   * "the agent-scoped 'deployment:persona' section", i.e. the belief that it
   * shadows has never matched the host.
   *
   * Changing it changes every team agent's system prompt, so it is a reviewer
   * decision plus a host-verified change, not a drive-by in an upgrade PR. This
   * ledger pins the exact current state: when the name is corrected to the real
   * prefix slot (or the shadowing claim is dropped from the comments), this test
   * fails on purpose and must be updated with the evidence that decided it.
   */
  const GLUE = 'packages/runtime/src/plugin/live/agent-bindings.mjs'

  it('the glue still registers the non-persona slot name (open defect, tracked)', () => {
    const glue = pluginFile(GLUE)
    const registersInventedName = /systemPrompt\.section\(\s*\{[^}]{0,80}?name:\s*'deployment:persona'/.test(glue)
    expect(registersInventedName).toBe(true)
    // And the host has never had that slot, so it cannot shadow anything:
    const hostSrc = hostFile('packages/core/system-prompt/src/index.ts')
    expect(hostSrc).toContain("'deployment:persona-prefix'")
    expect(/'deployment:persona'/.test(hostSrc)).toBe(false)
  })

  it('the reference tree claim about the older generations is reproducible when the tree is present', () => {
    const ref = join(REPO_ROOT, 'references', 'deepseek-harness-0.2.0-rc.2')
    if (!existsSync(ref)) return // read-only reference checkout is machine-local by design
    const src = readFileSync(join(ref, 'packages/core/system-prompt/src/index.ts'), 'utf8')
    expect(src).toContain("'deployment:persona-prefix'")
    expect(/export const PERSONA_SECTION\b/.test(src)).toBe(false)
  })
})
