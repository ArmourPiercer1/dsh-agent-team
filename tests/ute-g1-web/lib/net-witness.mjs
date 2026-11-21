/**
 * net-witness.mjs — the OUTBOUND-SOCKET WITNESS for the web family's baseline.
 *
 * WHY THIS FILE EXISTS. A web family is the first UTE family whose ordinary
 * behaviour is a network effect, so "the fixture was reachable and nothing else
 * was" cannot be proven by reading the corpus: it has to be counted at the one
 * place Node opens a socket. This module patches `node:net`'s
 * `Socket.prototype.connect` for the lifetime of a capture and records, per
 * connect call:
 *
 *   sockets   every TCP connect the process attempted (loopback + external);
 *   loopback  attempts whose destination is a loopback address;
 *   external  attempts whose destination is NOT loopback — each one is REFUSED
 *             before the syscall (the socket is destroyed with `EGRESS_REFUSED`
 *             and no `original.connect` runs), and recorded.
 *
 * WHAT IT IS NOT. It is not a policy and it is not a sandbox: it cannot make a
 * socket fail for a process it is not running in, and it does not decide
 * admission (the confined `web` face does that). It is a measurement whose
 * absence is detectable: {@link networkWitnessOf} throws `NET_WITNESS_MISSING`
 * rather than reporting a clean zero, so a disabled witness can never be read
 * as "no egress" (the same honesty the UTE lanes use for a missing guard sink).
 *
 * THE COUNTER'S POSITIVE CONTROL. {@link classifyConnectTarget} is the exact
 * function the patched method calls. `NC-NET-COUNTER-POSITIVE` invokes it with
 * `example.com:443` and the counter moves — proving the zero in the golden run
 * is a measurement, not a constant. It opens no socket: the classifier decides,
 * it never connects.
 *
 * WHY `Socket.prototype.connect` AND NOT A FETCH SHIM. HTTP over a loopback
 * fixture reaches the wire through Node's own client stack (undici's connector
 * calls `net.connect`, which constructs a `Socket` and calls this prototype
 * method), so the prototype is the single choke point every in-process socket
 * passes. A `globalThis.fetch` shim would miss it.
 *
 * @module tests/ute-g1-web/lib/net-witness
 */
import net from 'node:net'

/** The typed refusal the patched method raises for a non-loopback destination. */
export const EGRESS_REFUSED = 'EGRESS_REFUSED'

/** The typed error a caller gets when it asks for a witness that was never installed. */
export const NET_WITNESS_MISSING = 'NET_WITNESS_MISSING'

/** The process-wide install state (one patch, refcounted, restored exactly). */
const STATE = {
  installed: 0,
  original: null,
  /** Per-install counters; the ACTIVE install owns them. */
  counters: null,
  /** Every install ever made, for the evidence line (count, never reused). */
  installs: 0,
}

/** Is `host` a loopback destination this process may reach without leaving the machine? */
export function isLoopbackHost(host) {
  if (host === undefined || host === null || host === '') return false
  const value = String(host).toLowerCase().replace(/^\[|\]$/g, '')
  if (value === 'localhost' || value.endsWith('.localhost')) return true
  if (value === '::1' || value === '::ffff:127.0.0.1') return true
  const parts = value.split('.')
  if (parts.length !== 4) return false
  return parts[0] === '127' && parts.every((part) => /^\d{1,3}$/.test(part))
}

/**
 * Normalize the polymorphic `Socket.prototype.connect` arguments to a target.
 *
 * @param {readonly unknown[]} args - the arguments the caller passed.
 * @returns {{kind: 'tcp'|'unix', host: string, port: number|null, label: string}}
 */
export function normalizeConnectTarget(args) {
  const first = args[0]
  if (typeof first === 'string' || first instanceof URL) {
    // A single string (or URL) is a Unix socket path in Node's API; a URL object
    // is not a documented form but is handled defensively as its host/port.
    if (first instanceof URL) {
      return { kind: 'tcp', host: first.hostname, port: Number(first.port || 0), label: `${first.hostname}:${first.port || ''}` }
    }
    return { kind: 'unix', host: '', port: null, label: `unix:${first}` }
  }
  if (typeof first === 'number') {
    const host = typeof args[1] === 'string' ? args[1] : 'localhost'
    return { kind: 'tcp', host, port: first, label: `${host}:${first}` }
  }
  if (first !== null && typeof first === 'object') {
    // undici's connector forwards the option bag through an ARRAY-LIKE wrapper
    // (`{0: {host, port, lookup}, 1: null}`), so the real target sits one level
    // in. Reading only `first.host` would default every undici connect to
    // `localhost:0` — i.e. it would classify an EXTERNAL fetch as loopback and
    // let it through. Unwrap before anything else.
    const inner = first['0']
    if (inner !== null && typeof inner === 'object' && (inner.host !== undefined || inner.port !== undefined)) {
      return normalizeConnectTarget([inner])
    }
    if (typeof first.path === 'string' && first.port === undefined) {
      return { kind: 'unix', host: '', port: null, label: `unix:${first.path}` }
    }
    const host = typeof first.host === 'string' ? first.host : 'localhost'
    const port = typeof first.port === 'number' ? first.port : Number(first.port ?? 0)
    return { kind: 'tcp', host, port, label: `${host}:${port}` }
  }
  return { kind: 'tcp', host: '<unknown>', port: null, label: '<unknown>' }
}

/**
 * THE classification the patched method calls (and the one the positive control
 * invokes directly). A Unix socket is local by construction.
 *
 * @param {{kind: 'tcp'|'unix', host: string, port: number|null, label: string}} target
 * @returns {'loopback'|'external'}
 */
export function classifyConnectTarget(target) {
  if (target.kind === 'unix') return 'loopback'
  return isLoopbackHost(target.host) ? 'loopback' : 'external'
}

/**
 * Install the witness (refcounted). Every install records into its own counter
 * object; the last uninstall restores the prototype method EXACTLY.
 *
 * @returns {object} the live counters for this install (`snapshot()` is what the corpus records).
 */
export function installNetworkWitness() {
  if (STATE.installed === 0) {
    STATE.original = net.Socket.prototype.connect
    net.Socket.prototype.connect = function patchedConnect(...args) {
      const counters = STATE.counters
      const target = normalizeConnectTarget(args)
      const verdict = classifyConnectTarget(target)
      counters.sockets += 1
      counters.targets.push(target.label)
      if (verdict === 'external') {
        counters.external += 1
        counters.externalSamples.push(target.label)
        const error = new Error(
          `${EGRESS_REFUSED}: the UTE-G1 web baseline attempted a non-loopback destination (${target.label}); `
          + 'the witness refused it before the syscall so no packet leaves this process',
        )
        error.code = EGRESS_REFUSED
        // Destroy asynchronously: a synchronous throw would change the caller's
        // contract (Node reports connect failures through `error` events), and
        // the caller must see a socket error, not a different call shape.
        process.nextTick(() => this.destroy(error))
        return this
      }
      counters.loopback += 1
      counters.forwarded += 1
      return STATE.original.apply(this, args)
    }
  }
  STATE.installed += 1
  STATE.installs += 1
  const counters = {
    sockets: 0,
    loopback: 0,
    external: 0,
    /** Connects that reached the REAL `original.connect` (0 for every refusal). */
    forwarded: 0,
    /** Every connect destination, in order (`host:port`), for the isolation proof. */
    targets: [],
    externalSamples: [],
    installId: STATE.installs,
    snapshot() {
      return Object.freeze({
        installId: counters.installId,
        sockets: counters.sockets,
        loopback: counters.loopback,
        external: counters.external,
        forwarded: counters.forwarded,
        targets: Object.freeze([...counters.targets]),
        externalSamples: Object.freeze([...counters.externalSamples]),
      })
    },
  }
  STATE.counters = counters
  return counters
}

/**
 * Uninstall one install. The prototype is restored only when the last install
 * goes, and only if the prototype still carries OUR patch (a second patch from
 * elsewhere is left alone rather than silently clobbered).
 */
export function uninstallNetworkWitness() {
  if (STATE.installed === 0) return
  STATE.installed -= 1
  if (STATE.installed > 0) return
  if (typeof STATE.original === 'function') net.Socket.prototype.connect = STATE.original
  STATE.original = null
  STATE.counters = null
}

/** Whether the witness is currently installed in this process. */
export function networkWitnessInstalled() {
  return STATE.installed > 0
}

/**
 * Read a witness snapshot, or REFUSE with the typed `NET_WITNESS_MISSING`.
 *
 * @param {object|undefined} counters - the handle `installNetworkWitness` answered.
 * @returns {Readonly<object>} the counters.
 */
export function networkWitnessOf(counters) {
  if (counters === undefined || counters === null || typeof counters.snapshot !== 'function') {
    const error = new Error(
      `${NET_WITNESS_MISSING}: no outbound-socket witness was installed for this world, so "zero external sockets" `
      + 'is unmeasured rather than true; refusing to report a clean zero from an absent instrument',
    )
    error.code = NET_WITNESS_MISSING
    throw error
  }
  return counters.snapshot()
}
