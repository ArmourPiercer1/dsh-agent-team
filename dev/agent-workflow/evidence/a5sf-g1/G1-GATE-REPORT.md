# Alpha.5 Sandbox-First — Gate G1 report (P1 complete, strict verdicts)

- **Date**: 2026-11-02 · **Branch**: `task/a5sf-p1-01-20261102` (based on PR #531 head `8bff512d1`)
- **Machine authority**: **unchanged** — `dev/engineering/current-authority.json` still points at
  `as20261026r1` (old unified-baseline plan). No pointer/snapshot/`AGENTS.md`/`docs/plans/active`
  edit is in this branch. Production authority activation requires the separate Authority
  Migration PR (see §5).
- **CORE PATCH BUDGET = 0**: the branch adds only downstream lanes + their tests. `git diff
  master...HEAD --stat` shows 5 modified files (`domain/blueprint/src/{blueprint-v4,index}.ts`,
  `domain/vnext-field-mapping/src/{index,v4-authoring-map}.ts`, `runtime/tsconfig.json`) and the
  rest new files. No upstream Host source, no `cordis.patch.yml`, no `tests/` change.
- **Host**: `tests/deepseek-harness-test-use` @ `639ed01539` + pristine, untouched; stable `:3080`
  never contacted. Tests run in the worktree with the shared `node_modules`.

## 1. Per-gate verdicts (strict)

| Gate | Verdict | Basis | Named condition / gap |
|---|---|---|---|
| **G1.1** v4 Member ceiling grammar (P1-01) | **PASS** | 21/21 `a5sf-v4-member-ceiling-projection` | none |
| **G1.2** two-axis compiler (P1-02) | **PASS** | 16/16 `a5sf-member-policy`, RED→GREEN log kept | none |
| **G1.3** authorized paths / symlink / hardlink / write-needs-read / Provider capability gate (P1-03) | **PASS** | 27/27 `a5sf-path-rules` incl. real-fs symlink+hardlink and 12-method surface refusal | path identity consumes the injected resolver (trusted-realm boundary disclosed) |
| **G1.4** invocation binder + trust registry (P1-04) | **PASS** | 30/30 `a5sf-invocation` + `a5sf-trust-registry`; projection now refuses CONSUMED capabilities and unverified/expired leases; 68/68 with Alpha.4 regressions | the trust registry's digests come from the loader: it detects drift for an HONEST registrar and does not itself observe HMR (the HMR test simulates the replacement) — disclosed, not claimed as detection |
| **G1.5** per-Member Service realm (P1-05) | **CONDITIONAL** | 13/13 `a5sf-service-install` on real Cordis: isolated `ctx.isolate('fs')` scopes, real `tools.register`, per-member ceilings, stale-generation refusal, POST-MOUNT ROLLBACK (a later mount failure disposes the earlier Member and the install can be retried), and a `installToolBindingRealm` leg where the tool binding's narrower lane refuses a path the Member ceiling allows | upstream `dsh-tool-fs` binary and per-agent same-name variants need the real Host composition (not in `packages/runtime`'s dependency closure; `pnpm install` unavailable here: `ERR_SQLITE_ERROR`). Deferred to P2/E2E. Provider guard→syscall TOCTOU is disclosed residual (openat2/O_NOFOLLOW is the P2 hardening). |
| **G1.6** provider replacement + delivery (P1-06) | **CONDITIONAL** | 9/9 `a5sf-provider-composition`: real `applyEntryPatches`, exactly-one-active-provider, typed refusals, shipped bundle dormancy against the real `cordis.patch.yml` | real `pnpm smoke:composition` / `dsh --dump-config` boot and package `exports` wiring are the Native Integrator + pnpm-capable-environment leg. Rows are declared `shipped: false`. |
| **G1.7** OS runner / subprocess public face (P1-07) | **PASS (scoped)** | 13/13; **real confined child on this host**: allowed read OK, denied read `Permission denied`, write-only subtree writes and refuses read-back; probe rows `content-read: enforced`, `write: enforced`; native `SubprocessHandle` shape over the streaming arm; `spawn` never falls back to a bare process | A deny NESTED inside an allow is refused (`PATH_NESTED_DENY_UNEXPRESSIBLE`) instead of dropped — review B1 found that the earlier profile silently granted the denied subtree; `network-destination`/`directory-metadata`/`alias` are **UNSUPPORTED** and refused; network deny → `ENFORCEMENT_UNAVAILABLE`; `chmod` is outside Landlock (disclosed); a write-only locator nested under a readable parent keeps the parent's read bit and is REPORTED as readable, never claimed write-only. |
| **G1.8** PTY / persistent lifecycle (P1-08) | **CONDITIONAL** | 6/6 `a5sf-terminal-lifecycle`: trusted-owner identity, creation-time revision, reuse-without-restart, kill+rebuild on tightening, revocation, shutdown receipt with pid/descendants | PTY port is a double; real terminal backend wiring + native `spawnTerminal` run is the P2 leg. |

**P1 total gate (G1)**: **CONDITIONAL PASS** — the policy compiler, path algebra, invocation
binding, service isolation law and OS FS read/write enforcement are proven with positive and
negative evidence; three legs (G1.5/G1.6/G1.8) still need the real-Host wiring that the plan
assigns to the Native Integrator / P2 integration. No leg is claimed PASS on registration success
alone.

## 2. Test inventory (140 tests, all green in this worktree)

| Suite | Tests |
|---|---|
| `a5sf-v4-member-ceiling-projection` | 21 |
| `a5sf-member-policy` | 16 |
| `a5sf-path-rules` | 32 |
| `a5sf-invocation` / `a5sf-trust-registry` | 20 / 10 |
| `a5sf-service-install` | 13 |
| `a5sf-provider-composition` | 9 |
| `a5sf-os-runner` / `a5sf-subprocess-contract` | 9 / 2 |
| `a5sf-terminal-lifecycle` | 7 |

Evidence directories: `dev/agent-workflow/evidence/a5sf-p1-0{1..8}/` (RED and GREEN logs,
design/coverage notes). `tsc -p packages/runtime/tsconfig.json --noEmit` and
`tsc -p packages/domain/tsconfig.json --noEmit` both clean.

## 3. Invariants held (machine-checked, not asserted in prose)

- `EffectiveIo(member, tool, call) ⊆ MemberCeiling(member) ∩ ToolRestriction(member, tool)`:
  intersection is never a union; absence of a ceiling is a typed refusal
  (`MEMBER_CEILING_UNDECLARED`), never a synthesized allow-all; a one-shot approval produces the
  identical effective policy (no widening).
- `network: restricted` is refused as UNSUPPORTED this round; boolean `deny` is enforced or the
  spawn is refused.
- Hardlink aliasing is allowed only through an authorized path (path-based, not inode-based);
  symlink escape is denied by resolved identity.
- No second grant ledger: the invocation binder holds per-call state only and consumes Alpha.4
  `approvedOnce` as input; a CONSUMED capability cannot be projected into another compile, and a
  leased capability needs the caller clock.
- The RIGHT factor is enforced at a real boundary: `installToolBindingRealm` mounts a confined
  Provider for one (Member × tool binding) pair using the compiled `EffectiveIo`, so a tool lane
  narrower than the Member ceiling is refused by `ctx.fs` (review H1).
- A policy compiled for generation N cannot be installed for generation N+1 (`MEMBER_POLICY_STALE`).
- OS deny expressibility: nested deny refused; equal deny drops the rule; `mode: all` refused.
- Path identity: a write through a DANGLING symlink is `PATH_SYMLINK_ESCAPE` (review H2).

## 4. Environment finding that must not be lost

The plan's PoC recorded WSL2 Landlock `add_rule=EBADF` as `ENV_BLOCK`. **This host is WSL2
(`6.18.33.2-microsoft-standard-WSL2`) and Landlock enforcement works** (`content-read`/`write`
ENFORCE-confirmed; a real child was refused a denied read). The blocker is kernel-epoch specific,
not a property of WSL2; the P1-07 evidence records the exact rows. No deployment claim follows for
other kernels.

## 5. What G1 does NOT authorize

- No production activation: the machine pointer is unchanged; the plan is still a Draft design.
- No shipping of the provider rows (P1-06 rows are `shipped: false`) and no change to normal DSH
  composition.
- No claim about malicious in-process same-realm JS (inherent; disclosed in each module doc).
- The Authority Migration PR (separate, user-approved) is the only route to machine authority.

## 5b. Independent review and the defects it found (all fixed in this branch)

Two adversarial reviewers ran the suite independently and reproduced the probe rows. Findings and
disposition:

| Finding | Severity | Disposition |
|---|---|---|
| Nested deny dropped from the OS profile (the denied subtree became readable in the child) | BLOCKER | Fixed: `PATH_NESTED_DENY_UNEXPRESSIBLE` refusal + tests (both axes); test renamed because it previously asserted the parent rule |
| `EffectiveIo` had no runtime consumer (the invariant was compiler-only) | HIGH | Fixed: `installToolBindingRealm` + test where the binding is narrower than the ceiling and refuses |
| Dangling-symlink write approved the link name | HIGH | Fixed: `PATH_SYMLINK_ESCAPE` + real-fs test |
| Stale-generation policy installed / receipt claimed the spec generation | HIGH | Fixed: `MemberPolicy.instanceGeneration` + `MEMBER_POLICY_STALE` + test |
| Member `all` ∩ tool `restricted` collapsed to deny-all | HIGH | Fixed: `all` is the intersection identity + 4 mixed-mode tests |
| `lstat` non-ENOENT swallowed as "absent" (skipped write⇒read) | MEDIUM | Fixed: only ENOENT means absent; other errors are `IO_POLICY_UNSUPPORTED` |
| Caller `sandboxPolicy` forwarded into the base provider (could erase the host fence) | MEDIUM | Fixed: the argument is not forwarded |
| Consumed/expired capability re-projectable | MEDIUM | Fixed: `CAPABILITY_CONSUMED`, lease requires/checks `now` |
| PTY revocation race (a shell created during `revoke` survived) | MEDIUM | Fixed: revocation marked before the first await; generation-keyed |
| `toSubprocessHandle` consumed streams by default | MEDIUM | Fixed: `capture` is opt-in; a stream-read test proves non-interference |
| Two competing "closed" provider vocabularies; tested gate unused | HIGH | Fixed: one `MANAGED_FS_METHODS` (13 methods incl. `processPath`/`contains`) used by the install path |
| "Atomic install" rollback untested | HIGH | Fixed: post-mount failure test asserts rollback and a clean retry |
| Evidence drift ("11 methods") | LOW | Fixed (13) |
| `node_modules` symlinks untracked but not ignored | LOW | Fixed: `.gitignore` |

Residual, DISCLOSED (not claimed fixed): in-process guard→provider TOCTOU (the OS lane is the real
boundary); same-realm malicious JS; the PTY port is a double; `dsh-tool-fs`/dump-config boot legs;
the trust registry's loader-supplied digests.

## 6. Reproduce

```bash
cd .worktrees/a5sf-p1-01
node_modules/.bin/vitest run \
  packages/domain/test/a5sf-v4-member-ceiling-projection.test.ts \
  packages/runtime/test/a5sf-member-policy.test.ts \
  packages/runtime/test/a5sf-path-rules.test.ts \
  packages/runtime/test/a5sf-invocation.test.ts \
  packages/runtime/test/a5sf-trust-registry.test.ts \
  packages/runtime/test/a5sf-service-install.test.ts \
  packages/runtime/test/a5sf-provider-composition.test.ts \
  packages/runtime/test/a5sf-os-runner.test.ts \
  packages/runtime/test/a5sf-subprocess-contract.test.ts \
  packages/runtime/test/a5sf-terminal-lifecycle.test.ts
```
