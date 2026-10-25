#!/usr/bin/env node
// S2 §7.4 step-3 READ-ONLY dual-read diagnostic (isolated engineering slice).
//
// Reads TWO recorded authorities and compares the six current_contract fields:
//   NEW side : an EXPLICIT candidate snapshot file (path given on the command line —
//              there is no live pointer and none is consulted or implied).
//   OLD side : the legacy graph block, through the EXISTING reader
//              gen-current-state.mjs readLegacyAuthority (exported unchanged; no new
//              YAML parser was invented).
// Reports only: missing sides/fields, old/new value divergence, invalid digest,
// snapshot shape errors. It never selects an authority, never writes anything
// anywhere, never reads the derived mirror (dev/engineering/current-state.json) for
// authority values — a missing graph is reported as MISSING_LEGACY_AUTHORITY and is
// NEVER backfilled from the mirror (its presence is recorded as a diagnostic note
// only). Old consumers keep their own current paths untouched.
// Limits (this package): not the full legacy Q1-Q8, not Git/content reality checks,
// not CI/product acceptance. Exit: 0 no red verdict, 2 red verdicts, 1 usage/IO.

import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateShape, snapshotDigest } from './authority-snapshot.mjs';
import { readLegacyAuthority, LEGACY_MIRROR_KEYS } from './gen-current-state.mjs';

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

export function runDualRead(argv) {
  const snapPath = argv.indexOf('--snapshot') >= 0 ? argv[argv.indexOf('--snapshot') + 1] : null;
  const root = argv.indexOf('--root') >= 0 ? argv[argv.indexOf('--root') + 1] : null;
  if (!snapPath || !root) return { code: 1, why: 'usage: authority-dual-read.mjs --snapshot <candidate.json> --root <dir> (read-only; no pointer exists or is consulted)' };

  const verdicts = [];
  const red = (code, detail) => verdicts.push({ code, detail, red: true });
  const note = (code, detail) => verdicts.push({ code, detail, red: false });

  // ---- NEW side: explicit candidate snapshot (read-only, symlink input refused) ----
  let candidate = null;
  try {
    const st = lstatSync(snapPath);
    if (st.isSymbolicLink()) red('SNAPSHOT_SYMLINK', `candidate ${snapPath} is a symlink; refusing to read through it`);
    else if (!st.isFile()) red('SNAPSHOT_NOT_REGULAR', `candidate ${snapPath} is not a regular file`);
    else candidate = JSON.parse(readFileSync(snapPath, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') red('SNAPSHOT_MISSING', `candidate snapshot ${snapPath} does not exist`);
    else if (e instanceof SyntaxError) red('SNAPSHOT_PARSE', e.message);
    else return { code: 1, why: `IO_ERROR: ${e.message}` };
  }
  if (candidate) {
    const shape = validateShape(candidate);
    for (const err of shape.errors) red('SNAPSHOT_SHAPE', err);
    if (typeof candidate.content_digest !== 'string' || !DIGEST_RE.test(candidate.content_digest)) {
      red('SNAPSHOT_INVALID_DIGEST', `content_digest is absent or not sha256 hex: ${JSON.stringify(candidate.content_digest)}`);
    } else if (snapshotDigest(candidate) !== candidate.content_digest) {
      red('SNAPSHOT_INVALID_DIGEST', `recorded ${candidate.content_digest} != recomputed ${snapshotDigest(candidate)} (F0 canonical, content_digest excluded, published_utc covered)`);
    }
  }

  // ---- OLD side: legacy graph block via the existing reader; mirror NEVER consulted ----
  const legacy = readLegacyAuthority(root);
  if (!legacy.present) {
    red('MISSING_LEGACY_AUTHORITY', 'dev/agent-workflow/graph.yaml#current_contract is absent; the derived mirror is NOT a source of authority and was not consulted for any value');
    if (existsSync(join(realpathSync(root), 'dev/engineering/current-state.json'))) {
      note('DERIVED_MIRROR_PRESENT_NOT_CONSULTED', 'dev/engineering/current-state.json exists; read-only mirror, deliberately not used to backfill the missing authority (§7.4: derived views never reverse-decide)');
    }
  }

  // ---- six-field comparison of recorded strings only (no selection, no repair) ----
  let compared = 0;
  if (candidate && legacy.present) {
    const cc = candidate.current_contract ?? {};
    for (const key of LEGACY_MIRROR_KEYS) {
      const snapV = cc[key];
      const legacyV = legacy[key];
      if (snapV === undefined) { red('MISSING_SNAPSHOT_FIELD', `${key} absent from candidate current_contract`); continue; }
      if (legacyV === null || legacyV === undefined) { red('MISSING_LEGACY_FIELD', `${key}: snapshot=${JSON.stringify(snapV)} graph=<absent> (not backfilled from anywhere)`); continue; }
      compared += 1;
      if (snapV !== legacyV) red('SNAPSHOT_VS_LEGACY_VALUE', `${key}: snapshot=${JSON.stringify(snapV)} graph=${JSON.stringify(legacyV)}`);
    }
  }

  const anyRed = verdicts.some((v) => v.red);
  const out = { ok: !anyRed, compared, verdicts };
  console.log(JSON.stringify(out, null, 2));
  return { ...out, code: anyRed ? 2 : 0 };
}

export function main(argv) {
  const r = runDualRead(argv);
  if (r.code === 1) console.error(`ERROR: ${r.why}`);
  return r.code;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}
