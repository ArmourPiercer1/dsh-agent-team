#!/usr/bin/env node
/**
 * verify-corrupt-world.mjs — prove, WITHOUT a GUI and WITHOUT a server, that a
 * damaged approval record in a durable world reaches the HUMAN READ PLANE.
 *
 * Both reads below are the production ones, loaded from this repo's built
 * output and wired as `packages/runtime/src/plugin/root.ts` wires them (the
 * precedent for the dispatcher leg is the merged acceptance test
 * `packages/runtime/test/a4w1-corrupt-warning.test.ts`):
 *
 *   READ A  ControlService.listControlState(teamSessionId)
 *           → `corruptLegs[]` with `sequence` + `disclosesMember`.
 *   READ B  createS6RemotePorts({ corruptControlLegs }) + createS6RemoteDispatcher
 *           → contract v9 `team.listCorruptControlLegs` — the exact payload the
 *           Team-page warning bar renders (count, per-row sequence, the
 *           attributable/unattributable flag, the truncation flag).
 *
 * It also prints the rest of the durable read (`ledger.list()` by factType and
 * the other control lists) so a reader can SEE that the refused row did not
 * make the ledger unread: the strict reader refuses ONE row, it does not fail
 * the whole ledger. That distinction is a fact about the limitation, not a
 * detail — see FINDINGS.md.
 *
 * Usage:
 *   node verify-corrupt-world.mjs [--expect-count <n>] [--world <dir>]
 *        [--repo <dir>] [--root <rootSessionId>] [--blueprint <world-relative yaml>]
 *
 * Exit codes: 0 when the read plane agrees with --expect-count (and, when the
 * world marker exists, with the sequence it recorded); 1 on a refusal; 2 when
 * the readings disagree with the expectation. This is a CHECK, not a printout.
 *
 * @module dev/agent-workflow/evidence/a4-pr7/human-acceptance/verify-corrupt-world
 */

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  DEFAULT_WORLD_NAME,
  LEDGER_REL_PATH,
  REPO_ROOT,
  WORLD_MARKER,
  fail,
  loadProductionReadSurface,
  openWorld,
  parseArgs,
  refuseRunningHost,
  resolveWorld,
} from './world-seam.mjs'

const { opts } = parseArgs(process.argv.slice(2))
const REPO = resolve(opts.get('repo') ?? REPO_ROOT)
const WORLD = resolveWorld(REPO, opts.get('world'), DEFAULT_WORLD_NAME, '--world')
const EXPECT_COUNT = Number.parseInt(opts.get('expect-count') ?? '1', 10)
const LEDGER_FILE = join(WORLD, LEDGER_REL_PATH)
const MARKER_PATH = join(WORLD, WORLD_MARKER)

const say = (line) => process.stdout.write(`${line}\n`)
const json = (value) => JSON.stringify(value, null, 2)

if (!Number.isInteger(EXPECT_COUNT) || EXPECT_COUNT < 0) fail(`--expect-count must be a non-negative integer, got '${opts.get('expect-count')}'.`)
await refuseRunningHost('the world under verification', WORLD)

const prod = await loadProductionReadSurface(REPO)
const opened = await openWorld(REPO, WORLD)

let exitCode = 0
try {
  const repositories = opened.domain.repositories
  const sessions = repositories.teamSessions.list()
  let root = opts.get('root')
  if (root === undefined) {
    if (sessions.length !== 1) {
      fail(`found ${sessions.length} team_sessions rows in ${WORLD}; pass --root <rootSessionId>.`)
    }
    root = String(sessions[0]?.['rootSessionId'] ?? '')
    if (root === '') fail(`the single team_sessions row of ${WORLD} carries no rootSessionId.`)
  }

  // The catalog the root would build for this world's anchor blueprint. The
  // read under test never dereferences it (listControlState reads teamSessions
  // + ledger only), but passing a real catalog keeps the service constructor
  // production-shaped instead of stub-shaped.
  const blueprintRel = opts.get('blueprint') ?? 'blueprints/a4-accept-team.yaml'
  const blueprintPath = join(WORLD, blueprintRel)
  let catalog = prod.createBlueprintCatalog([])
  let catalogNote = 'empty catalog (no blueprint file in the world)'
  if (existsSync(blueprintPath)) {
    catalog = prod.createBlueprintCatalog([prod.parseBlueprint(readFileSync(blueprintPath, 'utf8'))])
    catalogNote = `catalog over ${blueprintRel}`
  }

  const control = prod.createControlService({
    teamDomain: opened.domain,
    blueprintCatalog: catalog,
    // The acceptance world's row config declares exactly this
    // (`externalPolicyFacts: { hard: {}, capabilityExists: {} }`); the read
    // plane under test never consults it.
    externalPolicyFacts: async () => ({ hard: {}, capabilityExists: {} }),
    now: () => new Date().toISOString(),
  })

  say('═══ a4-w5 corrupt-world verification (production read plane, no server) ═══')
  say(`WORLD        : ${WORLD}`)
  say(`LEDGER FILE  : ${LEDGER_FILE}`)
  say(`TEAM (root)  : ${root}`)
  say(`SERVICE      : ControlService over the open TeamDomain, ${catalogNote}`)
  say('')

  // ── READ A: the durable control state, as the service itself reports it ───
  const state = await control.listControlState(root)
  say('── READ A  ControlService.listControlState() ──')
  say(`requests=${state.requests.length} decisions=${state.decisions.length} ` +
      `consumptions=${state.consumptions.length} abandonments=${state.abandonments.length} ` +
      `escalations=<not exposed on this route>`)
  say(`corruptCount = ${state.corruptLegs.length}`)
  say(`corruptLegs  = ${json(state.corruptLegs.map((c) => ({
    sequence: c.sequence,
    requestId: c.requestId ?? null,
    approvalCaseId: c.approvalCaseId ?? null,
    disclosesMember: c.disclosesMember,
  })))}`)
  say('')

  // ── READ B: the browser-facing v9 wire, through the production dispatcher ─
  const ports = prod.createS6RemotePorts({
    rootSessionId: root,
    repositories: {},
    // The SAME closure shape root.ts installs (control.listControlState → corruptLegs).
    corruptControlLegs: (r) => control.listControlState(r).then((s) => s.corruptLegs),
  })
  const dispatcher = prod.createS6RemoteDispatcher(ports, () => {
    throw new Error('a corrupt-leg read must never derive a principal')
  })
  const wire = await dispatcher('team.listCorruptControlLegs', {
    version: 9,
    params: { teamSessionId: root },
  })
  say('── READ B  s6 dispatcher → team.listCorruptControlLegs (contract v9) ──')
  if (wire.ok !== true) {
    say(`REFUSED: ${json(wire.error ?? wire)}`)
    exitCode = 2
  } else {
    const cell = wire.value?.data?.corruption ?? wire.value?.corruption
    say(json(cell ?? wire.value))
    const count = cell?.corruptCount
    const legs = Array.isArray(cell?.legs) ? cell.legs : []
    say('')
    say(`corruptCount = ${count}   (expect ${EXPECT_COUNT})`)
    say(`disclosesMember = ${json(legs.map((l) => l.disclosesMember))}`)

    // ── verdicts ────────────────────────────────────────────────────────────
    const problems = []
    if (count !== EXPECT_COUNT) problems.push(`corruptCount ${count} !== expected ${EXPECT_COUNT}`)
    if (EXPECT_COUNT >= 1) {
      const unattributed = legs.filter((l) => l.disclosesMember === false).length
      if (unattributed !== legs.length) {
        problems.push('every served row must be disclosesMember=false (this recipe writes the unattributable shape)')
      }
      if (existsSync(MARKER_PATH)) {
        let marker
        try {
          marker = JSON.parse(readFileSync(MARKER_PATH, 'utf8'))
        } catch {
          problems.push(`world marker ${MARKER_PATH} is unreadable`)
        }
        const recorded = marker?.damagedSequence
        if (recorded !== undefined && recorded !== null) {
          if (!legs.some((l) => l.sequence === recorded)) {
            problems.push(`the wire did not serve the sequence the injector recorded (${recorded})`)
          } else {
            say(`marker cross-check: injector recorded sequence ${recorded} and the wire served it`)
          }
        }
      }
    }
    if (problems.length > 0) {
      say('')
      for (const p of problems) say(`MISMATCH: ${p}`)
      exitCode = 2
    } else {
      say('')
      say(`VERDICT: PASS — the read plane reports corruptCount=${count} exactly as expected`)
    }
  }
  say('')

  // ── the rest of the ledger still reads (refused row ≠ unreadable ledger) ──
  const entries = repositories.ledger.list()
  const byFactType = {}
  for (const entry of entries) {
    byFactType[entry.factType] = (byFactType[entry.factType] ?? 0) + 1
  }
  say('── STILL READABLE  (the same world, other durable reads) ──')
  say(`ledger rows      : ${entries.length}`)
  say(`by factType      : ${json(byFactType)}`)
  say(`team_sessions    : ${sessions.length} row(s), generation=${sessions[0]?.generation ?? 'n/a'}`)
  say(`member_instances : ${repositories.memberInstances.list(root).length}`)
  say(`control requests : ${state.requests.length} (a refused leg row is excluded; accepted rows are not)`)
  say('')
  say('NOTE: this is the ledger the STRICT control reader refuses ONE row of. The storage')
  say('      layer read above enumerated every row including the damaged one; the control')
  say('      reader filed it as a corrupt leg instead of defaulting it. Both facts are part')
  say('      of the limitation statement — see FINDINGS.md.')
} finally {
  await opened.close()
}

process.exit(exitCode)
