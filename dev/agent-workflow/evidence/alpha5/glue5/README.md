# GLUE-5 — production entry assembly (alpha5-glue5-entry)

Round: **GLUE-5 FINAL — production entry assembly, rebased onto the real
master.** Base = master `eb56f805` (#307; P-A `#303`, P-B `#299`, P-C `#300`,
P-LSP `#304`, GLUE-4 `#302` all MERGED). The prep round's pre-merge tree is
DROPPED (its content entered master as the squashed PRs — byte-identical to
what this branch had merged, verified file-by-file); only the ASSEMBLY DELTA
is replayed here onto the final base. Ledger dedup resolved exactly as the
prep round's own clause reserved: the P-B dup booking (`SCANNED_PATHS_A5PBMERGE`)
is dropped (#299 books those three paths as `SCANNED_PATHS_A5PB`), p4t6 ties
re-measured on the final tree (chain `1166 -> 1168`), and the disclosed a5p0
`register.ts` dup DISAPPEARS (#299 re-booked it) — the red set is now the
published baseline identity set, exactly.

HISTORY (prep round, kept as history per directive): prep base `01df26ca` +
UNMERGED lane tips P-A `c616cd58` / P-B `5e7daf5f` / P-C `b669a108` merged
into the branch (file sets pairwise DISJOINT, zero conflicts, lane logic
untouched); prep head `6d866f93` (tag `alpha5-glue5-prep-6d866f93`); prep
verdict run `runs/2026-10-17T11-10-37Z` (21/21).

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
| 6 | ledger payments: `p4t6-session-event-scan.test.ts` (+2 GLUE-5 rows; FINAL-REBASE: the prep's +3 P-B dup booking dropped against #299's, ties re-tied on the final tree 1166→1168 measured), `a5p7-lane-hygiene.test.ts` (REVIEWED_EDGE exceptions + the pinned-two-edges leg), `a5p5-dormant-audit.test.ts` (REVIEWED_EDGE exception + barrel-import-form leg + runtime-tsconfig include pin) | the "wiring enters review as its own change" payments, per-lane provenance recorded in the test bodies | n/a | tests-only | n/a | — |
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

Verdict, FINAL-tree authoritative run `runs/2026-10-17T11-44-58Z/` (master
`eb56f805` + this replayed delta, fresh build + placements): **GREEN — 21/21
criteria** (criteria table + world captures + redacted instance logs beside
it). The prep-round run `runs/2026-10-17T11-10-37Z/` (prep tree `6d866f93`)
is kept as history; both 21/21, same criteria set.

## 4. Gates

- build: `pnpm -r run build` EXIT 0; `place-dist-glue` 3 placements byte-identical; `check:artifacts` drift 0 (1730 compared on the final tree; 1726 on the prep tree — merged master grew the surface).
- ledgers: p4t6 10/10 GREEN (see `p4t6-PRE-EXTEND-RED.txt` / `p4t6-POST-GREEN.txt`); a5p7 hygiene GREEN incl. the two pinned reviewed edges; a5p5 lane dir 75/75 GREEN incl. the new barrel-import-form and runtime-include legs.
- **disclosed expected red (NOT re-fixed, per directive)**: `a5p0-layer-audit` consumer-set leg = `tools/a5p5-tools/src/register.ts` missing from the frozen pin — the #299/#304 fix round's single stroke (same file, same booking). Double-booking would move the derived totals twice; the final rebase keeps ONE booking. **FINAL status: RESOLVED at source** — master #299 carried the re-booking; the leg is GREEN on this tree (verified in both census captures).
- root vitest quick (FINAL tree, committed): **562 files / 7086 legs — double capture, red identity
  sets IDENTICAL (cap1 = cap2), and equal to the published baseline identity set exactly: the 9 titled
  reds (`nine-root-2162f6a7.md`: p6t3-mediation ×5, p6t3-restart ×2, p6t6-actions ×1,
  t2-blueprint-hash ×1). The prep-disclosed a5p0 `register.ts` dup is GONE (#299 re-booked at source).**
  NEW reds from this round: **0**. Counts: prep 560f/7060l → final 562f/7086l — the merged master
  carries #304's LSP suites + #307's leg-E files (by design). PREP-ROUND HISTORY (kept per directive):
  the prep run showed 560f/7060l = the same 9 baseline reds + the disclosed a5p0 dup; three reds the
  FIRST prep pass showed as mine were fixed in-round and disclosed (live-row lint
  `no-unused-expressions` → explicit if/else + dist re-placed; tsconfig JSON5 comment → strict JSON
  for the a4p3 hygiene leg; `a4-artifacts-nonempty` `OK: 1 file` fixture → derived from PLACEMENTS,
  same integration-owner re-booking family as p4t6, plus its a5p7 name-only hygiene exception).
  `a4p7` lint-universe law (learned the hard way, both rounds): ESLint does not read .gitignore —
  scratch litter inside the worktree pollutes the lint identity universe; kit rule: scratch OUT of
  the tree at gate time.

## 4b. Installable-artifact surface (post `place-dist-glue`, final tree)

Inventory as committed (paths under `packages/runtime/dist/` unless noted):

| surface | files | note |
|---------|-------|------|
| runtime dist total (`git ls-files packages/runtime/dist`) | **1727** | the committed install surface of the runtime package |
| — of which `packages/tools/a5p5-tools/**` (PR5 lane emit) | **44** | registration face `register.js/.d.ts/.map` + barrel + lane internals; imported ONLY by the plane live row |
| — glue placements (`src/plugin/live/`) | **3** | `agent-bindings.mjs`, `team-tool-plane.mjs`, `jobs-gateway-assembly.mjs` — byte-copies of the live `.mjs` rows (place-dist-glue PLACEMENTS; the drift gate covers all three) |
| `check:artifacts` (both install surfaces, index) | **OK: 1730 files, drift = 0** | `check-artifacts-committed.mjs`; graded green inside the a4p7 merge-gate leg |

## 5. Disclosures (nothing hidden in the table)

1. ALIAS ruling + the closed-vocabulary reason (grep/glob have no permission-tool class; same-name own-layer collision = fail-closed by law, so aliases never collide).
2. a5p5 dist dedup ruling: lane subtree only; transitives already mirrored, reached via relative specifiers.
3. Row-local definition store (jobs row) — today NO host seam feeds it; admit without a durable member or registered definition fail-CLOSES. The row brings the gate, not a registry.
4. Effect face shut by name (`IO_POLICY_UNSUPPORTED`) until the pb §6 adapters (C-FS + confined provider bodies) land — the gated SURFACE (placement + verified bindings + admission chain) is live, the effect bodies are not faked. Backends are injectable for the wiring rounds.
5. confinedProvider: the CONFIG ROW + the fail-closed pairing law are live (kit `refuse` world proves the public-route refusal); the provider's own probe/spawn body is PR4.
6. Q4 = the ORIGINAL authorization semantics implemented completely (placement attribution + per-call scoped compare); no new user ruling is claimed or implied anywhere.
7. subtree containment seam: the production decide gets NO string-handle containment seam (the A5 fs seam hands opaque provider handles, async — not usable on the lane's sync deny fast-path), so a subtree DENY rule over-approximates (matches rather than widens) — tighten-only, disclosed.
8. the plane mounts for leader AND members (role feeds the kernel config); leader exec-lane semantics unchanged.
9. kit hygiene: host porcelain 0 pre/post, `:3080` untouched (401→401), worlds `tests/homes/a5g5-*` swept, tokens redacted at capture.
10. world-kit LAW discovered this round (measured, not theorized): a `session/prompt` accepted WHILE the boot row's create-assembly is still running is swallowed — HTTP `accepted:true`, but no turn ever starts (probe worlds: early prompt ⇒ turns 0 forever; post-boot prompt ⇒ turn completes). The kit therefore drives every setup prompt through a BOOT-COMPLETION BARRIER: re-send until the wire request actually shows at the mock (public route + own mock only; the recorded `promptAttempts` in each world capture shows how many attempts the assembly took — the a5w7 kit's p6t6-state barrier expressed without mounting that lane's row).
11. host registration law met ASSEMBLY-SIDE (world-measured: the first plane world REFUSED with `tool "team_grep" must declare output { schema, render }`): the pinned host's `register()` requires an output presentation face; the a5p5 lane deliberately ships name/description/parameters/execute ONLY (execute = closed `{ text }` envelope). The PLANE assembly adds exactly that face — `output: { schema: {object,text,additionalProperties:false}, render: (_args,value)=>String(value?.text) }` — additively, zero change to any reviewed lane logic, and the PINNED object is this wrapper (placement pins what it put there, identity intact).
12. world-kit forensics, second measured law (and one WITHDRAWN false law): the host ships a `plugin-package-inventory-deepseek` REQUEST EXTENSION — it reads the NEAREST package.json of EVERY plugin row at EVERY model-request preparation and throws (`REQUEST_EXTENSION`) unless `name` AND `version` are non-empty. A version-less identity sentinel under the evidence dir therefore silently killed every turn in any world mounting those rows — turns ran, zero wire traffic, no console error. The gatered/plane stalls were diagnosed exactly this way (the earlier suspicion "the stray's scalar output schema poisons the wire" was a CONFOUNDER — WITHDRAWN; the stray face stays well-formed `{ text }` as good practice, not as a law). With the sentinel carrying `name+version`, plane discovers in 2 barrier attempts again. The session transcripts (`session.v4.jsonl.zstd`) were the decisive observable: `zstd -dc` + the last `turn/end` carries the true `REQUEST_EXTENSION` failure — worth knowing for every future kit.
