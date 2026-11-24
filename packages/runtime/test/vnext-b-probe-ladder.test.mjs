/**
 * vnext-b-probe-ladder.test.mjs — the B PROBE LADDER, over UNMODIFIED native tools.
 *
 * WHAT B ASKS FOR. The centre is the ONE place a member's tool call is decided: admission before the
 * body, a durable fact for the decision, a durable fact for the execution, and a settlement record
 * that joins them. B's acceptance is not "the code looks wired": it is a LADDER of probes, in a
 * fixed ORDER, over the host's own tool modules:
 *
 *     read → write → grep → web_fetch → persistent bash → run_code
 *
 * Each rung carries a POSITIVE control (in-lane: admitted, the body runs, the effect is observed, the
 * fact says allow + the settlement says COMPLETED) and a NEGATIVE control (out of lane / out of
 * ceiling: refused BEFORE the body, zero side effects, the fact names the refusal, the settlement
 * says REFUSED with `not-started`). Presence is not acceptance — this suite asserts ORDER and
 * IDENTITY as well:
 *
 *   ORDER     the durable facts, read back from the JSONL ledger on disk, must appear in ladder order
 *             (a fact stream that is merely complete in any order could hide a rung running early).
 *   IDENTITY  every rung must resolve the HOST module's own definition. For `read`/`write`/`grep`/
 *             `web_fetch` the mount must CHANGE the definition the member resolves relative to the
 *             standing preset, while its `execute` BODY must be byte-identical to that preset's (a
 *             Team-authored wrapper differs here). For `bash` the preset scope registers nothing (it
 *             has no `terminals` service), so the reference is the same host module applied to a
 *             collector with the member's OWN terminals face. `run_code` is not a mountable module at
 *             all: it is the host registry's reserved transport, and the member must resolve the SAME
 *             object the standing scope resolves — no shadow definition exists or can exist.
 *
 * WHAT IS REAL HERE, and why each piece has to be:
 *
 *   host modules   the PINNED baseline's `dsh-tool-fs`, `dsh-tool-fs-search`, `dsh-tool-web` and
 *                  `dsh-tool-bash-persistent` packages, mounted through the existing realm lane
 *                  (`hostNativeSpecs` + `mountHostModules`). No fixture tool, no Team body, no
 *                  renamed definition.
 *   providers      the pinned `LocalFileSystem` (wrapped once to COUNT calls: every override is
 *                  `super.<method>`), the product confined process provider, the product confined web
 *                  face with a LOCAL loopback fixture as its transport, and the host sandbox provider
 *                  the governed PTY face confines through. Nothing decides policy: the compiled
 *                  member answer is what the realm enforces, and the bound lanes are exactly that
 *                  answer projected by `bindingFromCompiledMember`.
 *   the centre     `installMemberCentre` — the product's ONE composition point — over a durable
 *                  `openFactLedger` and the product `ExecutionSettlementStore`. The suite never
 *                  installs the admission point by hand and never wraps a definition.
 *
 * THE B-LADDER IS AMENDED (owner ruling `docs/reviews/20261124-0151.txt` §PTC, 2026-11-24). The
 * SUPPORTED positive verification scope is `read → write → grep → web_fetch → bash`; PTC (`run_code`)
 * is verified ONLY as `run_code → typed refusal → zero worker execution → REFUSED/not-started`. The
 * amendment cites the frozen A0 contract instead of editing it: `ADR-ptc-unsupported.md`. What this
 * suite proves per rung, and what it does NOT prove, is reported — never silently reduced:
 *
 *   bash POSITIVE stays BLOCKED IN THIS WORLD, and round 75 changed WHY. Process execution no longer
 *   needs (and no longer has) a path lane: a shell is admitted on the v4 tool-level EXECUTION
 *   authorization (`toolBindings[].authorization` + `execution.executionBoundary`) carried into the
 *   compiled per-tool answer. This world's compiled answer declares NO tool binding for `bash`, so the
 *   centre refuses `process.exec` with `ADMISSION_EXECUTION_UNAUTHORIZED`. The positive control is not
 *   contract-blocked; it needs a world whose blueprint declares the binding (proven in
 *   `vnext-admission.test.mjs` ADM-125+). Fabricating that declaration here — or granting it from the
 *   write lane — would be a SECOND decision authority, which this round forbids.
 *
 *   run_code POSITIVE is NOT APPLICABLE — PRODUCT UNSUPPORTED (ADM-69). Under the ruling there is no
 *   supported PTC positive to run, so the arm reports the ruling's marker and status and asserts the
 *   declaration — it is NOT "skipped pending a fix" and it is NOT deleted. The refusal side is the
 *   real control and stays proven: ADM-76 (out-of-lane) and ADM-79 (the retained entry point on the
 *   real composition) both show the typed `ADMISSION_PTC_UNAVAILABLE`, the
 *   `unsupported-by-product-ruling` status on fact + settlement, zero worker, zero side effects, and
 *   REFUSED/not-started. ADM-80 asserts the not-applicable marker was REPORTED, so neither arm can
 *   become a silent skip.
 *
 * HOST REFUSAL follows `tests/world-factory/a5sf-fs-contract.test.mjs`: absent pinned host ⇒ one
 * machine-readable `VNEXT-B-LADDER-HOST-REFUSED` line and EVERY case `t.skip` (never a pass); host
 * present but an entry missing ⇒ hard `VNEXT-B-LADDER-HOST-INCOMPLETE` throw; complete ⇒ the arms
 * run. `A5SF_REQUIRE_PINNED_HOST=1` (set by the `ci-census` leg) turns the refusal into a failure.
 *
 * ARMS ADM-63 … ADM-80. The numbering continues `vnext-admission.test.mjs` (which stops at ADM-62)
 * rather than restarting, so a reader can follow one arm series across the two files. They live here
 * because they need the pinned host's built `lib/` entries, which the in-process admission suite
 * deliberately does not.
 *
 * @module packages/runtime/test/vnext-b-probe-ladder
 */

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { after, before, test } from 'node:test'

import { resolveSelectedHostModule, selectedHostPin, testHostMode } from '../../../tests/next-host/host-select.mjs'
import {
  executeToolDispatch,
  fsContractHostLayout,
  instrumentedFileSystemClass,
  loadFsContractSeams,
  provideWorkingDirectoryDouble,
} from '../../../tests/world-factory/lib/a5sf-fs-contract-world.mjs'
import { capabilityProbeLine, createConfinedProvider, probeEnvCapabilities, envLimited } from '../../../tests/world-factory/lib/a5sf-env-capability.mjs'

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))

// The product's own TypeScript sources are loaded through the repo's ts-strip hooks. `register` has
// to run before the first product import, which is why those imports are dynamic and below.
register(pathToFileURL(join(REPO_ROOT, 'scripts/run-tests-hooks.mjs')).href)

const { bindingFromCompiledMember, executorReadinessOf, installMemberCentre } = await import('../src/plugin/vnext/centre-install.mjs')
const { openFactLedger } = await import('../src/plugin/vnext/fact-ledger.mjs')
const { hostNativeSpecs, mountHostModules } = await import('../src/plugin/vnext/realm-lane.mjs')
const { createExecutionSettlementStore } = await import('../settlement/execution-settlement.ts')
const { dispatchExecutionId } = await import('../settlement/dispatch-settlement.ts')
// The owner ruling as a machine declaration: the marker/status the two not-applicable arms report and
// the closed arm list a marker arm asserts. A skip that is not one of these arms cannot borrow it.
const { PTC_NOT_APPLICABLE_MARKER, PTC_PRODUCT_RULING, productUnsupportedReport, reportProductUnsupported } = await import('../src/plugin/vnext/ptc-product-ruling.mjs')

// ---------------------------------------------------------------- the world's fixed identities

const IDENTITY = Object.freeze({
  teamId: 'team-vnext-b-ladder',
  memberInstanceId: 'member-vnext-b-ladder',
  templateId: 'worker',
  instanceGeneration: 1,
})
const AGENT_ID = 'agent-vnext-b-ladder'
const SESSION_ID = 'session-vnext-b-ladder'
const TEAM_ROOT_SESSION_ID = 'team-root-vnext-b-ladder'
const POLICY_REVISION = 'rev-vnext-b-ladder'
const WEB_BODY_MARKER = 'WEB-FIXTURE-BODY'
const BASH_MARKER = 'BASH-LADDER-OK'
const RUN_CODE_MARKER = 'RUN-CODE-LADDER-OK'

/**
 * The ladder, in the order B names it. `positive`/`negative` build the ARGUMENTS only — the ceiling
 * that decides them is the world's, never the probe's. `write` names the file it must not create.
 */
const LADDER = Object.freeze([
  Object.freeze({ rung: 1, tool: 'read', axis: 'fs.read', refusalCode: 'LANE_DENY' }),
  Object.freeze({ rung: 2, tool: 'write', axis: 'fs.write', refusalCode: 'LANE_DENY' }),
  Object.freeze({ rung: 3, tool: 'grep', axis: 'fs.read', refusalCode: 'LANE_DENY' }),
  Object.freeze({ rung: 4, tool: 'web_fetch', axis: 'net.fetch', refusalCode: 'NETWORK_DENY' }),
  Object.freeze({ rung: 5, tool: 'bash', axis: 'process.exec', refusalCode: 'ADMISSION_EXECUTION_UNAUTHORIZED' }),
  // Round 55 (C7): `run_code` is the PTC entry, and PTC's absence is the process lane PLUS the
  // escalation row's second authority — its own code, distinct from a plain shell's.
  Object.freeze({ rung: 6, tool: 'run_code', axis: 'process.exec', refusalCode: 'ADMISSION_PTC_UNAVAILABLE' }),
])

/**
 * The ONE rung whose POSITIVE control the compiled answer cannot carry in this world (see the header).
 * PTC is no longer in this table: its positive is NOT APPLICABLE — PRODUCT UNSUPPORTED (the ruling),
 * which is a different state from "blocked pending a world that declares the authorization".
 */
const POSITIVE_BLOCKED = Object.freeze({
  bash: 'execution-authority-not-declared-in-this-world: the compiled answer carries no toolBindings[] entry for bash, so there is no tool-level authorization to admit it (round 75 admission now keys on that declaration, not on a path lane)',
})

// ---------------------------------------------------------------- host gate (declared, not guessed)

/**
 * WHICH pinned host this world is built from. The ladder is host-SELECTABLE, not host-doubled: the
 * same 18 arms run against whichever pristine tree `TEAM_TEST_HOST` selects, and every host module
 * below resolves INSIDE that tree. Mixing the repo's rc.2 install into an rc.5 world is the
 * duplicate-instance hazard the route-C repair removed once already (round 110), so the selector is
 * consulted here rather than a bare `createRequire`.
 */
const HOST_MODE = testHostMode()
const HOST = fsContractHostLayout(REPO_ROOT, HOST_MODE)
const HOST_PIN = selectedHostPin(REPO_ROOT, HOST_MODE)
const REQUIRE_PINNED_HOST = process.env['A5SF_REQUIRE_PINNED_HOST'] === '1'

const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
/**
 * A few of the host packages the ladder needs are not direct dependencies of `packages/runtime`;
 * they resolve from the tool package that declares them (exactly as a composition that hosts those
 * tools would resolve them). The pnpm virtual store hoists the rest (the PTC runtime and the session
 * module are declared by the host's own assembly package, not by this repository). Those fallbacks
 * apply to the LEGACY host only: under `next` every host entry resolves inside the selected tree.
 */
const VIRTUAL_STORE_ANCHOR = join(REPO_ROOT, 'node_modules', '.pnpm', 'node_modules', '__vnext-b-ladder-resolve__.mjs')
const storeRequire = createRequire(VIRTUAL_STORE_ANCHOR)

/**
 * Resolve one HOST package entry in the SELECTED generation.
 * @param {string} spec - bare `@deepseek-ai/*` specifier.
 * @returns {string} absolute entry path inside the selected host tree.
 */
function resolveHost (spec) {
  if (HOST_MODE === 'next') return resolveSelectedHostModule(spec, REPO_ROOT, HOST_MODE)
  try {
    return runtimeRequire.resolve(spec)
  } catch (error) {
    if (error?.code !== 'MODULE_NOT_FOUND') throw error
    return storeRequire.resolve(spec)
  }
}

const hostEntryUrl = (spec) => pathToFileURL(resolveHost(spec)).href

/** One entry per piece of host the ladder cannot run without, with the EXACT reason it is absent. */
function hostEntry (name, locate) {
  try {
    const found = locate()
    if (typeof found !== 'string' || !existsSync(found)) return { name, problem: `not found at ${String(found)}` }
    return { name, path: found }
  } catch (error) {
    return { name, problem: String(error?.message ?? error) }
  }
}

const HOST_ENTRIES = Object.freeze([
  hostEntry('pinned tool-fs lib', () => HOST.entries.toolFs),
  hostEntry('pinned fs-local lib', () => HOST.entries.fsLocal),
  hostEntry('pinned fs-observation-policy lib', () => HOST.entries.observationPolicy),
  hostEntry('@deepseek-ai/dsh-tool-fs-search', () => resolveHost('@deepseek-ai/dsh-tool-fs-search')),
  hostEntry('@deepseek-ai/dsh-subprocess-local', () => resolveHost('@deepseek-ai/dsh-subprocess-local')),
  hostEntry('@deepseek-ai/dsh-spill-local', () => resolveHost('@deepseek-ai/dsh-spill-local')),
  hostEntry('@deepseek-ai/dsh-sandbox-policy', () => resolveHost('@deepseek-ai/dsh-sandbox-policy')),
  hostEntry('@deepseek-ai/dsh-sandbox-local', () => resolveHost('@deepseek-ai/dsh-sandbox-local')),
  hostEntry('@deepseek-ai/dsh-session-projection', () => resolveHost('@deepseek-ai/dsh-session-projection')),
  hostEntry('@deepseek-ai/dsh-tool-bash-persistent', () => resolveHost('@deepseek-ai/dsh-tool-bash-persistent')),
  hostEntry('@deepseek-ai/dsh-tool-web', () => resolveHost('@deepseek-ai/dsh-tool-web')),
  hostEntry('@deepseek-ai/dsh-web', () => resolveHost('@deepseek-ai/dsh-web')),
  hostEntry('@deepseek-ai/dsh-ptc-runtime-node', () => resolveHost('@deepseek-ai/dsh-ptc-runtime-node')),
  hostEntry('@deepseek-ai/dsh-session', () => resolveHost('@deepseek-ai/dsh-session')),
  // rc.5 replaced `ToolRuntime`'s `mode` config with an EXECUTOR SERVICE selected by scope. The
  // ladder's two presentations mount the two executors the host ships; on rc.2 dispatch is built in
  // and neither package exists (so neither is required).
  ...(HOST_MODE === 'next'
    ? [
        hostEntry('@deepseek-ai/dsh-tool-executor-native', () => resolveHost('@deepseek-ai/dsh-tool-executor-native')),
        hostEntry('@deepseek-ai/dsh-tool-executor-ptc', () => resolveHost('@deepseek-ai/dsh-tool-executor-ptc')),
      ]
    : []),
])

const HOST_PRESENT = existsSync(HOST.root)
const HOST_MISSING = HOST_ENTRIES.filter((entry) => entry.problem !== undefined)

const HOST_REFUSAL = HOST_PRESENT
  ? undefined
  : `VNEXT-B-LADDER-HOST-REFUSED host=${HOST_MODE} pinned=${HOST_PIN.version} sha=${HOST_PIN.sha} root=${HOST.root}`
const HOST_INCOMPLETE = HOST_PRESENT && HOST_MISSING.length > 0
  ? `VNEXT-B-LADDER-HOST-INCOMPLETE host=${HOST_MODE} root=${HOST.root} missing=${HOST_MISSING.map((entry) => `${entry.name} (${entry.problem})`).join('; ')}`
  : undefined

if (HOST_REFUSAL !== undefined && REQUIRE_PINNED_HOST) {
  // The census leg asks for a hard answer: a pinned world that is absent must not read as "fine".
  throw new Error(`${HOST_REFUSAL} (A5SF_REQUIRE_PINNED_HOST=1 turns this refusal into a failure)`)
}
if (HOST_INCOMPLETE !== undefined) throw new Error(HOST_INCOMPLETE)
if (HOST_REFUSAL !== undefined) process.stdout.write(`${HOST_REFUSAL}\n`)

// ---------------------------------------------------------------- the world

const lane = (allow) => Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })

/**
 * One ladder world.
 *
 * The PHYSICAL faces are identical in both worlds on purpose: the member's realm owns a working fs,
 * a working confined subprocess face, a working web face and a governed PTY. Only the COMPILED
 * answer (and therefore the binding the centre resolves) differs, so a negative refusal is the
 * centre's decision and not "the provider was never there".
 *
 * @param {object} input
 * @param {string} input.label - directory/marker label.
 * @param {'in-lane' | 'out-of-lane'} input.ceiling - which compiled answer this world enforces.
 */
async function buildLadderWorld ({ label, ceiling, dir, presentation = 'both' }) {
  const seams = await loadFsContractSeams(REPO_ROOT)
  const { Context, ToolRuntime, SystemPrompt, LocalFileSystem, createScope, bindScopeParent, nativeToolModules, row } = seams

  const inside = join(dir, 'inside')
  const outside = join(dir, 'outside')
  mkdirSync(inside, { recursive: true })
  mkdirSync(outside, { recursive: true })
  const insideFile = join(inside, 'doc.txt')
  const outsideFile = join(outside, 'secret.txt')
  writeFileSync(insideFile, 'alpha beta\n', 'utf8')
  writeFileSync(outsideFile, 'SECRET-NOT-FOR-MEMBER\n', 'utf8')

  // THE LOCAL HTTP FIXTURE. `web_fetch` is a real network tool; the probe runs it against a loopback
  // server this file owns, and the composition declares that exact origin as its one test endpoint.
  // No external network, no CDN, no flake.
  const fixture = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    response.end(`${WEB_BODY_MARKER}:${request.url}\n`)
  })
  await new Promise((resolve, reject) => {
    fixture.once('error', reject)
    fixture.listen(0, '127.0.0.1', resolve)
  })
  const fixtureUrl = `http://127.0.0.1:${fixture.address().port}`

  const root = new Context()
  await root.plugin(SystemPrompt)
  // THE DISPATCH SHAPE IS THE SELECTED HOST'S, not a config spelling:
  //
  //   rc.2  `ToolRuntime` owns dispatch; `mode: 'both'` additionally registers the registry's
  //         RESERVED `run_code` transport (the PTC runtime service below is what it dispatches into),
  //         while `mode: 'native'` is the shipped presentation with no such entry.
  //   rc.5  `mode` was REMOVED (`z.never()` — "Mount a native or PTC tool executor instead"). The
  //         registry delegates to an EXECUTOR SERVICE selected per scope (`tools.setExecutor`), the
  //         reserved `run_code` transport moved into `PtcExecutor.requirePtcTransport()`, and dispatch
  //         is a BATCH. The two presentations are the two executor packages the host ships; mounting
  //         them is the host's own contract, not a compatibility layer for rc.2.
  //
  // The PTC executor is mounted AFTER the PTC runtime because it statically injects `ptcRuntime`;
  // the native executor after nothing in particular. Both are mounted as the plugin objects the host
  // exports (`{name, inject, apply}`) — mounting the bare class skips `inject` and the pipeline then
  // cannot see `tools` (round 110's measured failure on route C).
  const presentationOf = (value) => (value === 'both' ? 'ptc' : 'native')
  const presentationMode = presentationOf(presentation)
  if (HOST_MODE === 'next') await root.plugin(ToolRuntime)
  else await root.plugin(ToolRuntime, presentationMode === 'native' ? { mode: 'native' } : { mode: 'both', ptc: {} })
  await root.plugin(LocalFileSystem, { cwd: dir, diffBasisMaxBytes: 10 * 1024 * 1024 })

  const LocalSubprocessRuntime = (await import(hostEntryUrl('@deepseek-ai/dsh-subprocess-local'))).default
  await root.plugin(LocalSubprocessRuntime)
  const LocalSpillStore = (await import(hostEntryUrl('@deepseek-ai/dsh-spill-local'))).default
  await root.plugin(LocalSpillStore, { root: join(dir, 'spill'), cleanupPeriodDays: 1 })

  // The PTY path: `sandboxPolicy` statically injects `sessionProjections`, and Cordis DEFERS a plugin
  // whose static inject is unmet (silently, from the caller's side), so the projection comes first.
  const SessionProjection = (await import(hostEntryUrl('@deepseek-ai/dsh-session-projection'))).default
  await root.plugin(SessionProjection)
  const SandboxPolicyService = (await import(hostEntryUrl('@deepseek-ai/dsh-sandbox-policy'))).default
  await root.plugin(SandboxPolicyService, { mode: 'workspace-write', workspaceRoot: inside })
  // The HOST's own sandbox provider, with NO `runnerCommand`: the host then selects its own rung
  // (bwrap if installed, else its landlock runner). Pinning the PRODUCT launcher here would be the
  // wrong seam — the host prepends its own bwrap profile args to a custom runner, and the product
  // launcher expects `--confined-exec`, so the two do not compose.
  const LocalSandboxProvider = (await import(hostEntryUrl('@deepseek-ai/dsh-sandbox-local'))).default
  const sandboxCounters = { confine: 0 }
  class CountingSandbox extends LocalSandboxProvider {
    async confine (...args) {
      sandboxCounters.confine += 1
      return await super.confine(...args)
    }
  }
  await root.plugin(CountingSandbox, {})

  const WebRuntime = (await import(hostEntryUrl('@deepseek-ai/dsh-web'))).default
  await root.plugin(WebRuntime)
  const NodePtcRuntime = (await import(hostEntryUrl('@deepseek-ai/dsh-ptc-runtime-node'))).default
  await root.plugin(NodePtcRuntime, {})

  // rc.5 only: the executor service the registry delegates to. On rc.2 dispatch is built into
  // `ToolRuntime` and neither package exists.
  //
  // THE DEPLOYMENT-LEVEL EXECUTOR is the PRESENTATION: a native deployment selects
  // `NativeToolExecutor`; a PTC-presenting deployment selects `PtcExecutor` (which is also the only
  // scope that retains the reserved `run_code` transport). rc.2 expressed the second one as
  // `mode: 'both'`, which kept native dispatch AND the PTC entry in ONE registry. rc.5 does not:
  // `tools.setExecutor` refuses a second executor IN A SCOPE, so a world that must dispatch native
  // calls AND reach the retained PTC entry composes them where the host allows — the PTC executor at
  // the deployment scope, the native executor in a nested member scope (created below, once the
  // member scope exists). That is per-scope executor selection, the host's own contract.
  if (HOST_MODE === 'next') {
    const executor = presentationMode === 'ptc'
      ? await import(hostEntryUrl('@deepseek-ai/dsh-tool-executor-ptc'))
      : await import(hostEntryUrl('@deepseek-ai/dsh-tool-executor-native'))
    await root.plugin({ name: executor.name, inject: executor.inject, apply: executor.apply })
  }

  // rc.5's `tool-fs` / `tool-fs-search` / `tool-bash-persistent` statically inject `workingDirectory`
  // (`packages/fs/tool-fs/lib/index.js:2003-2007`). Cordis defers a plugin whose inject is unmet, so
  // a world without it registers NO `read`/`write`/`edit` and every arm fails at DEFINITION_MISSING —
  // a harness absence masquerading as a refusal. The double answers the one question the body asks.
  // It is mounted ONLY on rc.5: rc.2 has no such service and must not grow one.
  if (HOST_MODE === 'next') provideWorkingDirectoryDouble(root, dir)

  // The host modules themselves. `tool-bash-persistent` is a plugin OBJECT (named `apply`), while the
  // tool packages export a default plugin; both are imported as the host ships them.
  const searchModules = await import(hostEntryUrl('@deepseek-ai/dsh-tool-fs-search'))
  const webModules = await import(hostEntryUrl('@deepseek-ai/dsh-tool-web'))
  const shellModules = await import(hostEntryUrl('@deepseek-ai/dsh-tool-bash-persistent'))

  // ---- the STANDING (preset) topology: what a member would inherit without the realm mount ----
  const standingKey = {}
  const standing = createScope(root, standingKey)
  await standing.ctx.plugin(nativeToolModules)
  await standing.ctx.plugin(searchModules, { sampleOverCapGlobResults: false })
  await standing.ctx.plugin(webModules)
  await standing.ctx.plugin(shellModules)

  // A REAL detached Session: `SessionProjection` reads `session.snapshotEvents()` on session events,
  // so a plain `{ header }` object fails inside the host's own projection (it is not a session).
  const sessionModules = await import(hostEntryUrl('@deepseek-ai/dsh-session'))
  const agentSession = sessionModules.Session.create(sessionModules.SessionId(SESSION_ID))

  const agentKey = { id: AGENT_ID, session: agentSession, options: {} }
  const agent = createScope(root, agentKey)
  agentKey.ctx = agent.ctx
  bindScopeParent(agentKey, standingKey)
  // The pinned terminal registry only opens a PTY for an agent its LIVE registry holds
  // (`get(owner.id) === owner`). This is the host service double the pinned suite already uses; it
  // is a registry entry, not a tool body, and nothing about the refusal logic is replaced by it.
  const agents = new Map([[AGENT_ID, agentKey]])
  root.provide('agents', { get: (id) => agents.get(id) })

  // rc.5 — THE MEMBER'S NATIVE DISPATCH SCOPE. The deployment-scope PTC executor (`run_code` only)
  // retains the entry ADM-76/ADM-79 drive; the native calls the ladder's other rungs dispatch must
  // reach an executor that runs them directly. `tools.setExecutor` allows ONE executor per scope, so
  // the native executor lives in a scope NESTED under the member: every dispatch made there is still
  // judged by the centre installed on the member scope (guards chain over ancestors, and
  // `tools/pre-execute` is dispatched on the scope chain), while executor selection picks the native
  // one. rc.2 needs neither: `mode: 'both'` already runs native calls directly.
  const nativeKey = HOST_MODE === 'next' && presentationMode === 'ptc'
    ? { id: `${AGENT_ID}-native`, session: agentSession, options: {} }
    : undefined
  if (nativeKey !== undefined) {
    const nativeScope = createScope(root, nativeKey)
    nativeKey.ctx = nativeScope.ctx
    bindScopeParent(nativeKey, agentKey)
    const nativeExecutor = await import(hostEntryUrl('@deepseek-ai/dsh-tool-executor-native'))
    await nativeScope.ctx.plugin({ name: nativeExecutor.name, inject: nativeExecutor.inject, apply: nativeExecutor.apply })
  }

  /**
   * The scope one tool call is DISPATCHED in: the host's executor selection is per scope, so this is
   * part of the host SHAPE, not of the expectation. `run_code` goes to the deployment scope (the PTC
   * executor ADM-79 drives); every native rung goes to the member/native scope on rc.5 (and to the
   * member scope on rc.2, which has no split).
   */
  const scopeOfTool = (name) => (HOST_MODE === 'next' && name !== 'run_code' && nativeKey !== undefined ? nativeKey : agentKey)

  /**
   * THE RESERVED `run_code` TRANSPORT, in the shape the SELECTED host exposes it.
   *
   * rc.2 keeps it in the registry, so `tools.get('run_code', scope)` answers it. rc.5 moved it into
   * the PTC EXECUTOR (`PtcExecutor.requirePtcTransport()` — it deliberately stays outside registered
   * capabilities and their restrictions), and the registry's `get()` no longer knows the name. The
   * arm's claim is unchanged — "one transport object, never a per-scope copy" — so this resolves the
   * SAME object through whichever entry the host actually offers; a host that offers none answers
   * `undefined` (the shipped native presentation), which is exactly what ADM-79 asserts.
   *
   * @param {object|undefined} scope - the viewing scope (agent), or undefined for the global view.
   * @param {string} name - tool name.
   */
  const definitionIn = (scope, name) => {
    const tools = root.get('tools')
    if (name === 'run_code' && HOST_MODE === 'next') {
      const executor = tools.selectExecutor(scope)
      return typeof executor?.requirePtcTransport === 'function' ? executor.requirePtcTransport() : undefined
    }
    return tools.get(name, scope)
  }
  const presetDefinition = (name) => definitionIn(standingKey, name)

  // ---- the composition's faces (physically identical in both worlds) ----
  const teamSandbox = await import(pathToFileURL(join(REPO_ROOT, 'packages/runtime/team-sandbox/src/index.ts')).href)
  const physicalRead = lane([inside])
  const physicalWrite = lane([inside])
  const profile = teamSandbox.compileExecutionProfile({
    memberIdentity: IDENTITY.memberInstanceId,
    revision: POLICY_REVISION,
    read: physicalRead,
    write: physicalWrite,
    network: Object.freeze({ access: 'deny' }),
  })
  if (!profile.ok) throw new Error(`the ladder world's execution profile must compile: ${profile.code} ${profile.detail}`)

  // The product's provider, built through the capability helper so the documented probe override
  // (A5SF_FORCE_NETWORK_DENY_ABSENT=1) can force the capability-absent path at the provider's own
  // `deps.probeFacts` seam. Without the override this is the production constructor, unchanged.
  const baseProcessProvider = await createConfinedProvider({
    realmId: IDENTITY.memberInstanceId,
    trustRoot: dir,
    scratchRoot: join(dir, 'scratch'),
  })
  // COUNTING WRAPPER, same class as `instrumentedFileSystemClass`: every call forwards to the real
  // provider, and the wrapper decides nothing.
  const processCounters = { execute: 0, spawn: 0, spawnStreaming: 0, executeStreaming: 0 }
  const processProvider = Object.freeze({
    probe: (...args) => baseProcessProvider.probe(...args),
    prepare: (...args) => baseProcessProvider.prepare(...args),
    execute: (...args) => { processCounters.execute += 1; return baseProcessProvider.execute(...args) },
    spawn: (...args) => { processCounters.spawn += 1; return baseProcessProvider.spawn(...args) },
    spawnStreaming: (...args) => { processCounters.spawnStreaming += 1; return baseProcessProvider.spawnStreaming(...args) },
    executeStreaming: (...args) => { processCounters.executeStreaming += 1; return baseProcessProvider.executeStreaming(...args) },
    requestCancellation: (...args) => baseProcessProvider.requestCancellation(...args),
    settleTermination: (...args) => baseProcessProvider.settleTermination(...args),
    bookkeeping: () => baseProcessProvider.bookkeeping(),
  })
  const spawnCalls = () => processCounters.execute + processCounters.spawn + processCounters.spawnStreaming + processCounters.executeStreaming

  const subprocessFace = {
    effective: {
      memberIdentity: IDENTITY.memberInstanceId,
      toolBindingIdentity: 'member-subprocess',
      invocationId: 'member-subprocess-face',
      policyRevision: POLICY_REVISION,
      read: physicalRead,
      write: physicalWrite,
      network: Object.freeze({ access: 'deny' }),
    },
    provider: processProvider,
    realmId: IDENTITY.memberInstanceId,
    bindingId: 'member-subprocess',
    memberScope: IDENTITY.memberInstanceId,
    // ripgrep lives outside the member's lane; the interpreter/executable's own directory is the
    // documented additive exception, and it is the ONLY one added here.
    runtimeAllowPaths: Object.freeze([{
      path: join(REPO_ROOT, 'tests/deepseek-harness-test-use/node_modules/.pnpm'),
      accessBits: { readFile: true, readDir: true, execute: true },
    }]),
    shellClass: Object.freeze({ programs: Object.freeze(['bash', 'sh']) }),
  }

  const webCounters = { transport: 0 }
  const webFace = {
    effective: {
      memberIdentity: IDENTITY.memberInstanceId,
      toolBindingIdentity: 'member-web',
      invocationId: 'member-web-face',
      policyRevision: POLICY_REVISION,
      read: physicalRead,
      write: physicalWrite,
      // The PHYSICAL face allows the fixture origin in both worlds. The negative world's refusal is
      // the compiled NETWORK axis, so it cannot be mistaken for a transport that never existed.
      network: Object.freeze({ access: 'allow' }),
    },
    provider: {
      id: 'ladder-transport',
      available: () => true,
      fetch: async (request) => {
        webCounters.transport += 1
        const response = await fetch(request.url)
        const text = await response.text()
        return { url: request.url, statusCode: response.status, body: { kind: 'text', content: text }, truncated: false }
      },
    },
    realmId: IDENTITY.memberInstanceId,
    bindingId: 'member-web',
    // PD-30: a loopback destination is refused by the SSRF leg unless the COMPOSITION declares it as
    // an exact test endpoint. A declaration here, never a widening the member can reach.
    testEndpoints: Object.freeze([fixtureUrl]),
  }

  // ---- the compiled answer this world enforces ----
  // In-lane: read/write inside, network allow. Out-of-lane: read/write inside (the targets are
  // OUTSIDE), network deny. Nothing else differs, so each negative has exactly one cause.
  const compiledCeiling = ceiling === 'in-lane'
    ? Object.freeze({ read: physicalRead, write: physicalWrite, network: Object.freeze({ access: 'allow' }) })
    : Object.freeze({ read: physicalRead, write: physicalWrite, network: Object.freeze({ access: 'deny' }) })

  const fsInstances = []
  const InstrumentedFs = instrumentedFileSystemClass(LocalFileSystem, fsInstances)

  const realm = await row.mountMemberA5sfRealm({
    root: agent.ctx,
    a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: join(dir, 'guard-consult.jsonl') }),
    provider: () => ({
      compiledFor: () => ({
        members: [{
          identity: IDENTITY,
          policy: {
            ok: true,
            value: Object.freeze({
              memberIdentity: IDENTITY.memberInstanceId,
              templateId: IDENTITY.templateId,
              instanceGeneration: IDENTITY.instanceGeneration,
              revision: POLICY_REVISION,
              read: compiledCeiling.read,
              write: compiledCeiling.write,
              network: compiledCeiling.network,
            }),
          },
          config: { cwd: dir, diffBasisMaxBytes: 10 * 1024 * 1024 },
        }],
        providerClass: InstrumentedFs,
        subprocess: subprocessFace,
        web: webFace,
        terminal: Object.freeze({
          mode: 'pty',
          program: '/bin/bash',
          memberSessionId: AGENT_ID,
          backendType: 'b-ladder-pty',
        }),
      }),
    }),
    member: {
      sessionId: SESSION_ID,
      instanceId: IDENTITY.memberInstanceId,
      teamRootSessionId: TEAM_ROOT_SESSION_ID,
      templateId: IDENTITY.templateId,
    },
  })
  assert.notEqual(realm, undefined, 'the configured row must mount a realm')

  const specs = hostNativeSpecs([
    { url: '@deepseek-ai/dsh-tool-fs', module: nativeToolModules, expectedTools: ['read', 'write', 'edit'] },
    { url: '@deepseek-ai/dsh-tool-fs-search', module: searchModules, expectedTools: ['grep', 'glob'], config: { sampleOverCapGlobResults: false } },
    { url: '@deepseek-ai/dsh-tool-web', module: webModules, expectedTools: ['web_fetch'] },
    { url: '@deepseek-ai/dsh-tool-bash-persistent', module: shellModules, expectedTools: ['bash'], config: { backendType: 'b-ladder-pty' } },
  ])
  const installed = await mountHostModules({ realm, root: agent.ctx, scope: agentKey, specs })

  // ---- THE CENTRE: the product's one composition point, over durable sinks ----
  const answer = row.compiledAnswerOfRealm(realm)
  // ROUND 76 — THE ANSWER CARRIES THE REALM'S OWN FACES. The centre derives its executor-readiness
  // answer from them (`executorReadinessOf`), so an answer that dropped `subprocess` made a
  // process-class declaration this realm DOES execute look like `ADMISSION_EXECUTOR_UNAVAILABLE`
  // (measured live on the realm-mounted persistent `bash`). The faces are passed through verbatim;
  // this arm fails if the stored answer loses them again.
  assert.equal(answer.subprocess, subprocessFace, 'the compiled answer must carry the subprocess face it mounted')
  assert.equal(answer.terminal?.mode, 'pty', 'the compiled answer must carry the PTY terminal face')
  assert.equal(executorReadinessOf(answer)['confined-subprocess'], 'ready', 'a mounted confined subprocess face is a READY executor')
  const binding = bindingFromCompiledMember({
    member: answer.members[0],
    ...(answer.bindings === undefined ? {} : { bindings: answer.bindings }),
    agentId: AGENT_ID,
    sessionId: SESSION_ID,
    workspaceRoot: inside,
    owner: TEAM_ROOT_SESSION_ID,
    instanceId: IDENTITY.memberInstanceId,
  })

  const ledger = openFactLedger({ path: join(dir, 'facts.jsonl') })
  const settlementStore = createExecutionSettlementStore({ dir: join(dir, 'settlement') })
  const settlementIdentity = (exec) => ({
    executionId: dispatchExecutionId({ rootSessionId: SESSION_ID, agentInstanceId: AGENT_ID }, exec.callId),
    actorId: IDENTITY.memberInstanceId,
    worldId: SESSION_ID,
  })

  const centre = installMemberCentre({
    ctx: agent.ctx,
    binding,
    resolveBinding: () => binding,
    recordAdmission: (fact) => ledger.recordAdmission(fact),
    recordExecution: (fact) => ledger.recordExecution(fact),
    isReplay: (callId) => ledger.has(callId),
    recordReplay: (input) => ledger.recordReplayRefusal(input),
    store: settlementStore,
    identityOf: settlementIdentity,
  })

  // THE HOST'S OWN CALL SHAPE. rc.2 takes one call; rc.5 takes a batch whose call arguments are a
  // JSON STRING and whose result is `batch.results[0].result`. The existing helper owns that split
  // (round 110 re-used it for route C rather than inventing a second mechanism); the ladder passes
  // only the call it wants dispatched and unwraps the SAME result shape the arms already assert on.
  const dispatch = async (name, args, callId) => {
    const settled = await executeToolDispatch(
      root.get('tools'),
      { signal: new AbortController().signal, callId, name, arguments: args, agent: scopeOfTool(name) },
      { hostMode: HOST_MODE },
    )
    const text = Array.isArray(settled.content)
      ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
      : ''
    return { isError: settled.isError === true, text, errorMessage: settled.error?.message }
  }

  const recordsOf = (callId) => {
    // Read back from the FILE, not from an in-memory array: a fact that only exists in RAM is not a
    // durable fact, and the whole point of the ledger is that it survives the writer.
    const records = ledger.readAll().filter((record) => record.callId === callId)
    return {
      admission: records.find((record) => record.kind === 'invocation-authority'),
      execution: records.find((record) => record.kind === 'execution'),
    }
  }

  const world = {
    label,
    presentation,
    dir,
    inside,
    outside,
    insideFile,
    outsideFile,
    fixtureUrl,
    root,
    agentKey,
    realm,
    installed,
    centre,
    ledger,
    settlementStore,
    binding,
    answer,
    dispatch,
    recordsOf,
    settlementOf: (callId) => settlementStore.read(settlementIdentity({ callId }).executionId),
    definitionOf: (name) => definitionIn(scopeOfTool(name), name),
    /** The model-visible set the host would OFFER this member (`tools.schemas(scope)`). */
    schemas: () => root.get('tools').schemas(agentKey),
    /** The HOST-registry view (no scope): what the process retains regardless of the member's offer. */
    globalDefinitionOf: (name) => definitionIn(undefined, name),
    /**
     * The host bash module's OWN definition for THIS member's terminals face. The preset scope has
     * no `terminals`, so the module registers nothing there and has no reference to compare against;
     * applying it to a collector (never dispatched, emitting no body of its own) is how the identity
     * of the mounted `bash` body is proven to be the host's.
     */
    async bashReferenceDefinitions () {
      const collected = []
      const plugin = typeof shellModules.default === 'function' ? shellModules.default : shellModules
      const referenceCtx = {
        terminals: realm.installation.members[0].faces.terminals,
        tools: { register: (definition) => collected.push(definition) },
        effect: () => () => {},
        get: (name) => root.get(name),
      }
      await plugin.apply(referenceCtx, { backendType: 'b-ladder-pty' })
      return collected
    },
    presetDefinition,
    memberFaces: realm.installation.members[0].faces,
    fsCalls: () => (fsInstances[0] === undefined ? undefined : fsInstances[0].calls),
    spawnCalls,
    transportCalls: () => webCounters.transport,
    confineCalls: () => sandboxCounters.confine,
    async dispose () {
      try { centre.dispose() } catch { /* teardown noise must not mask an arm's result */ }
      try { await installed.dispose() } catch { /* idem */ }
      try { await realm.dispose() } catch { /* idem */ }
      try { await root.dispose?.() } catch { /* idem */ }
      await new Promise((resolve) => fixture.close(resolve))
    },
  }
  return world
}

// ---------------------------------------------------------------- shared state

let scratchDir
let inLane
let outOfLane
let offered
const positiveLog = []
const negativeLog = []

const ARMS = []
const arm = (title, run) => ARMS.push({ title, run })

// ---------------------------------------------------------------- ARMS

arm('ADM-63 — the ladder\'s definitions are the HOST\'s own: every rung resolves a host module body', () => {
  const world = inLane
  assert.deepEqual([...world.installed.mounted].sort(), ['bash', 'edit', 'glob', 'grep', 'read', 'web_fetch', 'write'], 'the realm lane must prove it took over every declared host name')

  for (const name of ['read', 'write', 'grep', 'web_fetch']) {
    const member = world.definitionOf(name)
    const preset = world.presetDefinition(name)
    assert.notEqual(member, undefined, `the member must resolve ${name}`)
    assert.notEqual(preset, undefined, `the standing preset must resolve ${name} (the identity comparison needs a reference)`)
    // The mount must CHANGE the definition the member resolves. An unchanged object here is the
    // silent half-mount the realm lane exists to refuse.
    assert.notEqual(member, preset, `${name}: the realm mount must change the definition the member resolves`)
    // ...and the BODY must be the host's. A Team wrapper would differ even with an identical name.
    assert.equal(String(member.execute), String(preset.execute), `${name}: the mounted definition must BE the host module's body`)
    assert.equal(member.name, name, `${name}: a definition may not be renamed`)
  }

  // `bash`: the preset scope has no `terminals` service, so the host module deliberately registers
  // NOTHING there (that absence is the module's own contract, not a mount failure). The reference is
  // the same host module applied to a collector with the member's OWN governed terminals face; the
  // collector is never dispatched and authors no body.
  assert.equal(world.presetDefinition('bash'), undefined, 'the preset scope has no terminals, so the host module must register no bash definition there')
  return world.bashReferenceDefinitions().then((collected) => {
    assert.equal(collected.length, 1, 'the host bash module must register exactly one definition for this terminals face')
    assert.equal(collected[0].name, 'bash')
    assert.equal(String(world.definitionOf('bash').execute), String(collected[0].execute), 'bash: the member must run the host module\'s body, not a Team-authored one')

    // `run_code` is NOT a mountable module: it is the host registry's reserved transport. The member
    // must resolve the SAME object the standing scope resolves — there is no shadow to find.
    const memberRunCode = world.definitionOf('run_code')
    const presetRunCode = world.presetDefinition('run_code')
    assert.notEqual(memberRunCode, undefined, 'the member must resolve the host registry\'s reserved run_code transport')
    assert.notEqual(presetRunCode, undefined, 'the standing scope must resolve the same transport')
    assert.equal(memberRunCode, presetRunCode, 'run_code must be the registry\'s ONE transport object, never a per-scope copy or a shadow')
    assert.equal(typeof memberRunCode.execute, 'function')
  })
})

arm('ADM-64 — READ positive: in-lane read is admitted, executes on the member provider, and settles COMPLETED', async () => {
  const world = inLane
  const callId = 'ladder-pos-read'
  const before = { ...world.fsCalls() }
  const result = await world.dispatch('read', { file_path: world.insideFile }, callId)
  assert.equal(result.isError, false, `an in-lane read must succeed: ${result.text} ${String(result.errorMessage)}`)
  assert.match(result.text, /alpha beta/u, 'the bytes must arrive')

  const { admission, execution } = world.recordsOf(callId)
  assert.notEqual(admission, undefined, 'the admission fact must be durable')
  assert.notEqual(execution, undefined, 'the execution fact must be durable')
  assert.equal(admission.toolName, 'read')
  assert.equal(admission.axis, 'fs.read')
  assert.equal(admission.decision, 'allow')
  assert.equal(admission.callId, callId)
  assert.equal(execution.outcome, 'completed')
  assert.equal(execution.callId, callId)
  const settlement = world.settlementOf(callId)
  assert.equal(settlement?.state, 'COMPLETED', 'the settlement must join the same callId and close COMPLETED')
  assert.equal(settlement.observation.dispatch, 'quiesced')
  assert.equal(settlement.observation.bodyOutcome, 'completed')
  const after = world.fsCalls()
  assert.ok(after.readText + after.streamText > before.readText + before.streamText, 'the read must reach the member provider')
  positiveLog.push('read')
})

arm('ADM-65 — WRITE positive: in-lane write is admitted, lands on disk, and settles COMPLETED', async () => {
  const world = inLane
  const callId = 'ladder-pos-write'
  const target = join(world.inside, 'written-by-ladder.txt')
  const result = await world.dispatch('write', { file_path: target, content: 'WRITTEN-BY-LADDER\n' }, callId)
  assert.equal(result.isError, false, `an in-lane write must succeed: ${result.text} ${String(result.errorMessage)}`)
  assert.equal(readFileSync(target, 'utf8'), 'WRITTEN-BY-LADDER\n', 'the write must reach the member filesystem')
  const { admission, execution } = world.recordsOf(callId)
  assert.equal(admission.toolName, 'write')
  assert.equal(admission.axis, 'fs.write')
  assert.equal(admission.decision, 'allow')
  assert.equal(execution.outcome, 'completed')
  assert.equal(world.settlementOf(callId)?.state, 'COMPLETED')
  assert.ok(world.fsCalls().writeText >= 1, 'exactly the member provider served the write')
  positiveLog.push('write')
})

arm('ADM-66 — GREP positive: in-lane search is admitted, runs on the confined face, and settles COMPLETED', async (t) => {
  const world = inLane
  const callId = 'ladder-pos-grep'
  const before = world.spawnCalls()
  const result = await world.dispatch('grep', { pattern: 'alpha', path: world.inside }, callId)
  const capability = await probeEnvCapabilities()
  const { admission, execution } = world.recordsOf(callId)
  if (result.isError) {
    // ENV-LIMITED. The confined subprocess face requests `network: deny`; the product admits that
    // request only on its own `--net-leg` proof. This host cannot prove it, so the product refused
    // the spawn BEFORE any process (fail-closed). The positive grep guarantee is therefore NOT
    // proven; the refusal and the admission fact ARE. A failure on a host that proves the
    // capability is a real regression and fails here.
    assert.equal(capability.networkDeny.present, false, `an in-lane grep must not fail on a host that proves network-deny: ${result.text}`)
    assert.equal(admission?.toolName, 'grep', 'the admitted call must still produce its authority fact')
    assert.equal(admission?.decision, 'allow', 'the CENTRE admitted it: the refusal came from the confined face')
    assert.equal(admission?.axis, 'fs.read')
    assert.equal(admission?.locator, world.inside)
    assert.equal(execution?.outcome, 'failed', 'the body never ran: the product refused the confined spawn')
    assert.equal(world.settlementOf(callId)?.state, 'FAILED', 'a refused-by-provider call settles FAILED, never COMPLETED')
    assert.equal(world.spawnCalls(), before, 'the confined provider was never asked to spawn a process')
    assert.doesNotMatch(String(result.text), /Found 1 match/u, 'a refused spawn must not fabricate a search result')
    envLimited({
      arm: 'ADM-66',
      disposition: 'ENV-BLOCK',
      code: capability.networkDeny.code,
      probe: capability.networkDeny.detail,
      reason: 'the in-lane grep body did not run: the confined face requests network=deny and this host cannot prove it, so the product refused the spawn before any process (fail-closed). The search is NOT proven; the admission fact and the refusal are',
    })
    t.skip(`ENV-LIMITED ${capability.networkDeny.code}: the confined grep positive cannot run (see A5SF-CAPABILITY line); the fail-closed refusal IS proven, the search is NOT`)
    return
  }
  assert.equal(result.isError, false, `an in-lane grep must succeed: ${result.text} ${String(result.errorMessage)}`)
  assert.match(result.text, /Found 1 match/u, `the search must find the in-lane file: ${result.text}`)
  assert.equal(admission.toolName, 'grep')
  assert.equal(admission.axis, 'fs.read')
  assert.equal(admission.decision, 'allow')
  assert.equal(admission.locator, world.inside, 'the fact must name the locator the lane judged')
  assert.equal(execution.outcome, 'completed')
  assert.equal(world.settlementOf(callId)?.state, 'COMPLETED')
  assert.ok(world.spawnCalls() > before, 'the search must actually run (the confined subprocess face was used)')
  positiveLog.push('grep')
})

arm('ADM-67 — WEB_FETCH positive: in-lane fetch is admitted, the transport serves the loopback fixture, and settles COMPLETED', async () => {
  const world = inLane
  const callId = 'ladder-pos-web'
  const before = world.transportCalls()
  const result = await world.dispatch('web_fetch', { url: `${world.fixtureUrl}/ladder` }, callId)
  assert.equal(result.isError, false, `an in-lane fetch must succeed: ${result.text} ${String(result.errorMessage)}`)
  assert.match(result.text, new RegExp(WEB_BODY_MARKER, 'u'), 'the fixture body must arrive')
  assert.match(result.text, /HTTP 200/u)
  const { admission, execution } = world.recordsOf(callId)
  assert.equal(admission.toolName, 'web_fetch')
  assert.equal(admission.axis, 'net.fetch')
  assert.equal(admission.decision, 'allow')
  assert.equal(execution.outcome, 'completed')
  assert.equal(world.settlementOf(callId)?.state, 'COMPLETED')
  assert.equal(world.transportCalls() - before, 1, 'exactly one fetch must reach the composition transport')
  positiveLog.push('web_fetch')
})

arm('ADM-68 — BASH positive: NOT RUN in this world (no compiled execution authorization) — disclosed, never a pass', (t) => {
  const world = inLane
  const definition = world.definitionOf('bash')
  assert.notEqual(definition, undefined, 'the host bash module IS mounted: the block is the missing DECLARATION, not a missing tool')
  // The precise block, asserted so a future process-lane change flips THIS arm loudly instead of
  // leaving a stale skip behind.
  assert.equal(world.binding.process, undefined, 'there is no process LANE field at all (round 75)')
  assert.equal(world.binding.perTool?.bash?.authorization, undefined, 'this world declares no tool-level execution authorization for bash')
  process.stdout.write(`VNEXT-B-LADDER-BLOCKED rung=5 tool=bash control=positive verdict=NOT_RUN reason=${POSITIVE_BLOCKED.bash}\n`)
  t.skip(`BASH positive control NOT RUN (${POSITIVE_BLOCKED.bash}); the positive control on a declared world is ADM-125, the negative IS proven (ADM-75)`)
})

arm('ADM-69 — RUN_CODE positive: NOT APPLICABLE — PRODUCT UNSUPPORTED (owner ruling 20261124-0151 §PTC; a ruled scope, not a pending fix)', (t) => {
  const world = inLane
  // The host registry's reserved transport IS registered in this world: what is absent is not a tool
  // but a SUPPORTED governance story. The ruling closes the rung as a SCOPE decision, so the positive
  // claim has no supported target — and saying so is not the same as "skipped pending a fix".
  assert.notEqual(world.definitionOf('run_code'), undefined, 'the host registry retains the transport, which is exactly why the REFUSAL (not the hiding) is the control')
  assert.equal(world.binding.process, undefined, 'the compiled answer carries no process authorization, and the ruling does not invent one')
  assert.equal(PTC_PRODUCT_RULING.status, 'unsupported-by-product-ruling')
  assert.equal(PTC_PRODUCT_RULING.marker, PTC_NOT_APPLICABLE_MARKER)
  const declared = PTC_PRODUCT_RULING.notApplicableArms.find((entry) => entry.id === 'ADM-69')
  assert.notEqual(declared, undefined, 'the ruling declaration must enumerate this arm; an undeclared not-applicable skip is not allowed')
  assert.match(declared.claim, /executes in the governed Member world/u)
  process.stdout.write(`${reportProductUnsupported('ADM-69')}\n`)
  t.skip(`${PTC_NOT_APPLICABLE_MARKER} — ${PTC_PRODUCT_RULING.ruling}: the rung-6 POSITIVE has no supported target this generation; the refusal controls ADM-76/ADM-79 stand, with the rung verified ONLY as run_code -> typed refusal -> zero worker -> REFUSED/not-started`)
})

arm('ADM-70 — ORDER (positive): the durable facts read back in LADDER order', async (t) => {
  const capability = await probeEnvCapabilities()
  if (!capability.networkDeny.present) {
    // The grep rung's BODY could not run (ADM-66 ENV-BLOCK), so the 4-rung positive ladder cannot be
    // claimed. What is still true is asserted: the rungs that did run are in ladder order, and the
    // DURABLE admission facts still carry grep in its ladder position (it was admitted before the
    // confined face refused the spawn).
    assert.deepEqual(positiveLog, ['read', 'write', 'web_fetch'], 'the rungs that ran must still be in ladder order')
    const admissions = inLane.ledger.readAll().filter((record) => record.kind === 'invocation-authority' && record.decision === 'allow')
    assert.deepEqual(admissions.map((record) => record.toolName), ['read', 'write', 'grep', 'web_fetch'], 'the DURABLE admission facts must still appear in ladder order (grep was admitted; its body was refused by the confined face)')
    assert.deepEqual(admissions.map((record) => record.axis), ['fs.read', 'fs.write', 'fs.read', 'net.fetch'])
    envLimited({
      arm: 'ADM-70',
      disposition: 'ENV-BLOCK',
      code: capability.networkDeny.code,
      probe: capability.networkDeny.detail,
      reason: 'the full positive ladder order cannot be claimed because the grep rung body did not run (ADM-66 ENV-BLOCK); the order of the runnable rungs and of the DURABLE admission facts is asserted, but the 4-rung positive ladder is NOT proven',
    })
    t.skip(`ENV-LIMITED ${capability.networkDeny.code}: the grep rung body did not run, so the 4-rung positive ladder order is NOT proven (the admission-fact order and the runnable-rung order are)`)
    return
  }
  assert.deepEqual(positiveLog, ['read', 'write', 'grep', 'web_fetch'], 'the positive probes must run in the B ladder order; a complete-but-shuffled fact stream is not the ladder')
  const admissions = inLane.ledger.readAll().filter((record) => record.kind === 'invocation-authority' && record.decision === 'allow')
  assert.deepEqual(admissions.map((record) => record.toolName), ['read', 'write', 'grep', 'web_fetch'], 'the DURABLE admission facts must appear in ladder order (rungs 5-6 are blocked positives, disclosed above)')
  assert.deepEqual(admissions.map((record) => record.axis), ['fs.read', 'fs.write', 'fs.read', 'net.fetch'])
})

arm('ADM-71 — READ negative: out-of-lane read is refused before the body, with zero filesystem side effects', async () => {
  const world = outOfLane
  const callId = 'ladder-neg-read'
  const before = { ...world.fsCalls() }
  const result = await world.dispatch('read', { file_path: world.outsideFile }, callId)
  assert.equal(result.isError, true, `an out-of-lane read must fail: ${result.text}`)
  assert.doesNotMatch(result.text, /SECRET-NOT-FOR-MEMBER/u, 'the refusal must not carry the file it refused to read')
  const { admission, execution } = world.recordsOf(callId)
  assert.equal(admission.decision, 'deny', 'the CENTRE must be the one that denied, not a provider that was reached')
  assert.equal(admission.refusalCode, 'LANE_DENY')
  assert.equal(admission.locator, world.outsideFile, 'the fact must name the locator it judged')
  assert.equal(execution.outcome, 'admission-refusal', 'the execution fact must say the body never started')
  const settlement = world.settlementOf(callId)
  assert.equal(settlement?.state, 'REFUSED')
  assert.equal(settlement.observation.dispatch, 'not-started')
  assert.equal(settlement.observation.bodyOutcome, 'not-started')
  assert.equal(settlement.observation.effectEvidence, 'none-confirmed')
  const after = world.fsCalls()
  assert.deepEqual(after, before, 'a refused read must not touch the member provider at all')
  negativeLog.push('read')
})

arm('ADM-72 — WRITE negative: out-of-lane write is refused before the body, and the file is never created', async () => {
  const world = outOfLane
  const callId = 'ladder-neg-write'
  const target = join(world.outside, 'escaped-by-ladder.txt')
  const before = { ...world.fsCalls() }
  const result = await world.dispatch('write', { file_path: target, content: 'ESCAPED\n' }, callId)
  assert.equal(result.isError, true, `an out-of-lane write must fail: ${result.text}`)
  assert.equal(existsSync(target), false, 'the refused write must leave no bytes behind')
  const { admission, execution } = world.recordsOf(callId)
  assert.equal(admission.decision, 'deny')
  assert.equal(admission.refusalCode, 'LANE_DENY')
  assert.equal(admission.axis, 'fs.write')
  assert.equal(execution.outcome, 'admission-refusal')
  assert.equal(world.settlementOf(callId)?.state, 'REFUSED')
  assert.equal(world.settlementOf(callId).observation.dispatch, 'not-started')
  assert.deepEqual(world.fsCalls(), before, 'a refused write must not touch the member provider at all')
  negativeLog.push('write')
})

arm('ADM-73 — GREP negative: out-of-lane search is refused before the body, and no subprocess is spawned', async () => {
  const world = outOfLane
  const callId = 'ladder-neg-grep'
  const before = world.spawnCalls()
  const result = await world.dispatch('grep', { pattern: 'SECRET', path: world.outside }, callId)
  assert.equal(result.isError, true, `an out-of-lane grep must fail: ${result.text}`)
  assert.doesNotMatch(result.text, /SECRET-NOT-FOR-MEMBER/u)
  const { admission, execution } = world.recordsOf(callId)
  assert.equal(admission.decision, 'deny')
  assert.equal(admission.refusalCode, 'LANE_DENY')
  assert.equal(admission.locator, world.outside)
  assert.equal(execution.outcome, 'admission-refusal')
  assert.equal(world.settlementOf(callId)?.state, 'REFUSED')
  assert.equal(world.spawnCalls(), before, 'a refused search must not spawn the confined subprocess at all')
  negativeLog.push('grep')
})

arm('ADM-74 — WEB_FETCH negative: denied network axis is refused before the body, and the transport is never called', async () => {
  const world = outOfLane
  const callId = 'ladder-neg-web'
  const before = world.transportCalls()
  // The SAME URL as the positive control: the only difference is the compiled network axis, so the
  // refusal cannot be blamed on the destination.
  const result = await world.dispatch('web_fetch', { url: `${world.fixtureUrl}/ladder` }, callId)
  assert.equal(result.isError, true, `a fetch under a denied network axis must fail: ${result.text}`)
  assert.doesNotMatch(result.text, new RegExp(WEB_BODY_MARKER, 'u'), 'the refused fetch must not carry the body')
  const { admission, execution } = world.recordsOf(callId)
  assert.equal(admission.decision, 'deny')
  assert.equal(admission.refusalCode, 'NETWORK_DENY', 'the refusal must name the NETWORK axis, not the fs lanes')
  assert.equal(admission.axis, 'net.fetch')
  assert.equal(execution.outcome, 'admission-refusal')
  assert.equal(world.settlementOf(callId)?.state, 'REFUSED')
  assert.equal(world.transportCalls(), before, 'a refused fetch must never reach the composition transport')
  negativeLog.push('web_fetch')
})

arm('ADM-75 — BASH negative: with no compiled execution authorization, a shell is refused before the body with zero side effects', async () => {
  const world = outOfLane
  const callId = 'ladder-neg-bash'
  const before = { spawn: world.spawnCalls(), confine: world.confineCalls() }
  const result = await world.dispatch('bash', { command: `echo ${BASH_MARKER}` }, callId)
  assert.equal(result.isError, true, `a shell with no process lane must be refused: ${result.text}`)
  assert.doesNotMatch(result.text, new RegExp(BASH_MARKER, 'u'), 'the refused shell must not have run')
  const { admission, execution } = world.recordsOf(callId)
  assert.equal(admission.toolName, 'bash')
  assert.equal(admission.axis, 'process.exec')
  assert.equal(admission.decision, 'deny')
  assert.equal(admission.refusalCode, 'ADMISSION_EXECUTION_UNAUTHORIZED', 'the refusal must be the MISSING EXECUTION AUTHORIZATION, not a spawn failure')
  assert.match(String(admission.reason ?? ''), /execution authorization/u)
  assert.equal(execution.outcome, 'admission-refusal')
  const settlement = world.settlementOf(callId)
  assert.equal(settlement?.state, 'REFUSED')
  assert.equal(settlement.observation.dispatch, 'not-started')
  assert.equal(world.spawnCalls(), before.spawn, 'a refused shell must not reach the subprocess face')
  assert.equal(world.confineCalls(), before.confine, 'a refused shell must not reach the sandbox provider')
  negativeLog.push('bash')
})

arm('ADM-76 — RUN_CODE negative: PTC stays refused before the body with zero side effects, for the worker\'s OS-profile seam', async () => {
  const world = outOfLane
  const callId = 'ladder-neg-run-code'
  const before = { spawn: world.spawnCalls(), confine: world.confineCalls() }
  const result = await world.dispatch('run_code', { code: `return '${RUN_CODE_MARKER}'`, description: 'prove the code rung is refused' }, callId)
  assert.equal(result.isError, true, `run_code with no process lane must be refused: ${result.text}`)
  assert.doesNotMatch(result.text, new RegExp(RUN_CODE_MARKER, 'u'), 'the refused code must not have run')
  const { admission, execution } = world.recordsOf(callId)
  assert.equal(admission.toolName, 'run_code')
  assert.equal(admission.axis, 'process.exec')
  assert.equal(admission.decision, 'deny')
  assert.equal(admission.refusalCode, 'ADMISSION_PTC_UNAVAILABLE', 'the PTC entry keeps its own code')
  assert.equal(admission.status, PTC_PRODUCT_RULING.status, 'the refusal carries the PRODUCT-RULING status, not a fault status')
  assert.match(String(admission.reason ?? ''), /WORKER process/u, 'the reason names the ONE measured failing part')
  assert.match(String(admission.reason ?? ''), /per-execution policy seam/u, 'the reason names the seam the worker needs')
  assert.equal(execution.outcome, 'admission-refusal')
  assert.equal(world.settlementOf(callId)?.state, 'REFUSED')
  assert.equal(world.spawnCalls(), before.spawn, 'a refused run_code must not start a worker or a process')
  assert.equal(world.confineCalls(), before.confine)
  negativeLog.push('run_code')
})

arm('ADM-77 — ORDER (negative): the durable refusals read back in LADDER order, each before its body', () => {
  assert.deepEqual(negativeLog, ['read', 'write', 'grep', 'web_fetch', 'bash', 'run_code'], 'the negative controls must run in the B ladder order')
  const admissions = outOfLane.ledger.readAll().filter((record) => record.kind === 'invocation-authority')
  assert.deepEqual(admissions.map((record) => record.toolName), ['read', 'write', 'grep', 'web_fetch', 'bash', 'run_code'], 'the DURABLE refusal facts must appear in ladder order')
  assert.deepEqual(admissions.map((record) => record.refusalCode), LADDER.map((entry) => entry.refusalCode))
  const executions = outOfLane.ledger.readAll().filter((record) => record.kind === 'execution')
  assert.equal(executions.length, LADDER.length, 'one execution fact per rung, and no more')
  for (const execution of executions) assert.equal(execution.outcome, 'admission-refusal', 'every rung must record that its body never started')
})

arm('ADM-79 — PTC is ABSENT from the governed Member\'s OFFERED set, and the host-retained entry is a TYPED refusal with zero worker start (the real composition, shipped and PTC presentations)', async () => {
  // ---- (1) THE OFFER, under the presentation the product ships (`native`) ----
  // `schemas()` is the host's model-visible projection for THIS member's scope: it is the set a model
  // would be shown. `definitionOf` is the per-scope resolution the executor uses. Neither may offer
  // the PTC tool: hiding it from the prompt while resolving it at execution time would not be a
  // boundary, so the negative below proves the tool is refused even where the host DOES retain it.
  const offeredNames = offered.schemas().map((schema) => schema.name)
  assert.equal(offeredNames.includes('run_code'), false, `the model-visible set must not offer run_code; offered: ${offeredNames.join(',')}`)
  assert.equal(offered.definitionOf('run_code'), undefined, 'no per-member definition may resolve run_code under the shipped presentation')
  assert.equal(offered.globalDefinitionOf('run_code'), undefined, 'the shipped presentation does not even register the reserved transport')
  assert.equal(offered.installed.mounted.includes('run_code'), false, 'the mounted host modules must not include a PTC tool row')

  // ---- (2) THE HOST-RETAINED ENTRY, where PTC IS presented (`both`) ----
  // A deployment that presents PTC keeps the transport registered host-wide; a mis-wired member scope
  // could still reach it. That is the accidental path the ruling requires to fail TYPED, not to fall
  // through to a worker.
  assert.notEqual(inLane.globalDefinitionOf('run_code'), undefined, 'the PTC-presenting deployment retains the host transport: the entry point exists')
  assert.notEqual(inLane.definitionOf('run_code'), undefined, 'and on this member scope it resolves, so the refusal below is reached through the REAL entry, not a fabricated one')
  const before = { spawn: inLane.spawnCalls(), confine: inLane.confineCalls() }
  const callId = 'ladder-ptc-retained-entry'
  const result = await inLane.dispatch('run_code', { code: `return '${RUN_CODE_MARKER}'`, description: 'accidental PTC call through the retained entry' }, callId)
  assert.equal(result.isError, true, `the retained entry must refuse, not execute: ${result.text}`)
  assert.doesNotMatch(result.text, new RegExp(RUN_CODE_MARKER, 'u'), 'the refused code must not have run')
  const { admission, execution } = inLane.recordsOf(callId)
  assert.equal(admission.toolName, 'run_code')
  assert.equal(admission.decision, 'deny')
  assert.equal(admission.refusalCode, 'ADMISSION_PTC_UNAVAILABLE', 'the refusal keeps its own code (the decision stays individually identifiable)')
  assert.equal(admission.status, PTC_PRODUCT_RULING.status, 'the durable FACT carries the product-ruling status as a field')
  assert.match(String(admission.reason), /unsupported-by-product-ruling/u, 'and the reason names the ruling, not a missing provider')
  assert.equal(execution.status, PTC_PRODUCT_RULING.status, 'the EXECUTION fact carries the same status: a reader joining the two must not parse prose')
  assert.equal(execution.outcome, 'admission-refusal')
  assert.equal(inLane.spawnCalls(), before.spawn, 'ZERO WORKER: a refused run_code must not start the PTC worker or any process')
  assert.equal(inLane.confineCalls(), before.confine, 'and it must not reach the sandbox provider')
  const settled = inLane.settlementOf(callId)
  assert.equal(settled?.state, 'REFUSED')
  assert.equal(settled.observation.dispatch, 'not-started')
  assert.equal(settled.observation.bodyOutcome, 'not-started')
  assert.match(String(settled.terminalReason ?? ''), /ADMISSION_PTC_UNAVAILABLE/u, 'the REPORT surface names the typed code')
  assert.match(String(settled.terminalReason ?? ''), /unsupported-by-product-ruling/u, 'the REPORT surface carries the product-ruling status, not the fact alone')
})

arm('ADM-80 — the PTC not-applicable marker was REPORTED with its status (not a silent skip), and the ruled arm list is CLOSED', () => {
  const reports = productUnsupportedReport().filter((entry) => entry.arm === 'ADM-69')
  assert.equal(reports.length, 1, 'ADM-69 must emit exactly one machine-readable report')
  const line = reports[0].line
  assert.match(line, new RegExp(`marker="${PTC_NOT_APPLICABLE_MARKER}"`, 'u'))
  assert.match(line, /status=unsupported-by-product-ruling/u)
  assert.match(line, /verdict=NOT_APPLICABLE/u)
  assert.match(line, /ADR-ptc-unsupported\.md/u)
  assert.match(line, /arm=ADM-69/u)
  // CLOSED LIST: exactly the two ruled positives (the second is ADM-147, in the admission suite), so a
  // new "temporarily skipped" PTC positive cannot borrow the status — the reporter throws by name.
  assert.deepEqual(PTC_PRODUCT_RULING.notApplicableArms.map((entry) => entry.id), ['ADM-69', 'ADM-147'])
  assert.throws(() => reportProductUnsupported('ADM-999'), /not one of the ruled not-applicable arms/u)
  // The REFUSAL CONTROLS are declared and still exist here; a not-applicable arm never replaces them.
  assert.deepEqual([...PTC_PRODUCT_RULING.refusalControls], ['ADM-76', 'ADM-87'])
  assert.ok(ARMS.some((entry) => entry.title.startsWith('ADM-76')), 'ADM-76 must still be registered')
})

arm('ADM-78 — the binding is the COMPILED answer, and its absent axes stay absent (no second policy)', () => {
  // The positive binding is exactly what `bindingFromCompiledMember` projects from the realm's own
  // compiled answer — the suite never authors a lane. Its absent axes are this world's declarations.
  assert.equal(inLane.binding.process, undefined, 'there is no process lane field, and the binding must not invent one')
  assert.equal(inLane.binding.perTool?.bash?.authorization, undefined, 'nor may it invent execution authority the compiled answer does not carry')
  assert.equal(inLane.binding.network, 'allow', 'the in-lane ceiling allows the network axis, and the binding must say exactly that')
  assert.equal(outOfLane.binding.network, 'deny', 'the out-of-lane ceiling denies the network axis')
  assert.equal(outOfLane.binding.process, undefined)
  assert.deepEqual(inLane.binding.read.allow, [inLane.inside], 'the fs lane must be the compiled lane, by value')
  assert.equal(inLane.binding.workspaceRoot, inLane.inside, 'the member workspace is recorded context, never a process permission')
})

// ---------------------------------------------------------------- registration

if (HOST_REFUSAL !== undefined) {
  // Absent pinned host: every case SKIPS with the same machine-readable refusal. A skip is not a pass.
  for (const entry of ARMS) test(entry.title, { skip: HOST_REFUSAL }, () => {})
} else {
  before(async () => {
    scratchDir = mkdtempSync(join(tmpdir(), 'vnext-b-ladder-'))
    inLane = await buildLadderWorld({ label: 'in-lane', ceiling: 'in-lane', dir: join(scratchDir, 'in-lane') })
    outOfLane = await buildLadderWorld({ label: 'out-of-lane', ceiling: 'out-of-lane', dir: join(scratchDir, 'out-of-lane') })
    // The SAME composition under the SHIPPED presentation: the model-visible offer is measured here,
    // because "the host could be configured to present PTC" is not the deployment the product ships.
    offered = await buildLadderWorld({ label: 'offered-native', ceiling: 'in-lane', dir: join(scratchDir, 'offered-native'), presentation: 'native' })
    // The A0 B-ladder, AMENDED by the owner ruling: supported positive scope read→write→grep→web_fetch→bash,
    // and PTC verified ONLY as run_code→typed refusal→zero worker→REFUSED/not-started. This line is the
    // machine summary the acceptance report quotes; it must state the ruling, not a pending blocker.
    process.stdout.write('VNEXT-B-LADDER rungs=read,write,grep,web_fetch,bash,run_code negatives=6/6 positives=4/5 bash-positive=ADM-68-blocked-in-this-world-ADM-125-proves-it ptc=ADM-69-NOT-APPLICABLE-product-unsupported amendment=ADR-ptc-unsupported.md\n')
    const capability = await probeEnvCapabilities()
    process.stdout.write(`${capabilityProbeLine(capability)}\n`)
  })
  after(async () => {
    if (offered !== undefined) await offered.dispose()
    if (outOfLane !== undefined) await outOfLane.dispose()
    if (inLane !== undefined) await inLane.dispose()
    if (scratchDir !== undefined) rmSync(scratchDir, { recursive: true, force: true })
  })
  for (const entry of ARMS) test(entry.title, entry.run)
}
