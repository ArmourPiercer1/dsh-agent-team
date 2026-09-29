/**
 * pre-alpha3 PR-C §C.3 — the ObservedPersonaKind four-state (plan §C.3).
 *
 * Locks the closed four-state vocabulary of the OBSERVED persona kind (the
 * distinct 4-state — `absent | standard | complete | unresolved` — NOT the
 * three-state `PresetPersonaKind` the legacy persona slot uses):
 * - `absent` — no effective persona observed on the mounted preset;
 * - `standard` — a composable non-complete effective persona observed;
 * - `complete` — a complete effective persona observed (structural FATAL for
 *   Team, §13.5);
 * - `unresolved` — a TYPED host/probe failure (fail-closed, never a kind
 *   guess, NOT ordinary incompatibility).
 *
 * The `unresolved` state is the key difference from the legacy 3-state: a
 * typed observation failure is surfaced as `unresolved` (never collapsed to
 * `standard` — that would be the false OPEN the plan forbids).
 */
import { describe, expect, it } from 'vitest'
import {
  OBSERVED_PERSONA_KINDS,
  OBSERVED_PERSONA_KIND_VALUES,
  assertObservedPersonaKind,
  type ObservedPersonaKind,
} from '../agent-setup/preset/index.js'

describe('PR-C C.3 — the observed persona kind four-state', () => {
  it('the vocabulary is exactly absent | standard | complete | unresolved (closed 4-set)', () => {
    expect([...OBSERVED_PERSONA_KIND_VALUES].sort()).toEqual(['absent', 'complete', 'standard', 'unresolved'])
    expect(OBSERVED_PERSONA_KINDS.absent).toBe('absent')
    expect(OBSERVED_PERSONA_KINDS.standard).toBe('standard')
    expect(OBSERVED_PERSONA_KINDS.complete).toBe('complete')
    expect(OBSERVED_PERSONA_KINDS.unresolved).toBe('unresolved')
  })

  it('the 4-state is DISTINCT from the legacy 3-state (unresolved is a NEW state, not a legacy kind)', () => {
    // The legacy PresetPersonaKind (absent | standard | complete) has no
    // `unresolved` — the 4-state adds the typed observation failure.
    const legacy = ['absent', 'standard', 'complete']
    for (const value of OBSERVED_PERSONA_KIND_VALUES) {
      if (value === 'unresolved') continue
      expect(legacy).toContain(value)
    }
    expect(OBSERVED_PERSONA_KIND_VALUES).toContain('unresolved')
  })

  it('assertObservedPersonaKind accepts every closed value', () => {
    for (const value of OBSERVED_PERSONA_KIND_VALUES) {
      expect(assertObservedPersonaKind(value, 'k')).toBe(value as ObservedPersonaKind)
    }
  })

  it('assertObservedPersonaKind rejects a value outside the 4-set (fail-closed MALFORMED_DTO)', () => {
    expect(() => assertObservedPersonaKind('bogus', 'k')).toThrowError(/unknown observed persona kind/)
    expect(() => assertObservedPersonaKind(42, 'k')).toThrowError(/unknown observed persona kind/)
    expect(() => assertObservedPersonaKind(undefined, 'k')).toThrowError(/unknown observed persona kind/)
  })

  it('unresolved is a typed failure (never a kind guess) — it is NOT collapsed to standard', () => {
    // The plan forbids collapsing a typed observation failure to a kind
    // (that would be the false OPEN). The 4-state keeps `unresolved` distinct
    // from `standard`.
    expect(OBSERVED_PERSONA_KINDS.unresolved).not.toBe(OBSERVED_PERSONA_KINDS.standard)
  })
})
