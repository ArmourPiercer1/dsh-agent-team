# pinnedHost READ verification — verdicts (grading run 2026-10-20T08-12-12Z)

actual-tested-bytes = c515b064cbbe3e97a8c66babc39aaa316953d766 (pushed head; blob-equality
proven: index.ts cb0efa595a5cd25c / read-body.ts 8e84b7ca1e601627 / errors.ts e7cf88b1d323111c —
pushed-c515 sha256 == pinned-clone sha256, MATCH all three; world install face = github#same-sha;
pin clone porcelain clean; kit worktree 14db127c — the kit (evidence code) differs from c515,
the TESTED PILOT SOURCE does not.)

## Four evidence pieces (root RELEASE), all real-run real-recorded
1. original native body = 0: PASS (RP-NO-NATIVE-BODY, loader-hook count=0 in the pilot PID;
   structural separate-PID law booked as the accompanying note).
2. native schema + output parity: PASS (RP-PARITY 8/8 STRICT byte equality vs wire envelopes,
   zero normalization; v8 past-EOF is the both-mounts typed control — native "Error: offset
   9999 is out of range for ..." vs pilot GOV_NOT_FOUND with the identical message law,
   recorded as the single honest mismatch, NEVER pass-ized).
3. allow / deny / ask three forms: PASS (RP-ALLOW serve + net-fd-0; RP-DENY revoked ->
   GOV_ABANDONED_REVOKED reads=0; RP-ASK pending -> GOV_ADMISSION_MISSING opens=0 reads=0,
   resolved -> serves; witnesses in pilot-forms.json).
4. cancellation: PASS (RP-CANCEL-PILOT pre opens=0 / mid reads=0 fdDelta=0, both typed;
   RP-CANCEL-WORLD session.cancel accepted:true receipt mid-turn + turn settled).

## HARNESS FAILURES PRESERVED AS FAILURES (append-only, root order ①)
- run6: mock dispatch short-circuit (DISC branch first on accumulated history) — every tool
  turn answered DISC_OK. Harness law: specificity-first dispatch.
- run7: prompt ok:true treated as turn completion (it is QUEUE ADMITTANCE) — no wire poll.
- run8: FIRST-marker law answered v1 forever on later turns (history accumulation).
- run9: POSITIONAL capture off-by-history — v2..v9 "native" bytes were v1 RE-CAPTURES.
  ONLY v1's parity stood at that point; v2-v9 greens were void. Fixed with the
  session+tool_use_id+issuance-registry pairing (run10), under which the 8/8 strict parity
  was RE-EARNED. run9's FAIL lines stand in its own run dir; they are not rewritten.
- run1..5 harness bugs (install recipe, memory-side over-redaction killing BOOT_MARKER,
  missing plugin row = session/not-found): all harness, all recorded, none product.

## v8 note (root order ②, no loosening)
GOV_NOT_FOUND for offset-out-of-range is the PORT's own typed code (index.ts finish() law,
message text byte-equal to native's). Pinned bytes proven = pushed c515 (blob hashes above).
The mismatch stays recorded in parity-diff.json; the criterion asserts BOTH-mounts-typed and
nothing more.

## Homes/port metadata (root 3496 order)
Every run = FRESH DIR (non-symlink) tests/homes/a5rp-<own-stamp> + own pin clone; mock 3496 is
an in-memory HTTP stand-in with NO home/credentials; pnpm storeDir=.a5rp-store (lane-owned,
created by this lane). Retired/DO-NOT-REUSE dirs: never touched. No raw token ever lands
(RP-EVID-CLEAN hits=[] every run); token parsed in-memory only, stored as tokenHash.
