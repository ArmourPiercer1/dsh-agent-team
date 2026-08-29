#!/usr/bin/env node
/**
 * verify-zero-core — machine-provable CORE PATCH BUDGET = 0 scanner.
 *
 * Scans a DSH host tree (pristine upstream checkout or the downstream
 * forward-replay host) for any trace of the Team rewriting upstream source,
 * and — when plugin directories are supplied — for plugin code reaching into
 * upstream-private paths. This is the executable form of the AGENTS.md red
 * lines for P1-T5 (zero-core machine verification, G1 criteria 4/5):
 *
 *   C1  patch-package traces
 *       C1a any project package.json lifecycle script (preinstall/install/
 *           postinstall/prepare) referencing the `patch-package` tool;
 *       C1b any `patches/` directory whose `*.patch` files (patch-package
 *           naming `<name>@<version>.patch`) target a package that belongs to
 *           the host tree itself (the host's own workspace packages). Patches
 *           targeting third-party dependencies are upstream's own legitimate
 *           practice (pristine upstream ships `patches/node-pty@…` for
 *           pnpm) and are reported as INFO, never as findings.
 *   C2  pnpm.patchedDependencies
 *       `pnpm.patchedDependencies` in any project package.json, or
 *       top-level `patchedDependencies:` in pnpm-workspace.yaml, with an
 *       entry key `name@version` whose `name` is one of the host tree's own
 *       packages. Third-party-only entries are INFO.
 *   C3  file-writing lifecycle scripts
 *       any project package.json preinstall/install/postinstall/prepare
 *       script string containing an in-tree modification marker (`pnpm
 *       patch`, `git apply`/`git am`, in-place `sed`/`perl`, the `patch`
 *       command, or inline Node fs write APIs). Plain `node scripts/x.mjs`
 *       wrappers (upstream's lefthook installer, spawn-helper ensure) carry
 *       no marker and are not flagged.
 *   C4  private source imports (only with --plugin)
 *       C4a a relative import whose resolved target escapes the plugin root
 *           (e.g. `../../` walks out into the host tree's src);
 *       C4b a bare import of a host-tree package whose subpath is not in
 *           that package's `exports` map (the public-surface whitelist,
 *           built by reading every non-node_modules package.json of the
 *           host tree before scanning);
 *       C4c a bare `@deepseek-ai/*` import that no host-tree package
 *           provides (unresolved upstream scope).
 *   C5  git snapshot consistency (files captured by the operator at the
 *       pwsh layer, because this script never spawns child processes):
 *       --status-before/--status-after (git status --porcelain) and
 *       --diff-before/--diff-after (git diff) must each exist and be empty.
 *
 * Public-seam note: this scanner reads the host tree strictly read-only and
 * uses no upstream API at all — it is file-system archaeology over manifests
 * and source text, so it runs under plain Node in the spawn-restricted
 * sandbox (no child_process, no external dependencies, ESM).
 *
 * Usage:
 *   node scripts/verify-zero-core.mjs --host <hostTreeDir>
 *       [--plugin <dir>]...           repeatable; enables C4 for each dir
 *       [--status-before <file>] [--status-after <file>]
 *       [--diff-before <file>] [--diff-after <file>]
 *       [--exclude <name>]...         repeatable; directory basenames to
 *                                     skip while walking (e.g. the fixture
 *                                     tree when scanning the repo itself)
 *       [--json]                      print a machine-readable summary
 *
 * Exit codes: 0 = no findings; 1 = findings reported; 2 = usage/internal
 * error. Every finding is printed on its own line, prefixed `FINDING <code>`
 * with its file location; informational observations are prefixed `INFO`.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'

const ALWAYS_SKIP = new Set(['node_modules', '.git', '.pnpm-store'])
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const LIFECYCLE_SCRIPTS = ['preinstall', 'install', 'postinstall', 'prepare']

/** C3 markers: in-tree modification mechanisms (string-level, documented). */
const WRITE_MARKERS = [
  { code: 'pnpm-patch', re: /\bpnpm\s+patch\b/i, label: 'invokes `pnpm patch`' },
  { code: 'git-apply', re: /\bgit\s+(apply|am)\b/i, label: 'applies a git patch' },
  { code: 'sed-inplace', re: /\bsed\s+(-{1,2}\w*i)/i, label: 'in-place `sed` rewrite' },
  { code: 'perl-inplace', re: /\bperl\s+(-{1,2}\w*i)/i, label: 'in-place `perl` rewrite' },
  { code: 'patch-command', re: /\bpatch\s+-\w+/i, label: 'applies a `patch` file' },
  {
    code: 'node-fs-write',
    re: /\b(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|copyFileSync|cpSync|mkdirSync|mkdir|rmSync|unlinkSync|renameSync|rename)\b/,
    label: 'inline Node fs write API',
  },
]

/** Specifier extractors, run per line so line numbers are exact. */
const SPECIFIER_PATTERNS = [
  /\bfrom\s+(['"])([^'"]+)\1/g,
  /\bimport\s+(['"])([^'"]+)\1/g,
  /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
  /\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
]

function failUsage(message) {
  console.error(`verify-zero-core: ${message}`)
  console.error('Run with --help for usage.')
  process.exit(2)
}

function parseArgs(argv) {
  const args = {
    host: undefined,
    plugins: [],
    snapshots: {},
    excludes: new Set(),
    json: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    const next = () => {
      i += 1
      if (i >= argv.length) failUsage(`missing value for ${a}`)
      return argv[i]
    }
    switch (a) {
      case '--host': args.host = next(); break
      case '--plugin': args.plugins.push(next()); break
      case '--status-before': args.snapshots['status-before'] = next(); break
      case '--status-after': args.snapshots['status-after'] = next(); break
      case '--diff-before': args.snapshots['diff-before'] = next(); break
      case '--diff-after': args.snapshots['diff-after'] = next(); break
      case '--exclude': args.excludes.add(next()); break
      case '--json': args.json = true; break
      case '--help': case '-h':
        console.log('Usage: node scripts/verify-zero-core.mjs --host <hostTreeDir> [--plugin <dir>]... '
          + '[--status-before <file>] [--status-after <file>] [--diff-before <file>] [--diff-after <file>] '
          + '[--exclude <name>]... [--json]')
        console.log('Exit codes: 0 = no findings; 1 = findings; 2 = usage error.')
        process.exit(0)
        break
      default: failUsage(`unknown argument: ${a}`)
    }
  }
  if (args.host === undefined) failUsage('--host <hostTreeDir> is required')
  return args
}

/** Recursively yield file paths and directory paths under `root`. */
function* walk(root, skipNames) {
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue // unreadable directory: skip, do not fail the scan
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') && (entry.name === '.git' || entry.name === '.pnpm-store')) continue
      if (ALWAYS_SKIP.has(entry.name) || skipNames.has(entry.name)) continue
      const full = join(dir, entry.name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        yield { path: full, isDir: true, name: entry.name }
        stack.push(full)
      } else if (st.isFile()) {
        yield { path: full, isDir: false, name: entry.name }
      }
    }
  }
}

/**
 * Collect every non-ignored package.json of the host tree plus the set of
 * directories named `patches`. Returns { packages, patchDirs }.
 */
function scanHostTree(root, skipNames) {
  const packages = []
  const patchDirs = []
  for (const item of walk(root, skipNames)) {
    if (item.isDir) {
      if (item.name === 'patches') patchDirs.push(item.path)
      continue
    }
    if (item.name !== 'package.json') continue
    let parsed
    try {
      parsed = JSON.parse(readFileSync(item.path, 'utf8'))
    } catch (error) {
      console.error(`WARN unparseable package.json skipped: ${item.path} (${error instanceof Error ? error.message : String(error)})`)
      continue
    }
    if (typeof parsed.name !== 'string') continue
    packages.push({ path: item.path, dir: dirname(item.path), name: parsed.name, raw: parsed })
  }
  return { packages, patchDirs }
}

/** True when `child` is `parent` or nested inside it. */
function isInside(child, parent) {
  const rel = relative(parent, child)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

/** Parse a patch-package file name into its target package name, if any. */
function patchFileNameToPackage(fileName) {
  const base = fileName.replace(/\.patch$/i, '')
  if (!base) return undefined
  const at = base.lastIndexOf('@')
  const name = (at > 0 ? base.slice(0, at) : base).replace(/\+/g, '/')
  return name
}

/** Check one `name@version` key against the host's own package names. */
function checkPatchKey(key, ownNames, where, findings, infos) {
  const at = key.lastIndexOf('@')
  const name = at > 0 ? key.slice(0, at) : key
  if (ownNames.has(name)) {
    findings.push({
      code: 'patchedDependencies-own',
      where,
      detail: `key "${key}" targets host-owned package "${name}" — upstream source rewrite via pnpm patch`,
    })
  } else {
    infos.push(`third-party patched dependency "${name}" at ${where} (upstream's own dependency patching; not a Team rewrite)`)
  }
}

function checkPackageLifecycle(pkg, findings) {
  const scripts = pkg.raw.scripts
  if (scripts === undefined || typeof scripts !== 'object') return
  for (const key of LIFECYCLE_SCRIPTS) {
    const script = scripts[key]
    if (typeof script !== 'string' || script.trim() === '') continue
    if (script.includes('patch-package')) {
      findings.push({
        code: 'patch-package-lifecycle',
        where: `${pkg.path} [${key}]`,
        detail: `lifecycle script references the patch-package tool: "${script}"`,
      })
      continue // C1 owns this mechanism; C3 markers do not double-report it
    }
    for (const marker of WRITE_MARKERS) {
      if (marker.re.test(script)) {
        findings.push({
          code: 'writing-lifecycle-script',
          where: `${pkg.path} [${key}]`,
          detail: `lifecycle script ${marker.label}: "${script}"`,
        })
        break // one marker is enough to name the finding
      }
    }
  }
}

/**
 * Build the public-surface whitelist: every host-tree package name mapped to
 * its `exports` surface. A package without `exports` exposes every file
 * (legacy resolution) — recorded as `unrestricted`.
 */
function buildPublicSurface(packages) {
  const surface = new Map()
  for (const pkg of packages) {
    const exports = pkg.raw.exports
    let form
    let entries
    if (exports === undefined) {
      form = 'unrestricted'
      entries = new Set()
    } else if (typeof exports === 'string') {
      form = 'root-only'
      entries = new Set([''])
    } else if (Array.isArray(exports)) {
      form = 'invalid'
      entries = new Set()
    } else {
      form = 'map'
      entries = new Set(Object.keys(exports))
    }
    surface.set(pkg.name, { dir: pkg.dir, form, entries, exports })
  }
  return surface
}

/** Whether a subpath is admitted by a package's exports surface. */
function exportsAdmits(surfaceEntry, subpath) {
  const { form, entries } = surfaceEntry
  if (form === 'unrestricted') return true
  if (subpath === '') return form === 'root-only' || entries.has('.')
  if (form === 'root-only') return false
  const norm = subpath.startsWith('./') ? subpath : `.${subpath.startsWith('/') ? subpath : `/${subpath}`}`
  if (entries.has(norm)) return true
  for (const key of entries) {
    if (!key.includes('*')) continue
    const pattern = `^${key.split('*').map(escapeRegExp).join('.*')}$`
    if (new RegExp(pattern).test(norm)) return true
  }
  return false
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Extract import/export/require specifiers with their line numbers. */
function extractSpecifiers(source) {
  const out = []
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    for (const pattern of SPECIFIER_PATTERNS) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(line)) !== null) {
        const spec = match[2]
        if (spec.includes('${')) continue // dynamic template: not statically verifiable
        out.push({ line: i + 1, spec })
      }
    }
  }
  return out
}

function checkPluginImports(pluginRoot, hostRoot, surface, findings) {
  const pluginAbs = resolve(pluginRoot)
  const files = []
  for (const item of walk(pluginAbs, new Set())) {
    if (!item.isDir && SOURCE_EXTENSIONS.has(`.${item.name.slice(item.name.lastIndexOf('.') + 1)}`)) {
      files.push(item.path)
    }
  }
  for (const file of files) {
    let source
    try {
      source = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const { line, spec } of extractSpecifiers(source)) {
      if (spec.startsWith('node:') || spec.startsWith('cordis:') || spec.startsWith('#')) continue
      const where = `${file}:${line}`
      if (spec.startsWith('.') || spec.startsWith('/')) {
        const target = resolve(dirname(file), spec)
        if (!isInside(target, pluginAbs)) {
          const detailBits = [`import "${spec}" escapes plugin root ${pluginAbs} (resolves to ${target})`]
          if (hostRoot !== undefined && isInside(target, hostRoot)) detailBits.push('enters the host tree')
          findings.push({ code: 'private-relative-escape', where, detail: detailBits.join('; ') })
        }
        continue
      }
      if (!spec.includes('/')) {
        // Unscoped bare specifier: only host-owned or upstream-scoped names matter.
        if (spec.startsWith('@deepseek-ai/')) {
          findings.push({ code: 'unresolved-upstream-scope', where, detail: `import "${spec}" names no host-tree package` })
        }
        continue
      }
      let best = undefined
      for (const name of surface.keys()) {
        if (spec === name || spec.startsWith(`${name}/`)) {
          if (best === undefined || name.length > best.length) best = name
        }
      }
      if (best === undefined) {
        if (spec.startsWith('@deepseek-ai/')) {
          findings.push({ code: 'unresolved-upstream-scope', where, detail: `import "${spec}" names no host-tree package` })
        }
        continue // third-party package: public by construction
      }
      const subpath = spec.slice(best.length)
      const entry = surface.get(best)
      if (!exportsAdmits(entry, subpath)) {
        const allowed = [...entry.entries].slice(0, 12).map(k => (k === '' ? '.' : k)).join(', ')
        findings.push({
          code: 'private-subpath',
          where,
          detail: `import "${spec}": subpath "${subpath || '.'}" not in exports surface of host package "${best}" (public: ${allowed || '∅'})`,
        })
      }
    }
  }
}

function checkSnapshot(label, filePath, findings) {
  if (!existsSync(filePath)) {
    findings.push({ code: 'git-snapshot-missing', where: filePath, detail: `--${label} file does not exist; byte-clean cannot be proven` })
    return
  }
  const content = readFileSync(filePath, 'utf8').trim()
  if (content !== '') {
    const head = content.split('\n').filter(l => l.trim() !== '').slice(0, 5)
    findings.push({
      code: `dirty-git-${label}`,
      where: filePath,
      detail: `git snapshot for --${label} is non-empty (first lines: ${head.join(' | ')}${content.split('\n').length > 5 ? ' …' : ''})`,
    })
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const hostRoot = resolve(args.host)
  if (!existsSync(hostRoot) || !statSync(hostRoot).isDirectory()) failUsage(`--host is not a directory: ${hostRoot}`)
  const pluginRoots = args.plugins.map(p => {
    const abs = resolve(p)
    if (!existsSync(abs) || !statSync(abs).isDirectory()) failUsage(`--plugin is not a directory: ${abs}`)
    return abs
  })

  const findings = []
  const infos = []
  const { packages, patchDirs } = scanHostTree(hostRoot, args.excludes)
  const ownNames = new Set(packages.map(p => p.name))
  const surface = buildPublicSurface(packages)

  for (const pkg of packages) {
    checkPackageLifecycle(pkg, findings)
    const patched = pkg.raw.pnpm?.patchedDependencies
    if (patched !== undefined && typeof patched === 'object' && !Array.isArray(patched)) {
      for (const key of Object.keys(patched)) checkPatchKey(key, ownNames, `${pkg.path} [pnpm.patchedDependencies]`, findings, infos)
    }
  }

  for (const yamlPath of walk(hostRoot, args.excludes)) {
    if (!yamlPath.isDir && yamlPath.name === 'pnpm-workspace.yaml') {
      const lines = readFileSync(yamlPath.path, 'utf8').split('\n')
      let inBlock = false
      for (const line of lines) {
        if (/^patchedDependencies:\s*(#.*)?$/.test(line)) { inBlock = true; continue }
        if (inBlock) {
          const m = line.match(/^\s{2,}([^:\s][^:]*):\s*(.*)$/)
          if (m === null) { inBlock = /^\S/.test(line) ? false : inBlock; continue }
          checkPatchKey(m[1].trim().replace(/^['"]|['"]$/g, ''), ownNames, `${yamlPath.path} [patchedDependencies]`, findings, infos)
        }
      }
    }
  }

  for (const dir of patchDirs) {
    let patchFiles
    try {
      patchFiles = readdirSync(dir).filter(f => f.toLowerCase().endsWith('.patch'))
    } catch {
      continue
    }
    for (const file of patchFiles) {
      const name = patchFileNameToPackage(file)
      const where = join(dir, file)
      if (name !== undefined && ownNames.has(name)) {
        findings.push({
          code: 'patch-own-source',
          where,
          detail: `patch-package file targets host-owned package "${name}" — upstream source rewrite`,
        })
      } else if (name !== undefined) {
        infos.push(`third-party patch file ${where} (upstream's own dependency patching; not a Team rewrite)`)
      }
    }
  }

  for (const pluginRoot of pluginRoots) {
    checkPluginImports(pluginRoot, hostRoot, surface, findings)
  }

  for (const [label, filePath] of Object.entries(args.snapshots)) {
    checkSnapshot(label, filePath, findings)
  }

  const out = args.json ? console.error : console.log
  out(`verify-zero-core: host=${hostRoot}`)
  for (const pluginRoot of pluginRoots) out(`verify-zero-core: plugin=${pluginRoot}`)
  for (const info of infos) out(`INFO ${info}`)
  for (const finding of findings) out(`FINDING ${finding.code} @ ${finding.where} — ${finding.detail}`)

  if (args.json) {
    console.log(JSON.stringify({
      tool: 'verify-zero-core',
      host: hostRoot,
      plugins: pluginRoots,
      hostPackages: packages.length,
      findings,
      infoCount: infos.length,
      pass: findings.length === 0,
    }, null, 2))
  }

  if (findings.length === 0) {
    out('RESULT: PASS verify-zero-core (0 findings)')
    process.exit(0)
  }
  out(`RESULT: FAIL verify-zero-core (${findings.length} findings)`)
  process.exit(1)
}

main()
