const mod = await import('./packages/runtime/dist/packages/runtime/effective-policy/permission-assembler.js')
const { createPermissionOverlaySnapshot } = await import('./packages/runtime/dist/packages/storage/schema/permission-overlay.js').catch(() => ({ createPermissionOverlaySnapshot: null }))
const KEY = 'fskey:/workspace/a.txt'
const snap = createPermissionOverlaySnapshot({
  identity: { teamSessionId: 'session-root-1', memberInstanceId: 'inst-alpha' },
  state: { rules: [{ operation: 'team:member:write', resource: KEY, effect: 'deny' }] },
  metadata: { generation: 1, previousSnapshotId: null },
  provenance: { actor: 'leader', mutationId: 'mut-1', timestamp: '2026-10-01T00:00:00.000Z', reason: 'review fixture' },
})
const input = {
  teamSessionId: 'session-root-1',
  memberInstanceId: 'inst-alpha',
  template: { label: 'tpl', default: 'ask', rules: { allow: [{ tool: 'write', resource: { kind: 'exact', key: KEY } }], ask: [], deny: [] } },
}
const op = { tool: 'write', resource: { kind: 'file', key: KEY, display: `display:${KEY}` }, fingerprint: 'fp-smoke-1' }
for (const [name, rules] of [['views=[]', []], ['full view', [{ ruleIndex: 0, lane: 'deny', rule: { tool: 'write', resource: { kind: 'exact', key: KEY } } }]]]) {
  try {
    const { decision } = mod.assembleEffectivePermission({ ...input, overlays: [{ snapshot: snap, rules }] }, op)
    console.log(`SHIPPED-DIST ${name}: RETURNED decision=${decision.decision} win=${decision.winningLayer}`)
  } catch (error) {
    console.log(`SHIPPED-DIST ${name}: THREW ${error.code} / ${error.details.problem} missing=${JSON.stringify(error.details.missingRuleIndexes)}`)
  }
}
console.log('SHIPPED-DIST frozen vocabulary:', JSON.stringify({ layers: Object.isFrozen(mod.EFFECTIVE_PERMISSION_LAYERS), lookup: Object.isFrozen(mod.EFFECTIVE_PERMISSION_LOOKUP_ORDER), codes: Object.isFrozen(mod.EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES) }))
