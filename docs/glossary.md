# Glossary — one concept, one id (EB1-B, v0)

Meaning only. Writing form and synonyms live in [terminology.md](terminology.md);
stable normative ids live in
[contracts/engineering-baseline/ids.yaml](contracts/engineering-baseline/ids.yaml).
Every entry states what the concept is **not**, because the recorded drift
incidents in this repository were confusions, not unknowns.

| id | concept | meaning | must not be confused with | authoritative anchor |
| --- | --- | --- | --- | --- |
| C-EB-0001 | DSH Agent Scope | The Host-side scope in which a DSH agent's tool surface and context are resolved. | Team `ToolBinding` (C-EB-0002): a scope is where a tool is visible, not which binding executes. | `tests/paths.mjs` pinned Host revision (DSH side) |
| C-EB-0002 | Team ToolBinding | The Team-side pairing of a captured native definition with the governed adapter/provider that will run it for one agent. | C-EB-0001; and name equality — two same-named tools in different scopes are not the same execution body. | `packages/runtime/src/plugin/live/` assembly |
| C-EB-0003 | ControlOperationScope | The exact scope identity a control request / grant applies to; an allow authorizes that scope exactly once. | C-EB-0001, C-EB-0002; a standing permission (there is none). | Alpha.5 M0 lifecycle contract |
| C-EB-0004 | ApprovalCase | The durable record of one governance question and its decision. | Consumption (C-EB-0005): deciding is not consuming; a case may exist with no consumption. | Alpha.5 M0 lifecycle contract |
| C-EB-0005 | Control consumption / PA consumption / Provider settlement | Three separate durable facts in one call chain: the approval was spent, the admission was spent, the provider returned a real result. | Treating any one as proof of the others, or as proof the tool ran. | Alpha.5 M0 lifecycle contract |
| C-EB-0006 | handoff vs escalate | `handoff` moves work between peers at the same authority; `escalate` raises authority. | Each other. Same word "移交" in prose is not a licence to merge them. | Alpha.5 governance design |
| C-EB-0007 | turn / step / round (DSH) | Host-loop vocabulary for one model turn, one harness step, one goal round. | Review rounds / task attempts in this repo's protocol; do not rename Host units to match Team rounds. | `docs/ROUTER_RULES.md` |
| C-EB-0008 | Code Review vs runtime approval | A human/agent review of a diff versus a runtime governance decision made by Leader or human over a live scope. | Each other: a review never authorizes a runtime side effect, and a runtime approval never validates code. | `docs/ROUTER_RULES.md` §0, team control tools |
| C-EB-0009 | C1 / C2 / C3 | C1 = branch-local build/unit proof; C2 = real assembly (real Host mount + external effect) for a candidate; C3 = release-截面 verification on a pinned source set. | "tested" as a single undifferentiated word; C1 never implies C2, and branch-local C2 never implies merged-head C2. | `docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md` |
| C-EB-0010 | A / B / C evidence classes | A = release, critical-security or irreplaceable reproduction evidence (protected); B = stage evidence (time-boxed); C = repeated logs/caches/temp worlds. | "old" or "large" as a proxy for class; class comes from role, not age. | `docs/TEST_METHODS.md` §7 |
| C-EB-0011 | four truth axes | `decision_status` / `implementation_status` / `verification_status` / `release_status`, recorded independently. | Deriving one from another (merged is not verified; verified is not released). | `dev/engineering/README.md` |
| C-EB-0012 | `current_contract` vs `current-state.json` | `graph.yaml#current_contract` is the legacy hand-maintained execution authority; `current-state.json` is a generated read-only derived view. | Two editable "current" states. Until an approved migration, only `current_contract` commands. | `dev/agent-workflow/graph.yaml` |
| C-EB-0013 | `NOT_VERIFIED` / `REFUSED` / `ENV_BLOCK` / `SKIP` | Honest non-pass verdicts: unprovable, refused by policy, environment unavailable, deliberately not run. | PASS, and each other. None of them may be reported as green. | `scripts/ci-pr-gate.mjs` result classes |

## Status of this file

Concepts C-EB-0001 … C-EB-0008 restate vocabulary that the Alpha.5 contracts
already define elsewhere; this table is a navigation aid, and the anchor column
wins on any disagreement. Concepts C-EB-0009 … C-EB-0013 are introduced by the
Engineering Baseline and are `proposed-not-ratified` until approved.
