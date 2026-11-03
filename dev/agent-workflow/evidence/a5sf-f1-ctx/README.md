# F1 — the a5sf realm BINDS the Member's tool plane (effective half)

**Task:** Alpha.5 P2 wiring, F1 effective half · **branch** `task/a5sf-f1-ctx-20261103`
**base** `origin/master` @ `4049747c9` (the P2-wiring merge, PR #550) · **worktree** `.worktrees/a5sf-f1-ctx`
**Boot budget: 0.** No Host boot, no port (3080/3180 untouched), no `DSH_HOME`, no writes under
`tests/homes/**`, no pristine host tree. Every arm is an in-process Cordis unit root with
`mkdtemp` fixtures. **CORE PATCH BUDGET: 0** — no upstream source was read-patched, no
patch-package, no vendored copy.

---

## 1. The problem this closes

PR #550 made the compiled a5sf sandbox realm **reachable** from the product row: the live Member
setup calls `mountMemberA5sfRealm(...)` and transports every guard consultation to a JSONL sink.
But the mount installs the confined fs Provider through `root.isolate('fs', …)`
(`packages/runtime/team-services/src/install.ts:182`), and Cordis `isolate()` creates a **sibling**
scope: the Context handed to the mount — the agent row's own ctx — keeps the **BASE** provider.
Nothing product-side resolved the isolated scope, so a *fully configured* row produced **zero**
consultations and an empty sink. The realm was reachable mechanically and inert effectively
(`dev/agent-workflow/evidence/a5sf-p2-wiring/README.md` §8).

## 2. Route decision (ONE route, defended before implementing)

Two candidate routes were on the table:

* **(a)** mount the Member's tools **under** `realm.installation.members[i].ctx` / the binding ctx;
* **(b)** route the **tool plane's fs** through the isolated scope (a `host.ts` accessor + its
  consumers).

**Chosen: (b).** Route (a) cannot reach the tools that matter. The upstream agent-preset registry
(`@deepseek-ai/dsh-agent-preset-registry` 0.2.0-rc.2) **eagerly activates** a preset at
`register()` time and mounts every preset plugin under its **own** generation scope
(`createScope(this.owner, generationKey)` → `mountPreset(scope.ctx.extend({ baseUrl }))`), i.e.
before any agent ctx exists and structurally *never below it*. No Context handed to
`presets.mount(agentCtx, id)` can therefore change which `fs` a preset tool body resolves, so route
(a) would confine only plugins that were also rewritten to mount under the realm ctx — and it would
require an upstream patch to confine the native `read`/`write`/`edit` rows
(**`CORE_SEAM_BLOCKER`**, P3 native takeover BL-22). Route (b) instead binds the **row's own** tool
plane, which is the half this row actually owns: the Team tool registrations, the governed GLUE-5
plane (whose `cap.hostService(name)` lookups resolve **lazily** through the ctx it was mounted with,
`team-tool-plane.mjs:2137`), and the permission adapter's per-call fs seam. It also keeps **one**
mount path — `mountA5sfRealm` stays the only entry point; there is no second launcher, no second
policy compiler and no parallel tool registry.

## 3. What changed (file by file)

| File | Change |
| --- | --- |
| `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` | New exported `a5sfToolPlaneOf(realm)`: `undefined` for a row that mounted no realm; a loud `TypeError` for a malformed mount (no Member installation / no usable `ctx.get` / no confined `fs.readText`); otherwise a **frozen** `{ ctx, fs }` naming the realm's FIRST Member installation, where `fs` is the **installed confined instance, captured once** (never a per-call `ctx.get('fs')`). Module header rewritten from the F1 "not effective" disclosure to "what is bound and what is not". |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` | The named center-interface change (ARC-A override, §7). Per-setup `let a5sfToolPlane`, assigned from `a5sfToolPlaneOf(a5sfRealm)` inside the existing mount block; `toolPlaneCtx` / `toolPlaneFsBackend` ternaries (default = agent ctx / the original accessor); the Team tool registrations (`toolPlaneCtx.tools.register(def)`) and the governed plane (`built.value.mount(toolPlaneCtx)`) move to the tool-plane scope; all **four** permission-adapter fs reads (`containmentBackend`, `resolveTarget`'s `resolve`, `containsTargets`, `containOverlayKeys`) use `toolPlaneFsBackend(agentCtx)`. The stale "yields ZERO consultations" disclosure above the import is replaced with the accurate BOUND / NOT BOUND statement. |
| `packages/runtime/dist/…/a5sf-realm-row.mjs`, `…/agent-bindings.mjs` | Committed dist mirrors (GLUE-6 placements, `place-dist-glue.mjs`; both `.mjs` are copied, never tsc-emitted). |
| `tests/world-factory/a5sf-f1-ctx.test.mjs` | **NEW** host-free `node:test` suite, arms F1-1…F1-7 (§4, §6). |
| `dev/agent-workflow/evidence/a5sf-f1-ctx/` | This receipt, `red-test.log`, `green-tests.log`, `probe-after.log`, `probe-f1-tool-plane.mjs`. |
| `.github/workflows/ci-integration.yml` + `dev/ci/eb3-ci-manifest.json` | The new suite is enrolled as its own leg ("a5sf F1 tool plane"), because `ci-integration` lists `node:test` files **explicitly** (the #394/#529 incidents were files no layer collected). |
| `dev/agent-workflow/ledgers/arc-a-protected-center.json` | **Append-only** ARC-A L1 override for the new `agent-bindings.mjs` digest (§7). |
| `tests/world-factory/a5sf-p2-wiring.test.mjs` | Two doc/pin updates only: the W6 import pin now names `a5sfToolPlaneOf` (the additive name on the SAME import), and the header's "F1 not done" line points at the new suite. No behavioural arm changed. |
| `dev/agent-workflow/evidence/a5sf-p2-wiring/probe-f1-isolate.mjs` | Header pointer to the new BEFORE/AFTER probe (the isolate-topology receipt itself is unchanged). |

**No** new `packages/**` file was added: the two edited `.mjs` are already scannable/owned paths, so
the p4t6 booking needs no re-anchor (§6).

## 4. What is now TRUE (measured, dated 2026-11-03)

The discriminating pair is the point of the lane. The **same** tool definition shape
(`inject: ['tools','fs']`, body resolving the provider from the ctx it runs on — exactly what
`@deepseek-ai/dsh-tool-fs` does), the **same** file, the **same** real
`@deepseek-ai/dsh-tools` runtime (`tools.execute` → pre-policy → dispatch → result); only the
scope it was placed on changed:

| | tool-scope constructor | read of a file outside the ceiling | sink facts |
| --- | --- | --- | --- |
| tool plane on the agent ctx (**BEFORE**) | `FsDouble` (base) | `ALLOWED:"outside\n"` | **0** |
| tool plane through `a5sfToolPlaneOf(realm)` (**AFTER**) | `TeamConfinedFileSystem` | **`IO_READ_DENIED`** | **exactly 1** |

Measured on the committed `packages/runtime/dist` by
`probe-f1-tool-plane.mjs` (`probe-after.log`, verbatim):

```
── BEFORE (pre-F1 mapping: tool scope = agent ctx) ─────────────────
agent ctx constructor            : FsDouble
agent ctx -> outside             : ALLOWED:"outside\n"
tool scope === agent ctx         : true
tool scope constructor           : FsDouble
tool scope -> outside            : ALLOWED:"outside\n"
facts after BEFORE tool-scope read: 0 (expected 0)
── AFTER (F1 mapping: tool plane through a5sfToolPlaneOf) ──────────
a5sfToolPlaneOf present          : true
tool scope === realm member ctx  : true
tool scope constructor           : TeamConfinedFileSystem
tool scope -> outside            : IO_READ_DENIED
facts from the tool-scope read   : 1 (expected 1)
tool plane fs === realm member fs: true
realm member ctx -> outside      : IO_READ_DENIED (the SAME scope object, a second read)
agent ctx -> outside (unchanged) : ALLOWED:"outside\n"
sink facts                       : 2 member/readText/deny/IO_READ_DENIED member/readText/deny/IO_READ_DENIED
```

The fact is the guard's own record (`a5sf-guard-consult/1`, realm `member`, `method: readText`,
`decision: deny`, `decidedBy: IO_READ_DENIED`, `locator` = the resolved host path, `sequence: 1`),
written through the row's sink. The refusal is **fail-closed before the base Provider runs**: the
suite asserts the base read counter did not move, and that zero bytes of the denied file appear in
the tool result.

The **three-way split** after the change (suite arm F1-4):

* agent ctx → **BASE** provider (unchanged; a LEADER or non-tool consumer is untouched);
* tool-plane scope → **CONFINED** (`TeamConfinedFileSystem`), and it **is** the realm's Member ctx;
* `plane.fs === realm.installation.members[0].fs` — **one** instance, no copy, no second mount.

## 5. RED / GREEN

* **RED** (`red-test.log`): with the binding removed
  (`git stash push -- packages/runtime/src/plugin/live/{a5sf-realm-row.mjs,agent-bindings.mjs}`),
  the suite is **6 failed / 1 passed** — every arm that names or exercises the tool plane dies
  (`row.a5sfToolPlaneOf is not a function`; the F1-7 structural pin reports the missing import and
  the missing `toolPlaneCtx` call sites). The single passing arm is F1-5, the **default path**,
  which is exactly right: a row without a realm must behave identically before and after.
* **GREEN** (`green-tests.log`): `pnpm -r typecheck` ✔; `pnpm -r build` ✔;
  `place-dist-glue.mjs` 101 placements (both mirrors byte-identical) ✔; ARC-A / PR6 / A4P3 law
  suites 34/34 ✔; `vitest run a5sf` 166/166 ✔; **all** `tests/world-factory/a5sf-*.test.mjs`
  suites green (12 + **7** + 10 + 14 + 9 + 13) ✔; p4t6 20/20 ✔; `eb3-ci-required` pass
  (9 workflows, 0 findings) ✔; `eb3-ci-negative-controls` 24/24 ✔.

## 6. The p4t6 tie — MEASURED last, not copied

`packages/testkit/test/p4t6-bookings/a5sf.json` is **unchanged**, and that is a measurement, not an
omission. The lane adds **zero** new `packages/**` paths (it edits two already-counted `.mjs` and
adds one `tests/**` suite + `dev/**` evidence + CI enrolment). The scanner total on **this** tree,
read after the final build, is:

```
scanner total (measured on THIS tree): 1428
```

which is exactly the booking's `expectedDelta.to` (`from: 1396 → to: 1428`, 32 booked paths,
983 base + 444 derived). The p4t6 suite passes 20/20. Nothing was re-anchored; the evidence above
is the receipt that the arithmetic still holds on the post-change tree. Dist is outside the scanned
tree.

## 7. ARC-A L1 + A4-6 law

* `agent-bindings.mjs` is on the ARC-A protected-center list. The change is a **named
  center-interface change** (assigned by the coordinator, PR #550 lane), so exactly **one**
  append-only override entry was added — never a removal:
  `sha256 52b5bb84599dc7b6d7e491ddefb898060cac95471b82a707b3427bffd8fd4f8b`, `pr`
  `"PR #550 (task/a5sf-f1-ctx-20261103) …"`, with the reason spelling out the tool-plane binding,
  the default path and the evidence path. The earlier P2-wiring override
  (`480a2083…`) stays in the ledger: overrides are historical facts, not a moving set.
* `packages/runtime/tsconfig.build.json` is untouched (A4-6: no comments there, no bare entries).
* `packages/**` edits only — `control/**`, `tool-admission`/dispatch,
  `governance-center/**`, `pa-mount-registry` and `host.ts` are **not** touched.

## 8. What is STILL structural (do not read this lane as done)

1. **The native preset tools are NOT bound.** `read`/`write`/`edit` from
   `@deepseek-ai/dsh-tool-fs` still resolve the base provider, because the preset registry mounts
   its plugins under its own eagerly-created generation scope (§2). Confining them is the **P3
   native takeover (BL-22)** — it needs the preset packages' mount seam, not this row.
2. **The plane's fs family does not use `ctx.fs`.** It builds a hardened provider over its own
   `rootDir`/controlled-fs lane. Only consumers that go through `cap.hostService('fs')` (the state
   family, the agent-runtime port, …) see the confined provider; the family's own file effects are
   confined by *its* lane, not by the a5sf guard. This lane did not re-route that provider — doing
   so would be a second fs authority, which the route decision forbids.
3. **The Member CEILING realm is what gets consulted, not a per-binding lane.** The tool plane uses
   `installation.members[0]` (the ceiling). The narrower per-tool-binding realms
   (`installation.bindings[i]`) are mounted but still have no product consumer; a tool is checked
   against the Member ceiling only.
4. **Teardown ordering is bounded, and measured.** The realm disposer rides the same
   `toolDisposers` drain as the tool registrations it precedes. After disposal a `ctx.get('fs')` on
   the tool-plane scope answers `undefined` (NOT the base provider — suite arm F1-6), while the
   **captured** instance the permission adapter holds keeps refusing. So the post-dispose window
   cannot silently widen to the base provider, but a *late* ctx-resolving consumer would get a
   service-resolution fault rather than a guard refusal. That is the one risk a reviewer should
   weigh: `plane.fs` consumers fail closed with a guard refusal, `plane.ctx` consumers fail closed
   with a missing-service fault; neither fails open.
5. **No live enforcement was exercised.** No Host boot, no live agent row, no kernel/OS-level
   sandbox proof. This lane proves the ROUTING and the CONSULTATION, not the sandbox's OS teeth.

## 9. What a live run must prove (the next, separately-authorised step)

With a booted Host and a real a5sf-configured Member row:

1. A **tool-invoked** read outside the Member ceiling (through the Team tool plane / the governed
   plane, i.e. the paths this lane binds) is refused in the live row, with the refusal surfacing as
   a tool error — not as a pass-through and not as a `GUARD_OBSERVATION_FAILED`;
2. the live sink path (row config → `a5sfEvidencePath`) receives **exactly one**
   `a5sf-guard-consult/1` fact per consulted call, with `sequence` monotonic per realm;
3. a **native `read`** of the same file is still **ALLOWED** in that same live row — that
   asymmetry IS §8.1, and a live run that shows otherwise means the preset registry changed its
   mount shape (which would unblock BL-22);
4. the permission adapter (A2 canonicalization) accepts targets inside the ceiling and refuses
   outside it, over the same provider the tool executed on;
5. row close() releases the realm and the tool plane without a leaked fiber and without a
   post-dispose base-provider fallback (§8.4).

## 10. How to re-run (host-free)

```bash
cd /home/armourpiercer/projects/dsh-agent-team/.worktrees/a5sf-f1-ctx

# the suite (also its own CI leg)
node --test tests/world-factory/a5sf-f1-ctx.test.mjs

# the BEFORE/AFTER probe over the committed dist
cd packages/runtime/dist
node ../../../dev/agent-workflow/evidence/a5sf-f1-ctx/probe-f1-tool-plane.mjs "$(pwd)"

# the sibling receipts
node --test tests/world-factory/a5sf-p2-wiring.test.mjs
node ../../../dev/agent-workflow/evidence/a5sf-p2-wiring/probe-f1-isolate.mjs "$(pwd)"
```

Expected: 7/7 green; probe BEFORE = tool scope on the agent ctx (base, ALLOWED, 0 facts), AFTER =
tool plane through `a5sfToolPlaneOf` (confined, `IO_READ_DENIED`, 1 fact).
