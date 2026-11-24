**[dated label settlement, 2026-11-24 — R3 receipt EXTENDED to every FS mutation (edit/patch/delete/move) + a second live mutation, head `a7a7f08ca1f54229780fecce2a43df73e4351bde`]**

Round 96 on `vnext/a1-cut`, branch head **a7a7f08ca**. Sole writer worktree
`.worktrees/vnext-a1-cut`; no other worktree, no history rewrite, no merge, no port-3080 contact,
PR #822 stays **DRAFT and unmerged**.

## Ruling compliance

- **The owner ruling was "extend to Edit, the other FS methods, then Subprocess, each with its own
  proof"**, and "an OS-sandbox approval path must not be assumed to inherit the FS proof".
- **DELIVERED: all four remaining FS mutations** — `editText`, `patchText`, `deleteFile`, `moveFile` —
  on the SAME one-shot-grant → receipt → Provider-verification chain, each with its own operation
  kind, its own scope binding and its own arms.
- **NOT TOUCHED, by ruling: the subprocess/PTY face.** It keeps the fail-closed `IO_ASK_REQUIRES_APPROVAL`
  (R4). Its authority is an OS `SandboxExecutionPolicy`, not a file lane, and nothing here proves that
  plane. It is the named next step, not an implied inheritance.
- **No invariant changed.** `deny` is still decided before any receipt consult on EVERY path
  (including both move paths); the lane stays `ask` and is never promoted; bounds are still the
  compiler's own snapshot; the receipt is still single-use and execution-scoped; no `guarded`
  coupling, no second authority, no global callId map, no attribution-ALS reuse, no admission-duty
  expansion, no upstream patch, no weakened assertion, no widened timeout, no retry loop. The
  scripted model remains the only double.

## Per-method scope binding (receipt schema `a5sf-approved-ask-receipt/2`)

| tool → Provider method | kind | corridor | fingerprint is a `sha256` of | CANNOT say |
| --- | --- | --- | --- | --- |
| `write` → `writeText` | `fs-write` | target | the exact content string | nothing about the file's prior content |
| `edit` → `editText` | `fs-edit` | target | the requested `(oldString,newString,replaceAll)` transformation (`editSha256` of the triple) | NOT the prior content and NOT the resulting bytes — the Provider's literal-match/version guard decides those, after the receipt |
| `patch_text` → `patchText` | `fs-patch` | target | the exact `PatchHunk[]` payload (canonical JSON) | not prior/resulting bytes, not that the hunks apply cleanly |
| `delete_file` → `deleteFile` | `fs-delete` | target | nothing but the path; `bytesReadBack:false` is recorded | nothing about the deleted bytes — none are read back, by design |
| `move_file` → `moveFile` | `fs-move` | **both** paths | source AND destination, authored + canonical | (a→b) can never authorize (a→c) |

The verifier requires an EXACT method↔kind match (`RECEIPT_OPERATION_MISMATCH`) BEFORE any binding
check, so a receipt minted for one method can never satisfy another. Then, per path: deny wins on
the authored locator and on the canonical resolution, the path must resolve, must lie inside the
frozen bounds snapshot, and must equal the receipt's canonical path — one path for the single-target
methods, TWO for a move (a missing destination is a refusal, never a one-path match).

**Declared shapes vs shipped tools.** `write`/`edit` are shipped native tools. `patch_text`,
`delete_file`, `move_file` are DECLARED argument shapes for rc.5 Provider methods with **no shipped
tool in this product's preset**: no preset mounts them, so no model can reach them this round. Adding
them to the centre's closed axis table only means such a name is judged on the existing `fs.write`
axis (the same duty as `write`/`edit`) instead of being refused as unbound; it creates no tool and
admits nothing by default. rc.5's real multi-file `apply_patch` is deliberately NOT preparable: one
receipt binds ONE operation, and admitting it would either duplicate upstream's parser or let one
approval authorize N effects — it stays unbound (R4).

## Arms — `ADM-162`…`ADM-173` (`packages/runtime/test/vnext-admission.test.mjs`)

Over the REAL confined Provider on the PINNED hosts (`editText` on rc.2; `patchText`/`deleteFile`/
`moveFile` on rc.5 through the same host selector the rc.5 lane uses), REAL invocation binder, REAL
durable `ControlService`, REAL execution-settlement store; only the host loop is a double.

| arm | what it measures | result |
| --- | --- | --- |
| `ADM-162` edit POSITIVE | ask → allow → receipt verified for THAT edit → the real Provider applies `alpha→gamma`, bytes `gamma beta\n`, settlement `COMPLETED` | **PASS** |
| `ADM-163` edit content binding | receipt for edit X, body applies Y on the SAME path/lane ⇒ `RECEIPT_CONTENT_MISMATCH`, 0 bytes changed, `FAILED` at the body phase (phase honesty) | **PASS** |
| `ADM-164` cross-operation | a `writeText` receipt presented to `editText` ⇒ `RECEIPT_OPERATION_MISMATCH` | **PASS** |
| `ADM-165` lifecycle | revoked-after-consumption ⇒ `RECEIPT_REVOKED`; one consumed grant authorizes exactly one effect ⇒ `RECEIPT_REUSED` | **PASS** |
| `ADM-166` delete POSITIVE (rc.5) | ask → allow → receipt → file REMOVED (absence verified, no bytes read back), `COMPLETED` | **PASS** |
| `ADM-167` delete negatives | another path ⇒ `RECEIPT_OPERATION_MISMATCH` (both files intact); delete receipt on `writeText` ⇒ `RECEIPT_OPERATION_MISMATCH` | **PASS** |
| `ADM-168` move POSITIVE (rc.5) | ask → allow → receipt bound to BOTH paths → source gone, destination holds the exact bytes, `COMPLETED` | **PASS** |
| `ADM-169` move cross-path | receipt (a→b) used for (a→c), with c inside the live ask class ⇒ `RECEIPT_OPERATION_MISMATCH`, a intact, c absent, `FAILED` | **PASS** |
| `ADM-170` deny wins (move) | explicit deny on the destination refuses BEFORE any receipt consult, even with a live unused receipt ⇒ `IO_WRITE_DENIED`, nothing moved | **PASS** |
| `ADM-171` patch POSITIVE (rc.5) | ask → allow → receipt for the hunk payload → `one\nTWO\n`, `COMPLETED` | **PASS** |
| `ADM-172` patch content binding | receipt for payload X, body applies Y ⇒ `RECEIPT_CONTENT_MISMATCH`, byte-identical file, `FAILED` | **PASS** |
| `ADM-173` declared-shape honesty | a NON-mutation approval (`read`) mints NO receipt ⇒ a write smuggled into that body is `RECEIPT_NOT_IN_SCOPE`, 0 bytes | **PASS** |

Suite: **156 tests / 155 pass / 1 skipped / 0 fail**.

## LIVE proof — `probe-d4-routed-wake.mjs --boots 2` (DEV-LIVE)

Real rc.2 host (`639ed01539`), scripted model only, dev-live grant `devlive-fs-search-1`, world
`u5a5sfdev1`, PORCELAIN-CLEAN host tree before AND after both boots. **The existing judges were not
touched**, and the probe now performs a **second real mutation**: a second `write` from the same
worker, on a different path with different bytes, raising its OWN durable Control request.

| judge | boot1 | boot2 | byte-level evidence |
| --- | --- | --- | --- |
| `d4:ask-execute` | **PROVEN** | **PROVEN** | 27 bytes at `…/workspace/lane/worker-ask.txt`, `sha256:ced10112e5b82a2b1b6bca1b85b1dff242db7e9820aa4a1b6332f3096bdf28c3` (identical both boots), `COMPLETED` |
| `d4:ask-execute-2` | **PROVEN** | **PROVEN** | NEW durable request `ctrl-1u9ufbv1rss8va1kc1szx1d5`; real Leader `team_resolve_control` allow; receipt verified for THAT operation; 29 bytes at `…/workspace/lane/worker-ask-2.txt`, `sha256:2d71ffdd499955a34ec86af1c25c00f83c068fbe40f5fa3481f6a3752046442f` (identical both boots); the FIRST file is byte-identical to what the first approval wrote; the two digests differ ⇒ content binding across two approvals; `COMPLETED` |
| `d4:ask-denied` | **PROVEN** | **PROVEN** | approval deny through the real control path; file absent, 0 bytes; `REFUSED` / `not-started` |
| `d4:ask-stopped` | **PROVEN** | **PROVEN** | Stop via the public `session/cancel` while pending (HTTP 200); file absent, 0 bytes; `REFUSED` / `not-started` |
| `d4:enablement`, `d4:officer-up`, `d4:officer-binding`, `d4:refusal` | PROVEN | PROVEN | unchanged |
| `d4:routed-wake` | **REFUTED** | **REFUTED** | deliberately unchanged: the same EIGHT failing clauses — the ordinary ask carries no approval CASE, so the product router selects no Officer. A receipt is never routing evidence. |

Two-boot agreement: `agreeing=true`, `differing=[]`; `askExecuteBytes 27/27`,
`askExecute2Bytes 29/29`, both settlements `COMPLETED/COMPLETED`, deny/Stop `REFUSED` both boots.
The probe's ledger positive control was TIGHTENED, not relaxed: the durable reader must now see
exactly the control requests the world OBSERVED (2 requests / 2 decisions), so a reader that misses
one still fails. Artefacts: `runs/boot0{1,2}/{ask-execute,ask-execute-2,ask-denied,ask-stopped}.json`,
`verdict-ask-execute-2.json`, `agreement.txt`.

## Gate outputs (pasted token lines, logs in `round96/`)

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
DSH-CI-VERDICT pass pass=10 fail=0 skip=0 skipped=none legs=10 refused=0 refusedlegs=none seconds=273.8
```

`ute-vnext-a1`: **240 tests / 237 pass / 0 fail / 3 skipped** (was 228/225/0/3). Bound vitest
unchanged (node:test arms only). Catalog unchanged. `ute-p0-assets` unchanged ⇒ **no new scannable
file, so no p4t6 delta**. The full `ci-pr-gate` ran at `40fb3bc24`, whose only successor commit
(`a7a7f08ca`) adds this gate log; `artifacts-at-head` measured `HEAD carries its own build (1950
files, drift 0)`.

## What is NOT proven (the honest list)

1. **Subprocess / PTY has NO receipt and NO proof** — every subprocess ask still refuses
   (`IO_ASK_REQUIRES_APPROVAL`, R4). An OS-sandbox approval path is NOT assumed to inherit the FS
   proof: that is the next owner-ruled step and needs its own instrument.
2. **`apply_patch` (rc.5's real multi-file tool) stays unbound (R4)** — one receipt binds one
   operation.
3. **`patch_text` / `delete_file` / `move_file` are declared shapes, not shipped tools**, so their
   proof is at the production composition point (real admission port, Provider, binder, Control,
   settlement) plus the two LIVE `write` mutations — not a live model reaching those names.
4. **No row is PRODUCT-PROVEN.** The D4 evidence is a `DEV-LIVE` record, not a gate.
5. **`d4:routed-wake` remains REFUTED** and `C-alpha6` remains MECHANISM.
6. The receipt still binds `caseId:null` for an inline admission request, and the live run still uses
   the scripted model (no real-model interleaving measured).
