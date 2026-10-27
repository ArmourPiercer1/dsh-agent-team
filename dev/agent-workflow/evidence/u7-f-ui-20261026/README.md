# u7-f evidence — governed `ask_user_question` + `present` (dsh.ui-family)

Branch `task/u7-f-ui-20261026`, ONE commit set, ZERO core/center diff.

| artifact | what it proves |
| --- | --- |
| `c1` (live vitest run, quoted in the PR) | `packages/runtime/test/u7-f-ui-c1.test.ts` — 36 legs GREEN: positives land their effects on the injected fake port; EVERY refusal arm (port absent, unknown field ×3 depths, malformed question/option legs, default-deny ×2 layers, timed expiry, invalid timeouts ×5, duplicate ids, out-of-root, symlink escape, host sentences, present-face absent, replay ×2, in-flight token, dishonest/malformed/throwing port, canary byte-leak) proves typed refusal with ZERO port calls / zero consumption. |
| `mutation-1-drop-anchor-check-RED.log` | planted bug (drop the pure-lexical anchor refusal in `present-executor.mjs`) → P-2 RED `1 failed | 35 passed`; reverted byte-identically, suite re-greened. |
| `mutation-2-pending-merge-RED.log` | planted bug (pending branch stops dropping a dishonest port's answers) → T-5 RED `1 failed | 35 passed`; reverted, re-greened. |
| `p4t6-RED-unbooked.log` | MEASURED unbooked scanner: `scanner counts 1332, ledger derives 983 + 339 = 1322` → booking `packages/testkit/test/p4t6-bookings/u7fui.json` carries exactly that delta (+10 files), then 20/20 green. |
| `c2/` | live-Host suite `u7-f-ui`: 3 boot starts (budget `--max-host-starts 3`), final **f3 overall=PASS 7/7** (the 7th case is the runner's own `host-base-pristine-post` guard). Verbatim witnesses + boot-by-boot honesty in `c2/C2-VERDICTS.md`. |
| `world-factory-offline.log` | `node --test tests/world-factory/world-factory.test.mjs` exit 0 with the new suite/kind registered. |
| `ci-pr-gate-full.log` | `node scripts/ci-pr-gate.mjs --store-dir <repo>/.tmp-pnpm-store --full --census` on the provisioned worktree (pristine host checkout cloned @ `639ed01539`, porcelain-empty). |
| `host-tools.json.copy` | the pinned host tool-catalog snapshot the row mirrors (sha `35e2a63c…`), kept out of the untracked test-use tree. |
| quick gates (transcripts in PR body) | `pnpm typecheck` clean; `lint-identities` new 0 / resolved 0 vs baseline `lint-identities-0237d487.txt`; `docs:sync --check` exit 0; `docs:probe --worktree-only` **blocking=0** (advisories 2, contracts 20); `eb3-ci-required` pass findings=0; `check-artifacts-at-head` verdict=ok drift=0 (standalone) + the gate leg with a writable store. |
