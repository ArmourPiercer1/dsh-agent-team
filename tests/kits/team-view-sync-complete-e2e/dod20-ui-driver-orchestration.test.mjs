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
  }
  const tickMs = opts.tickMs || 3000
  const listings = opts.listings || DEFAULT_LISTINGS

  const io = {
    fs: null, // replaced per test via makeMemFs
    realpathSync: (p) => (opts.realpaths && opts.realpaths[p]) || p,
    homedir: () => HOME,
    now: () => w.v,
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
        dialogOpen: false,
        dialog: { crumb: 0, selected: null },
        newSessionCreated: false,
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
      const fireRes = (req, status, data, o = {}) => net.recordResponse({
        leg,
        m: req.m,
        req,
        status,
        t: o.t ?? w.v,
        envelope: o.envelope !== undefined ? o.envelope : { rpcId: o.rpcId ?? req.rpcId, result: o.result !== undefined ? o.result : { ok: true, value: { data } } },
        bodyText: o.rawBody ?? JSON.stringify(data ?? {}),
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
      const tick = () => {
        if (st.newSessionCreated) {
          const rs = fireReq('team.getReadState', { sessionId: NEW_ID })
          fireRes(rs, 200, { relation: 'none', liveToken: null })
          fireReq('team.listRoots', {})
          return
        }
        if (!st.selected) return
        const sel = st.selected
        const id = (opts.tickForeignRoot && sel.relation === 'team-root') ? OTHER_ID : sel.id
        const rs = fireReq('team.getReadState', { sessionId: id })
        fireRes(rs, 200, readData(sel))
      }

      const crumbOf = () => st.dialog.crumb === 0 ? 'Home' : (opts.cdSegments || ['testhome'])[st.dialog.crumb - 1]
      const page = {
        async gotoApp () {
          w.v += 50
          if (opts.bootTeamRequests) for (let i = 0; i < opts.bootTeamRequests; i += 1) fireReq('team.listRoots', {})
        },
        async reload () {
          w.v += 80
          if (st.selected) coldRound(st.selected)
        },
        async wait (ms) {
          // ticks fire on SCHEDULED boundaries (the product tickMs cadence),
          // never per-chunk — a boundary-accurate fake keeps every inter-tick
          // delta exactly tickMs so the cadence oracle tests the driver, not
          // fake artifacts.
          const target = w.v + ms
          while (st.selected || st.newSessionCreated) {
            if (st.nextTickAt == null) st.nextTickAt = w.v + tickMs
            if (st.nextTickAt > target) break
            w.v = st.nextTickAt
            tick()
            st.nextTickAt += tickMs
          }
          w.v = target
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
            out.push(leaf('Team', 60, 'div', '', 'main', 420))
            if (st.teamFace) out.push(leaf('Refresh team view', 100, 'button', '', 'main', 420))
          }
          return out
        },
        async clickLeaf (l) {
          w.clicks.push(leg + ':' + l.text)
          if (l.text === 'Ungrouped') { if (!opts.railStuckCollapsed) st.rail = 'expanded'; w.v += 20; return }
          if (/^Show \d+ more sessions$/.test(l.text)) { st.rail = 'all'; w.v += 20; return }
          if (l.text === 'New Session') { st.dialogOpen = true; st.dialog = { crumb: 0, selected: null }; w.v += 30; return }
          if (l.text === 'Team') { st.teamFace = true; w.v += 20; return }
          if (l.text === 'Refresh team view') {
            if (opts.breakAfterE3) throw new Error('fake break after E3')
            const t5 = w.v
            const lg = fireReq('team.getLedgerPage', { teamSessionId: ROOT_ID, afterSequence: 0, limit: 50 }, t5)
            fireRes(lg, 200, { ledger: true }, { t: t5 + 16 })
            const rs = fireReq('team.getReadState', { sessionId: st.selected.id }, t5 + 20)
            fireRes(rs, 200, readData(st.selected))
            fireReq('team.listRoots', {}, t5 + 25)
            w.v = t5 + 60
            return
          }
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
        async dialogSnapshot () {
          if (!st.dialogOpen) return { open: false, title: null, crumbLabel: null, folders: [], buttons: [], selectedFolder: null }
          const crumb = crumbOf()
          if (opts.foreignCrumbRoot) return { open: true, title: 'Select Workspace Directory', crumbLabel: 'Documents', folders: ['workspace'], buttons: ['Cancel', 'Open'], selectedFolder: null }
          let here = listings[crumb] || { folders: [], buttons: ['Cancel', 'Open'] }
          if (crumb === 'Home' && opts.listingsWithNearMiss) here = { folders: ['workspace-old', 'team-workspace', 'workspace copy'], buttons: ['New folder', 'Cancel', 'Open'] }
          return { open: true, title: 'Select Workspace Directory', crumbLabel: crumb, folders: here.folders.slice(), buttons: here.buttons.slice(), selectedFolder: st.dialog.selected }
        },
        async dialogClickFolder (name) {
          w.v += 15
          w.clicks.push(leg + ':dialog:' + name)
          const behavior = opts.dialogBehavior || 'drill'
          const here = listings[crumbOf()] || { folders: [] }
          if (!here.folders.includes(name)) return // click on nothing — state MUST not advance
          if (behavior === 'select-only') { st.dialog.selected = name; return }
          if (name === (opts.leafFolder || 'ws')) { st.dialog.selected = name; return } // the target row SELECTS (real UI shape)
          st.dialog.crumb += 1 // drill into an ancestor
        },
        async dialogClickButton (name) {
          w.v += 15
          if (name === 'Cancel') { st.dialogOpen = false; w.canceledDialogs += 1; return }
          if (name !== 'Open') return
          st.dialogOpen = false
          st.newSessionCreated = true
          st.selected = { id: NEW_ID, relation: 'none', title: 'ping' }
          st.nextTickAt = w.v + tickMs
          const rs = fireReq('team.getReadState', { sessionId: NEW_ID })
          fireRes(rs, 200, { relation: 'none', liveToken: null })
          fireReq('team.listRoots', {})
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
      fireRes(req, 200, undefined, {
        envelope: { rpcId: 'ffffffff', result: { ok: true, value: { data: { relation: 'team-member', memberInstanceId: MEMBER_INSTANCE } } } },
        rawBody: '{"relation":"team-member","memberInstanceId":"inst-0iin89s0dvix"}',
      })
    },
  })
  assert.equal(out.legs.E1.verdict, 'NOT_RUN')
  assert.match(out.legs.E1.reason, /selection-unverified/, JSON.stringify(out.legs.E1.reason))
})

test('P4: a FAILED response for the exact request (envelope ok:false) rejects verification', async () => {
  const { out } = await runCore({
    coldResponseOverride: ({ req, fireRes }) => {
      fireRes(req, 200, undefined, { envelope: { rpcId: req.rpcId, result: { ok: false, error: { code: 'internal', message: 'boom', details: {} } } }, rawBody: '{"ok":false}' })
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
