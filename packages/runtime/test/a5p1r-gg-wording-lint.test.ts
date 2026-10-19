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
 *     be judged closed in the same revision;
 *  4. (a5-docs-matrix hardening, census 458/459/460 class) the WALKER survives
 *     dangling symlinks: a missing-target link is skipped and DISCLOSED (named,
 *     counted), resolving links are still followed, and removing the dangling
 *     links from the same tree leaves the verdict surface byte-identical —
 *     the hardening alone can neither add a violation nor lose a file.
 *
 * Zero product-code change; static text scan only.
 *
 * @module test/a5p1r-gg-wording-lint
 */
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
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
    // On a clean tree the skip lane is VACUOUS AND SAYS SO (empty list, not a
    // missing field): the hardening is disclosed as unused, never assumed.
    expect(results.skippedDangling).toEqual([])
  })

  it('survives dangling symlinks: skips are disclosed by name, resolving links still walk, verdict surface unchanged', () => {
    // Reproduction of the census 458/459/460 shape in a scratch tree (the
    // candidate-package fixture-escape incident: a committed dangling symlink
    // made the walker's statSync throw an uncaught ENOENT and the lint
    // process CRASHED instead of reporting). Scratch lives outside the repo
    // tree (TMPDIR + trap-delete, same convention as test-human-protection.sh
    // after its 090b87b5 closure) — nothing is planted inside dev/agent-workflow.
    const scratch = mkdtempSync(join(tmpdir(), 'a5d-walker-dangling-'))
    try {
      const aw = join(scratch, 'dev', 'agent-workflow', 'evidence')
      mkdirSync(aw, { recursive: true })
      writeFileSync(join(aw, 'clean.md'), 'ordinary words, no claim here.\n')
      writeFileSync(join(scratch, 'outside.md'), 'a second ordinary file.\n')
      symlinkSync(join(scratch, 'outside.md'), join(aw, 'resolving.md')) // must STILL be scanned
      symlinkSync('no-such-target', join(aw, 'dangling.md')) // .md dangling — the crash shape
      symlinkSync(join(scratch, 'no-such-dir'), join(aw, 'dangling-dir')) // dir dangling — same class
      const withDangling = lintRepo(scratch)
      expect(withDangling.violations).toEqual([])
      expect(withDangling.filesScanned).toBe(2) // clean.md + resolving.md — no silent loss
      expect([...withDangling.skippedDangling].sort()).toEqual([
        'dev/agent-workflow/evidence/dangling-dir',
        'dev/agent-workflow/evidence/dangling.md',
      ])
      // Same tree, dangling links removed: counts and verdict are IDENTICAL —
      // only the disclosure changes. The hardening cannot alter the rule.
      unlinkSync(join(aw, 'dangling.md'))
      unlinkSync(join(aw, 'dangling-dir'))
      const clean = lintRepo(scratch)
      expect(clean.filesScanned).toBe(withDangling.filesScanned)
      expect(clean.violations).toEqual(withDangling.violations)
      expect(clean.skippedDangling).toEqual([])
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
