#!/usr/bin/env node
// S2 §7.4 step-4 small READ-ONLY source helper: load an explicit versioned authority
// snapshot as a consumer's authority source. No writes, no CLI, no fallback.
//
// Contract: caller MUST pass both an explicit file path and the expected digest —
// there is no live pointer, and absence of either is a refusal, never a default.
// Validation reuses the frozen schema + canonical digest path (validateShape,
// snapshotDigest); symlink inputs are refused. Every failure is structured
// (CANDIDATE_*) so the consumer can refuse without ever reaching graph or
// current-state as a fallback.
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { validateShape, snapshotDigest } from './authority-snapshot.mjs';
import { LEGACY_MIRROR_KEYS } from './authority-contract-fields.mjs';

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

export function loadCandidateAuthority(options) {
  // A non-object options argument is a structured refusal, never a thrown TypeError:
  // the caller's refusal path must be the same for every bad input.
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    return { ok: false, refused: 'CANDIDATE_OPTIONS_INVALID', detail: `options must be { file, expectedDigest }, got ${options === null ? 'null' : Array.isArray(options) ? 'array' : typeof options}` };
  }
  const { file, expectedDigest } = options;
  if (!file || typeof file !== 'string') return { ok: false, refused: 'CANDIDATE_PATH_REQUIRED' };
  if (typeof expectedDigest !== 'string' || !DIGEST_RE.test(expectedDigest)) return { ok: false, refused: 'CANDIDATE_EXPECTED_DIGEST_REQUIRED' };
  let st;
  try { st = lstatSync(file); } catch (e) { return { ok: false, refused: e.code === 'ENOENT' ? 'CANDIDATE_MISSING' : `CANDIDATE_IO_${e.code}` }; }
  if (st.isSymbolicLink()) return { ok: false, refused: 'CANDIDATE_SYMLINK' };
  if (!st.isFile()) return { ok: false, refused: 'CANDIDATE_NOT_REGULAR' };
  let obj;
  try { obj = JSON.parse(readFileSync(file, 'utf8')); } catch { return { ok: false, refused: 'CANDIDATE_PARSE' }; }
  // A successfully parsed value of ANY JSON type (including falsy) is validated:
  const shape = validateShape(obj);
  if (!shape.ok) return { ok: false, refused: 'CANDIDATE_SHAPE', detail: shape.errors.join('; ') };
  if (obj.content_digest !== expectedDigest) return { ok: false, refused: 'CANDIDATE_EXPECTED_VS_RECORDED', detail: `expected ${expectedDigest} recorded ${obj.content_digest}` };
  if (snapshotDigest(obj) !== expectedDigest) return { ok: false, refused: 'CANDIDATE_DIGEST_MISMATCH', detail: `expected ${expectedDigest} recomputed ${snapshotDigest(obj)} (F0 canonical, content_digest excluded)` };
  const six = {};
  for (const key of LEGACY_MIRROR_KEYS) six[key] = obj.current_contract[key];
  return { ok: true, file, six, snapshot_version: obj.snapshot_version, content_digest: obj.content_digest };
}
