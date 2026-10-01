# pr-b-effective-policy-smoke — BLOCKED (2026-10-01, post-#50-merge closure battery)

**Verdict: BLOCKED — concrete technical blocker (kit environment coupling + missing seed data), NOT time cost.**

- The kit hardcodes `SEED_BLUEPRINT_DIR = '/home/user/dsh-plugins/dsh-agent-team/tests/homes/mpr-2026-09-27T08-35-52/blueprints'` (line 93) — a machine-absolute path on the original machine (this environment's workspace root is /srv/workspace, not /home/user).
- The seed world `tests/homes/mpr-2026-09-27T08-35-52` (an ephemeral home, gitignored per TEST_METHODS §7) was NEVER committed: its blueprint YAMLs exist nowhere in the repo (searched: no blueprint files in the model-pref-kit-mpr-2026-09-27T08-35-52 evidence dir — only run captures; no matching committed blueprints dir anywhere under dev/agent-workflow/evidence/).
- Reconstructing the seed world from captures would be fabricating test input — not done.
- Fixing the kit's path would modify a tracked test file (the closure branch is docs/evidence-only per the user directive) — not done silently.
**Coverage fallback (recorded, not a claim of re-run):** #47's tree-era real-host run (committed under dev/agent-workflow/evidence/fix-effective-policy-reset-fallback/) + the merged-tree suite effective-policy tests (green in the 4865P full run at the product-identical tree) + verified non-interaction: the post-#47 product deltas are #48 (packages/runtime/src/plugin/root.ts, types.ts) and #50 (packages/runtime/src/plugin/host.ts, live/agent-bindings.mjs, root.ts) — ZERO policy/effective files touched (git diff name-only filtered, 2026-10-01).
