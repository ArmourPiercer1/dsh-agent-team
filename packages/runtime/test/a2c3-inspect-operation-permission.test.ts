/**
 * a2c3-inspect-operation-permission.test.ts — A2C-3 (alpha.2
 * capability-completion round, plan §10) MUST-TEST: `team_inspect_config`
 * exposes the REAL alpha.2 operation permission as an independent field.
 *
 * Pre-fix fact under attack (§10.1): the `config-inspected` payload carried
 * ONLY `effective` — the legacy GENERIC capability policy view (model /
 * tools / permissions / skills / mcp cells resolved by the generic
 * two-stage policy resolver from stored governance overrides + external
 * facts). The alpha.2 REAL enforcement runs the INDEPENDENT
 * `boundTemplate.capabilities.permissions → TemplatePermissionPolicy →
 * pre-execute adapter` path, so the generic `effective.permissions` cell
 * is NOT the actual operation-permission authority — it misleads the
 * user/model.
 *
 * Frozen fix (plan §10.2): the payload gains the independent field
 * `operationPermissions`:
 *
 * - bound template declares `capabilities.permissions` →
 *   `{ mode: 'static', default, allow, ask, deny, managedTools,
 *   resourceKinds }` — the rules AS STORED in the policy (deterministic
 *   declaration order — the A1 normalization pin), `managedTools` =
 *   `PERMISSION_TOOL_NAMES` and `resourceKinds` =
 *   `PERMISSION_RESOURCE_KINDS` (the FINAL closed vocabularies, imported
 *   from the domain blueprint constants — no hardcoded string literals
 *   that can drift);
 * - permissions absent → `{ mode: 'absent' }`.
 *
 * Data source (§10.3): the TeamSession bound Blueprint snapshot → the
 * target's template entry (leader vs member) → `capabilities.permissions`.
 * alpha.2 has no dynamic permission mutation → static policy == current
 * operation policy; NO alpha.3 `grants` / `overlays` fields are invented.
 *
 * Acceptance matrix (this file, §10.5):
 *   R1  RED probe — the config-inspected payload carries the independent
 *       `operationPermissions` field (ABSENT on the pre-fix tree);
 *   R2  RED probe — the semantic split is real: the fixture diverges the
 *       generic `effective.permissions` cell (a team-scoped HUMAN
 *       override grants a legacy permission name) from the bound static
 *       policy; post-fix `operationPermissions` mirrors the BOUND policy,
 *       never the generic cell (ABSENT on the pre-fix tree);
 *   T1  member static policy exact/any/subtree round-trip (the rules as
 *       stored in the blueprint round-trip losslessly, declaration order);
 *   T2  leader static policy (the reserved leader id maps to the bound
 *       LeaderTemplate);
 *   T3  permissions absent → `{ mode: 'absent' }` (exact shape);
 *   T4  `pwsh` present in `managedTools` (the FINAL A2C-1 vocabulary);
 *   T5  `resourceKinds` contains `subtree` (the FINAL A2C-7 vocabulary);
 *   T6  returned rule order deterministic (re-drive byte-equal; order =
 *       declaration order, never re-sorted);
 *   T7  inspect is a PURE READ: zero durable writes (the seam write log
 *       and every repository listing are unchanged by the effect);
 *   T8  remote/tool round-trip stays lossless (the REAL remote
 *       dispatcher over the p8t3 fake ports: the static effect — new
 *       field included — passes through the wire envelope unchanged,
 *       `effectSequence` provenance null as a read effect);
 *   T9  old `effective` consumers unregressed (the five-cell generic view
 *       is byte-identical to the pre-fix producer output — including the
 *       diverged `permissions` cell).
 *
 * RUNNER CONSTRAINTS (this repo's plain-node shim — see the a2/a2c5 suite
 * headers): every async scenario runs at MODULE level (top-level await)
 * and captures its results; the `it` bodies are pure synchronous
 * assertions. Shim matchers used: toBe / toEqual (+.not) only.
 *
 * SELF-CLEANLINESS: this file is inside the P4-T6 whole-tree scanner's
 * scope (`packages/**`); it carries ZERO legacy Team SessionEvent
 * denylist vocabulary (the scanner delta for this task is +1 file only).
 */

import { describe, expect, it } from 'vitest'

import {
  PERMISSION_RESOURCE_KINDS,
  PERMISSION_TOOL_NAMES,
} from '../../domain/blueprint/src/index.js'
import {
  makeDispatcher,
  p8t3Wire,
  expectSuccess,
  P8T3_REQUEST_TOKEN,
  P8T3_TEAM_SESSION_ID,
} from '../../remote/test/p8t3-helpers.js'
import type { RemoteResponse, RemoteSafeJsonValue, RemoteSafeRecord } from '../../remote/src/index.js'
import type { TeamRuntimeActionOutcome } from '../admission/index.js'
import {
  destroyP6T1World,
} from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  createP6T2Runtime,
  createP6T2World,
  makeActionRequest,
} from './p6t2-helpers.js'

// --- the A2C-3 fixture blueprint (bound snapshot) ------------------------------

/**
 * The A2C-3 fixture blueprint: the P6-T2 id/envelope/quota surface with
 * `capabilities` blocks added — the `worker` template carries a static
 * policy covering all three FINAL resource kinds (exact / any / subtree),
 * the `leader` template carries a static policy (the shell-class
 * ask/deny-via-`any` contract), and the `scout` template declares NO
 * capabilities at all (the `mode: 'absent'` leg).
 */
export const A2C3_BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: A2C3-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the A2C3 team.',
  '  capabilities:',
  '    teamTools:',
  '      kind: allow',
  '      items: []',
  '    builtinToolDeny: []',
  '    skills:',
  '      kind: allow',
  '      items: []',
  '    mcp:',
  '      kind: allow',
  '      items: []',
  '    permissions:',
  '      default: deny',
  '      allow: []',
  '      ask:',
  '        - tool: pwsh',
  '          resource:',
  '            kind: any',
  '      deny:',
  '        - tool: bash',
  '          resource:',
  '            kind: any',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the A2C3 work.',
  '    capabilities:',
  '      teamTools:',
  '        kind: allow',
  '        items: []',
  '      builtinToolDeny: []',
  '      skills:',
  '        kind: allow',
  '        items: []',
  '      mcp:',
  '        kind: allow',
  '        items: []',
  '      permissions:',
  '        default: ask',
  '        allow:',
  '          - tool: read',
  '            resource:',
  '              kind: exact',
  '              path: "notes/a.md"',
  '          - tool: write',
  '            resource:',
  '              kind: exact',
  '              path: "notes/b.md"',
  '        ask:',
  '          - tool: edit',
  '            resource:',
  '              kind: subtree',
  '              path: "src"',
  '          - tool: read_image',
  '            resource:',
  '              kind: any',
  '        deny:',
  '          - tool: lsp',
  '            resource:',
  '              kind: exact',
  '              path: "notes/secret.md"',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the A2C3 team.',
  '    contextPolicy: fresh_per_delegation',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  '  - domain: skill',
  '    name: base',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - request-control',
  '    - resolve-control',
  '    - archive-member',
  '    - restore-member',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  '  - templateId: scout',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '        - request-control',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The A2C3 default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  '  members:',
  '    maxInstances: 2',
  '    maxConcurrent: 2',
  'metadata: {}',
  '---',
  '',
].join('\n')

// --- the fixture identities ------------------------------------------------------

/** The seeded worker instance (P6T2 seed constant; template `worker`). */
const A2C3_WORKER_ID = 'inst-p6t2seedw01'
/** The seeded scout instance (P6T2 seed constant; template `scout`). */
const A2C3_SCOUT_ID = 'inst-p6t2seeds01'
/** The reserved leader instance id. */
const A2C3_LEADER_ID = 'inst-leader'

/** The generic-cell permission name the team-scoped HUMAN override grants
 *  (a legacy generic-vocabulary item — deliberately NOT one of the
 *  parameter-aware tools: it can only live in the GENERIC cell). */
const A2C3_GENERIC_PERMISSION_ITEM = 'legacy-generic-permission-item'

/** The expected static view of the `worker` template's bound policy (T1):
 *  the rules AS STORED in the blueprint (declaration order — the A1
 *  normalization pin), plus the FINAL closed vocabularies. */
const A2C3_WORKER_STATIC_VIEW: RemoteSafeJsonValue = {
  mode: 'static',
  default: 'ask',
  allow: [
    { tool: 'read', resource: { kind: 'exact', path: 'notes/a.md' } },
    { tool: 'write', resource: { kind: 'exact', path: 'notes/b.md' } },
  ],
  ask: [
    { tool: 'edit', resource: { kind: 'subtree', path: 'src' } },
    { tool: 'read_image', resource: { kind: 'any' } },
  ],
  deny: [
    { tool: 'lsp', resource: { kind: 'exact', path: 'notes/secret.md' } },
  ],
  managedTools: [...PERMISSION_TOOL_NAMES],
  resourceKinds: [...PERMISSION_RESOURCE_KINDS],
}

/** The expected static view of the `leader` template's bound policy (T2):
 *  the shell-class contract (tool-level `any` in ask/deny only). */
const A2C3_LEADER_STATIC_VIEW: RemoteSafeJsonValue = {
  mode: 'static',
  default: 'deny',
  allow: [],
  ask: [
    { tool: 'pwsh', resource: { kind: 'any' } },
  ],
  deny: [
    { tool: 'bash', resource: { kind: 'any' } },
  ],
  managedTools: [...PERMISSION_TOOL_NAMES],
  resourceKinds: [...PERMISSION_RESOURCE_KINDS],
}

/** The expected generic `effective` view for EVERY target of this world
 *  (T9): the five legacy generic cells — the human override wins the
 *  `permissions` cell, the other cells fail closed. Byte-identical to
 *  the pre-fix producer output (the old field is untouched). */
const A2C3_EXPECTED_EFFECTIVE: RemoteSafeJsonValue = {
  model: { kind: 'deny' },
  tools: { kind: 'deny' },
  permissions: { kind: 'allow', items: [A2C3_GENERIC_PERMISSION_ITEM] },
  skills: { kind: 'deny' },
  mcp: { kind: 'deny' },
}

// --- module level (top-level await): the world + the drives ---------------------

// Top-level await block (the p6t2 pattern): the world is built, driven,
// snapshotted and DESTROYED here; the `it` bodies assert on the captured
// plain data only (no live world handle crosses into the assertions).
const A2C3 = await (async () => {
  // One world: leader + worker + scout seeded (caller resolution requires
  // the acting member record; all three targets are addressable).
  const world: P6T1World = await createP6T2World(
    'a2c3-inspect-opperm',
    ['leader', 'worker', 'scout'],
    { blueprintSource: A2C3_BLUEPRINT_SOURCE },
  )
  try {
    // Plant the team-scoped HUMAN override that grants a legacy permission
    // name to the GENERIC `permissions` cell (invariant 34: human
    // overrides are not envelope-checked — the only way a generic cell
    // can carry an item in this world). This is what makes the R2
    // divergence fixture non-trivial: the generic cell is NON-EMPTY and
    // DIFFERENT from the bound static policy of every target.
    await world.domain.repositories.overrides.put({
      schemaVersion: 2,
      kind: 'human-override',
      recordId: 'ovr-a2c3-generic-cell',
      scope: 'team',
      rootSessionId: P6T2_ROOT,
      values: { permissions: { kind: 'allow', items: [A2C3_GENERIC_PERMISSION_ITEM] } },
      generation: 1,
      updatedAt: P6T2_NOW,
    })

    const runtime = createP6T2Runtime(world)

    // The durable-state snapshot taken BEFORE any inspect drive (T7: the
    // pure-read proof channel — the seam write log + every repository
    // listing must survive every effect below byte-identical).
    const before = {
      writeCount: world.seam.writeCount,
      writeLog: [...world.seam.writeLog],
      memberInstances: world.domain.repositories.memberInstances.list(P6T2_ROOT),
      overrides: world.domain.repositories.overrides.list(P6T2_ROOT),
      ledger: world.domain.repositories.ledger.list(),
      operations: world.domain.repositories.operations.list(),
    }

    const inspectWorker = await runtime.performAction(
      makeActionRequest({
        action: 'inspect-config',
        targetInstanceId: A2C3_WORKER_ID,
        requestToken: 'tok-a2c3-worker',
      }),
    )
    const inspectWorkerAgain = await runtime.performAction(
      makeActionRequest({
        action: 'inspect-config',
        targetInstanceId: A2C3_WORKER_ID,
        requestToken: 'tok-a2c3-worker-2',
      }),
    )
    const inspectLeader = await runtime.performAction(
      makeActionRequest({
        action: 'inspect-config',
        targetInstanceId: A2C3_LEADER_ID,
        requestToken: 'tok-a2c3-leader',
      }),
    )
    const inspectScout = await runtime.performAction(
      makeActionRequest({
        action: 'inspect-config',
        targetInstanceId: A2C3_SCOUT_ID,
        requestToken: 'tok-a2c3-scout',
      }),
    )

    const after = {
      writeCount: world.seam.writeCount,
      writeLog: [...world.seam.writeLog],
      memberInstances: world.domain.repositories.memberInstances.list(P6T2_ROOT),
      overrides: world.domain.repositories.overrides.list(P6T2_ROOT),
      ledger: world.domain.repositories.ledger.list(),
      operations: world.domain.repositories.operations.list(),
    }

    return {
      before,
      after,
      inspectWorker,
      inspectWorkerAgain,
      inspectLeader,
      inspectScout,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

// Exported for the A2C-3 evidence driver (dump-payload.mts): the captured
// plain-data snapshot (before/after + the four inspect outcomes). The
// world is already destroyed by the time any importer reads this.
export const A2C3_CAPTURED = A2C3

/** Type-erased read of one inspect outcome (loads and runs on BOTH the
 *  pre-fix tree — where `operationPermissions` does not exist yet — and
 *  the fixed tree; the R1/R2 probes are the RED discriminators). */
interface A2C3InspectLike {
  readonly kind: string
  readonly effective?: Record<string, unknown>
  readonly operationPermissions?: unknown
}

function inspectLike(outcome: TeamRuntimeActionOutcome): A2C3InspectLike {
  return outcome.effect as unknown as A2C3InspectLike
}

// --- T8: the remote round-trip (module level) -----------------------------------

/** The wire effect: the FULL post-fix static payload for the worker target
 *  (the generic cells + the independent operationPermissions field). */
const A2C3_RT_EFFECT: RemoteSafeRecord = {
  kind: 'config-inspected',
  effective: A2C3_EXPECTED_EFFECTIVE,
  operationPermissions: A2C3_WORKER_STATIC_VIEW,
}

/** T8 drive: the REAL remote dispatcher over the p8t3 fake ports; the
 *  admission port returns the static config-inspected outcome, and the
 *  member.create wire response must carry it back LOSSLESS (the remote
 *  applies no field allowlist — additive fields round-trip unchanged;
 *  the read effect carries NO sequence provenance). */
const A2C3_RT: RemoteResponse = await (async () => {
  const dispatcher = makeDispatcher({
    admission: {
      performAction() {
        return { accepted: true, effect: A2C3_RT_EFFECT }
      },
    },
  })
  return await dispatcher.dispatch(
    'member.create',
    p8t3Wire({
      teamSessionId: P8T3_TEAM_SESSION_ID,
      caller: { kind: 'human', humanId: 'h-1' },
      requestToken: P8T3_REQUEST_TOKEN,
    }),
  )
})()

describe('A2C-3: team_inspect_config exposes the real operation permission (plan §10)', () => {
  it('R1: the config-inspected payload carries the independent operationPermissions field', () => {
    for (const outcome of [
      A2C3.inspectWorker,
      A2C3.inspectLeader,
      A2C3.inspectScout,
    ]) {
      const effect = inspectLike(outcome)
      expect(effect.kind).toBe('config-inspected')
      expect('operationPermissions' in effect).toBe(true)
    }
  })

  it('R2: the semantic split is real — the bound policy, not the generic cell, is exposed', () => {
    const worker = inspectLike(A2C3.inspectWorker)
    // The GENERIC cell carries the human-override item (the legacy view is
    // intact — and provably NOT the operation-permission authority).
    expect(worker.effective?.['permissions']).toEqual({
      kind: 'allow',
      items: [A2C3_GENERIC_PERMISSION_ITEM],
    })
    // The BOUND static policy is what the field exposes — mode static,
    // the rules as stored, the FINAL vocabularies.
    expect(worker.operationPermissions).toEqual(A2C3_WORKER_STATIC_VIEW)
  })

  it('T1: member static policy — exact/any/subtree rules round-trip losslessly (declaration order)', () => {
    const worker = inspectLike(A2C3.inspectWorker)
    expect(worker.operationPermissions).toEqual(A2C3_WORKER_STATIC_VIEW)
    // The three FINAL resource kinds are all present, in their stored
    // shapes (exact carries its path; subtree carries its path; any is
    // the whole-tool resource).
    const view = worker.operationPermissions as Record<string, unknown>
    const allow = view['allow'] as { tool: string; resource: Record<string, unknown> }[]
    const ask = view['ask'] as { tool: string; resource: Record<string, unknown> }[]
    expect(allow[0]?.['resource']['kind']).toBe('exact')
    expect(ask[0]?.['resource']['kind']).toBe('subtree')
    expect(ask[1]?.['resource']['kind']).toBe('any')
    expect(ask[1]?.['resource']).toEqual({ kind: 'any' })
  })

  it('T2: leader static policy — the reserved leader id maps to the bound LeaderTemplate', () => {
    const leader = inspectLike(A2C3.inspectLeader)
    expect(leader.operationPermissions).toEqual(A2C3_LEADER_STATIC_VIEW)
  })

  it('T3: permissions absent — the scout template (no capabilities) yields exactly mode absent', () => {
    const scout = inspectLike(A2C3.inspectScout)
    expect(scout.operationPermissions).toEqual({ mode: 'absent' })
  })

  it('T4: managedTools is the FINAL closed tool vocabulary (includes pwsh)', () => {
    for (const outcome of [A2C3.inspectWorker, A2C3.inspectLeader]) {
      const view = inspectLike(outcome).operationPermissions as Record<string, unknown>
      const managedTools = view['managedTools'] as string[]
      expect(managedTools).toEqual([...PERMISSION_TOOL_NAMES])
      expect(managedTools.includes('pwsh')).toBe(true)
      expect(managedTools.includes('bash')).toBe(true)
    }
  })

  it('T5: resourceKinds is the FINAL closed resource vocabulary (includes subtree)', () => {
    for (const outcome of [A2C3.inspectWorker, A2C3.inspectLeader]) {
      const view = inspectLike(outcome).operationPermissions as Record<string, unknown>
      const resourceKinds = view['resourceKinds'] as string[]
      expect(resourceKinds).toEqual([...PERMISSION_RESOURCE_KINDS])
      expect(resourceKinds.includes('subtree')).toBe(true)
    }
  })

  it('T6: returned rule order is deterministic — the re-drive is byte-equal (declaration order pinned)', () => {
    const first = inspectLike(A2C3.inspectWorker)
    const second = inspectLike(A2C3.inspectWorkerAgain)
    expect(second.operationPermissions).toEqual(first.operationPermissions)
    // Order pinned as the blueprint declaration order (never re-sorted):
    // allow read(exact a) → write(exact b); ask edit(subtree src) →
    // read_image(any); deny lsp(exact secret).
    const view = first.operationPermissions as Record<string, unknown>
    const allow = view['allow'] as { tool: string }[]
    const ask = view['ask'] as { tool: string }[]
    expect(allow.map((rule) => rule.tool)).toEqual(['read', 'write'])
    expect(ask.map((rule) => rule.tool)).toEqual(['edit', 'read_image'])
  })

  it('T7: inspect is a pure read — zero durable writes (seam log + every repository unchanged)', () => {
    expect(A2C3.after.writeCount).toBe(A2C3.before.writeCount)
    expect(A2C3.after.writeLog).toEqual(A2C3.before.writeLog)
    expect(A2C3.after.memberInstances).toEqual(A2C3.before.memberInstances)
    expect(A2C3.after.overrides).toEqual(A2C3.before.overrides)
    expect(A2C3.after.ledger).toEqual(A2C3.before.ledger)
    expect(A2C3.after.operations).toEqual(A2C3.before.operations)
  })

  it('T8: remote round-trip stays lossless — the static payload (new field included) passes the wire unchanged', () => {
    const success = expectSuccess(A2C3_RT)
    // The outcome passes through unchanged (only the provenance is
    // derived) — the additive operationPermissions field survives the
    // wire envelope byte-identical, rules in order.
    expect(success.value.data).toEqual({
      outcome: { accepted: true, effect: A2C3_RT_EFFECT },
    })
    // The config-inspected effect is a READ effect: no sequence rides in
    // the provenance.
    expect(success.value.provenance.effectSequence).toBe(null)
    expect(success.value.provenance.requestToken).toBe(P8T3_REQUEST_TOKEN)
  })

  it('T9: old effective consumers unregressed — the five-cell generic view is byte-identical to the pre-fix producer', () => {
    for (const outcome of [
      A2C3.inspectWorker,
      A2C3.inspectLeader,
      A2C3.inspectScout,
    ]) {
      const effect = inspectLike(outcome)
      expect(Object.keys(effect.effective ?? {}).sort()).toEqual(
        ['mcp', 'model', 'permissions', 'skills', 'tools'],
      )
      expect(effect.effective).toEqual(A2C3_EXPECTED_EFFECTIVE)
    }
  })
})
