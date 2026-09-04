// T12-V21 splice: stateprobe phase + phase-conditional fresh-home preflight.
// t12-vertical.mjs is LF; all splices verified against unique anchors.
import { readFileSync, writeFileSync } from 'node:fs'

const RUNNER = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/T12-V/packages/tools/harness/t12-vertical.mjs'
const EV = 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/T12'

let src = readFileSync(RUNNER, 'utf8')
const isLF = src.includes('\r\n') === false
if (!isLF) {
  console.error('FATAL: runner is not LF — aborting, verify anchors again')
  process.exit(1)
}

function snippet(name) {
  let s = readFileSync(`${EV}/${name}`, 'utf8').replace(/\r\n/g, '\n')
  while (s.endsWith('\n')) s = s.slice(0, -1)
  return s
}

function spliceOnce(name, anchor, replacement) {
  const count = src.split(anchor).length - 1
  if (count !== 1) {
    console.error(`FATAL: anchor for ${name} found ${count} times (expected 1)`)
    process.exit(1)
  }
  src = src.replace(anchor, replacement)
  console.log(`ok: ${name}`)
}

// 1. probe constants after ROOT_C1
spliceOnce(
  'consts',
  "const ROOT_C1 = `session-t12v-c1-root-${NONCE}`\n",
  "const ROOT_C1 = `session-t12v-c1-root-${NONCE}`\n" + snippet('t12v21-snippet-consts.txt') + '\n',
)

// 2. phase-conditional fresh-home preflight
const oldPreflight = [
  "  // Fresh homes (fail closed on non-empty).",
  "  assertFreshHome(HOME_A, 'world A')",
  "  assertFreshHome(HOME_B, 'world B')",
  "  assertFreshHome(HOME_C, 'world C')",
  "  log('fresh homes A/B/C asserted (non-empty would fail CLOSED)')",
].join('\n')
spliceOnce('preflight', oldPreflight, snippet('t12v21-snippet-preflight.txt'))

// 3. dispatch: stateprobe after handoff
spliceOnce(
  'dispatch',
  "    await runPhase('handoff', runHandoff)\n",
  "    await runPhase('handoff', runHandoff)\n    await runPhase('stateprobe', runStateProbe)\n",
)

// 4. phase function before main().catch
spliceOnce(
  'phase-fn',
  "main().catch((error) => {",
  snippet('t12v21-snippet-phase.txt') + '\nmain().catch((error) => {',
)

writeFileSync(RUNNER, src, 'utf8')
console.log('runner written (LF preserved)')

// self-checks
const out = readFileSync(RUNNER, 'utf8')
const mustHave = [
  'const PORT_PROBE_A = 3186',
  "await runPhase('stateprobe', runStateProbe)",
  'async function runStateProbe()',
  'freshHomeNeeds',
  "t12v-stateprobe-run16b-${NONCE}.json",
]
for (const m of mustHave) {
  const c = out.split(m).length - 1
  if (c < 1) {
    console.error(`FATAL: self-check missing: ${m}`)
    process.exit(1)
  }
  console.log(`self-check ok (${c}x): ${m.slice(0, 60)}`)
}
console.log('T12-V21 splice complete')
