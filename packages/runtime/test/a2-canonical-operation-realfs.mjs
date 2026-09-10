/**
 * a2-canonical-operation-realfs.mjs — A2 canonicalization-contract cases
 * over the REAL upstream filesystem backend: the prebuilt
 * `@deepseek-ai/dsh-fs-local` of the pristine test-use checkout
 * (references/deepseek-harness-test-use per docs/TEST_METHODS.md — the
 * same prebuilt-lib import mechanism as `t12a-live-bridge.mjs`: the lib
 * is imported by absolute path, and its transitive imports resolve from
 * the test-use checkout's own pnpm layout).
 *
 * Why this exists (plan §7.6): the unit tests run over a deterministic
 * FAKE resolver (the module is seam-injected and treats keys as opaque —
 * plan §7.2). These cases pin the CONTRACT the real backend gives the
 * module: the upstream `resolve()`/realpath behavior IS the Windows
 * path semantics (separator normalization, case, relative-vs-absolute,
 * `..` traversal, symlink/junction) — the module defines none of them.
 * The local backend's `resolve()` resolves relative paths against the
 * bound cwd and returns `{ targetKey: realpath-like string, displayPath:
 * absolute display path }`; the same file yields the same targetKey.
 *
 * Self-contained + never-throwing: this module walks up to the repo root
 * (the references/deepseek-harness-test-use marker), imports the
 * prebuilt lib, constructs `LocalFileSystem` with a minimal Cordis
 * reflect double (the `Service` base constructor only needs
 * `ctx.reflect.provide`), and runs the cases in a temp dir under
 * `os.tmpdir` (created and destroyed here — the test-use tree stays
 * pristine, docs/TEST_METHODS.md §3). On any environment failure (fresh
 * checkout without the test-use build, native-module restriction) it
 * returns `{ available: false, reason }` so the consuming test records
 * the skip WITHOUT crashing the plain-node runner.
 *
 * The `LocalFileSystem` construction requires the explicit
 * `diffBasisMaxBytes` (the schemastery default is applied by the Cordis
 * loader, not the constructor — the constructor validates a resolved
 * config).
 *
 * @module @dsh-agent-team/runtime/test/a2-canonical-operation-realfs
 */
import { existsSync, mkdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const IS_WINDOWS = process.platform === 'win32'

const TEST_DIR = fileURLToPath(new URL('.', import.meta.url))
/** The worktree root (test -> runtime -> packages -> root). */
const WORKTREE_ROOT = resolve(TEST_DIR, '..', '..', '..')
/** The repository root (the worktree lives under <repo>/.worktrees/). */
const REPO_ROOT = resolve(WORKTREE_ROOT, '..', '..')

/** Walk up from the worktree root to the references/deepseek-harness-test-use marker. */
function findTestUse() {
  let dir = REPO_ROOT
  for (let depth = 0; depth < 4; depth += 1) {
    const candidate = join(dir, 'references', 'deepseek-harness-test-use')
    if (existsSync(join(candidate, 'packages', 'fs', 'fs-local', 'lib', 'index.js'))) {
      return candidate
    }
    dir = resolve(dir, '..')
  }
  return null
}

/** The real fs-local `resolve()` of one case (opaque key + display). */
function target(t) {
  return { key: String(t.targetKey), display: t.displayPath }
}

/**
 * Run the real-backend canonicalization cases.
 * @returns the structured case results (or `{ available: false, reason }`).
 */
export async function runRealBackendCases() {
  try {
    const testUse = findTestUse()
    if (testUse === null) {
      return { available: false, reason: 'references/deepseek-harness-test-use prebuilt fs-local lib not found' }
    }
    const libUrl = pathToFileURL(
      join(testUse, 'packages', 'fs', 'fs-local', 'lib', 'index.js'),
    ).href
    const { LocalFileSystem } = await import(libUrl)

    const tmp = join(tmpdir(), `dsh-a2-canonical-op-${Date.now()}-${process.pid}`)
    mkdirSync(join(tmp, 'sub'), { recursive: true })
    writeFileSync(join(tmp, 'f.txt'), 'a2 real-backend fixture\n', 'utf8')
    writeFileSync(join(tmp, 'CaseFile.txt'), 'a2 case fixture\n', 'utf8')
    writeFileSync(join(tmp, 'sub', 'g.txt'), 'a2 junction fixture\n', 'utf8')

    try {
      const fsx = new LocalFileSystem(
        { reflect: { provide() {} } },
        { cwd: tmp, diffBasisMaxBytes: 10 * 1024 * 1024 },
      )
      const r = (path) => fsx.resolve(path, { cwd: tmp })

      const relative = target(await r('f.txt'))
      const absolute = target(await r(join(tmp, 'f.txt')))
      // Separator-variant spelling (forward slashes on both platforms;
      // on Windows the backslash form is the native join above).
      const sepVariant = target(await r(tmp.split(/[\\/]/).join('/') + '/f.txt'))
      // `..` traversal spelling of the same file.
      const traversal = target(await r(join(tmp, 'sub', '..', 'f.txt')))

      // Case semantics per the FS the temp dir lives on (NTFS default is
      // case-insensitive: a differently-cased spelling still resolves to
      // the same file).
      let caseInsensitive = false
      let caseBaseline
      let caseVariant
      try {
        statSync(join(tmp, 'CASEFILE.TXT'))
        caseInsensitive = true
        caseBaseline = target(await r('CaseFile.txt'))
        caseVariant = target(await r('casefile.txt'))
      } catch {
        caseInsensitive = false
      }

      // Symlink/junction: the public seam expresses it via realpath — a
      // link to a file, and (on Windows) a directory junction, must both
      // resolve to the linked target's key.
      const fileSymlink = await probe(async () => {
        const link = join(tmp, 'link-f.txt')
        symlinkSync(join(tmp, 'f.txt'), link)
        const viaLink = target(await r('link-f.txt'))
        return viaLink.key === relative.key
      })
      const dirJunction = await probe(async () => {
        const junction = join(tmp, 'jlink')
        symlinkSync(join(tmp, 'sub'), junction, IS_WINDOWS ? 'junction' : 'dir')
        const viaJunction = target(await r(join('jlink', 'g.txt')))
        const direct = target(await r(join('sub', 'g.txt')))
        return viaJunction.key === direct.key
      })

      // Absent file: the local backend realpaths the nearest existing
      // ancestor and appends the missing suffix — identity is stable for
      // spellings, distinct for different files.
      const absentKey = String((await r('new-dir/new-file.txt')).targetKey)
      const absentTraversalKey = String((await r('new-dir/../new-dir/new-file.txt')).targetKey)
      const absentOtherKey = String((await r('new-dir/other-file.txt')).targetKey)

      return {
        available: true,
        root: testUse,
        cases: {
          relative,
          absolute,
          sepVariant,
          traversal,
          caseInsensitive,
          ...(caseBaseline !== undefined ? { caseBaseline } : {}),
          ...(caseVariant !== undefined ? { caseVariant } : {}),
          fileSymlink,
          dirJunction,
          absentKey,
          absentTraversalKey,
          absentOtherKey,
        },
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.stack ?? error.message : String(error),
    }
  }
}

/** Run one optional symlink/junction probe; record skip reasons (never throw). */
async function probe(run) {
  try {
    return { ok: true, sameKey: await run() }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.code ?? error.message : String(error),
    }
  }
}
