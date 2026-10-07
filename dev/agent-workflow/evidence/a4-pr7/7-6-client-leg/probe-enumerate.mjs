/**
 * A4-PR7 7.6 probe — enumerate the client leg's unresolvable set FROM THE REAL BUILD.
 *
 * Two independent instruments, so neither can launder the other:
 *   A) the gate's own closure scanner (imported read-only from
 *      scripts/composition-smoke-closure.mjs — nothing here writes to it), run on
 *      the built entry packages/client/dist/.../plugin/client.js;
 *   B) a direct scan of every bare specifier in each installed upstream client
 *      package file the entry reaches, resolved with createRequire from that file.
 *
 * Read-only probe. Writes nothing outside stdout.
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { esmStaticSpecifiers, packageNameOf, scanModuleClosure } from '../../../../../scripts/composition-smoke-closure.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const ENTRY = join(REPO, 'packages/client/dist/packages/client/src/plugin/client.js');

console.log(`repo:  ${REPO}`);
console.log(`entry: ${ENTRY}  exists=${existsSync(ENTRY)}`);
console.log('');

// ── A) the gate's own scanner ───────────────────────────────────────────────
const closure = scanModuleClosure({ entryFile: ENTRY, repoRoot: REPO });
console.log('=== A. gate scanner (scanModuleClosure) on the built entry ===');
console.log(`ran=${closure.ran} reason=${closure.reason} visitedFiles=${closure.visitedFiles} truncated=${closure.truncated}`);
console.log(`ownUnresolved=${closure.ownUnresolved.length} upstreamUnresolved=${closure.upstreamUnresolved.length} untraversed=${closure.untraversed} subpathBails=${closure.subpathBails.length}`);
const byPkg = new Map();
for (const u of closure.upstreamUnresolved) {
  const key = u.package ?? u.specifier;
  if (!byPkg.has(key)) byPkg.set(key, { specifiers: new Set(), importers: new Set() });
  const e = byPkg.get(key);
  e.specifiers.add(u.specifier);
  e.importers.add(u.importer.replace(REPO + '/', ''));
}
console.log('');
console.log(`distinct unresolvable PACKAGES (gate scanner): ${byPkg.size}`);
for (const [name, e] of [...byPkg.entries()].sort()) {
  console.log(`  ${name}`);
  console.log(`      specifiers: ${[...e.specifiers].sort().join(', ')}`);
  console.log(`      importers : ${[...e.importers].sort().join(' | ')}`);
}
if (closure.ownUnresolved.length) {
  console.log('OWN-UNRESOLVED (never skippable):');
  for (const u of closure.ownUnresolved) console.log(`  ${u.specifier} <- ${u.importer}`);
}
for (const list of [['untraversedItems', closure.untraversedItems], ['subpathBails', closure.subpathBails]]) {
  if (list[1].length) {
    console.log(`${list[0]}:`);
    for (const it of list[1]) console.log(`  ${it.specifier} <- ${it.importer} (${it.reason})`);
  }
}

// ── B) direct scan of the installed upstream client packages ────────────────
console.log('');
console.log('=== B. direct scan: every bare specifier in each installed upstream client package ===');
const PNPM = join(REPO, 'node_modules/.pnpm');
const UPSTREAM_SCOPES = ['@deepseek-ai+dsh-client-', '@deepseek-ai+dsh-util-'];
const dirs = readdirSync(PNPM).filter((d) => UPSTREAM_SCOPES.some((s) => d.startsWith(s)) && !d.includes('test-runtime'));
const requireFromRoot = createRequire(join(REPO, 'noop.js'));
const results = new Map();

function walkFiles(dir, out, cap = 4000) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (out.length > cap) return;
    const p = join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, out, cap);
    else if (e.isFile() && /\.(js|mjs|cjs)$/.test(e.name)) out.push(p);
  }
}

for (const d of dirs.sort()) {
  // node_modules/.pnpm/<name>@<ver>/node_modules/<name>/...
  const inner = join(PNPM, d, 'node_modules');
  if (!existsSync(inner)) continue;
  for (const pkgDirName of readdirSync(inner)) {
    const candidates = pkgDirName.startsWith('@')
      ? readdirSync(join(inner, pkgDirName)).map((s) => join(inner, pkgDirName, s))
      : [join(inner, pkgDirName)];
    for (const pkgDir of candidates) {
      const mf = join(pkgDir, 'package.json');
      if (!existsSync(mf) || !statSync(mf).isFile()) continue;
      const manifest = JSON.parse(readFileSync(mf, 'utf8'));
      if (!manifest.name) continue;
      const files = [];
      walkFiles(pkgDir, files);
      const specifiers = new Set();
      for (const f of files) {
        let text;
        try { text = readFileSync(f, 'utf8'); } catch { continue; }
        for (const s of esmStaticSpecifiers(text)) specifiers.add(s);
      }
      const bare = [...specifiers]
        .filter((s) => !s.startsWith('.') && !s.startsWith('/') && !s.startsWith('#'))
        .map((s) => ({ spec: s, pkg: packageNameOf(s) ?? s }))
        .filter((x) => x.pkg !== manifest.name);
      for (const { spec, pkg } of bare) {
        let ok = false;
        let err = null;
        try { requireFromRoot.resolve(spec, { paths: [pkgDir] }); ok = true; } catch (e) { err = e.code ?? e.message; }
        // pnpm hoist-fallback: also try the virtual store's hidden hoisted dir
        if (!ok) {
          try { requireFromRoot.resolve(spec, { paths: [join(PNPM, 'node_modules')] }); ok = true; err = 'via-hoist-fallback'; } catch { /* keep */ }
        }
        const key = `${manifest.name}@${manifest.version ?? '?'}`;
        if (!results.has(key)) results.set(key, []);
        results.get(key).push({ spec, pkg, ok, err });
      }
    }
  }
}

for (const [key, list] of [...results.entries()].sort()) {
  const uniq = new Map();
  for (const r of list) if (!uniq.has(r.pkg)) uniq.set(r.pkg, r);
  const missing = [...uniq.values()].filter((r) => !r.ok);
  console.log(`\n${key}: ${uniq.size} bare package(s) asked for, ${missing.length} unresolvable`);
  for (const r of [...uniq.values()].sort((a, b) => Number(a.ok) - Number(b.ok) || a.pkg.localeCompare(b.pkg))) {
    console.log(`   ${r.ok ? 'ok     ' : 'MISSING'} ${r.pkg}${r.ok && r.err === 'via-hoist-fallback' ? '  (hoist-fallback only)' : ''}`);
  }
}
