#!/usr/bin/env node
/**
 * Deterministic check for live-token redaction in the browser smoke's PERSISTED
 * copies (external review block on PR #53). No host, no network, no browser: a
 * synthetic v6 `team.getReadState` answer in the exact envelope the harness
 * emits is run through redactLiveTokenFields(), and two properties are proved —
 *
 *   (1) live-token material cannot survive into a persisted/logged copy, and
 *   (2) the fields the readiness assertion actually judges (relation /
 *       teamSessionId / memberInstanceId / disposed / durableGeneration) pass
 *       through UNCHANGED, so redaction cannot mask a wrong answer into a
 *       right one.
 *
 * The fixture token is assembled at runtime, so this file contains no
 * credential-shaped literal of its own (same rule as the evidence-side
 * redaction-check.mjs).
 */

import { redactLiveTokenFields, redactLiveTokenText, LIVE_TOKEN_MASK } from './live-token-redact.mjs'

const FAKE = ['lt', 'v1', 'SYNTHETIC', 'NOT', 'A', 'REAL', 'TOKEN', '0123456789abcdef'].join('-')
const OTHER = ['lt', 'v1', 'ALSO', 'SYNTHETIC', 'ffffffff9999'].join('-')

let failures = 0
function check(name, ok, detail = '') {
  process.stdout.write(`  ${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}\n`)
  if (!ok) failures += 1
}

/** The real v6 envelope: the record is at result.value.data (observed on the
 *  wire: {"type":"server-response","result":{"ok":true,"value":{"data":{…}}}}). */
function syntheticReadStateResponse() {
  return {
    type: 'server-response',
    rpcId: 'smoke-ready-1790863497467',
    result: {
      ok: true,
      value: {
        data: {
          relation: 'team-member',
          teamSessionId: 'session-mpr-t1-mpr-2026-10-01T13-21-34',
          memberInstanceId: 'inst-0iin89s0dvix',
          disposed: false,
          durableGeneration: 32,
          liveToken: FAKE,
        },
        provenance: { origin: 'team-remote', method: 'team.getReadState', contractVersion: 6 },
      },
    },
  }
}

const record = syntheticReadStateResponse().result.value.data
const before = JSON.stringify(record)

// 1. the field is masked in the persisted copy, and the raw value is gone.
const masked = redactLiveTokenFields(record)
check('liveToken field value is replaced by the mask', masked.liveToken === LIVE_TOKEN_MASK, `got ${JSON.stringify(masked.liveToken)}`)
check('the raw token appears nowhere in the persisted serialization', !JSON.stringify(masked).includes(FAKE))
check('the raw token IS present in the un-redacted record (the leak this prevents)', JSON.stringify(record).includes(FAKE))

// 2. the criteria-bearing fields survive byte-for-byte.
for (const key of ['relation', 'teamSessionId', 'memberInstanceId', 'disposed', 'durableGeneration']) {
  check(`criteria field '${key}' passes through unchanged`, JSON.stringify(masked[key]) === JSON.stringify(record[key]),
    `= ${JSON.stringify(masked[key])}`)
}
check('field set is preserved (nothing added or dropped)',
  JSON.stringify(Object.keys(masked).sort()) === JSON.stringify(Object.keys(record).sort()))

// 3. the input object is NOT mutated — the assertions keep seeing the response.
check('the original response object is untouched by redaction', JSON.stringify(record) === before)

// 4. tokens hidden in nested objects, arrays and free text are masked too.
const nested = redactLiveTokenFields({
  outer: { liveToken: FAKE, note: `retry with ${OTHER} later` },
  list: [{ liveToken: OTHER }, 'plain', { deep: { liveToken: FAKE } }],
  count: 3,
  flag: true,
  nothing: null,
})
const nestedText = JSON.stringify(nested)
check('nested liveToken values are masked', !nestedText.includes(FAKE) && !nestedText.includes(OTHER))
check('a token quoted inside free text is masked', !nestedText.includes(OTHER) && nested.outer.note.includes(LIVE_TOKEN_MASK))
check('non-credential values survive nesting untouched',
  nested.list[1] === 'plain' && nested.count === 3 && nested.flag === true && nested.nothing === null)

// 5. no-op when there is nothing to redact, and idempotence when there is.
const clean = { relation: 'team-root', teamSessionId: 'session-x', memberInstanceId: null, disposed: false, durableGeneration: 1 }
check('a token-free record is byte-identical after redaction', JSON.stringify(redactLiveTokenFields(clean)) === JSON.stringify(clean))
check('redaction is idempotent', JSON.stringify(redactLiveTokenFields(masked)) === JSON.stringify(masked))

// 6. the text form used for console lines masks the same shape.
check('redactLiveTokenText masks a token inside a log string',
  redactLiveTokenText(`readState=${JSON.stringify(record)}`).includes(LIVE_TOKEN_MASK)
  && !redactLiveTokenText(`readState=${JSON.stringify(record)}`).includes(FAKE))

// 7. the exact way the kit persists it.
const persisted = { runStamp: 'tvs-smoke-x', readyReadState: redactLiveTokenFields(record) }
check('smoke-host.json as the kit writes it carries no raw token', !JSON.stringify(persisted).includes(FAKE))
check('…and still records the member it verified',
  persisted.readyReadState.memberInstanceId === record.memberInstanceId
  && persisted.readyReadState.teamSessionId === record.teamSessionId)

process.stdout.write(`live-token-redaction-check: ${failures === 0 ? 'all assertions green' : `${failures} FAILED`}, exit=${failures === 0 ? 0 : 1}\n`)
process.exit(failures === 0 ? 0 : 1)
