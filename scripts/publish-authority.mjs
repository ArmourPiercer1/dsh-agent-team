#!/usr/bin/env node
// S2 step-2 publisher (candidate implementation, isolated engineering slice).
//
// Scope frozen for this package (recorded in this package's short manifest only):
//   - `check   <snapshot-file>`                     — validate shape + content digest +
//                                                     publisher-side bans; writes nothing.
//   - `publish <snapshot-file> --root <fixture>`    — append ONE immutable snapshot to
//                                                     <fixture>/dev/engineering/authority-snapshots/<version>.json
//   - The publisher's ENTIRE writable surface is that one relative path pattern.
//     It never writes, moves or reads-and-decides through a live pointer
//     (dev/engineering/current-authority.json is NOT implemented here — root ruling:
//     publish does not switch, switching does not publish), never writes any registry,
//     and does not touch docs:sync's GENERATED_FILES whitelist (two files, verbatim).
//   - Safety boundary is the one extracted from scripts/generated-write.mjs
//     (checkLocationBoundary): symlink-free walk, O_NOFOLLOW exclusive create,
//     refuse overwrite of an existing version, refuse symlink/hardlink targets.
// Exit codes: 0 ok, 1 usage/IO/parse failure, 2 policy refusal (printed as a reason).

import { constants, existsSync, lstatSync, mkdirSync, openSync, readFileSync, writeSync, closeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkSnapshotObject, canonicalBytes, snapshotDigest } from './authority-snapshot.mjs';
import { checkLocationBoundary } from './generated-write.mjs';

/** The ONLY directory this publisher may ever write into, relative to --root. */
export const PUBLISH_REL_PATH = 'dev/engineering/authority-snapshots';
const VERSION_RE = /^as[0-9]{8}r[0-9]{1,3}$/;

function refuse(why) { return { code: 2, why }; }

function readDraft(path) {
  const st = lstatSync(path);
  if (st.isSymbolicLink()) return refuse(`SYMLINK_TARGET: input draft ${path} is a symlink`);
  if (!st.isFile()) return refuse(`NOT_REGULAR_TARGET: input draft ${path} is not a regular file`);
  let obj;
  try {
    obj = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return { code: 1, why: `PARSE_ERROR: ${e.message}` };
  }
  return { obj };
}

export function runCheck(argv) {
  const file = argv[0];
  if (!file) return { code: 1, why: 'usage: publish-authority.mjs check <snapshot-file>' };
  const draft = readDraft(file);
  if (draft.code) return draft;
  const res = checkSnapshotObject(draft.obj);
  if (!res.ok) return refuse(res.errors.join('; '));
  console.log(JSON.stringify({ ok: true, version: draft.obj.snapshot_version, digest: draft.obj.content_digest, recomputed: snapshotDigest(draft.obj) }));
  return { code: 0 };
}

export function runPublish(argv) {
  const file = argv[0];
  const rootIdx = argv.indexOf('--root');
  const root = rootIdx >= 0 ? argv[rootIdx + 1] : null;
  if (!file || !root) return { code: 1, why: 'usage: publish-authority.mjs publish <snapshot-file> --root <dir>' };
  const draft = readDraft(file);
  if (draft.code) return draft;
  const { obj } = draft;

  const res = checkSnapshotObject(obj);
  if (!res.ok) return refuse(res.errors.join('; '));

  // Independent second guard, not delegated to the schema alone: the version is the
  // only value that becomes a path component, so it is re-checked here and only
  // here may it reach join().
  const version = obj.snapshot_version;
  if (!VERSION_RE.test(version)) return refuse(`PATH_VERSION_ILLEGAL: "${version}" is not asYYYYMMDDrN (placeholders such as v3 are not legal versions)`);

  const rel = join(PUBLISH_REL_PATH, `${version}.json`);
  // Same order as writeGenerated: create the parent chain, then consult the
  // boundary (a symlinked ancestor is still caught by the walk, below).
  const parentAbs = join(realpathSync(root), PUBLISH_REL_PATH);
  if (!existsSync(parentAbs)) mkdirSync(parentAbs, { recursive: true });
  const boundary = checkLocationBoundary(root, rel, { mustBeAbsent: true });
  if (!boundary.ok) return refuse(boundary.why);

  const fd = openSync(boundary.abs, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o644);
  try {
    // F0 rule: digested bytes contain zero 0x0A; the FILE ends with exactly one
    // trailing LF that is not part of any digested bytes.
    writeSync(fd, Buffer.concat([canonicalBytes(obj), Buffer.from('\n', 'utf8')]));
  } finally {
    closeSync(fd);
  }
  console.log(JSON.stringify({ ok: true, published: boundary.within, digest: obj.content_digest }));
  return { code: 0, path: boundary.within };
}

export function main(argv) {
  const [mode, ...rest] = argv;
  let r;
  if (mode === 'check') r = runCheck(rest);
  else if (mode === 'publish') r = runPublish(rest);
  else r = { code: 1, why: 'usage: publish-authority.mjs check <file> | publish <file> --root <dir> (no pointer mode exists)' };
  if (r.code !== 0) console.error(`REFUSED(${r.code}): ${r.why}`);
  return r.code;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}
