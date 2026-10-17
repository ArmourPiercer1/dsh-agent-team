# GLUE-5 — production entry assembly (alpha5-glue5-entry)

Round: **GLUE-5 prep writer — production-entry assembly**. Base = master
`01df26ca` + the three UNMERGED lane tips merged into the branch
(P-A `c616cd58`, P-B `5e7daf5f`, P-C `b669a108`; file sets pairwise
DISJOINT, zero conflicts; lane logic untouched — union/latest only at the
shared-file ledger level). This branch is a PREP branch: NOT merged, NOT
pushed to master; push = branch only, ff, per root directive.

The deliverable asked: 交付到仓库实际装配入口 — the LIVE assembly rows reach
the shipped production entry (`packages/runtime/src/plugin/live/
agent-bindings.mjs`, placed into the committed dist mirror), NOT a parallel
harness. Port discipline: everything measured on `:3183`; `:3080` read-only
401-probe before/after only.

## 1. What was assembled (implementation files)

| # | file | what it is | entry / mount point | tests-only? | root build & committed dist? | user-usable NOW + remaining blockers |
|---|------|-----------|--------------------|-------------|------------------------------|--------------------------------------|
| 1 | `packages/runtime/src/plugin/live/team-tool-plane.mjs` | the R1 **placement** assembly entry (Q4-approved route = completion of the ORIGINAL authorization semantics, not a new ruling): per-agent governed tool plane; trust-pair gate (pb §1.3), admission-assembly gate (pa §4), C-FS provider (opt-in), reviewed Definitions via the PR5 face (`decide` REQUIRED), `mount()` performs the placement and ROLLED-BACK-then-refuses on any conflict | `agent-bindings.mjs` agentSetup, ONLY when `permissionPolicy !== undefined` AND row config carries `teamToolPlane` (absent config ⇒ the line does not run; non-team sessions byte-zero BY CONSTRUCTION) | no — production live row | YES: `scripts/place-dist-glue.mjs` PLACEMENTS (byte-copy) + `check:artifacts` drift=0 | YES for a governed team whose host row ships `config.teamToolPlane`. Blockers: the EFFECT-FACE adapters (C-FS search body, confined provider PR4 launcher) are the registered pb §6 follow-up — the default backends answer `IO_POLICY_UNSUPPORTED` by name, never faked |
| 2 | `packages/runtime/src/plugin/live/jobs-gateway-assembly.mjs` | the pc-CONTRACT §3 **live row** for PR7: durable-member identity source over the real `domain.repositories.memberInstances` (cross-root claim ⇒ null ⇒ fail closed), assembly-owned lease window, gateway wired, teardown rides `close()` | created lazily per owning root at the same governed mount point; `close()` drains/releases/givesUp; bundle witness `liveJobsGatewayFor(rootSessionId)` (non-authority) | no — production live row | YES (same PLACEMENTS list) | YES as the TeamPermit/lease/owner-fence authority for its root. Disclosed gaps (pc §3): the DEFINITION STORE is row-local (no host seam today ⇒ any pin-less admit fail-closes `mapping-rejected`/`owner-not-durable`); the ACTUATOR leg (`ctx.jobs.start`) stays the registered `job_*` coverage gap — the row never fakes a host jobs capability |
| 3 | `packages/runtime/src/plugin/live/agent-bindings.mjs` (EDITS) | the wiring: guard input carries the mutable `assemblyOwnedNames`; plane mount between team-tool registration and the Coverage Gate; plane names join `teamToolNames` (coverage attribution) and `bindOwnTools` (placement-attributed verification, Q4 semantics); jobs assembly open + `close()` teardown + bundle accessor | the production entry itself | no | YES (existing PLACEMENTS entry; drift gate green) | YES — see row 1's config gate |
| 4 | `packages/tools/a5p5-tools/**` → `packages/runtime/dist/packages/tools/a5p5-tools/**` | the PR5 lane joins the COMMITTED install surface via `packages/runtime/tsconfig.build.json` include (the `.mjs` edge is invisible to tsc — the emit must ride the project explicitly) | imported ONLY by row 1 (`../../../../tools/a5p5-tools/src/index.js`, resolves inside the dist mirror) | no | YES — 44 lane files emitted + committed; DEDUP RULING (disclosed): ONLY the lane subtree lands; transitive faces (contracts, domain/tool-governance, authority-envelope, blueprint) were ALREADY mirrored and are reached by the emitted relative specifiers — zero second copies | YES via row 1 |
| 5 | `scripts/place-dist-glue.mjs` (EDITS) | PLACEMENTS += the two live rows (the check-artifacts drift gate auto-covers new placements) | build plumbing | no | YES | — |
| 6 | ledger payments: `p4t6-session-event-scan.test.ts` (+2 GLUE-5 rows, +3 P-B lane files per-merge attributed, ties 1157→1159→1162), `a5p7-lane-hygiene.test.ts` (REVIEWED_EDGE exceptions + the pinned-two-edges leg), `a5p5-dormant-audit.test.ts` (REVIEWED_EDGE exception + barrel-import-form leg + runtime-tsconfig include pin) | the "wiring enters review as its own change" payments, per-lane provenance recorded in the test bodies | n/a | tests-only | n/a | — |
| 7 | this kit: `a5g5-negctl-kit.mjs` + `a5g5-observer-row.mjs` + `a5g5-stray-row.mjs` (+ a one-field identity `package.json` sentinel — without it the client-modules loader maps BOTH evidence rows to the repo-root `dsh-agent-team` client package and refuses boot) | the negative control (below) | evidence only | tests-only | no | — |

## 2. Assembly-entry wiring summary (the live path)

```
agentSetup (governed only: permissionPolicy !== undefined)
  ├─ Guard install (PREPARING; assemblyOwnedNames = mutable, shared)   ← pre-existing
  ├─ mask (tools.restrict)                                             ← pre-existing
  ├─ Team tool registrations (selectedTeamToolNames)                   ← pre-existing
  ├─ GLUE-5: plane = createTeamToolPlaneAssembly(...)    [trust-pair → admission → C-FS → defs]
  │          placed = plane.mount(agentCtx)             [own-layer register; conflict ⇒ rollback+REFUSE]
  │          a5PlaneOwnedNames.push(...placed names)    [Guard reads at publish]
  │          liveJobsGatewayAssemblies.set(root, …)     [lazy per root]
  ├─ Coverage Gate: teamToolNames = [...selected, ...planeOwn]         [plane credited, stray NOT]
  ├─ bindOwnTools([...selected, ...planeOwn])           [pins THE OBJECTS IT PLACED]
  └─ publish (PREPARING→ACTIVE; fail-closed as before)
close(): agents → disposers → jobs assemblies drain/release/giveUp
```

Plane names are the `team_*` ALIASES (`team_grep`/`team_glob`/`team_bash`) —
ruling disclosed: the closed template permission vocabulary
(`read|read_image|write|edit|lsp|bash|pwsh`) has no grep/glob, and native
same-name take-over would collide (duplicate-in-layer = fail closed) with the
preset-realm mount of the SAME agent scope. The `decide` the PR5 pipeline
consumes is a synchronous tighten-only re-check of the template policy
(class mapping: team_bash→bash; grep/glob read-class covered by read/read_image
allow coverage; deny lanes match per-resource with fail-closed over-approximation
when the subtree seam cannot disprove a match). The ASYNC kernel/guard chain
remains the admission authority; the lane re-check only ever narrows.

## 3. Negative control (five controls, one port 3183, committed dist = load path)

KIT: `a5g5-negctl-kit.mjs` — synth half (REAL compiled dist plane/guard/jobs-row
over the RA Tier-A law-clone registry) + FOUR worlds
(baseline | plane | gatered=stray-on-surface | refuse=half-paired trustRoot),
each: boot → discovery turn → governed `team.create` (main blueprint,
`permissions:` block) → `standard`+`minimal` non-team sessions + turns →
observer reads (registry face, WIRE face via mock capture, observations via
the public `teamRoot.live` facade, live-jobs-gateway witness).

Verdict for this round's authoritative run `runs/2026-10-17T11-10-37Z/`:
**GREEN — 21/21 criteria** (`criteria.json`; world captures + redacted
instance logs beside it). Highlights as measured: plane leader own-layer
scoped `[team_bash,team_glob,team_grep]` with global face `[]`; aliases in
the model-facing WIRE catalog; jobs gateway + assembly lease present for the
owning root (baseline: none of these); `standard`(26)/`minimal`(1) non-team
catalogs set-identical baseline→plane on registry AND wire faces; the
team_-namespace masquerader dies on
`permission coverage gate failed … team_stray (unknown-unmanaged) (code:
alpha2-permission-coverage-unmanaged-tools)`; the half-paired trustRoot dies
typed (`TRUST_ROOT_SHA_MISMATCH`) with zero surviving aliases. Iteration
runs (barrier discovery, sentinel REQUEST_EXTENSION forensics) are disclosed
in §5.10–§5.12 rather than hidden; the committed run is the final one.

## 4. Gates

- build: `pnpm -r run build` EXIT 0; `place-dist-glue` 3 placements byte-identical; `check:artifacts` drift 0 (1726 compared).
- ledgers: p4t6 10/10 GREEN (see `p4t6-PRE-EXTEND-RED.txt` / `p4t6-POST-GREEN.txt`); a5p7 hygiene GREEN incl. the two pinned reviewed edges; a5p5 lane dir 75/75 GREEN incl. the new barrel-import-form and runtime-include legs.
- **disclosed expected red (NOT re-fixed, per directive)**: `a5p0-layer-audit` consumer-set leg = `tools/a5p5-tools/src/register.ts` missing from the frozen pin — the #299/#304 fix round's single stroke (same file, same booking). Double-booking would move the derived totals twice; the final rebase keeps ONE booking.
- root vitest quick (committed tree, post-fix): **560 files / 7060 legs — red set = the published
  baseline identity set exactly: the 9 titled reds (`nine-root-2162f6a7.md`: p6t3-mediation ×5,
  p6t3-restart ×2, p6t6-actions ×1, t2-blueprint-hash ×1) + the ONE disclosed a5p0 dup (delta is
  exactly `+ tools/a5p5-tools/src/register.ts`, the #299/#304 fix booking — disclosed, not re-fixed).**
  NEW reds introduced by this round: **0** — the three reds the first full run showed as mine were
  fixed in-round (live-row lint `no-unused-expressions` → explicit if/else + dist re-placed;
  tsconfig JSON5 comment → strict JSON, the a4p3 hygiene leg parses it; a4-artifacts-nonempty
  `OK: 1 file` fixture → derived from PLACEMENTS, same integration-owner re-booking family as the
  p4t6 endpoints, plus its a5p7 name-only hygiene exception) and both a4p7-merge-gate legs pass
  post-commit (lint identity diff + committed install surface). File count moved 558→560 by design
  (merged P-lane test files); legs 7010→7060 likewise. `a4p7` lint universe note: scratch litter
  pollutes the lint identity universe (ESLint does not read .gitignore) — kit rule: scratch OUT of
  the worktree universe at gate time (this round's scratch was swept before commit).