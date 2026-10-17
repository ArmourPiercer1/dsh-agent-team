/**
 * a5pbr2-row.mjs — P-B-R2 LIVE assembly row (pb §6 binding feed, positive-control lane).
 *
 * A PLAIN plugin row mounted through the public profile-patch seam
 * (`$DSH_HOME/profiles/web/cordis.patch.yml`) — the same public seam W5/the
 * bind-diag round use (IF-1). It carries the TEST-SIDE live assembly of the
 * pb §6 BINDING FEED into real session Agents, with production parts only:
 * `installScopedToolGuard` / `definitionIdentityOf` are imported from the
 * COMMITTED dist mirror (`packages/runtime/dist/packages/runtime/tool-dispatch/index.js`)
 * — the very bytes the git-install surface ships (the W0a byte-identity
 * argument: the face under test is the factory face).
 *
 * Three sessions share one host, one name: `read` — the SAME name the
 * installed production entry was refused on (install-entry `6a0f8e19`,
 * bind-diag 17/17×3):
 *
 *   role 'red'     the world shape the installed entry met: a plain DOUBLE
 *                  under `read` with NO placement attribution and NO feed;
 *                  the Guard installs with the MEASURED unscoped native list
 *                  (the web-profile fact: nothing governable on the global
 *                  face), publishes WITHOUT binding the name. Every `read`
 *                  call meets the verbatim
 *                  `…cannot be verified at dispatch time (no fallback to the native body)`
 *                  and the double's Body NEVER executes (its counter is the
 *                  witness for "no fallback").
 *
 *   role 'green'   the §6 wiring, in the design §4.1 order (a name keeps ONE
 *                  stable Binding family — so the governed placement binds
 *                  before publish, which is also the production assembly
 *                  order): PLACE the governed read (real node:fs read of the
 *                  world fixture — the admission/kernel effect face is NOT
 *                  this lane's claim, disclosed), record its identity via
 *                  `definitionIdentityOf`, install realm-paired with the
 *                  FEED + placement allowlist, `bindOwnTools` (verifies
 *                  against the provider record), publish. Every `read` call
 *                  runs the placed Body and the fixture bytes ride the wire
 *                  back to the model. Then the §6 semantics run LIVE:
 *                    step 'drift'   dispose + re-register a MUTATED Body →
 *                                   the next call meets the drift refusal,
 *                                   the mutated Body never runs (revocation).
 *                    step 'restore' put the ORIGINAL object back → the
 *                                   moved-back identity does NOT re-admit
 *                                   (withdrawal is permanent).
 *                    step 'rebind'  the explicit re-bind by this assembly —
 *                                   the only documented way back — runs.
 *                    step 'glue6'   a PLANE-shape def whose render returns a
 *                                   String (the #308 PLANE_PRESENTATION_FACE
 *                                   shape verbatim): the Body RUNS (the
 *                                   guard abstained — dispatcher layer green)
 *                                   and the result is recorded VERBATIM.
 *                                   The `content.some is not a function`
 *                                   host result-assembly crash belongs to
 *                                   GLUE-6 (parallel fix, cited not
 *                                   patched); whichever way this host
 *                                   answers, the row records what it says.
 *
 *   role 'realm'   the same placement, but the feed entry claims ANOTHER
 *                  realm: `bindOwnTools` REFUSES typed (Realm 不可混淆),
 *                  nothing publishes, no Body ever runs.
 *
 * Kit-provided environment:
 *   A5PBR2_DIST    <worktree>/packages/runtime/dist/packages
 *   A5PBR2_LEDGER  JSONL ledger path (append-only)
 *   A5PBR2_WORLD   absolute world root (repo/ under it = the read fixture)
 *   A5PBR2_TOKEN   the fixture token the target file carries
 *
 * @module evidence/alpha5/pb-binding-feed/a5pbr2-row
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const name = 'a5pbr2-binding-feed'
export const inject = ['webServer', 'agents']

const LEDGER = process.env['A5PBR2_LEDGER'] ?? ''
const DIST = process.env['A5PBR2_DIST'] ?? ''
const WORLD_ROOT = process.env['A5PBR2_WORLD'] ?? ''
const TOKEN = process.env['A5PBR2_TOKEN'] ?? 'A5PBR2-TOKEN'
const REALM = 'a5pbr2-realm'

const JOURNAL = []
function record(row) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...row })
  if (LEDGER !== '') {
    try {
      mkdirSync(dirname(LEDGER), { recursive: true })
      appendFileSync(LEDGER, line + '\n')
    } catch { /* the journal is the authoritative in-process copy */ }
  }
  JOURNAL.push(line)
}

const assemblies = new Map()
const byRole = new Map()
const slug = (v) => String(v ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
function safeLabel(read) {
  try { return String(read() ?? '(unknown-agent)') } catch (error) { return `(unreadable: ${String(error?.message ?? error).slice(0, 60)})` }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

const READ = 'read' // the SAME name the installed entry's member was refused on
const RENDER_PROBE = 'a5pbr2_render_probe'

export async function apply(ctx) {
  const webServer = ctx.webServer
  record({ leg: 'plugin-apply', pid: process.pid, dist: DIST })

  let td = null
  try {
    td = await import(new URL(`file://${join(DIST, 'runtime/tool-dispatch/index.js')}`).href)
    record({ leg: 'dist-imported', ok: true, feedFace: typeof td.installScopedToolGuard === 'function' && typeof td.definitionIdentityOf === 'function' })
  } catch (error) {
    record({ leg: 'dist-imported', ok: false, error: String(error?.message ?? error) })
  }

  if (webServer !== undefined && typeof webServer.register === 'function') {
    webServer.register({
      kind: 'exact', path: '/__a5pbr2/health',
      handler: (_req, res) => sendJson(res, 200, { ok: true, pid: process.pid, applied: td !== null, assemblies: [...assemblies.keys()], roles: [...byRole.keys()] }),
    }, 'a5pbr2 health')
    webServer.register({
      kind: 'exact', path: '/__a5pbr2/state',
      handler: (_req, res) => {
        const out = {}
        for (const [label, asm] of assemblies) out[label] = stateView(asm)
        sendJson(res, 200, { ok: true, assemblies: out })
      },
    }, 'a5pbr2 state')
    webServer.register({
      kind: 'exact', path: '/__a5pbr2/assemble',
      handler: async (req, res) => {
        let body = ''
        for await (const chunk of req) body += chunk
        let parsed
        try { parsed = JSON.parse(body || '{}') } catch { parsed = {} }
        const sessionId = String(parsed?.sessionId ?? '')
        const role = String(parsed?.role ?? '')
        const agent = getAgent(sessionId)
        if (agent === null || agent === undefined) { sendJson(res, 404, { ok: false, error: `no agent for session ${sessionId}` }); return }
        const label = slug(String(agent?.id ?? agent?.session?.header?.id ?? sessionId))
        if (assemblies.has(label)) { sendJson(res, 200, { ok: true, already: true, label }); return }
        const asm = {
          label, role, agent, inner: agent?.ctx,
          observations: [], stepFacts: [],
          doubleBodyCount: 0, placedBodyCount: 0, v2BodyCount: 0, renderProbeBodyCount: 0,
          placedDef: undefined, disposers: [],
          installOk: null, bindOwnOk: null, bindError: null, publishedOk: null,
          guardProbeRead: null, feedIdentity: null,
        }
        assemblies.set(label, asm)
        byRole.set(role, label)
        if (asm.inner === undefined || typeof asm.inner.tools?.register !== 'function' || typeof asm.inner.on !== 'function') {
          record({ leg: 'agent-ctx-unusable', label })
          sendJson(res, 500, { ok: false, error: 'agent ctx unusable' })
          return
        }
        try {
          const fact = runStep(asm, role === 'red' ? 'red-assemble' : role === 'green' ? 'green-assemble' : 'realm-assemble')
          asm.stepFacts.push({ step: `${role}-assemble`, fact })
          record({ leg: 'assemble', label, role, fact })
          sendJson(res, 200, { ok: true, label, role, fact })
        } catch (error) {
          record({ leg: 'assemble-error', label, role, error: String(error?.stack ?? error).slice(0, 800) })
          sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
        }
      },
    }, 'a5pbr2 assemble')
    webServer.register({
      kind: 'exact', path: '/__a5pbr2/step',
      handler: async (req, res) => {
        let body = ''
        for await (const chunk of req) body += chunk
        let parsed
        try { parsed = JSON.parse(body || '{}') } catch { parsed = {} }
        const role = String(parsed?.role ?? 'green')
        const step = String(parsed?.step ?? '')
        const label = byRole.get(role)
        const asm = label === undefined ? undefined : assemblies.get(label)
        if (asm === undefined) { sendJson(res, 404, { ok: false, error: `no ${role} assembly` }); return }
        try {
          const fact = runStep(asm, step)
          asm.stepFacts.push({ step, fact })
          record({ leg: 'step', label: asm.label, step, fact })
          sendJson(res, 200, { ok: true, step, fact })
        } catch (error) {
          record({ leg: 'step-error', label: asm.label, step, error: String(error?.stack ?? error).slice(0, 600) })
          sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
        }
      },
    }, 'a5pbr2 step')
  }

  function getAgent(sessionId) {
    try { return ctx.agents.inject?.(['agents'], () => ctx.agents.get?.(sessionId)) ?? ctx.agents.get?.(sessionId) ?? null } catch { return null }
  }

  function stateView(asm) {
    const census = {}
    for (const o of asm.observations) census[String(o?.event)] = (census[String(o?.event)] ?? 0) + 1
    return {
      role: asm.role,
      globalFaceNames: asm.globalFaceNames ?? null, // MEASURED unscoped tools.schemas() (bind-diag law)
      installOk: asm.installOk, bindOwnOk: asm.bindOwnOk, bindError: asm.bindError, publishedOk: asm.publishedOk,
      feedIdentity: asm.feedIdentity,
      guardProbeRead: asm.guardProbeRead,
      bodyCounts: { double: asm.doubleBodyCount, placed: asm.placedBodyCount, v2: asm.v2BodyCount, renderProbe: asm.renderProbeBodyCount },
      stepFacts: asm.stepFacts,
      eventCensus: census,
      observations: asm.observations.slice(-60),
    }
  }

  function installGuard(asm, extra) {
    const inner = asm.inner
    asm.globalFaceNames = (() => {
      try { return (inner.tools.schemas?.() ?? []).map((r) => String(r?.name)).filter((n) => typeof n === 'string' && n.length > 0) } catch { return [] }
    })()
    const trusted = [...new Set([safeLabel(() => asm.agent?.id), safeLabel(() => asm.agent?.session?.header?.id)]
      .filter((s) => !s.startsWith('(unreadable') && s !== '(unknown-agent)'))]
    return td.installScopedToolGuard({
      agentCtx: { tools: inner.tools, on: inner.on?.bind(inner) },
      runtimeAgent: asm.agent,
      agentScopeKey: safeLabel(() => asm.agent?.session?.header?.id ?? asm.agent?.id),
      trustedIdentities: trusted,
      // The bind-diag law, applied LIVE: nativeNames = the UNSCOPED global
      // face read (never the agent-scoped surface). The web profile answers
      // with nothing governable — the measurement is recorded, not assumed.
      nativeNames: asm.globalFaceNames,
      onObserve: (row) => { asm.observations.push(row) },
      ...extra,
    })
  }

  // ── the live acts (each step is one auditable act on the real surface) ──
  function runStep(asm, step) {
    const inner = asm.inner
    const fixture = join(WORLD_ROOT, 'repo', 'target.txt')
    const outDef = {
      schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } },
      render: (_args, value) => [{ type: 'text', text: String(value?.text ?? '') }], // the host LAW (ContentBlock[]), as W5 measured
    }
    if (step === 'red-assemble') {
      const doubleDef = {
        name: READ,
        description: 'A5PBR2 un-fed double standing in for a host-mounted read. args: {path}.',
        parameters: { type: 'object', properties: { path: { type: 'string' } } },
        output: outDef,
        execute: async () => { asm.doubleBodyCount += 1; return { text: 'A5PBR2-DOUBLE-BODY-RAN' } },
      }
      asm.disposers.push(inner.tools.register(doubleDef))
      const outcome = installGuard(asm, {})
      asm.installOk = outcome.ok === true
      if (!outcome.ok) return { installOk: false, error: String(outcome.error?.message).slice(0, 300) }
      asm.handle = outcome.value
      const published = asm.handle.publish()
      asm.publishedOk = published.ok === true
      // The dispatcher-layer RED fact (byte-checked by the runner):
      asm.guardProbeRead = asm.handle.dispatcher.guard({ name: READ, agentIdentity: safeLabel(() => asm.agent?.id) }) ?? null
      return { installOk: true, publishedOk: asm.publishedOk, nativeNames: asm.globalFaceNames, guardProbeRead: asm.guardProbeRead }
    }
    if (step === 'green-assemble') {
      // design §4.1 order: PLACE (own layer) → install (realm-paired, fed) →
      // bindOwnTools (feed-verified) → publish.
      const def = {
        name: READ,
        description: 'A5PBR2 governed placed read (§6 binding feed). args: {path}.',
        parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        output: outDef,
        execute: async (raw) => {
          asm.placedBodyCount += 1
          const text = readFileSync(String(raw?.path ?? fixture), 'utf8')
          return { text: `A5PBR2-READ-OK bytes=${String(text.length)} marker=${text.includes(TOKEN) ? 'TOKEN-SEEN' : 'NO-TOKEN'}\n${text.slice(0, 400)}` }
        },
      }
      asm.disposers.push(inner.tools.register(def))
      asm.placedDef = def
      const identity = td.definitionIdentityOf(def)
      asm.feedIdentity = identity
      const outcome = installGuard(asm, {
        realmId: REALM,
        // RENDER_PROBE is allowlisted too: the GLUE-6 bounding probe binds
        // EXACTLY as the production plane's defs bind today — placed name,
        // NO feed entry → the pre-feed placement-attribution path.
        assemblyOwnedNames: [READ, RENDER_PROBE],
        bindingFeed: (name) => (name === READ ? { definitionIdentity: identity, realmId: REALM } : undefined),
      })
      asm.installOk = outcome.ok === true
      if (!outcome.ok) return { installOk: false, error: String(outcome.error?.message).slice(0, 300) }
      asm.handle = outcome.value
      const bound = asm.handle.bindOwnTools([READ])
      asm.bindOwnOk = bound.ok === true
      if (!bound.ok) {
        asm.bindError = { code: bound.error.code, message: String(bound.error.message).slice(0, 400) }
        return { installOk: true, bindOwnOk: false, bindError: asm.bindError }
      }
      const published = asm.handle.publish()
      asm.publishedOk = published.ok === true
      const entry = asm.handle.dispatcher.surface.entryOf(READ)
      return {
        installOk: true, bindOwnOk: true, publishedOk: true, identity,
        verified: entry?.verified ?? null, origin: entry?.binding?.implementationOrigin ?? null,
        feedVerifiedObserved: asm.observations.some((o) => o.event === 'binding-feed-verified' && o.tool === READ),
      }
    }
    if (step === 'realm-assemble') {
      const def = {
        name: READ,
        description: 'A5PBR2 placement awaiting a CROSS-REALM feed entry (negative control). args: {path}.',
        parameters: { type: 'object', properties: { path: { type: 'string' } } },
        output: outDef,
        execute: async () => { asm.placedBodyCount += 1; return { text: 'A5PBR2-REALM-BODY-RAN' } },
      }
      asm.disposers.push(inner.tools.register(def))
      const identity = td.definitionIdentityOf(def)
      asm.feedIdentity = identity
      const outcome = installGuard(asm, {
        realmId: REALM,
        assemblyOwnedNames: [READ],
        // THE negative control: the SAME placement, the SAME identity, a
        // feed entry from ANOTHER realm.
        bindingFeed: (name) => (name === READ ? { definitionIdentity: identity, realmId: 'a5pbr2-OTHER-realm' } : undefined),
      })
      asm.installOk = outcome.ok === true
      if (!outcome.ok) return { installOk: false, error: String(outcome.error?.message).slice(0, 300) }
      asm.handle = outcome.value
      const bound = asm.handle.bindOwnTools([READ])
      asm.bindOwnOk = bound.ok === true
      asm.bindError = bound.ok === true ? null : { code: bound.error.code, message: String(bound.error.message).slice(0, 400) }
      const refusedObserved = asm.observations.some((o) => o.event === 'bind-refused-feed-realm-mismatch')
      return { installOk: true, bindOwnOk: asm.bindOwnOk, bindError: asm.bindError, refusedObserved, publishedOk: false }
    }
    if (step === 'drift') {
      for (const off of asm.disposers.splice(0)) { try { off() } catch { /* already off */ } }
      const v2 = {
        name: READ,
        description: 'A5PBR2 MUTATED read (drift leg). args: {path}.',
        parameters: { type: 'object', properties: { path: { type: 'string' } } },
        output: outDef,
        execute: async () => { asm.v2BodyCount += 1; return { text: 'A5PBR2-V2-BODY-RAN' } },
      }
      asm.disposers.push(inner.tools.register(v2))
      return { v2Registered: true }
    }
    if (step === 'restore') {
      for (const off of asm.disposers.splice(0)) { try { off() } catch { /* already off */ } }
      asm.disposers.push(inner.tools.register(asm.placedDef)) // the SAME object back
      return { restoredSameObject: asm.placedDef !== undefined }
    }
    if (step === 'rebind') {
      const bound = asm.handle.bindOwnTools([READ])
      asm.bindOwnOk = bound.ok === true
      return { rebindOk: bound.ok === true, verified: asm.handle.dispatcher.surface.entryOf(READ)?.verified ?? null }
    }
    if (step === 'glue6') {
      // The #308 PLANE-shape render face VERBATIM (render returns a String).
      // The claim here is the DISPATCHER layer: the guard must ABSTAIN and
      // the Body must RUN. What the host result assembly then does with the
      // String render is GLUE-6's parallel fix (install-entry S3 row cites
      // the same crash) — recorded verbatim, never patched by this row.
      const probeDef = {
        name: RENDER_PROBE,
        description: 'A5PBR2 GLUE-6 bounding probe. args: {}.',
        parameters: { type: 'object', properties: {} },
        output: { schema: outDef.schema, render: (_args, value) => String(value?.text ?? '') },
        execute: async () => { asm.renderProbeBodyCount += 1; return { text: 'A5PBR2-GLUE6-BODY-RAN' } },
      }
      inner.tools.register(probeDef)
      // Bind it the way the production plane binds its defs: placed name,
      // no feed entry → the pre-feed placement-attribution path. The probe
      // then DISPATCHES (guard abstains, Body runs); the String render face
      // meets the host's result assembly and the wire answers verbatim —
      // the crash (or non-crash) belongs to GLUE-6, this row only records.
      const bound = asm.handle.bindOwnTools([RENDER_PROBE])
      if (!bound.ok) return { probeBound: false, bindError: { code: bound.error.code, message: String(bound.error.message).slice(0, 400) } }
      // post-publish bind needs the surface entry too — publish is idempotent
      // only before ACTIVE; instead the probe rides the ACTIVE dispatcher
      // (bind on an ACTIVE dispatcher flips an immutable revision, same family).
      return { probeBound: true }
    }
    throw new Error(`unknown step ${step}`)
  }
}
