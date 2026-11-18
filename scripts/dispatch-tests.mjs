#!/usr/bin/env node
/**
 * dispatch-tests.mjs — TINF M6: the catalog-driven suite dispatcher.
 *
 * WHAT IT REPLACES. Until M6 a node:test leg's file set existed TWICE: as a `run: node --test <files>`
 * line in `.github/workflows/ci-integration.yml` and as a `check[]` array in
 * `dev/ci/eb3-ci-manifest.json`. `eb3-ci-required.mjs` exists because those two copies drifted. This
 * tool deletes the workflow copy: a leg's `run:` line names a LEG, and the file set is resolved here,
 * from the manifest's single declaration, and checked against the catalog's discovery.
 *
 * WHAT IT IS NOT. It is not a second authority. A leg declares WHICH discovered suites it runs
 * (`suites[]` for a subset of an area, `areas[]` for a whole area); discovery still comes from
 * `git ls-files` and the ONE test-file predicate exported by `scripts/test-catalog.mjs`. The dispatcher
 * refuses when a declared suite is not a tracked test file, when an area expands to nothing, or when
 * the resolved set is empty — an empty argv would make `node --test` run the whole repository, which is
 * the loudest possible version of "the leg was weakened".
 *
 * WHY `--run` IS PART OF THE DECLARED INVOCATION. A dispatcher that PRINTS an argv and exits 0 would be
 * a green step that runs nothing. The manifest leg's `cmd` ends with `--run`, so `eb3-ci-required`'s
 * allowlisted line reader proves the CI step actually executes the suites; `--run` is not defaulted.
 *
 * MODES ARE MUTUALLY EXCLUSIVE (TINF trust-closeout, F-01). Until this rule, `--run --json` printed the
 * plan JSON and exited 0 WITHOUT SPAWNING: a green CI step that ran nothing. `eb3-ci-required` could not
 * see it because it graded a cmd PREFIX. The dispatcher now refuses any combination of execution and
 * inspection modes by name (DISPATCH_MODE_CONFLICT, exit 2) before it reads the manifest, prints a
 * plan or spawns anything, `--run` without `--leg` is DISPATCH_NO_LEG, and the run token
 * (`DSH-TEST-DISPATCH … suites=N files=M`) is printed AFTER the spawn only.
 *
 * USAGE
 *   node scripts/dispatch-tests.mjs --leg <id> --run      # execute: node --test <resolved files>
 *   node scripts/dispatch-tests.mjs --leg <id>            # inspect: print the argv (mode=inspect)
 *   node scripts/dispatch-tests.mjs --leg <id> --run-args # inspect: print the argv explicitly
 *   node scripts/dispatch-tests.mjs --leg <id> --json     # inspect: {mode, leg, suites, argv}
 *   node scripts/dispatch-tests.mjs --list                # inspect: every leg + suite count
 *   node scripts/dispatch-tests.mjs --check               # inspect: every leg resolves
 *   node scripts/dispatch-tests.mjs --parity [--old-ref R]  # inspect: old-vs-new argv diff
 *
 * Exit: 0 ok | 2 REFUSED (named code on stderr) | otherwise the runner's own exit code under --run.
 *
 * @module scripts/dispatch-tests
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isNodeSuitePath } from './test-catalog.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const MANIFEST_REL = 'dev/ci/eb3-ci-manifest.json'
export const WORKFLOW_REL = '.github/workflows/ci-integration.yml'
/** The dispatcher's own argv[0..1]; a manifest leg must declare exactly this prefix (then --run). */
export const DISPATCHER_CMD = ['node', 'scripts/dispatch-tests.mjs']

// ------------------------------------------------------------------ refusals

function refused(code, detail) {
  process.stderr.write(`REFUSED ${code} ${String(detail).replace(/\s+/g, ' ').trim()}\n`)
  return 2
}

// ------------------------------------------------------------- leg resolution

/**
 * Every leg that declares a dispatcher invocation, in manifest order.
 *
 * TWO OWNERS, ONE SHAPE. A leg hangs off a `layers[].legs[]` entry (the ci-* layers) or off a
 * `knownNonRequired[]` entry that declares `legs[]` (a job whose Required-ness is declared there
 * instead — currently `pr-gate.yml#settlement`, the third Required context). Both are graded by the
 * same rules and resolved by the same dispatcher; what differs is only where the job's Required-ness
 * is written down, which is the manifest's business, not the dispatcher's.
 */
export function dispatchLegs(manifest) {
  const out = []
  const consider = (leg, workflow, owner) => {
    const cmd = Array.isArray(leg?.cmd) ? leg.cmd : []
    if (cmd.length < 3 || cmd[0] !== DISPATCHER_CMD[0] || cmd[1] !== DISPATCHER_CMD[1]) return
    if (cmd.includes('--leg') === false) return
    const at = cmd.indexOf('--leg')
    const id = cmd[at + 1]
    if (typeof id !== 'string' || id === '') return
    out.push({ layer: owner, workflow: workflow ?? WORKFLOW_REL, id, leg, explicit: cmd.includes('--run') })
  }
  for (const layer of manifest?.layers ?? []) {
    for (const leg of layer?.legs ?? []) consider(leg, layer?.workflow ?? WORKFLOW_REL, layer.id)
  }
  for (const entry of manifest?.knownNonRequired ?? []) {
    for (const leg of entry?.legs ?? []) consider(leg, entry.workflow ?? WORKFLOW_REL, `${entry.workflow}#${entry.job}`)
  }
  return out
}

export function loadManifest(root = REPO_ROOT) {
  const abs = resolve(root, MANIFEST_REL)
  if (!existsSync(abs)) throw new Error(`${MANIFEST_REL} is missing`)
  return JSON.parse(readFileSync(abs, 'utf8'))
}

/** The tracked-file universe, read ONCE. `-z` because a path may contain a space. */
export function trackedFiles(root = REPO_ROOT, run = execFileSync) {
  const out = run('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 64 * 1024 * 1024 })
  return new Set(out.toString('utf8').split('\0').filter(Boolean))
}

/**
 * Resolve ONE leg's suite set. Pure over (leg, tracked) so the laws are testable without git:
 *   - `suites[]`  explicit declared members: each MUST be a tracked node:test file.
 *   - `areas[]`   directory prefixes: every tracked node:test file under the prefix joins the leg.
 *                 This is the auto-collection half of M1: a new suite under such an area is collected
 *                 by CI without editing a list, which is the defect this milestone measures.
 * Anything else in the leg is not a suite source: a leg with neither refuses (never "run everything").
 */
export function resolveLeg(leg, tracked) {
  const declared = Array.isArray(leg?.suites) ? leg.suites : []
  const areas = Array.isArray(leg?.areas) ? leg.areas : []
  const problems = []
  const suites = new Set()
  for (const p of declared) {
    const rel = String(p).replace(/^\.\//, '')
    if (!isNodeSuitePath(rel)) {
      problems.push({ code: 'DISPATCH_SUITE_NOT_NODE_TEST', detail: `${rel} is not a node:test suite path` })
      continue
    }
    if (!tracked.has(rel)) {
      problems.push({ code: 'DISPATCH_SUITE_UNTRACKED', detail: `${rel} is declared by leg ${String(leg?.id)} but is not a tracked file (a plan cannot invent a suite)` })
      continue
    }
    suites.add(rel)
  }
  const areaCounts = []
  for (const raw of areas) {
    const area = String(raw).replace(/^\.\//, '').replace(/\/+$/, '')
    if (area === '') {
      problems.push({ code: 'DISPATCH_AREA_INVALID', detail: `leg ${String(leg?.id)} declares an empty area` })
      continue
    }
    const members = [...tracked].filter((p) => isNodeSuitePath(p) && p.startsWith(`${area}/`))
    if (members.length === 0) {
      problems.push({ code: 'DISPATCH_AREA_EMPTY', detail: `${area} expands to no tracked node:test suite — an empty area is not a small leg` })
      continue
    }
    areaCounts.push({ area, count: members.length })
    for (const m of members) suites.add(m)
  }
  const list = [...suites].sort()
  if (problems.length === 0 && list.length === 0) {
    problems.push({
      code: 'DISPATCH_NO_SUITES',
      detail: `leg ${String(leg?.id)} declares no suites[] and no areas[] — an empty argv would make \`node --test\` run the entire repository`,
    })
  }
  return { suites: list, areas: areaCounts, problems }
}

/** A stable digest of the resolved SET, so a transcript can name what ran without the list. */
export function setDigest(suites) {
  return `sha256:${createHash('sha256').update(JSON.stringify([...suites].sort())).digest('hex')}`
}

// ------------------------------------------------------------------- parity

/** Join shell line-continuations so a wrapped `node --test a \\\n b` yields both tokens. */
function joinedLines(text) {
  return String(text).replace(/\\\r?\n/g, ' ').split('\n')
}

/**
 * Old argv per STEP NAME from a workflow file's `run:` blocks. This reads the OLD form only
 * (`node --test <files>`), which is what M6 deletes; it is the "before" side of the parity proof.
 */
export function oldArgvByStep(workflowText) {
  const byStep = new Map()
  for (const block of String(workflowText).split(/^ {6}- name: /m).slice(1)) {
    const name = block.split('\n')[0].trim().replace(/^["']|["']$/g, '')
    const tokens = new Set()
    for (const line of joinedLines(block)) {
      const at = line.indexOf('node --test')
      if (at < 0) continue
      for (const raw of line.slice(at + 'node --test'.length).split(/\s+/)) {
        const tok = raw.replace(/^['"]|['"]$/g, '')
        if (!tok || tok.startsWith('-')) continue
        // A comment may spell a placeholder (`scripts/<name>.test.mjs`); it is prose, not a member.
        // Without this, the "before" side of the parity proof grew a file nobody ran.
        if (/[<>*?[\]{}]/.test(tok)) continue
        if (isNodeSuitePath(tok)) tokens.add(tok.replace(/^\.\//, ''))
      }
    }
    if (tokens.size > 0) byStep.set(name, [...tokens].sort())
  }
  return byStep
}

/** `--leg <id>` per STEP NAME from the NEW workflow form, so both sides are keyed the same way. */
export function legByStep(workflowText) {
  const byStep = new Map()
  for (const block of String(workflowText).split(/^ {6}- name: /m).slice(1)) {
    const name = block.split('\n')[0].trim().replace(/^["']|["']$/g, '')
    const m = /scripts\/dispatch-tests\.mjs[^\n]*?--leg\s+([A-Za-z0-9._-]+)/.exec(block)
    if (m) byStep.set(name, m[1])
  }
  return byStep
}

/**
 * Diff EVERY converted step: old `node --test` argv vs the dispatcher's resolved argv.
 * Returns { rows, ok } where a row is { step, leg, old, new, missing, added }. Sorted comparison,
 * because argv order is not a contract (the shell passes files in the order written; node does not
 * care). An empty missing/added on every row is the only passing state.
 */
export function parityReport({ oldText, newText, manifest, tracked = null, workflow = WORKFLOW_REL }) {
  const oldByStep = oldArgvByStep(oldText)
  const legByStepNew = legByStep(newText)
  const legsById = new Map(dispatchLegs(manifest).filter((l) => l.workflow === workflow).map((l) => [l.id, l.leg]))
  const rows = []
  const problems = []
  for (const [step, oldArgv] of oldByStep) {
    const legId = legByStepNew.get(step)
    if (legId === undefined) {
      problems.push(`step "${step}" still runs \`node --test\` and is not a dispatch step (not converted)`);
      continue
    }
    const leg = legsById.get(legId)
    if (leg === undefined) {
      problems.push(`step "${step}" dispatches unknown leg ${JSON.stringify(legId)}`)
      continue
    }
    const resolved = resolveLeg(leg, tracked ?? new Set(oldArgv))
    if (resolved.problems.length > 0) {
      problems.push(`leg ${legId}: ${resolved.problems.map((p) => `${p.code} ${p.detail}`).join(' ;; ')}`)
      continue
    }
    const oldSet = new Set(oldArgv)
    const newSet = new Set(resolved.suites)
    rows.push({
      workflow,
      step,
      leg: legId,
      old: oldArgv,
      new: resolved.suites,
      missing: [...oldSet].filter((p) => !newSet.has(p)).sort(),
      added: [...newSet].filter((p) => !oldSet.has(p)).sort(),
    })
  }
  const converted = [...legByStepNew.entries()].filter(([step]) => !oldByStep.has(step))
  for (const [step, legId] of converted) problems.push(`step "${step}" dispatches ${legId} but had no \`node --test\` argv on the old side`)
  const ok = problems.length === 0 && rows.every((r) => r.missing.length === 0 && r.added.length === 0)
  return { rows, problems, ok }
}

// ---------------------------------------------------------------------- cli

/**
 * Every CLI mode flag. ONE of these may be present in a valid invocation (or none: the default is
 * `inspect` for a `--leg` invocation). `--leg` is an operand, not a mode. Kept as a frozen list so the
 * conflict check cannot silently forget a flag when a new one is added.
 */
export const MODE_FLAGS = Object.freeze([
  ['--run', 'run'],
  ['--json', 'json'],
  ['--list', 'list'],
  ['--check', 'check'],
  ['--parity', 'parity'],
  ['--run-args', 'run-args'],
  ['--help', 'help'],
  ['-h', 'help'],
])

export function parseArgs(argv) {
  const opts = { leg: [], run: false, json: false, list: false, check: false, parity: false, runArgs: false, oldRef: 'origin/master', help: false, modes: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--leg') {
      const v = argv[i + 1]
      if (v === undefined || v.startsWith('--')) throw Object.assign(new Error('--leg needs an id'), { code: 'UNKNOWN_ARGUMENT' })
      opts.leg.push(v)
      i += 1
    } else if (a === '--run') { opts.run = true; opts.modes.push('run') }
    else if (a === '--json') { opts.json = true; opts.modes.push('json') }
    else if (a === '--list') { opts.list = true; opts.modes.push('list') }
    else if (a === '--check') { opts.check = true; opts.modes.push('check') }
    else if (a === '--parity') { opts.parity = true; opts.modes.push('parity') }
    else if (a === '--run-args') { opts.runArgs = true; opts.modes.push('run-args') }
    else if (a === '--old-ref') opts.oldRef = String(argv[(i += 1)])
    else if (a === '--help' || a === '-h') { opts.help = true; opts.modes.push('help') }
    else throw Object.assign(new Error(`unknown argument ${a}`), { code: 'UNKNOWN_ARGUMENT' })
  }
  return opts
}

/**
 * A mode COMBINATION is a refusal, not a precedence order. Any two distinct modes (including
 * `--run --run`? that is one mode twice, which is harmless and not a conflict) → DISPATCH_MODE_CONFLICT.
 * The check runs BEFORE the manifest is read, any plan/argv is printed, and any spawn.
 */
export function modeConflict(opts) {
  const distinct = [...new Set(opts.modes ?? [])]
  if (distinct.length <= 1) return null
  return `modes ${distinct.join(' + ')} are mutually exclusive — a single invocation either EXECUTES (--run) or INSPECTS (--json/--list/--check/--parity/--run-args/--help), never both; the F-01 defect was \`--run --json\` printing a plan and exiting 0 without spawning`
}

function main(argv) {
  let opts
  try {
    opts = parseArgs(argv)
  } catch (e) {
    return refused(e.code ?? 'UNKNOWN_ARGUMENT', e.message)
  }
  // F-01: mutually exclusive modes, refused by NAME before any manifest read/output/spawn.
  const conflict = modeConflict(opts)
  if (conflict !== null) return refused('DISPATCH_MODE_CONFLICT', conflict)
  const usage = [
    'usage: node scripts/dispatch-tests.mjs --leg <id> --run      (execute; modes are exclusive)',
    '       node scripts/dispatch-tests.mjs --leg <id> [--run-args|--json]',
    '       node scripts/dispatch-tests.mjs --list | --check',
    '       node scripts/dispatch-tests.mjs --parity [--old-ref origin/master]',
  ].join('\n')
  if (opts.help) {
    process.stdout.write(`${usage}\n`)
    return 0
  }
  // F-01: `--run` is an execution request; without a leg there is nothing to execute. Refuse by name
  // rather than falling through to the usage text (a generic exit 2 is not a named refusal).
  if (opts.run && opts.leg.length === 0) {
    return refused('DISPATCH_NO_LEG', '--run needs --leg <id>: there is no implicit leg, and an empty execution request must not be mistaken for a successful inspect')
  }
  const manifest = loadManifest(REPO_ROOT)
  const legs = dispatchLegs(manifest)
  if (legs.length === 0) return refused('DISPATCH_NO_LEGS', `${MANIFEST_REL} declares no dispatch leg`)

  if (opts.parity) {
    // ONE "before", TWO "after" files: ci-integration.yml and pr-gate.yml both used to carry their
    // own `node --test` argv. Every workflow that now has a dispatch leg is compared on its own.
    const tracked = trackedFiles(REPO_ROOT)
    const workflows = [...new Set(legs.map((l) => l.workflow))].sort()
    const rows = []
    const problems = []
    process.stdout.write(`dispatch-parity mode=inspect old=${opts.oldRef} new=worktree workflows=${workflows.join(',')}\n`)
    for (const wf of workflows) {
      let oldText
      try {
        oldText = execFileSync('git', ['show', `${opts.oldRef}:${wf}`], { cwd: REPO_ROOT, encoding: 'utf8' })
      } catch (e) {
        return refused('PARITY_OLD_UNREADABLE', `${opts.oldRef}:${wf}: ${String(e?.message ?? e)}`)
      }
      const newText = readFileSync(resolve(REPO_ROOT, wf), 'utf8')
      const report = parityReport({ oldText, newText, manifest, tracked, workflow: wf })
      process.stdout.write(`  ${wf}\n`)
      for (const r of report.rows) {
        process.stdout.write(
          `    ${r.step}: old=${String(r.old.length)} new=${String(r.new.length)} ` +
            `missing=${r.missing.length === 0 ? 'none' : r.missing.join(',')} added=${r.added.length === 0 ? 'none' : r.added.join(',')}\n`,
        )
        for (const p of r.old) process.stdout.write(`      old ${p}\n`)
        for (const p of r.new) process.stdout.write(`      new ${p}\n`)
      }
      for (const p of report.problems) process.stdout.write(`    UNCONVERTED ${p}\n`)
      rows.push(...report.rows)
      problems.push(...report.problems)
    }
    const oldAll = [...new Set(rows.flatMap((r) => r.old))].sort()
    const newAll = [...new Set(rows.flatMap((r) => r.new))].sort()
    process.stdout.write(`  union old=${String(oldAll.length)} new=${String(newAll.length)} set=${setDigest(newAll)}\n`)
    process.stdout.write(
      `DISPATCH-PARITY mode=inspect ${problems.length === 0 && rows.every((r) => r.missing.length === 0 && r.added.length === 0) ? 'IDENTICAL' : 'DIFFERS'} ` +
        `steps=${String(rows.length)} old_files=${String(oldAll.length)} new_files=${String(newAll.length)} problems=${String(problems.length)}\n`,
    )
    return problems.length === 0 && rows.every((r) => r.missing.length === 0 && r.added.length === 0) ? 0 : 1
  }

  const tracked = trackedFiles(REPO_ROOT)

  if (opts.list) {
    process.stdout.write(`DSH-TEST-DISPATCH-LIST mode=inspect legs=${String(legs.length)}\n`)
    for (const l of legs) {
      const r = resolveLeg(l.leg, tracked)
      process.stdout.write(`${r.problems.length === 0 ? 'ok ' : 'BAD'} ${l.id} suites=${String(r.suites.length)} layer=${l.layer}\n`)
      for (const p of r.problems) process.stdout.write(`    ${p.code} ${p.detail}\n`)
    }
    return 0
  }

  if (opts.check) {
    let bad = 0
    for (const l of legs) {
      const r = resolveLeg(l.leg, tracked)
      if (r.problems.length === 0) continue
      bad += 1
      for (const p of r.problems) process.stderr.write(`REFUSED ${p.code} leg=${l.id} ${p.detail}\n`)
    }
    process.stdout.write(`DSH-TEST-DISPATCH-CHECK mode=inspect ${bad === 0 ? 'PASS' : 'FAIL'} legs=${String(legs.length)} bad=${String(bad)}\n`)
    return bad === 0 ? 0 : 2
  }

  if (opts.leg.length === 0) {
    process.stderr.write(`${usage}\n`)
    return 2
  }
  const selected = []
  for (const id of opts.leg) {
    const hit = legs.find((l) => l.id === id)
    if (hit === undefined) {
      return refused('DISPATCH_LEG_UNKNOWN', `${JSON.stringify(id)} is not a dispatch leg in ${MANIFEST_REL} (known: ${legs.map((l) => l.id).join(', ')})`)
    }
    const r = resolveLeg(hit.leg, tracked)
    if (r.problems.length > 0) return refused(r.problems[0].code, `leg=${id} ${r.problems.map((p) => p.detail).join(' ;; ')}`)
    selected.push({ id, ...r })
  }
  const suites = [...new Set(selected.flatMap((s) => s.suites))].sort()
  if (suites.length === 0) return refused('DISPATCH_NO_SUITES', 'the selected leg(s) resolved to no suite')

  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ schema: 'test-dispatch/1', mode: 'inspect', legs: selected.map((s) => ({ id: s.id, suites: s.suites, areas: s.areas })), suites, set_digest: setDigest(suites), argv: ['node', '--test', ...suites] }, null, 2)}\n`)
    return 0
  }

  // INSPECT: the invocation that WOULD run. `mode=inspect` is in the human token too, so a transcript
  // that only captured stdout cannot be mistaken for an execution transcript.
  if (!opts.run) {
    for (const s of selected) {
      process.stdout.write(`DSH-TEST-DISPATCH mode=inspect leg=${s.id} suites=${String(s.suites.length)} files=${String(s.suites.length)} set=${setDigest(s.suites)}\n`)
    }
    process.stdout.write(`node --test ${suites.join(' ')}\n`)
    return 0
  }

  // F-01: EXECUTE. The resolved argv must be non-empty (DISPATCH_NO_SUITES above already guarantees
  // suites.length > 0; this assertion makes the invariant local to the spawn), and the ONLY run token
  // is printed AFTER spawnSync returns — there is no code path that prints it and exits 0 without
  // having spawned.
  if (suites.length === 0) return refused('DISPATCH_NO_SUITES', 'the resolved argv is empty — refusing instead of spawning `node --test` with no files (which would run the whole repository)')
  const runnerArgv = ['--test', ...suites]
  // PIPE, then forward, rather than stdio:'inherit': the token below must be printed AFTER every byte
  // of the child's own output, which inherit cannot order once the parent's stdout is a pipe (the
  // regression test for F-01 captures this process's stdout). maxBuffer matches the census spawn.
  const run = spawnSync(process.execPath, runnerArgv, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  if (run.error) return refused('DISPATCH_SPAWN_FAILED', String(run.error.message ?? run.error))
  if (run.stdout) process.stdout.write(run.stdout)
  if (run.stderr) process.stderr.write(run.stderr)
  const status = run.status ?? 1
  for (const s of selected) {
    process.stdout.write(`DSH-TEST-DISPATCH mode=run leg=${s.id} suites=${String(s.suites.length)} files=${String(s.suites.length)} exit=${String(status)} set=${setDigest(s.suites)}\n`)
  }
  return status
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)))
