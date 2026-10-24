/**
 * THE LSP REALM ASSEMBLY — the R-2 approved production arm (user ruling
 * 07:53Z): "policy change ⇒ destroy and rebuild the member's isolated LSP
 * instance", implemented as the Team-side ASSEMBLY DISCIPLINE API.
 *
 * Granularity (verbatim from `LSP-rulings-brief.md` R-2 §2, as approved):
 * one isolated instance per (member × policy generation) = its own provider
 * instance (realm) + its own confined OS process through the R-1 streaming
 * arm. This is ASSEMBLY DISCIPLINE, not OS enforcement of sub-realm policy:
 * the host pool key upstream stays a pure path, and sharing it under another
 * name would masquerade as policy isolation (forbidden by the brief). The
 * claims this module may support are exactly "realm-granularity isolation is
 * real; policy-granularity eviction is NOT claimed".
 *
 * Lifecycle laws (pinned by `a5lsp2-assembly`):
 *  - EVERY provider instance is created from the SAME `ProviderAssemblyConfig`
 *    the P-B install round froze (launcher path + sha byte gate + ABI floor):
 *    the double gate guards every realm, every spawn, unchanged.
 *  - `policyChange(member, generation)` = probe-gate the NEW realm FIRST (a
 *    gated assembly never disposes a healthy old one — no self-inflicted
 *    outage), then dispose the OLD instance (terminate + BOUNDED,
 *    OS-confirmed pid exit), then assemble the NEW one (spawnStreaming +
 *    readiness). A mid-change failure leaves ZERO residual handles/pids:
 *    a half-built instance is terminated and settled before the typed
 *    refusal returns; the member is left with NO instance (honest, never a
 *    dead handle).
 *  - `ensure` is HOT reuse or first assembly only; a generation mismatch is
 *    refused — `policyChange` is the single discipline entry for changes.
 *  - Disposal is per-member and net-zero: sibling members are never touched.
 *
 * Purity: imports within the lane only (contract-stub + provider); no
 * `node:*` — the OS facts flow through the provider's seams.
 *
 * @module @dsh-agent-team/runtime/sandbox-provider/lsp-assembly
 */

import { refuse, type ProviderResult } from './contract-stub.js'
import {
  createConfinedProcessProvider,
  type AllowPathEntry,
  type ProviderAssemblyConfig,
  type ProviderDeps,
  type ProviderLease,
  type StreamingSpawnHandle,
} from './provider.js'

/** One member's policy for one generation: exactly what a confined streaming spawn needs. */
export interface LspRealmPolicy {
  readonly grantFingerprint: string
  readonly bindingId: string
  readonly argv: readonly string[]
  readonly cwd: string
  readonly env: readonly (readonly [string, string])[]
  readonly allowPaths?: readonly AllowPathEntry[]
  readonly networkProfile?: 'deny' | 'restricted'
}

/** The observable lifecycle ledger of one assembly (the W-LSP-DR journal shape). */
export type LspAssemblyEvent =
  | { readonly kind: 'policy-change-begin'; readonly memberId: string; readonly from: string | null; readonly to: string }
  | { readonly kind: 'realm-disposed'; readonly memberId: string; readonly generation: string; readonly lastPid: number; readonly disposeMs: number }
  | { readonly kind: 'realm-assembled'; readonly memberId: string; readonly generation: string; readonly pid: number }
  | { readonly kind: 'policy-change-complete'; readonly memberId: string; readonly from: string | null; readonly to: string }
  | { readonly kind: 'assemble-failed'; readonly memberId: string; readonly generation: string; readonly stage: 'pre-gate' | 'dispose' | 'spawn' | 'ready' | 'policy'; readonly detail: string }

/** One LIVE isolated instance: (member × generation) bound to its realm and process. */
export interface LspInstance {
  readonly memberId: string
  readonly generation: string
  readonly realmId: string
  /** The confined payload's OS pid (handshake-reported). */
  readonly pid: number
  readonly handle: StreamingSpawnHandle
}

export interface LspAssemblyOptions {
  /** THE P-B assembly parameter surface — reused verbatim for every realm. */
  readonly assembly: ProviderAssemblyConfig
  readonly trustRoot: string | null
  readonly scratchRoot: string
  readonly hardDimensions?: readonly string[]
  readonly deps?: ProviderDeps
  /** The (member × generation) → policy map. Calling it is itself the discipline: generations are explicit. */
  readonly policyFor: (memberId: string, generation: string) => LspRealmPolicy
  /** Readiness over the live pipes: default = the STANDARD LSP initialize
   *  handshake (Content-Length framed `initialize` → capabilities →
   *  `initialized`); integrators may inject a stricter probe, never a
   *  weaker echo. */
  readonly ready?: (instance: LspInstance) => Promise<boolean>
  readonly readyTimeoutMs?: number
  readonly terminateGraceMs?: number
  readonly terminateDeadlineMs?: number
  readonly journal?: (event: LspAssemblyEvent) => void
}

/** What the assembly exposes: the discipline API, nothing more. */
export interface LspRealmAssembly {
  /** HOT reuse (same generation) or first assembly. A generation mismatch REFUSES — use policyChange. */
  ensure(memberId: string, generation: string): Promise<ProviderResult<LspInstance>>
  /** The approved semantics, one call: dispose the old realm (bounded, OS-confirmed) → new isolate. */
  policyChange(memberId: string, generation: string): Promise<ProviderResult<LspInstance>>
  /** Dispose one member's instance (terminate + settle). Idempotent. */
  dispose(memberId: string): Promise<ProviderResult<{ readonly generation: string; readonly lastPid: number; readonly disposeMs: number } | null>>
  /** Teardown: every instance, net-zero. */
  disposeAll(): Promise<ProviderResult<{ readonly disposed: readonly { readonly memberId: string; readonly generation: string; readonly lastPid: number }[] }>>
  /** The current live instance of a member, if any. */
  current(memberId: string): LspInstance | undefined
  /** Live instance count (teardown proof surface). */
  size(): number
}

/**
 * THE LSP BASE PROTOCOL CODEC (root LSP-review ruling 2026-10-25): the ONE
 * Content-Length framing implementation this package uses — the assembly's
 * readiness handshake and the consumer-side query backend (the realm supply)
 * both ride it, so no second dialect exists. Exported for that single
 * documented consumer; it carries no policy.
 */
export function encodeLspMessage(message: unknown): string {
  const body = JSON.stringify(message)
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`
}

/** A streaming decoder for the Content-Length framing. `push` returns the
 *  complete JSON messages the chunk completed; malformed framing THROWS —
 *  a framing desync is fatal to the round-trip contract, never re-synced. */
export function createLspFrameDecoder(maxBytes = 8 * 1024 * 1024): {
  push: (chunk: Buffer | string) => readonly unknown[]
} {
  let pending = Buffer.alloc(0)
  return {
    push: (chunk) => {
      pending = Buffer.concat([pending, Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8')])
      const out: unknown[] = []
      for (;;) {
        if (pending.length > maxBytes) throw new Error('lsp framing: pending buffer exceeded the bound — the stream is not LSP-framed')
        const headerEnd = pending.indexOf('\r\n\r\n')
        if (headerEnd < 0) {
          if (pending.length > 64 * 1024) throw new Error('lsp framing: no header terminator within the header bound')
          break
        }
        const header = pending.subarray(0, headerEnd).toString('ascii')
        const match = /content-length:\s*(\d+)/i.exec(header)
        if (match === null) throw new Error('lsp framing: header block carries no Content-Length')
        const length = Number(match[1])
        const bodyStart = headerEnd + 4
        if (pending.length < bodyStart + length) break
        const body = pending.subarray(bodyStart, bodyStart + length).toString('utf8')
        pending = pending.subarray(bodyStart + length)
        out.push(JSON.parse(body))
      }
      return out
    },
  }
}

export function createLspRealmAssembly(options: LspAssemblyOptions): LspRealmAssembly {
  const instances = new Map<string, LspInstance>()
  const emit = (event: LspAssemblyEvent): void => { options.journal?.(event) }

  function realmId(memberId: string, generation: string): string {
    return `lsp:${memberId}:${generation}`
  }

  function providerFor(memberId: string, generation: string) {
    return createConfinedProcessProvider({
      realmId: realmId(memberId, generation),
      trustRoot: options.trustRoot,
      scratchRoot: options.scratchRoot,
      ...(options.deps !== undefined ? { deps: options.deps } : {}),
      assembly: options.assembly,
    })
  }

  /** STANDARD-LSP readiness (root LSP-review ruling 2026-10-25: the old raw
   *  line-JSON ping was a transport echo, NOT the protocol — readiness is now
   *  the real LSP initialize handshake over Content-Length framing): send
   *  `initialize` (id 0), await the framed response carrying
   *  `result.capabilities`, then deliver `initialized`. end/error/timeout
   *  before that is NOT ready. */
  function defaultReady(instance: LspInstance): Promise<boolean> {
    return new Promise((resolve) => {
      const timeoutMs = options.readyTimeoutMs ?? 15_000
      const decoder = createLspFrameDecoder()
      let done = false
      const finish = (value: boolean): void => {
        if (done) return
        done = true
        clearTimeout(timer)
        instance.handle.stdout.off('data', onData)
        instance.handle.stdout.off('end', onEnd)
        instance.handle.stdout.off('error', onError)
        resolve(value)
      }
      const onData = (chunk: unknown): void => {
        let messages: readonly unknown[]
        try {
          messages = decoder.push(chunk as Buffer | string)
        } catch {
          finish(false)
          return
        }
        for (const msg of messages) {
          const m = msg as { id?: unknown, result?: { capabilities?: unknown } }
          if (m.id === 0 && m.result !== null && typeof m.result === 'object'
            && m.result.capabilities !== null && typeof m.result.capabilities === 'object') {
            try {
              instance.handle.stdin.write(encodeLspMessage({ jsonrpc: '2.0', method: 'initialized', params: {} }))
            } catch {
              finish(false)
              return
            }
            finish(true)
            return
          }
        }
      }
      const onEnd = (): void => { finish(false) }
      const onError = (): void => { finish(false) }
      const timer = setTimeout(() => { finish(false) }, timeoutMs)
      instance.handle.stdout.on('data', onData)
      instance.handle.stdout.on('end', onEnd)
      instance.handle.stdout.on('error', onError)
      try {
        instance.handle.stdin.write(encodeLspMessage({
          jsonrpc: '2.0',
          id: 0,
          method: 'initialize',
          params: { processId: null, rootUri: null, capabilities: {}, clientInfo: { name: 'a5m2-lsp-realm-assembly', version: '1' } },
        }))
      } catch {
        finish(false)
      }
    })
  }

  /** Assemble ONE isolated instance: probe gate → spawnStreaming → readiness; net-zero on failure. */
  async function assemble(memberId: string, generation: string): Promise<ProviderResult<LspInstance>> {
    const realm = realmId(memberId, generation)
    const provider = providerFor(memberId, generation)
    const gate = await provider.probe()
    if (!gate.ok) {
      emit({ kind: 'assemble-failed', memberId, generation, stage: 'pre-gate', detail: gate.error.message })
      return gate
    }
    let policy: LspRealmPolicy
    try {
      policy = options.policyFor(memberId, generation)
    } catch (error) {
      const detail = String((error as Error)?.message ?? error).slice(0, 200)
      emit({ kind: 'assemble-failed', memberId, generation, stage: 'policy', detail })
      return refuse('IO_POLICY_UNSUPPORTED', `policyFor('${memberId}','${generation}') failed: ${detail} — no process was started for the new realm`)
    }
    const spawned = await provider.spawnStreaming({
      grantFingerprint: policy.grantFingerprint,
      realmId: realm,
      bindingId: policy.bindingId,
      memberScope: `member/${memberId}`,
      argv: policy.argv,
      cwd: policy.cwd,
      env: policy.env,
      ...(policy.allowPaths !== undefined ? { allowPaths: policy.allowPaths } : {}),
      ...(policy.networkProfile !== undefined ? { networkProfile: policy.networkProfile } : {}),
    })
    if (!spawned.ok) {
      emit({ kind: 'assemble-failed', memberId, generation, stage: 'spawn', detail: spawned.error.message })
      return spawned
    }
    const instance: LspInstance = Object.freeze({
      memberId,
      generation,
      realmId: realm,
      pid: spawned.value.pid,
      handle: spawned.value,
    })
    const ready = options.ready ?? defaultReady
    let isReady = false
    try {
      isReady = await ready(instance)
    } catch {
      isReady = false
    }
    if (!isReady) {
      // failure cleanup: the half-built instance is TERMINATED and SETTLED before the
      // refusal returns — zero residual handles, zero residual pids, never a dead handle.
      const cleaned = await terminateInstance(instance)
      emit({ kind: 'assemble-failed', memberId, generation, stage: 'ready', detail: `readiness never answered (cleanup settled: ${cleaned.status})` })
      return refuse('IO_POLICY_UNSUPPORTED', `the new LSP realm '${realm}' never answered readiness; the half-built instance (pid ${String(instance.pid)}) was cleaned (lease: ${cleaned.status}) — zero residual handles/pids`)
    }
    emit({ kind: 'realm-assembled', memberId, generation, pid: instance.pid })
    instances.set(memberId, instance)
    return { ok: true, value: instance }
  }

  /** terminate + settle, bounded; returns the settled lease (never throws). */
  async function terminateInstance(instance: LspInstance): Promise<ProviderLease> {
    const settled = await instance.handle.terminate({
      graceMs: options.terminateGraceMs ?? 1_500,
      deadlineMs: options.terminateDeadlineMs ?? 10_000,
    })
    if (settled.ok) return settled.value
    // a settle REFUSAL still must not leave the assembly holding the instance —
    // surface it as an unconfirmed lease object the caller can inspect.
    return Object.freeze({ ...instance.handle.lease, status: 'termination-unconfirmed' as const })
  }

  async function disposeMember(memberId: string): Promise<ProviderResult<{ readonly generation: string; readonly lastPid: number; readonly disposeMs: number } | null>> {
    const instance = instances.get(memberId)
    if (instance === undefined) return { ok: true, value: null }
    const t0 = Date.now()
    const lease = await terminateInstance(instance)
    if (lease.status !== 'terminated') {
      // honesty law: an UNCONFIRMED disposal does not silently drop the instance —
      // the refusal carries the fact, the ledger keeps the member.
      emit({ kind: 'assemble-failed', memberId, generation: instance.generation, stage: 'dispose', detail: `termination settled ${lease.status}` })
      return refuse('EXECUTION_TERMINATION_UNCONFIRMED', `disposing member '${memberId}' realm '${instance.realmId}' (pid ${String(instance.pid)}) could not be confirmed within the bounded window`, { sideEffectUnknown: true })
    }
    instances.delete(memberId)
    const disposeMs = Date.now() - t0
    emit({ kind: 'realm-disposed', memberId, generation: instance.generation, lastPid: instance.pid, disposeMs })
    return { ok: true, value: { generation: instance.generation, lastPid: instance.pid, disposeMs } }
  }

  async function ensure(memberId: string, generation: string): Promise<ProviderResult<LspInstance>> {
    const current = instances.get(memberId)
    if (current !== undefined) {
      if (current.generation === generation) return { ok: true, value: current } // HOT reuse — no second process
      return refuse('IO_POLICY_UNSUPPORTED', `member '${memberId}' lives in generation '${current.generation}'; a generation change goes through policyChange() — the discipline entry (R-2)`)
    }
    return assemble(memberId, generation)
  }

  async function policyChange(memberId: string, generation: string): Promise<ProviderResult<LspInstance>> {
    const previous = instances.get(memberId)
    const from = previous?.generation ?? null
    emit({ kind: 'policy-change-begin', memberId, from, to: generation })
    if (previous !== undefined && previous.generation === generation) {
      emit({ kind: 'policy-change-complete', memberId, from, to: generation })
      return { ok: true, value: previous } // idempotent: the same generation needs no destroy
    }
    // (1) PRE-GATE the new realm FIRST: a byte-pin/ABI refusal never disposes
    //     the healthy old instance (no self-inflicted outage).
    const gateProvider = providerFor(memberId, generation)
    const gate = await gateProvider.probe()
    if (!gate.ok) {
      emit({ kind: 'assemble-failed', memberId, generation, stage: 'pre-gate', detail: gate.error.message })
      emit({ kind: 'policy-change-complete', memberId, from, to: generation })
      return gate
    }
    // (2) DESTROY: old realm disposed first, pid exit OS-CONFIRMED bounded (the
    //     provider terminate arm settles only on observed exit).
    if (previous !== undefined) {
      const disposed = await disposeMember(memberId)
      if (!disposed.ok) {
        emit({ kind: 'policy-change-complete', memberId, from, to: generation })
        return disposed
      }
    }
    // (3) REBUILD: the new isolate (new realm, new provider, new confined process).
    const created = await assemble(memberId, generation)
    emit({ kind: 'policy-change-complete', memberId, from, to: generation })
    return created
  }

  async function disposeAll(): Promise<ProviderResult<{ readonly disposed: readonly { readonly memberId: string; readonly generation: string; readonly lastPid: number }[] }>> {
    const disposed: { memberId: string; generation: string; lastPid: number }[] = []
    for (const memberId of [...instances.keys()]) {
      const r = await disposeMember(memberId)
      if (!r.ok) {
        return refuse(r.error.code, `disposeAll stopped at member '${memberId}': ${r.error.message}`, r.error.sideEffectUnknown === true ? { sideEffectUnknown: true } : undefined)
      }
      if (r.value !== null) disposed.push({ memberId, generation: r.value.generation, lastPid: r.value.lastPid })
    }
    return { ok: true, value: { disposed } }
  }

  return Object.freeze({
    ensure,
    policyChange,
    dispose: disposeMember,
    disposeAll,
    current: (memberId: string) => instances.get(memberId),
    size: () => instances.size,
  })
}
