#!/usr/bin/env node
/**
 * S8 boot kit — pnpm-style junction bridge (T12-V4/V5 logic, inlined from
 * packages/tools/harness/t12-vertical.mjs). Creates worktree-only junctions
 * (packages/runtime/node_modules + packages/node_modules) pointing at the
 * test-use host tree's pnpm hidden hoist entries. The host tree is never
 * touched; the links are gitignored worktree artifacts. Idempotent.
 */
import { existsSync, lstatSync, mkdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'

const WT = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/RC1'
const HOST_TREE = 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/deepseek-harness-test-use'
const hoist = join(HOST_TREE, 'node_modules', '.pnpm', 'node_modules')

const RUNTIME_LINKS = [
  ['@deepseek-ai', 'dsh-agent'],
  ['@deepseek-ai', 'dsh-llm'],
  ['@deepseek-ai', 'dsh-mcp-client'],
  ['@deepseek-ai', 'dsh-session'],
  ['@deepseek-ai', 'dsh-storage-domain'],
  [null, 'zod'],
]
const PACKAGES_LINKS = [
  ['@deepseek-ai', 'dsh-agent'],
  ['@deepseek-ai', 'dsh-llm'],
  ['@deepseek-ai', 'dsh-mcp-client'],
  ['@deepseek-ai', 'dsh-session'],
  ['@deepseek-ai', 'dsh-storage-domain'],
  ['@deepseek-ai', 'dsh-scope'],
  ['@deepseek-ai', 'dsh-system-prompt'],
]

function ensureJunctions(base, links, tag) {
  mkdirSync(base, { recursive: true })
  for (const [scope, name] of links) {
    const label = scope ? `${scope}/${name}` : name
    const target = scope ? join(hoist, scope, name) : join(hoist, name)
    if (!existsSync(target)) {
      throw new Error(`host tree pnpm hoist has no link for ${label} at ${target} — cannot wire S8 module links`)
    }
    const scopeDir = scope ? join(base, scope) : base
    mkdirSync(scopeDir, { recursive: true })
    const link = join(scopeDir, name)
    let st = null
    try { st = lstatSync(link) } catch { /* absent — create below */ }
    if (st !== null) {
      let ok = false
      try { ok = realpathSync(link) === realpathSync(target) } catch { ok = false }
      if (ok) continue
      rmSync(link, { force: true })
    }
    symlinkSync(target, link, 'junction')
    console.log(`${tag} link: ${label} -> ${target}`)
  }
}

ensureJunctions(join(WT, 'packages', 'runtime', 'node_modules'), RUNTIME_LINKS, 'runtime')
ensureJunctions(join(WT, 'packages', 'node_modules'), PACKAGES_LINKS, 'packages')
console.log('S8 links ready')
