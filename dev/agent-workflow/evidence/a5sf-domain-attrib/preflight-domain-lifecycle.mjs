#!/usr/bin/env node
/**
 * preflight-domain-lifecycle.mjs — the PRE-START control for the
 * `TeamDomain is closed` boot failure class (boot #5, PR #627).
 *
 * WHAT IT DECIDES: given a RUN PLAN (the JSON shape below), it returns a
 * classification that is falsifiable host-free and that names the evidence
 * experiment which establishes the mechanism behind each verdict.
 *
 * WHAT IT CANNOT DECIDE (the honest part — README §4): whether a runtime
 * fiber-lifetime event that the plan does NOT declare will tear down the
 * storage-domain fiber inside the boot window. boot #5's own plan carries no
 * such declaration (no required row failed, no reload was declared), so this
 * control classifies it CLEAN — i.e. it would NOT have predicted boot #5.
 * That falsification is the finding: no plan-only predicate can separate
 * boot #5 from a green boot of the same plan, because the difference is a
 * runtime event, not a property of the plan.
 *
 * PLAN SHAPE:
 *   {
 *     "planId": string,
 *     "homeFresh": boolean,            // is the target DSH_HOME unstamped?
 *     "bootPhase": "create" | "resume",
 *     "runtimeReload": { "possible": boolean, "why"?: string },
 *     "rows": [
 *       { "id": string,
 *         "kind": "product-row" | "host-row" | "preset",
 *         "module": string|null,       // path or file:// URL or package spec
 *         "required": boolean,
 *         "moduleCheck": "assert" | "skip",
 *         "fault": null | string,      // declared defect (e.g. "apply-throws")
 *         "declares"?: string }
 *     ]
 *   }
 *
 * USAGE:
 *   node preflight-domain-lifecycle.mjs --plan plans/plan-boot5-five-rows.json
 *   node preflight-domain-lifecycle.mjs --self-test
 *
 * Exit 0 for both modes when the classification is produced / self-test holds.
 * This script never starts a Host, never opens a port, never reads DSH_HOME,
 * and never writes anything but stdout.
 *
 * @module dev/agent-workflow/evidence/a5sf-domain-attrib/preflight-domain-lifecycle
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..', '..')

/** The verdict vocabulary (closed set — a plan can only get one of these). */
const VERDICTS = {
  CLEAN: 'CLEAN',
  TEAM_DOMAIN_EXISTS: 'PREDICTED_TEAM_DOMAIN_EXISTS',
  SCHEMA_STAMP_MISSING: 'PREDICTED_SCHEMA_STAMP_MISSING',
  BOOTSTRAP_DOMAIN_CLOSED: 'PREDICTED_BOOTSTRAP_DOMAIN_CLOSED',
  ABORT_ON_PENDING_BOOT: 'PREDICTED_ABORT_ON_PENDING_BOOT',
  UNDETERMINED: 'UNDETERMINED',
}

/**
 * The fixed list of conditions this control is BLIND to. Every verdict
 * carries it verbatim, because a pre-start control's most dangerous output is
 * a confident CLEAN that the reader mistakes for a liveness guarantee.
 */
const BLIND_TO = [
  'a runtime fiber disposal that the plan does not declare (loader unwind, Fiber._reload, an independent plugin disposer)',
  'a profile reload triggered after the plan was read (client-hmr / plugin-manager / any writer of profiles/<name>/cordis.patch.yml)',
  'a second boot or another process opening the same durable medium',
  'a port collision that aborts the composition after the boot window opened',
  'a readiness probe whose TIMING is not declared (this control sees the gate MODE, not the boot duration)',
  'the ORDER in which two independent async bootstraps touch the shared domain',
  'any row whose declared module resolves but throws later at mount time (moduleCheck only asserts existence)',
]

/** The reason each class exists, with the experiment that establishes it. */
const CLASSES = {
  [VERDICTS.TEAM_DOMAIN_EXISTS]: {
    reason: 'bootPhase "create" over a non-fresh home: createTeamDomain refuses a stamped medium before bootstrap runs',
    evidence: ['E5a'],
    decisive: 'homeFresh == false && bootPhase == "create"',
  },
  [VERDICTS.SCHEMA_STAMP_MISSING]: {
    reason: 'bootPhase "resume" over a fresh home: openTeamDomain finds no baseline schema stamp',
    evidence: ['E5b'],
    decisive: 'homeFresh == true && bootPhase == "resume"',
  },
  [VERDICTS.BOOTSTRAP_DOMAIN_CLOSED]: {
    reason:
      'the composition is disposed inside the boot window (a required row cannot mount, or a declared reload replaces the tree); ' +
      'the shared storage-domain facility closeAll() runs under the detached Team bootstrap, and the product reports that teardown as TeamDomain-closed',
    evidence: ['E2', 'E2b', 'E3'],
    decisive: 'a required row declares a fault / its module is missing, or runtimeReload.possible == true',
  },
  [VERDICTS.ABORT_ON_PENDING_BOOT]: {
    reason:
      'the readiness gate probes ONCE while the product boot is still pending (the production row returns from apply before its tracked ready settles, and the p6t6 health route exists only once ready settles), ' +
      'so the probe reads 404, the driver aborts, the world teardown closes the shared storage domain under the still-pending bootstrap, and the run records the teardown as TeamDomain-closed',
    evidence: ['E7', 'E7b', 'E2'],
    decisive: 'readiness.gate == "single-probe" && readiness.bootSettlesAsync == true && readiness.probeGatedOnReady != true',
  },
  [VERDICTS.CLEAN]: {
    reason: 'no declared defect, no declared reload, and the create/resume axis matches the home state',
    evidence: ['E1', 'E1b', 'E4'],
    decisive: 'none of the decisive conditions above hold',
  },
  [VERDICTS.UNDETERMINED]: {
    reason: 'the plan does not carry the home-freshness axis, so the deterministic create/resume classes cannot be decided',
    evidence: ['E5a', 'E5b'],
    decisive: 'homeFresh is absent or not a boolean',
  },
}

/** Resolve a plan module reference to a path we can existence-check. */
function modulePath(module) {
  if (typeof module !== 'string' || module.length === 0) return null
  if (module.startsWith('file://')) {
    try {
      return fileURLToPath(module)
    } catch {
      return null
    }
  }
  if (module.startsWith('.')) return resolve(HERE, 'plans', module)
  if (isAbsolute(module)) return module
  return null // a bare package specifier is not existence-checkable here
}

/** Classify ONE run plan. Pure: no I/O except the module existence probe. */
export function classify(plan) {
  const out = (verdict, extra = {}) => ({
    planId: typeof plan?.planId === 'string' ? plan.planId : '(unnamed)',
    verdict,
    reason: CLASSES[verdict].reason,
    decisive: CLASSES[verdict].decisive,
    evidence: CLASSES[verdict].evidence,
    blindTo: BLIND_TO,
    ...extra,
  })

  if (typeof plan !== 'object' || plan === null) {
    return out(VERDICTS.UNDETERMINED, { detail: 'plan is not an object' })
  }
  if (typeof plan.homeFresh !== 'boolean') {
    return out(VERDICTS.UNDETERMINED, { detail: 'homeFresh missing/not boolean' })
  }
  const rows = Array.isArray(plan.rows) ? plan.rows : []
  const faults = []
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const id = typeof row.id === 'string' ? row.id : '(unnamed row)'
    const required = row.required !== false
    if (typeof row.fault === 'string' && row.fault.length > 0) {
      faults.push({ row: id, required, fault: row.fault, why: 'declared fault' })
      continue
    }
    if (row.moduleCheck === 'assert') {
      const path = modulePath(row.module)
      if (path !== null && !existsSync(path)) {
        faults.push({ row: id, required, fault: 'module-missing', why: `module does not exist: ${path}` })
      }
    }
  }
  const fatalFaults = faults.filter((f) => f.required)
  if (fatalFaults.length > 0) {
    return out(VERDICTS.BOOTSTRAP_DOMAIN_CLOSED, { detail: 'required-row composition fault', faults: fatalFaults })
  }
  if (plan.bootPhase === 'create' && plan.homeFresh === false) {
    return out(VERDICTS.TEAM_DOMAIN_EXISTS)
  }
  if (plan.bootPhase === 'resume' && plan.homeFresh === true) {
    return out(VERDICTS.SCHEMA_STAMP_MISSING)
  }
  const readiness = plan.readiness
  if (
    readiness !== null &&
    typeof readiness === 'object' &&
    readiness.gate === 'single-probe' &&
    readiness.bootSettlesAsync === true &&
    readiness.probeGatedOnReady !== true
  ) {
    return out(VERDICTS.ABORT_ON_PENDING_BOOT, {
      detail:
        'the single readiness probe can observe the legitimate pending state as 404; a 404 is not a boot failure (E7b: a settled failure answers 200 {ok:false})',
      probe: { atMs: readiness.probeAtMs ?? null, routeRegisteredWhen: readiness.routeRegisteredWhen ?? null },
      fix: 'poll /__p6t6/health until 200 (ok true or false) or until bootTimeoutMs, and treat 404 as PENDING',
    })
  }
  if (plan.runtimeReload?.possible === true) {
    return out(VERDICTS.BOOTSTRAP_DOMAIN_CLOSED, {
      detail: 'declared runtime reload in the boot window',
      reloadWhy: plan.runtimeReload.why ?? '(no reason given)',
    })
  }
  return out(VERDICTS.CLEAN, {
    toleratedFaults: faults, // optional-row faults the Host is expected to tolerate
    warning:
      'CLEAN is a statement about the PLAN, not about the run. Boot #5 classified CLEAN and still failed — the missing declaration was a runtime event (README §4).',
  })
}

// --- CLI ---------------------------------------------------------------------

/** Load the evidence record so self-test can prove each verdict's mechanism. */
function evidenceRecord() {
  const path = join(HERE, 'domain-attrib.json')
  if (!existsSync(path)) {
    console.error(`preflight: missing ${path} — run domain-attrib.mjs first (the self-test cross-checks against it)`)
    process.exit(1)
  }
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** The self-test: every plan fixture must classify as declared, and every
 * verdict's cited experiment must exist and hold in domain-attrib.json. */
function selfTest() {
  const evidence = evidenceRecord()
  const passing = new Set(evidence.results.filter((r) => r.pass).map((r) => r.id))
  const cases = [
    ['plan-boot5-five-rows.json', VERDICTS.ABORT_ON_PENDING_BOOT],
    ['plan-boot5-polling-gate.json', VERDICTS.CLEAN],
    ['plan-clean-minimal.json', VERDICTS.CLEAN],
    ['plan-composition-fault.json', VERDICTS.BOOTSTRAP_DOMAIN_CLOSED],
    ['plan-reload-in-window.json', VERDICTS.BOOTSTRAP_DOMAIN_CLOSED],
    ['plan-stale-home-create.json', VERDICTS.TEAM_DOMAIN_EXISTS],
    ['plan-resume-fresh.json', VERDICTS.SCHEMA_STAMP_MISSING],
    ['plan-unknown-home.json', VERDICTS.UNDETERMINED],
  ]
  let failed = 0
  console.log('preflight-domain-lifecycle self-test')
  for (const [file, expected] of cases) {
    const plan = JSON.parse(readFileSync(join(HERE, 'plans', file), 'utf8'))
    const verdict = classify(plan)
    const evidenceOk = verdict.evidence.every((id) => passing.has(id))
    const pass = verdict.verdict === expected && evidenceOk
    if (!pass) failed += 1
    console.log(
      `${pass ? '[PASS]' : '[FAIL]'} ${file}: ${verdict.verdict}${pass ? '' : ` (expected ${expected}; evidenceOk=${evidenceOk})`}`,
    )
  }
  // Boot #5's REAL plan, classified against the run's preserved artefacts:
  // the control predicts the abort-on-pending-boot class, and its decisive
  // fact (a 404 probe on a route that only exists once `ready` settles) is
  // exactly what the run recorded. The one thing it still cannot predict is
  // WHEN the boot would have settled — see BLIND_TO.
  const boot5 = classify(JSON.parse(readFileSync(join(HERE, 'plans', 'plan-boot5-five-rows.json'), 'utf8')))
  const predicted = boot5.verdict === VERDICTS.ABORT_ON_PENDING_BOOT
  const evidenceOk = boot5.evidence.every((id) => passing.has(id))
  if (!predicted || !evidenceOk) failed += 1
  console.log(
    `${predicted && evidenceOk ? '[PASS]' : '[FAIL]'} boot #5's real plan is predicted ${VERDICTS.ABORT_ON_PENDING_BOOT} (matches health 404 + abortedDuring health-gate; evidence ${boot5.evidence.join(', ')})`,
  )
  console.log(`\n${cases.length + 1 - failed}/${cases.length + 1} classification expectations hold (0 starts)`)
  if (failed > 0) process.exitCode = 1
}

const argv = process.argv.slice(2)
const planIndex = argv.indexOf('--plan')
if (argv.includes('--self-test')) {
  selfTest()
} else if (planIndex !== -1 && argv[planIndex + 1] !== undefined) {
  const plan = JSON.parse(readFileSync(resolve(process.cwd(), argv[planIndex + 1]), 'utf8'))
  console.log(JSON.stringify(classify(plan), null, 2))
} else {
  console.error('usage: preflight-domain-lifecycle.mjs --plan <plan.json> | --self-test')
  process.exitCode = 2
}
