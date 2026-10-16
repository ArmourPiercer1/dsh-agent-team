# Alpha.5 Tool I/O Governance — Architecture Design (Draft for P0)

**Date:** 2026-10-14
**Status:** Design draft; [ADR](./ADR-alpha5-tool-io-governance.md) §8 and V2 addendum below supersede obsolete route/coverage descriptions. Execution wiring **unproven** until P0. No implementation/preset/schema migration performed.
**Scope:** ONLY tools, native adapters, I/O restrictions, custom adapters and Linux shadow-run. Other Alpha.5 work deferred to other documents.
**Current production baseline:** Team pins DSH `0.2.0-rc.2`; investigate newer Core features without silently switching support.

## 1. Decision record and boundary

Tool governance is **preset-scoped**. A Team's selected preset supplies the tool surface; Blueprint registers every visible `(owner, toolName)` as allowed/asked/denied. A configured `deny` counts as covered; a tool not present in that Team's effective preset is not governed merely because the Host installed it. After valid binding, tools default to the **trusted provider** model. Team does not inspect private implementations for business correctness. Full tool owner attestation is a future Core seam, not an Alpha.5 guarantee.

Read/write/network policy is independent of tool permission and existing Alpha.4 human/Leader/member review authority. Alpha.4 `teamHardEnvelope` and `permissionMutationEnvelope` remain lifetime-bound on the present schema. New I/O fields are **future proposed vNext schema**, not valid Blueprint v3 today.

## 2. Desired execution flow

```text
Preset-bound Agent + model tool request
  -> DSH ToolRuntime (scoped identity, exact immutable arguments)
  -> Team coverage / tool-level policy / I/O policy
  -> Alpha.4 ApprovalCase for any tool or I/O ask; no body launched yet
  -> last-mile permission + token/fingerprint + capability revalidation
  -> monotonic Team guard (including unmanaged/scope drift)
  -> approved ExecutionRoute:
       native      -> maintained DSH capability adapter
       custom      -> author/deployer's registered trusted adapter (exclusive)
       shadow-run  -> OS-limited independent subprocess launcher (exclusive)
  -> one normalized DSH ToolResult + scoped audit facts
```

**Warning:** Ordering above is logical. Current Core executes `tools/pre-execute` then `guard` then `tools/execute` and resolves `ToolDefinition.execute()` internally. A `tools/execute` callback must not be assumed to support safe alternate ToolDefinition dispatch; P0 shall investigate *registered proxy ToolDefinition on Agent scope*, trusted service seam replacement, and/or other public, lifecycle-safe alternatives. Nothing proceeds to main implementation until P0 proves no alternate body can execute.

## 3. Proposed contract data shapes (non-executable examples)

```yaml
# Proposed illustration; CURRENT Blueprint v3 DOES NOT ACCEPT this structure.
toolBindings:
  - owner: dsh.shell
    name: bash
    authorization: ask
    io:
      read:
        mode: restricted       # all | restricted
        allow: ["."]
        ask: ["~/datasets"]
        deny: ["./secret"]
      write:
        mode: restricted
        allow: ["./out"]
        ask: ["./src"]
        deny: [".git"]
      network:
        mode: deny             # allow | restricted | deny
    execution:
      kind: native
      adapterId: native.shell
  - owner: vendor.solver
    name: solver
    authorization: allow
    io:
      read: { mode: restricted, allow: ["."] }
      write: { mode: restricted, allow: ["./out"] }
      network: { mode: allow }
    execution:
      kind: shadow-run
      runnerId: solver-cli
```

`ExecutorBinding = native(adapterId) | custom(adapterId) | shadow-run(runnerId)`. Identifiers refer to already-installed trusted host registry entries, not author-supplied executable JS embedded in a Blueprint. `authorization` is independent from `io`. Effective policies must be fully populated after inheritance; omitted values do not expand to full access. Choose concise schema and inheritance at design integration, without adding a new authorization ladder.

## 4. File-system semantics

- `read` and `write` support `mode=all | restricted` with `allow/ask/deny` path rules. Under `restricted`, unspecified resources are denied; `all` starts from underlying execution identity's reachable resources, then overlays explicit exclusions. Define structural policy defaults explicitly and reject unresolved ambiguity.
- Accept relative paths only inside the immutable bound workspace root. `.` denotes root subtree; reject any `..` segment for relative paths, not just escapes after lexical collapse. Absolute paths are intentional outside-workspace grants; `~/...` is an explicit home-anchored expression resolved by the trusted execution-world provider. Do not use shell expansion or agent-controlled `HOME` for security decisions. An agent's changing active cwd does not mutate its policy anchor.
- Canonicalize **where the tool runs**; enforce against the same object identity used by the actual open/spawn, not raw string-prefix checks. Prevent directory-name prefix confusion, symlink/junction escapes, symlink races (openat2/OS sandbox or equivalent), mount/hardlink alias surprises and already-open descriptor bypass. Deny must apply to equivalent absolute and relative spellings.
- Preserve legal leading/trailing whitespace in paths; invalid or ambiguous characters should cause an explicit error. Never silently normalize one legitimate filename into another (`NRM-1`).
- The read set includes content, listing and metadata observation; the write set includes creation, deletion, renaming, link and relevant metadata mutation. This is **resource access**, not information-flow taint: data copied legally into an allowed path can later be accessed there.
- A confined subprocess requires an explicitly documented **trusted execution runtime base** (interpreter, libraries, devices), distinct from Blueprint business-data mounts. Do not accidentally expose host home or unrelated project data as a dependency convenience.

## 5. Network semantics, intentionally delegated

- `allow`: no Team network-destination restriction.
- `deny`: actual tool execution cannot establish prohibited network communications. Required Host/LLM/Control-plane communications are outside the tool sandbox and must continue normally.
- `restricted`: allow and deny named endpoints; ask for explicit endpoints **before execution**; allow optional `default: ask | deny` for unmatched targets. No on-connect interactive approval. Provider may support DNS names, IP/CIDR, port, protocol and local connections, but it must accurately declare granularity; Team does not implement DNS/proxy/TLS parsing or a general network-security engine.
- `network: restricted` requires an installed capable NetworkPolicyProvider for the selected native or shadow-run route. Absent/unsupported -> typed refusal, never silently allow. Alpha.5 Linux shadow-run minimum guarantee is basic `allow/deny`. Loopback and host-local resources are not automatic unrestricted exceptions; IPv4/IPv6, proxy, Unix socket, inherited FDs and WSL interoperability must be addressed in the chosen execution provider's threat model.
- An allowed network destination is a reachable destination, **not** a promise about HTTP URL paths, downstream data leakage, redirect safety or remote server behavior. These are not universal Team guarantees.

## 6. Approval and effective grant

All requested additional read/write/network access is collected BEFORE starting the tool body. No retry after a partial command by default. Each approved grant should be scoped to the Team root, Member instance, bound Blueprint authority generation, tool binding, full execution arguments/fingerprint, approved resource deltas and one execution. Before start, revalidate no relevant authority/identity state became stale; use Alpha.4 durable ApprovalCase rather than invent a new hierarchy. Approval of I/O access is not a standing permission mutation, and Core's sandbox escalation cannot override Team denial. Job/child process lifetime retains its fixed grant while running; require cancellation/drain and no unrelated caller reuse.

Existing Alpha.4 execution check/reviewer structure is the authority model; plumbing and security evidence are developer requirements, not invitations to add a higher reviewer tier.

## 7. Route guarantees and provider capability honesty

| Route | Registered executable | Assurance | Owner of correctness |
| --- | --- | --- | --- |
| `native` | maintained DSH tool capability adapter | Tested I/O semantics for explicitly supported tools/operations | Team |
| `custom` | author-owned, host-registered trusted adapter | Team guarantees **mandatory adapter routing** and honest provenance, not internal security | Blueprint author/deployer |
| `shadow-run` | host-registered independent argv/runner | OS-enforced policy before spawn; no escape to original tool body; unsupported policy => refuse | Team for sandbox boundary; author for tool/runtime completeness |

Custom adapters consume a minimal `ToolInvocation` + immutable `EffectiveIOGrant` + `AbortSignal` and return the host-standard result. No repeated execution; no silent fallback to original `execute()`. Adapters themselves must not be arbitrarily uploaded via Blueprint YAML. The Team registry is a trusted composition boundary and should report which route was actually selected (`native-enforced`, `custom-author-trusted`, `shadow-enforced`). Assurance fields are diagnostics, not authority grades.

### Shadow-run is NOT transactional shadow execution

`shadow-run` means a **restricted subprocess launcher**. For an approved writable bind, writes can reach the real allowed workspace immediately. No automatic rollback, Copy-on-Write overlay, checkpoint, post-run diff gate or transactional commit. The Runner author supplies a stand-alone executable, CLI wrapper or subprocess-accessible endpoint plus dependencies; no promise that arbitrary JS `ToolDefinition.execute()` can run isolated. A command failing due to missing libraries is a functional failure; a sandbox failing to enforce the requested limits is a **pre-spawn refusal**.

## 8. Native tool-family coverage proposal

| DSH native surface | Initial enforcement integration |
| --- | --- |
| `read`, `read_image`, `write`, `edit` and applicable `str_replace_editor` | Use trusted filesystem operations; enforce matching `read/write` target set and containment. |
| `glob`, `grep` | Isolated/search provider, not post-filtered unrestricted ripgrep; current upstream uses plain subprocess spawn. |
| `bash` (Linux), `pwsh` (future native parity) | Restricted subprocess using approved filesystem view + network mode; child processes inherit confinement. |
| `lsp`, `web_fetch`, `web_search`, `run_code`/PTC, job controls, Team/MCP operations | Classify actual tool effect and capability; adapt if provable or refuse strict unsupported operation. Do **not** imply all DSH-native tools are automatically covered. Nested native tools still require Team gating. |

Native-adapter minimal completeness for Alpha.5 shall be derived from the supported preset and explicit gate matrix. Every exposed tool needs a policy entry; this does **not** mean every conceivable native/tool-backend policy combination is supported. An `IO_POLICY_UNSUPPORTED` classification is legitimate only where its invocation fails closed and is honestly disclosed.

## 9. Mandatory P0 spike before committing to tool routing

Build minimal real-Host fixtures: (1) native file tool; (2) trusted in-process custom ToolDefinition; (3) stand-alone executable Shadow-run; (4) PTC nested native call, plus foreground/background shell case. Test under the **currently pinned** DSH Host, then optionally separately under newer DSH; never claim results from the newer Host as evidence of the pinned baseline.

Acceptance requirements:
1. Preset tool surface and strict coverage verified at the actual effective scope, including explicit deny; unknown/new scopes fail before execution.
2. Every active call hits one gate and monotonic denial; a deliberately short-circuiting `pre-execute` listener cannot bypass it.
3. Exactly one of the three selected executor paths runs; deliberately instrument original body and prove it is **never** called outside the chosen path, including adapter errors, cancellations and retries.
4. Approval completed before any tool effect, exact grant consumption, stale policy/args denial.
5. PTC sub-dispatch, background job completion and scoped registration do not introduce bypasses.
6. Native read/write/search/shell cases deny disallowed file paths; Linux shadow-run denies unauthorized network and read/write accesses at syscall level (not just output filtering), including symlink escape, process children and inherited handle paths.
7. Clear `IO_POLICY_UNSUPPORTED`, `SANDBOX_UNAVAILABLE`, `TOOL_BINDING_UNVERIFIED` (where identity truly unknowable), `APPROVAL_STALE` and `EXECUTION_ROUTE_UNAVAILABLE` diagnostics; these names are **proposed**, not current shipped codes.
8. Test sandbox invocation and test-use pristine checkout remain clean; do not touch the stable `:3080` DSH instance or homes. Respect `docs/TEST_METHODS.md` and frozen 2026-08-29 architecture.

P0 results: **GO** public, mandatory routing seam works; **BLOCK** cannot prevent original body; **BOUNDED DEFER** only for specifically unsupported native combinations when calls fail closed. On BLOCK write a reproducible `CORE_SEAM_BLOCKER` rather than patching upstream.

## 10. Work packages after P0 (proposal, not yet authorized plan)

P1 coverage policy migration (replace A2C2 classification with Blueprint declaration + actual per-tool policy enforcement); P2 native FS/search/shell adapters; P3 custom AdapterRegistry and exclusive dispatch; P4 Linux shadow-run with read/write/network allow/deny; P5 ApprovalCase and nested/cancellation/lifecycle integration + independent adversarial tests. Parallelize only after P0 contracts freeze. Network restricted providers are separately installable; absence must not prevent permissive or full-network-denied tools from working.

## 11. Security matrix and intentional limitations

| Negative case | Expected behavior |
| --- | --- |
| Preset exposes unregistered tool | start refused |
| Registered `deny` tool | no body |
| Ask not approved or grant stale | no body |
| `read: restricted` escapes anchor via `..` / symlink | refused before data access |
| `read` deny path masked by broad allow | deny wins at same policy level |
| Bash/rg reads forbidden file | OS-enforced refusal |
| Network deny program connects (including subprocess child) | refused |
| Provider lacks requested restricted-network implementation | `IO_POLICY_UNSUPPORTED`, no spawn |
| Runner environment missing libraries | tool failure; no security claim breached |
| Runner cannot establish sandbox | fail closed, no direct-process fallback |
| Custom adapter ignores grant internally | **author-trusted security limitation**; Team does not falsely claim independent confinement |
| Unknown dynamic tool or mismatched known binding | refuse affected call; no unvalidated implicit execution |
| Replayed grant / changed args | stale/deny |
| Inherited file descriptors, sockets, WSL interop | provider-specific audit; no blanket assurance |
| Host itself performs LLM or bookkeeping I/O | outside per-tool policy; preserve host availability |

**Legacy debt touched by this project:** TM-1..TM-9 coverage failures, NRM-1 whitespace, PM-1 Exec/overlay edge, Blueprint unsafe structural inputs and tool-bound identity drift. This plan does **not** quietly mark unrelated Alpha.4 debt resolved.

## 12. Explicit deferred decisions

Full provider owner authentication; freeze preset+Blueprint actual implementations vs untrusted third-party Worker; complete Windows/macOS parity; arbitrary third-party process migration; complex IP/DNS application-layer access; Shadow Execute COW/rollback; dynamic Blueprint governance evolution. Separate Alpha.5 goals (Member UI, Blueprint editor, Core reuse inventory, Team Tab, rename) will be addressed later.

## 13. Reference anchors

- Team `packages/runtime/operation-permission/permission-coverage.ts` and `pre-execute-adapter.ts` are the current A2C2 / Alpha.4 baseline, not the target general policy.
- DSH `docs/subsystems/tools.md`: the tool pre-execute/guard/execute pipeline and scoped tool registration.
- DSH `packages/fs/tool-fs-search/src/search-core.ts`: current unconstrained ripgrep `ctx.subprocess.spawn`.
- DSH `packages/sandbox/sandbox-local/src/profiles.ts`: current Linux workspace-write/bwrap profile, **not** read-confinement.
- Team Alpha.4 ADR/spec, `docs/TEST_METHODS.md`, `docs/ROUTER_RULES.md`, and `AGENTS.md` govern implementation constraints.

---

## 14. Alpha.5 V2 — controlling architecture addendum (2026-10-16)

This addendum controls where the original sections 1–13 conflict. It retains all earlier non-conflicting safety rules and deferrals. See the revised [ADR §8](./ADR-alpha5-tool-io-governance.md) and [tool-fork debt register](./tool-fork-debt.md).

### 14.1 Five responsibility boundaries, one Team permission authority

- **Binding:** final DISPATCHABLE surface (including PTC inner calls, Team tools, MCP and scoped registrations), scoped Member identity, trusted deployed Provider binding. A model-visible PTC `run_code` schema is not the full dispatchable set. Explicit denial fulfills binding coverage. Detected drift blocks affected calls.
- **Admission:** single logical permission judgment for Tool invocation + file read/write + network. The constraints are orthogonal, but Team asks are aggregated into one immutable `RequestedEffectSet` and routed through the EXISTING Alpha.4 ApprovalCase; each effect retains its own matcher and envelope ceiling. The reviewer must lawfully cover ALL requested effects. An unknown authority or definite denial refuses the whole invocation; no automatic truncation or partial execution.
- **Execution grant:** exact one-dispatch approval bound to Agent/MemberInstance, Blueprint authority generation, tool binding, argument fingerprint, execution realm, requested effect set and consumption identity. Ordinary static allow needs no new durable ledger. Child dispatch is checked independently and cannot exceed the parent fixed scope. Long-running jobs additionally declare an `ExecutionLifetime` (process/children, duration, cancel/revocation guarantees). One-shot grant never promises job rollback or immediate cancellation.
- **Enforcement:** controlled FS for trusted in-process DSH file operations; confined process for subprocess-backed ripgrep, Bash/pwsh, PTC and LSP, including actual read restriction, write restriction and any promised network rules. External Web/HPC/MCP and domain operations must be checked by the actual remote or trusted Provider; a local process sandbox has no power over remote effects. All required enforcement is DERIVED from the effective policy; do not let optional assurance declarations weaken it.
- **Domain authority:** trusted binding references the actual domain gate and its independently enforced object/state/business authority. Research state versioning/CAS, HPC job rights and equipment safety interlocks are examples. The gate must be rechecked at the actual domain effect boundary; Team approval does not override domain denial and a domain permit does not override Team denial. No new generic Team reviewer rung, domain-policy database or super-envelope.

### 14.2 Actual V2 execution sequence

```text
Team Agent assembly / detectable registration drift:
  compose preset + Team + scoped + MCP + PTC-dispatchable tools
  -> validate complete governed binding + required implementation capabilities

Each call:
  DSH ToolRuntime (actual Agent identity + immutable arguments)
  -> binding and authority-generation check
  -> compile canonical RequestedEffectSet in target Execution Realm
  -> Team admission (tool + file read + file write + network)
     -> deny/unknown: no body
     -> ask: one Alpha.4 ApprovalCase, every effect must be lawfully approved
     -> allow: proceed
  -> derive immutable, single-dispatch OperationGrant
  -> domain pre-authorization if applicable; match enforceable provider capabilities
  -> last-mile grant/identity/args/binding/abort revalidation
  -> monotonic end-cap guard + exactly one guarded dispatch
  -> controlled FS / confined process / delegated trusted provider
  -> domain gate again at actual effect commit where required
  -> normalized ToolResult + existing control facts and scoped execution evidence
```

Only one logical Team decision exists; preflight, last-mile guard and OS/provider confinement enforce different aspects of that SAME decision. Remote domain refusal and non-transactional execution remain distinct result classes. Under PTC, inner native dispatch is NOT automatically authorized by the `run_code` outer approval. A general-purpose script obtains a bounded sandbox scope *before start*, not automatic interactive escalation on every file fault.

### 14.3 Three orthogonal execution axes

| Axis | Values / ownership | Meaning |
| --- | --- | --- |
| `implementationOrigin` | DSH-native / Team or trusted-extension / standalone runner / remote provider | Who supplies the business implementation; does NOT imply isolation |
| `executionBoundary` | trusted Host / confined process / delegated remote | Where the real effects occur |
| `assurance` | per capability, Team-enforced / provider-enforced / author-trusted / unsupported plus verifiable scope | Who actually guarantees file read, write, network, subprocess and cancellation limits |

`native`, `custom` and `shadow-run` in the original proposal are historical routes, **not** V2 mutually exclusive permissions. An independently registered native-tool adapter may start a confined process. A third-party standalone runner may use the same confinement. `shadow-run` always means a REAL isolated process, not a speculative COW/transaction/rollback execution.

### 14.4 File/realm assurance closure

For each file/network permission, derive required enforcement by comparing the effective policy to the default access of the actual execution identity. A permissive `all` policy does not confer extra OS privilege. `restricted` file read/write and network limitations are mandatory to enforce; a provider that only supports write filtering cannot be selected for restricted reads. A generic binary-presence check (`bwrap` installed) is insufficient: use bounded functional probes and enforce the exact compiled policy before execution. Report the actual mechanism and per-capability coverage; unsupported means typed refusal, not a silently weaker launch.

Relative paths anchor to the bound immutable Workspace IN THE ACTUAL REALM; `~/` uses the trusted execution identity's home IN THAT REALM. Equal path strings on two hosts do not imply equivalent resources. Reject relative `..`, preserve meaningful path whitespace, prevent alias/rename/symlink/mount/FD bypass to the extent required by the advertised guarantee. File READ includes content, list and metadata observations; WRITE includes create, replace, delete, rename, link and metadata mutation. Mixed read/write commands (e.g., edit; write results exposing old content) need the permissions of their true effects or must suppress forbidden disclosures. Runtime binaries/libraries/paths are a separately identified trusted execution base, not an implicit all-host-business-data read grant.

### 14.5 Native-tool handling matrix (supported capability proposals, not proven deployment)

| DSH tool | Primary actual I/O | V2 control / isolation |
| --- | --- | --- |
| `read`, `read_image`, `write`, `edit` | `ctx.fs` operations | Team-aware Controlled FS at the real I/O boundary; no extra process sandbox. Include hidden reads/returned old content, actual target identity and intent/version checks. |
| `str_replace_editor` | `ctx.fs` read/list/write/edit | Controlled FS with subcommand-specific effective read/write scope; no additional process sandbox. |
| `glob`, `grep` | packaged `ripgrep` via plain `ctx.subprocess.spawn` | Confined Spawn around the **actual rg process**. Preserve upstream parser/result semantics; no post-filter as substitute for read isolation. |
| `bash`, `pwsh` | `ctx.shell` then subprocess | Sandbox-bound Shell Executor / Confined Spawn; command and descendants constrained; Windows strict read parity is not assumed. |
| `run_code` / PTC | managed Node subprocess plus nested tools | Apply the enhanced restricted-process policy for direct Node file/network effects; every nested ToolRuntime dispatch independently admitted and parent-scoped. |
| `lsp` | `ctx.lsp`, file reads plus persistent language-server subprocess | Controlled host source reads AND confined language server process, with policy-compatible process lifetime and rebind/restart on scope change. |
| `web_fetch`, `web_search` | `ctx.web` provider | Network Provider/effect gateway, no pretend OS confinement of remote server; endpoint grammar explicit. |
| `job_list`, `job_output`, `job_kill` | `ctx.jobs` | Job ownership and OperationGrant/Lifetime controls; no new OS process sandbox for the controller itself. |
| Team, todo, orchestration tools | trusted Team/session services | Ordinary Team governance and explicit delegation constraints; no automatic sandbox for trusted Host code. |
| MCP/remote/HPC/research/equipment | actual local process, in-process or remote provider | Bind the true execution boundary; remote domain/equipment effects governed at remote domain gate. No universal local-sandbox guarantee. |

Current pinned DSH `fs-sandbox` fences writes but leaves reads unrestricted; current Linux bwrap profile read-only binds `/` and therefore does NOT meet restricted business-file read policy. Both require stronger policy-aware providers. The existing `glob/grep` process spawn is unconfined, even when a shell sandbox is installed. These facts are motivations for Controlled FS and Confined Spawn, not proof that all combinations are implementable.

### 14.6 Adapter-first and conditional tool-level fork — default fallback

**Priority:** (A) independently register a Team-owned adapter through public DSH scope-safe tool/service seams. For a given native tool, P0 must instrument original `ToolDefinition.execute()` and demonstrate that every Team-controlled call reaches the adapter exactly once, and that no original body runs on error, denial, nested dispatch, cancellation or retry.

**Fallback only after proof:** if minimum public-seam repro establishes `CORE_SEAM_BLOCKER` (not merely greater implementation effort), (B) use a narrow **independently registered downstream fork of that native TOOL implementation** as the pre-approved default fallback. It may copy only the minimum necessary upstream TOOL code, preserving names/schema/errors/results, under Team-owned source and clear version/license provenance. It must not patch DSH Core or the upstream checkout, import private APIs, silently override deployment-global tools, or weaken safety on fallback. If even the tool fork cannot route exclusively, refuse and report blocker; fork is not a universal bypass around unexposed Core control points.

The user-ratified exception is limited to modified TOOL code needed for independent registration and **does not repeal** the broad repository redlines. A fork actually used is recorded as a named technical debt with upstream SHA, patch/delta, compatibility and security-update owner, parity and adversarial tests, exit owner, and a required removal gate after DSH exposes equivalent PUBLIC seams. See [tool-fork debt ledger](./tool-fork-debt.md). As of this memo, no fork debt is incurred; P0 remains unproven.

### 14.7 P0 gates and explicit remaining non-claims

- Verify actual **dispatchable**, not only model-visible, Team scope in native/hybrid/PTC modes, including nested and newly registered tools.
- Verify whole requested effect set approval authority against Alpha.4 `teamHardEnvelope` / `permissionMutationEnvelope`, with mismatched, missing and changed resources failing closed.
- Verify controlled FS read/write/metadata and write-result disclosure; confined rg/shell/PTC/LSP read/write/network effects and child escape negatives; environment base readability without arbitrary host-home access.
- Verify exactly-one-body routing (both standalone adapter and tool-fork candidate when triggered), monotonic guards, nested PTC, jobs, cancellation and cold resume; no fallback to original body.
- Verify trusted Domain Gate binding and final-effect refusal even after Team approval; no modeled actor can override the domain result by choosing different tool arguments.
- Verify long-lived job scope and cancellation semantics; cancellation requested is not guaranteed terminated.
- Keep user-facing schema vNext, provider trust attestation, exact domain identity plumbing, restricted-network endpoint grammar, full Windows parity, and implementation-specific sandbox internals explicitly pending separate design/P0 contracts. Never present them as Alpha.4 shipped behavior.
