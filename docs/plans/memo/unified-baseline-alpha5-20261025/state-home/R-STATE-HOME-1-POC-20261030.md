# R-STATE-HOME-1 — bounded PoC design note (2026-10-30)

> **ARCHIVED PoC DESIGN — 2026-10-31 (dated banner; body below verbatim from PR #463 head `2229c1bcbe19382786fb34c41262dd240f1a083d`, banner appended-only).**
> USER-RULING-20261031 §2 disposition: the PoC result is **accepted as design history**; PR #463 itself is **NOT merged**
> (`mergeable_state=dirty`; production-Home wiring deferred to a future product PR). This archive is **NOT production-merge
> authorization**: nothing here authorizes touching `packages/tools/families/agent-state.mjs`, `resolveAgentStateHome`,
> `DSH_HOME` semantics, or any Centre/Host interface; the `~/.dsh` operator-home guard stays exactly as is.
> **Boundary law (ruling §4):** #463's 20/20 PASS on **explicitly declared test homes** does NOT substitute for formal
> default production-Home acceptance; **R-STATE-HOME-1 closes only on live Host C2 six scenarios** (default formal Home with
> `DSH_HOME` unset, explicitly specified Home, World isolation, restart recovery, illegal-path refusal, persisted read-back).
> The ruling's canonical file `dev/agent-workflow/gates/USER-RULING-20261031.md` was **not yet on master** at archive time —
> its carrier is **PR #478** (`task/user-ruling-20261031`); until merged, cite #478. Path note: the evidence dir cited in the
> body (`dev/agent-workflow/evidence/u7r3-statehome-poc/`, PR #463 lane) resolves for this archive to
> `dev/agent-workflow/evidence/u7r3-state-home-463arch-20261031/` (same bytes); the PoC script there is the executable
> reference for the formal C1 spec `packages/runtime/test/u7-state-home-c1.test.ts` (ruling §2 Q6 promotion, this PR).
>
> DATED AMENDMENT 2026-10-31 (late, narrowing): the external reviewer re-verified upstream `639ed01539`
> (`resolveDshHome = configured ?? DSH_HOME ?? ~/.dsh`, `packages/util/home-paths/src/index.ts:87-92`; `profile-boot.ts:293/298`
> provides `profileContext.home`) and the user ruled the goal **narrowed** from "independent STATE_HOME design" to
> **REUSE the upstream trusted home**: remove the plugin's extra restrictions (unset-env `HOME_MISSING` refusal + default
> `~/.dsh` refusal in `fs-state-store.mjs`) where they conflict with production default behavior; **no new home system, no
> upstream changes**; the production/test policy split keeps the `~/.dsh` refusal for **TEST WORLDS only**. Design prep:
> `docs/plans/memo/unified-baseline-alpha5-20261025/state-home/PRODUCTION-HOME-DESIGN.md` (design lane task branch);
> implementation follows as a separate product PR with two mandated verifications — V1 pure-function equivalence,
> V2 isolated-temp-OS-HOME pristine boot. Under this narrowing the body's §3 `homePath` Center Interface variant is
> superseded for the production route (it stays recorded as explored history only).
>
> Original STATUS banner, preserved verbatim:

> **STATUS: PoC ONLY — NOT a merge candidate, NOT a decision record.**
> Lane `task/u7r3-statehome-poc-20261030` (branch of the same name, base `origin/master @ 3a850d3e3`).
> Authority: USER-RULING-20261029B item 4 — direction approved, PoC first, NOTHING merges.
> Everything below is exploration evidence + open questions; no product `src` changed, no kernel touched,
> no existing DSH Home persistence contract changed.

## 0. The question, as registered

R-STATE-HOME-1 (registered in `USER-RULING-20261029.md`, P2 production-home finding; direction in
`USER-RULING-20261029B.md` item 4): formal Agent State must persist under a governed, declared state home
with per-realm layout, digestable and census-visible; test Worlds keep independent homes and never touch
real DSH data; "production permanently refuses Agent State" is not the Alpha.5 end state. Item 4 names five
PoC questions: (1) formal home resolution + public interface incl. unset `DSH_HOME`; (2) can a trusted
assembly layer supply a normalised home; (3) prefer Host public capability, else a minimal `homePath`
Center Interface design; (4) keep ALL path protections; (5) cover default/explicit/test-World/restart/
illegal-path arms.

**Ledger honesty first:** `dev/agent-workflow/gates/U7-R3-GAP-MATRIX-20261029.md` contains **zero** rows
mentioning R-STATE-HOME-1 or state-home (grep-verified on base — the matrix is the 29-cell per-TOOL
reconciliation; R-STATE-HOME-1 is a FAMILY/remediation item). Its ledger homes today are
`USER-RULING-20261029.md` (registration), `USER-RULING-20261029B.md` item 4 (direction), `GATE-LEDGER.md`
(G5-blocking row) and `SESSION_ROUTER_LOG.md` (2026-10-29). "The C2 acceptance cell in the matrix ledger"
therefore has no existing cell to edit — §5 proposes its shape and flags the placement question for the Owner.

## 1. What already exists (verified at base `3a850d3e3`)

`packages/tools/agent-state-family/src/fs-state-store.mjs` (public entry `src/index.mjs`, mirrored
byte-identically under the tracked runtime dist) already exports the whole governed-home vocabulary:

| export | role |
| --- | --- |
| `resolveAgentStateHome({env, realHome})` | the ONE governed home resolution: absolute-or-refuse (`AGENT_STATE_STORE_HOME_INVALID`), existing-dir-or-refuse, operator live `~/.dsh` refused, **never invents a default** when `DSH_HOME` is unset (`AGENT_STATE_STORE_HOME_MISSING`) |
| `storeRootFor(home, realmId)` | per-realm derivation `<home>/team-state/agent-state/<realmId>` (`STATE_STORE_SUBTREE` + closed path-safe realm segment, `AGENT_STATE_STORE_REALM_INVALID` otherwise) |
| `createFsStateStore({rootDir, anchorDir, realmId, …})` | the store; anchor law refuses a root outside its anchor (`AGENT_STATE_STORE_PATH_REFUSED`); every op re-walks from the anchor with `O_NOFOLLOW`/openat semantics; atomic temp+fsync+rename commits; per-scope locks; per-realm `ledger/{attempts,writes}.jsonl`; `applied/` replay markers |
| `ledgerBytes`, `safeReadRecord`, `openStoreDir` | census/oracle primitives (typed `AGENT_STATE_STORE_LEDGER_UNREADABLE`, never zero-as-clean) |

`packages/tools/families/agent-state.mjs` (the production family descriptor) already resolves the home at
build via `resolveAgentStateHome()` + `storeRootFor()` and fail-closes with `PLANE_AGENT_STATE_STORE_MISSING`
when no home resolves — that fail-closure IS R-STATE-HOME-1's symptom, and the file itself documents the
named reason: the family capability object carries no home path and `cap.hostService('dshHomePath')` binds
only at `mount(agentCtx)` — **after** `build`. The store header calls the clean fix "a `homePath`
capability … a named center-interface change and is NOT made here (CORE PATCH BUDGET = 0)"
(`fs-state-store.mjs`, NAMED FOLLOW-UP, ~L240-248). So the centre gap was already NAMED before this PoC;
this PoC's job was to establish how much of R-STATE-HOME-1 does NOT need it.

## 2. Exact seam (public-only) — what the PoC drove, what it proved

PoC script: `dev/agent-workflow/evidence/u7r3-statehome-poc/run-poc.mjs` (standalone node, imports ONLY
the package public index through the runtime dist mirror — `src`↔`dist` for this package verified
byte-identical with `diff -q`). Receipts: `POC-RUN-20261030.txt` + `poc-receipt.json` (same dir; the
script is re-runnable, worlds dir gitignored). **Result: 20/20 checks PASS.**

Proved, through public API only, from two different declared state homes (plus a third as relocation target):

1. **Home governance (Q1, Q5)** — declared absolute home resolves; unset/relative/live-`~/.dsh`/missing
   all refuse typed, zero writes invented (A1-A4). Realm ids cannot name another directory (B2).
2. **ISOLATION (Q5 test-World arm)** — same `realmId` + same scope `agent:poc-agent-1` in home B reads
   `null` while home A holds the goal; realm isolation inside one home too (two realm dirs, no crossover);
   home B stayed at `writesBytes=0` the whole time (C3-C5). The **replay domain is per-home**: a consumed
   `applyId` refuses `STATE_APPLY_REPLAY` in A while the same id is an unconsumed fresh fact in B (C6-C7)
   — idempotence never leaks across homes.
3. **Anchor law across homes** — a store rooted under A cannot be constructed against B's anchor:
   `AGENT_STATE_STORE_PATH_REFUSED` at construction (D1).
4. **RELOCATABLE DIGEST** — digest = `sha256` over sorted `(subtree-relative path, sha256(file bytes))`
   for `<home>/team-state/agent-state/**`. The absolute home path never enters: a byte copy of the subtree
   to a new home digests **identical** (E2), a fresh public store instance on the relocated home reads the
   record back byte-equal (E3), and the consumed-grant refusal travels with the bytes (E4). This works
   because nothing in the durable format embeds the home path: records are
   `{schema:'agent-state-scope/1', key, realmId, goal, todos, planMode, appliedIds, updatedAt}`; ledger
   lines carry `op/scope/key/applyId/outcome/audit`, not paths.
5. **CENSUS** — one walk of a parent dir enumerates every home → resolution state → per-realm
   scope/applied/lock counts + both ledger byte counts + home digest (F1-F2, table in the receipt).

**Q2 answered:** YES — a trusted assembly layer can supply a normalised state home today: the whole
multi-home behaviour above needed nothing but the public exports and a declared directory satisfying
`resolveAgentStateHome`'s rules. **Q4 answered:** all protections (normalisation, symlink refusal, realm
containment, anchor law, atomic writes, replay domain) held untouched — nothing was weakened to make the
PoC pass.

## 3. The remaining centre question (the ONLY one), and why this is not a new blocker

The production family mount today declares its home ONLY through the host process's `DSH_HOME`
environment, sampled at build time. If the Owner wants the mount to receive a state home **different from
`DSH_HOME`** (or declared via host config/placement rather than env), that needs the already-named
`homePath` capability (a Center Interface PR + independent security review per item 4(3) and the AGENTS.md
red lines). That is a **pre-existing named follow-up**, not a blocker this PoC discovered.

**CORE_SEAM_BLOCKER: NO** for the R-STATE-HOME-1 convention as scoped here:
- governed STATE_HOME = "whatever `DSH_HOME` declares" → **zero** centre change (the layout, digest,
  census, isolation above are all public-API facts that hold today);
- migration/relocation/digest/census → zero centre change;
- only the *variant* "STATE_HOME ≠ DSH_HOME via host plumbing" depends on the named `homePath`
  Center Interface — minimal design: one closed capability field `homePath` (absolute, pre-validated) on
  the family capability object bound before `build`, with `resolveAgentStateHome` unchanged as the
  validator of whatever enters it. That design stays OUT of this PoC's scope (Centre Interface PR,
  user-owned).

## 4. Migration story for existing test-Worlds

- **Zero-migration default:** the convention IS the existing on-disk layout
  `<DSH_HOME>/team-state/agent-state/<realmId>/`. Worlds (`tests/homes/<world>`, TEST_METHODS §7) already
  satisfy it; the u7-astore C2 World (`tests/world-factory/lib/u7astore-assembly.mjs`) derives
  `STORE_ROOT = join(home, 'team-state', 'agent-state', PLANE_REALM_ID)` and reads it as its independent
  oracle — nothing moves, nothing rewrites.
- **A different STATE_HOME root:** byte-copy of the `team-state/agent-state` subtree is the whole
  migration (proven E2-E4); no record rewrite, no re-keying (records/ledgers are home-path-free), no
  schema bump. Operator byte-copy being the SANCTIONED relocation path is an Owner question (§6), not an
  assumption.
- **Test-World independence is already the enforcement direction:** the operator-live-`~/.dsh` refusal
  (A4) plus per-home isolation (C4-C7) means the ruling's "test Worlds never touch real DSH data" holds
  at the store layer today; STATE_HOME inherits, not replaces, it.
- **Dist drift discipline:** the PoC imported the tracked dist mirror because `src/index.mjs` →
  `executors.mjs` → domain governance import resolves only in the built tree — same condition every
  runtime import lives under; the existing same-commit dist-drift gate already covers it.

## 5. What census digest changes; candidate C2 acceptance cell

**Census changes (new view, consumes nothing existing):** per state home → `{stateHome: RESOLVED|code,
realms: [{realmId, scopeRecords, appliedMarkers, locks, writesLedgerBytes, attemptsLedgerBytes}],
digest}` where digest is the relocatable subtree digest above. Notes the receipt demonstrates:
the digest is over the whole subtree including ledgers, so a refused replay grows `attempts.jsonl` only —
`writes.jsonl` bytes stay byte-equal home-to-home (census-level zero-durable-write witness, visible in
the run table: home-gamma `writesB=208` identical to home-alpha after the refused replay). Honest scoping:
the repo's existing "census" word means the CI nine-root TEST census (`scripts/ci-pr-gate.mjs`) — that is
NOT this and is unchanged; this state-census is new, has no consumer gate yet, and the proposed consumers
are the u7 acceptance-runner oracle (replacing hand-derived `STORE_ROOT` reads) and G5 evidence binding.

**Candidate C2 acceptance cell** (shape mirrors `dev/agent-workflow/ledgers/u7-tool-acceptance.json` rows;
placement is an Owner decision since the 29-cell matrix has no family-level column — see §6):

```
id: R-STATE-HOME-1-C2
familyId: dsh.agent-state-family        level: C2 (candidate-bound live boot leg) + C1 deterministic legs
Owner: u7-astore lane (same world factory)
Host interface needed: NONE for the default variant (DSH_HOME-declared home);
                       `homePath` Center Interface ONLY for the STATE_HOME≠DSH_HOME variant (blocked-by, disclosed, not bypassed)
C1 (no boot):  port the PoC checks A/B/C/D/E/F into a deterministic multi-home C1 suite
               (the PoC doubles as the executable reference)
C2 (live):     production mount, World home, governed create_goal on the frozen candidate;
               independent Oracle = runner's own disk read of <home>/team-state/agent-state/<realm>/scopes/<sha>.json
               + census digest of the home persisted into the run record (candidate-bound)
Negative legs: second World home same realmId+scope → null + writesBytes=0; cross-home rooting →
               AGENT_STATE_STORE_PATH_REFUSED; illegal home (relative / operator ~/.dsh) → typed refusal
Stop condition: any leg that would need a kernel/homePath change → record the named dependency and stop
               the affected leg (this cell is GREEN without it under the default variant)
```

A GATE-LEDGER draft row for the same: `R-STATE-HOME-1 PARTIAL-CLOSED (PoC) — seam+digest+census proven
public-only at 3a850d3e3 (this note + evidence dir, PR #<n>); default variant needs no centre change;
STATE_HOME≠DSH_HOME variant stays behind the named homePath Center Interface; C2 leg pending the next
u7-astore boot package.`

## 6. Open questions for the Owner

1. **Cell placement:** R-STATE-HOME-1 has no row in the 29-cell U7-R3 matrix (it is per-tool). Accept it
   as a GATE-LEDGER remediation row with the §5 C2 leg riding the u7-astore boot package, or add a
   family-level cell to the matrix?
2. **STATE_HOME precedence:** sanction `STATE_HOME := DSH_HOME` as the Alpha.5 governed convention
   (zero centre change), with the `homePath` Center Interface PR deferred? Or open the Centre Interface PR
   now (item 4(3) route: minimal design + independent security review)?
3. **Relocation sanction:** is operator byte-copy of `team-state/agent-state/**` the sanctioned migration
   procedure (the PoC proves it suffices), or must a tool command own it?
4. **Census consumer:** which gate/evidence surface binds the home digest (proposed: u7 acceptance run
   records + G5 candidate evidence)? Should the digest live in the acceptance ledger rows?
5. **Lock-file digest policy:** the PoC digest includes `locks/` (empty after clean applies); should the
   governed census exclude transient `locks/` for cross-run digest stability, or keep them as
   presence-evidence? (PoC kept everything; digest stability held.)
6. **C1 promotion path:** the §5 C1 legs are deterministic and boot-free — fold them into
   `packages/runtime/test/u7-agentstate-fs-store-c1.test.ts` lineage in a REAL PR later, subject to the
   usual review, not from this PoC branch.

## 7. Boundaries (honesty)

No live Host boot, no G5 evidence value, no ledger/gate file edited — this note and its evidence dir are
the entire change. Worlds live workspace-local under the evidence dir (sandbox constraint, gitignored,
recreatable by re-running the script). The fake operator home was passed explicitly so the real `~/.dsh`
was never consulted. Nothing here settles, clears, or merges anything.
