/**
 * bound-blueprint-persona-helpers.ts — shared fixtures for the A2
 * (RC2 repair, plan §5/§6) suite: the binder persona must resolve from the
 * TeamSession's BOUND blueprint snapshot, never from the row-level
 * `config.blueprintSource` anchor.
 *
 * The diverged documents (closed v1, byte-stable):
 *
 *   A (the row anchor) — the document the row's `config.blueprintSource`
 *     carries. Its member list holds `worker-a` ONLY — it lacks every
 *     template the bound teams carry (`worker-b`, `worker`). A/B leader
 *     persona texts DIFFER (A2-T2's discriminant).
 *   B (Team 1's bound snapshot) — leader + members `worker-b` and
 *     `worker` (Team 1's `worker` persona text is B's).
 *   C (Team 2's bound snapshot) — leader + member `worker` (Team 2's
 *     `worker` persona text is C's — the SAME templateId as B's with a
 *     DIFFERENT persona: the A2-T3 root-scoped discriminant).
 *   D (a dangling identity) — a well-formed document whose
 *     (blueprintId, revision) identity is carried by a TeamSession row's
 *     bound ref but by NO registry row, NO saved source, and NOT the
 *     anchor: the A2-T4 unresolvable-snapshot case.
 *
 * The machine-readable Team context blocks below must stay byte-identical
 * to `agent-bindings.mjs` `rootTeamContextBlock` / `memberTeamContextBlock`
 * (the glue appends them to the scoped persona section — TCM-D4 / D3).
 *
 * Test-only module (no `.test.ts` suffix): never imported by production
 * code.
 * @module @dsh-agent-team/runtime/test/bound-blueprint-persona-helpers
 */

import { parseBlueprint } from '../../domain/blueprint/src/index.js'
import {
  createBlueprintSnapshotRef,
  LEADER_INSTANCE_ID,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
} from '../../contracts/src/index.js'
import type { BlueprintSnapshotRef } from '../../contracts/src/index.js'

// ── the persona texts (the assertion targets) ──────────────────────────────

export const LEADER_PERSONA_A = 'You lead the A2 anchor team.'
export const LEADER_PERSONA_B = 'You lead the A2 bound-B team.'
export const LEADER_PERSONA_C = 'You lead the A2 bound-C team.'
export const MEMBER_PERSONA_A_WORKER_A = 'You are worker-a of the A2 anchor team.'
export const MEMBER_PERSONA_B_WORKER_B = 'You are worker-b of the A2 bound-B team.'
export const MEMBER_PERSONA_B_WORKER = 'You are worker of the A2 bound-B team.'
export const MEMBER_PERSONA_C_WORKER = 'You are worker of the A2 bound-C team.'

// ── the diverged blueprint documents (closed v1) ───────────────────────────

export const DOC_A = `---
schemaVersion: 1
blueprintId: a2bpp.a
revision: "1"
leader:
  templateId: leader
  persona: "${LEADER_PERSONA_A}"
members:
  - templateId: worker-a
    displayName: Worker A
    persona: "${MEMBER_PERSONA_A_WORKER_A}"
requirements: []
memberEnvelopes: []
policyStates: []
metadata: {}
---
`

export const DOC_B = `---
schemaVersion: 1
blueprintId: a2bpp.b
revision: "1"
leader:
  templateId: leader
  persona: "${LEADER_PERSONA_B}"
members:
  - templateId: worker-b
    displayName: Worker B
    persona: "${MEMBER_PERSONA_B_WORKER_B}"
  - templateId: worker
    displayName: Worker
    persona: "${MEMBER_PERSONA_B_WORKER}"
requirements: []
memberEnvelopes: []
policyStates: []
metadata: {}
---
`

export const DOC_C = `---
schemaVersion: 1
blueprintId: a2bpp.c
revision: "1"
leader:
  templateId: leader
  persona: "${LEADER_PERSONA_C}"
members:
  - templateId: worker
    displayName: Worker
    persona: "${MEMBER_PERSONA_C_WORKER}"
requirements: []
memberEnvelopes: []
policyStates: []
metadata: {}
---
`

export const DOC_D = `---
schemaVersion: 1
blueprintId: a2bpp.d
revision: "1"
leader:
  templateId: leader
  persona: "You lead the A2 dangling team."
members:
  - templateId: worker-d
    displayName: Worker D
    persona: "You are worker-d of the A2 dangling team."
requirements: []
memberEnvelopes: []
policyStates: []
metadata: {}
---
`

// ── the fixture identities (plain strings; parse* where the grammar needs) ─

/** The boot root (Team 1) — the row's `rootSessionId`; bound snapshot B. */
export const ROOT_B = 'session-a2bpp-rootb'
/** Team 2's root (one row, a second bound team); bound snapshot C. */
export const ROOT_C = 'session-a2bpp-rootc'
/** Team 3's root; bound ref D (dangling — unresolvable). */
export const ROOT_D = 'session-a2bpp-rootd'
/** The factory world's root (direct root construction, no resolver). */
export const ROOT_F = 'session-a2bpp-rootf'
/** A root with NO durable TeamSession row (the missing-row fail-closed). */
export const ORPHAN = 'session-a2bpp-orphan'

/** Team 1's `worker-b` member (exists ONLY in bound snapshot B). */
export const INST_B1 = 'inst-a2bppb1'
export const CHILD_B1 = 'session-child-a2bppb1'
/** Team 1's `worker` member (the shared templateId, B's persona). */
export const INST_B2 = 'inst-a2bppb2'
export const CHILD_B2 = 'session-child-a2bppb2'
/** Team 2's `worker` member (the shared templateId, C's persona). */
export const INST_C1 = 'inst-a2bppc1'
export const CHILD_C1 = 'session-child-a2bppc1'
/** Team 3's `worker-a` member (present in anchor A — a silent row-anchor
 *  fallback would SUCCEED, making the fail-closed assertion discriminate). */
export const INST_D1 = 'inst-a2bppd1'
export const CHILD_D1 = 'session-child-a2bppd1'
/** The factory world's `worker-a` member (anchor-resolved, unchanged). */
export const INST_F1 = 'inst-a2bppf1'
export const CHILD_F1 = 'session-child-a2bppf1'

/** The fixed epoch (deterministic durable records). */
export const A2_NOW = '2026-08-31T00:00:00.000Z'

// ── the bound snapshot refs (strong-parsed identities + content hashes) ────

/** The bound ref of one document (its strong parse supplies the hash). */
function refOf(doc: string): BlueprintSnapshotRef {
  const parsed = parseBlueprint(doc)
  return createBlueprintSnapshotRef({
    blueprintId: parseBlueprintId(String(parsed.blueprintId)),
    revision: parseBlueprintRevision(String(parsed.revision)),
    contentHash: parseBlueprintContentHash(String(parsed.contentHash)),
  })
}

/** Team 1's bound snapshot ref (document B). */
export const REF_B = refOf(DOC_B)
/** Team 2's bound snapshot ref (document C). */
export const REF_C = refOf(DOC_C)
/** Team 3's bound snapshot ref (document D — dangling at resolution time). */
export const REF_D = refOf(DOC_D)

// ── the machine-readable Team context blocks (agent-bindings.mjs mirror) ───

/**
 * The root Team context block the glue appends to the ROOT agent's scoped
 * persona section (TCM-D4) — byte-identical to `rootTeamContextBlock`.
 */
export function rootContextBlock(rootSessionId: string): string {
  return (
    `[team-root-context rootSessionId=${rootSessionId} ` +
    `leaderInstanceId=${LEADER_INSTANCE_ID}]\n` +
    `Every team_* tool call must include rootSessionId="${rootSessionId}" ` +
    `and a unique requestToken.`
  )
}

/**
 * The member Team identity context block the glue appends to the MEMBER
 * agent's scoped persona section (D3) — byte-identical to
 * `memberTeamContextBlock`.
 */
export function memberContextBlock(rootSessionId: string, instanceId: string): string {
  return (
    `[team-member-context rootSessionId="${rootSessionId}" ` +
    `instanceId="${instanceId}" role="member"]\n` +
    `Every team_* tool call must include rootSessionId="${rootSessionId}" ` +
    `and a fresh unique requestToken; do not use another team's ` +
    `rootSessionId or another member's instanceId.`
  )
}
