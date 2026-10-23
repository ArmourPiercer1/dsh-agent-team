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

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { writeGenerated } from './generated-write.mjs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
// One blocking classification for all three entry points; doc-checks owns the list and
// does not import this file, so the dependency stays one-directional.
import { isBlockingFinding } from './doc-checks.mjs';

export const ENUMS = {
  decision_status: ['proposed', 'accepted', 'rejected', 'superseded', 'pending_coordination'],
  implementation_status: ['not_started', 'in_progress', 'implemented_in_branch', 'merged'],
  verification_status: ['not_verified', 'verified_local', 'verified_ci', 'verified_host'],
  release_status: ['not_released', 'candidate', 'released'],
};
const KINDS = ['work-package', 'implementation-pr', 'gate', 'migration'];
const REQUIRED = ['id', 'kind', 'title', 'decision_status', 'implementation_status', 'verification_status', 'release_status', 'owners'];
// Closed field set. registry.schema.json says additionalProperties:false; before this
// rule nothing enforced it, so a typo'd field silently carried no meaning.
const KNOWN_FIELDS = [...REQUIRED, 'refs', 'verification_artifacts', 'verified_tier', 'verification_commit', 'merged_commit'];
const ID_RE = /^EB[0-9]-[A-Z0-9-]+$/;
// Evidence tier of a claim: which environment it was earned in. Named once so the
// validator and the schema cross-check below read the same list.
const TIERS = ['C1', 'C2', 'C3'];
const SCHEMA_PATH = 'dev/engineering/registry.schema.json';
// A claim commit has to name a commit object, so abbreviated hex is not enough here;
// 40 hex is what the checks below enforce. COMMIT_REX is used by those checks and
// COMMIT_RE is the same rule as a source string for the schema comparison, so there
// is no second, drifting definition of what a commit field must look like.
const COMMIT_REX = /^[0-9a-f]{40}$/;
const COMMIT_RE = COMMIT_REX.source;

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
  const keysSeen = new WeakMap(); // a repeated key in one mapping is a defect, not last-write-wins
  const seenTop = new Set(); // top-level keys already assigned, including `entries`
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
      if (field[1] === 'entries') {
        // Same class as the other duplicate-key refusal, and the same silent-loss
        // bug: a second top-level entries: restarted the list, so the first block
        // of records disappeared from the view without any complaint.
        if (seenTop.has('entries')) errors.push(`registry-duplicate-key:L${i + 1}:entries`);
        seenTop.add('entries');
        continue;
      }
      // A repeated top-level key used to overwrite silently, so a registry carrying two
      // legacy_execution_authority lines kept whichever came last.
      if (Object.prototype.hasOwnProperty.call(doc, field[1])) errors.push(`registry-duplicate-key:L${i + 1}:${field[1]}`);
      doc[field[1]] = unquote(field[2]);
      continue;
    } else {
      errors.push(`registry-unsupported-syntax:L${i + 1}:${trimmed}`);
      continue;
    }
    let seen = keysSeen.get(target);
    if (!seen) { seen = new Set(); keysSeen.set(target, seen); }
    if (seen.has(key)) errors.push(`registry-duplicate-key:L${i + 1}:${key}`);
    seen.add(key);
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

const ID_REF_RE = /^(REQ|INV|AC|IDEA)-EB-[A-Z0-9-]+$|^EB-ADR-\d{4}$/;
const EVIDENCE_ROOTS = ['dev/agent-workflow/evidence/'];
const ARTIFACT_EXT = /\.(log|txt|md|json|jsonl|csv)$/i;

/** Ids that actually exist: the contract index plus every agent note in any lifecycle
 *  directory. Answering "does this cited id resolve?" is all it is used for. */
function knownContractIds(root) {
  const ids = new Set();
  const index = join(root, 'docs/contracts/engineering-baseline/ids.yaml');
  if (existsSync(index)) {
    for (const m of readFileSync(index, 'utf8').matchAll(/^\s*-?\s*id:\s*([A-Z]+-EB-[A-Z0-9-]+)/gm)) ids.add(m[1]);
  }
  for (const dir of ['proposed', 'implemented', 'rejected', 'archived']) {
    const d = join(root, '.agents/notes', dir);
    if (!existsSync(d)) continue;
    for (const name of readdirSync(d)) {
      if (!name.endsWith('.md')) continue;
      const m = readFileSync(join(d, name), 'utf8').match(/^id:\s*(\S+)\s*$/m);
      if (m) ids.add(m[1]);
    }
  }
  return ids;
}

export function validateRegistry(doc, root) {
  const findings = [];
  if (doc.schema_version === undefined) findings.push({ code: 'REGISTRY_SCHEMA', detail: 'schema_version missing' });
  else if (Number(doc.schema_version) !== 1) findings.push({ code: 'REGISTRY_SCHEMA', detail: `schema_version=${doc.schema_version} (expected 1)` });
  if (!doc.entries.length) findings.push({ code: 'REGISTRY_SCHEMA', detail: 'no entries' });
  const seen = new Set();
  for (const e of doc.entries) {
    const id = String(e.id || '<no-id>');
    for (const key of Object.keys(e)) {
      if (!KNOWN_FIELDS.includes(key)) {
        findings.push({ code: 'REGISTRY_UNKNOWN_FIELD', detail: `${id}: ${key} is not a field of the registry subset (typo or unsupported extension)` });
      }
    }
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
    if (e.verification_artifacts !== undefined && !Array.isArray(e.verification_artifacts)) {
      findings.push({ code: 'REGISTRY_ARTIFACTS_TYPE', detail: `${id}: verification_artifacts must be a list` });
    }
    if (e.owners !== undefined && !Array.isArray(e.owners)) {
      findings.push({ code: 'REGISTRY_OWNER_TYPE', detail: `${id}: owners must be a list of accountable roles, got ${typeof e.owners}` });
    }
    for (const p of artifacts) {
      if (typeof p !== 'string' || !EVIDENCE_ROOTS.some((r) => p.startsWith(r))) {
        findings.push({ code: 'ARTIFACT_LOCATION_UNCONTROLLED', detail: `${id}: ${p} must live under ${EVIDENCE_ROOTS.join(' or ')}: a verification artifact is a kept record, not an inline assertion` });
      } else if (!ARTIFACT_EXT.test(p)) {
        findings.push({ code: 'ARTIFACT_TYPE_UNSUPPORTED', detail: `${id}: ${p} (supported: log, txt, md, json, jsonl, csv)` });
      }
    }
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
    // A delivery claim has to be bound to metadata that already exists outside this
    // file: a commit object in this repository, and for merge/release claims, actual
    // ancestry in origin/master. This is not a proof system — it refuses claims that
    // cite nothing, which is the exact hole where "verified_host" could be typed into
    // a YAML file next to a C1 log and read as real-environment evidence.
    const tier = e.verified_tier;
    if (tier !== undefined && !TIERS.includes(tier)) {
      findings.push({ code: 'CLAIM_TIER_UNKNOWN', detail: `${id}: verified_tier=${tier} (expected C1|C2|C3)` });
    }
    if (claimsVerified && e.verification_status !== 'verified_local') {
      const commit = String(e.verification_commit || '');
      if (!COMMIT_REX.test(commit)) {
        findings.push({ code: 'CLAIM_UNBOUND', detail: `${id}: ${e.verification_status} requires verification_commit (40-hex); local work must stay verified_local` });
      } else if (git(root, ['cat-file', '-t', commit]) !== 'commit') {
        findings.push({ code: 'CLAIM_UNBOUND', detail: `${id}: verification_commit ${commit} is not a commit in this repository` });
      }
    }
    if (claimsVerified && e.verification_status === 'verified_host') {
      if (tier === 'C1') {
        findings.push({ code: 'CLAIM_TIER_MISMATCH', detail: `${id}: verified_host asserts real-environment behaviour; C1 static/local evidence cannot stand in for it` });
      } else if (tier !== 'C2' && tier !== 'C3') {
        findings.push({ code: 'CLAIM_TIER_MISSING', detail: `${id}: verified_host requires verified_tier C2 or C3` });
      }
    }
    if (e.implementation_status === 'merged') {
      const mc = String(e.merged_commit || e.verification_commit || '');
      const ok = COMMIT_REX.test(mc) && git(root, ['cat-file', '-t', mc]) === 'commit' && git(root, ['merge-base', '--is-ancestor', mc, 'origin/master']) !== null;
      if (!ok) findings.push({ code: 'MERGED_CLAIM_UNCORROBORATED', detail: `${id}: implementation_status=merged needs merged_commit that exists and is an ancestor of origin/master` });
    }
    if (e.release_status === 'candidate' || e.release_status === 'released') {
      const needed = e.release_status === 'released' ? ['C3'] : ['C2', 'C3'];
      const hostVerified = e.verification_status === 'verified_host' && needed.includes(tier);
      const merged = git(root, ['merge-base', '--is-ancestor', 'HEAD', 'origin/master']) !== null;
      if (!hostVerified || !merged) {
        findings.push({ code: 'RELEASE_CLAIM_UNCORROBORATED', detail: `${id}: release_status=${e.release_status} requires verified_host at ${needed.join('/')} plus a head that is an ancestor of origin/master` });
      }
    }
    const refs = Array.isArray(e.refs) ? e.refs : [];
    if (typeof e.refs === 'string' && e.refs) {
      findings.push({ code: 'REGISTRY_REF_SCALAR', detail: `${id}: refs must be a list, got scalar "${e.refs}"` });
      refs.push(e.refs);
    }
    const knownIds = knownContractIds(root);
    for (const ref of refs) {
      if (typeof ref !== 'string' || !ref.trim()) {
        findings.push({ code: 'REGISTRY_REF_TYPE', detail: `${id}: every ref must be a non-empty string` });
        continue;
      }
      if (ID_REF_RE.test(ref)) {
        if (!knownIds.has(ref)) {
          findings.push({ code: 'REGISTRY_REF_UNRESOLVED', detail: `${id}: ${ref} has id grammar but is declared nowhere (ids.yaml or an agent note)` });
        }
        continue;
      }
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

/** Compare the descriptive schema against the rules this file enforces. Only the
 *  keywords that schema actually uses are interpreted — required, enum, pattern,
 *  additionalProperties — so this is a comparison, not a half-written validator, and
 *  the validator stays the authority. Without it the two drift silently: the schema
 *  has in turn promised a closed field set nobody enforced, listed `refs` as required,
 *  and given `verified_tier` the verification_status values instead of C1|C2|C3. */
export function checkSchemaAgreement(root) {
  const file = join(root, SCHEMA_PATH);
  if (!existsSync(file)) {
    return [{ code: 'SCHEMA_MISSING', detail: SCHEMA_PATH + ' is gone, so the documented shape can no longer be compared with the enforced one' }];
  }
  let doc;
  try { doc = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { return [{ code: 'SCHEMA_UNPARSEABLE', detail: SCHEMA_PATH + ': ' + ((e && e.message) || String(e)) }]; }
  const item = (((doc.properties || {}).entries || {}).items || {});
  const props = item.properties || {};
  const out = [];
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const req = item.required || [];
  if (!same([...req].sort(), [...REQUIRED].sort())) {
    out.push({ code: 'SCHEMA_REQUIRED_MISMATCH', detail: 'schema required=[' + req.join(',') + '] enforced=[' + REQUIRED.join(',') + ']' });
  }
  for (const k of KNOWN_FIELDS) if (!props[k]) out.push({ code: 'SCHEMA_FIELD_MISSING', detail: k + ' is enforced but absent from ' + SCHEMA_PATH });
  for (const k of Object.keys(props)) if (!KNOWN_FIELDS.includes(k)) out.push({ code: 'SCHEMA_FIELD_EXTRA', detail: k + ' is documented but the validator does not accept it' });
  const wantEnum = Object.assign({ kind: KINDS, verified_tier: TIERS }, ENUMS);
  for (const k of Object.keys(wantEnum)) {
    const got = props[k] && props[k].enum;
    if (!got) {
      // Silence is not agreement: the comparison only ran when the keyword existed, so
      // a schema that said nothing about the vocabulary passed a validator that enforces one.
      out.push({ code: 'SCHEMA_KEYWORD_MISSING', detail: k + ': ' + SCHEMA_PATH + ' states no enum, but the value set is enforced [' + wantEnum[k].join(',') + ']' });
      continue;
    }
    if (!same([...got].sort(), [...wantEnum[k]].sort())) {
      out.push({ code: 'SCHEMA_ENUM_MISMATCH', detail: k + ': schema=[' + got.join(',') + '] enforced=[' + wantEnum[k].join(',') + ']' });
    }
  }
  const wantPattern = { id: ID_RE.source, verification_commit: COMMIT_RE, merged_commit: COMMIT_RE };
  for (const k of Object.keys(wantPattern)) {
    const got = props[k] && props[k].pattern;
    if (!got) out.push({ code: 'SCHEMA_KEYWORD_MISSING', detail: k + ': ' + SCHEMA_PATH + ' states no pattern, but /' + wantPattern[k] + '/ is enforced' });
    else if (got !== wantPattern[k]) out.push({ code: 'SCHEMA_PATTERN_MISMATCH', detail: k + ': schema=/' + got + '/ enforced=/' + wantPattern[k] + '/' });
  }
  if (item.additionalProperties !== false) {
    out.push({ code: 'SCHEMA_CONSTRAINT_MISMATCH', detail: SCHEMA_PATH + ' does not say additionalProperties:false, yet the entry field set is closed (REGISTRY_UNKNOWN_FIELD)' });
  }
  return out;
}

export function build(root) {
  const registryFile = join(root, 'dev/engineering/registry.yaml');
  if (!existsSync(registryFile)) return { refused: 'REGISTRY_MISSING' };
  if (git(root, ['rev-parse', '--git-dir']) === null) return { refused: 'NOT_A_GIT_REPO' };
  const { doc, errors } = parseRegistryStrict(readFileSync(registryFile, 'utf8'));
  const findings = errors.map((e) => ({ code: 'REGISTRY_PARSE', detail: e }));
  findings.push(...validateRegistry(doc, root));
  findings.push(...checkSchemaAgreement(root));
  findings.push(...checkContractIndex(root));

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
    // The view is also read against the id catalog — every `refs` entry resolves
    // through ids.yaml — so it names that input as well. Before this, an edit to
    // ids.yaml left the view reporting itself "fresh" while the meaning of every ref in
    // it had moved: freshness was being claimed about one of two inputs. A catalog edit
    // now has to be followed by a regeneration, which is what the field is for.
    source_catalog: 'docs/contracts/engineering-baseline/ids.yaml',
    source_catalog_sha: git(root, ['hash-object', 'docs/contracts/engineering-baseline/ids.yaml']),
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

/**
 * The second derived artifact: a readable index over the id catalog. Reported here, and
 * written only through scripts/generated-write.mjs like every other derivative.
 *
 * Why: ids.yaml is machine-readable and nobody reads it, so the ids that plans and notes
 * are supposed to cite had no browsable listing — the contract index in that directory
 * carried zero rows for 19 catalog entries. A hand-kept copy would be the same drift in
 * a new place, so this is generated, and the check below is what keeps it honest.
 *
 * The write surface is deliberately NOT widened by this file alone: adding the path to
 * GENERATED_FILES / the docs:sync allow-list is the approval step, and until then the
 * check reports CATALOG_NOT_GENERATED (non-blocking) instead of writing anything.
 */
export const CATALOG_INDEX_PATH = 'docs/contracts/engineering-baseline/INDEX.md';
export const CATALOG_SOURCE_PATH = 'docs/contracts/engineering-baseline/ids.yaml';

export function parseContractCatalog(root) {
  const file = join(root, CATALOG_SOURCE_PATH);
  if (!existsSync(file)) return null;
  const entries = [];
  let cur = null;
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
    if (!line.trim() || line.trimStart().startsWith('#')) return;
    const id = line.match(/^\s*- id:\s*(.+)$/);
    if (id) { cur = { id: unquote(id[1]) }; entries.push(cur); return; }
    if (!cur) return;
    const f = line.match(/^\s+([a-z_]+):\s*(.*)$/);
    if (!f) return;
    const value = f[2].trim();
    cur[f[1]] = value.startsWith('[') ? value.slice(1, -1).split(',').map(unquote).filter(Boolean) : unquote(value);
  });
  return entries;
}

export function renderContractIndex(root) {
  const entries = parseContractCatalog(root) || [];
  const byKind = {};
  for (const e of entries) (byKind[e.kind || 'unclassified'] = byKind[e.kind || 'unclassified'] || []).push(e);
  const out = [
    '<!-- GENERATED FILE - do not edit. Rendered from docs/contracts/engineering-baseline/ids.yaml',
    '     by scripts/gen-current-state.mjs; refresh with `node scripts/docs-sync.mjs --write`.',
    '     docs:sync --check and docs:probe refuse when this file no longer matches the catalog. -->',
    '',
    `# Engineering Baseline id index (${entries.length} ids)`,
    '',
    'Browsable listing over the machine-readable catalog. `ids.yaml` stays the source of',
    'truth; this file exists so the ids can be read and cited without opening YAML.',
    'Listing an id here grants it nothing: every entry stays',
    '`proposed-not-ratified` until an approval is recorded in',
    '`dev/engineering/registry.yaml` and the Contract Owner has reviewed it.',
    '',
  ];
  for (const kind of Object.keys(byKind).sort()) {
    out.push(`## ${kind} (${byKind[kind].length})`, '');
    for (const e of byKind[kind].slice().sort((a, b) => (a.id < b.id ? -1 : 1))) {
      out.push(`### ${e.id}`, '');
      out.push(`- normative_status: ${e.normative_status || 'MISSING'}`);
      out.push(`- owners: ${(e.owners || []).join(', ') || 'MISSING'}`);
      out.push(`- source_anchor: ${e.source_anchor || 'MISSING'}`);
      out.push(`- statement: ${e.statement || 'MISSING'}`, '');
    }
  }
  return `${out.join('\n').replace(/\n+$/, '')}\n`;
}

/** Is the generated index still what the catalog says? */
export function checkContractIndex(root) {
  const entries = parseContractCatalog(root);
  if (!entries) return [{ code: 'CATALOG_SOURCE_MISSING', detail: `${CATALOG_SOURCE_PATH} is absent, so ${CATALOG_INDEX_PATH} cannot be derived` }];
  if (!entries.length) return [{ code: 'CATALOG_SOURCE_EMPTY', detail: `${CATALOG_SOURCE_PATH} declares no ids` }];
  if (!existsSync(join(root, CATALOG_INDEX_PATH))) {
    // Not generated yet. That is a recorded gap, not drift, and it stays non-blocking
    // only while the file is absent: once it exists, any mismatch below is a refusal.
    return [{ code: 'CATALOG_NOT_GENERATED', detail: `${CATALOG_INDEX_PATH} has not been generated; the generator is ready and waits on adding that path to the write allow-list` }];
  }
  if (readFileSync(join(root, CATALOG_INDEX_PATH), 'utf8') !== renderContractIndex(root)) {
    return [{ code: 'STALE_GENERATED_CATALOG', detail: `${CATALOG_INDEX_PATH} no longer matches ${CATALOG_SOURCE_PATH}; regenerate with \`docs:sync --write\`, never hand-edit` }];
  }
  return [];
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
    const written = writeGenerated(root, 'dev/engineering/current-state.json', rendered);
    if (!written.ok) {
      console.log(`REFUSED WRITE_BOUNDARY: ${written.why}`);
      process.exit(2);
    }
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
  // Same classification as docs:sync --check and docs:probe. This entry point exited on
  // any finding at all, so it called a recorded non-blocking gap a refusal while the
  // probe reported the very same input as non_blocking — and it printed the gap as FAIL.
  const blocking = result.findings.filter(isBlockingFinding);
  for (const f of result.findings) console.log(`${isBlockingFinding(f) ? 'FAIL' : 'WARN'} ${f.code}: ${f.detail}`);
  console.log(`gen-current-state: view fresh entries=${result.view.entries.length} findings=${result.findings.length} blocking=${blocking.length}`);
  process.exit(blocking.length ? 1 : 0);
}
