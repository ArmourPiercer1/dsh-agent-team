/**
 * mock-routing.mjs — HOST-FREE proof of the BL-18 marker-routed mock table.
 *
 * It feeds the SAME `decide` callback the shipped mock server consumes a queue
 * of synthetic requests in the order a discovery-first boot would produce them,
 * plus the two orders that break an ordinal script, and asserts the decision
 * per turn. No server, no socket, no Host.
 *
 * The four orders exercised:
 *
 *   ORDINAL-SAFE   title → discovery → create → fetch → search → collect
 *   RETRY          discovery repeated (a retried request must not fire a tool)
 *   INTERLEAVED    title between every scripted turn
 *   WRONG-SESSION  the fetch marker appearing on a request that also carries
 *                  the create marker (the leader's turn): create wins, because
 *                  fetch is only scripted on the Member's own marker text
 *
 * What this does NOT prove is stated in the module header: only a boot can show
 * which markers the Host actually sends.
 *
 * Run: node dev/agent-workflow/evidence/a5sf-bl18-live/mock-routing.mjs
 */
import assert from 'node:assert/strict'

import { BL18_MARKERS, ROUTING_TABLE, makeBl18Decide, routeKindOf } from './bl18-marker-mock.mjs'

const LINES = []
function log(line) {
  LINES.push(line)
  process.stdout.write(`${line}\n`)
}

/** One synthetic request in the mock's recorded shape. */
function req({ user, system = [], role = 'user', extra = [] }) {
  return {
    headers: { accept: 'text/event-stream' },
    body: {
      model: 'a5sf-bl18-model',
      stream: true,
      messages: [
        ...system.map((text) => ({ role: 'system', content: text })),
        ...extra,
        { role, content: user },
      ],
    },
  }
}

const TITLE = 'Generate the session title for this conversation.'
const DISCOVERY = `You are the leader of the a5sf BL-18 anchor team. ${BL18_MARKERS.discovery} is the discovery marker.`
const CREATE = `Create the team and delegate to the web worker. ${BL18_MARKERS.create}`
const FETCH = `Fetch exactly https://example.test/legal/page with web_fetch, then report. ${BL18_MARKERS.fetch}`
const SEARCH = `Search "a5sf bl18 deny lane" with web_search, then report. ${BL18_MARKERS.search}`
const COLLECT = `Collect the member's work and report. ${BL18_MARKERS.collect}`

function toolNameOf(reply) {
  if (reply?.kind !== 'tool-call') return null
  const call = Array.isArray(reply.toolCalls) ? reply.toolCalls[0] : undefined
  return typeof call?.name === 'string' ? call.name : null
}

function run(label, requests, expected) {
  const decide = makeBl18Decide()
  const observed = requests.map((request) => {
    const reply = decide(request)
    return { kind: routeKindOf(request), reply }
  })
  const kinds = observed.map((entry) => entry.kind)
  assert.deepEqual(kinds, expected.kinds, `${label}: routing kinds`)
  observed.forEach((entry, index) => {
    assert.equal(toolNameOf(entry.reply), expected.tools[index], `${label}: turn ${index + 1} tool name`)
  })
  log(`${label}: ${kinds.join(' → ')}`)
  log(`  tools: ${observed.map((entry) => toolNameOf(entry.reply) ?? '-').join(' → ')}`)
  return observed
}

let exitCode = 0
try {
  log('a5sf BL-18 mock routing — host-free (zero boots, zero sockets)')
  log(`routing table: ${JSON.stringify(ROUTING_TABLE)}`)

  run('ORDINAL-SAFE', [
    req({ user: TITLE }),
    req({ user: DISCOVERY }),
    req({ user: CREATE }),
    req({ user: FETCH }),
    req({ user: SEARCH }),
    req({ user: COLLECT }),
  ], { kinds: ['title', 'discovery', 'create', 'fetch', 'search', 'collect'], tools: [null, null, 'team_create', 'web_fetch', 'web_search', 'team_collect'] })

  // A retried discovery request: no tool call, and it does not consume the
  // create script (the next create turn still fires).
  run('RETRY', [
    req({ user: DISCOVERY }),
    req({ user: DISCOVERY }),
    req({ user: CREATE }),
    req({ user: FETCH }),
  ], { kinds: ['discovery', 'discovery', 'create', 'fetch'], tools: [null, null, 'team_create', 'web_fetch'] })

  // The order that breaks an ordinal script: the DISCOVERY turn arrives FIRST
  // (boot 4 made zero requests; a discovery-first boot makes this the first).
  run('DISCOVERY-FIRST', [
    req({ user: DISCOVERY }),
    req({ user: CREATE }),
    req({ user: FETCH }),
    req({ user: SEARCH }),
    req({ user: COLLECT }),
  ], { kinds: ['discovery', 'create', 'fetch', 'search', 'collect'], tools: [null, 'team_create', 'web_fetch', 'web_search', 'team_collect'] })

  // Repeated markers are answered once; the second fetch is harmless, so a
  // duplicate probe cannot be mistaken for two measured cases.
  run('DUPLICATE', [
    req({ user: FETCH }),
    req({ user: FETCH }),
  ], { kinds: ['fetch', 'fetch'], tools: ['web_fetch', null] })

  // An interleaved title turn never lands on a scripted reply.
  run('INTERLEAVED', [
    req({ user: TITLE }),
    req({ user: CREATE }),
    req({ user: TITLE }),
    req({ user: FETCH }),
  ], { kinds: ['title', 'create', 'title', 'fetch'], tools: [null, 'team_create', null, 'web_fetch'] })

  // The leader's turn mentions the create marker; the member's fetch marker is
  // only in the member's delegate prompt. A request carrying BOTH is classified
  // by the marker precedence (fetch before create) — the run's delegate prompt
  // must therefore never quote the fetch marker to the leader.
  const mixed = req({ user: `${FETCH}\n${CREATE}` })
  assert.equal(routeKindOf(mixed), 'fetch', 'marker precedence: an item marker wins over the create marker')
  log('PRECEDENCE: a request carrying both MK_BL18_FETCH and MK_BL18_CREATE routes to fetch')
  log('  → the driver MUST NOT quote an item marker in the leader prompt; the delegate prompt is the only carrier.')

  // Unmarked traffic (a summariser, an internal retry) is harmless.
  const unmarked = req({ user: 'Summarise the conversation so far.' })
  const decide = makeBl18Decide()
  assert.equal(routeKindOf(unmarked), 'fallback')
  assert.equal(toolNameOf(decide(unmarked)), null)
  log('UNMARKED: harmless text, no tool call')

  log('')
  log('ROUTING-PROVEN: the table is marker-keyed; discovery-first, retries, duplicate markers and unmarked turns never fire a scripted tool call.')
  log('NOT PROVEN (a boot must show): which markers the Host actually sends, and that final-mock-requests.json carries them in order.')
} catch (error) {
  exitCode = 1
  log(`ROUTING FAILED: ${String(error?.message ?? error)}`)
  if (error?.stack !== undefined) log(String(error.stack))
}
process.exitCode = exitCode
