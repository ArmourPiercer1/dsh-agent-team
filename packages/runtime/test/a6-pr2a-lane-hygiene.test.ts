/**
 * Alpha.6 PR2a lane hygiene — pure, dormant, and not a second ledger.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const RUNTIME_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = join(RUNTIME_ROOT, '..', '..')
const LANE = join(RUNTIME_ROOT, 'review-authority')
const LANE_FILES = ['index.ts', 'evaluator.ts', 'types.ts']

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

describe('a6-pr2a lane hygiene', () => {
  it('is in the shared typecheck face and has no production importer', () => {
    expect(readFileSync(join(RUNTIME_ROOT, 'tsconfig.json'), 'utf8')).toContain('"review-authority"')
    const offenders: string[] = []
    for (const file of sourceFiles(join(REPO_ROOT, 'packages'))) {
      const rel = relative(REPO_ROOT, file)
      if (rel.startsWith(join('runtime', 'review-authority')) || rel.includes(join('runtime', 'test'))) continue
      const text = readFileSync(file, 'utf8')
      if (/from\s+['"][^'"]*review-authority/.test(text) && !/Alpha\.6 PR2a/.test(text)) offenders.push(rel)
    }
    // A6-PR2b is the first production consumer: the Control chain imports
    // the capability evaluator. PR2a's own law (no third consumer surface)
    // remains, so only the control service/types are exempted.
    expect(offenders.filter((f) => !f.startsWith('packages/runtime/control/'))).toEqual([])
  })

  it('has no I/O, clock, service, PA or second-ledger import', () => {
    for (const name of LANE_FILES) {
      const text = readFileSync(join(LANE, name), 'utf8')
      expect(text, `${name} must not import node:*`).not.toMatch(/from\s+['"]node:/)
      expect(text, `${name} must not import ControlService/PA/Grant`).not.toMatch(/from\s+['"][^'"]*(control\/service|operation-permission|tool-admission|guard)/)
      expect(text, `${name} must not write a ledger`).not.toMatch(/appendFact|writeDecision|requestControl|resolveControl/)
      expect(text, `${name} must not read a clock`).not.toMatch(/Date\.now|new Date\(|performance\.now/)
    }
  })
})
