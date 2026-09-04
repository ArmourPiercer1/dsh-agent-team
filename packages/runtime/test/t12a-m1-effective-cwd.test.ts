/**
 * t12a-m1-effective-cwd.test.ts — T12-M1: the ACTUAL Agent cwd is the
 * effective workspace.
 *
 * The old glue passed `meta: { cwd: process.env.DSH_HOME }` on every
 * agents.create — the root, every seeded member, and every factory child.
 * DSH_HOME is the session STORE, not a working directory: every agent
 * started in the home tree instead of its team's effective workspace.
 *
 * Contract (asserted at the ACTUAL agents.create boundary — the bridge
 * agents double records the meta of every create; NOT via projection
 * fields):
 *   M1-1 the root agent's cwd == the team's effective default workspace
 *        (config.defaultWorkspace);
 *   M1-2 a seeded member's cwd == the team's effective default workspace
 *        (the boot seed carries no per-member workspace);
 *   M1-3 a factory child created with a contract-explicit
 *        request.workspace gets EXACTLY that workspace as cwd;
 *   M1-4 a factory child without a request workspace falls back to the
 *        team's effective default workspace;
 *   M1-5 every create cwd is one of the two effective workspaces (never
 *        DSH_HOME).
 */
import { describe, expect, it } from 'vitest'
import { createLiveWorld, WORKTREE_ROOT } from './t12a-live-bridge.mjs'

const ROOT = 'session-t12a-m1-root'
const SEED_CHILD = 'session-team-child-m1seed'
// The values are recorded, never resolved on disk — a forward-slash join
// is a plain string (no node: import in a .ts test).
const TEAM_WS = `${WORKTREE_ROOT}/m1-team-ws`
const MEMBER_WS = `${WORKTREE_ROOT}/m1-member-ws`

const world = await createLiveWorld({
  rootSessionId: ROOT,
  members: [{ childSessionId: SEED_CHILD, instanceId: 'inst-t12am1seed', templateId: 'tpl-t12a' }],
  configOverrides: {
    defaultWorkspace: TEAM_WS,
    seedMembers: [
      { instanceId: 'inst-t12am1seed', templateId: 'tpl-t12a', label: 'seed M1', childSessionId: SEED_CHILD },
    ],
  },
})
await world.binding.boot()

// M1-3 / M1-4: the factory boundary, with and without a contract-explicit
// workspace.
const childAId = world.binding.childSessionIdFor(ROOT, 'inst-t12am1a')
const childBId = world.binding.childSessionIdFor(ROOT, 'inst-t12am1b')
await world.binding.childFactory.createChildSession({
  rootSessionId: ROOT,
  instanceId: 'inst-t12am1a',
  templateId: 'tpl-t12a',
  label: 'member A',
  workspace: MEMBER_WS,
})
await world.binding.childFactory.createChildSession({
  rootSessionId: ROOT,
  instanceId: 'inst-t12am1b',
  templateId: 'tpl-t12a',
  label: 'member B',
})

const createFor = (sessionId: string) => world.records.creates.find((c) => c.sessionId === sessionId)!
const rootCreate = createFor(ROOT)
const seedCreate = createFor(SEED_CHILD)
const childACreate = createFor(childAId)
const childBCreate = createFor(childBId)

describe('T12-M1 effective workspace as the actual Agent cwd', () => {
  it('M1-1 the root agent cwd is the team effective default workspace', () => {
    expect(rootCreate.meta?.cwd).toBe(TEAM_WS)
  })

  it('M1-2 the seeded member cwd is the team effective default workspace', () => {
    expect(seedCreate.meta?.cwd).toBe(TEAM_WS)
  })

  it('M1-3 a factory child with an explicit request workspace gets exactly that cwd', () => {
    expect(childACreate.meta?.cwd).toBe(MEMBER_WS)
  })

  it('M1-4 a factory child without a request workspace falls back to the team default', () => {
    expect(childBCreate.meta?.cwd).toBe(TEAM_WS)
  })

  it('M1-5 every create cwd is one of the effective workspaces (never DSH_HOME)', () => {
    for (const c of world.records.creates) {
      const cwd = c.meta?.cwd
      expect(cwd === TEAM_WS || cwd === MEMBER_WS).toBe(true)
    }
  })
})
