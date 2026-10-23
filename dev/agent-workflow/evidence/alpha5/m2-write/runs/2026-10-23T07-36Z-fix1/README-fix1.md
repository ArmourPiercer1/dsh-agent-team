# M2-WRITE-01 — fix round 1 (root security ruling 2026-10-23 07:13)

Card: **M2-WRITE-01** (tool `write`, matrix row `write (M-02)`).
Worktree `.worktrees/a5-m1-kernel`, branch `feat/a5-m1-center-kernel`, base HEAD `c978eb2fc`
(first revision of `write-slice.ts` pushed by CENTER as `a852227c6`).
This round: the ruling's ONE targeted fix. No commits, no push, no Host, no mounts.
Per CENTER's CI directive (07:3x): **no dist/mirror/glue built here** — the 8 dist entries
(4 new `write-slice.*` + 4 updated `index.*`) are CENTER's single-writer build action.

## 1. The three reproduced defects — BEFORE (verbatim reproduction) / AFTER (refusal verbatim)

Repro legs run against a **frozen verbatim copy** of the pushed old revision
(`repro/pre-fix-write-slice.ts`, extracted via `git show a852227c6:…`), imported by
`packages/tools/a5p5-tools/test/a5m2-write-slice-defect-repro.test.ts`
(run: `runs/2026-10-23T07-36Z-fix1/defect-repro.raw`, 3/3 PASS = the defects are real, verbatim):

| # | BEFORE (defect-repro leg, old artifact) | AFTER (c1-fix leg, fixed artifact) |
|---|---|---|
| ① cross member/call | **D1**: one approval at a target auto-approves ANY content / ANY callId / ANY member — the two PA requests carry the IDENTICAL fingerprint (effect-set fp is content-blind) and the PA request key set is verbatim `['callId','parametersFingerprint','realmId','requestedEffects']` (member/binding NEVER forwarded; `call.member` dead). Attacker bytes replace approved bytes. | **N12**: redeeming the real approved pair under member B / call Y ⇒ `admission-identity-mismatch:member` / `:call`, zero write, `consumedCount 0`. **N13**: same call presenting different content ⇒ `admission-identity-mismatch:fingerprint` (A2C-5 via the REAL `canonicalizeOperation`), bytes unchanged. **N6**: calls without real identity refused before anything (`identity-token-missing` / `identity-member-malformed` / `identity-binding-malformed`). |
| ② concurrent same grant | **D2**: ONE single-use grant backs two concurrent calls; consumption was recorded by `onWriteCommitted` AFTER success, so both pass the consumed-view check, both open, both write (first writer's bytes silently lost), ledger knows ONE grant. | **N7**: SAME exec token ⇒ single-flight (`exec-token-replay`, in-flight and settled spellings), ONE PA walk, ONE write ever. **N14**: THREE concurrent calls over ONE real approved pair ⇒ exactly ONE `written`, both losers `APPROVAL_STALE` / `grant-consumed` from the REAL one-shot kernel ledger; `consumedCount() === 1`. Cancellation: **N8** pre-aborted ⇒ `cancelled` with ZERO PA walk; abort DURING the wait ⇒ `cancelled`, zero bytes; the `{allow, cancelled:true}` verdict is a fact, never the allow branch. |
| ③ root swapped during PA wait | **D3**: while PA is awaited, the governed root is replaced by a symlink to the outside dir; the old face reports `written`, the receipt names the ANCHOR locator, and the bytes land OUTSIDE (`OUTSIDE-OVERWRITE` in the victim file). The lane binds `realpath(rootDir)` CURRENT — self-consistent with the swapped root, agreeing with nothing approved. | **N20**: the same swap during the REAL PA wait ⇒ `ANCHOR-DRIFT` (admission class), victim file verbatim `ORIGINAL-OUTSIDE-DATA`, `consumedCount 0` (drift refuses BEFORE the consumption edge). **N21**: the root's ANCESTOR moved+symlinked during the wait ⇒ same `ANCHOR-DRIFT`. |

## 2. The three mandated repairs (必修三项), as landed in `src/write-slice.ts`

1. **Full-plan freeze** (was: `effects.fp` as parameters fingerprint, `call.member` unused).
   Law 5 (:489): the plan freezes through the injected M1 canonicalizer
   (`operation-permission/canonical-operation.ts::canonicalizeOperation` — the write
   projection carries `contentHash` + resolved target key; A2C-5). The canonical fingerprint —
   never the effect-set fingerprint — is what the PA edge (:533), the identity seam (:563) and
   the exec-time port (:597) bind. A canonicalization failure is a typed refusal, never a
   pass-through (§7.5). NO new fingerprint system, NO new ledger: `write-slice.ts` contains no
   hash code at all; the effect-set grammar still rides as `requestedEffects`.
2. **Sole consumption point + cancel semantics + single-flight** (was: no cancel handling,
   post-success consumption racing). The PA arm is the OPEN half (admit; consumes nothing);
   THE one consumption point is the gated lane's exec-time recheck through
   `makePort` = production `createFsAdmissionPort` = kernel one-shot `consumeForExecution`
   (:594-598). The token ledger (:448, correlation-only, read-row discipline) single-flights
   per exec token; in-flight and settled replays are BOTH refused. `cancelled` outcomes at
   :527/:551/:571 are facts, never writes, never refusals. `onWriteCommitted` (:610) RECORDS
   only — never authorizes, never consumes.
3. **ANCHOR-DRIFT law** (was: a bare post-approval re-realpath that agrees with nothing).
   Law 11 (:581): AFTER approval, BEFORE the open, the injected drift seam re-runs the read
   side's discipline — root-identity agreement (covers the root AND every ancestor) +
   approved-target agreement (aliases are drift). Any drift: typed stale refusal, zero write,
   zero re-approval. The FINAL FD check (O_NOFOLLOW open + exec-time re-read) remains the
   gated C-FS lane's own law and still runs after it — the fix is the agreement, not a second
   realpath.

## 3. The six C1 leg classes (ruling-mandated) — where they run

| class | legs |
|---|---|
| content-change | P2 (distinct contents ⇒ distinct plan fingerprints, 2 grants, `consumedCount 2`), N13 (swap under frozen approval ⇒ `:fingerprint`) |
| cross member/call | N12 (`:member`, `:call`), P4 (positive: member B rides B grant through the REAL kernel) |
| concurrent token-or-grant | N7 (token single-flight), N14 (3-way race over one grant ⇒ one write + 2× `APPROVAL_STALE grant-consumed`, `consumedCount 1`) |
| cancel-during-wait | N8 (pre-aborted / abort-during-wait / `{allow,cancelled}`) |
| REAL center-consumption positive control | P1 (real `createProductionAdmissionAssembly` + real one-shot ledger: `consumedCount()===1`, fact record, PA request key set carries the five bindings); every refusal leg asserts `consumedCount()===0` |
| root AND ancestor drift | N20 (root→symlink during real PA wait), N21 (ancestor moved+symlinked) |

Plus the retained law legs: schema (N1-N3), lexical escape (N4-N5), identity law (N6),
pending (N9), slice default-deny (N10), REAL kernel deny (N11), REAL ask-lane honest denial
(N11b `APPROVAL_REQUEST_UNAVAILABLE`), effect-outside-grant (N15), symlink target now dies at
the plan freeze (N16 — the lane alias law stays as the second net), hidden-write loud (N17),
unbound port refuses (N18), grant-fingerprint divergence (N19 `fingerprint-divergence`, lane,
before the port), undetermined-honesty mapping law (pure leg: `mapLaneError` keeps
`sideEffectPossible`; unstated = conservative TRUE).

Run: `runs/2026-10-23T07-36Z-fix1/c1-fix.raw` — **26/26 PASS**, RUNNER_EXIT=0.
Repro run: `runs/2026-10-23T07-36Z-fix1/defect-repro.raw` — **3/3 PASS** (defects real), RUNNER_EXIT=0.

## 4. Policy grammar 口径 (banned default-allow)

Every assembly is built with `{default:'deny'|'ask', allow:[explicit exact rules]}`.
The first C1's `{default:'allow'}` harness shape is GONE. The file class projects only
exact/subtree resource rules — a whole-tool `'any'` allow over a file tool keeps ONLY the
tool-invoke arm ("TIGHTER than declared, disclosed never silent"), so each governed target
rides its own exact rule (same shape as every passing kernel test). `edit`/`replace` (future
cards) additionally require a READ effect — recorded here because this face is `write`
(create-or-replace, no old-content read; D-C2-1 receipt unchanged: locator+fingerprint only).

## 5. Disclosures

- **PARKED, NOT DELIVERED**: `governed-write-row.mjs` + `a5m2-governed-write-row-c1.test.ts`
  (the withdrawn production-assembly direction) moved to `parked/*.PARKED` — the row file was
  turning the governance audit red as an UNLISTED consumer (`governed-write-row.mjs`), and the
  row test carries the banned default-allow shape. Nothing deleted. Not delivered, not wired.
- **Lane census gate RED (legit, other-owned, reported verbatim not circumvented)**:
  `a5p5-dormant-audit` — `packages/testkit/test/p4t6-session-event-scan.test.ts:294/297` are
  comment lines mentioning `a5p5-tools` that violate the ledger's quoted-path line grammar
  (`/^'packages\/tools\/a5p5-tools\/[^']+',$/`). Booked in by CENTER at `c978eb2fc`
  (`git status` for that file is clean). Lane full: 105/106, the only failure is this gate
  (`runs/…/lane-full.raw`). Testkit is not my file.
- **NOT_VERIFIED (honesty)**: (a) the real `write-side-effect-unconfirmed` RACE cannot be
  forced from fixture level — the C-FS suite owns it; this round pins the MAPPING law
  (`mapLaneError`) as a pure leg instead. (b) This is FIXTURE-level C1: the plane
  write-takeover row does not exist; production wiring (the `canonicalize` / `resolveTarget`
  / `checkDrift` / `makePort` arms) rides the same seams with the real read-row resolver and
  `createFsAdmissionPort` at future C2 wiring. (c) No Host leg, no ports.
- No commits, no push; the 8 `dist/` entries stay untouched for CENTER's single build action.

## 6. Delta of this round (my files only)

| file | state |
|---|---|
| `packages/tools/a5p5-tools/src/write-slice.ts` | rewritten (fix round 1; ZERO `tool-governance`/`tool-dispatch` strings — consumer set unchanged) |
| `packages/tools/a5p5-tools/test/a5m2-write-slice.test.ts` | rewritten (26 legs, real parts, lawful grammar) |
| `packages/tools/a5p5-tools/test/a5m2-write-slice-defect-repro.test.ts` | NEW (3 pre-fix reproduction legs vs the frozen old copy) |
| `dev/agent-workflow/evidence/alpha5/m2-write/repro/` | NEW (frozen old slice copy) |
| `dev/agent-workflow/evidence/alpha5/m2-write/parked/` | NEW (2 parked stopped-direction files) |
| `dev/agent-workflow/evidence/alpha5/m2-write/runs/2026-10-23T07-36Z-fix1/` | NEW (this round's captures) |

Gates: `tsc -p packages/tools/a5p5-tools/tsconfig.json` EXIT=0 (`tsc-a5p5.txt`);
eslint on my three files EXIT=0 (`eslint.txt`); `audit-a5-tool-governance-imports.mjs`
EXIT=0, 29 consumers, `write-slice.ts` NOT among them (`audit.txt`).
`git status --porcelain` at capture: `git-status.txt` (other cards' entries untouched).
