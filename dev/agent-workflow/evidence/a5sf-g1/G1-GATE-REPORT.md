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
| **G1.4** invocation binder + trust registry (P1-04) | **PASS** | 28/28 `a5sf-invocation` + `a5sf-trust-registry`; 68/68 with Alpha.4 regressions | capabilities bind `toolBindingIdentity` (required by the laws, extension disclosed) |
| **G1.5** per-Member Service realm (P1-05) | **CONDITIONAL** | 10/10 `a5sf-service-install` on real Cordis: isolated `ctx.isolate('fs')` scopes, real `tools.register`, per-member ceilings, atomic install refusal | upstream `dsh-tool-fs` binary and per-agent same-name variants need the real Host composition (not in `packages/runtime`'s dependency closure; `pnpm install` unavailable here: `ERR_SQLITE_ERROR`). Deferred to P2/E2E. |
| **G1.6** provider replacement + delivery (P1-06) | **CONDITIONAL** | 9/9 `a5sf-provider-composition`: real `applyEntryPatches`, exactly-one-active-provider, typed refusals, shipped bundle dormancy against the real `cordis.patch.yml` | real `pnpm smoke:composition` / `dsh --dump-config` boot and package `exports` wiring are the Native Integrator + pnpm-capable-environment leg. Rows are declared `shipped: false`. |
| **G1.7** OS runner / subprocess public face (P1-07) | **PASS (scoped)** | 11/11; **real confined child on this host**: allowed read OK, denied read `Permission denied`, write-only subtree writes and refuses read-back; probe rows `content-read: enforced`, `write: enforced`; native `SubprocessHandle` shape over the streaming arm | `network-destination`, `directory-metadata`, `alias` are **UNSUPPORTED** here and are refused, never approximated; network-deny policy → `ENFORCEMENT_UNAVAILABLE`. `chmod` is outside the OS ceiling (Landlock cannot restrict same-uid chmod) — disclosed. |
| **G1.8** PTY / persistent lifecycle (P1-08) | **CONDITIONAL** | 6/6 `a5sf-terminal-lifecycle`: trusted-owner identity, creation-time revision, reuse-without-restart, kill+rebuild on tightening, revocation, shutdown receipt with pid/descendants | PTY port is a double; real terminal backend wiring + native `spawnTerminal` run is the P2 leg. |

**P1 total gate (G1)**: **CONDITIONAL PASS** — the policy compiler, path algebra, invocation
binding, service isolation law and OS FS read/write enforcement are proven with positive and
negative evidence; three legs (G1.5/G1.6/G1.8) still need the real-Host wiring that the plan
assigns to the Native Integrator / P2 integration. No leg is claimed PASS on registration success
alone.

## 2. Test inventory (128 tests, all green in this worktree)

| Suite | Tests |
|---|---|
| `a5sf-v4-member-ceiling-projection` | 21 |
| `a5sf-member-policy` | 16 |
| `a5sf-path-rules` | 27 |
| `a5sf-invocation` / `a5sf-trust-registry` | 18 / 10 |
| `a5sf-service-install` | 10 |
| `a5sf-provider-composition` | 9 |
| `a5sf-os-runner` / `a5sf-subprocess-contract` | 9 / 2 |
| `a5sf-terminal-lifecycle` | 6 |

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
  `approvedOnce` as input.

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
