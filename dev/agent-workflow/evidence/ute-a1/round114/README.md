# Round 114 — security-finding remediation: SEC-01 fixed, SEC-02 fixed (history retained), SEC-03 declared

Scope: `.worktrees/vnext-a1-cut` only; branch `vnext/a1-cut`; base `b5da23b4b`; PR #822 stays **DRAFT**
(unmerged). No history rewrite, no merge, no non-topic push, no upstream patch, no widened timeout, no
retry loop, no weakened assertion, no PRODUCT-PROVEN claim. `:3080` and its DSH_HOME were never touched.

## What changed

| file | change |
| --- | --- |
| `packages/runtime/src/plugin/vnext/fact-ledger.mjs` (+ byte-identical dist mirror) | **SEC-01.** The append is now `open(O_APPEND) → write → fsync(file) → close`, plus ONE directory fsync when the append creates the file. The in-memory admission is registered only AFTER the durable append. Policy: **fsync-before-return, no batching window**. Fail-closed named errors: `LEDGER_NOT_DURABLE` (file fsync refused; bytes rolled back), `LEDGER_DIRECTORY_NOT_DURABLE` (dir fsync refused; file unlinked), `LEDGER_CLOSE_FAILED` (durable but not reported), `LEDGER_UNRECOVERABLE` (rollback failed; every fact refused). Format/order/digest/replay unchanged. |
| `packages/runtime/test/vnext-admission.test.mjs` | **SEC-01 arms** `SEC-01a…d` (4 arms; see below). |
| `tests/checks/d4-evidence-consistency.test.mjs` | **SEC-02 machine check** (5 arms): README §2 vs `results.json` and `probe-digest.json` for the same head. |
| `dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md` | **SEC-02 correction** 2026-11-25: dated banner + §2 transcribed from `results.json` + round-87/88 text marked `[HISTORICAL]` (nothing deleted). |
| `CAPABILITY-MATRIX-C.md`, `D-ACCEPTANCE-REPORT.md` | **SEC-03 declared boundary**: new `C-host-capability` row (and a DECLARED UNCOVERED BOUNDARY status in the vocabulary) + single-table **row 35**. No behaviour change. |
| `SECURITY-REVIEW-20261125.md` | per-finding disposition table; §3 headers/§6 items/§7 verdict updated. |
| `PR-BODY-draft.md`, `MIGRATED-SUITE-STATUS.md` | round-114 sections with the same numbers and dispositions. |

## SEC-01 — the durability policy and its bound

**Policy: fsync-before-return.** `record()` does not return until the line is on stable storage. There is
no group-commit window, so there is no window in which a returned fact is not durable. The cost is
bounded and explicit: **one file fsync per record**, plus **one directory fsync for the first record**
that creates the file (the directory entry is what makes the inode reachable by name). A later record
incurs exactly one fsync. The ledger is on the admission path of a governed call, not a high-rate
telemetry path, so the simple bound was chosen over batching.

**Fail-closed, never silent:** a refused file fsync truncates the un-acked bytes back to the pre-append
length and throws `LEDGER_NOT_DURABLE`; a refused directory fsync unlinks the un-durable file and throws
`LEDGER_DIRECTORY_NOT_DURABLE`; a refused close throws `LEDGER_CLOSE_FAILED`; a failed rollback throws
`LEDGER_UNRECOVERABLE` (the ledger's authority is unknown, so every fact is refused). A caller that gets
a return has a durable record; a caller that gets a throw has neither a durable record nor an in-memory
one.

**Authority boundary:** `admission-port.mjs#commit` writes the durable fact FIRST and opens the
settlement record only after `record()` returns. A refused fsync therefore leaves **no settlement record
at all** for that call — not RUNNING, not COMPLETED, not a REFUSED that could be read as an execution.

**Format unchanged:** the line is still exactly `JSON.stringify(record) + '\n'`; the replay rule, the
record kinds and the load/readAll semantics are untouched (`SEC-01c` pins the bytes).

**Remaining bound (stated, not hidden):** a physical power cut cannot be injected in-process. The arms
pin the ordering that makes the machine-crash claim true and the process-crash observable; the actual
kernel/power cut is out of reach here (SEC-01 §4 in the review). The platform *does* provide `fsync`
through `node:fs` on the measured Linux/CI target — a ledger constructed without a real fsync seam is
refused at open (`IO_MISSING`), so there is no silent no-op.

### The four arms (all green)

| arm | what it proves |
| --- | --- |
| `SEC-01a` | a recorded fact survives a **SIGKILL** of the writer process before any next append (fresh ledger sees `KNOWN`, exactly one record) |
| `SEC-01b` | **the authority boundary**: fsync counts (2 on create = file+dir, 1 thereafter); a refusing fsync is `LEDGER_NOT_DURABLE`, the bytes are rolled back (empty file), the callId is not known, and the REAL centre + REAL settlement store open **no settlement record** (deny `ADMISSION_LEDGER_UNWRITABLE`) |
| `SEC-01c` | **no format/digest change**: byte-identical JSONL line, same reloaded object, replay still refused |
| `SEC-01d` | **fail-closed**: file fsync → `LEDGER_NOT_DURABLE`; directory fsync → `LEDGER_DIRECTORY_NOT_DURABLE` + unlink; close → `LEDGER_CLOSE_FAILED`; no-fsync seam → `IO_MISSING` |

## SEC-02 — the correction and the machine check

`d4/README.md` now states the current truth (`d4:routed-wake` **PROVEN** on 2/2 boots at the machine head
`41d5791195d199190c8d808d321aaa8e4dbca030`; all seven routed sub-judges PROVEN; `overall` BLOCKED only
for the separately-declared `d4:ask-execute-process`), with a **dated correction banner** and the
round-87/88 text kept as explicitly marked `[HISTORICAL]`. The round-97 closure is cited
(`ALPHA6-FORMAL-ROUTING.md` §"ROUND 97 ADDENDUM"); round 102 re-ran it on rc.5.

`tests/checks/d4-evidence-consistency.test.mjs` runs in the `tests-checks` area leg and fails when:

1. the README's declared measurement head ≠ `probe-digest.json#head`;
2. the two boots disagree, or the README's §2 judge set ≠ the machine judge set;
3. any §2 verdict ≠ `results.json` (or `overall` differs);
4. a current-tense REFUTED/“does not happen”/“remains UNPROVEN” about a PROVEN judge stands outside a
   `[HISTORICAL]` block.

**Mutation control (measured, not assumed):** run against the pre-correction README bytes
(`git show HEAD:…/d4/README.md`), the judge/verdict arm reports `d4:routed-wake => REFUTED` against the
machine `PROVEN` — it is RED on exactly the defect it exists to catch, and GREEN after the correction.

## SEC-03 — the declared boundary wording

No behaviour change. The single acceptance table has **row 35** and `CAPABILITY-MATRIX-C.md` has the
**C-host-capability** row plus a **DECLARED UNCOVERED BOUNDARY** status:

> `subagent`, `send_message`, `interrupt_agent`, `skill` and the 15 `team_*` names are closed and
> admitted on `team.control`/host authority, but their effects are performed by **host services**, so the
> centre's fs/net lane algebra **does not bound them** — they have **no managed I/O lane** (probe A15).
> The broad claim "every provider effect is inside the compiled lane" is **not** true here; a
> hostile-code model must treat them as capabilities **outside** the sandbox. Never counted as PROVEN
> for confinement.

## Gates at this head (all exit 0; logs in this directory)

| gate | measured |
| --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` (`A5SF_REQUIRE_PINNED_HOST=1`) | **255 tests / 252 pass / 0 fail / 3 skip**; 7-file set digest unchanged `sha256:edd4f1c4…` (`gate-dispatch-tests.log`) |
| `test-catalog --max-uncollected 41 --max-excluded 7` | **tests=786 collected=734 uncollected=38 excluded=14 findings=0**, digest `sha256:8982e6e9…` (`gate-test-catalog.log`) |
| `ute-cut-closure --check` | pass `cut(0/148)` `prodRefs=0 distResiduals=0 dupNames=0` (`gate-ute-cut-closure.log`) |
| `ute-p0-assets --check` | pass `cut(148/148)` modules=37 files=180 lines=69512 (`gate-ute-p0-assets.log`) |
| `docs-sync --check` | docs=193 findings=0 blocking=0 (`gate-docs-sync.log`) |
| `place-dist-glue` | 35 placements, byte-identical (`gate-place-dist-glue.log`) |
| `eb3-ci-required` | pass workflows=11 findings=0 (`gate-eb3-ci-required.log`) |
| bound vitest (`eb3-security-run --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt`) | **PASS** 15 suites / 15 files / 238 passed / 0 failed (`gate-bound-vitest.log`) |
| `EB3-RUN-MANIFEST` | **pass** records=602 strict=0 incomplete=11 findings=0 (`gate-eb3-run-manifest.log`) |
| UTE G1 nine-file argv | **89 tests / 89 pass / 0 fail / 0 skip** (`gate-ute-g1-argv.log`) |
| `ci-pr-gate --full --census-captures 2` | **PASS 10/10**; census `599f/7424l` twice with identical identity sets (`gate-ci-pr-gate.log`) |
| `pr-settlement-gate --pr 822` | `pr-settlement-gate.log` |

## New scannable-surface delta — measured, not assumed

**+1 test file, +1 collected test.** `test-catalog` moved `tests=785 → 786` and
`collected=733 → 734`; digest `sha256:da8a452d… → sha256:8982e6e9…`. The new file is
`tests/checks/d4-evidence-consistency.test.mjs` and it is collected by the `tests-checks` leg's declared
`areas: ["tests/checks"]` (no hand list edited). `docs-sync` is unchanged (`docs=193`) because the
evidence/docs edits live under `dev/agent-workflow/evidence/`, which it does not count. `ute-p0-assets`
and `ute-cut-closure` are unchanged. `place-dist-glue` is still 35 placements (the ledger's dist mirror
already existed; it was re-placed byte-identically).

## What is still open / not claimed

- **Not PRODUCT-PROVEN, not a gate:** every live claim remains DEV-LIVE; PR #822 stays DRAFT.
- **Physical power-loss cut** is not injectable in this environment; the fsync ordering is pinned, the
  kernel cut is not (SEC-01 §4).
- **SEC-03/SEC-04 remain declared boundaries**, not fixes: giving host-capability tools a managed lane,
  or governing ungoverned rows, are product-scope decisions.
- The candidate-acceptance verdict cited elsewhere is still bound to `41d579119`, not to this head;
  `git diff --stat 41d579119..HEAD -- packages/*/src` is **not empty** this time (the ledger file
  changed), so the candidate verdict is NOT stretched over the ledger change. The ledger change is
  covered by the `ute-vnext-a1` leg at this head instead.
