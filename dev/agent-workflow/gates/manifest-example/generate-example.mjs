#!/usr/bin/env node
/**
 * generate-example.mjs — regenerate evidence-manifest.json for the worked example.
 *
 * Worked example = REAL existing evidence dir:
 *   dev/agent-workflow/evidence/u7r3-pilot-c2-20261029  (tracked at origin/master)
 *
 * Hashes are computed with `sha256sum` (coreutils), sizes with `stat -c %s` —
 * the same primitives evidence-verify.mjs (planned, see rules doc §6) will use.
 * The secret scan below is a real scan over the real bytes: it matches the
 * boot-token / session-cookie shapes documented in scripts/sanitize-evidence.mjs
 * (`/?token=`, `dsh-auth-`, `authorization:`, `x-api-key`). It records finding
 * COUNTS and byte offsets only — never the matched secret value itself.
 *
 * Reproduce:
 *   node dev/agent-workflow/gates/manifest-example/generate-example.mjs
 * Writes evidence-manifest.json next to this file. Every sha256/size must come
 * out byte-identical; only `createdAt` moves between runs.
 *
 * This is an EXAMPLE GENERATOR, not the production tool: it hard-codes the
 * example dir and classification map. The production tool is the planned
 * scripts/evidence-verify.mjs (rules doc §6). It is read-only over the
 * evidence tree and writes only this manifest — never the artifacts.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..', '..'); // manifest-example -> gates -> agent-workflow -> dev -> repo root
const INDEXED_PATH = 'dev/agent-workflow/evidence/u7r3-pilot-c2-20261029';
const dir = join(repoRoot, INDEXED_PATH);

// ── classification map (rules doc §4 retention table, policy rows R1–R7) ──────
// Row ids reference EVIDENCE-OFFLOAD-RULES-20261031.md §4.
function classify(relPath) {
  const base = relPath.split('/').pop();
  if (/run-record\.json$/.test(base)) return { class: 'run-record', lane: 'git-forever', row: 'R1' };
  if (/\.oracle\.json$/.test(base)) return { class: 'verdict-artifact', lane: 'git-forever', row: 'R2' };
  if (/(?:digest|evidence)\.json$/.test(base)) return { class: 'settlement-digest', lane: 'git-forever', row: 'R3' };
  if (/^host-starts/.test(base)) return { class: 'boot-ledger', lane: 'git-forever', row: 'R4' };
  if (/^composed-profile-.*\.patch\.yml$/.test(base)) return { class: 'profile-snapshot', lane: 'git-forever', row: 'R5' };
  if (/^instance-port\d+\.log$/.test(base)) return { class: 'host-log', lane: 'offload-eligible', row: 'R6' };
  if (/\.stdout\.log$/.test(base)) return { class: 'transcript-log', lane: 'offload-eligible', row: 'R6' };
  if (base === 'setup-failure.json') return { class: 'raw-receipt', lane: 'offload-eligible', row: 'R7' };
  return { class: 'uncategorized', lane: 'offload-eligible', row: 'R7' };
}

// ── real secret scan (counts + offsets only; never the matched value) ─────────
const SECRET_PATTERNS = [
  { id: 'boot-token-url', re: /[?&]token=[A-Za-z0-9_\-.]{16,}/g },
  { id: 'dsh-auth-cookie', re: /dsh-auth-[A-Za-z0-9_\-.]{8,}/g },
  { id: 'authorization-header', re: /authorization\s*:\s*bearer\s+\S{16,}/gi },
  { id: 'x-api-key', re: /x-api-key\s*[:=]\s*\S{12,}/gi },
];
function secretScan(absPath) {
  let text;
  try {
    text = readFileSync(absPath, 'utf8');
  } catch {
    return { status: 'unchecked', note: 'unreadable-as-utf8' };
  }
  const findings = [];
  for (const { id, re } of SECRET_PATTERNS) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      findings.push({ pattern: id, offset: m.index, length: m[0].length }); // value NOT recorded
      if (findings.length >= 64) break;
    }
  }
  return findings.length === 0
    ? { status: 'clean' }
    : { status: 'finding', count: findings.length, sample: findings.slice(0, 4) };
}

// ── walk + hash (sha256sum) + size (stat) ─────────────────────────────────────
function walk(absDir) {
  const out = [];
  for (const name of readdirSync(absDir)) {
    const abs = join(absDir, name);
    if (statSync(abs).isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out.sort();
}

const git = (...args) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');

const artifacts = [];
for (const abs of walk(dir)) {
  const rel = relative(repoRoot, abs).split('\\').join('/');
  const sha256 = execFileSync('sha256sum', [abs], { encoding: 'utf8' }).trim().split(/\s+/)[0];
  const sizeBytes = Number(execFileSync('stat', ['-c', '%s', abs], { encoding: 'utf8' }).trim());
  const { class: cls, lane, row } = classify(rel);
  const secretScanResult = secretScan(abs);
  // EO-4/R6: a secret finding on an offload-eligible original forces lane=restricted
  // until sanitize-evidence.mjs output (or an access-controlled-store ruling) closes it.
  const effectiveLane = secretScanResult.status === 'finding' && lane === 'offload-eligible' ? 'restricted' : lane;
  artifacts.push({
    path: rel,
    sha256,
    sizeBytes,
    class: cls,
    retention: { lane: effectiveLane, policyRow: row },
    location: { state: 'in-git', uri: null, uploadedAt: null, verifiedAt: null },
    sensitivity: { secretScan: { checkedWith: 'generate-example.mjs/v1', ...secretScanResult } },
  });
}

// ── run bindings, read from the real run records ──────────────────────────────
function runRef(runRecordRel) {
  const r = JSON.parse(readFileSync(join(repoRoot, runRecordRel), 'utf8'));
  return {
    runId: r.runId,
    suite: r.suite,
    runRecord: runRecordRel,
    bindings: { teamSha: r.bindings?.teamSha ?? null, hostSha: r.bindings?.hostSha ?? null },
    overallVerdict: r.overall ?? null,
    startedAt: r.startedAt ?? null,
    finishedAt: r.finishedAt ?? null,
  };
}
const runRecords = artifacts
  .filter((a) => a.class === 'run-record')
  .map((a) => a.path)
  .sort()
  .map(runRef);

const manifest = {
  schema: 'evidence-manifest/1',
  manifestId: 'u7r3-pilot-c2-20261029',
  createdAt: new Date().toISOString(),
  generator: { name: 'generate-example.mjs', version: 'v1', note: 'example generator, not scripts/evidence-verify.mjs' },
  rules: {
    doc: 'dev/agent-workflow/gates/EVIDENCE-OFFLOAD-RULES-20261031.md',
    version: 'v1.0',
    authority: 'USER-RULING-20261031 §5 (原则批准 2026-10-31)',
  },
  index: { repo: 'dsh-agent-team', commit, indexedPath: INDEXED_PATH },
  runs: runRecords,
  backend: {
    kind: 'none',
    endpoint: null,
    bucket: null,
    prefix: 'evidence/',
    immutability: 'none',
    note: '示例状态：原件仍在 git 内（in-git），尚未外仓。本 lane 不部署后端（USER-RULING-20261031 §5 + lane 授权边界）。',
  },
  policy: {
    bulkyThresholdBytes: 65536,
    sampling: { minFiles: 3, minPerRun: 1, minPctOfArtifacts: 10 },
  },
  artifacts,
};

const out = join(here, 'evidence-manifest.json');
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
console.log(`wrote ${out}`);
console.log(`artifacts=${artifacts.length} runs=${runRecords.length}`);
const byLane = {};
for (const a of artifacts) byLane[a.retention.lane] = (byLane[a.retention.lane] ?? 0) + 1;
console.log('lanes:', JSON.stringify(byLane));
