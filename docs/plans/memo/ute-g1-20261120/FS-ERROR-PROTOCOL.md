# FS-ERROR-PROTOCOL — the B+C refusal interface, implemented on paper

**Part of:** `docs/plans/memo/ute-g1-20261120/` — the frozen UTE G1 implementation
contract. Marker discipline: [`README.md`](./README.md) §0.
**Dated:** 2026-11-20 (session calendar). **Work package:** UTE-3 (FS family
migration), the FS error-protocol slice.
**Branch:** `task/ute3-fs-errors-20261120` (one branch, one writer, one worktree).
**Base:** `origin/master` = `35b59ca3c42188bd645669920e64c7da885f2299`.
**Ruling implemented:** the owner's written ruling of 2026-11-20 on the FS refusal
surface (quoted verbatim in §1.1).

> **Status: EVIDENCE PACKAGE + APPROVAL REQUEST. NOT an approval, NOT a
> `SemanticDifferencesResolved` verdict, NOT a retirement licence.**
> The ledger term stays `verdict: false`, both differences stay
> `approval: null`, and `scripts/ute-retirement-gate.mjs` must keep refusing the
> FS family. The owner signs; this memo only prepares the request (§7).

---

## 1. The ruling, and exactly how far it goes

### 1.1 The ruling (verbatim intent)

`[OWNER-DECIDED]` The owner approved the **B+C technical route**:

> "原则上批准采用 B+C 方案：新执行路径使用 DSH 原生结构化 `FsError`，保留
> `FS_PERMISSION_DENIED` 等合理错误码；新旧路径采用封闭的拒绝类别映射评价兼容性，
> 不要求历史文本和内部错误码逐字一致。执行端应检查现有消费者、错误处理器和测试是否
> 依赖历史错误表示，建立相应的兼容性证据。不得借此放宽实际权限检查、改变拒绝时机，
> 或放宽文件副作用负控。此裁决批准技术路线，不等于已经批准
> `SemanticDifferencesResolved` 达标。后者仍需提交实际证据和对应的 Owner 批准记录，
> 不得由执行体自行伪造。"

### 1.2 What that authorises, in engineering terms

| letter | `[OWNER-DECIDED]` content | implemented by |
|---|---|---|
| **B** | The new execution path keeps the host's native structured `FsError` codes (`FS_PERMISSION_DENIED`, `FS_NOT_OBSERVED`, `FS_STALE_VERSION`, `FS_SANDBOX_DENIED` where the sandbox backend really denies, …). It does **not** rename them into the legacy `IO_*` vocabulary, and it does **not** claim `FS_SANDBOX_DENIED` from a lane-only provider (rc.5's `tool-fs` dereferences `policy.mode` for that code — see `tests/ute-g1-fs/golden/SEMANTIC-DIFFERENCES.md` §1). | §2.1, §2.4; `tests/ute-g1-fs/lib/refusal-categories.mjs` `NATIVE_FS_ERROR_MAP` |
| **C** | Old/new compatibility is judged through a **CLOSED refusal-category mapping**. Literal text equality and internal code equality are **not** required and are **not** claimed. | §2.2–§2.4; `refusal-categories.mjs` `LEGACY_REFUSAL_MAP` + `compareRefusal` |
| — | The executor must **inventory** every existing consumer, error handler and test that depends on the historical representation, and **build compatibility evidence**. | §4; `dev/agent-workflow/evidence/ute3-fs-errors-20261120/` |
| — | The ruling may **not** be used to relax a permission check, move a refusal's timing, or relax a file-effect negative control. | §3 (non-goals), §5.3 (what was NOT changed) |
| — | The ruling is **not** `SemanticDifferencesResolved`. That term still needs real evidence **and an owner approval record**. The executor must not fabricate it. | §6, §7 |

`[OWNER-DECIDED]` **Scope:** this is a *technical route* ruling for the FS family.
It is not a release verdict, not a V@B level, not a cross-family inference
(`RETIREMENT.md` §1.1, D4), and not a statement that the two paths are
behaviourally equivalent. The corpus already showed the effects agree; this
ruling addresses the **refusal surface** only.

---

## 2. The adopted interface

### 2.1 Route B — the native codes are kept

`[MEASURED]` The codes below are the `FsError` codes recorded in this tree (the
rc.5 host tree itself is not vendored; see §8 `UNKNOWN`-1 for what could not be
re-read):

| native `FsError` code | recorded at | category |
|---|---|---|
| `FS_SANDBOX_DENIED` | `tests/ute-g1-fs/golden/SEMANTIC-DIFFERENCES.md`, `dev/agent-workflow/evidence/a5sf-fs-face/README.md`, rc.5 `tool-fs/src/sandbox.ts:139-143` | `denied-by-lane` |
| `FS_PERMISSION_DENIED` | `tests/ute-g1-fs/lib/prototype-provider.mjs:93`, `tests/ute-g1-fs/README.md` | `denied-by-lane` |
| `FS_NOT_OBSERVED` | `tests/ute-g1-fs/lib/prototype-provider.mjs:93`, `tests/ute1-fs/lib/fake-host.mjs`, rc.2/rc.5 `fs-observation-policy` | `read-before-write` |
| `FS_STALE_VERSION` | `tests/world-factory/lib/a5sf-fs-contract-world.mjs:824`, `dev/agent-workflow/evidence/a5sf-fs-face/README.md` §2.1 | `stale-version` |
| `FS_NOT_FOUND` | `tests/ute1-fs/lib/fake-host.mjs:76,118,145` | `missing-path` |
| `FS_EDIT_NOT_FOUND` | `tests/ute1-fs/lib/fake-host.mjs:121` | `missing-path` |
| `FS_AMBIGUOUS_EDIT` | `tests/world-factory/lib/a5sf-fs-contract-world.mjs:1444-1447,1472` | `invalid-argument` |
| `FS_ABORTED` | `tests/world-factory/lib/a5sf-fs-contract-world.mjs:939,978-979` | `cancelled` |

`[MEASURED]` Deliberately **not** in the native map: `FS_BINDING_*`
(`FS_BINDING_HOST_GENERATION_MISMATCH`, `FS_BINDING_REFUSAL`,
`FS_BINDING_HOST_SURFACE_INCOMPLETE`, `FS_BINDING_LANE_INVALID`,
`FS_BINDING_SCOPE_INVALID`, `FS_BINDING_SERVICE_MISSING`). Those are the **Team
binding/assembly** refusal codes (`tests/ute1-fs/lib/arms.mjs`, the realm row),
not host `FsError`s, and they never travel the model-facing FS surface. Mapping
them would blur "the host refused the I/O" with "this assembly could not bind
the host", which is a different claim.

### 2.2 Route C — the closed category vocabulary

`[OWNER-DECIDED]` The vocabulary is closed and every category is defined by the
**condition** that produced the refusal, not by the string or code that spells
it. A definition that baked in a code would re-introduce the equality
requirement this interface exists to remove; `selfCheck()` refuses that.

| category | definition (behavioural, no surface bake-in) | reached from |
|---|---|---|
| `denied-by-lane` | A resolved lane/policy decision withheld the effect: outside every allowed subtree, inside an explicit deny subtree, a symlink escape, or an `ask` disposition this plane cannot consume. Taken **before** the effect ran. | `lane-read`, `lane-write`, `lane-deny`, the lane prose, `IO_READ_DENIED`, `IO_WRITE_DENIED`, `IO_ASK_REQUIRES_APPROVAL`, `PATH_NOT_ALLOWED`, `PATH_EXPLICITLY_DENIED`, `PATH_SYMLINK_ESCAPE`, `FS_SANDBOX_DENIED`, `FS_PERMISSION_DENIED` |
| `read-before-write` | A mutation of an existing target was withheld because the caller had not observed that exact target first. | `write-requires-read`, the unread-write prose, the write⇒read coupling prose, `IO_WRITE_REQUIRES_READ`, `FS_NOT_OBSERVED` |
| `stale-version` | A mutation was withheld because the target changed after the observation the caller relied on. | `stale-version`, the stale-edit prose, `FS_STALE_VERSION` |
| `missing-path` | The addressed path — or the addressed literal inside an existing file — does not exist where the call says it does. | the missing-read-target prose, `ENOENT`/`not found` prose, `PATH_NOT_FOUND`, `FS_NOT_FOUND`, `FS_EDIT_NOT_FOUND` |
| `invalid-argument` | The call's arguments are malformed, out of range, or under-specified, so it cannot run as written. | `FS_AMBIGUOUS_EDIT` |
| `unsupported-mode` | The requested operation/format/deployment capability is not supported here, so it is refused rather than approximated. | `IO_POLICY_UNSUPPORTED`, `PATH_RESOLUTION_UNSUPPORTED` |
| `cancelled` | The caller cancelled before completion. | `FS_ABORTED` |
| `unknown` | The evidence does not determine which condition above caused it. **Declared per value** — never a fallback. | the corpus residual class `other` (explicit entry) |

`[MEASURED]` `unknown` has exactly **one** declared producer (the corpus class
`other`). It is not reachable by passing an unclassified string: that raises
`REFUSAL_VOCABULARY_INCOMPLETE`. This is the difference between a closed
vocabulary and a default bucket.

### 2.3 The two TOTAL maps

`[MEASURED]` `tests/ute-g1-fs/lib/refusal-categories.mjs` exports:

- `LEGACY_REFUSAL_MAP` — ordered entries of kind `class` | `code` | `text`, each
  with a `category`, a MEASURED `sample`, and a `source` citation. Every entry's
  own sample is asserted to classify as its own category (`selfCheck`), so a
  reordering that shadows an entry is red.
- `NATIVE_FS_ERROR_MAP` — `FsError` code → category, exact match only.
- Both are **total or refused**: `categoryOfLegacyRefusal` /
  `categoryOfNativeFsError` throw a typed `RefusalVocabularyError` with code
  `REFUSAL_VOCABULARY_INCOMPLETE` for anything unmapped. There is no default.
- `compareRefusal({legacy, native})` → `{compatible, category, legacyCategory,
  nativeCategory, reason}`. `compatible` means "same behavioural class"; on an
  incompatible pair `category` is `null`, so a caller can never read a
  shared category out of a mismatch.
- `auditCorpus({legacy, native})` → findings; `assertCorpusVocabularyComplete`
  throws. This is the hook that turns the corpus red when it gains an unmapped
  value instead of silently absorbing it.

`[MEASURED]` **Ordering is load-bearing.** The stale-edit remedy contains the
read-before-write remedy as a substring (`re-read the file, then retry` ⊃
`read the file, then retry`). The `stale-version` prose pattern is therefore
tried first; a test pins that a stale sentence classifies as `stale-version`,
and a mutation that swaps the order is caught by `selfCheck`.

### 2.4 The full mapping table (single view)

| legacy surface (old path) | category | native `FsError` (new path) |
|---|---|---|
| class `lane-deny` / `lane-read` / `lane-write` | `denied-by-lane` | `FS_PERMISSION_DENIED`, `FS_SANDBOX_DENIED` |
| `IO_READ_DENIED` / `IO_WRITE_DENIED` | `denied-by-lane` | `FS_PERMISSION_DENIED` (lane-only provider) |
| `IO_ASK_REQUIRES_APPROVAL` | `denied-by-lane` | `FS_PERMISSION_DENIED` |
| `PATH_NOT_ALLOWED` / `PATH_EXPLICITLY_DENIED` / `PATH_SYMLINK_ESCAPE` | `denied-by-lane` | `FS_PERMISSION_DENIED` |
| prose "outside every allow subtree of the lane" / "inside an explicit deny subtree" / "dangling symlink" / "disposition 'ask'" | `denied-by-lane` | `FS_PERMISSION_DENIED` |
| class `write-requires-read` | `read-before-write` | `FS_NOT_OBSERVED` |
| `IO_WRITE_REQUIRES_READ` | `read-before-write` | `FS_NOT_OBSERVED` |
| prose "file has not been read — read the file, then retry" | `read-before-write` | `FS_NOT_OBSERVED` |
| prose "must read … before rewriting it … write does not imply read" | `read-before-write` | `FS_NOT_OBSERVED` |
| class `stale-version` | `stale-version` | `FS_STALE_VERSION` |
| prose "file changed since it was read — re-read the file, then retry" | `stale-version` | `FS_STALE_VERSION` |
| prose "read target '…' does not exist" / `ENOENT` / "not found" | `missing-path` | `FS_NOT_FOUND`, `FS_EDIT_NOT_FOUND` |
| `PATH_NOT_FOUND` | `missing-path` | `FS_NOT_FOUND` |
| — (the old corpus never recorded this class) | `invalid-argument` | `FS_AMBIGUOUS_EDIT` |
| `IO_POLICY_UNSUPPORTED` / `PATH_RESOLUTION_UNSUPPORTED` | `unsupported-mode` | — (no recorded native pair today) |
| — (the old corpus never recorded this class) | `cancelled` | `FS_ABORTED` |
| class `other` | `unknown` | — (declared residual class only) |

`[PROPOSED-BY-MEMO]` **What `compatible` does NOT mean** — stated here so it is
not oversold:
1. It does not say the model-facing text is equal. It is not.
2. It does not say the refusal happened at the same *instant*. Timing is graded
   by the corpus vectors ("refused, zero bytes, unchanged file"), not by this
   map.
3. It does not say the model saw the same *sentence*. It says the same kind of
   thing was withheld.
4. It is not transitive across families and not evidence for another family's
   refusal surface.

---

## 3. Explicit non-goals

`[OWNER-DECIDED]` (from the ruling's own prohibitions) — this work explicitly
does **not**:

1. **Relax a permission check.** No admission, lane, ceiling or policy code was
   touched. The mapping classifies refusals that were already produced.
2. **Move a refusal's timing.** No refusal was moved from before-I/O to
   after-I/O or vice versa. The corpus's "refused, zero bytes, file unchanged"
   vectors remain the timing evidence.
3. **Relax a file-effect negative control.** `negative-controls.mjs` and the
   corpus's effect oracle are untouched (a parallel slice owns those files); no
   assertion in this slice loosens an existence/bytes/sha256/mode check.
4. **Claim behavioural equivalence.** Effects agreeing on the covered vectors is
   not equivalence of the refusal surface, and not equivalence of `read_image`
   (which still has no baseline vector).
5. **Resolve `SemanticDifferencesResolved`.** The ledger term stays `false`
   (§6).
6. **Authorise retirement.** The gate keeps refusing; UTE-4 is untouched.
7. **Create or name an approval.** There is no approval record in this PR, by
   design (§7).

---

## 4. Consumer / handler / test inventory (deliverable 4)

### 4.1 How the inventory was produced

`[MEASURED]` Raw scan: `dev/agent-workflow/evidence/ute3-fs-errors-20261120/scan.sh`
searches `packages/**`, `tests/**`, `scripts/**`, `docs/**` (excluding `dist/`,
`node_modules/`, `.git/`) for the old FS refusal representation:

```
FS_SANDBOX_DENIED | outside every allow subtree | has not been read
changed since it was read | read the file, then retry
IO_READ_DENIED | IO_WRITE_DENIED | IO_ASK_REQUIRES_APPROVAL
IO_WRITE_REQUIRES_READ | IO_POLICY_UNSUPPORTED
```

Result: **724 rows across 165 files** (`consumer-scan.raw.txt`). The pre-slice
baseline was **653 rows across 162 files**; the three added files are this
slice's own instruments — `refusal-categories.mjs`, its test, and this memo —
classified `HARNESS`/`DOC` `unaffected` rather than hidden from the scan.
`adjudicate.mjs` then attaches `scope` + `verdict` + `depends` to every row using
reviewed **file groups** (a verdict is a property of what the file is for, not of
one line), and **fails closed** on any file no group covers — a new file cannot
inherit a verdict. Output: `consumer-scan.txt` (653 annotated rows) and
`consumer-verdicts.tsv` (162 adjudicated files, with reasons).

`[MEASURED]` Verdict totals: **unaffected-by-B+C = 135 files**, **needs-adaptation
= 30 files**, **incompatible = 0 files**, **unreviewed = 0**.
Scope totals: FS 33, NON-FS 84, PRODUCER 9, HANDLER 1, DOC 30, HARNESS 8.

`[PROPOSED-BY-MEMO]` **Scoping rule, stated so it is not read as an omission:**
the ruling is scoped to the FS tool family (D4). A `bash`/`subprocess`/`terminal`/
`search`/`web`/`jobs`/`skill`/`agent-state` test that asserts `IO_READ_DENIED`
is **out of this slice**: it observes another face's refusal, and families retire
independently. It is still in the raw scan (so nothing was hidden), with the
scope `NON-FS` and the reason attached. No cross-family inference is made in
either direction.

### 4.2 FS-scope files (the blast radius)

`[MEASURED]` Every FS-scope file, its verdict, and the one-line reason are in
`consumer-verdicts.tsv`. The table:

| file | verdict |
|---|---|
| `tests/world-factory/lib/a5sf-fs-contract-world.mjs` | **needs-adaptation** — densest dependency: asserts the three legacy model-facing prose sentences and the legacy provider op codes |
| `tests/world-factory/lib/a5sf-acceptance-preflight.mjs` | **needs-adaptation** — **HANDLER**: judges acceptance rows by matching legacy prose (`LANE_REFUSAL`, `IO_WRITE_REQUIRES_READ_PROSE`, the row-4b host sentence) |
| `tests/world-factory/lib/a5sf-dual-plane.mjs` | **needs-adaptation** — **oracle**: closed `decidedBy` expectation tables would report DISAGREE for a non-behavioural reason |
| `tests/world-factory/lib/u6-fs-assembly.mjs` | needs-adaptation |
| `tests/world-factory/a5sf-pd17-fs-read-axis.test.mjs` | needs-adaptation — FS safety arms (deny + 0 bytes + 1 fact) keyed on `IO_*` |
| `tests/world-factory/a5sf-fs-contract.test.mjs` | needs-adaptation |
| `tests/world-factory/a5sf-native-route-c.test.mjs` | needs-adaptation |
| `tests/world-factory/a5sf-f1-ctx.test.mjs` | needs-adaptation |
| `tests/world-factory/a5sf-tool-axis.test.mjs` | needs-adaptation |
| `tests/world-factory/a5sf-p2-seam.test.mjs` | needs-adaptation |
| `tests/world-factory/a5sf-p2-wiring.test.mjs` | needs-adaptation |
| `tests/world-factory/a5sf-product-assembly.test.mjs` | needs-adaptation |
| `tests/world-factory/a5sf-governed-preset.test.mjs` | needs-adaptation |
| `tests/world-factory/a5sf-harness.test.mjs` | needs-adaptation |
| `tests/world-factory/a5sf-pd19-fact-attribution.test.mjs` | needs-adaptation |
| `tests/world-factory/a5sf-acceptance-preflight.test.mjs` | needs-adaptation — pins the handler's prose constants |
| `tests/world-factory/a5sf-dual-plane.test.mjs` | needs-adaptation — uses the oracle's code tables |
| `tests/world-factory/suites/150-a5sf-read.mjs` | needs-adaptation — read/read_image axis |
| `tests/world-factory/suites/010-u6-fs.mjs` | needs-adaptation |
| `tests/world-factory/drivers/a5sf-pd31-read-image/run-boot.mjs` | **needs-adaptation** — requires the out-of-lane `read_image` text to be the legacy sentence (the uncovered unit member) |
| `tests/world-factory/drivers/a5sf-pd24-surface-ledger/build-ledger.mjs` | needs-adaptation — generates the FS surface promise `typed IO_READ_DENIED / IO_WRITE_DENIED` |
| `packages/runtime/test/a5sf-pd17-fs-policy.test.ts` | needs-adaptation — PD-17 arm 4 (deny + 0 base calls) keyed on `IO_WRITE_DENIED` |
| `packages/runtime/test/a5sf-service-install.test.ts` | needs-adaptation — pins `TEAM_IO_DENIAL_CODES` and the mounted FS refusals |
| `packages/runtime/test/a5sf-pd20-admission-close.test.ts` | needs-adaptation — ordering claim observed through `IO_READ_DENIED` |
| `packages/runtime/test/u7-9a-fs-mutation-c1.test.ts` | needs-adaptation — image/ask arms of the FS mutation suite |
| `tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs` | **needs-adaptation** — live acceptance: REAL fs write/read outside the ceiling must be `IO_*_DENIED` with zero bytes |
| `tests/kits/joint-acceptance-20261111/run-joint-acceptance.mjs` | **needs-adaptation** — same live claim |
| `scripts/diag-call-chain.mjs` | needs-adaptation — diagnostic decoder cannot explain a native `FsError` |
| `packages/runtime/test/a5-read-slice-window.test.ts` | unaffected — asserts the **policy compiler's** landing, not an FS call refusal |
| `packages/runtime/test/a5p2-composition.test.ts` | unaffected — same (policy compilation) |
| `tests/world-factory/m7a-real-slice.test.mjs` | unaffected — asserts the **real host `fs-sandbox`** `FS_SANDBOX_DENIED`, which route B keeps |
| `tests/world-factory/u6-arc-d.test.mjs` | unaffected — asserts the **host observation policy's** own text, which the native path keeps |
| `tests/world-factory/fixtures/a5sf-boot2-row6-sample.json` | unaffected — a recorded historical sample, not a promise |

`[MEASURED]` Docs that promise a specific model-facing FS string/code and are
therefore **needs-adaptation** at the switch (not now):

| doc | promise that becomes false |
|---|---|
| `docs/plans/active/alpha5-sandbox-first/TOOL-ACCEPTANCE-MATRIX.md` | the M-01…M-04 rows promise typed `IO_READ_DENIED` / `IO_WRITE_DENIED` / `IO_WRITE_REQUIRES_READ` |
| `docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md` | "true today" FS/read_image rows quote the same codes |

`[MEASURED]` Docs whose old-path statements are **unaffected**: dated phase
reports, the alpha5 backlog/end-state snapshots, the tool-io-governance memo set,
the m7a/m7b1 memos (they record the real host `FS_SANDBOX_DENIED`, retained),
`docs/reviews/20261120-1700.txt`, and the UTE memos themselves. They describe the
old path accurately **at their date**; rewriting history is forbidden and B+C
does not require it.

### 4.3 Handlers, specifically

`[MEASURED]` Four places **classify** a refusal rather than produce or assert it:

1. `packages/runtime/team-services/src/guard-observability.ts:66-70,262` — maps a
   refusal code to `ask`/`deny` for the guard fact. **unaffected**: a native
   `FsError` never reaches this `TeamIoDenial` surface; if it did, the
   `else`-branch classifies it `deny`, which is correct (no spelling
   dependency).
2. `tests/world-factory/lib/a5sf-acceptance-preflight.mjs:181-198,775-821` —
   **needs-adaptation, highest priority**: it judges acceptance rows by matching
   the legacy prose. A native-path row would be `REFUTED` for a non-behavioural
   reason. It is the first intended consumer of `refusal-categories.mjs`.
3. `tests/world-factory/lib/a5sf-dual-plane.mjs:66-120` — the dual-plane oracle's
   closed expectation tables. **needs-adaptation**.
4. `scripts/diag-call-chain.mjs:136` — diagnostic decoder keyed on the legacy
   codes. **needs-adaptation** (diagnostic coverage, not a gate).

### 4.4 `incompatible` rows

`[MEASURED]` **Zero.** No FS-scope consumer is structurally incompatible with
B+C. The three nearest misses, and why each is NOT `incompatible`:

1. `tests/world-factory/m7a-real-slice.test.mjs:430` requires
   `FS_SANDBOX_DENIED`. **Not incompatible**: it exercises the real host
   `fs-sandbox` backend, and route B keeps that code there. It is only a
   lane-*only* provider that may not claim it.
2. `tests/world-factory/drivers/a5sf-pd31-read-image/run-boot.mjs:922,926`
   requires the legacy sentence for an out-of-lane `read_image`. **Not
   incompatible**: the *claim* (lane refusal, one deny fact, zero bytes) survives;
   the surface assertion is mechanically re-expressed through the category. This
   is `needs-adaptation`, not a contradiction of the ruling.
3. `tests/world-factory/lib/a5sf-acceptance-preflight.mjs` would return
   `REFUTED` on native text. **Not incompatible**: the classification function is
   the thing the new mapping replaces.

`[PROPOSED-BY-MEMO]` If a future consumer requires the **new** path to emit the
**old** code/text verbatim, that row **is** `incompatible` with the ruling and is
a blocker for the FS switch. None exists today (measured above), but the
inventory is a snapshot, not a proof about future code — which is exactly why
`adjudicate.mjs` fails closed on an unseen file.

### 4.5 UI rendering

`[MEASURED]` **No UI renders the FS refusal text or code.** A search of
`packages/client/**` for `IO_*`, `FS_*`, "outside every allow", "has not been
read" returns zero matches. The client's `denied` occurrences are the Alpha.4
permission-administration surface, a different vocabulary. The refusal reaches
the model as the tool result's error text (host-rendered), not as a Team UI
string — so there is no client asset to adapt.

---

## 5. Evidence

### 5.1 Files in this slice

| file | what it is |
|---|---|
| `tests/ute-g1-fs/lib/refusal-categories.mjs` | the closed vocabulary + both total maps + comparator + corpus audit + self-check |
| `tests/ute-g1-fs/lib/refusal-categories.test.mjs` | 17 cases, corpus values **derived** from the committed golden/evidence, 4/4 real mutants red |
| `docs/plans/memo/ute-g1-20261120/FS-ERROR-PROTOCOL.md` | this memo |
| `dev/agent-workflow/evidence/ute3-fs-errors-20261120/scan.sh` | the raw scan (reproducible) |
| `…/consumer-scan.raw.txt` | 653 raw rows |
| `…/adjudicate.mjs` | the reviewed grouping table; fails closed on an unreviewed file |
| `…/consumer-scan.txt` | 724 rows annotated with scope/verdict/depends |
| `…/consumer-verdicts.tsv` | 165 adjudicated files with verdict + reason |
| `…/gates.txt` | verbatim gate output (§5.2) |

### 5.2 Gate transcript (verbatim)

`node scripts/ute-retirement-gate.mjs --all` → **exit 1**; FS refused; the two
`UTE_SEMANTIC_DIFFERENCES_UNRESOLVED` findings now carry the B+C route and the
pending approval in their detail (full text in `gates.txt`):

```
UTE-RETIREMENT-GATE ledger=dev/agent-workflow/ledgers/ute-retirement.json schema=ute-retirement/1 families=1
UTE-RETIREMENT-REFUSED family=fs codes=UTE_SEMANTIC_DIFFERENCES_UNRESOLVED,UTE_MEMBER_UNCOVERED state=NOT_RETIREABLE unit=0/4
  UTE-RETIREMENT-FINDING code=UTE_SEMANTIC_DIFFERENCES_UNRESOLVED … detail="blocking difference lane-refusal-code has no owner approval …; recorded status: … OWNER RULING 2026-11-20: route B+C adopted … approval PENDING (owner signature required)."
  UTE-RETIREMENT-FINDING code=UTE_SEMANTIC_DIFFERENCES_UNRESOLVED … detail="blocking difference refusal-observation-shape has no owner approval …; recorded status: … route B+C adopted (technical route only) … APPROVAL: PENDING (owner signature required) …"
UTE-RETIREMENT-SUMMARY requested=1 allowed=0 refused=1
```

New suite: `node --test tests/ute-g1-fs/lib/refusal-categories.test.mjs` →
**17/17 pass**, printing `REFUSAL-CATEGORY-MUTANTS total=4 red=4`.

`[MEASURED]` Gate's own suite after the message enrichment:
`node --test scripts/ute-retirement-gate.test.mjs` → **31/31 pass**, including
`MUTANTS — every new rule has a mutation that turns its control RED`.

### 5.3 What was deliberately NOT changed

`[MEASURED]` No admission/permission code, no lane compiler, no provider guard,
no effect oracle, no negative control, and no corpus vector was edited. The only
non-additive edits are: the two semantic-difference records (route + pending
approval), the ledger's `semanticDifferencesResolved` note/expect tokens (verdict
still `false`), and a **message-only** enrichment in
`scripts/ute-retirement-gate.mjs` that appends the difference's recorded
`summary` to the existing refusal. That branch still refuses; the annotation
cannot establish the term.

---

## 6. Continuity: why the gate still refuses (and must)

`[MEASURED]` The ledger keeps `verdict: false`, both differences keep
`approval: null`, and no approval record file exists. `evaluateDifferences`
therefore emits two `UTE_SEMANTIC_DIFFERENCES_UNRESOLVED` findings and the
predicate stays false. `state` remains `NOT_RETIREABLE`, `unit=0/4` (the corpus
still has no `read_image` vector and no per-member negative control).

`[OWNER-DECIDED]` A route ruling is not a `SemanticDifferencesResolved` verdict
(the ruling says so itself). What the owner must still supply is a **bound
approval record**: `by` (named approver), `on` (YYYY-MM-DD), a committed
`record` file containing the name, and a `reference` of the form
`PR #<n> @ <40-hex>` whose commit exists here **and** is an ancestor of the
graded HEAD (`RETIREMENT.md` §3, P4/P4b; gate code `UTE_APPROVAL_UNREFERENCED`).
A name in a file proves transcription, not authority; the reference is what
binds it to a merged act.

---

## 7. Approval REQUEST (the executor does not sign)

`[PROPOSED-BY-MEMO]` The owner is asked to issue **one** approval record covering
**both** differences, in the shape the gate already checks. The exact text the
owner would be signing:

```
APPROVAL — UTE G1 FS refusal compatibility (B+C), 2026-11-20

I approve the B+C compatibility interface for the FS family's refusal surface,
scoped to the two recorded differences below and to nothing else.

Interface approved:
  (B) The new execution path keeps the host's native structured FsError codes,
      including FS_PERMISSION_DENIED for a lane denial, FS_NOT_OBSERVED,
      FS_STALE_VERSION, FS_NOT_FOUND, FS_EDIT_NOT_FOUND, FS_AMBIGUOUS_EDIT and
      FS_ABORTED; and FS_SANDBOX_DENIED only where the fs-sandbox backend really
      denies. A lane-only provider does not claim FS_SANDBOX_DENIED.
  (C) Old/new compatibility is judged through the CLOSED refusal-category
      vocabulary and the two total maps in
      tests/ute-g1-fs/lib/refusal-categories.mjs, not by literal text equality
      or code equality. An unmapped legacy value or FsError code is a refusal
      (REFUSAL_VOCABULARY_INCOMPLETE), never a default bucket.

Differences covered:
  lane-refusal-code           (FS_SANDBOX_DENIED / FS_PERMISSION_DENIED)
  refusal-observation-shape   (legacy prose / native typed FsError code)

Not covered by this approval:
  - read_image coverage (the retirement unit member that has no baseline vector)
  - per-member negative controls (NC-MEMBER read/write/edit do not exist yet)
  - any other family's refusal surface (web, process, pty, search, mcp, ptc)
  - any claim that the two paths are behaviourally equivalent
  - retirement of the FS family, or UTE-4 deletion

I confirm this approval does not relax a permission check, does not move a
refusal's timing, and does not relax a file-effect negative control.

Signed: <owner name>
On:     <YYYY-MM-DD>
```

`[PROPOSED-BY-MEMO]` **This request does NOT authorise**, and a signature on it
would not authorise:

1. a `SemanticDifferencesResolved` verdict by itself — the term is still derived
   from the record by the gate, and coverage/negative-control findings still
   refuse the row;
2. retirement of the FS family, or any UTE-4 deletion;
3. a change to any permission check, admission decision, refusal timing, or
   file-effect negative control;
4. any coverage claim for `read_image` or for per-member negative controls;
5. any cross-family inference (an FS approval is not a Web/PTY approval);
6. an exemption from the evidence rules (the record must still be committed,
   named, dated and `PR #<n> @ <40-hex>`-referenced).

`[UNKNOWN]` The owner's preferred `record` path and reference form are not fixed
by this memo; the gate accepts any committed, safe, repo-relative path declared
in the ledger's `approval.record`, and `RETIREMENT.md` §3 leaves the convention
to the owner.

`[PROPOSED-BY-MEMO]` The executor has **not** written such a record. Doing so
would be the fabrication the ruling explicitly forbids.

---

## 8. Unknowns and gaps (stated, not smoothed)

| # | `UNKNOWN` | what would close it |
|---|---|---|
| 1 | The rc.5 host source tree (`packages/fs/tool-fs`, `@deepseek-ai/*`) is **not present** in this worktree (`tests/deepseek-harness-*` is gitignored and absent). The native code list in §2.1 is therefore derived from **recorded** evidence in this repository, not re-read from the host tree. | provision the pinned next-host tree (`docs/TEST_METHODS.md` §11) and re-derive the code list from `tool-fs/src/*` and `fs-local/src/index.ts` |
| 2 | The rc.5 `mapError` behaviour (§4.1 of `RETIREMENT.md`) is recorded as a measured crash from an earlier run; it was not re-executed in this slice (no boot, by design of this slice). | a host-free probe that raises `FS_SANDBOX_DENIED` from a lane-only provider and observes the `policy.mode` deref |
| 3 | `read_image` has **no** baseline vector and **no** per-member negative control; nothing in this slice changes that, and no approval for it is requested. | a `read_image` vector in the golden corpus + `NC-MEMBER read_image` (owned by a parallel slice) |
| 4 | The `needs-adaptation` rows are adjudicated, **not adapted**. The FS switch must perform the adaptations and re-run the affected suites before the path is switched. | the switch PR, with this inventory as its checklist |
| 5 | Whether an `unsupported-mode` refusal exists on the native FS surface (no recorded pair today). The category and the legacy side exist; the native side is unmapped because nothing records it. | a recorded native refusal of that kind; adding it is a deliberate map edit, not a default |
| 6 | `FS_BINDING_*` codes are excluded by reasoning (§2.1), not by an exhaustive trace of every Team binding emitter. | a scan of `packages/tools/src/native-fs-binding.ts` and the realm row for every emitted `FS_BINDING_*` code |
