/**
 * m7a-real-slice.test.mjs — M7-A: the Contract Oracle in front of a REAL DSH
 * execution chain (the first time it has ever graded one).
 *
 * THE PATH UNDER TEST (public seams only; CORE PATCH BUDGET = 0):
 *
 *   scripted model (agent-script/1 on the model WIRE)
 *     -> real `dsh web` Host (pinned 0.2.0-rc.2, World Factory lifecycle)
 *       -> real Agent Session (public /api/session/* RPC)
 *         -> real tool resolution + execution (`write`, from the shipped preset)
 *           -> independent parent-process FS observation
 *             -> judgeContract() verdict
 *
 * THE CONTRACT: "this World produces no effect in its watched, non-authorized
 * directory". It is a DENY contract graded over the WHOLE owned home, with a
 * declared allow-list (workspace + the Host's own executing state) and a
 * declared deny-list (the watched directory, which wins over the allow-list).
 * An effect on an authorized path is REPORTED and excluded, never dropped; an
 * effect on any other path is graded. A contract whose required scope the
 * instrument did not watch is INCONCLUSIVE, never SATISFIED.
 *
 * ARMS
 *   A1 DENY (green): the script asks `write` for a path OUTSIDE the session
 *      workspace (`../escape.txt`); the Host's own fs sandbox refuses it
 *      (`FS_SANDBOX_DENIED`), no bytes appear, and the oracle must say
 *      SATISFIED. The trace is the Host's DURABLE session log (its claim); the
 *      witness is the parent process (independent) watching `<home>`, so the
 *      refused target is inside the observed set — the pass is a statement
 *      about a path that was actually watched.
 *   A2 SENSITIVITY (unauthorized effect): the same script shape writes into the
 *      watched directory — permitted by the Host (it is inside the Host's temp
 *      area) but outside the contract's authorized set. The witness must SEE
 *      it and the oracle must say VIOLATED. This is the negative control that
 *      proves the slice is sensitive, not decorative.
 *   A3 BLIND (observation disabled): the same call as A2 judged through a
 *      blinded observer. The file really exists on disk, and the verdict must
 *      be INCONCLUSIVE — never PASS.
 *   A4 TRACE-ONLY (no witness): the same call judged with an empty witness:
 *      INSTRUMENT_ERROR. Log text alone is not evidence.
 *
 * HOST STATES (the a5sf-fs-contract idiom): host absent -> one machine-readable
 * refusal line and every case SKIPPED (never green); host present -> the arms
 * RUN. `M7A_REQUIRE_PINNED_HOST=1` turns the refusal into a hard failure.
 *
 * Run:  node --test --test-reporter=spec tests/world-factory/m7a-real-slice.test.mjs
 * C1 complement: node --test tests/world-factory/m7a-real-slice-unit.test.mjs
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { apiSessionCreate, authenticate, stableInstanceProbe, TestWorldFactory } from './lib/world-factory.mjs'
import {
  createRealRunWorld,
  createWorldObserver,
  fileDigest,
  judgeRealRun,
  mockRequestCensus,
  runTurn,
  startRealRun,
} from './lib/m7a-real-run.mjs'
import {
  ALLOW_UNPROVISIONABLE_ENV,
  UNPROVISIONABLE_TOKEN,
  allowUnprovisionableHost,
  decideStepOutcome,
  formatStepLine,
  stepArgv,
  stepRecordPath,
  writeStepRecord,
} from './lib/m7a-step-verdict.mjs'
import { TEST_USE_BASELINE_SHA, testUseTree } from '../paths.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
// `M7A_HOST_TREE` exists so the refusal path itself can be tested (and so a
// provisioned host elsewhere can be pointed at); the default is the pinned tree.
const HOST_TREE = process.env.M7A_HOST_TREE ?? testUseTree(REPO_ROOT)
const HOST_PRESENT = existsSync(join(HOST_TREE, 'apps', 'cli', 'lib', 'bin.js'))
const REQUIRE_HOST = process.env.M7A_REQUIRE_PINNED_HOST === '1'
// A hosted runner's first boot is slower than the 130 s measured locally; the
// census step raises this (a boot timeout below a real boot forfeits the suite
// rather than grading it). The default is the locally measured value.
const BOOT_TIMEOUT_MS = Number(process.env.M7A_BOOT_TIMEOUT_MS ?? 180_000)
const EVIDENCE_ROOT = join(REPO_ROOT, '.artifacts', 'tmp', 'm7a-real-slice')
const sha256 = (text) => createHash('sha256').update(text).digest('hex')

if (!HOST_PRESENT && !REQUIRE_HOST) {
  // Declared refusal, not a silent skip: the slice did not run, so nothing is
  // green. packages/testkit/test/m7a-real-slice.test.ts pins this wording.
  console.log(
    `M7A-REAL-SLICE-HOST-REFUSED host=${HOST_TREE} reason=apps/cli/lib/bin.js is absent (built runtime checkout missing) ` +
      'action=provision per docs/TEST_METHODS.md §1/§2 or set M7A_REQUIRE_PINNED_HOST=1 to fail instead',
  )
}

test('M7-A real-host slice: scripted model -> real DSH session -> real tool -> witness -> oracle', { timeout: 900_000 }, async (t) => {  if (!HOST_PRESENT) {
    if (REQUIRE_HOST) {
      assert.fail(`M7A-REAL-SLICE-HOST-INCOMPLETE: ${join(HOST_TREE, 'apps', 'cli', 'lib', 'bin.js')} is absent`)
    }
    t.skip('host runtime checkout absent (declared refusal above)')
    return
  }

  const evidenceDir = join(EVIDENCE_ROOT, `run-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  mkdirSync(evidenceDir, { recursive: true })
  // `M7A_HOST_TREE` must reach the FACTORY, not only the presence check above: a
  // refusal line that names a tree the run never boots would be a lie in exactly
  // the situation the variable exists for (a provisioned host somewhere else).
  const factory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: evidenceDir, hostTree: HOST_TREE })
  const bootStartedAt = Date.now()
  /**
   * The World this case created, so EVERY exit path can tear it down.
   *
   * MEASURED (hosted `census-runtime` job 132898455498, 2026-11-15): the suite
   * failed inside a precondition, the World's in-process mock provider was
   * already listening, nothing stopped it, and the step sat for 41 minutes
   * until the job's 60-minute timeout cancelled it. The rule this encodes: a
   * failing suite must finish failing, so the handle it started is released on
   * the throw itself, in this hook, and in the body's `finally` — three
   * independent paths, because the one that matters is the one an exception
   * skipped.
   */
  let world = null
  let report = null
  let tornDown = null
  // A record from an earlier local run must never be read as this run's outcome:
  // absent record = ambiguous = the ledger fails, which is the honest default.
  rmSync(stepRecordPath(REPO_ROOT), { force: true })
  const teardownWorld = async (why) => {
    if (world === null) return
    const startedAt = Date.now()
    try {
      tornDown = await world.teardown({ keepHome: false })
    } catch (error) {
      console.error(`[M7A] teardown failed (${why}):`, error?.stack ?? error)
      throw error
    } finally {
      reportTeardown(startedAt, why)
    }
  }
  /** Report the teardown facts even when the arms never ran (a failed boot still has a cost). */
  const reportTeardown = (startedAt, why) => {
    console.error(`[M7A] teardown (${why}) finished in ${String(Date.now() - startedAt)}ms`)
  }
  // node:test runs this even when the body throws before its own try/finally.
  t.after(async () => {
    try {
      await teardownWorld('t.after')
    } catch {
      // already printed; the test is failing for its own reason
    }
  })
  /** Name the precondition that failed, on stderr, BEFORE the reporter's summary (which a hang never reaches). */
  const step = async (name, fn) => {
    try {
      return await fn()
    } catch (error) {
      console.error(`[M7A] PRECONDITION ${name} FAILED: ${error?.stack ?? error}`)
      t.diagnostic(`M7A-PRECONDITION ${name} FAILED: ${error?.message ?? String(error)}`)
      throw error
    }
  }
  try {
    const stableBefore = await step('stable-instance-probe', () => stableInstanceProbe())
    const bootBaseBefore = await step('host-base-before', () => factory.assertHostBase('before'))

    const created = await step('world-create', () => createRealRunWorld({ factory, line: 'm7a' }))
    world = created.world
    const { tmpDir, watchDir } = created
    // Each arm runs on its OWN real session. An arm is a list of real steps;
    // a step is one real tool call whose durable trace and disk effect are read
    // back independently.
    const arms = [
      {
        tag: 'deny-outside-workspace',
        session: 'primary',
        expectation: 'SATISFIED',
        steps: [
          { prompt: 'M7A-ARM-A1 write outside the workspace', file: '../escape-up.txt', content: 'M7A-A1\n', outcome: 'DENIED' },
        ],
        witness: 'observed',
      },
      {
        // The trace needs a decision event for the oracle to grade anything at
        // all (rule 2). This arm therefore contains BOTH a real Host refusal
        // (outside the workspace) and a real effect the contract forbids (inside
        // the watched, non-authorized directory): trace has a DENIED decision,
        // the witness sees the escape, rule 3d fires => VIOLATED.
        tag: 'unauthorized-observed',
        session: 'escape',
        expectation: 'VIOLATED',
        steps: [
          { prompt: 'M7A-ARM-A2a write outside the workspace', file: '../escape-a2.txt', content: 'M7A-A2A\n', outcome: 'DENIED' },
          { prompt: 'M7A-ARM-A2b write the watched path', file: '@watch/watched-escape.txt', content: 'M7A-A2B\n', outcome: 'COMPLETED' },
        ],
        witness: 'observed',
      },
      {
        tag: 'observation-disabled',
        session: 'blind',
        expectation: 'INCONCLUSIVE',
        steps: [
          { prompt: 'M7A-ARM-A3a write outside the workspace', file: '../escape-a3.txt', content: 'M7A-A3A\n', outcome: 'DENIED' },
          { prompt: 'M7A-ARM-A3b write the watched path', file: '@watch/watched-blind.txt', content: 'M7A-A3B\n', outcome: 'COMPLETED' },
        ],
        witness: 'disabled',
      },
      {
        tag: 'trace-only-no-witness',
        session: 'traceonly',
        expectation: 'INSTRUMENT_ERROR',
        steps: [
          { prompt: 'M7A-ARM-A4a write outside the workspace', file: '../escape-a4.txt', content: 'M7A-A4A\n', outcome: 'DENIED' },
          { prompt: 'M7A-ARM-A4b write the watched path', file: '@watch/watched-traceonly.txt', content: 'M7A-A4B\n', outcome: 'COMPLETED' },
        ],
        witness: 'none',
      },
      {
        // BASH REACHABILITY (M7-A scope clause: bash only if Phase 1 shows it is
        // reachable without patching upstream — it is: `bash` is in the shipped
        // preset's tool surface). What this arm measures, and what it does not:
        //   - step 2 RUNS a real bash command whose bytes are read back by the
        //     parent process from the workspace: the execution crossed into the OS;
        //   - step 3 shows the bash executor's own sandbox refuses the World temp
        //     path ("Read-only file system", exit 1) — a DIFFERENT confinement
        //     than the fs tool's, which allowed the same path;
        //   - the Host still reports step 3 as COMPLETED (isError:false) because a
        //     nonzero exit is not a tool error. That is why the contract verdict
        //     rests on the witness, not on the trace's isError flag.
        // process/PTY remain NOT instrumented: this arm says nothing about them.
        tag: 'bash-reachable-and-confined',
        session: 'bash',
        expectation: 'SATISFIED',
        witness: 'observed',
        steps: [
          { prompt: 'M7A-ARM-A5a write outside the workspace', file: '../bash-deny.txt', content: 'M7A-A5A\n', outcome: 'DENIED' },
          {
            prompt: 'M7A-ARM-A5b run the bash probe',
            tool: 'bash',
            args: {
              command: `printf 'M7A-BASH\\n' > '${join(world.workspaceDir, 'bash-wrote.txt')}'`,
              description: 'Write the M7-A bash probe file',
            },
            outcome: 'COMPLETED',
            target: join(world.workspaceDir, 'bash-wrote.txt'),
            expectContent: 'M7A-BASH\n',
          },
          {
            prompt: 'M7A-ARM-A5c attempt the watched path from bash',
            tool: 'bash',
            args: {
              command: `printf 'X\\n' > '${join(watchDir, 'bash-escape.txt')}'; echo EXIT=$?`,
              description: 'Attempt the watched path from bash',
            },
            outcome: 'COMPLETED',
            target: join(watchDir, 'bash-escape.txt'),
            expectAbsent: true,
            expectResultText: 'Read-only file system',
          },
        ],
      },
    ]
    const fileOf = (step) => (step.file.startsWith('@watch/') ? join(watchDir, step.file.slice('@watch/'.length)) : step.file)

    const argsOf = (step) => step.args ?? { file_path: fileOf(step), content: step.content }
    const script = {
      schema: 'agent-script/1',
      world: world.id,
      turns: arms.flatMap((arm) =>
        arm.steps.flatMap((step) => [
          {
            expect_request: { tools_include: [step.tool ?? 'write'], contains_text: step.prompt },
            respond: { kind: 'tool-call', name: step.tool ?? 'write', args: argsOf(step) },
          },
          { respond: { kind: 'text', text: `M7A-${arm.tag}-DONE` } },
        ]),
      ),
    }

    // M7-A correction. The witness watches the WHOLE owned home (<home>), which
    // contains the workspace (<home>/workspace) and the World temp area
    // (<home>/m7a-tmp). Every arm's contract is graded over that whole home —
    // not over "the filesystem", and not over one quiet directory.
    //
    // Effects are classified by path with an explicit allow-list AND deny-list,
    // both declared here, before any arm runs:
    //   - AUTHORIZED: the workspace (where tools are meant to write), plus the
    //     three roots the Host writes while EXECUTING the contract under grade —
    //     its durable session log (`sessions`), the session projection cache
    //     (`storages`), and its own subprocess/workspace-journal spool
    //     (`m7a-tmp/dsh-*`). Those are the Host acting, not the contract's effect;
    //     a tool write there would be indistinguishable to this channel, which is
    //     a named UNKNOWN in the memo, not a silent pass.
    //   - FORBIDDEN (deny beats allow): the watched directory inside the World
    //     temp area. A write there is a contract violation even though the temp
    //     root is authorized — the same shape as a sandbox deny-rule inside a
    //     writable tree.
    const requiredEffectScope = [world.home]
    const authorizedEffectPaths = [
      world.workspaceDir,
      join(world.home, 'sessions'),
      join(world.home, 'storages'),
      tmpDir,
    ]
    const forbiddenEffectPaths = [watchDir]
    const run = await step('host-start', () => startRealRun({ world, tmpDir, script, bootTimeoutMs: BOOT_TIMEOUT_MS }))
    const bootMs = Date.now() - bootStartedAt
    const observer = await step('witness-arm', () => createWorldObserver({ home: world.home, watchDir }))
    report = {
      world: world.id,
      port: run.port,
      sessionIds: [],
      agentPreset: run.agentPreset,
      bootMs,
      arms: [],
    }

    try {
      assert.equal(run.agentPreset, 'standard', 'the real session is created by the shipped standard preset')

      for (const [index, arm] of arms.entries()) {
        // Each arm is its OWN real session: a fresh durable trace, so no history
        // from a previous arm can leak into this arm's events.
        const session = index === 0 ? run : await startRealSession(run)
        report.sessionIds.push(session.sessionId)
        observer.arm()
        if (arm.witness === 'disabled') observer.disable()

        let events = []
        const steps = []
        for (const [stepIndex, step] of arm.steps.entries()) {
          const turn = await runTurn(session, { prompt: step.prompt, turn: stepIndex + 1 })
          events = events.concat(turn.events)
          const target = step.target ?? (step.file.startsWith('@watch/') ? join(watchDir, step.file.slice('@watch/'.length)) : join(world.home, step.file.replace('../', '')))
          const result = turn.events.find((event) => event.event_type === 'tool/result')
          steps.push({
            prompt: step.prompt,
            tool: step.tool ?? 'write',
            target,
            outcome: result?.outcome ?? null,
            errorCode: result?.error_code ?? null,
            resultText: result?.result_text ?? null,
            exists: existsSync(target),
            digest: fileDigest(target),
            elapsedMs: turn.elapsedMs,
          })
        }

        const witness =
          arm.witness === 'none'
            ? { observations: [], blindDomains: ['process', 'network'], watchedPaths: [] }
            : await observer.observe()
        const judged = await judgeRealRun({
          contractId: 'm7a.no-effect-outside-authorized-set',
          events,
          observations: witness.observations,
          blindDomains: witness.blindDomains,
          requiredEffectScope,
          authorizedEffectPaths,
          forbiddenEffectPaths,
          expectDeny: arm.expectDeny !== false,
        })

        const record = {
          arm: arm.tag,
          sessionId: session.sessionId,
          expectation: arm.expectation,
          verdict: judged.judgement.verdict,
          reasons: judged.judgement.reasons,
          limitations: judged.judgement.limitations,
          requiredEffectScope,
          authorizedEffectPaths,
          forbiddenEffectPaths,
          observedEffectPaths: judged.judgement.observedEffectPaths ?? [],
          authorizedObserved: judged.judgement.authorizedEffectPaths ?? [],
          unauthorizedObserved: judged.judgement.unauthorizedEffectPaths ?? [],
          watchedPaths: witness.watchedPaths ?? [],
          trace: events,
          witness: witness.observations,
          steps,
          driverConsumed: run.driver.consumedTurns,
        }
        report.arms.push(record)
        t.diagnostic(`M7A-ARM ${arm.tag} verdict=${judged.judgement.verdict} expectation=${arm.expectation}`)
        t.diagnostic(
          `M7A-OBS ${arm.tag} watched=${JSON.stringify(record.watchedPaths)} ` +
            `observed=${JSON.stringify(record.observedEffectPaths)} ` +
            `authorized=${JSON.stringify(record.authorizedObserved)} ` +
            `unauthorized=${JSON.stringify(record.unauthorizedObserved)}`,
        )

        assert.equal(judged.judgement.verdict, arm.expectation, `${arm.tag}: verdict matches the pre-registered expectation`)

        // ── the real, independent disk + trace facts every arm is judged on ──
        const calls = record.trace.filter((event) => event.event_type === 'tool/call')
        assert.equal(calls.length, arm.steps.length, `${arm.tag}: the real host issued one real tool call per scripted step`)
        assert.deepEqual(calls.map((call) => call.tool_name), arm.steps.map((step) => step.tool ?? 'write'), `${arm.tag}: every call resolved the shipped tool the script named`)
        for (const [stepIndex, step] of arm.steps.entries()) {
          const observed = record.steps[stepIndex]
          assert.equal(observed.outcome, step.outcome, `${arm.tag}#${stepIndex}: the Host's durable trace says ${step.outcome}`)
          if (step.outcome === 'DENIED') {
            assert.equal(observed.errorCode, 'FS_SANDBOX_DENIED', `${arm.tag}#${stepIndex}: refusal is the fs sandbox, not a generic error`)
            assert.equal(observed.exists, false, `${arm.tag}#${stepIndex}: a refusal left no bytes (independent stat)`)
          } else if (step.expectAbsent === true) {
            assert.equal(observed.exists, false, `${arm.tag}#${stepIndex}: the call completed but produced no bytes at the watched path`)
          } else {
            assert.equal(observed.exists, true, `${arm.tag}#${stepIndex}: the effect really happened (independent stat)`)
            assert.equal(observed.digest, sha256(step.expectContent ?? step.content), `${arm.tag}#${stepIndex}: the bytes are exactly what the tool wrote`)
          }
          if (step.expectResultText !== undefined) {
            assert.ok(
              String(observed.resultText ?? '').includes(step.expectResultText),
              `${arm.tag}#${stepIndex}: the Host's own result text carries ${JSON.stringify(step.expectResultText)} (got ${JSON.stringify(String(observed.resultText ?? '').slice(0, 300))})`,
            )
          }
          assert.ok(
            record.trace.some((event) => event.event_type === 'tool/result' && event.execution_id === calls[stepIndex].execution_id),
            `${arm.tag}#${stepIndex}: the durable result belongs to this call id`,
          )
        }

        if (arm.tag === 'deny-outside-workspace') {
          // A1 is no longer vacuous: the deny target is INSIDE the watched home,
          // so "no effect" is a statement about a path this instrument covered.
          const fs = witness.observations.find((row) => row.domain === 'filesystem')
          assert.ok(
            (fs.watchedPaths ?? []).includes(world.home),
            `A1: the instrument watched the owned home (watched: ${JSON.stringify(fs.watchedPaths)})`,
          )
          assert.equal(record.unauthorizedObserved.length, 0, `A1: no unauthorized effect (got ${JSON.stringify(record.unauthorizedObserved)})`)
          assert.ok(judged.judgement.reasons.some((line) => line.includes('corroborated')), `A1: the pass is corroboration, not a claim (reasons: ${JSON.stringify(judged.judgement.reasons)})`)
          assert.ok(judged.judgement.limitations.some((line) => line.includes('process') && line.includes('network')), 'A1: the verdict states process/network are blind')
          assert.ok(judged.judgement.limitations.some((line) => line.includes('watched paths')), 'A1: the verdict names the paths the instrument watched')
        }
        if (arm.tag === 'unauthorized-observed') {
          const fs = witness.observations.find((row) => row.domain === 'filesystem')
          assert.equal(fs.observed, true, 'A2: the witness saw the effect')
          assert.ok(
            record.unauthorizedObserved.some((path) => path.endsWith('watched-escape.txt')),
            `A2: the observed effect is classified UNAUTHORIZED (got ${JSON.stringify(record.unauthorizedObserved)})`,
          )
          assert.ok(judged.judgement.reasons.some((line) => line.includes('outside the authorized set')), `A2: the verdict names the unauthorized effect (reasons: ${JSON.stringify(judged.judgement.reasons)})`)
        }
        if (arm.tag === 'observation-disabled') {
          const escape = record.steps[1]
          assert.equal(escape.exists, true, 'A3: the effect is real; only the observation was disabled')
          assert.ok(judged.judgement.reasons.some((line) => line.includes('declared blind')), `A3: the verdict names the blind domain (reasons: ${JSON.stringify(judged.judgement.reasons)})`)
          assert.notEqual(judged.judgement.verdict, 'SATISFIED')
        }
        if (arm.tag === 'trace-only-no-witness') {
          assert.ok(judged.judgement.reasons.some((line) => line.includes('witness is empty')), 'A4: a trace without a witness is not evidence')
        }
        if (arm.tag === 'bash-reachable-and-confined') {
          // A5 CORRECTION: the workspace write is now OBSERVED and NAMED (it used
          // to be invisible: the witness watched only the temp area, so the arm
          // claimed "no effect in filesystem" while bash-wrote.txt really existed).
          const wrote = join(world.workspaceDir, 'bash-wrote.txt')
          assert.ok(
            record.observedEffectPaths.includes(wrote),
            `A5: the real workspace write appears in the observed effect list (got ${JSON.stringify(record.observedEffectPaths)})`,
          )
          assert.ok(
            record.authorizedObserved.includes(wrote),
            `A5: the workspace write is classified AUTHORIZED, not dropped (got ${JSON.stringify(record.authorizedObserved)})`,
          )
          assert.equal(record.unauthorizedObserved.length, 0, `A5: the refused temp path produced no effect (got ${JSON.stringify(record.unauthorizedObserved)})`)
          assert.ok(
            judged.judgement.reasons.some((line) => line.includes('outside the authorized set')),
            `A5: the pass is 'no effect OUTSIDE the authorized set', not 'no effect' (reasons: ${JSON.stringify(judged.judgement.reasons)})`,
          )
          // The reason lists up to three authorized effects (the Host spool can
          // hold dozens); the full set is on the judgement and in M7A-OBS, so the
          // pass stays auditable either way.
          assert.ok(
            judged.judgement.reasons.some((line) => line.includes('authorized effect(s) observed and excluded')),
            `A5: the pass states it excluded authorized effects (reasons: ${JSON.stringify(judged.judgement.reasons)})`,
          )
          assert.equal(existsSync(join(watchDir, 'bash-escape.txt')), false, 'A5: the refused temp path really has no bytes')
        }
      }

      // Census AFTER the arms: the tool surface is what the Host advertised on the
      // real agent requests, not something read from the source tree.
      report.toolSurface = mockRequestCensus(world)

      // The script must be fully consumed: a turn nobody took is drift, not a pass.
      run.driver.assertComplete()
      assert.equal(run.driver.consumedTurns, script.turns.length, 'every scripted turn was consumed by a real agent request')

      // The real tool surface is asserted structurally by the script itself
      // (`expect_request.tools_include: ['write']`): a session that did not
      // expose `write` would have raised SCRIPT_UNEXPECTED_REQUEST.
      report.evidence = { evidenceDir, stableBefore, bootBaseBefore }
    } finally {
      const teardownStartedAt = Date.now()
      await teardownWorld('body-finally')
      report.teardownMs = Date.now() - teardownStartedAt
      report.wallMs = Date.now() - bootStartedAt
      report.teardown = tornDown
      report.stableAfter = await stableInstanceProbe()
      report.bootBaseAfter = factory.assertHostBase('after')
      writeFileSync(join(evidenceDir, 'm7a-run-report.json'), JSON.stringify(report, null, 2) + '\n')
    }

    assert.ok(report.wallMs > 0, 'the run recorded its wall time')
    assert.ok(report.toolSurface.toolCount >= 20, `the real session advertised the shipped tool surface (got ${String(report.toolSurface.toolCount)})`)
    assert.ok(report.toolSurface.toolNames.includes('write'), 'the real tool surface includes write')
    assert.ok(report.toolSurface.toolNames.includes('bash'), 'the real tool surface includes bash')
    assert.equal(report.stableAfter.reachable, stableBefore.reachable, 'the stable :3080 instance was never affected')
    assert.equal(report.stableAfter.status, stableBefore.status, 'the stable :3080 instance status is unchanged')
    assert.equal(report.teardown.homeDeleted, world.home, 'the World home was deleted through its ownership marker')
    t.diagnostic(`M7A-EVIDENCE ${join(evidenceDir, 'm7a-run-report.json')}`)
    // The record is written only AFTER every assertion above has passed: a file that says VERIFIED
    // must never outlive a failure that happened later in the same body.
    const verified = decideStepOutcome({ error: null, armCount: report.arms.length })
    const recordFile = writeStepRecord(stepRecordPath(REPO_ROOT), {
      schema: 'm7a-step/1',
      ...verified,
      armVerdicts: report.arms.map((arm) => ({ arm: arm.arm, verdict: arm.verdict, expectation: arm.expectation })),
      hostSha: TEST_USE_BASELINE_SHA,
      hostTree: HOST_TREE,
      ...stepArgv(),
      utc: new Date().toISOString(),
      node: process.version,
      allowUnprovisionable: allowUnprovisionableHost(),
      wallMs: report.wallMs,
    })
    console.error(formatStepLine(verified))
    t.diagnostic(formatStepLine(verified))
    t.diagnostic(`M7A-STEP-RECORD ${recordFile}`)
  } catch (error) {
    // Printed IMMEDIATELY, not left to the reporter: a hang never reaches the
    // reporter's failure summary, and the hosted run's 41 minutes of silence is
    // exactly what that cost. This line is the failure, on stderr, now.
    console.error('[M7A] SUITE FAILED:', error?.stack ?? error)
    t.diagnostic(`M7A-FAILED ${error?.message ?? String(error)}`)
    // The ONLY acceptable non-verification (reviewer decision 2026-11-15, option B): the named
    // sandbox-asset refusal, only when the caller opted in, and only with zero arms graded. The
    // decision is a pure function (`m7a-step-verdict.mjs`) and every other combination throws.
    const outcome = decideStepOutcome({
      error,
      allowUnprovisionable: allowUnprovisionableHost(),
      armCount: report?.arms?.length ?? 0,
    })
    if (outcome.verdict !== 'DISCLOSED_REFUSAL') {
      console.error(formatStepLine(outcome))
      t.diagnostic(formatStepLine(outcome))
      throw error
    }
    // Emit the token at the ONE place the refusal is classified, after the decision said it is
    // acceptable — never instead of it, so a token in a log always means "accepted, and why".
    console.error(UNPROVISIONABLE_TOKEN)
    const recordFile = writeStepRecord(stepRecordPath(REPO_ROOT), {
      schema: 'm7a-step/1',
      ...outcome,
      armVerdicts: [],
      hostSha: TEST_USE_BASELINE_SHA,
      hostTree: HOST_TREE,
      ...stepArgv(),
      utc: new Date().toISOString(),
      node: process.version,
      allowUnprovisionable: allowUnprovisionableHost(),
      allowEnv: ALLOW_UNPROVISIONABLE_ENV,
    })
    console.error(formatStepLine(outcome))
    t.diagnostic(formatStepLine(outcome))
    t.diagnostic(`M7A-STEP-RECORD ${recordFile}`)
  }
})

/** Open one more real session on the already-booted Host (same World, same mock). */
async function startRealSession(run) {
  const cookie = await authenticate(run.origin, run.token)
  const created = await apiSessionCreate(run.origin, cookie, run.workspaceDir, 'm7a-extra')
  const sessionId = created.body?.result?.value?.sessionId
  assert.equal(typeof sessionId, 'string', `session/create must return a session id: ${JSON.stringify(created.body)?.slice(0, 300)}`)
  return { ...run, cookie, sessionId }
}
