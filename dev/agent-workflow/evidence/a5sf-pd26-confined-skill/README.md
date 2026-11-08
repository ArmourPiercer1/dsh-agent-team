# PD-26 (CONFINED-SKILL) — a governed Member can read a skill body and declare a deliverable again, at the confined `fs` layer

**Lane** `PD26-CONFINED-SKILL` · branch `task/pd26-confined-skill-20261114` · base `origin/master`
`1e650c3e3` (`PD24-SURFACE-LEDGER`) · evidence class **DEV-LIVE** (`eligible = false`) · 2026-11-14.

> **Answer in one sentence.** Today a governed Member **can** read a declared `SKILL.md` body and
> **can** declare an in-lane deliverable, and the line is at the Member's **confined `fs` face**
> (`createMemberFsGuard`) — not at the tool name and not at the composition: the same two calls that
> succeed inside the compiled lane are a typed `IO_READ_DENIED` with **0 bytes** and **exactly one**
> deny fact outside it. PD-23 and PD-24 had closed both names instead, so before this lane the answer
> was "neither, and by removal"; this lane **restored** both capabilities and is **real wiring** — the
> pre-fix arm of the same driver, booting the archived pre-fix composition at the same commit, still
> measures the typed `unknown tool` and zero facts.

**Row number.** PD-25 is occupied by the in-flight `pd25-unbounded-turn` lane (not in this branch), so
this row is **PD-26**; that renumbering is disclosed in the register row and here.

---

## 1. The question this lane answers

Two rows of the register had accepted a **capability regression** rather than leave a hole:

- **PD-23** measured the governed preset's `skill-filesystem` returning an **out-of-lane** `SKILL.md`
  body through the BASE `fs` with **zero** `a5sf-guard-consult/1` facts (the body then stayed in seven
  later model requests) and removed the row: the opt-in governed preset offered **no skills at all**.
- **PD-24** measured `present` resolving through the same BASE `fs`: a real **out-of-lane** file was
  **accepted** (`Presented …`), a **missing** one was refused `file not found` — a cross-lane existence
  oracle — all with **zero** facts and two `deliverables/presented` events in the Member's own session,
  and removed the row.

PD-24's evidence named the honest route and called it a `CORE_SEAM_BLOCKER`: *a preset row's `ctx` is
the registry generation scope, the Member's confined provider is a fork in the Member's isolate, and no
composition-level row can be handed that fork's `fs`; a real fix is a new route-C product row plus a
realm-bound provider face (`confined-present-tool` on the `a5sf-realm-row` attach).*

**That route is what this lane took, and the seam turned out not to be a blocker.** The route-C attach
(`attachA5sfNativeToolModules`) already re-mounts native tool modules **inside** the Member's isolated
scope after the capability deny lane, and a module mounted there resolves **that scope's** `fs` — the
confined Provider PD-17 built. Two Team modules were enough.

## 2. What was built

| file | what it is |
| --- | --- |
| `packages/runtime/src/plugin/live/confined-skill-tool.mjs` (new) | the `skill` tool: the host package's description, parameter schema, three-variant `resourceBase` output schema and `renderSkillContent`, but the body read is `ctx.fs.resolve` + `ctx.fs.readText` on the **confined** face; YAML frontmatter stripped exactly as the host package does; refusals keep their typed `IO_READ_DENIED` code in the model-visible message |
| `packages/runtime/src/plugin/live/confined-present-tool.mjs` (new) | the `present` tool: the host package's definition verbatim, `lstat`/`resolve`/`stat` on the confined face, and the host package's two-step delivery (resolve → `tools/result` → append `deliverables/presented`) |
| `a5sf-realm-row.mjs` | `a5sfSkillCatalog` config (`{name,description,path}`, validated, deduped, omitted when empty) and two new attach specs appended to the route-C list, both **surface-neutral** shadows of names already visible post-deny (`unshadowedExpectedTools` still fails the Member setup closed) |
| `cordis.patch.yml` | `tool-skill` and `tool-present` return to `preset-a5sf-governed-member`; the PD-23/PD-24 removal notes stay, each carrying the dated PD-26 restoration note |
| `packages/runtime/package.json` + `pnpm-lock.yaml` | `@deepseek-ai/dsh-skill` / `@deepseek-ai/dsh-tools` moved dev→dependencies, `@deepseek-ai/dsh-tool-present` added (the preset row is shipped behaviour, not a test-only dependency); `pnpm install --frozen-lockfile` accepts the hand-moved lock |

Two seams were **measured**, not assumed, and both are part of the design:

1. **The deliverable event does not follow a delegated `apply`.** The host package's
   `ctx.on('tools/result')` listener is bound to the scope of the `ctx` it registers on; the realm ctx
   does **not** receive an agent-scoped `tools/result` dispatch. The first dev boot proved it: the
   in-lane presentation succeeded (two allow facts, `Presented …`) but **zero**
   `deliverables/presented` events were appended. The shadow therefore keeps the host definition
   verbatim but registers the delivery listener on the **agent's own** `ctx` (`exec.agent.ctx`), which
   is where the host contract says the event belongs — the Member's own Session. The host-free suite
   pins the shadow's definition **byte-equal** to the host package's (`PD26-PARITY`).
2. **The typed code does not follow the host's error path.** The host package re-raises the provider
   error unchanged, so a lane denial reached the model as `authored locator … is outside every allow
   subtree` with no code. Both shadows prefix the code (`IO_READ_DENIED: …`) so a refusal cannot be
   misread as an existence answer; the guard fact was already typed.

**No second policy source.** The lane is the Member's compiled policy the realm mounted; the catalog is
**data** (`{name,description,path}`) and authorizes nothing — the out-of-lane catalog entry's file
**exists on disk and is declared**, and is still refused at the read.

## 3. The measurement

One delegated Member turn, real Host, shipped opt-in preset `a5sf-governed-member`, shipped route-C
attach, pinned host `639ed015397290b3745d163aafe02ffee4aa3f84`, booted **twice** per arm
(`--boots 2`), both records bound to the pushed commit `427d226be` — the **code** commit; the two
follow-up commits after it touch no module (root dependency declaration, superseded absence arms,
register/matrix/README), so the records describe exactly the code this PR ships. The scripted model is the shared
mock; the skill files, the deliverable and the secret are World files. Every Member surface call and the
result the Member actually received are in `runs/boot0*/member-probes.json`.

| reading | **pre-fix** (`archive/pair-prefix/`, surface **33**) | **post-fix** (`runs/`, surface **35**) |
| --- | --- | --- |
| `skill` in-lane | typed `unknown tool "skill"` | **body returned** (`<skill_content name="pd26-in-lane-skill">…`), **1 allow fact** (`readText`, `tool=skill`, the call's `callId`) |
| `skill` out-of-lane | typed `unknown tool` | **`IO_READ_DENIED`**, **0 body bytes**, **exactly 1 deny fact** |
| `skill` unknown name | typed `unknown tool` | typed `skill "…" is unknown or no longer available`, **0 facts** (nothing read) |
| `present` in-lane | typed `unknown tool "present"` | `Presented …/workspace/in-lane.txt`, 2 allow facts (`lstat`+`stat`), **exactly 1 `deliverables/presented`** |
| `present` out-of-lane (existing) | typed `unknown tool` | **`IO_READ_DENIED`**, 1 deny fact at `lstat`, **0 events**, no bytes |
| `present` out-of-lane (missing) | typed `unknown tool` | **`IO_READ_DENIED`**, 1 deny fact, **no `file not found` oracle** |
| `bash` / `read` / `grep` | 6 allow facts, all execute | 9 allow facts (the +3 are the two restored faces), all execute |
| out-of-lane bytes in any model request | **0** | **0** |
| `skill`/`present` facts | **0** | 2 + 4 |
| deliverables events in the Member session | **0** | **1** |

Both pairs are **agreeing** (`agreement-postfix.txt`, `agreement-prefix.txt`: every field identical
across the two boots) and every case is `PROVEN` in both boots (`summary.txt`, `run-record.json`).

**The pre-fix defect, restated as a single line:** 0 body bytes before and 0 after — because before,
the *name* was gone (typed `unknown tool`, nothing read), and PD-23's pre-removal defect (a body that
reached seven model requests) cannot be reproduced through the shipped preset any more. The row's
before/after is therefore **capability 0 → 2, facts 0 → 6 (1+1 deny, 2+2 allow), out-of-lane bytes
0 → 0, existence oracle yes (PD-24, pre-removal) → no (now, typed at the read)**.

## 4. Mutation controls (each mutation reddens a **named** arm)

`tests/world-factory/a5sf-pd26-mutation-controls.mjs` (`mutation-controls.log`):

| arm | mutation | colour |
| --- | --- | --- |
| CLEAN | none | **green** (6/6 pass, PIN skipped) |
| **M1** | `confined-skill-tool.mjs`'s read block replaced by `readFileSync(entry.path,'utf8')` (the BASE-fs read PD-23 measured) | **reddens `PD26-CONTRACT-SKILL` only** — `CONTRACT-PRESENT`, `SURFACE-RESTORED`, `PARITY`, `CATALOG` stay green |
| **M2** | the test reads the **archived pre-fix composition** (`archive/pre-fix/cordis.patch.yml`, extracted by `git show 1e650c3e3:cordis.patch.yml`) | **reddens `PD26-SURFACE-RESTORED` only** — the confined-read contracts stay green |
| **PIN** | `A5SF_PD26_PIN=1`: reads the pre-fix composition by path and drives the real Cordis `ToolRuntime` | **green** — both calls are the router's typed `unknown tool`, so "absent" is measured, not asserted |

The host-free suite `tests/world-factory/a5sf-pd26-confined-skill.test.mjs` has five arms
(`SURFACE-RESTORED`, `CONTRACT-SKILL`, `CONTRACT-PRESENT`, `PARITY` for **both** shadows,
`CATALOG-VALIDATION`) plus the `PIN` arm.

## 5. What this lane does **not** claim

- **Not merge evidence.** `recordClass = DEV-LIVE`, `candidateClaimEligibility.eligible = false`,
  `CANDIDATE-C2` not run; no `V@B`, no matrix grade change, no Q7/Authority/Required-CI change,
  `CORE PATCH BUDGET = 0`. This is a draft PR.
- **The model is a scripted mock** (`packages/tools/harness/mock-deepseek.mjs`): the product path is
  real (shipped preset rows, realm provider/compiler, confined `fs` + guard sink, route-C attach, both
  Team modules, the host router), the *model* is not.
- **The lane is not tightened.** `a5sfSkillCatalog` is an allowlist *of declarations*, not of reads; the
  read admission is the same compiled read lane `bash`/`read`/`grep` use. A skill path inside the lane
  is readable exactly like any other in-lane file.
- **PD-25 is not this lane** (numbering disclosure), and PD-24's other residuals (`read_image` branch,
  `exit_plan_mode` active branch, `ask_user_question` blocking) are untouched.

## 6. Register / matrix consequences

- `PRODUCT-DEBT-REGISTER.md`: new row **PD-26 (CONFINED-SKILL)**, status **DRAFT — not merged**; the
  register's `FAIL-CLOSED` count for the two names moves to "restored", with the before/after above.
- `TOOL-ACCEPTANCE-MATRIX.md`: **append-only** §1.8.9 CORRECTION (dated) — the PD-24 buckets, grades,
  `V@B` and the 33-name roster are **unchanged**, and the correction states only the delta: the two
  in-register names leave `FAIL-CLOSED`, roster 33 → 35, and the out-of-lane readings above.

## 7. Reproduction

```bash
# host-free (no boot)
node --test tests/world-factory/a5sf-pd26-confined-skill.test.mjs
node tests/world-factory/a5sf-pd26-mutation-controls.mjs
A5SF_PD26_PIN=1 node --test tests/world-factory/a5sf-pd26-confined-skill.test.mjs

# live: the agreeing pair (real Host + shipped opt-in preset + real Member turn)
node tests/world-factory/drivers/a5sf-pd26-confined-skill/run-boot.mjs --boots 2

# live: the pre-fix arm, on the SAME commit (archived composition, not hand-edited)
A5SF_PD26_COMPOSITION=$PWD/dev/agent-workflow/evidence/a5sf-pd26-confined-skill/archive/pre-fix/cordis.patch.yml \
  node tests/world-factory/drivers/a5sf-pd26-confined-skill/run-boot.mjs --arm prefix --boots 2
```

The driver uses the shared dev-live slot lease (`tests/world-factory/lib/dev-live-slots.mjs`), the
3180-family ports, `DSH_HOME` under `tests/homes/`, and refuses to boot unless the pinned host tree is
clean.

## 8. Files

```
runs/boot01|02/            post-fix evidence (counters, member-probes, member-surface, guard-facts,
                           member-transcript.{json,txt}, run-record.json, summary.txt, teardown.json)
archive/pair-prefix/       pre-fix arm, same commit, archived composition
archive/pre-fix/cordis.patch.yml   git show 1e650c3e3:cordis.patch.yml
archive/mutations/         the M1 mutant (kept for audit)
agreement-postfix.{json,txt} / agreement-prefix.{json,txt}
driver.log                 the full run log (both arms, both boots)
driver-digest-*.json       commit/host pin, composition sha256, driver sha256, host digest
mutation-controls.log      CLEAN / M1 / M2 / PIN colours
run-ledger.jsonl           host-start ledger (DEV-LIVE records)
```

## 9. One-sentence answers (for the register and the PR)

1. **Can a governed Member read skill bodies and declare deliverables today, and at which layer is the
   line?** Yes to both, and the line is the **confined `fs` face** — the same compiled read lane
   `bash`/`read`/`grep` already use, consulted per target before any body or stat.
2. **Restored or still fail-closed, and why?** **Restored** — the two rows are back on the governed
   preset and shadowed inside the Member's isolate by two Team modules; nothing bypasses the guard.
3. **Out-of-lane bytes / facts, before vs after?** Bytes **0 → 0**, facts **0 → 2** for `skill`
   (1 allow in-lane, 1 deny out-of-lane) and **0 → 4** for `present` (2 allow in-lane, 2 deny
   out-of-lane, one of them a missing path that no longer answers "not found").
4. **Real wiring or another regression?** Real wiring: the pre-fix arm at the same commit still
   measures the typed `unknown tool` and zero facts, the confined-read contracts red when M1 restores
   the base-fs read, and the surface arm reds when M2 restores the pre-fix composition.
