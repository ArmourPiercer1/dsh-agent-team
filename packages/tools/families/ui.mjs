/**
 * FamilyAssembly descriptor — the UI family (ask_user_question + present,
 * ONE candidate) (u7-f).
 *
 * The plane drives this descriptor through the generic seam and names
 * none of it: ZERO lines in the center were touched to mount a family
 * that talks to a HUMAN. The two rows carry their FIXED native spellings
 * (the fs-mutation/jobs precedent — never the renamable `names` map; the
 * seam-owned placement path never consults the names-map ledger), the
 * same-name same-meaning claim rides this reviewed module: each row
 * mirrors the pinned host tool's description, parameter fields and render
 * (tool-ask-user index.ts/timed.ts and tool-present index.ts @639ed01539),
 * with the deviations disclosed on the PR body (closed-world parameter
 * schema; the present row's optional `turn`).
 *
 * MOUNT LAW (zero-flip): the family mounts ONLY under the closed boolean
 * plane config `uiFamilyEnabled` (the jobsEnabled precedent: absent = the
 * family does not exist and the native tools ride UNTOUCHED — every
 * existing world keeps its byte-equal mount shape). `disabledOwned` is
 * EMPTY: a mount without the key claims nothing.
 *
 * VARIANT LAW (the host `mode` mirror): the host registers the timed
 * `ask_user_question` ONLY under config `mode: 'timed'` — one shape per
 * mount, never both. The seam mirror is the closed boolean
 * `uiTimedQuestions` (absent = legacy, the host default); a non-boolean
 * value on either key is the seam's own PLANE_CONFIG_INCOMPLETE refusal
 * before this file runs. The per-call `timeout` law (the -1 keyed-indefinite
 * arm, the 1..2147483 bound, the host default 120, and the pending outcome
 * that is NEVER a fabricated answer) lives in the lane's ui-mechanics —
 * the row schema and the parser law read it from the ONE home.
 *
 * THE INTERACTION PORT IS INJECTED, NEVER OWNED: the trusted mount may
 * supply the whole port through the kit `backends` seam
 * (`input.backends.uiInteraction` — the C1 fake rides this); otherwise the
 * family adapts the host's OWN public `userQuestions` service (ask +
 * askTimed faces; the host has no ctx-facing deliverable-publish service,
 * so through the adapter the present face stays absent and the present row
 * fails closed). No port face = typed refusal, zero effect — the image
 * row's attachment-store law, applied to the human.
 *
 * @module tools/families/ui
 */
import {
  ASK_USER_QUESTION_NATIVE_NAME,
  PRESENT_NATIVE_NAME,
  buildAskRowDefinition,
  buildPresentRowDefinition,
  buildUiFamilyContribution,
  createGovernedAskExecutor,
  createGovernedPresentExecutor,
  createUserQuestionsPort,
} from '../ui-family/src/index.mjs'
import * as uiMechanics from '../ui-family/src/ui-mechanics.mjs'
import * as uiPort from '../ui-family/src/ui-interaction-port.mjs'

export const familyAssembly = Object.freeze({
  schema: 'u7-family-assembly/1',
  familyId: 'dsh.ui-family',
  order: 40,
  placement: 40,
  config: Object.freeze({
    uiFamilyEnabled: 'boolean',
    uiTimedQuestions: 'boolean',
  }),
  // Trusted-mount opt-in (the jobsEnabled law: absent = FALSE = zero flip).
  enabled: (cap) => cap.planeConfig.uiFamilyEnabled === true,
  claims: () => [ASK_USER_QUESTION_NATIVE_NAME, PRESENT_NATIVE_NAME],
  // OFF means OFF: with the key absent the family claims NOTHING and the
  // native host tools ride untouched (byte-equal status quo).
  disabledOwned: () => [],
  build(cap) {
    const { realmId, permissionPolicy, decide, pa, logBackend, fsInstance } = cap
    const timed = cap.planeConfig.uiTimedQuestions === true
    const rootDir = fsInstance !== null && typeof fsInstance?.rootDir === 'string' ? fsInstance.rootDir : null
    // The port resolution is LAZY per call (the image row's host-seam law):
    // an injected port wins; else the host's public userQuestions service
    // behind the family adapter; else null = fail closed at the row gate.
    // The ask row passes its per-call carrier Agent (the dispatch-provided
    // `exec.agent`, O2-A S1) into the adapter's EXISTING second-arg binding,
    // resolved lazily for THIS call only — never captured at mount. A call
    // without a carrier leaves the binding off exactly as before: the service
    // then answers its own typed refusal, which the row surfaces verbatim
    // (ui-interaction-port.mjs:73-79). An injected port owns its own binding.
    const injected = cap.injected?.uiInteraction ?? null
    const portRef = (agent) => {
      if (injected !== null && typeof injected === 'object') return injected
      const service = typeof cap.hostService === 'function' ? cap.hostService('userQuestions') : undefined
      return createUserQuestionsPort(service, { agent: () => agent })
    }
    const subtree = typeof cap.subtreeContains === 'function' ? { subtreeContains: cap.subtreeContains } : {}
    const askExecutor = createGovernedAskExecutor({
      realmId,
      policy: permissionPolicy,
      decide,
      pa,
      portRef,
      timed,
      observe: logBackend('u7f-ask'),
    })
    const presentExecutor = createGovernedPresentExecutor({
      realmId,
      rootDir,
      policy: permissionPolicy,
      decide,
      pa,
      portRef,
      ...subtree,
      observe: logBackend('u7f-present'),
    })
    const askRowDef = buildAskRowDefinition({ askExecutor, timed })
    const presentRowDef = buildPresentRowDefinition({ presentExecutor })
    // ONE candidate carries both rows (Registry law: one live candidate per
    // familyId); a partial UI family is a broken assembly the lane refuses
    // fail-closed inside the contribution builder.
    const contribution = buildUiFamilyContribution({
      ask: { definition: askRowDef, executorFactory: createGovernedAskExecutor },
      present: { definition: presentRowDef, executorFactory: createGovernedPresentExecutor },
      mechanics: uiMechanics,
      port: uiPort,
      cancelBoundary: 'the governed UI bodies touch the human ONLY after the Kernel edge consumed the call and pass the injected signal INTO the port request (ask: the port owns the suspended wait and its abort; present: the signal gates the probe loop and the publish); an arm that ends before the port was called honestly claims zero effect, one after is reported with sideEffectPossible',
    })
    return {
      definitions: [askRowDef, presentRowDef],
      contribution,
      diagnostics: { ask_user_question: askExecutor, present: presentExecutor },
    }
  },
  refusalCode: 'PLANE_UI_REGISTRATION_REFUSED',
})
