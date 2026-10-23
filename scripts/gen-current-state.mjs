#!/usr/bin/env node
// EB1-C state derivation bridge (Engineering Baseline, first version).
//
//   node scripts/gen-current-state.mjs --write    regenerate dev/engineering/current-state.json
//   node scripts/gen-current-state.mjs --check    fail if the committed view is stale or a claim is fake
//
// Pure Node + read-only git. No dependency, no wall-clock timestamp in the
// output (so --check is byte-reproducible), and no write path to any file other
// than the generated view named in the registry. The legacy authority
// (dev/agent-workflow/graph.yaml#current_contract) is read and mirrored only.
//
// Exit codes: 0 ok | 1 findings (stale view, schema violation, FAKE_VERIFICATION)
//             | 2 REFUSED (unusable input: no registry, not a git repo)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const ENUMS = {
  decision_status: ['proposed', 'accepted', 'rejected', 'superseded', 'pending_coordination'],
  implementation_status: ['not_started', 'in_progress', 'implemented_in_branch', 'merged'],
  verification_status: ['not_verified', 'verified_local', 'verified_ci', 'verified_host'],
  release_status: ['not_released', 'candidate', 'released'],
};
const KINDS = ['work-package', 'implementation-pr', 'gate', 'migration'];
const REQUIRED = ['id', 'kind', 'title', 'decision_status', 'implementation_status', 'verification_status', 'release_status', 'owners'];
const ID_RE = /^EB[0-9]-[A-Z0-9-]+$/;

function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function unquote(s) {
  return String(s).replace(/^['"]|['"]$/g, '').trim();
}

/** Parse the strict registry subset: top-level scalars + an `entries:` list of flat maps. */
export function parseRegistryStrict(text) {
  const doc = { entries: [] };
  const errors = [];
  const lines = text.split(/\r?\n/);
  let cur = null;
  let entryIndent = null; // column of the current entry's "-"
  let fieldIndent = null; // column of the current entry's fields
  let pendingList = null; // {obj, key, itemIndent}
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();

    const blockItem = trimmed.match(/^-\s+(.*)$/);
    if (blockItem && pendingList && indent === pendingList.itemIndent) {
      pendingList.obj[pendingList.key].push(unquote(blockItem[1]));
      continue;
    }
    pendingList = null;

    const entryStart = trimmed.match(/^-\s+(\w+):\s*(.*)$/);
    const isEntry = Boolean(entryStart) && (entryIndent === null || indent === entryIndent);
    const field = trimmed.match(/^(\w+):\s*(.*)$/);

    let target = null;
    let key = null;
    let value = null;
    if (isEntry) {
      if (cur === null) entryIndent = indent;
      cur = {};
      doc.entries.push(cur);
      fieldIndent = indent + 2;
      target = cur;
      key = entryStart[1];
      value = entryStart[2].trim();
    } else if (field && cur && indent >= fieldIndent) {
      target = cur;
      key = field[1];
      value = field[2].trim();
    } else if (field && entryIndent === null) {
      if (field[1] === 'entries') continue; // top-level key introducing the list
      doc[field[1]] = unquote(field[2]);
      continue;
    } else {
      errors.push(`registry-unsupported-syntax:L${i + 1}:${trimmed}`);
      continue;
    }
    if (value === '') {
      target[key] = [];
      pendingList = { obj: target, key, itemIndent: indent + 2 };
    } else if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim();
      target[key] = inner ? inner.split(',').map((s) => unquote(s.trim())) : [];
    } else {
      target[key] = unquote(value);
    }
  }
  return { doc, errors };
}

export function validateRegistry(doc, root) {
  const findings = [];
  if (doc.schema_version === undefined) findings.push({ code: 'REGISTRY_SCHEMA', detail: 'schema_version missing' });
  else if (Number(doc.schema_version) !== 1) findings.push({ code: 'REGISTRY_SCHEMA', detail: `schema_version=${doc.schema_version} (expected 1)` });
  if (!doc.entries.length) findings.push({ code: 'REGISTRY_SCHEMA', detail: 'no entries' });
  const seen = new Set();
  for (const e of doc.entries) {
    const id = String(e.id || '<no-id>');
    for (const key of REQUIRED) {
      if (e[key] === undefined || e[key] === '' || (Array.isArray(e[key]) && e[key].length === 0 && key !== 'refs')) {
        findings.push({ code: 'REGISTRY_SCHEMA', detail: `${id}: required field ${key} missing or empty` });
      }
    }
    if (!ID_RE.test(id)) findings.push({ code: 'REGISTRY_SCHEMA', detail: `${id}: id grammar` });
    if (seen.has(id)) findings.push({ code: 'REGISTRY_DUP_ID', detail: id });
    seen.add(id);
    if (!KINDS.includes(e.kind)) findings.push({ code: 'REGISTRY_SCHEMA', detail: `${id}: kind=${e.kind}` });
    for (const [axis, allowed] of Object.entries(ENUMS)) {
      if (e[axis] !== undefined && !allowed.includes(e[axis])) {
        findings.push({ code: 'REGISTRY_AXIS', detail: `${id}: ${axis}=${e[axis]} not in ${allowed.join('|')}` });
      }
    }
    const artifacts = Array.isArray(e.verification_artifacts) ? e.verification_artifacts : [];
    const claimsVerified = String(e.verification_status || '').startsWith('verified');
    if (claimsVerified) {
      const present = artifacts.filter((p) => existsSync(join(root, p)));
      if (present.length === 0) {
        findings.push({ code: 'FAKE_VERIFICATION', detail: `${id}: verification_status=${e.verification_status} with no existing artifact (refused; INV-EB-0009)` });
      }
      for (const p of artifacts) {
        if (!existsSync(join(root, p))) findings.push({ code: 'ARTIFACT_MISSING', detail: `${id}: ${p}` });
      }
    }
    for (const ref of Array.isArray(e.refs) ? e.refs : []) {
      const isId = /^(REQ|INV|AC|IDEA)-[A-Z0-9-]+$/.test(ref) || /^EB-ADR-\d{4}$/.test(ref);
      if (isId) continue; // resolved by the doc checks; keep generator free of that coupling
      if (!existsSync(join(root, ref))) findings.push({ code: 'REF_MISSING', detail: `${id}: ${ref}` });
    }
  }
  return findings;
}

function readLegacyAuthority(root) {
  const file = join(root, 'dev/agent-workflow/graph.yaml');
  if (!existsSync(file)) return { present: false };
  const text = readFileSync(file, 'utf8');
  const block = text.match(/\ncurrent_contract:\n((?:[ ]{2}\w+:.*\n?)+)/);
  const pick = (key) => {
    const m = block ? block[1].match(new RegExp(`^  ${key}:\\s*(\\S+)`, 'm')) : null;
    return m ? m[1].replace(/^"|"$/g, '') : null;
  };
  const baseline = pick('baseline');
  return {
    present: true,
    file: relative(root, file),
    phase_id: pick('phase_id'),
    active_plan: pick('active_plan'),
    baseline,
    baseline_exists: baseline ? git(root, ['cat-file', '-t', baseline]) === 'commit' : false,
    baseline_is_ancestor_of_head: baseline ? git(root, ['merge-base', '--is-ancestor', baseline, 'HEAD']) !== null : false,
    note: 'read-only mirror; this generator never writes graph.yaml and does not become an execution authority',
  };
}

export function build(root) {
  const registryFile = join(root, 'dev/engineering/registry.yaml');
  if (!existsSync(registryFile)) return { refused: 'REGISTRY_MISSING' };
  if (git(root, ['rev-parse', '--git-dir']) === null) return { refused: 'NOT_A_GIT_REPO' };
  const { doc, errors } = parseRegistryStrict(readFileSync(registryFile, 'utf8'));
  const findings = errors.map((e) => ({ code: 'REGISTRY_PARSE', detail: e }));
  findings.push(...validateRegistry(doc, root));

  const dirty = (git(root, ['status', '--porcelain']) || '').split('\n').filter(Boolean);
  // The persisted view carries ONLY facts that are stable between commits. Live
  // Git state (branch, head, dirtiness) is returned separately as `runtime` and
  // printed by --check / the probe: embedding it here would make the committed
  // view stale on every commit and turn a drift signal into churn.
  const view = {
    generated_by: 'scripts/gen-current-state.mjs',
    schema_version: 1,
    source_registry: 'dev/engineering/registry.yaml',
    source_registry_sha: git(root, ['hash-object', 'dev/engineering/registry.yaml']),
    axes_legend: ENUMS,
    legacy_authority: readLegacyAuthority(root),
    entries: doc.entries.map((e) => {
      const artifacts = Array.isArray(e.verification_artifacts) ? e.verification_artifacts : [];
      return {
        id: e.id,
        kind: e.kind,
        title: e.title,
        decision_status: e.decision_status,
        implementation_status: e.implementation_status,
        verification_status: e.verification_status,
        release_status: e.release_status,
        owners: e.owners,
        refs: e.refs,
        verification: {
          claimed: String(e.verification_status || '').startsWith('verified'),
          artifacts: artifacts.map((p) => ({ path: p, exists: existsSync(join(root, p)) })),
        },
      };
    }),
  };
  return {
    view,
    findings,
    runtime: {
      branch: git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
      head: git(root, ['rev-parse', 'HEAD']),
      merge_base_with_master: git(root, ['merge-base', 'HEAD', 'origin/master']),
      merged_into_master: git(root, ['merge-base', '--is-ancestor', 'HEAD', 'origin/master']) !== null,
      dirty_paths: dirty.length,
    },
    topLevel: { migration_of_legacy_consumers: doc.migration_of_legacy_consumers, legacy_execution_authority: doc.legacy_execution_authority },
  };
}

/** The one canonical serialization of the persisted view. probe, sync and the
 *  controls all compare against this, so they cannot disagree about "fresh". */
export function renderView(built) {
  return `${JSON.stringify({ ...built.view, migration: { migration_of_legacy_consumers: built.topLevel.migration_of_legacy_consumers, legacy_execution_authority: built.topLevel.legacy_execution_authority } }, null, 2)}\n`;
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const check = args.includes('--check');
  if (!write && !check) {
    console.error('usage: gen-current-state.mjs --check | --write');
    process.exit(2);
  }
  const result = build(root);
  if (result.refused) {
    console.log(`REFUSED ${result.refused}`);
    process.exit(2);
  }
  for (const f of result.findings) console.log(`FAIL ${f.code}: ${f.detail}`);
  console.log(`runtime: branch=${result.runtime.branch} head=${String(result.runtime.head).slice(0, 9)} merged_into_master=${result.runtime.merged_into_master} dirty_paths=${result.runtime.dirty_paths} (live state, not persisted in the view)`);
  const target = join(root, 'dev/engineering/current-state.json');
  const rendered = renderView(result);
  if (write) {
    if (result.findings.length) {
      console.log('REFUSED write: findings above (a fake verification claim is never written into the derived view)');
      process.exit(1);
    }
    writeFileSync(target, rendered);
    console.log(`wrote dev/engineering/current-state.json entries=${result.view.entries.length}`);
    process.exit(0);
  }
  if (!existsSync(target)) {
    console.log('FAIL STALE_GENERATED_VIEW: dev/engineering/current-state.json missing (run --write)');
    process.exit(1);
  }
  const current = readFileSync(target, 'utf8');
  if (current !== rendered) {
    console.log('FAIL STALE_GENERATED_VIEW: derived view does not match registry+git; run pnpm docs:sync --write');
    process.exit(1);
  }
  console.log(`gen-current-state: view fresh entries=${result.view.entries.length} findings=${result.findings.length}`);
  process.exit(result.findings.length ? 1 : 0);
}
