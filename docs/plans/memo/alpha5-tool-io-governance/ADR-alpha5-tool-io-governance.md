# ADR — Alpha.5 Preset-Scoped Tool Governance and I/O Execution

**Status:** Accepted design decisions; implementation seams and acceptance remain pending P0 verification.
**Decision date:** 2026-10-14
**Scope:** Alpha.5 **tool governance + I/O + sandbox only**. This ADR does **not** authorize an Alpha.5 stage kickoff, rewrite Alpha.4, or resolve Member UI, Blueprint editor, Team Tab, or project rename.
**Related:** [Architecture design](./architecture.md); [Alpha.4 authority ADR](../../active/alpha4-permission-governance/ADR-alpha4-hard-governance.md); [Alpha.4 governance spec](../../active/alpha4-permission-governance/alpha4-permission-governance-spec.md); [debt register](../post-alpha4-debt-register.md).
**Host baseline:** shipped Team package requires DSH `0.2.0-rc.2`; inspection of newer upstream APIs is **evidence, not a silent host upgrade**.

## 1. Problem and intent

Alpha.5 is a reinforcement/closure stage. Existing A2C2 covers a closed set of reviewed tool names and classifies many ordinary preset tools as unmanaged; it does not give general read-side I/O control. Blueprint authors need full freedom to select tools and decide file/network bounds without Team interpreting each tool's business semantics. The Team plugin must implement authorization, trustworthy routing for its own adapters, and honest security claims without building a universal untrusted Plugin Runtime.

## 2. Accepted decisions (binding for this design)

1. **Preset scope.** Team Blueprint governs **only the effective tool surface exposed by the Team's bound preset**, not all installed tools or other sessions. At Team start, each exposed tool must have a Blueprint registration and effective management policy; explicit `deny` counts as managed. Conceptual coverage: `T_preset ⊆ T_blueprint`. Preserve resolution per Leader/Member scope and effective preset rather than treating a global tool-name inventory as the surface.
2. **Trusted provider default.** After coverage validation, providers selected by the Blueprint author/deployer are trusted; Team does not review their business semantics or prove a private adapter's I/O correctness. Public DSH currently lacks a general, authenticated `(owner, toolName)→actual implementation` attestation seam. Declare this limitation explicitly; do not claim such proof.
3. **Existing authority ladder.** Retain Alpha.4 `deny < ask < allow`, ApprovalCase, reviewer hierarchy, `teamHardEnvelope` and `permissionMutationEnvelope`. No new approval levels, no rewriting the authority model. An external/Core approval cannot reverse Team denial.
4. **Separate tool authorization and I/O policy.** Tool-level `allow/ask/deny` governs permission to call; an orthogonal I/O policy governs effective read/write/network access. Both constraints must hold. Missing required effective policy does not silently mean unrestricted.
5. **File I/O.** Read and write each support `mode: all | restricted` and resource `allow/ask/deny` entries. `all` means resources accessible to the underlying execution identity (not privilege elevation); `restricted` means only explicitly allowed/approved resources, with unspecified paths denied. Deny overrides same-operation grant/ask, subject to existing Alpha.4 **inter-layer** precedence and lawful durable policy mutation; never smuggle a novel super-deny authority tier into I/O.
6. **Path grammar and anchoring.** Relative Blueprint paths resolve against the bound immutable workspace anchor, never the mutable active cwd. `.` means workspace subtree; reject relative path segments `..` (including `src/../x`). Explicit absolute paths may address outside workspace; `~/` explicitly anchors to the trusted execution identity's home. Resolve in the actual execution world and prevent symlink/junction/mount alias bypass; canonical identities and denial must agree across relative/absolute spelling. Preserve significant whitespace; reject ambiguous/malformed strings rather than silently trimming.
7. **Network I/O.** Three basic modes: `deny`, `restricted`, `allow`. For `restricted`, explicitly allowed destinations can connect; explicitly denied destinations never can; `ask` destinations and optionally unspecified destinations when `default: ask` may be requested **before** execution. No Team-owned generic DNS/proxy engine; delegate network enforcement to a trusted provider. Detailed endpoint grammar/protocol support is provider-specific and must be declared, not assumed.
8. **Before-start one-shot grants.** Any file/network `ask` expansion must be proposed, approved, bound to the exact operation and its scope, revalidated, and materialized **before tool body or sandboxed process starts**. Do not suspend arbitrary Bash on file fault; do not auto-replay partially executed commands. One-shot grants do not mutate standing permissions.
9. **Three execution routes.**
   - `native`: Team-maintained adapters for agreed DSH native tool families. Team owns the advertised enforcement correctness, within documented supported cases.
   - `custom`: author/deployer-registered trusted adapter. Team guarantees authorization, mandatory invocation via adapter and no silent original-body fallback; adapter implementation correctness and I/O assurances are **author-owned**.
   - `shadow-run`: author/deployer-registered independently launchable executable/runner, started under Team-maintained **Linux-first** restricted process isolation. Team guarantees the advertised enforced isolation and fail-closed behavior; author owns missing libraries, tool functionality, CLI/wrapper implementation. Arbitrary in-process DSH `ToolDefinition.execute()` cannot be magically transplanted into a sandbox.
10. **Shadow-run is NOT Shadow Execute.** Here `shadow-run` means subprocess isolation **before execution** with allowed writes possibly affecting the real permitted workspace immediately; it does **not** promise COW, diff review, rollback, transactional commit or automatic effects replay. These remain optional/deferred.
11. **Network delivery for Alpha.5.** Linux shadow-run must implement and prove basic `allow` and `deny` networking. `restricted` with address allow/ask/deny is defined at policy level, delivered only through a compatible registered NetworkPolicyProvider; if unavailable or insufficient the affected call **fails closed**. Do not silently treat `restricted` as `allow`.
12. **No broader provider isolation requirement.** Alpha.5 does not universally sandbox untrusted same-process JS plugins, fork all DSH tools, or rewrite Core ToolRuntime. Stronger untrusted Worker execution remains long-term.
13. **Runtime drift.** After startup coverage, no new or replaced *detectable* tool may execute without the relevant validated binding; deny affected calls until revalidated. Full source attestation and a decision between frozen preset+Blueprint versus untrusted-provider execution remain deferred.
14. **Core patch budget.** Existing `CORE PATCH BUDGET = 0` remains. No upstream patch/private import/vendored modified Core. A necessary unavailable public seam is a documented `CORE_SEAM_BLOCKER`, not permission to patch it. Independent adapters may be implemented with legitimate public seams; any future fork/change to this rule requires a separate decision.

## 3. Responsibility and assurance

| Route | Team proves | Blueprint author/deployer owns | Unsupported case |
| --- | --- | --- | --- |
| Native | tool binding, authorization, native adapter's claimed I/O controls | business suitability, selected policy | refuse with typed capability failure |
| Custom | binding, before-call policy/approval, **exclusive routing** through chosen adapter | adapter's internal enforcement, security and functionality | no implicit fallback |
| Shadow-run | binding, approved policy, OS-enforced isolation, safe process launch, cancellation/process-tree cleanup | independent runner, dependencies, functionality, run compatibility | do not launch without required isolation |

An author may deliberately choose full file access + network allow; this is valid policy. A requirement for isolation cannot be satisfied by mere success-shaped adapter metadata. Custom route's author-trusted assurance must be visible in diagnostics; do **not** imply Team audited its internal effects. For native and shadow-run routes, claimed enforcement must be testable. A sandbox can protect its subprocesses, not the whole DSH Host, other installed plugins, the LLM transport, or a remote MCP server.

## 4. Explicit non-goals

No Blueprint self-evolution, topology dynamics, new reviewer hierarchy, general-purpose untrusted provider verification, global DSH tool governance, arbitrary-URL-level network safety proof, filesystem information-flow taint tracking, live on-access Ask, automatic Shadow Execute/COW/checkpoint, or full Windows isolation parity in Alpha.5. Other Alpha.5 product work is scoped separately.

## 5. Known gaps / no premature closure

- DSH official `tools/pre-execute` and monotonic `tools.guard` can gate dispatch, but public `tools/execute` is an around-dispatch waterfall and does **not** by itself substitute a registered `ToolDefinition.execute()`; strict mandatory re-routing needs a tested implementation seam (P0).
- Current `ctx.sandbox` only models file-write effects; it is not the new file-read/network ACL interface. `dsh-tool-fs-search` spawns ripgrep through plain `ctx.subprocess`, while same-process and remote providers are outside subprocess confinement.
- Path interpretation, `~` execution-world identity and alias checks need concrete tests; existing NRM-1 whitespace normalization bug must not migrate into new policy.
- PTC nested dispatch, direct tool dispatch, jobs, dynamic registration, scoped overrides, foreground/background and tool-denial checks need last-mile real-Host verification.
- Exact author-facing inheritance, endpoint subgrammar, and network provider capability assertions are **architecture-spec proposals**, not individually user-ratified implementation syntax.
- Alpha.4 PM-1 (member Exec overlay) and related known defects must be included in regression/security gates; do not mistake current code for complete enforcement.
- Preset binding/author-trusted provider does not authenticate malicious same-process plugin code or post-start source replacement beyond detectable surface changes.

## 6. Decisions left to P0 technical verification, not new policy tiers

P0 must demonstrate exact tool routing on the supported Host using public seams, or record a precise `CORE_SEAM_BLOCKER` with reproducible minimal case. It must establish safe return/result normalization, no original-body fallback, guard ordering, nested PTC coverage, cancellation and callbacks, native search/file/shell seams, and a standalone shadow-run launcher. The technical choice of bwrap/Landlock/existing open-source runner is delayed until policy and capability requirements are fixed.

## 7. Supersession and precedence

This ADR records the user's Alpha.5 design decisions; it proposes a **future stage-local implementation contract**, not an in-place amendment to the accepted Alpha.4 production schema or the 2026-08-29 frozen historical plans. Any prospective contradiction must be listed as an intentional Alpha.5 change in the eventual active implementation plan and approved/validated under the repository's precedence rules. This document is not authorization to alter persistent permission meanings, existing Team identity, or installed host baselines.
