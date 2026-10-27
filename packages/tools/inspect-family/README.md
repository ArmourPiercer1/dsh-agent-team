# packages/tools/inspect-family — `dsh.inspect-family` (U7-F)

The governed `skill` / `cordis_inspect_list` / `cordis_inspect_query` rows
(aliased mount spellings `team_skill` / `team_cordis_inspect_list` /
`team_cordis_inspect_query`), delivered through the FamilyAssembly seam:
descriptor `packages/tools/families/inspect.mjs`, mount gate
`config.teamToolPlane.inspectFamilyEnabled === true` (default OFF).
One family, three rows, always all-three-or-refused; READ-ONLY effect law
(`tool-invoke` + `read`/`meta` arms only — the contribution states it as
data and family-assembly refuses anything else).

## Lane law (imports, dist, tests)

- Allowed outward edges, and only these: `node:*` builtins,
  `../../../contracts/src/index.js` (contracts — row/params shapes),
  `../../../domain/tool-governance/src/index.js` (the ONE thin effect-grammar
  face, `parseRequestedEffectSet` — the same single face the fs-family
  executors carry, booked file-by-file in
  `scripts/audit-a5-tool-governance-imports.mjs`), and the SIBLING FAMILY
  public faces: `../../fs-family/src/index.mjs` (`lexicalAnchor`,
  `resolveAnchoredPath` — the one anchor-law home) and
  `../../search-family/src/index.mjs` (`callAborted`, `raceConfinedSettle`,
  `CANCEL_CODE_ABORTED` via its `export * from './cancel-leg.mjs'` — the one
  cancel-leg race home). NO imports of the plane (`src/plugin/live/*`), the
  governance-center lane, tool-dispatch, tool-admission, or Host internals.
  Booked in `scripts/eb3-family-boundaries.mjs` (`dsh.inspect-family`).
- PA call law (measured live, C2 boots): the row's PA admission call carries
  the host-allocated call correlation (`exec.tokenKey`) as its callId, and
  the effect `tool-invoke` arm spells the MOUNTED placement name — the
  call-level facts entry resolves admission behind exactly that identity and
  refuses everything else fail-closed with zero effect.
- DIST MIRROR: every `.mjs` here rides `scripts/place-dist-glue.mjs`
  PLACEMENTS and mirrors byte-identically under
  `packages/runtime/dist/packages/tools/inspect-family/src/`.
- TESTS: `packages/runtime/test/u7f-inspect-family-c1.test.ts` (offline
  determinism: mount/SHUT arms, all refusal arms typed with zero effect, the
  read-only proof I9, the placement-spelling law I10, and the X1/X2 mutation
  controls that turn the anchor law and the no-late-result law RED when
  planted broken). Live C2 evidence: `dev/agent-workflow/evidence/
  u7-f-inspect-20261026/c2/`.
