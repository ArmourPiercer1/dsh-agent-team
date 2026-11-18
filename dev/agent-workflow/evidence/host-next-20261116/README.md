# host-next-20261116 — the second pinned DSH host (0.2.2-rc.5)

**Dated:** 2026-11-16 (session calendar; real UTC captured per file header).
**Branch / worktree:** `task/host-next-20261116` · `.worktrees/host-next-20261116`.
**CORE PATCH BUDGET = 0:** the upstream host source is never patched; only published package
entry points are imported and the only host-tree write is the digest-verified native-asset
install performed by the shared provisioner.

## What was verified (each number is in the file next to it)

| file | content |
| --- | --- |
| `pin-verification.txt` | upstream `dsh-v0.2.2-rc.5` = `9c2670d3bce5275e0d1610272958121af87787bb` (lightweight tag), rc.3 = `38a6a5c…`, the fork carries none of the 0.2.2 tags, the clone's HEAD/describe/version |
| `addon-tarball.txt` | `@deepseek-ai/node-addon-system-linux-x64@0.1.2` is the only published version; tarball sha256 `77fb771b…`; per-file sha256 == the committed pin; rc.5 native manifests + C sources are byte-identical to the 0.2.0-rc.2 tree; **drift**: a plain build produced `75450f92…` (17352 B) ≠ pin `54a9c25c…` (17360 B) |
| `materialize-build.txt` | clone / pinned-pnpm install / build commands and observed attribution (HEAD, tag, version, 371 client artifacts, 10/10 gates, 130.16 s) |
| `provisioning-receipt.txt` | `HOST-ASSETS-PROVISIONED … version=0.1.2 tarballSha256=77fb771b… host=9c2670d3…`, pre/post digests + modes, and the `u7-sbx-host-asset-receipt/1` receipt |
| `boot.txt` + `boot-log-excerpt.txt` | real boot of `apps/cli/lib/bin.js web` on port 3190 with the scripted mock model: boot marker, boot wall time, session served, mock request count, durable session log |
| `native-api-smoke.txt` | the six native-API assertions with their verbatim `NEXT-SMOKE …` proof lines |
| `legacy-invariance.txt` | legacy pin block untouched, legacy tree still at `639ed01539` (porcelain 0), `tinf-instruments` 48 suites / 733 pass / 0 fail, pre-existing environment red isolated |

## Reproduce

```bash
git worktree add .worktrees/host-next-20261116 -b task/host-next-20261116 origin/master
cd .worktrees/host-next-20261116
git clone --branch dsh-v0.2.2-rc.5 --depth 1 \
  https://github.com/deepseek-ai/deepseek-harness.git tests/deepseek-harness-next
npm install --prefix .next-tools pnpm@11.28.5
(cd tests/deepseek-harness-next && node ../../.next-tools/node_modules/pnpm/bin/pnpm.cjs install \
   --ignore-scripts --frozen-lockfile --store-dir ../../../.next-pnpm-store && \
 DSH_CLIENT_COMMIT_HASH=9c2670d3bc ESBUILD_WORKER_THREADS=1 \
   node ../../.next-tools/node_modules/pnpm/bin/pnpm.cjs run build)
node scripts/provision-host-assets.mjs --from-package --host next
node --test tests/next-host/
```

`tests/deepseek-harness-next/` and `tests/homes/` are gitignored; the commands above rebuild
them from the pin. Nothing in this evidence directory is a `.json` artifact requirement — the
provisioning receipt is quoted verbatim inside `provisioning-receipt.txt`.

## UNKNOWN

- The real subprocess PTC runtime (`@deepseek-ai/dsh-ptc-runtime-node`) is not wired into the
  smoke; the nested dispatch is driven through the host's public `PtcRuntime` provider seam.
- The next host was not run through the legacy census legs.
- Published bytes are pinned, not proven reproducible from source.
