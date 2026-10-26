/**
 * tests/world-factory/suites/010-u6-fs.mjs — the `u6-fs` C2 suite,
 * collected by u5-canary-runner.mjs from this directory (u7-w0, 2026-10-26).
 *
 * Moved VERBATIM out of u5-canary-runner.mjs at origin/master 88107ad71 (the
 * suite's SUITE_CASES entry + its comment, its run function and the banner
 * above it, and its totalRequests budget) so a new suite lane ADDS a file here
 * and edits no shared list in the runner. The only textual changes: the runner
 * helpers it used arrive through the `ctx` argument, `SUITE_CASES['u6-fs']`
 * reads the module's own CASES, and imports name exactly what the body uses.
 */
import { apiPrompt, authenticate, fetchJson } from '../lib/world-factory.mjs'
import { createFsAssembly, makeFsDecide, remoteCall, hasMarker, surfaceNamesOf, toolMsgsOf, MANAGED_TOOL_NAMES, SAFE_UNMANAGED_TOOL_NAMES } from '../lib/u6-fs-assembly.mjs'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// U6 PR2 C2: the governed READ lane matrix (the case list below was unannotated
// in the runner's SUITE_CASES; the shadow-parity comment above it there
// described u6-shadow and stays with that entry).
const CASES = Object.freeze(['fs:mounted', 'fs:governed-read-positive', 'fs:refusal-zero-effect', 'fs:ctl-native-read', 'fs:identity-swap', 'fs:identity-swap-sensitivity', 'fs:toctou-abort', 'fs:shadow-ledger-cap', 'fs:leak-check'])

// ─────────────────────────────────────────────────────────────────────────────
// u6-fs (U6 PR2 C2): ONE governed Team World on the pinned Host — the kernel-
// owned governed `read` lane, its deny lane, the permissions-less CI-03 lane,
// and the probe row's identity-swap / re-registration-window PLANTS. Case
// ids carry the `fs:` prefix; verdicts need effect evidence OUTSIDE the
// model transcript (probe ledger + marker dir + host-log hits + host pid).
// ─────────────────────────────────────────────────────────────────────────────
async function runU6Fs({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }, { sleep, waitUntil, readLedgerRows, evaluateLeak, REPO_ROOT, RUN_LIFETIME_MS }) {
  const CASE_IDS = CASES
  const done = new Set()
  const add = (id, verdict, detail) => {
    done.add(id)
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 220)}`)
  }
  const failRest = (why, extra = {}) => {
    for (const id of CASE_IDS) {
      if (!done.has(id)) add(id, 'FAIL', { reason: why, ...extra })
    }
  }
  const redactLine = (t) => String(t).replace(/\?token=[A-Za-z0-9_-]+/g, '?token=<redacted>').slice(0, 260)
  // runU6Fs waits are async predicates (HTTP probes); the module-level
  // waitUntil tests `predicate() === true` and would never see a Promise.
  const waitA = async (predicate, timeoutMs) => {
    const started = Date.now()
    for (;;) {
      let hit = false
      try {
        hit = (await predicate()) === true
      } catch {
        hit = false
      }
      if (hit) return { hit: true, waitedMs: Date.now() - started }
      if (Date.now() - started >= timeoutMs) return { hit: false, waitedMs: Date.now() - started }
      await sleep(400)
    }
  }
  const hostAlive = () => world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null

  // ── materialize + boot (one host start) ──────────────────────────────────
  const world = await factory.createWorld({ line, u6Fs: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const assembly = createFsAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir })
  assembly.writePreBootFiles() // must precede teamRows(): the plane rootDir canonicalizes the workspace
  world.u6Fs.rows.push(...assembly.teamRows())
  // THE GATE EYE (b5 lesson): the leader phase machine's ledger gates only
  // mean something when they read the probe's REAL ledger — b5 ran with the
  // default () => [] reader, every gate opened on its bounded overrun, and
  // the plant legs read STALE pre-plant evidence. The reader is a fresh
  // sync read per leader turn (append-only file, shared FS).
  await world.startMock({ decide: makeFsDecide({ assembly, readProbeLedger: () => readLedgerRows(world.u6fsLedgerPath) }) })
  record.logHostStart({ world: world.id, phase: 'u6fs-boot1' })
  rc.arm()
  const startPromise = world.startHost()
  const child = world.instance?.child ?? null
  if (child !== null) rc.bindChild(child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
  let boot
  try {
    boot = await startPromise
  } catch (error) {
    failRest(`host start failed: ${String(error?.message ?? error).slice(0, 200)}`)
    return
  }
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'u6fs-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`
  const probeLedger = () => world.u6fsLedgerRows() ?? []
  const listMarkers = () => {
    try { return readdirSync(world.u6fsMarkerDir) } catch { return [] }
  }

  // ── readiness: p6t6 health + anchored team session + probe mount ─────────
  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && (st.body?.ok === true || st.body?.ok === false)
  }, { timeoutMs: 120_000 })
  if (!healthW.hit || health?.body?.ok !== true) {
    add('fs:mounted', 'FAIL', { reason: `p6t6 health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 300)}` })
    failRest('mount readiness failed')
    return
  }
  let stateBody = null
  const stateW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    stateBody = st.body
    return st.status === 200 && stateBody?.rootSessionId === assembly.ROOT && stateBody?.phase === 'create' && stateBody?.teamSession !== null
  }, { timeoutMs: 90_000 })
  const mountedRow = probeLedger().find((r) => r.leg === 'register' && r.kind === 'probe-tool')
  add('fs:mounted', stateW.hit && mountedRow?.ok === true && hostAlive() ? 'PASS' : 'FAIL', {
    teamSession: stateBody?.teamSession !== null && stateBody?.teamSession !== undefined,
    probeRegister: mountedRow ?? { missing: true },
    hostAlive: hostAlive(),
    listenLegs: probeLedger().filter((r) => r.leg === 'listen').map((r) => `${String(r.event)}:${String(r.ok)}`),
  })
  if (!stateW.hit) {
    failRest('anchored Team Session never appeared (state probe timed out)')
    return
  }

  // ── discovery prompt -> builtinToolDeny -> main blueprint -> team.create ─
  const cookie = await authenticate(origin, world.token)
  const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u6fs')
  if (discPrompt.status !== 200) {
    failRest(`discovery prompt rejected: ${String(discPrompt.status)} ${JSON.stringify(discPrompt.body ?? {}).slice(0, 200)}`)
    return
  }
  const discW = await waitUntil(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), { timeoutMs: 150_000 })
  if (!discW.hit) {
    failRest('discovery model request absent (deny list cannot be computed)', { mockDigest: world.mockRequestDigest().slice(-6) })
    return
  }
  const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
  const surface = [...new Set(disc)].sort()
  // the probe tool stays IN the deny list: it is unmanaged surface that the
  // A2C-2 coverage gate must see declared (measured b2); it is never called
  // from a governed lane.
  const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
  assembly.writeMainBlueprint(denyList)
  // HOST-IDENTICAL ingest receipt BEFORE team.create: the emitted documents
  // are re-parsed with the host catalog's own validator (the dist domain
  // facade the host-loaded plugin imports). run7 spent its boot learning
  // the catalog fails ingest as MALFORMED_DTO 'blueprint not found in
  // catalog'; this line turns that outcome into an offline-shaped throw
  // (writeMainBlueprint already refuses to write a rejected document).
  record.record.u6arcaIngest = assembly.assertBlueprintIngestible()
  const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
  const createOk = created.status === 200 && created.body?.result?.ok === true
  if (!createOk) {
    failRest(`team.create failed: status=${String(created.status)} body=${JSON.stringify(created.body ?? null).slice(0, 300)}`)
    return
  }

  // ── drive: the LEADER chain owns all ordering (see makeFsDecide); the
  // runner only fires the three plant triggers on the UNGOVERNED boot-root
  // session at the observation points, each completion proven by the probe
  // LEDGER (never by transcript): swap before the under-swap read, restore
  // before the post-restore read, the toctou arm before the in-window read.
  // The leader's ledger gates poll until each trigger row lands, so there is
  // no cross-process race: at worst a gate exhausts its rounds and the
  // affected leg FAILS honestly on its own evidence.
  const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
  const laneDone = { strict: false, ctl: false, sens1: false, swapped: false, sens2: false, toctou: false, swapTrigger: false, restoreTrigger: false, toctouTrigger: false, leader: false }
  record.record.u6fsLanes = laneDone
  const awaitReply = async (content, timeoutMs) => (await waitUntil(() => replySeen(content), { timeoutMs })).hit
  const fireTrigger = async (markerText, pred, timeoutMs = 90_000) => {
    const pr = await apiPrompt(origin, cookie, assembly.ROOT, markerText, 'u6fs-trig')
    if (pr.status !== 200) {
      log(`trigger prompt ${String(markerText).slice(0, 40)} rejected: status=${String(pr.status)} ${JSON.stringify(pr.body ?? null).slice(0, 160)}`)
      return false
    }
    return (await waitA(pred, timeoutMs)).hit
  }
  // SYNCHRONIZED RHYTHM v2 (b5+b6 lessons): the leader chain is the TEAM
  // ROOT session's own loop (b6 forensics: the anchor-root session is a
  // DIFFERENT team root — team tools addressed from there were rejected
  // with TEAM_TOOL_CALLER_ROOT_MISMATCH). Fences advance through the WAKE
  // PROTOCOL (settled notice → team_collect over the ORIGINAL token — the
  // durable answer rides the result); gates HOLD their turn cheaply and
  // ONLY the runner's wake re-enters them, fired on the TEAM ROOT and only
  // AFTER the plant trigger's ledger row is proven. So: plant ordering is
  // structural (the gate cannot open early), and a parked chain is always
  // re-enterable. Boundary texts are the members' DONE replies (unique
  // strings, proven by the mock corpus in b5).
  const wake = async (tag) => {
    const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U6FS_PHASE_${tag}`, 'u6fs-wake')
    if (pr.status !== 200) log(`wake ${String(tag)} rejected: status=${String(pr.status)}`)
  }
  const wakeCadence = async (doneText, deadlineMs, tag) => {
    const t0 = Date.now()
    let lastWake = 0
    let wakes = 0
    for (;;) {
      if (replySeen(doneText)) return true
      if (Date.now() - t0 > deadlineMs) return replySeen(doneText)
      if (Date.now() - lastWake > 3000 && wakes < 14) { wakes += 1; lastWake = Date.now(); await wake(tag) }
      await new Promise((r) => setTimeout(r, 350))
    }
  }
  laneDone.strict = await wakeCadence('U6FS_STRICT_DONE', 90_000, 's')
  laneDone.ctl = await wakeCadence('U6FS_CTL_DONE', 75_000, 'c')
  laneDone.sens1 = await wakeCadence('U6FS_SENS1_DONE', 75_000, 'x')
  // plant triggers land FIRST (on the anchor-root session, where the probe
  // row is proven visible from b5); the gates hold until the LEDGER proves
  // the plant ran, so the ordering cannot race.
  laneDone.swapTrigger = await fireTrigger(assembly.markers.T_SWAP, () => probeLedger().some((r) => r.leg === 'spoof-attempt' && r.trigger === 'probe-body'))
  laneDone.swapped = await wakeCadence('U6FS_SWAPPED_DONE', 90_000, 'w')
  laneDone.restoreTrigger = await fireTrigger(assembly.markers.T_RESTORE, () => probeLedger().some((r) => r.leg === 'spoof-restore'))
  laneDone.sens2 = await wakeCadence('U6FS_SENS2_DONE', 75_000, 'y')
  laneDone.toctouTrigger = await fireTrigger(assembly.markers.T_TOCTOU, () => probeLedger().some((r) => (r.leg === 'probe-body-ran' && r.action === 'toctou') || r.leg === 'toctou-arm'))
  laneDone.toctou = await wakeCadence('U6FS_TOCTOU_DONE', 90_000, 't')
  laneDone.leader = await wakeCadence('U6FS_L1_DONE', 60_000, 'z')
  if (!laneDone.leader) {
    const stuck = world.mock.requests.map((r) => (r.reply?.kind === 'text' ? String(r.reply.content ?? '') : '')).filter((x) => x.startsWith('U6FS_ID_FAIL'))
    log(`leader chain did not close cleanly${stuck.length > 0 ? ` (${stuck[stuck.length - 1]})` : ''}; verdicts read the evidence as-is`)
  }

  // ── evidence collection (all channels; digests, tokens never recorded) ───
  const claimOccurrences = (claim) => (world.mock?.requests ?? []).reduce((n, r) =>
    n + toolMsgsOf(r).filter((m) => String(m.text).includes(claim)).length, 0)
  const probeRows = probeLedger()
  const markerFiles = listMarkers()
  const spoofBodyMarkers = markerFiles.filter((m) => m.startsWith('spoof-read-body-ran-'))
  const kernelHits = (() => {
    const pats = ['kernel-post-success-drift-veto', 'a5g7: placement-feed rows=', 'a5-plane: mount-REFUSED', 'a5-plane: placement-REFUSED', 'a5m1-authority-leg', 'ABORTED_BEFORE_DISPATCH', 'cannot be verified at dispatch']
    let text = ''
    try { text = readFileSync(boot.logPath, 'utf8') } catch { /* log unreadable */ }
    const out = {}
    for (const p of pats) {
      const lines = text.split('\n').filter((l) => l.includes(p))
      out[p] = { count: lines.length, sample: lines.length > 0 ? redactLine(lines[lines.length - 1]) : null }
    }
    return out
  })()
  const readResults = probeRows.filter((r) => r.leg === 'read-result')
  const readExecutes = probeRows.filter((r) => r.leg === 'read-execute')
  const swapAttempts = probeRows.filter((r) => r.leg === 'spoof-attempt')
  const registerAttempts = probeRows.filter((r) => r.leg === 'spoof-register')
  const restoreRows = probeRows.filter((r) => r.leg === 'spoof-restore')
  const toctouArms = probeRows.filter((r) => r.leg === 'toctou-arm')
  const digest = {
    surface, denyList,
    claims: Object.fromEntries(Object.entries(assembly.files).map(([k, f]) => [k, claimOccurrences(f.claim)])),
    spoofBodyMarkers,
    restoreRows, toctouArms,
    swapAttempts,
    registerAttempts,
    readExecutes: readExecutes.map((r) => ({ path: r.path, agent: r.agent })),
    readResults: readResults.map((r) => ({ isError: r.isError, cancelled: r.cancelled, head: String(r.head ?? '').slice(0, 160) })),
    kernelHits,
    laneDone,
  }
  record.record.u6fsDigest = digest
  try {
    writeFileSync(join(evidence, `${runId}.u6fs-evidence.json`), JSON.stringify(digest, null, 2) + '\n')
  } catch { /* evidence is best-effort; the RUN record carries the digest */ }

  // ── verdicts ──────────────────────────────────────────────────────────────
  const F = assembly.files
  // positive: the claim can only come from the host's own read Body; the
  // probe's observation ledger (a channel independent of the transcript)
  // must have seen the same content answered.
  const positiveObserved = readResults.some((r) => r.isError !== true && String(r.head ?? '').includes(F.s1.claim))
  add('fs:governed-read-positive',
    claimOccurrences(F.s1.claim) > 0 && positiveObserved && hostAlive() ? 'PASS' : 'FAIL',
    { claimOccurrences: claimOccurrences(F.s1.claim), probeObserved: positiveObserved, hostAlive: hostAlive(),
      note: 'SOUND = claim-in-result (only the file is its source) AND probe-row observation of the answered content AND host alive' })
  // refusal: the denied file's claim never appears; the call reached the
  // dispatcher (read-execute) and its observed result carries the KERNEL's
  // own typed word for this lane (measured offline on the current dist:
  // default-deny lands `IO_POLICY_UNSUPPORTED` / `template-default-deny`
  // BEFORE any byte is read; the guard/dispatch refusals are the fallback
  // witnesses if the lane shape ever moves).
  const denyExecuted = readExecutes.some((r) => String(r.path ?? '').includes('u6fs-denied'))
  const denialWords = /IO_POLICY_UNSUPPORTED|template-default-deny|permission denied|cannot be verified at dispatch|APPROVAL_DENIED|guard/i
  const denyRefusedObserved = readResults.some((r) => r.isError === true
    && !String(r.head ?? '').includes(F.denied.claim)
    && String(r.path ?? '').includes('u6fs-denied')
    && denialWords.test(String(r.head ?? '')))
  add('fs:refusal-zero-effect',
    claimOccurrences(F.denied.claim) === 0 && denyExecuted && denyRefusedObserved && hostAlive() ? 'PASS' : 'FAIL',
    { deniedClaimOccurrences: claimOccurrences(F.denied.claim), denyExecuted, denyRefusedObserved, hostAlive: hostAlive() })
  // CI-03: the permissions-less template's native read ran, observed by the
  // probe row (its claim file c1 is only ever asked on the ctl lane).
  const ctlObserved = readResults.some((r) => r.isError !== true && String(r.head ?? '').includes(F.c1.claim))
  add('fs:ctl-native-read',
    claimOccurrences(F.c1.claim) > 0 && ctlObserved && hostAlive() ? 'PASS' : 'FAIL',
    { claimOccurrences: claimOccurrences(F.c1.claim), probeObserved: ctlObserved, hostAlive: hostAlive() })

  // Plant verdicts. Two HOST-LEGAL arms are scored, chosen by what the probe
  // ledger says actually happened; NO arm accepts a spoof Body success:
  //  arm 'refused-at-dispatch' — a spoof registration BECAME the live
  //    resolution for the governed name and the guard refused the call:
  //    target claim ABSENT, spoof Body marker ABSENT.
  //  arm 'registration-refused' — the host registry/scope law made the spoof
  //    never win resolution: the governed row keeps answering CORRECTLY
  //    (claim present with the real content) and the spoof Body marker is
  //    ABSENT. A hijacked answer (spoof marker, or claim absent AND governed
  //    row silent) fails every arm.
  const plantAttempted = (trigger) => swapAttempts.find((a) => a.trigger === trigger)
  // ATTEMPT-RELATIVE law (b5 lesson): a plant leg may ONLY be spoken for by
  // observations taken AFTER the plant landed. Pre-plant reads of the same
  // file are stale evidence and can never produce a PASS.
  const afterAt = (rows, at) => rows.filter((r) => String(r.at ?? '') > String(at))
  // (b7 lesson: the assembly's file entries carry {path, claim} ONLY — a
  // `file.name` read is undefined and `includes(undefined)` never fires.)
  const fname = (file) => String(file.path).slice(String(file.path).lastIndexOf('/') + 1)
  const plantArm = (trigger, file) => {
    const name = fname(file)
    const attempt = plantAttempted(trigger)
    if (attempt === undefined) return { verdict: 'FAIL', why: `no spoof-attempt ledger row for trigger=${trigger} (the plant never ran)` }
    if (spoofBodyMarkers.length > 0) return { verdict: 'FAIL', why: `spoof Body markers exist: ${spoofBodyMarkers.join(',')} — a spoof body ANSWERED (or stamping ran); no arm forgives this` }
    const attemptAt = attempt.at
    const postResults = afterAt(readResults, attemptAt)
    const postExecutes = afterAt(readExecutes, attemptAt)
    const answeredCorrectly = postResults.some((r) => r.isError !== true
      && String(r.path ?? '').includes(name)
      && String(r.head ?? '').includes(file.claim))
    if (answeredCorrectly) {
      // AFTER the plant, the governed row still answered CORRECTLY and no
      // spoof body ran: wherever the spoof landed (threw, or a scope the
      // governed resolution never consults), the kernel-owned identity held.
      return { verdict: 'PASS', arm: 'registration-refused',
        why: `post-attempt (${String(attemptAt).slice(11, 23)}Z): the governed read answered with the real content and zero spoof-Body markers — the spoof either threw at registration (host scope law) or landed only in scopes the governed resolution masks; the kernel-table swap itself stays pinned by C1 (u6-pr2-kernel-guard-plants)` }
    }
    const dispatched = postExecutes.some((r) => String(r.path ?? '').includes(name))
    const refusal = postResults.find((r) => r.isError === true
      && String(r.path ?? '').includes(name)
      && /cannot be verified|ABORTED|refused|guard|denied/i.test(String(r.head ?? '')))
    if (dispatched && refusal !== undefined) {
      return { verdict: 'PASS', arm: 'refused-at-dispatch',
        why: `spoof placed in [${(Array.isArray(attempt.placedScopes) ? attempt.placedScopes : []).join(',')}], the post-attempt governed call was REFUSED at dispatch with zero spoof-Body effect (verbatim head: ${String(refusal.head ?? '').slice(0, 140)})` }
    }
    if (!dispatched) return { verdict: 'FAIL', why: `no POST-ATTEMPT dispatch of the target was observed (plant at ${String(attemptAt).slice(11, 23)}Z) — stale pre-plant reads never speak for the plant leg` }
    return { verdict: 'FAIL', why: 'the post-attempt call was dispatched, produced neither the governed answer nor a named refusal — unexplained silence' }
  }
  const swapVerdict = plantArm('probe-body', F.s3)
  add('fs:identity-swap', swapVerdict.verdict, {
    arm: swapVerdict.arm ?? null, why: swapVerdict.why,
    registerAttempts: registerAttempts.map((r) => ({ scope: r.scope, trigger: r.trigger, ok: r.ok, error: r.error === undefined ? undefined : String(r.error).slice(0, 120) })),
    spoofBodyMarkers, kernelGuardHits: Object.fromEntries(Object.entries(kernelHits).filter(([, v]) => v.count > 0).map(([k, v]) => [k, v.count])),
  })
  // sensitivity: reads run immediately before the swap and immediately after
  // restore — the swap verdict cannot be explained by a dead lane.
  // Sensitivity is an ORDER statement, not just an existence statement:
  // the pre-swap read must predate the swap, the under-swap read must sit
  // between swap and restore, and the post-restore read must postdate the
  // restore — otherwise the swap verdict could be stale-lane noise.
  const firstAt = (rows, pred) => rows.filter(pred).map((r) => String(r.at ?? '')).sort()[0] ?? ''
  const okReadAt = (name, claim) => firstAt(readResults, (r) => r.isError !== true
    && String(r.path ?? '').includes(name) && String(r.head ?? '').includes(claim))
  const swapAt = String(plantAttempted('probe-body')?.at ?? '')
  const restoreAt = String(restoreRows[0]?.at ?? '')
  const s2At = okReadAt('u6fs-s2', F.s2.claim)
  const s3At = okReadAt('u6fs-s3', F.s3.claim)
  const s4At = okReadAt('u6fs-s4', F.s4.claim)
  const orderOk = s2At !== '' && s3At !== '' && s4At !== '' && swapAt !== '' && restoreAt !== ''
    && s2At < swapAt && swapAt < s3At && s3At < restoreAt && restoreAt < s4At
  const sensOk = orderOk && claimOccurrences(F.s2.claim) > 0 && claimOccurrences(F.s4.claim) > 0
  add('fs:identity-swap-sensitivity', sensOk && spoofBodyMarkers.length === 0 && hostAlive() ? 'PASS' : 'FAIL',
    { s2At, swapAt, s3At, restoreAt, s4At, orderOk,
      s2Occurrences: claimOccurrences(F.s2.claim), s4Occurrences: claimOccurrences(F.s4.claim), hostAlive: hostAlive() })
  const toctouVerdict = plantArm('execute-window', F.s5)
  add('fs:toctou-abort', toctouVerdict.verdict, {
    arm: toctouVerdict.arm ?? null, why: toctouVerdict.why,
    inWindowRegisters: registerAttempts.filter((r) => String(r.trigger ?? '').includes('execute-window')).map((r) => ({ scope: r.scope, ok: r.ok })),
    spoofBodyMarkers,
  })

  // ── R-REM-3: the shadow audit LEDGER must have hit its K5 cap here ──────
  // (the product row mounted with a 5-row budget; the cap is an
  // audit-channel event — one terminal marker, then the appends stop while
  // the OBSERVE channel keeps every row and the call flow never notices).
  {
    const shadowPath = join(world.home, 'u6fs-shadow-ledger.jsonl')
    let rows = []
    try {
      rows = readFileSync(shadowPath, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line))
    } catch { /* absent = FAIL below with the read error stated */ }
    const markers = rows.filter((r) => r?.leg === 'shadow-ledger-capped')
    const installs = rows.filter((r) => r?.leg === 'shadow-installed')
    // zero-flow proof: the S4 read happens LONG after the 5-row budget is
    // spent — its claim answering proves the governed lane kept working on
    // a capped audit channel.
    const postCapRead = claimOccurrences(F.s4.claim) > 0
    // Review-r1 B5: the post-cap proof must NOT lean on the capped ledger
    // itself nor on the tool return. The probe's tools/post-execute oracle
    // reads the S4 FILE ITSELF at the fs boundary (leg: 'oracle-read-effect'
    // — bytes/sha256/claimSeen from the oracle's own readFileSync) and the
    // timestamp tie below binds one such observation to the post-cap window
    // (at >= the last capped marker's at). All three witnesses — transcript,
    // oracle, ledger marker — must agree.
    const capAt = String(markers[markers.length - 1]?.at ?? '')
    const oracleRows = probeLedger().filter((r) => r?.leg === 'oracle-read-effect' && r.pathTail === 'u6fs-s4.txt')
    const postCapOracle = oracleRows.filter((r) => r.claimSeen === true && capAt !== '' && String(r.at ?? '') >= capAt)
    add('fs:shadow-ledger-cap',
      markers.length > 0 && hostAlive() && postCapRead && postCapOracle.length > 0 ? 'PASS' : 'FAIL',
      { rows: rows.length, cappedMarkers: markers.length, installs: installs.length,
        budgets: markers[0] ? { maxLedgerRows: markers[0].maxLedgerRows, maxLedgerBytes: markers[0].maxLedgerBytes } : null,
        hostAlive: hostAlive(), postCapReadSucceeded: postCapRead,
        oraclePostCapRows: postCapOracle.length,
        oracleReceipt: postCapOracle.length > 0 ? {
          at: postCapOracle[postCapOracle.length - 1].at, pathTail: 'u6fs-s4.txt',
          bytes: postCapOracle[postCapOracle.length - 1].bytes,
          sha256: postCapOracle[postCapOracle.length - 1].sha256,
          claimSeen: true, capAt,
        } : null,
        detail: 'K5 terminal marker present, flow unaffected; post-cap read proven by an INDEPENDENT oracle observation of the read effect (oracle bytes/sha256, timestamped after the cap marker) (R-REM-3 cap-hit evidence)' })
  }

  // ── leak-check: teardown, then the factory's owned-resources audit ───────
  try {
    await rc.stopChild()
  } catch { /* idempotent */ }
  const receipts = await world.teardown({ keepHome })
  const leak = await evaluateLeak({ world, receipts, factory })
  add('fs:leak-check', leak.ok ? 'PASS' : 'FAIL', leak.detail)
  const laneGaps = Object.entries(laneDone).filter(([, v]) => v !== true).map(([k]) => k)
  if (laneGaps.length > 0) log(`lane completion gaps: ${laneGaps.join(',')} (each affected case above already carries the FAIL)`)
}

export default {
  suite: 'u6-fs',
  cases: CASES,
  totalRequests: 80,
  run: (opts, ctx) => runU6Fs(opts, ctx),
}
