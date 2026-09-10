# A6 — production wiring map (alpha.2, plan §11)

Frozen A1–A5 APIs → production composition points. Every arrow is a
composition (no re-implementation); the frozen sources are byte-unchanged.

## 1. The control-service reference (host → root → glue)

```
host.ts (createTeamProductionHost / the plugin factory)
  const controlServiceRef: { current: ControlService | undefined } = { current: undefined }
  │   a PLAIN object — the teamToolsRef pattern (one shared object, lazy read)
  ├──> glue.createAgentBindings({ ..., controlServiceRef })     (deps entry, OPTIONAL)
  └──> createTeamProductionRoot({ ..., controlServiceRef })     (REQUIRED param)

root.ts (createTeamProductionRoot, during construction — synchronous)
  const control = createControlService({ teamDomain, blueprintCatalog, externalPolicyFacts, now })   (A4)
  controlServiceRef.current = control        ← filled immediately after construction

agent-bindings.mjs (agentSetup — per agent, at boot/fresh-create/resume time)
  const service = controlServiceRef?.current
  if (permissionPolicy !== undefined):
     fail-closed check: service?.requestControl / .awaitControlDecision / .guardOperation all functions
       else → throw permissionControlUnavailable(sessionId, instanceId)
              (typed error.code = 'alpha2-permission-control-unavailable'
               + one 'alpha2-perm: permission-control-unavailable ...' observation row)
  installParameterPermissionListener(agentCtx, { controlService: service, ... })   (A5)
```

Ordering invariant: `boot()` runs only after construction returned, so in
production `.current` is always filled before any agentSetup reads it.
The lazy read (never at glue-construction time) is what lets a test world
fill the ref post-construction and still install — pinned by the a6a
world-5 leg.

## 2. The install decision (plan §11.1 — per agent, in agentSetup)

```
agentSetup(sessionId, instanceIdHint, templateIdHint, bindPath, childRoot)
  state = resolveConsumptionViews(...)                      (unchanged)
  boundTemplate = locateTemplate(sessionId, instanceId, templateIdHint, teamRootSid, bindPath)
  │   EXTRACTED from the old resolveStaticCapabilities (identical throw contract:
  │   blueprint-unavailable / template-not-found / template-id-missing)
  │   leader position → blueprint.leader template; member → the durable row's
  │   template (or the fresh-create hint window)
  capabilities = staticCapabilitiesOf(getBoundBlueprint(), boundTemplate)   (A1 projection — unchanged)
  permissionPolicy = boundTemplate.capabilities?.permissions
  │   FACT 3a: read DIRECTLY off the located (deep-frozen normalized) template —
  │   staticCapabilitiesOf deliberately does NOT project `permissions`
  │   (the alpha.1 pins its shape); undefined = absent = legacy/alpha.1 (no listener)

  ... existing alpha.1 wiring (model selection, presets, builtin deny, team tools,
      skills, persona, MCP, boundary records) ...

  if (permissionPolicy !== undefined):
     installParameterPermissionListener(agentCtx, {
        policy:            permissionPolicy,                            (A1-normalized policy)
        resolveTarget:     <lazy cwd closure — see §4>,
        controlService:    <ref.current, fail-closed checked>,          (A4)
        rootSessionId:     teamRoot,
        │   teamRoot = teamRootSid !== undefined ? String(teamRootSid) : rootSid
        caller:            { kind: 'instance', instanceId: state.instanceId },
        targetInstanceId:  state.instanceId,
        │   instanceId from resolveConsumptionViews: the LEADER position resolves
        │   to 'inst-leader' (instanceIdForSession), a member to its durable row id
        isLeader:          sessionId === teamRoot,
        │   → A5 requestKind = isLeader ? 'user-approval' : 'leader-approval'
        onObserve:         row => observations.push('alpha2-perm: ' + JSON.stringify(row)),
     })
     toolDisposers.push(disposePermission)
     │   lifecycle-owned: close() drains toolDisposers (function disposer);
     │   a cold resume re-runs agentSetup on a FRESH ctx → reinstall
```

## 3. The frozen pipeline (A5 — unchanged; composed, not reimplemented)

```
tools/pre-execute (per agent ctx)
  classifyPermissionTool(name)          (A2)  unsupported → next() pass-through
  canonicalizeOperation(...)            (A2)  any OperationPermissionError → deny
  resolveOperationPermission(...)       (A3)  allow → next() | deny → deny | ask →
     ask: requestControl → awaitControlDecision → guardOperation   (A4, exact
           scope + operationFingerprint, check-and-reserve) → allow → next()
  NEVER returns 'ask'; every non-allow outcome fails closed (zero-effect)
```

## 4. The lazy cwd closure (FACT 3b — the A6 seam)

```
resolveTarget = async (path) => {
  const cwd = agentCtx.agent?.session?.header?.cwd      ← read AT RESOLVE TIME
  const target = await agentCtx.fs.resolve(path, typeof cwd === 'string' && cwd !== '' ? { cwd } : {})
  return { key: String(target.targetKey), display: String(target.displayPath) }
}
```

- `ctx.agent` is the upstream agent-scoped back-reference (Agent.ctx shadows it
  with its own property — the DX accessor the upstream file tools use for the
  same `session.header.cwd` read).
- LAZILY read (per call), never captured at install: the a6a lazy-cwd leg
  rewrites `header.cwd` between two drives of the SAME installed listener and
  pins the resolver's recorded cwd + two distinct canonical keys/fingerprints.
- The seam is a plain function — A5's R2 rule-key cache caches exact-rule
  keys (install-owned), never the cwd.
- DEVIATION from the A5 handoff note ("captured at install (R1)"): documented
  in the A6 report §Design rulings; the lazy read is strictly more correct
  (a resumed/updated header stays authoritative) and the seam's basis matches
  the upstream file tools.

## 5. Diagnostics (the existing binding observation surface)

- `onObserve` rows → `alpha2-perm: <compact JSON>` appended to the binding's
  existing `observations` array (the established `p6t6: ...` / `alpha1: ...`
  style). Stages: canonicalized, decision, request-created, request-failed,
  decision-arrived, guard-verdict. Small records (stage + callId + ids), no
  tool payloads.
- The fail-closed ref failure also emits one observation row before it throws
  (never silent).

## 6. The test bridge (t12a-live-bridge — additive only)

| Addition | Where | Purpose |
| --- | --- | --- |
| `makeFakeFs()` | bridge `.mjs` | deterministic pure path resolution (absolute as-is; relative joined onto `cwd`; `..` collapsed) recording every `{ path, cwd }`; the `ctx.fs.resolve` seam double the `resolveTarget` closure consumes |
| `agent.session = { id, header: { cwd } }` | handle factory | create: `meta.cwd` (the boot default workspace); resume: `<WORKTREE_ROOT>/fixture-ws/<sessionId>` — the `header.cwd` is MUTABLE on purpose (lazy-read proof) |
| `ctx.agent` back-ref | handle factory | the `ctx.agent.session.header.cwd` read basis (FACT 3b) |
| `ctx.fs` | ctx double | per-agent fake fs (separate recorder per agent) |
| `controlServiceRef` option + world field | `createLiveWorld` | passed through to the glue verbatim; the SAME object returned on the world (tests fill `.current` post-construction to pin the lazy read) |
| `FakeFsDouble` + type surface | `.d.mts` | the tsc mirror of the above |

## 7. What did NOT change

- `packages/runtime/control/**` (A4) — byte-unchanged (read-only).
- `packages/runtime/operation-permission/**` (A2/A3/A5) — byte-unchanged
  (read-only; composed via the barrel import).
- `packages/domain/**` (A1) — byte-unchanged (the blueprint parse/normalize
  surface that produces the deep-frozen policy).
- The alpha.1 capability wiring order and behavior inside `agentSetup` —
  untouched (the absent-permissions legs + t4a 27/27 are the proof).
- The upstream DSH source — untouched (CORE PATCH BUDGET = 0).
