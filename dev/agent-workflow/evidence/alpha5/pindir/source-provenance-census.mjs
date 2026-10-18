#!/usr/bin/env node
// source-provenance census: for every pinned name, can the host tree at the pin
// show a real registration source? (coordinator unit ②: guessed names are RED)
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const REPO = process.argv[2] ?? '.'
const { findTestRepoRoot, TEST_USE_REL } = await import(new URL('file://' + path.resolve(REPO, 'tests/paths.mjs')).href)
const hostRoot = path.join(findTestRepoRoot(REPO), TEST_USE_REL)
const planeSrc = readFileSync(path.resolve(REPO, 'packages/runtime/src/plugin/live/team-tool-plane.mjs'), 'utf8')
const arr = planeSrc.match(/PLANE_RESERVED_NATIVE = Object\.freeze\(\[([\s\S]*?)\n\]\)/)[1]
  .split('\n').filter((line) => !line.trim().startsWith('//')).join('\n')
const pinned = [...arr.matchAll(/'([^']+)'/g)].map((m) => m[1])

const files = []
const walk = (dir, depth) => {
  if (depth > 6) return
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git' || e === 'lib' || e === 'dist' || e === 'out') continue
    const p = path.join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, depth + 1)
    else if (/\.(ts|mjs|yml|yaml)$/.test(e) && !/\.(spec|test)\./.test(e) && !/(^|\/)tests?\//.test(path.relative(hostRoot, p))) files.push(p)
  }
}
walk(path.join(hostRoot, 'packages'), 1)
const blob = files.map((f) => [f, readFileSync(f, 'utf8')])

const templateFallback = {
  stagehand_act: 'stagehand_${method}', stagehand_extract: 'stagehand_${method}', stagehand_navigate: 'stagehand_${method}',
  stagehand_observe: 'stagehand_${method}', stagehand_screenshot: 'stagehand_${method}', stagehand_tabs: 'stagehand_${method}',
  'mcp__host__tool': 'mcp__${serverName}__${rawName}',
}
for (const name of pinned) {
  const lit = blob.filter(([, t]) => t.includes(`'${name}'`) || t.includes(`"${name}"`) || t.includes(`toolName: ${name}`) || t.includes('`' + name + '`'))
  let hit = lit.length > 0 ? `${lit.length} literal site(s): ${path.relative(hostRoot, lit[0][0]).replace(/\\/g, '/')}` : 'NONE'
  if (lit.length === 0 && templateFallback[name]) {
    const tmpl = blob.filter(([, t]) => t.includes(templateFallback[name]))
    if (tmpl.length > 0) hit = `TEMPLATE ${templateFallback[name]} @ ${path.relative(hostRoot, tmpl[0][0]).replace(/\\/g, '/')}`
  }
  if (lit.length === 0 && !templateFallback[name]) console.log(`MISSING-SOURCE ${name}`)
  else if (hit.startsWith('TEMPLATE')) console.log(`TEMPLATE ${name} -> ${hit.slice(9)}`)
}
console.log(`checked ${pinned.length} names`)
