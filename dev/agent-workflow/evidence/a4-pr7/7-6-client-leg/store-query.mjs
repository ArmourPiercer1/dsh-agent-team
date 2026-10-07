/**
 * A4-PR7 7.6 probe — what the SHARED pnpm store index actually holds.
 *
 * `index.db` is the v11 store's SQLite index; each row key is
 * "<sha512 integrity>\t<name>@<version>", i.e. one row per package VERSION whose
 * files are content-addressed in `files/`. A name@version here is what
 * `pnpm install --offline` can materialise without the network; a version that is
 * absent here can only arrive over the network.
 *
 * usage: node store-query.mjs <path-to-index.db> [name ...]
 * With no names it prints the whole inventory as "<name>@<version>" lines.
 */
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.argv[2];
const names = process.argv.slice(3);
const db = new DatabaseSync(dbPath, { readOnly: true });
const byName = new Map();
for (const { key } of db.prepare('select key from package_index').all()) {
  const tab = key.indexOf('\t');
  const nv = tab < 0 ? key : key.slice(tab + 1);
  const at = nv.lastIndexOf('@');
  if (at <= 0) continue;
  const name = nv.slice(0, at);
  if (!byName.has(name)) byName.set(name, new Set());
  byName.get(name).add(nv.slice(at + 1));
}
console.log(`store: ${dbPath}`);
console.log(`rows=${byName.size ? [...byName.values()].reduce((n, s) => n + s.size, 0) : 0} distinctNames=${byName.size}`);
if (names.length === 0) {
  for (const [name, versions] of [...byName.entries()].sort()) console.log(`${name}@${[...versions].sort().join(',')}`);
} else {
  for (const name of names) {
    const versions = byName.get(name);
    console.log(`${versions ? 'PRESENT' : 'ABSENT '} ${name}: ${versions ? [...versions].sort().join(', ') : '-'}`);
  }
}
