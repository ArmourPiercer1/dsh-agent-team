# H6 closure report — alpha.2 hardening FOLLOW-UP closure (L1–L4 live proof + gates)

**Task**: `task/alpha2hf-h6-closure` · **worktree**: `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\alpha2hf-h6`
**Base**: int tip after H4+H5 = `dbbba5d` (H4 P1-A fresh per-decision exact-rule canonicalization; H5 P1-B bash effect-fingerprint projection)
**Scope**: verification + gates ONLY — **NO product-code changes.** Sole writer. World homes ephemeral/gitignored/never committed.

**VERDICT: alpha.2 permission baseline FROZEN (again).**
P0 end-cap unregressed, production wiring correct (incl. the bash workdir basis), the live minimal smoke **L1–L4 all PASS on a real host**, full parity has **NO new deterministic failure**, and **all gates green**. One commit, no push, worktree porcelain clean.

---

## 1. Focused suites (Part 1 — actuals)

| Suite | Actual |
| --- | --- |
| runtime 8 focused (a2·a3·a4a·a5a·a6a·h1a·h4·h5) | **264/264** PASS (recorded at the pre-h1a-extension h1a=40; byte-matches the parent cross-check) |
| domain a1 | **43/43** PASS |
| tools h3 (hostile-seam gate) | **10/10** PASS |

`focused-runtime-1.txt` / `focused-domain-1.txt` / `focused-tools-1.txt` carry the console tails.

## 2. P0 end-cap — the new H6 leg (Part 2)

`packages/runtime/test/h1a-pre-execute-endcap.test.ts` extended **in place** (40 → 49 tests; no pin move — h1a is a whole-tree-scanned file already counted, and no NEW file was added, so the p4t6 DEC-1 pin holds at 670). The one new uncovered leg per the brief is the **bash** end-cap under a hostile prepend-allow:

- **P0-K1** (5 its): an AUTHORIZED bash with the FULL H5 effect projection (`command + workdir + run_in_background + timeoutMs + sandbox_permissions`) on the ask lane, NO hostile → canonicalizes, ask→allow, **executes exactly once** (`ran:bash`), request/decision/consumption **exactly-once** (`{1,1,1}`), fingerprint is `sha256:`-prefixed and DIFFERS from the same call in a different workdir (H5 B1 workdir binding), the summary carries the `cwd=<dirA>` token + command preview, and the guard **abstains** (0 end-cap observations — no over-deny of the authorized bash path).
- **P0-K2** (4 its): the SAME bash call (full effect projection) under a hostile prepend-allow → **end-cap DENIED with the EXACT stable reason** (`k2Text === 'Error: ' + END_CAP_REASON`), the bash **body never runs** (`bashBodyCalls` delta 0), **ZERO new control rows** (`k2Rows toEqual k1Rows` baseline), and exactly **one** `end-cap-denial` observation carrying `reason` + `tool==='bash'`.

`h1a` re-ran **49/49 PASS** after the extension (see full runtime parity below, where h1a shows 49 tests).

## 3. Production wiring (Part 3 — the bash workdir basis)

- The single shared `resolveTarget` closure (`packages/runtime/src/plugin/live/agent-bindings.mjs` L1233–1248) serves **operations, exact rules, AND the bash workdir** — all canonicalized through the **same resolver + the same lazy session-header cwd basis** (`agentCtx.agent?.session?.header?.cwd`, re-read per call = the H4 same-basis invariant, FACT 3b). There is no second, divergent workdir basis for bash.
- **`process.cwd()` grep assertion** (whole-worktree, `packages/**`, src only, excluding `node_modules`/`dist`): the permission decision path (`operation-permission/` + `control/`) contains **ZERO** `process.cwd()` calls — the three hits there are contract-comment text only (`canonical-operation.ts:22`, `index.ts:44`, `types.ts:125`). The only ACTUAL `process.cwd()` calls in the tree are the four non-permission sites: `src/plugin/host.ts:854` (withDefaultWorkspace row-config default), `src/plugin/upstream-resolver.mjs:72` (plugin-row path resolve), `root-binding/harness/slots.mjs:122` and `member-residency/harness/slots-t6.mjs:128` (session-meta cwd defaults). **No `process.cwd()` is in the permission path.**
- `a6a-production-wiring` (52 tests, green in parity) pins the bind-path legs: exactly one listener + one guard per agent at create, the cold-resume re-install, close/drain, and the lazy cwd tracking the LIVE header across drives (ws-1 → ws-2).

## 4. Live minimal smoke L1–L4 (Part 4 — real host)

World: `references/.dsh-test-a2permhf-2026-09-11T10-58-06` (branch `task/alpha2hf-h6-closure` @ int tip `dbbba5d`), host port **3181**, mock **3493**; 3180 (user tsx) + 3080 (main instance) zero-touch. Kit: `a2permhf-{setup,boot,check}.mjs` (derived from the H3 kit). Policy = H3 world + the two H6 extensions: a leader exact **DENY** `read ./alias/secret.txt` (the path runs THROUGH the `alias` junction) and **bash on the default-ask lane**.

- **LIVE PASS — 155/155 checks** (`live.json` = `kit/h6-live-2026-09-11T10-58-06.json`).
- **COLD PASS — 42/42 checks** (`cold.json` = `kit/h6-cold-2026-09-11T10-58-06.json`), after `A2_PHASE=resume` re-boot of the SAME world home.

| Leg | Requirement | Result |
| --- | --- | --- |
| **L1** exact-rule topology retarget (H4 P1-A live) | T0: `alias`→dirA, read `alias/secret.txt` ⇒ **static DENY** (exact policy reason "…deny rule 1 denies read on …alias\secret.txt"), zero new requests, body untouched; retarget via node-fs `rmdirSync`+`symlinkSync(dirB, alias,'junction')` (realpath flip dirA→dirB recorded); T1: read again ⇒ **STILL static DENY**, zero new requests (no downgrade to the default-ask lane — the pre-H4 cached-key failure mode), body untouched | **PASS** — live `live-H6-L1-*` (10 checks); cold `cold-H6-L1-*` (4 checks: retarget persists, still static deny on the cold ctx, zero new requests, body untouched) |
| **L2** bash scope distinction (H5 P1-B live) | 3 foreground bash calls, same command `echo a2hf-scope-probe`, default-ask lane: (i) workdir dirA, (ii) workdir dirB, (iii) dirA + NEW callId ⇒ (i)≠(ii) fingerprint+requestId, summaries distinguishable (cwd tokens); (i)==(iii) fingerprint, (iii) requestId NEW; zero consumptions; no bash executed | **PASS** — live `live-H6-L2-*` (10 checks): fp(i)=fp(iii)=`sha256:9e7de8…4300`, fp(ii)=`sha256:bcb9a8…80a`; summaries `bash [cwd=…dirA] echo …` vs `bash [cwd=…dirB] echo …`; all three resolve deny, zero consumptions, dirA/dirB unchanged |
| **L3** hostile regression (H3 legs re-run) | hostile seam armed; policy-allowed read + default-ask + ask-lane write all end-cap DENIED with the EXACT stable reason, zero requests; worker-b hostile ⇒ end-cap (not policy) reason; worker-a no-hostile control executes; PTC two siblings denied; observations carry end-cap rows; durable plane unchanged | **PASS** — live `live-H3-0…8` (20 checks) + cold `cold-H3-0…3` (6 checks), unchanged from H3 |
| **L4** cold resume | listener+guard rebuilt on the cold bind path; exact-rule fresh canonicalization re-run post-resume (L1 T1 pattern on the persisted retarget); bash fingerprint consistent (same authority args ⇒ same fingerprint on the cold ctx) | **PASS** — cold `cold-H6-L1-*` (L1 re-proof) + `cold-H6-L2-fp-equals-live`: the cold bash request's `operationFingerprint` **EQUALS the live (i) fingerprint** (`sha256:9e7de8…4300`) under a NEW correlation/requestId — cross-world determinism of the H5 projection |

The V1 115-check live matrix + N-series and the 26-check cold battery ran **unchanged** and green; final files + counts sidecar recorded; the raw control ledger dumped into `evidence.controlLedger`.

## 5. Gates (Part 5 — actuals)

| Gate | Actual |
| --- | --- |
| **typecheck** (9 packages, worktree) | **0 errors, all 9 Done** (`gates-typecheck-1.txt`). *Note*: the first `pnpm -r run typecheck` was an invocation artifact — it ran against the MAIN repo root (session cwd), whose `packages/runtime` is a different tree, and reported spurious TS2307 (cordis/dsh-tools) there. Re-run pinned to the H6 worktree → clean 9/9. Also verified the int-tip h1a (changes stashed) typechecks clean, so the extension adds no type error. |
| **build** (`pnpm -r run build`) | all 9 packages `Done`, exit 0 (`gates-build-1.txt`) |
| **build:composition** (root) | `place-dist-glue` agent-bindings.mjs → dist **byte-identical**; client composition 87 modules/11 css; **`check-artifacts-committed` OK: 1080 files**, committed install-surface artifacts match the fresh build (`gates-build-composition-1.txt`) |
| **dist EOL / autocrlf glue** | fresh build re-polluted the LF-pinned `agent-bindings.mjs` glue with CRLF (the documented G-RMR F-2 autocrlf behavior on this machine); restored the committed LF canonical via `git checkout --`, re-scanned **0 CRLF**, and **re-verified `check-artifacts-committed` OK: 1080** |
| **p4t6 DEC-1 pin** | `p4t6-session-event-scan` **10/10 PASS @ 670** (`gates-p4t6-pin-1.txt`) — h1a extended in place, **no new scanner file**, pin holds at 670 |
| **references pristine** | `references/deepseek-harness-test-use` HEAD **`a66e470204`**, porcelain **0** — before AND after all builds |
| **world homes** | `.dsh-test-a2permhf-*` under `references/` = gitignored, never committed; H3 worlds untouched |

### Full parity — NO new deterministic failure

**runtime** (`runtime-parity-1.txt`): `Test Files 7 failed | 142 passed (149)` · `Tests 8 failed | 1560 passed (1568)`.
- Files 149 = H3's 147 + 2 new (h4, h5). Tests 1568 = 1526 + h1a(+9) + h4(+10) + h5(+25) + rmr-recovered(+7) − p6t3-send-delivery-load-dropout(−9).
- **Failing tests (8) = the pre-existing H1 baseline, exactly**: `d3` D3-4 (1) + `p6t3-mediation` (5) + `p6t3-restart` (2). **No new deterministic test failure.**
- H3 baseline flakes `p6t1-parallel` (1 test) and `rmr-remote-mount-race` (load) **both PASSED in this H6 full run** (concurrent flakes that did not fire).
- The one NEW module-load failure is `p6t3-send-delivery` — a **concurrent-load flake** (Windows `ENOTEMPTY` file-lock in `destroyDir` teardown under parallel full-suite execution), **9/9 PASS in isolation** (`runtime-parity-p6t3-isolation-1.txt`). Not deterministic.
- Stable module-load failures (unchanged, 0 tests each): `p8s3b`, `t12a-b2`, `t12a-glue`.

**domain** (`domain-parity-1.txt`): `Test Files 2 failed | 17 passed (19)` · `Tests 10 failed | 378 passed (388)` — the **SAME 10 pre-existing failures** as the H3/H2 baseline (`t1-capability-schema` 9 + `t2-blueprint-hash` 1). No new.

## 6. Deviations

- **D1 (kit, attempt 1)**: the first live world's L1 zero-request check read a STALE `/state` snapshot (baseline captured before the N6 `a2-fp2` request), so it compared 10 vs 11 and FAILED once — a kit measurement artifact, NOT a product deviation. The raw durable ledger is the authority and shows **zero** `control-request-recorded` facts for `h6-l1-t0`/`h6-l1-t1` (the L1 reads created nothing); T1's fresh-baseline zero-request check PASSED. Fixed by refreshing `st` before the T0 baseline; attempt 1 world removed (ephemeral); **attempt 2 (this report's world) is LIVE 155/155 + COLD 42/42.** See `deviation.md`.
- **D2 (gate invocation)**: the first `pnpm -r run typecheck` ran against the main-repo root (session cwd), not the worktree — a spurious cross-tree TS2307. Re-run pinned to the worktree → clean. No product impact.

## 7. Kept-debt list (carried to closure; plan §15)

1. **READ_LIMIT drift** — read-tool result cap not re-pinned this wave.
2. **PF-1 / PF-2** — the requester-scoped RAW-ledger read-path notes (why `/state` blocks while a member turn holds the work chain; the ledger is the unblocked read path).
3. **Hostile-seam removal before RC** — `POST /__hardening/hostile-prepend` is `DSH_HARDENING_PROBE`-gated (503 otherwise) and must be DELETED before any RC cut; it is a test device, not product surface.
4. **H3 baseline failures** — the pre-existing deterministic set carried unchanged: runtime `d3`(1)/`p6t3-mediation`(5)/`p6t3-restart`(2) + 0-test module-load `p8s3b`/`t12a-b2`/`t12a-glue`; domain 10 (`t1-capability-schema` 9 + `t2-blueprint-hash` 1).
5. **alpha.3** — out of scope for this wave.
6. **H5 `policyWorkspaceRoot` note** — the upstream-contract note that `resolveWorkdir` falls back to the session-header cwd (the exact basis this closure re-proves live).

## 8. Commit / hygiene

- **ONE commit** `H6 alpha.2 follow-up closure — …` containing: the whole `dev/agent-workflow/evidence/alpha2-hardening-followup/h6-closure/` evidence set (report, matrix, deviation, `live.json`/`cold.json`, focused/parity/gate txts, and the `kit/` with the three `.mjs` + state/counts/ledger JSONs + logs) + the `h1a` test extension. **No product/dist changes.**
- **No push.** Worktree **porcelain clean** after commit (world homes + scratch removed/gitignored).
- Ports 3181/3493 verified free after stop; 3180 (user tsx) + 3080 (main instance) untouched throughout.
