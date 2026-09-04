/**
 * plugin.mjs — P5-T6 (I-1) real-instance Cordis row: Member CREATE/RESUME
 * residency driven through DSH PUBLIC surfaces only.
 *
 * This row is mounted into the test instance's web profile patch layer
 * (`<DSH_HOME>/profiles/web/cordis.patch.yml` — the ONLY allowed seam;
 * see run.mjs + the evidence public-surfaces.md). It does not import any
 * DSH private/internal module: the static imports below are prebuilt
 * public packages (junction-farm resolved), and the dynamic imports are
 * the P5-T6/P5-T5/P4-T3/contracts/storage TS modules of THIS repository,
 * loaded through the worktree-relative TS resolution hook (the P5-T5
 * ts-loader.mjs, reused read-only from the root-binding harness,
 * registered before the first dynamic import).
 *
 * The row is the SOLE opener of the `team_domain` StorageDomain unit in
 * each process (the upstream facility rejects a second open of the same
 * name in-process — the P5-T5 root-binding row therefore mounts in its
 * own boots, never alongside this one; see run.mjs boot plan).
 *
 * Scenarios (driven by run.mjs over loopback HTTP, no real LLM calls):
 *
 *   M1 fresh member create — ensure the derived child session via
 *      agents.create (pre-specified SessionId), build the three REAL
 *      overlay slots (persona = member persona preset mounted through
 *      the agent-presets surface + the blueprint member persona text;
 *      model = real installModelSelection ref; capability = real
 *      tools/skills/mini-MCP/pre-step seams), createFreshMember ->
 *      durable MemberInstance + team-member binding, all three overlay
 *      slots installed (the ruling's "four-slot" reading: the three
 *      member overlay slots ON TOP of the inherited root substrate),
 *      admission decided open. Public verification: persona text,
 *      model read-back at the assembly boundary, tool + MCP visibility,
 *      agent-setup events, durable session publication, TeamDomain
 *      read-back, exact durable-write sequence.
 *   M5 ordinary invariance — an ordinary (unbound) agent sees no Team
 *      machinery: no binding row, no member record, no agent-setup
 *      events, no residency entry; and the negative probe
 *      subagents.followup(rootAgent, memberChildId, [...]) fails with
 *      SubagentError UNAUTHORIZED at the lineage check — BEFORE any
 *      turn submit (a Member is not a continuable subagent; the generic
 *      subagent path is otherwise untouched). No LLM call: the throw
 *      happens before submission and no model provider is ever
 *      contacted by this harness.
 *   I1A (armed via POST /__p5t6/i1a/run) — the CRASH-WINDOW run: the
 *      audited write proxy freezes the process AFTER the durable
 *      MemberInstance record put resolves and BEFORE the binding put.
 *      run.mjs polls GET /__p5t6/i1a/state until the window is open,
 *      then kills the real OS process (I1a crash). The convergent
 *      replay of the same spec is driven as scenario I1A on the NEXT
 *      boot: binding-only write, no duplicate member, consistent state.
 *   M2 cold member resume (boot after a process death) — agents.resume
 *      of the M1 child (app-faithful: model selection re-seeded from
 *      the durable `model/selection` projection, member persona preset
 *      mounted in setup), rehydrateColdMember -> durable present
 *      (wrote:false), member scope restored (no fresh installs),
 *      re-admitted, zero durable writes this boot.
 *   M3 evict settled — no durable lifecycle-transition mechanism exists
 *      in the P4/P5 scope (lifecycle transitions belong to a later
 *      coordination task), so the harness SEEDS the SETTLED record
 *      through the same row-owned repository seam the row's writes use
 *      (delete + put, logged as harness-setup ops, never product
 *      writes), then evictSettledMember: the live handle is dropped
 *      (residencyDropped:true), the durable records stay (lifecycle
 *      SETTLED, binding intact), zero product writes, zero surface
 *      events; a second evict with the handle already absent still
 *      succeeds (residencyDropped:false — "the handle may be absent").
 *   M4 re-admit (idempotency) — rehydrateColdMember TWICE on the
 *      evicted (SETTLED) member: both cold paths restore the scope and
 *      re-admit; exactly one durable member record, one binding row,
 *      one DSH child session; zero product writes.
 *   I1C restart idempotency (record loss) — run.mjs deletes the
 *      durable MemberInstance record under DSH_HOME before the boot;
 *      replaying createFreshMember with the same spec recreates the
 *      record (the binding already exists and is consistent —
 *      binding-only convergence is the mirror of the I1A replay),
 *      no duplicate Member/Session, no crash.
 *   I1B (boot 6, no scenario) — run.mjs corrupts the persisted
 *      `team_domain.json` unit version under DSH_HOME before the boot;
 *      this row's setup (openTeamDomain) must FAIL LOUDLY with
 *      SCHEMA_VERSION_MISMATCH (setup-failure.json carries the code)
 *      and the corrupted file must NOT be rewritten (no silent
 *      migration).
 *
 * Directive file `<DSH_HOME>/p5t6-directive.json` (written by run.mjs
 * before EVERY boot; the row re-reads it on each process start):
 *
 *   { boot: 3|4|5|6,
 *     reportDir: string,
 *     runStamp: string,
 *     memberPersonaPresetId: string,
 *     mcpPort: number,
 *     rootSessionId: string,             // the T5-row S1 root session
 *     ordinarySessionId: string,         // the M5 ordinary agent
 *     specs: { A: MemberCreateSpec, B: MemberCreateSpec },
 *     admissionPolicyByScenario: { M1: 'open', M2: 'open', M3: 'open',
 *                                  M4: 'open', M5: 'open', I1A: 'open',
 *                                  I1C: 'open' },
 *     blueprint: { blueprintId: string, revision: string, contentHash: string,
 *                  leaderPersona: string,
 *                  memberPersonas: { p5t6worker: string },
 *                  defaultModel: { provider: string, model: string },
 *                  defaultWorkspace?: string },
 *     capability: { toolsPermissions: {...}, skills: {...},
 *                   mcp: {...}, preStepPreExecute: {...} } }
 *
 * Public surfaces consumed (name + origin recorded in the evidence
 * public-surfaces.md; the harness proves they are enough):
 *
 *   agents.create / agents.resume / handle.dispose
 *     — @deepseek-ai/dsh-agent (public agent lifecycle)
 *   subagents.followup
 *     — @deepseek-ai/dsh-subagent (public continuable-subagent surface;
 *       the M5 negative probe — lineage authorization before submit)
 *   agentPresets.resolve / mount / composedPreset
 *     — @deepseek-ai/dsh-agent-presets (public preset seam)
 *   systemPrompt.assemble({ scope })
 *     — @deepseek-ai/dsh-system-prompt (public prompt assembly boundary)
 *   scopeOf(agentCtx)
 *     — @deepseek-ai/dsh-scope (public scope key)
 *   installModelSelection(agentCtx, ref)
 *     — @deepseek-ai/dsh-agent (public agent-scoped model selection)
 *   sessionProjections.stateOf(session, 'modelSelection')
 *     — @deepseek-ai/dsh-session-projections (public projection read;
 *       the durable model/selection restore, app-faithful)
 *   agent.ctx.tools.register / .schemas / agent.ctx.get('skills').register
 *     — public agent-scoped capability seams (P2-T4 pinned)
 *   agent.ctx.plugin(mcpClient, cfg)
 *     — @deepseek-ai/dsh-mcp-client (public MCP fiber seam)
 *   agent.ctx.on('tools/pre-execute' | 'agent/pre-step')
 *     — public agent-scoped waterfall listeners (P2-T4 pinned)
 *   agent.session.append / .events / sessions.get(SessionId) / sessions.list()
 *     — @deepseek-ai/dsh-session (public session surfaces)
 *   webServer.register({ kind: 'exact', path, handler })
 *     — @deepseek-ai/dsh-webserver (public host route seam)
 *   storageDomain.open / .closeAll
 *     — @deepseek-ai/dsh-storage-domain (public durable domain seam;
 *       routed to the DSH_HOME-resident json backend by the base bundle)
 *   <DSH_HOME>/storages/team_domain.json
 *     — the persisted TeamDomain unit (disk read/corruption by run.mjs
 *       for I1B/I1C; no API)
 *   <DSH_HOME>/sessions/<project>/<sessionId>/session.jsonl.zstd
 *     — public durable session artifact (disk read, no API)
 */

import { register } from 'node:module'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SessionId } from '@deepseek-ai/dsh-session'
import { scopeOf } from '@deepseek-ai/dsh-scope'
import { PERSONA_SECTION } from '@deepseek-ai/dsh-system-prompt'
import { installModelSelection } from '@deepseek-ai/dsh-agent'

// The TS resolution hook MUST be registered before the first dynamic TS
// import (it rewrites worktree-relative .js specifiers that have a .ts
// sibling). The static imports above are prebuilt packages only, so
// top-level registration is safe. The hook itself is the P5-T5 harness's
// (read-only reuse; its gate keys off the worktree packages/ dir computed
// from its own location, so importing it from this directory is safe).
register(new URL('../../root-binding/harness/ts-loader.mjs', import.meta.url), import.meta.url)

/**
 * The Loader only needs the named exports (the P2 boot-A evidence: a bare
 * early apply races late-registering rows). The remaining services
 * (systemPrompt, agentPresets, sessions, sessionProjections, subagents)
 * are resolved lazily at request time — by then the full host is up.
 */
export const name = 'p5t6-member-residency'

export const inject = ['agents', 'webServer', 'storageDomain']

const DIRECTIVE_NAME = 'p5t6-directive.json'
const SCENARIOS = ['M1', 'M2', 'M3', 'M4', 'M5', 'I1A', 'I1C']
const MEMBER_TEMPLATE = 'p5t6worker'
const MEMBER_SCOPE_SLOTS = ['persona', 'model', 'capability']

/**
 * Read the run directive (written by run.mjs before every boot).
 * @returns {object} the validated directive.
 */
function readDirective() {
  const home = process.env.DSH_HOME
  if (!home) throw new Error('p5t6: DSH_HOME is not set in the host process environment')
  const directive = JSON.parse(readFileSync(join(home, DIRECTIVE_NAME), 'utf8'))
  if (![3, 4, 5, 6].includes(directive.boot)) {
    throw new Error(`p5t6: directive.boot must be 3|4|5|6 (got ${JSON.stringify(directive.boot)})`)
  }
  if (typeof directive.reportDir !== 'string' || directive.reportDir.length === 0) {
    throw new Error('p5t6: directive.reportDir is required')
  }
  if (typeof directive.memberPersonaPresetId !== 'string' || directive.memberPersonaPresetId.length === 0) {
    throw new Error('p5t6: directive.memberPersonaPresetId is required')
  }
  if (!Number.isInteger(directive.mcpPort) || directive.mcpPort < 1 || directive.mcpPort > 65535) {
    throw new Error(`p5t6: directive.mcpPort must be a port number (got ${JSON.stringify(directive.mcpPort)})`)
  }
  if (typeof directive.rootSessionId !== 'string' || directive.rootSessionId.length === 0) {
    throw new Error('p5t6: directive.rootSessionId is required (the T5-row S1 root session)')
  }
  if (typeof directive.ordinarySessionId !== 'string' || directive.ordinarySessionId.length === 0) {
    throw new Error('p5t6: directive.ordinarySessionId is required (the M5 ordinary agent)')
  }
  for (const key of ['A', 'B']) {
    const spec = directive.specs?.[key]
    if (spec === undefined || spec === null) throw new Error(`p5t6: directive.specs.${key} is required`)
    for (const field of ['rootSessionId', 'templateId', 'label']) {
      if (typeof spec[field] !== 'string' || spec[field].length === 0) {
        throw new Error(`p5t6: directive.specs.${key}.${field} is required`)
      }
    }
    if (spec.templateId !== MEMBER_TEMPLATE) {
      throw new Error(`p5t6: directive.specs.${key}.templateId must be '${MEMBER_TEMPLATE}' (got ${JSON.stringify(spec.templateId)})`)
    }
  }
  if (directive.specs.A.rootSessionId !== directive.rootSessionId || directive.specs.B.rootSessionId !== directive.rootSessionId) {
    throw new Error('p5t6: both member specs must target directive.rootSessionId')
  }
  const memberPersona = directive.blueprint?.memberPersonas?.[MEMBER_TEMPLATE]
  if (typeof memberPersona !== 'string' || memberPersona.length === 0) {
    throw new Error(`p5t6: directive.blueprint.memberPersonas.${MEMBER_TEMPLATE} is required`)
  }
  if (directive.blueprint?.defaultModel?.provider === undefined || directive.blueprint?.defaultModel?.model === undefined) {
    throw new Error('p5t6: directive.blueprint.defaultModel {provider, model} is required')
  }
  if (directive.capability === undefined || directive.capability === null) {
    throw new Error('p5t6: directive.capability is required')
  }
  return directive
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(text)
}

/** @param {import('node:http').IncomingMessage} req @returns {Promise<string>} */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** @param {unknown} a @param {unknown} b @returns {boolean} */
function deepEq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** @param {object} ctx @param {object} agent @returns {string[]} */
function names(ctx, agent) {
  return ctx.tools.schemas(agent).map((s) => s.name)
}

/**
 * The on-disk state of one session's durable log (the P2-T3 pinned
 * artifact layout). @param {string} sessionId @returns {object}
 */
function diskFilesFor(sessionId) {
  const home = process.env.DSH_HOME
  if (!home) return { error: 'no DSH_HOME' }
  try {
    const sessionsRoot = join(home, 'sessions')
    for (const pd of readdirSync(sessionsRoot, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const dir = join(sessionsRoot, pd.name, sessionId)
      let entries
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        continue
      }
      return {
        projectDir: pd.name,
        files: entries.filter((e) => e.isFile()).map((e) => ({
          name: e.name,
          size: statSync(join(dir, e.name)).size,
          final: e.name === 'session.jsonl.zstd',
        })),
      }
    }
    return { found: false, sessionsRoot }
  } catch (error) {
    return { error: String(error?.message ?? error) }
  }
}

/**
 * Poll for the FINAL durable session artifact (write-behind publication;
 * an awaited flush is not a barrier — P2-T3 pinned limitation).
 * @param {string} sessionId
 * @param {number} timeoutMs
 * @returns {Promise<object>} the publication state.
 */
async function waitForDurable(sessionId, timeoutMs) {
  const startedAt = Date.now()
  for (;;) {
    const disk = diskFilesFor(sessionId)
    if (disk.files !== undefined) {
      const pub = disk.files.find((f) => f.final)
      if (pub !== undefined) {
        return { published: true, projectDir: disk.projectDir, size: pub.size }
      }
    }
    if (Date.now() - startedAt >= timeoutMs) return { published: false, disk }
    await new Promise((r) => { setTimeout(r, 250) })
  }
}

/**
 * Poll until a tool name is visible in the live schema list (the MCP
 * fiber activates after the boot marker).
 * @param {object} handle
 * @param {string} toolName
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
async function waitForSchemaTool(handle, toolName, timeoutMs) {
  const startedAt = Date.now()
  for (;;) {
    const visible = names(handle.agent.ctx, handle.agent).includes(toolName)
    if (visible) return true
    if (Date.now() - startedAt >= timeoutMs) return false
    await new Promise((r) => { setTimeout(r, 250) })
  }
}

// ── module state (one row instance per process = per boot) ────────────────

/** @type {object} the validated directive of this boot. */
let directive
/** @type {Promise<void>} resolves when row setup finished (success or failure). */
let readyGate
/** @type {((() => void) | undefined)} */
let resolveReady
/** @type {string|null} setup failure message (visible through /__p5t6/health). */
let setupError = null
/** @type {string|null} setup failure code (e.g. SCHEMA_VERSION_MISMATCH). */
let setupErrorCode = null
/** @type {object|null} the open TeamDomain facade (every boot reopens; the create path is only the absent-unit fallback). */
let domain
/** @type {object|null} the storage-domain TeamDomain read handle (binder P5-T1). */
let readHandle
/** @type {object|null} the product write port over the row-owned repositories. */
let baseWritePort
/** @type {object|null} the audited write proxy (module scope: makePorts + the module-level scenario handlers read it). */
let writes
/** @type {Array<object>} every durable write of this boot (audit trail; harness-setup ops are flagged). */
const writeLog = []
/** @type {Map<string, {installed: string[], restored?: object, restoreEffect?: string}>} live residency bookkeeping (surface side). */
const surfaceResidency = new Map()
/** @type {Map<string, object>} live agent handles bound to a child session. */
const residencyAgents = new Map()
/** @type {Array<object>} the binder's agent-setup event records (this boot). */
const eventLog = []
/** @type {Array<Promise<void>>} pending preset mounts fired by the real effects. */
const pendingMounts = []
/** @type {Array<object>} mount failures (never thrown into the bind). */
const mountErrors = []
/** @type {Array<object>} admission guard inputs (policy + live facts). */
const guardFacts = []
/** @type {number} restoreScope call count (cold-path detector). */
let restoreScopeCallCount = 0
/**
 * The I1A kill-gate state: the audited write proxy freezes the process
 * after the durable record put of the armed member and before the
 * binding put; run.mjs polls /__p5t6/i1a/state and kills the process in
 * that window.
 * @type {{armed: boolean, instanceId: string|null, childSessionId: string|null, recordWritten: boolean, bindingWritten: boolean, hold: Promise<never>|null}}
 */
const i1aGate = { armed: false, instanceId: null, childSessionId: null, recordWritten: false, bindingWritten: false, hold: null }
/** @type {object} the TS module handles (dynamic imports, hook-resolved). */
let modules
/** @type {object|null} the Cordis ctx of this boot (route handlers + gated runs). */
let ctxRef

/**
 * The row entry point (fire-and-forget async setup, the P2-proven form):
 * the Loader only needs the named exports; the HTTP handlers gate on
 * `readyGate`, so no scenario request can race the TeamDomain open.
 * @param {object} ctx - the Cordis plugin context.
 */
export function apply(ctx) {
  let resolveReadyLocal
  readyGate = new Promise((r) => { resolveReadyLocal = r })
  resolveReady = resolveReadyLocal
  run(ctx).catch((error) => {
    setupError = error instanceof Error ? error.message : String(error)
    setupErrorCode = error?.code ?? null
    try {
      const home = process.env.DSH_HOME
      const reportDir = directive?.reportDir ?? (home !== undefined ? join(home, 'p5t6-run') : '.')
      writeFileSync(
        join(reportDir, 'setup-failure.json'),
        JSON.stringify({ error: setupError, code: setupErrorCode, stack: error?.stack ?? null }, null, 2),
      )
    } catch {
      /* the boot log still carries the failure */
    }
    resolveReadyLocal()
  })
}

/**
 * The async row setup: read the directive, open the TeamDomain through
 * the REAL storageDomain seam (every boot reopens the persisted unit —
 * the T5 row's boot 1 created it in this shared DSH_HOME; the create
 * path is only the fallback for a genuinely absent unit), wire the
 * audited write port (with the I1A kill-gate) and register the host
 * routes.
 * @param {object} ctx
 * @returns {Promise<void>}
 */
async function run(ctx) {
  ctxRef = ctx
  directive = readDirective()
  mkdirSync(directive.reportDir, { recursive: true })

  const webServer = ctx.get('webServer')
  const storageDomain = ctx.get('storageDomain')
  if (webServer === undefined || storageDomain === undefined) {
    throw new Error('p5t6: webServer/storageDomain services missing despite inject')
  }

  // Dynamic imports: the TS resolution hook (registered at module top)
  // rewrites the worktree-relative .js specifiers to their .ts sources.
  const seamMod = await import('../../root-binding/harness/seam.mjs')
  const reposMod = await import('../../../storage/repositories/index.js')
  const binderMod = await import('../../agent-setup/binder/index.js')
  const memberMod = await import('../index.js')
  const slotsMod = await import('./slots-t6.mjs')
  modules = { memberMod, slotsMod }

  const realSeam = seamMod.createRealStorageDomainSeam(storageDomain)
  // The T5 row's boot 1 already created the team_domain unit in this
  // shared DSH_HOME (same storage backend), so every T6 boot reopens it.
  // Fallback: when the unit is genuinely absent, the storage seam treats
  // the missing file as an empty unit and openTeamDomain diagnoses that
  // as SCHEMA_STAMP_MISSING — take the create path then. A partially
  // stamped unit (crash mid-create) is NOT silently migrated:
  // createTeamDomain fails loudly with TEAM_DOMAIN_EXISTS.
  try {
    domain = await reposMod.openTeamDomain(realSeam)
  } catch (error) {
    if (error?.code === 'SCHEMA_STAMP_MISSING') {
      domain = await reposMod.createTeamDomain(realSeam)
    } else {
      throw error
    }
  }
  ctx.effect(() => () => {
    void domain.close().catch(() => {})
  }, 'p5t6 team-domain close')
  readHandle = binderMod.createTeamDomainReadHandle(domain.repositories)

  baseWritePort = memberMod.createMemberDomainWritePort(domain.repositories)

  // The audited write proxy: records every durable write, and freezes the
  // process in the I1A crash window (after the armed member's record put
  // resolves — durable — before the binding put starts).
  writes = {
    putMemberInstance(input) {
      return Promise.resolve(baseWritePort.putMemberInstance(input)).then((record) => {
        writeLog.push({
          op: 'putMemberInstance',
          rootSessionId: String(input.rootSessionId),
          instanceId: String(input.instanceId),
          childSessionId: String(input.childSessionId),
        })
        if (i1aGate.armed === true && String(input.instanceId) === i1aGate.instanceId) {
          i1aGate.recordWritten = true
          // The crash window: the record is durable, the binding is not
          // yet. Freeze until run.mjs kills the real process.
          return i1aGate.hold
        }
        return record
      })
    },
    putSessionBinding(binding) {
      return Promise.resolve(baseWritePort.putSessionBinding(binding)).then((record) => {
        writeLog.push({
          op: 'putSessionBinding',
          sessionId: String(record.sessionId),
          kind: record.kind,
        })
        if (i1aGate.armed === true && String(record.sessionId) === i1aGate.childSessionId) {
          i1aGate.bindingWritten = true
        }
        return record
      })
    },
  }

  // ── routes ─────────────────────────────────────────────────────────────
  webServer.register({
    kind: 'exact',
    path: '/__p5t6/health',
    handler: (req, res) => {
      sendJson(res, 200, { ok: setupError === null, boot: directive.boot, setupError, setupErrorCode })
    },
  }, 'p5t6 health route')

  webServer.register({
    kind: 'exact',
    path: '/__p5t6/i1a/state',
    handler: (req, res) => {
      void readyGate
      const specB = directive.specs.B
      const idB = modules.memberMod.deriveMemberIdentity(specB)
      sendJson(res, 200, {
        armed: i1aGate.armed,
        recordWritten: i1aGate.recordWritten,
        bindingWritten: i1aGate.bindingWritten,
        recordPresent: readHandle !== null && readHandle.getMemberInstance(directive.rootSessionId, idB.instanceId) !== undefined,
        bindingPresent: readHandle !== null && readHandle.getSessionBinding(idB.childSessionId)?.kind === 'team-member',
      })
    },
  }, 'p5t6 i1a state route')

  webServer.register({
    kind: 'exact',
    path: '/__p5t6/i1a/run',
    handler: (req, res) => {
      void readyGate
      if (setupError !== null) {
        sendJson(res, 503, { error: 'row setup failed', setupError, setupErrorCode })
        return
      }
      if (i1aGate.armed) {
        sendJson(res, 409, { error: 'I1A gate already armed' })
        return
      }
      const specB = directive.specs.B
      const idB = modules.memberMod.deriveMemberIdentity(specB)
      i1aGate.armed = true
      i1aGate.instanceId = idB.instanceId
      i1aGate.childSessionId = idB.childSessionId
      i1aGate.hold = new Promise(() => {})
      sendJson(res, 202, { armed: true, instanceId: idB.instanceId, childSessionId: idB.childSessionId })
      // The gated create runs in the background: it hangs inside the
      // audited putMemberInstance after the record is durable. run.mjs
      // polls /i1a/state and kills the process in the window — the HTTP
      // response of the create is never sent by design.
      void runI1aGatedCreate().catch((error) => {
        // Unreachable before the kill (the hold never resolves); recorded
        // for the post-mortem if a future change breaks that.
        try {
          writeFileSync(join(directive.reportDir, 'i1a-gated-create-error.json'), JSON.stringify({
            error: { name: error?.name ?? 'Error', message: String(error?.message ?? error), stack: error?.stack ?? null },
          }, null, 2))
        } catch {
          /* best effort */
        }
      })
    },
  }, 'p5t6 i1a run route')

  webServer.register({
    kind: 'exact',
    path: '/__p5t6/run',
    handler: async (req, res) => {
      const raw = await readBody(req)
      let scenario = null
      try {
        scenario = JSON.parse(raw)?.scenario
      } catch {
        scenario = null
      }
      if (!SCENARIOS.includes(scenario)) {
        sendJson(res, 400, { error: `unknown scenario '${String(scenario)}' (expected one of ${SCENARIOS.join(',')})` })
        return
      }
      try {
        await readyGate
        if (setupError !== null) {
          sendJson(res, 503, { scenario, error: 'row setup failed', setupError, setupErrorCode })
          return
        }
        const report = scenario === 'M1' ? await runFreshMember(ctx)
          : scenario === 'M2' ? await runColdMember(ctx)
            : scenario === 'M3' ? await runEvictSettled(ctx)
              : scenario === 'M4' ? await runReAdmit(ctx)
                : scenario === 'M5' ? await runOrdinaryInvariance(ctx)
                  : scenario === 'I1A' ? await runCrashReplay(ctx)
                    : await runRecordLossReplay(ctx)
        writeFileSync(join(directive.reportDir, `${scenario}.json`), JSON.stringify(report, null, 2))
        writeFileSync(
          join(directive.reportDir, `done-${scenario}.json`),
          JSON.stringify({ scenario, pass: report.pass, assertions: report.assertions }, null, 2),
        )
        sendJson(res, 200, report)
      } catch (error) {
        const failure = {
          scenario,
          error: { name: error?.name ?? 'Error', message: String(error?.message ?? error), stack: error?.stack ?? null },
        }
        try {
          writeFileSync(join(directive.reportDir, `${scenario}.error.json`), JSON.stringify(failure, null, 2))
        } catch {
          /* the response carries the failure */
        }
        sendJson(res, 500, failure)
      }
    },
  }, 'p5t6 run route')

  await resolveReady()
}

/**
 * Resolve the request-time services (the host is fully up by the time a
 * scenario request arrives; fail loud if one is missing).
 * @param {object} ctx
 * @returns {object}
 */
function resolveServices(ctx) {
  const agents = ctx.get('agents')
  const systemPrompt = ctx.get('systemPrompt')
  const agentPresets = ctx.get('agentPresets')
  const sessions = ctx.get('sessions')
  const sessionProjections = ctx.get('sessionProjections')
  if (agents === undefined || systemPrompt === undefined || agentPresets === undefined || sessions === undefined) {
    throw new Error('p5t6: request-time services missing (agents/systemPrompt/agentPresets/sessions)')
  }
  return { agents, systemPrompt, agentPresets, sessions, sessionProjections }
}

/**
 * The agent-setup surface for this boot: records installs/restores into
 * the residency bookkeeping and fires the REAL preset-mount effect on
 * scope restore (the app-faithful cold path — the member persona preset
 * is (re)mounted when the composed preset is not the member preset yet).
 * @param {object} ctx
 * @returns {object} the TeamAgentSetupSurface implementation.
 */
function createSurface(ctx) {
  return {
    getInstalledSlots(sessionId) {
      return surfaceResidency.get(sessionId)?.installed ?? []
    },
    installOverlay(sessionId, slot) {
      const entry = surfaceResidency.get(sessionId) ?? { installed: [] }
      if (!entry.installed.includes(slot)) entry.installed.push(slot)
      surfaceResidency.set(sessionId, entry)
    },
    restoreScope(sessionId, scope) {
      restoreScopeCallCount += 1
      const entry = surfaceResidency.get(sessionId) ?? { installed: [] }
      entry.restored = {
        kind: scope.kind,
        rootSessionId: scope.rootSessionId ?? null,
        instanceId: scope.instanceId ?? null,
        slots: [...scope.slots],
      }
      const binding = residencyAgents.get(sessionId)
      const agentPresets = ctx.get('agentPresets')
      if (binding !== undefined && agentPresets !== undefined) {
        const composed = agentPresets.composedPreset(binding.agent.ctx)
        if (composed !== directive.memberPersonaPresetId) {
          entry.restoreEffect = 'mounted'
          pendingMounts.push(
            Promise.resolve(agentPresets.mount(binding.agent.ctx, directive.memberPersonaPresetId))
              .catch((error) => {
                mountErrors.push({ sessionId, message: String(error?.message ?? error) })
                throw error
              }),
          )
        } else {
          entry.restoreEffect = 'already-composed'
        }
      } else {
        entry.restoreEffect = 'no-residency-agent'
      }
      surfaceResidency.set(sessionId, entry)
    },
    recordSessionEvent(sessionId, event) {
      eventLog.push({
        sessionId,
        name: event.name,
        ...(event.detail !== undefined ? { detail: event.detail } : {}),
      })
    },
  }
}

/**
 * The ephemeral residency port (evict path only): the live agent handle
 * map. dropResidency disposes the real handle (the public lifecycle).
 * @returns {object} the ResidencyPort implementation.
 */
function createResidencyPort() {
  return {
    hasResidency(sessionId) {
      return residencyAgents.has(sessionId)
    },
    dropResidency(sessionId) {
      const handle = residencyAgents.get(sessionId)
      if (handle === undefined) return false
      residencyAgents.delete(sessionId)
      void handle.dispose().catch(() => {})
      return true
    },
  }
}

/**
 * Build the product ports for one scenario: the shared audited writes +
 * the boot's surface/residency, plus per-scenario slots/admissionGuard.
 * @param {object} ctx
 * @param {object} [opts]
 * @param {object} [opts.slots] the real overlay slots (fresh paths only).
 * @param {string} [opts.scenario] the scenario key for the admission policy.
 * @returns {object}
 */
function makePorts(ctx, opts = {}) {
  return {
    teamDomain: readHandle,
    writes,
    surface: createSurface(ctx),
    residency: createResidencyPort(),
    sessionDurability: makeSessionDurability(ctx),
    ...(opts.slots !== undefined ? { slots: opts.slots } : {}),
    ...(opts.scenario !== undefined ? { admissionGuard: makeGuard(opts.scenario) } : {}),
  }
}

/**
 * The REAL SessionDurabilityPort: the upstream public
 * `sessions.flush(liveSession)` seam (the same call the ACP row makes at
 * session creation — the attached log writer's flush materializes the
 * header-only artifact for an empty session; R122: rc.1 removed
 * `sessionPersistence.ensureMaterialized` in favor of it). Fail-closed:
 * a missing service or a missing live child agent throws before any
 * durable TeamDomain write.
 * @param {object} ctx
 * @returns {object} a SessionDurabilityPort implementation.
 */
function makeSessionDurability(ctx) {
  return {
    async ensureDurable(childSessionId) {
      const sessions = ctx.get('sessions')
      if (sessions === undefined) {
        throw new Error('p5t6: sessions service missing — the durability barrier seam is unavailable')
      }
      const svc = resolveServices(ctx)
      const agent = svc.agents.get(SessionId(childSessionId))
      if (agent === undefined) {
        throw new Error(`p5t6: child session '${childSessionId}' has no live agent handle — the barrier cannot materialize it`)
      }
      await sessions.flush(agent.session)
    },
  }
}

/**
 * The admission guard of one scenario (the directive policy; the binder
 * records the decision — T5's real-guard pattern).
 * @param {string} scenarioId
 * @returns {object}
 */
function makeGuard(scenarioId) {
  const policy = directive.admissionPolicyByScenario?.[scenarioId]
  return {
    decide(context) {
      guardFacts.push({
        scenario: scenarioId,
        policy: policy ?? null,
        path: context.path,
      })
      if (policy === 'open') return { status: 'admitted' }
      if (policy === 'closed') {
        return { status: 'rejected', code: 'ADMISSION_TEAM_POLICY_CLOSED', detail: `path:${context.path}` }
      }
      return { status: 'rejected', code: 'ADMISSION_POLICY_UNKNOWN', detail: String(policy) }
    },
  }
}

/** @param {string} sessionId @returns {Array<object>} */
function eventsFor(sessionId) {
  return eventLog.filter((e) => e.sessionId === sessionId)
}

/**
 * Create the child session fresh (pre-specified SessionId — the DERIVED
 * durable identity; agents.create is the public agent-lifecycle seam).
 * Fails loud when the session already exists durably (fresh scenarios
 * must start from a clean child).
 * @param {object} svc
 * @param {string} childSessionId
 * @returns {Promise<object>}
 */
async function ensureFreshChild(svc, childSessionId) {
  const disk = diskFilesFor(childSessionId)
  const durable = disk.files !== undefined && disk.files.some((f) => f.final)
  if (durable) {
    throw new Error(`p5t6: child session '${childSessionId}' already durable — a fresh-create scenario requires a clean child`)
  }
  const handle = await svc.agents.create({
    sessionId: SessionId(childSessionId),
    meta: { cwd: process.env.DSH_HOME },
  })
  residencyAgents.set(childSessionId, handle)
  return handle
}

/**
 * Resume the durable child session with the app-faithful cold setup
 * (T5 S2 pattern): the model selection ref is re-seeded from the durable
 * `model/selection` projection when present, the member persona preset
 * is mounted in setup. Fails loud when the session is not durable.
 * @param {object} svc
 * @param {string} childSessionId
 * @returns {Promise<{handle: object, modelRef: object, composePath: string}>}
 */
async function resumeChildWithSetup(svc, childSessionId) {
  const disk = diskFilesFor(childSessionId)
  const durable = disk.files !== undefined && disk.files.some((f) => f.final)
  if (!durable) {
    throw new Error(`p5t6: child session '${childSessionId}' is not durable — a cold-resume scenario requires the persisted child`)
  }
  const disposers = []
  const modelRef = { current: undefined, assembled: undefined }
  const handle = await svc.agents.resume({
    resumeSessionId: SessionId(childSessionId),
    setup: async (agentCtx) => {
      disposers.push(installModelSelection(agentCtx, modelRef))
      const resolved = await svc.agentPresets.resolve(directive.memberPersonaPresetId)
      await svc.agentPresets.mount(agentCtx, resolved.id)
    },
  })
  residencyAgents.set(childSessionId, handle)
  let composePath = 'directive'
  if (svc.sessionProjections !== undefined) {
    try {
      const projectionModel = svc.sessionProjections.stateOf(handle.agent.session, 'modelSelection')
      const pending = projectionModel?.pending
      if (pending !== null && pending !== undefined) {
        modelRef.current = {
          provider: pending.provider,
          model: pending.model,
          ...(pending.reasoningEffort !== undefined ? { reasoningEffort: pending.reasoningEffort } : {}),
        }
        composePath = 'sessionProjections'
      }
    } catch {
      composePath = 'directive'
    }
  }
  return { handle, modelRef, composePath }
}

/**
 * Build the three REAL overlay slots for one live member handle (the
 * T6-owned slots-t6.mjs fork of the P5-T5 slots module — see its header
 * for provenance; the persona source resolves the member text from the
 * directive blueprint through getMemberPersona, the model slot over
 * installModelSelection, the capability slot over the real
 * tools/skills/MCP/listener seams).
 * @param {object} svc
 * @param {object} handle
 * @param {string} stamp
 * @returns {Promise<object>}
 */
async function buildSlotsFor(svc, handle, stamp) {
  return modules.slotsMod.buildRealSlots({
    agents: svc.agents,
    agentPresets: svc.agentPresets,
    systemPrompt: svc.systemPrompt,
    directive,
    handle,
    presetId: directive.memberPersonaPresetId,
    mcpPort: directive.mcpPort,
    stamp,
  })
}

/** Await the pending preset-mount effects; collect failures. @param {Promise[]} effects @returns {Promise<string[]>} */
async function settleMounts(effects) {
  const results = await Promise.allSettled(effects)
  return results
    .filter((r) => r.status === 'rejected')
    .map((r) => String(r.reason?.message ?? r.reason))
}

/** @param {object} svc @param {object} handle @returns {Promise<object>} the assembly + persona section. */
async function assemblePersona(svc, handle) {
  const scope = scopeOf(handle.agent.ctx)
  const assembly = await svc.systemPrompt.assemble({ scope })
  const personaSection = assembly.sections.find((s) => s.name === PERSONA_SECTION)
  return { scope, assembly, personaSection }
}

/**
 * M1 — the FRESH member create of spec A (derived durable identity, all
 * three overlay slots installed, admission open, public verification).
 * @param {object} ctx
 * @returns {Promise<object>} the scenario report.
 */
async function runFreshMember(ctx) {
  const svc = resolveServices(ctx)
  const spec = directive.specs.A
  const identity = modules.memberMod.deriveMemberIdentity(spec)
  const root = directive.rootSessionId
  const writeCountBefore = writeLog.length
  const handle = await ensureFreshChild(svc, identity.childSessionId)
  let built
  try {
    built = await buildSlotsFor(svc, handle, `M1-${directive.runStamp ?? process.pid}`)

    const ports = makePorts(ctx, { slots: built.slots, scenario: 'M1' })
    const result = await modules.memberMod.createFreshMember(ports, spec)

    // M1 must-assert (P5-T6 defect fix): at the moment createFreshMember
    // RESOLVED, the child's final artifact is already durable on disk --
    // the sessionDurability barrier (before the first durable write) is a
    // complete barrier: it flushed the pending write-behind batches and
    // materialized the (header-only) artifact. Synchronous check, NO
    // polling: polling would mask the very publication race the barrier
    // closes (DevPlan 18.5: MemberInstance durable / Session durable).
    const artifactAtResolve = diskFilesFor(identity.childSessionId)
    const artifactAtResolveFinal =
      artifactAtResolve.files !== undefined
        ? artifactAtResolve.files.find((f) => f.final)
        : undefined
    if (artifactAtResolveFinal === undefined) {
      throw new Error(
        `p5t6 M1 must-assert: child artifact not durable at createFreshMember resolution (disk: ${JSON.stringify(artifactAtResolve)}); the sessionDurability barrier failed to close the write-behind window`,
      )
    }

    const mountFailures = await settleMounts(built.pendingEffects)

    // Control-plane step: the model selection (app-faithful — the app
    // selects the blueprint model after the member is set up).
    built.modelSource.select(directive.blueprint.defaultModel)

    // ── public verification ────────────────────────────────────────────
    const { assembly, personaSection } = await assemblePersona(svc, handle, identity.childSessionId)
    const expectedModel = directive.blueprint.defaultModel
    const expectedPersona = directive.blueprint.memberPersonas[MEMBER_TEMPLATE]
    const toolNames = names(handle.agent.ctx, handle.agent)
    const mcpToolName = `mcp__${directive.capability.mcp.available[0]}__ping`
    const mcpVisible = await waitForSchemaTool(handle, mcpToolName, 20_000)
    const durable = await waitForDurable(identity.childSessionId, 30_000)
    const member = readHandle.getMemberInstance(root, identity.instanceId)
    const binding = readHandle.getSessionBinding(identity.childSessionId)
    const installedSlots = surfaceResidency.get(identity.childSessionId)?.installed ?? []
    const setupEvents = eventsFor(identity.childSessionId)
    const sessionEvents = handle.agent.session.events.map((ev) => ({ seq: ev.seq, type: ev.type }))
    const sessionExists = svc.sessions.get(SessionId(identity.childSessionId)) !== undefined
    const scenarioWrites = writeLog.slice(writeCountBefore)

    const assertions = [
      {
        name: 'identity: durable record carries the DERIVED identity (invariant 18/23)',
        pass: member !== undefined && String(member.instanceId) === identity.instanceId
          && String(member.childSessionId) === identity.childSessionId
          && String(member.rootSessionId) === root,
        actual: member === undefined ? null : { instanceId: String(member.instanceId), childSessionId: String(member.childSessionId), rootSessionId: String(member.rootSessionId) },
        expected: identity,
      },
      {
        name: 'durable: team-member binding row written (child -> root, instance)',
        pass: binding?.kind === 'team-member' && String(binding.sessionId) === identity.childSessionId
          && String(binding.rootSessionId) === root && String(binding.instanceId) === identity.instanceId,
        actual: binding ?? null,
      },
      {
        name: 'bind: fresh-member path, installed=true, admitted (open policy)',
        pass: result.path === 'fresh-member' && result.durable.wrote === true
          && result.bind.bound === true && result.bind.installed === true && result.bind.admitted === true,
        actual: { path: result.path, wrote: result.durable.wrote, bound: result.bind.bound, installed: result.bind.installed, admitted: result.bind.admitted },
      },
      {
        name: 'slots: all three overlay slots installed (persona/model/capability)',
        pass: deepEq(installedSlots, MEMBER_SCOPE_SLOTS),
        actual: installedSlots,
        expected: MEMBER_SCOPE_SLOTS,
      },
      {
        name: 'bind: agent-setup events (3 overlay-installed + 1 admission-decided)',
        pass: setupEvents.filter((e) => e.name === 'agent-setup/overlay-installed').length === 3
          && setupEvents.filter((e) => e.name === 'agent-setup/admission-decided').length === 1,
        actual: setupEvents,
      },
      {
        name: 'persona: assembled persona text is the blueprint MEMBER persona',
        pass: personaSection !== undefined && personaSection.text === expectedPersona,
        actual: personaSection?.text ?? null,
        expected: expectedPersona,
      },
      {
        name: 'model: assembly variables carry the selected provider/model',
        pass: assembly.variables?.provider === expectedModel.provider && assembly.variables?.model === expectedModel.model,
        actual: { provider: assembly.variables?.provider ?? null, model: assembly.variables?.model ?? null },
        expected: expectedModel,
      },
      {
        name: 'capability: tools + skills registered and the mini-MCP tool visible',
        pass: built.obs.toolsRegistered.includes('p5t6-tool-alpha') && built.obs.toolsRegistered.includes('p5t6-tool-beta')
          && built.obs.skillsRegistered.includes('p5t6-skill-one') && mcpVisible === true,
        actual: { toolsRegistered: built.obs.toolsRegistered, skillsRegistered: built.obs.skillsRegistered, mcpVisible, toolNames },
      },
      {
        name: 'session: final artifact durable SYNCHRONOUSLY at resolution (M1 must-assert; no polling)',
        pass: artifactAtResolveFinal !== undefined,
        actual: { projectDir: artifactAtResolve.projectDir ?? null, size: artifactAtResolveFinal?.size ?? null },
      },
      {
        name: 'session: live + durable artifact published, model/selection appended',
        pass: sessionExists === true && durable.published === true && sessionEvents.some((e) => e.type === 'model/selection'),
        actual: { sessionExists, durable, sessionEvents },
      },
      {
        name: 'writes: exactly [putMemberInstance, putSessionBinding] in that order',
        pass: scenarioWrites.length === 2 && scenarioWrites[0].op === 'putMemberInstance' && scenarioWrites[1].op === 'putSessionBinding',
        actual: scenarioWrites,
      },
    ]

    return {
      scenario: 'M1',
      boot: directive.boot,
      sessionId: identity.childSessionId,
      identity,
      pass: assertions.every((a) => a.pass),
      assertions,
      bind: result.bind,
      durableState: result.durable,
      verification: { writes: scenarioWrites, guardFacts: guardFacts.filter((g) => g.scenario === 'M1') },
      obs: { mountErrors: [...mountErrors, ...mountFailures], mountFailures },
    }
  } finally {
    await handle.dispose()
    residencyAgents.delete(identity.childSessionId)
  }
}

/**
 * M5 — ordinary-agent invariance + the negative continuable-subagent
 * probe: subagents.followup(rootAgent, memberChildId, [...]) must fail
 * with SubagentError UNAUTHORIZED at the lineage check, before any turn
 * submit (a Member is not a continuable subagent; no LLM call).
 * @param {object} ctx
 * @returns {Promise<object>} the scenario report.
 */
async function runOrdinaryInvariance(ctx) {
  const svc = resolveServices(ctx)
  const root = directive.rootSessionId
  const spec = directive.specs.A
  const identity = modules.memberMod.deriveMemberIdentity(spec)
  const ordinaryId = directive.ordinarySessionId
  const subagents = ctx.get('subagents')

  const ordHandle = await svc.agents.create({
    sessionId: SessionId(ordinaryId),
    meta: { cwd: process.env.DSH_HOME },
  })
  const rootHandle = await svc.agents.resume({ resumeSessionId: SessionId(root) })
  // The member child is durable in the agent-runtime session store — the
  // sessions service's own store does not know it (sessions.get would
  // miss it), so the probe's effect on the child is measured through a
  // plain agents.resume handle: the resume completes before the "before"
  // reading, so the delta across the probe captures only the probe.
  const childHandle = await svc.agents.resume({ resumeSessionId: SessionId(identity.childSessionId) })
  try {
    // The child session's event count before the probe (the probe must
    // submit NOTHING to it).
    const childEventCountBefore = childHandle.agent.session.events.length

    let probeError = null
    let probeResult = null
    try {
      probeResult = await subagents.followup(
        rootHandle.agent,
        SessionId(identity.childSessionId),
        [{ type: 'text', text: 'p5t6 negative probe — must not be admitted' }],
        {},
      )
    } catch (error) {
      probeError = error
    }

    const childEventCountAfter = childHandle.agent.session.events.length

    const membersOfRoot = readHandle.getMemberInstance(root, identity.instanceId)
    const ordinaryBinding = readHandle.getSessionBinding(ordinaryId)
    const ordinaryResidency = surfaceResidency.get(ordinaryId)
    const ordinaryEvents = eventsFor(ordinaryId)

    const assertions = [
      {
        name: 'ordinary: no team binding row for the ordinary session',
        pass: ordinaryBinding === undefined,
        actual: ordinaryBinding ?? null,
      },
      {
        name: 'ordinary: no residency/overlay bookkeeping for the ordinary session',
        pass: ordinaryResidency === undefined && (residencyAgents.get(ordinaryId) === undefined),
        actual: { surfaceEntry: ordinaryResidency ?? null, liveHandle: residencyAgents.get(ordinaryId) !== undefined },
      },
      {
        name: 'ordinary: no agent-setup events for the ordinary session',
        pass: ordinaryEvents.length === 0,
        actual: ordinaryEvents,
      },
      {
        name: 'member: the M1 member record still stands (unchanged by this scenario)',
        pass: membersOfRoot !== undefined && String(membersOfRoot.childSessionId) === identity.childSessionId,
        actual: membersOfRoot === undefined ? null : { childSessionId: String(membersOfRoot.childSessionId) },
      },
      {
        name: 'probe: followup(rootAgent, memberChildId) rejected with SubagentError UNAUTHORIZED',
        pass: probeError !== null && probeError?.name === 'SubagentError' && probeError?.code === 'UNAUTHORIZED',
        actual: probeError === null
          ? { resolved: probeResult }
          : { name: probeError.name, code: probeError.code, message: String(probeError.message) },
        expected: { name: 'SubagentError', code: 'UNAUTHORIZED' },
      },
      {
        name: 'probe: no turn submitted to the member child (event count unchanged)',
        pass: childEventCountAfter === childEventCountBefore,
        actual: { before: childEventCountBefore, after: childEventCountAfter },
      },
    ]

    return {
      scenario: 'M5',
      boot: directive.boot,
      sessionId: ordinaryId,
      probeChildSessionId: identity.childSessionId,
      pass: assertions.every((a) => a.pass),
      assertions,
      verification: {},
      obs: { subagentsAvailable: subagents !== undefined },
    }
  } finally {
    await childHandle.dispose()
    await rootHandle.dispose()
    await ordHandle.dispose()
  }
}

/**
 * M2 — the COLD member resume of spec A after a process death: the
 * durable child is resumed (app-faithful setup), the scope is restored
 * with ZERO fresh side effects and ZERO durable writes this boot.
 * @param {object} ctx
 * @returns {Promise<object>} the scenario report.
 */
async function runColdMember(ctx) {
  const svc = resolveServices(ctx)
  const spec = directive.specs.A
  const identity = modules.memberMod.deriveMemberIdentity(spec)
  const root = directive.rootSessionId
  const writeCountBefore = writeLog.length
  const { handle, modelRef, composePath } = await resumeChildWithSetup(svc, identity.childSessionId)
  try {
    const ports = makePorts(ctx, { scenario: 'M2' })
    const result = await modules.memberMod.rehydrateColdMember(ports, {
      rootSessionId: root,
      instanceId: identity.instanceId,
    })

    const { personaSection } = await assemblePersona(svc, handle, identity.childSessionId)
    const expectedModel = directive.blueprint.defaultModel
    const expectedPersona = directive.blueprint.memberPersonas[MEMBER_TEMPLATE]
    const member = readHandle.getMemberInstance(root, identity.instanceId)
    const binding = readHandle.getSessionBinding(identity.childSessionId)
    const setupEvents = eventsFor(identity.childSessionId)
    const restored = surfaceResidency.get(identity.childSessionId)?.restored
    const restoreEffect = surfaceResidency.get(identity.childSessionId)?.restoreEffect
    const sessionEvents = handle.agent.session.events.map((ev) => ({ seq: ev.seq, type: ev.type }))
    const scenarioWrites = writeLog.slice(writeCountBefore)

    const assertions = [
      {
        name: 'cold: cold-member path, bound+installed, no noop (the member exists durably)',
        pass: result.path === 'cold-member' && result.bind?.bound === true && result.bind?.installed === true
          && result.noopReason === undefined,
        actual: { path: result.path, bound: result.bind?.bound ?? null, installed: result.bind?.installed ?? null, noopReason: result.noopReason ?? null },
      },
      {
        name: 'cold: identity is the MEMBER identity (kind member, root, instance, child session)',
        pass: result.bind?.identity?.kind === 'member' && String(result.bind?.identity?.sessionId) === identity.childSessionId
          && String(result.bind?.identity?.rootSessionId) === root && String(result.bind?.identity?.instanceId) === identity.instanceId,
        actual: result.bind?.identity ?? null,
      },
      {
        name: 'cold: scope restored with the exact member scope (persona/model/capability)',
        pass: restored !== undefined && restored.kind === 'member' && restored.rootSessionId === root
          && restored.instanceId === identity.instanceId && deepEq(restored.slots, MEMBER_SCOPE_SLOTS),
        actual: restored ?? null,
        expected: { kind: 'member', rootSessionId: root, instanceId: identity.instanceId, slots: MEMBER_SCOPE_SLOTS },
      },
      {
        name: 'cold: admission re-decided open (admitted=true)',
        pass: result.bind?.admitted === true,
        actual: { admitted: result.bind?.admitted ?? null, admissionCode: result.bind?.admissionCode ?? null },
      },
      {
        name: 'cold: agent-setup events exactly [scope-restored(member), admission-decided] — no overlay-installed',
        pass: setupEvents.length === 2
          && setupEvents.some((e) => e.name === 'agent-setup/scope-restored' && e.detail === 'member')
          && setupEvents.some((e) => e.name === 'agent-setup/admission-decided')
          && setupEvents.filter((e) => e.name === 'agent-setup/overlay-installed').length === 0,
        actual: setupEvents,
      },
      {
        name: 'cold: ZERO durable writes this boot (the cold path is read-only on the control plane)',
        pass: scenarioWrites.length === 0,
        actual: scenarioWrites,
      },
      {
        name: 'durable: record + binding intact and consistent (wrote=false)',
        pass: result.durable?.wrote === false && member !== undefined
          && String(member.instanceId) === identity.instanceId
          && binding?.kind === 'team-member' && String(binding.instanceId) === identity.instanceId,
        actual: { wrote: result.durable?.wrote ?? null, memberPresent: member !== undefined, binding: binding ?? null },
      },
      {
        name: 'model: durable model/selection survived the process restart (projection re-seed)',
        pass: sessionEvents.some((e) => e.type === 'model/selection')
          && modelRef.assembled?.provider === expectedModel.provider && modelRef.assembled?.model === expectedModel.model,
        actual: { composePath, assembled: modelRef.assembled ?? null, sessionEvents },
        expected: expectedModel,
      },
      {
        name: 'persona: resumed handle composes the member persona preset with the blueprint text',
        pass: svc.agentPresets.composedPreset(handle.agent.ctx) === directive.memberPersonaPresetId
          && personaSection !== undefined && personaSection.text === expectedPersona,
        actual: { composedPreset: svc.agentPresets.composedPreset(handle.agent.ctx), personaText: personaSection?.text ?? null },
      },
    ]

    return {
      scenario: 'M2',
      boot: directive.boot,
      sessionId: identity.childSessionId,
      identity,
      pass: assertions.every((a) => a.pass),
      assertions,
      bind: result.bind,
      durableState: result.durable,
      verification: { writes: scenarioWrites, restoreScopeCallCount, guardFacts: guardFacts.filter((g) => g.scenario === 'M2') },
      obs: { restoreEffect, mountErrors: [...mountErrors] },
    }
  } finally {
    // The M2 handle STAYS resident (residencyAgents) — M3's evict needs
    // a live handle to drop (residencyDropped:true case).
    // (M2's report is written before M3 runs in the same boot.)
  }
}

/**
 * I1A — the convergent REPLAY of the crashed fresh create (spec B): the
 * record is already durable (the crash froze the process after the
 * record put), so the replay must write ONLY the binding, create no
 * duplicate member, and leave a consistent state (I1a crash proof).
 * @param {object} ctx
 * @returns {Promise<object>} the scenario report.
 */
async function runCrashReplay(ctx) {
  const svc = resolveServices(ctx)
  const spec = directive.specs.B
  const identity = modules.memberMod.deriveMemberIdentity(spec)
  const root = directive.rootSessionId
  const writeCountBefore = writeLog.length
  const { handle, modelRef, composePath } = await resumeChildWithSetup(svc, identity.childSessionId)
  let built
  try {
    built = await buildSlotsFor(svc, handle, `I1A-${directive.runStamp ?? process.pid}`)

    const ports = makePorts(ctx, { slots: built.slots, scenario: 'I1A' })
    const result = await modules.memberMod.createFreshMember(ports, spec)
    const mountFailures = await settleMounts(built.pendingEffects)
    built.modelSource.select(directive.blueprint.defaultModel)

    const member = readHandle.getMemberInstance(root, identity.instanceId)
    const membersOfRoot = domain.repositories.memberInstances.list(root)
    const binding = readHandle.getSessionBinding(identity.childSessionId)
    const scenarioWrites = writeLog.slice(writeCountBefore)
    const durable = await waitForDurable(identity.childSessionId, 30_000)

    const assertions = [
      {
        name: 'replay: convergent — the ONLY durable write is the binding put (the record pre-existed)',
        pass: scenarioWrites.length === 1 && scenarioWrites[0].op === 'putSessionBinding',
        actual: scenarioWrites,
        expected: [{ op: 'putSessionBinding' }],
      },
      {
        name: 'replay: no duplicate member — exactly one record for the identity, team size unchanged (A + B)',
        pass: member !== undefined && membersOfRoot.length === 2
          && membersOfRoot.filter((m) => String(m.instanceId) === identity.instanceId).length === 1,
        actual: { memberPresent: member !== undefined, teamMemberCount: membersOfRoot.length },
      },
      {
        name: 'replay: no unrecoverable half-write — record + binding consistent after crash+replay',
        pass: member !== undefined && String(member.childSessionId) === identity.childSessionId
          && binding?.kind === 'team-member' && String(binding.sessionId) === identity.childSessionId
          && String(binding.instanceId) === identity.instanceId,
        actual: { record: member === undefined ? null : { childSessionId: String(member.childSessionId) }, binding: binding ?? null },
      },
      {
        name: 'replay: operation completed (wrote=true, installed=true, admitted open)',
        pass: result.durable.wrote === true && result.bind.installed === true && result.bind.admitted === true,
        actual: { wrote: result.durable.wrote, installed: result.bind.installed, admitted: result.bind.admitted },
      },
      {
        name: 'replay: child session durable (no duplicate session)',
        pass: durable.published === true,
        actual: durable,
      },
    ]

    return {
      scenario: 'I1A',
      boot: directive.boot,
      sessionId: identity.childSessionId,
      identity,
      pass: assertions.every((a) => a.pass),
      assertions,
      bind: result.bind,
      durableState: result.durable,
      verification: { writes: scenarioWrites, guardFacts: guardFacts.filter((g) => g.scenario === 'I1A') },
      obs: { composePath, modelRef: modelRef.assembled ?? null, mountErrors: [...mountErrors, ...mountFailures] },
    }
  } finally {
    await handle.dispose()
    residencyAgents.delete(identity.childSessionId)
  }
}

/**
 * M3 — evict the SETTLED member (spec A). Harness setup (documented in
 * the g5 report): the SETTLED record is seeded through the row-owned
 * repository seam (delete + put, logged as harness-setup ops — no
 * durable lifecycle-transition mechanism exists in the P4/P5 scope).
 * Product call: evictSettledMember — drops the live handle only.
 * @param {object} ctx
 * @returns {Promise<object>} the scenario report.
 */
async function runEvictSettled(ctx) {
  const _svc = resolveServices(ctx)
  const spec = directive.specs.A
  const identity = modules.memberMod.deriveMemberIdentity(spec)
  const root = directive.rootSessionId
  const writeCountBefore = writeLog.length
  // eventLog carries no scenario tag: baseline the member child's event
  // count here so the zero-event assertion measures only this scenario.
  const childEventCountBefore = eventsFor(identity.childSessionId).length

  // ── harness setup: seed the SETTLED record (delete + put) ────────────
  const existing = readHandle.getMemberInstance(root, identity.instanceId)
  if (existing === undefined) {
    throw new Error('p5t6 M3: the member record is absent — M3 requires the M1/M2 member to be durably present')
  }
  const hadLiveResidency = residencyAgents.has(identity.childSessionId)
  writeLog.push({ op: 'harness-setup-member-delete', rootSessionId: root, instanceId: identity.instanceId })
  await domain.repositories.memberInstances.delete(root, identity.instanceId)
  const settledInput = { ...existing, lifecycle: 'SETTLED' }
  delete settledInput.schemaVersion
  writeLog.push({ op: 'harness-setup-member-put-settled', rootSessionId: root, instanceId: identity.instanceId })
  const settled = await domain.repositories.memberInstances.put(settledInput)

  // ── product call 1: evict with the live handle present ───────────────
  const ports = makePorts(ctx)
  const result1 = await modules.memberMod.evictSettledMember(ports, {
    rootSessionId: root,
    instanceId: identity.instanceId,
  })

  // ── product call 2: evict with the handle already absent ─────────────
  const result2 = await modules.memberMod.evictSettledMember(ports, {
    rootSessionId: root,
    instanceId: identity.instanceId,
  })

  const memberAfter = readHandle.getMemberInstance(root, identity.instanceId)
  const binding = readHandle.getSessionBinding(identity.childSessionId)
  const scenarioWrites = writeLog.slice(writeCountBefore)
  const productWrites = scenarioWrites.filter((w) => !String(w.op).startsWith('harness-setup'))
  const setupWrites = scenarioWrites.filter((w) => String(w.op).startsWith('harness-setup'))

  const assertions = [
    {
      name: 'setup: SETTLED seeded through the row-owned repository seam (2 harness-setup writes, logged)',
      pass: setupWrites.length === 2 && setupWrites[0].op === 'harness-setup-member-delete' && setupWrites[1].op === 'harness-setup-member-put-settled'
        && settled.lifecycle === 'SETTLED',
      actual: setupWrites,
    },
    {
      name: 'evict: path evict-settled with the live handle present -> residencyDropped=true',
      pass: result1.path === 'evict-settled' && result1.residencyDropped === true && hadLiveResidency === true,
      actual: { path: result1.path, residencyDropped: result1.residencyDropped, hadLiveResidency },
    },
    {
      name: 'evict: the live handle was disposed (no residency left)',
      pass: residencyAgents.get(identity.childSessionId) === undefined
        && ports.residency.hasResidency(identity.childSessionId) === false,
      actual: { liveHandlePresent: residencyAgents.get(identity.childSessionId) !== undefined },
    },
    {
      name: 'evict: the durable record SURVIVES — lifecycle SETTLED, identity intact',
      pass: memberAfter !== undefined && memberAfter.lifecycle === 'SETTLED'
        && String(memberAfter.instanceId) === identity.instanceId
        && String(memberAfter.childSessionId) === identity.childSessionId,
      actual: memberAfter === undefined ? null : { lifecycle: memberAfter.lifecycle, instanceId: String(memberAfter.instanceId) },
    },
    {
      name: 'evict: the binding row SURVIVES (team-member, unchanged identity)',
        pass: binding?.kind === 'team-member' && String(binding.sessionId) === identity.childSessionId
          && String(binding.instanceId) === identity.instanceId,
        actual: binding ?? null,
      },
    {
      name: 'evict: ZERO product durable writes (harness-setup writes are flagged separately)',
      pass: productWrites.length === 0,
      actual: { productWrites, setupWrites },
    },
    {
      name: 'evict: no agent-setup events on the evict path (the binder is the single emitter; eviction is not a bind path)',
      pass: eventsFor(identity.childSessionId).length === childEventCountBefore,
      actual: eventsFor(identity.childSessionId).slice(childEventCountBefore),
    },
    {
      name: 'evict2: handle-absent eviction still succeeds (residencyDropped=false, record intact)',
      pass: result2.path === 'evict-settled' && result2.residencyDropped === false
        && result2.member.lifecycle === 'SETTLED',
      actual: { path: result2.path, residencyDropped: result2.residencyDropped },
    },
  ]

  return {
    scenario: 'M3',
    boot: directive.boot,
    sessionId: identity.childSessionId,
    identity,
    pass: assertions.every((a) => a.pass),
    assertions,
    evict1: { path: result1.path, residencyDropped: result1.residencyDropped },
    evict2: { path: result2.path, residencyDropped: result2.residencyDropped },
    verification: { writes: scenarioWrites, hadLiveResidency },
    obs: {},
  }
}

/**
 * M4 — re-admit the evicted (SETTLED) member TWICE: idempotent cold
 * paths, no duplicate member record / binding row / DSH session, zero
 * product writes.
 * @param {object} ctx
 * @returns {Promise<object>} the scenario report.
 */
async function runReAdmit(ctx) {
  const svc = resolveServices(ctx)
  const spec = directive.specs.A
  const identity = modules.memberMod.deriveMemberIdentity(spec)
  const root = directive.rootSessionId
  const writeCountBefore = writeLog.length
  const restoreCountBefore = restoreScopeCallCount
  const { handle, modelRef, composePath } = await resumeChildWithSetup(svc, identity.childSessionId)
  const ports = makePorts(ctx, { scenario: 'M4' })
  try {
    const result1 = await modules.memberMod.rehydrateColdMember(ports, {
      rootSessionId: root,
      instanceId: identity.instanceId,
    })
    const result2 = await modules.memberMod.rehydrateColdMember(ports, {
      rootSessionId: root,
      instanceId: identity.instanceId,
    })

    const membersOfRoot = domain.repositories.memberInstances.list(root)
    const memberRows = membersOfRoot.filter((m) => String(m.instanceId) === identity.instanceId)
    const memberBindings = domain.repositories.sessionBindings.listByKind('team-member')
      .filter((row) => String(row.sessionId) === identity.childSessionId)
    const allSessions = svc.sessions.list()
    const childSessionRows = allSessions.filter((s) => String(s.id) === identity.childSessionId)
    const scenarioWrites = writeLog.slice(writeCountBefore)

    const assertions = [
      {
        name: 'readmit1: cold path succeeded on the SETTLED member (bound+installed+admitted, wrote=false)',
        pass: result1.path === 'cold-member' && result1.bind?.bound === true && result1.bind?.installed === true
          && result1.bind?.admitted === true && result1.durable?.wrote === false,
        actual: { bound: result1.bind?.bound ?? null, installed: result1.bind?.installed ?? null, admitted: result1.bind?.admitted ?? null, wrote: result1.durable?.wrote ?? null },
      },
      {
        name: 'readmit2: the SECOND cold path is idempotent (same outcome, wrote=false)',
        pass: result2.path === 'cold-member' && result2.bind?.bound === true && result2.bind?.installed === true
          && result2.bind?.admitted === true && result2.durable?.wrote === false,
        actual: { bound: result2.bind?.bound ?? null, installed: result2.bind?.installed ?? null, admitted: result2.bind?.admitted ?? null, wrote: result2.durable?.wrote ?? null },
      },
      {
        name: 'no duplicate member: exactly one durable record for the identity (team size A + B unchanged)',
        pass: memberRows.length === 1 && membersOfRoot.length === 2,
        actual: { identityRecordCount: memberRows.length, teamMemberCount: membersOfRoot.length },
      },
      {
        name: 'no duplicate binding: exactly one team-member row for the child session (never re-pointed)',
        pass: memberBindings.length === 1 && String(memberBindings[0]?.instanceId) === identity.instanceId,
        actual: memberBindings.map((b) => ({ sessionId: String(b.sessionId), instanceId: String(b.instanceId) })),
      },
      {
        name: 'no duplicate session: the child session exists exactly once in the live session list',
        pass: childSessionRows.length === 1,
        actual: { childSessionRows: childSessionRows.length, totalSessions: allSessions.length },
      },
      {
        name: 'readmit: scope restored twice, ZERO product durable writes',
        pass: restoreScopeCallCount - restoreCountBefore === 2 && scenarioWrites.length === 0,
        actual: { restoreScopeCalls: restoreScopeCallCount - restoreCountBefore, writes: scenarioWrites },
      },
    ]

    return {
      scenario: 'M4',
      boot: directive.boot,
      sessionId: identity.childSessionId,
      identity,
      pass: assertions.every((a) => a.pass),
      assertions,
      readmit1: { bound: result1.bind?.bound ?? null, wrote: result1.durable?.wrote ?? null },
      readmit2: { bound: result2.bind?.bound ?? null, wrote: result2.durable?.wrote ?? null },
      verification: { writes: scenarioWrites, guardFacts: guardFacts.filter((g) => g.scenario === 'M4') },
      obs: { composePath, modelRef: modelRef.assembled ?? null },
    }
  } finally {
    await handle.dispose()
    residencyAgents.delete(identity.childSessionId)
  }
}

/**
 * I1C — restart idempotency under record loss: run.mjs deleted the
 * durable MemberInstance record before this boot; replaying
 * createFreshMember with the SAME spec must recreate the record
 * (binding-only convergence is the mirror of the I1A replay), create no
 * duplicate Member/Session, and not crash.
 * @param {object} ctx
 * @returns {Promise<object>} the scenario report.
 */
async function runRecordLossReplay(ctx) {
  const svc = resolveServices(ctx)
  const spec = directive.specs.A
  const identity = modules.memberMod.deriveMemberIdentity(spec)
  const root = directive.rootSessionId
  const writeCountBefore = writeLog.length

  // Precondition captured at scenario start (the row opened the domain
  // from the post-deletion file during setup).
  const recordBefore = readHandle.getMemberInstance(root, identity.instanceId)

  const { handle, modelRef, composePath } = await resumeChildWithSetup(svc, identity.childSessionId)
  let built
  try {
    built = await buildSlotsFor(svc, handle, `I1C-${directive.runStamp ?? process.pid}`)

    const ports = makePorts(ctx, { slots: built.slots, scenario: 'I1C' })
    const result = await modules.memberMod.createFreshMember(ports, spec)
    const mountFailures = await settleMounts(built.pendingEffects)
    built.modelSource.select(directive.blueprint.defaultModel)

    const membersOfRoot = domain.repositories.memberInstances.list(root)
    const memberRows = membersOfRoot.filter((m) => String(m.instanceId) === identity.instanceId)
    const memberBindings = domain.repositories.sessionBindings.listByKind('team-member')
      .filter((row) => String(row.sessionId) === identity.childSessionId)
    const allSessions = svc.sessions.list()
    const childSessionRows = allSessions.filter((s) => String(s.id) === identity.childSessionId)
    const scenarioWrites = writeLog.slice(writeCountBefore)

    const assertions = [
      {
        name: 'precondition: the member record was LOST before this boot (record absent at scenario start)',
        pass: recordBefore === undefined,
        actual: recordBefore === undefined ? 'absent' : { instanceId: String(recordBefore.instanceId) },
      },
      {
        name: 'replay: the record is recreated — exactly one row for the identity, no crash',
        pass: memberRows.length === 1 && result.durable.wrote === true,
        actual: { identityRecordCount: memberRows.length, wrote: result.durable.wrote },
      },
      {
        name: 'no duplicate member: the team holds exactly A + B (the recreation is not a second record)',
        pass: membersOfRoot.length === 2,
        actual: { teamMemberCount: membersOfRoot.length },
      },
      {
        name: 'no duplicate binding: the original binding survived the record loss (one row, never re-pointed)',
        pass: memberBindings.length === 1 && String(memberBindings[0]?.instanceId) === identity.instanceId,
        actual: memberBindings.map((b) => ({ sessionId: String(b.sessionId), instanceId: String(b.instanceId) })),
      },
      {
        name: 'no duplicate session: the child session exists exactly once (resumed, not recreated)',
        pass: childSessionRows.length === 1,
        actual: { childSessionRows: childSessionRows.length, totalSessions: allSessions.length },
      },
      {
        name: 'replay: writes exactly [putMemberInstance] (the binding already existed and was consistent)',
        pass: scenarioWrites.length === 1 && scenarioWrites[0].op === 'putMemberInstance',
        actual: scenarioWrites,
      },
    ]

    return {
      scenario: 'I1C',
      boot: directive.boot,
      sessionId: identity.childSessionId,
      identity,
      pass: assertions.every((a) => a.pass),
      assertions,
      bind: result.bind,
      durableState: result.durable,
      verification: { writes: scenarioWrites, guardFacts: guardFacts.filter((g) => g.scenario === 'I1C') },
      obs: { composePath, modelRef: modelRef.assembled ?? null, mountErrors: [...mountErrors, ...mountFailures] },
    }
  } finally {
    await handle.dispose()
    residencyAgents.delete(identity.childSessionId)
  }
}

/**
 * The I1A crash-window run: the fresh create of spec B, frozen inside
 * the audited write proxy after the durable record put (the HTTP
 * response is never sent — run.mjs kills the process in the window).
 * @returns {Promise<never>} hangs at the gate (documented above).
 */
async function runI1aGatedCreate() {
  const ctx = ctxRef
  const svc = resolveServices(ctx)
  const spec = directive.specs.B
  const identity = modules.memberMod.deriveMemberIdentity(spec)
  const handle = await ensureFreshChild(svc, identity.childSessionId)
  try {
    const built = await buildSlotsFor(svc, handle, `I1A-GATED-${directive.runStamp ?? process.pid}`)
    const ports = makePorts(ctx, { slots: built.slots, scenario: 'I1A' })
    // Hangs in the audited putMemberInstance (record durable, binding not).
    await modules.memberMod.createFreshMember(ports, spec)
    // Unreachable before the kill: if ever reached, the gate broke.
    i1aGate.bindingWritten = true
  } finally {
    await handle.dispose()
    residencyAgents.delete(identity.childSessionId)
  }
}
