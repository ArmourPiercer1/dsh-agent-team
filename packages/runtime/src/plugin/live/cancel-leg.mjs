/**
 * a5-cancel-leg — the cancellation leg the TWO ASYNC confined-rg rows share
 * (anchored search `search-backend.mjs`, anchored glob `glob-backend.mjs`).
 * Small on purpose, and used by those two rows and nobody else.
 *
 * WHY A SEPARATE MODULE, AND WHY NOT THE SHELL ROW'S LEG. The confined-shell row
 * already carries its own abort leg (`raceShellSettle` + `shellCancelled` in
 * `plane-effect-backends.mjs`, lane B3). That leg answers a cancelled call by
 * PRESENTING a cancelled settlement — a value with `cancelled: true` — because
 * the shell row's wire form is a presentation of what the payload did. The two rg
 * rows have the opposite law: a cancelled search/glob produced NO ANSWER, so it
 * is a typed FAILURE built by each row's own frozen refusal table, never an
 * `ok: true` empty result (an empty list is a statement about the tree, and a
 * cancelled walk has made no statement about anything). Reusing the shell leg's
 * vocabulary here would smuggle a presentation into a refusal, so this module
 * shares the MECHANICS and owns none of the wording.
 *
 * Three facts, three exports:
 *
 *  1. `callAborted(signal)` — the boundary predicate. Absent signal is not a
 *     signal: `undefined` never aborts, which is what makes the whole leg
 *     additive (a call that carries no channel takes no new branch at all).
 *  2. `createOwnedStop()` — ONE owned terminate per call. The child is ADOPTED
 *     the moment a handle exists — including a handle that arrives after the
 *     caller already gave up, which is the case a naive race loses (the payload
 *     keeps running with nobody holding it). `stop()` returns the one memoized
 *     promise; its result MUST be read: only a provider-confirmed
 *     `{ok: true, value: {status: 'terminated'}}` — or the honest absence of a
 *     child — may be reported as stopped. A refused terminate, a throwing
 *     terminate, or any other lease status is UNCONFIRMED, and the row says so
 *     with its own code rather than claiming a stop it cannot prove.
 *  3. `raceConfinedSettle(...)` — the settle race, with the tie law FIXED below.
 *
 * THE TIE LAW: `exited > timedOut > aborted`, decided by REGISTRATION ORDER and
 * never re-decided. The three facts are peers; what must not vary is which one
 * ANSWERS. A payload that finished is a finished payload even if the caller
 * gave up in the same tick — the row reports the completed walk's own verdict,
 * and a later abort is honoured at the NEXT boundary (before any commit) rather
 * than rewriting the winner. A late fact therefore never changes an outcome that
 * has already been decided; it only ever prevents a publication.
 *
 * NO USER INTENT IS CLAIMED ANYWHERE IN THIS LEG. An aborted signal is a
 * cooperative-cancel fact about the call, not a statement about who raised it or
 * why, and `signal.reason` is never read or echoed here: it is caller-owned
 * free text, and these rows publish codes plus arithmetic and nothing else.
 *
 * @module runtime/plugin/live/cancel-leg
 */
import { setTimeout as sleepTimer, clearTimeout as clearSleepTimer } from 'node:timers'

/**
 * The two codes this leg can produce. THEY ARE WORDS, NOT OWNERSHIP: each row
 * keeps its own frozen table (text + family word) and refuses through its own
 * `failure()` face; this module only keeps the two spellings from drifting apart.
 * `call-aborted` is the STOPPED-CONFIRMED form (nothing of this call is running,
 * proved by the provider or by the call never having spawned anything);
 * `termination-unconfirmed` is the form the row must use when the caller gave up
 * and the stop could NOT be proved.
 */
export const CANCEL_CODE_ABORTED = 'call-aborted'
export const CANCEL_CODE_UNCONFIRMED = 'termination-unconfirmed'

/**
 * The boundary predicate. `signal === undefined` (the overwhelmingly common
 * case, and the ONLY case these rows saw before this leg) returns false without
 * touching anything, so a call with no channel runs the identical branch it ran
 * before. A real `AbortSignal` answers from its own `aborted` flag; the leg
 * never reads `reason`, and never caches the answer across a boundary — that is
 * the whole point of re-checking after every await.
 */
export function callAborted(signal) {
  return signal !== undefined && signal !== null && signal.aborted === true
}

/** Audit-safe form word: the shape of a stop, never a payload of the stop. */
function formWord(value) {
  const word = String(value).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return word.length > 0 ? word : 'unshaped'
}

/**
 * The ONE classification of a terminate result, and it is a STRICT LITERAL test.
 * Confirmed means `settled.ok === true` together with `settled.value.status ===
 * 'terminated'` — that exact word, the one the provider's own lease type carries.
 * `formWord` below is for the AUDIT WORD and nothing else: folding a status into
 * its normalised form BEFORE comparing it would let 'TERMINATED' or ' terminated!
 * ' claim a stopped payload the provider never confirmed. A claim of safety is
 * worth exactly what the word behind it is worth, so nothing between the provider's
 * byte and this comparison is allowed to normalise, trim or case-fold it.
 */
function classifyStop(settled) {
  if (settled === null || typeof settled !== 'object') {
    return Object.freeze({ stopped: false, confirmedBy: null, form: 'terminate-unshaped' })
  }
  if (settled.ok !== true) {
    return Object.freeze({ stopped: false, confirmedBy: null, form: 'terminate-refused' })
  }
  if (settled.value?.status === 'terminated') {
    return Object.freeze({ stopped: true, confirmedBy: 'provider', form: 'terminated' })
  }
  // `active`, `cancelling`, `termination-unconfirmed`, any case or punctuation
  // variant of any of them, and anything a future arm invents: the lease is not
  // provably dead, so the stop is UNCONFIRMED. The raw value reaches the form word
  // for the audit face only — never the decision above.
  const raw = settled.value?.status
  const word = typeof raw === 'string' ? formWord(raw) : 'missing'
  return Object.freeze({ stopped: false, confirmedBy: null, form: `status-${word}` })
}

/** A terminate that threw: the caller gave up and the arm could not answer. */
const STOP_THREW = Object.freeze({ stopped: false, confirmedBy: null, form: 'terminate-threw' })

/** No terminate arm at all — nothing this call could have asked of the provider. */
const NO_ARM = Object.freeze({ stopped: false, confirmedBy: null, form: 'no-terminate-arm' })

/** No child was ever adopted, so there is nothing of THIS call left running. */
const NO_CHILD = Object.freeze({ stopped: true, confirmedBy: 'never-spawned', form: 'no-child' })

/**
 * The owned stop of ONE call, with ONE terminate and TWO readings of it.
 *
 * `adopt` registers a handle the instant it exists (first handle wins). A handle
 * that arrives AFTER `stop()` already settled on empty ownership is adopted into
 * the stop path instead of being dropped — the late-child case a `Promise.race`
 * over the spawn promise loses, leaving a payload live with nobody holding it.
 *
 *  - `rawStop()` hands out THE terminate promise: the same object every time, and
 *    a rejection is NOT swallowed. This is the arm the row has always awaited on
 *    its own (`await child.terminate()`), and on a call nobody cancelled its
 *    failure contract must stay exactly where it was — a throwing lease belongs in
 *    the row's own catch, not in a cancel word it never asked for.
 *  - `stop()` is the CANCEL face: it derives from that same promise, never
 *    rejects, and says in words what it could or could not prove. A cancel cannot
 *    manufacture an unhandled rejection, and it cannot mint a stop the provider
 *    did not confirm.
 *
 * One terminate per call, whichever face asks and however many boundaries ask.
 */
export function createOwnedStop() {
  let held = null
  let raw = null
  let classified = null
  let settledEmpty = false
  const rawLeg = () => {
    if (raw === null) {
      if (held === null || typeof held.terminate !== 'function') {
        // Nothing to terminate — recorded as an empty settlement so a handle
        // arriving later re-opens the leg onto IT (see `adopt`).
        settledEmpty = true
        raw = Promise.resolve(undefined)
      } else {
        raw = Promise.resolve().then(() => held.terminate())
      }
    }
    return raw
  }
  return {
    /** Register the child this call owns. Safe to call before or after a stop. */
    adopt(child) {
      if (held !== null || child === null || child === undefined) return
      held = child
      if (settledEmpty) {
        // The caller gave up before the handle existed; the handle is now real,
        // so BOTH faces re-open onto it — the payload gets stopped through the
        // owned terminate instead of being dropped with the walk live.
        settledEmpty = false
        raw = null
        classified = null
      }
    },
    /** The handle this call owns, or null when it never spawned anything. */
    child: () => held,
    /** THE terminate promise. Rejection intact: this is the row's own arm. */
    rawStop: rawLeg,
    /** THE classified stop of this call — memoized, never rejecting. */
    stop() {
      if (classified === null) {
        if (held === null) {
          settledEmpty = true
          classified = Promise.resolve(NO_CHILD)
        } else if (typeof held.terminate !== 'function') {
          classified = Promise.resolve(NO_ARM)
        } else {
          classified = rawLeg().then(classifyStop, () => STOP_THREW)
        }
      }
      return classified
    },
  }
}

/**
 * The settle race of a confined walk: the walk's own exit, the row's timeout
 * budget, and (only when the call carries one) the caller's cancel channel.
 *
 * Tie law `exited > timedOut > aborted`, fixed by the registration order below
 * — `Promise.race` hands the answer to the FIRST leg that settles, so legs
 * settled at setup time in the same tick resolve in this order and the outcome
 * cannot depend on a listener's arrival order. A signal that already fired
 * settles its leg at setup, which is what makes a pre-abort deterministic
 * instead of a timing bet. The abort listener is removed the moment the race
 * settles: the row keeps no listener on a caller's signal past the call.
 *
 * With no signal the leg list is exactly `[exited, timeout]`, i.e. exactly the
 * race these rows have always run.
 */
export function raceConfinedSettle({ exited, timeoutMs, signal, sleep = sleepTimer, clear = clearSleepTimer }) {
  const hasChannel = signal !== undefined && signal !== null
  let onAbort = null
  let timer = null
  const legs = [
    exited,
    new Promise((resolve) => {
      timer = sleep(() => resolve({ timedOut: true }), timeoutMs)
      // `unref` says a live timer must not hold the process open. It is NOT the
      // release: the release is `release()` below, which runs on the settled path
      // AND on the rejecting one.
      if (typeof timer?.unref === 'function') timer.unref()
    }),
  ]
  if (hasChannel) {
    legs.push(new Promise((resolve) => {
      onAbort = () => resolve({ aborted: true })
      if (signal.aborted === true) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })
    }))
  }
  const release = () => {
    if (timer !== null && timer !== undefined) {
      const handle = timer
      timer = null
      clear(handle)
    }
    if (hasChannel && onAbort !== null) {
      const listener = onAbort
      onAbort = null
      signal.removeEventListener('abort', listener)
    }
  }
  // Both settle paths release. `exited` rejecting is a real possibility (the
  // provider's own face can fail) and it propagates untouched — the row's catch
  // answers it, exactly as before this leg existed — but it must not leave a live
  // timer or a listener on the caller's signal behind.
  return Promise.race(legs).then((winner) => {
    release()
    return winner
  }, (error) => {
    release()
    throw error
  })
}
