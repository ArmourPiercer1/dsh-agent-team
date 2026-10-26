# Alpha.5 external/MCP tool control — U7 research

## Scope and authority

**DESIGN.** The S0 memo set is historical/superseded for execution but remains the design canon: each file carries the 2026-10-22 historical banner (for example `ADR-alpha5-tool-io-governance.md:1-5`, `architecture.md:1-4`); the active plan says the unified PR #364 plan is now the implementation plan while the memo remains the requirements source (`docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md:3-7,20-24`). The frozen 20260829 development plan only requires per-Agent MCP availability/filtering and says tools capability cannot be inferred for MCP (`docs/plans/finished/DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md:2018-2022,2056-2072`).

## 1. Control-type taxonomy

**DESIGN.** External/MCP is not authorized merely by a tool name or a read-only claim. The controlling Alpha.5 V2 architecture requires an effect request describing actual read, write, process, network and Domain effects, then a common Team admission/ApprovalCase/Grant path (`docs/plans/memo/alpha5-tool-io-governance/architecture.md:181-185,198-208,218-227`; `docs/plans/memo/unified-baseline-alpha5-20261025/u6/center-assembly-architecture.md:98-107`). Execution boundaries are separate: trusted Host, confined process, or delegated remote; assurance is per capability and may be Team-enforced, provider-enforced, author-trusted, or unsupported (`architecture.md:218-225`).

**DESIGN.** For MCP specifically, stdio requires a local confined-process envelope (file/network/process); HTTP requires a trusted remote Provider and local admission/binding only. Local sandboxing cannot constrain remote effects (`docs/plans/memo/alpha5-tool-io-governance/S0-SELECTION-MATRIX.md:60`; `architecture.md:239-242`; `M0-B-FAMILY-TARGET-CONTRACTS.md:145-149`). The required control classes therefore are effect classes (read/list/metadata, write/mutation, process/child, network/connect, Domain reference), plus lifecycle/cancellation/uncertain termination—not a new enum of “controlled read/write/sandbox/network” in the current code.

**NOT THE SAME VOCABULARY.** `ALL_MUTATION_OPS` is the Team-governance action ceiling (`packages/runtime/admission/envelope.ts:146-160`); `ENVELOPE_EXEC_OPS` is only `bash|pwsh` authorization (`:162-182`). Neither is the external-effect taxonomy. The design's effect kinds are deliberately provider/family-specific and normalized as EffectRequest (`center-assembly-architecture.md:214-224`), not the envelope mutation list.

## 2. Admission conditions

**DESIGN requires:**

* source identity/selector and digest; Provider identity and digest;
* schema/contract version, family/version, closed input/output contract;
* native names and aliases, actual Scope/Profile binding;
* required/optional capabilities with closed-world negotiation;
* declared effects and targets, with actual Provider capability verification;
* execution boundary and named Bridge where provider-backed;
* kernel-owned lifecycle, drain, cancellation boundary, result correlation;
* evidence/RUN digest, approval subject/time, policy generation, expiry and revocation state;
* per-call PA/Control/Grant, exact arguments/effect fingerprint, fresh recheck, and one-shot consumption.

These are explicit in `center-assembly-architecture.md:214-224,226-234` and the B-MCP contract (`M0-B-FAMILY-TARGET-CONTRACTS.md:145-149`).

**IMPLEMENTED today (schema/center).** `FamilyContributionInput` carries schema version, source/provider digests, names/aliases/profile requirements, contract digests, effects, execution route, lifecycle cancel boundary, result and Kernel obligations (`packages/runtime/governance-center/contribution-schema.ts:81-135`). Validation is closed-world and rejects unknown fields, bad digests, unknown capabilities, effect-without-execution, provider-backed contributions without a named Bridge, and non-Kernel obligations (`:143-149,288-325,365-425,427-467`). Registry dynamic origin lands `not_verified` (`packages/runtime/governance-center/registry.ts:41-52,132-145`); Kernel refuses it before approval (`packages/runtime/governance-center/kernel.ts:307-329`). Scope and definition identity are required at the kernel decision face (`kernel.ts:132-160,320-334`).

**IMPLEMENTED today (MCP mount).** Team setup filters configured servers by template/durable policy and reconciles the MCP surface (`packages/runtime/src/plugin/live/agent-bindings.mjs:2992-3024`); `mcp__` names are excluded from trusted-native harvesting (`:698-730`). This is mount/filter/identity defense, not external-effect enforcement.

**MISSING/only declared.** The schema accepts `effects.kinds` as arbitrary strings (`contribution-schema.ts:111-115,365-380`), and does not validate the MCP effect taxonomy, actual target semantics, evidence reference, expiry, policy generation, signer, or revocation record. No production DynamicSourceAdmissionRecord type/signing path exists. Lifecycle is shape-checked, not proven for real MCP stdio/HTTP cancellation/drain. Matrix M-12 remains `WIRED-NOT-ACCEPTED`/`NOT_VERIFIED`, with stdio confinement, dynamic revalidation, reconnect, hot replacement, revocation and auth identity untested (`TOOL-CAPABILITY-MATRIX-9b2.md:41-42,65`).

## 3. DynamicSourceAdmissionRecord and order

**DESIGN.** A newly discovered source is always UNKNOWN/NOT_VERIFIED and cannot execute. Only the existing authorized configuration authority signs an immutable record; Family, Registry and Kernel may not self-promote. The record binds source/server/endpoint/package identity and digest, Provider digest, native names, Scope/Profile, contract version, allowed capabilities, approving principal/time, evidence digest, expiry, policy generation, record version and revocation state; no plaintext credentials (`center-assembly-architecture.md:226-231`).

Promotion order is: discover/isolate → verify source, contract, Provider and Host seam → authorized configuration authority reviews/signs → Registry validates digest and emits candidate → every call still uses PA/Control/Grant; any source/Provider/Scope/Profile/contract/Host-pin change invalidates the old record and requires revalidation (`:232-233`). Revocation is: block new dispatch and mark revoked → increment generation/revocation epoch → invalidate caches/Bindings/unconsumed Grants → Provider drain/cancel → confirm terminal state or record UNCERTAIN; re-enable only with a new record (`:234`).

**IMPLEMENTED today.** Registry's `dynamic-source → not_verified`, Kernel `NOT_VERIFIED_SOURCE`, source digest/generation binding, scoped approval and revoke/tombstone behavior implement fragments (`registry.ts:132-145`; `kernel.ts:293-334`; `kernel.ts:220-234`). PoC-4b demonstrates late discovery refusal, same-name non-inheritance and beta admitted server-side execution, with the alpha positive gap disclosed (`dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/README.md:151-180`; `u4-g1f-sup-b-20261025/runs/g1fb-2026-10-25T14-34-41Z/summary-reeval.json:110-132`).

**MISSING.** No signer/authorized-config authority, immutable record, expiry/policy-generation fields, evidence digest binding, or exact promotion/revocation orchestration is wired into MCP. Kernel/Registry are not allowed to invent that ledger (`center-assembly-architecture.md:222,228-234`).

## 4. Can we continue with CORE PATCH BUDGET=0?

**VERDICT: `blocked-with-reason` for the full design; `executable-with-narrowing` only for an explicitly reduced claim.** The public seams are sufficient to continue identity/Scope/closed-world admission work: public scoped `tools.get`, `tools.schemas`, and events are observation seams (`governance-center/README.md:48-50`), PoC-4b proves pre-body unknown/same-name refusal, and the current MCP mount is a real public assembly point. However, the design requires actual external effects to be constrained by a confined provider or trusted remote/domain Provider. Current MCP code only mounts/reconciles and excludes `mcp__` from native trust; it does not constrain stdio file/network/process effects or HTTP remote effects, nor bind a signed DynamicSourceAdmissionRecord. The design explicitly says a missing body-before-effect seam is a `CORE_SEAM_BLOCKER` (`center-assembly-architecture.md:145-156,249-254`).

Therefore do **not** claim Alpha.5 external-effect control is complete. A narrow release may claim: “unknown/late/same-name MCP sources are denied until an explicit center binding; no remote isolation guarantee.” It must defer controlled MCP effects, resources and dynamic promotion until the named Bridge/Provider path is delivered and evidenced.

## 5. Minimal delivery plan (required obligations)

1. **PR-U7-CENTER (protected-set neutral):** define versioned effect-class vocabulary/contract, DynamicSourceAdmissionRecord (authorized signer, bound identity/digests, Scope/Profile, capability/effect set, evidence, expiry/generation/revocation), and connect Registry/Kernel invalidation to the required promotion/revocation order. Preserve `mcp__` default deny. Protected impact: center/registry/bridge interfaces only; `tool-admission/**`, `tool-dispatch/**`, `operation-permission/**`, `control/**` remain unchanged unless separately reviewed.
2. **PR-U7-MCP-BRIDGE (MCP class):** named MCP Bridge for stdio and HTTP. Stdio must use a real confined process/provider enforcing declared F/N/process effects; HTTP must use a trusted remote Provider/domain gate and explicit endpoint/redirect identity. Bind server ID + connection incarnation + transport/provider identity + raw tool name + schema digest + Scope. Add reconnect, same-name, drift, revoke, cancel/drain and UNCERTAIN tests. Matrix target: M-12 `mcp__<server>__<tool>`; release remains blocked until real Host evidence.
3. **PR-U7-MCP-RESOURCES (resource trio):** ordinary takeover adapter at the public resource registration/request-transit seam; per-call effects for `resources/list`, `resources/templates/list`, `resources/read`; bind concrete server/incarnation/method/cursor/opaque URI (URI is never an FS path). Matrix rows are explicitly separate static names and currently UNKNOWN (`TOOL-CAPABILITY-MATRIX-9b2.md:116-122`; `u4-g1f-sup-c-20261025/unknown-dispositions.json:514-586`).
4. **PR-U7-EVIDENCE:** rerun PoC-4b alpha-positive admitted→served, real stdio confined positive/negative, real HTTP/provider identity and remote-veto tests, resource trio, and dynamic re-entry/revocation. Update M-12 and the three resource rows only from pinned evidence; no fixture-to-product extrapolation.

## 6. Original Alpha.5 scope versus unified plan

Original Alpha.5 did include MCP as a required tool family, but only as a deferred PR7 external-provider/Bridge obligation: S0 M-12 says dynamic registration/retraction/re-registration/same-name closed-world Guard, stdio Confined Spawn and HTTP trusted remote Provider, with untested third-party server/resources/reconnect/revocation (`S0-SELECTION-MATRIX.md:60`; `alpha5-s0-pr0-pr8-implementation-plan.md:153-168`). The active matrix still records M-12 as PR1/PR4/PR7/PR8, `WIRED-NOT-ACCEPTED`, not release-ready (`TOOL-CAPABILITY-MATRIX-9b2.md:41-42,65`). The unified plan expands this into `AuthoritativeToolSources→ExpectedToolObligations` and dynamic-census work (execution-plan.md:95,131-136), while U4 classifies `mcp__` and the resource trio as REQUIRED bridge obligations, not a shipped guarantee (`dev/agent-workflow/evidence/u4-obligations-20261025/SUMMARY.md:10-23,34-49`). Thus MCP/external control was in Alpha.5's required release *claim*, but never closed in the original implementation; it was deferred to PR7/late U7 work, not left for a later alpha.
