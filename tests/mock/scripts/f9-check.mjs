// f9-check.mjs — F9 (repair-r1, Remote contract v4) persistent gate checks.
//
// Zero-model-turn companions for the F9 Playwright rows
// (tests/mock/evidence/F9-PLAYWRIGHT-ASSETS.md): the wire-level
// v3/v4 served-version gating, the durable control-fact scans that
// validate the pending-request detail fields and the allow/deny/
// external-policy outcomes, and the offline selftest preflight.
//
// usage:
//   node f9-check.mjs version-gate                     live host; typed-rejection probes only (zero world mutation)
//   node f9-check.mjs pending [--json '{"kind":"user-approval","target":"inst-w1","action":"write"}']
//                                                durable scan; validates the §26.2 detail fields of ONE pending
//                                                control request and writes state/f9-pending.json for the
//                                                ui-gate.mjs F9 configs ({{requestId}} interpolation)
//   node f9-check.mjs decided --request-id <rid> --expect allow|deny [--reason external-policy]
//                                                durable scan; exactly one decision fact, decider.kind=human,
//                                                optional reason pin
//   node f9-check.mjs consumed --request-id <rid> [--json '{"expectAbsent": true}']
//                                                durable scan; exactly one control-allow-consumed
//                                                (the allow half), or — with expectAbsent — NONE
//                                                (the deny / managed-policy half: zero side effects)
//   node f9-check.mjs policy    --request-id <rid>    durable scan; decision=deny + reason=external-policy
//                                                + decider=human + NO consumption (the §26.4 managed-policy row)
//   node f9-check.mjs selftest                        offline; canned fixtures; the no-host preflight
//
// Options JSON (the --json argument, or {}):
//   root      mock root session id (default: state/boot-state.json rootSessionId)
//   kind      request kind filter (pending): user-approval | leader-approval | envelope-mutation
//   target    targetInstanceId filter (pending)
//   action    actionName substring filter (pending)
//   toolName  exact toolName filter (pending): selects the request that carries the named
//             DSH tool (the frozen external-policy discriminator — a present toolName
//             derives capabilityDomain 'tools'); requests without a toolName never match
//   out       state file for pending (default state/f9-pending.json)
//
// exit 0 = all checks PASS; 1 = any FAIL; 2 = usage / precondition absent.
// No product-code imports; node builtins + common.mjs helpers only.
import {
  MOCK_ROOT, STATE_DIR, DSH_HOME, loadDomain, ledgerFactsForRoot,
  readBootState, readCookie, teamRemote,
} from './common.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// ── closed F9 vocabulary (mirrors the product constants; the source of
//    truth is packages/remote + packages/runtime/control — a drift here is
//    a test bug, caught by the green regression run) ─────────────────────

/** The closed control-request kinds (CONTROL_REQUEST_KINDS). */
const CONTROL_KINDS = ['leader-approval', 'user-approval', 'envelope-mutation']
/** The closed control decision values. */
const CONTROL_DECISIONS = ['allow', 'deny', 'stale-denied']
/** The seven closed CONTROL_* service codes that the remote v4 surface passes through (invariant 4b). */
const CONTROL_CODES = [
  'CONTROL_REQUEST_MALFORMED',
  'CONTROL_TARGET_STALE',
  'CONTROL_REQUEST_NOT_FOUND',
  'CONTROL_REQUEST_DECIDED',
  'CONTROL_RESOLVER_NOT_AUTHORIZED',
  'CONTROL_REQUEST_STALE',
  'CONTROL_EXTERNAL_POLICY_DENIED',
]

// ── pure check helpers (selftest exercises these directly) ──────────────

/**
 * Assert the served-version gating result of one `team.resolveControl`
 * probe. `version <= 3`: the v4-only method is typed-rejected AFTER the
 * envelope parse (details echo the REQUEST contract version). `version === 4`:
 * the version gate is PASSED — the probe reaches the control port and is
 * typed-rejected there (an unknown requestId cannot be a success).
 * @param version - the stamped contract version of the probe.
 * @param r - the teamRemote() result {ok, error, ...}.
 * @returns [] on pass, otherwise the list of problems.
 */
export function checkVersionGateResult(version, r) {
  const problems = []
  if (r === null || r === undefined) {
    return [`no result (transport failure?) for v${version} probe`]
  }
  if (version <= 3) {
    if (r.ok !== false) problems.push(`v${version}: expected a typed rejection, got ok=true`)
    if (r.error?.code !== 'method-version-unsupported') problems.push(`v${version}: code ${JSON.stringify(r.error?.code)} != method-version-unsupported`)
    if (r.error?.details?.contractVersion !== version) problems.push(`v${version}: details.contractVersion ${JSON.stringify(r.error?.details?.contractVersion)} != ${version} (the echo must be the REQUEST version)`)
    if (r.error?.details?.reason !== 'method-not-available-in-version') problems.push(`v${version}: details.reason ${JSON.stringify(r.error?.details?.reason)}`)
    if (r.error?.details?.field !== 'method') problems.push(`v${version}: details.field ${JSON.stringify(r.error?.details?.field)} != method`)
  } else if (version === 4) {
    if (r.ok !== false) problems.push('v4: expected a typed rejection for the unknown requestId, got ok=true')
    if (r.error?.code !== 'CONTROL_REQUEST_NOT_FOUND') problems.push(`v4: code ${JSON.stringify(r.error?.code)} != CONTROL_REQUEST_NOT_FOUND (the v4 gate passed; the request reached the control port)`)
  } else {
    problems.push(`unexpected probe version ${version}`)
  }
  return problems
}

/**
 * Assert the closed-param enforcement: a spoofed identity field (`caller`)
 * is a `malformed-params` unknown-field BEFORE any derivation or port work
 * (U3: the wire carries NO caller/actor fields).
 * @param r - the teamRemote() result of the v4 spoofed-field probe.
 * @returns [] on pass, otherwise the list of problems.
 */
export function checkSpoofedField(r) {
  const problems = []
  if (r?.ok !== false) problems.push(`expected a typed rejection, got ok=${JSON.stringify(r?.ok)}`)
  if (r?.error?.code !== 'malformed-params') problems.push(`code ${JSON.stringify(r?.error?.code)} != malformed-params`)
  if (r?.error?.details?.field !== 'caller') problems.push(`details.field ${JSON.stringify(r?.error?.details?.field)} != caller`)
  if (r?.error?.details?.reason !== 'unknown-field') problems.push(`details.reason ${JSON.stringify(r?.error?.details?.reason)} != unknown-field`)
  return problems
}

/**
 * Validate the pending-request DETAIL FIELDS of one
 * `control-request-recorded` payload (the §26.2 fields the UI renders or
 * carries durably — see F9-PLAYWRIGHT-ASSETS.md §2 mapping table).
 * @param p - the request payload.
 * @returns [] on pass, otherwise the list of problems.
 */
export function checkPendingRequestFields(p) {
  const problems = []
  if (typeof p?.requestId !== 'string' || !/^ctrl-/.test(p.requestId)) problems.push(`requestId ${JSON.stringify(p?.requestId)} is not a durable ctrl-* opaque token`)
  if (!CONTROL_KINDS.includes(p?.kind)) problems.push(`kind ${JSON.stringify(p?.kind)} outside the closed set [${CONTROL_KINDS.join(', ')}]`)
  if (p?.requester === undefined || typeof p.requester !== 'object' || p.requester === null || typeof p.requester.kind !== 'string' || p.requester.kind === '') problems.push('requester (the ControlCallerRef) absent or malformed')
  if (typeof p?.targetInstanceId !== 'string' || p.targetInstanceId === '') problems.push('targetInstanceId absent')
  if (typeof p?.actionName !== 'string' || p.actionName === '') problems.push('actionName (the requested operation) absent')
  if (typeof p?.correlation !== 'string' || p.correlation === '') problems.push('correlation (the requestToken) absent')
  if (p?.summary !== undefined && typeof p.summary !== 'string') problems.push('summary (the reason text) present but not a string')
  if (p?.toolName !== undefined && typeof p.toolName !== 'string') problems.push('toolName present but not a string')
  return problems
}

/**
 * Split the durable facts of one root into the control families.
 * @param facts - ledgerFactsForRoot() rows.
 * @returns {requests, decisions, consumptions, pending} — `pending` = the
 *   request payloads whose requestId carries NO decision fact yet.
 */
export function splitControlFacts(facts) {
  const requests = facts.filter((f) => f.factType === 'control-request-recorded')
  const decisions = facts.filter((f) => f.factType === 'control-decision-recorded')
  const consumptions = facts.filter((f) => f.factType === 'control-allow-consumed')
  const decidedIds = new Set(decisions.map((f) => f.payload.requestId))
  const pending = requests.filter((f) => !decidedIds.has(f.payload.requestId))
  return { requests, decisions, consumptions, pending }
}

/**
 * Assert the DECIDED outcome of one requestId (the allow/deny half):
 * exactly one request fact + exactly one decision fact (the first decision
 * is authoritative — exactly-once), the decision value as expected, the
 * decider as a HUMAN (the F9 ingress: the host-derived human principal),
 * and the reason pin when given.
 * @param facts - ledgerFactsForRoot() rows.
 * @param requestId - the durable ctrl-* request id.
 * @param expect - 'allow' | 'deny' | 'stale-denied'.
 * @param opts - {decider = 'human', reason?}.
 * @returns [] on pass, otherwise the list of problems.
 */
export function checkDecided(facts, requestId, expect, opts = {}) {
  const { decider = 'human', reason } = opts
  if (!CONTROL_DECISIONS.includes(expect)) return [`expected decision ${JSON.stringify(expect)} is not in the closed set`]
  const { requests, decisions } = splitControlFacts(facts)
  const problems = []
  const reqs = requests.filter((f) => f.payload.requestId === requestId)
  const decs = decisions.filter((f) => f.payload.requestId === requestId)
  if (reqs.length !== 1) problems.push(`expected exactly 1 request fact for ${requestId}, got ${reqs.length}`)
  if (decs.length !== 1) problems.push(`expected exactly 1 decision fact for ${requestId} (first decision authoritative), got ${decs.length}`)
  const decRow = decs[0]
  const d = decRow?.payload
  if (decRow) {
    // The created-at rides on the durable ENTRY (the payload carries
    // requestId/decision/decider/scope/requestSequence[/reason|note]).
    if (typeof decRow.createdAt !== 'string' || decRow.createdAt === '') problems.push('createdAt absent on the decision entry (the created-at detail field)')
  }
  if (d) {
    if (d.decision !== expect) problems.push(`decision ${JSON.stringify(d.decision)} != expected ${expect}`)
    if (d.decider?.kind !== decider) problems.push(`decider.kind ${JSON.stringify(d.decider?.kind)} != ${decider} (F9: the human ingress — a member is never a resolver)`)
    if (reason !== undefined && d.reason !== reason) problems.push(`reason ${JSON.stringify(d.reason)} != ${JSON.stringify(reason)}`)
    if (!Number.isInteger(d.requestSequence) || d.requestSequence < 1) problems.push(`requestSequence ${JSON.stringify(d.requestSequence)} invalid (safe int >= 1)`)
  }
  return problems
}

/**
 * Assert the CONSUMPTION (exactly-once evidence) of one requestId:
 * `expectAbsent` (the deny / managed-policy half — zero side effects) or
 * exactly one `control-allow-consumed` fact (the allow half, after the
 * guarded operation executed).
 * @param facts - ledgerFactsForRoot() rows.
 * @param requestId - the durable ctrl-* request id.
 * @param opts - {expectAbsent = false}.
 * @returns [] on pass, otherwise the list of problems.
 */
export function checkConsumed(facts, requestId, opts = {}) {
  const { expectAbsent = false } = opts
  const { consumptions } = splitControlFacts(facts)
  const rows = consumptions.filter((f) => f.payload.requestId === requestId)
  if (expectAbsent) {
    return rows.length === 0 ? [] : [`expected NO consumption for ${requestId} (zero side effects), got ${rows.length}`]
  }
  if (rows.length !== 1) return [`expected exactly 1 control-allow-consumed fact for ${requestId} (exactly-once), got ${rows.length}`]
  return []
}

/**
 * Assert the §26.4 MANAGED-POLICY outcome of one requestId: the human
 * attempted an allow, the external hard policy denied the capability, and
 * the durable row is a DENY with `reason: 'external-policy'` (decider still
 * the human — the decision fact records who decided, not that the allow
 * stood) — with NO consumption (the execution was blocked).
 * @param facts - ledgerFactsForRoot() rows.
 * @param requestId - the durable ctrl-* request id.
 * @returns [] on pass, otherwise the list of problems.
 */
export function checkPolicy(facts, requestId) {
  return checkDecided(facts, requestId, 'deny', { decider: 'human', reason: 'external-policy' })
    .concat(checkConsumed(facts, requestId, { expectAbsent: true }))
}

// ── IO phases ────────────────────────────────────────────────────────────

const results = []
const check = (name, problems) => {
  const ok = problems.length === 0
  results.push({ name, ok, problems })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  — ' + problems.join(' | ')}`)
}

function parseArgs(argv) {
  const opts = { json: {} }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') opts.json = JSON.parse(argv[++i] ?? '{}')
    else if (a === '--request-id') opts.requestId = argv[++i]
    else if (a === '--expect') opts.expect = argv[++i]
    else if (a === '--reason') opts.reason = argv[++i]
    else throw new Error(`unknown argument: ${a}`)
  }
  return opts
}

function readFacts(root) {
  const dom = loadDomain(DSH_HOME)
  return ledgerFactsForRoot(dom, root)
}

async function phaseVersionGate(root) {
  const state = readBootState()
  const cookie = readCookie()
  const origin = state.origin
  const probeParams = { teamSessionId: root, requestId: 'f9-gate-probe', decision: 'allow' }
  for (const v of [1, 2, 3]) {
    const r = await teamRemote(origin, cookie, 'team.resolveControl', probeParams, v)
    check(`version-gate v${v} -> method-version-unsupported`, checkVersionGateResult(v, { ok: r.ok, error: r.error }))
  }
  const r4 = await teamRemote(origin, cookie, 'team.resolveControl', probeParams, 4)
  check('version-gate v4 accepted (reaches the control port: CONTROL_REQUEST_NOT_FOUND)', checkVersionGateResult(4, { ok: r4.ok, error: r4.error }))
  const rSpoof = await teamRemote(origin, cookie, 'team.resolveControl', { ...probeParams, caller: { kind: 'human', humanId: 'spoof' } }, 4)
  check('version-gate v4 spoofed caller field -> malformed-params unknown-field (before any derivation/port work)', checkSpoofedField({ ok: rSpoof.ok, error: rSpoof.error }))
}

function phasePending(root, opts) {
  const { kind, target, action, toolName, out } = opts
  const { pending } = splitControlFacts(readFacts(root))
  const matched = pending.filter((f) =>
    (kind === undefined || f.payload.kind === kind)
    && (target === undefined || f.payload.targetInstanceId === target)
    && (action === undefined || String(f.payload.actionName).includes(action))
    && (toolName === undefined || f.payload.toolName === toolName))
  if (matched.length === 0) {
    console.error(`[f9-check] no pending control request matches the filter (${JSON.stringify({ kind, target, action, toolName })}) — deliver the request prompt (b4-requests.md / b6-req.md) first, then re-run`)
    process.exit(2)
  }
  if (matched.length > 1) {
    console.log(`[f9-check] ${matched.length} pending requests match — taking the first (sequence ${matched[0].sequence}); the others stay pending:`)
    for (const f of matched.slice(1)) console.log(`  - seq ${f.sequence} requestId=${f.payload.requestId} kind=${f.payload.kind} action=${f.payload.actionName}`)
  }
  const chosen = matched[0]
  const problems = checkPendingRequestFields(chosen.payload)
  check(`pending detail fields (requestId ${chosen.payload.requestId.slice(0, 12)}… kind=${chosen.payload.kind})`, problems)
  const outFile = out ?? join(STATE_DIR, 'f9-pending.json')
  mkdirSync(STATE_DIR, { recursive: true })
  writeFileSync(outFile, JSON.stringify({
    root,
    requestId: chosen.payload.requestId,
    kind: chosen.payload.kind,
    requester: chosen.payload.requester,
    targetInstanceId: chosen.payload.targetInstanceId,
    actionName: chosen.payload.actionName,
    toolName: chosen.payload.toolName ?? null,
    summary: chosen.payload.summary ?? null,
    correlation: chosen.payload.correlation,
    sequence: chosen.sequence,
    createdAt: chosen.createdAt,
  }, null, 2) + '\n')
  console.log(`[f9-check] wrote ${outFile} (vars for the ui-gate.mjs F9 configs)`)
}

function phaseDecided(root, requestId, expect, reason) {
  const problems = checkDecided(readFacts(root), requestId, expect, reason === undefined ? {} : { reason })
  check(`decided ${expect} (requestId ${requestId.slice(0, 12)}…${reason !== undefined ? `, reason=${reason}` : ''})`, problems)
}

function phaseConsumed(root, requestId, opts) {
  const expectAbsent = opts?.expectAbsent === true
  check(
    expectAbsent
      ? 'consumed ZERO (deny / managed-policy half — no side effects; requestId ' + requestId.slice(0, 12) + '…)'
      : 'consumed exactly-once (requestId ' + requestId.slice(0, 12) + '…)',
    checkConsumed(readFacts(root), requestId, { expectAbsent }),
  )
}

function phasePolicy(root, requestId) {
  check('managed-policy (deny + reason external-policy + decider human + no consumption)', checkPolicy(readFacts(root), requestId))
}

// ── selftest: the offline preflight (no host, no boot state, no world) ──

function phaseSelftest() {
  // canned wire results for the version-gate probes
  const v1Result = { ok: false, error: { code: 'method-version-unsupported', message: "method 'team.resolveControl' is not available in remote contract v1", details: { method: 'team.resolveControl', contractVersion: 1, field: 'method', reason: 'method-not-available-in-version' } } }
  const v4Result = { ok: false, error: { code: 'CONTROL_REQUEST_NOT_FOUND', message: 'no durable control request', details: { cause: { code: 'CONTROL_REQUEST_NOT_FOUND' }, contractVersion: 4 } } }
  const spoofResult = { ok: false, error: { code: 'malformed-params', message: "method 'team.resolveControl' has unknown param field 'caller'", details: { method: 'team.resolveControl', contractVersion: 4, field: 'caller', reason: 'unknown-field' } } }
  check('selftest version-gate v1 shape', checkVersionGateResult(1, v1Result))
  check('selftest version-gate v4 shape', checkVersionGateResult(4, v4Result))
  check('selftest version-gate v4 WRONG code detected', checkVersionGateResult(4, { ok: false, error: { code: 'CONTROL_REQUEST_DECIDED', details: { contractVersion: 4 } } }).length > 0 ? [] : ['the wrong-code result was NOT flagged'])
  check('selftest version-gate v1 non-echo detected', checkVersionGateResult(1, { ok: false, error: { code: 'method-version-unsupported', details: { contractVersion: 3, field: 'method', reason: 'method-not-available-in-version' } } }).length > 0 ? [] : ['the wrong echo was NOT flagged'])
  check('selftest spoofed caller shape', checkSpoofedField(spoofResult))
  check('selftest spoofed caller accepted-detected', checkSpoofedField({ ok: true, error: null }).length > 0 ? [] : ['an ok=true spoof result was NOT flagged'])

  // canned durable facts for the pending/decided/consumed/policy scans
  const reqPayload = {
    requestId: 'ctrl-selftest000000000000',
    kind: 'user-approval',
    requester: { kind: 'instance', instanceId: 'inst-w1', role: 'member' },
    targetInstanceId: 'inst-w1',
    actionName: 'write',
    toolName: 'mcp__dtest-mini__write-file',
    capabilityDomain: 'tools',
    correlation: 'dtest-v2-req-ua-1',
    summary: '写入 tests/mock-outside/probe/v2-probe-1.txt',
  }
  const facts = (decisions = [], consumptions = []) => [
    { sequence: 1, factType: 'control-request-recorded', createdAt: '2026-09-07T00:00:00.000Z', payload: reqPayload },
    ...decisions.map((p, i) => ({ sequence: 2 + i, factType: 'control-decision-recorded', createdAt: '2026-09-07T00:00:01.000Z', payload: p })),
    ...consumptions.map((p, i) => ({ sequence: 10 + i, factType: 'control-allow-consumed', createdAt: '2026-09-07T00:00:02.000Z', payload: p })),
    { sequence: 99, factType: 'team-work-admitted', createdAt: '2026-09-07T00:00:03.000Z', payload: { unrelated: true } },
  ]
  const decision = (decision, reason) => ({
    requestId: reqPayload.requestId,
    decision,
    decider: { kind: 'human', humanId: reqPayload.targetInstanceId },
    scope: { rootSessionId: 'root', targetInstanceId: 'inst-w1', actionName: 'write', toolName: 'mcp__dtest-mini__write-file', correlation: reqPayload.correlation },
    requestSequence: 1,
    decisionSequence: 2,
    createdAt: '2026-09-07T00:00:01.000Z',
    ...(reason !== undefined ? { reason } : {}),
  })

  check('selftest pending fields (good payload)', checkPendingRequestFields(reqPayload))
  check('selftest pending fields (broken payload detected)', checkPendingRequestFields({ ...reqPayload, requestId: 'nope', kind: 'superuser', targetInstanceId: '' }).length > 0 ? [] : ['the broken payload was NOT flagged'])
  check('selftest split pending', splitControlFacts(facts([])).pending.length === 1 ? [] : ['pending count wrong'])
  check('selftest split decided', splitControlFacts(facts([decision('allow')])).pending.length === 0 ? [] : ['decided request still pending'])

  const rid = reqPayload.requestId
  check('selftest decided allow + human decider', checkDecided(facts([decision('allow')]), rid, 'allow'))
  check('selftest decided allow detects member decider', checkDecided(facts([{ ...decision('allow'), decider: { kind: 'instance', instanceId: 'inst-w1', role: 'leader' } }]), rid, 'allow').length > 0 ? [] : ['the member decider was NOT flagged'])
  check('selftest decided deny', checkDecided(facts([decision('deny')]), rid, 'deny'))
  check('selftest decided missing entry createdAt detected', checkDecided([{ sequence: 1, factType: 'control-request-recorded', payload: reqPayload }, { sequence: 2, factType: 'control-decision-recorded', payload: decision('allow') }], rid, 'allow').length > 0 ? [] : ['a decision entry without createdAt was NOT flagged'])
  check('selftest decided double-decision detected', checkDecided(facts([decision('allow'), decision('deny')]), rid, 'allow').length > 0 ? [] : ['two decision facts were NOT flagged'])
  check('selftest consumed exactly-once', checkConsumed(facts([decision('allow')], [{ requestId: rid, decisionSequence: 2, scope: {}, consumedAt: 'x' }]), rid))
  check('selftest consumed expectAbsent (no consumption)', checkConsumed(facts([decision('deny')]), rid, { expectAbsent: true }))
  check('selftest consumed expectAbsent detects consumption', checkConsumed(facts([decision('deny')], [{ requestId: rid, decisionSequence: 2, scope: {}, consumedAt: 'x' }]), rid, { expectAbsent: true }).length > 0 ? [] : ['a consumption under expectAbsent was NOT flagged'])
  check('selftest consumed double detected', checkConsumed(facts([decision('allow')], [{ requestId: rid, decisionSequence: 2, scope: {}, consumedAt: 'x' }, { requestId: rid, decisionSequence: 3, scope: {}, consumedAt: 'y' }]), rid).length > 0 ? [] : ['two consumptions were NOT flagged'])
  check('selftest policy (deny + external-policy + human + no consumption)', checkPolicy(facts([decision('deny', 'external-policy')]), rid))
  check('selftest policy detects consumption', checkPolicy(facts([decision('deny', 'external-policy')], [{ requestId: rid, decisionSequence: 2, scope: {}, consumedAt: 'x' }])).length > 0 ? [] : ['the consumption was NOT flagged'])
  check('selftest policy detects allow value', checkPolicy(facts([decision('allow')])).length > 0 ? [] : ['an allow value was NOT flagged'])
  check('selftest control codes closed set (7)', CONTROL_CODES.length === 7 ? [] : [`got ${CONTROL_CODES.length} codes`])
}

// ── main ─────────────────────────────────────────────────────────────────

const [phase, ...rest] = process.argv.slice(2)
const KNOWN = ['version-gate', 'pending', 'decided', 'consumed', 'policy', 'selftest']
if (!phase || !KNOWN.includes(phase)) {
  console.error(`usage: node f9-check.mjs <${KNOWN.join('|')}> [options] — see the file header`)
  process.exit(2)
}
const opts = parseArgs(rest)

try {
  if (phase === 'selftest') {
    phaseSelftest()
  } else if (phase === 'version-gate') {
    const root = opts.json.root ?? readBootState().rootSessionId
    await phaseVersionGate(root)
  } else if (phase === 'pending') {
    const root = opts.json.root ?? readBootState().rootSessionId
    phasePending(root, opts.json)
  } else {
    if (!opts.requestId) { console.error(`[f9-check] ${phase} requires --request-id <rid>`); process.exit(2) }
    const root = opts.json.root ?? readBootState().rootSessionId
    if (phase === 'decided') {
      if (!opts.expect) { console.error('[f9-check] decided requires --expect allow|deny'); process.exit(2) }
      phaseDecided(root, opts.requestId, opts.expect, opts.reason)
    } else if (phase === 'consumed') phaseConsumed(root, opts.requestId, opts.json)
    else if (phase === 'policy') phasePolicy(root, opts.requestId)
  }
} catch (e) {
  console.error(`[f9-check] ${phase}: ${e.message}`)
  process.exit(2)
}

const fails = results.filter((r) => !r.ok)
console.log(`\n[f9-check] ${results.length - fails.length} PASS, ${fails.length} FAIL — ${fails.length === 0 ? 'OK' : 'F9 GATE FAIL'}`)
process.exit(fails.length === 0 ? 0 : 1)
