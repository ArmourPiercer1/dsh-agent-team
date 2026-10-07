#!/usr/bin/env node
/**
 * Iterative OFFLINE-obtainability measurement for the client leg's unresolvable set.
 *
 * Loop: run `pnpm install --offline` in the probe project. On an offline failure,
 * identify what floated out of reach and pin it to a version the SHARED STORE
 * actually holds, then retry. Two failure classes are distinguishable in pnpm's
 * own output:
 *   ERR_PNPM_NO_OFFLINE_META    — no cached registry packument for <pkg>@<range>
 *                                 (the fix is never a pin of <pkg> itself if the
 *                                 store has no copy: the lever is the PARENT that
 *                                 floated to a version nobody ever fetched here)
 *   ERR_PNPM_NO_OFFLINE_TARBALL — metadata known, package files not in the store.
 *
 * Nothing here touches the network. Convergence = the store holds a full closure
 * under SOME resolution; a no-store-version verdict = a hard finding.
 *
 * Writes only inside .tmp-faultscratch/offline-probe/ (gitignored scratch).
 */
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';

const MAIN = '/home/user/dsh-plugins/dsh-agent-team';
const PROJ = `${MAIN}/.tmp-faultscratch/offline-probe/proj`;
const STORE = `${MAIN}/.tmp-pnpm-store`;
const OUT = `${MAIN}/.tmp-faultscratch/offline-probe`;
const manifestPath = `${PROJ}/package.json`;
const base = JSON.parse(readFileSync(manifestPath, 'utf8'));
const pins = [];
mkdirSync(OUT, { recursive: true });

const store = new DatabaseSync(`${STORE}/v11/index.db`, { readOnly: true });
const storeVersions = new Map();
for (const { key } of store.prepare('select key from package_index').all()) {
  const tab = key.indexOf('\t');
  const nv = tab < 0 ? key : key.slice(tab + 1);
  const at = nv.lastIndexOf('@');
  if (at <= 0) continue;
  const name = nv.slice(0, at);
  if (!storeVersions.has(name)) storeVersions.set(name, new Set());
  storeVersions.get(name).add(nv.slice(at + 1));
}
const cmp = (a, b) => {
  const pa = a.split('.').map(Number); const pb = b.split('.').map(Number);
  return (pa[0] - pb[0]) || (pa[1] - pb[1]) || (pa[2] - pb[2]);
};
const highestStore = (name) => {
  const have = storeVersions.get(name);
  if (!have || have.size === 0) return null;
  return [...have].sort(cmp).at(-1);
};
const highestStoreBelow = (name, version) => {
  const have = storeVersions.get(name);
  if (!have) return null;
  const ok = [...have].filter((v) => cmp(v, version) < 0).sort(cmp);
  return ok.length ? ok.at(-1) : null;
};

const log = [];
let verdict = 'unknown';
for (let round = 1; round <= 80; round += 1) {
  // pnpm 11 reads `overrides` from pnpm-workspace.yaml, NOT from the "pnpm" field of
  // package.json (measured: it warns and ignores the latter).
  writeFileSync(manifestPath, `${JSON.stringify(base, null, 2)}\n`);
  writeFileSync(`${PROJ}/pnpm-workspace.yaml`, pins.length
    ? `packages: []\noverrides:\n${pins.map((p) => `  '${p.name}': ${p.version}`).join('\n')}\n`
    : 'packages: []\n');
  rmSync(`${PROJ}/node_modules`, { recursive: true, force: true });
  rmSync(`${PROJ}/pnpm-lock.yaml`, { force: true });
  let out = '';
  let code = 0;
  try {
    out = execFileSync('pnpm', ['install', '--offline', `--store-dir=${STORE}`, '--ignore-scripts', '--config.confirmModulesPurge=false'], {
      cwd: PROJ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: 'true' },
    });
  } catch (e) {
    code = e.status ?? 1;
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  log.push(`\n===== round ${round} (pins=${pins.length}) exit=${code} =====\n${out.trim()}`);
  process.stderr.write(`round ${round}: exit=${code} pins=${pins.length}\n`);
  if (code === 0) { verdict = 'CONVERGED'; console.log(`CONVERGED after ${round} round(s), ${pins.length} transitive pin(s) needed.`); break; }

  const meta = /ERR_PNPM_NO_OFFLINE_META\] Failed to resolve (\S+)@(.+?) in package mirror/.exec(out);
  const trailAt = [...out.matchAll(/ at (\S+)@(\S+)/g)].at(-1);
  const trailOf = /installing the dependencies of (\S+)@(\S+)/.exec(out);
  const tarball = /ERR_PNPM_NO_OFFLINE_TARBALL/.test(out);
  const tarballPkg = /packages?\/([\w@/.-]+)\/([\d.]+)|([\w@/.-]+)@(\d+\.\d+\.\d+)/g;

  let pin = null;
  let note = '';
  if (meta) {
    const missing = meta[1];
    const parent = trailAt ? { name: trailAt[1], version: trailAt[2] } : (trailOf ? { name: trailOf[1], version: trailOf[2] } : null);
    if (parent && parent.name !== missing) {
      const lower = highestStoreBelow(parent.name, parent.version) ?? (highestStore(parent.name) !== parent.version ? highestStore(parent.name) : null);
      note = `metadata missing for ${missing}@${meta[2].trim()}, asked for by ${parent.name}@${parent.version}`;
      pin = lower ? { name: parent.name, version: lower, note } : null;
      if (!pin) { log.push(`\nNO ALTERNATIVE for parent ${parent.name}: store holds ${[...(storeVersions.get(parent.name) ?? [])].join(', ') || 'nothing'}; the missing child ${missing} is in the store: ${storeVersions.has(missing)}`); verdict = 'BLOCKED'; console.log(`BLOCKED: ${missing} has no store copy and its parent ${parent.name}@${parent.version} has no store-available alternative.`); break; }
    } else {
      const v = highestStore(missing);
      note = `metadata missing for ${missing}@${meta[2].trim()} and it is the direct ask`;
      pin = v ? { name: missing, version: v, note } : null;
      if (!pin) { verdict = 'BLOCKED'; console.log(`BLOCKED: ${missing} has no store copy at all.`); break; }
    }
  } else if (tarball) {
    // pnpm names the exact tarball it could not find: read the name/version off
    // that URL instead of guessing at which package in the trail is at fault.
    const m = /registry\.npmjs\.org\/(.+?)\/-\/([^/]+?)-(\d+\.\d+\.\d+)\.tgz/.exec(out);
    if (!m) { verdict = 'UNKNOWN'; console.log('UNKNOWN tarball failure, see log.'); break; }
    const name = m[1]; // the path before /-/ IS the package name, scope included
    const version = m[3];
    const v = highestStoreBelow(name, version) ?? highestStore(name);
    note = `tarball missing for ${name}@${version}`;
    pin = v ? { name: m[1], version: v, note } : null;
    if (!pin) { verdict = 'BLOCKED'; console.log(`BLOCKED: ${m[1]} has no store copy.`); break; }
  } else {
    verdict = 'NON-OFFLINE-FAILURE';
    console.log(`STOPPED at round ${round}: failure is not an offline-obtainability failure; see log.`);
    break;
  }
  if (pins.some((p) => p.name === pin.name)) {
    verdict = 'LOOP';
    console.log(`LOOP: already pinned ${pin.name}; see log.`);
    break;
  }
  pins.push(pin);
  writeFileSync(`${OUT}/pins.json`, `${JSON.stringify(pins, null, 2)}\n`);
}
writeFileSync(`${OUT}/iterate-log.txt`, log.join('\n'));
writeFileSync(manifestPath, `${JSON.stringify(base, null, 2)}\n`);
writeFileSync(`${OUT}/verdict.txt`, `${verdict}\npins=${pins.length}\n`);
console.log(`\nverdict=${verdict}; pins required (${pins.length}):`);
for (const p of pins) console.log(`  ${p.name} -> ${p.version}   [${p.note}]`);
