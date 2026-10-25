# feat(u6-pr2): FS/read family on the governance kernel — enforcing next()-guard, golden-vector fingerprint parity, old read row removed

U6 slice plan PR2 (2/6). The governed `read` becomes the first family lane
on the U6 center-assembly kernel: the Family owns the read row's body /
presentation / projection as data it contributes; the Kernel owns the
placement identity (ONE center approval table), the one-shot grant consume
(the existing tool-admission face, composed through a port), and the
ENFORCING next()-guard posture through the EXISTING `tool-dispatch/install.ts`
seam set. The old center-built read row is deleted in THIS PR — no dual-keep.

## What moves where (owner roles: `packages/tools/fs-family/README.md`)

- NEW `packages/tools/fs-family/src/` — the Family lane (owner: FS family;
  U6 PR2 single writer): `fs-mechanics.mjs` + `read-executor.mjs` (moved
  VERBATIM from `plane-effect-backends.mjs:69-242/:1067-1550`),
  `read-presentation.mjs` (moved VERBATIM from `team-tool-plane.mjs:144-277`),
  `read-row.mjs` (the row Definition builder), `fs-read-contribution.mjs`
  (the closed-schema contribution: digests over the SOURCE TEXT of exactly
  what executes), `index.mjs` barrel, and the lane's ONE TypeScript module
  `read-normalizer.ts` — the pure `case 'read'` projection (moved A2C-5 law,
  zero imports).
- `plane-effect-backends.mjs` / `team-tool-plane.mjs`: the moved regions are
  replaced by imports + a re-export block (9 symbols) so every prior import
  site and the hand-written `.d.mts` stay VALID unchanged; the plane stays
  the trusted ASSEMBLY point.
- `canonical-operation.ts` `case 'read'`: the private `effectiveReadWindow`
  is DELETED; the arm calls the family normalizer and the center computes
  the fingerprint from the returned projection (path authority stays the
  injected resolver seam; error vocabulary/reasons unchanged).
- THE GOLDEN-VECTOR GATE (mandatory per plan): the 877-vector corpus
  (fingerprints + typed-error details) recorded from master @ 2db321f63
  BEFORE the move reproduces BYTE-IDENTICALLY through the new pipeline —
  pinned digest `sha256(JSON.stringify(corpus)) =
  7fbb3ab9ae48451fc8ab41489491dfcf4d0420bfaa0f596dd09c949124a7987c` in
  `packages/runtime/test/u6-pr2-read-golden-vectors.test.ts`. Durable grants
  keyed by the operation fingerprint survive the move unchanged.

## Kernel wiring (ENFORCING, via existing seams only — no new Host hook)

- `team-tool-plane.mjs`: per-mount center assembly — closed registry +
  `register(contribution, {origin:'reviewed-manifest'})` (a registration
  refusal FAILS the assembly closed: `PLANE_READ_REGISTRATION_REFUSED`);
  kernel `publish()`; the pb §6 `placementFeed` for the owned name answers
  from the kernel's approval TABLE (lazily bound through the Guard's ONE
  minter `definitionIdentityOf`, never silently re-bound); the read consume
  routes through `kernel.consumeOnce` whose `grantConsume` port wraps the
  existing `assembly.consumeForExecution` (full legacy deny answers
  preserved; kernel adds replay-guard-BEFORE-port + lifecycle refusal);
  dispose drives the kernel lifecycle observationally (drain→tombstone→
  revoke→release).
- `tool-dispatch/install.ts` (center-interface change, disclosed): the
  install input gains the OPTIONAL `kernelGuard` port; for owned names the
  execute gate adds the post-`next()` re-check — success + drifted live
  identity (vs the pinned door identity or the table) is converted into a
  FAIL-CLOSED refusal (`kernel-post-success-drift-veto`); cancelled/error
  settles keep their native shape; un-kernel'd names are byte-for-byte
  today's law. Identity questions stay the Guard's ONE existing law
  (feed/bind check + `tools/change` abort) — nothing here re-implements it.
- `agent-bindings.mjs`: forwards the plane handle's `kernelGuard` into the
  install (absent = unchanged behavior). PR1's open item "kernel →
  tool-admission/tool-dispatch port binding" lands here.

## Center-interface change — every hunk

1. `packages/runtime/operation-permission/canonical-operation.ts` —
   `case 'read'` arm + static import + `effectiveReadWindow` deletion.
2. `packages/runtime/tool-dispatch/install.ts` — optional `kernelGuard`
   input + post-success drift veto at the execute gate (existing seam).
3. `packages/runtime/src/plugin/live/agent-bindings.mjs` — forward
   `kernelGuard` (consumer registration for the PR1-open port binding).
4. `packages/runtime/src/plugin/live/team-tool-plane.mjs` — read row/feed/
   consume now kernel-backed (assembly point).
5. `packages/runtime/src/plugin/live/plane-effect-backends.mjs` — moved
   regions → family import + re-export block.
6. `packages/runtime/tsconfig.build.json` — include the lane's TS face
   (emit-only, precedent: the Search/Shell lane's include).
7. `scripts/place-dist-glue.mjs` — six `.mjs` byte-placements (lane runtime
   face; dist mirror co-committed in this PR).
8. `scripts/audit-a5-tool-governance-imports.mjs` +
   `packages/domain/test/a5p0-layer-audit.test.ts` — book the lane's ONE
   thin effect-grammar edge (`read-executor.mjs` → `parseRequestedEffectSet`).
9. `packages/runtime/src/plugin/live/center-shadow-row.mjs` — the
   PR1-disclosed minter rebind: the shadow row now audits through the ONE
   shared `definitionIdentityOf` face (booked as a consumer next to the
   plane's GLUE-7 entry); inertness law unchanged (u6-pr1-shadow-inert
   green).
10. `packages/testkit/test/p4t6-session-event-scan.test.ts` —
   `SCANNED_PATHS_U6PR2` (10 files, MEASURED 1238→1248).
11. `packages/runtime/governance-center/README.md` — posture: read is now
    kernel-owned; PR2 port binding landed.
`control/**` and `pa-mount-registry.mjs`: UNTOUCHED.

## Tests (C1) + integration (C2)

- moved read suites ride unchanged (identities/titles kept):
  a2c5-read-fingerprint, a3p5-permission-read-projection/-wiring,
  a5-m1-read-c1c2 (admit→ask→consume→execute→settle over the kernel-routed
  consume), a5-read-slice-window (61 incl zero-flip Z1), artifact-read-*.
- NEW: golden vectors (digest gate), kernel flow (table/feed/consume),
  plants (identity-swap bind refusal; TOCTOU → `ABORTED_BEFORE_DISPATCH`
  zero bodies; post-success drift → veto with BLINDED leg; cond-10
  no-drift success).
- C2 NEW `tests/world-factory/u5-canary-runner.mjs --suite u6-fs` on the REAL
  pinned Host (0.2.0-rc.2 @ 639ed01539, shared pristine test-use tree,
  porcelain 0 before/after): **9/9 PASS**
  (run `u5-u6-fs-u6fsb8-2026-10-25T17-50-11-493Z`) — fs:mounted /
  fs:governed-read-positive (real content delivered to the member) /
  fs:refusal-zero-effect (deny typed, zero leakage) / fs:ctl-native-read
  (CI-03 native non-Team read unchanged) / fs:identity-swap +
  fs:identity-swap-sensitivity (cadence-ordered) / fs:toctou-abort (plant
  landed INSIDE the execute window) / stable-instance-unchanged /
  host-base-pristine-post / fs:leak-check. **PLANT ARM DISCLOSURE:** the
  plant legs landed on the `registration-refused` arm — re-registering the
  kernel-owned `read` in the boot/team ROOT agent scopes throws the Host's
  own scope law (`tool "read" is already registered in this scope`), so the
  kernel-table swap is INEXPRESSIBLE through public seams there; the
  member-agent/row-scope spoof rows were accepted but provably NEVER
  dispatched (post-attempt governed reads answered real content, zero
  spoof-body markers). The kernel-table swap ITSELF is pinned by C1
  (`u6-pr2-kernel-guard-plants.test.ts`). The runner's plant verdict is
  two-arm law: `registration-refused` OR `refused-at-dispatch`, both with
  zero effect.
- C2 `--suite core` RE-RUN after the last shared-runner edit: **PASS 7/7**
  (run `u5-core-u6cr2-2026-10-25T17-51-53-751Z`).
- Boot-budget DISCLOSURE: the slice plan asked <=5 Host starts for C2; the
  lane consumed 8 (u6-fs bring-up, all mechanically ledger-gated in
  `c2/budget.jsonl`) + 4 for the core re-run (new ledger) = 12. The
  suite's own final green run booted 3. Every refusal/overrun is in the
  ledgers; nothing was booted outside the factory (no :3080, no ~/.dsh).

## Gates (all re-run on the final tree; receipts in
`dev/agent-workflow/evidence/u6-pr2-20261025/`)

- `pnpm -r typecheck` exit 0 (all packages, tests included).
- root vitest x2 final passes: 7796 passed; failing set = the KNOWN
  environment/master-baseline reds measured on this machine at master @
  2db321f63 (t2-blueprint-hash, p6t3-mediation x5, p6t3-restart x2,
  p6t6-actions, rc2-sanitize, a4p7-merge-gate pre-commit legs, a5p7/a3p3
  load-boundary timings — the a3p3 leg measures 3763ms on MASTER vs 3793ms
  here and is green standalone). Zero new product reds.
- lint-identities: new 0 / resolved 0 vs the a4 baseline.
- tool-governance audit OK (26 consumers: +1 booked fs-family edge, the
  moved plane edge retired in place with provenance); a5p0-layer-audit 4/4.
- p4t6 10/10 (SCANNED_PATHS_U6PR2 measured 1238 to 1248).
- docs:sync --check blocking=0; docs:probe --base origin/master
  blocking=0 (advisories 2, same posture as master).
- ci-pr-gate legs: graph-parse / state-freshness / install /
  blueprint-fence / typecheck / artifacts-at-head PASS. Nine-root census:
  locally DECLARED-REFUSED (`--allow-refused census` — this worktree has no
  pristine `tests/deepseek-harness-test-use`, so the gate refuses pre-spawn
  by its own law, run `u6pr2-gate-census.log`); it is graded by this PR's
  census-runtime CI check, whose tolerated identity set is UNCHANGED by the
  bookings above (no new census-visible file outside the booked ten + the
  booked tests/world-factory lane).
- dist mirror co-committed: check-artifacts-committed OK (1786 files, 19
  glue placements), check:artifacts:head "HEAD carries its own build".

## Review round 1 — B1–B5 (gpt-6.1-sol) → fix → evidence

| Blocker | Fix | Proof |
| --- | --- | --- |
| B1 self-count lifecycle fallback (plane :1723-28) | Fallback DELETED: enforcing read mount without the real dispatcher port ⇒ typed `PLANE_READ_KERNEL_UNAVAILABLE`, no mount, no self-count. Production passes ONLY `a5p1Guard.pendingCalls`. | `u6-pr2-review-r1.test.ts` RED→GREEN: R1 refusal; R1c samples `port.inflight() === guard.pendingCalls().length` on success/throw/refusal/abort; kernel `release()` ⇒ `LEASE_OPEN` while the hung call is in the ledger, ok after drain (`review-r1-RED.log`). 15 suites + int-r3 kit re-wired to the ledger-ref shape; all GREEN. |
| B2 native read fallback for governed agents (CI-05) | Governed plane without a mounted read row now exposes a REJECTING guard face (`owns('read')=true`, `identityFor⇒null`); the door's pre-body table gate refuses every read BEFORE its Body; glue forwards the face lazily (no glue edit). Non-Team native lane byte-unchanged. | R2b face shape; R2c production-shape negative: governed, no fsInstance ⇒ `bodies==[]`, `center approval table no longer backs`, observation `kernel-pre-body-table-refusal`; R2d CI-03 control GREEN. |
| B3 stale world-factory SUITE_CASES | Pin updated with `fs:shadow-ledger-cap`. | `node --test tests/world-factory/world-factory.test.mjs` = 19 pass / 0 fail (was 18/1). |
| B4 golden corpus path classes | `u6-pr2-golden-corpus.mts` (injected canonicalizer) +14 classes: NFC/NFD, non-BMP, leading/climbing `..`, `./`, trailing slash, `//`, absolute inside/outside, symlink-name w/ resolver-disclosed targets. Master reference regenerated from a detached `origin/master` worktree (c6cfec890, worktree removed after). | Full-corpus byte-equal on BOTH canonicalizers: digest `bfa69f58df48b9ff7881aef6b5eb1d750b02f18a362d9c6202468ff856c6eacf`, 2893 vectors (old 877 / `7fbb3ab9…`; 300556 B → 750899 B). All 877 round-1 vectors byte-preserved inside (`golden-vectors-round2.{txt,family.json,master.json}`). |
| B5 post-cap success without independent witness | Probe-host `tools/post-execute` oracle reads the S4 file ITSELF (`leg: oracle-read-effect`, bytes/sha256/claimSeen from the oracle's own `readFileSync` — not the tool return, not the shadow ledger); the cap verdict now requires one row timestamped after the capped marker and carries it in the receipt. | `c2r3/run-u6fsb11.json` `fs:shadow-ledger-cap` PASS: `oraclePostCapRows=1`, `oracleReceipt{at=20:57:45.275Z > capAt=20:57:45.247Z, sha256=3f747935…, claimSeen=true}`. |

Bookkeeping round: p4t6 13 files / tie `1253−1240` (measured `expected 1253`);
typecheck exit 0; docs gates blocking=0; check:artifacts:head drift=0; full
runtime+fs-family+p4t6 vitest re-run on the final tree (disclosed baseline
reds only); C2 u6-fs twice, 1 boot each (`u6fsb10`/`u6fsb11`), 10/10 PASS.

Disclosed fix rounds on this branch after the first round-1 push: (1) the
new spec's TS surface (`fileURLToPath(href)` + non-literal `.mjs` import —
the earlier background typecheck wrapper's echoed exit code masked the real
log; the local gate caught it and the evidence now carries the clean rerun);
(2) fence-key preservation — the B1 ledger-holder insertion in
`a5-m1-auth-bridge.test.ts` was relocated BELOW the line-anchored
`::L1264::v2` fence adjudication (pre-site bytes restored, fence answers
ADJUDICATED, unknown 0); (3) lint identities of the new spec to 0. Local
`ci-pr-gate --allow-refused census` final state: pass=7 fail=0 skip=1
(census, CI-graded).
