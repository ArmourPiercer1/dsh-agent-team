/**
 * a5sf-web-row.test.mjs — BL-18 LIVE-HALF UNBLOCK: the confined `web` face
 * forwarded and configured through the PRODUCT ROW.
 *
 * WHY THIS SUITE EXISTS. `evidence/a5sf-web/README.md` §8 marks five of eight
 * live steps `BLOCKED` for one reason, in the lane's own words: the realm row
 * (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`) forwards
 * `compiled.subprocess` but NOT `compiled.web`, and no row config key carries a
 * confined web provider — so there is no product-shaped composition a deny-lane
 * `strace` could be hung on. The backend round proved the face behind a bespoke
 * harness; this suite proves the row can carry it.
 *
 * WHAT IS MEASURED (host-free: in-process Cordis roots, mkdtemp sinks, no boot,
 * no port, no DSH_HOME):
 *
 *   ROW-FACE-FORWARDED   a provider answer carrying `web: { effective,
 *                        provider.fetch }` is forwarded by the PRODUCT row
 *                        (`mountMemberA5sfRealm`), so the mounted realm answers
 *                        `faces.web !== null` — the mirror of `compiled.subprocess`.
 *   ROW-DENY             the deny lane, driven through the row's OWN
 *                        `attachA5sfNativeToolModules` and the REAL pinned
 *                        `@deepseek-ai/dsh-tool-web`: ONE `web:fetch` deny fact
 *                        (`NETWORK_UNCONFINED_REALM`), ZERO provider fetches,
 *                        ZERO DNS/connect/proxy entries, and the inherited host
 *                        `ctx.web` tripwire never consulted.
 *   ROW-ALLOW            the allow lane reaches the provider EXACTLY once with
 *                        the declared URL, one ALLOW fact carrying the typed
 *                        redirect/proxy residual.
 *   ROW-ABSENCE-TYPED    `compiled.web` DECLARED with no provider refuses at
 *                        composition time with the typed
 *                        `NETWORK_UNCONFINED_REALM` — never a mounted tool that
 *                        silently falls back to the inherited host face.
 *   ROW-CONFIG-FACE      the row config key `a5sfWebFace` names a module whose
 *                        factory answers the SAME `{ effective, provider }`
 *                        shape, so a row with NO web field in its compiled
 *                        answer still mounts the confined face (the config half
 *                        of "forwarded and configured").
 *   ROW-CONFIG-ABSENCE   the same key with a factory that supplies no provider
 *                        refuses typed; a blank specifier is a config fault.
 *   ROW-AMBIGUOUS        both sources for one realm refuse (two web-face
 *                        authorities is a fork).
 *   ROW-NO-FACE          a realm that declares NO web face is UNCHANGED:
 *                        `faces.web === null` and the real `tool-web` module is
 *                        refused typed at composition time (context control —
 *                        green on pristine sources too).
 *
 * THE DECISION IS NOT RECOMPUTED HERE. The factory the config names is an
 * ordinary composition caller of the ONE compiler (`compileEffectiveIo`); the
 * row never intersects a lane, never reads a blueprint and never evaluates the
 * network axis. The face it forwards consults `effective.network.access` and
 * BL-17's imported `probeNetworkDenial`, exactly as the backend round wired.
 *
 * Run: node --test tests/world-factory/a5sf-web-row.test.mjs
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { after, test } from 'node:test'

import {
  DECLARED_URL,
  WEB_IDENTITY,
  drive,
  effectiveOf,
  fakeWebBoundary,
  loadWebSeams,
  makeBaseFsClass,
  makeHostWebTripwire,
  refusalCode,
  textOf,
} from './lib/a5sf-web-arms.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const seams = await loadWebSeams(REPO)
const runtimeRequire = createRequire(join(REPO, 'packages/runtime/package.json'))
const { bindScopeParent } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)

/** The row module under test — the PRODUCT call site, not a seam double. */
const ROW_PATH = join(REPO, 'packages/runtime/src/plugin/live/a5sf-realm-row.mjs')
const row = await import(pathToFileURL(ROW_PATH).href)

/** The REAL pinned `tool-web` module (read-only import from the pristine tree). */
const TOOL_WEB = join(seams.pristine, 'packages/web/tool-web/lib/index.js')

const WORLDS = []
after(async () => {
  for (const world of WORLDS.splice(0).reverse()) {
    try {
      await world.realm?.dispose()
    } catch {
      // The arm's own failure is the one reported.
    }
  }
  for (const dir of CLEANUP.splice(0)) rmSync(dir, { recursive: true, force: true })
})
const CLEANUP = []

function tempDir(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-web-row-${label}-`))
  CLEANUP.push(dir)
  return dir
}

/**
 * Build the PRODUCT topology the live Member setup uses, then call the row:
 * a standing PRESET scope carrying the real `tool-web` row, an agent scope whose
 * parent is that standing key, the base `fs` + a host `web` TRIPWIRE (so an
 * accidental inherited resolution is a measured failure), and the row's own
 * `mountMemberA5sfRealm`.
 */
async function rowWorld({
  network = 'allow',
  compiledWeb,
  configWebFace,
  withWebFace = true,
  probeLevel = 'unsupported',
} = {}) {
  const BaseFs = makeBaseFsClass(seams.Service)
  const HostWeb = makeHostWebTripwire(seams.Service)
  HostWeb.calls = 0
  const root = new seams.Context()
  await root.plugin(seams.SystemPrompt)
  await root.plugin(seams.ToolRuntime)
  await root.plugin(HostWeb, {})
  await root.plugin(BaseFs, {})

  // The preset plane: the REAL pinned tool-web module on the STANDING scope.
  const standingKey = {}
  const standing = seams.createScope(root, standingKey)
  await standing.ctx.plugin(seams.toolWeb, {})
  const agentKey = { session: { header: {} } }
  const agent = seams.createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)

  const boundary = fakeWebBoundary({ probeLevel })
  const dir = tempDir(`${network}-${withWebFace ? 'web' : 'none'}`)
  const sink = join(dir, 'consult.jsonl')
  const config = { a5sfEvidencePath: sink }
  if (configWebFace !== undefined) Object.assign(config, configWebFace(boundary, network))

  const face = compiledWeb ?? (withWebFace
    ? { effective: effectiveOf(seams, { network }), provider: boundary, realmId: 'realm-web-row' }
    : undefined)

  let realm
  let error
  try {
    realm = await row.mountMemberA5sfRealm({
      root: agent.ctx,
      a5sfConfig: row.a5sfRealmConfigOf(config),
      provider: () => ({
        compiledFor: () => ({
          members: [{ identity: WEB_IDENTITY, policy: { ok: true, value: memberPolicy(network) } }],
          providerClass: BaseFs,
          ...(face === undefined ? {} : { web: face }),
        }),
      }),
      member: {
        sessionId: 'session-a5sf-web-row',
        instanceId: WEB_IDENTITY.memberInstanceId,
        teamRootSessionId: 'team-root-a5sf-web-row',
        templateId: WEB_IDENTITY.templateId,
      },
    })
  } catch (caught) {
    error = caught
  }

  const world = { root, agentKey, agentCtx: agent.ctx, realm, error, boundary, HostWeb, sink, seams, dir }
  WORLDS.push(world)
  return world
}

/** The compiled Member policy (the ceiling the ONE compiler consumes). */
function memberPolicy(network) {
  return Object.freeze({
    memberIdentity: WEB_IDENTITY.memberInstanceId,
    templateId: WEB_IDENTITY.templateId,
    instanceGeneration: WEB_IDENTITY.instanceGeneration,
    revision: 'rev-a5sf-web-row',
    read: Object.freeze({ mode: 'restricted', allow: Object.freeze(['/tmp']), ask: Object.freeze([]), deny: Object.freeze([]) }),
    write: Object.freeze({ mode: 'restricted', allow: Object.freeze(['/tmp']), ask: Object.freeze([]), deny: Object.freeze([]) }),
    network: Object.freeze({ access: network }),
  })
}

/** Attach the REAL tool-web module through the row's OWN route-C call. */
async function attachToolWeb(world) {
  return row.attachA5sfNativeToolModules(
    world.realm,
    world.agentCtx,
    row.a5sfRealmConfigOf({
      a5sfEvidencePath: world.sink,
      a5sfNativeToolModules: [{ url: TOOL_WEB, expectedTools: ['web_fetch', 'web_search'] }],
    }),
    world.agentKey,
  )
}

/** The guard facts the row's sink holds (read through the product reader). */
async function factsOf(world) {
  const { readGuardConsultFile } = await import(
    pathToFileURL(join(REPO, 'packages/runtime/team-services/src/guard-observability.ts')).href
  )
  return readGuardConsultFile(world.sink)
}

// ---------------------------------------------------------------------------
// ROW-FACE-FORWARDED — the mirror of the subprocess block
// ---------------------------------------------------------------------------

test('ROW-FACE-FORWARDED: the product row forwards compiled.web, so the realm answers faces.web !== null', async () => {
  const world = await rowWorld({ network: 'allow' })
  assert.equal(world.error, undefined, `the row must mount the declared web face: ${String(world.error?.message ?? '')}`)
  assert.notEqual(world.realm, undefined, 'the realm was mounted')
  const faces = world.realm.installation.members[0].faces
  assert.notEqual(faces.web, null, 'compiled.web reached installMemberIoProviders (faces.web is a mounted face, not null)')
  assert.equal(typeof faces.web.fetch, 'function')
  assert.equal(typeof faces.web.search, 'function')
  // The sibling faces keep their existing shape (no refactor of subprocess).
  assert.equal(faces.fs, 'confined')
  assert.equal(faces.subprocess, null)
})

// ---------------------------------------------------------------------------
// ROW-DENY — the deny lane is measurable from the PRODUCT composition
// ---------------------------------------------------------------------------

test('ROW-DENY: network deny, driven through the product row, refuses BEFORE the provider: 0 fetch/DNS/connect/proxy, one typed fact', async () => {
  const world = await rowWorld({ network: 'deny' })
  assert.equal(world.error, undefined, `mount must succeed: ${String(world.error?.message ?? '')}`)
  await attachToolWeb(world)
  const result = await drive(world, 'web_fetch', { url: DECLARED_URL }, 'row-deny')

  // The refusal reaches the model face as a typed failure...
  assert.equal(result.isError, true, 'the deny lane must not produce an admitted result')
  // The tool layer renders the refusal MESSAGE to the model; the TYPED code is
  // on the guard fact asserted below (`decidedBy`), never string-parsed from it.
  assert.match(textOf(result), /refusing before any provider call/, 'the refusal (not a fabricated result) reached the model face')
  // ...and it happened BEFORE the only object that owns a transport.
  assert.equal(world.boundary.fetches.length, 0, 'zero provider fetches')
  assert.equal(world.boundary.dnsLookups, 0, 'zero DNS lookups')
  assert.equal(world.boundary.connects, 0, 'zero connects')
  assert.equal(world.boundary.proxyLookups, 0, 'zero proxy lookups')
  assert.equal(world.HostWeb.calls, 0, 'the inherited host web service was never consulted')

  const facts = (await factsOf(world)).filter((fact) => String(fact.method).startsWith('web:'))
  assert.equal(facts.length, 1, 'exactly one web guard fact')
  assert.equal(facts[0].method, 'web:fetch')
  assert.equal(facts[0].decision, 'deny')
  assert.equal(facts[0].decidedBy, 'NETWORK_UNCONFINED_REALM')
  assert.equal(facts[0].locator, DECLARED_URL)
})

// ---------------------------------------------------------------------------
// ROW-ALLOW — exactly one provider call, admitted through the same face
// ---------------------------------------------------------------------------

test('ROW-ALLOW: network allow reaches the provider EXACTLY once with the declared URL and one ALLOW fact', async () => {
  const world = await rowWorld({ network: 'allow' })
  assert.equal(world.error, undefined, `mount must succeed: ${String(world.error?.message ?? '')}`)
  await attachToolWeb(world)
  const result = await drive(world, 'web_fetch', { url: DECLARED_URL }, 'row-allow')
  assert.equal(result.isError, false, `the admitted call must succeed: ${textOf(result)}`)
  assert.equal(world.boundary.fetches.length, 1, 'exactly one provider fetch')
  assert.equal(world.boundary.fetches[0].url, DECLARED_URL)
  assert.match(textOf(result), /BL18-MOCK-BODY/, 'the provider body reached the model face')
  assert.equal(world.HostWeb.calls, 0)

  const facts = (await factsOf(world)).filter((fact) => String(fact.method).startsWith('web:'))
  assert.equal(facts.length, 1)
  assert.equal(facts[0].decision, 'allow')
  assert.equal(facts[0].decidedBy, 'ALLOW')
  assert.deepEqual(facts[0].annotations, [
    'WEB_REDIRECT_UNMEDIATED_ON_ALLOW',
    'WEB_PROXY_ENV_UNMEDIATED_ON_ALLOW',
  ])
})

// ---------------------------------------------------------------------------
// ROW-ABSENCE-TYPED — declared face, no provider: refuse at composition time
// ---------------------------------------------------------------------------

test('ROW-ABSENCE-TYPED: a declared compiled.web with no provider refuses typed at composition time (never a silent host fallback)', async () => {
  const world = await rowWorld({ compiledWeb: { effective: effectiveOf(seams, { network: 'deny' }) } })
  assert.notEqual(world.error, undefined, 'a declared web face that cannot mount must refuse, not mount without it')
  assert.equal(refusalCode(world.error), 'NETWORK_UNCONFINED_REALM', 'the refusal carries the typed code')
  assert.equal(world.realm, undefined, 'no realm was mounted (nothing can fall back to the host face)')
  // The refusal happened before any provider could be entered.
  assert.equal(world.boundary.fetches.length, 0)
})

// ---------------------------------------------------------------------------
// ROW-CONFIG-FACE — the row CONFIG key carries the face factory
// ---------------------------------------------------------------------------

/**
 * Write a factory module the row config can name. It is an ordinary composition
 * caller of the ONE compiler — exactly what the boot composition would do — and
 * it returns the SAME `{ effective, provider }` shape the compiled answer
 * carries. `bad` returns a shape that cannot mount.
 */
function writeFaceFactory(label, { bad = false } = {}) {
  const dir = tempDir(`factory-${label}`)
  const file = join(dir, 'web-face.mjs')
  const compiler = pathToFileURL(join(REPO, 'packages/runtime/member-io-policy/src/index.ts')).href
  writeFileSync(file, `
import { compileEffectiveIo } from ${JSON.stringify(compiler)}

export function createConfinedWebFace({ member, config }) {
  const policy = member.policy.value
  const lane = (allow) => ({ mode: 'restricted', allow, ask: [], deny: [] })
  const compiled = compileEffectiveIo(policy, {
    bindingIdentity: 'dsh.web/fetch',
    read: lane(['/tmp']),
    write: lane(['/tmp']),
    network: policy.network.access,
  }, {
    memberIdentity: policy.memberIdentity,
    callId: 'call-a5sf-web-row-factory',
    policyRevision: policy.revision,
    toolBindingIdentity: 'dsh.web/fetch',
    approvedOnce: false,
  })
  if (!compiled.ok) throw new Error('factory compile refused: ' + JSON.stringify(compiled))
  return {
    effective: compiled.value,
    provider: config.provider,
    realmId: 'realm-web-row-config',
  }
}
`)
  if (bad) {
    writeFileSync(file, `
export function createConfinedWebFace() {
  return { effective: {} }
}
`)
  }
  return pathToFileURL(file).href
}

test('ROW-CONFIG-FACE: the row config key a5sfWebFace carries a factory, and the config half of the row mounts the confined face', async () => {
  const world = await rowWorld({
    network: 'deny',
    withWebFace: false,
    configWebFace: (boundary) => ({
      a5sfWebFace: { url: writeFaceFactory('good'), config: { provider: boundary } },
    }),
  })
  assert.equal(world.error, undefined, `the config-declared face must mount: ${String(world.error?.message ?? '')}`)
  assert.notEqual(world.realm, undefined)
  assert.notEqual(world.realm.installation.members[0].faces.web, null, 'the config factory supplied the face')
  await attachToolWeb(world)
  const result = await drive(world, 'web_fetch', { url: DECLARED_URL }, 'row-config-face')
  assert.equal(result.isError, true)
  assert.match(textOf(result), /refusing before any provider call/)
  assert.equal(world.boundary.fetches.length, 0, 'the deny lane still refuses before the provider')
  const facts = (await factsOf(world)).filter((fact) => String(fact.method).startsWith('web:'))
  assert.equal(facts.length, 1)
  assert.equal(facts[0].decidedBy, 'NETWORK_UNCONFINED_REALM')
})

test('ROW-CONFIG-ABSENCE: a config factory that supplies no provider refuses typed; a blank specifier is a config fault', async () => {
  const bad = await rowWorld({
    withWebFace: false,
    configWebFace: () => ({ a5sfWebFace: writeFaceFactory('bad', { bad: true }) }),
  })
  assert.notEqual(bad.error, undefined, 'a factory that supplies no provider must refuse, not mount a half face')
  assert.equal(refusalCode(bad.error), 'NETWORK_UNCONFINED_REALM')

  const blank = await rowWorld({ withWebFace: false, configWebFace: () => ({ a5sfWebFace: '   ' }) })
  assert.notEqual(blank.error, undefined, 'a blank a5sfWebFace specifier is a configuration fault')
  assert.ok(blank.error instanceof TypeError, 'the config fault is the row reader\'s typed TypeError')
  assert.match(String(blank.error.message), /a5sfWebFace/)
})

test('ROW-AMBIGUOUS: compiled.web AND a config factory for one realm refuse (two web-face sources is a fork)', async () => {
  const world = await rowWorld({
    network: 'allow',
    configWebFace: (boundary) => ({
      a5sfWebFace: { url: writeFaceFactory('ambiguous'), config: { provider: boundary } },
    }),
  })
  assert.notEqual(world.error, undefined, 'both sources present must refuse')
  assert.equal(refusalCode(world.error), 'REALM_DECLARATION_INVALID')
})

// ---------------------------------------------------------------------------
// ROW-NO-FACE — the default product path is unchanged
// ---------------------------------------------------------------------------

test('ROW-NO-FACE: a realm that declares no web face is unchanged — web: null and the real tool-web module is refused typed', async () => {
  const world = await rowWorld({ withWebFace: false })
  assert.equal(world.error, undefined, 'a realm without a web face still mounts (default-preserving)')
  // PD-13 (2026-11-11): the faces answer is total, so the terminal axis is an
  // explicit `null` here — this realm declares no terminal face either.
  assert.deepEqual(world.realm.installation.members[0].faces, { fs: 'confined', subprocess: null, web: null, terminals: null })
  // The composition-time refusal is the shipped one, not a new decision point.
  const attachment = await attachToolWeb(world).then(() => undefined, (error) => error)
  assert.notEqual(attachment, undefined, 'the real tool-web module may not mount on a faceless realm')
  assert.equal(refusalCode(attachment), 'NETWORK_UNCONFINED_REALM')
})

// ---------------------------------------------------------------------------
// ROW-PRODUCT-DECLARATION — the shipped PRODUCT declaration path + the config
// factory: a row with no `teamA5sfRealm` service still gets the confined face
// ---------------------------------------------------------------------------

/** A v4 blueprint whose `memberIoCeilings` are exactly the declaration's. */
function blueprintSourceFor(decl) {
  const document = {
    schemaVersion: 4,
    blueprintId: decl.teamId,
    revision: decl.blueprintRevision,
    leader: { templateId: 'leader', persona: 'Lead.' },
    members: decl.members.map((member) => ({ templateId: member.templateId, persona: `Worker ${member.templateId}.` })),
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: decl.members.map((member) => ({ templateId: member.templateId, io: member.ceiling })),
  }
  return `---\n${JSON.stringify(document, null, 2)}\n---\n`
}

function productDeclaration() {
  const lane = (allow) => ({ mode: 'restricted', allow, ask: [], deny: [] })
  const ceiling = {
    read: lane(['/tmp']),
    write: { mode: 'all', deny: [] },
    network: { mode: 'allow' },
  }
  return {
    schema: 'a5sf-product-member-policies/1',
    teamId: 'team.a5sf.webrow',
    blueprintRevision: '1',
    authority: { revision: 'a4:webrow:1', admitted: true },
    members: [{ templateId: WEB_IDENTITY.templateId, instanceGeneration: WEB_IDENTITY.instanceGeneration, ceiling }],
  }
}

test('ROW-PRODUCT-DECLARATION: the shipped product declaration path + a5sfWebFace mounts the confined face with NO teamA5sfRealm service', async () => {
  const decl = productDeclaration()
  const boundary = fakeWebBoundary()
  const dir = tempDir('product-declaration')
  const sink = join(dir, 'consult.jsonl')
  const BaseFs = makeBaseFsClass(seams.Service)
  const HostWeb = makeHostWebTripwire(seams.Service)
  HostWeb.calls = 0
  const root = new seams.Context()
  await root.plugin(seams.SystemPrompt)
  await root.plugin(seams.ToolRuntime)
  await root.plugin(HostWeb, {})
  await root.plugin(BaseFs, {})
  const standingKey = {}
  const standing = seams.createScope(root, standingKey)
  await standing.ctx.plugin(seams.toolWeb, {})
  const agentKey = { session: { header: {} } }
  const agent = seams.createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)

  const config = row.a5sfRealmConfigOf({
    a5sfMemberPolicies: decl,
    blueprintSource: blueprintSourceFor(decl),
    // The product path needs NO sink; a measurement composition configures one
    // to READ the decision (the row's optional observation channel).
    a5sfEvidencePath: sink,
    a5sfWebFace: { url: writeFaceFactory('product'), config: { provider: boundary } },
  })
  const realm = await row.mountMemberA5sfRealm({
    root: agent.ctx,
    a5sfConfig: config,
    // The glue ALWAYS forwards this accessor; the product path must NOT need a
    // `teamA5sfRealm` service behind it. `undefined` is that world.
    provider: () => undefined,
    member: {
      sessionId: 'session-product-web-row',
      instanceId: 'mi-product-web-row',
      teamRootSessionId: 'team-root-product-web-row',
      templateId: WEB_IDENTITY.templateId,
    },
  })
  const world = { root, agentKey, agentCtx: agent.ctx, realm, boundary, HostWeb, sink, seams, dir }
  WORLDS.push(world)
  assert.notEqual(realm, undefined, 'the product declaration mounted its realm')
  assert.notEqual(realm.installation.members[0].faces.web, null, 'the config factory supplied the confined face')
  await attachToolWeb(world)
  const result = await drive(world, 'web_fetch', { url: DECLARED_URL }, 'product-declaration')
  assert.equal(result.isError, false, `the allow lane must reach the provider: ${textOf(result)}`)
  assert.equal(boundary.fetches.length, 1, 'exactly one provider call')
  assert.equal(boundary.fetches[0].url, DECLARED_URL)
  assert.equal(HostWeb.calls, 0)
  const facts = (await factsOf(world)).filter((fact) => String(fact.method).startsWith('web:'))
  assert.equal(facts.length, 1)
  assert.equal(facts[0].decision, 'allow')
})

// ---------------------------------------------------------------------------
// ROW-NO-SECOND-COMPILER — the row decides nothing; the face owns the decision
// ---------------------------------------------------------------------------

test('ROW-NO-SECOND-COMPILER: the row never compiles a lane, never intersects one and never evaluates a network decision', async () => {
  const source = readFileSync(ROW_PATH, 'utf8')
  // CALL syntax only: the doc comments NAME the seam the row must not own.
  for (const call of ['compileEffectiveIo(', 'intersectLane(', 'probeNetworkDenial(', 'createWebNetworkGuard(']) {
    assert.equal(source.includes(call), false, `the row must not own \`${call})\` (the ONE compiler / the ONE probe / the ONE guard live elsewhere)`)
  }
  // The CONFIG key only carries a factory; the row forwards its answer verbatim.
  assert.match(source, /A5SF_WEB_FACE_KEY = 'a5sfWebFace'/, 'the config key is a plain module specifier carrier')
})
