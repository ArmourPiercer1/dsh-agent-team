/**
 * Alpha.6 PR1 lane hygiene — the router is pure and dormant.
 *
 * It may read Blueprint types and the shared overlay vocabulary; it may not
 * import a host, a clock, ControlService, PA, or a production file. PR2a is the
 * first consumer and arrives with its own gate.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const RUNTIME_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = join(RUNTIME_ROOT, '..', '..')
const LANE = join(RUNTIME_ROOT, 'review-router')
const LANE_FILES = ['index.ts', 'policy.ts', 'router.ts', 'types.ts']

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue
    const full = join(dir, entry)
    // A concurrently-removed test temp dir must not red the population scan.
    let stat
    try {
      stat = statSync(full)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    if (stat.isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(ts|tsx|mjs|cjs)$/.test(entry)) out.push(full)
  }
  return out
}

describe('a6-pr1 lane hygiene', () => {
  it('is in the shared typecheck face', () => {
    const tsconfig = readFileSync(join(RUNTIME_ROOT, 'tsconfig.json'), 'utf8')
    expect(tsconfig).toContain('"review-router"')
  })

  it('has no production importer yet', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(join(REPO_ROOT, 'packages'))) {
      const rel = relative(REPO_ROOT, file)
      if (rel.startsWith(join('runtime', 'review-router'))) continue
      if (rel.includes(join('runtime', 'test'))) continue
      const text = readFileSync(file, 'utf8')
      if (/review-router|reviewRouter/.test(text) && !/review-router is dormant|Alpha\.6 PR1/.test(text)) offenders.push(rel)
    }
    // A6-PR2a is the first legitimate importer (the capability evaluator
    // consumes the shared policy/router vocabulary); the router-first wake
    // PLAN and the root ROUTER INPUT are the PR6 composition consumers. No
    // OTHER alpha6 file and no root/plugin path may import the lane: the
    // root consumes the composition, never the pure lane directly.
    expect(offenders.filter((f) => !f.includes('review-authority/')
      && !f.endsWith(join('runtime', 'alpha6', 'wake-plan.ts'))
      && !f.endsWith(join('runtime', 'alpha6', 'root-router.ts')))).toEqual([])
  })

  it('keeps the module set pure: no node builtins, no host/control/PA imports, no clock', () => {
    for (const name of LANE_FILES) {
      const text = readFileSync(join(LANE, name), 'utf8')
      expect(text, `${name} must not import node:*`).not.toMatch(/from\s+['"]node:/)
      expect(text, `${name} must not import the host/plugin plane`).not.toMatch(/from\s+['"][^'"]*src\/plugin/)
      expect(text, `${name} must not import ControlService/PA`).not.toMatch(/from\s+['"][^'"]*(control\/service|operation-permission|tool-admission)/)
      expect(text, `${name} must not read a clock`).not.toMatch(/Date\.now|new Date\(|performance\.now/)
      expect(text, `${name} must not import an effect executor`).not.toMatch(/agent\.followup|deliverReviewWake|requestControl/)
    }
  })
})
