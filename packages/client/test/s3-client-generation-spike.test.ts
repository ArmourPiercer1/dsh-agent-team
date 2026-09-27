// EXCLUDED FROM THE PACKAGE TSC PROGRAM (see tsconfig.json `exclude`) —
// characterization evidence only, runtime-verified by vitest:
// `cd packages/client && npx vitest run test/s3-client-generation-spike.test.ts`
//
// WHY EXCLUDED: this spike drives the PRISTINE upstream client services
// straight from the test-use checkout
// (`../../../../../tests/deepseek-harness-test-use/...`). Those sources are
// outside this package's tsc program rootDir (TS6059), and several upstream
// bare specifiers (`@deepseek-ai/dsh-api-*-controller/*`, `dsh-remote-mock`,
// `dsh-typert-protocol`) are not type-resolvable here (TS2307) — the package's
// Vite pipeline resolves them via the linked-dsh-source-redirect plugin; tsc
// has no equivalent. The findings are captured under
// dev/agent-workflow/evidence/restart-017rc1/supplement-client/. This file is
// not product code and asserts no product behavior.

/**
 * s3-client-generation-spike.test.ts — S3 (PR #31 supplemental fix guide §7
 * Commit S3): the same-page "Session unavailable" (会话不可用) characterization
 * spike. EVIDENCE ONLY — no product workaround (guide §3.2: 先不写最终产品
 * workaround). Nothing in this file modifies team product behavior.
 *
 * Drives the PRISTINE 0.1.7-rc.1 upstream client services (test-use checkout,
 * read-only) over a mocked Remote and observes exactly the guide §7 Commit S3
 * list:
 *   - `sessions.retainInfo(root)`           — same-SID reopen reference-count trace
 *   - `SessionReference.ready`              — failed-generation lifetime
 *   - Session binding / generation identity — same-id generation vs fresh generation
 *   - `uiWorkspace` main selection          — who owns the mainView reference, which
 *                                              public call can release it
 *   - `sessions.refresh()` / connection     — why the catalog refresh (the current
 *                                              `openTeamMode` step (c)) does NOT reconcile
 *
 * Scenario (the Q2 browser finding reproduced at the data layer):
 *   S1 ordinary open #1 of the cold Team root: history opens normally.
 *   S2 the fence veto arrives as `api-session/error` (agent activation refused)
 *      → `ClientSessions.handleSessionError` → `session.lastAgentError` (sticky,
 *      per generation).
 *   S3 backend takeover success + the CURRENT product step (c)
 *      (`ctx.sessions.refresh()`): generation unchanged, error state unchanged
 *      → the composer stays unavailable (§3.1 reproduced at the data layer).
 *   S4 same-SID reopen through the public navigation (`uiWorkspace.openSession`
 *      with the same id): retain +1 / release −1 — transiently 2, settles at 1,
 *      NEVER 0 → the failed generation survives → still stuck. (Answers Q1/Q4.)
 *   S5 a connection reset (`handleConnected`) rebuilds baselines but does not
 *      touch the generation → still stuck.
 *   S6 the ONLY public uiWorkspace path that releases the mainView reference:
 *      `uiWorkspace.archiveSession(root)` — with the host-archive side effect
 *      (recorded) → referenceCount 0 → the generation is RETIRED (binding gone,
 *      scope fiber disposed, Session object dropped).
 *   S7 re-retain the SAME id → a FRESH generation (new binding identity, one
 *      new `session/follow` open, clean open, `lastAgentError` null) → the
 *      main selection still names the same session id (no switch).
 *   S8 a generation whose OPEN was rejected (ROOT2): failed-open lifetime,
 *      per-retain open retry semantics, retire-at-0, fresh generation on
 *      re-retain, and that a connection reset does not retire it. (Answers Q2.)
 *   S9 public seam inventory (runtime capture, printed for the evidence doc).
 *
 * Conclusion recorded in
 * dev/agent-workflow/evidence/restart-017rc1/supplement-client/ : the
 * reset/reopen seam exists at the ISessions level (release-to-0 + re-retain →
 * fresh generation, Q2 = YES), but the mainView reference is privately owned
 * by `UiWorkspaceService`; NO public `ctx.sessions` / `ctx.uiWorkspace` call
 * can retire the failed generation without a forbidden navigation side effect
 * (archive / new session — guide §3.4), and no UiWorkspace generation-reset
 * API exists (Q4 = NO). → NO-GO-C1 (guide §3.4); the only safe fix is an
 * upstream `UiWorkspaceService` change = a core patch = budget 0.
 *
 * Shim note: run with plain vitest (packages/client/vitest.config.ts); async
 * `it` body — same pattern as the upstream reference-ownership spec.
 */
import { setImmediate } from 'node:timers/promises'
import { Context } from '@deepseek-ai/cordis'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { LayoutController } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {
  SessionBinding, SessionRetainInfo,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type {
  IWorkspaces, WorkspaceSnapshot,
} from '@deepseek-ai/dsh-api-workspace-controller/client'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { ok } from '@deepseek-ai/dsh-remote-mock'
import { describe, expect, vi } from 'vitest'
// Pristine test-use checkout (read-only, test infra per TEST_METHODS.md).
// This repo's vitest source redirect maps @deepseek-ai/<pkg>/<subpath> only
// for subpaths that live UNDER the package src root, so the `./src/*`-shaped
// entries (and the class-level service export) are imported by relative path
// — the same module copies the redirect produces for the linked packages
// (one singleton world, no built lib).
import { ClientSessions } from '../../../../../tests/deepseek-harness-test-use/packages/api/session-controller/src/client/sessions/service.ts'
import { UiWorkspaceService } from '../../../../../tests/deepseek-harness-test-use/packages/client/ui-workspace/src/client/navigation.ts'
import { createWorkspaceViewStore } from '../../../../../tests/deepseek-harness-test-use/packages/client/ui-workspace/src/client/stores.ts'
import type { RowToast } from '../../../../../tests/deepseek-harness-test-use/packages/client/ui-workspace/src/client/contract/slots.ts'
import {
  createClientTest,
  webApp,
} from '../../../../../tests/deepseek-harness-test-use/packages/test-support/client-runtime/src/assembly/index.ts'
// The upstream spec-local opening-snapshot builder the real SessionEventStream
// is verified against upstream. NOTE: the sibling `session.client.ts` helper
// is NOT imported — its `event-script.client.ts` chain pulls `@deepseek-ai/dsh-llm`,
// whose source graph does not survive this repo's vitest worker pipeline
// (Node type-stripping SyntaxError, reproducible with a bare dsh-llm import).
// `history.client.ts` is import-clean, so the 12-line `followScript` wrapper
// is mirrored locally below, byte-for-byte in behavior.
import { followSnapshot } from '../../../../../tests/deepseek-harness-test-use/packages/api/session-controller/tests/remote/history.client.ts'
import type {
  SessionFollowRequest, SessionPage,
} from '@deepseek-ai/dsh-api-session-controller/types'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'

/** The Session history endpoint a Session opens for its window. */
/** Bounded test-harness settle: poll until `probe` holds or time out. */
async function waitUntil(probe: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + 2000
  while (!probe()) {
    if (Date.now() > deadline) throw new Error(`spike: timed out waiting for ${what}`)
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}

const FOLLOW = 'session/follow'

type HistorySource = RemoteResult<SessionPage>
  | ((request: SessionFollowRequest) => RemoteResult<SessionPage> | Promise<RemoteResult<SessionPage>>)

/**
 * `session/follow` script (mirror of the upstream spec-local helper): the
 * opening snapshot built from the history answer, then open for pushes. A
 * failed answer fails the stream with its error.
 */
function followScript(history: HistorySource) {
  return async ([request]: [SessionFollowRequest], stream: {
    push(frame: unknown): void
    fail(error: unknown): void
  }): Promise<void> => {
    const result = await (typeof history === 'function' ? history(request) : history)
    if (!result.ok) {
      stream.fail(result.error)
      return
    }
    stream.push(followSnapshot(result.value, request))
  }
}

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    s3SpikeProbe: unknown
  }
}

const ROOT = SessionId('s3-spike-root')
const ROOT2 = SessionId('s3-spike-root2')
const VETO = 'resume failed … intercepted foreign Agent activation for Team-managed session "s3-spike-root"'
const VETO2 = 'resume failed … intercepted foreign Agent activation for Team-managed session "s3-spike-root2"'
const EMPTY_HISTORY = { records: [], hasMore: false }

/** localStorage backing for the uiWorkspace selection persist key. */
const lsBacking = new Map<string, string>()
;(globalThis as Record<string, unknown>).localStorage = {
  getItem: (key: string) => lsBacking.get(key) ?? null,
  setItem: (key: string, value: string) => { lsBacking.set(key, value) },
  removeItem: (key: string) => { lsBacking.delete(key) },
  clear: () => { lsBacking.clear() },
  key: (index: number) => [...lsBacking.keys()][index] ?? null,
  get length() { return lsBacking.size },
}

function workspaceRow(workspaceId: string, sessionIds: readonly string[]): WorkspaceSnapshot['items'][number] {
  return {
    workspaceId: workspaceId as WorkspaceSnapshot['items'][number]['workspaceId'],
    path: `/w/${workspaceId}`,
    title: workspaceId,
    sessionIds: [...sessionIds] as WorkspaceSnapshot['items'][number]['sessionIds'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function workspaceState(archived: readonly string[]): WorkspaceSnapshot {
  return {
    items: [workspaceRow('s3-ws', [ROOT as string, ROOT2 as string])],
    archivedSessionIds: [...archived] as WorkspaceSnapshot['archivedSessionIds'],
    pinnedSessionIds: [] as WorkspaceSnapshot['pinnedSessionIds'],
    state: 'idle',
    // 'pending' for the whole spike: with phase !== 'ready' the uiWorkspace
    // startup `restoreSelection` (which would call session/create) never runs,
    // so the scenario drives the navigation exclusively through the explicit
    // openSession/archiveSession/unarchiveSession calls under test.
    phase: 'pending',
    error: null,
  }
}

const it = createClientTest({ roster: webApp.closure(['@deepseek-ai/dsh-api-gateway']) })

describe('S3 same-page generation characterization (evidence only, no product workaround)', () => {
  it('traces the same-SID reopen, the failed-generation lifetime, and the public seams', async ({ mock, start }) => {
    const client = await start()
    const ctx = new Context()

    // --- bench scaffolding (mirrors the upstream workspaces-service spec) ---
    const locale = new LocaleRuntime(ctx)
    locale.setLocale('en')
    ctx.provide('locale', locale)
    const layout = new LayoutController({
      selectPanel: vi.fn(), retainMainPanels: vi.fn(),
      setSidebar: vi.fn(), toggleSidebar: vi.fn(), setViewportWidth: vi.fn(),
      setRightbar: vi.fn(), openRightbar: vi.fn(), closeRightbar: vi.fn(),
    }, () => true)
    ctx.provide('layout', layout)
    ctx.effect(() => () => { layout.dispose() })

    // --- catalog: both Team-root sessions listed before any open ---
    mock.remote.session.list.mockResolvedValue(ok({ items: [
      { sessionId: ROOT, updatedAt: 1, running: false, blank: true, agentAvailable: true },
      { sessionId: ROOT2, updatedAt: 2, running: false, blank: true, agentAvailable: true },
    ] }))

    const svc = new ClientSessions(ctx, client.ctx.remote)
    const followCounts: Record<string, number> = {}
    let root2FailOpen = true
    mock.stream(FOLLOW, followScript((request) => {
      const sid = String(request.address.kind === 'session'
        ? request.address.sessionId
        : request.address.parentSessionId)
      followCounts[sid] = (followCounts[sid] ?? 0) + 1
      if (sid === String(ROOT2) && root2FailOpen) {
        // A branded RemoteError, like the real fence wire failure, so the
        // client folds it into openState='error' instead of crashing the
        // stream-failure handler (which rethrows non-remote faults).
        return { ok: false, error: new RemoteError('session/intercepted' as never, VETO2, {}) }
      }
      return ok({ ...EMPTY_HISTORY })
    }))
    await svc.refresh()

    // --- fake workspaces (archive updates the list like the Host would) ---
    const archivedCalls: string[] = []
    const unarchivedCalls: string[] = []
    const workspaces = {
      list: createSnapshotStore<WorkspaceSnapshot>(workspaceState([])),
      archiveSession: async (sessionId: string) => {
        archivedCalls.push(sessionId)
        const current = workspaces.list.getSnapshot()
        workspaces.list.set(workspaceState([...current.archivedSessionIds, sessionId]))
      },
      unarchiveSession: async (sessionId: string) => {
        unarchivedCalls.push(sessionId)
        const current = workspaces.list.getSnapshot()
        workspaces.list.set(workspaceState(
          current.archivedSessionIds.filter(id => id !== sessionId),
        ))
      },
      pinSession: async () => undefined,
      unpinSession: async () => undefined,
      create: async () => { throw new Error('spike: workspaces.create unused') },
      initializeDefault: async () => undefined,
      rename: async () => { throw new Error('spike: workspaces.rename unused') },
      delete: async () => { throw new Error('spike: workspaces.delete unused') },
      insertBefore: async () => undefined,
    } as unknown as IWorkspaces
    const directoryPicker = {
      pick: async (): Promise<string | null> => null,
      list: async (): Promise<never[]> => [],
      createDirectory: async (): Promise<never> => { throw new Error('spike: directoryPicker unused') },
    }
    const view = createWorkspaceViewStore().create()
    const toasts: RowToast[] = []
    const uiWorkspace = new UiWorkspaceService(
      ctx, directoryPicker, workspaces, svc, view.actions, (toast) => { toasts.push(toast) },
    )

    // --- trace capture ---
    let gen1: SessionBinding | undefined
    let gen2: SessionBinding | undefined
    let genF1: SessionBinding | undefined
    let genF2: SessionBinding | undefined
    const label = (b: SessionBinding | undefined): string | null =>
      b === undefined ? null
        : b === gen1 ? 'G1'
        : b === gen2 ? 'G2'
        : b === genF1 ? 'GF1'
        : b === genF2 ? 'GF2' : 'G?'
    const adopt = (b: SessionBinding | undefined): void => {
      if (b === undefined) return
      if (gen1 === undefined) { gen1 = b; return }
      if (gen2 === undefined && b !== gen1) gen2 = b
    }
    const adoptF = (b: SessionBinding | undefined): void => {
      if (b === undefined) return
      if (genF1 === undefined) { genF1 = b; return }
      if (genF2 === undefined && b !== genF1) genF2 = b
    }
    const trace: Array<Record<string, unknown>> = []
    const record = (step: string, id: typeof ROOT = ROOT): void => {
      const b = svc.binding(id)
      const face = b?.session.getSnapshot()
      // Adopt into the pool that tracks THIS id's generations only, so
      // ROOT2's failed generations land in genF1/genF2, not gen1/gen2.
      if (id === ROOT) adopt(b)
      else adoptF(b)
      trace.push({
        step,
        retain: svc.retainInfo(id).getSnapshot(),
        generation: label(b),
        openState: face?.openState ?? null,
        lastAgentError: face?.lastAgentError ?? null,
        followOpens: followCounts[String(id)] ?? 0,
      })
    }

    // --- S1: ordinary open #1 (the cold Team root; the history open SUCCEEDS) ---
    uiWorkspace.openSession(ROOT)
    record('S1 openSession #1 (ordinary open of the cold Team root)')
    const probe1 = svc.retain(ROOT, { source: 's3SpikeProbe' })
    await probe1.ready // the shared opening settles (session/follow snapshot delivered)
    record('S1 probe reference ready (open #1 succeeded)')
    probe1.release()
    expect(gen1).toBeDefined()
    expect(svc.retainInfo(ROOT).getSnapshot()).toEqual({ referenceCount: 1, retainedBy: { mainView: 1 } })

    // --- S2: the fence veto arrives on the wire (agent activation refused) ---
    svc.handleSessionError(ROOT, VETO)
    record('S2 api-session/error (fence veto: "intercepted foreign Agent activation")')
    expect(svc.binding(ROOT)?.session.getSnapshot().lastAgentError).toBe(VETO)
    expect(svc.binding(ROOT) === gen1).toBe(true) // the generation is alive and carries the sticky error

    // --- S3: takeover success (backend live) + the CURRENT product step (c) ---
    await svc.refresh() // = ctx.sessions.refresh() in team-mount-core openTeamMode step (c)
    record('S3 takeover success + ctx.sessions.refresh() (current product step c)')
    expect(svc.binding(ROOT) === gen1).toBe(true) // generation unchanged
    expect(svc.binding(ROOT)?.session.getSnapshot().lastAgentError).toBe(VETO) // error state unchanged

    // --- S4: same-SID reopen through the public navigation (Team-mode entry) ---
    const bumps: SessionRetainInfo[] = []
    const stopWatch = svc.retainInfo(ROOT).subscribe(() => {
      bumps.push(svc.retainInfo(ROOT).getSnapshot())
    })
    uiWorkspace.openSession(ROOT) // replaceMain: retain(mainView)+1, previous release −1
    stopWatch()
    record('S4 openSession #2 (same-SID reopen, Team-mode entry)')
    expect(bumps.some(b => b.referenceCount === 2 && b.retainedBy.mainView === 2)).toBe(true)
    expect(svc.retainInfo(ROOT).getSnapshot()).toEqual({ referenceCount: 1, retainedBy: { mainView: 1 } })
    expect(svc.binding(ROOT) === gen1).toBe(true) // the failed generation SURVIVED the reopen
    expect(svc.binding(ROOT)?.session.getSnapshot().lastAgentError).toBe(VETO) // still stuck

    // --- S5: a connection reset does not retire the generation either ---
    svc.handleConnected()
    await setImmediate() // let the re-pulled catalog settle
    record('S5 handleConnected (connection/reset rebuilds baselines)')
    expect(svc.binding(ROOT) === gen1).toBe(true)
    expect(svc.binding(ROOT)?.session.getSnapshot().lastAgentError).toBe(VETO)

    // --- S6: the ONLY public release path for the mainView reference ---
    await uiWorkspace.archiveSession(ROOT) // side effect: the host-archive call is recorded
    record('S6 uiWorkspace.archiveSession (public release path; host-archive side effect)')
    expect(archivedCalls).toEqual(['s3-spike-root']) // the side effect happened
    expect(svc.retainInfo(ROOT).getSnapshot()).toEqual({ referenceCount: 0, retainedBy: {} })
    expect(svc.binding(ROOT) === undefined).toBe(true) // the generation was RETIRED

    // While the session sits in the archived set, the navigation policy
    // refuses to hold it as main (clearArchivedCurrent on every reconcile) —
    // an archived session cannot keep the main position, so the public
    // repair is the archive → unarchive → reopen PAIR (three host-side calls,
    // all recorded here as side effects).
    await uiWorkspace.unarchiveSession(ROOT)
    record('S6b uiWorkspace.unarchiveSession (second side effect of the public repair)')
    expect(unarchivedCalls).toEqual(['s3-spike-root'])

    // --- S7: re-retain the SAME id → a FRESH generation, no session switch ---
    uiWorkspace.openSession(ROOT)
    record('S7 openSession #3 (same id after retire — fresh generation)')
    expect(svc.binding(ROOT) !== undefined).toBe(true)
    expect(svc.binding(ROOT) !== gen1).toBe(true)
    const probe2 = svc.retain(ROOT, { source: 's3SpikeProbe' })
    await probe2.ready // the fresh generation's open settles cleanly
    record('S7 fresh generation ready (clean open)')
    probe2.release()
    expect(svc.retainInfo(ROOT).getSnapshot()).toEqual({ referenceCount: 1, retainedBy: { mainView: 1 } })
    expect(svc.binding(ROOT)?.session.getSnapshot().lastAgentError).toBeNull() // sticky error gone
    expect(svc.binding(ROOT)?.session.getSnapshot().openState).toBe('open')
    expect(followCounts[String(ROOT)]).toBe(2) // exactly one new session/follow open (the fresh one)
    // the main selection still names the SAME session id (no other-session switch):
    expect(JSON.parse(String(lsBacking.get('dsh.sessions.current')))).toEqual({ sessionId: 's3-spike-root' })

    // --- S8: a generation whose OPEN failed (failed-open lifetime, Q2) ---
    // NOTE (source-verified): ClientSessions.doOpen SWALLOWS a RemoteFailure —
    // a rejected session/follow sets openState='error' + openError and RESOLVES,
    // so reference.ready resolves even for a failed open; the failure is
    // observed through the session snapshot, not a rejected promise.
    const probeF1 = svc.retain(ROOT2, { source: 's3SpikeProbe' })
    await probeF1.ready // resolves despite the failed open
    // the journal failure lands as a terminal BACKGROUND failure after the
    // open settles (failEventStream): give it a bounded settle, then read state
    await waitUntil(
      () => svc.binding(ROOT2)?.session.getSnapshot().openState === 'error',
      'ROOT2 failed-open settle',
    )
    record('S8 retain ROOT2 → open FAILED (error state, sticky generation)', ROOT2)
    expect(svc.retainInfo(ROOT2).getSnapshot()).toEqual({ referenceCount: 1, retainedBy: { s3SpikeProbe: 1 } })
    expect(genF1 !== undefined).toBe(true)
    expect(genF1?.session.getSnapshot().openState).toBe('error')
    expect(genF1?.session.getSnapshot().openError?.code).toBe('session/intercepted')
    // re-retain of the same failed generation: a NEW open attempt per retain
    // (per-generation single-flight only while in-flight; after settle, retryable)
    const probeF2 = svc.retain(ROOT2, { source: 's3SpikeProbe' })
    await probeF2.ready // resolves again; the retried open fails again
    await waitUntil(
      () => followCounts[String(ROOT2)] === 2
        && svc.binding(ROOT2)?.session.getSnapshot().openState === 'error',
      'ROOT2 retry failed-open settle',
    )
    record('S8 second retain of the failed generation (new open attempt, fails again)', ROOT2)
    probeF2.release()
    expect(followCounts[String(ROOT2)]).toBe(2) // the retry re-ran the session/follow handshake
    // a connection reset does not retire the failed generation either
    svc.handleConnected()
    await setImmediate()
    expect(svc.binding(ROOT2) === genF1).toBe(true)
    // release to zero → retire; re-retain → fresh generation (backend now healed)
    probeF1.release()
    record('S8 release-to-0 (failed generation retired)', ROOT2)
    expect(svc.retainInfo(ROOT2).getSnapshot()).toEqual({ referenceCount: 0, retainedBy: {} })
    expect(svc.binding(ROOT2) === undefined).toBe(true)
    root2FailOpen = false
    const probeF3 = svc.retain(ROOT2, { source: 's3SpikeProbe' })
    await probeF3.ready
    record('S8 re-retain ROOT2 (fresh generation, clean open)', ROOT2)
    expect(svc.binding(ROOT2) !== undefined).toBe(true)
    expect(svc.binding(ROOT2) !== genF1).toBe(true)
    expect(genF2 !== undefined).toBe(true)
    expect(svc.binding(ROOT2)?.session.getSnapshot().openState).toBe('open')
    expect(svc.binding(ROOT2)?.session.getSnapshot().lastAgentError).toBeNull()
    probeF3.release()

    // --- S9: public seam inventory (printed for the evidence document) ---
    // Prototype methods AND instance-own methods (some ClientSessions members
    // like `binding`/`list` are instance fields, not prototype methods).
    const protoNames = (obj: object): string[] =>
      Object.getOwnPropertyNames(Object.getPrototypeOf(obj))
        .filter(name => name !== 'constructor')
        .sort()
    const ownMethodNames = (obj: object): string[] =>
      Object.getOwnPropertyNames(obj)
        .filter(name => typeof (obj as Record<string, unknown>)[name] === 'function')
        .sort()
    const uiWorkspaceSeams = [...protoNames(uiWorkspace), ...ownMethodNames(uiWorkspace)].sort()
    const sessionServiceSeams = [...protoNames(svc), ...ownMethodNames(svc)].sort()
    // The expected public seams exist (both surfaces):
    expect(uiWorkspaceSeams).toEqual(expect.arrayContaining([
      'archiveSession', 'connectWorkspace', 'forkSession', 'openSession',
      'openWorkspace', 'startSession', 'unarchiveSession', 'pinSession', 'unpinSession',
    ]))
    expect(sessionServiceSeams).toEqual(expect.arrayContaining([
      'retain', 'using', 'retainInfo', 'refresh', 'refreshProjections', 'search',
      'fork', 'create', 'scope', 'scopeOf', 'sessionOf', 'binding', 'subagentAddress',
      'handleConnected', 'handleSessionError',
    ]))
    // `list` (the SessionListState snapshot store) is an instance PROPERTY,
    // not a method — the inventory records it separately below.
    // THE Q4 answer, runtime-verified: NEITHER public surface exposes any
    // generation-reset / reopen / reference-release / error-clear seam.
    expect([
      ...uiWorkspaceSeams, ...sessionServiceSeams,
    ].some(name => /reset|reopen|release|unstick|clearError|discard/i.test(name))).toBe(false)

    console.log('S3-SPIKE-TRACE', JSON.stringify(trace, null, 2))
    console.log('S3-SPIKE-SEAMS', JSON.stringify({
      uiWorkspaceSeams, sessionServiceSeams,
      sessionServiceProperties: ['list', 'manager', 'scopes', 'retainObservers', 'closed'].filter(
        name => (svc as unknown as Record<string, unknown>)[name] !== undefined,
      ),
      followCounts,
    }, null, 2))

    await ctx.fiber.dispose()
  })
})
