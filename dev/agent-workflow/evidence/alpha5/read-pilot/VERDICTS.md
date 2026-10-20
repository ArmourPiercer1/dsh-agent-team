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

---
# APPENDIX A (2026-10-20, root correction orders + 8ae PASS wording list — append-only; run dirs NOT rewritten; NO new runs for these corrections)

## A0 run governance of this package
- Reference run = runs/2026-10-20T08-22-06Z (run12). It began BEFORE the "no re-runs" order arrived
  and completed after; adopted as-is (same pinned bytes c515b064cbbe… + added ledger/hashes/read-only
  check). Earlier run10 remains on record (its criteria.json still says 21 checks). No re-runs
  are or will be done for the wording corrections below.
- runs/2026-10-20T08-21-28Z (run11) = PRODUCT-SIDE BOOT FLAKE, recorded: plugin `bootstrap FAILED:
  TeamDomainError: store 'session_bindings' get rejected: the TeamDomain is closed` at bootPhase-create
  (bindFreshRoot), MOUNTED then dead → session/not-found. Same recipe passed runs 6-10,12: flake
  observation booked for the plugin lane (a5-tools-gov plane), NOT caused by harness or by the pilot.

## A1 (root ③ / 8ae ⑤) denominator & positive-control precision
- Parity denominator = ALL 9 vectors: **8/9 strict byte equality**; v8-pastEOF is a RECORDED
  MISMATCH inside the denominator — no red hidden by exclusion.
- Positive control law: "v1 true equality" means WITHIN a single run the native wire envelope
  equals the pilot render — NOT identical bytes across runs (paths carry per-run home stamps).
- run9 self-attestation harmony: its 9 "native" captures hashed to ONE identical value
  (811a5b94) = the recapture signature; three-way consistent with the harness-failure ledger.

## A2 (8ae ②) v8 machine entry (parity-diff.v8 completed)
- nativeLen=182; pilot typed-message length=175; DELTA = 7 = exactly the `"Error: "` envelope
  prefix that the HOST tool runtime wrapper prepends when it stringifies a thrown error — that
  prefix layer lives in the host adapter, which the isolated pilot (no production assembly) does
  not own. pilotLen/pilotHead are now machine-filled for error vectors by the kit (future runs).
- v8 full item: expected = native typed out-of-range; observed native = `Error: offset 9999 is
  out of range for "<run home>/rpdata/plain.txt" (3 lines)`; observed pilot = typed
  GOV_NOT_FOUND with byte-identical message law (`offset 9999 is out of range for "…plain.txt"
  (3 lines)`); path = same fixture file, same caps; support-status: typed-refusal parity SUPPORTED;
  wire-envelope byte parity for error paths UNSUPPORTED-AT-PILOT-LAYER (host adapter owns the
  "Error: " prefix) — recorded, not pass-ized.

## A3 (8ae ①) native-body=0 claim narrowed to the mechanism-provable surface
- Exact claim: the ESM **resolve hook** observed ZERO resolution whose **specifier string**
  matched /tool-fs|read-render/ inside the instrumented pilot PID. That is all the instrument
  proves: specifier-substring only (pre-resolution), ESM-resolve path only, single PID. It is
  NOT a whole-process proof; the host world legitimately EXECUTES the native body (that is
  mount N). Kit hardened for future runs: hit lines now carry pid= and the hook additionally
  matches the RESOLVED URL, not just the specifier.

## A4 (8ae ④) DENY-form semantics mapping (registered)
- RP-DENY tests **revoked-AFTER-grant**: a live view flipping revoked before the effect ⇒
  GOV_ABANDONED_REVOKED, reads=0. The "NEVER granted" shape is carried by RP-ASK-pending
  (no binding ⇒ GOV_ADMISSION_MISSING, opens=0, reads=0). The two refuse faces are distinct
  and both legged; neither substitutes for the other.

## A5 (8ae ③) counting caliber (package body rules)
- criteria.json body = **23 checks (all pass) + 3 note(null) = 26 lines**; KIT_SUMMARY
  {"total":23,"pass":23,"fail":0}. Earlier "21 PASS" and the interim "22/22" order are void —
  the package body is authoritative, as ordered.

## A6 (ledger provenance, root)
- callid-ledger.json + src-dist-hashes.json exist ONLY in run12 (live-recorded there; issued
  per-turn + capturedBy {callId,resultId,bytes} × 9; dist face 1773 files aggregate sha256
  36474497c49b…; pin src 4 files). For run10 the pairing ledger was NOT persisted ⇒ marked
  UNVERIFIED for run10; nothing is back-filled or reconstructed after the fact.

## A7 PENDING ROOT RULINGS (do not self-modify)
- P1: whether the unauthenticated GET probe of :3080 (H0 before / T3 after, 401-identity law)
  is within the authorized probe surface — awaiting root.
- P2: whether the cancel leg needs an additional terminal-attribution requirement beyond
  accepted:true + turn-settled receipt — awaiting root.

---
# APPENDIX B (root P1/P2 rulings + 8ae wording core PASS with 4 fixes — append-only; zero reruns)

## B1 (root P1) :3080 probe = WITHIN the authorized surface
Unauthenticated GET health/root probe of the existing local instance, STATUS recorded only,
zero secrets; no login/config/deploy/session actions ever. P1 RESOLVED "within authorized
surface"; never an approval blocker.

## B2 (root P2) cancel terminal-attribution leg = **PENDING**, missing elements named
Required three: (a) exact call/run identity of the canceled in-flight effect, (b) observed
terminal outcome of the turn, (c) post-cancel NO content-read/effect witness.
run12 artifacts: (a) MISSING — callid-ledger shows NO issued call for the bigc turn (see B3);
(b) PARTIAL — accepted:true receipt (request ack only) + queue-receipt settled:true; NO turn-
terminal observation; (c) MISSING — no post-cancel witness ledger. The leg stays PENDING with
exactly (a)(c) missing and (b) downgraded to request-ack per root wording. Not run-polished.

## B3 harness-fidelity observation (new, run12): the BIGC turn was HIJACKED by the last-marker
law — prior-turn VECTURN markers in history matched first, so the bigc turn answered a DONE text
and issued NO read call. RP-CANCEL-WORLD therefore honestly supports ONLY: "typed session.cancel
accepted (accepted:true) while SOME root-session turn was in flight; queue receipt settled" —
NOT "a read was canceled mid-flight". Scope corrected here, not re-gated.

## B4 (8ae ①) native-body claim text + PID count corrected
Kit criterion now reads the narrowed claim (specifier-substring + ESM resolve, per instrumented
PID) — future runs carry it; old run texts untouched. CORRECTION to A3: the package instrumented
THREE PIDs (serve/forms/cancel phase processes), not "single PID"; the claim per PID is unchanged
and strictly narrower.

## B5 (8ae ②) v8 field semantics for future runs
pilotLen for error vectors = the RAW typed-message length (175), with a separate
hostPrefixBytes:7 field — never a synthesized 182 masquerading as pilot output. run12's shipped
null stays as shipped.

## B6 (8ae ③) erratum to A0
run10's criteria body = 22 checks / 25 lines, KIT_SUMMARY 22/22. The "21" in A0 quoted the then
live order text, not run10's body — corrected; A5's caliber (package body rules) stands.

## B7 (8ae ④) instrument provenance
run12 ran with the hooks blob sha 647fa2eb (pre-hardening instrument, as shipped in 2ddc6180).
The hardened kit/hook (456c2e1d, pid= lines + resolved-URL matching) has NOT been exercised by
any run — stated plainly; no run may cite it as evidence.
