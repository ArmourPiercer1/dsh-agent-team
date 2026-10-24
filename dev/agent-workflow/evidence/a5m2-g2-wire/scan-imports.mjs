// read-only import-graph walker for the supply inventory (round-72)
import fs from 'node:fs';
import path from 'node:path';
const exts = ['', '.ts', '.mjs', '.js', '/index.ts', '/index.mjs', '/index.js'];
const seen = new Set();
const ext = new Map();
function note(k, from) {
  if (!ext.has(k)) ext.set(k, new Set());
  ext.get(k).add(path.relative(process.cwd(), from));
}
function tryResolve(from, spec) {
  if (spec.startsWith('node:')) return null;
  if (!spec.startsWith('.')) {
    const root = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    note(root, from);
    return null;
  }
  const base = path.resolve(path.dirname(from), spec);
  // vitest resolves '.js' specifiers onto '.ts'/'.mjs' sources: mirror that
  if (base.endsWith('.js')) {
    for (const alt of [base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.mjs')]) {
      try { if (fs.statSync(alt).isFile()) return alt; } catch { /* next */ }
    }
  }
  for (const e of exts) {
    const c = base + e;
    try { if (fs.statSync(c).isFile()) return c; } catch { /* next */ }
  }
  note('UNRESOLVED:' + spec, from);
  return null;
}
const re = /from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
const q = process.argv.slice(2);
while (q.length) {
  const f = q.pop();
  if (seen.has(f)) continue;
  seen.add(f);
  let src;
  try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
  let m;
  while ((m = re.exec(src))) {
    const spec = m[1] || m[2] || m[3];
    if (spec && spec.includes('${')) continue; // template specifier: host-graph dynamic roots
    if (spec) tryResolve(f, spec);
  }
}
console.log('FILES_WALKED=' + seen.size);
for (const [k, v] of [...ext.entries()].sort()) {
  console.log(k + ' <= ' + [...v].slice(0, 3).join(', ') + (v.size > 3 ? ' (+' + (v.size - 3) + ' more)' : ''));
}
