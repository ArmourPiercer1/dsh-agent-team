#!/usr/bin/env node
/**
 * eb3-node-test-collection.mjs — every tracked *.test.mjs is collected by CI or exempted by name.
 *
 * WHY. The a5w-uncollected audit (dev/agent-workflow/evidence/a5w-uncollected-20261031/AUDIT.md)
 * computed the set difference by hand and found 32 of 38 tracked `*.test.mjs` files that NO
 * collection source runs — the same silent exposure that had already produced two named
 * incidents: eb3-tool-acceptance's law fixtures (a mutation of containsVerbatim kept every
 * layer green, #529 review seat) and tests/checks/dist-placements.test.mjs (4/5 red on clean
 * master, nobody ran it). Audits rot; this file makes the difference a standing law, run
 * inside ci-integration right after eb3-ci-required.
 *
 * THE LAW:
 *   CI_NODE_TEST_UNCOLLECTED <path>   a tracked *.test.mjs is named in NO collection source
 *                                     (no cmd/check token of any leg in dev/ci/eb3-ci-manifest.json,
 *                                     no explicit `node --test` line in pr-gate.yml or ci-*.yml)
 *                                     AND carries no entry in the EXEMPT table below. RED.
 *
 * WARNINGS (never red, because the tree is better off than the law requires):
 *   CI_NODE_TEST_EXEMPT_NOW_COLLECTED <path>  an exempted file is collected — delete the exemption.
 *   CI_NODE_TEST_EXEMPT_STALE <path>          an exempted path is no longer tracked — delete the entry.
 *
 * THE EXEMPT TABLE IS THE ONLY PERMITTED WAY to keep a tracked *.test.mjs out of CI, and every
 * entry must carry 路径|类别|理由|复评触发 (path | category | reason | re-review trigger).
 * An exemption without a trigger is an audit waiting to happen; add the trigger or collect the
 * suite. The table lives HERE, not in the workflow, so a PR cannot quietly drop a file from a
 * step without this gate naming it.
 *
 * Output contract (style of eb3-ci-required.mjs):
 *   findings printed one per line, then the summary:
 *   EB3-NODE-TEST-COLLECTION pass|fail files=<tracked> exempt=<table size> findings=<N> warnings=<N>
 *   exit 0 pass · exit 1 fail · exit 2 could-not-grade (refused, never a silent green).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const TEST_FILE = /(?:^|\/)[^/]*\.test\.mjs$/

/**
 * The exemption table: one entry per tracked *.test.mjs that is DELIBERATELY not collected.
 * reason cites the measured evidence (AUDIT.md rows carry the runlogs); recheck names the
 * concrete condition that re-opens the question — when it fires, re-run the file and either
 * wire it into a leg+step or rewrite the entry with a new dated reason.
 * Categories: BOOT-KIT = boot/e2e kit semantics, seat-discipline forbids CI runs;
 * ENV-DEP = environment/provisioning precondition, re-measure on a qualifying box;
 * POC = proof-of-concept evidence artifact, not yet a standing contract file.
 */
export const EXEMPT = Object.freeze([
  {
    path: 'tests/kits/pr-e-requirement-recovery-smoke/stage2-observer.test.mjs',
    category: 'BOOT-KIT',
    reason: 'observes real launch records (launchUrl/token record face); kit semantics target booted worlds (AUDIT row 23)',
    recheck: 'a CI job that boots a world exists (boot lane) — re-run inside it, else keep exempt',
  },
  {
    path: 'tests/kits/pr-e-requirement-recovery-smoke/ui-observe.test.mjs',
    category: 'BOOT-KIT',
    reason: 'kit-directory adjudication over the --ui-observe world record face (AUDIT row 24)',
    recheck: 'a CI job that boots a world exists (boot lane)',
  },
  {
    path: 'tests/kits/rc2-real-host-smoke/run-control.regression.test.mjs',
    category: 'BOOT-KIT',
    reason: 'watchdog regression of the rc2 REAL-HOST smoke suite (spawn+ipc host lifecycle) (AUDIT row 25)',
    recheck: 'a CI job that boots a world exists (boot lane)',
  },
  {
    path: 'tests/kits/rc2-real-host-smoke/runner-wiring.regression.test.mjs',
    category: 'BOOT-KIT',
    reason: 'imports spawnHost from ./rc2-real-host-smoke.mjs and tests production spawn owning its child before any boot await (AUDIT row 26)',
    recheck: 'a CI job that boots a world exists (boot lane)',
  },
  {
    path: 'tests/kits/team-view-sync-complete-e2e/carrier-import-preflight.test.mjs',
    category: 'BOOT-KIT',
    reason: 'kit-directory adjudication over the boot preflight script (spawnSync) (AUDIT row 27)',
    recheck: 'a CI job that boots a world exists (boot lane)',
  },
  {
    path: 'tests/kits/team-view-sync-complete-e2e/dod20-ui-driver.test.mjs',
    category: 'BOOT-KIT',
    reason: 'e2e kit: TEST_USE runtime jsdom + browser-launch semantics ("fatal before any browser launch" verdict face) (AUDIT row 28)',
    recheck: 'a CI job that boots a world exists (boot lane)',
  },
  {
    path: 'tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-orchestration.test.mjs',
    category: 'BOOT-KIT',
    reason: 'e2e kit: makeWorld/bootTeamRequests/launchUrl orchestration face (AUDIT row 29)',
    recheck: 'a CI job that boots a world exists (boot lane)',
  },
  {
    path: 'tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-ownership.test.mjs',
    category: 'BOOT-KIT',
    reason: 'e2e kit: chromium.launchServer(...).process() process-ownership face + spawn (AUDIT row 30)',
    recheck: 'a CI job that boots a world exists (boot lane)',
  },
  {
    path: 'tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-rail-dom.test.mjs',
    category: 'BOOT-KIT',
    reason: 'kit-directory adjudication: rail DOM on TEST_USE jsdom, kit semantics = boot-evidence driven (AUDIT row 31)',
    recheck: 'a CI job that boots a world exists (boot lane)',
  },
  {
    path: 'tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-rail-identity.test.mjs',
    category: 'BOOT-KIT',
    reason: 'kit-directory adjudication: member identity → pre-browser-launch verdict face (AUDIT row 32)',
    recheck: 'a CI job that boots a world exists (boot lane)',
  },
  {
    path: 'tests/world-factory/world-factory.test.mjs',
    category: 'ENV-DEP',
    reason: '44/44 completed cases green; the one unfinished saturation case (host leasing → 13000 band) is RCA-1 black-hole-box timeout arithmetic (portInUse eats 1500ms per probed port across 19+50 leases > 60s), an environment property, not a product red (AUDIT row 21, runlogs/wf-tail.log)',
    recheck: 're-run once on a normal-RST box (regular Linux/GH runner) OR with a leg timeout >= 180s; green => SAFE, wire it into a step+leg and delete this entry',
  },
  {
    path: 'tests/world-factory/host-sandbox-assets.test.mjs',
    category: 'ENV-DEP',
    reason: '17/28 red on this box, fail-closed BY DESIGN against unprovisioned native assets (SOURCE/DESTINATION_DIGEST_MISMATCH on bin/glibc/system.node; T19 ENOENT /srv/workspace — this box has no shared baseline). Registered, NOT fixed; TEST_METHODS §9 supply command owns the precondition (AUDIT row 22, §4)',
    recheck: 'after the reference machine is provisioned per TEST_METHODS §9, re-run; still red after a CORRECT provisioning => escalate to RUN-RED and fix (product/manifest pin defect)',
  },
  {
    path: 'tests/world-factory/poc/poc-native-present.test.mjs',
    category: 'POC',
    reason: '38/38 green in 0.43s but it is a PoC evidence artifact importing the built lib of a PROVISIONED tests/deepseek-harness-test-use checkout — GitHub-hosted runners do not provision that runtime (AUDIT row 20, runtime-dependency disclosure §2)',
    recheck: 'if it graduates from PoC evidence to a standing contract file AND runner provisioning of the test-use runtime exists, re-measure and wire it; until then keep exempt',
  },
])

/** Tracked *.test.mjs paths (the universe the law grades). */
export function trackedTestFiles({ root = ROOT, run = execFileSync } = {}) {
  const out = run('git', ['ls-files', '-z', '*.test.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  return String(out).split('\0').filter((s) => s !== '').sort()
}

/** *.test.mjs tokens named by manifest legs (cmd + check arrays of every layer). */
export function manifestCollectionTokens(manifest) {
  const found = new Set()
  for (const layer of manifest?.layers ?? []) {
    for (const leg of layer?.legs ?? []) {
      for (const token of [...(leg?.cmd ?? []), ...(leg?.check ?? [])]) {
        if (typeof token === 'string' && TEST_FILE.test(token)) found.add(token.replace(/^\.\//, ''))
      }
    }
  }
  return found
}

/**
 * *.test.mjs tokens named by explicit `node --test` lines in the PARSED workflows
 * (pr-gate.yml + ci-*.yml — the collection sources; other workflows do not collect
 * .test.mjs: census-runtime.yml's mention is a comment, which parsing excludes).
 */
export function workflowCollectionTokens(workflows) {
  const found = new Set()
  for (const [name, text] of workflows) {
    if (!(name === '.github/workflows/pr-gate.yml' || /^\.github\/workflows\/ci-[^/]*\.ya?ml$/.test(name))) continue
    const doc = parseYaml(text)
    for (const job of Object.values(doc?.jobs ?? {})) {
      for (const step of job?.steps ?? []) {
        if (typeof step?.run !== 'string') continue
        for (const line of step.run.split('\n')) {
          const m = line.match(/^\s*(?:[\w.]+=\S+\s+)*node\s+--test\s+(.*)$/)
          if (m === null) continue
          for (const tok of m[1].trim().split(/\s+/)) {
            const clean = tok.replace(/^["']/, '').replace(/["']$/, '')
            if (TEST_FILE.test(clean)) found.add(clean.replace(/^\.\//, ''))
          }
        }
      }
    }
  }
  return found
}

/** Grade the set difference. Pure — the caller supplies the three views. */
export function gradeCollection({ tracked, collected, exempt = EXEMPT }) {
  const byPath = new Map(exempt.map((e) => [e.path, e]))
  const findings = []
  const warnings = []
  for (const f of tracked) {
    if (collected.has(f)) continue
    if (!byPath.has(f)) findings.push({ code: 'CI_NODE_TEST_UNCOLLECTED', detail: `${f} — tracked, collected by no manifest leg and no explicit node --test line, and absent from the EXEMPT table: add it to a step+leg, or add a dated exemption with a re-review trigger` })
  }
  for (const e of exempt) {
    if (!tracked.includes(e.path) && !collected.has(e.path)) warnings.push({ code: 'CI_NODE_TEST_EXEMPT_STALE', detail: `${e.path} — exemption entry names a file that is no longer tracked (and collected nowhere); delete the entry` })
    else if (collected.has(e.path)) warnings.push({ code: 'CI_NODE_TEST_EXEMPT_NOW_COLLECTED', detail: `${e.path} — collected by CI while still exempt; delete the EXEMPT entry (${e.category})` })
  }
  return { findings, warnings }
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  const json = process.argv.includes('--json')
  let out
  try {
    const tracked = trackedTestFiles()
    if (tracked.length === 0) throw new Error('git ls-files returned no tracked *.test.mjs — this does not look like the repo checkout the law grades')
    const manifest = JSON.parse(readFileSync(join(ROOT, 'dev/ci/eb3-ci-manifest.json'), 'utf8'))
    const wfDir = join(ROOT, '.github/workflows')
    const workflows = new Map()
    for (const f of readdirSync(wfDir).sort()) {
      if (!/\.ya?ml$/.test(f)) continue
      if (!(f === 'pr-gate.yml' || (f.startsWith('ci-') && /\.ya?ml$/.test(f)))) continue
      workflows.set(`.github/workflows/${f}`, readFileSync(join(wfDir, f), 'utf8'))
    }
    if (workflows.size === 0) throw new Error('no collection workflows found under .github/workflows')
    const collected = new Set([...manifestCollectionTokens(manifest), ...workflowCollectionTokens(workflows)])
    const { findings, warnings } = gradeCollection({ tracked, collected })
    out = { files: tracked.length, exempt: EXEMPT.length, findings, warnings }
  } catch (e) {
    console.error(`EB3-NODE-TEST-COLLECTION refused could-not-grade: ${String(e?.message ?? e)}`)
    process.exit(2)
  }
  if (json) console.log(JSON.stringify(out, null, 2))
  else {
    for (const w of out.warnings) console.log(`  WARNING ${w.code} ${w.detail}`)
    for (const f of out.findings) console.log(`  ${f.code} ${f.detail}`)
    console.log(`EB3-NODE-TEST-COLLECTION ${out.findings.length === 0 ? 'pass' : 'fail'} files=${String(out.files)} exempt=${String(out.exempt)} findings=${String(out.findings.length)} warnings=${String(out.warnings.length)}`)
  }
  process.exit(out.findings.length === 0 ? 0 : 1)
}
