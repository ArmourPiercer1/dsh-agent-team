/**
 * center-shadow-row.mjs — the U6 PR1 center-assembly SHADOW row (inert).
 * FIX-K (2026-10-26) adds the two row-side laws the audit named: K5 the
 * BOUNDED ledger (below), and K4 the scopeKey carried into every verdict.
 *
 * WHAT THIS IS: the single row the production glue
 * (`agent-bindings.mjs`, config `teamToolPlane.centerAssembly === 'shadow'`)
 * mounts, and the same row the U6 C2 shadow-parity suite mounts on the real
 * Host through the TestWorldFactory's public profile-patch seam. It composes
 * the governance-center lane (Registry + Kernel + HostSurfaceAdapter over
 * INJECTED ports) and installs ONE prepended `tools/execute` observer.
 *
 * THE INERT LAW (U6-SLICE-PLAN PR1; sup-a §5 conditions 1/3/7/10, shadow
 * form):
 *   - the kernel computes its verdict for every governed-scope call and the
 *     row writes that verdict to an AUDIT-ONLY ledger (JSONL, `ledgerPath`,
 *     plus the caller's `observe` channel);
 *   - the listener ALWAYS takes `next()` — it never returns a value in place
 *     of the native chain, never touches `exec` (not even `exec.signal`),
 *     never throws into the waterfall (every internal failure is a
 *     `shadow-error` ledger row and then `next()`);
 *   - nothing in this row holds or mints authority: no `approval/request`
 *     install, no grant consume, no admission call. The kernel's approval
 *     table exists (condition 1, inert) but is fed NOTHING in PR1, so every
 *     verdict is a documented `defer`/`not-active` observation — the audit
 *     trail of "the center saw this call and deliberately took next()".
 *
 * LEDGER: `ledgerPath` — the CALLER supplies the audit destination (the
 * production glue from its config surface; the C2 harness from its own env
 * convention, per the live-row law that product rows receive everything from
 * their assembly point and read no environment of their own). Absent = audit
 * goes to the `observe` channel only.
 *
 * BOUNDED LEDGER (FIX-K K5): an unbounded append channel is a disk-growth
 * bug with the process-lifetime as its only release. The per-install ledger
 * writer therefore carries a ROW budget and a BYTE budget
 * (`maxLedgerRows`/`maxLedgerBytes`, defaults below; budgets bound the TOTAL
 * file lines INCLUDING the terminal marker). At the first write that does
 * not fit, the writer appends ONE terminal marker row
 * (`leg: 'shadow-ledger-capped'`, carrying the budgets and the written
 * counts) and stops appending to the file. Capping is an AUDIT-channel
 * event, never a flow event: the `observe` sink keeps receiving every row
 * (its bound belongs to the caller), and the waterfall keeps taking `next()`
 * exactly as before. `dispose()` CLOSES the writer — after it, nothing
 * appends any more; the state lives in this install's closure, so one
 * agent scope's churn can never grow anything module-wide.
 *
 * IMPORT FACE: the lane barrel is imported as
 * `../../../governance-center/index.js` — the tsc-emitted file in the dist
 * mirror (the shipped face); under vitest the sibling TypeScript source
 * resolves through the test resolver. This file is byte-placed into the dist
 * mirror by `scripts/place-dist-glue.mjs`.
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/** K5 default budgets — generous for a real session's audit trail, finite,
 *  and overridable per install by the trusted caller. */
const DEFAULT_MAX_LEDGER_ROWS = 5000
const DEFAULT_MAX_LEDGER_BYTES = 1024 * 1024 // 1 MiB

/**
 * One bounded JSONL writer (FIX-K K5). `write(row)` returns whether the row
 * reached the FILE; it never throws. The terminal marker is written at most
 * once and is itself exempt from the byte check it reports.
 */
function createLedgerWriter({ ledgerPath, maxRows, maxBytes }) {
  const ledger = typeof ledgerPath === 'string' && ledgerPath.length > 0 ? ledgerPath : ''
  let rows = 0
  let bytes = 0
  let capped = false
  let closed = false
  const write = (row) => {
    if (ledger === '' || closed) return false
    let line
    try {
      line = `${JSON.stringify(row)}\n`
    } catch {
      return false // an unserializable row is a lost observation, never a throw
    }
    const roomForNextLine = rows + 1 < maxRows // one line stays reserved for the marker
    if (!capped && !(roomForNextLine && bytes + line.length <= maxBytes)) {
      // stop-with-marker: the cap is itself an audited event
      capped = true
      const marker = JSON.stringify({
        at: row?.at,
        scope: row?.scope,
        leg: 'shadow-ledger-capped',
        cappedReason: rows + 1 >= maxRows ? 'rows' : 'bytes',
        maxLedgerRows: maxRows,
        maxLedgerBytes: maxBytes,
        ledgerRowsWritten: rows,
        ledgerBytesWritten: bytes,
      })
      try {
        mkdirSync(dirname(ledger), { recursive: true })
        appendFileSync(ledger, `${marker}\n`)
        rows += 1
        bytes += marker.length + 1
      } catch {
        // a dead audit channel loses evidence and must NEVER change the flow
      }
      return false
    }
    if (capped) return false
    try {
      mkdirSync(dirname(ledger), { recursive: true })
      appendFileSync(ledger, line)
      rows += 1
      bytes += line.length
      return true
    } catch {
      // A dead audit channel loses evidence and must NEVER change the flow:
      // the observe channel is the surviving witness.
      return false
    }
  }
  return {
    write,
    close: () => {
      closed = true
    },
    stats: () => ({ rows, bytes, capped, closed }),
  }
}

/**
 * The proven identity law, injected (same algebra as tool-dispatch's
 * `definitionIdentityOf`: WeakMap over the resolved object, no stringify, no
 * clock). PR1 owns a local minter because the shadow must not import the
 * center file it will later replace; the REBIND to the shared minter is part
 * of the PR2 wiring.
 */
function createIdentityMinter() {
  const minted = new WeakMap()
  let counter = 0
  return (target) => {
    if (target === null || (typeof target !== 'object' && typeof target !== 'function')) return null
    const seen = minted.get(target)
    if (seen !== undefined) return seen
    counter += 1
    const mint = `gc-def#${String(counter)}`
    minted.set(target, mint)
    return mint
  }
}

/**
 * Install one shadow assembly for one agent scope.
 *
 * @param {object} deps
 * @param {object} deps.agentCtx - the agent-scoped plugin context (public
 *   seams: `on`, `tools.get`, optional `tools.schemas`).
 * @param {string} deps.scopeKey - audit provenance (`teamRoot:instanceId`);
 *   since FIX-K K4 it is ALSO the scope the kernel keys its verdict on
 *   (Carrying it into `kernel.decide` is what makes a scope-B call unable
 *   to inherit a scope-A approval even in shadow accounting).
 * @param {string} [deps.ledgerPath] - JSONL audit ledger, supplied by the
 *   trusted caller (absent = `observe` channel only).
 * @param {(row: object) => void} [deps.observe] - the caller's observation
 *   sink (production glue routes this into its observations channel).
 * @param {number} [deps.maxLedgerRows] - K5 row budget (default 5000).
 * @param {number} [deps.maxLedgerBytes] - K5 byte budget (default 1 MiB).
 * @returns {Promise<{ installed: true, disposers: (() => void)[], registry: object, kernel: object, adapter: object }>}
 */
export async function installCenterShadowRow({ agentCtx, scopeKey, ledgerPath, observe, maxLedgerRows, maxLedgerBytes }) {
  const lane = await import('../../../governance-center/index.js')
  const sink = typeof observe === 'function' ? observe : () => undefined
  const scoped = typeof scopeKey === 'string' && scopeKey.length > 0 ? scopeKey : ''
  const ledger = createLedgerWriter({
    ledgerPath,
    maxRows: typeof maxLedgerRows === 'number' && maxLedgerRows > 0 ? Math.floor(maxLedgerRows) : DEFAULT_MAX_LEDGER_ROWS,
    maxBytes: typeof maxLedgerBytes === 'number' && maxLedgerBytes > 0 ? Math.floor(maxLedgerBytes) : DEFAULT_MAX_LEDGER_BYTES,
  })
  const record = (row) => {
    const stamped = { at: new Date().toISOString(), scope: scoped || 'n/a', ...row }
    // K4 ride-along: the file AND the sink see the scoped resolution the
    // verdict was keyed on, so the audit trail is self-describing.
    ledger.write(stamped)
    try {
      sink(stamped)
    } catch {
      // an observation sink that throws never runs over the call flow
    }
  }

  const { registry, kernel, adapter } = lane.createCenterAssembly({
    // PR1 publishes NO capabilities: every contribution must declare an
    // empty required set, and the registry stands empty in shadow anyway.
    kernelManifest: { capabilities: {} },
    tools: agentCtx?.tools,
    on: typeof agentCtx?.on === 'function' ? (event, listener) => agentCtx.on(event, listener) : undefined,
    identityOf: createIdentityMinter(),
  })
  const published = kernel.publish()
  record({ leg: 'shadow-installed', published: published.ok === true, state: kernel.state(), generation: registry.generation() })

  const disposers = []
  const sub = agentCtx?.on?.('tools/execute', async (exec, next) => {
    // THE INERT BODY: decide (purely), record (audit-only), ALWAYS next().
    try {
      const name = String(exec?.name ?? '')
      const read = adapter.readDefinition(name, exec?.agent)
      const verdict = kernel.decide({
        nativeName: name,
        // FIX-K K4: the scope this scoped resolution belongs to. Absent ⇒
        // the kernel records SCOPE_UNVERIFIED (shadow still takes next()).
        ...(scoped === '' ? {} : { scopeKey: scoped }),
        ...(read.ok === true ? { definitionIdentity: read.identity } : {}),
      })
      record({
        leg: 'shadow-verdict',
        name,
        scopeKey: scoped || null,
        callId: String(exec?.callId ?? ''),
        outcome: verdict.outcome,
        code: verdict.code,
        generation: verdict.generation,
        identityReadable: read.ok === true,
      })
    } catch (error) {
      record({ leg: 'shadow-error', detail: String(error?.message ?? error).slice(0, 200) })
    }
    // Always next(); return its value UNTOUCHED (condition 10: the success
    // shape belongs to the native chain, never to the shadow).
    return next()
  })
  if (typeof sub === 'function') disposers.push(() => sub())

  disposers.push(() => {
    // The audit close row rides the SAME bounded writer (a capped ledger
    // stays capped — that is the point); then the writer is CLOSED (K5
    // release): after dispose nothing appends to the file any more, and the
    // counters live only in this install's closure.
    record({ leg: 'shadow-disposed', state: kernel.state(), ledger: ledger.stats() })
    ledger.close()
  })

  return { installed: true, disposers, registry, kernel, adapter }
}
