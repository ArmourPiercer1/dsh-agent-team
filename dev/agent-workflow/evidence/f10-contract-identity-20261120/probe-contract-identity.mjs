#!/usr/bin/env node
/**
 * probe-contract-identity.mjs — a re-runnable, host-free probe for F-10.
 *
 * It RE-DERIVES the counterexample and the five refusals without any test
 * framework: run it in the worktree that carries the fix and every line must
 * name the expected refusal; run it with the two lib files reverted to
 * `ef7e3af00` and the same lines pass (the probe then exits 1).
 *
 *   node dev/agent-workflow/evidence/f10-contract-identity-20261120/probe-contract-identity.mjs
 *
 * Exit 0 = every control refused by name and the positive control accepted.
 * Exit 1 = at least one control was accepted / answered the wrong name.
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const HERE = new URL('.', import.meta.url).pathname
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const TMP_ROOT = join(REPO_ROOT, '.artifacts', 'tmp', 'f10-probe')

const load = (relative) => import(pathToFileURL(join(REPO_ROOT, relative)).href)
const { TestWorld, TestWorldFactory } = await load('tests/world-factory/lib/world-factory.mjs')
const { checkWindowBinding, contractWorldIdentity, declareObservationContract } = await load('tests/world-factory/lib/m7b1-observation-contract.mjs')
const identity = await load('tests/world-factory/lib/world-identity.mjs')

mkdirSync(TMP_ROOT, { recursive: true })
const root = mkdtempSync(join(TMP_ROOT, 'probe-'))
const failures = []
const line = (tag, expected, actual) => {
  const ok = expected === actual
  if (!ok) failures.push(`${tag}: expected ${expected}, got ${JSON.stringify(actual)}`)
  process.stdout.write(`F10-PROBE ${tag} expected=${expected} actual=${JSON.stringify(actual)} ${ok ? 'OK' : 'MISMATCH'}\n`)
}

try {
  const homeA = join(root, 'home-a')
  const homeB = join(root, 'home-b')
  const watchedA = join(homeA, 'watched')
  const watchedB = join(homeB, 'watched')
  mkdirSync(watchedA, { recursive: true })
  mkdirSync(watchedB, { recursive: true })
  const factory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: join(root, 'evidence'), hostTree: join(root, 'no-host') })
  const probeWorld = (home, id) => new TestWorld(factory, { id, name: id, home, workspaceDir: join(home, 'workspace'), visible: false })
  const worldA = probeWorld(homeA, 'probe-world-a')
  const worldB = probeWorld(homeB, 'probe-world-b')
  const contract = declareObservationContract({ world: worldA, agentId: 'agent-owner', executionId: 'exec-shared', scope: [watchedA] })
  const other = declareObservationContract({ world: worldB, agentId: 'agent-b', executionId: 'exec-b', scope: [watchedB] })

  line('POSITIVE', true, contractWorldIdentity(contract).ok)

  // (a) Object.create(validContract) + overridden world_id
  const derived = Object.create(contract)
  Object.defineProperty(derived, 'world_id', { value: 'another-world', enumerable: true, configurable: true })
  line('A-DERIVED-OVERRIDE', 'CONTRACT_IDENTITY_UNPROVEN', contractWorldIdentity(derived).reason ?? 'ACCEPTED')

  // (b) the same child with NO override
  line('B-DERIVED-UNCHANGED', 'CONTRACT_IDENTITY_UNPROVEN', contractWorldIdentity(Object.create(contract)).reason ?? 'ACCEPTED')

  // (c) Reflect.ownKeys / getOwnPropertySymbols reflection copy
  const copy = {}
  for (const key of Reflect.ownKeys(contract)) Object.defineProperty(copy, key, Object.getOwnPropertyDescriptor(contract, key))
  line('C-SYMBOL-REFLECTION', 'CONTRACT_IDENTITY_UNPROVEN', contractWorldIdentity(copy).reason ?? 'ACCEPTED')

  // (d) a minted contract whose world_id is mutated after minting
  if (typeof identity.declareContractIdentity !== 'function') {
    line('D-MUTATED-AFTER-MINT', 'CONTRACT_FIELDS_MISMATCH', 'PRE-FIX (no declareContractIdentity)')
  } else {
    const mutable = {}
    for (const symbol of Object.getOwnPropertySymbols(contract)) Object.defineProperty(mutable, symbol, Object.getOwnPropertyDescriptor(contract, symbol))
    for (const key of Object.keys(contract)) Object.defineProperty(mutable, key, { value: contract[key], writable: true, enumerable: true, configurable: true })
    identity.declareContractIdentity(mutable, {
      world_id: contract.world_id,
      world_home: contract.world_home,
      agent_id: contract.agent_id,
      execution_id: contract.execution_id,
      contract_id: contract.contract_id,
    })
    mutable.world_id = 'another-world'
    line('D-MUTATED-AFTER-MINT', 'CONTRACT_FIELDS_MISMATCH', contractWorldIdentity(mutable).reason ?? 'ACCEPTED')
  }

  // (e) two Worlds' contracts cross-wired
  const crossWired = Object.create(contract)
  for (const field of ['world_id', 'world_home', 'agent_id', 'execution_id', 'contract_id', 'world_identity']) {
    Object.defineProperty(crossWired, field, { value: other[field], enumerable: true, configurable: true })
  }
  line('E-CROSS-WIRED', 'CONTRACT_IDENTITY_UNPROVEN', contractWorldIdentity(crossWired).reason ?? 'ACCEPTED')

  // (f) execution_id matches, actor_id belongs to another agent
  const window = {
    window_id: 'probe-window',
    world_id: contract.world_id,
    agent_id: contract.agent_id,
    execution_id: contract.execution_id,
    phase: 'post',
    closedAt: '2026-11-20T00:00:00.000Z',
    armedAt: '2026-11-20T00:00:00.000Z',
    watchedPaths: [...contract.scope],
    producedBy: '@dsh-agent-team/testkit/effect-witness@1',
  }
  const events = [
    { schema: 'agent-execution-event/1', event_seq: 1, event_type: 'tool/call', actor_id: 'agent-other', execution_id: contract.execution_id, outcome: 'DISPATCHED' },
    { schema: 'agent-execution-event/1', event_seq: 2, event_type: 'tool/result', actor_id: 'agent-other', execution_id: contract.execution_id, outcome: 'COMPLETED' },
  ]
  const foreign = checkWindowBinding({ contract, window, events })
  line('F-ACTOR-MISMATCH', 'ACTOR_ID_MISMATCH', foreign === null ? 'ACCEPTED' : foreign.reason)
  const own = checkWindowBinding({ contract, window, events: events.map((event) => ({ ...event, actor_id: 'agent-owner' })) })
  line('F-ACTOR-OWNER', null, own === null ? null : own.reason)
} finally {
  rmSync(root, { recursive: true, force: true })
}

process.stdout.write(`F10-PROBE ${failures.length === 0 ? 'PASS' : 'FAIL'} controls=${7} failures=${failures.length}\n`)
for (const failure of failures) process.stdout.write(`F10-PROBE-FAILURE ${failure}\n`)
process.exit(failures.length === 0 ? 0 : 1)
