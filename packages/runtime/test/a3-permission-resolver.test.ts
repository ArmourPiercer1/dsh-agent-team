/**
 * a3-permission-resolver.test.ts — A3 (alpha.2, plan §8) MUST-TEST: the
 * pure static operation permission resolver (plan §8.4 minimum, all
 * cases covered):
 *
 * - allow / ask / deny exact (rule key === operation resource key);
 * - any allow / any ask / any deny (whole-tool match);
 * - frozen priority `deny > ask > allow > policy.default` (plan §8.3),
 *   including deny winning over matching ask/allow rules with the
 *   provenance pointing at the deciding (deny) lane;
 * - no match + default ask / default deny (source 'default', effect =
 *   policy.default, lane/ruleIndex omitted);
 * - same canonical key / different display → SAME decision (display is
 *   never authority); different canonical key → no match;
 * - keys compared verbatim (no case folding, no startsWith, no path
 *   parsing, no trimming in A3 — trimming is A1's normalization);
 * - the recorded bash ruling (plan §4): a bash `any` rule matches the
 *   bash operation in ANY lane (whole-tool allow/ask/deny); an exact
 *   bash rule is INERT BY CONSTRUCTION (never matches, even when its
 *   key string equals the tool-level key); file rules never match a
 *   bash operation and vice-versa;
 * - provenance first-match indexing in declaration order (two matching
 *   allow rules → ruleIndex 0; first misses + second matches →
 *   ruleIndex 1);
 * - determinism (same input → structurally identical output, across
 *   fresh-but-equal input objects);
 * - the A2 handoff vocabulary pin: A2 `PERMISSION_TOOL_VALUES`
 *   deep-equals A1 `PERMISSION_TOOL_NAMES` (same six names, same
 *   order) — the two definitions must never diverge (plan §6.2).
 *
 * The resolver is PURE over canonical identities (plan §8): the
 * fixtures are small `CanonicalOperation` / `CanonicalRules` literals
 * (no fs, no `canonicalizeOperation` call, no path resolution anywhere
 * — A5 owns that; A3 receives canonical keys and compares them). A3
 * reads ONLY `policy.default` from the A1 policy (the lanes it matches
 * arrive as `canonicalRules`), so the fixtures derive an A1-form
 * policy from the canonical rules to keep the policy argument honest.
 *
 * RUNNER CONSTRAINTS (this repo's plain-node shim — see
 * `d1-team-ownership-index.test.ts` header): every `it` body is a
 * pure synchronous assertion (the resolver is synchronous). Shim
 * matchers used: toBe / toEqual (+.not) only — `undefined` is pinned
 * via `toBe(undefined)` (the shim surface has no toBeUndefined).
 *
 * SELF-CLEANLINESS: this file is inside the P4-T6 whole-tree scanner's
 * scope (`packages/**`), so no legacy Team SessionEvent denylist token
 * may appear in this source — none does.
 *
 * @module @dsh-agent-team/runtime/test/a3-permission-resolver
 */
import { describe, expect, it } from 'vitest'
import {
  BASH_TOOL_RESOURCE_KEY,
  PERMISSION_TOOL_VALUES,
  resolveOperationPermission,
} from '../operation-permission/index.js'
import type { CanonicalOperation, CanonicalRule, CanonicalRules } from '../operation-permission/index.js'
import { PERMISSION_TOOL_NAMES } from '../../domain/blueprint/src/index.js'
import type { PermissionRule, PermissionTool, TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'

// ---------------------------------------------------------------------------
// Fixtures: opaque canonical keys (an A2 local-backend realpath-like
// identity), the bash tool-level resource, and small rules/policy
// builders. The fingerprint is opaque to the resolver — any string.
// ---------------------------------------------------------------------------

const KEY_A = 'fskey:/workspace/a.txt'
const KEY_B = 'fskey:/workspace/b.txt'
const KEY_C = 'fskey:/workspace/sub/c.txt'

const FINGERPRINT = 'sha256:' + '0'.repeat(64)

/** One file-tool canonical operation (the resource key is the authority). */
function fileOp(tool: PermissionTool, key: string, display: string): CanonicalOperation {
  return {
    tool,
    resource: { kind: 'file', key, display },
    fingerprint: FINGERPRINT,
  }
}

/** The bash canonical operation (tool-level resource, plan §7.1). */
function bashOp(): CanonicalOperation {
  return {
    tool: 'bash',
    resource: { kind: 'tool', key: BASH_TOOL_RESOURCE_KEY, display: BASH_TOOL_RESOURCE_KEY },
    fingerprint: FINGERPRINT,
  }
}

/** One canonical rule (A5-normalized form: exact.key is a canonical key). */
function exactRule(tool: PermissionTool, key: string): CanonicalRule {
  return { tool, resource: { kind: 'exact', key } }
}

/** One canonical `any` rule (whole tool, no resource identity). */
function anyRule(tool: PermissionTool): CanonicalRule {
  return { tool, resource: { kind: 'any' } }
}

/** An empty-rules triple (the no-match cases). */
function emptyRules(): CanonicalRules {
  return { allow: [], ask: [], deny: [] }
}

/**
 * Derive the A1-form policy for the resolver's `policy` argument from
 * the canonical rules (identity mapping: exact.key → exact.path — the
 * key is a string, and the A3 resolver NEVER reads the policy's lanes,
 * only `policy.default`; this keeps the fixture honest — the policy
 * argument is exactly what the policy WOULD look like before A5's
 * per-rule canonicalization).
 */
function policyFrom(def: 'ask' | 'deny', rules: CanonicalRules): TemplatePermissionPolicy {
  const toRule = (r: CanonicalRule): PermissionRule =>
    r.resource.kind === 'exact'
      ? { tool: r.tool, resource: { kind: 'exact', path: r.resource.key } }
      : { tool: r.tool, resource: { kind: 'any' } }
  return {
    default: def,
    allow: rules.allow.map(toRule),
    ask: rules.ask.map(toRule),
    deny: rules.deny.map(toRule),
  }
}

/** The exact expected rule-decision shape (decision + full provenance). */
function ruleDecision(lane: 'allow' | 'ask' | 'deny', ruleIndex: number): unknown {
  return {
    decision: lane,
    provenance: { source: 'rule', effect: lane, lane, ruleIndex },
  }
}

/** The exact expected default-decision shape (no lane / ruleIndex keys). */
function defaultDecision(effect: 'ask' | 'deny'): unknown {
  return {
    decision: effect,
    provenance: { source: 'default', effect },
  }
}

// ---------------------------------------------------------------------------
// Matcher (plan §8.2, frozen)
// ---------------------------------------------------------------------------

describe('a3 static resolver — matcher over canonical identities (plan §8.2, frozen)', () => {
  it('allow exact: matching key → allow with rule provenance (lane allow, ruleIndex 0)', () => {
    const rules: CanonicalRules = { allow: [exactRule('read', KEY_A)], ask: [], deny: [] }
    const decision = resolveOperationPermission(
      policyFrom('ask', rules),
      fileOp('read', KEY_A, 'display:/workspace/a.txt'),
      rules,
    )
    expect(decision).toEqual(ruleDecision('allow', 0))
  })

  it('ask exact: matching key, no deny/allow → ask with rule provenance (lane ask, ruleIndex 0)', () => {
    const rules: CanonicalRules = { allow: [], ask: [exactRule('write', KEY_A)], deny: [] }
    const decision = resolveOperationPermission(
      policyFrom('deny', rules),
      fileOp('write', KEY_A, 'display:/workspace/a.txt'),
      rules,
    )
    expect(decision).toEqual(ruleDecision('ask', 0))
  })

  it('deny exact: matching key → deny with rule provenance (lane deny, ruleIndex 0)', () => {
    const rules: CanonicalRules = { allow: [], ask: [], deny: [exactRule('edit', KEY_A)] }
    const decision = resolveOperationPermission(
      policyFrom('ask', rules),
      fileOp('edit', KEY_A, 'display:/workspace/a.txt'),
      rules,
    )
    expect(decision).toEqual(ruleDecision('deny', 0))
  })

  it('any rule, tool match → whole-tool allow (allow lane)', () => {
    const rules: CanonicalRules = { allow: [anyRule('write')], ask: [], deny: [] }
    const decision = resolveOperationPermission(
      policyFrom('deny', rules),
      fileOp('write', KEY_C, 'display:/workspace/sub/c.txt'),
      rules,
    )
    expect(decision).toEqual(ruleDecision('allow', 0))
  })

  it('any rule, tool match → whole-tool ask (ask lane)', () => {
    const rules: CanonicalRules = { allow: [], ask: [anyRule('read_image')], deny: [] }
    const decision = resolveOperationPermission(
      policyFrom('deny', rules),
      fileOp('read_image', KEY_B, 'display:/workspace/b.txt'),
      rules,
    )
    expect(decision).toEqual(ruleDecision('ask', 0))
  })

  it('any rule, tool match → whole-tool deny (deny lane)', () => {
    const rules: CanonicalRules = { allow: [], ask: [], deny: [anyRule('lsp')] }
    const decision = resolveOperationPermission(
      policyFrom('ask', rules),
      fileOp('lsp', KEY_A, 'display:/workspace/a.txt'),
      rules,
    )
    expect(decision).toEqual(ruleDecision('deny', 0))
  })

  it('any rule does not match a different tool (write any vs read op → default)', () => {
    const rules: CanonicalRules = { allow: [anyRule('write')], ask: [], deny: [] }
    const decision = resolveOperationPermission(
      policyFrom('deny', rules),
      fileOp('read', KEY_A, 'display:/workspace/a.txt'),
      rules,
    )
    expect(decision).toEqual(defaultDecision('deny'))
  })

  it('exact key equality is verbatim: no case folding, no startsWith/prefix, no path parsing', () => {
    // case folding: the local backend's keys are case-sensitive identities.
    const caseRules: CanonicalRules = {
      allow: [exactRule('read', 'fskey:/workspace/a.txt')],
      ask: [],
      deny: [],
    }
    const caseOp = fileOp('read', 'fskey:/workspace/A.TXT', 'display:/workspace/A.TXT')
    expect(resolveOperationPermission(policyFrom('ask', caseRules), caseOp, caseRules)).toEqual(
      defaultDecision('ask'),
    )
    // startsWith/prefix: a LONGER key sharing the prefix is a different key.
    const suffixRules: CanonicalRules = {
      allow: [exactRule('read', 'fskey:/workspace/a.txt')],
      ask: [],
      deny: [],
    }
    const suffixOp = fileOp('read', 'fskey:/workspace/a.txt.bak', 'display:x')
    expect(resolveOperationPermission(policyFrom('ask', suffixRules), suffixOp, suffixRules)).toEqual(
      defaultDecision('ask'),
    )
    // path parsing: the keys are opaque — no segment/slash reasoning.
    const nestedRules: CanonicalRules = {
      allow: [exactRule('read', 'fskey:/workspace/a.txt')],
      ask: [],
      deny: [],
    }
    const nestedOp = fileOp('read', 'fskey:/workspace/sub/a.txt', 'display:x')
    expect(resolveOperationPermission(policyFrom('ask', nestedRules), nestedOp, nestedRules)).toEqual(
      defaultDecision('ask'),
    )
  })
})

// ---------------------------------------------------------------------------
// Resolution (plan §8.3, frozen): deny > ask > allow > policy.default
// ---------------------------------------------------------------------------

describe('a3 static resolver — frozen priority deny > ask > allow > default (plan §8.3)', () => {
  it('deny beats ask and allow: one matching rule in EACH lane → deny, provenance at the deny lane, first matching deny index', () => {
    const rules: CanonicalRules = {
      allow: [exactRule('write', KEY_A), anyRule('write')],
      ask: [exactRule('write', KEY_A)],
      deny: [exactRule('write', KEY_B), exactRule('write', KEY_A)],
    }
    const decision = resolveOperationPermission(
      policyFrom('ask', rules),
      fileOp('write', KEY_A, 'display:/workspace/a.txt'),
      rules,
    )
    // deny wins even though allow (index 0 AND 1) and ask (index 0) match;
    // the provenance names the DECIDING lane, at the first matching deny
    // index (index 1 — the index-0 deny rule does not match KEY_A).
    expect(decision).toEqual(ruleDecision('deny', 1))
  })

  it('ask beats allow: allow + ask match, no deny → ask, lane ask', () => {
    const rules: CanonicalRules = {
      allow: [exactRule('read', KEY_A)],
      ask: [exactRule('read', KEY_A)],
      deny: [],
    }
    const decision = resolveOperationPermission(
      policyFrom('deny', rules),
      fileOp('read', KEY_A, 'display:/workspace/a.txt'),
      rules,
    )
    expect(decision).toEqual(ruleDecision('ask', 0))
  })

  it('allow beats default: allow match + default deny → allow, lane allow', () => {
    const rules: CanonicalRules = { allow: [exactRule('read', KEY_A)], ask: [], deny: [] }
    const decision = resolveOperationPermission(
      policyFrom('deny', rules),
      fileOp('read', KEY_A, 'display:/workspace/a.txt'),
      rules,
    )
    expect(decision).toEqual(ruleDecision('allow', 0))
  })

  it('no match + default ask → ask (source default, effect ask, lane/ruleIndex omitted)', () => {
    const rules = emptyRules()
    const decision = resolveOperationPermission(
      policyFrom('ask', rules),
      fileOp('read', KEY_A, 'display:/workspace/a.txt'),
      rules,
    )
    expect(decision).toEqual(defaultDecision('ask'))
    expect(decision.provenance.lane).toBe(undefined)
    expect(decision.provenance.ruleIndex).toBe(undefined)
  })

  it('no match + default deny → deny (source default, effect deny, lane/ruleIndex omitted)', () => {
    const rules = emptyRules()
    const decision = resolveOperationPermission(policyFrom('deny', rules), bashOp(), rules)
    expect(decision).toEqual(defaultDecision('deny'))
    expect(decision.provenance.lane).toBe(undefined)
    expect(decision.provenance.ruleIndex).toBe(undefined)
  })
})

// ---------------------------------------------------------------------------
// Canonical identity: key is authority, display is not
// ---------------------------------------------------------------------------

describe('a3 static resolver — canonical identity (key authority, display inert)', () => {
  it('same canonical key, different display → structurally identical decision (display is not authority)', () => {
    const rules: CanonicalRules = { allow: [exactRule('read', KEY_A)], ask: [], deny: [] }
    const op1 = fileOp('read', KEY_A, 'display:/workspace/a.txt')
    const op2 = fileOp('read', KEY_A, 'display:C:\\Other\\Spelling\\A.TXT')
    const d1 = resolveOperationPermission(policyFrom('deny', rules), op1, rules)
    const d2 = resolveOperationPermission(policyFrom('deny', rules), op2, rules)
    expect(d1).toEqual(d2)
    expect(d1).toEqual(ruleDecision('allow', 0))
  })

  it('different canonical key (different file) → no match, falls to default', () => {
    const rules: CanonicalRules = { allow: [exactRule('read', KEY_A)], ask: [], deny: [] }
    const decision = resolveOperationPermission(
      policyFrom('deny', rules),
      fileOp('read', KEY_B, 'display:/workspace/b.txt'),
      rules,
    )
    expect(decision).toEqual(defaultDecision('deny'))
  })

  it('key compared verbatim as given: a whitespace-differing key is a different key (A3 does NOT trim — that is A1)', () => {
    // The rule key as given (clean) matches the identical op key.
    const matchingRules: CanonicalRules = { allow: [exactRule('read', KEY_A)], ask: [], deny: [] }
    const matching = resolveOperationPermission(
      policyFrom('ask', matchingRules),
      fileOp('read', KEY_A, 'display:x'),
      matchingRules,
    )
    expect(matching).toEqual(ruleDecision('allow', 0))
    // The same key plus a trailing space is a DIFFERENT opaque key:
    // A3 compares strings verbatim and performs no normalization.
    const spacedRules: CanonicalRules = { allow: [exactRule('read', KEY_A + ' ')], ask: [], deny: [] }
    const spaced = resolveOperationPermission(
      policyFrom('ask', spacedRules),
      fileOp('read', KEY_A, 'display:x'),
      spacedRules,
    )
    expect(spaced).toEqual(defaultDecision('ask'))
  })
})

// ---------------------------------------------------------------------------
// bash (RECORDED RULING, plan §4: no positive parameter-level allow for
// bash — enforced by the matcher, not the schema)
// ---------------------------------------------------------------------------

describe('a3 static resolver — bash (recorded ruling, plan §4)', () => {
  it('bash op + bash any rule (ask lane) → ask, whole tool', () => {
    const rules: CanonicalRules = { allow: [], ask: [anyRule('bash')], deny: [] }
    const decision = resolveOperationPermission(policyFrom('deny', rules), bashOp(), rules)
    expect(decision).toEqual(ruleDecision('ask', 0))
  })

  it('bash op + bash any rule (deny lane) → deny, whole tool', () => {
    const rules: CanonicalRules = { allow: [], ask: [], deny: [anyRule('bash')] }
    const decision = resolveOperationPermission(policyFrom('ask', rules), bashOp(), rules)
    expect(decision).toEqual(ruleDecision('deny', 0))
  })

  it('bash op + bash any rule (allow lane) → allow (documented consequence: whole-tool allow for bash)', () => {
    const rules: CanonicalRules = { allow: [anyRule('bash')], ask: [], deny: [] }
    const decision = resolveOperationPermission(policyFrom('deny', rules), bashOp(), rules)
    expect(decision).toEqual(ruleDecision('allow', 0))
  })

  it('bash op vs an exact read rule → no match (the tool names differ)', () => {
    const rules: CanonicalRules = { allow: [exactRule('read', KEY_A)], ask: [], deny: [] }
    const decision = resolveOperationPermission(policyFrom('ask', rules), bashOp(), rules)
    expect(decision).toEqual(defaultDecision('ask'))
  })

  it('bash op vs an exact bash rule (a file key) → no match (inert by construction)', () => {
    // An exact-path bash rule is accepted by the A1 schema but can never
    // match the bash operation: an exact key is a file key and a file key
    // can never equal the tool-level key.
    const rules: CanonicalRules = { allow: [exactRule('bash', KEY_A)], ask: [], deny: [] }
    const decision = resolveOperationPermission(policyFrom('deny', rules), bashOp(), rules)
    expect(decision).toEqual(defaultDecision('deny'))
  })

  it('bash op vs an exact bash rule whose key IS the tool-level key string → still no match (exact is file-scoped)', () => {
    // Even a degenerate backend that emitted the file key
    // 'bash' (string-equal to BASH_TOOL_RESOURCE_KEY) cannot put the
    // bash operation into an exact lane: `exact` matches only
    // kind: 'file' resources (the recorded ruling made structural).
    const rules: CanonicalRules = {
      allow: [exactRule('bash', BASH_TOOL_RESOURCE_KEY)],
      ask: [],
      deny: [],
    }
    const decision = resolveOperationPermission(policyFrom('deny', rules), bashOp(), rules)
    expect(decision).toEqual(defaultDecision('deny'))
  })

  it('file op vs a bash any rule → no match (the tool names differ)', () => {
    const rules: CanonicalRules = { allow: [anyRule('bash')], ask: [], deny: [] }
    const decision = resolveOperationPermission(
      policyFrom('ask', rules),
      fileOp('read', KEY_A, 'display:/workspace/a.txt'),
      rules,
    )
    expect(decision).toEqual(defaultDecision('ask'))
  })
})

// ---------------------------------------------------------------------------
// Provenance first-match indexing + determinism
// ---------------------------------------------------------------------------

describe('a3 static resolver — provenance first-match indexing and determinism (plan §8.1)', () => {
  it('two matching allow rules → ruleIndex 0 (first in declaration order)', () => {
    const rules: CanonicalRules = {
      allow: [exactRule('write', KEY_A), anyRule('write')],
      ask: [],
      deny: [],
    }
    const decision = resolveOperationPermission(
      policyFrom('deny', rules),
      fileOp('write', KEY_A, 'display:/workspace/a.txt'),
      rules,
    )
    expect(decision).toEqual(ruleDecision('allow', 0))
  })

  it('first allow rule does NOT match, second does → ruleIndex 1', () => {
    const rules: CanonicalRules = {
      allow: [exactRule('write', KEY_B), exactRule('write', KEY_A)],
      ask: [],
      deny: [],
    }
    const decision = resolveOperationPermission(
      policyFrom('deny', rules),
      fileOp('write', KEY_A, 'display:/workspace/a.txt'),
      rules,
    )
    expect(decision).toEqual(ruleDecision('allow', 1))
  })

  it('determinism: two calls with the same input → structurally identical output', () => {
    const rules: CanonicalRules = {
      allow: [exactRule('read', KEY_A)],
      ask: [anyRule('read')],
      deny: [exactRule('read', KEY_B)],
    }
    const op = fileOp('read', KEY_A, 'display:/workspace/a.txt')
    const policyObj = policyFrom('ask', rules)
    const d1 = resolveOperationPermission(policyObj, op, rules)
    const d2 = resolveOperationPermission(policyObj, op, rules)
    expect(d1).toEqual(d2)
    expect(d1).toEqual(ruleDecision('ask', 0))
  })

  it('determinism: fresh-but-equal input objects (new identity, same values) → structurally identical output', () => {
    const rules: CanonicalRules = { allow: [], ask: [], deny: [anyRule('read')] }
    const op = fileOp('read', KEY_A, 'display:/workspace/a.txt')
    const d1 = resolveOperationPermission(policyFrom('deny', rules), op, rules)
    const d2 = resolveOperationPermission(
      policyFrom('deny', { allow: [], ask: [], deny: [anyRule('read')] }),
      fileOp('read', KEY_A, 'display:/workspace/a.txt'),
      { allow: [], ask: [], deny: [anyRule('read')] },
    )
    expect(d1).toEqual(d2)
    expect(d2).toEqual(ruleDecision('deny', 0))
  })
})

// ---------------------------------------------------------------------------
// Vocabulary pin (A2 handoff): the two PermissionTool definitions must
// never diverge (plan §6.2 — same six names, same closed semantics).
// ---------------------------------------------------------------------------

describe('a3 static resolver — tool vocabulary pin (A2 handoff)', () => {
  it('A2 PERMISSION_TOOL_VALUES deep-equals A1 PERMISSION_TOOL_NAMES (same six names, same order)', () => {
    expect(PERMISSION_TOOL_VALUES).toEqual(PERMISSION_TOOL_NAMES)
    expect(PERMISSION_TOOL_NAMES).toEqual(['read', 'read_image', 'write', 'edit', 'lsp', 'bash'])
  })
})
