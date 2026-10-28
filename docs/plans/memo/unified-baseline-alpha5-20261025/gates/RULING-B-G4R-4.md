# Main-agent ruling B-G4R-4 — G4-R phase 3: +1 boot for the ARC-A ENV retry — 2026-10-28

**What this rules.** Phase-3 leg 1 (ARC-A) consumed its single authorized start and recorded an honest
`overall: FAIL` whose ONLY failure class is a lane-provisioning gap (an ENV/harness defect), fixed between
attempts. This ruling authorizes **one additional start (+1) for an ARC-A retry only**, taking the G4-R
total from the B-G4R-3 ceiling of 9 to **10** — which exceeds R1's envelope (6) by **4, disclosed**. All
other legs keep their B-G4R-3 table unchanged (ARC-D 1, Jobs 1, ARC-B 1, crash 2). No other start is
authorized by this document; a second ENV retry of any leg requires a further ruling.

**Issued by.** The main agent (takeover session 2), 2026-10-28, before the retry spawn, per R1's standing
rule "No over-budget boots without a new main-agent ruling" and the user standing ruling that boot-budget
extensions are executed **with disclosure as over-budget**, never silently.

**Nature.** Authorization + disclosure, not a gate verdict. G4 remains `G4-CORE-PASS / BRIDGE-BLOCKED`.

## The defect this authorizes a retry for (measured, ENV class)

- Leg 1 record: `.worktrees/u7-g4r3/dev/agent-workflow/evidence/u7-g4r3-20261028/arc-a/run-record.json`
  (lane worktree; every file named in this section lives under `.worktrees/u7-g4r3/` and becomes tracked
  when the lane's Finish commit lands on PR #432), run
  `u5-u6-arc-a-g4r3a-2026-10-28T17-15-44-158Z` (`bindings.teamSha` = the candidate; top-level `teamSha` is null), `overall: FAIL` (9 of 10 cases fail on `mount readiness
  failed` / the mount itself; the one PASS is the `stable-instance-unchanged` guard case — its 401 read
  proves :3080 stayed untouched). The world log
  `logs/u5g4r3a-20261028T17-15-44Z/setup-failure.json` reads verbatim:
  `Cannot find package '@deepseek-ai/dsh-storage-domain' imported from …/tests/deepseek-harness-test-use/apps/cli/lib/__resolver__.js`.
- Cause (rooted to ground, not guessed): the lane's setup provisioned the RUNTIME tree (clone + install +
  build + sandbox assets, `SETUP-NOTES.md`) but **not the lane's team-root `node_modules`** — it was absent
  (`ls node_modules` → No such file). The mounted seam
  (`packages/runtime/root-binding/harness/seam.mjs:33`, placed by `scripts/dist-placements/020-runtime-entry-deps.json`)
  bare-imports `@deepseek-ai/dsh-storage-domain`, which the team root declares at the baseline pin
  (`package.json:59`: `0.2.0-rc.2`, resolved by the lockfile). From an empty team root the production
  resolver hook ([upstream-resolver.mjs](../../../../../packages/runtime/src/plugin/upstream-resolver.mjs)) tries the install's
  own `node_modules` first, gets `ERR_MODULE_NOT_FOUND`, and the checkout fallback re-parents into the
  runtime tree's `apps/cli` — where the package is likewise absent (the runtime tree's links answer only
  its own dependency graph). Bootstrap dies; the product is never reached.
- Why this is ENV/harness, not product: the identical seam booted green under the phase-2 lane whose
  team root WAS installed (`.worktrees/u7-g4r2/node_modules/@deepseek-ai/dsh-storage-domain ->
  ../.pnpm/@deepseek-ai+dsh-storage-domain@0.2.0-rc.2…`, live on disk), and the verticals of earlier
  rounds ran on this same seam. The gap is one omitted setup step in THIS lane (`--frozen-lockfile` was
  never run at the team root), matching the envelope's class "ENV or a harness defect fixed in between".
- Fix, applied between attempts without touching the frozen candidate: `pnpm install --frozen-lockfile
  --store-dir .tmp-pnpm-store` at the lane team root (exit 0, "Done in 5s"); `node_modules/@deepseek-ai/
  dsh-storage-domain` now present; `git status --porcelain --untracked-files=no` still shows only the
  append-only boot declaration `arc-a/host-starts.jsonl`; `git rev-parse HEAD` unchanged at the frozen
  candidate `5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3`. `pnpm-lock.yaml` not modified (`--frozen-lockfile`).
- Budget accounting: the failed boot was declared BEFORE the spawn in the lane's own ledger
  (`arc-a/host-starts.jsonl`, 1 line, phase `u6arca-boot1`) — the accounting survived the failure, and no
  hidden start occurred. Phase 2 consumed 3 of R1's 6; leg 1 is start 4. B-G4R-3's ceiling-reading note
  makes explicit that the planned six consume the whole 9-start authorization, so this retry — even
  though it is exactly the ENV class the +1 reserve names — cannot draw on the reserve and needs this
  new ruling. Disclosure: after this ruling G4-R may reach 10 starts total; if the retry fails with the
  SAME class, stop and report — no further boot without a new ruling.

## Preconditions for the retry (all re-checked immediately before the spawn)

- `git rev-parse HEAD` == `5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3` (frozen candidate) in the booting
  worktree; tracked tree otherwise clean apart from the append-only lane ledgers;
- runtime clone porcelain empty; sandbox pre-flight probe still `partial`/`full` in the booting tree;
- `:3080` probed read-only (401) before and after;
- the retry appends to the SAME `arc-a/host-starts.jsonl` (runner-enforced `--max-host-starts 2` after
  1 used = the declared +1, no room for a silent second retry).

## Explicitly not ruled here

- Any change to the leg-1 FAIL record: it stands as written (history is never rewritten).
- Any other leg's budget, any judge/assembly/runner change (the seam and resolver are NOT touched —
  the fix was `pnpm install`, byte-for-byte zero source change), and any gate verdict: promotion remains
  the R2 reviewers' call.
