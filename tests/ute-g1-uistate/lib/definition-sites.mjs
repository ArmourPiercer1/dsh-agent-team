/**
 * definition-sites.mjs — WHERE each member's model-visible definition lives.
 *
 * The Stage-0 probe and the lane suite must agree on this measurement, so the
 * scan lives here once. A definition site is a row's `name:` declaration (or a
 * `name: <CONSTANT>` whose constant is declared as that literal) — never a
 * doc table, a comment, a test fixture or a prose mention.
 *
 * @module tests/ute-g1-uistate/lib/definition-sites
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { PRISTINE_ROOT, REPO_ROOT } from './paths.mjs'

/** Repo-tracked product sources (no dist, no test fixtures). */
export function repoProductSources() {
  return execFileSync('git', ['-C', REPO_ROOT, 'ls-files', '--', 'packages'], { encoding: 'utf8' })
    .split('\n')
    .filter((path) => path.length > 0 && !path.includes('/dist/') && !path.includes('/test/') && !path.includes('/node_modules/')
      && (path.endsWith('.mjs') || path.endsWith('.ts') || path.endsWith('.js')))
}

/** The host packages that declare the booked spellings (built `lib/`). */
export const HOST_SOURCES = Object.freeze([
  'packages/interaction/tool-ask-user/lib/index.js',
  'packages/interaction/tool-ask-user/lib/timed.js',
  'packages/deliverables/tool-present/lib/index.js',
  'packages/todo/tool-todo/lib/index.js',
  'packages/goal/tool-goal/lib/index.js',
  'packages/plan/plan-mode/lib/index.js',
])

/** The host's own identifying symbol per member (measured, not guessed). */
export const HOST_SYMBOL = Object.freeze({
  ask_user_question: '`@deepseek-ai/dsh-tool-ask-user` apply() -> defineTool (index.ts:39)',
  present: '`@deepseek-ai/dsh-tool-present` apply() -> defineTool (index.ts:39)',
  todo_write: '`@deepseek-ai/dsh-tool-todo` apply() -> defineTool (index.ts:136)',
  get_goal: '`@deepseek-ai/dsh-tool-goal` apply() -> defineTool (index.ts:196)',
  create_goal: '`@deepseek-ai/dsh-tool-goal` apply() -> defineTool (index.ts:208)',
  update_goal: '`@deepseek-ai/dsh-tool-goal` apply() -> defineTool (index.ts:235)',
  exit_plan_mode: '`@deepseek-ai/dsh-plan-mode` PlanMode.start() -> defineTool (index.ts:279)',
})

const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 1-based line of the first match, or 0. */
export function lineOf(text, re) {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i += 1) if (re.test(lines[i])) return i + 1
  return 0
}

/** The constants that carry a member's spelling (`const X = 'member'`). */
export function constantsFor(root, files, member) {
  const declared = new Set()
  const re = new RegExp(`(?:export )?const (\\w+) = ['"\`]${escapeRe(member)}['"\`]`)
  for (const rel of files) {
    let text
    try { text = readFileSync(join(root, rel), 'utf8') } catch { continue }
    for (const match of text.matchAll(new RegExp(re.source, 'g'))) declared.add(match[1])
  }
  return declared
}

/**
 * Every `name: '<member>'` / `name: <constant>` declaration under one root.
 * @returns {Array<{rel: string, line: number}>}
 */
export function definitionSites(root, files, member) {
  const constants = constantsFor(root, files, member)
  const names = [`'${member}'`, `"${member}"`, `\`${member}\``, ...[...constants]]
  const literal = new RegExp(`name:\\s*(?:${names.map((name) => /^['"\`]/.test(name) ? name : `\\b${name}\\b`).join('|')})`)
  const sites = []
  for (const rel of files) {
    let text
    try { text = readFileSync(join(root, rel), 'utf8') } catch { continue }
    const line = lineOf(text, literal)
    if (line > 0) sites.push({ rel, line })
  }
  return sites
}

/**
 * The two implementation sites per member, measured.
 * @param {readonly string[]} members
 */
export function measureImplementationSites(members) {
  const repoFiles = repoProductSources()
  const measured = {}
  for (const member of members) {
    measured[member] = {
      governedBody: definitionSites(REPO_ROOT, repoFiles, member),
      hostDefinition: definitionSites(PRISTINE_ROOT, [...HOST_SOURCES], member),
      hostSymbol: HOST_SYMBOL[member],
    }
  }
  return measured
}
