/**
 * Alpha.6 PR0 (Lane 2) — lane hygiene: what this lane is allowed to touch, and
 * who is allowed to consume it.
 *
 * Three laws, each the kind that is invisible while it holds:
 *
 *  1. DORMANT IS DECLARED, NOT ASSUMED. PR0 ships the delegation law with NO
 *     production consumer: no reviewer decision is wired to `allow` until the
 *     named Center-Interface PR (execution-plan PR-I1) passes its safety gate
 *     (gate G-5). A lane that is dark is safe only while it stays dark, so the
 *     import set is measured from disk on every run rather than asserted from
 *     a comment.
 *  2. THE LANE NEVER DEPENDS ON THE PROTECTED CENTER. Every decision entrance
 *     this lane can serve lives inside the ARC-A digest-pinned set
 *     (`control/**`); a reverse import would put a new lane in the compile
 *     graph of the kernel and make the next Center-Interface PR a merge of two
 *     directions. So: the lane's own imports of protected prefixes are zero.
 *  3. THE LANE IS IN THE COMPILE FACE. A lane nothing typechecks is a lane
 *     whose law drifts silently — the recurring review condition "the lane
 *     never entered a repo-wide tsc". Both tsconfigs must name it.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const RUNTIME_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LANE_DIR = join(RUNTIME_ROOT, 'review-mandate')
const PACKAGES_ROOT = join(RUNTIME_ROOT, '..')

/** Production source files that may import the lane. Empty until PR-I1 wires
 *  it — and PR-I1 must arrive WITH its Center-Interface ledger override, its
 *  own tests and this list updated in the same change, never as a stray edit. */
const ALLOWED_CONSUMERS: readonly string[] = []

/** Prefixes inside the ARC-A protected center (the set
 *  `packages/testkit/test/arc-a-fitness/scan.mjs` pins; restated here as the
 *  dependency-direction question only — this test does not re-derive the
 *  digest ledger, u6-arc-a-fitness does). */
const PROTECTED_PREFIXES = [
  `control${sep}`,
  `operation-permission${sep}`,
  `tool-admission${sep}`,
  `tool-dispatch${sep}`,
  join('src', 'plugin', 'live', 'pa-mount-registry.mjs'),
  join('src', 'plugin', 'live', 'agent-bindings.mjs'),
  `governance-center${sep}`,
]

function sourceFiles(root: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(root)) {
    const full = join(root, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue
      out.push(...sourceFiles(full))
      continue
    }
    if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) out.push(full)
  }
  return out
}

describe('a6-pr0 lane hygiene', () => {
  it('the lane exists and is more than a barrel', () => {
    const files = sourceFiles(LANE_DIR).map((file) => relative(LANE_DIR, file)).sort()
    expect(files).toEqual(['index.ts', 'mandate.ts', 'plan.ts', 'types.ts'])
  })

  it('is DORMANT: no production file outside the lane imports it yet', () => {
    const offenders: string[] = []
    for (const pkg of ['runtime', 'tools', 'remote', 'client', 'domain', 'storage']) {
      const pkgRoot = join(PACKAGES_ROOT, pkg)
      for (const file of sourceFiles(pkgRoot)) {
        const rel = relative(PACKAGES_ROOT, file)
        if (rel.startsWith(join('runtime', 'review-mandate') + sep)) continue
        if (rel.includes(`${sep}test${sep}`)) continue
        const text = readFileSync(file, 'utf8')
        if (/review-mandate\/(index|types|plan|mandate)\.js|from '\.\.\/review-mandate\/index\.js'/.test(text)) {
          offenders.push(rel)
        }
      }
    }
    expect(offenders).toEqual([...ALLOWED_CONSUMERS])
  })

  it('imports NOTHING from the ARC-A protected center (no reverse dependency)', () => {
    for (const file of sourceFiles(LANE_DIR)) {
      const text = readFileSync(file, 'utf8')
      for (const prefix of PROTECTED_PREFIXES) {
        expect(text, `${relative(RUNTIME_ROOT, file)} must not import the protected ${prefix}`).not.toContain(`../${prefix}`)
        expect(text, `${relative(RUNTIME_ROOT, file)} must not import the protected ${prefix}`).not.toContain(`./${prefix}`)
      }
    }
  })

  it('is named by both tsconfigs, so a repo-wide tsc reads it', () => {
    expect(readFileSync(join(RUNTIME_ROOT, 'tsconfig.json'), 'utf8')).toContain('"review-mandate"')
    expect(readFileSync(join(RUNTIME_ROOT, 'tsconfig.build.json'), 'utf8')).toContain('"review-mandate"')
  })

  it('performs no I/O and reads no clock: only node:crypto, contracts and itself', () => {
    const allowed = /^(node:crypto|(?:\.\.\/)+contracts\/src\/index\.js|\.\/(types|plan|mandate)\.js)$/
    for (const file of sourceFiles(LANE_DIR)) {
      const text = readFileSync(file, 'utf8')
      const specifiers = [...text.matchAll(/^\s*(?:import|export)[^;]*?from '([^']+)'/gm)].map((match) => match[1] as string)
      for (const specifier of specifiers) {
        expect(allowed.test(specifier), `${relative(RUNTIME_ROOT, file)} imports ${specifier}, outside the pure-lane allow-list`).toBe(true)
      }
      expect(text).not.toMatch(/Date\.now\(/)
      expect(text).not.toMatch(/new Date\(\)/)
      expect(text).not.toMatch(/readFileSync|process\.env|fetch\(/)
    }
  })
})
