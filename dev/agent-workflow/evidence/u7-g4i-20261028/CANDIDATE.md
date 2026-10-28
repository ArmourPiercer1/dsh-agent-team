# G4-I candidate binding — facts only, no gate verdict

## Frozen candidate

- Team merged-point SHA: `e6589ef5fbbc0dd599e629d5cf82b8f5579aecdd` (origin/master at lane setup; merge PR #418). It is not the later packet commit. No product change is made in this lane.
- `pwd`: `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/u7-g4i`; branch `task/u7-g4i-candidate-bind-20261028`.
- `git status --porcelain --untracked-files=no` was empty after install/build and before each unchanged C2 launch. Packet files were untracked and do not alter committed executable inputs. A separate binding JSON records the final digest inventory.
- Host: `639ed015397290b3745d163aafe02ffee4aa3f84` (`639ed01539`), independent local no-hardlinks clone from root test-use; detached, pristine tracked porcelain empty after full build. No upstream patch, no packages product edit, no stable-instance mutation.
- Node `v24.21.0`; pnpm `11.7.0`. Team install: frozen lockfile with `.tmp-pnpm-store`. Host default-store install failed SQLite open; local-store retry and `DSH_CLIENT_COMMIT_HASH=639ed01539 ESBUILD_WORKER_THREADS=1 pnpm run build` succeeded.

## Byte pins

| Input | SHA-256 |
|---|---|
| package.json | `a8aa65fa07775a0dbef479829de42624989627b2833ac9e06070bbfe3ebae5ed` |
| pnpm-lock.yaml | `432cfe5f1729b5cd32b656d8732cfd0850e9e1b3a2502be4b263c4ca87dba2ab` |
| current-authority.json pointer bytes | `42465659edeb03d85f42975969c77b2790827ee91228c7e48ef13ee438ffb0ae` |

Authority was resolved by `node scripts/current-authority.mjs`: snapshot `as20261026r1`, content_digest `sha256:93692d7aeb3b097c3b3467e0a9207f1da5f05c2c1cb324c74d25168b1516a4d4`. The immutable snapshot and pointer, package/dist input file hashes, runner-reported composed profile/config and source/oracle digests are inventoried in the sibling binding JSON. The unchanged ARC-A runner does **not** persist composed profile/config digest or trusted-source/world-oracle digest, and the World has been removed; these requested fields remain **MISSING / PARTIAL**, explicitly null in candidate-binding.json. Offline source/oracle file hashes do not retroactively substitute for runner-recorded fields. Profile digests are World-specific, not a claim that volatile absolute paths/provider URLs are identical across historical runs. Runtime dist manifest SHA-256: `a213af949d3ab973d407dac178cfcec1c6ebc5a80e2b12f4aca803d5a3f4c636`.

## Starts, discarded attempts, limits

Four starts total, enforced by the shared boot ledger. Starts 1 and 2 used an evidence-only ESM overlay suppressing stable status probes because the initial brief was interpreted literally as forbidding all :3080 access. Parent clarified the established read-only probe is allowed and required. The overlay was removed; its runs were discarded and are **not candidate acceptance evidence**. Both starts still count. Start 1 ARC-A was killed; start 2 Jobs completed but is discarded, not a receipt.

Start 3 uses the unchanged ARC-A runner: finalized **overall PASS 10/10**, `teamTreeClean:true`, exact frozen candidate and Host pins, real stable read-only pre/post check PASS. Start 4 uses unchanged Jobs; a later parent allocation asked to use AC-1 instead, but the fourth start had already been declared. It was terminated immediately; its owner unwound cleanup. No fifth start was attempted. This sequencing mistake leaves AC-1 and tbash affected-unrebound. No overall-PASS assertion can be inferred from discarded or interrupted runs.

The frozen candidate intentionally excludes pending PR #421. Its crash-survivor record is not current-candidate proof. Moving the candidate after these runs would need a new dependency assessment.

## Environment observation

The isolated lane sandbox cannot create user namespaces: sibling native-sandbox-probe.log records bwrap exit 1, “No permissions to create new namespace … kernel does not allow non-privileged user namespaces.” The discarded Jobs observation reported native boot-root bash: `sandbox mode "workspace-write" is requested but no sandbox backend is usable on this host`. This is ENV_BLOCK for native control, not a Team defect and not PASS. Historical #400 native control really returned `U74A_CTL_CLAIM_…` plus `landlock-run: partial enforcement (older Landlock ABI)`; this environment differs. No sandbox relaxation, native tool substitution, or product patch was used.
