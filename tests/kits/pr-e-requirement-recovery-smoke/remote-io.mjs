// KIT-LOCAL transport IO layer for the pr-e kit (moved VERBATIM out of
// pr-e-requirement-recovery-smoke.mjs): ONE implementation — the kit
// destructures makeRemoteIo(), and offline node --test regression tests drive
// the SAME code injecting only the transport-level fetch + timers (no host,
// no kit run). Keep this module dependency-free apart from node builtins and
// ./ui-observe.mjs.

import { randomUUID } from 'node:crypto'
import { abortableSleep } from './ui-observe.mjs'

export async function fetchJson(url, init, timeoutMs = 30_000, signal = undefined) {
  // ITEM-B: OPTIONAL trailing AbortSignal, COMBINED with (not replacing) the
  // self-timeout. signal === undefined keeps the exact historical signal —
  // every non-UI call site behaves byte-identically.
  let res
  try {
    res = await fetch(url, { ...init, signal: signal ? AbortSignal.any([AbortSignal.timeout(timeoutMs), signal]) : AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    if (signal?.aborted === true) {
      // GAP closure (a): a rejection while the CALLER's UI signal is aborted
      // is PRESERVED as a typed AbortError — never collapsed into a status:0
      // that downstream could not distinguish from a network failure.
      // Without a caller signal the historical status:0 form is unchanged
      // (genuine network errors and the self-timeout included).
      throw Object.assign(new Error('UI read aborted (AbortSignal)'), { name: 'AbortError', code: 'ABORT_ERR' })
    }
    return { status: 0, body: null, error: String(error?.message ?? error) }
  }
  const text = await res.text().catch(() => '')
  let body = null
  try { body = text === '' ? null : JSON.parse(text) } catch { body = text }
  return { status: res.status, body, error: null }
}

export function makeRemoteIo({ getTranscript, log, sleep, scrubTokens }) {
  if (typeof getTranscript !== 'function' || typeof log !== 'function' || typeof sleep !== 'function' || typeof scrubTokens !== 'function') {
    throw new TypeError('makeRemoteIo requires { getTranscript, log, sleep, scrubTokens }')
  }

  async function remoteCall(host, method, params, tag, version = 1, timeoutMs = 60_000, signal = undefined) {
    const body = {
      type: 'client-request',
      rpcId: `${tag}-${randomUUID().slice(0, 8)}`,
      method,
      payload: { version, params },
    }
    const r = await fetchJson(`${host.origin}/team-remote/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: host.cookie },
      body: JSON.stringify(body),
    }, timeoutMs, signal)
    if (signal?.aborted === true) {
      // GAP closure (b): the abort happened — what fetchJson returned is NOT
      // a response. NO transcript entry and NO log line are written for an
      // aborted call (disclosed contract, coordinator-ruled suppression over
      // a typed terminal record: the abort's ONLY terminal artifacts are the
      // UI lane's summary.json REJECTED:UI_READ_ABORTED line +
      // uiObserveRecords.lastReason), and the typed abort propagates.
      throw Object.assign(new Error('UI read aborted (AbortSignal)'), { name: 'AbortError', code: 'ABORT_ERR' })
    }
    const entry = {
      at: new Date().toISOString(),
      boot: host.boot,
      method,
      version,
      tag,
      status: r.status,
      error: r.error,
      ok: r.body?.result?.ok === true,
      code: r.body?.result?.ok === false ? r.body?.result?.error?.code : undefined,
      params: params ?? null,
      body: r.body,
    }
    getTranscript().push(entry)
    log(`remote ${method} v${version} [${tag}] -> ${r.status} ok=${entry.ok === true}${entry.code ? ` code=${entry.code}` : ''}${r.error ? ` (net: ${scrubTokens(r.error)})` : ''}`)
    return r
  }

  async function remoteCallReady(host, method, params, tag, version = 1, retries = 20, signal = undefined) {
    // ITEM-B: OPTIONAL trailing AbortSignal. With signal === undefined the loop
    // below is behaviorally identical to the historical one (no abort check
    // fires, plain sleep). With a signal the retry chain aborts BEFORE and
    // AFTER every attempt/sleep — an abort stops the chain mid-sleep.
    const uiAbort = () => Object.assign(new Error('UI read aborted (AbortSignal)'), { name: 'AbortError', code: 'ABORT_ERR' })
    let last = null
    for (let i = 0; i < retries; i += 1) {
      if (signal?.aborted === true) throw uiAbort()
      last = await remoteCall(host, method, params, tag, version, 60_000, signal)
      if (signal?.aborted === true) throw uiAbort() // GAP closure (c): consulted BEFORE any
      // return classification — an abort can never produce a returned
      // 'response' nor feed a retry decision.
      if (last.status !== 429) return last
      if (signal) await abortableSleep(1500, signal)
      else await sleep(1500)
      if (signal?.aborted === true) throw uiAbort()
    }
    return last
  }

  return { fetchJson, remoteCall, remoteCallReady }
}
