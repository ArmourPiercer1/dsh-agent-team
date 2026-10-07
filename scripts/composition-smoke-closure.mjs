/**
 * composition-smoke-closure.mjs — the three-state classifier behind
 * `scripts/composition-smoke.mjs` (A4-PR7 Task 7.5).
 *
 * WHY THIS FILE EXISTS. `pnpm smoke:composition` loaded our built client entry
 * with plain Node and called it a check. The entry statically imports
 * `@deepseek-ai/dsh-client-ui-primitives`, whose published manifest declares
 * `dependencies: {}` (measured at 0.2.0-rc.2, both on disk and in the public
 * registry packument — its only declared dependency is the
 * `@deepseek-ai/cordis` PEER) while its `lib/index.js` statically imports 23
 * distinct bare packages. Six of those happen to be installed in this
 * workspace as our own devDependencies or through pnpm's `.pnpm/node_modules`
 * hoist fallback; seventeen are not installed here at all, so no bare Node
 * process in this workspace can load the entry, and no amount of pinning from
 * our side makes it a meaningful check either: in production the host loads the
 * esbuild/composition bundle with those specifiers EXTERNAL, so the load step
 * was never exercising the artifact the host runs. The plan's Task 7.5 line
 * diagnoses this as "the missing `clsx` dependency"; the measurement above is
 * what is actually true, and `clsx` is only the FIRST of seventeen
 * (the discard experiment `pnpm add clsx@2.1.1` moved the error to
 * `simple-icons`).
 *
 * THE RULE THIS IMPLEMENTS (plan ADR X12, "a gate step that cannot be run is
 * not a gate step", plus the addition that it must never be reported as a
 * pass): a step that cannot be executed prints `SKIP` with the reason and the
 * named packages, on every run, and exits 0 — while any failure that is NOT
 * the missing upstream closure prints `FAIL` and exits non-zero. A mute and a
 * fix must not produce identical output, and this repo has already closed a
 * gate by silencing it (the six `eslint-disable no-explicit-any` in A4-PR6), so
 * the classification is deliberately conservative: it skips ONLY when the real
 * `import()` attempt failed on a bare package specifier that a file OUTSIDE our
 * own artifact asked for. Anything else — a module-evaluation throw, an
 * unresolvable file inside our own dist, a bare import OUR artifact asks for
 * (the class of defect a missing entry in `packages/client/package.json`
 * produces) — is a FAIL even though the upstream closure is also incomplete.
 *
 * WHAT THIS IS NOT. It is not a claim that the client plugin works: verifying
 * the plugin inside a real host is the host-side acceptance run (Task 7.6/7.7).
 * `SKIP` is the honest report that this workspace cannot execute that check,
 * and `scripts/composition-smoke-bundle.mjs` is the check that CAN run here.
 */
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'

/**
 * Asset specifiers the smoke's registered loader maps to an inert module
 * (`composition-smoke-assets-loader.mjs`). Kept in sync with that file by
 * hand and by this comment: the scan must not call an asset an unresolvable
 * import, and the loader must not be widened to swallow real specifiers.
 */
export const ASSET_SPECIFIER = /\.(?:css|svg|png|jpe?g|gif|webp|ico|woff2?|ttf)$/i

/** Node builtins, with and without the explicit `node:` prefix. */
const BUILTIN = new Set(builtinModules)

/**
 * Error codes that mean "the module graph could not be linked because a
 * specifier does not resolve". Anything outside this set is a genuine failure
 * of OUR artifact and is never classified as a skip.
 */
export const RESOLUTION_ERROR_CODES = Object.freeze([
  'ERR_MODULE_NOT_FOUND',
  'ERR_PACKAGE_PATH_NOT_EXPORTED',
  'ERR_UNSUPPORTED_DIR_IMPORT',
])

/** Import/export statement starts. Bundlers and tsc both emit these at column 0. */
const STATEMENT_START = /^(?:import|export)\b/
/** `from '<spec>'` / `import '<spec>'` / `import('<spec>')` inside a statement. */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/
/**
 * A line that continues a wrapped statement. tsc wraps long import lists, so
 * growth is needed; a comment or a blank line is not a continuation, which is
 * what keeps JSDoc prose (`* … from "the target instance" …`) out of the
 * specifier set — measured, that prose produced three invented "own imports"
 * on `packages/runtime/dist` before this guard existed. A `*`/`/` right after
 * the leading whitespace is a comment line, not a continuation: `export * from`
 * carries its star mid-line, never at the start of one.
 */
const CONTINUATION = /^(?:[A-Za-z_$@{,)}.'"]|\s+[A-Za-z_$@{,)}.'"])/
/** Module-specifier-shaped text: no whitespace, no quotes, a sane head. */
const PLAUSIBLE_SPECIFIER = /^(?:[@a-zA-Z0-9_][^'"\s]*|\.{1,2}\/[^'"\s]*)$/

/** True for `node:fs` and the bare builtin names. */
export function isBuiltinSpecifier(specifier) {
  return specifier.startsWith('node:') || BUILTIN.has(specifier)
}

/**
 * `@scope/pkg/sub/path` -> `@scope/pkg`; `pkg/sub` -> `pkg`.
 * Returns null for relative, absolute, and URL-like specifiers.
 */
export function packageNameOf(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/') || /^[a-z]+:/.test(specifier)) {
    return null
  }
  const parts = specifier.split('/')
  if (specifier.startsWith('@')) {
    return parts.length < 2 ? null : `${parts[0]}/${parts[1]}`
  }
  return parts[0] ?? null
}

/**
 * The static ESM specifiers of a module's text.
 *
 * Deliberately line-anchored: only statements that begin at column 0 are
 * considered, because both tsc and the bundlers used here emit ESM that way,
 * and because a permissive multi-line regex reads JSDoc prose as imports —
 * measured on `packages/runtime/dist`: a `[\s\S]{0,300}?` window invented
 * packages out of comment text (`"the target instance"`, `"probed at"`).
 * A missed specifier under-reports the closure and can only ever make the gate
 * skip LESS eagerly, never more; a false positive is bounded by
 * `packageNameOf` accepting package-shaped specifiers only.
 */
export function esmStaticSpecifiers(text) {
  const lines = text.split('\n')
  const found = []
  for (let i = 0; i < lines.length; i += 1) {
    const first = lines[i] ?? ''
    if (!STATEMENT_START.test(first)) continue
    if (/^(?:import|export)\s+type\b/.test(first)) continue
    let statement = first
    for (let guard = 0; guard < 12 && !SPECIFIER.test(statement); guard += 1) {
      const next = lines[i + guard + 1]
      // Grow only across genuine continuations, so a wrapped statement is read
      // and a following JSDoc block is not.
      if (next === undefined || !CONTINUATION.test(next)) break
      statement += `\n${next}`
    }
    for (const match of statement.matchAll(new RegExp(SPECIFIER.source, 'g'))) {
      const spec = match[1]
      if (typeof spec === 'string' && spec.length > 0 && PLAUSIBLE_SPECIFIER.test(spec)) found.push(spec)
    }
  }
  return found
}

/**
 * Node's PACKAGE_RESOLVE directory walk, restricted to the question this gate
 * actually asks: is the package present on disk at all?
 *
 * A full conditional-exports resolver is deliberately NOT reimplemented here:
 * presence is what `Cannot find package 'x'` means, and a present-but-not
 * require-resolvable package (pure-ESM `exports`, no `require` condition) is
 * reported as present and left to the real `import()` to judge.
 */
export function findPackageDirectory(fromDirectory, packageName, io = {}) {
  const directoryExists = io.directoryExists ?? ((p) => existsSync(join(p, 'package.json')))
  if (packageName === null) return null
  let dir = fromDirectory
  for (;;) {
    const candidate = join(dir, 'node_modules', ...packageName.split('/'))
    if (directoryExists(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/**
 * Best-effort module entry for a package directory + subpath, used only to
 * decide which file to recurse into. Returning null means "present, not
 * traversed" — never "missing".
 */
export function resolvePackageEntryFile(packageDirectory, specifier, io = {}) {
  const fileExists = io.fileExists ?? ((p) => existsSync(p) && statSync(p).isFile())
  const readJson = io.readJson ?? ((p) => JSON.parse(readFileSync(p, 'utf8')))
  const name = packageNameOf(specifier)
  if (name === null) return null
  const rest = specifier.slice(name.length).split('/').filter(Boolean)
  const subpath = rest.length === 0 ? '.' : `./${rest.join('/')}`
  const manifestPath = join(packageDirectory, 'package.json')
  if (rest.length > 0) {
    const subpathFile = join(packageDirectory, ...rest)
    if (fileExists(subpathFile)) return subpathFile
  }
  let manifest
  try {
    manifest = readJson(manifestPath)
  } catch {
    return fileExists(join(packageDirectory, 'index.js')) ? join(packageDirectory, 'index.js') : null
  }
  const pick = (value) => {
    if (typeof value === 'string') return value
    if (value === null || typeof value !== 'object') return null
    for (const condition of ['import', 'default', 'require', 'node']) {
      const nested = pick(value[condition])
      if (nested !== null) return nested
    }
    return null
  }
  let fromExports = null
  if (manifest.exports !== null && typeof manifest.exports === 'object') {
    const keyed = manifest.exports[subpath]
    fromExports = keyed === undefined ? (rest.length === 0 ? pick(manifest.exports) : null) : pick(keyed)
  } else if (typeof manifest.exports === 'string' && rest.length === 0) {
    fromExports = manifest.exports
  }
  const candidate = fromExports ?? (typeof manifest.main === 'string' ? manifest.main : 'index.js')
  const file = join(packageDirectory, ...String(candidate).split('/'))
  return fileExists(file) ? file : null
}

/**
 * Walk the static ESM graph of `entryFile`.
 *
 * Every specifier that does not resolve is recorded with the zone of its
 * IMPORTER: `own` for a file that is part of this repository's artifact
 * (anything under `repoRoot` outside `node_modules`), `upstream` for a
 * third-party file. That distinction is the whole point of the scan — an
 * unresolvable import asked for by our own artifact is a defect in our own
 * manifest and must fail the gate, while an unresolvable import asked for by a
 * third-party module is the host's closure and is what a SKIP reports.
 */
export function scanModuleClosure(options) {
  const { entryFile, repoRoot, maxFiles = 4000 } = options
  const io = options.io ?? {}
  const fileExists = io.fileExists ?? ((p) => existsSync(p) && statSync(p).isFile())
  const directoryExists = io.directoryExists ?? ((p) => existsSync(join(p, 'package.json')))
  const readFile = io.readFile ?? ((p) => readFileSync(p, 'utf8'))
  const realpath = io.realpath ?? ((p) => { try { return realpathSync(p) } catch { return p } })
  const ownPrefixes = io.ownPrefixes ?? [repoRoot]

  const zoneOf = (file) => {
    const real = realpath(file)
    const insideRepo = ownPrefixes.some((prefix) => real === prefix || real.startsWith(prefix + sep))
    return insideRepo && !real.includes(`${sep}node_modules${sep}`) ? 'own' : 'upstream'
  }

  const result = {
    ran: false,
    reason: null,
    visitedFiles: 0,
    truncated: false,
    ownUnresolved: [],
    upstreamUnresolved: [],
    untraversed: 0,
  }
  if (!fileExists(entryFile)) {
    result.reason = `entry file missing: ${entryFile}`
    return result
  }
  result.ran = true

  const seenFiles = new Set()
  const seenPackages = new Set()
  const queue = [entryFile]
  while (queue.length > 0) {
    // Node resolves symlinks before it resolves a module's own imports (no
    // `--preserve-symlinks`), and pnpm's layout makes that decisive: from the
    // LINKED path `packages/client/node_modules/<pkg>/lib` the upward walk
    // never reaches the `.pnpm/node_modules` hoist directory, so three
    // packages Node finds were reported missing (measured: 20 vs Node's 17).
    const file = realpath(queue.shift())
    if (seenFiles.has(file)) continue
    if (seenFiles.size >= maxFiles) {
      result.truncated = true
      break
    }
    seenFiles.add(file)
    let text
    try {
      text = readFile(file)
    } catch {
      continue
    }
    result.visitedFiles += 1
    const zone = zoneOf(file)
    for (const specifier of esmStaticSpecifiers(text)) {
      if (ASSET_SPECIFIER.test(specifier) || isBuiltinSpecifier(specifier)) continue
      if (specifier.startsWith('.') || specifier.startsWith('/')) {
        const target = resolve(dirname(file), specifier)
        if (fileExists(target)) {
          queue.push(target)
          continue
        }
        const record = { specifier, importer: file, zone }
        if (zone === 'own') result.ownUnresolved.push(record)
        else result.upstreamUnresolved.push(record)
        continue
      }
      const packageName = packageNameOf(specifier)
      if (packageName === null) continue
      const packageDirectory = findPackageDirectory(dirname(file), packageName, { directoryExists })
      if (packageDirectory === null) {
        const record = { specifier, package: packageName, importer: file, zone }
        const bucket = zone === 'own' ? result.ownUnresolved : result.upstreamUnresolved
        if (!bucket.some((entry) => entry.specifier === specifier && entry.importer === file)) {
          bucket.push(record)
        }
        continue
      }
      const key = `${packageDirectory}::${specifier}`
      if (seenPackages.has(key)) continue
      seenPackages.add(key)
      const entry = resolvePackageEntryFile(packageDirectory, specifier, { fileExists, readJson: io.readJson })
      if (entry === null) {
        result.untraversed += 1
        continue
      }
      queue.push(entry)
    }
  }
  return result
}

/**
 * The parseable shape of a load failure: its code, the specifier Node could not
 * resolve, and the file that asked for it. Returns null for anything this
 * classifier must not treat as a closure failure (a throw during module
 * evaluation, an unknown file extension, a malformed graph) — null means FAIL.
 *
 * Node appends suggestions to these messages ("Did you mean to import
 * \"clsx/dist/clsx.js\"?"), so the importer is taken as the rest of the line
 * that says `imported from`, not as the tail of the message.
 */
export function resolutionFailureOf(error) {
  const code = typeof error?.code === 'string' ? error.code : undefined
  if (code === undefined || !RESOLUTION_ERROR_CODES.includes(code)) return null
  const message = typeof error?.message === 'string' ? error.message : ''
  const notFound = /Cannot find (?:package|module) '([^']+)'(?: imported from ([^\n]+))?/.exec(message)
  const notExported = /Package (?:subpath|specifier) '([^']+)' is not defined by "(?:exports|imports)" in ([^\n]+)/.exec(message)
  const specifier = notFound?.[1] ?? notExported?.[1] ?? null
  const importer = (notFound?.[2] ?? notExported?.[2] ?? '').trim() || null
  if (specifier === null || importer === null) return null
  return { code, specifier, importer, package: packageNameOf(specifier) }
}

/** True when a path lies inside a `node_modules` tree (either separator). */
export function isInsideNodeModules(path) {
  return /(?:^|[/\\])node_modules(?:[/\\]|$)/.test(path)
}

/**
 * The state machine. Exactly one of `run` / `skip` / `fail`.
 *
 * `skip` requires ALL of: the entry exists, our own artifact resolves
 * completely, the real `import()` failed, and that failure is a bare-package
 * resolution error raised by a file that is NOT part of our artifact. The
 * upstream closure scan is what makes the message informative and what catches
 * an own-artifact defect that the first link error would have hidden.
 */
export function classifyClosureStep(input) {
  const { entryExists, closure, loadError } = input
  if (!entryExists) {
    return { status: 'fail', why: 'built entry is missing — run `pnpm build` first (a missing artifact is a failure, never a skip)' }
  }
  if (closure !== null && closure.ran && closure.ownUnresolved.length > 0) {
    const list = closure.ownUnresolved.map((entry) => entry.specifier).sort()
    const names = [...new Set(list)].join(', ')
    return {
      status: 'fail',
      why: `our own artifact imports specifiers this workspace cannot resolve (${names}) — `
        + 'an undeclared dependency in this repo, not the host module closure, so this is never skippable',
    }
  }
  if (loadError === undefined || loadError === null) {
    return { status: 'run', why: 'the module loaded; the contract checks run' }
  }
  const failure = resolutionFailureOf(loadError)
  if (failure === null) {
    const message = loadError instanceof Error ? loadError.message : String(loadError)
    return { status: 'fail', why: `the entry failed to load for a reason that is not a missing upstream package (${message})` }
  }
  const upstreamImporter = isInsideNodeModules(failure.importer)
  if (!upstreamImporter || failure.package === null) {
    return {
      status: 'fail',
      why: `resolution failure inside this repo's own artifact ('${failure.specifier}' from ${failure.importer})`,
    }
  }
  const missing = upstreamMissingPackages(closure, failure.package)
  return { status: 'skip', why: 'closure', missing }
}

/** The named missing set a SKIP reports: the scan, plus the package the loader itself tripped on. */
export function upstreamMissingPackages(closure, loadErrorPackage) {
  const names = new Set(closure?.upstreamUnresolved.map((entry) => entry.package ?? packageNameOf(entry.specifier)) ?? [])
  if (typeof loadErrorPackage === 'string' && loadErrorPackage.length > 0) names.add(loadErrorPackage)
  return [...names].sort()
}

/**
 * The SKIP wording. It names the count and every package, in sorted order: an
 * unexplained SKIP is the lint-mute failure mode in a different costume.
 */
export function formatSkipDetail(missing) {
  return `host module closure unavailable — ${missing.length} unresolvable: ${missing.join(', ')}`
}

/** Relative path helper kept here so the two smoke modules phrase paths alike. */
export function repoRelative(repoRoot, absolute) {
  return relative(repoRoot, absolute).split(sep).join('/')
}
