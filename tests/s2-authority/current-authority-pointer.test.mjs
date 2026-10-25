#!/usr/bin/env node
// U2 (G2 switchover) — pointer loader + switch transaction + consumer-default tests (pure node).
// Named controls required by plan U2 and G2 review R1:
//   transaction success · precondition mismatch refusal · digest mismatch refusal ·
//   symlink target refusal · injected failure after temp write → EXACT previous bytes restored ·
//   two-current guard RED · consumer reads pointer by default · missing pointer RED (no graph
//   fallback) · forged snapshot edit (the "forged C2" class: bytes edited after publish) ·
//   wrong version ID grammar · old/new conflict (pointer + restored graph block).
// ISOLATED engineering test: NOT CI/Host/C1/C2. Temp fixtures live under REPO like the sibling
// suites (.tmp-s2-*); every fixture is created here and removed here.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, symlinkSync, linkSync, lstatSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { snapshotDigest } from '../../scripts/authority-snapshot.mjs';
import { loadPointerAuthority, pointerExists, twoCurrentFindings, POINTER_REL, SNAPSHOTS_REL, EXPECTED_BASELINE_REF } from '../../scripts/current-authority.mjs';
import { switchAuthority, pointerBytes } from '../../scripts/switch-authority.mjs';
import { build } from '../../scripts/gen-current-state.mjs';
import { checkPointerCurrentContract } from '../../scripts/ci-pr-gate.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const REPO = resolve(here, '../..');
const EXAMPLE = JSON.parse(readFileSync(join(here, 'snapshot-example.json'), 'utf8'));

let fails = 0, ran = 0;
const t = (n, f) => { ran += 1; try { f(); console.log(`PASS ${n}`); } catch (e) { fails += 1; console.log(`FAIL ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

const sha256 = (buf) => `sha256:${createHash('sha256').update(buf).digest('hex')}`;

const createdRoots = []; // every fixture root; swept at exit even when an assertion throws mid-test
/** Fixture root: dev/engineering with registry + optional snapshot + optional pointer. */
const mkRoot = ({ snapshot = true, pointer = true, graph = false, edit = null } = {}) => {
  const root = mkdtempSync(join(REPO, '.tmp-u2-ptr-'));
  createdRoots.push(root);
  mkdirSync(join(root, 'dev', 'engineering', 'authority-snapshots'), { recursive: true });
  mkdirSync(join(root, 'dev', 'agent-workflow'), { recursive: true });
  mkdirSync(join(root, 'docs', 'contracts', 'engineering-baseline'), { recursive: true });
  writeFileSync(join(root, 'docs/contracts/engineering-baseline/ids.yaml'), 'ids: []\n'); // build() names this input; keep its git read quiet
  writeFileSync(join(root, 'dev/engineering/registry.yaml'), 'schema_version: 1\nmigration_of_legacy_consumers: none\nlegacy_execution_authority: graph\nentries:\n  - id: T-001\n');
  if (snapshot) {
    const obj = edit ? edit({ ...EXAMPLE, current_contract: { ...EXAMPLE.current_contract } }) : EXAMPLE;
    const file = join(root, SNAPSHOTS_REL, `${obj.snapshot_version}.json`);
    writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
  }
  if (pointer) writeFileSync(join(root, POINTER_REL), pointerBytes(EXAMPLE.snapshot_version, EXAMPLE.content_digest));
  if (graph) {
    const cc = EXAMPLE.current_contract;
    writeFileSync(join(root, 'dev/agent-workflow/graph.yaml'),
      `current_phase: "${EXAMPLE.current_phase_statement}"\ncurrent_contract:\n${Object.entries(cc).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\n`);
  }
  return root;
};
const clean = (...ds) => ds.forEach((d) => rmSync(d, { recursive: true, force: true }));

// ───────────────────────────── loader ─────────────────────────────
t('L1 valid pointer → six values + statement + digest, source = snapshot file', () => {
  const root = mkRoot();
  const r = loadPointerAuthority(root);
  assert(r.ok && r.status === 'POINTER', JSON.stringify(r));
  assert(r.six.phase_id === EXAMPLE.current_contract.phase_id && r.six.baseline === EXAMPLE.current_contract.baseline, 'six values wrong');
  assert(r.content_digest === EXAMPLE.content_digest && r.snapshot_version === EXAMPLE.snapshot_version, 'binding wrong');
  assert(r.current_phase_statement === EXAMPLE.current_phase_statement, 'statement not carried');
  assert(r.snapshot_file === `${SNAPSHOTS_REL}/${EXAMPLE.snapshot_version}.json`, 'snapshot path wrong');
  clean(root);
});

t('L2 missing pointer → status ABSENT, never values, never the mirror', () => {
  const root = mkRoot({ pointer: false });
  const r = loadPointerAuthority(root);
  assert(!r.ok && r.status === 'ABSENT' && r.refused === 'POINTER_ABSENT', JSON.stringify(r));
  assert(!('six' in r), 'an absent pointer must carry NO values');
  clean(root);
});

t('L3 digest mismatch (forged snapshot edit after publish) → INVALID, no fallback', () => {
  // The "forged C2" class applied to the authority itself: bytes edited AFTER publishing.
  const root = mkRoot({ edit: (o) => { o.current_contract.baseline = 'f'.repeat(40); return o; } });
  const r = loadPointerAuthority(root);
  assert(!r.ok && r.status === 'INVALID', JSON.stringify(r));
  assert(/DIGEST/.test(String(r.refused)), `expected a digest refusal, got ${r.refused}`);
  clean(root);
});

t('L3b pointer digest edited (pointer↔snapshot disagreement) → INVALID', () => {
  const root = mkRoot();
  writeFileSync(join(root, POINTER_REL), JSON.stringify({ snapshot_version: EXAMPLE.snapshot_version, content_digest: `sha256:${'a'.repeat(64)}` }) + '\n');
  const r = loadPointerAuthority(root);
  assert(!r.ok && /EXPECTED/.test(String(r.refused)), JSON.stringify(r));
  clean(root);
});

t('L4 wrong version ID grammar (pointer and snapshot-name) → INVALID, never a path traversal', () => {
  const root = mkRoot();
  writeFileSync(join(root, POINTER_REL), JSON.stringify({ snapshot_version: '../evil', content_digest: EXAMPLE.content_digest }) + '\n');
  assert(!loadPointerAuthority(root).ok && loadPointerAuthority(root).refused === 'POINTER_VERSION', 'traversal-ish version must be refused by grammar');
  const r2 = mkRoot();
  writeFileSync(join(r2, POINTER_REL), JSON.stringify({ snapshot_version: 'v1', content_digest: EXAMPLE.content_digest }) + '\n');
  assert(loadPointerAuthority(r2).refused === 'POINTER_VERSION', 'v1 is not asYYYYMMDDrN');
  clean(root, r2);
});

t('L5 symlinked pointer → refusal, never followed', () => {
  const root = mkRoot({ pointer: false });
  const outside = mkdtempSync(join(REPO, '.tmp-u2-out-'));
  const real = join(outside, 'ptr.json');
  writeFileSync(real, pointerBytes(EXAMPLE.snapshot_version, EXAMPLE.content_digest));
  symlinkSync(real, join(root, POINTER_REL));
  const r = loadPointerAuthority(root);
  assert(!r.ok && r.refused === 'POINTER_SYMLINK', JSON.stringify(r));
  clean(root, outside);
});

t('L6 symlinked snapshot → refusal, never followed', () => {
  const root = mkRoot({ snapshot: false });
  const outside = mkdtempSync(join(REPO, '.tmp-u2-out-'));
  const real = join(outside, 'snap.json');
  writeFileSync(real, JSON.stringify(EXAMPLE));
  symlinkSync(real, join(root, SNAPSHOTS_REL, `${EXAMPLE.snapshot_version}.json`));
  const r = loadPointerAuthority(root);
  assert(!r.ok && /SYMLINK/.test(String(r.refused)), JSON.stringify(r));
  clean(root, outside);
});

t('L7 extra pointer key → POINTER_KEYS (a third key is a second authority)', () => {
  const root = mkRoot();
  writeFileSync(join(root, POINTER_REL), JSON.stringify({ snapshot_version: EXAMPLE.snapshot_version, content_digest: EXAMPLE.content_digest, phase_id: 'alpha9-sneak' }) + '\n');
  assert(loadPointerAuthority(root).refused === 'POINTER_KEYS', 'extra key accepted');
  clean(root);
});

// ───────────────────────────── transaction ─────────────────────────────
t('S1 switch transaction success (absent → pointer created, re-verified via the loader)', () => {
  const root = mkRoot({ pointer: false });
  const r = switchAuthority(root, { snapshotVersion: EXAMPLE.snapshot_version, expectedDigest: EXAMPLE.content_digest, expectPointerAbsent: true });
  assert(r.ok && r.switched, JSON.stringify(r));
  assert(r.previous_pointer.existed === false, 'previous recorded wrong');
  const l = loadPointerAuthority(root);
  assert(l.ok && l.content_digest === EXAMPLE.content_digest, 'loader refuses what the transaction wrote');
  clean(root);
});

t('S2 precondition mismatch refusals touch ZERO bytes', () => {
  const root = mkRoot();
  const before = readFileSync(join(root, POINTER_REL));
  const a = switchAuthority(root, { snapshotVersion: EXAMPLE.snapshot_version, expectedDigest: EXAMPLE.content_digest, expectPointerAbsent: true });
  assert(!a.ok && /POINTER_PRECONDITION/.test(a.why), JSON.stringify(a));
  assert(readFileSync(join(root, POINTER_REL)).equals(before), 'bytes moved despite refusal');
  const b = switchAuthority(root, { snapshotVersion: EXAMPLE.snapshot_version, expectedDigest: EXAMPLE.content_digest, expectPointerDigest: `sha256:${'b'.repeat(64)}` });
  assert(!b.ok && /POINTER_PRECONDITION/.test(b.why), JSON.stringify(b));
  assert(readFileSync(join(root, POINTER_REL)).equals(before), 'bytes moved despite digest-precondition refusal');
  clean(root);
});

t('S3 target digest mismatch refusal (wrong --expected-digest) touches ZERO bytes', () => {
  const root = mkRoot({ pointer: false });
  const r = switchAuthority(root, { snapshotVersion: EXAMPLE.snapshot_version, expectedDigest: `sha256:${'c'.repeat(64)}`, expectPointerAbsent: true });
  assert(!r.ok && /SNAPSHOT_REFUSED/.test(r.why) && /EXPECTED/.test(r.why), JSON.stringify(r));
  assert(!existsSync(join(root, POINTER_REL)), 'pointer created despite target refusal');
  clean(root);
});

t('S4 symlink target refusal: an existing pointer that is a symlink is never followed or replaced', () => {
  const root = mkRoot({ pointer: false });
  const outside = mkdtempSync(join(REPO, '.tmp-u2-out-'));
  const real = join(outside, 'target.json');
  const realBytes = JSON.stringify({ snapshot_version: 'as20200101r1', content_digest: `sha256:${'d'.repeat(64)}` }) + '\n';
  writeFileSync(real, realBytes);
  symlinkSync(real, join(root, POINTER_REL));
  const r = switchAuthority(root, { snapshotVersion: EXAMPLE.snapshot_version, expectedDigest: EXAMPLE.content_digest, expectPointerAbsent: true });
  assert(!r.ok && /POINTER_SYMLINK/.test(r.why), JSON.stringify(r));
  assert(readFileSync(real, 'utf8') === realBytes, 'the symlink TARGET was written through');
  clean(root, outside);
});

t('S5 hardlink target refusal: an existing pointer sharing its inode is never written through', () => {
  const root = mkRoot();
  const other = join(root, 'shared-inode.txt');
  const before = readFileSync(join(root, POINTER_REL));
  linkSync(join(root, POINTER_REL), other); // nlink 2
  const r = switchAuthority(root, { snapshotVersion: EXAMPLE.snapshot_version, expectedDigest: sha256(Buffer.concat([before])), expectPointerDigest: sha256(before) });
  assert(!r.ok && /POINTER_HARDLINK/.test(r.why), JSON.stringify(r));
  assert(readFileSync(other).equals(before), 'shared inode changed');
  clean(root);
});

t('S6 injected failure AFTER TEMP WRITE → exact previous bytes restored (real interrupted transaction)', () => {
  const root = mkRoot();
  const before = readFileSync(join(root, POINTER_REL));
  const beforeDigest = sha256(before);
  const otherVersion = { ...EXAMPLE, snapshot_version: 'as20261025r2' };
  otherVersion.content_digest = snapshotDigest(otherVersion);
  writeFileSync(join(root, SNAPSHOTS_REL, 'as20261025r2.json'), JSON.stringify(otherVersion) + '\n');
  process.env.U2_SWITCH_INJECT_FAIL = 'after-temp-write';
  let r;
  try { r = switchAuthority(root, { snapshotVersion: 'as20261025r2', expectedDigest: otherVersion.content_digest, expectPointerDigest: beforeDigest }); } finally { delete process.env.U2_SWITCH_INJECT_FAIL; }
  assert(!r.ok && !r.switched, JSON.stringify(r));
  assert(r.restore_ok === true, `restore did not verify: ${JSON.stringify(r.restore)}`);
  assert(readFileSync(join(root, POINTER_REL)).equals(before), 'restored bytes are NOT byte-identical to the previous pointer');
  clean(root);
});

t('S6b injected failure after RENAME, pointer was absent → exact ABSENCE restored', () => {
  const root = mkRoot({ pointer: false });
  process.env.U2_SWITCH_INJECT_FAIL = 'after-rename';
  let r;
  try { r = switchAuthority(root, { snapshotVersion: EXAMPLE.snapshot_version, expectedDigest: EXAMPLE.content_digest, expectPointerAbsent: true }); } finally { delete process.env.U2_SWITCH_INJECT_FAIL; }
  assert(!r.ok && !r.switched, JSON.stringify(r));
  assert(r.restore_ok === true, `restore did not verify: ${JSON.stringify(r.restore)}`);
  assert(!existsSync(join(root, POINTER_REL)), 'pointer left behind after failed switch from absence');
  assert(loadPointerAuthority(root).status === 'ABSENT', 'loader does not see the restored absence');
  clean(root);
});

t('S7 repoint under precondition: old digest supplied → switched; a stale expectation → refused', () => {
  const root = mkRoot();
  const oldBytes = readFileSync(join(root, POINTER_REL));
  const other = { ...EXAMPLE, snapshot_version: 'as20261025r3' };
  other.content_digest = snapshotDigest(other);
  writeFileSync(join(root, SNAPSHOTS_REL, 'as20261025r3.json'), JSON.stringify(other) + '\n');
  const bad = switchAuthority(root, { snapshotVersion: 'as20261025r3', expectedDigest: other.content_digest, expectPointerDigest: sha256(Buffer.from('stale')) });
  assert(!bad.ok && /POINTER_PRECONDITION/.test(bad.why), JSON.stringify(bad));
  const ok = switchAuthority(root, { snapshotVersion: 'as20261025r3', expectedDigest: other.content_digest, expectPointerDigest: sha256(oldBytes) });
  assert(ok.ok, JSON.stringify(ok));
  assert(loadPointerAuthority(root).snapshot_version === 'as20261025r3', 'repoint not visible to the loader');
  clean(root);
});

t('S8 pointer bytes are deterministic (canonical two-key + one LF)', () => {
  const a = pointerBytes('as20261025r1', EXAMPLE.content_digest);
  const b = pointerBytes('as20261025r1', EXAMPLE.content_digest);
  assert(a.equals(b), 'serialization is not deterministic');
  assert(a.toString().endsWith('\n') && !a.subarray(0, a.length - 1).includes(0x0a), 'file = canonical bytes (zero LF inside) + exactly one trailing LF');
  assert(JSON.parse(a.toString()).snapshot_version === 'as20261025r1', 'roundtrip');
});

// ───────────────────────────── two-current guard ─────────────────────────────
t('G1 two-current guard: pointer + graph block → named RED; pointer alone green; block alone is not the guard\'s business', () => {
  const both = mkRoot({ graph: true });
  const f = twoCurrentFindings(both);
  assert(f.length === 1 && f[0].startsWith('TWO_CURRENT_AUTHORITY'), JSON.stringify(f));
  const only = mkRoot({ graph: false });
  assert(twoCurrentFindings(only).length === 0, 'clean switch must not fire');
  const pre = mkRoot({ pointer: false, graph: true });
  assert(twoCurrentFindings(pre).length === 0, 'guard is pointer-conditional by design');
  clean(both, only, pre);
});

t('G1b the ci-pr-gate pointer entry itself grades the two-current state RED', () => {
  const root = mkRoot({ graph: true });
  const graphText = readFileSync(join(root, 'dev/agent-workflow/graph.yaml'), 'utf8');
  const r = checkPointerCurrentContract({ root, graphText, readFile: () => null, fileExists: () => false, revExists: () => true, baselineCurrent: () => true, driftProvider: () => [] });
  assert(r.refused === 'TWO_CURRENT_AUTHORITY', JSON.stringify(r.findings));
  assert(r.findings[0].includes('TWO_CURRENT_AUTHORITY'), 'named finding missing');
  clean(root);
});

// ───────────────────────────── consumer defaults read the pointer ─────────────────────────────
t('C1 gen-current-state build() DEFAULT reads the pointer-resolved snapshot (source binding recorded)', () => {
  const root = mkRoot({ graph: true }); // even WITH a stale block present, the pointer wins; the block is reported, never read
  const built = build(root);
  assert(!built.refused, 'default build refused: ' + JSON.stringify(built.refused));
  const b = built.view.authority_source_binding;
  assert(b && b.kind === 'authority-pointer' && b.content_digest === EXAMPLE.content_digest, JSON.stringify(b));
  assert(built.view.legacy_authority.phase_id === EXAMPLE.current_contract.phase_id, 'mirror not fed by the snapshot');
  // two-current is reported as a blocking finding, NOT resolved by reading the block:
  const f = built.findings.find((x) => x.code === 'POINTER_AND_GRAPH_BLOCK_BOTH_PRESENT');
  assert(f, 'two-current refusal mode missing from checkPointerMirror');
  clean(root);
});

t('C1b clean switch tree: pointer default, no two-current finding, mirror from snapshot', () => {
  const root = mkRoot({ graph: false });
  const built = build(root);
  assert(!built.refused && built.findings.every((x) => !String(x.code).startsWith('POINTER_')), JSON.stringify(built.findings));
  assert(built.view.legacy_authority.baseline === EXAMPLE.current_contract.baseline, 'six values not mirrored');
  clean(root);
});

t('C2 invalid pointer FAILS THE BUILD — no fallback to graph or mirror', () => {
  const root = mkRoot({ graph: true, edit: (o) => { o.current_contract.matrix = 'docs/plans/active/alpha5-tool-io-governance/SOMETHING-ELSE.md'; return o; } });
  const built = build(root);
  assert(built.refused && /DIGEST/.test(String(built.refused)), JSON.stringify(built));
  clean(root);
});

t('C3 missing pointer + missing block = RED in the pointer entry (no graph fallback exists)', () => {
  const root = mkRoot({ pointer: false, snapshot: false });
  const r = checkPointerCurrentContract({ root, graphText: 'current_phase: "x"\n', readFile: () => null, fileExists: () => false, revExists: () => true, baselineCurrent: () => true, driftProvider: () => [] });
  assert(r.refused === 'POINTER_ABSENT' && r.findings[0].includes('AUTHORITY_POINTER_ABSENT'), JSON.stringify(r));
  clean(root);
});

t('C4 pointer entry runs the SAME core: a valid pointer tree grades green with all six values surfaced', () => {
  const root = mkRoot();
  const cc = EXAMPLE.current_contract;
  const docs = `<!-- phase-baseline-ref: ${EXPECTED_BASELINE_REF} -->\n<!-- phase-identity: ${cc.phase_id} -->\n# doc\n`;
  const matrix = docs + '<!-- q5:main-begin -->\n| ①行ID | ② | ③ | ④ | ⑤ | ⑥ | ⑦ | ⑧ | V@B |\n|---|---|---|---|---|---|---|---|---|\n| a | x | y | z | w | Unit 无；n/a | — | NOT_IMPLEMENTED | no |\n<!-- q5:main-end -->\n<!-- q5:appendix-begin -->\n- **fixture_probe** [opt-in] — 逐名：UNKNOWN（主表无行；缺口登记）\n<!-- q5:appendix-end -->\n';
  const map = new Map(Object.entries({
    'AGENTS.md': docs,
    [cc.active_plan]: docs,
    [cc.backlog]: docs + '\n| BL-01 | x | OPEN | x |\n',
    [cc.matrix]: matrix,
  }));
  const r = checkPointerCurrentContract({
    root,
    graphText: `current_phase: "${EXAMPLE.current_phase_statement}"\nready: []\nblocked: [BL-01]\n`,
    readFile: (p) => map.get(p) ?? null,
    fileExists: (p) => map.has(p),
    revExists: () => true,
    baselineCurrent: () => true,
    driftProvider: () => [],
  });
  assert(r.findings.length === 0, 'pointer-mode green tree graded red: ' + JSON.stringify(r.findings));
  assert(r.info.contract.baseline === cc.baseline && r.info.contract.backlog === cc.backlog && r.info.contract.matrix === cc.matrix && r.info.contract.baseline_collected === cc.baseline_collected, 'all six values must be surfaced');
  assert(r.info.authority_source.kind === 'pointer' && r.info.authority_source.content_digest === EXAMPLE.content_digest, 'source not recorded');
  clean(root);
});

t('C5 pointer entry red on carriers still citing the retired block (Q6 moved with the source)', () => {
  const root = mkRoot();
  const cc = EXAMPLE.current_contract;
  const stale = (p) => `<!-- phase-baseline-ref: dev/agent-workflow/graph.yaml#current_contract -->\n<!-- phase-identity: ${cc.phase_id} -->\n# doc\n`;
  const map = new Map(Object.entries({ 'AGENTS.md': stale(), [cc.active_plan]: stale(), [cc.backlog]: stale(), [cc.matrix]: stale() }));
  const r = checkPointerCurrentContract({
    root, graphText: `current_phase: "${EXAMPLE.current_phase_statement}"\n`,
    readFile: (p) => map.get(p) ?? null, fileExists: (p) => map.has(p),
    revExists: () => true, baselineCurrent: () => true, driftProvider: () => [],
  });
  assert(r.findings.filter((x) => x.startsWith('Q6:')).length === 4, JSON.stringify(r.findings));
  clean(root);
});

console.log(`u2-current-authority: ${ran - fails}/${ran} passed`);
process.exit(fails === 0 ? 0 : 1);
