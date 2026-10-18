# Blueprint authoring (issue #2 blueprint-loading, plan §13/§14)

The local, no-HMR authoring loop for saved Team blueprints. This round
deliberately ships **no full-featured web Blueprint editor** and adds
**no Blueprint CRUD Remote** (plan §14): the loop is a local helper +
the panel's manual refresh.

## The loop

```text
1. stage        node scripts/blueprint-authoring.mjs stage <blueprintId> [--dir <blueprintDir>]
2. edit         open <blueprintDir>/<blueprintId>.draft.yaml in your editor
3. validate-save node scripts/blueprint-authoring.mjs validate-save <draftPath> [--dir <blueprintDir>]
4. refresh      in the New Team panel, click "Refresh blueprints" (刷新蓝图目录)
                 → the new source state is visible immediately (no Cordis HMR)
```

- **`stage`** writes/keeps `<blueprintDir>/<blueprintId>.draft.yaml` and
  performs **no validation**. An existing draft is kept byte-for-byte —
  the point is that the user edits the draft directly in their editor.
  A fresh draft gets a minimal CLOSED v1 skeleton (the same document
  shape the strong parser accepts), so an untouched draft still
  validates and saves cleanly. The only refusal is a filename-safety
  guard (path separators / `..` would escape the blueprint dir).
- **`validate-save`** does exactly three things and **nothing stronger**
  (no strong semantic validation):
  1. the **format inspector** (the BP-B identity-level read: the closed
     structural + identity checks — one logically broken file can never
     sink the catalog);
  2. the **identity extraction** (`{ schemaVersion, blueprintId,
     revision }` — the minimal immutable-revision identity);
  3. the **atomic replace/write** of `<blueprintDir>/<blueprintId>.yaml`
     (same-directory tmp + fsync + `fs.rename` — a crash never leaves a
     torn target).

  A document the inspector accepts but the strong parser rejects is
  **written anyway** (by design): the saved-source catalog lists it
  (the index is inspector-based) and RESOLVING it fails closed with the
  strong parser's exact diagnosis — the plan's tolerance for a
  logically broken saved file (it must not take down the catalog).

## Where blueprints live

- The host row config's **`blueprintDir`** is the directory the
  production source index rescans (the live catalog's saved sources):
  `*.yaml` / `*.yml` are candidate saved sources; `*.draft.yaml` /
  `*.draft.yml` are **ignored** (a draft is invisible to the catalog
  until `validate-save` promotes it). A directory with no index entry
  (absent config) lists only the row's boot anchor.
- The CLI's `--dir` defaults to `./blueprints` for `stage` and to the
  draft's own directory for `validate-save`.

## What "frozen" means (the unambiguous definition)

> **Frozen means the runtime AUTHORITY no longer changes — it is NOT an
> OS file read-only bit that guarantees the user cannot edit the file.**

When a TeamSession is minted, its blueprint snapshot is **frozen** into
the runtime's Blueprint registry (the row stores the source text + the
`contentHash` — the bound Teams resolve THAT row, never the file).
Consequences:

- an **external edit of a frozen file changes NO Team/runtime
  authority** — the registry's frozen copy keeps serving every bound
  Team;
- a **same-revision re-save can never alter a bound Team's snapshot** —
  the registry row for that `(blueprintId, revision)` identity already
  exists and is authoritative;
- to change a live Team's blueprint you author a **new revision**
  (a new identity) and bind it to a new TeamSession — the existing
  Teams keep their frozen snapshot (immutability is the invariant).

## The frozen write guard (the plan's conditional)

IF the helper can obtain the registry repository **through the same
process / a test harness**, the frozen identity **must** directly
reject a same-revision write. The exported `validateAndSave` accepts an
optional `registryProbe(blueprintId, revision) -> row | null`: present
and answering a row → the save is refused under `frozen-revision` (see
`packages/testkit/test/bp1h-blueprint-authoring.test.ts`).

The **standalone CLI has no public durable seam** to the live runtime
registry (the production seam is built from the DSH `storageDomain`
public service, in-process only), so it carries no probe: the runtime
registry remains the authority and the documented fallback applies
(frozen copy keeps serving; a same-revision write changes no
authority). **No Remote v5** was added to let a CLI query frozen state
(plan §14: 不得为了给 CLI 查询 frozen 状态新增 Remote v5).

## Out of scope this round

- no web Blueprint editor, no Blueprint CRUD Remote, no Remote v5;
- no strong semantic validation in the helper (the strong parser stays
  the single strong entry, at resolution/freeze time);
- no automatic polling or subscription in the panel — the refresh is
  the user's explicit click (`[data-intent-refresh-catalog]`, plan
  §13: generation-guarded, per-row detail reset, selection reset when
  the picked blueprint disappears).

## Author-visible grammar tightenings (post-Alpha.4 fix round, 2026-10-16)

Documentation sync for `fix/post-alpha4-20261016` (audit items TM-8, PRS-1,
PRS-2, NRM-2, G4/G4-R in `docs/plans/memo/post-alpha4-debt-register.md`).
These are fail-closed tightenings of the strong parser/validator only —
the stage/validate-save loop above is unchanged (`validate-save` still runs
just the format inspector; a tighten-rejected document is written anyway
and fails at resolution with the typed diagnosis). Blueprints that
previously resolved may now be **refused at resolution**; the authoring fix
is to correct the document, never a runtime relaxation.

- **`capabilities.builtinToolDeny` exact-tool-name grammar (TM-8).** Each
  entry must be an exact built-in tool name: no trimming and no case
  folding happen, so a copy-pasted stray character used to create a deny
  rule that silently never matched. Now refused **at parse** with a typed
  `MALFORMED_DTO` carrying the entry path, in three branches:
  1. C0 control characters or DEL (`U+0000–U+001F`, `U+007F`);
  2. whitespace anywhere — leading, trailing, or embedded (JS `/\s/`);
  3. C1 controls and invisible/format code points that both previous
     scanners missed: `U+0080–U+009F`, soft hyphen, zero-width/joiner/
     direction marks `U+200B–U+200F`, `U+2028`/`U+2029`, bidi overrides/
     embeddings `U+202A–U+202E` and isolates `U+2066–U+2069`, word joiner
     `U+2060`, BOM `U+FEFF`. Lane-scoped: prose/display fields keep their
     existing scanners.
- **Recursive YAML anchors are typed, not a crash (PRS-1).** A document
  like `metadata: &m { self: *m }` decodes to a genuinely cyclic object;
  it used to reach `RangeError: Maximum call stack size exceeded` in the
  strong parser while the inspector called the same file OK. The cycle is
  now detected at the single decode point (heap-bounded explicit-stack DFS,
  G4-R — shared-but-acyclic alias reuse stays legal) and rejected with
  typed `MALFORMED_DTO` ("recursive anchor — a YAML node contains
  itself"), so `inspectBlueprintSource` and `parseBlueprint` give the same
  verdict for the same file.
- **Decode failures keep their cause (PRS-2).** A non-`YAMLError` decode
  failure (e.g. the yaml library's `Excessive alias count` /
  `Unresolved alias` ReferenceErrors) no longer collapses to a fixed
  one-liner: the typed code is unchanged and the original error name plus
  first message line are kept in the message and as `cause`.
- **Quota fields must be positive SAFE integers (NRM-2).** Values beyond
  `Number.MAX_SAFE_INTEGER` are rejected instead of silently coerced to
  the nearest double (two different source documents used to hash
  identically); the gate now matches the same-worded contracts gate.

## The `{3, 4}` dual-parsing window (v4 flip round, 2026-10-18)

Author-facing facts since the v4 flip (formal Schema ADR:
`docs/plans/memo/alpha5-tool-io-governance/ADR-vnext-blueprint-schema-v4.md`;
every claim below is machine-pinned by `packages/domain/test/a5fl1-blueprint-v4-flip.test.ts`):

> **Provenance (doc-sync round 2, 2026-10-18, post-merge).** This section is a
> **delivered master fact since the flip merged at `ee49c4c0`** (PR #324):
> `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [3, 4]`
> (`packages/domain/blueprint/src/schema.ts:87`) and the pin suites
> `a5fl1` / `a5fl2` / `a5fl3` are on master. Before that merge the same grammar
> shipped **dormant and unwired** at run set `[3]` (the fourth parser's own
> header: "WHY THIS FILE IS NOT WIRED … NOTHING shipped reaches the functions
> below", `packages/domain/blueprint/src/blueprint-v4.ts` @ `382e5fb6`,
> PR #316) — that is the history of this constant, not its current face. The
> route that authorized the stroke is the 4-stage table of `71af4f64` (PR #320):
> stages 1–3 ADR-gate-normal, stage 4 gated **only** on T-1. What the flip did
> NOT move stays disclosed in the bullets below: the family is a
> **document-face** binding (parse / freeze / hash), dispatch fail-closes at the
> Tool Binding verification gate, and the verified-effect feed is a later route
> (`ee49c4c0` commit body; live-host leg 14/14 under
> `dev/agent-workflow/evidence/alpha5/v4-flip/`).

- **Two versions RUN.** `schemaVersion: 3` keeps its frozen branch with zero
  load-time deformation (the same document hashes exactly what it hashed
  before the flip). `schemaVersion: 4` now parses and hashes through the
  production entry too — its core face is validated by the SAME frozen v3
  validator (the fourth parser delegates; it forks nothing).
- **What v4 adds.** Exactly one optional top-level field: the `toolBindings`
  effect-governance family (closed entry grammar: owner / name / authorization /
  io read-write-network lanes / execution facts — all values explicit, no
  implicit defaults, unknown keys refused at their full path, removed proposal
  fields refused BY NAME). A v4 document that declares no family declares
  nothing new. `toolBindings` is an UNKNOWN FIELD at v3 — refused there, as before.
- **The family moves the content hash.** Two v4 documents differing only in
  `toolBindings` are different blueprints; identity binds the family.
- **翻档 ≠ 退役 — the flip is not a retirement.** The window's DURATION and
  EXIT are the T-1 pending ruling; this round does not pre-set them, declares
  no v3 retirement, and demotes nothing (the retired set stays derived at
  `[1, 2]` — v1/v2 remain discoverable-with-identity, refused as
  operator-owns-the-migration). A never-defined version keeps the typed
  parse refusal unchanged.
- **Production effect acceptance is still closed.** A v4 document's
  `toolBindings` is parsed, frozen and hash-bound — but the runtime effect
  plane does not EXECUTE those lanes, and dispatch fail-closes at the Tool
  Binding verification gate. The same-stroke M-3 envelope Scope tables are
  **GRAMMAR-not-ACCEPTANCE**: the added scope classes
  (`fs-metadata` / `network-destination` / `domain-reference`,
  `packages/domain/authority-envelope/src/authority-envelope.ts:149-151`)
  PARSE, with zero new rung, and grant nothing by themselves; wiring the
  verified-effect feed is the effect-queue round's.
  Authoring a v4 document is therefore safe-but-dark for effects, and
  irreversible for identity: the point of no return is the FIRST authored v4
  document, not the constant flip.
