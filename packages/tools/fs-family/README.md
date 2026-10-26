# `packages/tools/fs-family` — the FS Family lane (U6 PR2 read; U7-9a write/edit/read_image)

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

At move time (U6 PR2) the center kept its OLD import/export surface alive as
a temporary RE-EXPORT hub (`plane-effect-backends.mjs`); U6 PR6 DELETED that
hub once this family's registration + C1/C2 were green — this lane is now the
single home (ledger `dev/agent-workflow/evidence/u6-pr6-20261026/legacy-path-removal.md`).

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

## U7-9a — the mutation + image rows (governed `write`, `edit`, `read_image`)

CA-01's first per-family delivery: the three new members join the ONE
`dsh.fs-family` candidate (`fs-family-contribution.mjs`) through the CLOSED
contribution schema and the SAME kernel — one ledger with `read`, bash, the
search family and the job family; the center's 33 protected files carry ZERO
diff (ARC-A L1 fitness scan; `canonical-operation.ts` byte-identical). The
plane config that mounts them is the u6-fs read World's config byte-for-byte
(`realmId + fsInstance` + the shadow-assembly keys) — zero assembly growth.

Mechanics live in `fs-mutation-mechanics.mjs` (shared parse/anchor/lane law),
one executor per tool, one row Definition per tool, and the image row's
bounded verified-handle read port (`image-read-port.mjs`). The post-consume
closures (verify-before-truncate `openWriteFd`, `O_CREAT|O_EXCL` create, the
same-fd edit receipt pair) are the controlled-fs provider's own law — the
row carries ONLY the `parseRequestedEffectSet` fingerprint, never an
authority decision.

DISCLOSED DEVIATIONS from the native presets (all STRICTER, none looser —
the native tool's success surface is preserved for in-scope calls):

1. `write` never echoes before/after bytes back (no `FsEditReceipt`-style
   disclosure on the write row; D-C2-1).
2. `write` refuses payloads over 1 MiB (native has no cap) — bounded
   in-flight memory for a governed body.
3. Unknown call parameters are REFUSED (native ignores them) — the closed
   schema's `IO_ARG_*` center codes carry the refusal verbatim.
4. `write` and `edit` serialize per canonical path IN-PROCESS (measured
   boot-law: same-path races become sequences — final bytes are ONE whole
   payload and receipts keep their own bytes; native interleaves).
5. `edit` never CREATES (native edit also refuses missing files; stated for
   completeness) and its governed lane needs the center's per-effect
   coverage pair: a `tool:edit` rule covers `tool-invoke(edit)` + the
   `edit`/`write` effect, and a `tool:read`-class rule must ALSO cover the
   read effect the body performs (measured law: missing half =
   `IO_POLICY_UNSUPPORTED`, never a half-covered admit).
6. `read_image` answers HONESTLY: when the model-route/attachment seams the
   native law requires cannot be resolved it refuses typed
   (`IMAGE_ROUTE_UNRESOLVED`) — it never degrades to returning bytes the
   model cannot route; it has no delete face and no mkdir-recursive face.
7. `create` via `write` is one-shot (`O_EXCL`; EEXIST = refusal, zero bytes)
   — no recursive parent creation; parent dirs must exist.
8. The verified-handle re-check rides `/proc/self/fd` (Linux hosts; the
   whole governed surface is Linux-pinned by the landlock launcher).
9. Refusal vocabulary is the CENTER's frozen codes (`IO_*`, `TOOL_*`,
   `IMAGE_*` mirrors of `canonicalizeOperation`'s surface) — the family
   never invents error words (golden gate:
   `packages/runtime/test/u7-9a-mutation-golden-vectors.test.ts`, 1440
   vectors, digest-pinned).

C1: `packages/runtime/test/u7-9a-fs-mutation-c1.test.ts` (33 legs). C2:
world-factory suite `--suite u7-fs-mut` (ONE host boot per run; verdicts from
the runner's OWN disk reads + host-log witnesses, never the transcript).
Boot history and the measured host-side laws (PA authority leg,
`paPlacementNameOf` family spelling, CI-03-member-as-native-control, the
test-host sandbox refusing member NATIVE writes) live in
`dev/agent-workflow/evidence/u7-9a-fs-20261026/`.
