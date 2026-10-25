fix(u6): kernel safety — revoke-bound approvals, in-flight consume reservation, required lifecycle port, scope-keyed approvals, bounded shadow ledger

Remediation work package **FIX-K** on the U6 PR1 governance-center kernel (external audit, base `2db321f63`). The lane stays exactly as PR1 shipped it otherwise: **INERT, enforcement OFF** (`centerAssembly` default `'off'`; the kernel factory default mode is `'shadow'`; the shadow row ALWAYS takes `next()`), zero new imports from `tool-dispatch`/`tool-admission`/`operation-permission`/`control`/`pa-mount-registry`, CORE PATCH BUDGET 0, protected set untouched.

Each finding followed RED-first → fix → GREEN with the failing-test output captured in `dev/agent-workflow/evidence/u6-fixk-20261026/logs/` (RED logs recorded against unmodified master `2db321f63`).

## K1 — kernel never checked registry state (`logs/RED-kernel-safety.log`, legs 1–3)

**RED**: after `registry.revoke()`, an existing ApprovalEntry still allowed — `decide()` consulted only its own table.
**Fix**: entries are minted only against a LIVE registry candidate and snapshot `familyId + boundGeneration + boundSourceDigest`; every `decide()` re-validates the binding against the live registry — tombstoned/missing owner or a claim re-held by a different family ⇒ `CANDIDATE_REVOKED`; re-registration at a new generation (or re-digest) ⇒ `STALE_GENERATION`; re-register never resurrects a dropped entry (a new generation earns authority only through a fresh owner-surface `addApprovalEntry`/generation-checked `replaceApprovalEntry` re-bind). `dropApprovalsForFamily(familyId)` is the deterministic kernel-OWNER revoke act the trusted assembly point runs alongside `registry.revoke` (there is deliberately **no registry→kernel event edge** — the registry surface stays pinned closed and the lane registers zero new import edges; the per-decide re-validation is the fail-closed backstop).
**GREEN**: `CANDIDATE_REVOKED` after revoke, `STALE_GENERATION` after re-register until a NEW approval, drop removes exactly that family's entries; the positive control (live candidate + matching entry ⇒ allow) and condition 9 (`NOT_VERIFIED_SOURCE`) stay true.

## K2 — double-present race: consumed-set check straddled the await (`legs 4–6`)

**RED**: `consumeOnce()` added the grantId to `consumed` only AFTER `await port.consumeForExecution()` — two concurrent calls both reached the port.
**Fix**: three-state ledger `free → in flight → burned`; the reservation is inserted **synchronously before any await**; a second in-flight call refuses `GRANT_IN_FLIGHT` with `portCalled: false` **without touching the port**. The burn is outcome-independent: a port refusal AND even a port throw leave the id burned (retries get `GRANT_REPLAY`, never a re-presentation). Justification (kernel header + README): the port owns the grant ledger and its state is unobservable from the kernel — a "failed" presentation may already have committed there, so any re-presentation risks the exact double-consume the one-shot law exists to prevent; fail-closed. This **retires** the PR1 leg "a FAILED port consume does not burn the id" (disclosed below).
**GREEN**: `Promise.all` race against a deferred gate port proves `portCalls === 1` and an immediate `GRANT_IN_FLIGHT`; refusal/throw both stay burned; sequential replay after success still refuses (PR1 law holds).

## K3 — absent lifecycle port reported zero in-flight (`legs 7–8`)

**RED**: `release()` treated a missing `DispatcherLifecyclePort` as in-flight 0 and released cleanly.
**Fix**: `release()` checks transition legality first, then refuses `LIFECYCLE_PORT_MISSING` when no port is injected — the refusal detail records **`UNCOUNTED`** (no mode ever reports a clean zero it did not count); a counted non-zero still refuses `LEASE_OPEN` (CI-08). New explicit factory option `mode: 'shadow' | 'enforcing'` (default `'shadow'` — nothing ships enforcing): an **enforcing** kernel without the port **throws at construction**. `mode()` reports what was built; `createCenterAssembly` passes `mode` through.
**GREEN**: no-port release refuses with `UNCOUNTED`; enforcing factory throws; counted-zero release + counted-non-zero refusal unchanged.

## K4 — approval keyed by nativeName alone (`legs 9–12`)

**RED**: an approval minted in one scope authorized the same name in any scope; calls carried no scope.
**Fix**: table key = `(scopeKey, nativeName)`; `CallFacts` carries the HostSurfaceAdapter scoped-resolution `scopeKey` — absent ⇒ `SCOPE_UNVERIFIED` (refuse) on both the decide path and the owner-write surface; entries carry the bound source identity (`familyId` + `boundSourceDigest`), so the same name re-claimed by a different family cannot inherit the old entry. `approvalFor(scopeKey, nativeName)` reads a dead binding as gone.
**GREEN**: scope-A approval never reaches scope-B; scope-less call refuses `SCOPE_UNVERIFIED`; re-claim by another family refuses; `addApprovalEntry` refuses names no live candidate claims (`NO_CANDIDATE` — an entry without a bound candidate is dead authority).

## K5 — unbounded shadow-row ledger (`logs/RED-shadow-ledger.log`, 4 legs)

**RED**: `center-shadow-row.mjs` appended JSONL forever — disk growth with process lifetime as the only bound.
**Fix**: per-install bounded writer (`maxLedgerRows` default 5000, `maxLedgerBytes` default 1 MiB; budgets bound total file lines INCLUDING the terminal marker); at the first write that does not fit it appends ONE `leg: 'shadow-ledger-capped'` marker (budgets + written counts) and stops file appends (stop-with-marker, no rotation — a capped audit channel is auditable, not silently trimmed). Capping never changes the flow: the `observe` sink keeps every row and `next()` still runs exactly once, value untouched. `dispose()` writes the audit-close row then CLOSES the writer — post-dispose appends are impossible and all counters live in the install closure (nothing module-wide grows).
**GREEN**: row cap → file holds exactly `maxLedgerRows` lines with the marker last while the sink sees every verdict; byte cap → marker lands even at `maxLedgerBytes: 1`; dispose closes the writer (a stale listener changes zero bytes); default budget writes everything with no marker.

## Disclosed test changes (API contract moved deliberately)

`u6-pr1-kernel.test.ts` rides the fixed contract: fixtures now register a live candidate + pass `scopeKey`/`familyId` on every entry write, `fresh()` injects a counted-zero lifecycle port (K3 makes uncounted release a refusal), and the K2 leg is **inverted** to the new burn semantics ("a presented port consume is BURNED whatever the port answered") with the reasoning inline. All other PR1 legs keep their names and laws (40/40 GREEN post-fix, `logs/GREEN-u6-pr1-suites-postfix.log`).

## Receipts

- **C1 unit**: `u6-fixk-kernel-safety.test.ts` 17/17 + `u6-fixk-shadow-ledger.test.ts` 4/4 GREEN (`logs/GREEN-*.log`); RED against unmodified master: 12/17 and 4/4 failing (`logs/RED-*.log`).
- **Full root vitest**: 610 files, 7806 pass / 12 fail — all 12 are the tolerated baseline identities from `dev/agent-workflow/evidence/u1-closure-20261025/u1b/reds.json`, EXCEPT one transient `check-artifacts-committed` drift leg that failed only because the run happened mid-worktree (dist rebuilt, pre-commit) — post-commit it is GREEN: a4p7 static legs 10/10 (`logs/a4p7-static-legs-postcommit.log`), `check:artifacts` verdict `ok … drift=0` (`logs/root-vitest.json`, `logs/root-vitest.log`).
- **`pnpm -r typecheck`**: clean. **lint identities**: `new 0, resolved 0` vs baseline `lint-identities-0237d487.txt` (`logs/lint-identities.log`).
- **Layer audit**: `audit-a5-tool-governance-imports.mjs` OK — lane registers zero new edges (kernel gained no imports; revoke-invalidation is a kernel-owner surface).
- **docs**: `docs:sync --check` blocking=0; `docs-probe --base origin/master` blocking=0 non_blocking=0.
- **ci-pr-gate**: `pass=7 fail=0 skip=1 (census, named)` refused=0 (`logs/ci-pr-gate.log`), incl. artifacts-at-head `drift=0` (dist mirror co-committed: tsc emit + `place-dist-glue` byte placement).
- **p4t6 scan ledger**: measured RED `expected 1240 to be 1238` (`logs/p4t6-RED-unbooked.log`) → own `SCANNED_PATHS_FIXK` booking + tie → 10/10 GREEN.
- **C2** (`tests/world-factory/u5-canary-runner.mjs --suite u6-shadow`, ONE run, factory reused, 2 Host starts on leased 3180, `:3080` stable instance probed unchanged before/after, homes torn down): **overall=PASS 16/16** — native canary ledger sha **identical** off/shadow (`a3a450597c…`), effects/markers/cases parity all true; ON world shows 3 verdict rows all `defer NO_APPROVAL_ENTRY`, `anyAllow=false`, `shadowErrorRows=0`; OFF world proves mounted-but-inert (`center-skipped`). teamSha `c2ff22dcd` (= this PR head), Host `639ed01539` porcelain-empty. Evidence: `c2/RUN-u6-shadow-fixk.json`, `c2/u6-shadow-parity.json`, host logs `c2/logs/`.

Requested by: U6 remediation workflow (FIX-K). DO NOT MERGE without the scheduled review composition.
