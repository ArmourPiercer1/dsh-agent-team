/**
 * Fixtures for the P8-T1 projection suites.
 *
 * All fixtures are PLAIN, unbranded, untrusted values: they are fed through
 * the parse pipeline exactly like a decoded wire value. Where a test needs
 * the `create*` factory paths, it builds branded inputs from a parsed DTO
 * (see the suites). No fixture carries a denylist token or a legacy field.
 */

export const P8T1_CREATED_AT = '2026-08-29T12:00:00.000Z'
export const P8T1_GENERATED_AT = '2026-08-29T12:05:00.000Z'

/** A structurally valid effective configuration (all four lanes). */
export function rawEffectiveConfig(): Record<string, unknown> {
  return {
    model: { value: 'claude-sonnet-4-5', source: 'blueprint', state: 'inherited' },
    workspace: { value: '/ws/team-1', source: 'instance-creation', state: 'locked' },
    permissions: {
      Bash: { value: 'allowed', source: 'policy-state', state: 'inherited' },
      Web: { value: null, source: 'external-hard-policy', state: 'denied' },
    },
    autonomy: { value: 'web-search', source: 'autonomy-overlay', state: 'suppressed' },
  }
}

/** A structurally valid compatibility summary (no probe timestamp). */
export function rawCompatibility(): Record<string, unknown> {
  return {
    status: 'OPEN',
    probeGeneration: 3,
    requirementFingerprint: 'req-abc123',
    environmentFingerprint: 'env-xyz789',
    warningCount: 0,
    fatalCount: 0,
    acknowledgedWarningCount: 0,
  }
}

/** A structurally valid ledger summary (sum of byCategory = totalEntries). */
export function rawLedger(): Record<string, unknown> {
  return {
    latestSequence: 7,
    totalEntries: 7,
    byCategory: {
      team: 2,
      member: 1,
      lifecycle: 1,
      message: 2,
      control: 0,
      policy: 0,
      compatibility: 1,
      progress: 0,
    },
    pendingControlCount: 0,
  }
}

/** The single leader template row. */
export function rawLeaderTemplate(): Record<string, unknown> {
  return {
    kind: 'leader',
    templateId: 'leader-core',
    displayName: 'Leader',
    contextPolicy: 'persistent',
  }
}

/** A member template row (with cap and description). */
export function rawMemberTemplate(): Record<string, unknown> {
  return {
    kind: 'member',
    templateId: 'researcher',
    displayName: 'Researcher',
    description: 'Research worker',
    contextPolicy: 'fresh_per_delegation',
    instanceQuota: 4,
  }
}

/** The LeaderInstance row (no childSessionId; live overlay by default). */
export function rawLeaderMember(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    instanceId: 'inst-leader',
    templateId: 'leader-core',
    label: 'Leader',
    workspace: '/ws/team-1',
    createdAt: P8T1_CREATED_AT,
    lifecycle: 'RUNNING',
    contextPolicy: 'persistent',
    effectiveConfig: rawEffectiveConfig(),
    liveActivity: { residency: 'resident', currentAction: 'coordinating', runningSince: P8T1_CREATED_AT },
    ...overrides,
  }
}

/** A member row (with childSessionId, durable activity, and a live overlay). */
export function rawMember(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    instanceId: 'inst-a1',
    templateId: 'researcher',
    label: 'Researcher A',
    groupId: 'g-research',
    childSessionId: 'session-2',
    workspace: '/ws/member-a',
    createdAt: P8T1_CREATED_AT,
    lifecycle: 'RUNNING',
    contextPolicy: 'fresh_per_delegation',
    effectiveConfig: rawEffectiveConfig(),
    activity: {
      status: 'in-progress',
      subject: 'harmonic analysis',
      lastProgressAt: P8T1_CREATED_AT,
      openIntervals: [{ correlation: 'work-1', openedAt: P8T1_CREATED_AT }],
    },
    liveActivity: { residency: 'resuming' },
    ...overrides,
  }
}

/** The team root view (no lifecycle field — Architecture §8.6). */
export function rawRoot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    teamSessionId: 'session-1',
    defaultWorkspace: '/ws/team-1',
    createdAt: P8T1_CREATED_AT,
    policyState: 'research',
    admission: 'OPEN',
    compatibility: rawCompatibility(),
    creationBudgetConsumed: 1,
    ...overrides,
  }
}

/** A structurally valid whole projection (generation 1 by default). */
export function rawProjection(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    teamSessionId: 'session-1',
    blueprint: {
      blueprintId: 'AIUED-ALGO',
      revision: '17',
      contentHash: 'sha256:abc123',
    },
    generation: 1,
    generatedAt: P8T1_GENERATED_AT,
    root: rawRoot(),
    templates: [rawLeaderTemplate(), rawMemberTemplate()],
    members: [rawLeaderMember(), rawMember()],
    ledger: rawLedger(),
    ...overrides,
  }
}
