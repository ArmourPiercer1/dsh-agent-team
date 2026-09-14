# Task B — multi-mcp live reconciler (agent-bindings.mjs) gate evidence

- branch: `task/multi-mcp-b-runtime` (worktree `.worktrees/multi-mcp-b-runtime`)
- base (rebase target): int `06427a7` (M1 — Task A merged + p4t6 pin 701); repo base for reporting = `b49f4239`
- owner file: `packages/runtime/src/plugin/live/agent-bindings.mjs` (ONLY source change)
- contract: `dev/agent-workflow/briefs/multi-mcp/00-contract.md` I4 (full), I9/I11/I12
- date: session of the M1+1 wave

## Change summary (I4 per-server live state)

1. `import { configuredMcpServers } from '../mcp-supply.js'` — the sole canonical
   MCP-supply read (I1); no other `config.mcpServer` / `config.mcpServers` read
   remains in the file (grep-verified).
2. `consumptionState` per-session shape →
   `{ instanceId, ref, modelView, mcpViews: Record<serverName, view>,
   mcpFibers: Map<serverName, fiber>, mcpActivationErrors: Map<serverName, string>,
   appliedRecordIds: Set }` (header + state doc comments updated).
3. `resolveConsumptionViews` returns `mcpViews` (Record; `{}` when zero
   configured servers — T12-H1 generalized); one
   `resolveDurableMcpFacet({serverName, ...})` call per configured server
   (resolver untouched — C4).
4. `applyBoundaryRecords(state, modelView, mcpViews)` — aggregates
   `modelView.pendingNextBoundary` ∪ every server view's pending into
   `appliedRecordIds` (Set dedupes shared-scope records).
5. `reconcileMcpSet(agentCtx, state, targetServerNames)` replaces
   `reconcileMcp(agentCtx, state, allowed)`; I4 timing 1–7:
   (1) target ⊆ configured else throw (structural guard);
   (2) deny-first: dispose mounted servers outside target (dispose error →
       observation, continue), clear their fiber+error entries; last-applied
       views kept (state doc semantics);
   (3) mounts = target − mounted, in CONFIGURED order;
   (4) port-null for a to-be-mounted server → throw
       `p6t6: the durable policy allows mcp server '<name>' but no mini-MCP
       port is configured (config.mcpServers port for '<name>')`;
   (5) mount via `agentCtx.plugin(mcpClient, {transport:'streamable-http',
       serverName, url:'http://127.0.0.1:<port>/mcp', headers:{},
       toolCallTimeoutMs:15_000, failOnStartupError:true})` — options VERBATIM
       from the old single-server path — `await fiber`, collect in a temporary
       set;
   (6) ANY failure this round (activation rejection OR the port-null throw):
       dispose all temp-set fibers, denied disposals NOT restored, record
       `mcpActivationErrors.set(failedName, msg)`, observation
       `p6t6: mcp activation failed [server <name>]: <msg>` (I8: server named),
       rethrow (fail closed — request never runs on a partial surface);
   (7) all success → commit temp set into `state.mcpFibers`, clear stale error
       entries.
6. Both call sites (agentSetup / request-boundary) compute the target
   verbatim per I4 §2.3:
   `templateAllowedNames = filterMcpServers(configuredNames, capabilities.mcp)`
   (selective) / `configuredNames` (legacy), then
   `target = templateAllowedNames.filter(name => mcpViews[name]?.allowed === true)`.
   - agentSetup: ONE `reconcileMcpSet` covers the whole target set, kept
     BETWEEN the A2C-2 pre-MCP snapshot and the coverage FINAL snapshot
     (classifier zero-change; ordering preserved).
   - request-boundary: always calls `reconcileMcpSet` when a server is
     configured (empty target = dispose-all path — durable tighten/deny
     converges per server); `state.mcpViews = mcpViews` per boundary.
7. `close()` iterates ALL session states and disposes EVERY fiber in each
   `mcpFibers` Map (then clears both Maps).
8. Fiber options, error/observation vocabulary (`p6t6: mcp ... [server <name>]`),
   and the config-error envelope (host's `TeamPluginError` via A's helper) are
   preserved; no new error codes invented.

## Gate 1 — grep self-check (single-value vocabulary extinct): PASS

```
$ grep -n "mcpFiber\b\|mcpActivationError\b\|\.mcpView\b" \
    packages/runtime/src/plugin/live/agent-bindings.mjs
<zero hits — exit 1>
```
(also: `grep -n "config\.mcpServer\b"` → zero hits — every supply read goes
through `configuredMcpServers`; raw output: `grep-single-value-extinct.txt`)

## Gate 2 — targeted vitest pairs (expected partial failures = C's GREEN): 

### 2a. `t4a-capability-wiring.test.ts` + `t12a-h1-nullable-mcp.test.ts`

- `t4a-capability-wiring.test.ts`: **27/27 PASS**
- `t12a-h1-nullable-mcp.test.ts`: 3/4 — **H1-2 FAIL (expected)**:
  `expect(memberView.mcpView).toBe(null)` → `AssertionError: expected
  undefined to be null` (the return field is now the `mcpViews` record; zero
  configured servers → `mcpViews: {}`, not a `mcpView: null` scalar).
  H1-1/H1-3/H1-4 PASS (boot + zero-mount behavior intact).
- **Classification: single-value assertion vs per-server reality** — C adapts
  (H1-2 → `mcpViews` deep-equal `{}`). NOT a logic regression.

### 2b. `p8s4b-mcp-facet.test.ts` + `t12a-b3-external-deny.test.ts`

- `p8s4b-mcp-facet.test.ts`: **11/11 PASS**
- `t12a-b3-external-deny.test.ts`: 3/4 — **B3-4 FAIL (expected)**:
  `deniedView.mcpView.deniedBy` → `TypeError: Cannot read properties of
  undefined (reading 'deniedBy')` (legacy scalar field; per-server form is
  `mcpViews[<name>].deniedBy`). B3-1/B3-2/B3-3 PASS (external hard-deny
  behavior intact).
- **Classification: single-value assertion vs per-server reality** — C adapts.
  NOT a logic regression.

## Gate 3 — `a2c2-permission-coverage.test.ts` (classifier zero-change): PASS

**18/18 PASS.** The A2C-2 coverage classifier and the
pre-MCP-snapshot → single reconcile → final-snapshot ordering are unchanged.
No DEVIATIONS entry needed for the brief's "若此测试在 B 树上失败" clause.

## Gate 4 — `pnpm --filter @dsh-agent-team/runtime typecheck`: PASS

exit 0 (`tsc -p tsconfig.json`; the `.mjs` glue is outside tsc's constraint —
this proves the TS surface is unbroken, per brief).

## Full-suite blast-radius run (beyond the required gates)

`pnpm vitest run packages/runtime/test` on the B tree:
**1818/1828 tests passed; 10 test-level failures + 3 file-level failures.**
Classification of every failure:

| Failure | Tree evidence | Class |
|---|---|---|
| t12a-h1-nullable H1-2 | new on B | single-value assertion (C adapts) — see 2a |
| t12a-b3 B3-4 | new on B | single-value assertion (C adapts) — see 2b |
| p8s3b-result-effects [file: agentPresets service absent] | **identical on int tip** (control run) | PRE-EXISTING — not B |
| t12a-b2-child-identity [file: capability template unresolved] | **identical on int tip** | PRE-EXISTING — not B |
| t12a-glue-handoff-ports [file: blueprint frontmatter] | **identical on int tip** | PRE-EXISTING — not B |
| d3 D3-4 (error text: capability template unresolved) | **identical on int tip** (same root cause as t12a-b2) | PRE-EXISTING — not B |
| p6t3-mediation ×5 (session identity / messaging) | **identical on int tip** | PRE-EXISTING — not B |
| p6t3-restart ×2 (messaging recovery) | **identical on int tip** | PRE-EXISTING — not B |
| p6t1-parallel ×2 (under full-suite load) | **9/9 PASS in isolation** on B tree | documented load flake (isolation 9/9 precedent) — not a regression |

Control run: the 6 non-MCP failing files run on the INT worktree
(`int/multi-mcp-quick-fix` @ 4ad989d = M1 bookkeeping, no B changes) fail with
the EXACT same test set (8 test-level + 3 file-level).
**No failure class is a logic regression.**

## Out-of-file consumer sweep (informational, no action)

- `resolveConsumptionViews` / `getConsumptionState` external consumers:
  `packages/runtime/test/p8s5a-stub-glue.mjs`, `t12a-h1-nullable-mcp.test.ts`,
  `t12a-b3-external-deny.test.ts` (all C-owned tests) + `types.ts` doc
  reference only. No runtime source outside agent-bindings.mjs consumes the
  old shape.
- `mcpFiber`-shaped hits in `member-residency/harness/slots-t6.mjs` /
  `root-binding/harness/slots.mjs` / `root-binding/harness/plugin.mjs` are
  standalone P2/P5 worlds with their own local variables — out of scope,
  untouched.

## Behavioral anchors (for the main agent's re-gate with C's tests)

- expert-1 → A only; expert-2 → B only; expert-3 → A+B; expert-4 → none
  (per-server target = template ∩ durable; expert-4's durable deny of both
  yields an empty target — zero fibers).
- denied server never exposed by another server's activation failure
  (deny-first dispose happens BEFORE any new mount).
- round failure → all NEW fibers of that round disposed (temporary set),
  denied disposals not restored, setup/boundary throws → request does not
  continue.
- cold resume: no special code — fresh per-boot state + first
  setup/boundary rebuilds the exact set from durable truth.
