/**
 * p8t4-server.ts — the P8-T4 fake server: a mutable in-memory TeamState
 * backing the REAL frozen P8-T3 dispatcher, exposed as a
 * `RemotePushTransport`.
 *
 * Mock-first (ruling R28): the remote layer under test is REAL —
 * `createRemoteDispatcher` over the twelve structural ports (reused from
 * `p8t3-helpers`, with a mutable `projection` port and a mutable
 * `ledger` port). Only the durable TeamState behind the ports is
 * simulated, plus the seam channel itself (`lose` / `restore`, scripted
 * delayed responses).
 *
 * The channel discipline matches the frozen contract: RPC-level outcomes
 * are typed `RemoteResponse` values that never reject; a channel loss
 * rejects with the `PushTransportLossError` sentinel (the only rejection
 * kind the engine may see).
 *
 * Erasable TS only; no `node:` builtins; relative `.js` imports.
 * @module p8t4-server
 */

import {
  createRemoteDispatcher,
  PushTransportLossError,
} from '../src/index.js'
import type {
  RemoteHandlerDeps,
  RemoteResponse,
  RemoteSafeRecord,
  SeamClientRequest,
  SeamServerResponse,
} from '../src/index.js'
import { P8T3_TEAM_SESSION_ID, makeFakePorts } from './p8t3-helpers.js'

/** The stable root id the mutable ledger entries carry. */
const P8T4_ROOT_SESSION_ID = P8T3_TEAM_SESSION_ID

/**
 * Build the mutable whole-projection DTO (the nine frozen top-level
 * fields of `RemoteProjectionValue`), regenerated on every
 * `setGeneration` call so that a changed generation always ships with a
 * changed `generatedAt`.
 */
function p8t4Projection(teamSessionId: string, generation: number): RemoteSafeRecord {
  return {
    schemaVersion: 1,
    teamSessionId,
    blueprint: { blueprintId: 'bp-1', revision: 2 },
    generation,
    generatedAt: `2026-08-29T00:00:${String(generation).padStart(2, '0')}.000Z`,
    root: { rootSessionId: teamSessionId },
    templates: [{ templateId: 'tpl-1' }],
    members: [{ instanceId: 'inst-1', templateId: 'tpl-1', childSessionId: 'child-1' }],
    ledger: {
      latestSequence: 0,
      totalEntries: 0,
      byCategory: {},
      pendingControlCount: 0,
    },
  }
}

/** One mutable durable ledger fact row (the storage `LedgerEntry` shape). */
function p8t4LedgerEntry(sequence: number, factType: string): RemoteSafeRecord {
  return {
    schemaVersion: 1,
    sequence,
    rootSessionId: P8T4_ROOT_SESSION_ID,
    factType,
    payload: { factType, sequence },
    operationId: `op-${sequence}`,
    createdAt: `2026-08-29T01:00:${String(sequence).padStart(2, '0')}.000Z`,
  }
}

/** The options of the fake server. */
export interface P8T4FakeServerOptions {
  /** The initial whole-projection generation (default 1). */
  readonly startGeneration?: number
  /** The initial ledger entry count (default 0). */
  readonly initialLedger?: number
  /** Optional port replacements (on top of the mutable projection/ledger). */
  readonly ports?: Partial<RemoteHandlerDeps>
}

/** The fake server surface. */
export interface P8T4FakeServer {
  /** Send one seam request (the `RemotePushTransport` binding). */
  send(request: SeamClientRequest): Promise<SeamServerResponse>
  /** Sever the seam channel (subsequent sends reject with the loss sentinel). */
  lose(): void
  /** Restore the seam channel. */
  restore(): void
  /** Whether the seam channel is currently down. */
  readonly down: () => boolean
  /** Advance the whole-projection truth to `generation`. */
  setGeneration(generation: number): void
  /** The current whole-projection generation. */
  getGeneration(): number
  /** Append one durable ledger fact; returns its sequence. */
  appendLedgerEntry(factType?: string): number
  /** The durable ledger entries (ascending by sequence). */
  ledgerEntries(): readonly RemoteSafeRecord[]
  /** The current whole-projection DTO (the port's backing truth). */
  projection(): RemoteSafeRecord
  /** Every seam request received, in order. */
  readonly requests: readonly SeamClientRequest[]
  /**
   * Script the next response for `method`: the next request on that
   * method returns `response` instead of reaching the dispatcher (a
   * delayed / stale / duplicated in-flight response).
   */
  scriptNext(method: string, response: RemoteResponse): void
  /** The number of still-pending scripted responses for `method`. */
  pendingScripts(method: string): number
}

/**
 * Create the fake server over the real frozen dispatcher.
 * @param options - the server options (see interface).
 * @returns the fake server.
 */
export function createP8T4FakeServer(options: P8T4FakeServerOptions = {}): P8T4FakeServer {
  let generation = options.startGeneration ?? 1
  const ledger: RemoteSafeRecord[] = []
  const ledgerFactTypes = ['team-created', 'member-created', 'fact']
  for (let i = 1; i <= (options.initialLedger ?? 0); i += 1) {
    ledger.push(p8t4LedgerEntry(i, ledgerFactTypes[(i - 1) % ledgerFactTypes.length] ?? 'fact'))
  }

  const mutableProjectionPort = {
    project(teamSessionId: string): RemoteSafeRecord {
      const base = p8t4Projection(teamSessionId, generation)
      const lastEntry = ledger.length > 0 ? ledger[ledger.length - 1] : undefined
      const latestSequence = lastEntry !== undefined ? lastEntry['sequence'] ?? 0 : 0
      return {
        ...base,
        ledger: {
          latestSequence,
          totalEntries: ledger.length,
          byCategory: {},
          pendingControlCount: 0,
        },
      }
    },
  }
  const mutableLedgerPort = {
    listEntries(teamSessionId: string): readonly RemoteSafeRecord[] {
      void teamSessionId
      return ledger
    },
    countEntries(teamSessionId: string): number {
      void teamSessionId
      return ledger.length
    },
  }

  const ports = makeFakePorts({
    projection: mutableProjectionPort,
    ledger: mutableLedgerPort,
    ...options.ports,
  })
  const dispatcher = createRemoteDispatcher(ports)

  const requests: SeamClientRequest[] = []
  const scripts = new Map<string, RemoteResponse[]>()
  let down = false

  const send = async (request: SeamClientRequest): Promise<SeamServerResponse> => {
    requests.push(request)
    if (down) {
      throw new PushTransportLossError()
    }
    const queue = scripts.get(request.method)
    if (queue !== undefined && queue.length > 0) {
      const scripted = queue.shift()
      if (scripted !== undefined) {
        return { rpcId: request.rpcId, result: scripted }
      }
      scripts.delete(request.method)
    }
    const result = await dispatcher(request.method, request.payload)
    return { rpcId: request.rpcId, result }
  }

  const lose = (): void => {
    down = true
  }
  const restore = (): void => {
    down = false
  }

  const setGeneration = (next: number): void => {
    if (!Number.isInteger(next) || next < 1) {
      throw new Error(`p8t4 fake server: generation must be a positive integer: ${next}`)
    }
    generation = next
  }
  const getGeneration = (): number => generation
  const appendLedgerEntry = (factType = 'fact'): number => {
    const sequence = ledger.length + 1
    ledger.push(p8t4LedgerEntry(sequence, factType))
    return sequence
  }
  const ledgerEntries = (): readonly RemoteSafeRecord[] => [...ledger]
  const projection = (): RemoteSafeRecord => mutableProjectionPort.project(P8T4_ROOT_SESSION_ID)
  const scriptNext = (method: string, response: RemoteResponse): void => {
    const queue = scripts.get(method) ?? []
    queue.push(response)
    scripts.set(method, queue)
  }
  const pendingScripts = (method: string): number => scripts.get(method)?.length ?? 0

  return {
    send,
    lose,
    restore,
    down: () => down,
    setGeneration,
    getGeneration,
    appendLedgerEntry,
    ledgerEntries,
    projection,
    requests,
    scriptNext,
    pendingScripts,
  }
}
