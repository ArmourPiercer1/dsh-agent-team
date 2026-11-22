# FINDING — on a Member Scope the native `read` was served by the BASE provider (round 60) — FIXED in shape A (round 61)

This is the owner's named risk, measured on a real host instead of argued about: *"Member Scope 上原生工具是否
解析到该 Agent 的受控 Provider（无 Shadow Definition）"*. Round 60 answered **NO** and recorded the defect
below. Round 61 implements **shape A** (mount the preset's own host modules into the governed Member's
isolated scope, by default) and re-measures the SAME unmodified acceptance driver: the admitted call is now
served by the Member's controlled provider and the guard is consulted. Both round-61 reds were instrument
defects, and both are repaired rather than deleted: `d:native-read-surface` was re-anchored in round 62, and
`d:member-read-denied` was rewritten in round 71 to measure the DECIDING CHANNEL at each channel's proper
layer (live `LANE_DENY` with zero provider guard facts; in-process `IO_READ_DENIED`, `ADM-100`). Both judges
are PROVEN on two agreeing boots. The residual history is kept in "Residuals" and §"Round 71".

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

1. **`d:member-read-denied`: the PROVIDER channel cannot be reached on the live path while admission
   precedes execution — the JUDGE was repaired in round 71, the product was not changed.** The out-of-lane
   read is refused by the centre with `LANE_DENY` (durable fact `refusalCode=LANE_DENY`), so `denyFacts=0`
   and the tool result never names the provider's `IO_READ_DENIED`. The provider-side typed refusal IS
   proven in-process on the same seam (`ADM-100`: the out-of-lane call is `isError`, no secret bytes, and
   the provider lane records its own `deny` fact). The old clause demanded the provider's code on the live
   path, which would require the provider path to run BEFORE the centre — the wrong order for a governance
   system — so it was a defect about the judge.
   **Round 71 rewrites it, strictly, not permissively:** the clause now reads the deciding channel off the
   durable fact. Lane channel (`LANE_DENY`) additionally requires **zero provider guard facts for that
   exact call id** — the positive proof that the refusal preceded the provider. Provider channel
   (`IO_READ_DENIED`) requires that call's own guard `deny` fact (`decidedBy=IO_READ_DENIED`). Both
   channels require zero secret bytes and not-ENOENT. A separate clause runs the provider channel in its
   own in-process population (`node --test --test-name-pattern ADM-100`, pass AND the provider-deny
   assertion present). Measured on two agreeing boots: `refusalCode=LANE_DENY`, `channel=lane`,
   `provider guard facts for this call=0`, `ADM-100` green. The judge is PROVEN; what remains a LIMIT is
   exactly the lane-first ordering above, which is the contract.
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

## Round 71 — the two judges that were REFUTED for reasons about the judge

Two live clauses were rewritten in round 71. Neither was relaxed: each now measures the CONTRACT at the
layer where the contract actually decides. Both drivers exit 0 with their full clause sets on two
agreeing boots at HEAD `82dfda0c3` (host pin `639ed01539`), and no product code changed for the round.

### `d:member-read-denied` (run-boot.mjs)

Old clause: require the provider's `IO_READ_DENIED` on the live path. The centre decides before
execution, so that code is unreachable there **by design** — the clause was testing an ordering that
governance forbids.

New clauses (all required):

1. the call is the native `read`, is an error, and the result names a typed code;
2. `typed-denial-names-authority` — the durable fact's `refusalCode` is `LANE_DENY` or
   `IO_READ_DENIED`, and the tool result names the same code;
3. `deciding-channel-evidenced` — **lane channel**: result carries `LANE_DENY` AND **zero provider
   guard facts exist for that exact call id**; **provider channel**: result carries `IO_READ_DENIED`
   AND that call's provider guard facts exist, are `deny`s, and name `decidedBy=IO_READ_DENIED`;
4. `zero-secret-bytes` and `not-enoent` — required on BOTH channels;
5. `provider-channel-in-process-ADM-100` — a separate clause runs
   `node --test --test-name-pattern ADM-100 packages/runtime/test/vnext-admission.test.mjs` in the boot,
   writes the raw result to `runs/boot0N/in-process-provider-channel.json`, and requires the pass **and**
   the presence of that test's provider-deny assertion.

Measured (boot1; boot2 identical): `refusalCode=LANE_DENY`, `channel=lane`,
`provider guard facts for this call=0`, zero secret bytes, not-ENOENT, `ADM-100 exit=0 pass=true
providerDenyAssertionPresent=true`. The lane channel is proven live; the provider channel is proven in
its own in-process population — the two are evidenced, not conflated.

### `d2:revocation` (run-boot-d2.mjs)

Old clause: require that revoking a durable deny REFUSES the previously succeeded call with a new
compiled generation. That is widening, which `overlay-decision.mjs:9` / `admission-port.mjs:498-521` /
`permission-mutation.ts:435-436` forbid.

New clauses (all required), measured live:

- **(a)** durable deny lands (`changed:true`) → the same call is refused `ADMISSION_OVERLAY_DENY`, zero
  body, settlement `REFUSED`/`not-started`; the fact is `decision=deny`, `refusalCode=ADMISSION_OVERLAY_DENY`,
  `overlayOutcome=deny`, `laneDecision=allow`, with a non-empty `policyGeneration`;
- **(b)** deny removal (`changed:true`) → the same call family is admitted again and settles
  `COMPLETED`/`quiesced` as a NEW fact (pre/mid/post facts are distinct, same `call-d2-b-` family);
- **(c)** an untouched in-lane read is admitted, returns its bytes, is an `allow` fact and settles
  `COMPLETED` at ALL THREE phases (pre / deny / restore);
- **(d)** widening is refused: `team_grant_permission` is asked for `effect:'allow'` on a locator outside
  the member's compiled lane and answers
  `{"status":"permission-mutated", …, "changed":false, "reason":"mutation-proposal-pending"}` — a
  durable proposal, NOT a minted authority (the judge accepts a typed refusal or a no-op, and fails a
  `changed:true` expansion); the widened locator then stays `LANE_DENY` with zero foreign bytes and a
  `decision=deny` fact.

The centre fact's `policyGeneration` is the COMPILED revision fixed at bind (`centre-install.mjs:94`);
that is what (a) and (b) assert it carries, and why "a new compiled generation" is not part of the
contract.

**Everything not proven:** the live path never enters the provider (by design), so `IO_READ_DENIED` is
an in-process fact only; widening beyond the compiled ceiling remains impossible by design, so direction
(d) proves the REFUSAL and nothing about a permitted expansion; and both drivers remain `DEV-LIVE`
records, never gates or candidate evidence.
