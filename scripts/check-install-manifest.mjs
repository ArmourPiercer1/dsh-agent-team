#!/usr/bin/env node
// check-install-manifest.mjs — install-surface declaration regression (RED on the unfixed
// root manifest, GREEN after declaring what shipped code actually imports).
//
// SCOPE (honest bounds — NOT a complete install-surface or runtime-identity proof):
//   * Module graph parsed with the project's own declared TypeScript compiler
//     (devDependency, source/CI leg only, never a product dependency). Only
//     string-literal module specifiers are followed; every runtime-constructed
//     specifier is REJECTED by default (file:line + verbatim expression). The only
//     way a computed site does not fail is a structure-matched audited-site handler
//     (exact relative module path + function/binding shape + unique-site count, per
//     ROOT's reviewed list) whose enumerated literal targets are then enqueued and
//     scanned. There are no name-only or variable-name whitelists and no broad
//     exemptions; custom row-injected glueUrl/seamUrl values are explicitly outside
//     this package's static guarantee (only the shipped defaults are verified).
//   * Files with parser syntax diagnostics are errors (fail-closed).
//   * A pass on a scanned root never proves content of a tar that was not unpacked
//     and scanned, and never proves the running Host supplies peer identity.
// Within that scope it proves:
//   1. every literal bare import in a HOST graph is declared by the ROOT manifest,
//      kind matching site class (value -> exact dependency or host peer; type-only ->
//      peer). HOST = every exports entry EXCEPT the DSH browser entry `./client`,
//      matched as an exact key (no name guessing).
//   2. every @deepseek-ai/* peer version equals the declared @deepseek-ai/dsh version.
//   3. browser module table members may appear only in the `./client` graph and never
//      as Node dependencies; the same file reached via both `./client` and a host entry
//      is scanned in both graphs (dedup is (file, graph)).
//   4. targets exist: exports condition targets (nested walked, non-string leaf fails),
//      dsh.bundle.patch, every relative .js/.mjs module; a non-js/mjs relative target is
//      REJECTED unless consumed by an audited structural handler (e.g. the S5/S6 skills
//      asset directories, which are checked for shipment with SKILL.md).
//   5. LOCK LEG runs only when pnpm-lock.yaml sits under the scanned root: root importer
//      must match the manifest actually under check (dependency and pinned peer:
//      specifier equal, version equal or its peer-context form) and every importer
//      version-ref must resolve to a snapshots: key; a built-in negative control proves
//      the leg can fail. SKIPPED is reported as SKIPPED, never as a pass.
//   6. traversal is bounded: exceeding the guard fails, never a silent OK.
// Usage: node scripts/check-install-manifest.mjs [rootDir] [manifestOverride]
'use strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(process.argv[2] ?? '.');
const MANIFEST = process.argv[3] ? resolve(process.argv[3]) : join(ROOT, 'package.json');
const require2 = createRequire(import.meta.url);
let ts;
try { ts = require2('typescript'); } catch {
  console.error('FAIL check-install-manifest: TypeScript parser not resolvable (devDependency of the checked-out project; source/CI leg only)');
  process.exit(1);
}
const SEMVER_EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const NODE_BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'crypto', 'dns', 'events', 'fs',
  'http', 'https', 'module', 'net', 'os', 'path', 'process', 'stream', 'string_decoder',
  'timers', 'tty', 'url', 'util', 'worker_threads', 'zlib',
]);
const BROWSER_ONLY = new Set([
  'react', 'react-dom', 'react/jsx-runtime', 'react-dom/client',
  '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-primitives',
]);
const BROWSER_ENTRY_KEYS = new Set(['./client']);
const FILE_GUARD = 20000;

const pkg = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const deps = pkg.dependencies ?? {};
const peers = pkg.peerDependencies ?? {};
const errors = [];
const notes = [];
const rejected = [];
const undeclared = new Map();

const nameOf = (s) => (s.startsWith('@') ? s.split('/').slice(0, 2).join('/') : s.split('/')[0]);
const rel = (p) => (p.startsWith(ROOT) ? p.slice(ROOT.length + 1) : p);

function classify(spec, where, kind, graph) {
  const name = nameOf(spec);
  if (name.startsWith('node:') || NODE_BUILTINS.has(name)) return;
  const inDeps = Object.prototype.hasOwnProperty.call(deps, name);
  const inPeers = Object.prototype.hasOwnProperty.call(peers, name);
  if (BROWSER_ONLY.has(spec) || BROWSER_ONLY.has(name)) {
    if (graph === 'host') errors.push(`browser-module-table import in HOST graph: ${spec} (${where})`);
    if (inDeps) errors.push(`browser-module-table entry must never be a Node dependency: ${name} (${where})`);
    return;
  }
  if (inDeps) {
    if (kind === 'type-only') errors.push(`type-only import declared as Node dependency; host-provided types belong in peerDependencies: ${name} (${where})`);
    if (!SEMVER_EXACT.test(deps[name])) errors.push(`root dependency must pin an exact lock semver (no ranges/workspaces): ${name}@${deps[name]} (${where})`);
    return;
  }
  if (inPeers) {
    if (!SEMVER_EXACT.test(peers[name])) errors.push(`peerDependency version must be an exact semver: ${name}@${peers[name]} (${where})`);
    return;
  }
  if (!undeclared.has(name)) undeclared.set(name, `${kind}/${graph} first: ${where}`);
}

const dshPeer = peers['@deepseek-ai/dsh'];
if (!dshPeer) errors.push('peerDependencies missing @deepseek-ai/dsh (host identity anchor)');
else if (!SEMVER_EXACT.test(dshPeer)) errors.push(`@deepseek-ai/dsh peer must be an exact semver: ${dshPeer}`);
else for (const [name, version] of Object.entries(peers)) {
  if (name !== '@deepseek-ai/dsh' && name.startsWith('@deepseek-ai/') && version !== dshPeer) {
    errors.push(`@deepseek-ai/* peer must equal the declared @deepseek-ai/dsh peer version (${dshPeer}): ${name}@${version}`);
  }
}

const seen = new Set();
const queue = [];
function enqueue(file, graph) {
  const key = `${graph}\u0000${file}`;
  if (!/\.(js|mjs)$/.test(file) || seen.has(key) || queue.some((q) => q[2] === key)) return;
  queue.push([file, graph, key]);
}
function collectExportsTargets(exportsValue) {
  // entry: [displayKey, topLevelSubpath, target] — graph identity follows the TOP-LEVEL
  // subpath: './client'[any condition chain] is still the browser entry ./client.
  const out = [];
  const walk = (value, displayKey, subpath) => {
    if (typeof value === 'string') { out.push([displayKey, subpath, value]); return; }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const entries = Object.entries(value);
      if (!entries.length) { errors.push(`empty exports condition object: ${displayKey}`); return; }
      for (const [k, v] of entries) walk(v, `${displayKey}[${k}]`, subpath);
      return;
    }
    errors.push(`unsupported exports condition value (neither string nor condition object): ${displayKey} -> ${JSON.stringify(value)}`);
  };
  for (const [subpath, value] of Object.entries(exportsValue ?? {})) walk(value, subpath, subpath);
  return out;
}
for (const [displayKey, subpath, target] of collectExportsTargets(pkg.exports)) {
  const abs = resolve(ROOT, target);
  if (!existsSync(abs)) { errors.push(`exports target missing: ${displayKey} -> ${target}`); continue; }
  if (!/\.(js|mjs)$/.test(abs)) { notes.push(`exports target not a scanned module class (existence verified only): ${displayKey} -> ${target}`); continue; }
  if (BROWSER_ENTRY_KEYS.has(subpath) && displayKey !== subpath) notes.push(`browser entry reached via condition chain ${displayKey}; inherits ./client browser identity`);
  enqueue(abs, BROWSER_ENTRY_KEYS.has(subpath) ? 'browser' : 'host');
}
if (pkg.dsh?.bundle?.patch && !existsSync(resolve(ROOT, pkg.dsh.bundle.patch))) {
  errors.push(`dsh.bundle.patch missing: ${pkg.dsh.bundle.patch}`);
}

// ---- ROOT-audited site handlers (finite, structure-matched; unknown computed FAILs) ----
const HOST_REL = 'packages/runtime/dist/packages/runtime/src/plugin/host.js';
const BUNDLE_REL = 'packages/client/composition-shim/client-bundle.js';
const SKILLS_REL = 'packages/runtime/dist/packages/runtime/src/plugin/team-skills.js';
const EXTERNALS_EXACT = new Set(['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-primitives']);
const extOverrideChecked = { done: false };

function enclosingFnName(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isFunctionDeclaration(n) && n.name) return n.name.text;
    if (ts.isMethodDeclaration(n) && n.name) return n.name.getText();
  }
  return null;
}
function walkNodes(root, fn) { (function w(n) { fn(n); ts.forEachChild(n, w); })(root); }
function fnNamed(sf, name) {
  let found = null; let count = 0;
  walkNodes(sf, (n) => { if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && (n.name?.getText(sf) === name)) { count += 1; found = n; } });
  return count === 1 ? found : null;
}
function literalArrayOf(sf, fnRoot, arrName) {
  let arr = null; let count = 0;
  walkNodes(fnRoot ?? sf, (n) => {
    if (ts.isVariableDeclaration(n) && n.name.getText(sf) === arrName && n.initializer && ts.isArrayLiteralExpression(n.initializer)) { count += 1; arr = n.initializer; }
  });
  if (count !== 1) return null;
  const out = [];
  for (const el of arr.elements) { if (!ts.isStringLiteral(el)) return null; out.push(el.text); }
  return out;
}
function bindingCoalesceDefault(sf, fnRoot, varName, leftProp, fnCallName) {
  let ok = false; let count = 0;
  walkNodes(fnRoot ?? sf, (n) => {
    if (!ts.isVariableDeclaration(n) || n.name.getText(sf) !== varName || !n.initializer) return;
    count += 1;
    const i = n.initializer;
    if (ts.isBinaryExpression(i) && i.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      && i.left.getText(sf) === `${leftProp}.${varName}` && ts.isCallExpression(i.right)
      && i.right.expression.getText(sf) === fnCallName && i.right.arguments.length === 1
      && i.right.arguments[0].getText(sf) === 'import.meta.url') ok = true;
  });
  return ok && count === 1;
}
function urlLiteralsInFn(sf, fnName) {
  const fn = fnNamed(sf, fnName);
  if (!fn) return null;
  const out = [];
  walkNodes(fn, (n) => {
    if (ts.isNewExpression(n) && n.expression.getText(sf) === 'URL' && n.arguments?.length === 2
      && ts.isStringLiteral(n.arguments[0]) && n.arguments[1].getText(sf).endsWith('ModuleUrl')) out.push(n.arguments[0].text);
    else if (ts.isNewExpression(n) && n.expression.getText(sf) === 'URL') out.push(null);
  });
  return out.every((x) => typeof x === 'string') && out.length ? out : null;
}
function checkedConfigHasNoOverrides() {
  if (extOverrideChecked.done) return true;
  extOverrideChecked.done = true;
  const p = join(ROOT, 'cordis.patch.yml');
  if (!existsSync(p)) { errors.push('audited seam/glue defaults claim cordis.patch.yml carries no overrides, but cordis.patch.yml is absent'); return false; }
  const bad = readFileSync(p, 'utf8').split('\n').filter((l) => !/^\s*#/.test(l)).filter((l) => /\b(glueUrl|seamUrl)\s*:/.test(l));
  if (bad.length) { errors.push(`cordis.patch.yml overrides seam/glue targets, audited defaults do not describe the declared install config: ${bad.slice(0, 2).join(' ; ')}`); return false; }
  return true;
}
function assetSkillsCheck() {
  const dir = join(ROOT, '.agents', 'skills');
  if (!existsSync(dir)) { errors.push('audited skills asset dir missing: .agents/skills (first resolveTeamSkillsDir candidate must ship)'); return false; }
  const subs = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const missing = subs.filter((s) => !existsSync(join(dir, s, 'SKILL.md')));
  const inFiles = Array.isArray(pkg.files) && pkg.files.some((f) => String(f).startsWith('.agents/skills'));
  if (!inFiles) errors.push('.agents/skills not declared in package.json files[] though shipped by audited policy');
  if (!subs.length || missing.length) { errors.push(`packaged skills must each carry SKILL.md (skill dirs=${subs.length}, missing=${missing.join(', ') || 'none'})`); return false; }
  return true;
}
function applyHandlers(relFile, graph, sf, pending, visit, at) {
  const unconsumed = [];
  const host = relFile === HOST_REL && graph === 'host';
  if (host) {
    const byIdent = new Map();
    for (const p of pending) if (p.kind === 'import' && p.ident) byIdent.set(p.ident, [...(byIdent.get(p.ident) ?? []), p]);
    const sole = (id) => (byIdent.get(id)?.length === 1 ? byIdent.get(id)[0] : null);
    let h;
    if ((h = sole('candidate')) && enclosingFnName(h.node) === 'loadLegacyInspect') {
      const fn = fnNamed(sf, 'loadLegacyInspect');
      let forOfOk = false;
      const contains = (root, target) => { let hit = false; walkNodes(root, (n) => { if (n === target) hit = true; }); return hit; };
      walkNodes(fn, (n) => {
        if (!ts.isForOfStatement(n) || n.expression.getText(sf) !== 'legacyEntryCandidates') return;
        if (!ts.isVariableDeclarationList(n.initializer) || n.initializer.declarations.length !== 1) return;
        if ((n.initializer.flags & ts.NodeFlags.Const) === 0) return;
        if (n.initializer.declarations[0]?.name.getText(sf) !== 'candidate') return;
        if (!contains(n, h.node)) return;
        forOfOk = true;
      });
      const lits = fn && literalArrayOf(sf, fn, 'legacyEntryCandidates');
      if (forOfOk && lits) { for (const l of lits) visit(l, 'value', h.node); h.consumed = true; notes.push(`audited site S1 consumed: host.js loadLegacyInspect literal array (${lits.length} targets enqueued+verified)`); }
    }
    if ((h = sole('seamUrl')) && enclosingFnName(h.node) && bindingCoalesceDefault(sf, enclosingFn(sf, enclosingFnName(h.node)) ?? sf, 'seamUrl', 'rowConfig', 'resolveDefaultSeamUrl')) {
      const lits = urlLiteralsInFn(sf, 'defaultSeamUrlCandidates');
      if (lits && checkedConfigHasNoOverrides()) { for (const l of lits) visit(l, 'value', h.node); h.consumed = true; notes.push(`audited site S2 consumed: seamUrl default candidates (${lits.length} literals enqueued+verified; injected rowConfig.seamUrl NOT covered by package guarantee)`); }
    }
    if ((h = sole('glueUrl')) && enclosingFnName(h.node) && bindingCoalesceDefault(sf, enclosingFn(sf, enclosingFnName(h.node)) ?? sf, 'glueUrl', 'rowConfig', 'defaultGlueUrl')) {
      const lits = urlLiteralsInFn(sf, 'defaultGlueUrl');
      if (lits && checkedConfigHasNoOverrides()) { for (const l of lits) visit(l, 'value', h.node); h.consumed = true; notes.push(`audited site S3 consumed: glueUrl default literal enqueued+verified (injected rowConfig.glueUrl NOT covered)`); }
    }
  }
  if (relFile === BUNDLE_REL && graph === 'browser') {
    const req = pending.filter((p) => p.kind === 'require');
    const def = fnNamed(sf, '__extReq');
    if (req.length === 1 && def && def.parameters.length === 1 && def.parameters[0].name.getText(sf) === 'spec'
      && enclosingFnName(req[0].node) === '__extReq' && req[0].ident === 'spec') {
      const specs = new Set(); let bad = 0; let refs = 0;
      walkNodes(sf, (n) => {
        if (ts.isIdentifier(n) && n.text === '__extReq') {
          refs += 1;
          const parent = n.parent;
          const isDef = ts.isFunctionDeclaration(parent) && parent.name === n;
          const isDirectLiteralCall = ts.isCallExpression(parent) && parent.expression === n && parent.arguments.length === 1 && ts.isStringLiteral(parent.arguments[0]);
          if (isDef) return;
          if (isDirectLiteralCall) specs.add(parent.arguments[0].text); else bad += 1;
        }
      });
      const same = specs.size === EXTERNALS_EXACT.size && [...specs].every((s) => EXTERNALS_EXACT.has(s));
      if (bad === 0 && same) { for (const s of specs) { const fake = req[0].node; classify(s, `${relFile}:__extReq(${JSON.stringify(s)})`, 'value', 'browser'); } req[0].consumed = true; notes.push(`audited site S4 consumed: __extReq all-${refs}-refs direct-literal, set == browser table (4)`); }
      else if (bad > 0 || !same) errors.push(`S4 audited shape violated in ${relFile}: non-literal/aliased refs=${bad}, spec set ${JSON.stringify([...specs])} vs browser table`);
    }
  }
  if (relFile === SKILLS_REL && graph === 'host') {
    const urls = pending.filter((p) => p.kind === 'literal-url');
    const fn = fnNamed(sf, 'resolveTeamSkillsDir');
    const SKILL_SPECS = ['../../../../../../../.agents/skills', '../../../../.agents/skills'];
    if (fn && urls.length === 2 && urls.every((u) => u.ident === 'entryUrl' && enclosingFnName(u.node) === 'resolveTeamSkillsDir')
      && urls.map((u) => u.spec).join('\u0000') === SKILL_SPECS.join('\u0000')) {
      if (assetSkillsCheck(sf)) { for (const u of urls) u.consumed = true; notes.push('audited sites S5/S6 consumed: resolveTeamSkillsDir asset dirs (first .agents/skills shipped with SKILL.md; dist fallback may be absent)'); }
    }
  }
  for (const p of pending) {
    if (p.consumed || p.kind !== 'literal-url') continue;
    if (/\.(js|mjs)$/.test(p.spec)) {
      const abs = resolve(dirname(join(ROOT, relFile)), p.spec);
      if (!existsSync(abs)) errors.push(`literal new URL() module target missing: ${p.spec} (${at(p.node)})`);
      else { enqueue(abs, graph); p.consumed = true; }
    }
  }
  for (const p of pending) if (!p.consumed) unconsumed.push(p);
  return unconsumed;
}
function enclosingFn(sf, name) { return fnNamed(sf, name); }

function scan(file, graph, key) {
  seen.add(key);
  let source;
  try { source = readFileSync(file, 'utf8'); } catch { errors.push(`unreadable graph module: ${rel(file)}`); return; }
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.mjs') ? ts.ScriptKind.MJS : ts.ScriptKind.JS);
  if (sf.parseDiagnostics?.length) { errors.push(`parser syntax diagnostics (${sf.parseDiagnostics.length}) — fail-closed: ${rel(file)}`); return; }
  const relDir = dirname(file);
  const pending = [];
  const at = (node) => `${rel(file)}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
  const visit = (spec, kind, node) => {
    if (!spec.startsWith('.')) { classify(spec, at(node), kind, graph); return; }
    if (!/\.(js|mjs)$/.test(spec)) { pending.push({ kind: 'literal-nonjs', spec, node, ident: null }); return; }
    const abs = resolve(relDir, spec);
    if (!existsSync(abs)) { errors.push(`missing local module: ${spec} (${at(node)})`); return; }
    enqueue(abs, graph);
  };
  const exprOf = (a) => (a ? JSON.stringify(a.getText(sf).slice(0, 160)) : '<no-argument>');
  const walk = (node) => {
    if (ts.isImportDeclaration(node)) {
      visit(node.moduleSpecifier.text, node.importClause?.isTypeOnly ? 'type-only' : 'value', node);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      visit(node.moduleSpecifier.text, node.isTypeOnly ? 'type-only' : 'value', node);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const a = node.arguments[0];
      if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))) visit(a.text, 'value', node);
      else pending.push({ kind: 'import', ident: a && ts.isIdentifier(a) ? a.text : null, node, expr: a ? a.getText(sf) : '<no-argument>' });
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
      const a = node.arguments[0];
      if (a && ts.isStringLiteral(a)) visit(a.text, 'value', node);
      else pending.push({ kind: 'require', ident: a && ts.isIdentifier(a) ? a.text : null, node, expr: a ? a.getText(sf) : '<no-argument>' });
    } else if (ts.isNewExpression(node) && node.expression.getText(sf) === 'URL') {
      const a = node.arguments?.[0];
      if (a && ts.isStringLiteral(a)) pending.push({ kind: 'literal-url', spec: a.text, node, ident: node.arguments?.[1]?.getText(sf) ?? null });
      else pending.push({ kind: 'url', ident: a && ts.isIdentifier(a) ? a.text : null, node, expr: a ? a.getText(sf) : '<no-argument>' });
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  for (const p of applyHandlers(rel(file), graph, sf, pending, visit, at)) {
    rejected.push(`${p.kind === 'import' ? 'computed import() rejected (no audited structural match)' : p.kind === 'require' ? 'computed require() rejected (no audited structural match)' : p.kind === 'url' ? 'computed new URL() target rejected' : 'unaudited non-js/mjs relative target'} at ${at(p.node)} expr=${JSON.stringify((p.expr ?? p.spec ?? '<none>').slice(0, 160))}`);
  }
}
let guard = 0;
while (queue.length) {
  if (guard++ > FILE_GUARD) { errors.push(`traversal guard exceeded (> ${FILE_GUARD} visits): unresolved graph, refusing to pass`); break; }
  const [file, graph, key] = queue.shift();
  scan(file, graph, key);
}
for (const [name, from] of undeclared) errors.push(`undeclared bare import (needs root dependency or peerDependency): ${name} (${from})`);
if (seen.size === 0) errors.push('empty module graph: no exports .js/.mjs target scanned — refusing to pass');

let lockStatus = 'SKIPPED';
const lockPath = join(ROOT, 'pnpm-lock.yaml');
let YAML;
try { YAML = require2('yaml'); } catch {
  console.error('FAIL check-install-manifest: yaml parser (project dependency) not resolvable from the checked-out project; source/CI leg only');
  process.exit(1);
}
function lockStructure(text, label) {
  let doc;
  try { doc = YAML.parse(text); } catch (e) { return { error: `${label}: YAML parse failure: ${String(e.message).slice(0, 120)}` }; }
  if (!doc || typeof doc !== 'object' || !doc.importers || typeof doc.importers !== 'object') return { error: `${label}: no importers section` };
  const rootImp = doc.importers['.'];
  if (!rootImp || typeof rootImp !== 'object') return { error: `${label}: root importer ('.') not found` };
  if (!doc.snapshots || typeof doc.snapshots !== 'object') return { error: `${label}: no snapshots section` };
  const deps = {};
  for (const bucket of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const b = rootImp[bucket];
    if (b && typeof b === 'object') for (const [name, v] of Object.entries(b)) if (!(name in deps)) deps[name] = v;
  }
  return { deps, snapshotKeys: new Set(Object.keys(doc.snapshots)), doc };
}
function checkLock(struct, label) {
  const found = [];
  const { deps, snapshotKeys } = struct;
  const declared = new Map();
  for (const [name, spec] of Object.entries(pkg.dependencies ?? {})) declared.set(name, { spec, kind: 'dependency' });
  for (const [name, spec] of Object.entries(pkg.peerDependencies ?? {})) if (!declared.has(name)) declared.set(name, { spec, kind: 'peer' });
  for (const [name, d] of declared) {
    const imp = deps[name];
    if (!imp) { found.push(`${label}: manifest ${d.kind} ${name}@${d.spec} missing from root importer block`); continue; }
    const impSpec = typeof imp === 'object' && imp !== null ? String(imp.specifier ?? '') : '';
    const impVer = typeof imp === 'object' && imp !== null ? String(imp.version ?? '') : String(imp);
    if (impSpec !== d.spec) found.push(`${label}: ${name} specifier mismatch manifest=${d.spec} lock=${impSpec}`);
    if (impVer !== d.spec && !impVer.startsWith(`${d.spec}(`)) found.push(`${label}: ${name} version is neither the manifest exact version nor its peer-context form: lock=${impVer.slice(0, 70)}`);
  }
  const dangling = [];
  for (const [name, imp] of Object.entries(deps)) {
    const ver = typeof imp === 'object' && imp !== null ? String(imp.version ?? '') : String(imp);
    if (ver.startsWith('link:')) continue;
    const key = ver.startsWith(`${name}@`) ? ver : `${name}@${ver}`;
    if (!snapshotKeys.has(key)) dangling.push(`${name}@${ver.slice(0, 60)}`);
  }
  if (dangling.length) found.push(`${label}: ${dangling.length} importer version-ref(s) without snapshot key: ${dangling.slice(0, 5).join(' ; ')}`);
  return found;
}
if (existsSync(lockPath)) {
  const lockText = readFileSync(lockPath, 'utf8');
  const struct = lockStructure(lockText, 'pnpm-lock.yaml');
  const ctlStruct = struct.error ? null : (() => {
    const clone = structuredClone(struct.doc);
    const imp = clone.importers['.'];
    const bucket = imp.dependencies ?? imp.devDependencies ?? null;
    if (!bucket) return null;
    const firstKey = Object.keys(bucket)[0];
    if (!firstKey) return null;
    if (typeof bucket[firstKey] === 'object' && bucket[firstKey] !== null) bucket[firstKey].version = '9.9.9-negative-control';
    else bucket[firstKey] = '9.9.9-negative-control';
    const c = lockStructure(YAML.stringify(clone), 'lock-negative-control');
    return c.error ? null : c;
  })();
  if (struct.error) {
    errors.push(struct.error);
    lockStatus = 'FAILED (lock unparseable)';
  } else if (!ctlStruct || checkLock(ctlStruct, 'lock-negative-control').length === 0) {
    errors.push('lock negative control FAILED: mutated importer ref not detected (lock leg is dead)');
    lockStatus = 'FAILED (negative control did not trip; lock leg is dead)';
  } else {
    const found = checkLock(struct, 'pnpm-lock.yaml');
    if (found.length > 0) {
      for (const f of found) errors.push(f);
      lockStatus = `FAILED (${found.length} manifest/lock issue(s); negative control alive)`;
    } else {
      lockStatus = `PASS (manifest<->root-importer specifier/version match; importer refs resolve to snapshots; negative control tripped; entries=${Object.keys(struct.deps).length})`;
    }
  }
}

for (const r of rejected) errors.push(r);
for (const n of notes) console.log(`  note: ${n}`);
const lockBanner = lockStatus.startsWith('PASS') ? 'PASS' : lockStatus === 'SKIPPED' ? 'SKIPPED (lock leg did not run; nothing about the lock is claimed)' : lockStatus;
if (errors.length) {
  console.error(`FAIL check-install-manifest: ${errors.length} issue(s) over ${seen.size} graph visit(s); lock leg: ${lockBanner}`);
  for (const e of errors.slice(0, 50)) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`OK check-install-manifest: graph=${seen.size} visits ('./client' browser entry vs host graphs separated; 0 unaudited/unhandled computed sites — ${notes.filter((n) => n.startsWith('audited site')).length} audited-site handler consumption(s) recorded in notes above; any other runtime-constructed specifier would have been rejected with file:line+expr); lock leg: ${lockBanner}`);
