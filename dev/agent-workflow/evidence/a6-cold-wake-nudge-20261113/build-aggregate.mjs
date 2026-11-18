#!/usr/bin/env node
/**
 * build-aggregate.mjs — fold the per-run `cw-facts.md` blocks into ONE committed
 * JSON (`nudge-arms.json`).
 *
 * WHY one file: the devex gate budgets the committed `.json` blobs under
 * `dev/agent-workflow/evidence` (`BOUNDS.maxCandidates = 6000`, measured 5994
 * after the COLD-WAKE lane). Ten per-run fact files would spend ten units of a
 * budget with six left; the fenced-JSON-in-markdown convention spends one and
 * keeps every byte of the evidence.
 *
 * Usage: node build-aggregate.mjs [--dir .] [--out nudge-arms.json]
 * Reads every `run-*&#47;cw-facts.md`, writes the aggregate next to them, and prints a
 * one-line summary. Deterministic except for the run content itself.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const argValue = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (hit === undefined) return fallback
  const eq = hit.indexOf('=')
  return eq === -1 ? process.argv[process.argv.indexOf(hit) + 1] : hit.slice(eq + 1)
}

const DIR = resolve(argValue('dir', HERE))
const OUT = join(DIR, argValue('out', 'nudge-arms.json'))

/** The fenced block is the run's fact document: ```json … ``` at the top. */
function factsOf(text) {
  const m = /```json\n([\s\S]*?)\n```/.exec(text)
  if (m === null) return null
  return JSON.parse(m[1])
}

const runs = []
for (const name of readdirSync(DIR).sort()) {
  if (!name.startsWith('run-')) continue
  const file = join(DIR, name, 'cw-facts.md')
  if (!existsSync(file)) continue
  const facts = factsOf(readFileSync(file, 'utf8'))
  if (facts === null) continue
  const log = existsSync(join(DIR, name, 'run.log')) ? readFileSync(join(DIR, name, 'run.log'), 'utf8').trim().split('\n').slice(-1)[0] : ''
  runs.push({
    dir: name,
    arm: facts.arm,
    flags: facts.flags ?? null,
    killPoint: facts.killPoint,
    windowMs: facts.windowMs,
    nudgeMarker: facts.nudgeMarker,
    verdict: facts.verdict,
    armExpectationMet: facts.armExpectationMet,
    outcome: facts.outcome,
    decidedBy: facts.decidedBy,
    clauses: facts.clauses,
    pendingBefore: facts.pendingBefore,
    nudge: facts.nudge,
    window: facts.window,
    newDecision: facts.newDecision,
    decisionCall: facts.decisionCall,
    decisionByNudgeTurn: facts.decisionByNudgeTurn,
    wakeTurns: (facts.wakeTurns ?? []).map((t) => ({
      seq: t.seq, at: t.at, kind: t.kind, namesNewRequest: t.namesNewRequest, relayTo: t.relayTo ?? null,
      wakeToken: t.wakeToken ?? null, firstLine: t.firstLine, toolCalls: t.toolCalls,
    })),
    nudgeTurns: (facts.nudgeTurns ?? []).map((t) => ({
      seq: t.seq, at: t.at, kind: t.kind, markerSeen: t.markerSeen, relayTo: t.relayTo ?? null,
      firstLine: t.firstLine, toolCalls: t.toolCalls, toolResults: t.toolResults,
    })),
    recovery: {
      wakeFilesAtKill: facts.wakeFilesAtKill ?? null,
      recoveryWakeTurns: facts.recoveryWakeTurns ?? null,
      wakeIntentDirAtRecovery: facts.wakeIntentDirAtRecovery ?? null,
    },
    preCrash: {
      requestId: facts.preCrashRequest?.requestId ?? null,
      decider: facts.preCrashDecision?.decider ?? null,
      wakeTurns: (facts.preCrashWakeTurns ?? []).length,
    },
    operatorResolve: facts.operatorResolve === undefined ? null : { status: facts.operatorResolve.status, code: facts.operatorResolve.code ?? null },
    authorityComparison: facts.authorityComparison ?? null,
    leaderProbe: facts.leaderProbe ?? null,
    userApproval: facts.userApproval ?? null,
    memberWork: facts.memberWork ?? null,
    startedAt: facts.startedAt,
    endedAt: facts.endedAt,
    logTail: log,
  })
}

const byArm = {}
for (const run of runs) {
  const flags = run.flags ?? {}
  const phase = flags.userApproval ? 'step1-user-approval'
    : flags.leaderProbe ? 'step2-leader-resolve'
      : flags.memberWork ? 'step4-member-work'
        : run.killPoint === 'none' ? 'control-a-no-restart'
          : run.arm === 'none' ? 'control-b-restart-no-nudge' : 'step3-officer-message'
  run.phase = phase
  const key = phase
  byArm[key] = byArm[key] ?? []
  byArm[key].push(run)
}

/** Agreement is on the OBSERVABLES, not on prose: verdict + decidedBy + clause map. */
const arms = {}
for (const [key, list] of Object.entries(byArm)) {
  const signatures = list.map((r) => JSON.stringify({ v: r.verdict, d: r.decidedBy, c: r.clauses, n: r.decisionByNudgeTurn }))
  arms[key] = {
    runs: list.map((r) => r.dir),
    verdicts: list.map((r) => r.verdict),
    decidedBy: list.map((r) => r.decidedBy),
    outcome: list.map((r) => r.outcome),
    decisionByNudgeTurn: list.map((r) => r.decisionByNudgeTurn),
    nudgeTurns: list.map((r) => (r.nudgeTurns ?? []).length),
    wakeTurnsNamingNew: list.map((r) => (r.wakeTurns ?? []).filter((t) => t.namesNewRequest).length),
    agrees: new Set(signatures).size === 1,
  }
}

const doc = {
  schema: 'a6-cold-wake-nudge-arms/1',
  lane: 'A6 COLD-WAKE: Leader-to-Officer restart briefing (PD-44)',
  generatedAt: new Date().toISOString(),
  hostBinding: {
    testuse: 'tests/deepseek-harness-test-use @ 639ed015397290b3745d163aafe02ffee4aa3f84',
    kit: 'tests/kits/a6-cold-wake-nudge-20261113/a6-cold-wake-nudge.mjs',
    note: 'per-run facts stay in run-*/cw-facts.md (fenced JSON); this file is the single committed .json for the lane',
  },
  arms,
  runs,
}

writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`)
const lines = Object.entries(arms).map(([k, v]) => `${k}: ${v.verdicts.join(',')} agrees=${String(v.agrees)} decidedBy=${v.decidedBy.join(',')}`)
process.stdout.write(`wrote ${OUT} (${runs.length} runs, ${Object.keys(arms).length} arms)\n${lines.join('\n')}\n`)
