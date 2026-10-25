/**
 * center-shadow-row.mjs — the U6 PR1 center-assembly SHADOW row (inert).
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
 * IMPORT FACE: the lane barrel is imported as
 * `../../../governance-center/index.js` — the tsc-emitted file in the dist
 * mirror (the shipped face); under vitest the sibling TypeScript source
 * resolves through the test resolver. This file is byte-placed into the dist
 * mirror by `scripts/place-dist-glue.mjs`.
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

function appendLedgerRow(ledgerPath, row) {
  if (typeof ledgerPath !== 'string' || ledgerPath.length === 0) return
  try {
    mkdirSync(dirname(ledgerPath), { recursive: true })
    appendFileSync(ledgerPath, `${JSON.stringify(row)}\n`)
  } catch {
    // A dead audit channel loses evidence and must NEVER change the flow:
    // the observe channel is the surviving witness.
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
 * @param {string} deps.scopeKey - audit provenance (`teamRoot:instanceId`).
 * @param {string} [deps.ledgerPath] - JSONL audit ledger, supplied by the
 *   trusted caller (absent = `observe` channel only).
 * @param {(row: object) => void} [deps.observe] - the caller's observation
 *   sink (production glue routes this into its observations channel).
 * @returns {Promise<{ installed: true, disposers: (() => void)[], registry: object, kernel: object, adapter: object }>}
 */
export async function installCenterShadowRow({ agentCtx, scopeKey, ledgerPath, observe }) {
  const lane = await import('../../../governance-center/index.js')
  const ledger = typeof ledgerPath === 'string' && ledgerPath.length > 0 ? ledgerPath : ''
  const sink = typeof observe === 'function' ? observe : () => undefined
  const record = (row) => {
    const stamped = { at: new Date().toISOString(), scope: String(scopeKey ?? 'n/a'), ...row }
    appendLedgerRow(ledger, stamped)
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
        ...(read.ok === true ? { definitionIdentity: read.identity } : {}),
      })
      record({
        leg: 'shadow-verdict',
        name,
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
    record({ leg: 'shadow-disposed', state: kernel.state() })
  })

  return { installed: true, disposers, registry, kernel, adapter }
}
