// One-shot byte-level fix for s8-browser.mjs (v2 — exact on-disk shapes
// verified via char-code dump): the S9 rewrite passed through the harness
// redactor and both launch-token template literals were corrupted from
// `${state.token}` to `***}` (the interpolation ate the variable, kept the
// closing brace). The driver therefore sent the literal string '***}' as the
// launch token on every run -> server 401. Rebuild the URL via URL +
// searchParams (same pattern the working s8-401probe.mjs uses).
import { readFileSync, writeFileSync } from 'node:fs'

const P = 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/P9/s8/s8-browser.mjs'
const marker = '***'
let c = readFileSync(P, 'utf8')

const corruptCount = c.split('token=' + marker).length - 1
console.log(`corrupt markers before: ${corruptCount}`)
if (corruptCount !== 2) {
  console.log('unexpected marker count — aborting, inspect by hand')
  process.exit(1)
}

// 1) step log line (L143), exact on-disk shape:
//    step(`open ${origin}/?token=***}`)
const oldStep = 'step(`open ${origin}/?token=' + marker + '}`)'
const newStep = "step('open ' + origin + ' (launch-token param set)')"
if (!c.includes(oldStep)) {
  console.log('step line shape unexpected — aborting')
  process.exit(1)
}
c = c.replace(oldStep, newStep)

// 2) goto line (L144), exact on-disk shape:
//    const resp = await page.goto(`${origin}/?token=***}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
const oldGoto =
  'const resp = await page.goto(`' +
  '${origin}/?token=' + marker +
  '}`, { waitUntil: \'domcontentloaded\', timeout: 60_000 })'
const newGoto =
  'const launchUrl = new URL(origin)\n' +
  '  launchUrl.searchParams.set(\'token\', token)\n' +
  '  const resp = await page.goto(launchUrl.href, { waitUntil: \'domcontentloaded\', timeout: 60_000 })'
if (!c.includes(oldGoto)) {
  console.log('goto line shape unexpected — aborting')
  process.exit(1)
}
c = c.replace(oldGoto, newGoto)

// 3) guard: the token variable itself (L37) must be intact.
if (!c.includes('const token = state.token')) {
  console.log('token variable line missing — aborting before write')
  process.exit(1)
}

writeFileSync(P, c)
console.log('patched OK')
