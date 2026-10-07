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
 *
 * What it also is not is COMPLETE, and an incomplete scan is not a neutral
 * thing here. Once the upstream closure wins Node's link race — which it does
 * for every file deeper than the entry, because the 17-package gap is linked
 * before anything else in this graph — the load error names a third-party file
 * and the SCAN is the only remaining input that can still tell an own-zone
 * defect from a host one. Every blind spot below therefore biases this gate
 * toward SKIPPING, and each was reproduced by execution rather than reasoned
 * about (receipt `dev/agent-workflow/evidence/a4-pr7/gates/7-5-review-round-mutations.txt`):
 *   - It reads STATIC statements only. A specifier reached through
 *     `await import()`, `require`, a runtime-computed string, an `import type`
 *     (correctly elided), or a wrapped statement longer than the 12-line
 *     growth guard is invisible. An own import in any of those shapes is
 *     neither own-unresolved nor traversed, and the step skips over it.
 *   - Package resolution here is PRESENCE, not Node's resolver (see
 *     `findPackageDirectory`): `exports` CONDITIONS are not evaluated, so a
 *     subpath a package publishes only under a `require` or `types` condition
 *     counts as present. Again the skip direction.
 * The two shapes that were blind when this file was reviewed and are blind no
 * more — a dangling subpath of an installed package, and an own import that is
 * indented rather than at column 0 — are each pinned by a test that is red
 * without the code below.
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

/**
 * Import/export statement starts. Leading whitespace is allowed, and has to be:
 * an indented `import` is valid ESM, and a scanner anchored to column 0 makes an
 * own-zone import vanish — the missed specifier deletes the own FAIL, the load
 * error then names an upstream file, and the step SKIPS over our own defect.
 * The allowance is a measured no-op on this repository's artifact: the healthy
 * `pnpm smoke:composition` output with and without it is the same bytes
 * (md5 026e462608899aecdb47f326905e4f31: same 17 named packages, nine PASS arms, exit 0), and a walk that
 * swaps only this pattern sees 0 specifiers it had not seen before. Receipt
 * `7-5-review-round-mutations.txt`, FIX 2 section.
 */
const STATEMENT_START = /^[ \t]*(?:import|export)\b/
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
 * Line-anchored on purpose — but at the STATEMENT, not at column 0 (see
 * `STATEMENT_START`): only a line whose first token is `import`/`export` opens
 * a statement, because a permissive multi-line regex reads JSDoc prose as
 * imports — measured on `packages/runtime/dist`: a `[\s\S]{0,300}?` window
 * invented packages out of comment text (`"the target instance"`, `"probed
 * at"`). Comment and JSDoc lines still fail the pattern on their leading `*`
 * or `//`, which is what keeps that prose out while admitting an indented
 * statement.
 *
 * A missed specifier does NOT "merely under-report". The scan is the only thing
 * that can still see an own-zone defect after the upstream closure wins the
 * link race, so one missed own import deletes the own FAIL and the step SKIPS:
 * under-reporting is the EAGER-skip direction. The comment here used to claim
 * the opposite ("can only ever make the gate skip LESS eagerly"); that was
 * backwards, and it was the reason the shape went unfixed for a round. A false
 * positive is bounded by `packageNameOf` accepting package-shaped specifiers
 * only, and it fails LOUD (an own-zone FAIL, or an extra named package in the
 * SKIP line) — the two errors are not symmetric, so the scanner errs wide.
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
 * Does this package directory actually have the SUBPATH `specifier` asks for?
 *
 * `true` — a miss, i.e. Node could not resolve this specifier at all — is
 * claimed only under Node's own two hard rules:
 *   - the manifest has an `exports` field and no key covers the subpath.
 *     `exports` is a gate, not a hint: with a string `exports` only `.` is
 *     published, and with an object `exports` an uncovered subpath is
 *     `ERR_PACKAGE_PATH_NOT_EXPORTED` EVEN IF the file sits on disk (measured
 *     against Node 24 in the review-round receipt).
 *   - there is no `exports` field and nothing Node's legacy path resolution
 *     would find: the exact name, the name plus a recognised extension, or
 *     `<name>/index.*`.
 *
 * Everything else is `false` = "do not call this a miss", including a covered
 * exports key whose target file is absent (that is `untraversed`: present,
 * mapped by the manifest, not followed by this scan) and an unreadable
 * manifest (unknown is never evidence of absence). Conditions are not
 * evaluated, so a subpath exported only for `require` reads as present — the
 * skip-direction limit named in this file's header.
 */
export function packageSubpathIsMissing(packageDirectory, specifier, io = {}) {
  const fileExists = io.fileExists ?? ((p) => existsSync(p) && statSync(p).isFile())
  const readJson = io.readJson ?? ((p) => JSON.parse(readFileSync(p, 'utf8')))
  const name = packageNameOf(specifier)
  if (name === null) return false
  const rest = specifier.slice(name.length).split('/').filter(Boolean)
  if (rest.length === 0) return false
  const subpath = `./${rest.join('/')}`
  const target = join(packageDirectory, ...rest)
  let manifest
  try {
    manifest = readJson(join(packageDirectory, 'package.json'))
  } catch {
    return false
  }
  const exportsField = manifest !== null && typeof manifest === 'object'
    ? manifest.exports ?? null
    : null
  if (exportsField !== null && exportsField !== undefined) {
    if (typeof exportsField === 'string') return true
    if (typeof exportsField !== 'object') return false
    const keys = Object.keys(exportsField)
    if (keys.includes(subpath)) return false
    // `"./*": "./dist/*"` and friends can cover the subpath; any possible
    // match is treated as covered, which keeps this conservative.
    for (const key of keys) {
      if (!key.includes('*')) continue
      const [prefix = '', suffix = ''] = key.split('*')
      if (subpath.startsWith(prefix) && subpath.endsWith(suffix) && subpath.length >= prefix.length + suffix.length) return false
    }
    return true
  }
  if (fileExists(target)) return false
  for (const ext of ['.js', '.mjs', '.cjs', '.json', '.node']) {
    if (fileExists(`${target}${ext}`)) return false
  }
  for (const index of ['/index.js', '/index.mjs', '/index.cjs', '/index.json']) {
    if (fileExists(`${target}${index}`)) return false
  }
  return true
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
 *
 * A PRESENT package whose SUBPATH does not exist is unresolved too, in the
 * importer's zone. It used to be counted as `untraversed`, which laundering
 * that made is measured, not theorised: a dangling
 * `@dsh-agent-team/contracts/does-not-exist` in a non-entry file of our own
 * built client artifact printed the healthy `SKIP … 17 unresolvable …` and
 * exit 0, byte-identical to a clean run, because the 17-package upstream gap
 * wins the link race and the scan had silently mapped the dangling subpath
 * onto the package's own root instead of reporting it.
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
      const recordUnresolved = () => {
        const record = { specifier, package: packageName, importer: file, zone }
        const bucket = zone === 'own' ? result.ownUnresolved : result.upstreamUnresolved
        if (!bucket.some((entry) => entry.specifier === specifier && entry.importer === file)) {
          bucket.push(record)
        }
      }
      if (packageDirectory === null) {
        recordUnresolved()
        continue
      }
      // Present package, subpath that cannot resolve. This is the same defect
      // class as an undeclared dependency and is reported in the same place:
      // the IMPORTER's zone. Counting it as `untraversed` instead is what let a
      // dangling subpath in our own artifact ride along with the host's gap.
      if (packageSubpathIsMissing(packageDirectory, specifier, { fileExists, readJson: io.readJson })) {
        recordUnresolved()
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
 * The package a `package.json` path belongs to, read off the path:
 * `…/node_modules/@scope/name/package.json` → `@scope/name`. Used only for the
 * `exports` form of resolution failure, whose message names the SUBPATH
 * (`'./nope'`) rather than the package, so `packageNameOf` on the specifier
 * yields nothing and the classifier would have to guess. Guessing wrong here
 * means blaming the host for a package the host actually serves, or blaming us
 * for a subpath that resolves fine in the host's tree.
 */
export function packageNameOfManifestPath(path) {
  const normalised = String(path).split(sep).join('/')
  const at = normalised.lastIndexOf('/node_modules/')
  if (at === -1) return null
  const tail = normalised.slice(at + '/node_modules/'.length)
  if (!tail.endsWith('/package.json')) return null
  const segments = tail.slice(0, -'/package.json'.length).split('/').filter(Boolean)
  if (segments.length === 0) return null
  if (segments[0]?.startsWith('@')) return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : null
  return segments[0] ?? null
}

/**
 * The parseable shape of a load failure: its code, the specifier Node could not
 * resolve, and the file that asked for it. Returns null for anything this
 * classifier must not treat as a closure failure (a throw during module
 * evaluation, an unknown file extension, a malformed graph) — null means FAIL.
 *
 * Node appends suggestions to these messages ("Did you mean to import
 * \"clsx/dist/clsx.js\"?"), so the importer is taken as the rest of the line
 * that says `imported from`, never as the tail of the message.
 *
 * The `exports`/directory forms matter most, because they carry TWO paths: the
 * offending package's own `package.json` AND, after ` imported from `, the file
 * that asked for it. Taking everything after ` in ` — which this function used
 * to do — yields a string that contains the package.json, which is always
 * inside `node_modules`, so `isInsideNodeModules` answered "upstream" for every
 * single one of them and the zone test decided nothing. The FAIL then came from
 * `package === null` while the message claimed "inside this repo's own
 * artifact" over a `node_modules` path. Each form is now parsed to its own
 * importer, measured against Node 24's verbatim messages, and the `exports`
 * form recovers the package NAME from that manifest path so the zone test is
 * the thing that decides.
 */
export function resolutionFailureOf(error) {
  const code = typeof error?.code === 'string' ? error.code : undefined
  if (code === undefined || !RESOLUTION_ERROR_CODES.includes(code)) return null
  const message = typeof error?.message === 'string' ? error.message : ''
  const notFound = /Cannot find (?:package|module) '([^']+)'(?: imported from ([^\n]+))?/.exec(message)
  const notExported = /Package (?:subpath|specifier) '([^']+)' is not defined by "(?:exports|imports)" in (?:([^\n]+?) imported from ([^\n]+)|([^\n]+))/.exec(message)
  const dirImport = /Directory import '([^']+)' is not supported resolving ES modules imported from ([^\n]+)/.exec(message)
  const specifier = notFound?.[1] ?? notExported?.[1] ?? dirImport?.[1] ?? null
  const importer = (notFound?.[2] ?? notExported?.[3] ?? notExported?.[2] ?? dirImport?.[2] ?? '').trim() || null
  if (specifier === null || importer === null) return null
  const manifestPath = notExported?.[2] ?? null
  const packageName = packageNameOf(specifier) ?? (manifestPath === null ? null : packageNameOfManifestPath(manifestPath))
  return { code, specifier, importer, package: packageName }
}

/** True when a path lies inside a `node_modules` tree (either separator). */
export function isInsideNodeModules(path) {
  return /(?:^|[/\\])node_modules(?:[/\\]|$)/.test(path)
}

/**
 * The state machine. Exactly one of `run` / `skip` / `fail`.
 *
 * `skip` requires ALL of: the entry exists, our own artifact resolves
 * completely (including every SUBPATH of a package that is installed — a
 * dangling `pkg/nope` is our defect, not the host's), the scan saw the whole
 * graph (a truncated walk cannot certify the own zone), the real `import()`
 * failed, and that failure is a bare-package resolution error raised by a file
 * that is NOT part of our artifact. The upstream closure scan is what makes the
 * message informative and what catches an own-artifact defect that the first
 * link error would have hidden.
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
  // A capped walk has not looked at the whole graph, so it cannot certify the
  // own zone clean. Skipping on a partial scan is a SKIP whose evidence is
  // "we did not get that far", which is the mute this classifier exists to
  // prevent; a load that SUCCEEDED above is still a real `run`, which is why
  // this sits on the skip path only.
  if (closure !== null && closure.ran && closure.truncated) {
    return {
      status: 'fail',
      why: `the closure scan hit its file cap after ${closure.visitedFiles} files, so it cannot certify this repo's own artifact clean — a SKIP here would claim an unscanned graph (raise maxFiles or fix the graph, never the classification)`,
    }
  }
  const importerIsUpstream = isInsideNodeModules(failure.importer)
  if (!importerIsUpstream || failure.package === null) {
    const where = importerIsUpstream
      ? 'a file this repo does not own'
      : "this repo's own artifact"
    const notABarePackage = failure.package === null
      ? ` — '${failure.specifier}' is not a bare package name, so no host module table can be missing it`
      : ''
    return {
      status: 'fail',
      why: `resolution failure in ${where}: '${failure.specifier}' imported from ${failure.importer}${notABarePackage}`,
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
