# Alpha.3 PR2 — EffectivePermissionAssembler: scope constraints and environment

Task order (the task contract this round executed against), restated as working constraints:

- **SCOPE**: implement `EffectivePermissionAssembler` + targeted tests. Location
  `packages/runtime/effective-policy/`, exported through that lane's `index.ts`.
  Pure in-memory. **No production wiring**: no tool/pre-execute hook, no GMS,
  no approval UI, no notification, no durable write, no StorageDomain binding.
- **CONSUMES**: the Blueprint baseline policy, the Template static policy, and
  the MemberInstance overlay snapshot(s) (the PR1 `PermissionOverlaySnapshot`
  vocabulary; the port's `latest` / `history` output shapes), and must carry
  provenance (which layer / snapshot / actor / mutationId / reason the winning
  rule came from).
- **REUSES** the real Alpha.2 resolver surface
  (`packages/runtime/operation-permission/permission-resolver.ts` + `types.ts`),
  the `packages/runtime/effective-policy/activation-policy.ts` lane conventions,
  and the operation resolver: exact / subtree / any resources, allow-ask-deny
  lanes, **higher-layer MATCHED rules take precedence over lower layers, only
  then same-layer deny > ask > allow**. No naive field-level overwrite; no
  global-deny-suppresses-everything shortcut; absence falls through. The
  operation resolver stays a pure function: this PR does not mutate, wrap or
  reimplement it.
- **TESTS** (targeted, no PR1-gate duplication, no PR3 pre-build): overlay and
  static deny, fallback, same-layer deny > ask > allow, provenance correctness,
  MemberInstance isolation (two instances' overlays never cross). Offline
  vitest, host-free.
- **DO NOT TOUCH**: PR1 permission-governance semantics (read-only imports are
  fine), `TeamDomain/stores.ts`, the operation resolver's internals (no
  semantics change), the client, tools, remote.
- **FROZEN SEMANTICS read before implementing**: the three local governing docs
  (`docs/plans/active/dsh-agent-team-alpha3-permission-governance-{ADR,design,
  implementation-plan}-revised.md`), ADR §2 (append-only FULL snapshots,
  highest generation = current authority, history audit-only, no replay),
  ADR §3 (Stage 1 assembly vs Stage 2 pure resolver), ADR §4 (the precedence
  order + "do not implement global deny precedence" + same-layer
  deny > ask > allow), ADR §7 (no actor-based precedence), design §3.1 (both
  "field-level overwrite" and "all denies globally override all allows" listed
  as incorrect readings). Doc hashes verified against PR #57 §2: ADR
  `1af9899c54192ab0d80f3c4e591ab9b04f5d59fc2337cd3c1967447262887803` (4282 B),
  design `cb916ce3b733403fda69557cc72135b82905be46de5295e059c734ed7b2aa8e5`
  (3731 B), plan
  `2d4c0d4479cffb5846b3192da850723700936337e30efa893b9a120eb3d7f365` (2959 B).

## Environment facts (honest accounting)

- **node_modules provenance**: `node_modules/` in this worktree (root +
  `packages/{client,domain,runtime}/node_modules`) was **COPIED READ-ONLY from
  `.worktrees/pr56-client-panel`**. No `pnpm install` was run and none is
  possible (offline). This is a dependency-copy workaround, **not** an install:
  nothing here asserts "install succeeded".
- Toolchain used from that tree: `node_modules/.bin/{vitest,tsc,eslint}`,
  node v24.21.0, vitest 4.1.11.
- **No host, no live anything**: nothing was started on :3080 or :3180, no
  DSH_HOME world was created, no host process was touched. Every check in this
  evidence directory is an offline `vitest` / `tsc` / `eslint` / `node scripts/*`
  run.
- **Git**: worktree `.worktrees/pr2-effective-assembler`, branch
  `task/alpha3-pr2-effective-assembler`. Development base was the PR1 head
  `5bc775f9c6c7fac4ce03e5233e62d257ad370495`; the coordinator's correction
  (2026-10-01) requires the shipped branch to sit on the ACTUAL master
  `9e2ac40d44a90c8283e6f7ca4bd7bfb54dcfe123`, which additionally preserves the
  PR55 infra. Because the branch was never pushed (`git ls-remote` empty
  verified before the move), the branch was re-landed with
  `git rebase --onto origin/master 5bc775f9…` — a local branch move, not a
  force-push of shared history. The DRAFT PR therefore has base `master`, and the
  earlier "stacked on PR #57" wording is retired (PR #57 is merged). No rebase of
  any pushed branch, no force-push, no merge.

## CAS prose boundary (carried forward from PR1, stated again for PR2)

The overlay repository is **single-repo-instance serialized**: `latest` reads
under a per-instance mutex and `append` serializes through the same store. Every
durable CAS story (the generation-conflict semantics PR1 pins) is true **within
one repository instance**; this repository makes no cross-process atomic CAS
claim. PR2 itself performs **zero** durable operations, so it neither strengthens
nor weakens that statement — it only reads a snapshot value handed to it.
