# WP — F-2 Goal Domain Authority (next phase; design only)

**Status:** **DESIGN ONLY — not implemented, no product change, no blueprint edit, no candidate
move.** This document describes a future classification. It does not alter the A2C-2 gate, the
`builtinToolDeny` artefact, the Goal tools' authority or any 0.1.6 behaviour.
**Written:** 2026-11-11 by the DOCS lane, from F-2 as measured by the packaged acceptance `#713`
(`dev/agent-workflow/evidence/v016-packaged-acceptance/` §6 F-2).
**Depends on:** the A2C-2 gate as it exists (`packages/runtime/operation-permission/permission-coverage.ts`)
and the Alpha.5 realm work. If AER changes the final tool surface, this classification is applied
to the post-AER surface, not the 0.1.6 one.

---

## 1. The defect in one paragraph

F-2 is the measured statement that **one Member cannot both declare the `bash` ask lane and own the
Goal trio**. The cause is not the Goal tools' authority; it is an **ownership-classification**
collapse. A2C-2 asks a closed question — "does every tool on the final model-facing surface have a
clear authority owner?" — and answers it with six classes
(`MANAGED_OPERATION_PERMISSION`, `OTHER_MANAGED_TEAM_TOOL`, `OTHER_MANAGED_MCP`,
`SAFE_UNMANAGED`, `KNOWN_SENSITIVE_UNMANAGED` (fatal), `UNKNOWN_UNMANAGED` (fatal)). The Goal tools
are not in the managed operation-permission vocabulary, so on an agent that declares
`capabilities.permissions` they fall into a fatal class; the only way to boot is to put them in
`builtinToolDeny` (19 unmanaged names), which removes the Goal tools from the surface. The product
then allocates capabilities across **different Members**. That split is a **v0.1.6 limitation forced by
the classification collapse, not an architecture principle**: it is the workaround this work package
exists to replace, and no document may cite it as the intended end state.

That is safe but it is the wrong **reason** to lose a capability: the Goal tools are not an
unowned I/O surface. They are owned by the **host's goal domain**, and that domain already has its
own authorisation predicate (`requireDirectHuman` / `hasDirectHumanInput`). The classification
should say so, instead of routing them into the same fatal bucket as an unknown tool.

## 2. The proposed separation — Goal is a domain authority, not an I/O permission

Add a **Host Domain / Goal Authority** class to the A2C-2 classification, with the same closed-set,
fixed-precedence discipline as the existing six:

- **class:** `HOST_DOMAIN_GOAL_AUTHORITY` (name illustrative; the schema is the Owner's).
- **what it asserts:** this tool name is owned by a **host domain** whose authorisation predicate is
  defined and enforced upstream (`requireDirectHuman`); the runtime does not need a
  per-tool Blueprint rule, an I/O lane, or a `builtinToolDeny` entry to know who owns it.
- **precedence:** below an explicit managed adapter and Team/MCP ownership, above
  `SAFE_UNMANAGED`/`KNOWN_SENSITIVE_UNMANAGED`/`UNKNOWN_UNMANAGED`. A Goal tool that is also
  explicitly managed keeps the managed class (no re-classification by name).
- **closed vocabulary:** the class accepts an explicit allow-list of Goal tool names, not a
  `goal*` prefix. A name not on the list is still unmanaged and still fatal — the gate stays
  fail-closed.
- **responsibility-closed:** the class is not an acknowledgement; it names the predicate
  (`requireDirectHuman`) and the module that enforces it, so a reviewer can check that the owner
  exists rather than trusting a label.

The intended outcome is **one Member declaring both the `bash` ask lane and the Goal trio**, with
the Goal call still refused on a turn that lacks direct human input. The I/O permission lane and the
Goal authorisation lane become two axes of one surface, not a zero-sum allocation.

## 3. What must not change (hard invariants)

1. **No second permission authority.** The new class records **ownership**, not permission. The
   Alpha.4 envelope, the Alpha.5 realm and the host's native authorisation remain the only places a
   permission decision is made. `HOST_DOMAIN_GOAL_AUTHORITY` must not create an approval path, a
   grant, a revoke, an allow lane or a second ledger.
2. **`builtinToolDeny` semantics unchanged.** It still denies exactly the names it lists and stays
   the blueprint artefact it is. The new class must not auto-remove a name from a Member's deny
   list, must not make a denied tool callable, and must not change the deny's precedence. Removing
   an old `builtinToolDeny` entry is an explicit blueprint edit, not a gate side effect.
3. **Upstream `requireDirectHuman` unchanged.** `create_goal` must still be refused on a turn with
   no direct human input. The classification must not forge `source.kind`, widen
   `hasDirectHumanInput`, add a relay exception, or move the predicate. PD-38's two-provenance
   semantics stay as they are.
4. **No surface widening by classification.** A tool the model can see today only because it was
   denied must not become visible merely because it was re-classified. Visibility and ownership are
   different questions; this work package answers the second.
5. **No `V@B` move and no grade change.** The matrix, the frozen candidates and the 0.1.6 notes
   describe the old allocation; the new class is later-version scope.

## 4. Acceptance sketch

| id | arm | assertion | evidence class |
|---|---|---|---|
| **F2D-1** | one Member, both lanes | a single Member declares the `bash` ask lane **and** owns `create_goal`/`get_goal`/`update_goal`; setup does not fail with the coverage error | DEV-LIVE, 2 agreeing boots |
| **F2D-2** | goal authority still enforced | on a machine-relay turn, `create_goal` is refused (`GOAL_TOOL_AUTHORITY_REQUIRED`); on a direct-human turn it is accepted | DEV-LIVE, 2 runs |
| **F2D-3** | deny unchanged | a Member whose blueprint still lists a Goal tool in `builtinToolDeny` cannot call it (same typed `unknown tool` / deny shape as 0.1.6) | host-free pin + 1 boot |
| **F2D-4** | gate stays fail-closed | an unknown tool (not on the Goal allow-list, not managed) is still fatal on an agent declaring `capabilities.permissions` | host-free test |
| **F2D-5** | no second authority | a grant/revoke still lands on the one permission authority; the Goal class creates no ledger, approval or grant | code read + host-free pin |
| **F2D-6** | 0.1.6 regression | the existing different-Members allocation still works on the same artifact | C2-grade regression |

## 5. Boundaries and open questions

- **Does not reopen the Alpha.5 Preview** or the frozen 0.1.6 allocation. The 0.1.6 text remains
  true for 0.1.6; this is `v0.1.7`-or-later scope.
- **Does not redesign A2C-2's six classes** beyond adding one closed class; the fail-closed posture
  and the fixed precedence stay.
- **Open for the Owner:** (1) is the Goal allow-list literal names or a reviewed registry like
  `SAFE_UNMANAGED_TOOL_NAMES`? (2) does the class cover only the Goal trio or every host-domain tool
  (e.g. Stop, control tools)? (3) does the Member's `builtinToolDeny` ever get a migration hint, or
  does the old allocation simply coexist until the blueprint is edited?
