// Run #16 settlement archive (copy home A — KEEP populated; rename dumps; slice log)
import { cpSync, existsSync, renameSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'

const EV = 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/T12'
const HOME_A = 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/.dsh-test-t12-a'

// 1. copy home A evidence subtrees (copy, do NOT move — run homes must stay
//    populated per parent directive). profiles/ is EXCLUDED on purpose: it is
//    machine-generated and its node_modules is a symlink/junction farm into the
//    test-use tree — fs.cpSync following it overflows the stack (0xC0000409).
//    Same pruned layout as the run14-home-a convention: root files + sessions/
//    + storages/.
rmSync(`${EV}/run16-home-a`, { recursive: true, force: true })
const dest = `${EV}/run16-home-a`
mkdirSync(dest, { recursive: true })
for (const rootFile of ['.anonymous-user-id', '.credentials.yaml', 'p6t6-directive.json']) {
  const p = `${HOME_A}/${rootFile}`
  if (existsSync(p)) { writeFileSync(`${dest}/${rootFile}`, readFileSync(p)); console.log(`copied root file ${rootFile}`) }
}
cpSync(`${HOME_A}/sessions`, `${dest}/sessions`, { recursive: true })
cpSync(`${HOME_A}/storages`, `${dest}/storages`, { recursive: true })
console.log('run16-home-a copied (sessions + storages + root files; profiles excluded; home A left in place)')

// 2. copy A1/A2 instance logs
rmSync(`${EV}/run16-instances`, { recursive: true, force: true })
mkdirSync(`${EV}/run16-instances`, { recursive: true })
for (const label of ['A1', 'A2']) {
  const src = `${EV}/instances/${label}`
  if (existsSync(src)) cpSync(src, `${EV}/run16-instances/${label}`, { recursive: true })
  else console.log(`WARN: instances/${label} missing`)
}
console.log('run16-instances copied (A1, A2)')

// 3. rename dumps
const renames = [
  ['summary.json', 't12v-summary-run16.json'],
  ['t12v-mock-capture.json', 't12v-mock-capture-run16.json'],
  ['t12v-state.json', 't12v-state-run16.json'],
  ['t12v-port3080-pre.txt', 't12v-port3080-pre-run16.txt'],
  ['t12v-port3080-post.txt', 't12v-port3080-post-run16.txt'],
]
for (const [from, to] of renames) {
  const p = `${EV}/${from}`
  if (existsSync(p)) { renameSync(p, `${EV}/${to}`); console.log(`renamed ${from} -> ${to}`) }
  else console.log(`WARN: ${from} not present (skipped)`)
}

// 4. slice cumulative log lines 824..890 (1-based, inclusive) -> t12v-run16.log
const lines = readFileSync(`${EV}/t12v-run.log`, 'utf8').split('\n')
const section = lines.slice(823, 890) // JS 0-based: lines 824..890
if (!section[0].includes('mtkumols991e58') || !section[section.length - 1].includes('runner done')) {
  console.error('FATAL: log section boundaries wrong — check line numbers')
  process.exit(1)
}
writeFileSync(`${EV}/t12v-run16.log`, section.join('\n'), 'utf8')
console.log(`t12v-run16.log written (${section.length} lines)`)
