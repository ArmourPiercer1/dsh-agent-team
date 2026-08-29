/**
 * Characterization harness — private-import scanner (C4-equivalent).
 *
 * Static detection of upstream-private imports, re-implemented
 * self-contained from the semantics of scripts/verify-zero-core.mjs C4
 * (P1-T5) with the identical specifier patterns, so the harness owns its
 * private-import negative test end to end. The independent alignment check
 * is running verify-zero-core itself over the harness source (exit 0
 * required; see README and evidence).
 *
 * Two scan modes:
 *   - `harness` — strict: only `node:` builtins and relative specifiers
 *     that stay inside the scanned root are allowed; ANY bare third-party
 *     or upstream specifier is a finding (the harness code must have zero
 *     upstream imports and zero third-party runtime dependencies);
 *   - `probe`   — C4 semantics for probe plugins: upstream (host-tree)
 *     packages must resolve inside their public exports surface; other bare
 *     specifiers are third-party and admitted by construction.
 */
import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { checkSpecifier } from './public-surface.mjs'
import { walk } from './util.mjs'

/** Specifier extractors — identical set to verify-zero-core (line-exact). */
const SPECIFIER_PATTERNS = [
  /\bfrom\s+(['"])([^'"]+)\1/g,
  /\bimport\s+(['"])([^'"]+)\1/g,
  /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
  /\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
]

/** Extract every static/dynamic import specifier with its 1-based line. */
export function extractSpecifiers(source) {
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

function isInside(child, parent) {
  const rel = relative(parent, child)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

/**
 * Scan one source file's specifiers.
 *
 * @param {string} file - absolute path (relative escapes are checked against its dir)
 * @param {string} source - file content
 * @param {{mode: 'harness'|'probe', surface: Map, root: string, rootLabel: string}} options
 * @returns {Array<{code: string, line: number, spec: string, detail: string}>}
 */
export function scanFileSpecifiers(file, source, options) {
  const { mode, surface, root, rootLabel } = options
  const findings = []
  const rootAbs = resolve(root)
  for (const { line, spec } of extractSpecifiers(source)) {
    if (spec.startsWith('node:') || spec.startsWith('cordis:') || spec.startsWith('#')) continue
    if (spec.startsWith('.') || spec.startsWith('/')) {
      if (mode !== 'harness' || !isInside(resolve(dirname(file), spec), rootAbs)) {
        const target = isAbsolute(spec) ? spec : resolve(dirname(file), spec)
        findings.push({
          code: 'private-relative-escape',
          line,
          spec,
          detail: `relative import escapes ${rootLabel} ${rootAbs} (resolves to ${target})`,
        })
      }
      continue
    }
    if (mode === 'harness') {
      findings.push({
        code: 'bare-import-in-harness',
        line,
        spec,
        detail: `bare specifier "${spec}" — harness code may only import node: builtins and in-root relative files`,
      })
      continue
    }
    const check = checkSpecifier(spec, surface)
    if (!check.admitted) {
      findings.push({
        code: 'private-subpath-import',
        line,
        spec,
        detail: `${check.reason}`,
      })
    }
  }
  return findings
}

/** Scan every .js/.mjs/.cjs/.ts file under `dir` (skipping node_modules). */
export function scanDirectory(dir, options) {
  const findings = []
  const sourceExtensions = new Set(['.js', '.mjs', '.cjs', '.ts'])
  for (const item of walk(dir, new Set(['node_modules']))) {
    const ext = item.name.slice(item.name.lastIndexOf('.'))
    if (!sourceExtensions.has(ext)) continue
    let source
    try {
      source = readFileSync(item.path, 'utf8')
    } catch {
      continue
    }
    for (const finding of scanFileSpecifiers(item.path, source, { ...options, root: dir, rootLabel: 'root' })) {
      findings.push({ ...finding, file: item.path })
    }
  }
  return findings
}
