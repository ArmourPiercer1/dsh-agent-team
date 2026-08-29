// P2-T6 slot probe (TEAM_VIEW_SLOT / NEW_TEAM_ENTRY / input-dock fallback seat).
// Host-side payload: runs inside the DSH instance child process. Imports only the
// public ui-slots library (SlotCore), the engine underneath the plugin-level
// ctx.slots face, and drives it through seat declarations that mirror the frozen
// upstream artifacts:
//   A: ui-conversation — conversation.session entry declares conversation.view (list/session);
//      an external "Team" entry registers a Team Tab into that list seat.
//   B: ui-sidebar — the sidebar entry declares sidebar.footer.action (list/root);
//      an external entry registers a "New Team" action into that list seat.
//   C: ui-conversation — the conversation entry declares conversation.input.dock
//      (list/session); the Team Dock registers into it (fallback-seat evidence:
//      the matrix row's frozen fallback clause needs this public seat to exist).
// SlotCore is a pure registry: components are never invoked, so stub functions
// are complete stand-ins. Writes obs-slot.json under $P2T6_OBS_DIR.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SlotCore } from '@deepseek-ai/dsh-client-ui-slots'

export const name = 'p2t6-slot-probe'
export const inject = []

const PROBE = 'p2t6-slot-probe'

export function apply(ctx) {
  void ctx
  const obsDir = process.env.P2T6_OBS_DIR
  if (typeof obsDir !== 'string' || obsDir === '') {
    throw new Error(`${PROBE}: P2T6_OBS_DIR is not set`)
  }
  const out = { probe: PROBE, node: process.version, done: false, cores: {} }

  const stub = (label) => {
    void label
    return function P2T6StubComponent() {
      return null
    }
  }
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

  const recorder = () => {
    const checks = []
    const add = (id, expected, actual) => {
      const pass = JSON.stringify(expected) === JSON.stringify(actual)
      checks.push({ id, expected, actual, pass })
      return pass
    }
    const throwsWith = (id, fn, substrings) => {
      try {
        fn()
        checks.push({ id, expected: `throws containing: ${substrings.join(' | ')}`, actual: 'did not throw', pass: false, missing: substrings })
        return { threw: false, message: null }
      } catch (error) {
        const message = String(error?.message ?? error)
        const missing = substrings.filter((s) => !message.includes(s))
        checks.push({ id, expected: `throws containing: ${substrings.join(' | ')}`, actual: message, pass: missing.length === 0, missing })
        return { threw: true, message }
      }
    }
    return { checks, add, throwsWith }
  }

  // Core A — conversation.view list seat (TEAM_VIEW_SLOT mirror).
  async function coreA() {
    const { checks, add, throwsWith } = recorder()
    const facts = {}
    const core = new SlotCore()
    add('A0-root-seeded', { kind: 'single', scope: 'root' }, core.spec('root'))
    add('A0-root-epoch', 1, core.declarationEpoch('root'))

    const declEvents = []
    const unsubDecl = core.subscribeDeclaration('conversation.view', () => { declEvents.push(Date.now()) })

    // The conversation entry (registered into root) declares conversation.session.
    const disposeConversation = core.register({
      name: 'root',
      registrant: 'p2t6-shell',
      children: { 'conversation.session': { kind: 'single', scope: 'session' } },
    }, stub('conversation-entry'))
    add('A1-session-declared', { kind: 'single', scope: 'session' }, core.spec('conversation.session'))

    // The session entry declares conversation.view (list/session), the frozen seat.
    const disposeSession = core.register({
      name: 'conversation.session',
      registrant: 'p2t6-session',
      children: { 'conversation.view': { kind: 'list', scope: 'session' } },
    }, stub('session-entry'))
    add('A2-view-declared', { kind: 'list', scope: 'session' }, core.spec('conversation.view'))

    // Positive: external Team entry registers a Team Tab into the seat.
    const disposeTab1 = core.register({
      name: 'conversation.view',
      id: 'p2t6-team-tab',
      label: 'Team',
      priority: 0,
      registrant: 'p2t6-team-probe',
    }, stub('team-tab-0'))
    add('A3-tab-registered', 1, core.entries('conversation.view').length)
    const tab1 = core.entries('conversation.view')[0]
    facts.a3_tab = { id: tab1.options.id, label: tab1.options.label, registrant: tab1.registrant, live: core.isLive(tab1) }
    add('A3-tab-fields', { id: 'p2t6-team-tab', label: 'Team', registrant: 'p2t6-team-probe', live: true }, facts.a3_tab)
    add('A3-winners', 1, core.entriesOfSlot('conversation.view').length)

    // Shadow with a different priority is legal; the lowest priority renders.
    const disposeTab2 = core.register({
      name: 'conversation.view',
      id: 'p2t6-team-tab',
      label: 'Team v2',
      priority: 1,
      registrant: 'p2t6-team-probe-v2',
    }, stub('team-tab-1'))
    add('A4-shadow-entries', 2, core.entries('conversation.view').length)
    const winners = core.entriesOfSlot('conversation.view')
    add('A4-shadow-winner-count', 1, winners.length)
    add('A4-shadow-winner-lowest', 0, winners[0]?.options.priority)

    // Same id + same priority collides (verbatim message, registrant named).
    facts.a5_sameId = throwsWith('A5-same-id-same-priority', () => {
      core.register({ name: 'conversation.view', id: 'p2t6-team-tab', priority: 0, registrant: 'p2t6-squatter' }, stub('squatter'))
    }, [
      'list slot "conversation.view" already has an entry with id "p2t6-team-tab"',
      'at priority 0',
      'registered by p2t6-team-probe',
      'register at a different priority to shadow it (lowest renders)',
    ])

    // A list registration without options.id is rejected.
    facts.a6_noId = throwsWith('A6-list-requires-id', () => {
      core.register({ name: 'conversation.view', registrant: 'p2t6-no-id' }, stub('no-id'))
    }, ['list slot "conversation.view" requires options.id'])

    // Registering into an undeclared slot is rejected (verbatim).
    facts.a7_undeclared = throwsWith('A7-undeclared-slot', () => {
      core.register({ name: 'conversation.view.nonexistent', id: 'x', registrant: 'p2t6-ghost' }, stub('ghost'))
    }, ["slot \"conversation.view.nonexistent\" is not declared (a parent entry's children table must declare it)"])

    // A child slot cannot be declared twice.
    facts.a8_redeclare = throwsWith('A8-child-redeclaration', () => {
      core.register({
        name: 'conversation.session',
        id: 'x',
        priority: 5,
        registrant: 'p2t6-rival',
        children: { 'conversation.view': { kind: 'list', scope: 'session' } },
      }, stub('rival'))
    }, ['slot "conversation.view" is already declared (by'])

    // The single parent seat: shadow at a different priority is legal; same priority collides.
    const disposeSession2 = core.register({ name: 'conversation.session', priority: 1, registrant: 'p2t6-session-v2' }, stub('session-v2'))
    add('A9-single-shadow-entries', 2, core.entries('conversation.session').length)
    const singleWinners = core.entriesOfSlot('conversation.session')
    add('A9-single-winner-count', 1, singleWinners.length)
    // The original session entry registered without an explicit priority: its
    // options.priority stays undefined and the effective default is 0 — assert
    // the effective value plus the winner's identity.
    add('A9-single-winner-lowest', 0, singleWinners[0]?.options.priority ?? 0)
    add('A9-single-winner-identity', 'p2t6-session', singleWinners[0]?.registrant)
    facts.a10_singleSamePrio = throwsWith('A10-single-same-priority', () => {
      core.register({ name: 'conversation.session', priority: 0, registrant: 'p2t6-squatter2' }, stub('squatter2'))
    }, [
      'single slot "conversation.session" already has a registration',
      'at priority 0',
      'registered by p2t6-session',
    ])

    // subscribe is microtask-batched: two same-tick mutations, one notification per key.
    let subCount = 0
    const unsub = core.subscribe('conversation.view', () => { subCount += 1 })
    core.register({ name: 'conversation.view', id: 'p2t6-tab-a', registrant: 'p2t6-batch' }, stub('batch-a'))
    core.register({ name: 'conversation.view', id: 'p2t6-tab-b', registrant: 'p2t6-batch' }, stub('batch-b'))
    add('A11-subscribe-not-yet', 0, subCount)
    await tick()
    add('A11-subscribe-batched', 1, subCount)
    unsub()

    // Disposer cascade: disposing the declarant collapses the child slot.
    const viewEpochBefore = core.declarationEpoch('conversation.view')
    disposeSession()
    add('A12-spec-collapsed', undefined, core.spec('conversation.view'))
    add('A12-epoch-bumped', viewEpochBefore + 1, core.declarationEpoch('conversation.view'))
    add('A12-entries-cleared', 0, core.entries('conversation.view').length)
    add('A12-entry-dead', false, core.isLive(tab1))
    facts.a12_rethrow = throwsWith('A12-register-after-collapse', () => {
      core.register({ name: 'conversation.view', id: 'p2t6-zombie', registrant: 'p2t6-zombie' }, stub('zombie'))
    }, ["slot \"conversation.view\" is not declared (a parent entry's children table must declare it)"])
    add('A12-decl-subscriber-notified', true, declEvents.length >= 1)
    // After the declarant's disposer runs, only session-v2 remains: the A8
    // rival registration was atomically rolled back when its children
    // re-declaration threw, and the disposed entry is removed itself.
    const sessionEntries = core.entries('conversation.session')
    add('A12-sibling-survives', 1, sessionEntries.length)
    add('A12-sibling-identity', 'p2t6-session-v2', sessionEntries[0]?.registrant)
    // Redefining the seat after collapse is legal again (the epoch bump unblocks it).
    const disposeSession3 = core.register({
      name: 'conversation.session',
      priority: 7,
      registrant: 'p2t6-session-v3',
      children: { 'conversation.view': { kind: 'list', scope: 'session' } },
    }, stub('session-v3'))
    add('A12b-redeclare-after-collapse', { kind: 'list', scope: 'session' }, core.spec('conversation.view'))

    unsubDecl()
    disposeTab1()
    disposeTab2()
    disposeSession3()
    disposeSession2()
    disposeConversation()
    return { checks, facts }
  }

  // Core B — sidebar.footer.action list seat (NEW_TEAM_ENTRY mirror).
  async function coreB() {
    const { checks, add, throwsWith } = recorder()
    const facts = {}
    const core = new SlotCore()
    const disposeShell = core.register({
      name: 'root',
      registrant: 'p2t6-shell',
      children: { sidebar: { kind: 'single', scope: 'root' } },
    }, stub('shell-entry'))
    add('B1-sidebar-declared', { kind: 'single', scope: 'root' }, core.spec('sidebar'))
    const disposeSidebar = core.register({
      name: 'sidebar',
      registrant: 'p2t6-sidebar',
      children: { 'sidebar.footer.action': { kind: 'list', scope: 'root' } },
    }, stub('sidebar-entry'))
    add('B2-footer-action-declared', { kind: 'list', scope: 'root' }, core.spec('sidebar.footer.action'))

    // Positive: external entry registers the New Team action.
    const disposeNewTeam = core.register({
      name: 'sidebar.footer.action',
      id: 'p2t6-new-team',
      label: 'New Team',
      priority: 0,
      registrant: 'p2t6-team-probe',
    }, stub('new-team'))
    add('B3-new-team-registered', 1, core.entries('sidebar.footer.action').length)
    const action = core.entries('sidebar.footer.action')[0]
    facts.b3_action = { id: action.options.id, label: action.options.label, registrant: action.registrant, live: core.isLive(action) }
    add('B3-new-team-fields', { id: 'p2t6-new-team', label: 'New Team', registrant: 'p2t6-team-probe', live: true }, facts.b3_action)
    add('B4-winners', 1, core.entriesOfSlot('sidebar.footer.action').length)

    facts.b5_squatter = throwsWith('B5-same-id-same-priority', () => {
      core.register({ name: 'sidebar.footer.action', id: 'p2t6-new-team', priority: 0, registrant: 'p2t6-squatter' }, stub('squatter'))
    }, [
      'list slot "sidebar.footer.action" already has an entry with id "p2t6-new-team"',
      'registered by p2t6-team-probe',
    ])
    facts.b6_noId = throwsWith('B6-list-requires-id', () => {
      core.register({ name: 'sidebar.footer.action', registrant: 'p2t6-no-id' }, stub('no-id'))
    }, ['list slot "sidebar.footer.action" requires options.id'])

    // Disposing the declaring sidebar entry removes the seat and its contributions.
    disposeSidebar()
    add('B7-spec-collapsed', undefined, core.spec('sidebar.footer.action'))
    add('B7-entry-dead', false, core.isLive(action))
    facts.b8_rethrow = throwsWith('B8-register-after-collapse', () => {
      core.register({ name: 'sidebar.footer.action', id: 'p2t6-zombie', registrant: 'p2t6-zombie' }, stub('zombie'))
    }, ['slot "sidebar.footer.action" is not declared'])

    disposeShell()
    disposeNewTeam()
    return { checks, facts }
  }

  // Core C — conversation.input.dock list seat (Team Dock fallback-seat evidence).
  async function coreC() {
    const { checks, add } = recorder()
    const facts = {}
    const core = new SlotCore()
    const disposeConversation = core.register({
      name: 'root',
      registrant: 'p2t6-shell',
      children: {
        'conversation.session': { kind: 'single', scope: 'session' },
        'conversation.input.dock': { kind: 'list', scope: 'session' },
      },
    }, stub('conversation-entry'))
    add('C1-dock-declared', { kind: 'list', scope: 'session' }, core.spec('conversation.input.dock'))
    const disposeDock = core.register({
      name: 'conversation.input.dock',
      id: 'p2t6-team-dock',
      label: 'Team Dock',
      priority: 0,
      registrant: 'p2t6-team-probe',
    }, stub('team-dock'))
    add('C2-dock-registered', 1, core.entries('conversation.input.dock').length)
    const dock = core.entries('conversation.input.dock')[0]
    facts.c2_dock = { id: dock.options.id, label: dock.options.label, registrant: dock.registrant, live: core.isLive(dock) }
    add('C2-dock-fields', { id: 'p2t6-team-dock', label: 'Team Dock', registrant: 'p2t6-team-probe', live: true }, facts.c2_dock)
    disposeDock()
    disposeConversation()
    return { checks, facts }
  }

  void (async () => {
    try {
      out.cores.A_conversationView = await coreA()
      out.cores.B_sidebarFooterAction = await coreB()
      out.cores.C_inputDock = await coreC()
    } catch (error) {
      out.fatal = String(error?.message ?? error) + '\n' + String(error?.stack ?? '')
    } finally {
      const all = [
        ...(out.cores.A_conversationView?.checks ?? []),
        ...(out.cores.B_sidebarFooterAction?.checks ?? []),
        ...(out.cores.C_inputDock?.checks ?? []),
      ]
      out.checkSummary = {
        total: all.length,
        passed: all.filter((c) => c.pass).length,
        failedIds: all.filter((c) => !c.pass).map((c) => c.id),
      }
      out.done = true
      try {
        writeFileSync(join(obsDir, 'obs-slot.json'), JSON.stringify(out, null, 2))
      } catch (error) {
        out.fatal = (out.fatal ? out.fatal + '\n' : '') + `obs write failed: ${String(error)}`
      }
    }
  })()
}
