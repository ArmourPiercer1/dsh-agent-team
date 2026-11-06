/**
 * preflight-bundle.mjs — the ZERO-BOOT preflight input for the Subprocess
 * dev-live driver.
 *
 * DERIVED FROM `evidence/a5sf-fs-devlive/driver/preflight-bundle.mjs`; the
 * builder was reduced to the two lane-shaped cases this face actually tables
 * and the steps this driver actually runs.
 *
 * WHY ONLY TWO CASES ARE TABLED. The preflight's case schema is lane-shaped:
 * `axis` is read|write|network and a network case is graded as either a
 * connection denial (web caller/transport) or a web-shaped admission refusal.
 * The Subprocess face's network refusal has no web caller: it is the Member's
 * confined face refusing a `spawn` whose compiled policy says
 * `network: deny`. Tabling it as `axis: network` would make the preflight demand
 * a web-surfacing preset the Member does not have (a FALSE declaration), so the
 * deny is measured and reported in `probe-report.json` with its own verdict and
 * is NOT tabled here. It is still a SELECTED case of the run record (its verdict
 * folds into `overall`); it is not a PREFLIGHT case. The README states the split.
 *
 * The two tabled cases are genuine allow-axis observations:
 *   - `sub:product-bash-executor` — the Member's own `bash` runs (locator =
 *     its working directory);
 *   - `sub:face-admitted` — the confined face admits the declared argv shape
 *     and runs a child (locator = the in-lane fixture the body reads).
 *
 * @module dev/agent-workflow/evidence/a5sf-sub-devlive/driver/preflight-bundle
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
 * @param {string} input.head
 * @param {number} input.bootSequence
 * @param {number} input.priorRows
 * @param {object} input.paths
 * @param {string[]} input.caseIds
 * @param {object} input.fixtures
 * @param {string[]} input.emittedRowIds
 * @param {string[]} input.worldRowIds
 * @param {string[]} input.leaderSurface
 * @param {object[]} input.nativeModules
 * @param {object} input.grant
 * @param {string[]} input.hostModules repo-relative or absolute paths the plan mounts
 */
export function buildPreflightBundle(input) {
  const {
    repoRoot, head, bootSequence, priorRows, paths, caseIds, fixtures,
    emittedRowIds, worldRowIds, leaderSurface, nativeModules, grant, hostModules,
  } = input
  const authority = authorityOf(repoRoot)

  const C = (id, extra) => ({
    id,
    face: 'subprocess',
    corpus: ['transcript', 'subprocess-counter', 'guard-facts', 'proc-observation'],
    returnShape: ['call', 'result', 'claim', 'argv', 'providerCalls', 'procSightings'],
    terminate: true,
    archiveBeforeStart: true,
    ...extra,
    corpus: ['transcript', 'subprocess-counter', 'guard-facts', 'proc-observation'],
    returnShape: ['call', 'result', 'claim', 'argv', 'providerCalls', 'procSightings'],
    terminate: true,
    archiveBeforeStart: true,
  })
  const cases = [
    C('sub:product-bash-executor', {
      axis: 'read',
      expected: 'allow',
      locator: paths.workspace,
      guardFactKey: 'sub.executor',
      route: 'bash',
      memberTemplate: 'worker',
      input: { command: '<user bash command>', workdir: paths.workspace },
    }),
    C('sub:face-admitted', {
      axis: 'read',
      expected: 'allow',
      locator: paths.inLaneFile,
      guardFactKey: 'sub.admitted',
      route: 'sub_probe',
      memberTemplate: 'worker',
      input: { vector: 'face_control', argv: ['/bin/bash', '-c', '<allow body>'] },
    }),
  ]

  const memberBindings = cases.map((c) => ({
    caseId: c.id,
    memberIdentity: 'member-a5sf-sub-worker',
    toolBindingIdentity: c.id === 'sub:product-bash-executor' ? 'dsh.shell/bash' : 'dsh.subprocess/exec',
  }))

  // ── driver plan: the order gates must run in ──────────────────────────────
  const capture = { captures: ['body'], captureLimits: { body: { maxChars: null } } }
  const steps = [
    { id: 'preflight', produces: [], canFail: true, ...capture },
    { id: 'row-identity', produces: [], canFail: true, ...capture },
    { id: 'world-create', produces: ['world'], canFail: true, ...capture },
    { id: 'mock-start', requires: ['world'], produces: ['mock'], canFail: true, ...capture },
    { id: 'host-boot', requires: ['world', 'mock'], produces: ['host'], canFail: true, ...capture },
    { id: 'composition-handoff', requires: ['host'], produces: ['composed-profile'], canFail: true, ...capture },
    { id: 'health-poll', requires: ['composed-profile'], produces: ['health'], canFail: true, ...capture },
    { id: 'discovery-surface', requires: ['health'], produces: ['leader-surface'], canFail: true, ...capture },
    { id: 'team-create', requires: ['leader-surface'], produces: ['team-session'], canFail: true, ...capture },
    { id: 'state-gate', requires: ['team-session'], produces: ['team-state'], canFail: true, ...capture },
    { id: 'member-install', requires: ['team-state'], produces: ['member-session'], canFail: true, ...capture },
    { id: 'delegate-dispatch', requires: ['member-session'], produces: ['member-rows'], canFail: true, ...capture },
    { id: 'evidence-collection', requires: ['member-rows'], produces: ['samples'], canFail: true, ...capture },
    { id: 'teardown', requires: ['samples'], produces: ['teardown'], canFail: true, ...capture },
    { id: 'outcome-row', requires: ['teardown'], produces: ['dev-live-outcome'], canFail: true, ...capture },
  ]

  return {
    schema: 'a5sf-zero-boot-preflight/1',
    label: `Subprocess dev-live start #${String(bootSequence)} — executor identity, argv predicate, network-deny position (DEV-LIVE; development evidence, never a candidate claim)`,
    sources: {
      note: 'Built at run time from the World this start will boot. Development evidence only: recordClass DEV-LIVE can never produce V@B=yes.',
      driver: 'dev/agent-workflow/evidence/a5sf-sub-devlive/driver/run-boot.mjs',
      providerRow: 'dev/agent-workflow/evidence/a5sf-sub-devlive/driver/a5sf-sub-devlive-realm-row.mjs',
      evidence: 'dev/agent-workflow/evidence/a5sf-sub-devlive/README.md',
      limit: 'A DEV-LIVE start is development evidence. It does not move V@B, does not become a candidate claim, and does not certify the matrix. The network-deny observation is a face measurement reported in probe-report.json, not a tabled preflight case (see the module header).',
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
      requiredDistFaces: ['subprocess'],
      distFaces: { subprocess: true, fs: false, web: false },
      hostModules: hostModules.map((path) => ({ path, exists: existsSync(String(path).startsWith('/') ? String(path) : join(repoRoot, String(path))), role: 'declared by the plan' })),
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
      effectiveReadAllow: [paths.workspace],
      effectiveWriteAllow: [paths.workspace],
      networkAccess: 'deny',
      note: 'the read/write lane is the World workspace. network=deny is the DENY MEMBER template\'s compiled axis; it is measured by the face probe (probe-report.json) and deliberately not tabled as a preflight case: the closed network case class is web-caller-shaped and this face has no web caller.',
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
        { blueprintId: 'team.a5sf.sub.anchor', members: 1 },
        { blueprintId: 'team.a5sf.sub.main', members: 2 },
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
