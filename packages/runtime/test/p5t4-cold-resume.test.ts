/**
 * p5t4-cold-resume — TaskDoc §11.5 must-test group 4: COLD RESUME (the
 * process-restart model, verified THROUGH the binder): a fresh bind on the
 * first process image installs the effective capability; after a restart
 * (NEW binder + NEW mock-first surface over the SAME durable TeamDomain
 * world and the SAME injected config) the cold rehydrate restores the
 * scope WITHOUT re-running any fresh-time side effect:
 *
 * - the restored scope carries the FULL slot order (persona → model →
 *   capability) — the capability facet is part of the durable scope;
 * - ZERO fresh-time effects on the cold path: no `installOverlay` call,
 *   no `agent-setup/overlay-installed` event, no slot `apply` (the slot's
 *   seams record nothing new — the cold path never re-installs);
 * - the resolution is IDEMPOTENT: the same durable world + the same
 *   injected config recompute to the SAME effective sets (the core formula
 *   is a pure function of the config; the source sets are explicitly
 *   injected from the durable/policy state);
 * - an already-bound cold rehydrate on the same binder is a no-op
 *   (`already-bound`): no second `restoreScope`, no duplicate events;
 * - the binder never WRITES the durable world (zero-write proof, the P4
 *   file seam `writeLog`).
 *
 * Mock-first (ruling R28): no live Agent, no port, no `node:` builtin; the
 * durable truth is the real P4 repositories over the testkit FileStorageSeam
 * (reopened with a NEW seam instance — the process-restart model). The
 * async world setup is module-top-level (the plain-node vitest shim runs
 * synchronous `it` bodies only, the p5t1 convention).
 *
 * @module @dsh-agent-team/runtime/test/p5t4-cold-resume
 */

import { describe, expect, it } from 'vitest'

import {
  ADMISSION_OPEN_CODE,
  AGENT_SETUP_EVENT_NAMES,
  OVERLAY_SLOT_ORDER,
  TeamAgentBinder,
} from '../agent-setup/binder/index.js'
import {
  FakeAgentSetupSurface,
  readHandleFor,
  restartTeamWorld,
  seedTeamWorld,
} from './p5t1-helpers.js'
import {
  createCapabilityOverlaySlot,
  resolveCapabilityOverlay,
} from '../agent-setup/capability/index.js'
import {
  destroyDir,
  makeCapabilityConfig,
  restoredScopesFor,
  wireCapabilityBinder,
} from './p5t4-helpers.js'

// ---------------------------------------------------------------------------
// The durable world (seeded once; the binder never writes it) and its
// post-restart re-open (a NEW seam instance over the SAME scratch dir —
// the process-restart model; the durable files outlive the realm).
// ---------------------------------------------------------------------------

const world = await seedTeamWorld('p5t4-cold')
const domain2 = await restartTeamWorld(world.scratchDir)

describe('P5-T4 must-test: cold resume (no fresh-time side effects, idempotent resolution)', () => {
  it('a fresh bind installs the effective capability, then a cold rehydrate after restart restores the scope only', () => {
    const { config, seams } = makeCapabilityConfig()
    const wired = wireCapabilityBinder(world, config)
    const root = world.ids.rootSessionId
    const child = world.ids.childSessionId

    // --- process image 1: the fresh bind (the first-install effects).
    const e1 = wired.binder.bindFreshRoot(root)
    expect(e1.installed).toBe(true)
    expect(seams['tools-permissions'].installed.length).toBe(1)
    expect(seams['tools-permissions'].installed[0]).toEqual([
      'tool-read',
      'tool-write',
      'tool-search',
      'perm-fs-workspace',
      'perm-net-web',
    ])
    const writesAfterFresh = [...world.seam.writeLog]
    expect(world.seam.writeCount).toBe(writesAfterFresh.length)

    // --- the restart: NEW binder + NEW surface over the SAME durable
    // world (reopened with a fresh seam instance) and the SAME config.
    const surface2 = new FakeAgentSetupSurface()
    const slot2 = createCapabilityOverlaySlot({ config })
    const binder2 = new TeamAgentBinder({
      surface: surface2,
      teamDomain: readHandleFor(domain2),
      slots: { capability: slot2 },
    })

    const e2 = binder2.rehydrateColdRoot(root)

    expect(e2.bound).toBe(true)
    expect(e2.installed).toBe(true)
    // The restored scope carries the FULL slot order (capability included)
    // and the target identity.
    expect(restoredScopesFor(surface2, root).length).toBe(1)
    expect(restoredScopesFor(surface2, root)[0]).toEqual({
      kind: 'root',
      rootSessionId: root,
      slots: OVERLAY_SLOT_ORDER,
    })
    // ZERO fresh-time side effects on the cold path.
    expect(surface2.countCalls('installOverlay', root)).toBe(0)
    expect(surface2.eventsFor(root)).toEqual([
      { name: AGENT_SETUP_EVENT_NAMES.scopeRestored, detail: 'root' },
      { name: AGENT_SETUP_EVENT_NAMES.admissionDecided, detail: ADMISSION_OPEN_CODE },
    ])
    expect(slot2.applied.length).toBe(0)
    expect(slot2.lastResolution === null).toBe(true)
    // The shared seams record NOTHING new: the cold path never re-installs.
    expect(seams['tools-permissions'].installed.length).toBe(1)
    expect(seams['skills'].installed.length).toBe(1)
    expect(seams['mcp'].installed.length).toBe(1)
    expect(seams['pre-step-pre-execute'].installed.length).toBe(1)
    // Idempotent resolution: same durable world + same config ⇒ the same
    // effective sets (the pure core formula recomputed from the config).
    const recomputed = resolveCapabilityOverlay(config)
    expect(recomputed['tools-permissions'].effective).toEqual(seams['tools-permissions'].installed[0])
    expect(recomputed['skills'].effective).toEqual(['skill-review', 'skill-test'])
    expect(recomputed['mcp'].effective).toEqual(['mcp-streamable-http'])
    expect(recomputed['pre-step-pre-execute'].effective).toEqual(['guard-pre-step', 'guard-pre-execute'])

    // --- the cold MEMBER path (same restart, same new surface).
    const e3 = binder2.rehydrateColdMember(child)
    expect(e3.bound).toBe(true)
    expect(e3.installed).toBe(true)
    expect(e3.identity?.kind).toBe('member')
    expect(restoredScopesFor(surface2, child).length).toBe(1)
    expect(restoredScopesFor(surface2, child)[0]).toEqual({
      kind: 'member',
      rootSessionId: root,
      instanceId: world.ids.instanceId,
      slots: OVERLAY_SLOT_ORDER,
    })
    expect(surface2.countCalls('installOverlay', child)).toBe(0)
    expect(slot2.applied.length).toBe(0)

    // --- an already-bound cold rehydrate on the SAME binder is a no-op:
    // no second restoreScope, no duplicate events.
    const e4 = binder2.rehydrateColdRoot(root)
    expect(e4.installed).toBe(false)
    expect(e4.noopReason).toBe('already-bound')
    expect(surface2.countCalls('restoreScope', root)).toBe(1)

    // The binder never WRITES the durable world (fresh or cold).
    expect(world.seam.writeLog).toEqual(writesAfterFresh)
  })
})

// ---------------------------------------------------------------------------
// Teardown (module level, the p5t1 convention).
// ---------------------------------------------------------------------------

destroyDir(world.scratchDir)
