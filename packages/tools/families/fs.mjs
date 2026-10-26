/**
 * FamilyAssembly descriptor — the FS family (read + write + edit +
 * read_image, ONE candidate).
 *
 * Moved VERBATIM out of `team-tool-plane.mjs` (u7-w0b S3): the four governed
 * executors over the ONE controlled-fs instance root, the image row's two
 * host seams (attachment store + model-route capability, resolved lazily
 * through the mount's agent ctx), the four row Definitions, the
 * all-four-together completeness refusal, the ONE family contribution, the
 * governed-read PA hand-off face and its teardown. The plane drives this
 * descriptor through the generic seam (`runtime/src/plugin/live/
 * family-assembly.mjs`) and names none of it.
 *
 * @module tools/families/fs
 */
import {
  buildReadRowDefinition,
  createGovernedReadExecutor,
  buildWriteRowDefinition,
  buildEditRowDefinition,
  buildImageRowDefinition,
  createGovernedWriteExecutor,
  createGovernedEditExecutor,
  createGovernedReadImageExecutor,
  createBoundedImageReadPort,
  buildFsFamilyContribution,
} from '../fs-family/src/index.mjs'
import * as fsFamilyReadMechanics from '../fs-family/src/fs-mechanics.mjs'
import * as fsFamilyReadPresentation from '../fs-family/src/read-presentation.mjs'
import * as fsFamilyMutationMechanics from '../fs-family/src/fs-mutation-mechanics.mjs'

// U7-9a: the fs mutation + image rows mount at FIXED native spellings (the
// jobs precedent — never the configurable names map); the takeover law's
// same-name same-meaning claim is recorded in the plane's
// PLANE_SUPPORTED_NATIVE_TAKEOVERS ledger.
const WRITE_NATIVE_NAME = 'write'
const EDIT_NATIVE_NAME = 'edit'
const READ_IMAGE_NATIVE_NAME = 'read_image'

const hasRoot = (cap) => cap.fsInstance !== null && typeof cap.fsInstance.rootDir === 'string'

export const familyAssembly = Object.freeze({
  schema: 'u7-family-assembly/1',
  familyId: 'dsh.fs-family',
  order: 10,
  placement: 30,
  config: Object.freeze({}),
  // The four rows mount TOGETHER under ONE governed root; no fsInstance =
  // none of them.
  enabled: (cap) => hasRoot(cap),
  claims: (cap) => [cap.readName, WRITE_NATIVE_NAME, EDIT_NATIVE_NAME, READ_IMAGE_NATIVE_NAME],
  // REVIEW-R1 B2 (CI-05): a governed mount WITHOUT the read row keeps
  // ownership of `read` with a table that answers NULL forever, so the door
  // refuses every read before its Body instead of letting the native
  // definition ride.
  disabledOwned: (cap) => [cap.readName],
  build(cap) {
    const { realmId, fsInstance, permissionPolicy, decide, pa, logBackend, readName } = cap
    const subtree = cap.subtreeContains === undefined ? {} : { subtreeContains: cap.subtreeContains }
    // GLUE-7 fs-class row: the governed `read` over the SAME controlled-fs
    // instance root (no second fs algebra). Deny-lane and
    // template-default-deny re-check BEFORE any byte is read.
    const readExecutor = createGovernedReadExecutor({
      realmId,
      rootDir: fsInstance.rootDir,
      policy: permissionPolicy,
      decide,
      pa,
      ...subtree,
      observe: logBackend('a5g7-read'),
    })
    const readRowDef = buildReadRowDefinition({ readName, readExecutor })
    // The image row's two host seams: resolved LAZILY through the mount's
    // agent ctx at call time — absent seam = the native-shaped refusal,
    // never a bypass, never a fake.
    const attachmentsProvider = () => cap.hostService('attachments')
    // The capability route gate: the native law (read-image.ts:121-131
    // @639ed01539) — the llm service answers the model's declared input
    // modalities; a model without 'image' refuses with the native sentence.
    const imageRouteResolver = async ({ filePath, provider, model, signal }) => {
      const llm = cap.hostService('llm')
      if (typeof provider !== 'string' || typeof model !== 'string'
        || llm === undefined || typeof llm.resolveModelInfo !== 'function') {
        return { ok: false, refusal: { code: 'IMAGE_ROUTE_UNRESOLVED', text: `cannot read "${filePath}" as an image: the current model route could not be resolved` } }
      }
      let active
      try {
        active = await llm.resolveModelInfo(provider, model, signal)
      } catch (error) {
        return { ok: false, refusal: { code: 'IMAGE_ROUTE_UNRESOLVED', text: `cannot read "${filePath}" as an image: the current model route could not be resolved (${String(error?.message ?? error).slice(0, 120)})` } }
      }
      const modalities = Array.isArray(active?.inputModalities) ? active.inputModalities : []
      if (!modalities.includes('image')) {
        return { ok: false, refusal: { code: 'IMAGE_MODEL_NOT_CAPABLE', text: `cannot read "${filePath}" as an image: model "${model}" does not declare image input; switch to an image-capable model to read images` } }
      }
      return { ok: true }
    }
    const writeExecutor = createGovernedWriteExecutor({
      realmId,
      rootDir: fsInstance.rootDir,
      policy: permissionPolicy,
      decide,
      pa,
      ...subtree,
      observe: logBackend('a5g7-write'),
    })
    const editExecutor = createGovernedEditExecutor({
      realmId,
      rootDir: fsInstance.rootDir,
      policy: permissionPolicy,
      decide,
      pa,
      ...subtree,
      observe: logBackend('a5g7-edit'),
    })
    const imageReadPort = createBoundedImageReadPort({ rootDir: fsInstance.rootDir, observe: logBackend('a5g7-image-port') })
    const imageExecutor = createGovernedReadImageExecutor({
      realmId,
      rootDir: fsInstance.rootDir,
      policy: permissionPolicy,
      decide,
      pa,
      ...subtree,
      attachmentsProvider,
      imageRoute: imageRouteResolver,
      readBytes: imageReadPort,
      observe: logBackend('a5g7-image'),
    })
    const writeRowDef = buildWriteRowDefinition({ writeName: WRITE_NATIVE_NAME, writeExecutor })
    const editRowDef = buildEditRowDefinition({ editName: EDIT_NATIVE_NAME, editExecutor })
    const imageRowDef = buildImageRowDefinition({ readImageName: READ_IMAGE_NATIVE_NAME, imageExecutor, imageRouteResolver })
    // The four fs rows mount TOGETHER: a partial fs family is a broken
    // assembly (the family contribution requires all four), refused
    // fail-closed — the retired ungoverned native rows do not come back.
    if (writeRowDef === null || editRowDef === null || imageRowDef === null) {
      return { refused: { code: 'PLANE_FS_FAMILY_INCOMPLETE', message: 'the fs family mounts read+write+edit+read_image together; a partial fs lane is a broken assembly (fail closed)' } }
    }
    // U7-9a (CA-01): ONE fs-family candidate carries ALL FOUR rows — the
    // Registry law is one live candidate per family (DUP_FAMILY_ID).
    const contribution = buildFsFamilyContribution({
      read: { definition: readRowDef, executorFactory: createGovernedReadExecutor },
      write: { definition: writeRowDef, executorFactory: createGovernedWriteExecutor },
      edit: { definition: editRowDef, executorFactory: createGovernedEditExecutor },
      readImage: { definition: imageRowDef, executorFactory: createGovernedReadImageExecutor, readPortFactory: createBoundedImageReadPort },
      mechanics: fsFamilyReadMechanics,
      mutationMechanics: fsFamilyMutationMechanics,
      presentation: fsFamilyReadPresentation,
      cancelBoundary: 'the governed fs bodies check the injected signal at every await edge (read: before/after the verified-handle open; write/create: before truncate and before EVERY chunk, with mid-write cancellation reported as write-side-effect-unconfirmed; edit: before truncate; read_image: before the attachment commit, which is the one post-read step that may honestly claim zero side effect); the dispatcher-side arm + tools/change watcher lands ABORTED_BEFORE_DISPATCH before any body runs (install.ts seams, U6 PR2)',
    })
    return {
      definitions: [readRowDef, writeRowDef, editRowDef, imageRowDef],
      contribution,
      // U7-9a: the fs bodies (diagnostics only).
      diagnostics: { read: readExecutor, write: writeExecutor, edit: editExecutor, read_image: imageExecutor },
      // A5-M2: the governed-read hand-off face for THIS mount. The plane
      // stores nothing here: the row holds the token-keyed flight and the
      // correlation law, and the adapter's `tools/result` observer drives
      // open/close. A mount with NO governed read row does not declare the
      // field at all (presence is the capability signal).
      handoff: Object.freeze({
        name: readName,
        open: (args, opts) => readExecutor.paHandoffOpen(args, opts),
        close: (token) => readExecutor.paHandoffClose(token),
      }),
      // A5-M2: no hand-off survives its mount.
      teardown: () => readExecutor?.paHandoffCloseAll?.(),
    }
  },
  refusalCode: 'PLANE_READ_REGISTRATION_REFUSED',
})
