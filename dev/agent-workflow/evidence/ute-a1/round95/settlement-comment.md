**[dated label settlement, 2026-11-24 — R3 receipt wired into the PRODUCTION mount + live `write` proof, head `60cb8d75d15cdd3661f63c906ac7e695197cb851`]**

Round 95 on `vnext/a1-cut`, branch head **60cb8d75d**. Sole writer worktree
`.worktrees/vnext-a1-cut`; no other worktree, no history rewrite, no merge, no port-3080 contact,
PR #822 stays **DRAFT and unmerged**.

## Ruling compliance (review 20261124-0151 §2)

- **R2 — REJECTED and NOT built.** No `guarded` coupling, no second approval-consumption path, no
  second authority, no global callId map, no reuse of the attribution ALS as authorization. The
  one-shot Grant remains the only consumption.
- **R3 — APPROVED, now WIRED INTO THE PRODUCTION MOUNT for `write`/`writeText` only**, and proven on
  two agreeing booted hosts (DEV-LIVE).
- **R4 — still the fail-closed interim for everything outside R3's frozen scope.** Every `ask` for a
  method other than native `writeText`, and for every other tool/face, still refuses
  `IO_ASK_REQUIRES_APPROVAL`.
- **No invariant changed.** `deny` is decided before any receipt consult; the lane stays `ask` (never
  promoted); the bounds snapshot is the compiler's own `perEffective` read/write; no admission-duty
  expansion; no upstream patch; no widened timeout/retry; the scripted model is the only double.

## Production wiring (file:line)

| location | what it does |
| --- | --- |
| `packages/runtime/src/plugin/vnext/agent-bindings.mjs:1771-1790` | passes `approvedAskAuthority: { binder: grantBinder }` to the member-realm mount **only when** the row's Control service is wired (`grants !== undefined`). Same binder the grant is spent through; it mints nothing and adds no allow source. |
| `packages/runtime/src/plugin/live/a5sf-realm-row.mjs:835,968` | `mountMemberA5sfRealm({ …, approvedAskAuthority })`, forwarded into the mount input only when supplied. |
| `packages/runtime/team-services/src/mount.ts:796,896,965` | `MountA5sfRealmInput.approvedAskAuthority`, forwarded to `installMemberIoProviders` and `installToolBindingRealm`. |
| `packages/runtime/team-services/src/install.ts:104,513,880` | `createMemberFsGuard(policy, undefined, authority)` on the MEMBER face and the BINDING-REALM face. Terminal faces untouched; a row without Control keeps the byte-identical fail-closed mount. |
| `packages/runtime/team-services/src/guard-observability.ts:280-305` | the observer wrapper now forwards the optional `FsGuardOperation` **verbatim**. It had dropped `writeText`'s content, so a governed realm (which always supplies an evidence sink) refused a valid receipt with `RECEIPT_CONTENT_UNAVAILABLE`. Nothing about the decision changes. |

Dist was rebuilt and `place-dist-glue` reports 35 placements; the tracked dist carries the same
wiring (`install.js`, `mount.js`, `agent-bindings.mjs`).

## Regression arms

`packages/runtime/test/a5sf-service-install.test.ts` — `R3 production wiring: the mount passes the
invocation binder`:

| arm | expected | result |
| --- | --- | --- |
| authority supplied | real confined Provider writes the bytes | **PASS** |
| authority absent | `IO_ASK_RECEIPT_REFUSED` / `RECEIPT_AUTHORITY_UNAVAILABLE`, ENOENT | **PASS** |
| outside the execution scope | `RECEIPT_NOT_IN_SCOPE`, ENOENT | **PASS** |
| `observeGuard` operation forwarding | inner guard receives `{content}` unchanged | **PASS** |

File `20/20`. `ute-vnext-a1` leg unchanged (`228 tests / 225 pass / 0 fail / 3 skipped`, same digest).

## LIVE proof — `probe-d4-routed-wake.mjs --boots 2` (DEV-LIVE)

Real rc.2 host (`639ed01539`), scripted model only, dev-live grant `devlive-fs-search-1`,
world `u5a5sfdev1`, two boots with two-boot agreement `agreeing=true, differing=[]`. The target lives
INSIDE the Member's own workspace (the host sandbox root), so the measured effect is the lane/receipt,
never a sandbox accident.

| judge | boot1 | boot2 | byte-level evidence |
| --- | --- | --- | --- |
| `d4:ask-execute` | **PROVEN** | **PROVEN** | real durable Control request `ctrl-1xxrzo21k29yc31rawhls0qn`; Leader `team_resolve_control` **allow**; one-shot grant consumed; receipt verified for THAT execution; **27 bytes** at `…/workspace/lane/worker-ask.txt`, `sha256:ced10112e5b82a2b1b6bca1b85b1dff242db7e9820aa4a1b6332f3096bdf28c3` (identical both boots); execution fact `completed`; settlement `COMPLETED` (`ADMITTED → RUNNING → COMPLETED`) |
| `d4:ask-denied` | **PROVEN** | **PROVEN** | approval **deny** through the real control path; file **absent**, 0 bytes; execution fact `admission-refusal`; settlement `REFUSED` / `not-started` (`ADMITTED → REFUSED`) |
| `d4:ask-stopped` | **PROVEN** | **PROVEN** | Stop through the public `session/cancel` while the ask is pending (HTTP 200); file **absent**, 0 bytes; execution fact `admission-refusal`; settlement `REFUSED` / `not-started` |
| `d4:enablement` / `d4:officer-up` / `d4:officer-binding` / `d4:refusal` | PROVEN | PROVEN | unchanged |
| `d4:routed-wake` | **REFUTED** | **REFUTED** | deliberately unchanged: the ordinary ask carries no approval CASE, so the product router selects no Officer. R3 is not routing evidence. |

Measured summary rows: `askExecuteBytes 27/27`, `askExecuteSha256` identical,
`askExecuteSettlement COMPLETED/COMPLETED`, `askDeniedBytes null`, `askDeniedSettlement REFUSED`,
`askStoppedBytes null`, `askStoppedSettlement REFUSED`. Artefacts:
`dev/agent-workflow/evidence/d-boot-feasibility/d4/runs/boot0{1,2}/{ask-execute,ask-denied,ask-stopped}.json`.

## Gate outputs (pasted token lines, logs in `round95/`)

```
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975
DSH-TEST-CATALOG tests=785 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32 refused=0 findings=0
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
place-dist-glue: done (35 placement(s))
EB3-CI-REQUIRED pass workflows=10 findings=0
EB3-LAYER layer=ci-security verdict=PASS suites=14 files=14 describes=62 passed=222 failed=0 clock_ms=20000
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
UTE G1 argv: tests 89 / pass 89 / fail 0 (exit 0)
DSH-CI-VERDICT pass pass=10 fail=0 skip=0 skipped=none legs=10 refused=0 refusedlegs=none seconds=275.4
```

Catalog unchanged (`tests=785`, uncollected 38, excluded 14). No new scannable-surface file was added,
so p4t6 books no delta this round (`approved-ask-receipt.ts` was booked last round).

## Settlement verdict

- **R3 / BL-30 / G2: CLOSED FOR `write`/`writeText` ONLY**, at **DEV-LIVE** level (a real booted
  product turn, not a CI gate). The mechanism row stays MECHANISM; the Control ask→grant→EXECUTE leg
  is `DEV-LIVE` for this one operation. Never PRODUCT-PROVEN.
- **G11:** the lane-algebra fix is now live-validated (the pure-ask lane reaches Control and executes
  after the allow).
- **G1 / `d4:routed-wake`:** still **REFUTED**; `C-alpha6` stays **MECHANISM**. R3 did not touch it and
  must not be read as routing evidence.
- **R4:** unchanged for every other tool, FS method and face.

## Not proven / not claimed

1. Only `write`/`writeText` is covered. `editText`/`patchText`/`deleteFile`/`moveFile`, subprocess,
   and every other tool/face still refuse `IO_ASK_REQUIRES_APPROVAL` (R4).
2. No capability row is PRODUCT-PROVEN: the D4 record is `DEV-LIVE`, not a gate.
3. Alpha.6 routing (`d4:routed-wake`, G1) remains REFUTED.
4. The receipt binds `caseId:null` for an inline admission request — the identity it actually has.
5. The live run uses the scripted model; no real-model interleaving was measured.
6. The hosted CI verdicts for this head are re-queried after the push; only the local gates above are
   claimed here.
