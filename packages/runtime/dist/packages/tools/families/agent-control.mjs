/**
 * FamilyAssembly descriptor — the AGENT-CONTROL family (U7-F).
 *
 * The seven governed agent-control rows — `subagent`, `subagent_fork`,
 * `send_message`, `interrupt_agent`, `list_agents`, `list_subagent_models`,
 * `workflow` — mount TOGETHER through the generic seam
 * (`packages/runtime/src/plugin/live/family-assembly.mjs`); the plane names
 * none of it (u7-w0b law, the fs/process/search precedent).
 *
 * THE MOUNT GATE is the closed boolean `teamToolPlane.agentControlEnabled`
 * (the jobs `jobsEnabled` law): ABSENT means this family mounts NOTHING —
 * zero flip, and the host's native agent-control tools ride untouched. A
 * non-boolean value is refused by the seam's own config check before any
 * family runs.
 *
 * THE AUTHORITY FORCES all arrive through the seam's capability object: the
 * lane `decide`, the one-shot PA edge, the template `permissionPolicy`, the
 * public `hostService` face the production port resolver rides, and the
 * kit/test `injected` seam (`agentRuntime` fake, `agentScope` roster,
 * `callerAuthority` snapshot, `forkContextProvider` context DATA source).
 * The trusted trust-data inputs FAIL CLOSED: without a caller-authority
 * snapshot no spawn runs, without a scope roster no steer/interrupt runs —
 * a mount that cannot prove the bound is a mount that never reaches.
 *
 * @module tools/families/agent-control
 */
import {
  AGENT_CONTROL_NAMES,
  buildSpawnRowDefinition,
  buildForkRowDefinition,
  buildSteerRowDefinition,
  buildInterruptRowDefinition,
  buildListAgentsRowDefinition,
  buildListModelsRowDefinition,
  buildWorkflowRowDefinition,
  createAgentControlExecutors,
  createHostAgentRuntimePort,
  normalizePort,
  buildAgentControlContribution,
} from '../agent-control-family/src/index.mjs'
import * as agentControlMechanics from '../agent-control-family/src/agent-control-mechanics.mjs'
import * as agentControlPort from '../agent-control-family/src/agent-runtime-port.mjs'
import * as agentControlExecutorLaw from '../agent-control-family/src/agent-control-executor.mjs'

// U7-F (CA-01): the seven rows mount at FIXED native spellings (the jobs/fs
// precedent — never the configurable names map, no Gate 0b surface). The
// takeover law's same-name same-meaning implementations are ASSEMBLED: the
// governed executor bodies over the injected agent-runtime port (public
// host faces @ 639ed01539 evidence: agentTeams.listMembers/sendMessage/
// interrupt, llm.listProviders/listModels; every other leg refuses typed,
// the C2 run records verbatim what a real mount answers).
const AGENT_CONTROL_NATIVE_NAMES = AGENT_CONTROL_NAMES

export const familyAssembly = Object.freeze({
  schema: 'u7-family-assembly/1',
  familyId: 'dsh.agent-control-family',
  order: 40,
  placement: 40,
  config: Object.freeze({ agentControlEnabled: 'boolean' }),
  // The jobs `jobsEnabled` law: absent/false ⇒ the family mounts NOTHING
  // (zero rows, zero flip; the native agent-control tools ride).
  enabled: (cap) => cap.planeConfig.agentControlEnabled === true,
  claims: () => [...AGENT_CONTROL_NATIVE_NAMES],
  disabledOwned: () => [],
  build(cap) {
    const observe = cap.logBackend('u7f-agent-control')
    // The port: the kit/test fake WINS over the host resolver (the search
    // lane's `injected.search ?? realSearch` law); production resolves
    // LAZILY through the mount's public hostService face, and every leg a
    // real host does not answer stays a typed refusal, never a fake.
    const port = normalizePort(cap.injected?.agentRuntime
      ?? createHostAgentRuntimePort({
        hostService: (name) => cap.hostService(name),
        caller: { realmId: cap.realmId, templateId: cap.templateId, instanceId: cap.instanceId },
        observe,
      }))
    // Trusted ASSEMBLY trust data (fail-closed when absent — the mechanics
    // file states why absence is a refusal, not an inherit).
    const scopeFence = cap.injected?.agentScope ?? null
    const callerAuthority = cap.injected?.callerAuthority ?? null
    const forkContextProvider = typeof cap.injected?.forkContextProvider === 'function'
      ? cap.injected.forkContextProvider
      : undefined
    const mountScope = {
      scopeKey: typeof scopeFence?.scopeKey === 'string'
        ? scopeFence.scopeKey
        : `${cap.realmId}:${cap.instanceId}`,
    }
    const executors = createAgentControlExecutors({
      realmId: cap.realmId,
      templateId: cap.templateId,
      instanceId: cap.instanceId,
      mountScope,
      permissionPolicy: cap.permissionPolicy,
      decide: cap.decide,
      pa: cap.pa,
      port,
      scopeFence,
      callerAuthority,
      ...(forkContextProvider === undefined ? {} : { forkContextProvider }),
      observe,
    })
    const definitions = [
      buildSpawnRowDefinition({ name: 'subagent', spawnExecutor: executors.subagent }),
      buildForkRowDefinition({ name: 'subagent_fork', forkExecutor: executors.subagent_fork }),
      buildSteerRowDefinition({ name: 'send_message', steerExecutor: executors.send_message }),
      buildInterruptRowDefinition({ name: 'interrupt_agent', interruptExecutor: executors.interrupt_agent }),
      buildListAgentsRowDefinition({ name: 'list_agents', listAgentsExecutor: executors.list_agents }),
      buildListModelsRowDefinition({ name: 'list_subagent_models', listModelsExecutor: executors.list_subagent_models }),
      buildWorkflowRowDefinition({ name: 'workflow', workflowExecutor: executors.workflow }),
    ]
    const contribution = buildAgentControlContribution({
      spawnDefinition: definitions[0],
      forkDefinition: definitions[1],
      steerDefinition: definitions[2],
      interruptDefinition: definitions[3],
      listAgentsDefinition: definitions[4],
      listModelsDefinition: definitions[5],
      workflowDefinition: definitions[6],
      executors,
      mechanics: agentControlMechanics,
      portModule: agentControlPort,
      executorModule: agentControlExecutorLaw,
      cancelBoundary: 'the governed rows carry the host exec.signal into the runtime port legs (the same channel the native callingAgent tools use); a cancelled call settles through the runtime leg it started, the family never settles a run it did not start, and the one-shot exec-token ledger records the settled correlation so a replayed token never re-reaches the port',
    })
    return {
      definitions: definitions.map((def) => Object.freeze({ ...def, output: cap.presentationFace })),
      contribution,
      diagnostics: {
        subagent: executors.subagent,
        subagent_fork: executors.subagent_fork,
        send_message: executors.send_message,
        interrupt_agent: executors.interrupt_agent,
        list_agents: executors.list_agents,
        list_subagent_models: executors.list_subagent_models,
        workflow: executors.workflow,
      },
    }
  },
  refusalCode: 'PLANE_AGENT_CONTROL_REGISTRATION_REFUSED',
})
