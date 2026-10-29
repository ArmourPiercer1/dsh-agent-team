# u7r3-as-idem — cross-scope applyId consumption atomicity (audit P0-2a) — CONFIRMED + FIXED

**Claim (external audit intake #3 P0-2a):** `applyId` is documented cross-scope-GLOBAL
idempotence (`state-store.mjs` DURABLE IDEMPOTENCE law d; the recording fake — the
specification — keys consumption on ONE store-wide `applied` set), but the durable
store's persistence locking is PER-SCOPE and the global marker was written only AFTER
the commit with the EEXIST swallowed. Two applies carrying the SAME `applyId` at
DIFFERENT scopes serialize under nothing in common: both passed the
`appliedIds`/`markerPresent` check under their own scope locks and BOTH committed.

**Reproduction (offline, deterministic, no boot):** `u7-agentstate-fs-store-c1.test.ts`
describe `u7as I` / leg `I1` — the C1-test-only `faultAt('after-read')` seam (the file
already offers it; fires inside the critical section, past the replay witness check)
parked BOTH applies on a two-arrival barrier, so both entered the commit window with
zero global witness. Pre-fix: both legs answered `ok` (RED on "at most ONE durable
commit"). 3/3 stable runs. Receipts:

- `RED-unfixed-i1.txt` — I1 against HEAD (unfixed) src: `expected … length of 1 but got 2`.
- `GREEN-full-family.txt` — 5 files 138/138 after the fix (fs-store c1 51, fs-store audit,
  f-agentb c1 54, a5p0 layer audit, p4t6 scan law).
- Stability: `-t I1` RED 3/3 pre-fix, GREEN 3/3 post-fix.

**Fix shape (atomic consumption, NOT a post-commit re-check):** the `applied/` marker
becomes the CONSUMPTION PRIMITIVE and moves BEFORE the commit: an `O_EXCL` create is
the check AND the consume, one atomic filesystem op, outside the reach of any single
scope lock — the loser of the create answers `STATE_APPLY_REPLAY` with zero
persistence whichever scope carries the apply. A CLEAN failure before the commit
(refused precondition / typed write failure the process survives) REFUNDS the marker
unlink, so the R law (a refused apply never burns its applyId) and M1 (failed apply
stays re-drivable) hold verbatim. The accepted hard-crash window flips conservative:
dying inside [consume, commit) leaves the grant CONSUMED with no state change (re-drive
answers `STATE_APPLY_REPLAY`) — losing that write is preferred over ever re-applying a
possibly-consumed grant, which is the law the audit found violated. The committed
record STILL carries the id (per-scope witness) and `faultAt('after-commit')` now
fires post-commit-post-consumption; M2 re-pinned to the new order (BOTH witnesses
present, replay refused). No lock-order change (no new lock; the scope/realm lock
discipline is untouched).

**Guards kept:** all lock laws (L/F/M/N/R3 legs untouched and green), containment,
bounds, hardlink law, ledgers. `I1` also asserts the DISK facts (one `writes.jsonl`
line for the id, one record carrying it, one marker).

**Dist mirror:** byte-copied via `node scripts/place-dist-glue.mjs` (110-agent-state
lane entries); `pnpm check:artifacts:head` drift=0 after the commit (see log note).

**Known-local-reds disclosure:** `tsc -p packages/runtime/tsconfig.json` in this
worktree reports 79 errors IDENTICALLY before and after the change (measured by
scoped stash) — all are missing `@deepseek-ai/*` type declarations from the
worktree's absent `pnpm install`, zero in agent-state-family files; environment, not
behavioral.

**Artifact-law status at this commit (disclosed, environment-blocked leg):**
`node scripts/check-artifacts-at-head.mjs` answers `verdict=not-run reason=install`
in THIS environment — pnpm's global store `/home/user/.local/share/pnpm/store/v11`
is on a READ-ONLY file system (probe: `touch` → EROFS; not a sandbox-policy
question, the mount itself is read-only), so the instrument's scratch
`pnpm install` cannot run and cannot be fixed from this session. The lane's
contribution to the law is verified directly instead: at HEAD,
`git show HEAD:packages/runtime/dist/…/fs-state-store.mjs` and `state-store.mjs`
are `cmp`-byte-identical to their src rows (the placement law for exactly the two
files this commit moves), and the commit touches ZERO TypeScript, so the tsc-emitted
dist surface is byte-unchanged. `node scripts/composition-smoke.mjs`: the runtime
host-plugin leg (which loads the mirrors) PASSes; only the
`packages/client` built-entry leg fails ("run `pnpm build` first") — the same
read-only-store block, identical before and after this commit.
