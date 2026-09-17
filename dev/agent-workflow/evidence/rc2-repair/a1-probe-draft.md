# A1 probe patch draft (working note — applied at the A1 phase, on the int tree AFTER A2)

Plan §9. Three temporary instrumentation sites, ONE commit (evidence-only,
deletable). Probe lines go to the host process stderr → captured in the
kit instance.log. The kit (rc2-real-host-smoke.mjs) is the live-repro
harness (plan §10): blueprint B carries allow read subtree team /
deny read subtree runtime / ask bash any.

## Site 1 — packages/runtime/src/plugin/host.ts, fsBackend() (~L798-810)

After `const svc = ctx.get('fs') as …`:

```ts
// RC2-A1 probe (TEMPORARY — removed with the probe commit):
// the live fs service identity + seam presence, once per process.
if (globalThis.__RC2_A1_FS_PROBE__ !== true) {
  globalThis.__RC2_A1_FS_PROBE__ = true
  console.error(JSON.stringify({
    probe: 'a1-fs-backend',
    constructorName: svc?.constructor?.name ?? null,
    resolveType: typeof svc?.resolve,
    containsType: typeof svc?.contains,
  }))
}
```

(Read-only; no sensitive data; once-per-process to keep the log readable —
fsBackend() is per-call lazy.)

## Site 2 — packages/runtime/src/plugin/live/agent-bindings.mjs, containsTargets (L1563-1572)

Wrap the body:

```js
const containsTargets = (parent, child) => {
  // RC2-A1 probe (TEMPORARY — removed with the probe commit):
  const backend = fsBackend(agentCtx)
  const targetInfo = (t) => ({
    targetKey: t && typeof t === 'object' ? (t.targetKey ?? null) : null,
    displayPath: t && typeof t === 'object' ? (t.displayPath ?? null) : null,
  })
  console.error(JSON.stringify({
    probe: 'a1-contains-call',
    backendType: backend === null || backend === undefined ? String(backend) : (backend.constructor?.name ?? typeof backend),
    hasContains: typeof backend?.contains === 'function',
    parent: targetInfo(parent),
    child: targetInfo(child),
  }))
  if (typeof backend.contains !== 'function') {
    // RC2-A1 probe: the throw itself, verbatim (error.name/message/stack).
    const err = new Error('the fs provider does not expose a public contains() seam (alpha.2 subtree containment undeterminable)')
    console.error(JSON.stringify({
      probe: 'a1-contains-throw',
      errorName: err.name,
      errorMessage: err.message,
      errorStack: err.stack,
    }))
    throw err
  }
  try {
    return backend.contains(parent, child)
  } catch (error) {
    // RC2-A1 probe: a contains() FAULT (Branch B evidence), verbatim.
    console.error(JSON.stringify({
      probe: 'a1-contains-fault',
      errorName: error?.name ?? null,
      errorMessage: error?.message ?? null,
      errorStack: error?.stack ?? null,
    }))
    throw error
  }
}
```

(No semantics change: same throw conditions, same propagation; the
adapter's catch keeps treating a fault as containment-undeterminable.)

## Site 3 — packages/runtime/operation-permission/pre-execute-adapter.ts,
reportFailure closure (L806-808)

```ts
const reportFailure = (failure: RuleCanonicalizationFailure): void => {
  // RC2-A1 probe (TEMPORARY — removed with the probe commit): the exact
  // cause with lane / tool / rule path / operation display.
  console.error(JSON.stringify({
    probe: 'a1-canonicalization-failure',
    lane: laneName,
    tool,
    cause: failure.cause,
    ruleKind: failure.kind,
    rulePath: failure.path,
    operationKind: operation.resource.kind,
    operationDisplay: operation.resource.display ?? null,
  }))
  failures = failures === undefined ? [failure] : [...failures, failure]
}
```

## Live-repro run (plan §10)

1. Apply probe commit on fix/rc2-runtime-compat (after A2 merge); rebuild
   dist (probe commit includes the dist mirror — it is itself a fix-branch
   commit, deletable).
2. `node tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs
   --worktree <int worktree>` → the run REDs on A1-dependent legs as
   expected (A2 already in → S4/S5 should be GREEN by then; S3 GREEN via
   A6; S1/S2 = the A1 signal).
3. Branch determination (plan §11):
   - **A** (contains seam absent on the rc.2 fs service): probe
     a1-fs-backend shows containsType ≠ 'function' + a1-contains-throw
     rows; S1 = non-match (allow lane non-match-on-failure) / S2 = deny
     lane fail-closed deny-canonicalization-failure (cause
     containment-undeterminable) — NOT the explicit static deny the plan
     wants.
   - **B** (contains present but faults / misbound): a1-fs-backend
     containsType = 'function'; a1-contains-fault rows (error name/stack)
     — e.g. a receiver-binding loss.
   - **C** (contains returns false / wrong verdict): no fault rows;
     S1 non-match + S2 non-match-on-deny… (deny lane would report
     failure? no — false verdict = rule canonicalized with
     containsOperation=false → deny rule does not match → decision falls
     to default ask, NOT a static deny) → check handles/cwd/provider
     identity/targetKey/displayPath from a1-contains-call rows.
   - **Prohibited fixes (plan §11/§19): prefix-string matching, parsing
     opaque keys.**
4. Minimal fix per the determined branch + §12 tightening (contains
   REQUIRED: a template declaring subtree while the provider lacks
   contains → setup failure, fail-closed; no silent fallback).
5. Delete the probe sites (revert the probe commit's hunks), rebuild,
   re-run the kit → S1–S5 GREEN (RED→GREEN arc).

## Gate notes

- Probe commit: evidence-only; must keep the full suite at the same
  baseline (instrumentation cannot change behavior — the a1-* console
  lines are diagnostics only, never authority).
- A1 fix commit: + A1-T1..T6 (plan §13): T1 facade preserves the
  contains receiver (method binding), T2 allow subtree static-allow with
  NO control request, T3 deny subtree static-deny, T4 sibling path no
  false positive, T5 relative/absolute path equivalence, T6
  missing-contains fail-fast at setup.
