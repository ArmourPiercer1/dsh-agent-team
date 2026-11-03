#!/usr/bin/env node
/**
 * rejudge.mjs — re-derive THIS run's case verdicts from the artifacts the one
 * boot produced, WITHOUT a second boot.
 *
 * WHY THIS FILE EXISTS (disclosed, not hidden): the executed `run-boot.mjs`
 * tested "legible setup refusal" as `toolResult.is_error === true`. The host's
 * Team tool layer reports a refused activation as a NORMAL tool result whose
 * JSON body is `{"status":"rejected","code":"TEAM_RUNTIME_DURABLE_WRITE_FAILED",
 * "message":"…TypeError: agent-bindings: the a5sf native tool re-mount needs a
 * SCOPED agent Context…"}` — `is_error` stays false. The raw predicate
 * therefore scored a legible refusal as FAIL. The boot is spent; re-running it
 * to satisfy a predicate is exactly what the one-boot rule forbids.
 *
 * This file reads `transcript.json` (the mock model's captured corpus),
 * `guard-facts.json`, `ledger-rows.json` and `grant.json` — all produced by
 * that same single boot — and rewrites `run-record.json` with the corrected
 * table. It starts nothing, opens no port, appends no ledger row and writes no
 * product file. Every revised verdict names the captured fact it rests on.
 *
 * @module dev/agent-workflow/evidence/a5sf-live-native/rejudge
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { overallVerdict, formatSummary } from '../../../../tests/world-factory/lib/run-record.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = (name) => JSON.parse(readFileSync(join(HERE, name), 'utf8'))
const transcript = read('transcript.json')
const guardFactsFile = read('guard-facts.json')
const ledger = read('ledger-rows.json')
const grant = read('grant.json')
const record = read('run-record.json')

const results = transcript.results
const setupRefusals = results.filter((r) => /a5sf native tool re-mount needs a SCOPED agent Context/.test(r.head))
const memberRequests = transcript.surfacePerMemberRequest
const guardFacts = guardFactsFile.guardFacts ?? []
const createMemberRefusals = results.filter((r) => r.tool === 'team_create_member')
const ledgerRows = ledger.rows ?? []

const cases = []
const add = (id, verdict, detail) => cases.push({ id, verdict, at: new Date().toISOString(), ...detail })

// ── the five points, re-derived ─────────────────────────────────────────────
add('live:booted-member-a5sf-wired', 'FAIL', {
  disposition: 'REFUTED',
  reason: 'A5SF_WIRED_MEMBER_SETUP_REFUSED',
  hostBooted: true,
  teamSessionCreated: true,
  memberModelTurns: memberRequests.length,
  refusals: setupRefusals.length,
  observed: setupRefusals[0]?.head ?? null,
  note: 'The Host booted and the Team Session was created, but the a5sf-wired Member never reached an agent turn: its child-session activation refused with the exact TypeError below. "A booted world where a model-visible native read is refused" is therefore NOT established at this HEAD — the product seam refuses earlier.',
})

add('live:native-read-outside-refused', 'NOT_REACHED', {
  disposition: 'NOT_REACHED',
  reason: 'MEMBER_SETUP_REFUSED_BEFORE_ANY_TOOL_CALL',
  memberModelTurns: memberRequests.length,
  readCallsSeen: results.filter((r) => r.tool === 'read').length,
  note: 'No Member agent ever existed, so no model request, no `read` tool call and no guard decision took place. This is a product-seam blocker, not a missing test seam: the refusal is the setup TypeError quoted under live:booted-member-a5sf-wired.',
})

add('live:sink-exactly-one-deny-fact', 'NOT_REACHED', {
  disposition: 'NOT_REACHED',
  reason: 'SINK_NEVER_CREATED',
  sinkExists: false,
  guardFacts: guardFacts.length,
  note: 'The configured `a5sfEvidencePath` sink was never created: the realm mounted (mount happens before the attach) but no tool ever consulted the Guard, so there is nothing to count. An empty sink is reported as empty, never as "zero denials found".',
})

add('live:native-read-inside-allowed', 'NOT_REACHED', {
  disposition: 'NOT_REACHED',
  reason: 'MEMBER_SETUP_REFUSED_BEFORE_ANY_TOOL_CALL',
  note: 'Same blocker as the outside read: no Member ran, so neither the inside bytes nor an allow fact exist.',
})

add('live:builtin-deny-native-fails-loud', 'NOT_REACHED', {
  disposition: 'LOUD_FAILURE_PROVEN / DENY_SPECIFIC_REFUSAL_NOT_REACHED',
  reason: 'REFUSAL_IS_THE_UNSCOPED_CTX_TYPEERROR_NOT_THE_SURFACE_NEUTRALITY_REFUSAL',
  refused: createMemberRefusals.length > 0,
  toolResultIsErrorFlag: createMemberRefusals.map((r) => r.isError),
  observed: createMemberRefusals[0]?.head ?? null,
  note: 'PROVEN that a `builtinToolDeny: [read]` Member does NOT run silently unconfined: the create result is a typed rejection ("status":"rejected", code TEAM_RUNTIME_DURABLE_WRITE_FAILED) carrying the cause verbatim, and no member turn happened. NOT_REACHED for C2(a)\'s *specific* arm: the refusal is the unscoped-agent-Context TypeError that EVERY a5sf-wired Member hits (the control `worker` Member got the identical error first), so the deny-then-attach surface-neutrality refusal never executed and cannot be credited here.',
})

add('live:teardown-no-shadow', 'NOT_REACHED', {
  disposition: 'NOT_REACHED',
  reason: 'NO_OBSERVABLE_SEAM_FOR_A_DEAD_SCOPE',
  archiveIssued: true,
  archiveResult: 'blocked target-stale (the Member never reached a live durable state)',
  note: 'No Member ran, so there was no shadow to keep or drop. C2(b)\'s "does the row keep a shadow after the Member stops" remains unobservable in this boot: the only stop reachable from the product is archive, which co-terminates with the agent, and no host-exposed seam reports the disposed agent scope.',
})

add('live:runtime-revoke-reachable', 'NOT_REACHED', {
  disposition: 'NOT_REACHED',
  reason: 'NO_A5SF_RUNTIME_REVOKE_SEAM',
  note: 'No a5sf runtime revoke exists on the model/leader surface: the 15 team tools contain no a5sf revoke; team_grant_permission / team_revoke_permission are the Alpha.4 permission-rule lane and do not re-evaluate a mounted a5sf realm. The only a5sf revoke is the row teardown (realm.dispose), reached by archive and co-terminating with the agent.',
})

record.cases = cases
record.overall = overallVerdict(cases)
record.verdictsRevised = {
  by: 'dev/agent-workflow/evidence/a5sf-live-native/rejudge.mjs',
  why: 'the executed predicate required toolResult.is_error===true for a legible setup refusal; the host reports a refused activation as status:"rejected" with is_error false. Re-derived from the same single boot\'s captured transcript; NO second boot was made.',
  bootLedgerRows: ledgerRows.length,
  grantId: grant.grantId,
  grantBoundCommit: grant.boundCommit,
}
writeFileSync(join(HERE, 'run-record.json'), JSON.stringify(record, null, 2) + '\n')
console.log(formatSummary(record))
console.log('dispositions:')
for (const c of cases) console.log(`  ${c.id}: ${c.verdict} — ${c.disposition}`)
