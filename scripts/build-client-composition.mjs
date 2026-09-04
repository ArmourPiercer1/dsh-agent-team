#!/usr/bin/env node
/**
 * Client composition builder — canonical in-repo product builder (R125
 * master product closure).
 *
 * Provenance: lifted VERBATIM (code) from the S8 boot kit adapter
 * (dev/agent-workflow/evidence/P9/s8/s8-bundle.mjs; D-T9-11: "the
 * composition wiring is S8/main-agent territory") that produced the
 * verified R122 rc.1 production-host boot bundle
 * (references/.dsh-test-s8-2026-09-04T12-26-59/s8-client-row/). Only this
 * file-level documentation and the harness-side log prefix changed; every
 * string emitted into the bundle is unchanged, so output stays
 * byte-reproducible against the verified artifact.
 *
 * The P9 client product ships a plain tsc ESM dist (T10 contract: no
 * bundler, no module-loader handoff in the product build). This builder
 * is the composition-side step that turns that dist into the upstream
 * client-module wire format for a real production-host boot:
 *
 *   - input : packages/client dist (tsc ESM, entry plugin/client.js — the
 *             D-T9-13 glue exporting the frozen plugin surface
 *             name/inject/apply) + packages/client src (CSS module text);
 *   - output: <out-dir>/client-bundle.js — a single file in the
 *             window.__ModuleLoader__.load({ id, factory(require) }) format
 *             (the exact shape of the upstream tsdown client bundles, e.g.
 *             references/deepseek-harness-test-use/packages/client/
 *             ui-conversation/lib/client.js @ cd5ef814: `require(spec)`
 *             returns the module-table NAMESPACE directly — no .default
 *             hop — and the factory returns module.exports, which the
 *             entry module's exports object IS);
 *             + <out-dir>/package.json — the home-local shim package that
 *             carries the `dsh.client` manifest + `./client` export the
 *             node-half scan requires (product package.json untouched,
 *             T10-pinned surface stays).
 *
 * Bundle invariants enforced loudly (fail closed):
 *   - only baseline module-table externals may be required (react,
 *     react/jsx-runtime, @deepseek-ai/dsh-client-store,
 *     @deepseek-ai/dsh-client-ui-primitives) — the P9 client value-imports
 *     nothing else bare (s8-analyze.mjs verified on this tree);
 *   - every relative import of the reachable graph must resolve inside the
 *     dist module root; every .module.css import must have its CSS source;
 *   - .module.css maps use the IDENTITY class map (class "x" -> "x") and
 *     inject the real CSS text once per file via <style> (recorded choice:
 *     no hashing, no scoping — S8 smoke evidence only).
 *
 * Usage: node build-client-composition.mjs <client-pkg-dir> <out-dir>
 *        (repo root: pnpm build:composition — builds
 *         packages/client/composition-shim/ after `pnpm build`)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

const [,, pkgDir, outDir] = process.argv
if (!pkgDir || !outDir) {
  console.error('usage: node build-client-composition.mjs <client-pkg-dir> <out-dir>')
  process.exit(2)
}
const PKG = resolve(pkgDir)
const OUT = resolve(outDir)
// --probe: emit the S8 debug variant (apply-time `remote` seam diagnostics +
// window.__s8Probe hook). Harness-side only; the product bundle never carries it.
const PROBE = process.argv.slice(2).includes('--probe')

const PLUGIN_ID = '@dsh-agent-team/client'
// plugin-bundle-form: the git-install bundle form names its client row by the
// ROOT package (`dsh-agent-team` — nearestPackage walk from the row's module
// lands on the root manifest), while the manual shim form names it by the
// shim package. The emitted facade therefore registers the SAME lazy factory
// under both ids; each world claims exactly one, and the unclaimed
// registration stays inert (the client module system materializes factories
// on first import and never errors on unclaimed ids — verified against
// packages/client/modules/src/client/system.ts in the test-use host).
const ROOT_PLUGIN_ID = 'dsh-agent-team'
const EXTERNALS = new Set([
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-primitives',
])

function die(msg) {
  console.error(`build-client-composition: ${msg}`)
  process.exit(1)
}

// ── locate entry + module root ──────────────────────────────────────────
const distRoot = join(PKG, 'dist')
const entry = join(distRoot, 'packages', 'client', 'src', 'plugin', 'client.js')
if (!existsSync(entry)) die(`entry missing: ${entry}`)
const moduleRoot = join(distRoot, 'packages', 'client', 'src')
const srcRoot = join(PKG, 'src')

const toId = (file) => relative(moduleRoot, file).split(sep).join('/')
const toSlash = (p) => p.split(sep).join('/')

// ── statement-level parsing of tsc ESM output ───────────────────────────
// tsc emits import/export statements at column 0; JSDoc comments (which may
// contain import-like text) start with '*' or '/', body lines are indented.

/** Join a (possibly multi-line) import/export statement starting at lines[i]. */
function statementAt(lines, i) {
  let buf = lines[i]
  let j = i
  for (;;) {
    const opens = (buf.match(/{/g) ?? []).length
    const closes = (buf.match(/}/g) ?? []).length
    const hasSemi = /;\s*$/.test(buf)
    const hasFrom = /\bfrom\s+['"]/.test(buf)
    const isSideImport = /^import\s+['"]/.test(buf)
    if (opens === closes && (hasSemi || isSideImport || /}\s*$/.test(buf) || (hasFrom && /['"]\s*;?\s*$/.test(buf)))) break
    j++
    if (j >= lines.length) break
    buf += '\n' + lines[j]
  }
  return { text: buf, next: j + 1 }
}

function parseImportDecl(decl) {
  // returns { default?, namespace?, named: [{local, exported}] } or { side: true }
  const d = decl.trim()
  if (d === '') return { side: true }
  const out = { named: [] }
  const ns = d.match(/^\*\s*as\s+([A-Za-z_$][\w$]*)$/)
  if (ns) {
    out.namespace = ns[1]
    return out
  }
  const pureNamed = d.match(/^\{(.*)\}$/)
  if (pureNamed) {
    for (let n of pureNamed[1].split(',')) {
      n = n.trim()
      if (n === '') continue // tsc 6 emits a trailing comma: `{ a, }`
      const as = n.split(/\s+as\s+/)
      out.named.push({ exported: as[0].trim(), local: (as[1] ?? as[0]).trim() })
    }
    return out
  }
  const pureDefault = d.match(/^([A-Za-z_$][\w$]*)$/)
  if (pureDefault) {
    out.default = d
    return out
  }
  // Mixed forms: `default, { named }` or `default, * as ns`
  const parts = d.split(',')
  if (parts.length !== 2) return null
  const p0 = parts[0].trim()
  const p1 = parts[1].trim()
  if (!/^[A-Za-z_$][\w$]*$/.test(p0)) return null
  out.default = p0
  const nsP = p1.match(/^\*\s*as\s+([A-Za-z_$][\w$]*)$/)
  if (nsP) {
    out.namespace = nsP[1]
    return out
  }
  const namedP = p1.match(/^\{(.*)\}$/)
  if (!namedP) return null
  for (let n of namedP[1].split(',')) {
    n = n.trim()
    if (n === '') continue
    const as = n.split(/\s+as\s+/)
    out.named.push({ exported: as[0].trim(), local: (as[1] ?? as[0]).trim() })
  }
  return out
}

/**
 * Line scanner state for brace-depth tracking (skips string/template/
 * comment content so literal braces never skew the depth).
 */
function makeScanner() {
  const st = { mode: 'code', depth: 0, lineDepthStart: 0, lineEndsCode: false, lastCodeChar: '' }
  st.scan = (line) => {
    st.lineDepthStart = st.depth
    st.lineEndsCode = false
    st.lastCodeChar = ''
    // A line comment never spans lines: reset to code at line start.
    if (st.mode === 'linecomment') st.mode = 'code'
    let i = 0
    while (i < line.length) {
      const c = line[i]
      const c2 = line[i + 1]
      if (st.mode === 'code') {
        if (c === '/' && c2 === '/') { st.mode = 'linecomment'; i += 2; continue }
        if (c === '/' && c2 === '*') { st.mode = 'blockcomment'; i += 2; continue }
        if (c === "'") { st.mode = 'sq'; i += 1; continue }
        if (c === '"') { st.mode = 'dq'; i += 1; continue }
        if (c === '`') { st.mode = 'tpl'; i += 1; continue }
        if (c === '{') st.depth++
        if (c === '}') st.depth--
        st.lineEndsCode = true
        st.lastCodeChar = c
        i += 1
        continue
      }
      if (st.mode === 'linecomment') { i = line.length; continue }
      if (st.mode === 'blockcomment') {
        if (c === '*' && c2 === '/') { st.mode = 'code'; i += 2; continue }
        i += 1
        continue
      }
      if (st.mode === 'sq' || st.mode === 'dq') {
        const q = st.mode === 'sq' ? "'" : '"'
        if (c === '\\') { i += 2; continue }
        if (c === q) { st.mode = 'code'; st.lineEndsCode = true; st.lastCodeChar = q }
        i += 1
        continue
      }
      if (st.mode === 'tpl') {
        if (c === '\\') { i += 2; continue }
        if (c === '`') { st.mode = 'code'; st.lineEndsCode = true; st.lastCodeChar = '`' }
        // ${ } expressions: treated as opaque (braces inside templates never
        // skew depth; good enough for completion detection)
        i += 1
        continue
      }
      i += 1
    }
    return st
  }
  return st
}

/**
 * Transform one module file. Returns { prologue, body, imports, cssImports }
 * where prologue is the lines that materialize its import bindings (using
 * __req/__extReq/__css with build-time-resolved targets), body is the
 * transformed module body (export statements handled, everything else
 * verbatim), imports = resolved relative ids, cssImports = css keys.
 */
function transformModule(id, file) {
  const raw = readFileSync(file, 'utf8')
  const lines = raw.split('\n')
  const prologue = []
  const body = []
  const imports = new Set()
  const cssImports = new Set()
  const scanner = makeScanner()
  let pendingDecl = null // { names, startDepth } for a multi-line export declaration
  let cssCounter = 0
  let reCounter = 0
  let n = 0
  while (n < lines.length) {
    const line = lines[n]
    // ── deferred export-declaration completion (lazy live-binding exports) ──
    if (pendingDecl !== null) {
      body.push(line)
      scanner.scan(line)
      const completed = scanner.depth <= pendingDecl.startDepth &&
        (scanner.lineEndsCode === false ? false : (scanner.lastCodeChar === ';' || scanner.lastCodeChar === '}')) &&
        n > pendingDecl.firstLine
      if (completed) {
        for (const nm of pendingDecl.names) {
          body.push(`Object.defineProperty(exports, ${JSON.stringify(nm)}, { enumerable: true, get: () => ${nm} });`)
        }
        pendingDecl = null
      }
      n++
      continue
    }
    if (/^import\s/.test(line)) {
      const { text, next } = statementAt(lines, n)
      const m = text.match(/^import\s+(?:([\s\S]*?)\s+from\s+)?['"]([^'"]+)['"]\s*;?\s*$/)
      if (!m) die(`unparseable import in ${id}: ${text.slice(0, 120)}`)
      const declPart = m[1] ?? ''
      const spec = m[2]
      const target = resolveImport(id, spec, file, (t) => imports.add(t), (c) => cssImports.add(c))
      const parsed = parseImportDecl(declPart)
      if (parsed === null) die(`unparseable import decl in ${id}: ${text.slice(0, 120)}`)
      if (!parsed.side) {
        const ref = target.kind === 'ext' ? `__extReq(${JSON.stringify(target.spec)})`
          : target.kind === 'css' ? `__css(${JSON.stringify(target.key)})`
          : `__req(${JSON.stringify(target.id)})`
        // CSS targets: __css() returns the class map itself — the CSS module's
        // default export — not a namespace, so default bindings bind ref
        // directly (no .default hop).
        const cssTarget = target.kind === 'css'
        if (parsed.default && parsed.named.length === 0 && !parsed.namespace) {
          prologue.push(cssTarget
            ? `const ${parsed.default} = ${ref};`
            : `const ${parsed.default} = ${ref}.default;`)
        } else if (parsed.namespace && !parsed.default && parsed.named.length === 0) {
          prologue.push(`const ${parsed.namespace} = ${ref};`)
        } else {
          const tmp = `__imp${n}`
          prologue.push(`const ${tmp} = ${ref};`)
          if (parsed.default) prologue.push(cssTarget ? `const ${parsed.default} = ${tmp};` : `const ${parsed.default} = ${tmp}.default;`)
          if (parsed.namespace) prologue.push(`const ${parsed.namespace} = ${tmp};`)
          for (const { local, exported } of parsed.named) {
            prologue.push(`const ${local} = ${tmp}.${exported};`)
          }
        }
      }
      n = next
      continue
    }
    if (/^export\s+default\s/.test(line)) {
      const { text, next } = statementAt(lines, n)
      const m = text.match(/^export\s+default\s+([\s\S]*)$/)
      if (!m) die(`unparseable export default in ${id}`)
      body.push(`Object.defineProperty(exports, "default", { enumerable: true, get: () => (${m[1].replace(/;\s*$/, '')}) });`)
      n = next
      continue
    }
    if (/^export\s*\{/.test(line)) {
      const { text, next } = statementAt(lines, n)
      const m = text.match(/^export\s*\{([^}]*)\}(?:\s+from\s+['"]([^'"]+)['"])?\s*;?\s*$/)
      if (!m) die(`unparseable export {} in ${id}: ${text.slice(0, 120)}`)
      const names = m[1].split(',').map((s) => s.trim()).filter(Boolean)
      let ref = null
      const extra = []
      if (m[2] !== undefined) {
        const target = resolveImport(id, m[2], file, (t) => imports.add(t), (c) => cssImports.add(c))
        const name = `__re${reCounter++}`
        ref = name
        extra.push(`const ${name} = ${target.kind === 'ext' ? `__extReq(${JSON.stringify(target.spec)})` : `__req(${JSON.stringify(target.id)})`};`)
      }
      for (const nm of names) {
        const as = nm.split(/\s+as\s+/)
        const exported = as[0].trim()
        const local = (as[1] ?? as[0]).trim()
        body.push(ref === null
          ? `Object.defineProperty(exports, ${JSON.stringify(exported)}, { enumerable: true, get: () => ${local} });`
          : `Object.defineProperty(exports, ${JSON.stringify(exported)}, { enumerable: true, get: () => ${ref}.${exported} });`)
      }
      body.push(...extra)
      n = next
      continue
    }
    if (/^export\s+(?:const|let|var|function|async\s+function|class)\b/.test(line)) {
      // Declaration statements: strip the `export ` keyword on the first
      // line only; the rest of the declaration flows through verbatim.
      // The live-binding defineProperty getter reads the name lazily, so
      // it is placed where the STATEMENT completes: single-line
      // declarations (and one-line function/class bodies) inline right
      // after the first line, multi-line ones (object literals, function
      // and class bodies, arrow initializers) deferred until the
      // scanner-based completion detector in the loop above fires.
      // Placing the defineProperty mid-literal is a syntax error
      // ("Unexpected token '.'") and is what this deferral prevents.
      const stripped = line.replace(/^export\s+/, '')
      body.push(stripped)
      const names = []
      if (/^(?:const|let|var)\s/.test(stripped)) {
        const headM = stripped.match(/^(?:const|let|var)\s+([^=;]*)/)
        const head = headM ? headM[1] : ''
        const d1 = head.match(/^\{([^}]*)\}/)
        const d2 = head.match(/^\[([^\]]*)\]/)
        if (d1 || d2) {
          for (const p of (d1 ?? d2)[1].split(',')) {
            const t = p.trim()
            if (t === '') continue
            const local = t.split(/\s*:\s*/).pop().trim().replace(/=.*$/, '').trim()
            if (/^[A-Za-z_$][\w$]*$/.test(local)) names.push(local)
          }
        } else {
          for (const p of head.split(',')) {
            const t = p.trim().replace(/=.*$/, '').trim()
            if (/^[A-Za-z_$][\w$]*$/.test(t)) names.push(t)
          }
        }
      } else {
        const nm = stripped.match(/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|^class\s+([A-Za-z_$][\w$]*)/)
        if (nm) names.push(nm[1] ?? nm[2])
      }
      const sc = scanner.scan(stripped)
      const startDepth = sc.lineDepthStart
      const doneFirst = sc.depth <= startDepth && sc.lineEndsCode === true &&
        (sc.lastCodeChar === ';' || sc.lastCodeChar === '}')
      if (doneFirst) {
        for (const nm of names) {
          body.push(`Object.defineProperty(exports, ${JSON.stringify(nm)}, { enumerable: true, get: () => ${nm} });`)
        }
      } else {
        pendingDecl = { names, startDepth, firstLine: n }
      }
      n++
      continue
    }
    body.push(line)
    n++
  }
  void cssCounter
  return { prologue, body, imports: [...imports], cssImports: [...cssImports] }
}

/** Resolve one import spec of module `id` at file `file` (build time, loud). */
function resolveImport(id, spec, file, onImport, onCss) {
  if (spec.startsWith('.')) {
    const resolved = normalize(join(dirname(file), spec))
    if (resolved.endsWith('.css')) {
      const cssFile = join(srcRoot, toSlash(resolved).replace(/^/, ''))
      const cssSrc = join(srcRoot, relative(moduleRoot, file).replace(/\.js$/, '.css'))
      // the CSS source sits next to the SOURCE module, mirroring the dist path
      const key = toSlash(relative(moduleRoot, resolved))
      const candidates = [cssFile, cssSrc, join(srcRoot, toSlash(relative(moduleRoot, resolved)))]
      const found = candidates.find((c) => existsSync(c))
      if (!found) die(`css source missing for ${key} (looked in ${candidates.join(' | ')})`)
      onCss(key)
      return { kind: 'css', key, file: found }
    }
    const target = normalize(join(moduleRoot, toSlash(id), '..', spec))
    if (!existsSync(target)) die(`unresolved relative import '${spec}' in ${id} -> ${target}`)
    const tid = toId(target)
    onImport(tid)
    return { kind: 'mod', id: tid }
  }
  if (EXTERNALS.has(spec)) return { kind: 'ext', spec }
  die(`non-baseline bare import '${spec}' in ${id} — the S8 adapter externalizes the baseline set only`)
}

function normalize(p) {
  return resolve(p)
}

// ── reachability walk from the entry ────────────────────────────────────
const ENTRY_ID = toId(entry)
const queue = [entry]
const seen = new Map() // id -> file
const cssFiles = new Map() // key -> {file, text, classes}
const order = []
while (queue.length > 0) {
  const file = queue.shift()
  const id = toId(file)
  if (seen.has(id)) continue
  const { prologue, body, imports, cssImports } = transformModule(id, file)
  seen.set(id, { file, prologue, body, imports, cssImports })
  order.push(id)
  for (const imp of imports) {
    const f = join(moduleRoot, imp)
    if (!seen.has(imp)) queue.push(f)
  }
  for (const key of cssImports) {
    if (!cssFiles.has(key)) {
      const cssFile = join(srcRoot, key)
      if (!existsSync(cssFile)) die(`css source missing: ${cssFile}`)
      const text = readFileSync(cssFile, 'utf8')
      const classes = new Set()
      for (const m of text.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)) classes.add(m[1])
      const map = {}
      for (const c of classes) map[c] = c
      cssFiles.set(key, { text, classes: map })
    }
  }
}

// ── assemble the facade file ────────────────────────────────────────────
const cssTable = {}
for (const [key, v] of cssFiles) cssTable[key] = { classes: v.classes, text: v.text }

const parts = []
parts.push(`var __dshFactory = (require) => {`)
parts.push(`\t\tvar module = { exports: {} };`)
parts.push(`\t\tvar exports = module.exports;`)
parts.push(`\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });`)
parts.push(`\t\t/* S8 composition adapter (D-T9-11 territory): the P9 client product ships a plain tsc ESM dist; this single-file facade inlines its module graph, externalizes the baseline module-table specifiers, and maps .module.css to identity class maps with real CSS <style> injection. */`)
parts.push(`\t\tvar __extCache = {};`)
parts.push(`\t\tfunction __extReq(spec) { var m = __extCache[spec]; if (m === undefined) { m = __extCache[spec] = require(spec); } return m; }`)
parts.push(`\t\tvar __cssTable = ${JSON.stringify(cssTable)};`)
parts.push(`\t\tvar __cssDone = {};`)
parts.push(`\t\tfunction __css(key) {`)
parts.push(`\t\t\tif (!__cssDone[key]) {`)
parts.push(`\t\t\t\t__cssDone[key] = true;`)
parts.push(`\t\t\t\tvar el = document.createElement("style");`)
parts.push(`\t\t\t\tel.setAttribute("data-dsh-agent-team-s8", key);`)
parts.push(`\t\t\t\tel.textContent = __cssTable[key].text;`)
parts.push(`\t\t\t\t(document.head || document.documentElement).appendChild(el);`)
parts.push(`\t\t\t}`)
parts.push(`\t\t\treturn __cssTable[key].classes;`)
parts.push(`\t\t}`)
parts.push(`\t\tvar __mods = {};`)
parts.push(`\t\tfunction __req(id) {`)
parts.push(`\t\t\tvar m = __mods[id];`)
parts.push(`\t\t\tif (!m) throw new Error("s8-team-bundle: unresolved module " + id);`)
parts.push(`\t\t\tif (!m.done) { m.done = true; m.fn(m.exports); }`)
parts.push(`\t\t\treturn m.exports;`)
parts.push(`\t\t}`)
for (let i = 0; i < order.length; i++) {
  const id = order[i]
  const mod = seen.get(id)
  const isEntry = id === ENTRY_ID
  const exportsRef = isEntry ? 'module.exports' : '(__mods[' + JSON.stringify(id) + '].exports = {})'
  parts.push(`\t\t__mods[${JSON.stringify(id)}] = { done: false, fn: function (exports) {`)
  for (const p of mod.prologue) parts.push(`\t\t\t${p}`)
  for (const b of mod.body) parts.push(`\t\t\t${b}`)
  parts.push(`\t\t\t}, exports: ${isEntry ? 'module.exports' : '{}'} };`)
  if (isEntry) parts.push(`\t\t/* entry ${JSON.stringify(id)}: its exports object IS the facade module.exports */`)
  void exportsRef
}
parts.push(`\t\t__req(${JSON.stringify(ENTRY_ID)});`)
if (PROBE) {
  // S8 debug variant only (harness-side, never the product bundle): wrap the
  // entry apply with leaf-level diagnostics on the injected `remote` seam and
  // expose a window hook so the browser driver can call agentPresets.list()
  // later (at panel-mount time) and report the raw envelope or rejection.
  // tsc emits entry exports as non-configurable getters, so the facade
  // delegates through a fresh object instead of mutating module.exports
  // (sloppy-mode assignment to a getter-only property would be a silent no-op).
  parts.push(`\t\tvar __entry = module.exports;`)
  parts.push(`\t\tvar __probeDone = false;`)
  parts.push(`\t\tvar __wrappedApply = function (ctx, config) {`)
  parts.push(`\t\t\tif (!__probeDone) {`)
  parts.push(`\t\t\t\t__probeDone = true;`)
  parts.push(`\t\t\t\tvar __remote = undefined;`)
  parts.push(`\t\t\t\ttry {`)
  parts.push(`\t\t\t\t\t__remote = ctx.remote;`)
  parts.push(`\t\t\t\t\tvar __ap = __remote ? __remote.agentPresets : undefined;`)
  parts.push(`\t\t\t\t\tvar __diag = { remoteType: typeof __remote, agentPresets: __remote ? String(typeof __ap) : 'no-remote', list: __ap ? String(typeof __ap.list) : 'n/a' };`)
  parts.push(`\t\t\t\t\tconsole.log('[s8-probe] apply: ' + JSON.stringify(__diag));`)
  parts.push(`\t\t\t\t\twindow.__s8Probe = {`)
  parts.push(`\t\t\t\t\t\tdiag: __diag,`)
  parts.push(`\t\t\t\t\t\tnsKeys: function () { try { var ks = []; for (var k in __remote) { var v = __remote[k]; if (v !== null && typeof v === 'object') ks.push(k); } return ks.join(','); } catch (e) { return 'ERR ' + e.message; } },`)
  parts.push(`\t\t\t\t\t\tcallList: function () {`)
  parts.push(`\t\t\t\t\t\t\treturn Promise.resolve(__remote.agentPresets.list()).then(`)
  parts.push(`\t\t\t\t\t\t\t\tfunction (r) { return 'ok=' + (r && r.ok) + ' value=' + (r && r.value ? (r.value.presets ? 'presets:' + r.value.presets.length : 'obj') : 'absent') + ' error=' + (r && r.error ? JSON.stringify(r.error) : 'none'); },`)
  parts.push(`\t\t\t\t\t\t\t\tfunction (e) { return 'REJECTED ' + (e && e.name) + ': ' + (e && e.message); },`)
  parts.push(`\t\t\t\t\t\t\t);`)
  parts.push(`\t\t\t\t\t\t},`)
  parts.push(`\t\t\t\t\t};`)
  parts.push(`\t\t\t\t} catch (e) {`)
  parts.push(`\t\t\t\t\tconsole.log('[s8-probe] diagnostics error: ' + (e && e.message));`)
  parts.push(`\t\t\t\t}`)
  parts.push(`\t\t\t}`)
  parts.push(`\t\t\treturn __entry.apply(ctx, config);`)
  parts.push(`\t\t};`)
  parts.push(`\t\tvar __facade = {};`)
  parts.push(`\t\tfor (var __k in __entry) {`)
  parts.push(`\t\t\t(function (k) {`)
  parts.push(`\t\t\t\tObject.defineProperty(__facade, k, { enumerable: true, configurable: true, get: function () { return k === 'apply' ? __wrappedApply : __entry[k]; } });`)
  parts.push(`\t\t\t})(${String('__k')});`)
  parts.push(`\t\t}`)
  parts.push(`\t\ttry {`)
  parts.push(`\t\t\tvar __syms = Object.getOwnPropertySymbols(__entry);`)
  parts.push(`\t\t\tfor (var __si = 0; __si < __syms.length; __si++) {`)
  parts.push(`\t\t\t\tvar __sd = Object.getOwnPropertyDescriptor(__entry, __syms[__si]);`)
  parts.push(`\t\t\t\tif (__sd) Object.defineProperty(__facade, __syms[__si], __sd);`)
  parts.push(`\t\t\t}`)
  parts.push(`\t\t} catch (e) {}`)
  parts.push(`\t\treturn __facade;`)
}
parts.push(`\t\treturn module.exports;`)
parts.push(`\t}`)
parts.push(`};`)
parts.push(`window.__ModuleLoader__.load({ id: ${JSON.stringify(ROOT_PLUGIN_ID)}, factory: __dshFactory });`)
parts.push(`window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: __dshFactory });`)
parts.push('')

const bundleText = parts.join('\n')
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'client-bundle.js'), bundleText)

// The Node half: the Cordis Loader imports every row entry on the Node side
// (a browser facade there dies with `window is not defined`), so the shim
// ships an inert function-plugin module as its `.` export. The browser half
// travels separately: the client module system reads the dsh.client manifest
// from this same package.json and serves the `./client` export to the page.
const nodeHalf = [
  '/**',
  ' * S8 shim Node half: an inert Cordis function plugin (no host-side',
  ' * contributions). The P9 team client half is browser-only; the client',
  ' * module system serves its `./client` export (client-bundle.js) from this',
  ' * package.json manifest. Must import cleanly under plain Node.',
  ' */',
  'export function apply(ctx) {',
  '  void ctx',
  '}',
  '',
].join('\n')
writeFileSync(join(OUT, 'index.js'), nodeHalf)

const shimPkg = {
  name: PLUGIN_ID,
  version: '0.0.0',
  private: true,
  type: 'module',
  description: 'S8 composition shim: dsh.client manifest + ./client export for the P9 client bundle (product package.json untouched per D-T9-11/T10 pin).',
  exports: {
    '.': './index.js',
    './client': './client-bundle.js',
    './package.json': './package.json',
  },
  // Nested `dsh.client` (not a flat "dsh.client" key) — the node-half
  // manifest scan reads pkg.dsh.client; the flat key was the Gate-4 blocker.
  dsh: {
    client: {
      platform: 'web',
    },
  },
  files: ['client-bundle.js', 'index.js'],
}
writeFileSync(join(OUT, 'package.json'), JSON.stringify(shimPkg, null, 2) + '\n')

console.log(`build-client-composition: ${order.length} modules, ${cssFiles.size} css files`)
console.log(`build-client-composition: entry=${ENTRY_ID}`)
console.log(`build-client-composition: externals=[${[...EXTERNALS].join(', ')}]`)
console.log(`build-client-composition: wrote ${join(OUT, 'client-bundle.js')} (${Buffer.byteLength(bundleText)} B)`)
console.log(`build-client-composition: wrote ${join(OUT, 'index.js')} (node half)`)
console.log(`build-client-composition: wrote ${join(OUT, 'package.json')}`)
