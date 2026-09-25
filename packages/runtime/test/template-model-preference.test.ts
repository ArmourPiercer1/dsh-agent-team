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
 *   - a MALFORMED token (only via a template that bypassed the Blueprint
 *     strong validation)            -> `undefined` FAIL-CLOSED: no guessed
 *     provider/model, no silent staticModel fallback.
 *
 * Unit level over the REAL pure helper — no live world needed: the
 * live-glue / activation / read-side wiring of the SAME derivation is
 * covered by Gates D/E/F.
 *
 * @module @dsh-agent-team/runtime/test/template-model-preference
 */

import { describe, expect, it } from 'vitest'

import { parseTemplateId } from '../../contracts/src/index.js'
import type { BlueprintTemplate } from '../../domain/blueprint/src/index.js'
import { initialTemplateModelGrantOf } from '../agent-setup/model/index.js'
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

  it('B5 malformed tokens (bypassing the validator) -> undefined, fail closed', () => {
    for (const bad of ['/model', 'provider/', 'provider /model', 'provider/ model', ' ']) {
      expect(initialTemplateModelGrantOf(template(bad), BASELINE)).toBe(undefined)
    }
  })

  it('the baseline MODEL is never used (only its provider, and only for bare tokens)', () => {
    const bare = initialTemplateModelGrantOf(template('qwen3.8-27b'), BASELINE)
    expect(bare).toEqual({ kind: 'allow', items: ['qiyuan-self/qwen3.8-27b'] })
    const qualified = initialTemplateModelGrantOf(template('prov-x/model-y'), BASELINE)
    expect(qualified).toEqual({ kind: 'allow', items: ['prov-x/model-y'] })
  })
})
