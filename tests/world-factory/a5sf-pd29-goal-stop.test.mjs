/**
 * PD-29 (GOAL-STOP) — host-free pins for the two composition facts the live
 * pair cannot keep honest on its own.
 *
 * The live evidence (`dev/agent-workflow/evidence/a5sf-pd29-goal-stop/`) is the
 * acceptance: an agreeing two-boot `DEV-LIVE` pair in which every Stop arm is
 * judged on the Member's OWN durable event log (no round, no tool call, no
 * model request in a measured silent window). This suite is the cheap guard
 * that keeps that shape from rotting:
 *
 *   PD29-GOAL-ROW        the governed preset still DECLARES `tool-goal` (the
 *                        PD-25 removal stays reverted) and still does not
 *                        declare `tool-ask-user`.
 *   PD29-STOP-SEQUENCE   the shipped stop path is cancel → disarm → durable
 *                        pause, looked up by the DERIVED child session id (the
 *                        empty-`childSessionId` column is why the first two
 *                        boots silently did nothing), and the durable pause is
 *                        attempted before the process-local disarm.
 *   PD29-PIN             the same read against the base commit fails: this is
 *                        a pin over `git show`, so a revert of the lane turns
 *                        the arm red instead of passing quietly.
 *   PD29-MUTATION        a copy of the file with the disarm call deleted must
 *                        redden PD29-STOP-SEQUENCE (the arm has teeth).
 *
 * No boot, no Host, no policy compiler: `CORE PATCH BUDGET = 0`, and nothing
 * here imports the upstream tree.
 *
 * @module tests/world-factory/a5sf-pd29-goal-stop.test
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')
const BINDINGS = 'packages/runtime/src/plugin/live/agent-bindings.mjs'
const BASE_COMMIT = process.env.A5SF_PD29_BASE ?? '24d2cf760'

function read(rel, rev = null) {
  if (rev === null) return readFileSync(join(REPO_ROOT, rel), 'utf8')
  return execFileSync('git', ['show', `${rev}:${rel}`], { cwd: REPO_ROOT, encoding: 'utf8' })
}

/**
 * Every plugin row in the `preset-a5sf-governed-member` group, flattened.
 * The group is a `- id: "preset-…"` row carrying a `config.plugins` list, so the
 * slice ends at the NEXT preset row (the file holds several presets, and
 * matching plugin ids across all of them would make the arm meaningless).
 */
function governedRows(yaml) {
  const lines = yaml.split('\n')
  const start = lines.findIndex((line) => /^\s*-\s*id:\s*["']?preset-a5sf-governed-member["']?\s*$/.test(line))
  assert.notEqual(start, -1, 'cordis.patch.yml must declare the preset-a5sf-governed-member row')
  const rows = []
  for (const line of lines.slice(start + 1)) {
    if (/^\s*-\s*id:\s*["']?preset-/.test(line)) break
    const id = /^\s*-\s*id:\s*["']?([A-Za-z0-9_-]+)["']?\s*$/.exec(line)
    if (id !== null) { rows.push({ id: id[1] }); continue }
    const name = /^\s*name:\s*["']?([^"'\s]+)["']?\s*$/.exec(line)
    if (name !== null && rows.length > 0 && (name[1].startsWith('@') || name[1].startsWith('./'))) rows[rows.length - 1].name = name[1]
  }
  return rows
}

test('PD29-GOAL-ROW: the governed preset declares tool-goal and not tool-ask-user', () => {
  const rows = governedRows(read('cordis.patch.yml'))
  const goal = rows.find((r) => r.id === 'tool-goal')
  assert.ok(goal !== undefined, 'the governed preset must declare the tool-goal row again (PD-25 removal stays reverted)')
  assert.equal(goal.name, '@deepseek-ai/dsh-tool-goal')
  assert.equal(rows.some((r) => r.id === 'tool-ask-user'), false, 'ask-user stays closed')
})

/** The stop path's shape, as a list of ordered facts. */
function stopFacts(source) {
  const interrupt = /function interrupt\(target\)\s*\{([\s\S]*?)\n  \}/.exec(source)
  assert.ok(interrupt !== null, 'agent-bindings must still publish an interrupt(target) lifecycle port')
  const body = interrupt[1]
  const disarm = /function disarmStoppedGoal\(agent, target\)\s*\{([\s\S]*?)\n  \}/.exec(source)
  assert.ok(disarm !== null, 'the PD-29 disarm seam must exist')
  const disarmBody = disarm[1]
  return {
    cancels: body.includes("handle.agent.cancel({ kind: 'user' })"),
    callsDisarm: body.split('\n').some((line) => line.trim() === 'disarmStoppedGoal(handle.agent, target)'),
    derivesChildSid: body.includes('childSessionIdFor('),
    pushesNoLiveObservation: body.includes('found NO live agent'),
    pauseBeforeDisarm: disarmBody.indexOf('goals.pause(') !== -1 && disarmBody.indexOf('goals.pause(') < disarmBody.indexOf('goals.disarm('),
    pauseCarriesCas: /goals\.pause\(agent, \{ id: before\.id, revision: before\.revision \}\)/.test(disarmBody),
    disarms: disarmBody.includes('goals.disarm(agent)'),
  }
}

test('PD29-STOP-SEQUENCE: cancel, then disarm, then the durable CAS pause', () => {
  const facts = stopFacts(read(BINDINGS))
  assert.deepEqual(facts, {
    cancels: true,
    callsDisarm: true,
    derivesChildSid: true,
    pushesNoLiveObservation: true,
    pauseBeforeDisarm: true,
    pauseCarriesCas: true,
    disarms: true,
  })
})

test('PD29-PIN: the base commit had no disarm seam (a revert reddens this suite)', () => {
  const base = read(BINDINGS, BASE_COMMIT)
  assert.equal(base.includes('disarmStoppedGoal'), false, `base ${BASE_COMMIT} must not contain the PD-29 disarm seam`)
  assert.throws(() => stopFacts(base))
})

test('PD29-MUTATION: deleting the disarm call reddens the stop sequence', () => {
  const source = read(BINDINGS)
  const mutated = source.replace('    disarmStoppedGoal(handle.agent, target)', '    // disarmStoppedGoal(handle.agent, target)')
  assert.notEqual(mutated, source)
  const dir = mkdtempSync(join(tmpdir(), 'pd29-mutation-'))
  try {
    const file = join(dir, 'agent-bindings.mjs')
    writeFileSync(file, mutated)
    const facts = stopFacts(readFileSync(file, 'utf8'))
    assert.equal(facts.callsDisarm, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
