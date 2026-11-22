/**
 * vnext-fs-slice.test.mjs — A1's vertical slice, on the REAL host tool runtime.
 *
 * THE CLAIM UNDER TEST, in the owner's terms: a member's native `read` must be served by THAT
 * member's provider, with no Team-authored tool body anywhere in the path. Everything below is
 * the pinned baseline's own code: the real `@deepseek-ai/dsh-tools` registry, the real
 * `@deepseek-ai/dsh-tool-fs` module (loaded from the pinned tree's built `lib/`), the real
 * `LocalFileSystem`, and Cordis' own scopes and isolation.
 *
 * WHAT EACH ASSERTION BUYS
 *   identity     the `read` the agent resolves is a DIFFERENT definition object from the one its
 *                preset scope installed — the mount took effect — while `execute` is the SAME
 *                FUNCTION SOURCE, which is what "the host's body, not a Team copy" means when a
 *                module builds a definition per apply(). A wrapper would fail the second check.
 *   inside       a path inside the member's ceiling reads, one provider call, correct bytes.
 *   outside      a path outside it is refused, and the refusal comes from the member's provider:
 *                its own counters show no successful read of that path, and the file's bytes
 *                never appear in the tool result.
 *   negative     the SAME world with the realm mount removed lets the outside read succeed. This
 *                is the control that makes the three assertions above falsifiable: if the arm
 *                could not fail, it would not be evidence.
 *
 * NOT PROVEN HERE, deliberately: approval, Stop, settlement, or any second member. Those are B.
 * This slice is one member, one face, one provider — the smallest thing that can be wrong.
 *
 * Run: node --test packages/runtime/test/vnext-fs-slice.test.mjs
 * Requires the pinned tree to be built (docs/TEST_METHODS.md §1).
 */

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { after, before, test } from 'node:test'
import { createRequire, register } from 'node:module'
import { hostNativeSpecs, mountHostModules } from '../src/plugin/vnext/realm-lane.mjs'
import {
  executeToolDispatch, instrumentedFileSystemClass, loadFsContractSeams, provideWorkingDirectoryDouble,
} from '../../../tests/world-factory/lib/a5sf-fs-contract-world.mjs'
import { resolveSelectedHostModule, testHostMode } from '../../../tests/next-host/host-select.mjs'

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
/** WHICH pinned host this slice grades against (TEAM_TEST_HOST=next | legacy). */
const HOST_MODE = testHostMode()

/**
 * Resolve a host module entry for the SELECTED host. On rc.2 the repo's own install is the host,
 * so a `packages/runtime`-anchored require is correct; on rc.5 the same require returns the rc.2
 * package, which is the mixed-host substitution this lane refuses.
 */
const resolveHostEntry = (spec) => (HOST_MODE === 'next'
  ? resolveSelectedHostModule(spec, REPO_ROOT)
  : createRequire(join(REPO_ROOT, 'packages/runtime/package.json')).resolve(spec))

/** A require anchored at the package that OWNS `spec`'s entry (`<pkg>/lib/index.js` -> `<pkg>`). */
const requireOfOwningPackage = (spec) => createRequire(join(dirname(dirname(resolveHostEntry(spec))), 'package.json'))

/**
 * Resolve from the owning package first, then from the SELECTED host. Some prerequisite providers
 * are not dependencies of the package that consumes them (a real composition mounts them explicitly),
 * so the owning-package walk is the narrow first try; the host resolver is the fallback that keeps
 * rc.5 from silently borrowing an rc.2 package.
 */
const resolveFromPackageOrHost = (requireOfPackage, spec) => {
  try {
    return requireOfPackage.resolve(spec)
  } catch (error) {
    if (error?.code !== 'MODULE_NOT_FOUND') throw error
    return resolveHostEntry(spec)
  }
}

// The admission point is TypeScript importing product packages with `.js` specifiers; the repo's
// hooks resolve those to `.ts`. Register them BEFORE the dynamic import (a static import would be
// hoisted above the registration).
register(pathToFileURL(fileURLToPath(new URL('../../../scripts/run-tests-hooks.mjs', import.meta.url))).href)
const { installAdmissionPoint } = await import('../src/plugin/vnext/admission-port.mjs')
const { installExecutionFacts } = await import('../src/plugin/vnext/execution-facts.mjs')
const { openFactLedger } = await import('../src/plugin/vnext/fact-ledger.mjs')
const { createInvocationBinder } = await import('../member-io-policy/src/invocation.ts')
const { dispatchExecutionId } = await import('../settlement/dispatch-settlement.ts')
const { createSettlementWriter } = await import('../src/plugin/vnext/settlement-port.mjs')
const { createExecutionSettlementStore } = await import('../settlement/execution-settlement.ts')

const IDENTITY = Object.freeze({
  teamId: 'team-vnext-slice',
  memberInstanceId: 'member-vnext-slice',
  templateId: 'worker',
  instanceGeneration: 1,
})

const lane = (allow) => Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })

/** Build one world. `mountRealm: false` is the negative control, not a second composition. */
async function buildWorld ({ mountRealm, dir, admission, durable, askPath, observation, approvalMode = 'allowed-once', search = false, web = false, webNetwork = 'allow', webTestEndpoints, bash = false, revokeAfterDecision = false }) {
  const seams = await loadFsContractSeams(REPO_ROOT, HOST_MODE)
  const { Context, ToolRuntime, SystemPrompt, LocalFileSystem, NativeToolExecutor, createScope, bindScopeParent, nativeToolModules, row } = seams

  const inside = join(dir, 'inside')
  const outside = join(dir, 'outside')
  mkdirSync(inside, { recursive: true })
  mkdirSync(outside, { recursive: true })
  const insideFile = join(inside, 'doc.txt')
  const outsideFile = join(outside, 'secret.txt')
  writeFileSync(insideFile, 'alpha beta\n', 'utf8')
  writeFileSync(outsideFile, 'SECRET-NOT-FOR-MEMBER\n', 'utf8')

  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  // B4 (rc.5 only): dispatch is behind a selected ToolExecutor service. On the legacy host it is
  // built in; on rc.5 an unmounted executor is TOOL_EXECUTOR_UNAVAILABLE, not a tool refusal.
  if (HOST_MODE === 'next') await root.plugin(NativeToolExecutor)
  // The composition's provider: what a member would resolve if nothing confined it.
  await root.plugin(LocalFileSystem, { cwd: dir, diffBasisMaxBytes: 10 * 1024 * 1024 })
  // B3 (rc.5 only): `dsh-tool-fs` statically injects `workingDirectory`; Cordis defers the plugin
  // silently when it is absent, so the world would have NO read/write/edit. LABELED DOUBLE — the
  // same shape as the `approval` double below: it answers "which directory is this session in?"
  // and nothing else. Never mounted on rc.2, where the inject does not exist.
  if (HOST_MODE === 'next') provideWorkingDirectoryDouble(root, dir)
  // RUNG 4. The search module injects `subprocess` and `spill` (and `systemPrompt`, already here),
  // so those two providers are mounted only when the world is asking for the search family. Loading
  // them always would make every other arm depend on a spawn service it never uses.
  let searchModules
  if (search || bash) {
    // The subprocess provider is not a direct dependency of packages/runtime; it resolves from the
    // search module's own scope, which is the package that declares it. BOTH rung 4 and rung 6 need
    // it: the confined face WRAPS the base service, so the base service has to exist first.
    const searchRequire = requireOfOwningPackage('@deepseek-ai/dsh-tool-fs-search')
    const LocalSubprocessRuntime = (await import(pathToFileURL(searchRequire.resolve('@deepseek-ai/dsh-subprocess-local')).href)).default
    await root.plugin(LocalSubprocessRuntime)
    if (search) {
      const LocalSpillStore = (await import(pathToFileURL(resolveHostEntry('@deepseek-ai/dsh-spill-local')).href)).default
      await root.plugin(LocalSpillStore, { root: join(dir, 'spill'), cleanupPeriodDays: 1 })
      searchModules = await import(pathToFileURL(resolveHostEntry('@deepseek-ai/dsh-tool-fs-search')).href)
    }
  }
  // The two states of the observation policy. The product default in A1/B is OFF, which in this
  // host means "the plugin is not mounted" - the policy has no config switch, so absence IS the
  // off state and the two arms differ by exactly this plugin.
  if (observation === 'on') await root.plugin(seams.observationPolicy)

  // The PRESET topology: the standing scope installs the host's tool module. This is the
  // definition the member would inherit — the thing the realm mount must replace, not rename.
  const standingKey = {}
  const standing = createScope(root, standingKey)
  await standing.ctx.plugin(nativeToolModules)

  const agentKey = {
    // The confined terminal face fences every session by an OWNER id; an owner with no `id` is
    // refused (TERMINALS_OWNER_UNTRUSTED), which is exactly what the first bash arm hit.
    id: 'agent-vnext-slice',
    session: {
      header: { cwd: inside },
      requestHeader: () => ({ config: { provider: 'mock-provider', model: 'mock-model' } }),
    },
    options: {},
  }
  const agent = createScope(root, agentKey)
  // A real Agent carries its OWN context, and tools that register per-owner cleanup reach it
  // (`owner.ctx.effect`). Without it the first bash call died inside the tool's session bookkeeping.
  agentKey.ctx = agent.ctx
  bindScopeParent(agentKey, standingKey)
  const presetRead = root.get('tools').get('read', agentKey)

  // RUNG 4/6. The realm can only host a `subprocess`-consuming module if it OWNS a confined
  // subprocess face, and the composition is what builds it: the product's compiled profile plus the
  // product's P1-07 OS provider. Nothing here decides policy or launches a process by hand.
  let subprocessFace
  if (search || bash) {
    const teamSandbox = await import(pathToFileURL(join(REPO_ROOT, 'packages/runtime/team-sandbox/src/index.ts')).href)
    const sandbox = await import(pathToFileURL(join(REPO_ROOT, 'packages/runtime/sandbox-provider/index.ts')).href)
    const profile = teamSandbox.compileExecutionProfile({
      memberIdentity: IDENTITY.memberInstanceId,
      revision: 'rev-vnext-slice',
      read: lane(askPath === undefined ? [inside] : [inside, askPath]),
      write: lane([inside]),
      network: Object.freeze({ access: 'deny' }),
    })
    if (!profile.ok) throw new Error(`the slice profile must compile: ${profile.code} ${profile.detail}`)
    subprocessFace = {
      effective: {
        memberIdentity: IDENTITY.memberInstanceId,
        toolBindingIdentity: 'member-subprocess',
        invocationId: 'member-subprocess-face',
        policyRevision: 'rev-vnext-slice',
        read: lane(askPath === undefined ? [inside] : [inside, askPath]),
        write: lane([inside]),
        network: Object.freeze({ access: 'deny' }),
      },
      provider: sandbox.createConfinedProcessProvider({ realmId: IDENTITY.memberInstanceId, trustRoot: dir, scratchRoot: join(dir, 'scratch') }),
      // The realm id the provider was created for: a request naming a different realm is refused.
      realmId: IDENTITY.memberInstanceId,
      bindingId: 'member-subprocess',
      memberScope: IDENTITY.memberInstanceId,
      // ripgrep lives outside the member's lane; the interpreter/executable's own directory is the
      // documented additive exception, and it is the ONLY one added here.
      runtimeAllowPaths: Object.freeze([{ path: join(REPO_ROOT, 'tests/deepseek-harness-test-use/node_modules/.pnpm'), accessBits: { readFile: true, readDir: true, execute: true } }]),
      // The realm's DECLARED shell class: a persistent shell is only admissible when the composition
      // names the programs it may run. Not a permission for a command - a class of executables.
      shellClass: Object.freeze({ programs: Object.freeze(['bash', 'sh']) }),
    }
  }

  // RUNG 5. The confined web face is composition-owned: the transport is this test's provider, and
  // the lane that guards it is the Member's compiled network axis.
  // RUNG 6 (PTY). The governed PTY face confines through the deployment `sandbox` provider and
  // allocates the PTY through the BASE subprocess service; both are host plugins, and the launcher
  // pin is the composition's (the same one the OS arms measured).
  if (bash) {
    const launcher = join(REPO_ROOT, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
    // Neither sandbox package is a direct dependency of packages/runtime; they resolve from the
    // shell module's own scope, which is what a real composition that hosts a PTY would declare.
    const shellRequire = requireOfOwningPackage('@deepseek-ai/dsh-tool-bash-persistent')
    const SandboxPolicyService = (await import(pathToFileURL(resolveFromPackageOrHost(shellRequire, '@deepseek-ai/dsh-sandbox-policy')).href)).default
    const LocalSandboxProvider = (await import(pathToFileURL(resolveFromPackageOrHost(shellRequire, '@deepseek-ai/dsh-sandbox-local')).href)).default
    // `sandboxPolicy` statically injects `sessionProjections`, and Cordis DEFERS a plugin whose
    // static inject is unmet - silently, from the caller's point of view. The first attempt mounted
    // it this way and root.get('sandboxPolicy') stayed undefined. Give it what it injects.
    const SessionProjection = (await import(pathToFileURL(resolveFromPackageOrHost(shellRequire, '@deepseek-ai/dsh-session-projection')).href)).default
    await root.plugin(SessionProjection)
    await root.plugin(SandboxPolicyService, { mode: 'workspace-write', workspaceRoot: inside })
    await root.plugin(LocalSandboxProvider, {
      runnerCommand: ['python3', launcher],
      // The launcher's own fail-closed marker on stderr; the provider requires the declaration so a
      // sandbox failure is classified as a sandbox failure and never as a tool error.
      runnerFailureSignatures: ['abi_unavailable', 'launcher_error'],
    })
  }

  let shellModules
  let webFace
  let webModules
  let webFetchCalls = 0
  if (web) {
    // `dsh-web` is not a direct dependency of packages/runtime; the tool module that consumes it is,
    // so the base class resolves from that module's own scope.
    const toolWebRequire = requireOfOwningPackage('@deepseek-ai/dsh-tool-web')
    const WebRuntime = (await import(pathToFileURL(toolWebRequire.resolve('@deepseek-ai/dsh-web')).href)).default
    webModules = await import(pathToFileURL(resolveHostEntry('@deepseek-ai/dsh-tool-web')).href)
    await root.plugin(WebRuntime)
    webFace = {
      effective: {
        memberIdentity: IDENTITY.memberInstanceId,
        toolBindingIdentity: 'member-web',
        invocationId: 'member-web-face',
        policyRevision: 'rev-vnext-slice',
        read: lane([inside]),
        write: lane([inside]),
        // The point of the arm: the TOOL is mounted either way; the network axis decides.
        network: Object.freeze({ access: webNetwork }),
      },
      provider: {
        id: 'slice-transport',
        available: () => true,
        fetch: async (request) => {
          webFetchCalls += 1
          const response = await fetch(request.url)
          const text = await response.text()
          // The closed body union's text arm is `{kind:'text', content}` - not `text`. The host's
          // output validation is what caught the difference.
          return { url: request.url, statusCode: response.status, body: { kind: 'text', content: text }, truncated: false }
        },
      },
      realmId: IDENTITY.memberInstanceId,
      bindingId: 'member-web',
      // PD-30: a loopback destination is refused by the SSRF leg unless the COMPOSITION declares it
      // as an exact test endpoint. It is a declaration here, never a widening the member can reach.
      ...(webTestEndpoints === undefined ? {} : { testEndpoints: Object.freeze([...webTestEndpoints]) }),
    }
  }

  const fsInstances = []
  let realm
  let installedModules
  let mountRefusal
  if (mountRealm) {
    const InstrumentedFs = instrumentedFileSystemClass(LocalFileSystem, fsInstances)
    realm = await row.mountMemberA5sfRealm({
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
                revision: 'rev-vnext-slice',
                // The realm's physical lane must cover an ask subtree the centre can approve;
                // otherwise an approved call is unexecutable (the provider cannot ask).
                read: lane(askPath === undefined ? [inside] : [inside, askPath]),
                write: lane([inside]),
                network: Object.freeze({ access: 'allow' }),
              }),
            },
            config: { cwd: dir, diffBasisMaxBytes: 10 * 1024 * 1024 },
          }],
          providerClass: InstrumentedFs,
          ...(subprocessFace === undefined ? {} : { subprocess: subprocessFace }),
          ...(webFace === undefined ? {} : { web: webFace }),
          // RUNG 6. The confined terminal face runs ON the confined child face (no PTY, no base
          // subprocess), so a persistent-looking shell is still a confined child per command.
          ...(bash
            ? {
                // The PRODUCT path is the governed PTY face (one live shell per Member). The
                // confined per-send child face is a different seam with a different consumer.
                terminal: { mode: 'pty', program: '/bin/bash', memberSessionId: 'agent-vnext-slice', backendType: 'a5sf-pty' },
              }
            : {}),
        }),
      }),
      member: {
        sessionId: 'session-vnext-slice',
        instanceId: IDENTITY.memberInstanceId,
        teamRootSessionId: 'team-root-vnext-slice',
        templateId: IDENTITY.templateId,
      },
    })
    assert.notEqual(realm, undefined, 'the configured row must mount a realm')
    const primary = { url: '@deepseek-ai/dsh-tool-fs',
      module: nativeToolModules,
      // `read_image` is deliberately NOT declared: the pinned tool-fs registers it from a
      // deferred child that injects `attachments`, which this minimal world does not mount, so
      // the name is an ABSENT OPTIONAL CAPABILITY (mount.ts settle rule) rather than a missing
      // mount. Declaring it here would ask the lane to prove something this world cannot provide.
      expectedTools: ['read', 'write', 'edit'],
    }
    const extra = [
      ...(search ? [{ url: '@deepseek-ai/dsh-tool-fs-search', module: searchModules, expectedTools: ['grep', 'glob'], config: { sampleOverCapGlobResults: false } }] : []),
      ...(web ? [{ url: '@deepseek-ai/dsh-tool-web', module: webModules, expectedTools: ['web_fetch'] }] : []),
    ]
    if (bash) {
      shellModules = await import(pathToFileURL(resolveHostEntry('@deepseek-ai/dsh-tool-bash-persistent')).href)
      extra.push({ url: '@deepseek-ai/dsh-tool-bash-persistent', module: shellModules, expectedTools: ['bash'] })
    }
    const specs = hostNativeSpecs(extra.length === 0 ? [primary] : [primary, ...extra])
    try {
      installedModules = await mountHostModules({ realm, root: agent.ctx, scope: agentKey, specs })
    } catch (error) {
      // A composition refusal is a RESULT this world reports, not a crash: the arm below asserts it.
      if (!search) throw error
      mountRefusal = error
    }
  }

  // THE ADMISSION POINT, installed on the agent scope exactly as product wiring will install it.
  // `admission: 'bound'` resolves the member's binding; `admission: 'unbound'` models a controlled
  // call the centre has NOT been wired for, which must be refused rather than forwarded.
  let facts = []
  let executions = []
  let disposeAdmission
  let disposeExecutions
  // `ask-granted` models a host with an approval channel that answers 'allowed-once'. The stub is
  // the smallest thing that proves the centre's half: mint when the ask is raised, spend exactly
  // once at the guard. It is a TEST double for `ctx.get('approval')`, not product wiring.
  let grants
  if (admission === 'ask-granted') {
    // The approval channel's answer is a parameter because Stop is measured through it: a cancelled
    // approval must end the call before the body, with the grant left unspent.
    root.provide('approval', { request: async () => approvalMode })
    const binder = createInvocationBinder()
    grants = {
      binder,
      memberOf: (binding) => ({ teamId: 'team-vnext-slice', memberInstanceId: binding.agentId, templateId: 'tmpl-vnext-slice', instanceGeneration: binding.instanceGeneration }),
    }
  }
  // SETTLEMENT. One store per world, keyed by the product's own execution id, observed at the host's
  // tools/result - the same place the ledger observes it.
  const settlementStore = createExecutionSettlementStore({ dir: join(dir, 'settlement') })
  const settlement = createSettlementWriter({
    store: settlementStore,
    identityOf: (exec) => ({
      // SAME provenance as the ledger fact's executionIdOf below. Two id schemes for one execution
      // would mean the settlement record and the fact could never be joined - and the first version
      // of this wiring did exactly that (the completed call stayed ADMITTED forever).
      executionId: dispatchExecutionId({ rootSessionId: 'session-vnext-slice', agentInstanceId: 'agent-vnext-slice' }, exec.callId),
      actorId: IDENTITY.memberInstanceId,
      worldId: 'session-vnext-slice',
    }),
  })

  // `durable` = the ledger path. When present every admission/execution record goes to disk and a
  // SECOND world built on the same path stands in for the resumed process.
  const ledger = durable === undefined ? undefined : openFactLedger({ path: durable })
  if (mountRealm && admission !== undefined) {
    const lanes = {
      // The provider lane is the physical ceiling for a call the centre has ALREADY adjudicated,
      // so it carries the ask subtree in `allow`: a provider cannot ask, and making it refuse an
      // approved locator would make approval unexecutable. The ask itself is raised by the centre
      // before the body, which is where it can be answered.
      read: { mode: 'restricted', allow: askPath === undefined ? [inside] : [inside, askPath], ask: askPath === undefined ? [] : [askPath], deny: [] },
      write: { mode: 'restricted', allow: [inside], ask: [], deny: [] },
    }
    const binding = {
      agentId: 'agent-vnext-slice',
      sessionId: 'session-vnext-slice',
      instanceGeneration: IDENTITY.instanceGeneration,
      read: lanes.read,
      write: lanes.write,
      definitionSource: '@deepseek-ai/dsh-tool-fs',
      policyGeneration: 'rev-vnext-slice',
      blueprintRevision: 'bp-vnext-slice',
      owner: 'team-root-vnext-slice',
      // The search family's omitted `path` means the member's own root, and the network axis is its
      // own permission - absent is not allow.
      workspaceRoot: inside,
      ...(web ? { network: webNetwork } : {}),
      // ROUND 75: a shell is admitted on its compiled tool-level EXECUTION authorization, never on a
      // path lane. The PTY face is the declared executor (it is mounted below), so readiness is a
      // fact this world knows and states, not a permission it invents.
      ...(bash
        ? {
            executors: { 'confined-subprocess': 'ready' },
            perTool: {
              bash: {
                authorization: 'allow',
                execution: { implementationOrigin: 'dsh-native', executionBoundary: 'confined-subprocess' },
              },
            },
          }
        : {}),
    }
    // REVOCATION (SLICE-34): the binding holder can be revoked between the pre-execute decision and
    // the guard, which is what a real permission revoke looks like from inside one dispatch. The
    // count is deliberate: the FIRST resolution is the decision, the SECOND is the guard's recheck.
    let bindingResolutions = 0
    disposeAdmission = installAdmissionPoint({
      ctx: agent.ctx,
      resolveBinding: () => {
        if (admission !== 'bound' && admission !== 'ask-granted') return undefined
        bindingResolutions += 1
        if (revokeAfterDecision && bindingResolutions > 1) return undefined
        return binding
      },
      record: (record) => {
        facts.push(record)
        if (ledger !== undefined) ledger.recordAdmission(record)
      },
      ...(ledger === undefined ? {} : { isReplay: (callId) => ledger.has(callId), recordReplay: (input) => ledger.recordReplayRefusal(input) }),
      ...(grants === undefined ? {} : { grants }),
      settlement,
    })
    disposeExecutions = installExecutionFacts({
      ctx: agent.ctx,
      record: (fact) => {
        executions.push(fact)
        if (ledger !== undefined) ledger.recordExecution(fact)
      },
      admissionOf: (callId) => facts.find((entry) => entry.callId === callId),
      // The settlement writer consumes the SAME fact the ledger got, and the store's transition law
      // decides what is legal from there.
      onFact: (fact, exec) => {
        if (fact.outcome === 'admission-refusal') return
        if (fact.outcome === 'aborted') settlement.stop({ exec, phase: 'in-flight' })
        settlement.settled({ exec, outcome: fact.outcome })
      },
      // The product's own settlement identity, not a second scheme: same agent + same callId must
      // always produce the same ExecutionId, or the settlement store cannot join a retry.
      executionIdOf: (callId) => dispatchExecutionId({ rootSessionId: 'session-vnext-slice', agentInstanceId: 'agent-vnext-slice' }, callId),
    })
  }

  const dispatch = async (name, args, callId, options = {}) => {
    // B4: rc.5 takes a BATCH input (`calls:[{type:'tool-call', …}]` with JSON-string arguments)
    // and answers `batch.results[0].result`; the legacy shape stays verbatim for rc.2.
    const settled = await executeToolDispatch(root.get('tools'), {
      signal: options.signal ?? new AbortController().signal,
      callId,
      name,
      arguments: args,
      agent: agentKey,
    }, { hostMode: HOST_MODE })
    const text = Array.isArray(settled.content)
      ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
      : ''
    return { isError: settled.isError === true, text, errorMessage: settled.error?.message }
  }

  return {
    dir,
    ledger,
    schemas: () => root.get('tools').schemas(agentKey),
    definitionOf: (name) => root.get('tools').get(name, agentKey),
    facts: () => facts,
    executions: () => executions,
    inside,
    outside,
    insideFile,
    outsideFile,
    presetRead,
    resolvedRead: root.get('tools').get('read', agentKey),
    resolvedDefinitions: Object.fromEntries(['read', 'write', 'edit'].map((name) => [name, root.get('tools').get(name, agentKey)])),
    realm,
    mountRefusal,
    webFetchCalls: () => webFetchCalls,
    settlementStore,
    settlement,
    fsInstances,
    dispatch,
    async dispose () {
      if (typeof disposeExecutions === 'function') disposeExecutions()
      if (typeof disposeAdmission === 'function') disposeAdmission()
      if (installedModules !== undefined) await installedModules.dispose()
      if (realm !== undefined) await realm.dispose()
      await root.dispose?.()
    },
  }
}

let dir
before(() => { dir = mkdtempSync(join(tmpdir(), 'vnext-fs-slice-')) })
after(() => { rmSync(dir, { recursive: true, force: true }) })

test('SLICE-1 — the member resolves the host module mounted on its own realm, by identity and by body', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'identity') })
  try {
    assert.notEqual(world.resolvedRead, undefined, 'the member must resolve `read`')
    assert.notEqual(world.resolvedRead, world.presetRead, 'the mount must CHANGE the definition the member resolves; an unchanged definition means the body would run on the inherited provider')
    // A module that builds a definition per apply() gives a different OBJECT per scope; the
    // BODY is what must be the host's. A Team wrapper would differ here even with the same name.
    assert.equal(
      String(world.resolvedRead.execute),
      String(world.presetRead.execute),
      'the mounted definition must be the host module\'s own body, not a Team-authored one',
    )
  } finally {
    await world.dispose()
  }
})

test('SLICE-2 — inside the ceiling the member read succeeds through its provider', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'inside') })
  try {
    assert.equal(statSync(world.insideFile).size, 11)
    const result = await world.dispatch('read', { file_path: world.insideFile }, 'slice-inside')
    assert.equal(result.isError, false, `an in-ceiling read must succeed: ${result.text}`)
    assert.match(result.text, /alpha beta/u)
    const member = world.realm.installation.members[0].fs
    assert.equal(member.calls.readText + member.calls.streamText, 1, 'exactly one read reached the member provider')
  } finally {
    await world.dispose()
  }
})

test('SLICE-3 — outside the ceiling the member read is refused by ITS provider, and the bytes never arrive', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'outside') })
  try {
    const result = await world.dispatch('read', { file_path: world.outsideFile }, 'slice-outside')
    assert.equal(result.isError, true, `an out-of-ceiling read must fail: ${result.text}`)
    assert.doesNotMatch(result.text, /SECRET-NOT-FOR-MEMBER/u, 'the refusal must not carry the file it refused to read')
    const member = world.realm.installation.members[0].fs
    assert.equal(member.calls.readText, 0, 'the member provider must not have completed a buffered read of an out-of-ceiling path')
    // The refusal must come from the MEMBER'S OWN LANE, and it must refuse before the underlying
    // filesystem is touched at all: a refusal that read the file and then withheld it would be a
    // disclosure bug wearing a passing test.
    assert.match(String(result.errorMessage), /outside every allow subtree/u, `the refusal must name the member lane, not a caller above it: ${String(result.errorMessage)}`)
    assert.equal(member.calls.stat + member.calls.lstat + member.calls.readText + member.calls.streamText, 0, 'the confined provider must refuse BEFORE the real filesystem is reached')
    assert.ok(world.fsInstances.length >= 1, 'the confined provider instance is the only provider the member reached')
  } finally {
    await world.dispose()
  }
})

test('SLICE-5 — write: inside the ceiling the member writes through its provider, and the bytes land', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'write-inside') })
  try {
    const target = join(world.inside, 'written.txt')
    const result = await world.dispatch('write', { file_path: target, content: 'WRITTEN-BY-MEMBER\n' }, 'slice-write-inside')
    assert.equal(result.isError, false, `an in-ceiling write must succeed: ${result.text} ${String(result.errorMessage)}`)
    assert.equal(readFileSync(target, 'utf8'), 'WRITTEN-BY-MEMBER\n', 'the write must reach the member\'s filesystem')
    const member = world.realm.installation.members[0].fs
    assert.equal(member.calls.writeText, 1, 'exactly one write reached the member provider')
  } finally {
    await world.dispose()
  }
})

test('SLICE-6 — write: outside the ceiling it is refused before the filesystem is touched', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'write-outside') })
  try {
    const target = join(world.outside, 'forbidden.txt')
    const result = await world.dispatch('write', { file_path: target, content: 'ESCAPED\n' }, 'slice-write-outside')
    assert.equal(result.isError, true, `an out-of-ceiling write must fail: ${result.text}`)
    assert.match(String(result.errorMessage), /outside every allow subtree/u)
    assert.equal(existsSync(target), false, 'the refused write must not have created the file')
    const member = world.realm.installation.members[0].fs
    assert.equal(member.calls.writeText + member.calls.editText, 0, 'the member provider must not have been asked to write')
  } finally {
    await world.dispose()
  }
})

test('SLICE-7 — the admission point allows an in-ceiling call and records exactly one allow fact', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'adm-allow'), admission: 'bound' })
  try {
    const result = await world.dispatch('read', { file_path: world.insideFile }, 'adm-allow')
    assert.equal(result.isError, false, `the bound in-ceiling read must succeed: ${result.text} ${String(result.errorMessage)}`)
    const facts = world.facts()
    assert.equal(facts.length, 1, 'one call, one fact')
    assert.equal(facts[0].callId, 'adm-allow')
    assert.equal(facts[0].decision, 'allow')
    assert.equal(facts[0].axis, 'fs.read')
    assert.equal(facts[0].locator, world.insideFile)
    assert.equal(facts[0].policyGeneration, 'rev-vnext-slice')
    assert.equal(facts[0].definitionSource, '@deepseek-ai/dsh-tool-fs')
  } finally {
    await world.dispose()
  }
})

test('SLICE-8 — the admission point refuses an out-of-ceiling call BEFORE the body, and records why', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'adm-deny'), admission: 'bound' })
  try {
    const member = world.realm.installation.members[0].fs
    const result = await world.dispatch('read', { file_path: world.outsideFile }, 'adm-deny')
    assert.equal(result.isError, true, `the guard must refuse: ${result.text}`)
    assert.match(String(result.errorMessage), /outside the binding's fs\.read lane/u, 'the refusal must name the lane the binding compiled, not a generic denial')
    assert.equal(member.calls.stat + member.calls.readText + member.calls.streamText, 0, 'a guard refusal must precede the body, so the provider is never reached')
    const facts = world.facts()
    assert.equal(facts.length, 1)
    assert.equal(facts[0].decision, 'deny')
    assert.equal(facts[0].refusalCode, 'LANE_DENY')
    assert.equal(facts[0].locator, world.outsideFile)
  } finally {
    await world.dispose()
  }
})

test('SLICE-9 — UNWIRED: with no binding the same in-ceiling call is refused, and it never reaches the provider', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'adm-unbound'), admission: 'unbound' })
  try {
    const member = world.realm.installation.members[0].fs
    const result = await world.dispatch('read', { file_path: world.insideFile }, 'adm-unbound')
    assert.equal(result.isError, true, `an unbound controlled call must be refused: ${result.text}`)
    assert.match(String(result.errorMessage), /ADMISSION_NO_BINDING/u)
    assert.equal(member.calls.readText + member.calls.streamText, 0, 'the refusal must come before any execution')
    const facts = world.facts()
    assert.equal(facts.length, 1)
    assert.equal(facts[0].refusalCode, 'ADMISSION_NO_BINDING')
    assert.equal(facts[0].agentId, '', 'the record must not invent an identity the binding did not supply')
  } finally {
    await world.dispose()
  }
})

test('SLICE-10 — one execution, one canonical fact, with provenance kept apart from outcome', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'exec-facts'), admission: 'bound' })
  try {
    const allowed = await world.dispatch('read', { file_path: world.insideFile }, 'exec-allow')
    assert.equal(allowed.isError, false, `the allowed read must succeed: ${allowed.text}`)
    const denied = await world.dispatch('read', { file_path: world.outsideFile }, 'exec-deny')
    assert.equal(denied.isError, true, 'the second read must be refused')
    const executions = world.executions()
    assert.equal(executions.length, 2, `two calls must produce two facts, got ${JSON.stringify(executions)}`)
    const byId = Object.fromEntries(executions.map((fact) => [fact.callId, fact]))
    assert.equal(byId['exec-allow'].outcome, 'completed')
    assert.equal(byId['exec-allow'].isError, false)
    assert.equal(byId['exec-deny'].outcome, 'admission-refusal', 'a governed refusal is NOT a tool failure; merging the two makes a refusal look like a broken tool')
    assert.equal(byId['exec-deny'].refusalCode, 'LANE_DENY')
    assert.equal(byId['exec-deny'].errorMessage, undefined, 'a refusal carries its code, not a body error')
  } finally {
    await world.dispose()
  }
})

test('SLICE-11 — a duplicate callId is a REFUSAL, not a merge (UTE-15)', async () => {
  // A fake observer context: this arm is about the fact ledger's own rule, so it needs no host.
  let listener
  const record = []
  const dispose = installExecutionFacts({ ctx: { on: (name, fn) => { if (name === 'tools/result') listener = fn; return () => { listener = undefined } } }, record: (fact) => record.push(fact) })
  assert.equal(typeof listener, 'function')
  const exec = { callId: 'dup-1', name: 'read', agent: { id: 'agent-1' }, turn: 1, step: 1 }
  listener(exec, { isError: false })
  assert.equal(record.length, 1)
  assert.throws(() => listener(exec, { isError: false }), (error) => error.code === 'EXECUTION_FACT_DUPLICATE', 'a second fact for one callId is a replay and must be refused')
  assert.equal(record.length, 1, 'the refused duplicate must not have been written')
  assert.throws(() => listener({ name: 'read' }, { isError: false }), (error) => error.code === 'CALL_ID_MISSING')
  dispose()
})

test('SLICE-12 — the ledger is durable: a SECOND world on the same file reads both decisions back', async () => {
  const ledgerPath = join(dir, 'durable', 'facts.jsonl')
  const first = await buildWorld({ mountRealm: true, dir: join(dir, 'durable-w1'), admission: 'bound', durable: ledgerPath })
  try {
    const allowed = await first.dispatch('read', { file_path: first.insideFile }, 'dur-allow')
    assert.equal(allowed.isError, false, `the allowed read must succeed: ${allowed.text}`)
    const denied = await first.dispatch('read', { file_path: first.outsideFile }, 'dur-deny')
    assert.equal(denied.isError, true)
  } finally {
    await first.dispose()
  }

  // A fresh ledger instance = the resumed process: nothing is carried in memory between them.
  const reopened = openFactLedger({ path: ledgerPath })
  const records = reopened.readAll()
  const admissions = records.filter((record) => record.kind === 'invocation-authority')
  const executions = records.filter((record) => record.kind === 'execution')
  assert.equal(admissions.length, 2, `two calls, two durable authority records: ${JSON.stringify(records)}`)
  assert.equal(executions.length, 2, 'two calls, two durable execution records')
  assert.equal(reopened.has('dur-allow'), true)
  assert.equal(reopened.has('dur-deny'), true, 'a REFUSED call is admitted-and-decided; it must be on disk too')
  const denial = admissions.find((record) => record.callId === 'dur-deny')
  assert.equal(denial.decision, 'deny')
  assert.equal(denial.refusalCode, 'LANE_DENY')
  assert.equal(executions.find((record) => record.callId === 'dur-deny').outcome, 'admission-refusal')
})

test('SLICE-13 — NO REPLAY: after a restart the same callId is refused, not re-judged', async () => {
  const ledgerPath = join(dir, 'replay', 'facts.jsonl')
  const first = await buildWorld({ mountRealm: true, dir: join(dir, 'replay-w1'), admission: 'bound', durable: ledgerPath })
  try {
    const allowed = await first.dispatch('read', { file_path: first.insideFile }, 'replay-1')
    assert.equal(allowed.isError, false, `the first call must succeed: ${allowed.text}`)
  } finally {
    await first.dispose()
  }
  const second = await buildWorld({ mountRealm: true, dir: join(dir, 'replay-w2'), admission: 'bound', durable: ledgerPath })
  try {
    const member = second.realm.installation.members[0].fs
    const replay = await second.dispatch('read', { file_path: second.insideFile }, 'replay-1')
    assert.equal(replay.isError, true, `a replay must be refused: ${replay.text}`)
    assert.match(String(replay.errorMessage), /ADMISSION_REPLAY/u)
    assert.equal(member.calls.readText + member.calls.streamText, 0, 'the replay refusal must precede any execution')
    const records = second.ledger.readAll()
    const replays = records.filter((record) => record.kind === 'replay-refusal')
    assert.equal(replays.length, 1, 'the replay attempt must itself be durable')
    assert.equal(replays[0].callId, 'replay-1')
    assert.equal(records.filter((record) => record.kind === 'invocation-authority').length, 1, 'the first decision must NOT be overwritten by the replay')
  } finally {
    await second.dispose()
  }
})

test('SLICE-14 — the ledger refuses to read its own corruption rather than guessing', async () => {
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const base = join(dir, 'ledger-rules')
  mkdirSync(base, { recursive: true })

  // A crash mid-append leaves a partial line. Treating it as absent would silently drop an
  // admission record; treating it as valid would mis-parse. It is refused by name.
  const truncated = join(base, 'truncated.jsonl')
  writeFileSync(truncated, '{"kind":"invocation-authority","callId":"t-1","decision":"allow"}\n{"kind":"invoc')
  assert.throws(() => openFactLedger({ path: truncated }).readAll(), (error) => error.code === 'LEDGER_TRUNCATED')

  // Two authority records for one callId: the file cannot arbitrate, so it refuses to.
  const dup = join(base, 'dup.jsonl')
  writeFileSync(dup, [
    JSON.stringify({ kind: 'invocation-authority', callId: 'd-1', decision: 'allow' }),
    JSON.stringify({ kind: 'invocation-authority', callId: 'd-1', decision: 'deny' }),
    '',
  ].join('\n'))
  assert.throws(() => openFactLedger({ path: dup }).readAll(), (error) => error.code === 'LEDGER_DUPLICATE_AUTHORITY')

  // An execution record for a callId the ledger never admitted is not writable: the two halves of
  // the record must join, and a join with nothing on the other side is a defect, not a new fact.
  const ledger = openFactLedger({ path: join(base, 'join.jsonl') })
  assert.throws(() => ledger.recordExecution({ callId: 'never-admitted', outcome: 'completed' }), (error) => error.code === 'LEDGER_EXECUTION_UNBOUND')
  ledger.recordAdmission({ callId: 'ok-1', decision: 'allow' })
  ledger.recordExecution({ callId: 'ok-1', outcome: 'completed' })
  assert.throws(() => ledger.recordAdmission({ callId: 'ok-1', decision: 'allow' }), (error) => error.code === 'LEDGER_REPLAY')
})

test('SLICE-15 — ONE native registration per name: the model-visible catalogue has no duplicate', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'catalog'), admission: 'bound' })
  try {
    const schemas = world.schemas()
    const names = schemas.map((schema) => schema.name)
    assert.deepEqual([...new Set(names)], names, `the model-visible catalogue must not contain a name twice: ${JSON.stringify(names)}`)
    for (const name of ['read', 'write', 'edit']) {
      assert.equal(names.filter((entry) => entry === name).length, 1, `exactly one ${name} must be visible to the agent`)
      // The one visible definition must be the member's own mounted one, not the preset's: a name
      // present once while dispatch resolves the inherited body would be the old defect wearing a
      // single entry.
      assert.equal(world.definitionOf(name), world.resolvedDefinitions[name], `${name} must dispatch to the member-mounted definition`)
    }
  } finally {
    await world.dispose()
  }
})

test('SLICE-16 — an ASK is refused as ADMISSION_ASK_UNWIRED, never executed and never silently allowed', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'ask'), admission: 'bound', askPath: join(dir, 'ask', 'asked') })
  try {
    const member = world.realm.installation.members[0].fs
    const askedFile = join(dir, 'ask', 'asked', 'report.txt')
    mkdirSync(join(dir, 'ask', 'asked'), { recursive: true })
    writeFileSync(askedFile, 'asked\n')
    const result = await world.dispatch('read', { file_path: askedFile }, 'ask-1')
    assert.equal(result.isError, true, `an ask must not run until Control can adjudicate it: ${result.text}`)
    assert.match(String(result.errorMessage), /ADMISSION_ASK_UNWIRED/u)
    assert.equal(member.calls.readText + member.calls.streamText, 0, 'an unadjudicated ask must not reach the provider')
    const facts = world.facts()
    assert.equal(facts.length, 1)
    // The record says BOTH: `decision` is what the centre enforced (a deny - it refused the call), and
    // `laneDecision` is what the lane answered (an ask). Recording only the ask let a refused call be
    // durably reported as allowed; recording only the deny would lose who refused and why.
    assert.equal(facts[0].decision, 'deny', 'the enforced decision is a refusal')
    assert.equal(facts[0].laneDecision, 'ask', 'the lane answer is kept, so "who refused" stays answerable')
    assert.equal(facts[0].refusalCode, 'ADMISSION_ASK_UNWIRED')
    assert.match(String(facts[0].reason), /requires approval/u)
  } finally {
    await world.dispose()
  }
})

test('SLICE-17 — observation policy OFF: an overwrite needs no prior read (the product default)', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'obs-off') })
  try {
    const overwrite = await world.dispatch('write', { file_path: world.insideFile, content: 'rewritten without reading\n' }, 'obs-off-1')
    assert.equal(overwrite.isError, false, `with the policy absent an overwrite is unconditional: ${overwrite.text}`)
    assert.equal(readFileSync(world.insideFile, 'utf8'), 'rewritten without reading\n')
  } finally {
    await world.dispose()
  }
})

test('SLICE-18 — observation policy ON: the same overwrite is refused until the file was observed', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'obs-on'), observation: 'on' })
  try {
    const unobserved = await world.dispatch('write', { file_path: world.insideFile, content: 'blind overwrite\n' }, 'obs-on-1')
    assert.equal(unobserved.isError, true, `an unobserved overwrite must be refused: ${unobserved.text}`)
    assert.match(String(unobserved.errorMessage), /has not been read/u, 'the refusal must be the observation policy\'s own no-clobber rule, not an unrelated failure')
    assert.equal(readFileSync(world.insideFile, 'utf8'), 'alpha beta\n', 'a refused overwrite must not change the file')

    const observed = await world.dispatch('read', { file_path: world.insideFile }, 'obs-on-2')
    assert.equal(observed.isError, false, `the observation read must succeed: ${observed.text} ${String(observed.errorMessage)}`)
    const afterRead = await world.dispatch('write', { file_path: world.insideFile, content: 'observed overwrite\n' }, 'obs-on-3')
    assert.equal(afterRead.isError, false, `after the observation the same write must land: ${afterRead.text} ${String(afterRead.errorMessage)}`)
    assert.equal(readFileSync(world.insideFile, 'utf8'), 'observed overwrite\n')
  } finally {
    await world.dispose()
  }
})

test('SLICE-19 — observation policy ON: a version that moved under the member is refused, not clobbered', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'obs-stale'), observation: 'on' })
  try {
    const observed = await world.dispatch('read', { file_path: world.insideFile }, 'obs-stale-1')
    assert.equal(observed.isError, false, `the observation must succeed: ${observed.text} ${String(observed.errorMessage)}`)
    // The change the member cannot see: another writer between the read and the write.
    writeFileSync(world.insideFile, 'changed by someone else\n', 'utf8')
    const stale = await world.dispatch('write', { file_path: world.insideFile, content: 'member overwrite\n' }, 'obs-stale-2')
    assert.equal(stale.isError, true, `a stale version must be refused: ${stale.text}`)
    assert.match(String(stale.errorMessage), /changed since|not been read|version/iu, 'the refusal must be about freshness, not about the lane')
    assert.equal(readFileSync(world.insideFile, 'utf8'), 'changed by someone else\n', 'the other writer\'s bytes must survive')
  } finally {
    await world.dispose()
  }
})

test('SLICE-20 — an approved ask executes exactly once, and the approval is spent at the guard', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'ask-granted'), admission: 'ask-granted', askPath: join(dir, 'ask-granted', 'asked'), durable: join(dir, 'ask-granted', 'facts.jsonl') })
  try {
    mkdirSync(join(dir, 'ask-granted', 'asked'), { recursive: true })
    const askedFile = join(dir, 'ask-granted', 'asked', 'report.txt')
    writeFileSync(askedFile, 'approved content\n')
    const approved = await world.dispatch('read', { file_path: askedFile }, 'ask-approved-1')
    assert.equal(approved.isError, false, `an approved ask must execute: ${approved.text} ${String(approved.errorMessage)}`)
    assert.match(approved.text, /approved content/u, 'the body must have run and returned the file')
    const facts = world.facts()
    assert.equal(facts.length, 1)
    assert.equal(facts[0].decision, 'ask', 'the record keeps the ASK, not a rewritten allow: approval does not change what was asked')
    const executions = world.executions()
    assert.equal(executions.length, 1, 'exactly one execution for one approval')
    assert.equal(executions[0].outcome, 'completed')

    // The same callId cannot be bought twice: the replay is refused before the body.
    const replay = await world.dispatch('read', { file_path: askedFile }, 'ask-approved-1')
    assert.equal(replay.isError, true)
    assert.match(String(replay.errorMessage), /ADMISSION_REPLAY/u)
  } finally {
    await world.dispose()
  }
})

test('SLICE-21 — STOP before dispatch: an aborted call never reaches the body', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'stop-pre'), admission: 'bound' })
  try {
    const member = world.realm.installation.members[0].fs
    const controller = new AbortController()
    controller.abort()
    const aborted = await world.dispatch('read', { file_path: world.insideFile }, 'stop-1', { signal: controller.signal })
    assert.equal(aborted.isError, true, `an aborted call must not succeed: ${aborted.text}`)
    assert.equal(member.calls.stat + member.calls.readText + member.calls.streamText, 0, 'Stop must precede the body: the provider must not be touched')
    const executions = world.executions()
    assert.equal(executions.length, 1, 'the host settles the aborted call, so the fact exists - as an abort')
    assert.equal(executions[0].outcome, 'aborted', 'a Stop is not a failure of the tool')
  } finally {
    await world.dispose()
  }
})

test('SLICE-22 — STOP during approval: a cancelled ask ends the call and the grant is never spent', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'stop-ask'), admission: 'ask-granted', askPath: join(dir, 'stop-ask', 'asked'), approvalMode: 'cancelled' })
  try {
    mkdirSync(join(dir, 'stop-ask', 'asked'), { recursive: true })
    const askedFile = join(dir, 'stop-ask', 'asked', 'report.txt')
    writeFileSync(askedFile, 'never read\n')
    const member = world.realm.installation.members[0].fs
    const cancelled = await world.dispatch('read', { file_path: askedFile }, 'stop-ask-1')
    assert.equal(cancelled.isError, true, `a cancelled approval must not run the call: ${cancelled.text}`)
    assert.equal(member.calls.readText + member.calls.streamText, 0, 'the provider must not be reached')
    const executions = world.executions()
    assert.equal(executions.length, 1, 'the host settles the cancelled ask, so the fact exists')
    assert.equal(executions[0].outcome, 'approval-refused', 'the ask was refused at approval, which is neither a Stop nor a broken tool')
    const facts = world.facts()
    assert.equal(facts.length, 1, 'the ask itself is still recorded: it was asked, then stopped')
    assert.equal(facts[0].decision, 'ask')
  } finally {
    await world.dispose()
  }
})

test('SLICE-23 — lifecycle close: the centre stops deciding, and records nothing after close', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'lifecycle'), admission: 'bound', durable: join(dir, 'lifecycle', 'facts.jsonl') })
  let factsBefore
  let executionsBefore
  try {
    const one = await world.dispatch('read', { file_path: world.insideFile }, 'life-1')
    assert.equal(one.isError, false, `the pre-dispose read must succeed: ${one.text}`)
    factsBefore = world.facts().length
    executionsBefore = world.executions().length
  } finally {
    await world.dispose()
  }
  // MEASURED, AND NOT WHAT WE WANT: after dispose the member's native `read` STILL EXECUTES - the
  // mounted registration outlives the realm handle this world disposes. It is recorded as an open
  // defect (evidence section 13), not asserted as correct. What IS guaranteed today is that the
  // centre closed: no further decision and no further fact can be written for this member.
  // WHICH definition answers after close? If the mount was really removed, the agent falls back to
  // the PRESET definition - and the preset body is served by the UNCONFINED base provider. That is
  // worse than a leak: a retired member keeps reading outside its ceiling. Measured below.
  const afterDefinition = world.definitionOf('read')
  const afterOutside = await world.dispatch('read', { file_path: world.outsideFile }, 'life-3')
  // THE FIX, MEASURED. Close must not revert to the inherited definition (whose body the unconfined
  // composition provider serves); it must leave a refusing tombstone on the member's own layer.
  assert.notEqual(afterDefinition, world.presetRead, 'close must not revert to the preset definition')
  assert.equal(afterOutside.isError, true, 'after close a locator outside the ceiling must NOT be readable')
  assert.match(String(afterOutside.errorMessage), /MEMBER_CLOSED/u, 'the refusal must name the closed member')
  // The closed surface stays VISIBLE as closed: dropping the name would make the model's catalogue
  // silently change shape, and a name that simply vanishes is indistinguishable from a mount bug.
  assert.equal(world.schemas().some((schema) => schema.name === 'read'), true, 'the closed tool must still be declared, as closed')
  assert.equal(world.facts().length, factsBefore, 'no fact may be written after close')
  assert.equal(world.executions().length, executionsBefore, 'no execution fact may be written after close')
})

test('SLICE-24 — the execution fact carries the PRODUCT settlement id, deterministically', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'settle'), admission: 'bound' })
  try {
    const one = await world.dispatch('read', { file_path: world.insideFile }, 'settle-1')
    assert.equal(one.isError, false, `the read must succeed: ${one.text}`)
    const two = await world.dispatch('read', { file_path: world.insideFile }, 'settle-2')
    assert.equal(two.isError, false)
    const [first, second] = world.executions()
    assert.match(String(first.executionId), /^exec-[0-9a-f]{40}$/u, 'the id must be the product scheme, not an invented one')
    assert.notEqual(first.executionId, second.executionId, 'two different calls are two different executions')
    // Determinism is the property the settlement store depends on: recomputing from the same
    // provenance and callId must reproduce the exact id.
    assert.equal(first.executionId, dispatchExecutionId({ rootSessionId: 'session-vnext-slice', agentInstanceId: 'agent-vnext-slice' }, 'settle-1'))
  } finally {
    await world.dispose()
  }
})

test('SLICE-25 — crash recovery across a REAL process boundary: a child writes, this process reads', async () => {
  // The in-process "second world" arm proves re-reading; it does not prove the FILE is the authority.
  // Here a separate `node` process appends the records and exits, then THIS process (which never saw
  // that memory) answers for the calls.
  const ledgerPath = join(dir, 'crash', 'facts.jsonl')
  mkdirSync(dirname(ledgerPath), { recursive: true })
  const script = `
    const { openFactLedger } = await import(${JSON.stringify(pathToFileURL(join(REPO_ROOT, 'packages/runtime/src/plugin/vnext/fact-ledger.mjs')).href)})
    const ledger = openFactLedger({ path: ${JSON.stringify(ledgerPath)} })
    ledger.recordAdmission({ callId: 'crash-1', decision: 'allow', toolName: 'read' })
    ledger.recordExecution({ callId: 'crash-1', outcome: 'completed' })
    console.log('CHILD-WROTE')
  `
  const { execFileSync } = await import('node:child_process')
  const childOut = execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' })
  assert.match(childOut, /CHILD-WROTE/u)

  const reopened = openFactLedger({ path: ledgerPath })
  assert.equal(reopened.health().state, 'KNOWN')
  const observed = reopened.observe('crash-1')
  assert.equal(observed.state, 'KNOWN', 'the durable side must answer for a call written by another process')
  assert.equal(observed.admission.decision, 'allow')
  assert.equal(reopened.readAll().filter((record) => record.kind === 'execution').length, 1)
  // ...and the recovered process still cannot admit it a second time.
  assert.throws(() => reopened.recordAdmission({ callId: 'crash-1', decision: 'allow' }), (error) => error.code === 'LEDGER_REPLAY')
})

test('SLICE-26 — edit: inside the ceiling it rewrites through the member provider, and the file really changes', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'edit-inside'), admission: 'bound' })
  try {
    // The observation policy is OFF in this world (A1/B default), so an edit does not need a prior
    // read. That is the documented default, not an accident of this arm.
    const result = await world.dispatch('edit', { file_path: world.insideFile, old_string: 'alpha beta', new_string: 'alpha gamma' }, 'edit-1')
    assert.equal(result.isError, false, `an in-ceiling edit must succeed: ${result.text}`)
    assert.equal(readFileSync(world.insideFile, 'utf8').trim(), 'alpha gamma', 'the file on disk must carry the edit')
    const member = world.realm.installation.members[0].fs
    assert.equal(member.calls.writeText + member.calls.editText > 0, true, 'the edit must have gone through the member provider')
    const facts = world.facts()
    assert.equal(facts.length, 1)
    assert.equal(facts[0].axis, 'fs.write', 'edit is a WRITE tool: it must not be judged on the read lane')
    assert.equal(world.executions()[0].outcome, 'completed')
  } finally {
    await world.dispose()
  }
})

test('SLICE-27 — edit: outside the ceiling it is refused before the provider is reached', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'edit-outside'), admission: 'bound' })
  try {
    const target = join(world.outside, 'secret.txt')
    writeFileSync(target, 'do not touch\n')
    const result = await world.dispatch('edit', { file_path: target, old_string: 'do not', new_string: 'do' }, 'edit-out')
    assert.equal(result.isError, true, `an out-of-ceiling edit must fail: ${result.text}`)
    assert.equal(readFileSync(target, 'utf8').trim(), 'do not touch', 'the refused edit must not have changed the file')
    const member = world.realm.installation.members[0].fs
    assert.equal(member.calls.writeText + member.calls.editText, 0, 'the member provider must not have been asked to write')
  } finally {
    await world.dispose()
  }
})

test('SLICE-28 — rung 4: grep runs confined inside the ceiling and is refused outside it', async () => {
  // The realm owns a confined subprocess face (compiled profile + P1-07 provider), which is what
  // makes the search module admissible at all: without it the product refuses the composition
  // (measured in the previous round as SUBPROCESS_UNCONFINED_REALM). Now the family is mounted on
  // the MEMBER scope, so `grep` resolves the confined `subprocess`, never the inherited base one.
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'search'), admission: 'bound', search: true })
  try {
    assert.equal(world.mountRefusal, undefined, `the composition must mount now: ${world.mountRefusal?.message ?? ''}`)
    const inside = await world.dispatch('grep', { pattern: 'alpha', path: world.inside }, 'grep-in')
    assert.equal(inside.isError, false, `an in-ceiling grep must succeed: ${inside.text}`)
    assert.match(String(inside.text), /alpha/u, 'the match must come back from the real ripgrep run')
    const facts = world.facts()
    assert.equal(facts[0].axis, 'fs.read')
    // The negative control: the same tool and pattern, a locator outside the ceiling.
    const outside = await world.dispatch('grep', { pattern: 'alpha', path: world.outside }, 'grep-out')
    assert.equal(outside.isError, true, `an out-of-ceiling grep must fail: ${outside.text}`)
    // The refusal is the CENTRE's admission decision, not ripgrep failing: the call never reached a
    // process. That distinction is the whole point of rung 4 - the lane decides before the spawn.
    assert.match(String(outside.errorMessage), /outside the binding's fs\.read lane/u, 'the refusal must be the lane, not a ripgrep error')
    // The host settles the refused call too (it emits tools/result), and the fact keeps the
    // provenance: two facts, the second one an admission refusal - never a 'failed' that would read
    // like ripgrep broke.
    const executions = world.executions()
    assert.equal(executions.length, 2)
    assert.equal(executions[1].outcome, 'admission-refusal')
    assert.equal(executions[1].toolName, 'grep')
  } finally {
    await world.dispose()
  }
})

test('SLICE-29 — settlement at the host: one record per call, and a refusal is its own terminal state', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'settle-world'), admission: 'bound' })
  try {
    const ok = await world.dispatch('read', { file_path: world.insideFile }, 'settle-ok')
    assert.equal(ok.isError, false, `the read must succeed: ${ok.text}`)
    const refused = await world.dispatch('read', { file_path: join(world.outside, 'nope.txt') }, 'settle-deny')
    assert.equal(refused.isError, true, 'the outside read must be refused')

    const records = world.settlementStore.list()
    assert.equal(records.length, 2, 'one settlement record per execution, including the refused one')
    const byState = records.map((record) => `${record.identity.toolName}:${record.state}`).sort()
    assert.deepEqual(byState, ['read:COMPLETED', 'read:REFUSED'], 'the refused call must not read as completed or as RUNNING')
    // The refusal record names the code, so an operator can tell a lane denial from a broken tool.
    const refusedRecord = records.find((record) => record.state === 'REFUSED')
    assert.match(String(refusedRecord.terminalReason), /LANE_DENY/u)
    // ...and the completed record never claims an observed effect it does not have.
    const completed = records.find((record) => record.state === 'COMPLETED')
    assert.equal(completed.observation.effectEvidence, 'none-confirmed', 'no effect observer is wired, so no effect may be claimed')
  } finally {
    await world.dispose()
  }
})

test('SLICE-30 — a Stop before admission invents no settlement record, and is not silently lost', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'settle-stop'), admission: 'bound' })
  try {
    const controller = new AbortController()
    controller.abort()
    const aborted = await world.dispatch('read', { file_path: world.insideFile }, 'stop-settle-1', { signal: controller.signal })
    assert.equal(aborted.isError, true)
    // Aborted BEFORE the admission point, so no record was ever opened - and the centre must not
    // fabricate one: settling would invent an admission decision nobody made. The execution fact is
    // what carries the Stop, and that is what this arm asserts.
    assert.equal(world.settlementStore.list().length, 0, 'no settlement record may be invented for a call that never reached admission')
    assert.equal(world.executions()[0].outcome, 'aborted', 'the Stop is still recorded where it happened')
  } finally {
    await world.dispose()
  }
})

test('SLICE-31 — rung 5: web_fetch with the network axis ON reaches the composition transport', async () => {
  const { createServer } = await import('node:http')
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain' })
    response.end('NETWORK-BODY-OK')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'web-on'), admission: 'bound', web: true, webNetwork: 'allow', webTestEndpoints: [`http://127.0.0.1:${port}`] })
  try {
    assert.equal(world.mountRefusal, undefined, `the web face must mount: ${world.mountRefusal?.message ?? ''}`)
    const result = await world.dispatch('web_fetch', { url: `http://127.0.0.1:${port}/doc` }, 'web-on-1')
    assert.equal(result.isError, false, `an allowed fetch must succeed: ${result.text}`)
    assert.match(String(result.text), /NETWORK-BODY-OK/u, 'the body must come back through the member scope\'s confined web face')
    assert.equal(world.webFetchCalls(), 1, 'the transport must be called exactly once')
    const facts = world.facts()
    assert.equal(facts[0].axis, 'net.fetch')
  } finally {
    await world.dispose()
    await new Promise((resolve) => server.close(resolve))
  }
})

test('SLICE-32 — rung 5 NEGATIVE CONTROL: the same tool with the network axis DENIED never reaches the transport', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'web-off'), admission: 'bound', web: true, webNetwork: 'deny' })
  try {
    const result = await world.dispatch('web_fetch', { url: 'http://127.0.0.1:9/doc' }, 'web-off-1')
    assert.equal(result.isError, true, `a denied fetch must fail: ${result.text}`)
    assert.equal(world.webFetchCalls(), 0, 'the transport must not be called at all when the network axis denies')
    // The refusal names the network axis, not a connection error: port 9 would fail to connect, and
    // the arm must not be able to pass by that accident.
    assert.equal(/ECONNREFUSED|fetch failed/u.test(String(result.errorMessage)), false, `the refusal must be the lane, not a network accident: ${result.errorMessage}`)
  } finally {
    await world.dispose()
  }
})

test('SLICE-33 — rung 6: a PTY shell is refused to an owner the host does not recognise', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'bash-on'), admission: 'bound', bash: true })
  try {
    assert.equal(world.mountRefusal, undefined, `the governed PTY face must mount: ${world.mountRefusal?.message ?? ''}`)
    // The admission point admits it (the compiled execution authorization allows it and the PTY face
    // is a ready executor), and the PTY face then refuses the OWNER: the host PTY service only opens a
    // session for an agent the registry
    // holds (`agents.get(owner.id) === owner`). This world has no live host agent, so the fence does
    // its job - which is exactly the guarantee: a shell is never opened for an unregistered owner.
    const result = await world.dispatch('bash', { command: 'echo SHOULD-NOT-RUN' }, 'bash-1')
    assert.equal(result.isError, true, `the shell must be refused: ${result.text}`)
    assert.match(String(result.errorMessage), /OWNER_NOT_LIVE|not the registered PTY owner/u)
    assert.equal(String(result.text).includes('SHOULD-NOT-RUN\n') && !result.isError, false)
    assert.equal(world.webFetchCalls(), 0)
  } finally {
    await world.dispose()
  }
})

test('SLICE-34 — REVOCATION between the decision and the body: the recheck refuses, the body never runs', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'revoke'), admission: 'bound', revokeAfterDecision: true })
  try {
    const member = world.realm.installation.members[0].fs
    const revoked = await world.dispatch('read', { file_path: world.insideFile }, 'revoke-1')
    assert.equal(revoked.isError, true, 'a revoked authority must not execute')
    assert.match(String(revoked.errorMessage), /ADMISSION_RECHECK/u, `the refusal must name the recheck, not a tool failure: ${String(revoked.errorMessage)}`)
    assert.equal(member.calls.readText + member.calls.streamText + member.calls.stat, 0, 'the body must never be reached')
    // The decision that WAS made is still on record, because it was genuinely made.
    const facts = world.facts()
    assert.equal(facts.length, 1)
    assert.equal(facts[0].decision, 'allow', 'the record keeps the allow the centre actually decided; the recheck is a separate refusal')
    const executions = world.executions()
    assert.equal(executions.length, 1)
    assert.equal(executions[0].outcome, 'admission-refusal', `a recheck refusal is an admission refusal, not a broken tool: ${JSON.stringify(executions[0])}`)
    assert.match(String(executions[0].refusalCode), /^ADMISSION_RECHECK_/u, 'the fact keeps the code the guard used')
  } finally {
    await world.dispose()
  }
})

test('SLICE-4 — NEGATIVE CONTROL: without the realm mount the same outside read SUCCEEDS', async () => {
  const world = await buildWorld({ mountRealm: false, dir: join(dir, 'control') })
  try {
    assert.equal(world.resolvedRead, world.presetRead, 'with no mount the member resolves the preset definition')
    const result = await world.dispatch('read', { file_path: world.outsideFile }, 'control-outside')
    assert.equal(result.isError, false, `the control must be able to read what SLICE-3 refuses, or SLICE-3 proves nothing: ${result.text}`)
    assert.match(result.text, /SECRET-NOT-FOR-MEMBER/u)
  } finally {
    await world.dispose()
  }
})

test('SLICE-35 — the confined provider covers EVERY base entry point that touches a path', async () => {
  // WHY THIS ARM EXISTS. On the pinned baseline the confined provider overrode ten methods, and that
  // was the whole interface. On 0.2.2-rc.5 the base FileSystem grows patchText/deleteFile/moveFile -
  // and nothing in this repo would have noticed: the class still compiles (against rc.2), the slice
  // still passes (it never calls them), and apply_patch/delete/move would reach the real backend with
  // the Member's lane never consulted.
  //
  // So instead of listing today's ten methods, this arm DERIVES the required set from the base class
  // and refuses any base entry point nobody confined. When the baseline moves, this goes red on its
  // own - no rc.5 knowledge baked in, no allowlist to rot.
  const { createConfinedFileSystemClass } = await import('../team-services/src/fs.ts')
  // The same seam loader the rest of this suite uses: the provider under test is the PINNED baseline's
  // fs-local, resolved from the host tree, never a copy the test happens to find.
  const { LocalFileSystem } = await loadFsContractSeams(REPO_ROOT, HOST_MODE)
  // NOT IO ENTRY POINTS, and why: path algebra and locking (resolve / processPath /
  // processPathFromHostPath / fileUrl / contains) compute names without touching the filesystem, and
  // the confined callers always pass their result through an admitted method; withLock is the
  // serialization primitive those admitted methods call; versionAfterWrite derives the version of a
  // write that already passed the guard; sandboxMode reads the per-call policy that IS the guard's
  // input. Everything else on the base is an effect on a path and must be confined.
  const NOT_IO = new Set([
    'constructor', 'withLock', 'resolve', 'processPath', 'processPathFromHostPath',
    'fileUrl', 'contains', 'versionAfterWrite', 'sandboxMode',
  ])
  // The WHOLE chain, starting at the concrete class: on the pinned baseline the effects are declared on
  // LocalFileSystem itself and the abstract FileSystem above it carries only watch/sandboxMode/
  // processPathFromHostPath. Walking from the concrete prototype is what keeps this arm honest when a
  // newer host moves a method up or down the hierarchy.
  const baseNames = new Set()
  for (let proto = LocalFileSystem.prototype; proto && proto !== Object.prototype && proto !== Function.prototype; proto = Object.getPrototypeOf(proto)) {
    if (proto.constructor?.name === 'Service') break
    for (const name of Object.getOwnPropertyNames(proto)) baseNames.add(name)
  }
  // rc.5 ALSO declares four TS-`private` helpers of its concrete provider
  // (`patchContent`, `requireFile`, `withLocks`, `writeTarget`). They are NOT
  // entry points: nothing outside the provider can name them (TS `private` is
  // not runtime-private, which is why this derivation sees them), and each is
  // reached ONLY from a public mutation this class confines. The rc.5
  // migration deferred the decision to exclude them; B5 makes it, and makes it
  // WITNESSED instead of an allowlist that rots: every excluded name that the
  // base declares must be called from a base method that is itself in the
  // guarded set. If a future host calls a helper from a method the class does
  // not override, that method is still derived (and red), and if the guarded
  // caller disappears the witness below goes red.
  const INTERNAL_HELPERS = new Set(['withLocks', 'writeTarget', 'requireFile', 'patchContent'])
  const ioEntryPoints = [...baseNames].filter((name) => !NOT_IO.has(name) && !INTERNAL_HELPERS.has(name))
  const Confined = createConfinedFileSystemClass(LocalFileSystem, async () => {})
  const confined = new Set(Object.getOwnPropertyNames(Confined.prototype))
  for (const helper of INTERNAL_HELPERS) {
    if (!baseNames.has(helper)) continue
    const witnesses = [...confined].filter((name) => name !== helper && typeof LocalFileSystem.prototype[name] === 'function'
      && String(LocalFileSystem.prototype[name]).includes(`this.${helper}(`))
    assert.ok(
      witnesses.length > 0,
      `the excluded helper '${helper}' is declared by the base provider but no method the Team class overrides calls it; `
      + 'the exclusion is no longer justified (a path-touching entry point is being ignored)',
    )
  }
  const unconfined = ioEntryPoints.filter((name) => !confined.has(name)).sort()
  assert.deepEqual(
    unconfined,
    [],
    `the base provider has path-touching entry points the Team confined class does not override: ${unconfined.join(', ')}`
    + ' — on a newer host those calls reach the real backend with the Member lane never consulted.'
    + ' Add the override (guard the target(s), then delegate) before upgrading the baseline.',
  )
  // Falsifiability: the derived set is not empty and names the methods the slice actually exercises,
  // so a refactor that accidentally stops deriving anything cannot pass.
  assert.ok(ioEntryPoints.length >= 10, `expected at least the ten known entry points, derived ${ioEntryPoints.length}`)
  for (const name of ['readText', 'writeText', 'editText', 'stat', 'listDir']) {
    assert.ok(ioEntryPoints.includes(name), `${name} must be recognised as an IO entry point`)
  }
  // B5: on a host that declares the rc.5 additions they are IO entry points AND
  // this class confines them. Host-relative on purpose: on rc.2 the base has none
  // of the three, so requiring them there would be an rc.5 fact baked into the
  // legacy lane. Excluding them from the derivation (the mistake this arm exists
  // to catch) fails HERE even if it somehow passed the unconfined comparison.
  for (const name of ['patchText', 'deleteFile', 'moveFile']) {
    if (typeof LocalFileSystem.prototype[name] !== 'function') continue
    assert.ok(ioEntryPoints.includes(name), `${name} must be derived as an IO entry point on a host that declares it`)
    assert.ok(confined.has(name), `${name} must be confined by the Team class (B5)`)
  }
})

test('SLICE-36 — the coverage invariant actually detects an unconfined entry point', async () => {
  // The arm above is only worth having if it can FAIL. This is its positive control: take the real
  // provider, add a path-touching method the confined class does not override - exactly what a newer
  // host does - and require the same derivation to name it. Without this, a refactor that made
  // SLICE-35 vacuously green (empty derivation) would look like success.
  const { createConfinedFileSystemClass } = await import('../team-services/src/fs.ts')
  const { LocalFileSystem } = await loadFsContractSeams(REPO_ROOT, HOST_MODE)
  const NOT_IO = new Set([
    'constructor', 'withLock', 'resolve', 'processPath', 'processPathFromHostPath',
    'fileUrl', 'contains', 'versionAfterWrite', 'sandboxMode',
  ])
  // The same witnessed exclusion SLICE-35 applies (rc.5's TS-`private` helpers of
  // the concrete provider). Duplicated deliberately: this control must derive with
  // the SAME rule the arm under test uses, or it would grade a different algorithm.
  const INTERNAL_HELPERS = new Set(['withLocks', 'writeTarget', 'requireFile', 'patchContent'])
  const derive = (Base) => {
    const names = new Set()
    for (let proto = Base.prototype; proto && proto !== Object.prototype && proto !== Function.prototype; proto = Object.getPrototypeOf(proto)) {
      if (proto.constructor?.name === 'Service') break
      for (const name of Object.getOwnPropertyNames(proto)) names.add(name)
    }
    return [...names].filter((name) => !NOT_IO.has(name) && !INTERNAL_HELPERS.has(name))
  }
  class FutureProvider extends LocalFileSystem {
    // Three entry points the PRODUCT does not cover, i.e. what a future host
    // addition looks like from here. They used to be patchText/deleteFile/
    // moveFile — the point of B5 is that those three are now confined, so reusing
    // their names would measure the product's coverage instead of this
    // derivation (the control would go red for the wrong reason, and the only way
    // to make it green would be to stop covering them). The names are otherwise
    // arbitrary: the arm measures the DERIVATION, never these bodies.
    async copyFile() { throw new Error('never called: this arm measures the DERIVATION, not the effect') }
    async truncateFile() { throw new Error('never called') }
    async renamePath() { throw new Error('never called') }
  }
  const ConfinedFuture = createConfinedFileSystemClass(FutureProvider, async () => {})
  const confined = new Set(Object.getOwnPropertyNames(ConfinedFuture.prototype))
  const unconfined = derive(FutureProvider).filter((name) => !confined.has(name))
  // HOST-RELATIVE EXPECTATION, still exact. The fixture ADDS three names to whatever the selected
  // host already declares, so the expected set is "the selected base's own un-overridden entry
  // points PLUS those three". Deriving it (instead of hard-coding three) is what lets this control
  // run on both hosts without baking one generation's extra names in: on rc.5 the base carries four
  // MORE path-touching names than rc.2 (handled by the same witnessed INTERNAL_HELPERS exclusion
  // SLICE-35 applies), and a hard-coded expectation would fail here for the right reason but with
  // the wrong message. What must NOT be done is allowlisting rc.5's names on the `unconfined` side:
  // that would turn the control into a no-op. B5 note: the fixture's three names are deliberately
  // NOT the rc.5 additions, because those are now covered by the product — see the fixture comment.
  const ConfinedBase = createConfinedFileSystemClass(LocalFileSystem, async () => {})
  const confinedBase = new Set(Object.getOwnPropertyNames(ConfinedBase.prototype))
  const fixtureAdditions = ['copyFile', 'renamePath', 'truncateFile']
  const expected = [...new Set([
    ...derive(LocalFileSystem).filter((name) => !confinedBase.has(name)),
    ...fixtureAdditions,
  ])].sort()
  assert.deepEqual(
    unconfined.sort(),
    expected,
    'the derivation must name exactly the un-overridden path-touching methods: the selected base\'s own + the three the fixture adds',
  )
  // ADDITIVE (B5), not a replacement: on a host that declares the rc.5 additions
  // the PRODUCT covers all three, so a derivation that stopped seeing them would
  // pass the comparison above by losing them from `derive` — this pins them.
  for (const name of ['patchText', 'deleteFile', 'moveFile']) {
    if (typeof LocalFileSystem.prototype[name] !== 'function') continue
    assert.ok(confinedBase.has(name), `${name} must be covered by the product class on a host that declares it`)
    assert.ok(derive(LocalFileSystem).includes(name), `${name} must still be DERIVED as an IO entry point`)
  }
})
