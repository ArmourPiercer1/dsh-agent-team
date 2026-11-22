# FINDING — on a Member Scope the native `read` was served by the BASE provider (round 60) — FIXED in shape A (round 61)

This is the owner's named risk, measured on a real host instead of argued about: *"Member Scope 上原生工具是否
解析到该 Agent 的受控 Provider（无 Shadow Definition）"*. Round 60 answered **NO** and recorded the defect
below. Round 61 implements **shape A** (mount the preset's own host modules into the governed Member's
isolated scope, by default) and re-measures the SAME unmodified acceptance driver: the admitted call is now
served by the Member's controlled provider and the guard is consulted. One judge clause remains REFUTED
(`d:member-read-denied`) for the cause recorded in "Residuals" — a finding, not a relaxation; the second
round-61 red (`d:native-read-surface`) was an instrument defect, repaired and re-anchored in round 62.

## Round 60 measurement (the defect, kept as history)

Two agreeing boots (`--boots 2`, `agreeing=true`), one governed Member, three model requests, remote mount
`SKIPPED` (C-remote), and:

| judge | result |
| --- | --- |
| `d:centre-facts` | PASS — the member's durable ledger holds `allow` + `deny/LANE_DENY` + 2 execution facts |
| `d:member-read-admitted` | PASS — in-lane bytes arrive in the native `<path>/<type>/<content>` envelope (but the judge cannot witness WHICH provider served them) |
| `d:guard-facts` | **REFUTED — ZERO guard consults**; the sink file does not exist |
| `d:member-read-denied` | REFUTED — the refusal is the centre's `LANE_DENY`, not the provider's typed `IO_READ_DENIED` |
| `d:native-read-surface` | REFUTED — judge instrument defect (see below) |

Zero `a5sf-guard-consult/1` facts means the call never went through the confined provider: it was admitted by
the centre and then executed by the **base `fs`**.

## Why (product source, not conjecture)

The preset `tool-fs` row resolves the preset standing scope's **base** `fs`. Only `a5sfNativeToolModules`
re-mounts a native module into the Member's isolated scope (`team-services/src/mount.ts`), and this row
declares none. So confinement of native tools was **opt-in per row**, not a property of being governed.

That is the gap: a governed Member got the centre's decision (correct) and the base provider's I/O (wrong).

## Round 61 fix — shape A, ONE definition, no shadow

**What is mounted.** For a row that compiles a realm / installs the centre, the native-tool modules are now
mounted into the MEMBER'S OWN scope by default:

- `packages/runtime/src/plugin/vnext/realm-lane.mjs` — new exported
  `mountGovernedNativeToolModules({governed, realm, root, scope, presetModules})`:
  - derives the candidate set from the preset's own rows (the registry's `compositionInventory()`), never
    from a second module list;
  - forwards each row's OWN `config` (read from the preset's declared document through the public
    `readDocument()` seam) — the same module AND the same configuration the preset row would have mounted
    (`dsh-tool-fs-search` requires `sampleOverCapGlobResults`, so an invented-default mount would be a
    different module in practice);
  - imports the HOST namespace, observes its registrations (`observeOnly`), keeps it only when it declares
    a confined face (`fs`/`subprocess`/`web`/`terminals`) and registers at least one name the centre
    adjudicates (`TOOL_AXES` from `admission.ts` — still the ONE closed table);
  - skips a candidate whose declared face this realm does not own (recorded in `skipped`);
  - refuses typed if a module cannot be imported (`GOVERNED_NATIVE_MODULE_UNRESOLVED`), is not a Cordis
    plugin (`GOVERNED_NATIVE_MODULE_INVALID`), registers nothing
    (`GOVERNED_NATIVE_MODULE_EMPTY`), registers a name outside the post-deny surface
    (`GOVERNED_NATIVE_SURFACE_CONFLICT`), has an ambiguous owner
    (`GOVERNED_NATIVE_MODULE_AMBIGUOUS`) or changes the surface
    (`GOVERNED_NATIVE_SURFACE_CHANGED`);
  - mounts with `mountHostModules` — the HOST's own module and its own `execute`, proved by definition
    identity per declared name. **No shadow ToolDefinition is created** (A1).
- `packages/runtime/src/plugin/vnext/agent-bindings.mjs` — wires it for a governed member
  (`compiledAnswerOfRealm(realm) !== undefined`) and only when the row does not configure
  `a5sfNativeToolModules` (a configured row keeps today's explicit mount). The mount is applied
  **immediately AFTER `applyBuiltInToolDeny`** (order is load-bearing: an own-scope registration sits
  outside `tools.restrict`, so mounting before the deny would re-enable a denied tool), and its disposer is
  registered with the other native-mount disposers.
- `packages/runtime/src/plugin/host.ts` — the lazy `agentPresets` accessor now also exposes
  `compositionInventory()` and `readDocument()` (the same public seam the persona observer already uses), so
  the glue never reaches for a private API.

**Not-mounting is not the safety net; failing closed is.** An ungoverned row returns `undefined` before the
realm or the preset rows are read, so it is byte-for-byte today's behaviour. A governed member with nothing
on its post-deny surface that the centre adjudicates mounts nothing (there is no base-provider tool call to
confine); every other unresolved/unmountable case is a typed refusal that propagates out of member setup.

## Round 61 re-measure (same driver, UNMODIFIED)

`env -u DBOOT_WITHOUT_CENTRE -u A5SF_WF_NO_INSTALL_GRAPH node tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs --boots 2`
— two agreeing boots, `agreeing=true`, same fixture, no timeout change.

| judge | round 60 | round 61 | why |
| --- | --- | --- | --- |
| `d:member-read-admitted` | PASS | **PASS** | in-lane bytes (`admittedBytes=true`), native `<path>` envelope |
| `d:guard-facts` | REFUTED (0 facts) | **PROVEN** | 2 allow facts for the in-lane locator (`stat`, `readText`), naming `inst-0pe2z220bhfb`, `decidedBy=ALLOW` |
| `d:centre-facts` | PASS | **PASS** | 2 `fs.read` admissions (`allow` + `deny/LANE_DENY`) and 2 execution facts |
| `d:member-read-denied` | REFUTED | REFUTED | residual 1: the centre refuses BEFORE the provider, so `IO_READ_DENIED` is unreachable for that call |
| `d:native-read-surface` | REFUTED | REFUTED | residual 2: the judge's `native-description` clause reads the top-level description, where the marker is not (**round 62: instrument re-anchored, now PROVEN — see the round-62 addendum**) |

Guard facts are the finding's own falsifier: they only exist when the confined provider's guard is entered.
`out-lane-never-reached-provider` also passes with 0 facts, because the centre's `LANE_DENY` precedes the tool
body — the provider is not merely unproven for that call, it is never entered.

## Residuals (reported, not relaxed)

1. **`d:member-read-denied` cannot pass while admission precedes execution.** The out-of-lane read is refused
   by the centre with `LANE_DENY` (durable fact `refusalCode=LANE_DENY`), so `denyFacts=0` and the tool result
   never names the provider's `IO_READ_DENIED`. The provider-side typed refusal IS proven in-process on the
   same seam (`ADM-100`: the out-of-lane call is `isError`, no secret bytes, and the provider lane records its
   own `deny` fact). Making the live judge pass would require the provider path to run BEFORE the centre —
   the wrong order for a governance system. The judge's clause is therefore a product-semantics finding, not
   a tolerance to widen.
2. **`d:native-read-surface` `native-description` was an instrument defect — REPAIRED in round 62, kept
   here as history.** It required `resolved by the filesystem backend` in the top-level tool description,
   but in the pinned host that phrase is the **`file_path` PARAMETER** description
   (`tests/deepseek-harness-test-use/packages/fs/tool-fs/src/read.ts`); the top-level description is
   `Read a UTF-8 text file and return line-numbered content.` The clause was re-anchored rather than
   deleted (`native-description` reads the top-level field, `native-file-path-description` reads the
   parameter field) and the judge is **PROVEN** with all six clauses on two agreeing boots
   (`D-BOOT-FEASIBILITY.md:494-511`). The "no shadow" claim was kept — it was the right claim. This is no
   longer an open residual; it is recorded because deleting the evidence of a wrong instrument is how the
   same defect returns.
3. **Face coverage is derived, so a face the realm does not own stays on the preset row.** The D realm owns
   `fs` and `subprocess`, so `tool-fs` (read/write/edit/read_image) and `tool-fs-search` (grep/glob) both
   mount. A realm with no `subprocess` face would skip `fs-search` (recorded in `skipped`), leaving
   grep/glob exactly as today; `bash` is never a candidate (it injects `shell`, not a controlled face).
4. **Surface gate.** The default mount is gated on the post-deny surface actually carrying a name the centre
   adjudicates. This keeps a governed member with no reachable native tool from failing over a preset row
   that is not installed in the current process (the in-process preset doubles), and it is not a fallback:
   when a controlled name IS on the surface, absence/unmountability of its module is a typed refusal.

## Two lawful fixes (the round-60 design record)

| # | shape | notes |
| --- | --- | --- |
| **A** | MOUNT BY DEFAULT: for a governed Member, mount the host's native tool modules into the member realm unless the row explicitly narrows the set | implemented in round 61; preserves the "ONE definition" law (no shadow), fails closed if a native module cannot be resolved |
| **B** | REFUSE an undeclared set: a governed row without `a5sfNativeToolModules` is refused at bind (`MEMBER_NATIVE_UNCONFINED`) | retained as the per-module safety net inside A (typed refusals), not as the row-level behaviour |

## What must not happen

- Do not report "native tools are confined" from `d:member-read-admitted` alone: it passed on the base
  provider in round 60. The proof is `d:guard-facts` (allow facts with the member identity) plus the
  in-process identity assertion (`ADM-100`).
- Do not relax `d:guard-facts` to "facts may be absent": zero guard consults IS the finding.
- Do not fix this by writing a Team tool that shadows `read` — that is the shadow definition A1 forbids.

## Round 62 addendum — the denied live call and the revocation semantics

Two things measured after the boundary fix:

1. **`IO_READ_DENIED` on the live path is unreachable by design**: the centre decides BEFORE execution, so an
   out-of-lane call never reaches the provider. The provider-side refusal is proven in-process (ADM-100: zero
   secret bytes). The live judge therefore reports the centre's `LANE_DENY`, which is the correct division of
   labour, not a missing guarantee.
2. **`d:native-read-surface` was an instrument defect, repaired rather than deleted.** The `native-description`
   clause read the top-level `description`; the marker lives in the `file_path` parameter description. Round 62
   re-anchored the clause (top-level field for `native-description`, parameter field for
   `native-file-path-description`), and the judge is now **PROVEN** on real boots with all six clauses
   (`D-BOOT-FEASIBILITY.md:494-511`). Nothing about the product changed for this.
3. **Authority revocation cannot come from the durable overlay, and that is a CONTRACT INVARIANT, not a bug**:
   `overlay-decision.mjs:9` (deny-only), `admission-port.mjs:498-521` (consulted only when the compiled lane
   allows; the only verdict is `ADMISSION_OVERLAY_DENY`), `permission-mutation.ts:435-436` (a revoke removes
   restrictions and "never needs expansion authority"). Measured live: add a durable deny ⇒ the call is refused
   `ADMISSION_OVERLAY_DENY`; revoke that deny ⇒ the call is admitted again; an untouched in-lane call keeps
   working. What CANNOT happen — and must not — is the overlay WIDENING authority or a revoke producing a new
   compiled generation.

So D's "permission revocation" acceptance must be stated in the contract's own terms: **revocation of access =
a durable deny (refused with zero body), restoration = removing that deny, and widening beyond the compiled
ceiling is refused.** A judge that requires the overlay to grant is testing for a capability the contract
forbids; it is REFUTED on purpose.
