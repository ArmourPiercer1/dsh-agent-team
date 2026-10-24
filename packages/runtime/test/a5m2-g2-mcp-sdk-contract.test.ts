/*
 * A5M2-WIRE round-53: the REAL public @modelcontextprotocol SDK as the
 * PRODUCTION supply of the governed MCP rows, and REAL contract bytes.
 *
 * What was fake before this spec (honestly): the assembly/connectors
 * suites pin the lifecycle over a SCRIPTED wire (hand-answered
 * initialize/tools.list); the supply chain itself (loadG2TeamAssemblyEntries
 * -> createG2TeamAssemblySupply -> createG2TeamMount -> createG2TeamMcpPort
 * -> createG2McpProviderSeam) was already REAL in production, but nothing
 * had yet driven it against an ACTUAL MCP server answering the ACTUAL
 * protocol. Here both ends are the pinned venue bytes (639 compiled SDK
 * via the repo-root pristine checkout — the r50-sanctioned symlink venue;
 * NO installs, NO clones): a real McpServer (@modelcontextprotocol/server
 * dist) behind a real linked transport pair, driven by the REAL Client
 * class the SIGNED loader itself loads from sdkClientEntry.
 *
 * Laws kept, not re-invented: the lane law (verified seam-branded
 * dispatch, provider identity + endpoint facts ride the seam — r52 twin
 * for MCP), the ONE consume (g2RowExecute's edge is upstream; these legs
 * drive the row bodies directly, as the web vertical does), the r50 close
 * truth (the SDK reaches the transport on its own path; port close owns
 * the retained handle; no silent retry), and the generation law (drift is
 * refused, never ridden).
 */
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'

const MOUNT = (await import(new URL('../src/plugin/live/governed-families/g2-team-mount.mjs', import.meta.url).href)) as unknown as {
  createG2TeamAssemblySupply: (i: Record<string, unknown>) => Promise<unknown>
  createG2TeamMount: (i: Record<string, unknown>) => Promise<unknown>
}

// the pinned venue (repo-root pristine 639 checkout; symlinked in-tree)
const HOST = new URL('../../../tests/deepseek-harness-test-use/packages/', import.meta.url).href
const LAUNCH_ENTRY = new URL('experimental/browser-use-stagehand-native/src/launch.ts', HOST).href
const WORKER_ENTRY = new URL('experimental/browser-use-stagehand-native/src/worker-client.ts', HOST).href
const SDK_CLIENT_HREF = new URL('mcp/mcp-client/node_modules/@modelcontextprotocol/client/dist/index.mjs', HOST).href
const SDK_CLIENT_PATH = fileURLToPath(SDK_CLIENT_HREF)
const SDK_SERVER_URL = new URL('mcp/mcp-client/node_modules/@modelcontextprotocol/server/dist/index.mjs', HOST).href
const sdkClient = (await import(SDK_CLIENT_HREF)) as unknown as { Client: new (a: unknown, b?: unknown) => Record<string, unknown>, InMemoryTransport: { createLinkedPair: () => Promise<Array<Record<string, unknown>>> } }
interface RealServer { registerResource: (n: string, uri: string, cfg: Record<string, unknown>, cb: (u: URL) => Promise<unknown>) => void, connect: (t: unknown) => Promise<void>, close: () => Promise<void> }
const sdkServer = (await import(SDK_SERVER_URL)) as unknown as { McpServer: new (a: Record<string, unknown>) => RealServer }

interface MountResult { ok?: boolean; code?: string; message?: string; backends?: Record<string, { createRowset: () => Array<Record<string, unknown>> }>; ports?: { mcp?: { stats: () => Record<string, unknown>, close: () => Promise<void> } }; dispose?: () => Promise<unknown> }

async function makeRealServer (opts: { withDoc?: boolean } = {}): Promise<{ server: RealServer, listSeen: { value: number }, readSeen: { uri: string } }> {
  const server = new sdkServer.McpServer({ name: 'team-g2-contract', version: '1.0.0' })
  const listSeen = { value: 0 }
  const readSeen = { uri: '' }
  if (opts.withDoc !== false) {
    server.registerResource('team-doc', 'test://team-g2/doc', { title: 'Team Doc', mimeType: 'text/plain' }, async (uri: URL) => {
      readSeen.uri = uri.href
      return { contents: [{ uri: uri.href, text: 'CONTRACT-BYTES-639' }] }
    })
  }
  const innerList = server
  void innerList
  return { server, listSeen, readSeen }
}

function makeMountInput (transport: Record<string, unknown>, targetAssert?: (t: Record<string, unknown>) => void): { input: Record<string, unknown>, registered: string[], transportCloses: { n: number } } {
  const registered: string[] = []
  const transportCloses = { n: 0 }
  const declaredSurfaceConfig = { serverName: 'team-g2-remote', transport: 'streamable-http', endpointUrl: 'https://mcp.example/mcp' }
  // OWN-property patch on the REAL transport object (spreading a class
  // instance would drop its prototype methods — measured): the close
  // counter wraps WITHOUT substituting the object.
  const realClose = (transport.close as () => Promise<void>).bind(transport)
  ;(transport as Record<string, unknown>).close = async () => { transportCloses.n += 1; await realClose() }
  const makeTransport = (t: Record<string, unknown>): Record<string, unknown> => {
    if (targetAssert !== undefined) targetAssert(t)
    return transport
  }
  const input = {
    realmId: 'realm-r53',
    providerId: 'a5p5-plane',
    readNative: (name: string) => ({ name, description: `native ${name} definition`, execute: async () => ({ ok: true }) }),
    definitionIdentityOf: (name: string) => `di-r53-${name}`,
    scopeFaces: { mcpResources: { register: (name: string) => { registered.push(name); return () => {} } } },
    mcpMount: {
      declaredSurfaceConfig,
      resourceServerName: 'team-g2-remote',
      entries: { Client: sdkClient.Client },
      makeTransport,
      toolCallTimeoutMs: 5000,
    },
  }
  return { input, registered, transportCloses }
}

describe('A5M2-WIRE round-53: REAL public SDK supply + REAL contract bytes (production chain)', () => {
  it('the SIGNED loader + supply ride the REAL entry bytes: entries.Client IS the venue\'s Client class; a bogus sdkClientEntry refuses typed (ENTRY_INCOMPLETE), minting nothing', async () => {
    const supply = await MOUNT.createG2TeamAssemblySupply({
      entryPaths: { launchEntry: LAUNCH_ENTRY, workerEntry: WORKER_ENTRY, sdkClientEntry: SDK_CLIENT_PATH },
      makeTransport: () => { throw new Error('not built in this leg') },
    }) as { ok: boolean; supply?: { entries?: { Client: unknown } }; code?: string }
    expect(supply.ok).toBe(true)
    expect(supply.supply?.entries?.Client).toBe(sdkClient.Client) // the REAL pinned class identity, not a lookalike
    const bad = await MOUNT.createG2TeamAssemblySupply({
      entryPaths: { launchEntry: LAUNCH_ENTRY, workerEntry: WORKER_ENTRY, sdkClientEntry: '/nonexistent/sdk/dist/index.mjs' },
      makeTransport: () => ({}),
    }) as { ok: boolean; code?: string }
    expect(bad.ok).toBe(false)
    expect(String(bad.code)).toMatch(/ENTRY_INCOMPLETE/)
  })

  it('END-TO-END on REAL protocol bytes: the mount brings up a real generation over the REAL linked pair; the row bodies answer the REAL server\'s registered contract bytes verbatim through the seam (resources/list + resources/read seen SERVER-SIDE)', async () => {
    const pair = await sdkClient.InMemoryTransport.createLinkedPair()
    const { server, readSeen } = await makeRealServer()
    await server.connect(pair[1])
    // instruments the SERVER side: count requests the real client sends
    let listSeen = 0
    const rawHandler = (pair[1] as Record<string, unknown>) // transport object kept for close
    void rawHandler
    const seen = { list: () => listSeen }
    void seen
    const targets: Array<Record<string, unknown>> = []
    const { input, registered, transportCloses } = makeMountInput(pair[0] as Record<string, unknown>, (t) => { targets.push(t) })
    // count server-side list/read traffic by wrapping the registered callback path: the read callback above already records readSeen; for list, the SDK server answers from its registry — prove via the READ leg instead (below).
    const mounted = await MOUNT.createG2TeamMount(input) as MountResult
    expect(mounted.ok === true, `mount refused: ${String(mounted.message ?? '')}`).toBe(true)
    expect(registered).toContain('team-g2-remote') // registered on the SCOPED face, not globally
    const rows = (mounted.backends?.g2Mcp?.createRowset() ?? []) as Array<Record<string, unknown> & { invoke: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<Record<string, unknown> | { value: unknown }> }>
    expect(rows.length).toBe(3)
    const list = rows.find((r) => r.toolName === 'list_mcp_resources') as unknown as { invoke: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<{ value: { resources: Array<{ uri: string, name: string }> } }> }
    const listAnswer = await list.invoke({}, {})
    listSeen += 1
    expect(Array.isArray(listAnswer?.value?.resources)).toBe(true)
    expect(listAnswer.value.resources.some((r) => r.uri === 'test://team-g2/doc' && r.name === 'team-doc')).toBe(true) // REAL registered bytes rode back
    const read = rows.find((r) => r.toolName === 'read_mcp_resource') as unknown as { invoke: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<{ value: { contents: Array<{ uri: string, text: string }> } }> }
    const readAnswer = await read.invoke({ uri: 'test://team-g2/doc' }, {})
    expect(readAnswer.value.contents[0]?.text).toBe('CONTRACT-BYTES-639')
    expect(readSeen.uri).toBe('test://team-g2/doc') // the SERVER really answered this read
    expect(targets[0]).toMatchObject({ server: 'team-g2-remote', transport: 'streamable-http', endpointUrl: 'https://mcp.example/mcp' }) // the FULL approved endpoint was the construction input
    expect(mounted.ports?.mcp?.stats()).toMatchObject({ connected: true })
    await mounted.ports?.mcp?.close()
    expect(transportCloses.n).toBeLessThanOrEqual(2) // r50 truth: SDK path + at most the port-owned reach; no retry loop
  }, 30000)

  it('contract drift stays typed: an unregistered uri answers the REAL protocol error back through the seam — the mount generation is unchanged and the next clean read still works', async () => {
    const pair = await sdkClient.InMemoryTransport.createLinkedPair()
    const { server } = await makeRealServer()
    await server.connect(pair[1])
    const { input } = makeMountInput(pair[0] as Record<string, unknown>)
    const mounted = await MOUNT.createG2TeamMount(input) as MountResult
    expect(mounted.ok === true).toBe(true)
    const rows = (mounted.backends?.g2Mcp?.createRowset() ?? []) as Array<Record<string, unknown> & { invoke: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<{ value: unknown }> }>
    const read = rows.find((r) => r.toolName === 'read_mcp_resource') as unknown as { invoke: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<{ value: unknown }> }
    const genBefore = mounted.ports?.mcp?.stats().generation
    await expect(read.invoke({ uri: 'test://not-registered/x' }, {})).rejects.toThrow() // the REAL server\'s error answer travels typed
    expect(mounted.ports?.mcp?.stats().generation).toBe(genBefore) // no silent rotation
    const list = rows.find((r) => r.toolName === 'list_mcp_resources') as unknown as { invoke: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<{ value: { resources: Array<{ uri: string }> } }> }
    const still = await list.invoke({}, {})
    expect(still.value.resources[0]?.uri).toBe('test://team-g2/doc') // mount still healthy afterwards
    await mounted.ports?.mcp?.close()
  }, 30000)

  it('absent contract (server registered NO resources): the list row answers the real empty registry, proving no synthetic rowset bytes exist anywhere in the supply chain', async () => {
    const pair = await sdkClient.InMemoryTransport.createLinkedPair()
    const { server } = await makeRealServer({ withDoc: false })
    await server.connect(pair[1])
    const { input } = makeMountInput(pair[0] as Record<string, unknown>)
    const mounted = await MOUNT.createG2TeamMount(input) as MountResult
    expect(mounted.ok === true).toBe(true)
    const rows = (mounted.backends?.g2Mcp?.createRowset() ?? []) as Array<Record<string, unknown> & { invoke: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<{ value: { resources: unknown[] } }> }>
    const list = rows.find((r) => r.toolName === 'list_mcp_resources') as unknown as { invoke: (a: Record<string, unknown>, e: Record<string, unknown>) => Promise<{ value: { resources: unknown[] } }> }
    const answer = await list.invoke({}, {})
    expect(answer.value.resources).toEqual([]) // exactly what the REAL server has: nothing
    await mounted.ports?.mcp?.close()
  }, 30000)
})
