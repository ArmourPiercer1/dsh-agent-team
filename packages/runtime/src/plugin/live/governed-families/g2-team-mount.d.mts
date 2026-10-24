/**
 * Adjacent tsc type surface for `packages/runtime/src/plugin/live/governed-
 * families/g2-team-mount.mjs` (A5-M2 G2 TEAM MOUNT + ASSEMBLY SUPPLY, lane
 * feat/a5m2-wire-g2). Minimal, consumed-only (the image.d.mts pattern): it
 * types what the lane tests (a5m2-g2-team-assembly.test.ts,
 * a5m2-g2-wire-c1.test.ts) and the host producer (host.ts via the glueUrl
 * import) actually consume; the RUNTIME LAW lives in the `.mjs` — including
 * the root final-card SINGLE-SOURCE law (the producer-resolved browser pair
 * is THE source; entryPaths is a deployment input consumed AT the producer,
 * provenance recorded, no loader path out-voting it) and the deployment-
 * fact discipline stated at createG2TeamAssemblySupply. Faces pinned to the
 * 639ed01539 host (launchChromium src/launch.ts:24, openBrowserWorker
 * src/worker-client.ts:15, execute worker-client.ts:71). No host .ts is
 * imported; everything structural.
 */

/** The refusal struct EVERY producing call answers instead of throwing
 *  (the module's `refuse`): a named code, a message that carries its own
 *  cleanup disclosure, `ok:false` — never a silent half-supply. */
export interface G2MountRefusal {
  ok: false
  code: string
  message: string
}

/** The answer law every governed row body uses: the {ok,value} struct the
 *  plane's consumption edge reads (ran.value). */
export type G2RowAnswer = { ok: true, value: unknown } | G2MountRefusal

/** Awaited cleanup law of a built mount: every constructed port runs its
 *  REAL close; failures are RETURNED, never swallowed. */
export type G2DisposeResult = { ok: true, failures: [] } | { ok: false, failures: readonly unknown[] }

export interface G2TeamMountInput {
  /** ONE realm under ONE provider identity (both REQUIRED non-empty). */
  realmId?: string
  providerId?: string
  /** the scope tools.get capture seam (REQUIRED): captures the SAME native
   *  faces the plane places; the mount never substitutes its own. */
  readNative?: (name: string) => unknown
  definitionIdentityOf?: (...args: unknown[]) => unknown
  /** per-member scoped faces (the mcpResources registration seam). */
  scopeFaces?: { mcpResources?: { register?: (...args: unknown[]) => unknown, [key: string]: unknown }, [key: string]: unknown }
  /** MCP half: approved surface config + transport factory + SDK entries. */
  mcpMount?: { declaredSurfaceConfig?: unknown, resourceServerName?: unknown, toolCallTimeoutMs?: unknown, entries?: Record<string, unknown>, makeTransport?: (target: Record<string, unknown>) => { start: unknown, send: unknown, close: unknown }, [key: string]: unknown }
  /** Browser half: mode/nativeConfig from the APPROVED config; callResource
   *  (the stagehand method mapping over the PUBLIC execute face) is REQUIRED
   *  at this mount; entries/consumeApproval/launchEnvelope/declaredService-
   *  Facts ride from the supply (SINGLE SOURCE: the producer-resolved pair). */
  browserMount?: { mode?: 'launch' | 'attach', nativeConfig?: Record<string, unknown>, callResource?: (resource: unknown, method: string, args: unknown, signal: AbortSignal) => Promise<unknown>, entries?: { launchChromium?: unknown, openBrowserWorker?: unknown, [key: string]: unknown }, consumeApproval?: unknown, launchEnvelope?: unknown, declaredServiceFacts?: Record<string, unknown>, [key: string]: unknown }
  /** Web half: seam-branded fixed lanes + the per-root center-port reader. */
  webMount?: { lanes?: Record<string, unknown>, resolveWebCenterPorts?: () => unknown, [key: string]: unknown }
  observe?: (event: Record<string, unknown>) => void
}

export interface G2TeamMountOk {
  ok: true
  /** familyId-keyed backend faces the plane injects (g2Mcp/g2Browser/g2Web
   *  — present ONLY for arms actually built). */
  backends: Readonly<Record<string, unknown>>
  /** the constructed ports (close laws belong to them). */
  ports: Readonly<Record<string, unknown>>
  /** the named WEB route gap, verbatim from the SIGNED assembly module —
   *  the plane's WEB injection point stays fail-closed (disclosed, not a
   *  silent absence). */
  webRouteGap: string
  dispose: () => Promise<G2DisposeResult>
}

/** THE governed mount: builds ONLY what the input arms, refuses typed on
 *  every half (each refusal closes what it already built, awaited). */
export declare function createG2TeamMount (input?: G2TeamMountInput): Promise<G2TeamMountOk | G2MountRefusal>

/** Supply producer input: approved config ALONE (see the .mjs header for
 *  which faces are REAL and which stay NAMED pass-through gaps).
 *  `entries` when ARMED is the PRODUCER-RESOLVED browser pair — THE single
 *  source per the root final card (identity-consumed, never re-resolved);
 *  `entriesProvenance` records the ACTUAL source and rides the supply.
 *  `entryPaths` is a deployment input for the un-armed loader world. */
export interface G2AssemblySupplyInput {
  entryPaths?: { launchEntry?: string, workerEntry?: string, sdkClientEntry?: string } | null
  entries?: { launchChromium?: unknown, openBrowserWorker?: unknown, Client?: unknown, [key: string]: unknown } | null
  entriesProvenance?: Record<string, unknown> | null
  mcpResources?: { register?: (...args: unknown[]) => unknown, [key: string]: unknown } | null
  makeTransport?: ((target: Record<string, unknown>) => { start: unknown, send: unknown, close: unknown }) | null
  consumeBrowserApproval?: unknown
  callResource?: unknown
  webFixedLanes?: Record<string, unknown> | null
  webSearchNotReady?: string
  webSearchEndpointOrigin?: string
  webFixedTransport?: Record<string, unknown> | null
  [key: string]: unknown
}

/** The produced supply bag: face pass-throughs present ONLY when real; the
 *  browser trio (browserEntries/consumeBrowserApproval/callResource) is
 *  ALL-OR-NOTHING; entriesProvenance rides ONLY the producer-armed carrier
 *  (a pair armed WITHOUT provenance is recorded AS SUCH — shape is never
 *  trusted as 639 identity). One readable result bag, consumed-only (the
 *  sibling d.mts pattern): the module freezes either `supply` or the named
 *  `code`/`message` refusal — never both. */
export interface G2AssemblySupplyResult {
  ok: boolean
  supply?: Record<string, unknown>
  code?: string
  message?: string
}

/** THE SUPPLY PRODUCER (approved config alone; every face this lane cannot
 *  mint is NAMED, never faked). An armed-but-half browser pair refuses
 *  `G2_BROWSER_SUPPLIER_UNRESOLVED` before anything reaches the lease;
 *  ENTRY_INCOMPLETE applies only when NO resolved pair is in hand. */
export declare function createG2TeamAssemblySupply (input?: G2AssemblySupplyInput): Promise<G2AssemblySupplyResult>

/** RELAY utility (passthrough only — NOT a PA proof, NOT a second grant):
 *  polls the durable ControlService for the walk's same-call consumed
 *  decision, relaying it verbatim until the deadline. Throws TypeError when
 *  getService/rootSessionId are absent. */
export declare function createG2ConsumedRelay (opts?: { getService?: () => unknown, rootSessionId?: string, deadlineMs?: number, pollMs?: number }): (callFacts?: { approvedCallId?: unknown, [key: string]: unknown }) => Promise<string>

/** The stagehand method mapping: binds execute(method, args, signal) on the
 *  LEASE-OWNED resource.value (worker-client.ts:70-71 public face). Throws
 *  on any runtime swap — no fallback. */
export declare function callResourceViaWorkerExecute (resource: { value?: { execute?: (method: string, args: unknown, signal: AbortSignal) => Promise<unknown> } } | null | undefined, method: string, args: unknown, signal: AbortSignal): Promise<unknown>

/** The kernel one-shot consumedProof approval (the walk's REAL final edge
 *  relayed verbatim, verified by PRESENCE of a grantId — the boundary
 *  fact, not a correlation, not a Control-state read). Answers 'consumed'
 *  or 'refused'. */
export declare function createG2ConsumedProofApproval (): (callFacts?: { consumedProof?: { grant?: { grantId?: string } | null, [key: string]: unknown } | null, [key: string]: unknown } | undefined) => Promise<'consumed' | 'refused'>

/** One seam-branded fixed lane: the reviewed seam product (provider +
 *  registration law + stats) rides VERBATIM; the search half additionally
 *  carries the REAL deployment cap (positive integer — absence cannot
 *  cancel the cap) and the DERIVED endpoint origin. */
export type G2WebFixedLane = Readonly<{ provider: unknown, registrationLaw: unknown, stats: unknown, [key: string]: unknown }>

export interface G2WebFixedLanesOk {
  web_fetch: G2WebFixedLane
  web_search?: G2WebFixedLane & { searchMaxResults: number, endpointOrigin?: string }
}

/** Builds the fixed web lanes over the REAL public provider object via the
 *  reviewed seam (createG2WebProviderSeam). Throws G2_SUPPLY_ENTRY_INVALID
 *  on any absence — nothing pins around a missing provider or cap. */
export declare function createG2WebFixedLanes (opts?: { fixedProvider?: { id?: string, [key: string]: unknown }, declared?: Record<string, unknown>, readMountFacts?: () => Record<string, unknown>, observe?: (event: Record<string, unknown>) => void, seamMod?: { createG2WebProviderSeam?: (input: Record<string, unknown>) => Record<string, unknown> }, search?: { fixedSearchProvider?: { id?: string, [key: string]: unknown }, searchMaxResults?: number, declared?: Record<string, unknown> } | null }): G2WebFixedLanesOk

export interface G2WebBackendInput {
  webAdaptersMod?: { createG2WebAdapters?: (input: Record<string, unknown>) => Record<string, unknown> }
  realmId?: string
  providerId?: string
  readNative?: (name: string) => unknown
  /** classify pins THIS; it must EQUAL the lane's derived endpoint origin
   *  (one resolved config produces ALL target facts) — a contradicting
   *  pair throws G2_WEB_SEARCH_ORIGIN_CONTRADICTION at build. */
  searchOrigin?: string
  readProviderFacts?: () => Record<string, unknown>
  definitionIdentityOf?: (...args: unknown[]) => unknown
  observe?: (event: Record<string, unknown>) => void
  /** the seam-branded lanes from createG2WebFixedLanes (the ONLY dispatch
   *  route — G2_WEB_LANE_DISPATCH_ABSENT throws on any bypass). */
  lanes?: G2WebFixedLanesOk | Record<string, unknown>
  descriptions?: Record<string, unknown>
  resolveWebCenterPorts?: () => { ports: Record<string, unknown>, assemblyId: string } | null
}

export interface G2WebBackendOk {
  createRowset: () => readonly unknown[]
  descriptions: Readonly<Record<string, unknown>>
  teamFixedWebProviderLanes: Readonly<Record<string, unknown>>
}

/** The standard g2Web backend face for the plane's backends injection.
 *  Synchronous, non-empty contract: honest inability is a THROW at build,
 *  never an empty rowset. */
export declare function createG2WebBackend (input?: G2WebBackendInput): G2WebBackendOk
