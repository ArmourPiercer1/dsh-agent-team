#!/usr/bin/env node
/**
 * ute-a1-window.mjs — the A1 CUT WINDOW's own gate: a declared green set, and a red list that
 * may only shrink.
 *
 * WHY A WINDOW. A1 deletes 146 files and replaces the two entries that assemble everything. In
 * the middle of that, `master`'s required-green set cannot be the standard: dozens of suites
 * legitimately cannot pass until their subject is gone and the new centre is mounted. The
 * dishonest ways out are well known — skip the suites, widen `exclude`, add a compatibility
 * layer, or quietly stop running a leg. The honest one is to DECLARE the red set, enumerate it
 * by file, and make growing it a visible, reviewed act.
 *
 * THE LAW OF THE RED LIST.
 *   1. Every entry names a real, tracked test file (not a directory, not a glob).
 *   2. Every entry states why it is red, and which phase makes it green again.
 *   3. `budget.max` is the number of red entries this window is allowed. Adding an entry means
 *      raising `budget.max` in the same diff, which a reviewer cannot miss. Removing one means
 *      lowering it. That is what "only shrinking" means mechanically: the budget is data, and
 *      the check refuses a list that outgrew it.
 *   4. An entry whose file is gone or green is STALE — it is not credit to spend elsewhere.
 *
 * Usage:
 *   node scripts/ute-a1-window.mjs --check
 *   node scripts/ute-a1-window.mjs --write      # regenerate the measured section
 *   node scripts/ute-a1-window.mjs --self-test  # the gate's own arms
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
export const LEDGER_PATH = 'dev/agent-workflow/ledgers/ute-a1-window.json'

/** The contexts branch protection Requires. Membership is the contract, not the order. */
export const REQUIRED_GREEN = Object.freeze(['pr-gate', 'ci-required', 'pr-settlement-gate'])
export const PHASES = Object.freeze(['A1', 'B', 'C', 'D'])

const tracked = (root) => new Set(execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).trim().split('\n'))

/**
 * Grade a window ledger against the tree. Pure: takes the parsed ledger and the tracked set, so
 * the self-test can mutate a copy without touching disk.
 */
export function checkWindow (ledger, trackedPaths) {
  const findings = []
  const push = (code, detail) => findings.push({ code, detail })

  const schema = ledger?.schema
  if (schema !== 'ute-a1-window/1') push('UTE_A1_WINDOW_SCHEMA', `schema must be ute-a1-window/1, got ${JSON.stringify(schema)}`)
  if (typeof ledger?.branch !== 'string' || !ledger.branch.startsWith('vnext/')) {
    push('UTE_A1_WINDOW_BRANCH', `branch must be the window branch (vnext/...), got ${JSON.stringify(ledger?.branch)}`)
  }
  if (typeof ledger?.base !== 'string' || !/^[0-9a-f]{40}$/.test(ledger.base)) {
    push('UTE_A1_WINDOW_BASE', `base must be the full 40-hex commit the window was cut from, got ${JSON.stringify(ledger?.base)}`)
  }
  // The green set is a declaration: it must contain every Required context, and it may not
  // invent a context that branch protection does not require (that would be a private gate).
  const green = Array.isArray(ledger?.requiredGreen) ? ledger.requiredGreen : null
  if (green === null) {
    push('UTE_A1_WINDOW_GREEN', 'requiredGreen must be an array')
  } else {
    for (const c of REQUIRED_GREEN) if (!green.includes(c)) push('UTE_A1_WINDOW_GREEN_MISSING', `requiredGreen must include ${c}`)
    for (const c of green) if (!REQUIRED_GREEN.includes(c)) push('UTE_A1_WINDOW_GREEN_EXTRA', `${c} is not a Required context — the window may not invent one`)
  }

  const red = Array.isArray(ledger?.redList) ? ledger.redList : null
  const max = ledger?.budget?.max
  if (red === null) {
    push('UTE_A1_WINDOW_RED', 'redList must be an array (empty is the honest starting state)')
  } else {
    if (!Number.isInteger(max) || max < 0) push('UTE_A1_WINDOW_BUDGET', `budget.max must be a non-negative integer, got ${JSON.stringify(max)}`)
    else if (red.length > max) {
      // THE ONLY-SHRINKING LAW: growth must be paid for by raising the budget in review.
      push('UTE_A1_WINDOW_BUDGET_EXCEEDED', `redList has ${red.length} entries but budget.max is ${max} — raising the budget is a reviewed act, not a side effect`)
    }
    const seen = new Set()
    for (const e of red) {
      const path = e?.path
      if (typeof path !== 'string' || path === '') {
        push('UTE_A1_WINDOW_RED_ENTRY', `every red entry needs a path, got ${JSON.stringify(e)}`)
        continue
      }
      if (seen.has(path)) push('UTE_A1_WINDOW_RED_DUPLICATE', `${path} is listed twice`)
      seen.add(path)
      if (path.endsWith('/') || path.includes('*')) push('UTE_A1_WINDOW_RED_NOT_A_FILE', `${path}: entries name files, not directories or globs`)
      if (!trackedPaths.has(path)) push('UTE_A1_WINDOW_RED_UNTRACKED', `${path} is not a tracked file`)
      if (typeof e.reason !== 'string' || e.reason.length < 30) push('UTE_A1_WINDOW_RED_NO_REASON', `${path}: a red entry needs a real reason, not a label`)
      if (!PHASES.includes(e.phase)) push('UTE_A1_WINDOW_RED_PHASE', `${path}: phase must be one of ${PHASES.join('|')}, got ${JSON.stringify(e.phase)}`)
    }
  }

  // The deletion obligations the window inherits from A0: it may not claim to be finished
  // while the frozen boundary still has sources on disk or dist artifacts behind them.
  const cut = ledger?.cut
  if (cut === undefined || cut === null) {
    push('UTE_A1_WINDOW_CUT', 'cut must record the measured deletion state')
  } else {
    for (const k of ['retiredSourcesOnDisk', 'retiredDistArtifacts']) {
      if (!Number.isInteger(cut[k]) || cut[k] < 0) push('UTE_A1_WINDOW_CUT', `cut.${k} must be a non-negative integer, got ${JSON.stringify(cut[k])}`)
    }
    if (cut.complete === true && (cut.retiredSourcesOnDisk !== 0 || cut.retiredDistArtifacts !== 0)) {
      push('UTE_A1_WINDOW_CUT_LIE', `cut.complete is true while ${cut.retiredSourcesOnDisk} retired sources and ${cut.retiredDistArtifacts} dist artifacts remain`)
    }
  }
  return findings
}

/** Read the measured cut state from the same two checkers the A0 merge made authoritative. */
export function measureCut (root = ROOT) {
  const run = (script) => {
    try {
      return execFileSync(process.execPath, [join(root, 'scripts', script), '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
    } catch (e) {
      return e.stdout ?? ''
    }
  }
  let closure = null
  try { closure = JSON.parse(run('ute-cut-closure.mjs')) } catch { closure = null }
  if (closure === null) return { retiredSourcesOnDisk: -1, retiredDistArtifacts: -1, complete: false, note: 'closure measurement unavailable' }
  return {
    retiredSourcesOnDisk: closure.cut.retiredSourcesOnDisk,
    retiredDistArtifacts: closure.distResiduals.length,
    survivingProductionRefs: closure.cut.survivingProductionRefs,
    complete: closure.cut.retiredSourcesOnDisk === 0 && closure.distResiduals.length === 0 && closure.cut.survivingProductionRefs === 0,
  }
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (!isMain) {
  // importable
} else {
  const argv = process.argv.slice(2)
  const path = join(ROOT, LEDGER_PATH)
  const ledger = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null

  if (argv.includes('--self-test')) {
    const base = {
      schema: 'ute-a1-window/1',
      branch: 'vnext/a1-cut',
      base: 'a19d1df018e772f20602f93bc726694524bdeb2f',
      requiredGreen: [...REQUIRED_GREEN],
      redList: [{ path: 'packages/runtime/test/x.test.ts', reason: 'its subject is the plane the cut deletes, and its replacement lands in phase B', phase: 'B' }],
      budget: { max: 1 },
      cut: { retiredSourcesOnDisk: 146, retiredDistArtifacts: 52, complete: false },
    }
    const trackedPaths = new Set(['packages/runtime/test/x.test.ts'])
    const codes = (l) => checkWindow(l, trackedPaths).map((f) => f.code)
    const clone = () => JSON.parse(JSON.stringify(base))
    const arms = [
      ['a clean window ledger passes', () => { if (codes(base).length !== 0) throw new Error(JSON.stringify(codes(base))) }],
      ['a red list that outgrew its budget fails', () => {
        const l = clone(); l.redList.push({ path: 'packages/runtime/test/x.test.ts', reason: 'x'.repeat(40), phase: 'B' })
        if (!codes(l).includes('UTE_A1_WINDOW_RED_DUPLICATE') || !codes(l).includes('UTE_A1_WINDOW_BUDGET_EXCEEDED')) throw new Error(JSON.stringify(codes(l)))
      }],
      ['a directory or glob is not a red entry', () => {
        const l = clone(); l.redList[0].path = 'packages/runtime/test/*'
        if (!codes(l).includes('UTE_A1_WINDOW_RED_NOT_A_FILE')) throw new Error(JSON.stringify(codes(l)))
      }],
      ['an untracked file is not a red entry', () => {
        const l = clone(); l.redList[0].path = 'packages/runtime/test/gone.test.ts'
        if (!codes(l).includes('UTE_A1_WINDOW_RED_UNTRACKED')) throw new Error(JSON.stringify(codes(l)))
      }],
      ['a red entry needs a reason and a phase', () => {
        const l = clone(); l.redList[0].reason = 'flaky'; l.redList[0].phase = 'Z'
        const got = codes(l)
        if (!got.includes('UTE_A1_WINDOW_RED_NO_REASON') || !got.includes('UTE_A1_WINDOW_RED_PHASE')) throw new Error(JSON.stringify(got))
      }],
      ['the green set may not drop a Required context or invent one', () => {
        const a = clone(); a.requiredGreen = ['pr-gate', 'ci-required']
        if (!codes(a).includes('UTE_A1_WINDOW_GREEN_MISSING')) throw new Error(JSON.stringify(codes(a)))
        const b = clone(); b.requiredGreen = [...REQUIRED_GREEN, 'my-private-gate']
        if (!codes(b).includes('UTE_A1_WINDOW_GREEN_EXTRA')) throw new Error(JSON.stringify(codes(b)))
      }],
      ['a complete cut with sources still on disk is a lie', () => {
        const l = clone(); l.cut.complete = true
        if (!codes(l).includes('UTE_A1_WINDOW_CUT_LIE')) throw new Error(JSON.stringify(codes(l)))
      }],
      ['the window must be cut from a full commit', () => {
        const l = clone(); l.base = 'a19d1df'
        if (!codes(l).includes('UTE_A1_WINDOW_BASE')) throw new Error(JSON.stringify(codes(l)))
      }],
    ]
    let failed = 0
    for (const [name, fn] of arms) {
      try { fn(); console.log(`ok   ${name}`) } catch (e) { failed++; console.log(`FAIL ${name}: ${e.message}`) }
    }
    console.log(`UTE-A1-WINDOW self-test arms=${arms.length} failed=${failed}`)
    process.exit(failed === 0 ? 0 : 1)
  }

  if (argv.includes('--write')) {
    const cut = measureCut()
    const next = {
      schema: 'ute-a1-window/1',
      branch: 'vnext/a1-cut',
      base: ledger?.base ?? 'a19d1df018e772f20602f93bc726694524bdeb2f',
      note: 'The A1 window: master\'s required-green set still applies to the THREE Required contexts; everything else that cannot pass mid-cut is declared here, by file, with a reason and the phase that turns it green. Growing this list requires raising budget.max in the same diff.',
      requiredGreen: [...REQUIRED_GREEN],
      redList: ledger?.redList ?? [],
      budget: ledger?.budget ?? { max: 0 },
      cut,
    }
    writeFileSync(path, JSON.stringify(next, null, 2) + '\n')
    console.log(`UTE-A1-WINDOW write cut=${JSON.stringify(cut)} red=${next.redList.length}/${next.budget.max}`)
    process.exit(0)
  }

  if (!argv.includes('--check')) {
    console.error('usage: node scripts/ute-a1-window.mjs --check|--write|--self-test')
    process.exit(2)
  }
  if (ledger === null) {
    console.error(`UTE_A1_WINDOW_MISSING ${LEDGER_PATH} does not exist — the window must DECLARE its green set`)
    process.exit(1)
  }
  const findings = checkWindow(ledger, tracked(ROOT))
  for (const f of findings) console.error(`${f.code} ${f.detail}`)
  console.log(`UTE-A1-WINDOW ${findings.length === 0 ? 'pass' : 'fail'} branch=${ledger.branch} red=${ledger.redList?.length ?? '?'}/${ledger.budget?.max ?? '?'} cut=(${ledger.cut?.retiredSourcesOnDisk}/${ledger.cut?.retiredDistArtifacts}) findings=${findings.length}`)
  process.exit(findings.length === 0 ? 0 : 1)
}
