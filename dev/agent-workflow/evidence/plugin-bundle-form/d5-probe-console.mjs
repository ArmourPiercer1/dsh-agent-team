#!/usr/bin/env node
/**
 * d5-probe-console.mjs — capture the FULL browser console/pageerror text of
 * the D5 world's shell (the gentry report truncates at 500 chars). One-shot
 * diagnostic; the instance must be D5-READY (reads the newest d5-state file).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const EV = dirname(fileURLToPath(import.meta.url))
function findMainRepoRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'references', 'deepseek-harness-test-use'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error('no main repo root')
    dir = parent
  }
}
import { existsSync } from 'node:fs'
const MAIN_REPO = findMainRepoRoot(EV)
const requireFromWeb = createRequire(join(MAIN_REPO, 'references', 'deepseek-harness-test-use', 'apps', 'web', 'package.json'))
const { chromium } = requireFromWeb('playwright')

const files = readdirSync(EV).filter((f) => /^d5-state-.+\.json$/.test(f)).sort()
const state = JSON.parse(readFileSync(join(EV, files[files.length - 1]), 'utf8'))
const origin = `http://127.0.0.1:${state.port}`

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const events = []
page.on('console', (msg) => events.push({ kind: 'console', type: msg.type(), text: msg.text() }))
page.on('pageerror', (err) => events.push({ kind: 'pageerror', text: String(err) }))
page.on('response', async (res) => {
  const u = new URL(res.url())
  if (u.pathname.startsWith('/plugins')) {
    events.push({ kind: 'response', status: res.status(), url: res.url().slice(0, 120) })
  }
})
const launch = new URL(origin)
launch.searchParams.set('token', state.token)
await page.goto(launch.href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForTimeout(12_000)
for (const e of events) {
  if (e.kind === 'response') console.log(`[resp ${e.status}] ${e.url}`)
}
console.log('=== console/pageerror (full text) ===')
for (const e of events) {
  if (e.kind !== 'response') {
    console.log(`\n--- ${e.kind} (${e.type ?? ''}) ---\n${e.text}`)
  }
}
await browser.close()
