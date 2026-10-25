/**
 * mock-script.mjs — turns the shared mock-deepseek into a scripted turn
 * driver for the U5 canary.
 *
 * WHY NOT SEQ-NUMBERED DECISIONS (s1-h0-m1 lesson, run
 * s1-h0-m1-20261024T222400Z): a `seq === 1`-style script wasted its one tool
 * call on whichever request arrived first (a title/compaction side call), and
 * the agent turn never got it — a 180 s timeout with the probe never run. The
 * discriminator here is STRUCTURAL:
 *
 *   agent request      = request whose tools[] carry the canary definition
 *                        (title/compaction calls carry no tool list)
 *   follow-up request  = messages already contain OUR tool result
 *   everything else    = answered with a plain terminal text
 *
 * Script entries are consumed ONLY by agent requests, in order, pushed by the
 * case that prompts. `forced: true` entries are issued even WITHOUT the tool
 * being visible — the wrong-scope control (a model calling what the scope
 * does not expose must produce no effect host-side).
 */
import { CANARY_TOOL_NAME } from './world-factory.mjs'
import { stateKeyOf } from '../../kits/rc2-real-host-smoke/run-budget.mjs'

export function requestToolNames(parsed) {
  const tools = Array.isArray(parsed?.tools) ? parsed.tools : []
  return tools.map((t) => t?.function?.name ?? t?.name).filter((n) => typeof n === 'string')
}

export function requestHasTool(parsed, name) {
  return requestToolNames(parsed).includes(name)
}

function systemText(parsed) {
  for (const m of Array.isArray(parsed?.messages) ? parsed.messages : []) {
    if (m?.role === 'system') {
      return typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
    }
  }
  return ''
}

/** Find OUR tool result inside a request's messages (both wire dialects). */
export function findToolResultInMessages(parsed, callId) {
  for (const message of Array.isArray(parsed?.messages) ? parsed.messages : []) {
    if (message?.role === 'tool' && message.tool_call_id === callId) {
      const text = typeof message.content === 'string' ? message.content : JSON.stringify(message.content ?? '')
      return { text, isError: message.is_error === true || /^error/i.test(text) }
    }
    for (const part of Array.isArray(message?.content) ? message.content : []) {
      if (part?.type === 'tool_result' && part.tool_use_id === callId) {
        const text = typeof part.content === 'string' ? part.content : JSON.stringify(part.content ?? '')
        return { text, isError: part.is_error === true }
      }
    }
  }
  return undefined
}

const nonceCallId = (nonce) => new RegExp(`^u5-${nonce}-\\d+$`)

/** Is this message one of OUR tool results (chat `tool` role or a
 *  `tool_result` part), for a call id this run issued? */
function ourToolResultIndex(messages, nonce) {
  const re = nonceCallId(nonce)
  let idx = -1
  messages.forEach((m, i) => {
    if (m?.role === 'tool' && typeof m.tool_call_id === 'string' && re.test(m.tool_call_id)) idx = i
    for (const part of Array.isArray(m?.content) ? m.content : []) {
      if (part?.type === 'tool_result' && typeof part.tool_use_id === 'string' && re.test(part.tool_use_id)) idx = i
    }
  })
  return idx
}

/** Last USER-prompt message (plain text — not a tool_result-only carrier).
 *  Every new prompt the runner pushes is a fresh one of these; ambient
 *  runtime-context splices count as prompts too (worst case: the next queue
 *  entry is issued one request early — effects stay real, verdicts honest). */
function lastUserPromptIndex(messages) {
  let idx = -1
  messages.forEach((m, i) => {
    if (m?.role !== 'user') return
    if (typeof m.content === 'string') { idx = i; return }
    const parts = Array.isArray(m.content) ? m.content : []
    if (parts.some((p) => p?.type === 'text')) idx = i
  })
  return idx
}

/**
 * @param {object} opts
 * @param {Array<{mode:string, tag:string, sleepMs?:number, forced?:boolean}>} opts.queue
 *        consumed FIFO by agent requests (pushed by the prompting case)
 * @param {string} opts.nonce unique per run (call ids u5-<nonce>-<k>)
 * @param {(issue:object)=>void} [opts.onCallIssued] bookkeeping
 * @param {{budget?:object, runControl?:object}} [opts.control] progress budgets
 */
export function makeCanaryDecide({ queue, nonce, onCallIssued = () => {}, control = {} }) {
  let issued = 0
  return async ({ seq, req }) => {
    const { budget, runControl } = control
    const purpose = requestHasTool(req, CANARY_TOOL_NAME) ? 'agent' : 'aux'
    const toolResults = countToolResults(req)
    const key = stateKeyOf({ purpose, systemText: systemText(req), toolResults })
    if (budget !== undefined) {
      const v = budget.observeRequest(key)
      if (v !== null) {
        runControl?.requestAbort?.(`mock budget: ${v.detail}`)
        return { kind: 'text', content: 'U5-ABORT' }
      }
    }
    const reply = decideReply()
    if (budget !== undefined) {
      const v = budget.noteReply(key, `${reply.kind}:${JSON.stringify(reply).slice(0, 120)}`)
      if (v !== null) {
        runControl?.requestAbort?.(`mock budget: ${v.detail}`)
        return { kind: 'text', content: 'U5-ABORT' }
      }
    }
    return reply

    function decideReply() {
      const hasCanary = requestHasTool(req, CANARY_TOOL_NAME)
      // Follow-up of OUR chain iff OUR tool result sits AFTER the last user
      // prompt. A positional test, not a whole-history scan: history from
      // earlier turns must not blind later turns (measured dbg2 run: a scan
      // made every follow-on turn answer TURN-DONE and never re-issue).
      const msgs = Array.isArray(req?.messages) ? req.messages : []
      const resultIdx = ourToolResultIndex(msgs, nonce)
      const promptIdx = lastUserPromptIndex(msgs)
      if (resultIdx > promptIdx) {
        const callId = msgs[resultIdx]?.tool_call_id
          ?? (Array.isArray(msgs[resultIdx]?.content) ? msgs[resultIdx].content.find((p) => p?.type === 'tool_result')?.tool_use_id : undefined)
        const res = findToolResultInMessages(req, callId) ?? { isError: false }
        return { kind: 'text', content: `U5-TURN-DONE ${res.isError ? 'after-error' : 'after-ok'}` }
      }
      if (queue.length === 0) return { kind: 'text', content: 'U5-NOTURN' }
      const head = queue[0]
      if (!head.forced && !hasCanary) {
        // Not an agent-scope request and this entry needs the visible tool —
        // do NOT consume the queue on aux traffic.
        return { kind: 'text', content: 'U5-AUX' }
      }
      const entry = queue.shift()
      const callId = `u5-${nonce}-${issued}`
      issued += 1
      onCallIssued({ callId, seq, ...entry })
      return {
        kind: 'tool-call',
        toolCalls: [{
          id: callId,
          name: CANARY_TOOL_NAME,
          arguments: { mode: entry.mode, tag: entry.tag, ...(entry.sleepMs !== undefined ? { sleepMs: entry.sleepMs } : {}) },
        }],
      }
    }
  }
}

function countToolResults(parsed) {
  let n = 0
  for (const message of Array.isArray(parsed?.messages) ? parsed.messages : []) {
    if (message?.role === 'tool') n += 1
    for (const part of Array.isArray(message?.content) ? message.content : []) {
      if (part?.type === 'tool_result') n += 1
    }
  }
  return n
}

/** Scan all mock requests for the result envelope of one of our call ids. */
export function findIssuedResult(mockRequests, callId) {
  for (const record of mockRequests) {
    const res = findToolResultInMessages(record.body, callId)
    if (res !== undefined) return { found: true, ...res, requestSeq: record.seq }
  }
  return { found: false }
}

/**
 * Does a tool-result text CLAIM a ran-effect? The text is the render layer's
 * JSON, often double-escaped (`\"ran\":true` inside a [{type:text,...}]
 * envelope) — unescape first, then test. This is the tool's OWN claim: only
 * the blinded Oracle variant and the defect-detection case consume it.
 * @param {string} text tool result content
 * @returns {boolean}
 */
export function resultClaimsRan(text) {
  const flat = String(text ?? '').replace(/\\+["\\]/g, (m) => (m.endsWith('"') ? '"' : ''))
  return /"ran"\s*:\s*true/.test(flat)
}
