/**
 * Gate B — `initialTemplateModelGrantOf`: the bound Blueprint template's
 * INITIAL STATIC model grant (the model-preference routing fix).
 *
 * The derivation is the SINGLE source every consumer shares (live request
 * boundary, activation step-8, the read-side `readTemplatePolicy`, and
 * the projections that assemble through it):
 *
 *   - absent `modelPreference`      -> `undefined` (the model cell stays
 *     `unspecified`; the deployment default applies at the consumer);
 *   - a QUALIFIED route             -> `allow [provider/model]` UNCHANGED
 *     (the template's explicit provider is never replaced by the
 *     deployment default's);
 *   - a MODEL-ONLY shorthand        -> `allow [<baseline.provider>/model]`
 *     (the deployment default's provider stands in — the documented
 *     Blueprint semantics);
 *   - a further slash               -> belongs to the model string
 *     (an `openrouter` catalog id stays intact);
 *   - a PRESENT-but-MALFORMED token (only via a template that bypassed the
 *     Blueprint strong validation)  -> THROWS the typed
 *     `InvalidTemplateModelPreferenceError` FAIL-LOUD (P2-1): it is never
 *     disguised as "absent" and never a silent staticModel fallback.
 *
 * The two semantics MUST stay apart (P2-1): ABSENT -> `undefined` (the
 * unspecified -> staticModel fallback); PRESENT+MALFORMED -> throw.
 *
 * Unit level over the REAL pure helper — no live world needed: the
 * live-glue / activation / read-side wiring of the SAME derivation is
 * covered by Gates D/E/F (the live "no staticModel fallback" integration
 * proof is S2 below + real-host R1/R2).
 *
 * @module @dsh-agent-team/runtime/test/template-model-preference
 */

import { describe, expect, it } from 'vitest'

import { parseTemplateId } from '../../contracts/src/index.js'
import type { BlueprintTemplate } from '../../domain/blueprint/src/index.js'
import {
  InvalidTemplateModelPreferenceError,
  initialTemplateModelGrantOf,
  isInvalidTemplateModelPreferenceError,
  MODEL_ERROR_CODES,
} from '../agent-setup/model/index.js'
import type { ModelSelection } from '../agent-setup/model/index.js'

const BASELINE: ModelSelection = { provider: 'qiyuan-self', model: 'default-model' }

function template(modelPreference: string | undefined): BlueprintTemplate {
  return {
    templateId: parseTemplateId('worker'),
    persona: 'You are the worker.',
    ...(modelPreference !== undefined ? { modelPreference } : {}),
  }
}

describe('Gate B: initialTemplateModelGrantOf (the bound template static model grant)', () => {
  it('B1 no modelPreference -> undefined (the cell stays unspecified)', () => {
    expect(initialTemplateModelGrantOf(template(undefined), BASELINE)).toBe(undefined)
  })

  it('B2 bare model token -> allow grant with the BASELINE provider', () => {
    expect(initialTemplateModelGrantOf(template('qwen3.8-27b'), BASELINE)).toEqual({
      kind: 'allow',
      items: ['qiyuan-self/qwen3.8-27b'],
    })
  })

  it('B3 qualified route -> stays EXACTLY the token (the template provider wins)', () => {
    expect(initialTemplateModelGrantOf(template('openai/gpt-6-astra'), BASELINE)).toEqual({
      kind: 'allow',
      items: ['openai/gpt-6-astra'],
    })
  })

  it('B4 the FIRST slash splits: further slashes belong to the model', () => {
    expect(
      initialTemplateModelGrantOf(template('openrouter/meta/llama-x'), BASELINE),
    ).toEqual({
      kind: 'allow',
      items: ['openrouter/meta/llama-x'],
    })
  })

  it('B5 malformed tokens (bypassing the validator) -> THROW the typed error (fail-loud, P2-1)', () => {
    for (const bad of ['/model', 'provider/', 'provider /model', 'provider/ model', ' ']) {
      expect(() => initialTemplateModelGrantOf(template(bad), BASELINE)).toThrow(
        InvalidTemplateModelPreferenceError,
      )
    }
  })

  it('B5b the thrown error carries the model-layer code + templateId + raw token (branch on code, not message)', () => {
    const bad = 'provider /model'
    try {
      initialTemplateModelGrantOf(template(bad), BASELINE)
      expect.unreachable('expected InvalidTemplateModelPreferenceError to be thrown')
    } catch (e) {
      if (!isInvalidTemplateModelPreferenceError(e)) {
        expect.unreachable(`expected InvalidTemplateModelPreferenceError, got: ${String(e)}`)
      }
      expect(e.code).toBe(MODEL_ERROR_CODES.INVALID_TEMPLATE_MODEL_PREFERENCE)
      expect(e.details.templateId).toBe('worker')
      expect(e.details.token).toBe(bad)
    }
  })

  it('B5c a Unicode whitespace token (U+1680 OGHAM SPACE MARK) is malformed -> throws (single-parser grammar, S1)', () => {
    const ogham = '\u1680'
    expect(() => initialTemplateModelGrantOf(template(`provider${ogham}/model`), BASELINE)).toThrow(
      InvalidTemplateModelPreferenceError,
    )
  })

  it('the baseline MODEL is never used (only its provider, and only for bare tokens)', () => {
    const bare = initialTemplateModelGrantOf(template('qwen3.8-27b'), BASELINE)
    expect(bare).toEqual({ kind: 'allow', items: ['qiyuan-self/qwen3.8-27b'] })
    const qualified = initialTemplateModelGrantOf(template('prov-x/model-y'), BASELINE)
    expect(qualified).toEqual({ kind: 'allow', items: ['prov-x/model-y'] })
  })
})

describe('S2 integration — a hand-built malformed template REJECTS the shared derivation (no staticModel fallback, P2-1)', () => {
  // This is the SINGLE derivation the live request boundary (observeAssembly /
  // agent-bindings), the activation step-8, and the inspect-config effect all
  // share. Proving it THROWS (rather than returning `undefined` -> the
  // staticModel baseline) proves NO boundary — including observeAssembly — can
  // silently fall back to the staticModel for a PRESENT-but-malformed
  // `modelPreference`: the only outcome for a malformed token is the typed
  // throw, so the rejected anti-pattern `catch { return staticModel }` cannot
  // produce a baseline grant.
  const staticModel: ModelSelection = { provider: 'qiyuan-self', model: 'deployment-default' }

  it('the derivation rejects a hand-built malformed template (it never returns the staticModel baseline)', () => {
    const malformed = template('provider /model') // hand-built, bypassing the Blueprint validator
    let outcome: unknown
    let threwInvalid = false
    try {
      outcome = initialTemplateModelGrantOf(malformed, staticModel)
    } catch (e) {
      if (!isInvalidTemplateModelPreferenceError(e)) throw e
      threwInvalid = true
    }
    expect(threwInvalid).toBe(true)
    // The ONLY outcome is the throw — the derivation returned NOTHING a boundary
    // could mistake for the staticModel (no `undefined` -> baseline, no silent
    // `{ provider: staticModel.provider, ... }` grant).
    expect(outcome).toBeUndefined()
  })

  it('the reject cannot be "defensively ignored" into the staticModel (the fix the guide forbids)', () => {
    const malformed = template('prov\x00ider/model') // a C0 control char — also malformed
    let caught: unknown
    try {
      initialTemplateModelGrantOf(malformed, staticModel)
      expect.unreachable('expected a throw for a malformed template')
    } catch (e) {
      caught = e
    }
    expect(isInvalidTemplateModelPreferenceError(caught)).toBe(true)
    const err = caught as InvalidTemplateModelPreferenceError
    // The error names the template + raw token (so the reject is diagnosable)
    // and carries the closed code (so a boundary branches on `code` and fails
    // loud, never `return staticModel`).
    expect(err.details.templateId).toBe('worker')
    expect(err.details.token).toBe('prov\x00ider/model')
    expect(err.code).toBe(MODEL_ERROR_CODES.INVALID_TEMPLATE_MODEL_PREFERENCE)
    // ...and the staticModel baseline is NEVER emitted for the malformed token.
    expect(JSON.stringify(err)).not.toContain(`${staticModel.provider}/${staticModel.model}`)
  })
})
