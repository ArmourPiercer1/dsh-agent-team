# ENV-LIMITED capability record — the confined process lane's `network: deny` profile

Round 82, 2026-11-23. Worktree `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut`.
Leg: `ute-vnext-a1` (`dev/ci/eb3-ci-manifest.json` → `ci-census`; 7 suites / 206 tests, pinned host
`A5SF_REQUIRE_PINNED_HOST=1`).

## 1. What the five arms depend on

`OS-2`, `OS-3`, `ADM-66`, `SLICE-28` and the `ADM-70` grep rung all ask the confined process lane for
`networkProfile: 'deny'`. The product admits that request only when its own `runNetworkLeg` (the
launcher's real `--net-leg`) reports `NET-DENY-CONFIRMED`: a control child reaches a loopback listener,
a deny child lands in a DISTINCT network namespace and both tcp and udp fail with a kernel errno while
the listener counters do not move. `grep` runs through the same confined subprocess face, so the
"ripgrep provider failure" the hosted runner reported was the provider's fail-closed refusal, not a
ripgrep defect.

The leg now measures the capability first (`tests/world-factory/lib/a5sf-env-capability.mjs`, reusing
`createLauncherDeps`/`runAbiProbe`/`runAvailabilityPreflight`/`runEnforcementLeg`/`runNetworkLeg`, no
second probe, one probe per process) and prints `A5SF-CAPABILITY …`.

## 2. Local host — capability PRESENT (real kernel controls)

```
$ uname -a
Linux DESKTOP-D 6.18.33.2-microsoft-standard-WSL2 #1 SMP PREEMPT_DYNAMIC … x86_64 GNU/Linux

$ A5SF_REQUIRE_PINNED_HOST=1 node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
A5SF-CAPABILITY network-deny=present level=enforced code=NET_DENY_ENFORCED ripgrep=present \
  ripgrep-path=…/tests/deepseek-harness-test-use/node_modules/.pnpm/@vscode+ripgrep-linux-x64@1.18.0/node_modules/@vscode/ripgrep-linux-x64/bin/rg \
  forced=false detail="runNetworkLeg verdict=NET-DENY-CONFIRMED mechanism=netns netns=4026532298/(host 4026531833)"
…
✔ OS-1 — the host answers the Landlock ABI the provider requires
✔ OS-2 — NEGATIVE CONTROL: a confined payload CANNOT read outside its allow set
✔ OS-3 — POSITIVE CONTROL: the same payload CAN read inside its allow set
✔ ADM-66 — GREP positive: in-lane search is admitted, runs on the confined face, and settles COMPLETED
✔ SLICE-28 — rung 4: grep runs confined inside the ceiling and is refused outside it
✔ ADM-70 — ORDER (positive): the durable facts read back in LADDER order
ℹ tests 206  ℹ pass 204  ℹ fail 0  ℹ skipped 2
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c4…
```

The two declared skips are the product-contract blocks (`ADM-68` bash, `ADM-69` run_code); there is no
ENV-LIMITED record on this host (`DSH-TEST-DISPATCH-ENV-LIMITED` is absent).

## 3. Hosted `ci-census` runner — capability ABSENT (measured, not assumed)

Job: https://github.com/ArmourPiercer1/dsh-agent-team/actions/runs/45087501430 (job
`137415027784`, image `ubuntu-26.04`, release `ubuntu26/20261116.202`), HEAD `fd5fb9e62`.

```
$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1     # inside ci-census

A5SF-CAPABILITY network-deny=absent level=unsupported code=NETWORK_DENY_UNPROVEN ripgrep=present \
  ripgrep-path=…/tests/deepseek-harness-test-use/node_modules/.pnpm/@vscode+ripgrep-linux-x64@1.18.0/node_modules/@vscode/ripgrep-linux-x64/bin/rg \
  forced=false \
  detail="runNetworkLeg verdict=NO-ENFORCEMENT; DENY child moved to a distinct net namespace: expected DISTINCT, got writing /proc/self/uid_map refused | DENY tcp refused by the kernel: expected ERRNO, got connected | DENY udp refused by the kernel: expected ERRNO, got delivered; deny reason: writing /proc/self/uid_map refused"

UTE-VNEXT-A1-ENV-LIMITED arm=ADM-66 disposition=ENV-BLOCK code=NETWORK_DENY_UNPROVEN probe="…"
UTE-VNEXT-A1-ENV-BLOCK arm=ADM-66 code=NETWORK_DENY_UNPROVEN reason="the in-lane grep body did not run: … (fail-closed)"
UTE-VNEXT-A1-ENV-LIMITED arm=ADM-70 disposition=ENV-BLOCK code=NETWORK_DENY_UNPROVEN probe="…"
UTE-VNEXT-A1-ENV-BLOCK arm=ADM-70 code=NETWORK_DENY_UNPROVEN reason="the 4-rung positive ladder is NOT proven"
UTE-VNEXT-A1-ENV-LIMITED-SUMMARY count=2 proven=0 blockers=2 fail_closed=0 arms=ADM-66:ENV-BLOCK,ADM-70:ENV-BLOCK
UTE-VNEXT-A1-ENV-LIMITED arm=SLICE-28 disposition=ENV-BLOCK code=NETWORK_DENY_UNPROVEN probe="…"
UTE-VNEXT-A1-ENV-BLOCK arm=SLICE-28 code=NETWORK_DENY_UNPROVEN reason="the in-ceiling grep positive did not run …"
UTE-VNEXT-A1-ENV-LIMITED-SUMMARY count=1 proven=0 blockers=1 fail_closed=0 arms=SLICE-28:ENV-BLOCK
UTE-VNEXT-A1-ENV-LIMITED arm=OS-2 disposition=FAIL-CLOSED-CONTROL code=NETWORK_DENY_UNPROVEN probe="…"
UTE-VNEXT-A1-ENV-LIMITED arm=OS-3 disposition=FAIL-CLOSED-CONTROL code=NETWORK_DENY_UNPROVEN probe="…"
UTE-VNEXT-A1-ENV-LIMITED-SUMMARY count=2 proven=0 blockers=0 fail_closed=2 arms=OS-2:FAIL-CLOSED-CONTROL,OS-3:FAIL-CLOSED-CONTROL

ℹ tests 206  ℹ pass 199  ℹ fail 0  ℹ skipped 7

DSH-TEST-DISPATCH-ENV-LIMITED mode=run leg=ute-vnext-a1 count=5 proven=0 env_blocks=3 fail_closed_controls=2 \
  arms=ADM-66:ENV-BLOCK:NETWORK_DENY_UNPROVEN,ADM-70:ENV-BLOCK:NETWORK_DENY_UNPROVEN,SLICE-28:ENV-BLOCK:NETWORK_DENY_UNPROVEN,OS-2:FAIL-CLOSED-CONTROL:NETWORK_DENY_UNPROVEN,OS-3:FAIL-CLOSED-CONTROL:NETWORK_DENY_UNPROVEN
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c4…
EB3-LAYER layer=ci-census verdict=PASS status=success
```

The exact failure is `writing /proc/self/uid_map refused`: the runner permits creating the user+net
namespaces but refuses the uid_map write, so the deny child never leaves the host network — it
CONNECTS tcp and DELIVERS udp. Without the proof the provider must refuse, and it does. Seven skips =
the 2 product-contract skips + the 5 env-limited arms.

## 4. Per-arm dispositions

| arm | local (capability present) | hosted (capability absent) | code | disposition |
| --- | --- | --- | --- | --- |
| `OS-2` | kernel denies the out-of-allow read — PASS | asserts `plan.ok===false`, `IO_POLICY_UNSUPPORTED`, the "network profile 'deny' is not offered" + "PoC-4b / not a mechanism" wording, no `scratch/plans`, no `scratch/out`; then skips | `NETWORK_DENY_UNPROVEN` | `FAIL-CLOSED-CONTROL` |
| `OS-3` | the same payload reads inside the allow set — PASS | same refusal assertions on the positive payload; then skips | `NETWORK_DENY_UNPROVEN` | `FAIL-CLOSED-CONTROL` |
| `ADM-66` | `Found 1 match`, settlement `COMPLETED`, spawn count moves — PASS | asserts one admission fact (`allow`/`fs.read`/judged locator), one execution `failed`, settlement `FAILED`, `spawnCalls()` unchanged, no fabricated match; then skips | `NETWORK_DENY_UNPROVEN` | `ENV-BLOCK` |
| `SLICE-28` | in-ceiling search + lane refusal — PASS | asserts the refused-spawn facts, then the out-of-ceiling negative control still runs (lane message `outside the binding's fs.read lane`, 2 executions, second `admission-refusal`); then skips | `NETWORK_DENY_UNPROVEN` | `ENV-BLOCK` |
| `ADM-70` | 4-rung positive ladder order — PASS | asserts `positiveLog===['read','write','web_fetch']` and the durable admission order `['read','write','grep','web_fetch']` with axes `['fs.read','fs.write','fs.read','net.fetch']`; then skips | `NETWORK_DENY_UNPROVEN` | `ENV-BLOCK` |

`t.skip` is called only AFTER the assertions: a regression in the fail-closed refusal turns the arm
RED. None of the five counts as proven; `proven=0` is printed in every summary.

## 5. Simulated absence on the capable host (probe override, not a fake environment)

`A5SF_FORCE_NETWORK_DENY_ABSENT=1` forces ONLY the net-deny verdict at the provider's own
`deps.probeFacts` seam (`NO-ENFORCEMENT` with an explicit override reason). The ABI probe and the three
enforcement legs stay real; the still-generated netns is printed and the override is echoed in
`A5SF-CAPABILITY … forced=true` and in every ENV-LIMITED line. Whole-leg run on this host:

```
$ A5SF_FORCE_NETWORK_DENY_ABSENT=1 A5SF_REQUIRE_PINNED_HOST=1 node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
ℹ tests 206  ℹ pass 199  ℹ fail 0  ℹ skipped 7
DSH-TEST-DISPATCH-ENV-LIMITED mode=run leg=ute-vnext-a1 count=5 proven=0 env_blocks=3 fail_closed_controls=2 …
```

This is what makes the absent branch reviewable on a machine that HAS the capability. It is a
documented test seam, not an environment simulation: no kernel capability is removed, and every
printed line says `forced=true`.

## 6. Product gap or runner limitation?

**Runner limitation.** The product's launcher already performs the only mechanism that can enforce the
profile (`CLONE_NEWUSER|CLONE_NEWNET` + uid/gid maps in `landlock-prelauncher.py`), and the provider
offers `deny` exactly when the probe measures it. The runner's refusal is at the kernel/container
policy layer (`writing /proc/self/uid_map refused`); there is no product option that can make it
succeed, and patching around it would be the forbidden "absence-as-pass". A runner that permits the
uid_map write gets the real controls automatically: same leg, same code, no change —
`network-deny=present` and all five arms run their positive paths, as on the local host.

## 7. What remains UNPROVEN on an incapable runner

- the kernel denial of an out-of-allow-set read (`OS-2`) and the in-allow-set read (`OS-3`);
- the confined `grep` body / `Found 1 match` / `COMPLETED` settlement (`ADM-66`, `SLICE-28`);
- the complete 4-rung positive ladder order (`ADM-70`).

On such a runner the only claims made are the product's fail-closed refusals, the admission facts, the
durable admission order and the lane-refusal controls. The next capable runner closes the gap with no
code change; until then these cells are ENV-LIMITED in `CAPABILITY-MATRIX-C.md` and are never counted
as PROVEN.
