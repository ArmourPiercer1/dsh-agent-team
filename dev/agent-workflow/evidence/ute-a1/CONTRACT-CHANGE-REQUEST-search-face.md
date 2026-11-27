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

---

## Shape B implemented (round 64, 2026-11-22) — no contract change

**Decision: shape B, as recommended. The vocabulary is unchanged.** The rule is now expressed where the
overlay's answer is produced, not at the caller:

- `packages/runtime/src/plugin/vnext/overlay-decision.mjs` — `prepare` classifies the tool by vocabulary
  membership (`isPermissionToolName`, the same closed set `canonicalizeOperation` throws from) BEFORE any
  canonicalization. A tool outside it is stored as `noOpinion` and never canonicalized; a tool inside it is
  canonicalized exactly as before (a failure there is still stored as a FAULT). `decide` returns
  `'no-opinion'` for that entry — it neither denies nor throws.
- `packages/runtime/src/plugin/vnext/admission-port.mjs` — the synchronous port treats `'no-opinion'` as an
  abstention (the lane verdict stands) and records the overlay's own answer as the durable fact's
  `overlayOutcome: 'deny' | 'no-opinion' | 'fault'`. A thrown canonicalization fault on a covered tool still
  becomes `ADMISSION_OVERLAY_FAULT` and `overlayOutcome: 'fault'`; a lane `deny` never consults the overlay,
  so its fact carries no `overlayOutcome` at all.
- `packages/runtime/src/plugin/vnext/admission.ts` — `InvocationAuthorityFacts.overlayOutcome` is declared and
  projected by `invocationFactsOf`, so the distinction is durable rather than inferable from prose.

What the durable fact now answers, without parsing a refusal string: **why** the overlay abstained. A covered
tool with no matching rule and an out-of-vocabulary tool both read `overlayOutcome: 'no-opinion'` (the overlay
imposes nothing); a canonicalization fault reads `'fault'` and is a refusal; a stored restriction reads
`'deny'`. The search face is admitted on the lane's verdict alone.

**Arms** (`packages/runtime/test/vnext-admission.test.mjs`, `ADM-103`…`ADM-106`, node:test, real
`installMemberCentre` + real `createOverlayDecisionProvider` + real canonicalizer; only the durable overlay
PORT is a declared-input double): (a) a covered tool with a matching stored deny still denies
(`ADMISSION_OVERLAY_DENY`, `overlayOutcome=deny`); (b) a covered tool whose fs seam cannot canonicalize still
denies with `ADMISSION_OVERLAY_FAULT` (`overlayOutcome=fault`, reason names `resolver-threw`); (c) an in-lane
`grep` is admitted, the fact reads `overlayOutcome=no-opinion`, and the fs seam is never consulted (the tool
never enters canonicalization); (d) an out-of-lane `grep` is `LANE_DENY` with no `overlayOutcome` (the overlay
was never asked) and never an overlay fault.

**Live re-measure** (`run-boot-d3.mjs --boots 2`): the result is recorded in `D-BOOT-FEASIBILITY.md` §16 and
`CAPABILITY-MATRIX-C.md` ("Round 64"). The crash judge's in-flight call stays the `edit`; the `grep` is now the
admitted search probe before it.

## Round 98 — DECIDED: shape B is the declared support level (not full dynamic permission governance)

**Owner ruling `docs/reviews/20261124-0151.txt` §Search (2026-11-24).** Shape B is the support level for
this generation, with the limitation stated plainly: a durable Overlay deny aimed at ordinary file reads
does **not** automatically deny `grep`/`glob`; the Overlay returns `no-opinion` for tools outside its
vocabulary, and the compiled FS Read Lane alone judges the search. The ruling's required negative control
(parent ALLOW, child DENY, recursive search must not read/return the child) is GREEN over the real search
paths — `SLICE-39` — because the confined `subprocess` face compiles the effective lane once and Landlock
cannot express a nested deny (`PATH_NESTED_DENY_UNEXPRESSIBLE`), so the spawn is refused before a process
exists: no match and no child byte. This is a wholesale refusal of the dangerous scope, not a root-path
check. **Shape A remains future work** (a subtree search face in the closed vocabulary) and is the only
shape that can express a nested deny precisely.

## Residual (what shape B does NOT buy)

- **The search face is governed by the LANE only.** A durable overlay rule cannot restrict `grep`/`glob` (or
  `web_fetch`, `run_code`, …): those faces are outside the overlay's vocabulary, so an operator cannot deny
  them through `grantInstance`-style durable rules. The lane ceiling is the entire governance for them. That
  is the explicit weakening shape B accepts.
- **The CENTRE judges the search ROOT, not the traversal.** `grep`/`glob` are judged on the `path`
  argument (defaulting to the workspace root), so a lane decision is about the root the call names. Whether
  every file the scan opens is independently confined is the PROVIDER path's question, not this CCR's, and
  is not measured here.
- **Shape A is still the durable answer.** Adding a search face to the closed vocabulary (subtree resource +
  canonical-operation + tests) is the only shape that lets the durable overlay deny a search precisely. It
  remains open and belongs with the process-lane ruling.
