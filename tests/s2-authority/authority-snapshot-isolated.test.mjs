#!/usr/bin/env node
// S2 step-2 isolated engineering test — NOT CI, NOT Host, NOT C1/C2.
// Pure node (no framework). Fixture root is a temp dir inside this worktree; the real
// repository is never used as a publish root and no live pointer exists or is written.
// Rulings under test (root rulings + engineering rulings for this package):
//   - canonical digest = F0 rules over the snapshot object with content_digest removed;
//     published_utc IS covered; the file-byte hash is NOT the content digest.
//   - publisher whitelist = dev/engineering/authority-snapshots/<version>.json ONLY;
//     docs:sync two-file whitelist must not expand; no pointer, no registry.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync, linkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalBytes, canonicalDigest, snapshotDigest,
  validateShape, checkSnapshotObject,
} from '../../scripts/authority-snapshot.mjs';
import { GENERATED_AREAS, GENERATED_FILES } from '../../scripts/generated-write.mjs';
import { PUBLISH_REL_PATH, runPublish } from '../../scripts/publish-authority.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const REPO = resolve(here, '../..');
const EXAMPLE_PATH = join(here, 'snapshot-example.json');
const EXAMPLE_DIGEST = 'sha256:67ac0074f5e19bed0c2643afd3c88cd1c11d270f9cd0aea324096bdc4f435d64';
const EXAMPLE_BYTES = readFileSync(EXAMPLE_PATH);
const EXAMPLE = JSON.parse(EXAMPLE_BYTES.toString('utf8'));

let fails = 0;
let ran = 0;
const t = (name, fn) => {
  ran += 1;
  try { fn(); console.log(`PASS ${name}`); }
  catch (e) { fails += 1; console.log(`FAIL ${name}: ${e.message}`); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- whitelist regression: docs:sync surface verbatim, never widened ----------
t('W1 docs:sync whitelist verbatim (2 files, unchanged)', () => {
  assert(JSON.stringify(GENERATED_FILES) === JSON.stringify([
    'dev/engineering/current-state.json',
    'docs/contracts/engineering-baseline/INDEX.md',
  ]), `GENERATED_FILES changed: ${JSON.stringify(GENERATED_FILES)}`);
  assert(JSON.stringify(GENERATED_AREAS) === JSON.stringify([
    'dev/engineering', 'docs/contracts/engineering-baseline',
  ]), `GENERATED_AREAS changed: ${JSON.stringify(GENERATED_AREAS)}`);
});
t('W2 publisher whitelist is authority-snapshots only', () => {
  assert(PUBLISH_REL_PATH === 'dev/engineering/authority-snapshots', PUBLISH_REL_PATH);
});

// ---------- canonical digest (F0 rules, content_digest removed) ----------
t('V1 example shape validates against frozen schema', () => {
  const r = validateShape(EXAMPLE);
  assert(r.ok, `shape errors: ${r.errors.join('; ')}`);
});
t('V2 recomputed digest matches example vector (published_utc covered)', () => {
  assert(snapshotDigest(EXAMPLE) === EXAMPLE_DIGEST, `got ${snapshotDigest(EXAMPLE)}`);
});
t('V3 digest is NOT the raw whole-file byte hash (engineering ruling B)', () => {
  const fileHash = `sha256:${createHash('sha256').update(EXAMPLE_BYTES).digest('hex')}`;
  assert(fileHash !== EXAMPLE.content_digest, 'file byte hash must not equal content_digest');
  assert(snapshotDigest(EXAMPLE) === EXAMPLE.content_digest);
});
t('V4 canonical bytes: zero 0x0A, compact separators, keys code-point sorted', () => {
  const b = canonicalBytes({ b: 1, a: { z: [3, { y: 'é', 'ä': 2 }] }, A: true });
  const s = b.toString('utf8');
  assert(!s.includes('\n'), 'digest input must contain zero 0x0A');
  assert(s === '{"A":true,"a":{"z":[3,{"y":"é","ä":2}]},"b":1}', s); // code-point sort: y(0x79) < ä(0xE4)
  assert(Buffer.from(s, 'utf8').includes(Buffer.from('é', 'utf8')), 'non-ASCII must be raw UTF-8, not \\u escaped');
  assert(!s.includes('\\u'), `non-ASCII escaped, not raw: ${s}`);
  assert(canonicalDigest(EXAMPLE).startsWith('sha256:'));
});
t('V5 published_utc is covered by the digest (mutate -> mismatch)', () => {
  const m = clone(EXAMPLE);
  m.published_utc = '2026-10-25T02:24:55Z';
  const r = checkSnapshotObject(m);
  assert(!r.ok && r.errors.some((e) => e.startsWith('DIGEST_MISMATCH')), r.errors.join(';'));
});
t('V6 digest mismatch detected when content_digest edited', () => {
  const m = clone(EXAMPLE);
  m.content_digest = `sha256:${'0'.repeat(64)}`;
  const r = checkSnapshotObject(m);
  assert(!r.ok && r.errors.some((e) => e.startsWith('DIGEST_MISMATCH')), r.errors.join(';'));
});

// ---------- schema rejections (negative controls) ----------
const shapeRejected = (name, mutate, frag) => t(name, () => {
  const m = clone(EXAMPLE);
  mutate(m);
  const r = validateShape(m);
  assert(!r.ok, 'expected rejection, got ok');
  if (frag) assert(r.errors.some((e) => e.includes(frag)), `expected frag ${frag} in ${r.errors.join(';')}`);
});
shapeRejected('N1 missing current_contract.matrix rejected', (m) => { delete m.current_contract.matrix; }, 'matrix');
shapeRejected('N2 7th current_contract field rejected', (m) => { m.current_contract.extra = 1; }, 'UNEXPECTED_KEY current_contract.extra');
shapeRejected('N3 unknown top-level key rejected', (m) => { m.ninth = 1; }, 'UNEXPECTED_KEY ninth');
shapeRejected('N4 version placeholder "v3" is not a legal version', (m) => { m.snapshot_version = 'v3'; }, 'snapshot_version');
shapeRejected('N5 baseline not 40hex rejected', (m) => { m.current_contract.baseline = 'abc'; }, 'baseline');
shapeRejected('N6 backlog with space rejected', (m) => { m.current_contract.backlog = 'a b.md'; }, 'backlog');
shapeRejected('N7 active_plan wrong prefix rejected', (m) => { m.current_contract.active_plan = 'docs/plans/paused/x.md'; }, 'active_plan');
shapeRejected('N8 bad published_utc grammar rejected', (m) => { m.published_utc = '2026-10-25 02:24:54'; }, 'published_utc');
shapeRejected('N9 authored_from without commit anchor rejected', (m) => { m.authored_from = 'dev/agent-workflow/graph.yaml#current_contract'; }, 'authored_from');

// ---------- publish: immutable, whitelisted, link-safe; isolated fixture root ----------
const root = mkdtempSync(join(REPO, '.tmp-s2-iso-'));
const goodFile = join(root, 'draft.json');
writeFileSync(goodFile, JSON.stringify(EXAMPLE, null, 2));
const snapRel = join('dev', 'engineering', 'authority-snapshots', 'as20261025r1.json');
const snapAbs = join(root, snapRel);

t('P1 publish writes only the whitelisted immutable snapshot (canonical bytes + trailing LF)', () => {
  const r = runPublish([goodFile, '--root', root]);
  assert(r.code === 0, `publish failed: ${JSON.stringify(r)}`);
  assert(existsSync(snapAbs), 'snapshot not created');
  const onDisk = readFileSync(snapAbs);
  assert(onDisk[onDisk.length - 1] === 0x0a, 'file must end with one trailing LF');
  const body = onDisk.subarray(0, onDisk.length - 1);
  assert(Buffer.compare(body, canonicalBytes({ ...EXAMPLE })) === 0, 'body must be canonical bytes (zero 0x0A)');
  const rr = checkSnapshotObject(JSON.parse(body.toString('utf8')));
  assert(rr.ok, `re-check on disk failed: ${rr.errors.join(';')}`);
});
t('P2 republish refused (immutable); bytes verbatim before/after', () => {
  const before = readFileSync(snapAbs); // captured BEFORE the refused attempt
  const r = runPublish([goodFile, '--root', root]);
  assert(r.code === 2 && /OVERWRITE_REFUSED/.test(r.why || ''), JSON.stringify(r));
  const after = readFileSync(snapAbs);
  assert(Buffer.compare(before, after) === 0, 'snapshot bytes changed across a refused republish');
});
t('P3 symlinked snapshots dir refused; outside target untouched', () => {
  const r2 = mkdtempSync(join(REPO, '.tmp-s2-iso-'));
  const outside = join(r2, 'outside.json');
  writeFileSync(outside, 'SENTINEL');
  mkdirSync(join(r2, 'dev', 'engineering'), { recursive: true });
  symlinkSync(outside, join(r2, 'dev', 'engineering', 'authority-snapshots'));
  const r = runPublish([goodFile, '--root', r2]);
  assert(r.code === 2 && /SYMLINK_ANCESTOR/.test(r.why || ''), JSON.stringify(r));
  assert(readFileSync(outside, 'utf8') === 'SENTINEL', 'sentinel overwritten!');
  rmSync(r2, { recursive: true, force: true });
});
t('P4 hardlink second-name target refused', () => {
  const r3 = mkdtempSync(join(REPO, '.tmp-s2-iso-'));
  mkdirSync(join(r3, 'dev', 'engineering', 'authority-snapshots'), { recursive: true });
  const other = join(r3, 'other');
  writeFileSync(other, 'X');
  linkSync(other, snapAbsAt(r3));
  const r = runPublish([goodFile, '--root', r3]);
  assert(r.code === 2 && /OVERWRITE_REFUSED|HARDLINK_TARGET/.test(r.why || ''), JSON.stringify(r));
  assert(readFileSync(other, 'utf8') === 'X');
  rmSync(r3, { recursive: true, force: true });
});
t('P5 no pointer / registry / other artifact is ever produced', () => {
  // root now contains exactly: draft.json + dev/engineering/authority-snapshots/<one file>
  assert(!existsSync(join(root, 'dev', 'engineering', 'current-authority.json')), 'pointer must not be written');
  assert(!existsSync(join(root, 'registry.yaml')), 'registry must not be written');
  assert(readdirSync(join(root, 'dev', 'engineering', 'authority-snapshots')).join() === 'as20261025r1.json');
});
function snapAbsAt(r) { return join(r, snapRel); }
t('P6 invalid draft refused at publish (bad version path rejected before any write)', () => {
  const bad = clone(EXAMPLE);
  bad.snapshot_version = '../escape';
  const badFile = join(root, 'bad.json');
  writeFileSync(badFile, JSON.stringify(bad));
  const r = runPublish([badFile, '--root', root]);
  assert(r.code === 2, JSON.stringify(r));
  assert(!existsSync(join(root, 'dev', 'engineering', 'authority-snapshots', '..', 'escape.json')));
});
t('P7 check CLI exits 0 on example, 2 on digest-corrupted copy', () => {
  const cli = join(REPO, 'scripts', 'publish-authority.mjs');
  const ok = execFileSync('node', [cli, 'check', EXAMPLE_PATH], { encoding: 'utf8' });
  assert(/"ok":\s*true/.test(ok) || /OK/.test(ok), ok);
  const broken = clone(EXAMPLE);
  broken.current_contract.baseline = 'f'.repeat(40); // shape ok, digest wrong
  const bf = join(root, 'broken.json');
  writeFileSync(bf, JSON.stringify(broken));
  let code = 0;
  try { execFileSync('node', [cli, 'check', bf], { encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { code = e.status; }
  assert(code === 2, `expected exit 2, got ${code}`);
});

// ---------- review-fix negatives (must be RED at 291165d79a) ----------
const ownKey = (obj, key, val) => { // guaranteed OWN enumerable key, bypassing __proto__ setters
  Object.defineProperty(obj, key, { value: val, enumerable: true, writable: true, configurable: true });
  return obj;
};
t('P8 symlinked dev/engineering ancestor: refused BEFORE any mkdir; external dir gains nothing', () => {
  const r4 = mkdtempSync(join(REPO, '.tmp-s2-iso-'));
  const outside = mkdtempSync(join(REPO, '.tmp-s2-iso-')); // external REAL dir
  mkdirSync(join(r4, 'dev'), { recursive: true });
  symlinkSync(outside, join(r4, 'dev', 'engineering')); // mid-level link, lower level absent
  const before = readdirSync(outside).join('|');
  const r = runPublish([goodFile, '--root', r4]);
  const gained = readdirSync(outside).join('|');
  assert(r.code === 2 && /SYMLINK_ANCESTOR/.test(r.why || ''), JSON.stringify(r));
  assert(gained === before, `external dir gained entries: "${before}" -> "${gained}"`);
  rmSync(r4, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true });
});
t('N10 own "constructor" key at root rejected (hasOwn, not in)', () => {
  const r = validateShape(ownKey(clone(EXAMPLE), 'constructor', 1));
  assert(!r.ok && r.errors.some((e) => e.includes('UNEXPECTED_KEY constructor')), r.errors.join(';') || 'ACCEPTED');
});
t('N11 own "__proto__" key: rejected; canonical must not swallow it', () => {
  const polluted = ownKey(clone(EXAMPLE), '__proto__', 1);
  assert(Object.hasOwn(polluted, '__proto__'), 'fixture lost its own key');
  const r = validateShape(polluted);
  assert(!r.ok && r.errors.some((e) => e.includes('UNEXPECTED_KEY __proto__')), r.errors.join(';') || 'ACCEPTED');
  const canon = canonicalBytes(JSON.parse('{"__proto__":1}')).toString('utf8');
  assert(canon === '{"__proto__":1}', `canonical swallowed the key: ${canon}`);
  assert(snapshotDigest(polluted) !== snapshotDigest(EXAMPLE), 'digest ignored the own __proto__ key');
});
t('N12 own "toString" key in current_contract rejected', () => {
  const m = clone(EXAMPLE);
  ownKey(m.current_contract, 'toString', 1);
  const r = validateShape(m);
  assert(!r.ok && r.errors.some((e) => e.includes('UNEXPECTED_KEY current_contract.toString')), r.errors.join(';') || 'ACCEPTED');
});
t('V7 current_phase_statement digit INCONSISTENT with phase_id refused (frozen Q1 check)', () => {
  const m = clone(EXAMPLE);
  m.current_phase_statement = 'ALPHA.6 TOOL-IO-GOVERNANCE PHASE'; // phase_id says alpha5
  m.content_digest = snapshotDigest(m); // shape+digest ok; only the digit check may fire
  const r = checkSnapshotObject(m);
  assert(!r.ok && r.errors.some((e) => e.startsWith('PHASE_STATEMENT_DIGIT_MISMATCH')), r.errors.join(';') || 'ACCEPTED');
});
t('V8 current_phase_statement digit CONSISTENT positive (ALPHA.5 vs alpha5-*, still optional)', () => {
  const r = checkSnapshotObject(EXAMPLE); // example carries a consistent statement
  assert(r.ok, r.errors.join(';'));
});

rmSync(root, { recursive: true, force: true });
console.log(fails === 0 ? `ALL GREEN (${ran} cases, actual count)` : `RED (${fails}/${ran} failing, actual count)`);
process.exit(fails === 0 ? 0 : 1);
