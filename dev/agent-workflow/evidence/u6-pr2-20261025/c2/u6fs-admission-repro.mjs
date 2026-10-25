// u6fs admission repro (C2 debug, ZERO host boots): replicate the production
// admission decision for the u6fs STRICT template's exact-allow read policy,
// in-process, against the CURRENT dist. Question answered: does an
// exact-allowed read admit WITHOUT approval, or is `requires-approval` (a
// durable Control leg) the by-design lane? Scratch — lives outside the
// worktree per the lint-identities rule.
const REPO = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/u6-pr2'
const DIST = `${REPO}/packages/runtime/dist/packages/runtime`
const { createProductionAdmissionAssembly } = await import(`${DIST}/tool-admission/index.js`)

const REALM = 'u6fs-repro-realm'
const HOME = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/u6-pr2/tests/homes'
const ROOT_REAL = `${HOME}/repro-root`
const S1 = `${ROOT_REAL}/notes/u6fs-s1.txt`
const DENIED = `${ROOT_REAL}/secret/u6fs-denied.txt`

const permissionPolicy = {
  default: 'deny',
  allow: [
    { tool: 'read', resource: { kind: 'exact', path: S1 } },
  ],
  ask: [],
  // VARIANT (measured forensics): NO explicit read-deny rule. A deny rule on
  // `read` also projects a tool-invoke-class deny (admission-kernel
  // :890), and Ruling 1 then routes EVERY read's tool-invoke arm into Ask —
  // the whole class stalls on approvals. With default deny only, covered
  // reads admit; an uncovered read lands policyDenied -> Ask (the refusal
  // leg), which a durable Control row + human deny settles.
  deny: [],
}

const built = await createProductionAdmissionAssembly({
  permissionPolicy,
  realmId: REALM,
  templateId: 'strict',
  role: 'member',
  definitionOwnerAuthority: 'human-user',
  clock: () => Date.now(),
  authorityGeneration: () => 1,
  beneficiaryAuthority: 'member',
  subtreeContains: ({ parent, child }) => child === parent || child.startsWith(`${parent}/`),
  onObserve: (row) => console.log('[observe]', JSON.stringify(row)),
})
if (built.ok !== true) {
  console.log('ASSEMBLY REFUSED:', JSON.stringify(built.error, null, 1))
  process.exit(2)
}
const assembly = built.value

// THE executor's exact effect arms (read-executor.mjs:215-219) parsed through
// the SAME closed-set parser the row uses.
const { parseRequestedEffectSet } = await import(`${REPO}/packages/runtime/dist/packages/domain/tool-governance/src/index.js`)
const effectSet = (path) => {
  const arms = [
    { kind: 'tool-invoke', toolName: 'read', resource: null },
    { kind: 'read', resource: { realmId: REALM, kind: 'absolute-path', canonicalLocator: path, rights: ['read'] } },
  ]
  const parsed = parseRequestedEffectSet(arms)
  if (!parsed.ok) throw new Error(`effect-set rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

for (const [label, path] of [['s1-allow', S1], ['denied-file', DENIED]]) {
  const request = {
    binding: { bindingId: `plane-row:read`, definitionIdentity: 'def#1', revision: 1, status: 'ACTIVE', authorityGeneration: 1, policyGeneration: 1 },
    member: { teamSessionId: 'repro-team', instanceId: 'repro-inst' },
    callId: `call-${label}`,
    realmId: REALM,
    parametersFingerprint: effectSet(path).fingerprint, // the FROZEN grammar: the real effect-set fingerprint
    requestedEffects: effectSet(path),
  }
  try {
    const admitted = await assembly.admitCall(request)
    if (admitted.ok !== true) {
      console.log(`${label}: admitCall REFUSED`, JSON.stringify(admitted.error))
    } else {
      console.log(`${label}: decision=${admitted.value.kind}`, admitted.value.kind === 'denied' ? JSON.stringify(admitted.value.error) : (admitted.value.reason ?? ''))
    }
  } catch (error) {
    console.log(`${label}: THREW`, String(error?.message ?? error).slice(0, 300))
  }
}

// ── matcher forensics: what did the projection actually build? ─────────────
console.log('assembly keys:', Object.keys(assembly).join(','))
const doc = typeof assembly.policyDocument === 'function' ? assembly.policyDocument() : undefined
console.log('policyDocument:', JSON.stringify(doc, null, 1).slice(0, 1200))

// ── forensics round 2: the PARSED set's effect shape + scope matcher ──────
const adm = await import(`${DIST}/tool-admission/index.js`)
console.log('tool-admission exports:', Object.keys(adm).filter((k) => /scope|expansion|approval/i.test(k)).join(','))
const parsed = effectSet(S1)
console.log('parsed effects:', JSON.stringify(parsed.effects, null, 1))
if (typeof adm.effectApprovalScope === 'function') {
  console.log('scope(read):', JSON.stringify(adm.effectApprovalScope(parsed.effects[1], REALM)))
}

// ── forensics round 3: expansion of the exact set against the exact doc ───
console.log('scope(read-arm):', JSON.stringify(adm.effectApprovalScope(parsed.effects[0], REALM)))
const exp = adm.evaluateEffectSetExpansion(parsed, REALM, doc)
console.log('expansion:', JSON.stringify(exp))
const readEntries = (doc.entries ?? doc).filter?.((e) => e.effectKind === 'read') ?? []
console.log('read entries matchers:', JSON.stringify(readEntries.map((e) => [e.matcher.resource, e.maximumEffect]), null, 1))
