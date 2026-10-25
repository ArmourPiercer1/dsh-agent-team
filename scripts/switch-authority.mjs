#!/usr/bin/env node
// U2 (G2 switchover) — the pointer TRANSACTION script: the only writer of
// dev/engineering/current-authority.json.
//
// This is deliberately NOT part of the publisher: publishing and switching are separate
// entries on purpose (publish creates immutable history; switch moves the single editable
// pointer — root ruling quoted in scripts/publish-authority.mjs:11). The publisher stays
// untouched; this script NEVER writes snapshots, registry, or the derived view.
//
// Transaction (G2 review R1 §"Recommended minimal switchover design" step 3):
//   1. PRECONDITION  the current pointer's exact byte digest must equal --expect-pointer-digest,
//                    or --expect-pointer-absent must match reality. A precondition miss
//                    touches ZERO bytes.
//   2. RESOLVE + VERIFY the target snapshot BEFORE any write: schema + canonical digest +
//      pointer-declared digest agreement, through scripts/current-authority.mjs machinery.
//   3. WRITE atomically and symlink-safely: same-directory temp (O_EXCL|O_NOFOLLOW), full
//      write, fsync(file), rename over the target, fsync(dir). If an existing pointer is
//      replaced it must be a regular file with nlink == 1 — a symlink or hardlink target is
//      refused, never followed, never written through.
//   4. RE-READ + VERIFY: bytes re-read must hash to the new pointer, and the loader must
//      resolve pointer → snapshot → six fields with the expected digest.
//   5. RESTORE on any failure at or after step 3: the exact previous bytes (atomic re-write
//      verified by digest) or, when the precondition was absence, absence again. The
//      restore result is printed; a failed restore is the loudest failure this tool has.
//
// Two-current note: this tool does NOT refuse while graph.yaml#current_contract still
// exists — the approved switchover removes that block in the SAME commit the pointer
// enters (graph block + pointer are one transaction at the git level). While the block is
// still present the result records `two_current_pending: true` so the operator sees that
// the removal must ride the same commit; every gate then grades TWO_CURRENT_AUTHORITY red
// until it is gone (scripts/current-authority.mjs).
//
// Test seam: U2_SWITCH_INJECT_FAIL=after-temp-write|after-rename|before-restore-verify
// makes the run fail at that exact point (used by tests/s2-authority to prove the restore
// path with a REAL interrupted transaction). It never changes behaviour when unset.
//
// Exit codes: 0 switched (or verified), 1 usage/IO, 2 policy refusal / failed precondition.

import { constants, existsSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, closeSync, fsyncSync, unlinkSync, writeSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { canonicalBytes } from './authority-snapshot.mjs';
import { loadCandidateAuthority } from './authority-candidate-source.mjs';
import { POINTER_REL, SNAPSHOTS_REL, loadPointerAuthority, pointerExists, graphBlockPresent } from './current-authority.mjs';

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const VERSION_RE = /^as[0-9]{8}r[0-9]{1,3}$/;

const sha256 = (buf) => `sha256:${createHash('sha256').update(buf).digest('hex')}`;
function refuse(why) { return { code: 2, why }; }

/** Serialize THE pointer: canonical F0 bytes of exactly the two keys + one trailing LF
 *  (the same "digest covers content, file carries one LF" convention as the publisher). */
export function pointerBytes(snapshotVersion, contentDigest) {
  return Buffer.concat([canonicalBytes({ snapshot_version: snapshotVersion, content_digest: contentDigest }), Buffer.from('\n', 'utf8')]);
}

function injectFail(point) {
  // ONE-SHOT by contract: the seam proves the RESTORE path by failing the main write once;
  // if it kept firing, the restore write itself would trip it and the test would grade the
  // restore as failed for the wrong reason. The first hit consumes the environment value.
  if (process.env.U2_SWITCH_INJECT_FAIL === point) {
    delete process.env.U2_SWITCH_INJECT_FAIL;
    throw new Error(`U2_SWITCH_INJECT_FAIL=${point}`);
  }
}

function fsyncDir(dir) {
  let fd;
  try { fd = openSync(dir, constants.O_RDONLY); fsyncSync(fd); } finally { if (fd !== undefined) closeSync(fd); }
}

/** Component-by-component mkdir with symlink checks before/after each creation — the same
 *  discipline as scripts/publish-authority.mjs safeMkdirParentsNoSymlink: creation never
 *  precedes verification, so a symlinked mid-level directory can never gain children. */
function safeMkdirParentsNoSymlink(realRoot, relDir) {
  let cursor = realRoot;
  for (const part of relDir.split('/').filter(Boolean)) {
    cursor = join(cursor, part);
    let st = null;
    try { st = lstatSync(cursor); } catch (e) { if (e.code !== 'ENOENT') return { ok: false, why: `STAT_ERROR: ${cursor}: ${e.code}` }; }
    if (st) {
      if (st.isSymbolicLink()) return { ok: false, why: `SYMLINK_ANCESTOR: ${cursor}` };
      if (!st.isDirectory()) return { ok: false, why: `NOT_DIRECTORY_ANCESTOR: ${cursor}` };
      continue;
    }
    try { mkdirSync(cursor); } catch (e) { return { ok: false, why: `MKDIR_FAILED: ${cursor}: ${e.code || e.message}` }; }
    let re;
    try { re = lstatSync(cursor); } catch { return { ok: false, why: `POST_CREATE_VANISHED: ${cursor}` }; }
    if (re.isSymbolicLink()) return { ok: false, why: `SYMLINK_ANCESTOR: ${cursor} (post-create)` };
    if (!re.isDirectory()) return { ok: false, why: `NOT_DIRECTORY_ANCESTOR: ${cursor} (post-create)` };
  }
  return { ok: true };
}

/** Atomic same-directory temp+fsync+rename write. Returns the digest of the bytes that
 *  landed (re-read), or throws. Refuses symlink/hardlink targets on `abs`. */
function atomicWrite(abs, bytes, { replace } = {}) {
  if (replace) {
    const st = lstatSync(abs);
    if (st.isSymbolicLink()) throw new Error(`TARGET_SYMLINK: refusing to replace ${abs} — the pointer must not be a symlink and is never followed`);
    if (!st.isFile()) throw new Error(`TARGET_NOT_REGULAR: refusing to replace ${abs}`);
    if (st.nlink > 1) throw new Error(`TARGET_HARDLINK: refusing to replace ${abs} — ${st.nlink} links share the inode; writing through would edit a file outside the pointer`);
  }
  const tmp = join(dirname(abs), `.${basename(abs)}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`);
  let wrote = false;
  try {
    const fd = openSync(tmp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o644);
    try { writeSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
    wrote = true;
    injectFail('after-temp-write');
    renameSync(tmp, abs);
    fsyncDir(dirname(abs));
    injectFail('after-rename');
  } catch (e) {
    if (wrote) { try { unlinkSync(tmp); } catch { /* temp already gone */ } }
    else { try { unlinkSync(tmp); } catch { /* never created */ } }
    throw e;
  }
  const landed = readFileSync(abs);
  if (sha256(landed) !== sha256(bytes)) throw new Error(`POST_WRITE_REREAD: ${abs} re-read does not match the bytes written`);
  return sha256(landed);
}

/** Capture the exact current state of the pointer for the precondition and the restore. */
function capturePointer(abs) {
  let st;
  try { st = lstatSync(abs); } catch (e) { if (e.code === 'ENOENT') return { present: false }; throw e; }
  if (st.isSymbolicLink()) return { error: `POINTER_SYMLINK: ${POINTER_REL} is currently a symlink; the transaction refuses to run against it at all` };
  if (!st.isFile()) return { error: `POINTER_NOT_REGULAR: ${POINTER_REL} is not a regular file` };
  const bytes = readFileSync(abs);
  return { present: true, bytes, digest: sha256(bytes), hardlinked: st.nlink > 1 };
}

/**
 * THE transaction. Pure-structured return, no console. `root` is the tree whose
 * dev/engineering/ paths are edited (the repo working tree, or a fixture in tests).
 */
export function switchAuthority(root, { snapshotVersion, expectedDigest, expectPointerAbsent = false, expectPointerDigest = null }) {
  const fail = (why, extra) => ({ ok: false, why, ...extra });
  if (typeof snapshotVersion !== 'string' || !VERSION_RE.test(snapshotVersion)) return fail(`SWITCH_ARGS: --snapshot-version must match asYYYYMMDDrN, got "${String(snapshotVersion)}"`);
  if (typeof expectedDigest !== 'string' || !DIGEST_RE.test(expectedDigest)) return fail(`SWITCH_ARGS: --expected-digest must be sha256:<64 hex>, got "${String(expectedDigest)}"`);
  if (expectPointerAbsent === (expectPointerDigest !== null)) return fail('SWITCH_ARGS: exactly one of --expect-pointer-absent / --expect-pointer-digest is required (the precondition is never implicit)');

  const rootAbs = realpathSync(root);
  const pointerAbs = join(rootAbs, POINTER_REL);
  const snapshotRel = join(SNAPSHOTS_REL, `${snapshotVersion}.json`);
  const snapshotAbs = join(rootAbs, snapshotRel);

  // 1. PRECONDITION on the old pointer — zero writes happen below this line's failure.
  const old = capturePointer(pointerAbs);
  if (old.error) return fail(old.error);
  if (expectPointerAbsent && old.present) return fail(`POINTER_PRECONDITION: ${POINTER_REL} exists (digest ${old.digest}) but the transaction declared --expect-pointer-absent — refusing to overwrite a pointer that moved`);
  if (!expectPointerAbsent) {
    if (!old.present) return fail(`POINTER_PRECONDITION: ${POINTER_REL} is absent but the transaction expected pointer digest ${expectPointerDigest}`);
    if (old.digest !== expectPointerDigest) return fail(`POINTER_PRECONDITION: current pointer digest is ${old.digest}, expected ${expectPointerDigest} — refusing (the pointer moved underneath this switch)`);
  }
  if (old.present && old.hardlinked) return fail(`POINTER_HARDLINK: refusing to replace a pointer whose inode has more than one link`);

  // 2. RESOLVE + VERIFY the target BEFORE any write (schema + recorded digest + F0 digest
  //    + statement semantics; same code path every reader uses, so a pointer can never
  //    be written that its own readers would refuse).
  const v = loadCandidateAuthority({ file: snapshotAbs, expectedDigest });
  if (!v.ok) return fail(`SNAPSHOT_REFUSED(${v.refused}${v.detail ? `: ${v.detail}` : ''}): ${snapshotRel} is not publishable as the current pointer; no bytes were written`);
  if (v.snapshot_version !== snapshotVersion) return fail(`SNAPSHOT_VERSION_MISMATCH: pointer names ${snapshotVersion}, file at ${snapshotRel} says ${v.snapshot_version}`);

  // 3–5. WRITE (atomic, symlink-safe) → RE-READ+LOAD → RESTORE on any failure.
  const next = pointerBytes(snapshotVersion, expectedDigest);
  let writeErr = null;
  try {
    // The pointer's directory chain is verified component by component (creation, if a
    // component is missing at all, never precedes its verification — same discipline as
    // the publisher's safeMkdirParentsNoSymlink).
    const dir = safeMkdirParentsNoSymlink(rootAbs, dirname(POINTER_REL));
    if (!dir.ok) throw new Error(dir.why);
    if (old.present) atomicWrite(pointerAbs, next, { replace: true });
    else atomicWrite(pointerAbs, next);
  } catch (e) {
    writeErr = e;
  }
  let loadErr = null;
  if (!writeErr) {
    const after = loadPointerAuthority(rootAbs);
    if (!after.ok || after.status !== 'POINTER' || after.content_digest !== expectedDigest || after.snapshot_version !== snapshotVersion) {
      loadErr = `post-write verification failed: ${JSON.stringify({ status: after.status, refused: after.refused, detail: after.detail })}`;
    }
  }
  if (!writeErr && !loadErr) {
    return {
      ok: true,
      switched: true,
      pointer: POINTER_REL,
      snapshot: snapshotRel,
      snapshot_version: snapshotVersion,
      content_digest: expectedDigest,
      pointer_bytes_sha256: sha256(next),
      previous_pointer: old.present ? { existed: true, digest: old.digest } : { existed: false },
      two_current_pending: graphBlockPresent(rootAbs),
    };
  }
  // RESTORE: back to the exact previous bytes, or back to absence. Injected failures
  // land here on purpose so the restore path is exercised for real.
  let restore = null;
  try {
    injectFail('before-restore-verify');
    if (old.present) {
      atomicWrite(pointerAbs, old.bytes, { replace: true });
      restore = { restored: 'previous-bytes', digest: sha256(readFileSync(pointerAbs)), expected: old.digest, verified: sha256(readFileSync(pointerAbs)) === old.digest };
    } else if (existsSync(pointerAbs)) {
      const st = lstatSync(pointerAbs);
      if (st.isSymbolicLink() || !st.isFile()) restore = { restored: 'absence', verified: false, error: `REFUSING_UNLINK: ${POINTER_REL} is not a regular file mid-failure; manual attention required` };
      else {
        unlinkSync(pointerAbs);
        fsyncDir(dirname(pointerAbs));
        restore = { restored: 'absence', verified: !existsSync(pointerAbs) };
      }
    } else restore = { restored: 'absence', verified: true };
  } catch (e) {
    restore = { restored: old.present ? 'previous-bytes' : 'absence', verified: false, error: e.message };
  }
  const restoreOk = restore !== null && restore.verified === true;
  return {
    ok: false,
    switched: false,
    why: `SWITCH_FAILED: ${writeErr ? writeErr.message : loadErr}; restore ${restoreOk ? `completed (${JSON.stringify(restore)})` : `DID NOT VERIFY (${JSON.stringify(restore)}) — manual repair required from git (this tool never edits graph.yaml or snapshots)`}`,
    restore,
    restore_ok: restoreOk,
  };
}

export function main(argv) {
  const mode = argv[0];
  if (mode !== 'switch' && mode !== 'verify') {
    console.error('usage: switch-authority.mjs switch --root <dir> --snapshot-version asYYYYMMDDrN --expected-digest sha256:<hex> (--expect-pointer-absent | --expect-pointer-digest sha256:<hex>)');
    console.error('       switch-authority.mjs verify --root <dir>    (read-only: loader status)');
    return 1;
  }
  const flag = (name) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : null; };
  const root = flag('--root') ?? process.cwd();
  if (mode === 'verify') {
    const r = loadPointerAuthority(root);
    console.log(JSON.stringify(r));
    return r.ok ? 0 : r.status === 'ABSENT' ? 3 : 2;
  }
  const r = switchAuthority(root, {
    snapshotVersion: flag('--snapshot-version'),
    expectedDigest: flag('--expected-digest'),
    expectPointerAbsent: argv.includes('--expect-pointer-absent'),
    expectPointerDigest: flag('--expect-pointer-digest'),
  });
  console.log(JSON.stringify(r, null, 2));
  if (r.ok) {
    if (r.two_current_pending) console.error('NOTE two_current_pending: graph.yaml#current_contract still exists — the approved switchover removes it in the SAME commit; every gate grades TWO_CURRENT_AUTHORITY red until then.');
    return 0;
  }
  return r.restore && r.restore.verified === false ? 1 : 2;
}

const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
