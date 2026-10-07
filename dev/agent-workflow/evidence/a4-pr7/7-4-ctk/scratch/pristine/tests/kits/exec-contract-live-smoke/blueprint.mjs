/**
 * exec-contract live smoke — blueprint builders (pure; no side effects).
 *
 * The three scenario blueprints for the PR #19 production live
 * verification (user ruling 2026-09-19, the three L1/L2/L3 cases):
 *
 *   L1  dual gate OPEN:
 *       leader `permissions.allow` = bash/any (static gate 1) AND the
 *       teamEnvelope carries the `bash` exec token (gate 2) → the bash
 *       call executes directly, ZERO control requests.
 *
 *   L2  gate 1 open, gate 2 CLOSED:
 *       the same leader allow lane, but the teamEnvelope does NOT carry
 *       the `bash` token. The review trap is explicit: the envelope must
 *       still admit the `request-control` op or the downgrade fallback is
 *       itself envelope-blocked (and a missing request would be
 *       misread as a dual-gate pass). The bash call is therefore
 *       downgraded to the existing ask path — a durable `user-approval`
 *       request (human-only resolver closure); zero side effect until
 *       the human allows; the exec runs only after the allow.
 *
 *   L3  external hard deny:
 *       both gates open (as L1) but the HOST's external hard policy
 *       denies the `tools` cell. The static-allow last-mile recheck
 *       (A2C-4, the shared read-only ControlService probe over the SAME
 *       hard facts) refuses: no Team decision — human included — may
 *       bypass the external ceiling (invariant 34). No control row is
 *       written by a recheck denial (zero-effect deny).
 *
 * The LEADER's effective exec-envelope formula (the dual-gate input,
 * `leaderExecEnvelopeOps`): `teamEnvelope.allow − teamEnvelope.deny`,
 * further intersected with the leader template's `memberEnvelopes` entry
 * when such an entry exists (it only tightens), ∩ {bash, pwsh}. The
 * scenario blueprints declare memberEnvelopes for the WORKER template
 * only, so the leader formula is exactly the teamEnvelope allow list.
 *
 * The LEADER permissions policy is IDENTICAL in all three scenarios
 * (default ask; allow: bash/any; ask + deny lanes carry inert read rules
 * the oracle never triggers — bash appears ONLY in the allow lane so no
 * lane interaction can shadow the static grant). The worker is an
 * unused strict-shape filler (the pre-execute contract rejects a member
 * shell-allow at blueprint validation; the worker is never activated).
 */

/**
 * The teamEnvelope allow list per scenario.
 *
 * @param {boolean} withExecToken - L1/L3: carry the `bash` exec token;
 *   L2: omit it (gate 2 closed). `request-control` + `resolve-control`
 *   stay admitted in ALL scenarios (the fallback must never be
 *   envelope-blocked; the review's explicit L2 trap).
 * @returns {string[]} the teamEnvelope allow slugs (declaration order).
 */
export function teamEnvelopeAllow(withExecToken) {
  const allow = [
    'assign-task',
    'create-member',
    'send-message',
    'report-progress',
    'request-control',
    'resolve-control',
  ]
  if (withExecToken) allow.push('bash')
  return allow
}

/**
 * One saved-source strict scenario blueprint.
 *
 * @param {string} bpId - the blueprintId (e.g. `team.exec-l1`).
 * @param {string} leaderPersona - the leader persona (carries the
 *   scenario marker the mock oracle routes on).
 * @param {string} workerPersona - the worker persona (unused filler).
 * @param {boolean} withExecToken - gate 2 open (L1/L3) vs closed (L2).
 * @param {string[]} denyList - the live-surface remainder to deny
 *   (computed from the boot-root discovery: the non-managed, non-safe,
 *   non-team tools — the strict Coverage Gate convention).
 * @returns {string} the YAML source (frontmatter-delimited).
 */
export function scenarioBlueprintYaml(bpId, leaderPersona, workerPersona, withExecToken, denyList) {
  const denyLines = (baseIndent) => {
    const pad = '  '.repeat(baseIndent)
    return denyList.length === 0
      ? [`${pad}builtinToolDeny: []`]
      : [`${pad}builtinToolDeny:`, ...denyList.map((n) => `${pad}  - ${n}`)]
  }
  const leaderBlock = [
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(leaderPersona)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items: []',
    ...denyLines(2),
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: bash',
    '          resource:',
    '            kind: any',
    '      ask:',
    '        - tool: read',
    '          resource:',
    '            kind: subtree',
    '            path: team',
    '      deny:',
    '        - tool: read',
    '          resource:',
    '            kind: subtree',
    '            path: runtime',
  ]
  const workerBlock = [
    'members:',
    '  - templateId: worker',
    `    persona: ${JSON.stringify(workerPersona)}`,
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    ...denyLines(3),
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
    '              kind: subtree',
    '              path: team',
    '        ask:',
    '          - tool: bash',
    '            resource:',
    '              kind: any',
    '        deny:',
    '          - tool: read',
    '            resource:',
    '              kind: subtree',
    '              path: runtime',
  ]
  const teamEnvelope = [
    'teamEnvelope:',
    '  allow:',
    ...teamEnvelopeAllow(withExecToken).map((op) => `    - ${op}`),
    '  deny: []',
  ]
  const memberEnvelope = [
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '        - request-control',
    '      deny: []',
  ]
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    ...leaderBlock,
    ...teamEnvelope,
    ...workerBlock,
    ...memberEnvelope,
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

/**
 * The row anchor: a plain legacy leader (the 0.1.0-rc.1 boot shape —
 * the boot root's surface carries the discovery marker).
 *
 * @param {string} bpId - the anchor blueprintId.
 * @param {string} persona - the boot leader persona (carries the
 *   discovery marker).
 * @returns {string} the YAML source.
 */
export function anchorBlueprintYaml(bpId, persona) {
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(persona)}`,
    'members:',
    '  - templateId: worker',
    '    persona: "You are a worker of the exec-contract live smoke boot team."',
    'memberEnvelopes: []',
    'requirements: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}
