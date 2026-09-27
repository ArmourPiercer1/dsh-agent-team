/**
 * diag-hook-c4.mjs — Commit 4 runtime OBSERVATION hook (no file modification).
 *
 * Loaded into the test host via NODE_OPTIONS='--import <this file>'. Uses
 * node:module registerHooks() to TRANSFORM (in memory only) three product
 * dist modules of the INSTALLED plugin (path derived from DSH_HOME) with
 * [c4diag] console.error logs. The files on disk stay byte-identical —
 * this is pure observation, the same zero-product-modification discipline
 * as the Phase 0 diag-hook.
 *
 * What it records (all to the host's stderr → the per-boot instance log):
 *   [c4diag-host] apply() entry/exit (counted) + fence creation (counted)
 *   [c4diag-host] bindOwnershipResolver calls
 *   [c4diag-fence] beforeAgentCreated inputs: sid / owner / ownedDepth /
 *     permits / closed — PLUS the branch taken (PASS-unmanaged /
 *     PASS-owned / PASS-permit / VETO)
 *   [c4diag-glue] runOwnedActivation calls: sid / fence-present /
 *     ownedDepth before + after the operation
 *
 * Attribution question being settled: the boot 1 (create) run showed the
 * production fence vetoing the glue's OWN boot-root creation ("bootstrap
 * FAILED: TeamSessionActivationInterceptedError"). The fence unit semantics
 * are correct (owned passes — verified by the isolated repro), so either
 * (a) the vetoing listener is on a DIFFERENT fence instance than the guard
 * the glue wrapped (double apply() → two fences), or (b) the glue's
 * activationFence closure was undefined (fallback direct create). This
 * hook's logs decide (a) vs (b) with timestamps.
 */
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'

// Full rejection stacks: the 10-frame default cut the createAgent caller,
// which is THE frame that settles attribution.
Error.stackTraceLimit = 200 // capture the FULL rejection stack (the 10-frame default hides the caller of createAgent)

const DSH_HOME = process.env.DSH_HOME
const INSTALLED = DSH_HOME
  ? `${DSH_HOME}/profiles/web/node_modules/dsh-agent-team/packages/runtime/dist/packages/runtime/src/plugin`
  : null
const FENCE_URL = INSTALLED ? `file://${INSTALLED}/team-session-activation.js` : null
const HOST_URL = INSTALLED ? `file://${INSTALLED}/host.js` : null
const GLUE_URL = INSTALLED ? `file://${INSTALLED}/live/agent-bindings.mjs` : null
// 0.1.7 create-chain entry points (upstream test-use tree; in-memory
// transform only — the caller of agents.create is the missing frame):
const TESTUSE = '/home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use'
const AGENT_LIB_URL = `file://${TESTUSE}/packages/core/agent/lib/index.js`
const AGENT_LOOP_URL = `file://${TESTUSE}/packages/core/agent-loop/lib/index.js`

const T = () => new Date().toISOString()
const log = (line) => { try { console.error(`[c4diag ${T()}] ${line}`) } catch { /* never throw from the hook */ } }

function transformFence(src) {
  let s = src
  // 1. log the decision inputs in beforeAgentCreated (right after `sid`).
  const sidAnchor = 'const sid = String(input.agent.id);'
  const sidLog = `${sidAnchor} console.error('[c4diag-fence] beforeAgentCreated sid=' + sid + ' owner=' + (ownershipResolver ? resolveOwningSafe(sid) : 'UNBOUND-RESOLVER') + ' ownedDepth=' + (ownedDepthBySession.get(sid) ?? 0) + ' permits=' + ordinaryPermits.size + ' closed=' + closed + ' fenceId=' + (this && this.__c4id) + ' fenceMapAddr=' + (ownedDepthBySession.__c4addr ??= 'M' + (globalThis.__c4mapN = (globalThis.__c4mapN ?? 0) + 1)));`
  if (!s.includes(sidAnchor)) { log('fence: sid anchor NOT FOUND — no transform'); return src }
  // ownershipResolver is a closure var; read it safely without calling it twice.
  const safeFn = 'function resolveOwningSafe(x){ try { const o = ownershipResolver(x); return o === undefined ? "UNMANAGED" : o; } catch (e) { return "RESOLVER-THREW:" + e.message; } }'
  s = s.replace(sidAnchor, `${safeFn} ${sidLog}`)
  // 2. log the VETO branch (right before the throw).
  const vetoAnchor = 'throw new TeamSessionActivationInterceptedError(sid);'
  const vetoLog = `console.error('[c4diag-fence] VETO sid=' + sid); ${vetoAnchor}`
  if (s.includes(vetoAnchor)) s = s.replace(vetoAnchor, vetoLog)
  return s
}

function transformHost(src) {
  let s = src
  const applyAnchor = 'export async function apply(ctx, config) {'
  const applyLog = `${applyAnchor} console.error('[c4diag-host] apply() entry #' + (globalThis.__c4applyN = (globalThis.__c4applyN ?? 0) + 1));`
  if (s.includes(applyAnchor)) s = s.replace(applyAnchor, applyLog)
  const fenceAnchor = 'const activationFence = createTeamSessionActivationFence();'
  const fenceLog = `${fenceAnchor} console.error('[c4diag-host] fence created #' + (globalThis.__c4fenceN = (globalThis.__c4fenceN ?? 0) + 1) + ' id=' + (activationFence.__c4id ??= 'F' + globalThis.__c4fenceN));`
  if (s.includes(fenceAnchor)) s = s.replace(fenceAnchor, fenceLog)
  const bindAnchor = 'activationFence.bindOwnershipResolver((sessionId) => resolveOwningTeamRoot(domain, resolvedRowConfig.rootSessionId, sessionId));'
  if (s.includes(bindAnchor)) {
    s = s.replace(bindAnchor, `activationFence.bindOwnershipResolver((sessionId) => resolveOwningTeamRoot(domain, resolvedRowConfig.rootSessionId, sessionId)); console.error('[c4diag-host] bindOwnershipResolver called (fence #' + (globalThis.__c4fenceN ?? 0) + ')');`)
  }
  return s
}

function transformGlue(src) {
  let s = src
  const anchor = 'async function runOwnedActivation(sessionId, operation) {'
  const logLine = `async function runOwnedActivation(sessionId, operation) { console.error('[c4diag-glue] runOwnedActivation sid=' + sessionId + ' fencePresent=' + (activationFence !== undefined && typeof activationFence.runOwned === 'function') + ' fenceId=' + (activationFence && activationFence.__c4id));`
  if (s.includes(anchor)) {
    // Wrap the two returns to log the depth after.
    s = s.replace(anchor, logLine)
    s = s.replace(
      'return await activationFence.runOwned(String(sessionId), operation)',
      '(globalThis.__c4rtaDepthBefore = activationFence.__c4peek ? activationFence.__c4peek(String(sessionId)) : -999, console.error(\'[c4diag-glue] runOwned BEGIN sid=\' + sessionId), (async () => { const r = await activationFence.runOwned(String(sessionId), operation); console.error(\'[c4diag-glue] runOwned END sid=\' + sessionId); return r })())',
    )
    s = s.replace(
      'return await operation()',
      'console.error(\'[c4diag-glue] FALLBACK-DIRECT (fence absent) sid=\' + sessionId); (async () => { const r = await operation(); console.error(\'[c4diag-glue] FALLBACK-DIRECT END sid=\' + sessionId); return r })()',
    )
  } else {
    log('glue: runOwnedActivation anchor NOT FOUND — no transform')
  }
  return s
}

// 0.1.7 create-chain instrumentation (upstream test-use tree, in-memory only):
// log every public agents.create/resume + createAgent entry with the CALLER
// stack — the frame above initializeAgent that the 10-frame default hid.
function transformAgentLib(src) {
  let s = src
  const anchor = 'async create(options) {'
  const logLine = `async create(options) { console.error('[c4diag-017] AgentRegistry.create sessionId=' + (options && options.sessionId) + ' CALLER-STACK:\\n' + (new Error('c4diag').stack || '').split('\\n').slice(2, 14).join('\\n'));`
  if (s.includes(anchor)) s = s.replace(anchor, logLine)
  return s
}

function transformAgentLoop(src) {
  let s = src
  const anchor = 'async createAgent(ownerCtx, options) {'
  const logLine = `async createAgent(ownerCtx, options) { console.error('[c4diag-017] createAgent sessionId=' + (options && options.sessionId) + ' parentAgent=' + (options && options.parentAgent ? 'yes' : 'no'));`
  if (s.includes(anchor)) s = s.replace(anchor, logLine)
  return s
}

if (INSTALLED === null) {
  log('DSH_HOME unset — hook inactive')
} else {
  registerHooks({
    load(url, context, nextLoad) {
      const isTarget = url === FENCE_URL || url === HOST_URL || url === GLUE_URL || url === AGENT_LIB_URL || url === AGENT_LOOP_URL
      if (isTarget) log(`LOAD url=${url} format=${context.format ?? '?'}`)
      let result
      try {
        result = nextLoad(url, context)
      } catch (e) {
        throw e
      }
      let source = result && result.source
      if (Buffer.isBuffer(source)) source = source.toString('utf8')
      if (typeof source !== 'string') {
        if (isTarget) log(`source type for ${url}: ${typeof source} (isBuffer=${Buffer.isBuffer(result?.source)}) — NOT transformed`)
        return result
      }
      let out = null
      if (url === FENCE_URL) out = transformFence(source)
      else if (url === HOST_URL) out = transformHost(source)
      else if (url === GLUE_URL) out = transformGlue(source)
      else if (url === AGENT_LIB_URL) out = transformAgentLib(source)
      else if (url === AGENT_LOOP_URL) out = transformAgentLoop(source)
      if (out === null) return result
      log(`transformed in-memory: ${url}`)
      return { ...result, source: out }
    },
  })
  log(`hook armed for ${INSTALLED}`)
}
