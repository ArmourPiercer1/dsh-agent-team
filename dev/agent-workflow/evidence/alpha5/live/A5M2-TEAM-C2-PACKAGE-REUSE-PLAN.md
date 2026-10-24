# A5M2-B-TEAM C2 — next minimal family reuse against the new standard pack candidate (PREPARATION ONLY)

Scope law for this file: **no install, no boot, no Host, no pack, no repo-lock write**. Every number below
was read read-only in this round (2026-10-24); commands are named so the window owner can re-run them.
Nothing here is executed. Tier of the family stays **接线未测** until a Host round traces the legs.

---

## 1) BASE IDENTITY (measured read-only)

**Driver side (this lane)**
- Driver: `dev/agent-workflow/evidence/alpha5/live/a5m2-team-c2-runner.mjs`; acceptance row:
  `…/a5m2-team-c2-kit.mjs`.
- The driver **owns no install surface of its own**: `a5m2-team-c2-kit.mjs:32-39` declares
  `REUSE_INSTALL = { mode: 'reuse-install', lock: '<center-matrix value>', installsNewRuntime: false,
  createsNewWorld: false }`, and the runner mounts the shared trees it never writes —
  `a5m2-team-c2-runner.mjs:52` `SHARED_HOST_TREE = <repo>/tests/deepseek-harness-test-use`,
  `:63` `SHARED_PRODUCT_TREE = <repo>/.worktrees/a5-m2-int`, `:733` `dshHome = join(REPO, world)`.
- Consequence: the reuse target is the **standard fixture** below; my world adds only
  `profiles/ blueprints/ sessions/ storages/` (§4).

**Standard fixture = the reuse-install surface**
- Absolute path: `tests/homes/a5m2-sched-c2-dry-2026-10-23T22-56-05-203ZZ/install-eda06b4a7`
- Measured size: **449,616,145 B** (`du -sb`), 27,033 files.
- Fixture manifest: `package.json` **900 B**, `sha256 07b444775f88a0c52f7f4ac97b77ffa3b308f1136be347ad3bf101de151c26ea`,
  `"name": "a5m2-bf4-install-fixture"`, **16 dependencies**.
- Fixture lock: `pnpm-lock.yaml` **611,385 B**, `sha256`
  **`7faee42f88306edb43888cbd3d822a45596d6a05d0641e32457cbcd553568cfe`** — measured here, this is the
  same value the center matrix cites as the Schedule lock, and the same value the run's
  `reuse-receipt.json` records as `/lockSha256`
  (`dev/agent-workflow/evidence/a5m2-schedule-c2/run-dry-2026-10-23T23-31-16-886Z/reuse-receipt.json`).
  So the kit's reference slot can now be read as **measured in place**, not copied.
- **Pin identity (verified, not assumed)**: the directory name `install-eda06b4a7` is the first 9 hex of the
  product tgz `sha256` of the pack it was built from. Measured on the surviving bytes:
  `.worktrees/pack-int/out-874f3ae0d-20261023T213601Z/dsh-agent-team-0.1.1-alpha.2.tgz`
  = **3,857,455 B**, `sha256 eda06b4a78bba180c0acef1b25237f3f741917385cd0728ee66adc737b1cd09d`, **1,821 entries**
  (`sha256sum` / `tar -tzf | wc -l`), source `874f3ae0d…` (a commit, ancestor of the integration line).
  The same id pair is recorded in that pack's `MANIFEST-874f3ae0d.txt` (`BYTES/SHA256/ENTRIES`).
- **Peer face (the 16)**: `dsh-agent-team` (ours) + `yaml` + `zod` + 13 `@deepseek-ai/*`
  (`cordis, dsh, dsh-agent, dsh-llm, dsh-mcp-client, dsh-schedule, dsh-scope, dsh-session, dsh-spill,
  dsh-spill-local, dsh-storage-domain, dsh-system-prompt, dsh-tool-fs-search`).
  The **15 peers to be left alone** = that set minus `dsh-agent-team`.

---

## 2) NEW CANDIDATE (verified read-only this round)

- Frozen full SHA **`699cc4fb7a27941b19c1550c42d45d45520535da`** — `git cat-file -t` = commit.
  Honest note: it is **not** the current integration tip; local branch `feat/a5-m2-integration` and
  `git ls-remote origin` both read **`b165f8db01d45dbd908ddf2a0ef75bb606e45f2c`** at this moment. The
  candidate stays frozen as given; no successor substitution, no self-taken tip.
- tgz `…/.worktrees/pack-int/out-699cc4fb7a27941b19c1550c42d45d45520535da-20261024T043040Z/dsh-agent-team-0.1.1-alpha.2.tgz`
  measured: **4,107,270 B**, `sha256`
  **`c8dd3f07b940efec03ec69173a3f98a9ded6106ccf725e0bda88efa74c754b0e`**, `tar -tzf` RC=0 →
  **1,837 entries, 0 directory records** (i.e. pnpm-pack layout, unlike this lane's own `git archive`
  candidate which carries 102 directory records and is candidate evidence only).
- **Member delta vs the base face (1,821)**: `only_in_new = 16`, `only_in_base = 0` — nothing disappears;
  all 16 are dist mirrors under `…/plugin/live/governed-families/`:
  `g1-query-assembly`, `g1-query-wiring`, `g1-trusted-topology-supply`,
  `g2-connector-adapters`, `g2-provider-seams`, `g2-team-assembly`, `g2-team-mount`, `g2-web-supply`,
  `g3-ptc-wiring`, `g3-terminal-wiring`, `g5-goal-service`, `g5-goal-wiring`, `subagent-adapters`,
  `subagent-spawn-adapters`, `subagent-spawn-wiring`, `subagent-wiring` (`.mjs`).
  So the "+16" is broader than ptc-wiring alone: g1/g2/g3/g5 + subagent mirrors, **dist-only**, no
  member removals ⇒ a strict superset at file-list level.
- Family-relevant read for the window: the base face carries `A5_B_TEAM_ADAPTER_REVISION = 1`; the
  candidate must answer **2** plus the plane's `callerGate` / bridge's settled-value channel. Verifying
  that inside the candidate is an extract-and-`git hash-object`/grep step at window time (this lane proved
  the method: member hash == `git rev-parse <sha>:<path>`).

---

## 3) MINIMAL REPLACE REQUIREMENT (one package, existing fixture)

1. Point **only our** dependency at the new bytes: in the fixture's own `package.json`
   (`install-<…>/package.json`, name `a5m2-bf4-install-fixture`) rewrite the `dsh-agent-team`
   `file:` specifier to the candidate tgz absolute path in §2. The 15 peers' specifiers stay untouched.
2. Run the installer's own **one-package update** flow inside that install directory (the flow the
   fixture already supports: it is a pnpm workspace installed from `file:` specs). This re-resolves the
   single `file:` entry; peers are already satisfied and stay in place.
3. **Re-pin the surface by the established naming convention**: the install directory name is
   `install-<first9 of the product tgz sha256>` ⇒ the new surface is
   **`install-c8dd3f07b`** (from `c8dd3f07b940efec03ec69173a3f98a9ded6106ccf725e0bda88efa74c754b0e`).
   Keep the old `install-eda06b4a7` as evidence; no deletion.
4. **Explicitly out of scope**: full reinstall, touching any of the 15 peers, and any **repo** lock write
   (the only lock allowed to change is the fixture's own `install-…/pnpm-lock.yaml`; its pre-value is
   recorded in §1 as `7faee42f…` so the post-value delta is auditable).
5. This whole section is **gated**: it is an install action, needs root's install order, and belongs to
   the owner that runs the standard flow.

---

## 4) FRESH-HOME INCREMENT BUDGET (measured precedent, honest split)

- World increment (per bounded round), from `a5m2-c2-r17-20261023T15-03-57Z`:
  `profiles` **3,483 B** + `blueprints` **3,185 B** + `sessions` **68,428 B** + `storages` **41,666 B**
  ≈ **117 KB/round**.
- Install copy is a **separate surface**, not the world increment: it lives inside the world's
  `install-<pin>/` and measures **449,616,145 B** (Schedule fixture) / **463,022,694 B** world total for r17 —
  dominated by the extracted package plus its `node_modules` (`mount-helper-root` 14,065,688 B).
- Disk headroom measured now: `df -B1 --output=avail /` = **8,947,163,136 B (~8.33 GiB)**.
  Rule for the window: keep **≥ 6 GiB** free after the copy; at ~450 MB per install surface that allows
  roughly 5 more reuse surfaces, and a fresh world alone costs ~0.12 MB.
- No pruning/deletion is proposed here (delete-forbidden without order).

---

## 5) PORT AND CLEANUP (no boot executed)

- Ports: **3180 family only** (`docs/TEST_METHODS.md:14`: `3180-3186 / 3491-3500`; the stable
  development instance on **3080** and its `DSH_HOME` are forbidden to test instances).
- Lock discipline: lock sits beside the home as **`<home>.lock`** (`docs/TEST_METHODS.md:89`); content
  shape measured on surviving locks: `{ world, pid, kit, runStamp, at }`. Existing worlds' locks stay as
  they are; a new round writes its own lock next to its own world.
- Cleanup protocol: `docs/TEST_METHODS.md` §7 naming/cleanup protocol governs retention; the retained
  standard surfaces (`install-eda06b4a7`, the G6 fixture, `out-*` packs) are ACTIVE evidence — untouched.
- **Future steps, all gated on root's orders (none run by this file):** ① root install order → §3 steps;
  ② root boot order → boot on a 3180-family port with a fresh world; ③ trace the C legs
  (`C-READINESS-BARRIER / C-CREATE-ONCE / C-ROOT-LIVE / C-READ-STATE / C-TEAM-QUERY / C-LEDGER-PAGE /
  C-LEADER-MEMBERS`), each asserting on real answers; ④ `C-DUR-1` still needs a durable approval composed
  under the previous revision (named gap, not simulatable).

---

## 6) NON-BLOCKERS (do not wait)

- **`run_code` wiring** is not a precondition for this family: B-TEAM's closed set is tools 74-82 + 86 and
  its legs run through `team_*` + PA/plan seams only.
- The **four user rulings** are not awaited here; none is on the C2 critical path as scoped.
- This lane's three named gaps proceed on the source face as scoped:
  `GAP-BLUEPRINT-IDENTITY` (reuse face closed by a real in-tree v3 artifact `…/natexe/runs/live-2026-10-18T03-32-07/blueprints-v3/a5nx-main.yaml`,
  live-mint face open), `GAP-INITIAL-WORK-TOKEN` (needs a token minted by a prior landed initial-work
  flow), `GAP-DURABLE-REPLAY` (needs a preimage row from an unclipped durable export).
- This lane's own `git archive` candidate (`…out-7fe56009dc…-20261024T034202Z/`, 102 directory records,
  CI RED-AT-HEAD) is **candidate evidence only** and is **not** used for any new-SHA acceptance; the
  standard `pnpm pack` flow belongs to its usual owner.
