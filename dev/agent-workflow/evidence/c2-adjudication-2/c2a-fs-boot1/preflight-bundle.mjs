/**
 * preflight-bundle.mjs — the ZERO-BOOT preflight input for the FS/Search
 * dev-live driver.
 *
 * WHAT THIS IS. One pure builder: it turns facts the driver ALREADY knows
 * before the spawn (fixture paths inside the freshly created World, the
 * compiled lanes, the case table, the row handoff, the authority pointer, the
 * dev-live authorisation) into the `a5sf-zero-boot-preflight/1` document that
 * `scripts/a5sf-preflight.mjs` / `lib/a5sf-acceptance-preflight.mjs#runZeroBootPreflight`
 * grades. It decides nothing: every check stays in that module.
 *
 * WHY THE BUNDLE IS BUILT AT RUN TIME, NOT COMMITTED. The World home is minted
 * by the factory, so the case locators only exist after `createWorld()`. A
 * committed bundle would carry `<world>` placeholders and grade a diagram
 * instead of this run's fixtures. The driver writes this file BEFORE the
 * spawn and refuses to boot on anything but PASS.
 *
 * DEV-LIVE NOTE (owner ruling 2026-11-09). The `grant` block records the
 * scope authorisation AND the ledger arithmetic of THIS start
 * (`maxStarts = priorRows + intent + boot`). Under DEV-LIVE that number is
 * RECORDED, not enforced: there is no cumulative cap. It is present because
 * the preflight grades the ledger arithmetic that the start will actually
 * write, and a dev boot writes the same rows as any other boot.
 *
 * @module dev/agent-workflow/evidence/a5sf-fs-devlive/driver/preflight-bundle
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const PREFLIGHT_BUNDLE_NAME = 'preflight-bundle.json'

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

/** Read the authority pointer and the immutable snapshot it names. */
function authorityOf(repoRoot) {
  const pointerPath = join(repoRoot, 'dev', 'engineering', 'current-authority.json')
  const pointerBytes = readFileSync(pointerPath)
  const pointer = JSON.parse(pointerBytes.toString('utf8'))
  const snapshot = JSON.parse(readFileSync(join(repoRoot, 'dev', 'engineering', 'authority-snapshots', `${pointer.snapshot_version}.json`), 'utf8'))
  return {
    pointerPath: 'dev/engineering/current-authority.json',
    snapshotVersion: pointer.snapshot_version,
    contentDigest: pointer.content_digest,
    baseline: snapshot.baseline,
    pointerSha256: sha256(pointerBytes),
    pointer: { snapshot_version: pointer.snapshot_version, content_digest: pointer.content_digest },
  }
}

/**
 * @param {object} input
 * @param {string} input.repoRoot
 * @param {string} input.head           the commit this start executes
 * @param {number} input.bootSequence
 * @param {number} input.priorRows      shared-ledger rows before this start
 * @param {object} input.paths          the World's fixture paths
 * @param {string[]} input.caseIds
 * @param {object} input.fixtures       caseId -> declared inputs
 * @param {string[]} input.emittedRowIds
 * @param {string[]} input.worldRowIds
 * @param {string[]} input.leaderSurface
 * @param {object[]} input.nativeModules
 * @param {object} input.grant
 * @param {string[]} input.hostModules  repo-relative paths the plan mounts
 */
export function buildPreflightBundle(input) {
  const {
    repoRoot, head, bootSequence, priorRows, paths, caseIds, fixtures,
    emittedRowIds, worldRowIds, leaderSurface, nativeModules, grant, hostModules,
  } = input
  const authority = authorityOf(repoRoot)

  // ── the case table ────────────────────────────────────────────────────────
  // Every case owns a UNIQUE locator and guard-fact key (case isolation is the
  // defect that cost candidate-1 allocation #1). `axis`/`expected` are the
  // policy-lane facts; the verdict itself is judged live.
  const C = (id, extra) => ({
    id,
    face: 'fs-search',
    caseClass: undefined,
    corpus: ['transcript', 'guard-facts', 'provider-counter'],
    returnShape: ['call', 'result', 'claim', ...(Array.isArray(extra?.shape) ? extra.shape : [])],
    terminate: true,
    archiveBeforeStart: true,
    ...extra,
    // the collector contract's own keys are never overridable by a case
    corpus: ['transcript', 'guard-facts', 'provider-counter'],
    returnShape: ['call', 'result', 'claim', ...(Array.isArray(extra?.shape) ? extra.shape : [])],
    terminate: true,
    archiveBeforeStart: true,
  })
  const cases = [
    C('live:search-row1-grep-in-lane-allowed', { axis: 'read', expected: 'allow', locator: paths.inLaneDir, guardFactKey: 'search.row1', route: 'grep', input: { pattern: '<needle>', path: paths.inLaneDir } }),
    C('live:search-row2-grep-outside-ceiling-refused', { axis: 'read', expected: 'deny', locator: paths.outsideDir, guardFactKey: 'search.row2', deniedBy: 'ceiling', route: 'grep', input: { pattern: '<outside>', path: paths.outsideDir } }),
    C('live:search-row3-grep-outside-restriction-refused', { axis: 'read', expected: 'deny', locator: paths.restrictedFile, guardFactKey: 'search.row3', deniedBy: 'restriction', route: 'grep', input: { pattern: '<restricted>', path: paths.restrictedFile } }),
    C('live:search-row4-cancelled-search-settles-cancelled', { axis: 'read', expected: 'allow', locator: paths.fifo, guardFactKey: 'search.row4', route: 'grep', input: { pattern: '<fifo>', path: paths.fifo } }),
    C('live:search-row5-invalid-pattern-is-error', { axis: 'read', expected: 'allow', locator: paths.invalidDir, guardFactKey: 'search.row5', route: 'grep', input: { pattern: 'A5SF_(', path: paths.invalidDir } }),
    C('live:search-row6-archive-boundary-no-callable-shadow', { axis: 'read', expected: 'allow', locator: paths.globDir, face: 'non-data-plane', guardFactKey: 'search.row6', route: 'team_archive', input: {} }),
    C('live:row1-read-a-inside-both-allowed', { axis: 'read', expected: 'allow', locator: paths.readA, guardFactKey: 'fs.row1', route: 'read', input: { file_path: paths.readA } }),
    C('live:row2-read-b-binding-deny-on-read-path', { axis: 'read', expected: 'deny', locator: paths.readB, guardFactKey: 'fs.row2', deniedBy: 'restriction', route: 'read', input: { file_path: paths.readB } }),
    C('live:row3-read-c-refused-no-widening', { axis: 'read', expected: 'deny', locator: paths.readC, guardFactKey: 'fs.row3', deniedBy: 'ceiling', route: 'read', input: { file_path: paths.readC } }),
    C('live:row4a-write-in-lane-readable-allowed-ceiling-only', { axis: 'write', expected: 'allow', locator: paths.w4a, guardFactKey: 'fs.row4a', route: 'write', input: { file_path: paths.w4a } }),
    C('live:row4b-write-b-ceiling-allowed-read-not-implied', { axis: 'write', expected: 'allow', locator: paths.w4b, guardFactKey: 'fs.row4b', route: 'write', input: { file_path: paths.w4b } }),
    C('fs:edit-in-lane', { axis: 'write', expected: 'allow', locator: paths.editInLane, guardFactKey: 'edit.in', route: 'edit', input: { file_path: paths.editInLane } }),
    C('fs:edit-outside-ceiling', { axis: 'write', expected: 'deny', locator: paths.editOutside, guardFactKey: 'edit.out', deniedBy: 'restriction', route: 'edit', input: { file_path: paths.editOutside } }),
    C('fs:read-image-observation', { axis: 'read', expected: 'allow', locator: paths.imageFile, guardFactKey: 'image.in', route: 'read_image', input: { file_path: paths.imageFile } }),
  ]

  // The dispositions the deny cases claim, computed from the declared lanes (the
  // driver's own probe report is the live witness; this block is the host-free
  // claim the preflight grades).
  const dispositions = {
    'live:search-row2-grep-outside-ceiling-refused': { ceiling: 'deny', restriction: 'allow', effective: 'deny' },
    'live:search-row3-grep-outside-restriction-refused': { ceiling: 'allow', restriction: 'deny', effective: 'deny' },
    'live:row2-read-b-binding-deny-on-read-path': { ceiling: 'allow', restriction: 'deny', effective: 'deny' },
    'live:row3-read-c-refused-no-widening': { ceiling: 'deny', restriction: 'allow', effective: 'deny' },
    'fs:edit-outside-ceiling': { ceiling: 'deny', restriction: 'deny', effective: 'deny' },
  }

  const memberBindings = cases.filter((c) => c.face !== 'non-data-plane').map((c) => ({
    caseId: c.id,
    memberIdentity: 'member-a5sf-worker',
    toolBindingIdentity: c.route === 'grep' || c.route === 'glob' ? 'dsh.search/grep' : 'dsh.fs/read',
  }))

  // ── driver plan: the order gates must run in ──────────────────────────────
  // Every step that can fail captures the body (a gate that fails without the
  // product's message costs a boot and teaches nothing).
  const capture = { captures: ['body'], captureLimits: { body: { maxChars: null } } }
  const steps = [
    { id: 'preflight', produces: [], canFail: true, ...capture },
    { id: 'row-identity', produces: [], canFail: true, ...capture },
    { id: 'world-create', produces: ['world'], canFail: true, ...capture },
    { id: 'mock-start', requires: ['world'], produces: ['mock'], canFail: true, ...capture },
    { id: 'host-boot', requires: ['world', 'mock'], produces: ['host'], canFail: true, ...capture },
    { id: 'composition-handoff', requires: ['host'], produces: ['composed-profile'], canFail: true, ...capture },
    { id: 'health-poll', requires: ['composed-profile'], produces: ['health'], canFail: true, ...capture },
    { id: 'leader-grep-probe', requires: ['health'], produces: ['base-subprocess'], canFail: true, ...capture },
    { id: 'negative-control', requires: ['base-subprocess'], produces: ['unconfined-search'], canFail: true, ...capture },
    { id: 'team-create', requires: ['unconfined-search'], produces: ['team-session'], canFail: true, ...capture },
    { id: 'state-gate', requires: ['team-session'], produces: ['team-state'], canFail: true, ...capture },
    { id: 'member-install', requires: ['team-state'], produces: ['member-session'], canFail: true, ...capture },
    { id: 'delegate-dispatch', requires: ['member-session'], produces: ['member-rows'], canFail: true, ...capture },
    { id: 'cancellation-window', requires: ['member-rows'], produces: ['cancelled-search'], canFail: true, ...capture },
    { id: 'evidence-collection', requires: ['member-rows'], produces: ['samples'], canFail: true, ...capture },
    { id: 'glob-face', requires: ['samples'], produces: ['glob-samples'], canFail: true, ...capture },
    { id: 'stop-and-probe', requires: ['samples'], produces: ['stopped-member'], canFail: true, ...capture },
    { id: 'teardown', requires: ['stopped-member'], produces: ['teardown'], canFail: true, ...capture },
    { id: 'outcome-row', requires: ['teardown'], produces: ['dev-live-outcome'], canFail: true, ...capture },
  ]

  return {
    schema: 'a5sf-zero-boot-preflight/1',
    label: `FS/Search dev-live start #${String(bootSequence)} — read/write/edit/grep/glob/read_image on current master (DEV-LIVE; development evidence, never a candidate claim)`,
    sources: {
      note: 'Built at run time from the World this start will boot. Development evidence only: recordClass DEV-LIVE can never produce V@B=yes.',
      driver: 'driver/run-boot.mjs (real Host; CASES = SEARCH_CASES + FS_CASES + EDIT_CASES)',
      providerRow: 'driver/a5sf-fs-devlive-realm-row.mjs',
      evidence: 'dev/agent-workflow/evidence/a5sf-fs-devlive/README.md',
      limit: 'A DEV-LIVE start is development evidence. It does not move V@B, does not become a candidate claim, and does not certify the matrix.',
    },
    candidate: {
      head,
      baseline: authority.baseline,
      pin: '639ed015397290b3745d163aafe02ffee4aa3f84',
      productTreeProof: [],
    },
    authority,
    grant: {
      ...grant,
      boundCommit: head,
      priorRows,
      plannedStarts: 1,
      maxStarts: priorRows + 2,
      note: 'recorded, NOT enforced under DEV-LIVE: the authorisation has no cumulative cap. maxStarts is the ledger arithmetic of this start (prior rows + intent + boot).',
    },
    runRecord: {
      teamSha: head,
      hostSha: '639ed015397290b3745d163aafe02ffee4aa3f84',
      ledger: { bootRows: 1, plannedStarts: 1, aborts: 0 },
      bindings: { authority: { pointer: authority.pointer, baseline: authority.baseline, pointerSha256: authority.pointerSha256 } },
    },
    assembly: {
      requiredDistFaces: ['fs', 'subprocess'],
      distFaces: { fs: true, subprocess: true, web: false },
      hostModules: hostModules.map((path) => ({ path, exists: existsSync(join(repoRoot, path)), role: 'declared by the plan' })),
      rowHandoff: {
        usesHandOverRows: true,
        beforeBoot: true,
        emittedRowIds,
        worldRowIds,
        healthProbeRowPresent: emittedRowIds.includes('p6t6-team-tools'),
      },
    },
    fixtures,
    policy: {
      effectiveReadAllow: [paths.inLaneDir],
      effectiveWriteAllow: [paths.workspace],
      networkAccess: 'deny',
      fifo: paths.fifo,
      dispositions,
      note: 'effectiveReadAllow is ceiling ∩ restriction (the product algebra over fixture inputs); effectiveWriteAllow is the ceiling write lane because the binding declares no additional narrowing.',
    },
    identity: {
      bootRoot: 'session-a5sf-acceptance-root',
      teamRoot: 'session-a5sf-acceptance-team',
      createRoot: 'session-a5sf-acceptance-team',
      stateQueryRoot: 'session-a5sf-acceptance-team',
      toolRouteRoot: 'session-a5sf-acceptance-team',
      archiveRoot: 'session-a5sf-acceptance-team',
      oracleRoot: 'session-a5sf-acceptance-team',
      directiveRoot: 'session-a5sf-acceptance-team',
      blueprints: [
        { blueprintId: 'team.a5sf.cand1.anchor', members: 1 },
        { blueprintId: 'team.a5sf.cand1.main', members: 1 },
      ],
      memberBindings,
    },
    nativeModules,
    driver: {
      steps,
      plannedCases: [...caseIds],
      driverCases: [...caseIds],
      blueprint: {
        leader: {
          tools: leaderSurface,
          builtinToolDeny: 'discovery-first',
          teamTools: [],
          worldRows: {},
          presetTools: leaderSurface,
        },
      },
      leaderSurface: { tools: leaderSurface, builtinToolDeny: 'discovery-first', teamTools: [] },
    },
    cases,
  }
}
