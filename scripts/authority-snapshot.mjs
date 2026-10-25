#!/usr/bin/env node
// S2 step-2 authority snapshot — PURE READ / VALIDATE / CANONICAL DIGEST module.
// No CLI on purpose and no write path: importing this module must never write anything.
//
// Frozen shape source of truth: dev/engineering/authority-snapshot.schema.json
// (byte-identical copy of the r2 candidate at
// dev/agent-workflow/evidence/s2-schema-candidate-20261025/r2/AUTHORITY-SNAPSHOT.schema.json,
// sha256 d70fcec29b0bd719b388c51821c83eaffb4bd7a4ede4ceb39b8a50f85855ee89; the freeze
// decision is recorded ONLY in this package's short manifest, not in any overall plan).
//
// Canonical digest = the EXISTING F0 rules (dev/agent-workflow/evidence/
// s1-f0-issued-20261025/F0-ISSUED-20261025.json canonical_digest_algorithm): UTF-8 no
// BOM, object keys sorted by Unicode code point recursively, arrays order-preserved,
// compact separators, RFC 8259 minimal escapes with non-ASCII emitted as raw UTF-8,
// zero 0x0A bytes in the digested bytes, sha256 lowercase hex prefixed "sha256:".
// The digest covers the snapshot object with the content_digest key REMOVED and
// published_utc INCLUDED like every other key (root ruling 4). The hash of the file
// bytes on disk is NOT this digest and must never be treated as it (engineering
// ruling for this package; fixture CONF-03's "byte hash" phrasing is the relation,
// not the mechanism).
//
// The validator is deliberately NOT a general JSON-Schema framework: it interprets
// exactly the draft-07 constructs the frozen schema uses (type / const / pattern /
// minLength / maxLength / required / additionalProperties:false / properties) and
// refuses loudly to validate if the schema gains any other construct, so a widened
// schema can never silently pass unvalidated.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FROZEN_SCHEMA_PATH = join(HERE, '..', 'dev', 'engineering', 'authority-snapshot.schema.json');
export const SNAPSHOT_DIR_REL = 'dev/engineering/authority-snapshots';

export function loadFrozenSchema(path = FROZEN_SCHEMA_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// ---------- canonical encoding (F0 rules) ----------

function canonicalValue(v) {
  if (v === null || typeof v === 'boolean' || typeof v === 'number') return v;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(canonicalValue);
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = canonicalValue(v[k]); // default sort = UTF-16 code-unit order = code-point order
    return out;
  }
  throw new Error(`CANONICAL_UNSUPPORTED_TYPE: ${typeof v}`);
}

/** Deterministic canonical JSON bytes: sorted keys, compact, raw non-ASCII, zero 0x0A. */
export function canonicalBytes(obj) {
  return Buffer.from(JSON.stringify(canonicalValue(obj)), 'utf8');
}

export function canonicalDigest(obj) {
  return `sha256:${createHash('sha256').update(canonicalBytes(obj)).digest('hex')}`;
}

/** The snapshot content digest: canonical digest with content_digest itself removed;
 *  every other key — published_utc included — is covered. */
export function snapshotDigest(snapshot) {
  const { content_digest, ...rest } = snapshot;
  return canonicalDigest(rest);
}

// ---------- frozen-schema validation (limited constructs, loud on the rest) ----------

const SUPPORTED_PROP_KEYS = new Set(['type', 'const', 'pattern', 'minLength', 'maxLength', 'description']);
const SUPPORTED_OBJ_KEYS = new Set(['type', 'properties', 'required', 'additionalProperties', 'description']);

function typeOk(value, t) {
  switch (t) {
    case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'array': return Array.isArray(value);
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number';
    case 'integer': return Number.isInteger(value);
    case 'boolean': return typeof value === 'boolean';
    case 'null': return value === null;
    default: throw new Error(`VALIDATOR_UNSUPPORTED_TYPE_CONSTRUCT: ${t}`);
  }
}

const SUPPORTED_CONSTRUCTS = new Set([...SUPPORTED_PROP_KEYS, ...SUPPORTED_OBJ_KEYS]);

function validateNode(value, schema, path, errors) {
  for (const k of Object.keys(schema)) {
    if (k.startsWith('$') || k === 'title') continue; // schema identity/doc metadata, not validation constructs
    if (!SUPPORTED_CONSTRUCTS.has(k)) throw new Error(`VALIDATOR_UNSUPPORTED_SCHEMA_CONSTRUCT: ${path}.${k}`);
  }
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeOk(value, t))) {
      errors.push(`TYPE ${path}: expected ${types.join('|')}`);
      return;
    }
  }
  if ('const' in schema && value !== schema.const) {
    errors.push(`CONST ${path}: expected ${JSON.stringify(schema.const)}`);
    return;
  }
  if (typeof value === 'string') {
    if (schema.pattern !== undefined && !(new RegExp(schema.pattern, 'u')).test(value)) {
      errors.push(`PATTERN ${path}: "${value}" does not match ${schema.pattern}`);
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`MIN_LENGTH ${path}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`MAX_LENGTH ${path}`);
  }
  if (schema.properties !== undefined) {
    if (!typeOk(value, 'object')) return;
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in schema.properties)) errors.push(`UNEXPECTED_KEY ${path === '$' ? key : `${path}.${key}`}`);
      }
    } else if (schema.additionalProperties !== undefined) {
      throw new Error(`VALIDATOR_UNSUPPORTED_SCHEMA_CONSTRUCT: ${path}.additionalProperties`);
    }
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`MISSING_KEY ${path === '$' ? key : `${path}.${key}`}`);
    }
    for (const [key, sub] of Object.entries(schema.properties)) {
      if (key in value) validateNode(value[key], sub, path === '$' ? key : `${path}.${key}`, errors);
    }
  }
}

/** Shape-only validation against the frozen schema. The six-field cross checks
 *  (phase digit agreement, current_phase bans) are publisher-side per the schema. */
export function validateShape(obj, schema = loadFrozenSchema()) {
  // Drop schema-level annotation extensions (x-status, x-carriers, x-current-phase-bans):
  // they document the contract, they do not validate data. Everything else must stay
  // inside the supported construct set, so a widened schema still fails loudly.
  const core = {};
  for (const [k, v] of Object.entries(schema)) if (!k.startsWith('x-')) core[k] = v;
  const errors = [];
  validateNode(obj, core, '$', errors);
  return { ok: errors.length === 0, errors };
}

/** Shape + digest + publisher-side machine bans on current_phase_statement. */
export function checkSnapshotObject(obj, schema = loadFrozenSchema()) {
  const { ok, errors } = validateShape(obj, schema);
  const all = [...errors];
  if (typeof obj?.content_digest === 'string' && /^sha256:[0-9a-f]{64}$/.test(obj.content_digest)) {
    const computed = snapshotDigest(obj);
    if (computed !== obj.content_digest) {
      all.push(`DIGEST_MISMATCH: recorded ${obj.content_digest} != computed ${computed}`);
    }
  } else if (obj?.content_digest !== undefined) {
    all.push('DIGEST_UNVERIFIABLE: content_digest is not a sha256 hex digest');
  }
  if (typeof obj?.current_phase_statement === 'string') {
    const s = obj.current_phase_statement;
    if (/\b[0-9a-f]{7,40}\b/.test(s)) all.push('PHASE_STATEMENT_BAN: embedded revision (ci-pr-gate.mjs:192)');
    if (/PR\s*#?\d/.test(s)) all.push('PHASE_STATEMENT_BAN: PR census (ci-pr-gate.mjs:195)');
    if (/ALPHA\.?4|A4-PR7/i.test(s)) all.push('PHASE_STATEMENT_BAN: names Alpha.4 (ci-pr-gate.mjs:343)');
  }
  return { ok: all.length === 0, errors: all };
}
