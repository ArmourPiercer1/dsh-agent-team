# `packages/tools/fs-family` — the FS Family lane (U6 PR2)

Owner-facing lane for the governed `read` row's FAMILY-owned halves. Read
`src/index.mjs` first — it is the module-role map. This README states the
OWNER ROLE and the lane law.

## Provenance

Every byte of moved code came VERBATIM out of the center files at master
`2db321f63` (PR #369 merge = U6 PR1):

| family file | moved from (master lines) |
| --- | --- |
| `src/fs-mechanics.mjs` | `src/plugin/live/plane-effect-backends.mjs` :69-242 (read constants, governed window law, anchor law) |
| `src/read-presentation.mjs` | `src/plugin/live/team-tool-plane.mjs` :144-282 (B2 presentation block) |
| `src/read-executor.mjs` | `src/plugin/live/plane-effect-backends.mjs` :1066-1550 (the `read` effect body) |
| `src/read-row.mjs` | `src/plugin/live/team-tool-plane.mjs` :1723-1783 (B13 row Definition), restructured as `buildReadRowDefinition` |
| `src/read-normalizer.ts` | NEW pure slot carrying the moved `effectiveReadWindow` + `case 'read'` projection (A2C-5 semantics) — the lane's ONE TypeScript module, statically imported by `canonical-operation.ts` and emitted on the runtime build face (the lane's .mjs runtime modules ride `scripts/place-dist-glue.mjs`) |
| `src/fs-read-contribution.mjs` | NEW §4/§10.3 contribution descriptor factory |

The center keeps its OLD import/export surface alive as a RE-EXPORT
(`plane-effect-backends.mjs`), so pinned consumers, the `.d.mts` typings and
the shipped read suites resolve unchanged.

## Owner role (what the Family owns / does NOT own)

OWNS (center-assembly-architecture §4): the row Definition (name/description/
parameter schema), the argument & window contract, the effect BODY, the
result SHAPE (presentation face), and the PURE operation-projection
normalizer the center's canonicalizer consumes.

DOES NOT OWN: admission, approval, grant mint, grant consume, placement
identity, lifecycle/drain/cancel decisions, the fingerprint computation. The
contribution descriptor states `admission/grantMint/grantConsume: 'kernel'`
as data (§ CI-06 — self-approval is unexpressable, and the Kernel's closed
schema refuses any other value). Every authority force used inside
`read-executor.mjs` (lane `decide`, the PA edge, the fresh policy, the
containment seam) is INJECTED by the trusted assembly point; the normalizer
has zero imports by design (sup-a §5 condition 7: the family's canonicalizing
part is PURE — identity is never minted from family data).

## The fingerprint golden law

`normalizeReadProjection` + the center's `sha256:` fingerprint computation
must reproduce master's `canonicalizeOperation('read', …)` fingerprints
BYTE-IDENTICALLY over the pinned corpus — durable grants/rules keyed by that
fingerprint survive the move. Gate:
`packages/runtime/test/u6-pr2-read-golden-vectors.test.ts`.

## Lane law (imports, dist, tests)

- Allowed outward edges, and only these: `node:*` builtins,
  `../../../contracts/src/index.js` (canonical JSON),
  `../../../runtime/controlled-fs/src/index.js` (`isBeneath`,
  `verifyOpenedHandle` — referenced, never copied), and the frozen
  `parseRequestedEffectSet` vocabulary face of
  `../../../domain/tool-governance/src/index.js` (registered consumer:
  `scripts/audit-a5-tool-governance-imports.mjs` + the pinned set in
  `packages/domain/test/a5p0-layer-audit.test.ts`). NO imports of the plane
  (`src/plugin/live/*`), the governance-center lane, tool-dispatch, or Host
  modules.
- DIST MIRROR: plain `.mjs` files are tracked as byte copies under
  `packages/runtime/dist/packages/tools/fs-family/src/` via PLACEMENTS in
  `scripts/place-dist-glue.mjs`. Edit here, run `node
  scripts/place-dist-glue.mjs`, co-commit the dist bytes (check D of
  `check-artifacts-committed.mjs` gates parity).
- Tests live with the runtime suites (`packages/runtime/test/u6-pr2-*.test.ts`
  + the moved read suites); the lane has no package.json and is not a pnpm
  workspace member — same posture as `packages/tools/a5p5-tools`.
