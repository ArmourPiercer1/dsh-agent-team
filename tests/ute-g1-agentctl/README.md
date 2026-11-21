# UTE-3 / G1 — AGENT-CONTROL lane (stage B1)

The retirement baseline, negative controls and honest non-retirement record for
the census unit **`dsh.agent-control-family`** (seven members):
`subagent`, `subagent_fork`, `send_message`, `interrupt_agent`, `list_agents`,
`list_subagent_models`, `workflow`.

* **Stage 0 premise (`probe-composition.mjs`)** — measured on the product
  route-C: **7 dual / 0 single**. Every member has a governed family-body row at
  the native spelling AND a pinned host native row. Route-C serves **none** of
  them (all seven `unknown tool`, zero provider calls, zero guard facts).
* **Old path** — because route-C has no agent-control face, the old path this
  fixture captures is the **governed family body at C1**: the legacy governed
  plane (`createTeamToolPlaneAssembly`) + the FamilyAssembly seam + the
  `dsh.agent-control-family` descriptor, with the one closed boolean
  `plane.agentControlEnabled = true`.
* **Golden** — `golden/old-path.tsv`, **42 rows** (six vectors per member), each
  with four witnesses: the model-facing payload, the read-back state cell, the
  refusal code + imported refusal category, and the call/control facts.
  `golden/COVERAGE.md` maps member → vectors.
* **Differences** — three, all blocking, all **unapproved**:
  `golden/SEMANTIC-DIFFERENCES.md`.
* **Retirement state** — `NOT_RETIREABLE`. `newPathVerified` is **false**: there
  is no confined agent-control new path at B1
  (`dev/agent-workflow/evidence/ute3-agentctl-b1-20261121/new-path-absent.txt`).
  The lane does **not** fabricate a next-host run to make a term green.

## Run

```sh
node tests/ute-g1-agentctl/probe-composition.mjs        # Stage-0 composition probe (writes evidence)
node tests/ute-g1-agentctl/capture-old-path.mjs         # verify the fixture (exit 1 on drift)
node tests/ute-g1-agentctl/capture-old-path.mjs --write # re-capture (two runs must agree)
node tests/ute-g1-agentctl/negative-controls.mjs        # 24 controls; NC-VERDICT GREEN controls=24 failed=0
node --test tests/ute-g1-agentctl/lane-suite.test.mjs   # seven lane checks
```

Lane-run: no boot, no ports, no `DSH_HOME`, no host tree. The fixture executes no
host code; the host pin is referenced only so the two-implementation claim is
anchored.

## Files

| path | role |
| --- | --- |
| `probe-composition.mjs` | Stage-0 composition probe (definition sites, route-C dispatch, plane claims/natexe, real C1 mount) |
| `lib/world.mjs` | host-free C1 world: governed plane mount + deterministic stateful agent-runtime port + local Control legs |
| `lib/corpus.mjs` | 42 vectors, 7 members, six each, with design claims |
| `lib/scenario.mjs` | one vector execution; witnesses serialized |
| `lib/effect-oracle.mjs` | imports the FS lane's closed refusal vocabulary; total local code→category map |
| `lib/compare.mjs` | graded columns, TSV serializer/parser, design-claim checker |
| `lib/old-path.mjs` | old-path identity + capture facade |
| `lib/semantic-differences.mjs` | the three measured, blocking, unapproved differences |
| `capture-old-path.mjs` | write/verify the golden; prints the exclusion set |
| `negative-controls.mjs` | per-member (2 each) + family (10) controls |
| `lane-suite.test.mjs` | seven load-bearing checks |
| `golden/` | fixture, meta, coverage, differences |

## Refusal vocabulary

Refusals are classified through the **imported** closed vocabulary
(`tests/ute-g1-fs/lib/refusal-categories.mjs`): `CATEGORY_IDS`,
`RefusalVocabularyError`, `categoryOfLegacyRefusal`. The lane adds a **total**
map from the codes this family's rows actually emit to an imported category. An
unlisted code raises `REFUSAL_VOCABULARY_INCOMPLETE`; there is no default bucket
and the residual category `other`/`unknown` is unreachable (asserted by the
suite and NC-F3).

## UNKNOWNs

1. **Host-side effects are not proven.** The effect boundary is an injected
   agent-runtime port. The fixture proves the family calls the port with the
   right arguments and turns the port's answer into the right model-facing
   payload; it does not prove what a real host does with a subagent, a workflow
   run, an interrupt or a message. `UNKNOWN`.
2. **The native row's own encoding is not executed.** The pinned host's native
   agent-control rows are the SECOND implementation, measured statically (name
   and file). This lane does not dispatch them, so it cannot claim behavioural
   equivalence — only that both implementations exist.
3. **No product route, no switch, no boot.** Nothing here mounts the product
   route-C with agent-control enabled (it has no such face), sets a production
   flag, or boots a host. `UNKNOWN` what a product-enabled family would do
   beyond the C1 mount measured here.
4. **`list_agents`/`list_subagent_models` unwired legs** are demonstrated with an
   absent port (`route-unresolved`), not with a real host service that answers
   with an error.
5. **The approval round-trip** is exercised through a local Control leg that
   mints a real fingerprint-bound grant on the plane; this is the C1 stand-in
   (`packages/runtime/test/a5-m1-control-legs.mjs` semantics), not the durable
   Control service.
6. **Cancellation** is a pre-aborted signal. A mid-flight abort is not modelled.
7. **No authority move, no legacy deletion, no approval.** `CORE PATCH BUDGET = 0`;
   no `packages/**` file changes; no `docs/plans/active/**` edit; the ledger row
   is `NOT_RETIREABLE` and every difference is `approval: null`.

## Fences honoured

* Single writer in its own worktree; no other family's test dir or ledger row
  touched.
* No new CI workflow/job/leg: the suite rides the existing post-build
  “UTE G1 FS binding product lane” leg, with the manifest `check[]` token
  byte-identical to the workflow `run:` line.
* Golden contains no repo root, no `/home/`, no `.artifacts/tmp`, no session
  name, no plane correlation nonce.
