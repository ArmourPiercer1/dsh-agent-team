# Alpha.5 Tool I/O Governance — Architecture Design (Draft for P0)

**Date:** 2026-10-14
**Status:** Design draft. Governance intent accepted in [ADR](./ADR-alpha5-tool-io-governance.md); execution wiring **unproven** until P0. No implementation/preset/schema migration performed.
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
