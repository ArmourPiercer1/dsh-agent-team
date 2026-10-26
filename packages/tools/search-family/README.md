# `packages/tools/search-family` — the SEARCH Family lane (U6 PR5)

Owner-facing lane for the governed `grep`/`glob` rows' FAMILY-owned halves.
Read `src/index.mjs` first — it is the module-role map. This README states
the OWNER ROLE and the lane law.

## Provenance

Every byte of moved code came VERBATIM out of the center files at master
`5c03f7240` (PR #376 merge = post-PR3 master):

| family file | moved from (master lines) |
| --- | --- |
| `src/search-mechanics.mjs` | `src/plugin/live/plane-effect-backends.mjs` :106-539 (`grepArgv`, the fd-view remap/sink helpers, the `createAnchoredSearchBackend` TWO-body row, the ARCHIVED CANDIDATE-A `createAnchoredGlobBackend`) |
| `src/search-backend.mjs` | `src/plugin/live/search-backend.mjs` (whole file; ONLY the provider import depth re-based — one line, path-only) |
| `src/glob-backend.mjs` | `src/plugin/live/glob-backend.mjs` (whole file; ONLY the provider import depth re-based — one line, path-only) |
| `src/cancel-leg.mjs` | `src/plugin/live/cancel-leg.mjs` (whole file, byte-identical) |
| `src/search-row.mjs` | NEW placement face over the assembly-injected a5p5 trio registration face (PR3 dormancy law; the plane discards the shell ARM) |
| `src/search-contribution.mjs` | NEW §4/§10.3 contribution descriptor factory |
| `src/stream-drain.mjs` | NEW (u7 grep-drain, post-move lane fix): the ONE stream drain law both confined-rg rows share — watch stdout/stderr to their terminal event, bounded wait (`STREAM_DRAIN_MS` = the glob row's measured 250 ms), listeners released on every path |

The byte-identity of the moves is pinned by
`packages/runtime/test/u6-pr5-search-move-law.test.ts` (the moved regions
re-extract hash-identically from the pre-move master blobs).
M2 compares the MOVE COMMIT's own blobs (`b720fa8f6`) with those masters, so a
later lane-owned fix (u7 grep-drain changed `search-backend.mjs` and
`glob-backend.mjs`) is never mistaken for part of the move.

At move time (U6 PR5) the center kept its OLD export surface alive as a
temporary RE-EXPORT hub (`plane-effect-backends.mjs`), so pinned consumers —
the shipped search/glob suites, the `.d.mts` typings, team-tool-plane —
resolved unchanged (the PR2 read / PR3 shell precedents). U6 PR6 DELETED that
hub once this family's registration + C1/C2 were green; the pinned consumers
were retargeted to this lane in the same round. The family lane is the single
home of the search-slice logic: NO dual implementation exists at any slice.

## Owner role (what the Family owns / does NOT own)

OWNS (center-assembly-architecture §4): the two row Definitions
(name/description/parameter schema placement contract), the argument
contract, the effect BODIES (argv builders, the grep(1) port, the confined
rg walk + verified-handle anchor law, the cancel leg), and the result
SHAPES (`SearchOutcome` forms the reviewed renderer consumes).

DOES NOT OWN: admission, approval, grant mint, grant consume, placement
identity, lifecycle/drain/cancel decisions, the Result ENVELOPE (the host
registration face is attached by the trusted assembly). The contribution
descriptor states `admission/grantMint/grantConsume: 'kernel'` as data
(§ CI-06 — self-approval is unexpressable, and the Kernel's closed schema
refuses any other value). Every authority force used inside the bodies
(the anchor law, the verified-handle seam, the confined provider, the
lane `decide` + PA edges reached only THROUGH the injected a5p5 transport)
is INJECTED by the trusted assembly point or reached through the public
face of the OWNING lane — the lane imports no plane, no Kernel, no Host
internals.

## The native-behavior contract (slice plan §10.5-5)

The rg vocabulary is the host PUBLIC package `@deepseek-ai/dsh-tool-fs-search`
at the pin (`buildGrepCommand` / `buildGlobCommand` / `parseGrepArgs` /
`parseGlobArgs` / `resolveRgPath` / `GLOB_MAX_RESULTS`) — the "real native
behavior contract": the lane bakes argv and parses output EXACTLY as the
host package does, inside the confined provider face (kernel-enforced read
scope), anchored at the governed root. The golden-vector gate
(`packages/runtime/test/u6-pr5-search-golden-vectors.test.ts`) pins the
whole canonicalization pipeline byte-for-byte against the master recording
over a corpus generated FROM master (argv forms, effect projections, the
operation-permission refusals, presentation shapes).

## Lane law (imports, dist, tests)

- Allowed outward edges, and only these: `node:*` builtins,
  `@deepseek-ai/dsh-tool-fs-search` (host public package — the same pin the
  center rode), `../../../runtime/sandbox-provider/index.js` (the reviewed
  confined process provider public face — CI-07 named provider, booked as a
  NAMED MOUNT row in `a5p4-lane-hygiene`),
  `../../../runtime/controlled-fs/src/index.js` (`verifyOpenedHandle` —
  referenced, never copied), and the SIBLING FAMILY public faces:
  `../../fs-family/src/index.mjs` (`resolveAnchored` — the one anchor-law
  home) and `../../process-family/src/index.mjs` (`SYSTEM_RX` — the one
  provider grant-entry-builder home). NO imports of the plane
  (`src/plugin/live/*`), the governance-center lane, tool-dispatch, the
  dormant a5p5 lane, or Host internals.
- DIST MIRROR: every `.mjs` here rides `scripts/place-dist-glue.mjs`
  PLACEMENTS and mirrors byte-identically under
  `packages/runtime/dist/packages/tools/search-family/src/`.
- TESTS: the pinned search/glob/cancel suites were re-pointed to this lane
  (moved suites ride along: `alpha5-search-backend`, `alpha5-glob-backend`,
  `alpha5-glob-backend-adversarial`, `alpha5-g6b-rc-first`,
  `a5-cancel-search`, `a5-cancel-glob`, `a5b3-cancel-leg`,
  `alpha5-glue7-plane-backends`, the harnesses, and the integration
  mounts), plus the PR5 gates: `u6-pr5-search-move-law` (move byte-law),
  `u6-pr5-search-golden-vectors` (native-behavior corpus),
  `u6-pr5-kernel-flow` (the search family on the Kernel), and the
  `u6-arc-a-fitness` suite's census/name scans.

## Admission claim — the ANCHORED form (U7-6 GLUE-4)

What a governed search row DECLARES as its demand is owned by the a5p5 lane
(`packages/tools/a5p5-tools/src/effects-schema.ts`, module header + the
anchored law); the rows' BACKEND anchoring is this family's (`resolveAnchored`
/ `openAnchoredWalkRoot`). Since U7-6 the production plane mounts the search
rows anchored: `effectAnchorRoot = fsInstance.rootDir` (the same absolute
root the backends anchor at), and the derived claim is the governed WALK
SURFACE, never the raw target —

- `team_grep` → `tool-invoke(grep)` + `list(directory @ root)` + `read(absolute-path @ root)`;
- `team_glob` → `tool-invoke(glob)` + `list(directory @ root)`;
- `team_bash` → `tool-invoke(bash)` (the anchor never touches the shell arm).

Consequences, stated plainly: a call whose target escapes the root derives
the SAME effect set as an in-root call and therefore ADMITS under a policy
that covers the surface — the containment refusal then comes from this
family's own anchor law (`target-outside-governed-root`, zero spawn), which
is the layer that actually inspects the target. And the claim is broader
than a narrow in-root file target by design: it is the row's WHOLE governed
surface, so a policy that does not cover the root refuses EVERY search call
on that row (STRICTER than the historical target-scoped claim, not looser).
The historical target-scoped derivation remains the default for every
consumer that passes no anchor — byte-identical, including the run8 wire
fingerprints (evidence `dev/agent-workflow/evidence/u7-6-glue4-20261026/`).
