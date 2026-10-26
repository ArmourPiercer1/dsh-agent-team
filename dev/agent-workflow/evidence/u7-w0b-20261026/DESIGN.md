# u7-w0b — generic FamilyAssembly mount seam in `team-tool-plane.mjs` (design note)

Named center-interface PR. Branch `task/u7-w0b-plane-family-seam-20261026`, base
`88107ad71`, merged with master through `21f3f5b08` (#397). CORE PATCH BUDGET = 0.
Protected center (`arc-a-protected-center.json`, 33 paths): **zero diff**, no override.

## Problem (S1-MAP.md)

Each governed family was hand-wired into the plane: named imports of its
modules, one hand-written `registry.register` block, one hand-written
`ensure<X>ApprovalEntry` near-copy (five of them, differing only in a flag, a
name source, a latch shape and a caller-supplied `familyId` literal), and a
boolean in `kernelFamilies` read at four sites. A new family meant editing all of
them — the U6 stop condition "新普通 Family 仍需硬编码中心表".

## Shape after

```
packages/tools/families/          ← reviewed drop-in directory
  manifest.json                     reviewed list: module + sha256 + kernel capability backings
  index.mjs  (GENERATED)            static imports, manifest order  (scripts/gen-family-index.mjs)
  fs.mjs / process.mjs / search.mjs one FamilyAssembly descriptor per ordinary family
runtime/src/plugin/live/
  family-assembly.mjs               descriptor law, capability object, reviewed-set verifier
  approval-entry-binder.mjs         the ONE bind-once approval-entry binder
  team-tool-plane.mjs               drives every descriptor through the same phases; names none
  jobs-family-bridge.mjs            unchanged — jobs stays a NAMED BRIDGE (S4-JOBS.md)
```

**Descriptor** (`u7-family-assembly/1`, closed key set): `familyId`, `order`
(registration), `placement` (row order), `config` (closed boolean planeCfg keys,
wrong type ⇒ `PLANE_CONFIG_INCOMPLETE`), `claims(cap)`, `enabled(cap)`,
`disabledOwned(cap)`, optional `backends(cap)`, `build(cap)` →
`{definitions, contribution, diagnostics?, handoff?, teardown?}` (closed) or
`{refused}`, `refusalCode`.

**Plane phases**, identical for every family: verify the reviewed set (any
failure ⇒ `PLANE_FAMILY_MANIFEST_REFUSED`, nothing mounts) → closed config check
→ `enabled` → `backends` (shared set; the search trio reads the process shell
backend) → `build` → built-family check (contribution `familyId` and claimed
names must equal the descriptor's; placed rows must equal the claims) → place in
`placement` order → register in `order` with **`origin:'reviewed-manifest'` set
by the plane** → kernel ownership = claims of enabled families ∪ `disabledOwned`
of disabled ones ∪ names claimed by a registered candidate → bind through the ONE
binder → dispose: family `teardown`s, then revoke + drop every live candidate.

**Capability object** (`CAPABILITY_KEYS`, frozen): identity, validated mount
config, the row-level `decide`/`pa` edges every row was already constructed over,
shared backends, presentation/transport/host faces, the existing kit `backends`
seam. No kernel, registry, approval-table or grant handle; authority-shaped keys
throw at construction. The kernel's approval mutators are still called only in
the plane (the binder receives `approvalFor`/`bindEntry` ports) — ARC-D AD4's
second-ledger detector stays green.

**Binder law** (S2): familyId from the mount-time claim table of REGISTERED
descriptors, never from a caller; bind once per (scopeKey, name); a pre-mint
`null` is not latched; once latched an invalidated entry answers `null` for the
mount (no re-mint, no resurrection after revoke + re-register).

## What a new ordinary family must add (and nothing else)

1. its lane under `packages/tools/<id>-family/src/` (rows, executor, contribution);
2. one descriptor module `packages/tools/families/<id>.mjs`;
3. one entry in `packages/tools/families/manifest.json` (module + sha256, plus any
   new kernel capability backing it requires), then `node scripts/gen-family-index.mjs`;
4. its dist placements as one `scripts/dist-placements/NNN-<id>.json`, its p4t6
   booking as one `packages/testkit/test/p4t6-bookings/<lane>.json`, its census
   booking in `arc-a-family-census.json`.

Zero lines in `team-tool-plane.mjs`, `family-assembly.mjs`, the binder or any
protected file. Proven in-process by `u7-w0b-family-seam.test.ts` P0 (a probe
family outside the product manifest mounts, registers, is owned, and carries the
plane-set origin, with no plane change).

## Identity (S3/S4)

A 12-config mount fingerprint (placed names in order, row schemas, every
registered candidate with source/provider digests, claims, state, origin,
generation, kernel ownership and bound familyId over 14 names, diagnostics
backend ids, refusal codes) is **byte-equal to base 88107ad71** after each of
search, fs, process, the jobs change and the #397 merge:
`7b2babd6c22924f7321b137b3e9ae13caecdd88f72dcc04e33468ca661454552`. A planted
gate-precedence bug changed it (one hunk) — the probe is sensitive. The four
golden corpora (read 2893 / bash 299 / search 409 / fs-mutation 1440) replay
against their master-pinned digests.

## Disclosed limits

* Jobs is not on the seam (S4-JOBS.md); its block is the one named-bridge edge
  the F1 fitness law allows.
* The plane still carries non-family tool-name knowledge that is lane config, not
  family wiring: `DEFAULT_PLANE_NAMES`, the reserved-native and supported-takeover
  ledgers, Gate 0b name validation, `createLaneDecide`'s coarse classes, and the
  PA admission `invokeClasses`. F1 polices family identity (familyIds, family
  module paths, per-family flags/copies), not these.
* `a5g6-install-face-render` first-test cold-import timeout under parallel load
  (KNOWN-FLAKE-a5g6.md); `u6-arc-d` `ci03-native-parity` fails on master too
  (c2/BUDGET.md).
