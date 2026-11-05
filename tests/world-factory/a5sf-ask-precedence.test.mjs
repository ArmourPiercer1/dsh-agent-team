/**
 * a5sf-ask-precedence.test.mjs — the `deny > ask > allow` order, as a regression arm.
 *
 * WHY THIS FILE EXISTS: `A5-DUAL-PLANE-01` (2026-11-05) was approved on a probe — the
 * reviewer asked for the precedence to be confirmed, and it was measured on the built
 * output, but no committed test asserted the `deny + ask` OVERLAP. An overlap is the
 * only shape where the order is observable: with a deny subtree and an ask rule both
 * covering one locator, a broken precedence silently turns a refusal into a prompt.
 * A measurement without an arm rots the moment someone reorders two lines.
 *
 * These are pure decision-table assertions against `matchLocator`; no Host, no port,
 * no Provider. The admission-level consequence of `ask` is covered separately by
 * `a5sf-dual-plane.test.mjs` (DP-REFUSE) and the ask-closed arms.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { matchLocator } from '../../packages/runtime/dist/packages/runtime/member-io-policy/src/path-rules.js'

const lane = (over = {}) => Object.freeze({ mode: 'all', allow: [], deny: [], ask: [], ...over })

test('ASK-P1 an explicit deny subtree wins over an ask rule covering the same locator', () => {
  // The overlap shape: both rules name the same subtree.
  assert.equal(matchLocator(lane({ deny: ['/w/secret'], ask: ['/w/secret'] }), '/w/secret/x'), 'deny')
  // And when ask is the WIDER rule and deny the narrower one.
  assert.equal(matchLocator(lane({ deny: ['/w/a/deep'], ask: ['/w/a'] }), '/w/a/deep/f'), 'deny')
  // Sibling of the deny must stay ask, otherwise the deny is over-applied.
  assert.equal(matchLocator(lane({ deny: ['/w/a/deep'], ask: ['/w/a'] }), '/w/a/other/f'), 'ask')
})

test('ASK-P2 ask is never promoted to allow by a covering allow', () => {
  // mode:'all' is the widest possible allow; ask must still win.
  assert.equal(matchLocator(lane({ ask: ['/w/a'] }), '/w/a/b'), 'ask')
  // An explicit allow locator that also covers the asked locator.
  assert.equal(matchLocator(Object.freeze({ mode: 'subtree', allow: ['/w'], deny: [], ask: ['/w/a'] }), '/w/a/b'), 'ask')
})

test('ASK-P3 allow serves and an uncovered locator is denied (no implicit permission)', () => {
  assert.equal(matchLocator(lane(), '/w/ok'), 'allow')
  assert.equal(matchLocator(Object.freeze({ mode: 'subtree', allow: ['/w/ok'], deny: [], ask: [] }), '/w/no'), 'deny')
  // An ask rule elsewhere must not affect an unrelated locator.
  assert.equal(matchLocator(lane({ ask: ['/w/a'] }), '/w/ok'), 'allow')
})

test('ASK-P4 the order is total: every locator gets exactly one of deny/ask/allow', () => {
  const shapes = [
    lane(),
    lane({ deny: ['/w/d'] }),
    lane({ ask: ['/w/a'] }),
    lane({ deny: ['/w/d'], ask: ['/w/a'] }),
    Object.freeze({ mode: 'subtree', allow: ['/w/a'], deny: ['/w/d'], ask: ['/w/a/b'] }),
  ]
  const locators = ['/w/a', '/w/a/b', '/w/d', '/w/d/e', '/w/z']
  for (const shape of shapes) {
    for (const loc of locators) {
      const got = matchLocator(shape, loc)
      assert.ok(['deny', 'ask', 'allow'].includes(got), `${loc} -> ${got}`)
    }
  }
})
