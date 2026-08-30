/**
 * P7-T6 — synchronous filesystem seam for the legacy teammates adapter.
 *
 * The core module (teammates-adapter.ts) is pure: every `node:` usage in
 * this task lives here. Synchronous on purpose: the P7 test shim runs
 * `it()` bodies synchronously.
 *
 * Authority: Development Plan §20.6 — the adapter reads one legacy
 * teammates directory exactly once per import call; there is no watcher
 * and no re-read. A missing directory returns an empty entry list (ported
 * legacy silent-skip); the pure core then fails loudly if the import was
 * requested with no entries.
 *
 * Scratch helpers are guarded to `.scratch-p7t6-*` directories under
 * `test/fixtures/` and are used only by the p7t6 unit test's
 * source-changes-after-snapshot case (always removed in `finally`).
 *
 * @module @dsh-agent-team/legacy/teammates-adapter-fs
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(HERE, 'test', 'fixtures')
const FIXTURE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/
const SCRATCH_NAME_PATTERN = /^p7t6-[a-z0-9][a-z0-9-]*$/
const ADAPTER_SOURCE_FILES = [
  'teammates-adapter.ts',
  'teammates-adapter-fs.mjs',
  'teammates-adapter-fs.d.mts',
]

function assertSafeFileName(fileName) {
  if (
    typeof fileName !== 'string' ||
    fileName.length === 0 ||
    fileName === '.' ||
    fileName === '..' ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.includes(sep)
  ) {
    throw new Error(`unsafe file name: ${String(fileName)}`)
  }
}

/** Resolve a fixture directory under `test/fixtures/` (path-traversal safe). */
export function fixtureDir(name) {
  if (typeof name !== 'string' || !FIXTURE_NAME_PATTERN.test(name)) {
    throw new Error(`unsafe fixture name: ${String(name)}`)
  }
  const dir = join(FIXTURES_DIR, name)
  if (dir !== FIXTURES_DIR && !dir.startsWith(FIXTURES_DIR + sep)) {
    throw new Error('fixture escapes the fixtures directory')
  }
  return dir
}

/**
 * Read one legacy teammates directory: sorted `.md` file names, each as
 * `{ fileName, content }`. A missing directory yields `[]` (ported legacy
 * silent-skip); any other filesystem error propagates.
 */
export function readTeammateDirectory(dirPath) {
  let names
  try {
    names = readdirSync(dirPath)
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return []
    throw err
  }
  const mdFiles = names.filter((n) => n.endsWith('.md')).sort()
  return mdFiles.map((n) => ({ fileName: n, content: readFileSync(join(dirPath, n), 'utf8') }))
}

/** Read one of the committed fixture directories under `test/fixtures/`. */
export function readFixtureTeammates(fixtureName) {
  return readTeammateDirectory(fixtureDir(fixtureName))
}

/**
 * The shipped adapter source texts (core .ts, this seam .mjs, its .d.mts),
 * for the p7t6 no-runtime-authority source scan in the unit test.
 */
export function adapterSourceTexts() {
  return ADAPTER_SOURCE_FILES.map((name) => ({
    path: join(HERE, name),
    content: readFileSync(join(HERE, name), 'utf8'),
  }))
}

function scratchDir(name) {
  if (typeof name !== 'string' || !SCRATCH_NAME_PATTERN.test(name)) {
    throw new Error(`unsafe scratch name: ${String(name)}`)
  }
  return join(FIXTURES_DIR, `.scratch-${name}`)
}

/** Create `.scratch-p7t6-<name>` under fixtures and write the given files. */
export function createScratchTeammatesDir(name, files) {
  const dir = scratchDir(name)
  mkdirSync(dir, { recursive: true })
  for (const file of files) {
    assertSafeFileName(file.fileName)
    writeFileSync(join(dir, file.fileName), file.content, 'utf8')
  }
  return dir
}

/** Overwrite one file inside an existing scratch teammates directory. */
export function writeScratchTeammateFile(name, fileName, content) {
  assertSafeFileName(fileName)
  writeFileSync(join(scratchDir(name), fileName), content, 'utf8')
}

/** Remove a scratch teammates directory (idempotent). */
export function removeScratchTeammatesDir(name) {
  const dir = scratchDir(name)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}
