# CONTRACT CHANGE REQUEST — the search face cannot be judged by the durable overlay

**Raised:** round 63 (D3 live run, two agreeing boots). **Class:** a contract gap, not a bug in the centre's
logic. **Blocks:** a governed Member's `grep`/`glob` — i.e. the B probe ladder's third rung — on a real host.

## Measured

An **in-lane** `grep` on a governed Member:

```
laneDecision=allow
refusalCode=ADMISSION_OVERLAY_FAULT
detail=canonicalization failed for tool "grep": tool-unsupported
```

The closed permission vocabulary is `read/read_image/write/edit` + `bash/pwsh`
(`packages/runtime/operation-permission/types.ts:59-64`, `:90-93`); `classifyPermissionTool` returns
`unsupported` for a search tool (`canonical-operation.ts:260-267`), and the A5 adapter maps that fault to a
DENY. So a call the compiled lane ALLOWS is refused because the overlay cannot express it.

That is fail-closed (good) but wrong in both directions: the capability is lost, and the refusal is reported as
an overlay FAULT rather than "this face is not governed by the durable overlay".

## Why it was not caught earlier

The in-process arms feed the overlay a canonicalizable locator; the live path is the first place the search
face meets `canonicalizeOperation` for real. A1/B's probe ladder planned `read → write → grep → web_fetch →
persistent bash → run_code`; rung 3 is the one that hits this.

## Two lawful shapes

| # | shape | consequence |
| --- | --- | --- |
| **A** | Extend the permission vocabulary with a **search face** (subtree resource), so `grep`/`glob` canonicalize and the durable overlay can deny them precisely | contract change (vocabulary + canonical-operation + tests); keeps one judgement path |
| **B** | Rule that the durable overlay governs ONLY the canonicalizable faces, and the compiled LANE alone judges the search face; an `unsupported` classification must then mean "no overlay opinion", NOT a fault | no vocabulary change; the search face gets lane-only governance, which is weaker than the overlay but explicit |

## Recommendation

**B now, A next.** B is a small, honest rule that restores a preserved capability immediately and states its
governance level; A is the durable answer and belongs with the process-lane ruling (both are "the closed
vocabulary is smaller than the tool surface").

## What must not happen

- Do not widen the overlay into a grant path to work around this.
- Do not silence `ADMISSION_OVERLAY_FAULT` generally: for a face the vocabulary DOES cover, a canonicalization
  fault must still deny.
