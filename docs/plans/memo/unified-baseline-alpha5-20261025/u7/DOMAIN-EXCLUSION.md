# R-G1F-2 — Domain family excluded from the Alpha.5 release claim

**RECORD OF A SCOPE NARROWING. NOT A DELIVERY.** Dated 2026-10-26. Records that the user excluded
`surface:domain_family` from what Alpha.5 claims. No Domain capability ships, no gate verdict changes, no matrix
cell is re-coloured. Docs/evidence only: no product code, no host boot.

## 1. The ruling and the question it answered (verbatim)

Ruling — `dev/agent-workflow/evidence/u7-design-20261026/USER-RULINGS-20261026.md:7-9` (2026-10-26):

> 3. **R-G1F-2（Domain family）→ 总体同意 B**，但需先回答：Alpha.5 原始设计中对外来工具/MCP 的接入控制要求是什么
>    （必须满足的条件、必须能接入某个控制类型，如控制读、控制写、控制沙箱启动），以及现在能否继续按该设计执行。
>    → 见 `docs/plans/memo/unified-baseline-alpha5-20261025/u7/EXTERNAL-TOOL-CONTROL-DESIGN.md`。

Question answered — `dev/agent-workflow/evidence/u7-design-20261026/USER-DECISIONS.md:7`:

> 3. **R-G1F-2 — Domain family scope:** For `surface:domain_family`, should Alpha.5 (A) enumerate a finite set
> of Domain tools/scopes and deliver them as REQUIRED, (B) explicitly exclude Domain from Alpha.5's
> product/release claim with a documented boundary (recommended if no provider is approved), or (C) defer to
> Alpha.6 and keep G5 blocked? … Recommendation: **B** unless a concrete Domain provider and scope are approved.

The A/B/C row that produced the question: `…/u7-design-20261026/U7-PLAN.md:18` (class (iii) USER ruling
required; B = narrow the release claim). The ruling's second half — answer the external/MCP control question
first — is discharged at `…/u7-design-20261026/DECISION-3-ANSWER.md:88-89`: Domain excluded from the Alpha.5
release claim with a recorded boundary, MCP still required under its own narrowed claim.

**Citation-scope disclosure.** Those three evidence files and `u7/EXTERNAL-TOOL-CONTROL-DESIGN.md` live on
branch `task/u7-rulings-decision3-20261026` (PR #384, open); they are absent from this branch's base
`origin/master @ 496a3980f`, so a cold clone of master alone cannot open them. Cited here, never copied.

## 2. What `surface:domain_family` is, and where it appears today

It is **a surface obligation class — not a tool name, provider, Scope or enumeration.** The record says so:
`dev/agent-workflow/evidence/u4-obligations-20261025/expected-tool-obligations.json:1627` names the entry
`"surface:domain_family (family obligation — no registered names)"`; `:1630` "design-semantic family
(HPC/RPC/research-state/device) — NOT proven registered names"; `:1641` "do not invent `hpc_*` class names".

Grep result, stated plainly (transcript: `dev/agent-workflow/evidence/u7-r1f2-domain-exclusion-20261026/greps.txt`):
`grep -c 'domain_family'` on that file = **1** — that suffixed entry, not a bare tool name; `grep -n
'"surface:domain_family"'` exits **1**: no bare-name record. The file is **untracked local evidence**, which is
itself part of the finding: the obligation was never committed.

Tracked-tree occurrences (`git grep -n domain_family`): `m0-closure-v3/route-records-v3c.json:1927` (seed route
record; `currentRoute=DOMAIN_INTERSECTION_SELF_DETERMINED`, `req=N-A-TOOL`); `machine-v3/route-record.schema.json:216`
(schema enum); `machine-v3/coverage-keys-expected.json:60` (`surface:domain_family#surface`);
`M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json:4022`; `gates/GATE-VERDICTS.md:15` (R-G1F-2 NAMED-BLOCKER);
`gates/G1-F-G3-REVIEW-R2.md:22,30` ("acceptable named blocker, not a seam failure");
`gates/HANDOFF-U6-20261026.md:35,44`. The hyphen spelling `domain-family` occurs **nowhere** (`git grep` exit 1).

Design statements of the same family: `docs/plans/memo/alpha5-tool-io-governance/S0-SELECTION-MATRIX.md:61`
(M-13 "Domain 工具（HPC/RPC/研究状态/设备）", 无 P0 实验腿); `ADR-alpha5-tool-io-governance.md:72`
("Domain-side permissions remain independent") and `:75` (intersection; "No universal domain rule hierarchy …
is added"); `architecture.md:185` (trusted binding to a real domain gate) and `:242` (remote domain/equipment
effects governed at the remote gate); `m0-closure-v3/M0-B-FAMILY-TARGET-CONTRACTS.md:175-176` (B-DOMAIN);
`m0-closure-v3/M0-PLANB-ASSEMBLY.md:59` (B-DOMAIN = 1, CONNECTOR, "非模型面工具名").

In code, what exists is a veto *result type*, not a family — `packages/domain/tool-governance/src/interfaces.ts:181`
`export type DomainVeto = 'allowed' | 'denied' | 'not-applicable'`, consumed at `:186` as
`readonly domainVeto: DomainVeto`; `src/effects.ts:43` lists `'domain-ref'` in the closed `EFFECT_KINDS`,
defined `:71-76` as `DomainRefEffect` (`domainAuthorityId`, `resource: null`); `src/errors.ts:31` registers
`'DOMAIN_DENIED'`. Absence proof: `grep -rn -i 'equipment|hpc_|domain_family|domain-family'
packages/domain/tool-governance/` → **exit 1**; the only `hpc_` string in the tracked tree is matrix L43's
instruction not to invent such names. Existing Domain-veto evidence is **row-local mocks, not a provider** —
`tests/kits/a5-w7m-m13-domain-veto/README.md:25` discloses a "row-local Domain mock", and the mock interlock at
`dev/agent-workflow/evidence/alpha5/wiring/we2/README.md:26` refusing a minted grant is a fixture, not a family.

## 3. The boundary — claimed / not claimed

**Alpha.5 does NOT claim, and this record does not deliver:** any Domain provider, tool name, Scope or
enumeration; any `hpc_*`/`equipment`/research-state/RPC integration; any domain gate mounted in a real Host; any
per-domain per-name acceptance row. `surface:domain_family` stays **UNKNOWN / not-claimed** for the Alpha.5
release claim. `GATE-VERDICTS.md:15` records this as a named scope gap, not a seam failure.

**Alpha.5 DOES continue to claim** what it already claimed independently of Domain: shared identity, approval
and authorization primitives, pre-Body refusal, one-shot grant consumption, and every tool family with its own
row. CI-10 is unchanged — where a deployment does bind a real Domain authority, `Team Permit` must not override
`Domain Permit` and vice versa (`u6/center-assembly-architecture.md:55`; `G4-CORE-EVIDENCE.md:27` records
"unchanged, gated earlier"). That is a property of the kernel's effect model: this exclusion neither weakens it
nor implements it for any concrete domain. A future Domain family cannot be inferred from this exclusion (§5).

## 4. Compatibility and scope consequences

- **G5 no longer requires Domain.** G5 has never been opened: `gates/GATE-LEDGER.md` holds rows for G1-I, G1-F
  (R1/R2), G2, G3, remediation, U6 PR2–PR6 and G4 — **no G5 row exists**. G5 stays **BLOCKED** on its other
  blockers per `u6/center-assembly-architecture.md:249-255` (§10.6: G4-CORE-PASS/BRIDGE-BLOCKED does not unlock
  G5; while required Bridges are unresolved or un-scope-changed, "G5/Alpha.5 release 必须 BLOCKED") and
  `execution-plan.md:146` (PRODUCT-GATE). This ruling is one such "明确范围变更", for Domain only.
- **No matrix cell changes.** `TOOL-CAPABILITY-MATRIX-9b2.md:43` (M-13 Domain) keeps its verdict
  **NOT_VERIFIED**, all other cells verbatim. Recording a boundary is not laundering a status: a NOT_VERIFIED
  row does not become NOT_APPLICABLE because the release claim dropped it. `UNKNOWN`/`NOT_VERIFIED` stay.
- **Verdict cells are not edited here at all.** `docs/plans/active/**` is user/main-agent production
  (`AGENTS.md` directory table: "用户/主 Agent 产物，禁 worker 改动"), so the boundary lives in this memo. The
  obligation entry `expected-tool-obligations.json:1627` is likewise untouched: its `obligation: REQUIRED` is
  the historical fact G1-F recorded; §3 narrows only its release effect.
- **Release-claim text naming Domain, identified:** matrix L43 (M-13); `GATE-VERDICTS.md:15`;
  `HANDOFF-U6-20261026.md:35,44`; the §2 design rows. None is rewritten; each is qualified by reference to this
  file. `grep -i 'domain\|M-13' docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md` → exit 1:
  that file never mentions Domain, so no qualification is owed there.

## 5. What would reopen it

All four, not any one: (1) a named Domain provider with a real effect boundary; (2) a finite enumeration of
Domain tool names and Scopes, committed to the repo; (3) real evidence at that boundary — not a row-local mock,
not the W7M/WE2 fixtures reused as proof; (4) a new user ruling assigning it to a named alpha with its own
acceptance rows. None of these can be inferred or back-filled from this exclusion, which narrows one claim and
is not a template for reviving the family. Until then: excluded; "no provider was approved" is the current state.

## 6. Interaction with MCP / external tools — a separate decision, not merged

`docs/plans/memo/unified-baseline-alpha5-20261025/u7/EXTERNAL-TOOL-CONTROL-DESIGN.md:47-51` (PR #384) rules the
external/MCP side separately: `blocked-with-reason` for the full design, `executable-with-narrowing` for a
reduced claim only — unknown/late/same-name MCP sources per `:51` are denied until an explicit center binding,
with **no remote isolation guarantee**, and controlled MCP effects, the resource trio and dynamic promotion
deferred to a named Bridge/Provider.

The two decisions are **independent and must not be fused**. MCP remains a required family in Alpha.5 whose
unfinished parts cannot count toward G5; Domain leaves the claim entirely. Treating one as evidence for the
other is exactly the inference §3 and §5 forbid; they share procedure only — both were decided 2026-10-26 by the
same user, both narrow what may be claimed, neither adds a gate PASS.
