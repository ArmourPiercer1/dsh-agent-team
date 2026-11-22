# Owner decisions needed to finish the candidate

Six items are blocked on a ruling, not on work. Each is stated with what is MEASURED today, the options, and
what each option costs. Nothing here is a request to relax a safety invariant; every option either preserves it
or states plainly where the governance level changes.

Ordered by how much they block: items 1–2 block D acceptance claims; items 3–6 block capability rows.

---

## 1. Process lane — `bash`, PTY, `run_code` (C-subprocess / C-pty / C-ptc)

**Measured (round 63, live host):** `bash` on a governed Member is refused `ADMISSION_AXIS_UNSUPPORTED`
(`process.exec` deny, settlement `ADMITTED → REFUSED`). Declaring `io.process` is REJECTED by the frozen v4
shape as `MALFORMED_DTO` (`blueprint-v4.ts:187-197`). The shipped preset never mounts
`dsh-tool-bash-persistent`.

**Why it is not a bug:** admitting a shell with nothing to judge it against would claim an enforcement that does
not exist (`ADM-18`, `ADM-24`). The three rejected shortcuts (judge on the write lane, a second realm
declaration, deriving from `executionBoundary`) are recorded in `CONTRACT-CHANGE-REQUEST-process-lane.md`.

| option | what it means | cost |
| --- | --- | --- |
| **A** (engine's preference) | add `process` to the v4 ceiling with the same lane grammar | contract change to a frozen closed field set; then compile + mount + rungs 5–6 positives |
| **B** | a v5 schema carrying the lane; v4 worlds refuse a row that declares one | new schema version; two schema paths to maintain |
| **C** | declare subprocess/PTY/PTC NOT SUPPORTED in this generation | C rows become `UNAVAILABLE BY RULING`; B rung 6 stays in-process-only; the typed refusal is shipped behaviour |

**If nothing is decided:** the safe refusal stays. No row can claim subprocess support, and `d3:persistent-
subprocess` stays REFUTED. That is honest but incomplete against D's wording.

---

## 2. Runtime team creation on a centre row (the 405)

**Measured (rounds 58–59):** a centre-configured row boots and cannot create a team at runtime —
`POST /team-remote/team.create` returns **405**, because C-remote refuses to build the S6 plane (its dispatcher
is authorized by a server-derived principal the centre cannot speak for) and that plane is the product's ONLY
creation entrance. The acceptance Team is therefore BOOT-CREATED (`root.ts:4888`).

| option | what it means | cost |
| --- | --- | --- |
| **A** | a centre-governed creation command with a declared axis | contract change (no such axis exists) |
| **B** | a non-remote product creation route that goes through the centre | product feature; no contract change |
| **C** | accept boot-created teams on centre rows; record the limitation | no product change; D must state "no runtime creation on a centre row" |

**Current state:** C is what the D evidence already does, and `ESCALATION-centre-row-creation-entrance.md`
records it. B is the product-shaped fix and is the engine's recommendation after C unblocked measurement.

---

## 3. Settlement recheck contract change

`CONTRACT-CHANGE-REQUEST-settlement-recheck.md` (option A): the REFUSED-after-`allow` cell cannot be produced
without widening the settlement state machine. Two cells remain explicitly unreachable and are documented as
such rather than faked.

## 4. Realmless admission

`ESCALATION-realmless-admission.md`: (A) admit against the compiled ceiling and record `provider: 'unconfined'`,
or (B) refuse. The code today REFUSES (`MEMBER_CENTRE_UNWIRED`, ADM-44) — the docs that said otherwise were
corrected in round 67. A ruling would settle whether the refusal is the final answer.

## 5. Search face governance depth

`CONTRACT-CHANGE-REQUEST-search-face.md`: shape B is implemented (in-lane `grep` runs, overlay abstains,
`overlayOutcome: no-opinion`), so the capability is back. Open question is whether the durable overlay should be
able to DENY a search (shape A: a subtree search face in the permission vocabulary). Today the LANE ceiling is a
search's entire governance, and the centre judges the search ROOT, not each file a scan opens.

## 6. Alpha.6 review routing

The refusal is now recorded at the host entry (round 68). The ROUTED path is still unreachable: there is no
review-routing axis in the centre (`admission.ts:32/57/114`), and the config gate refuses the opt-in on every
row. Two shapes: (A) a compiled review-routing axis (contract change), or (B) a ruling that a record-only
approval fact on `host.service` IS adjudication, then wire the PA approval-fact join.

---

## What the engine recommends

1. **C for items 1 and 2** if the goal is a reviewable candidate now: both limitations are already measured,
   typed and recorded, and neither pretends to be enforcement.
2. **B for item 2** as the next product increment — it is the only one of the six that restores a user-visible
   product capability without touching a frozen contract.
3. **A for item 1** as the contract decision it is; it also unblocks rungs 5–6 of the B ladder.
4. Items 3–5 need a sentence each, not a build.
5. Item 6 should stay refused until the routed path can be governed; the recorded refusal is already correct.

## What must not happen

- No item may be closed by re-enabling an ungoverned plane, inventing an axis, or widening an invariant for the
  sake of a green row.
- No row moves to PRODUCT-PROVEN on the strength of these documents; that needs the D report's limits read as
  limits.
