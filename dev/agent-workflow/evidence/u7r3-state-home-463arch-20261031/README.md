# u7r3-state-home-463arch-20261031 — archive evidence for adjudicated PR #463 content

**Lane:** `task/u7r3-463-archive-20261031` (branch + worktree `.worktrees/u7r3-463arch`), base `origin/master @ 89d96a13d`.
**Authority:** USER-RULING-20261031 §2 (six-answer NO-MERGE ruling). The canonical ruling file
`dev/agent-workflow/gates/USER-RULING-20261031.md` was **not yet on master** at archive time — its carrier is **PR #478**
(`task/user-ruling-20261031`); until merged, cite #478.
**PR status:** DO-NOT-MERGE — pending independent review (R-DM-1).

## Source PR #463 (untouched)

| field | value |
| --- | --- |
| PR | #463 `docs+PoC: R-STATE-HOME-1 state-home seam exploration (NOT FOR MERGE)` |
| head branch | `task/u7r3-statehome-poc-20261030` (NOT rebased, NOT merged, NOT commented on by this lane) |
| head sha | `2229c1bcbe19382786fb34c41262dd240f1a083d` |
| state at archive | OPEN, `mergeable=CONFLICTING`, `mergeStateStatus=DIRTY` (recorded in the ruling itself) |
| PoC result | 20/20 checks PASS (offline, explicit declared test homes, public API only) |

## Disposition = NO-MERGE (ruling §2, six answers)

1. **Cell placement:** GATE-LEDGER independent Family-level remediation row — not a 30th tool, the 29-cell matrix count is unchanged.
2. **Wiring authority:** explicit test homes may keep using `DSH_HOME`; a formal production Home must come from trusted Host
   configuration or a public interface; any `homePath` Center Interface study requires an independent security review first;
   Host private interfaces stay untouched; the `~/.dsh` guard is never removed to make a production Home writable.
3. **Migration:** cold migration after write-stop is sanctioned (stop → verify digests → copy → remount → read back → switch);
   online hot migration is NOT approved.
4. **Digest binding:** Home digest binds to the C2 RUN Record and final G5 candidate evidence — not into every tool L1–L4 cell.
5. **Lock files:** excluded from the stable state digest; lock state recorded separately; non-empty locks get explicit handling.
6. **PoC test promotion:** agreed — deterministic PoC tests enter the formal C1 suite **as an independent PR**, existing
   regression tests kept; **C1 PASS never substitutes the production default-Home C2.** That promotion is what this PR carries:
   `packages/runtime/test/u7-state-home-c1.test.ts` (20 legs A1–F2, 1:1 with the PoC checks).

`#463` itself is NOT merged; production-Home wiring is deferred to a future product PR.

## DATED AMENDMENT 2026-10-31 (late, narrowing — USER-RULING-20261031 §2 narrowed)

The external reviewer re-verified upstream `639ed01539` (`resolveDshHome = configured ?? DSH_HOME ?? ~/.dsh` at
`packages/util/home-paths/src/index.ts:87-92`; `profile-boot.ts:293/298` provides `profileContext.home`) and the user ruled the
goal **narrowed** from "independent STATE_HOME design" to **REUSE the upstream trusted home**: remove the plugin's extra
restrictions (unset-env `HOME_MISSING` + default `~/.dsh` refusal in `fs-state-store.mjs`) where they conflict with production
default behavior; **no new home system, no upstream changes**; the production/test policy split keeps the `~/.dsh` refusal for
**TEST WORLDS only**. Design prep: `docs/plans/memo/unified-baseline-alpha5-20261025/state-home/PRODUCTION-HOME-DESIGN.md`
(design lane task branch; not on master or on this branch — path citation, not a sha pin). Implementation follows as a
**separate product PR** with two mandated verifications: **V1** pure-function equivalence against upstream `resolveDshHome`,
**V2** isolated-temp-OS-HOME pristine boot. Consequence for this archive: the C1 legs A2/A4 (unset-`DSH_HOME` refusal,
operator `~/.dsh` refusal) stay — their assertion scope is **TEST-WORLD policy**, marked in dated comments inside
`u7-state-home-c1.test.ts` and the memo banner, so the archive cannot be misread as endorsing production refusal.

## Boundary law (ruling §4 — hold or stop)

- #463's **20/20 PASS on explicitly declared test homes is NOT** acceptance of the formal default production Home.
- **R-STATE-HOME-1 stays G5-blocking** and closes ONLY on live Host **C2 six scenarios**: (1) default formal Home with
  `DSH_HOME` unset, (2) explicitly specified Home, (3) World isolation, (4) restart recovery, (5) illegal-path refusal,
  (6) persisted read-back.
- C1 test completion ≠ U7-R3 product acceptance.

## Deliberate exclusions (NOT copied into this archive)

- **No production wiring:** nothing touching `packages/tools/families/agent-state.mjs`, `resolveAgentStateHome`,
  `DSH_HOME` semantics, or any Centre/Host interface; the `~/.dsh` operator guard is untouched. Test-side env plumbing
  exists only inside the test scope (explicit `env` object + fake `realHome`; `process.env` never mutated).
- No merge, no rebase, no comment on PR #463; its branch history is untouched.
- No `SESSION_ROUTER_LOG.md` edit (log sync is the main lane's post-merge step).
- No GATE-LEDGER row edit (ruling Q1 placement is recorded here as history; the ledger surface is owner-owned).

## Contents

| file | kind |
| --- | --- |
| `README.md` | this disposition + boundary law + narrowing amendment |
| `../u7r3-statehome-poc` (same bytes) → `run-poc.mjs`, `POC-RUN-20261030.txt`, `poc-receipt.json`, `.gitignore` (`worlds/`) | VERBATIM byte copies of PR #463 head `2229c1bc` evidence (sha256 verified: `run-poc.mjs f25438d58e8eefeb…`, `POC-RUN-20261030.txt 5b162e8f4f99f0ba…`, `poc-receipt.json d658d9c33cc06b81…`, `.gitignore fa17c87da10e91aa…`) |
| `POC-RERUN-20261031.txt` | verbatim PoC script re-run **on this branch** (same-depth scratch dir, removed after): 20/20 PASS, exit 0 |
| `C1-GREEN-RUN-20261031.txt` | formal C1 spec green runs (two consecutive 20/20, node v24.21.0, vitest 4.1.11, offline) |
| `p4t6-RED-unbooked-20261031.txt` | scanner measurement with the new spec present, clause unbooked: `scanner counts 1391, ledger derives 983 + 407 = 1390` (exit 1) |
| `p4t6-GREEN-booked-20261031.txt` | base control (no file/no booking: 20/20 at 1390) + booked control (`packages/testkit/test/p4t6-bookings/u7r3-463arch.json`, 1390→1391): 20/20 |

The design note archived beside this dir: `docs/plans/memo/unified-baseline-alpha5-20261025/state-home/R-STATE-HOME-1-POC-20261030.md`
(body verbatim from #463 head, dated archive banner + narrowing amendment appended-only).

## Reproduce

```bash
pnpm exec vitest run packages/runtime/test/u7-state-home-c1.test.ts        # 20/20 offline
(cd packages/testkit && pnpm exec vitest run test/p4t6-session-event-scan.test.ts)  # 20/20 booked
```
