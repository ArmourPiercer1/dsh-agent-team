# P1-07 · OS Runner / Subprocess public face — evidence

- **Task**: P1-07 (Gate **G1.7**), branch `task/a5sf-p1-01-20261102`.
- **Lane**: `packages/runtime/team-sandbox/src/{profile,runner,subprocess,index}.ts` (new),
  reusing the existing `packages/runtime/sandbox-provider` launcher/probe/lease lane.
- **Tests**: `a5sf-os-runner.test.ts` 9 + `a5sf-subprocess-contract.test.ts` 2 = **11/11**;
  `tsc` rc=0 (`green-tests.log`).

## 1. Environment (recorded, because the plan's PoC saw a different result)

```
$ uname -a
Linux DESKTOP-D 6.18.33.2-microsoft-standard-WSL2 ... x86_64 GNU/Linux
$ probe (real launcher)
[["content-read","enforced"],["write","enforced"],
 ["directory-metadata","unsupported"],["alias","unsupported"],
 ["network-destination","unsupported"],["inherit-cancel","author-trusted"]]
```

The earlier PoC's **WSL2 Landlock `add_rule=EBADF` ENV_BLOCK does not reproduce on
this kernel** (6.18.33.2-microsoft-standard-WSL2): content-read and write are
ENFORCE-confirmed and a real confined child was observed to be refused a denied
read. The blocker is environment/kernel-epoch specific, not a property of "WSL2".
This is recorded as a fact of THIS environment; it is not a deployment PASS for
other hosts, and `directory-metadata`/`alias`/network remain UNSUPPORTED here.

## 2. Laws pinned

| Law | Test |
|---|---|
| read/write compiled INDEPENDENTLY; a write-only subtree has no read bits | profile pure tests |
| read+write locator becomes one entry with all bits | profile pure tests |
| a deny EQUAL to an allow removes the rule; a deny NESTED inside an allow is REFUSED (`PATH_NESTED_DENY_UNEXPRESSIBLE`) because Landlock has no negative rules | profile pure tests |
| `mode: all` ⇒ `PATH_LANE_UNRESTRICTED` (never invented as an allowlist) | profile pure tests |
| `ask` ⇒ `PATH_LANE_UNSUPPORTED` (an ask is not an OS grant) | profile pure tests |
| network `deny` rides `networkProfile`, `allow` adds no restriction | profile pure tests |
| **REAL**: allowed read works, denied read is `Permission denied` inside the child and the secret never appears | real OS leg |
| **REAL**: a write-only subtree accepts a write (file lands on disk) while the child cannot read it back | real OS leg |
| network deny with no enforcement ⇒ `ENFORCEMENT_UNAVAILABLE`, no process | real OS leg |
| empty argv / inexpressible profile refused before any process | runner plan tests |
| native `SubprocessHandle` shape: pid/stdin/stdout/stderr/`collected`/`done`/`waitForExit`/idempotent `terminate` over the streaming arm | subprocess contract (real stream) |

## 2b. Review follow-up (2026-11-02, PR #532 review)

- **BLOCKER fixed**: the profile used to DROP a deny nested inside an allow, so the child could read
  the denied subtree. It now refuses the profile. The previous test (which asserted the parent rule
  and was named "a denied locator never reaches the kernel ruleset") was rewritten to assert the
  refusal, and the false claim was removed from this document.
- The real-OS test now SKIPS (not passes) on a host without enforcement, so a non-enforcing kernel
  can never report the FS law green.
- `toSubprocessHandle` no longer consumes the streams by default (`capture` is opt-in) — the native
  `for await` consumers keep every byte.
- `chmod`, nested write-only-under-read, and the `network`/`dir-metadata`/`alias` rows remain
  disclosed limitations.

## 3. Honest gaps

- `chmod` is NOT constrained by Landlock for a same-uid owner; the profile claims
  no chmod ceiling (the plan forbids using 0200/0300 VFS bits as a general
  fallback). Disclosed, not approximated.
- `directory-metadata` and `alias` dimensions are unsupported on this kernel
  profile; a policy that needs them must be refused by the consumer (the runner
  only hard-requires content-read/write/network- deny today).
- The profile is compiled from the **Member** policy (or an EffectiveIoPolicy);
  the per-tool intersection is P1-02's job and is applied before the profile.
- Native `ctx.subprocess.spawn` wiring into the live Host is P1-05/P2 integration.
- Gate G1.7 is **PASS for the FS read/write dimensions on this host**, with
  network/dir-metadata/alias explicitly refused, and `spawn` shape preserved.

## 4. Reproduce

```bash
cd .worktrees/a5sf-p1-01
node_modules/.bin/vitest run packages/runtime/test/a5sf-os-runner.test.ts \
  packages/runtime/test/a5sf-subprocess-contract.test.ts
```
