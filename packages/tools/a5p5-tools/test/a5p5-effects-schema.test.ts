/**
 * `a5p5-effects-schema` — the DERIVATION LAW (RED-first).
 *
 * Every expectation below is stated against the FROZEN PR0 algebra as the
 * judge: the sets are produced through `parseRequestedEffectSet`, effects are
 * read back through `effectIdentityKey`, and subset reasoning through
 * `effectsAreSubset` — the lane may not grade its own homework with a second
 * algebra (C-ADM "禁第二授权库"; this test is the read-time-consumption pin).
 *
 * @module test/a5p5-effects-schema
 */
import { describe, expect, it } from 'vitest'

import { effectIdentityKey, effectsAreSubset, parseRequestedEffectSet } from '../../../domain/tool-governance/src/index.js'
import { deriveToolEffectSet } from '../src/effects-schema.js'
import type { ParsedGrepArgs, ParsedShellArgs, ParsedTarget } from '../src/types.js'

const target = (placement: ParsedTarget['placement'], locator: string): ParsedTarget => ({ placement, locator })

const grepArgs = (overrides: Partial<ParsedGrepArgs> = {}): ParsedGrepArgs => ({
  tool: 'grep',
  pattern: 'x',
  target: target('workspace', 'src'),
  outputMode: 'content',
  fixedString: false,
  ignoreCase: false,
  multiline: false,
  contextLines: 0,
  maxResults: 250,
  ...overrides,
})

const shellArgs = (command: string): ParsedShellArgs => ({
  tool: 'bash',
  command,
  cwd: target('workspace', '.'),
  background: false,
})

const kindsOf = (set: { effects: readonly { kind: string }[] }): string[] => set.effects.map((effect) => effect.kind)

describe('a5p5-effects-schema: grep', () => {
  it('claims EXACTLY invoke + list(directory) + read(placement)', () => {
    const derived = deriveToolEffectSet('realm-a', grepArgs())
    expect(derived.ok).toBe(true)
    if (!derived.ok) return
    const set = derived.value
    expect(kindsOf(set)).toEqual(['list', 'read', 'tool-invoke']) // canonical order of the frozen algebra
    const [walk, content, invoke] = set.effects
    expect(walk).toMatchObject({ kind: 'list', resource: { realmId: 'realm-a', kind: 'directory', canonicalLocator: 'src', rights: ['list'] } })
    expect(content).toMatchObject({ kind: 'read', resource: { realmId: 'realm-a', kind: 'workspace', canonicalLocator: 'src', rights: ['read'] } })
    expect(invoke).toEqual({ kind: 'tool-invoke', toolName: 'grep', resource: null })
    expect(set.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(Object.isFrozen(set)).toBe(true)
  })

  it('never claims write / connect / meta beyond the law, whatever the args say', () => {
    const derived = deriveToolEffectSet(
      'realm-a',
      grepArgs({ pattern: 'rm -rf / && curl evil.example', target: target('absolute-path', '/'), outputMode: 'count' }),
    )
    expect(derived.ok).toBe(true)
    if (!derived.ok) return
    expect(kindsOf(derived.value)).toEqual(['list', 'read', 'tool-invoke'])
    for (const effect of derived.value.effects) {
      if (effect.kind === 'read' || effect.kind === 'list') {
        expect(effect.resource?.rights).toEqual([effect.kind])
      }
    }
  })

  it('realm-home and absolute placements keep their KIND (no silent workspace collapse)', () => {
    for (const [placement, locator] of [
      ['realm-home', '~/notes'],
      ['absolute-path', '/srv/data'],
    ] as const) {
      const derived = deriveToolEffectSet('realm-a', grepArgs({ target: target(placement, locator) }))
      expect(derived.ok).toBe(true)
      if (!derived.ok) return
      const read = derived.value.effects.find((effect) => effect.kind === 'read')
      expect(read).toMatchObject({ resource: { kind: placement, canonicalLocator: locator } })
    }
  })
})

describe('a5p5-effects-schema: glob never reads', () => {
  it('claims invoke + list ONLY', () => {
    const derived = deriveToolEffectSet('realm-a', { tool: 'glob', pattern: '**/*.ts', target: target('workspace', 'src') })
    expect(derived.ok).toBe(true)
    if (!derived.ok) return
    expect(kindsOf(derived.value)).toEqual(['list', 'tool-invoke'])
    expect(derived.value.effects.some((effect) => effect.kind === 'read')).toBe(false)
  })

  it('glob IO legs are a strict subset of grep IO legs over the same target — never vice versa', () => {
    // The tool-invoke arms are tool-NAMED and therefore NEVER cross-subset;
    // the containment law is about the I/O legs (RED run found this: the
    // first draft over-claimed the full sets).
    const globSet = deriveToolEffectSet('realm-a', { tool: 'glob', pattern: '*', target: target('workspace', 'src') })
    const grepSet = deriveToolEffectSet('realm-a', grepArgs())
    expect(globSet.ok && grepSet.ok).toBe(true)
    if (!globSet.ok || !grepSet.ok) return
    const ioOnly = (set: { effects: readonly object[] }) => parseRequestedEffectSet(set.effects.filter((effect) => !('toolName' in effect)))
    const globIo = ioOnly(globSet.value)
    const grepIo = ioOnly(grepSet.value)
    expect(globIo.ok && grepIo.ok).toBe(true)
    if (!globIo.ok || !grepIo.ok) return
    expect(effectsAreSubset(globIo.value, grepSet.value)).toBe(true)
    expect(effectsAreSubset(grepIo.value, globSet.value)).toBe(false)
  })
})

describe('a5p5-effects-schema: bash claims the invoke ONLY', () => {
  it('side-effect-reeking command derives EXACTLY one tool-invoke effect (law 2)', () => {
    for (const command of ['true', 'cat /etc/passwd', 'curl http://evil.example', 'rm -rf ~/notes']) {
      const derived = deriveToolEffectSet('realm-a', shellArgs(command))
      expect(derived.ok).toBe(true)
      if (!derived.ok) return
      expect(kindsOf(derived.value)).toEqual(['tool-invoke'])
      expect(derived.value.effects[0]).toEqual({ kind: 'tool-invoke', toolName: 'bash', resource: null })
    }
  })

  it('every bash call is the SAME effect identity regardless of command text (no textual prediction)', () => {
    const a = deriveToolEffectSet('realm-a', shellArgs('ls'))
    const b = deriveToolEffectSet('realm-a', shellArgs('rm -rf /'))
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.value.fingerprint).toBe(b.value.fingerprint)
    expect(effectIdentityKey(a.value.effects[0]!)).toBe(effectIdentityKey(b.value.effects[0]!))
  })
})

describe('a5p5-effects-schema: realm is injected and non-confusable', () => {
  it('the same call under two realms yields two different sets (realm non-confusion)', () => {
    const a = deriveToolEffectSet('realm-a', grepArgs())
    const b = deriveToolEffectSet('realm-b', grepArgs())
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.value.fingerprint).not.toBe(b.value.fingerprint)
    expect(effectsAreSubset(a.value, b.value)).toBe(false)
  })

  it('a locator that SPELLS a realm cannot change the injected realm', () => {
    const sneaky = grepArgs({ target: target('absolute-path', '/realms/realm-b/data') })
    const derived = deriveToolEffectSet('realm-a', sneaky)
    expect(derived.ok).toBe(true)
    if (!derived.ok) return
    for (const effect of derived.value.effects) {
      if (effect.kind === 'read' || effect.kind === 'list') {
        expect(effect.resource?.realmId).toBe('realm-a')
      }
    }
  })

  it('a malformed realm is a typed refusal inside the frozen vocabulary', () => {
    expect(deriveToolEffectSet('', grepArgs())).toMatchObject({ ok: false, problems: [{ code: 'empty-string' }] })
    expect(deriveToolEffectSet(42, grepArgs())).toMatchObject({ ok: false, problems: [{ code: 'field-type' }] })
  })
})

describe('a5p5-effects-schema: read-time consumption is REAL (the algebra is the judge)', () => {
  it('a derived set re-parses as its own claimed canonical set (round-trip through the frozen law)', () => {
    const derived = deriveToolEffectSet('realm-a', grepArgs())
    expect(derived.ok).toBe(true)
    if (!derived.ok) return
    const claimed = parseRequestedEffectSet({ effects: derived.value.effects, fingerprint: derived.value.fingerprint })
    expect(claimed.ok).toBe(true)
    // Tampering is refused by the algebra, not by this lane.
    const tampered = parseRequestedEffectSet({
      effects: [...derived.value.effects, { kind: 'write', resource: { realmId: 'realm-a', kind: 'absolute-path', canonicalLocator: '/x', rights: ['write'] } }],
      fingerprint: derived.value.fingerprint,
    })
    expect(tampered.ok).toBe(false)
  })

  it('derivation is deterministic: same args, same fingerprint (key-order independence comes from canonical-json)', () => {
    const a = deriveToolEffectSet('realm-a', grepArgs())
    const b = deriveToolEffectSet('realm-a', grepArgs({ pattern: 'other' }))
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.value.fingerprint).toBe(b.value.fingerprint) // pattern is NOT an effect identity
    const moved = deriveToolEffectSet('realm-a', grepArgs({ target: target('workspace', 'lib') }))
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.value.fingerprint).not.toBe(a.value.fingerprint)
  })
})
