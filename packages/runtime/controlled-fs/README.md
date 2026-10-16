# A5-PR3 (Lane B) — ControlledFs + PoC3 (DORMANT lane)

Trusted-Host FS mediator implementing the frozen PR0 `ControlledFs`
interface + the Alpha.5 **C-FS** contract (INTERFACES-v1). Developed against
the contract fixture (PR2 not merged — per integration rule this lane may
only claim "verified against fixture", never "verified chain").
**Nothing here is live-wired**: new directory only; root registry, barrels,
package tsconfigs, and the root vitest config are untouched (integration
owner wires after C-ADM freeze).

Run the lane (from `packages/runtime/controlled-fs/`):

```bash
<repo>/node_modules/.bin/vitest run            # 37 tests, real FS worlds
<repo>/node_modules/.bin/tsc -p tsconfig.lane.json
```

## §1 契约符合点 (C-FS conformance)

- **资源描述符 `{fs, path, fd?}`** — `src/cf-descriptor.ts`: closed keys,
  closed path law (instance-relative, `..` refused, legal whitespace never
  trimmed), `fd` never participates in identity; bridged to the frozen
  `ResourceRef` (realm-bound) via the PR0 parsers only.
- **错误闭集 typed，三分** — `src/cf-errors.ts`: `CF_ERROR_CLASSES =
  denied | hidden | undetermined` (+ total closed reason partition); no
  lane-invented §5 codes — class/reason ride in `details`
  (`cfClass`/`cfReason`/`cfDiagnostic`) on frozen `GovernanceError`.
- **hidden-read 永不静默** — enforced constructively: `cfsHidden()` THROWS
  on a blank diagnostic; the diagnostic is required both in the typed error
  (`details.cfDiagnostic`) and in the append-only ledger (`refused:hidden:*`
  / `withheld-stat` lines). A hidden `stat` answers the honest
  `{exists:false, kind:'unknown', withheld:true}` — withheld is not absent.
- **open-at-exec 重读** — `src/open-at-exec.ts`: object re-read runs AFTER
  the OS open and BEFORE any byte moves (`/proc/self/fd` realpath under the
  anchor; `fstat` (dev,ino) equality with the check-time snapshot); policy
  re-read rides the `AdmissionRecheck` seam.
- **PR0 interface law carried through**: grant-per-call (no shared mutable
  grant), checks before open, `limit:null` window law (no default windows),
  write receipts never echo old content (M-02), no standing fd across calls
  — a presented fd is verified against the lane registry + live `/proc`
  view, never trusted.

## §2 偏离点 (recorded deviations, pre-freeze by contract)

1. **`AdmissionRecheck` default = honest no-op** — the C-ADM freeze (PR2)
   must wire the real recheck; until then the seam is NOT claimed to
   re-ask admission (fixture-level claim only, per integration rule).
2. **§5 code mapping table** (cf-errors header) — PR0 has no generic
   "policy-denied" code; denials ride `TOOL_BINDING_UNVERIFIED` (PR0's own
   `effect-outside-grant` precedent), staleness rides `APPROVAL_STALE`,
   strictness-unprovable rides `IO_POLICY_UNSUPPORTED`, unconfirmed raced
   writes ride `EXECUTION_TERMINATION_UNCONFIRMED` + `sideEffectUnknown`.
   Any lane wanting the class FROM THE CODE alone must read `details` —
   contract-visible mapping, not a silent coinage.
3. **Residual race window on the node fallback** — between check and open
   the OS may open a foreign inode (PoC3-B ledger proves it: `open-issued`
   then `exec-refused`); zero DISCLOSURE is guaranteed, zero FOREIGN-OPEN
   is NOT claimable without `OpenAtPort`. Therefore: fully-untrusted mutable
   trees ⇒ strict profile = `IO_POLICY_UNSUPPORTED`; fixed trusted trees ⇒
   profile holds. This is plan §6's own trichotomy resolved honestly.

## §3 探针缝 (test-only seams)

- `LaneHooks.onAfterPreCheckBeforeOpen` = deterministic "attacker window"
  injection (fixture race legs); `onFdOpened` = fd capture. Both are lane
  config, off unless a fixture passes them.

## §4 接线注 (for the integration owner — post C-ADM freeze)

> **接线状态（集成轮 branch `alpha5-int-wiring`）**：§4.1/§4.2/§4.5 已落代码——
> `src/admission-binding.ts`（unbound=typed 拒 `admission-unbound`；recheck 绑本调用
> PR1 canonical `parametersFingerprint`，偏离/null 在端口查询前 typed 拒）+
> `ControlledFsLaneConfig.subtreeContains`（authority-envelope `SubtreeContains`
> 注入点；未注入=lane 窄律逐字节不变）+ runtime tsconfig（typecheck 全量、build 仅
> `controlled-fs/src`）+ root vitest 收集本目录 `test/`。§4.3 不变（消费仍 PR2
> durable ledger，lane 只读视图）。§4.4 **仍未落地**：`OpenAtPort` 未实现，任意可变
> 树 profile 禁发布 Supported——`ARBITRARY_TREE_PROFILE_PUBLISHED=false` 常量钉 +
> `a5w-integration-wiring` 套件断言（PR8 矩阵相关行仅经 pending_update 通道注记）。
> 全部 fixture 级验证，非整链宣称；证据见
> `dev/agent-workflow/evidence/alpha5/wiring/`。

1. Replace `NO_RECHECK` with PR2 `OperationAdmission` bound to the **PR1
   canonical `parametersFingerprint` of THIS call** (fingerprint-law
   alignment: the exec-time recheck must present the same fingerprint the
   Guard saw pre-call; a re-resolved definition must never exec under
   another call's fingerprint).
2. Replace `effectCovers` subtree rule with `domain/authority-envelope`
   `SubtreeContains` when planes are wired (lane rule is deliberately
   narrower: identity + directory-prefix only).
3. Grant CONSUMPTION stays PR2's durable ledger (lane consumes nothing; it
   reads the `GrantConsumptionLedgerView`).
4. `OpenAtPort` (openat2 native helper) upgrades the strict profile; until
   it lands, PR8 must not publish the arbitrary-tree profile as Supported.
5. Wiring into `packages/runtime/{tsconfig.json,tsconfig.build.json,index}`
   and any barrel/registry = integration owner (lane kept DORMANT per
   INTERFACES-v1; root vitest runnable surface untouched — lane runs on its
   own `vitest.config.ts`).

## §5 证据

`dev/agent-workflow/evidence/alpha5/pr3/`: `runs/RED-lane-vitest.txt`
(RED-first, src/ absent), `runs/GREEN-lane-vitest.txt` (37/37 + tsc 0 +
world teardown proof), `POC3-RESULTS.md` (five legs, naive-vs-guarded,
verdicts). Worlds = `tests/homes/a5p3-*`, destroyed after every run; port
3182 reserved-but-unused (no host boot in this lane).
