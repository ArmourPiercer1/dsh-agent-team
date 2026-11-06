/**
 * make-bundles.mjs — emit the BL-18 pre-start preflight bundles.
 *
 * WHY A BUILDER AND NOT TWO HAND-WRITTEN JSON FILES. There are two bundles and
 * they must differ in EXACTLY ONE FIELD (`cases[].networkProbeEnforced`), so
 * that the pair is a control: the same plan passes or fails on nothing but the
 * honesty of the enforcement claim. Two hand-maintained files would drift and
 * the control would stop controlling. The emitted JSON is the deliverable; this
 * file is the reason it can be trusted.
 *
 *   preflight-bundle.json                  the PLAN. `networkProbeEnforced: false`
 *                                          (this host's provider probe reports
 *                                          `network-destination: unsupported`).
 *   preflight-enforced-claim.bundle.json   NEGATIVE CONTROL, not the plan. The
 *                                          SAME bundle with that one flag set
 *                                          true. It exists to show that a PASS
 *                                          payload is reachable ONLY by
 *                                          asserting an enforcement this host
 *                                          does not have.
 *
 * `candidate.head` / `grant.boundCommit` / `runRecord.teamSha` are the commit
 * that carries the run's rows and this proof — read from `git rev-parse HEAD`
 * at emit time, never typed.
 *
 * USAGE
 *   node dev/agent-workflow/evidence/a5sf-bl18-live/make-bundles.mjs [--head <sha>] [--out <dir>]
 *
 * @module dev/agent-workflow/evidence/a5sf-bl18-live/make-bundles
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..', '..')
const argv = process.argv.slice(2)
const argOf = (flag) => {
  const i = argv.indexOf(flag)
  return i === -1 ? undefined : argv[i + 1]
}
const OUT_DIR = resolve(argOf('--out') ?? HERE)
const HEAD = argOf('--head') ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim()
const AUTHORITY_FILE = join(REPO, 'dev', 'engineering', 'current-authority.json')
const authorityPointer = JSON.parse(execFileSync('node', [join(REPO, 'scripts', 'current-authority.mjs')], { cwd: REPO, encoding: 'utf8' }))
// The EB3 run-manifest contract hashes the POINTER FILE BYTES; same convention here.
const pointerBytesSha256 = createHash('sha256').update(readFileSync(AUTHORITY_FILE)).digest('hex')

const BASELINE = authorityPointer.six.baseline
const CONTENT_DIGEST = authorityPointer.content_digest
const SNAPSHOT_VERSION = authorityPointer.snapshot_version

const MEMBER = 'inst-bl18-web'
const MEMBER_TEMPLATE = 'webworker'
const BINDING = 'team/web'
const URL_FETCH = 'https://example.test/legal/page'
const URL_SEARCH = 'https://example.test/legal/search'

/** The two cases the run exists to observe. */
function denyCases(networkProbeEnforced) {
  return [
    {
      id: 'web-fetch-deny',
      face: 'web',
      axis: 'network',
      locator: URL_FETCH,
      guardFactKey: 'web-fetch-deny',
      expected: 'deny',
      method: 'fetch',
      collector: 'guard-fact',
      returnShape: ['call', 'result', 'claim'],
      terminate: true,
      archiveBeforeStart: true,
      corpus: ['web-fetch-deny'],
      observable: 'pre-provider-refusal',
      expectedCode: 'NETWORK_UNCONFINED_REALM',
      expectedFact: { method: 'web:fetch', decision: 'deny', decidedBy: 'NETWORK_UNCONFINED_REALM' },
      providerEntries: 0,
      networkProbeEnforced,
    },
    {
      id: 'web-search-deny',
      face: 'web',
      axis: 'network',
      locator: URL_SEARCH,
      guardFactKey: 'web-search-deny',
      expected: 'deny',
      method: 'search',
      collector: 'guard-fact',
      returnShape: ['call', 'result', 'claim'],
      terminate: true,
      archiveBeforeStart: true,
      corpus: ['web-search-deny'],
      observable: 'pre-provider-refusal',
      expectedCode: 'NETWORK_UNCONFINED_REALM',
      expectedFact: { method: 'web:search', decision: 'deny', decidedBy: 'NETWORK_UNCONFINED_REALM' },
      providerEntries: 0,
      networkProbeEnforced,
    },
  ]
}

function bundleOf({ label, note, networkProbeEnforced }) {
  const planNote = [
    'BL-18 live deny lane, planned on the OPTIONAL teamA5sfRealm composition seam (evidence/a5sf-web/README.md §8b).',
    'The product config path (a5sfMemberPolicies) is NOT used for the deny lane: product-assembly.ts refuses a narrowing',
    'network mode at composition with NETWORK_UNCONFINED_REALM (assembly-proof.mjs scenario A).',
    'The realm compiles the deny ceiling + a confined web face; the face refuses at admission with the typed code.',
    'CALLER (assembly-proof.mjs scenario D): the LEADER cannot be the caller (no realm mounts for the root session; and',
    'web_fetch/web_search are KNOWN_SENSITIVE_UNMANAGED, so a strict leader must deny them). The caller is a Member whose',
    'template declares NO capabilities.permissions (legacy mode: no A2C-2 gate) and whose PRESET surfaces',
    'web_fetch/web_search, so route-C can shadow the pair instead of ADDING it (scenario C2).',
    'NOT CLAIMED: OS-level network isolation. The refusal is an admission decision (evidence/a5sf-subprocess-face/README.md §7).',
  ].join(' ')
  return {
    schema: 'a5sf-zero-boot-preflight/1',
    label,
    sources: {
      note,
      planNote,
      assemblyProof: 'dev/agent-workflow/evidence/a5sf-bl18-live/assembly-proof.mjs (host-free, green)',
      prediction: 'dev/agent-workflow/evidence/a5sf-surface/README.md §6 (boot-4 prediction)',
      seamRecipe: 'dev/agent-workflow/evidence/a5sf-web/README.md §8b',
      markerMock: 'dev/agent-workflow/evidence/a5sf-bl18-live/bl18-marker-mock.mjs (routing proven host-free)',
    },
    assembly: {
      requiredDistFaces: ['fs', 'web'],
      distFaces: { fs: true, subprocess: true, web: true },
      hostModules: [
        { path: 'tests/deepseek-harness-test-use/packages/web/tool-web/lib/index.js', role: 'the REAL pinned web_fetch/web_search rows the realm shadows' },
        { path: 'tests/deepseek-harness-test-use/packages/web/web/lib/index.js', role: 'the host `web` service class the confined face shadows' },
      ],
      rowHandoff: {
        usesHandOverRows: true,
        beforeBoot: true,
        emittedRowIds: ['u5-canary', 'u6-fs-probe-host', 'a5sf-bl18-web-offer', 'dsh-agent-team', 'p6t6-team-tools', 'preset-a5sf-bl18-base'],
        worldRowIds: ['u5-canary', 'u6-fs-probe-host', 'a5sf-bl18-web-offer', 'dsh-agent-team', 'p6t6-team-tools', 'preset-a5sf-bl18-base'],
        healthProbeRowPresent: true,
      },
      seamRow: {
        id: 'a5sf-bl18-web-offer',
        provides: 'teamA5sfRealm',
        answers: 'compiledFor(member) -> { members:[{identity, policy}], web:{ effective, provider:{fetch,search,probe} } }',
        oneSourcePerRealm: 'config.a5sfWebFace MUST be absent when the service answers a web face (two sources refuse)',
      },
      presetRow: {
        id: 'preset-a5sf-bl18-base',
        mustSurface: ['web_fetch', 'web_search'],
        why: 'route-C refuses to ADD a name: a preset without the pair makes the native shadow refuse (assembly-proof.mjs scenario C2)',
        composition: ['persona', '@deepseek-ai/dsh-tool-fs', 'persistent-shell group', '@deepseek-ai/dsh-tool-web'],
      },
    },
    identity: {
      bootRoot: 'session-bl18-anchor',
      teamRoot: 'session-bl18-root',
      createRoot: 'session-bl18-root',
      stateQueryRoot: 'session-bl18-root',
      toolRouteRoot: 'session-bl18-root',
      archiveRoot: 'session-bl18-root',
      oracleRoot: 'session-bl18-root',
      directiveRoot: 'session-bl18-root',
      blueprints: [
        { blueprintId: 'team.a5sf.bl18.anchor', members: 1, role: 'anchor (boot root)' },
        { blueprintId: 'team.a5sf.bl18', members: 1, role: 'acceptance team (created)' },
      ],
      memberBindings: [
        { caseId: 'web-fetch-deny', memberIdentity: MEMBER, toolBindingIdentity: BINDING },
        { caseId: 'web-search-deny', memberIdentity: MEMBER, toolBindingIdentity: BINDING },
      ],
      callerMember: {
        templateId: MEMBER_TEMPLATE,
        capabilities: 'ABSENT (legacy mode: no capabilities.permissions => A2C-2 does not run for this Member)',
        why: 'a strict Member cannot surface web_fetch (known-sensitive-unmanaged) AND cannot deny it (route-C would ADD the name)',
      },
    },
    authority: {
      snapshotVersion: SNAPSHOT_VERSION,
      contentDigest: CONTENT_DIGEST,
      pointerSha256: pointerBytesSha256,
    },
    candidate: {
      head: HEAD,
      baseline: BASELINE,
      productTreeProof: [],
      note: 'the run executes at candidate.head; no product path differs from the baseline for this lane (no product change)',
    },
    grant: {
      grantId: 'P2-04-bl18-live-remaining-1',
      grantedBy: 'owner ruling 2026-11-06 「批准5次P2-04预算」 (allocation #2 = BL-17 live; BL-18 = the remaining start)',
      boundCommit: HEAD,
      priorRows: 4,
      plannedStarts: 1,
      maxStarts: 5,
    },
    runRecord: {
      teamSha: HEAD,
      bindings: {
        authority: {
          pointer: { snapshot_version: SNAPSHOT_VERSION, content_digest: CONTENT_DIGEST, pointerSha256: pointerBytesSha256 },
        },
      },
      ledger: { bootRows: 1, plannedStarts: 1, aborts: 0 },
    },
    nativeModules: [
      {
        name: '@deepseek-ai/dsh-tool-web',
        path: 'tests/deepseek-harness-test-use/packages/web/tool-web/lib/index.js',
        inject: ['tools', 'web', 'systemPrompt'],
        requiredConfig: [],
        config: {},
        expectedTools: ['web_fetch', 'web_search'],
        role: 'the REAL pinned pair, re-mounted by the row route-C inside the Member scope',
      },
    ],
    policy: {
      effectiveReadAllow: ['/w/workspace'],
      effectiveWriteAllow: ['/w/workspace'],
      networkAccess: 'deny',
      dispositions: {},
      fifo: null,
      note: 'the web face reads only effective.network.access; this bundle declares the axis the compiled lane carries',
    },
    cases: denyCases(networkProbeEnforced),
    fixtures: {
      'web-fetch-deny': {
        input: URL_FETCH,
        method: 'fetch',
        provider: 'composition boundary whose probe answers network-destination=unsupported; every entry is counted',
        expectedProviderEntries: 0,
        sink: 'config.a5sfEvidencePath',
      },
      'web-search-deny': {
        input: URL_SEARCH,
        method: 'search',
        provider: 'the SAME boundary instance (one transport per realm)',
        expectedProviderEntries: 0,
        sink: 'config.a5sfEvidencePath',
      },
    },
    driver: {
      steps: [
        { id: 'boot', produces: ['boot-health'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'discover-leader-surface', requires: ['boot-health'], produces: ['leader-surface'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'create-team', requires: ['leader-surface'], produces: ['team-session'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'create-member', requires: ['team-session'], produces: ['member'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'delegate-items', requires: ['member'], produces: ['member-turn'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'collect-fence', requires: ['member-turn'], produces: ['collected'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'teardown', requires: ['collected'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
      ],
      plannedCases: ['web-fetch-deny', 'web-search-deny'],
      markerRouting: {
        source: 'bl18-marker-mock.mjs',
        markers: ['MK_BL18_DISC', 'MK_BL18_CREATE', 'MK_BL18_FETCH', 'MK_BL18_SEARCH', 'MK_BL18_COLLECT'],
        rule: 'marker-keyed, never ordinal; an unmarked or repeated turn gets a harmless no-tool reply',
      },
      blueprint: {
        leader: {
          tools: ['bash', 'edit', 'read', 'read_image', 'team_archive_member', 'team_delegate', 'u5_canary', 'u6fs_probe', 'web_fetch', 'web_search', 'write'],
          builtinToolDeny: 'discovery-first',
          worldRows: { 'u5-canary': ['u5_canary'], 'u6-fs-probe-host': ['u6fs_probe'] },
          presetTools: ['bash', 'edit', 'read', 'read_image', 'web_fetch', 'web_search', 'write'],
          teamTools: ['team_delegate', 'team_archive_member'],
          mcpTools: [],
          safeUnmanaged: ['todo_write'],
          note: 'discovery-first computes the deny list with A2C-2 CLASSIFIER itself; web_fetch/web_search are denied here and stay surfaced for the LEGACY Member',
        },
      },
    },
    disclosures: [
      'The run measures an ADMISSION refusal at the web face, not OS-level network isolation (a5sf-subprocess-face/README.md §7: refusing to fetch is a statement about our admission code, made before the OS was asked).',
      'No grade, no V@B, no product change: the matrix row M-14 keeps NOT_WIRED / V@B=no.',
      'The web provider is a composition boundary; a "zero provider entries" counter is not a kernel/transport observation.',
      'The caller Member is legacy/non-strict (no capabilities.permissions). The run therefore measures the IO face, not the A2C-2 permission lane.',
    ],
  }
}

mkdirSync(OUT_DIR, { recursive: true })
const plan = bundleOf({
  label: 'BL-18 live deny lane — teamA5sfRealm seam, confined web face, truthful enforcement declaration',
  note: 'THE PLAN. networkProbeEnforced=false because this host reports network-destination unsupported.',
  networkProbeEnforced: false,
})
const control = bundleOf({
  label: 'NEGATIVE CONTROL (NOT THE PLAN) — the same bundle with networkProbeEnforced=true',
  note: 'NOT A PLAN. Exists only to prove that a PASS payload is reachable by asserting the one field the host cannot support.',
  networkProbeEnforced: true,
})

writeFileSync(join(OUT_DIR, 'preflight-bundle.json'), `${JSON.stringify(plan, null, 2)}\n`)
writeFileSync(join(OUT_DIR, 'preflight-enforced-claim.bundle.json'), `${JSON.stringify(control, null, 2)}\n`)
process.stdout.write(`wrote ${join(OUT_DIR, 'preflight-bundle.json')} (head ${HEAD.slice(0, 12)}…)\n`)
process.stdout.write(`wrote ${join(OUT_DIR, 'preflight-enforced-claim.bundle.json')} (same plan, networkProbeEnforced=true)\n`)
