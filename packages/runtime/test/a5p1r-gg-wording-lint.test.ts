/**
 * a5p1r-gg-wording-lint.test.ts — the G-g support contract §3/G-5 as an
 * always-run CI gate (the machine-checkable form of P8). Runs the repo-level
 * wording lint on every root vitest run:
 *
 *  1. the rule itself is proven NON-VACUOUS on fixtures: a bare closure claim
 *     aimed at the silent-channel configuration must be caught; qualified
 *     (UNSUPPORTED/UNTESTED/待证), retracted (RETRACTION/撤回) and merely
 *     exception-flavoured ("swallows the error", no channel context) lines must
 *     not be — the rule is deliberately narrow ("宁窄勿宽");
 *  2. the repository scan is green: no unqualified fail-closed/silent-safe/
 *     已合规/compliant claim aimed at the silent `tools/change` configuration
 *     anywhere in `dev/agent-workflow/**` markdown (hits would name file:line);
 *  3. the PENDING-GATES clause is proven on fixtures and reports its engagement
 *     state honestly: `absent` (the file is not on this baseline) is stated, not
 *     silently passed; when the file lands, the G-g row and the G-a row may not
 *     be judged closed in the same revision.
 *
 * Zero product-code change; static text scan only.
 *
 * @module test/a5p1r-gg-wording-lint
 */
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  lintMarkdownText,
  lintPendingGatesText,
  lintRepo,
} from '../../../scripts/lint-g-g-wording.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

describe('a5p1r G-g probe G-5 — wording lint for the silent-channel posture', () => {
  it('catches the exact claim shape it exists to catch (non-vacuous, narrow)', () => {
    // Caught: a closure claim aimed at the silent configuration, unqualified.
    expect(lintMarkdownText('x/y.md', 'For the silent-channel configuration the lane is fail-closed.')).toHaveLength(1)
    expect(lintMarkdownText('x/y.md', '静默通道（订阅成功但永不投递）下该装配 fail-closed。')).toHaveLength(1)
    expect(lintMarkdownText('x/y.md', 'the subscription stays alive, emissions never deliver, and the arm is compliant.')).toHaveLength(1)
    // Caught: the swallow injection named with its channel context, unqualified.
    expect(lintMarkdownText('x/y.md', 'the tools/change subscription swallow makes this posture fail-closed.')).toHaveLength(1)
    // NOT caught — qualified per the contract's missing-evidence template.
    expect(lintMarkdownText('x/y.md', 'G-g（订阅成功但永不投递）= UNSUPPORTED/待证：fail-closed 未证。')).toHaveLength(0)
    // NOT caught — retraction / prohibition context (the wording rules themselves).
    expect(lintMarkdownText('x/y.md', 'RETRACTION: the old fail-closed claim for the silent channel is withdrawn（撤回）.')).toHaveLength(0)
    expect(lintMarkdownText('x/y.md', '禁用（对静默配置的一切场合）：fail-closed。')).toHaveLength(0)
    // NOT caught — exception-swallowing or ordinary fail-closed, no channel context.
    expect(lintMarkdownText('x/y.md', 'the catch swallows the error; the guard still fails closed.')).toHaveLength(0)
    expect(lintMarkdownText('x/y.md', 'unknown Error fail-closed — deny, never success.')).toHaveLength(0)
    // NOT caught — the registered RETRACTION window (contract anchor :99-122);
    // the same claim just outside the window is still caught.
    const windowed = Array.from({ length: 130 }, (_, i) =>
      (i >= 98 && i <= 121) || i === 124 ? 'the silent channel is fail-closed' : 'clean')
    const windowHits = lintMarkdownText('dev/agent-workflow/evidence/alpha5-pr1r/seam-record-post-door-resolution.md', windowed.join('\n'))
    expect(windowHits.map((v) => v.line)).toEqual([125])
  })

  it('the PENDING-GATES clause engages only when the file exists, and then bites', () => {
    expect(lintPendingGatesText('| G-a | closed ✅ |\n| G-g | OPEN |\n')).toHaveLength(0)
    const both = lintPendingGatesText('| G-a | CLOSED |\n| G-g | CLOSED |\n')
    expect(both).toHaveLength(1)
    expect(String(both[0]!.text)).toContain('does not close G-g')
  })

  it('the repository scan is green and says what it scanned', () => {
    const results = lintRepo(REPO_ROOT)
    expect(results.filesScanned).toBeGreaterThan(100)
    expect(results.violations.map((v) => `${String(v.file)}:${String(v.line)}: ${v.text}`)).toEqual([])
    // Honest engagement state (this baseline has no PENDING-GATES.md; the
    // integration owner's landing of the file engages the second clause).
    expect(['absent', 'checked']).toContain(results.pendingGates)
  })
})
