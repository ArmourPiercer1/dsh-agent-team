/**
 * dod20-ui-driver-orchestration.test.mjs — OFFLINE orchestration tests for the
 * DDoD20 UI driver (node --test; no browser, no host, no network, no jsdom).
 *
 * WHY THIS FILE EXISTS (external review P2 round, PR #55): the sibling suite
 * tests pure helpers in isolation while the LIVE lane — the code that
 * mis-ordered preClick, fed body.innerText into an HTML parser, cut the E3
 * window after the cold round, correlated responses by leg+method, silently
 * authorized a default workspace and always exited 0 — had ZERO caller
 * coverage. These tests drive the REAL async leg orchestration
 * (runDriverCore) through the same seams the Playwright adapter implements
 * (openLeg / page / NetworkLog / fs / clock injected) against scripted
 * fake worlds — a fresh browser context per leg, like the real lane.
 *
 * Defect → scenario map (each red on the reviewed implementation):
 *  P1 preClick is measured AT the click (boot traffic still counts, the cold
 *     round does not); the E1 window is the reload cold round; member-first.
 *  P2 the Select Workspace Directory dialog is REAL dialog state (snapshot +
 *     crumb verification), never innerText fed to an HTML string parser.
 *  P3 the E3 window starts at the cold-open click, so the cold projection /
 *     ledger it requires are the ones the navigation produced.
 *  P4 selection = exact header id + a SUCCESS response correlated to THAT
 *     fresh request (reqSeq + rpcId + status + envelope ok + parsed relation/
 *     instance); mis-correlated / failed / stale-foreign responses reject.
 *  P5 evalE3 uses the injected PRODUCT tick interval, >=6 target ticks, the
 *     real deltas, and verifies the root identity it was handed.
 *  P6 the workspace is EXPLICIT + filesystem-authorized (realpath containment
 *     under an explicit non-home root); nested fixtures are reached
 *     level-by-level with state verification; escapes die BEFORE any browser
 *     leg opens; near-miss / foreign crumb never reach Open.
 *  P7 aggregation: fatal ⇒ exit 3; FAIL ⇒ exit 1; NOT_RUN is never a PASS
 *     (exit 2, ok=false); no parent verdict stamping; E4 stays declared.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as D from './dod20-ui-driver.mjs'

// ── canonical identities (mirror of dod20-ui-driver-fixtures.mjs) ───────────
const ROOT_ID = 'session-mpr-t1-mpr-2026-10-01T13-21-34'
const ROOT_TITLE = 'ack:role-leader:mpr-2026-10-01T13-21-34'
const MEMBER_ID = 'session-team-child-52860b5a204e428e1cb00690a10eb02f'
const MEMBER_TITLE = 'ack:role-worker:deleg:mpr-2026-10-01T13-21-34'
const MEMBER_INSTANCE = 'inst-0iin89s0dvix'
const OTHER_ID = 'session-team-child-259520eccdc5502ef43ef3f0762921e6'
const NEW_ID = 'session-ordinary-new-1'
const HOME = '/home/user'

const DEFAULT_LISTINGS = {
  Home: { folders: ['bin', 'deepseek-harness', 'workspace', 'testhome'], buttons: ['New folder', 'Cancel', 'Open'] },
  testhome: { folders: ['ws', 'ws-old'], buttons: ['New folder', 'Cancel', 'Open'] },
}

/**
 * makeWorld(opts) → { w, io }
 * io is EXACTLY the dependency bag runDriverCore consumes. Every leg gets a
 * FRESH state slice (rail/notice/selection/dialog) — one fresh browser
 * context per leg is a frozen property of the real lane, the fake keeps it.
 */
function makeWorld (opts = {}) {
  const w = {
    v: 1000, // shared monotonic virtual clock (ms)
    rpc: 0,
    shots: [],
    clicks: [],
    canceledDialogs: 0,
    openLegCalls: 0,
    legsOpened: [],
    closedContexts: 0,
    opened: [], // per-leg snapshots for cross-leg assertions
    walk: null, // set by the leg's page.wait: boundary-accurate tick walk
  }
  const tickMs = opts.tickMs || 3000
  const listings = opts.listings || DEFAULT_LISTINGS

  const io = {
    fs: null, // replaced per test via makeMemFs
    realpathSync: (p) => (opts.realpaths && opts.realpaths[p]) || p,
    homedir: () => HOME,
    now: () => w.v,
    // product ticks fire on PAGE-side time (page.wait) at exact nextTickAt
    // boundaries; driver-side io.sleep is driver wall time and must not
    // conjure product polls (that would let stale worlds self-heal).
    sleep: async (ms) => { w.v += ms },
    log: () => {},
    tickMs,
    openLeg: async (name, net) => {
      w.openLegCalls += 1
      w.legsOpened.push(name)
      if (opts.openLegThrows && opts.openLegThrows.includes(name)) throw new Error('fake openLeg failure for ' + name)
      const st = {
        rail: opts.rail || 'collapsed',
        notice: opts.notice !== false,
        selected: null,
        teamFace: false,
        // TEAM MOUNT MODEL (mirrors packages/client/src/state/team-refresh-
        // coordinator.ts:7-8/346-351 — ticks run ONLY while TeamView is
        // ATTACHED; the Chat view + TeamDock label produce COLD ROUNDS only).
        // teamTab = the conversation tabstrip state ([data-conversation-tabs]
        // ConversationSession.tsx:143-154): present/hits count ONLY role=tab
        // entries; the dock's same-text label span is NOT a tab and never
        // arms ticks (team-mount-core openTeamTab is a documented no-op).
        teamTab: {
          present: !((name === 'E1' && opts.e1TabAbsent) || (name === 'E3' && opts.e3TabAbsent)),
          hits: name === 'E3' && opts.e3TabDouble ? 2 : 1,
          label: 'Team',
          active: false, // aria-selected=true
          mounted: false, // [data-team-view] visible => coordinator ATTACHED
        },
        persistBroken: false,
        dialogOpen: false,
        dialog: { crumbs: ['Home'], selected: null, pending: null }, // probe-shaped state, async listing (pending) — DirectoryBrowser semantics
        newSessionCreated: false,
        staleReq: null,
        walk: null,
      }
      w.opened.push(st)
      const leg = name

      const rows = () => {
        if (st.rail === 'collapsed') return []
        const base = [[MEMBER_TITLE, MEMBER_ID], [ROOT_TITLE, ROOT_ID], ['ack:role-expert:pre:mpr-2026-10-01T13-21-34', OTHER_ID]]
        const shown = opts.railOrder === 'reordered'
          ? [[ROOT_TITLE, ROOT_ID], ['ack:role-expert:pre:mpr-2026-10-01T13-21-34', OTHER_ID], [MEMBER_TITLE, MEMBER_ID]]
          : base
        const filtered = opts.dropMember ? shown.filter(([t]) => t !== MEMBER_TITLE) : shown
        return st.rail === 'expanded' ? filtered.slice(0, 2) : (opts.duplicateMemberTitle ? [...filtered, [MEMBER_TITLE, MEMBER_ID]] : filtered)
      }
      const leaf = (text, y, tag = 'span', cls = 'W0d-vW_title', region = 'rail', x = 20) => ({ tag, cls, role: '', text, x, y, w: 180, h: 20, region })

      const readData = (sel) => sel.relation === 'team-member'
        ? { relation: 'team-member', memberInstanceId: MEMBER_INSTANCE, liveToken: 'lt-v1-fakevalue' }
        : sel.relation === 'team-root'
          ? { relation: 'team-root', durableGeneration: 32, liveToken: 'lt-v1-fakevalue' }
          : { relation: 'none', liveToken: null }

      const fireReq = (m, p, t = w.v) => net.recordRequest({ leg, m, rpcId: String(++w.rpc), p, t })
      // RESPONSE REPRESENTATION = the RAW WIRE BODY (frozen round-2 item 1).
      // The fake and the live Playwright callback now hand recordResponse the
      // SAME bytes ({rpcId,result:{ok,value:{data}}} JSON — push/types.ts +
      // contracts/response.ts), so the driver's parseServerResponseEnvelope
      // → record → verify chain runs offline exactly as it does live; the
      // round-1 flat-vs-raw split (fake raw object vs adapter flat parse) is
      // structurally impossible now.
      const fireRes = (req, status, data, o = {}) => net.recordResponse({
        leg,
        m: req.m,
        req,
        status,
        t: o.t ?? w.v,
        bodyText: o.rawBody !== undefined ? o.rawBody : JSON.stringify(o.envelope !== undefined ? o.envelope : { rpcId: o.rpcId ?? req.rpcId, result: o.result !== undefined ? o.result : { ok: true, value: { data } } }),
      })
      const coldRound = (sel, at = w.v) => {
        const rs = fireReq('team.getReadState', { sessionId: sel.id }, at)
        if (opts.coldResponseOverride) { opts.coldResponseOverride({ net, req: rs, fireReq, fireRes, sel, w }); return }
        fireRes(rs, 200, readData(sel), { t: at })
        if (sel.relation !== 'none') {
          const pj = fireReq('team.getProjection', { teamSessionId: ROOT_ID }, at)
          fireRes(pj, 200, { projection: true }, { t: at + 2 })
          const lg = fireReq('team.getLedgerPage', { teamSessionId: ROOT_ID, afterSequence: 0, limit: 50 }, at)
          fireRes(lg, 200, { ledger: true }, { t: at + 3 })
        }
      }
      // the [data-team-refresh] button's forced round (TeamView runRefresh:
      // ledger re-pull + member re-probe + listRoots), shared by the legacy
      // leaf click and the scoped teamRefreshControl seam path.
      const doRefresh = () => {
        if (opts.breakAfterE3 && leg === 'E3') throw new Error('fake break after E3')
        const t5 = w.v
        const lgRoot = opts.foreignLedgerOnRefresh ? OTHER_ID : ROOT_ID
        const lg = fireReq('team.getLedgerPage', { teamSessionId: lgRoot, afterSequence: 0, limit: 50 }, t5)
        fireRes(lg, 200, { ledger: true }, { t: t5 + 16 })
        const reprobeId = opts.foreignReprobeOnRefresh ? OTHER_ID : st.selected.id
        const rs = fireReq('team.getReadState', { sessionId: reprobeId }, t5 + 20)
        fireRes(rs, 200, readData(st.selected))
        fireReq('team.listRoots', {}, t5 + 25)
        w.v = t5 + 60
      }
      const tick = () => {
        if (st.newSessionCreated) {
          // the created session's poll: REQUEST every tick; the RESPONSE only
          // when the world says the transport answers (createdNoResponse keeps
          // the request unanswered — bounded wait must exhaust fail-closed).
          const rs = fireReq('team.getReadState', { sessionId: NEW_ID })
          if (opts.createdNullRpcRes) fireRes(rs, 200, undefined, { rawBody: '{"result":{"ok":true,"value":{"data":{"relation":"none","liveToken":null}}}}' })
          else if (!opts.createdNoResponse) fireRes(rs, 200, { relation: 'none', liveToken: null })
          fireReq('team.listRoots', {})
          return
        }
        if (!st.selected) return
        const sel = st.selected
        const id = (opts.tickForeignRoot && sel.relation === 'team-root') ? OTHER_ID : sel.id
        const rs = fireReq('team.getReadState', { sessionId: id })
        fireRes(rs, 200, readData(sel))
      }

      // boundary-accurate tick walk for ANY clock advance of the CURRENT leg.
      // MOUNT GATE (live-incident fix): the product's ticks are armed only
      // while TeamView is ATTACHED (coordinator :7-8/346-351) — an ordinary
      // session's created-poll and an ATTACHED team view are the only tick
      // sources; a selected-but-Chat/Chat+dock world fires COLD ROUNDS ONLY.
      const armed = () => st.newSessionCreated || (st.selected && st.teamTab.mounted)
      const walk = (ms) => {
        const target = w.v + ms
        while (armed()) {
          if (st.nextTickAt == null) st.nextTickAt = w.v + tickMs
          if (st.nextTickAt > target) break
          w.v = st.nextTickAt
          tick()
          st.nextTickAt += tickMs
        }
        w.v = target
      }
      st.walk = walk
      w.walk = walk
      const landDialogListing = () => {
        if (st.dialog.pending && w.v >= st.dialog.pending.at) {
          st.dialog.crumbs = [...st.dialog.crumbs, st.dialog.pending.seg]
          st.dialog.pending = null
        }
      }
      const crumbOf = () => st.dialog.crumbs[st.dialog.crumbs.length - 1]
      const page = {
        async gotoApp () {
          w.v += 50
          if (opts.bootTeamRequests) for (let i = 0; i < opts.bootTeamRequests; i += 1) fireReq('team.listRoots', {})
        },
        async reload () {
          w.v += 80
          // DEFAULT: the app restores the ACTIVE conversation view across
          // reload (selection persisted) — the driver still RE-VERIFIES
          // activation after reload rather than assuming it. The knob models
          // a restore failure (aria-selected never returns).
          if (opts.e1ReloadBreak) { st.persistBroken = true; st.teamTab.active = false; st.teamTab.mounted = false; st.teamFace = false }
          if (st.selected) coldRound(st.selected)
        },
        async wait (ms) {
          // ticks fire on SCHEDULED boundaries (the product tickMs cadence),
          // never per-chunk — a boundary-accurate fake keeps every inter-tick
          // delta exactly tickMs so the cadence oracle tests the driver, not
          // fake artifacts.
          walk(ms)
        },
        async screenshot (name) { w.shots.push(leg + '/' + name) },
        async collectLeaves () {
          const out = []
          let y = 78
          out.push(leaf('New Session', y, 'span', '_25B0JG_newSessionLabel')); y += 40
          out.push(leaf('Ungrouped', y)); y += 34
          for (const [title] of rows()) { out.push(leaf(title, y)); y += 34 }
          if (st.rail === 'expanded') out.push(leaf('Show 4 more sessions', y, 'button', 'HVH6QW_sessionOverflowButton'))
          if (st.selected) {
            out.push(leaf(st.selected.id, 20, 'h1', 'sessionHeader', 'main', 400))
            if (st.selected.relation !== 'none') {
              // THE LIVE-INCIDENT WORLD (raw 2026-10-01T17-43-09: teamTabHits=2):
              // the TeamDock title span (team-mount-core:846-851 openTeamTab is
              // a documented no-op) and the conversation role=tab coexist with
              // the SAME text. Text-level counting saw 2 hits and refused;
              // role=tab-scoped activation must still find exactly 1.
              out.push(leaf('Team', 60, 'span', 'dockTitle', 'main', 420))
              if (st.teamTab.present) out.push(leaf('Team', 40, 'button', 'convTabTeam', 'main', 300))
              if (st.teamTab.hits > 1) out.push(leaf('Team', 40, 'button', 'convTabTeam2', 'main', 330))
            }
            if (st.teamTab.mounted) out.push(leaf('Refresh team view', 100, 'button', 'teamRefresh', 'main', 420))
          }
          return out
        },
        async clickLeaf (l) {
          w.clicks.push(leg + ':' + l.text)
          if (l.text === 'Ungrouped') { if (!opts.railStuckCollapsed) st.rail = 'expanded'; w.v += 20; return }
          if (/^Show \d+ more sessions$/.test(l.text)) { st.rail = 'all'; w.v += 20; return }
          if (l.text === 'New Session') {
            st.dialogOpen = true
            st.dialog = { crumbs: ['Home'], selected: null, pending: null }
            // stale bait: an ordinary session that ALREADY existed gets a
            // PRE-Open readState request; its response lands late (after
            // Open). Its request is pre-Open and its id was seen pre-Open —
            // findCreatedSession must refuse it (frozen item 5).
            if (opts.staleBait) st.staleReq = fireReq('team.getReadState', { sessionId: 'session-ordinary-old-1' })
            w.v += 30
            return
          }
          if (l.text === 'Team') {
            // Legacy generic-click path ONLY (the fixed driver uses the seam
            // action activateTeamTab). The dock title button is a faithful
            // NO-OP (team-mount-core:846-851); a convTab leaf click activates
            // exactly like the seam action would.
            w.v += 20
            if (l.cls === 'dockTitle') return
            if (!st.teamTab.present || st.teamTab.hits !== 1) return
            st.teamTab.active = true; st.teamTab.mounted = true; st.teamFace = true
            if (st.nextTickAt == null) st.nextTickAt = w.v + tickMs
            return
          }
          if (l.text === 'Refresh team view') { doRefresh(); return }
          const hit = rows().find(([title]) => title === l.text)
          if (hit) {
            st.selected = { id: hit[1], relation: hit[1] === ROOT_ID ? 'team-root' : 'team-member', title: hit[0] }
            w.v += 10
            st.nextTickAt = w.v + tickMs
            coldRound(st.selected)
          }
        },
        async parkMouse () { w.v += 5 },
        async dismissNoticeIfVisible () {
          if (!st.notice) return 'absent'
          if (opts.noticeUndismissable) return 'present-undismissable'
          st.notice = false; w.v += 10; return 'dismissed'
        },
        // ── seam activation / ready actions (the SAME call runDriverCore makes
        // live through the Playwright adapter — no selector-string-only test) ──
        async activateTeamTab ({ names = [], phase = '', budgetMs = 6000 } = {}) {
          w.v += 10
          if (leg === 'E3' && opts.breakBeforeE3) throw new Error('fake break before E3')
          const t = st.teamTab
          if (!st.selected || st.selected.relation === 'none') return { ok: false, phase, reason: 'team-tab-not-found (no conversation view for this session)' }
          if (!t.present) return { ok: false, phase, reason: 'team-tab-not-found under [data-conversation-tabs] role=tab allowlist (' + names.join('/') + ') — Chat-only mount' }
          if (t.hits > 1) return { ok: false, phase, reason: 'team-tab-ambiguous (' + t.hits + ' role=tab hits) — never guess' }
          if (!names.includes(t.label)) return { ok: false, phase, reason: 'team-tab-label-not-in-allowlist ' + JSON.stringify(t.label) }
          if (t.active && t.mounted) return { ok: true, phase, alreadyArmed: true }
          if (st.persistBroken) { w.v += budgetMs; return { ok: false, phase, reason: 'team-tab-not-armed: aria-selected=false within ' + budgetMs + 'ms bounded verify — selection did not persist across reload' } }
          if (opts.e3TabNoop && leg === 'E3') { w.v += budgetMs; return { ok: false, phase, reason: 'team-tab-not-armed: aria-selected=false data-team-view-visible=false within ' + budgetMs + 'ms bounded verify' } }
          t.active = true; t.mounted = true; st.teamFace = true
          if (st.nextTickAt == null) st.nextTickAt = w.v + tickMs
          return { ok: true, phase, armed: true }
        },
        async teamRefreshControl ({ names = [], click = false } = {}) {
          if (!st.teamTab.mounted) return { ok: false, reason: 'team-refresh-control-not-found ([data-team-view] absent — TeamView not mounted/ready)' }
          const label = opts.refreshForeignLabel || 'Refresh team view'
          if (!names.includes(label)) return { ok: false, reason: 'team-refresh-label-not-in-allowlist ' + JSON.stringify(label) }
          if (!click) { w.v += 5; return { ok: true, label } }
          w.clicks.push(leg + ':team-refresh')
          doRefresh()
          return { ok: true, label, clicked: true }
        },
        async dialogSnapshot () {
          if (!st.dialogOpen) return { open: false, title: null, crumbLabels: [], rows: [], buttons: [] }
          // async listDirectory landing: the crumb trail advances ONLY when
          // the selected folder's listing arrives (DirectoryBrowser :506/:688
          // child ?? parent) — never synchronously on click.
          landDialogListing()
          const crumbs = opts.foreignCrumbRoot ? ['Documents'] : st.dialog.crumbs.slice()
          const cols = crumbs.map((c) => {
            if (c === 'Home' && opts.listingsWithNearMiss) return { folders: ['workspace-old', 'team-workspace', 'workspace copy'], buttons: ['New folder', 'Show hidden files', 'Cancel', 'Open'] }
            return listings[c] || { folders: [], buttons: ['New folder', 'Show hidden files', 'Cancel', 'Open'] }
          })
          const rows = []
          cols.forEach((here, level) => here.folders.forEach((name) => rows.push({
            level,
            name,
            selected: !!st.dialog.selected && st.dialog.selected.level === level && st.dialog.selected.name === name,
          })))
          const deepestButtons = cols[cols.length - 1].buttons
          // shape parity with the REAL probe output: dialogStateFrom returns
          // EVERY button in the dialog (crumb buttons + row buttons + footer).
          const footer = ['New folder', 'Show hidden files', ...deepestButtons.filter((b) => b !== 'New folder' && b !== 'Show hidden files')]
          return {
            open: true,
            title: opts.dialogTitleZh ? '选择工作区目录' : 'Select Workspace Directory',
            crumbLabels: crumbs,
            rows,
            buttons: [...crumbs, ...rows.map((r) => r.name), ...footer],
          }
        },
        async dialogClickFolder (name) {
          w.v += 15
          w.clicks.push(leg + ':dialog:' + name)
          landDialogListing()
          const deepest = st.dialog.crumbs.length - 1
          let here = listings[crumbOf()] || { folders: [] }
          if (deepest === 0 && opts.listingsWithNearMiss) here = { folders: ['workspace-old', 'team-workspace', 'workspace copy'] }
          if (!here.folders.includes(name)) return // click on nothing — state MUST not advance
          st.dialog.selected = { level: deepest, name } // select(): aria-current lands on the row button IMMEDIATELY (:499-503)
          if ((opts.dialogBehavior || 'drill') === 'select-only') return // listing NEVER lands => crumb never advances (drill-in broken world)
          st.dialog.pending = { seg: name, at: w.v + (opts.dialogListingDelayMs ?? 0) } // child listing arrives ASYNC (:506)
        },
        async dialogClickButton (name) {
          w.v += 15
          if (name === 'Cancel' || name === '取消') { st.dialogOpen = false; w.canceledDialogs += 1; return }
          if (name !== 'Open' && name !== '打开') return
          st.dialogOpen = false
          st.newSessionCreated = true
          st.selected = { id: NEW_ID, relation: 'none', title: 'ping' }
          // the created session's readState runs on the PRODUCT CADENCE from
          // the Open commit — the round-1 fake emitted it synchronously and
          // hid the live E2 race; the driver must bounded-WAIT for it.
          st.nextTickAt = w.v + tickMs * (opts.createdResponseDelayTicks || 1)
          if (opts.staleBait && st.staleReq) fireRes(st.staleReq, 200, { relation: 'none', liveToken: null }, { t: w.v + 1500 })
          w.v += 30
        },
        async fillComposer (text) { st.composerText = text; w.v += 10 },
      }
      return { page, close: async () => { w.closedContexts += 1 } }
    },
  }
  return { w, io }
}

function makeMemFs (files) {
  const written = new Map()
  return {
    written,
    readFileSync: (p) => { if (p in files) return files[p]; throw new Error('ENOENT(memfs) ' + p) },
    readdirSync: (dir) => Object.keys(files).filter((p) => p.startsWith(dir + '/')).map((p) => p.slice(dir.length + 1)).filter((p) => !p.includes('/')),
    existsSync: (p) => p in files || written.has(p),
    mkdirSync: () => {},
    writeFileSync: (p, data) => { written.set(p, data) },
    statSync: (p) => ({ isDirectory: () => false, isFile: () => p in files }),
  }
}

const proj = (id, cwd, title) => [`/world/storages/session_projcache/sessions/${id}.json`, JSON.stringify({ record: { rows: { title: { val: title } }, identity: { cwd } } })]

function stdFiles (extra = {}) {
  const files = Object.fromEntries([
    ['/world/browser-access.json', JSON.stringify({ launchUrl: 'http://127.0.0.1:3181/?token=FAKEt0kenValue4Test', origin: 'http://127.0.0.1:3181' })],
    ['/world/smoke-host.json', JSON.stringify({ origin: 'http://127.0.0.1:3181', t1: ROOT_ID, t1MemberSession: MEMBER_ID, t1MemberInstance: MEMBER_INSTANCE })],
    proj(ROOT_ID, '/srv/x', ROOT_TITLE),
    proj(MEMBER_ID, '/srv/x', MEMBER_TITLE),
    proj(OTHER_ID, '/srv/x', 'ack:role-expert:pre:mpr-2026-10-01T13-21-34'),
    ...Object.entries(extra),
  ])
  return files
}

// the default round: nested fixture under an explicit authorized root
function stdCfg (over = {}) {
  return {
    accessPath: '/world/browser-access.json',
    smokeHostPath: '/world/smoke-host.json',
    world: '/world',
    out: '/out',
    testWorkspace: '/home/user/testhome/ws',
    authorizedRoot: '/home/user/testhome',
    ...over,
  }
}

async function runCore (opts = {}, cfgOver = {}, filesOver = {}) {
  const { w, io } = makeWorld(opts)
  const cfg = stdCfg(cfgOver)
  io.fs = makeMemFs(stdFiles({
    [`/world/storages/session_projcache/sessions/${NEW_ID}.json`]: JSON.stringify({ record: { identity: { cwd: cfg.testWorkspace }, rows: { title: { val: 'ping' } } } }),
    ...filesOver,
  }))
  const out = await D.runDriverCore(cfg, io)
  return { out, w, io }
}

// ══════════════ P1 — E1 preClick boundary & cold-window delimitation ════════
test('P1: E1 PASSES — preClick is measured AT the click (the click cold round is NOT preClick), window = reload cold round, member-first', async () => {
  const { out } = await runCore({})
  assert.equal(out.legs.E1.verdict, 'PASS', 'E1 must PASS: ' + JSON.stringify(out.legs.E1))
  assert.equal(out.legs.E1.measured.preClickTeamReqs, 0, 'old impl counted the whole navigation (verify readStates included) => frozen PASS was impossible')
  assert.equal(out.legs.E1.measured.firstIsMember, true)
  const s = D.summarize(out)
  assert.equal(s.exitCode, 0, 'all browser legs PASS => exit 0: ' + JSON.stringify(s.verdicts))
})

test('P1: pre-click boot traffic is honestly attributed to preClick and FAILs the frozen oracle (not hidden)', async () => {
  const { out } = await runCore({ bootTeamRequests: 1 })
  assert.equal(out.legs.E1.verdict, 'FAIL', 'preClick guards exactly the pre-click traffic (frozen oracle, not weakened)')
  assert.equal(out.legs.E1.measured.preClickTeamReqs, 1)
})

test('P1: the member cold open never visits the root session first — zero pre-click requests, first readState is the member', async () => {
  const { out } = await runCore({})
  const pre = out.net.filter((e) => e.kind === 'req' && e.seq <= out.legs.E1.clickSeq)
  assert.equal(pre.length, 0, 'fresh context stayed silent until the member click')
  const first = out.net.find((e) => e.kind === 'req' && e.m === 'team.getReadState')
  assert.equal(first.p.sessionId, MEMBER_ID)
})

// ══════════════ P4 — selection ⇄ correlated-response binding ════════════════
test('P4: a response with a FOREIGN rpcId never authenticates the selection — NOT_RUN fail-closed', async () => {
  const { out } = await runCore({
    coldResponseOverride: ({ req, fireRes }) => {
      // RAW wire text with a FOREIGN rpcId (the real transport shape) — the
      // parse succeeds, the correlation fails.
      fireRes(req, 200, undefined, {
        rawBody: JSON.stringify({ rpcId: 'ffffffff', result: { ok: true, value: { data: { relation: 'team-member', memberInstanceId: MEMBER_INSTANCE, liveToken: 'lt-v1-fakevalue' } } } }),
      })
    },
  })
  assert.equal(out.legs.E1.verdict, 'NOT_RUN')
  assert.match(out.legs.E1.reason, /selection-unverified/, JSON.stringify(out.legs.E1.reason))
})

test('P4: a FAILED response for the exact request (envelope ok:false) rejects verification', async () => {
  const { out } = await runCore({
    coldResponseOverride: ({ req, fireRes }) => {
      // RAW wire text of a FAILED envelope for the RIGHT rpcId — 2xx + ok:false
      fireRes(req, 200, undefined, { rawBody: JSON.stringify({ rpcId: req.rpcId, result: { ok: false, error: { code: 'internal', message: 'boom', details: {} } } }) })
    },
  })
  assert.match(out.legs.E1.reason, /selection-unverified/)
})

test('P4: a late foreign response body (correct text, bound to a STALE pre-click request) rejects — no leg+method bucket authentication', async () => {
  const { out } = await runCore({
    coldResponseOverride: ({ fireReq, fireRes }) => {
      const stale = fireReq('team.getReadState', { sessionId: MEMBER_ID }, 1) // t far before the click
      fireRes(stale, 200, { relation: 'team-member', memberInstanceId: MEMBER_INSTANCE }, { t: 9_999_999 })
    },
  })
  assert.match(out.legs.E1.reason, /selection-unverified/, 'the old verify accepted ANY fresh body containing the relation string')
})

test('P4: the E2 created-session id comes from a SUCCESS relation-none correlated response, never from an exclusion guess', async () => {
  const { out } = await runCore({})
  assert.equal(out.legs.E2.workspaceCwdCheck.sessionId, NEW_ID)
  assert.equal(out.legs.E2.workspaceCwdCheck.signal, 'session_projcache record.identity.cwd')
  assert.equal(out.legs.E2.workspaceCwdCheck.ok, true)
})

// ══════════════ P2/P6 — real dialog state + explicit authorization ══════════
test('P2: the dialog is driven through REAL dialog state (snapshot + crumb verify + exact folder selection); E2 PASSES', async () => {
  const { out, w } = await runCore({})
  assert.equal(out.legs.E2.verdict, 'PASS', JSON.stringify(out.legs.E2))
  assert.deepEqual(out.legs.E2.workspacePlan, ['cd:testhome', 'select:ws', 'open', 'assert-dialog-closed', 'verify-session-cwd:/home/user/testhome/ws'])
  assert.ok(w.clicks.includes('E2:New Session'))
})

test('P6: an explicit --test-workspace is REQUIRED — missing => fatal BEFORE any browser leg opens', async () => {
  const { w, io } = makeWorld({})
  io.fs = makeMemFs(stdFiles())
  const out = await D.runDriverCore(stdCfg({ testWorkspace: undefined }), io)
  assert.match(out.fatal, /test-workspace|testWorkspace/i)
  assert.equal(w.openLegCalls, 0, 'no browser leg may open before workspace authorization')
})

test('P6: authorization is filesystem containment (realpath) — a symlink-escaping workspace dies before any leg', async () => {
  const { w, io } = makeWorld({ realpaths: { '/home/user/testhome/ws': '/elsewhere/private/ws' } })
  io.fs = makeMemFs(stdFiles())
  const out = await D.runDriverCore(stdCfg({}), io)
  assert.match(out.fatal, /contain|authoriz|real|escape/i)
  assert.equal(w.openLegCalls, 0)
})

test('P6: an authorized root that IS the private home is rejected (too broad, never a wide-dir fallback)', async () => {
  const { io, w } = makeWorld({})
  io.fs = makeMemFs(stdFiles())
  const out = await D.runDriverCore(stdCfg({ authorizedRoot: HOME }), io)
  assert.match(out.fatal, /home|broad|authoriz/i)
  assert.equal(w.openLegCalls, 0)
})

test('P6: a DEEPER nested fixture is reached level-by-level with crumb verification (no direct-child-of-home rule)', async () => {
  const { out } = await runCore({
    cdSegments: ['testhome', 'fixtures'],
    leafFolder: 'ws',
    listings: {
      Home: { folders: ['bin', 'testhome', 'workspace'], buttons: ['New folder', 'Cancel', 'Open'] },
      testhome: { folders: ['fixtures'], buttons: ['Cancel', 'Open'] },
      fixtures: { folders: ['ws', 'ws-old'], buttons: ['Cancel', 'Open'] },
    },
  }, { testWorkspace: '/home/user/testhome/fixtures/ws' })
  assert.equal(out.legs.E2.verdict, 'PASS', JSON.stringify(out.legs.E2))
  assert.deepEqual(out.legs.E2.workspacePlan, ['cd:testhome', 'cd:fixtures', 'select:ws', 'open', 'assert-dialog-closed', 'verify-session-cwd:/home/user/testhome/fixtures/ws'])
})

test('P6: a dialog that cannot drill to an ancestor fails CLOSED — Cancel asserted, NEVER Open on a broader dir', async () => {
  const { out, w } = await runCore({ dialogBehavior: 'select-only', cdSegments: ['testhome', 'fixtures'], leafFolder: 'ws' }, { testWorkspace: '/home/user/testhome/fixtures/ws' })
  assert.equal(out.legs.E2.verdict, 'NOT_RUN')
  assert.match(out.legs.E2.reason, /testhome|ancestor|crumb|folder/i)
  assert.equal(w.canceledDialogs, 1, 'the modal is left UNCONFIRMED via Cancel')
  assert.equal(w.opened[w.opened.length - 1].newSessionCreated, false, 'no session was ever Opened on a broader directory')
})

test('P6: near-miss names are rejected and the modal is canceled, never guessed', async () => {
  const { out, w } = await runCore({ listingsWithNearMiss: true, cdSegments: ['testhome'], leafFolder: 'ws' })
  assert.equal(out.legs.E2.verdict, 'NOT_RUN')
  assert.equal(w.canceledDialogs, 1)
})

test('P6: a dialog on a foreign crumb root is rejected before Open', async () => {
  const { out, w } = await runCore({ foreignCrumbRoot: true })
  assert.equal(out.legs.E2.verdict, 'NOT_RUN')
  assert.match(out.legs.E2.reason, /root/i)
  const e2state = w.opened[w.opened.length - 1]
  assert.equal(e2state.newSessionCreated, false)
})

test('P6: post-Open cwd mismatch (record.identity.cwd) still fail-closes E2', async () => {
  const { out } = await runCore({}, {}, {
    [`/world/storages/session_projcache/sessions/${NEW_ID}.json`]: JSON.stringify({ record: { identity: { cwd: '/home/user/elsewhere' }, rows: { title: { val: 'ping' } } } }),
  })
  assert.equal(out.legs.E2.verdict, 'NOT_RUN')
  assert.equal(out.legs.E2.workspaceCwdCheck.ok, false)
})

// ══════════════ P3/P5 — E3 window boundary, configured cadence, root id ═════
test('P3+P5: the E3 window INCLUDES the navigation cold round (1 projection + 1 ledger) and the cadence band comes from the injected product interval', async () => {
  const { out } = await runCore({ tickMs: 1000 })
  assert.equal(out.legs.E3E5.E3.verdict, 'PASS', 'old oracle FAILs a 1000ms cadence (hardcoded 2700-3300); new uses the injected interval')
  const m = out.legs.E3E5.E3.measured
  assert.equal(m.projections, 1, 'the counted cold projection is the one the navigation produced (window starts at the click)')
  assert.equal(m.ledger, 1)
  assert.ok(m.deltasMs.length >= 6, '>=6 target ticks recorded: ' + JSON.stringify(m.deltasMs))
  assert.ok(m.deltasMs.every((d) => d >= 900 && d <= 1300), 'actual deltas stay near the injected interval: ' + JSON.stringify(m.deltasMs))
  assert.equal(m.rootIdentityOk, true)
})

test('P5: ticks on a FOREIGN root FAIL even with perfect cadence (old evalE3 ignored expectedRootId entirely)', async () => {
  const { out } = await runCore({ tickForeignRoot: true })
  assert.equal(out.legs.E3E5.E3.verdict, 'FAIL')
  assert.equal(out.legs.E3E5.E3.measured.rootIdentityOk, false)
})

test('E5: exactly one {afterSequence:0,limit:50} ledger after the refresh click, zero projections, latency recorded from the correlated response', async () => {
  const { out } = await runCore({ tickMs: 1000 })
  assert.equal(out.legs.E3E5.E5.verdict, 'PASS', JSON.stringify(out.legs.E3E5.E5))
  assert.equal(out.legs.E3E5.E5.measured.projectionsAfter, 0)
  assert.equal(out.legs.E3E5.E5.measuredExtra.ledgerResponseLatencyMs, 16)
})

// ══════════════ navigation fail-closed shapes (orchestration callers) ═══════
test('NAV: rail stuck collapsed after the group click (v3 hazard inverted) => NOT_RUN, never a blind locate', async () => {
  const { out } = await runCore({ railStuckCollapsed: true })
  assert.equal(out.legs.E1.verdict, 'NOT_RUN')
  assert.match(out.legs.E1.reason, /ungrouped/i)
})

test('NAV: duplicate canonical title => AMBIGUOUS fail-closed (locateTitle caller contract)', async () => {
  const { out } = await runCore({ duplicateMemberTitle: true })
  assert.equal(out.legs.E1.verdict, 'NOT_RUN')
  assert.match(out.legs.E1.reason, /locate-ambiguous/)
})

test('NAV: recency-reordered rail is irrelevant — title-exact locate still PASSES', async () => {
  const { out } = await runCore({ railOrder: 'reordered' })
  assert.equal(out.legs.E1.verdict, 'PASS', JSON.stringify(out.legs.E1))
})

test('NAV: target missing => locate-not_found fail-closed (neighbors exist and are never picked)', async () => {
  const { out } = await runCore({ dropMember: true })
  assert.equal(out.legs.E1.verdict, 'NOT_RUN')
  assert.match(out.legs.E1.reason, /locate-not_found/)
})

test('NAV: present-but-undismissable notice => fail-closed NOT_RUN', async () => {
  const { out } = await runCore({ noticeUndismissable: true })
  assert.equal(out.legs.E1.verdict, 'NOT_RUN')
  assert.match(out.legs.E1.reason, /notice/i)
})

// ══════════════ P7 — aggregation, exit discipline, no stamping ══════════════
test('P7: a crash AFTER E3 keeps the nested E3 verdict; E5 becomes an explicit NOT_RUN; no parent stamping; exit 2', async () => {
  const { out } = await runCore({ breakAfterE3: true })
  const s = D.summarize(out)
  assert.equal(out.legs.E3E5.E3.verdict, 'PASS', 'the parent must never overwrite the nested verdicts')
  assert.equal(out.legs.E3E5.E5, undefined, 'the crash left no raw E5 record — only summarize() materializes it')
  assert.equal(s.verdicts.E3, 'PASS')
  assert.equal(s.verdicts.E5, 'NOT_RUN')
  assert.equal(s.ok, false)
  assert.equal(s.exitCode, 2, 'NOT_RUN is never a PASS — exit 2')
})

test('P7: any FAIL => exit 1, ok=false; E4 stays a declared NOT_RUN and never fails the run', async () => {
  const { out } = await runCore({ bootTeamRequests: 1 })
  const s = D.summarize(out)
  assert.equal(s.verdicts.E1, 'FAIL')
  assert.equal(s.ok, false)
  assert.equal(s.exitCode, 1, 'FAIL outranks NOT_RUN: ' + JSON.stringify(s.verdicts))
  assert.equal(s.verdicts.E4, 'NOT_RUN')
})

test('P7: fatal (unreadable access record) => out.fatal + exit 3 + output written + zero legs opened', async () => {
  const { io, w } = makeWorld({})
  io.fs = makeMemFs({})
  const out = await D.runDriverCore(stdCfg({}), io)
  assert.match(out.fatal, /access/i)
  const s = D.summarize(out)
  assert.equal(s.exitCode, 3)
  assert.equal(s.ok, false)
  assert.equal(w.openLegCalls, 0)
  assert.ok(io.fs.written.has('/out/dod20-driver-out.json'), 'out.json is written even on the fatal path')
})

test('P7: driver-crash legs => NOT_RUN + driver-error reason (never FAIL), exit 2 (old code: ok=true, exit 0)', async () => {
  const { out } = await runCore({ openLegThrows: ['E1', 'E2'] })
  const s = D.summarize(out)
  assert.equal(s.verdicts.E1, 'NOT_RUN')
  assert.equal(s.verdicts.E2, 'NOT_RUN')
  assert.match(out.legs.E1.reason, /driver-error/)
  assert.equal(s.exitCode, 2)
})

// ══════════════ auth hygiene through the full orchestration ═════════════════
test('AUTH: the launch token and liveToken values never reach the written out.json', async () => {
  const { io } = await runCore({})
  const text = io.fs.written.get('/out/dod20-driver-out.json')
  assert.ok(text, 'out.json written')
  assert.ok(!text.includes('FAKEt0kenValue4Test'), 'launch token must never be serialized')
  assert.ok(!/"launchUrl"/.test(text), 'the launchUrl key is stripped')
  assert.ok(!/lt-v1-fakevalue/.test(text), 'liveToken values are masked end-to-end')
})

// ══════════════ round-2 frozen batch (external review @ d6f940ae) ═══════════
// R2-1 RESPONSE REPRESENTATION: the fakes now hand the SAME raw wire body the
// live Playwright callback hands the NetworkLog; the real parse→record→verify
// chain is exercised offline on every PASS (a flat pre-parsed body can no
// longer pass as success — the round-1 live-vs-fake split).
test('R2-1: raw wire body -> parseServerResponseEnvelope -> record -> verifySelection (the live adapter chain, offline)', () => {
  const net = D.createNetworkLog()
  const req = net.recordRequest({ leg: 'E1', m: 'team.getReadState', rpcId: '42', p: { sessionId: MEMBER_ID }, t: 100 })
  net.recordResponse({
    leg: 'E1', m: 'team.getReadState', req, status: 200, t: 110,
    bodyText: JSON.stringify({ type: 'server-response', rpcId: '42', result: { ok: true, value: { data: { relation: 'team-member', memberInstanceId: MEMBER_INSTANCE, liveToken: 'lt-v1-fakevalue' } } } }),
  })
  const e = net.resps('E1')[0]
  assert.equal(e.ok, true, 'a REAL success envelope body records ok:true (round-1: the adapter recorded ok:false for every real success)')
  assert.equal(e.rpcId, '42')
  assert.equal(e.data.memberInstanceId, MEMBER_INSTANCE)
  const v = D.verifySelection({
    headerLeaves: [{ text: MEMBER_ID }],
    freshRequests: net.reqs('E1'),
    freshResponses: net.resps('E1'),
    expected: { sessionId: MEMBER_ID, relation: 'team-member', instance: MEMBER_INSTANCE },
    clickT: 50,
  })
  assert.equal(v.verified, true, JSON.stringify(v))
  // the round-1 adapter's PRE-PARSED FLAT shape is not the wire shape: it now
  // records as uncorrelated (fails closed), never as a silent ok:false success
  // that verifySelection might misread — and never as ok:true.
  const req2 = net.recordRequest({ leg: 'E1', m: 'team.getReadState', rpcId: '43', p: { sessionId: MEMBER_ID }, t: 200 })
  net.recordResponse({ leg: 'E1', m: 'team.getReadState', req: req2, status: 200, t: 210, bodyText: JSON.stringify({ rpcId: '43', ok: true, data: { relation: 'team-member', memberInstanceId: MEMBER_INSTANCE } }) })
  const flat = net.entries[net.entries.length - 1]
  assert.equal(flat.ok, false)
  assert.equal(flat.error, 'unparseable-envelope')
})

test('R2-3: an ancestor listing that lands LATE (async listDirectory) is BOUNDED-WAITED for the exact crumb path — no premature Cancel; E2 PASSES', async () => {
  const { out, w } = await runCore({ dialogListingDelayMs: 2500 })
  assert.equal(out.legs.E2.verdict, 'PASS', JSON.stringify(out.legs.E2))
  assert.equal(w.canceledDialogs, 0, 'a legitimately-lagging listing must never trigger the fail-closed Cancel')
})

test('R2-4: the created-session response arriving only on the product cadence (delayed ticks) still verifies E2 through the bounded wait', async () => {
  const { out } = await runCore({ createdResponseDelayTicks: 3 })
  assert.equal(out.legs.E2.verdict, 'PASS', JSON.stringify(out.legs.E2))
  assert.equal(out.legs.E2.workspaceCwdCheck.sessionId, NEW_ID)
  assert.ok(out.legs.E2.createdSessionWait.polls >= 5, 'the driver really waited across cadence boundaries: ' + JSON.stringify(out.legs.E2.createdSessionWait))
})

test('R2-4b: no created-session response within the cadence-derived budget => bounded NOT_RUN fail-closed (no identity is ever fabricated)', async () => {
  const { out, w } = await runCore({ createdNoResponse: true })
  assert.equal(out.legs.E2.verdict, 'NOT_RUN')
  assert.match(out.legs.E2.reason, /bounded|exhausted/, JSON.stringify(out.legs.E2.reason))
  assert.equal(out.legs.E2.workspaceCwdCheck.ok, false)
  assert.equal(out.legs.E2.createdSessionWait.budgetMs, 5 * 3000 + 2000)
  assert.ok(w.closedContexts >= 1, 'the leg dies fail-closed with its context closed')
})

test('R2-5: a PRE-Open ordinary request whose response lands after Open can never impersonate the created session', async () => {
  const { out } = await runCore({ staleBait: true })
  assert.equal(out.legs.E2.verdict, 'PASS', JSON.stringify(out.legs.E2))
  assert.equal(out.legs.E2.workspaceCwdCheck.sessionId, NEW_ID, 'never the stale ordinary session that was already being polled pre-Open')
})

test('R2-5b: a relation-none response WITHOUT a wire rpcId never authenticates anything (non-null correlation, symmetric with verifySelection)', async () => {
  const { out } = await runCore({ createdNullRpcRes: true })
  assert.equal(out.legs.E2.verdict, 'NOT_RUN')
  assert.match(out.legs.E2.reason, /bounded|exhausted|correlated/, JSON.stringify(out.legs.E2.reason))
})

test('R2-6: a post-refresh ledger page fetched for a FOREIGN teamSessionId FAILS E5 (root binding, orchestration-level)', async () => {
  const { out } = await runCore({ foreignLedgerOnRefresh: true, tickMs: 1000 })
  assert.equal(out.legs.E3E5.E3.verdict, 'PASS', 'E5 root binding must not regress E3')
  assert.equal(out.legs.E3E5.E5.verdict, 'FAIL')
  assert.equal(out.legs.E3E5.E5.measured.ledgerOnExpectedRoot, false)
  assert.equal(D.summarize(out).exitCode, 1)
})

test('R2-6b: a post-refresh reprobe of a FOREIGN sessionId FAILS E5', async () => {
  const { out } = await runCore({ foreignReprobeOnRefresh: true, tickMs: 1000 })
  assert.equal(out.legs.E3E5.E5.verdict, 'FAIL')
  assert.equal(out.legs.E3E5.E5.measured.reprobesOnExpectedRoot, false)
})

test('P7b: a crash BEFORE E3 is computed materializes BOTH nested legs as NOT_RUN (exit 2, no parent stamping)', async () => {
  const { out } = await runCore({ breakBeforeE3: true })
  assert.equal(out.legs.E3E5.E3, undefined)
  assert.equal(out.legs.E3E5.E5, undefined)
  const s = D.summarize(out)
  assert.equal(s.verdicts.E3, 'NOT_RUN')
  assert.equal(s.verdicts.E5, 'NOT_RUN')
  assert.equal(s.exitCode, 2, 'NOT_RUN is never a PASS: ' + JSON.stringify(s.verdicts))
})

// ───────── LIVE-INCIDENT batch (raw 2026-10-01T17-43-09, teamTabHits=2) ─────────
// Scope FROZEN by the coordinator: activation of the REAL conversation tab +
// attach-verified observation windows. No further scenario additions.
test('LIVE-INCIDENT: dock-Team + role=tab Team coexist (old text count saw 2 hits) — the driver activates the REAL tab, E3 PASSes, E5 clicks the scoped [data-team-refresh]', async () => {
  const { out, w } = await runCore({})
  assert.equal(out.legs.E3E5.teamTabActivation.ok, true)
  assert.equal(out.legs.E3E5.E3.verdict, 'PASS')
  assert.equal(out.legs.E3E5.E5.verdict, 'PASS')
  assert.ok(!w.clicks.some((c) => c.endsWith(':Team')), 'no generic Team-text click ever happens — the dock label is never clicked')
  assert.ok(w.clicks.includes('E3:team-refresh'), 'E5 goes through the scoped data-team-refresh action')
})
test('LIVE-INCIDENT wall-clock: phase windows recorded as driver WALL time (network span is not a substitute)', async () => {
  const { out } = await runCore({})
  const w1 = out.legs.E1.observationWindow
  assert.equal(out.legs.E1.teamTabActivationPostReload.alreadyArmed, true, 'post-reload verify takes the idempotent alreadyArmed path')
  assert.ok(w1 && w1.wallMs >= 10000, 'E1 reload window wall time recorded and >= the 10000ms wait: ' + JSON.stringify(w1))
  const w3 = out.legs.E3E5.E3WindowWall
  assert.ok(w3 && w3.wallMs >= 29000, 'E3 window = 10000 + 6*tickMs+1000 recorded: ' + JSON.stringify(w3))
})
test('E3/E5: no role=tab Team anywhere → NOT_RUN (driver precondition), NEVER a product FAIL; other legs unaffected; exit 2', async () => {
  const { out } = await runCore({ e3TabAbsent: true })
  assert.equal(out.legs.E3E5.E3.verdict, 'NOT_RUN')
  assert.match(out.legs.E3E5.E3.reason, /team-view-not-armed: team-tab-not-found/)
  assert.equal(out.legs.E3E5.E5.verdict, 'NOT_RUN')
  assert.match(out.legs.E3E5.E5.reason, /team-view-not-armed/)
  assert.equal(out.legs.E1.verdict, 'PASS')
  assert.equal(D.summarize(out).exitCode, 2)
})
test('E3: two role=tab Team hits → NOT_RUN ambiguous — never guess, never click', async () => {
  const { out, w } = await runCore({ e3TabDouble: true })
  assert.equal(out.legs.E3E5.E3.verdict, 'NOT_RUN')
  assert.match(out.legs.E3E5.E3.reason, /team-tab-ambiguous \(2 role=tab hits\)/)
  assert.equal(out.legs.E3E5.teamTabActivation.ok, false)
  assert.ok(!w.clicks.some((c) => c.endsWith(':Team')))
})
test('E3: tab click never arms (aria-selected/[data-team-view] never verified true) → bounded-verify NOT_RUN', async () => {
  const { out } = await runCore({ e3TabNoop: true })
  assert.equal(out.legs.E3E5.E3.verdict, 'NOT_RUN')
  assert.match(out.legs.E3E5.E3.reason, /team-tab-not-armed: aria-selected=false/)
})
test('E1: activation before the cold reload is the precondition — absent tab → NOT_RUN with reason, never a FAIL', async () => {
  const { out } = await runCore({ e1TabAbsent: true })
  assert.equal(out.legs.E1.verdict, 'NOT_RUN')
  assert.match(out.legs.E1.reason, /E1-team-view-not-armed/)
  assert.equal(out.legs.E2.verdict, 'PASS')
})
test('E1: reload loses the active tab → post-reload re-verification NOT_RUNs the leg (readStates threshold UNCHANGED)', async () => {
  const { out } = await runCore({ e1ReloadBreak: true })
  assert.equal(out.legs.E1.teamTabActivation.ok, true, 'armed BEFORE reload')
  assert.equal(out.legs.E1.teamTabActivationPostReload.ok, false)
  assert.equal(out.legs.E1.verdict, 'NOT_RUN')
  assert.match(out.legs.E1.reason, /did not persist across reload/)
})
test('E5: refresh label outside the allowlist (after correct scoping) → NOT_RUN, E3 result preserved', async () => {
  const { out } = await runCore({ refreshForeignLabel: 'Reload view' })
  assert.equal(out.legs.E3E5.E3.verdict, 'PASS')
  assert.equal(out.legs.E3E5.E5.verdict, 'NOT_RUN')
  assert.match(out.legs.E3E5.E5.reason, /team-refresh-label-not-in-allowlist/)
})
// R2 supplement (delta-3, P2): pin the fake MOUNT GATE itself so the 18/18
// RED reproducibility no longer rests on an unasserted world property.
test('WORLD-FIDELITY: unattached Chat+dock = COLD ROUNDS ONLY across a long wait; only real activation arms ticks (kills the selected-gate mutation)', async () => {
  const { io } = makeWorld({})
  const seen = []
  const netStub = {
    recordRequest: (e) => { const en = { ...e, seq: seen.length + 1 }; seen.push(en); return en },
    recordResponse: (e) => ({ ...e }),
  }
  const leg = await io.openLeg('E3', netStub)
  const page = leg.page
  await page.gotoApp('http://127.0.0.1:3181/app')
  await page.clickLeaf((await page.collectLeaves()).find((l) => l.text === 'Ungrouped'))
  const root = (await page.collectLeaves()).find((l) => l.text === ROOT_TITLE)
  await page.clickLeaf(root) // the nav click's COLD round (readState+projection+ledger)
  const rs = () => seen.filter((e) => e.kind === undefined || e.kind === 'req').filter((e) => e.m === 'team.getReadState').length
  const cold = rs()
  assert.equal(cold, 1, 'the cold round produced exactly one readState')
  await page.wait(20000) // Chat view active, TeamDock label present: the product's ticks are PAUSED
  assert.equal(rs(), cold, 'unattached: 20 virtual seconds add ZERO readStates (hidden->paused, coordinator :7-8)')
  const act = await page.activateTeamTab({ names: ['Team', '团队'], phase: 'world-fidelity' })
  assert.equal(act.ok, true)
  await page.wait(20000)
  assert.ok(rs() >= cold + 5, 'attached: ticks flow at cadence — readStates ' + rs())
  await leg.close()
})
