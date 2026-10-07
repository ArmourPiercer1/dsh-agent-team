// @ts-check
/**
 * blueprint-authoring.mjs — the minimal local Blueprint authoring helper
 * (issue #2 blueprint-loading parallel repair, plan §14 / BP10).
 *
 * This round does NOT ship a full-featured web Blueprint editor and adds
 * NO Blueprint CRUD Remote (plan §14). It ships the two local commands
 * the authoring loop needs (the command names follow the existing
 * scripts/ kebab-case style):
 *
 *   node scripts/blueprint-authoring.mjs stage <blueprintId> [--dir <blueprintDir>]
 *     Writes/keeps `<blueprintDir>/<blueprintId>.draft.yaml` (NO
 *     validation — an existing draft is kept byte-for-byte; the user
 *     edits the draft directly in their editor). A fresh draft gets a
 *     minimal CLOSED v1 skeleton (the same shape the strong parser
 *     accepts). `*.draft.yaml` is IGNORED by the saved-source index —
 *     a draft is invisible to the catalog until validate-save promotes
 *     it.
 *
 *   node scripts/blueprint-authoring.mjs validate-save <draftPath> [--dir <blueprintDir>]
 *     Does exactly three things and NOTHING stronger (plan §14 — no
 *     strong semantic validation):
 *       1. the format inspector (BP-B `inspectBlueprintSource`: the
 *          closed structural + identity-level read — one logically
 *          broken file can never sink the catalog, the same split the
 *          source index relies on);
 *       2. the identity extraction (`{ schemaVersion, blueprintId,
 *          revision }` — the minimal immutable-revision identity);
 *       3. the atomic replace/write of `<blueprintDir>/<blueprintId>.yaml`
 *          (same-directory tmp + fs.rename — a crash never leaves a
 *          torn target).
 *     A document that is inspector-`ok` but strong-parse-invalid is
 *     WRITTEN anyway (by design): the catalog lists it (the index is
 *     inspector-based) and RESOLVING it fails closed with the strong
 *     parser's exact diagnosis — the plan's logical-broken-file
 *     tolerance.
 *
 * FROZEN semantics (plan §14 — the docs must be unambiguous): "frozen"
 * means the runtime AUTHORITY no longer changes — it is NOT an OS
 * file read-only bit that guarantees the user cannot edit the file.
 * The runtime's frozen registry copy (the BlueprintRegistry row with
 * its stored source + contentHash) keeps serving; an external edit of
 * a frozen file changes NO Team/runtime authority, and a same-revision
 * re-save can never alter a bound Team's snapshot.
 *
 * Registry probe (the plan's conditional): IF the helper can obtain the
 * registry repository through the same process / a test harness, the
 * FROZEN identity MUST directly reject a same-revision write. The
 * exported `validateAndSave` therefore accepts an OPTIONAL
 * `registryProbe(blueprintId, revision) -> row | null`: present (a
 * same-process harness that holds an opened domain) → a row for
 * (blueprintId, revision) rejects the save under `frozen-revision`.
 * ABSENT (the standalone product CLI — it has no public durable seam
 * to the live runtime registry: the production seam is built from the
 * DSH `storageDomain` public service, in-process only) → the check is
 * skipped and the runtime registry remains the authority (the
 * documented fallback — an external mis-edit of a frozen file leaves
 * the frozen copy in force). NO Remote v5 is added for a CLI frozen-
 * state query (plan §14: 不得为了给 CLI 查询 frozen 状态新增 Remote v5).
 *
 * Pure I/O: node builtins + the BP-B inspector (loaded through the
 * same .js→.ts sibling hook the plain-node test runner uses — no
 * bundler, no build step, no dist dependency).
 *
 * Usage:
 *   node scripts/blueprint-authoring.mjs stage <blueprintId> [--dir <dir>]
 *   node scripts/blueprint-authoring.mjs validate-save <draftPath> [--dir <dir>]
 * Exit codes: 0 = ok, 1 = rejected (reason on stderr), 2 = usage error.
 */
import { register } from 'node:module'
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// The .js→.ts sibling resolution hook (the plain-node runner's hook —
// the inspector is TS source, no dist dependency).
register('./run-tests-hooks.mjs', import.meta.url)
const { inspectBlueprintSource } = await import('../packages/domain/blueprint/src/index.js')

/** The default blueprint directory (relative to the process CWD). */
export const DEFAULT_BLUEPRINT_DIR = 'blueprints'

/**
 * The minimal CLOSED v1 skeleton for a fresh draft (the same document
 * shape the strong parser accepts — the probe fixture's shape,
 * parameterized by the blueprint id). A draft the user never edits
 * still validates + saves cleanly.
 */
export function draftSkeleton(blueprintId) {
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${blueprintId}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: "You are the leader of the ${blueprintId} team."`,
    'members:',
    '  - templateId: member-1',
    `    persona: "You are member member-1 of the ${blueprintId} team."`,
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

/**
 * `stage` (plan §14): write/keep `<dir>/<id>.draft.yaml` — NO validation.
 * An existing draft is kept UNTOUCHED (byte-for-byte; the user edits it
 * in their editor). A fresh draft gets the minimal closed skeleton.
 * The only refusal is a FILENAME-SAFETY guard (not blueprint
 * validation): an id that would escape the blueprint dir (path
 * separators / `..`).
 *
 * @param {object} args
 * @param {string} args.blueprintId - the id to stage.
 * @param {string} [args.blueprintDir] - the target dir (default: ./blueprints).
 * @returns {{ status: 'staged', path: string, created: boolean } |
 *            { status: 'rejected', reason: 'unsafe-id', message: string }}
 */
export function stageDraft({ blueprintId, blueprintDir = DEFAULT_BLUEPRINT_DIR }) {
  const id = String(blueprintId ?? '')
  if (
    id.length === 0 ||
    id.includes('/') ||
    id.includes('\\') ||
    id.includes(sep) ||
    id.includes('..')
  ) {
    return {
      status: 'rejected',
      reason: 'unsafe-id',
      message: `the blueprintId '${id}' would escape the blueprint directory (path separators / '..' are not filename-safe); stage is filename-safe but does NOT validate blueprint grammar`,
    }
  }
  const dir = isAbsolute(blueprintDir) ? blueprintDir : resolve(process.cwd(), blueprintDir)
  const path = join(dir, `${id}.draft.yaml`)
  let created = false
  try {
    readFileSync(path)
  } catch {
    mkdirSync(dir, { recursive: true })
    writeFileSync(path, draftSkeleton(id), 'utf8')
    created = true
  }
  return { status: 'staged', path, created }
}

/**
 * Atomic same-directory replace: write to a tmp file in the TARGET
 * directory, fsync it, then fs.rename over the target (atomic on the
 * same volume — a crash never leaves a torn or half-written target).
 *
 * @param {string} targetPath - the final file path.
 * @param {string} content - the UTF-8 content.
 */
function atomicWrite(targetPath, content) {
  const dir = dirname(targetPath)
  mkdirSync(dir, { recursive: true })
  const tmp = `${targetPath}.tmp-${process.pid}-${Date.now()}`
  const fd = openSync(tmp, 'w')
  try {
    writeSync(fd, content, 'utf8')
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(tmp, targetPath)
}

/**
 * `validate-save` (plan §14): the format inspector + the identity
 * extraction + the atomic replace — and NOTHING stronger (no strong
 * semantic validation; a document the inspector accepts but the strong
 * parser rejects is written, listed by the catalog, and fails closed
 * at RESOLUTION time with the strong parser's exact diagnosis).
 *
 * @param {object} args
 * @param {string} args.draftPath - the staged draft (`*.draft.yaml`).
 * @param {string} [args.blueprintDir] - the target dir for the
 *   `<blueprintId>.yaml` promotion (default: the draft's own directory).
 * @param {((blueprintId: string, revision: string) => unknown) } [args.registryProbe]
 *   The plan's conditional frozen guard: a same-process / test-harness
 *   registry read. PRESENT and answering a row for (blueprintId,
 *   revision) → the save is REJECTED under `frozen-revision` (the
 *   frozen identity — the authority no longer changes). ABSENT (the
 *   standalone CLI — no public durable seam to the live runtime
 *   registry) → the runtime registry remains the authority (a
 *   mis-edit of a frozen file leaves its frozen copy in force; a
 *   same-revision write changes no Team/runtime authority).
 * @returns {{ status: 'saved', path: string, identity: { schemaVersion: number, blueprintId: string, revision: string } } |
 *            { status: 'rejected', reason: 'draft-not-found' | 'inspection-rejected' | 'frozen-revision', message: string, diagnostics?: readonly { reason: string, message: string }[] }}
 */
export function validateAndSave({ draftPath, blueprintDir, registryProbe }) {
  let source
  try {
    source = readFileSync(draftPath, 'utf8')
  } catch {
    return {
      status: 'rejected',
      reason: 'draft-not-found',
      message: `the draft '${draftPath}' does not exist (stage it first: node scripts/blueprint-authoring.mjs stage <blueprintId>)`,
    }
  }
  // 1) the format inspector (BP-B): the closed structural read.
  const inspection = inspectBlueprintSource(source)
  if (inspection.status === 'rejected') {
    return {
      status: 'rejected',
      reason: 'inspection-rejected',
      message: 'the draft is not a well-formed blueprint source (identity level): '
        + inspection.diagnostics.map((d) => `${d.reason}: ${d.message}`).join('; '),
      diagnostics: inspection.diagnostics,
    }
  }
  // 2) the identity extraction (the inspector's ok payload).
  const identity = inspection.identity
  // 3) the conditional frozen guard (the same-process / harness path).
  if (typeof registryProbe === 'function') {
    const row = registryProbe(identity.blueprintId, identity.revision)
    if (row !== null && row !== undefined) {
      return {
        status: 'rejected',
        reason: 'frozen-revision',
        message: `the identity (${identity.blueprintId} @ ${identity.revision}) is FROZEN in the runtime registry — frozen means the authority no longer changes (NOT an OS read-only bit); a same-revision write is refused so it can never alter a bound Team's snapshot`,
      }
    }
  }
  // 4) the atomic replace/write of the target.
  const dir = blueprintDir !== undefined && blueprintDir !== null
    ? (isAbsolute(blueprintDir) ? blueprintDir : resolve(process.cwd(), blueprintDir))
    : dirname(draftPath)
  const target = join(dir, `${identity.blueprintId}.yaml`)
  atomicWrite(target, source)
  return { status: 'saved', path: target, identity }
}

// --- the CLI --------------------------------------------------------------------

function usage() {
  return [
    'usage:',
    '  node scripts/blueprint-authoring.mjs stage <blueprintId> [--dir <blueprintDir>]',
    '  node scripts/blueprint-authoring.mjs validate-save <draftPath> [--dir <blueprintDir>]',
    '',
    'blueprintDir defaults to ./blueprints (stage) or the draft\'s own directory (validate-save).',
    'Drafts (*.draft.yaml) are ignored by the saved-source index until validate-save',
    'promotes them to <blueprintId>.yaml (atomic same-directory replace).',
    'See docs/blueprint-authoring.md for the frozen semantics (authority, not a file lock).',
  ].join('\n')
}

function parseArgs(argv) {
  const args = { _: [], dir: undefined }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dir') {
      i++
      if (i >= argv.length) throw new Error('--dir requires a value')
      args.dir = argv[i]
    } else if (a === '--help' || a === '-h') {
      args.help = true
    } else {
      args._.push(a)
    }
  }
  return args
}

const isDirectRun = (() => {
  if (process.argv[1] === undefined) return false
  try {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1])
  } catch {
    return false
  }
})()

if (isDirectRun) {
  const fail = (message, code = 1) => {
    console.error(message)
    process.exitCode = code
  }
  const args = (() => {
    try {
      return parseArgs(process.argv.slice(2))
    } catch (error) {
      fail(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}`, 2)
      return null
    }
  })()
  if (args !== null && args.help) {
    console.log(usage())
  } else if (args !== null) {
    const [command, ...rest] = args._
    if (command === 'stage' && rest.length === 1) {
      const result = stageDraft({ blueprintId: rest[0], blueprintDir: args.dir })
      if (result.status === 'staged') {
        console.log(`${result.created ? 'staged (created)' : 'staged (kept the existing draft)'}: ${result.path}`)
      } else {
        fail(`${result.reason}: ${result.message}`)
      }
    } else if (command === 'validate-save' && rest.length === 1) {
      const result = validateAndSave({
        draftPath: rest[0],
        blueprintDir: args.dir !== undefined ? args.dir : dirname(rest[0]),
      })
      if (result.status === 'saved') {
        console.log(`saved: ${result.path} (${result.identity.blueprintId} @ ${result.identity.revision}, schemaVersion ${String(result.identity.schemaVersion)})`)
        console.log('note: no strong semantic validation was performed (plan §14) — the catalog lists the document; resolving it fails closed with the strong parser\'s diagnosis if it is logically invalid.')
        console.log('note: no registry probe is available to the standalone CLI — the runtime registry remains the frozen authority (an external edit of a frozen file changes no Team/runtime authority).')
      } else {
        fail(`${result.reason}: ${result.message}`)
      }
    } else {
      fail(`unknown command or argument count: '${command ?? '(none)'}'\n\n${usage()}`, 2)
    }
  }
}
