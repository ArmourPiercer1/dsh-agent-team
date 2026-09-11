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
