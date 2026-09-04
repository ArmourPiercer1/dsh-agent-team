/**
 * P7-T5 MUST-TEST — the static "no creation path" scan (TaskDoc §11.8
 * P7-T5; DevPlan §20.5): the handoff module owns NO
 * MemberInstance/TeamSession creation path of its own — team creation
 * is DELEGATED to the injected public Team creation entry. The committed
 * scanner (`./p7t5-no-creation-scan.mjs`) proves this on every run over
 * `packages/runtime/handoff/*.ts`:
 *
 *   R1 — no import specifier with a `storage` path segment;
 *   R2 — no import specifier with an `activation` / `root-binding`
 *        path segment;
 *   R3 — no `.repositories.` member access text;
 *   R4 — no creation call text (`putTeamSession(`, `teamSessions.put`,
 *        `memberInstances.put`, `activate(`, `bindFreshTeamRoot`);
 *   R5 — no `node:` builtin import;
 *   R6 — only intra-repo relative import specifiers (`./` / `../`);
 *   R7 — no dynamic module loading (`import(` / `require(`).
 *
 * Positive AND negative controls are run against the matcher with
 * synthetic samples, so a rule that silently stopped matching could not
 * turn the scan green.
 *
 * SELF-CLEANLINESS: this file is inside the P4-T6 whole-tree scanner's
 * scope (`packages/**`; only two files are self-excluded there), so no
 * legacy Team SessionEvent denylist token may appear in this source —
 * none does (the samples below carry creation-path tokens only).
 *
 * @module @dsh-agent-team/runtime/test/p7t5-no-creation-scan
 */

import { describe, expect, it } from 'vitest'
import {
  matchNoCreationRulesInText,
  scanHandoffNoCreation,
} from './p7t5-no-creation-scan.mjs'

/** The scan runs once per file load (synchronous, deterministic). */
const scanResult = scanHandoffNoCreation()

/** A synthetic source that VIOLATES every rule (the positive control). */
const POSITIVE_SAMPLE: readonly string[] = [
  "import { readFileSync } from 'node:fs'",
  "import { describe } from 'vitest'",
  "import { putTeamSession } from '../../storage/repositories/team-domain.js'",
  "import { activate } from '../../runtime/activation/index.js'",
  "import { bindFreshTeamRoot } from '../../runtime/root-binding/fresh-root.js'",
  'const a = domain.repositories.memberInstances.put(x)',
  'const b = teamSessions.put(root, y)',
  'const c = putTeamSession(domain, t)',
  'const d = activate(intent)',
  "const e = await import('../../storage/index.js')",
  "const f = require('some-module')",
]

/** A synthetic clean source that violates NO rule (the negative
 *  control): relative-only imports, plain member access, plain calls. */
const NEGATIVE_SAMPLE: readonly string[] = [
  "import { deepFreeze } from '../../contracts/src/index.js'",
  "import { HANDOFF_ERROR_CODES } from './errors.js'",
  "import type { RemoteSafeRecord } from '../../contracts/src/index.js'",
  "export { createHandoffService } from './service.js'",
  'const ok = deepFreeze({ a: 1 })',
  'const pair = service.startTeamFromHere(request)',
]

describe('p7t5 no-creation static scan', () => {
  it('coverage: exactly the four handoff module files are scanned', () => {
    expect(scanResult.files).toEqual([
      'packages/runtime/handoff/errors.ts',
      'packages/runtime/handoff/index.ts',
      'packages/runtime/handoff/service.ts',
      'packages/runtime/handoff/types.ts',
    ])
  })

  it('the handoff module carries ZERO creation-path violations', () => {
    expect(scanResult.totalViolations).toBe(0)
    expect(scanResult.violations).toEqual([])
  })

  it('the handoff module import surface is non-empty and relative-only (R6 holds per file)', () => {
    expect(scanResult.totalImportSpecifiers).toBeGreaterThan(0)
    const allRelative = scanResult.fileResults.every((f) =>
      f.importSpecifiers.every((s) => s.startsWith('./') || s.startsWith('../')),
    )
    expect(allRelative).toBe(true)
    // The only cross-package dependencies are the shared seam
    // (contracts) and, since T12-B5, the pure identity digest primitive
    // (domain/blueprint): the composite handoff identity tokens are
    // derived from the canonical (sourceSessionId, requestToken) digest,
    // and domain/blueprint owns the repo's pure sha256 helper. No other
    // cross-package import may appear.
    const specifiers = scanResult.fileResults.flatMap((f) => [...f.importSpecifiers])
    const nonSharedSeams = specifiers.filter(
      (s) =>
        !s.startsWith('../../contracts/') &&
        !s.startsWith('../../domain/blueprint/') &&
        !s.startsWith('./'),
    )
    expect(nonSharedSeams).toEqual([])
  })

  it('positive control: the synthetic violation sample is caught by ALL SEVEN rules', () => {
    const { violations } = matchNoCreationRulesInText(
      POSITIVE_SAMPLE.join('\n'),
      'synthetic/positive.ts',
    )
    expect(violations.length).toBeGreaterThan(0)
    const rules = [...new Set(violations.map((v) => v.rule))].sort()
    expect(rules).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'])
    // Every violation is attributed to the synthetic file.
    expect(violations.every((v) => v.file === 'synthetic/positive.ts')).toBe(true)
    // The R1/R2 segment matches are precise: the `activation` segment is
    // reported on the activation import, not on the storage one.
    const r2 = violations.filter((v) => v.rule === 'R2').map((v) => v.detail)
    expect(r2).toEqual([
      '../../runtime/activation/index.js',
      '../../runtime/root-binding/fresh-root.js',
    ])
  })

  it('negative control: the clean relative-only sample is NOT caught by any rule', () => {
    const { violations, importSpecifiers } = matchNoCreationRulesInText(
      NEGATIVE_SAMPLE.join('\n'),
      'synthetic/negative.ts',
    )
    expect(violations).toEqual([])
    expect(importSpecifiers.length).toBe(4)
  })
})
