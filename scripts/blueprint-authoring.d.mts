/**
 * Hand-maintained type declarations for `scripts/blueprint-authoring.mjs`
 * (NodeNext: a `.mjs` module's types resolve from its sibling `.d.mts` —
 * the same convention as the runtime/test .mjs doubles).
 *
 * The minimal local Blueprint authoring helper (issue #2 blueprint-loading
 * parallel repair, plan §14 / BP10): `stage` + `validate-save`.
 */

/** The default blueprint directory (relative to the process CWD). */
export const DEFAULT_BLUEPRINT_DIR: 'blueprints'

/**
 * The minimal CLOSED v1 skeleton for a fresh draft (the same document
 * shape the strong parser accepts, parameterized by the blueprint id).
 */
export function draftSkeleton(blueprintId: string): string

/** `stage` — kept (an existing draft is untouched) or created fresh. */
export interface BlueprintStageOk {
  readonly status: 'staged'
  /** The draft file path (`<dir>/<id>.draft.yaml`). */
  readonly path: string
  /** True when this call created the draft (false = kept as-is). */
  readonly created: boolean
}

/** `stage` — the only refusal (a filename-safety guard, NOT validation). */
export interface BlueprintStageRejected {
  readonly status: 'rejected'
  readonly reason: 'unsafe-id'
  readonly message: string
}

/**
 * `stage` (plan §14): write/keep `<dir>/<id>.draft.yaml` — NO validation;
 * an existing draft is kept byte-for-byte (the user edits it directly).
 */
export function stageDraft(args: {
  readonly blueprintId: string
  readonly blueprintDir?: string
}): BlueprintStageOk | BlueprintStageRejected

/** The minimal immutable-revision identity (the inspector's ok payload). */
export interface BlueprintSourceIdentity {
  readonly schemaVersion: number
  readonly blueprintId: string
  readonly revision: string
}

/** `validate-save` — the promoted (atomic-replaced) target. */
export interface BlueprintSaveOk {
  readonly status: 'saved'
  /** The target file path (`<dir>/<blueprintId>.yaml`). */
  readonly path: string
  /** The extracted identity. */
  readonly identity: BlueprintSourceIdentity
}

/**
 * `validate-save` — refused: `draft-not-found` (no draft at the path),
 * `inspection-rejected` (the BP-B format inspector's closed diagnostics),
 * `frozen-revision` (the plan's conditional — the same-process registry
 * probe answered a row for the identity: frozen = the authority no longer
 * changes, a same-revision write is refused).
 */
export interface BlueprintSaveRejected {
  readonly status: 'rejected'
  readonly reason: 'draft-not-found' | 'inspection-rejected' | 'frozen-revision'
  readonly message: string
  /** Present for `inspection-rejected` (the inspector's diagnostics). */
  readonly diagnostics?: readonly { readonly reason: string; readonly message: string }[]
}

/**
 * The plan's conditional frozen guard: a same-process / test-harness
 * registry read (row or null/undefined per (blueprintId, revision)).
 * ABSENT (the standalone CLI — no public durable seam to the live runtime
 * registry) → the runtime registry remains the authority.
 */
export type RegistryProbe = (blueprintId: string, revision: string) => unknown

/**
 * `validate-save` (plan §14): the format inspector + the identity
 * extraction + the atomic replace/write — and NOTHING stronger (no strong
 * semantic validation).
 */
export function validateAndSave(args: {
  readonly draftPath: string
  readonly blueprintDir?: string
  readonly registryProbe?: RegistryProbe
}): BlueprintSaveOk | BlueprintSaveRejected
