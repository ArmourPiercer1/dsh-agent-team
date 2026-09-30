/**
 * pre-alpha3 PR-E (plan §E.9 "Member 即使同样缺 required MCP，也可被启动
 * recovery；不可用 MCP 缺失，其他 read/bash/etc 按原权限运行") — the REDUCED
 * original authority of recovery work:
 *
 * - the downed capability is `unavailable`;
 * - every OTHER operation keeps its ORIGINAL policy decision UNCHANGED.
 *
 * plus authority negatives #2 / #3 / #4:
 *
 * ```text
 * #2. Recovery 不把 bash ask 变 allow
 * #3. Recovery 不把 write deny 变 ask
 * #4. external-hard 仍绝对
 * ```
 *
 * @module @dsh-agent-team/runtime/test/recovery-member-reduced-authority
 */

import { describe, expect, it } from 'vitest'

import {
  externalHardAllowed,
  RECOVERY_DECISIONS,
  recoveryPolicyDecision,
} from '../requirements/index.js'

describe('E.9 recovery runs on the REDUCED original authority', () => {
  it('the downed capability is `unavailable` in recovery', () => {
    expect(recoveryPolicyDecision('allow', /* capabilityDown */ true)).toBe(RECOVERY_DECISIONS.unavailable)
  })

  it('other operations keep their ORIGINAL decision (allow stays allow)', () => {
    expect(recoveryPolicyDecision('allow', false)).toBe('allow')
  })

  it('other operations keep their ORIGINAL decision (ask stays ask)', () => {
    expect(recoveryPolicyDecision('ask', false)).toBe('ask')
  })

  it('other operations keep their ORIGINAL decision (deny stays deny)', () => {
    expect(recoveryPolicyDecision('deny', false)).toBe('deny')
  })
})

describe('authority negative #2: recovery does NOT turn bash `ask` → `allow`', () => {
  it('a bash operation that is `ask` stays `ask` in recovery', () => {
    // bash is an ordinary (non-downed) operation during an MCP recovery: its
    // decision must stay `ask` (it is never upgraded to `allow`).
    expect(recoveryPolicyDecision('ask', false)).toBe('ask')
    expect(recoveryPolicyDecision('ask', false)).not.toBe('allow')
  })
})

describe('authority negative #3: recovery does NOT turn write `deny` → `ask`', () => {
  it('a write operation that is `deny` stays `deny` in recovery', () => {
    // write is an ordinary (non-downed) operation: its `deny` stays `deny`
    // (it is never loosened to `ask`).
    expect(recoveryPolicyDecision('deny', false)).toBe('deny')
    expect(recoveryPolicyDecision('deny', false)).not.toBe('ask')
  })
})

describe('authority negative #4: external-hard stays ABSOLUTE', () => {
  it('an external-hard operation is never allowed in any state (including recovery)', () => {
    // external-hard is absolute: it is forbidden in normal, degraded, AND
    // recovery. Recovery never relaxes it.
    expect(externalHardAllowed()).toBe(false)
    // And even a downed-capability check cannot make it allowed.
    expect(recoveryPolicyDecision('allow', /* downed */ false) === 'allow' && externalHardAllowed()).toBe(false)
  })
})
