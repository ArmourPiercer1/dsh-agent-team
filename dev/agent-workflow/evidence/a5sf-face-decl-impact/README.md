# a5sf-face-decl-impact — declaring the governed faces for a Member

**Task**: `a5sf-face-decl-impact-20261111` · **Branch**: `task/a5sf-face-decl-impact-20261111`
· **Base**: `origin/master` @ `35f3a0d2f` · **0 boots, 0 Host starts, 0 candidate claims.**
· **Record class: `IMPACT-ANALYSIS`** (a measurement of the tree, not a live result and
not a matrix row).
· **`CORE PATCH BUDGET = 0`**: no upstream file, no pinned-host file, no matrix,
register, STATUS, END-STATE or plan file was modified.

This is the decision material for one owner question: **does the product declare
the governed faces** (confined `terminals` + confined `subprocess`), now that the
mechanisms exist on the route-C path? It is an impact analysis, not a plan edit.
Everything below is either read out of code, measured by [`measure.mjs`](measure.mjs)
into [`impact-table.json`](impact-table.json), or cited to an evidence directory
that already measured it. Nothing here is a capability claim.

---

## 0. The answer, in one paragraph

**Declare them — as an ADDITIONAL, opt-in Member preset, not by moving the
deployment default in the same change — but know that this buys the read axis and
the confined child, not the network row.** Today a Member's `bash` is a host tool
outside every compiled lane: its reads are not attributed and its child shares the
host network namespace. With the faces declared, each command becomes a fresh
confined child whose named reads are refused before the shell starts, and the
model-visible `bash` is served by the confined face. The price is the transient
host tool's `run_in_background`, its per-call `timeoutMs`, its
`sandbox_permissions` escalation and its structured result; a persistent-shell
preset would additionally lose `cd`/`export`, interactive stdin and its PTY. Two
things do **not** come with it: the network deny (the one product declaration
parser refuses a narrowed network lane before any realm exists — measured
`NETWORK_UNCONFINED_REALM`), and any change to the shipped default preset (which
today is the host's `standard`, a *transient* shell, so `cd`/`export` are not
actually at stake for existing Members).

The exact sentence the owner is asked to authorise is in §8. What would change
this answer is in §8.2. The smallest change that gets a Member into the governed
path today is in §9 — it is **three product edits, not a config edit**.

---

## 1. What is already measured (not re-derived here)

| fact | where it was measured |
| --- | --- |
| the confined terminal face exists, is command-scoped, and refuses a command's named out-of-lane read with `IO_READ_DENIED` and 0 bytes | [`a5sf-pd13-fix/README.md`](../a5sf-pd13-fix/README.md) §3–§7, §10 |
| a persistent PTY cannot ride the confined profile — hence "one fresh confined child per command" | same, §3; register PD-13 residual (2) |
| the double-terminal fork is refused (`TERMINALS_DOUBLE_TERMINAL_REFUSED`) rather than resolved by composition order | same, §4 + pin C4; register PD-3 (2026-11-11 annotation) |
| `network: deny` on the confined child is refused **by the operating system** (own netns, `ENETUNREACH`, 0 accepted connections) | [`a5sf-bl42-netdeny/README.md`](../a5sf-bl42-netdeny/README.md) §1–§5, §6–§8 |
| the network proof is bound to the face that consumes it (`NETWORK_PROOF_FACE_MISMATCH`) | [`a5sf-pd15-face-bound-proof/README.md`](../a5sf-pd15-face-bound-proof/README.md); register PD-15 |
| a Member's `bash` was routed to the confined **subprocess** face for the network axis, but a shell body's reads stayed unattributed | [`a5sf-pd12-fix/README.md`](../a5sf-pd12-fix/README.md); register PD-12 residual (2) |
| the product declaration surface (`a5sfMemberPolicies`) cannot request a process face | `packages/runtime/team-services/src/product-assembly.ts#L87-L91` ("WHAT IS DELIBERATELY NOT REACHABLE FROM PRODUCT CONFIG"); pinned by `a5sf-product-assembly.test.mjs` PA4 |
| no shipped composition declares a terminal face, so the Shell-PTY rows stay `NOT_WIRED` | register PD-3/PD-13 status; `TOOL-ACCEPTANCE-MATRIX.md` M-08/M-13 |
| the live Member shell measured in the PTY dev-live lane was the **kit** smoke preset's persistent PTY, not the shipped default | [`a5sf-pty-devlive/run-boot.mjs`](../a5sf-pty-devlive/run-boot.mjs) L401, L484, L1105 |

**One correction this lane makes to the framing it was given**, because it changes
what the owner is weighing: the shipped product does **not** inherit a persistent
PTY. The shipped profile selects the host bundles `@deepseek-ai/dsh-base` +
`@deepseek-ai/dsh-web-app`; the deployment default preset is `standard`
(`packages/bundle/web-app/cordis.patch.yml` → `agent-preset-registry.config.default:
standard`), and `standard` mounts the **transient** `@deepseek-ai/dsh-tool-bash`
over the host `ctx.shell` — no `dsh-terminal`, no `terminals` service, no PTY
(measured: `impact-table.json` `rows[]` for `standard.patch.yml`,
`host.hostHostLevelRows.terminalsProducerAtHostLevel = false`). The persistent
shell lives in the host's `minimal` preset and in the **kit** presets
(`tests/kits/_shared/preset-seam.mjs#persistentShellGroup`). So:

* for a Member on the shipped default, "`cd` persistence / interactive stdin" is
  **already not there** — declaring the faces does not take it away;
* for a Member on a `minimal`-shaped or kit preset, it **is** there, and declaring
  the faces takes it away *and* refuses the install outright (see §3).

---

## 2. Census — every composition and agent preset in the tree

Measured by [`measure.mjs`](measure.mjs) (`impact-table.json` `rows[]`). "Shell
today" is what the model-visible `bash` currently resolves to; "publishes
`terminals`" means the row list contains `@deepseek-ai/dsh-terminal` on a scope the
Member agent inherits (the precondition for the double-terminal refusal).

| # | composition / preset | origin | declares today | shell today | publishes `terminals` | to declare the governed faces |
|---|---|---|---|---|---|---|
| 1 | `cordis.patch.yml` (the shipped bundle layer) | this tree | host row `dsh-agent-team/host`, `team-spill-local`, client. **No preset row, no `rootPresetId`/`memberPresetId`, no `a5sf*` key, no realm face.** Members therefore take the deployment default | **none of its own** — inherits `standard` (transient) | no | a provider row that provides `teamA5sfRealm` (a shipped module; none exists), an enablement key that does not fork (none exists — §6.3), and a Member preset without `persistent-shell`. Also: a **v4** blueprint with `memberIoCeilings` (§6.2) |
| 2 | `opshome/.dsh/profiles/web/cordis.patch.yml` (operator profile) | this tree | team row override (`rootPresetId`/`memberPresetId` = `u7as-base-…`) + preset `u7as-base-…` (persona, `tool-fs`, `tool-fs-search`). No shell row at all; absolute `file:///srv/...` URLs point at another worktree | **no `bash` tool** | no | the same three items as #1; this profile's preset would gain a `bash` row for the shadow to replace |
| 3 | `opshome/.dsh/profiles/web/cordis.yml` | this tree | `[]` — the profile root; the tree is composed from bundles + `cordis.patch.yml` | none | no | n/a (not a composition) |
| 4 | `packages/runtime/test/issue2-fixtures/presets/i2-standard/agent.cordis.yml` | this tree | a **retired** legacy directory-shape preset (two fixture tools). Nothing reads `.agent-presets/` on the pinned generation | none | no | n/a (fixture; migration is `preset-seam.mjs`'s job) |
| 5 | `web-app/presets/standard.patch.yml` | pinned host (read-only) | `persona`, `agent-instructions`, **`tool-bash` (transient)**, `tool-pwsh`, `tool-fs`, `tool-fs-search`, `tool-jobs`, skills, goal, plan-mode, … | transient host shell (`ctx.shell` → `SandboxBashExecutor`) | no | **do not edit**: `CORE PATCH BUDGET = 0`. Declare a governed preset in THIS tree instead |
| 6 | `web-app/presets/minimal.patch.yml` | pinned host (read-only) | `persona` + **`persistent-shell` group** (`pty` = `dsh-terminal`, `terminal-bash`, `persistent-bash`) with `isolate: { terminals: true }` | persistent PTY, state survives, real `/dev/pts/N` | **yes** | same; and a Member on this preset must **drop the group** first (§3, §5) |
| 7 | `web-app/presets/ptc.patch.yml` | pinned host (read-only) | `tool-bash` (transient) plus the ptc tool set | transient | no | same as #5 |
| 8 | `web-app/presets/cordis.patch.yml` (`cordis` preset) | pinned host (read-only) | `tool-bash` (transient) + fs/search/jobs/… | transient | no | same as #5 |

**The deployment default is `standard`** (`agent-preset-registry.config.default:
standard`, `packages/bundle/web-app/cordis.patch.yml#L562-L565`), and neither
`dsh-base` nor `dsh-web-app` mounts a **host-level** `terminals` producer
(measured: `host.hostHostLevelRows.perBundle = { "dsh-base": false, "dsh-web-app":
false }`). Consequences that matter:

* the double-terminal refusal is **not** triggered by the shipped product today —
  it is triggered the moment the Member's preset is a persistent-shell one;
* a deployment whose profile installed the `sdk-minimal` bundle **would** have a
  host-level `dsh-terminal` (`packages/bundle/sdk-minimal/cordis.patch.yml#L51`)
  and every Member realm would refuse the face. That bundle is not what this
  repo's profile selects, but it is the failure mode a profile switch can create.

Also in-tree, but *preset builders* rather than declared compositions (they mount
the same shape from code): `tests/kits/_shared/preset-seam.mjs`
(`persistentShellGroup`, `smokePresetPlugins`) and its 19 call sites — full list in
§5.

---

## 3. The exact consequence of declaring the faces, per composition

Two different outcomes, and the split is the whole decision:

| Member preset today | declaring `terminal` + `subprocess` | what the Member ends up with | what the user loses |
| --- | --- | --- | --- |
| `standard` / `cordis` / `ptc` / the exemplar (transient `tool-bash`) | **accepted** — nothing on the Member's scope publishes `terminals`, so the install has no fork to refuse | one `bash`, served by the confined terminal face; each command a fresh confined child; named reads admitted against the compiled lane | `run_in_background` (job registry), per-call `timeoutMs`, `sandbox_permissions`/`justification`, the structured result object. **Not** `cd`/`export` — the transient tool never had them |
| `minimal` or a kit persistent-shell preset | **REFUSED** at install: `TERMINALS_DOUBLE_TERMINAL_REFUSED` (`install.ts#L379-L386`) | **no Member at all** — `agent-bindings.mjs` fails closed on a mount rejection and rolls the unpublished agent back (`agent-bindings.mjs#L2576-L2586`) | the Member cannot be created. This is stricter than "no shell": there is no Member to have a shell |
| a preset with **no** `bash` row (`opshome` profile #2) | accepted, but there is no `bash` name to shadow — route-C shadow is surface-neutral and never adds a name | confined faces mounted, **model still has no shell** | nothing gained for the shell; the fs faces still apply |

The capability list is read off code, not assumed:
`packages/runtime/src/plugin/live/confined-terminal-tool.mjs#L89-L104` registers
`bash` with `command`, `description`, `workdir` only; the host's transient
`tool-bash` registers `command`, `description`, `timeoutMs`, `workdir`,
`run_in_background` (when a job registry is composed) and
`sandbox_permissions`/`justification` (when the deployment exposes escalation
modes) — `tests/deepseek-harness-test-use/packages/shell/tool-bash/src/index.ts#L376-L407`.
The persistent tool registers `command` only —
`packages/shell/tool-bash-persistent/src/index.ts#L415-L421`.

**The drop-the-legacy-row diff is [shown and not applied](diff/drop-legacy-row.diff)**
— it targets our own `tests/kits/_shared/preset-seam.mjs`, states the failure it
prevents (`TERMINALS_DOUBLE_TERMINAL_REFUSED` → rolled-back Member, pinned by
`a5sf-pd13-terminal-read-axis.test.mjs` arm C4), and states what 19 kit worlds
would lose. The same edit to the pinned host's `minimal.patch.yml` is **forbidden**
(`CORE PATCH BUDGET = 0`); the alternative is declaring a new preset, which is the
exemplar.

---

## 4. The smallest governed preset exemplar

[`exemplar/`](exemplar/) is an installable bundle (a `package.json` +
`governed-member-preset.patch.yml` + the proposed provider module
[`a5sf-governed-realm.mjs`](exemplar/a5sf-governed-realm.mjs)). It is **committed
as evidence and not installed, not merged, and not booted.**

What it declares, and why each piece is required:

1. **A host row providing `teamA5sfRealm`.** The host row reads it lazily
   (`host.ts#L2319`); a preset cannot supply it (a preset service must be isolated
   with its consumers, and the consumers here are host plugins). The module parses
   the SAME product declaration with the ONE shipped parser and then **adds** the
   two faces — it compiles no lane of its own.
2. **A Member preset with the transient `tool-bash` and no `persistent-shell`.**
   The `bash` name must exist for route-C to shadow it, and a `dsh-terminal` row on
   an ancestor scope turns the install into a refusal.
3. **A v4 blueprint with a `memberIoCeilings` family.** The shipped blueprint is
   `schemaVersion: 3` with no ceilings, and a declaration against it is refused
   `MEMBER_POLICY_WITHOUT_BLUEPRINT` (`product-assembly.ts#L624-L632`). This is a
   **product design change**, not wiring.
4. **`network: allow` in the ceiling** — because `deny` is refused before any realm
   exists (§6.1). This is the exemplar's honest limit, not an oversight.

**What it gives up** (the comment block in the patch file repeats it so an
operator cannot install it without reading it): the network still is the host's;
no persistent shell state; no background jobs, timeout or escalation; dynamic
reads (`$(…)`, backticks) are not attributed; an absolute path outside the read
lane makes a command the model thought was safe refuse before it starts. The
provider module additionally declines to invent a policy: with no
`config.memberPolicies` it throws rather than mounting a permissive realm.

The exemplar's checks are machine-run by `measure.mjs`: the patch parses, both rows
are present, the team row enables the realm and selects the preset, no persistent
shell and no `terminals` producer appear anywhere in it, the declared program is
absolute, the declared shell class admits it, and every relative import resolves at
the **proposed** product location in both source and dist
(`impact-table.json` `exemplar.ok`).

---

## 5. Blast radius, by name (measured)

`impact-table.json` `census.blastRadius`. Re-running the a5sf family is unaffected
today (`a5sfSuitesReadingShippedRow = []`): **not one** `tests/world-factory/a5sf-*`
suite reads the shipped composition, `cordis.patch.yml`, `opshome`, or a preset id.
They build in-process Cordis roots or their own profile patches. So "the shipped
preset changed" cannot break the a5sf gate; what it changes is what a *booted*
world's Member sees.

**Mounts the persistent-shell shape directly** (7 files):

* `tests/kits/_shared/preset-seam.mjs` — the ONE shape (`persistentShellGroup`)
* `tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs`
* `tests/world-factory/a5sf-pty-contract.test.mjs` + `tests/world-factory/lib/a5sf-pty-contract-world.mjs`
  (inject the real `TerminalSessionService` port — they keep working, but a world
  asserting "the Member's shell is a PTY" would assert something no longer true)
* `packages/runtime/test/live-persona-observer.test.ts`
* `packages/runtime/test/a5sf-provider-composition.test.ts`
* `packages/testkit/test/rc2-kit-preset-seam.test.ts`

**Mount it through the seam** (19 files — each is a world/preset that would hit
`TERMINALS_DOUBLE_TERMINAL_REFUSED` on the day a realm declares the face in the
same world):

`tests/kits/a5-pr1-guard-dispatch/a5p1-kit.mjs`, `tests/kits/a5-w7-jobs-wiring/a5w7-kit.mjs`,
`tests/kits/a5-w7m-m13-domain-veto/a5w7m-kit.mjs`, `tests/kits/a5p1diag/a5p1-kit.mjs`,
`tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs`,
`tests/kits/exec-contract-live-smoke/exec-contract-live-smoke.mjs`,
`tests/kits/send-message-liveness-smoke/send-message-liveness-smoke.mjs`,
`tests/world-factory/lib/u6-arc-a-assembly.mjs`, `lib/u6-arc-d-assembly.mjs`,
`lib/u6-fs-assembly.mjs`, `lib/u6-proc-assembly.mjs`, `lib/u7-census-assembly.mjs`,
`lib/u7-fsmut-assembly.mjs`, `lib/u7-fui-assembly.mjs`, `lib/u7-pwsh-assembly.mjs`,
`lib/u7-tbash-assembly.mjs`, `lib/u7f-web-assembly.mjs`, `lib/u7r3-uif4-assembly.mjs`,
`tests/world-factory/suites/140-u7r3-bootwave.mjs`.

**Mention `persistent-shell` without mounting it** (4 files):
`install.ts` / `types.ts` (the refusal text), `a5sf-pd13-terminal-read-axis.test.mjs`
(the C4 control), `lib/u6-jobs-assembly.mjs` (a design comment).

**Select presets by id** (`memberPresetId`/`rootPresetId` appear in 54 files) —
the two that pin the *shipped* default are the ones to re-read if the default
preset ever moves: `tests/kits/pr-c-mcp-isolation-smoke/pr-c-mcp-isolation-smoke.mjs`
(C6: "shipped state standard == standard (row config leaves the preset ids ABSENT)")
and `tests/kits/pr-e-requirement-recovery-smoke/pr-e-requirement-recovery-smoke.mjs`
(B9/B9b drive `standard` and `bare`).

**The only a5sf suite that names the legacy-terminal fork**:
`tests/world-factory/a5sf-pd13-terminal-read-axis.test.mjs` (C4). If the shipped
preset moved to a persistent-shell shape, that suite's control would become the
product's actual behaviour.

---

## 6. Three measured reasons "declare it" is not a config edit

All three are re-assertions of documented limits, run by `measure.mjs` so this
table fails loudly if one is lifted — not new findings.

### 6.1 The product declaration path refuses `network: deny`

`measure.mjs` probe → `probes.networkDenyRefusal = { refused: true, code:
"NETWORK_UNCONFINED_REALM" }`. The refusal is at
`product-assembly.ts#L862-L873`: *"the Member realm installs no web face, so the
narrowing could not be enforced"*. So a governed preset built on the product
declaration cannot express the very lane BL-42 made OS-enforceable. The confined
child therefore runs with `network: allow` — and `subprocess.ts#L1444-L1500` only
sets `networkProfile: 'deny'` when `effective.network.access === 'deny'`, so **no
netns is requested**. The product's network row stays `unsupported` whatever this
decision does.

### 6.2 The shipped blueprint cannot carry a Member ceiling

Shipped `cordis.patch.yml` blueprint is `schemaVersion: 3` with no
`memberIoCeilings`. `product-assembly.ts#L624-L632` refuses any declaration
against a non-v4 blueprint (`MEMBER_POLICY_WITHOUT_BLUEPRINT`). A governed Member
therefore requires the shipped team design to move to v4 — a product-design change
that the owning lane must carry, not a wiring row.

### 6.3 The only non-forking enablement key is an evidence file path

`a5sfRealmConfigOf` (`a5sf-realm-row.mjs#L323-L352`) answers `undefined` — and the
mount is never attempted — unless the team row carries `a5sfEvidencePath`,
`a5sfMemberPolicies` or `a5sfMemberAuthority`. The latter two both set
`config.memberPolicies`, and a row carrying both a declaration and a provided
`teamA5sfRealm` throws *"two compiled-realm sources for one Member is ambiguous"*
(`a5sf-realm-row.mjs#L764-L772`). That leaves `a5sfEvidencePath` — a file path,
which the shipped layer's own header forbids ("Machine-agnostic by contract …
no machine paths"). **A neutral enablement key is the smallest real blocker in this
whole analysis, and it is ours, not the pinned host's.**

`measure.mjs` also records `probes.compiledAnswerKeys = ["members"]` and
`probes.compiledAnswerCarriesFaces = []`: the product provider's answer has no
`subprocess`/`terminal`/`web` key at all (`A5sfProductCompiledAnswer`,
`product-assembly.ts#L363-L367`), which is why the service path is the only one.

### 6.4 What is *not* a `CORE_SEAM_BLOCKER`

Nothing in this analysis hits a pinned-host schema refusal: a `teamA5sfRealm`
provider row is an ordinary host plugin row, a preset is an ordinary
`@deepseek-ai/dsh-agent-preset` declaration, and the confined faces are mounted
through the existing isolate/plugin seam. The blockers above are **this repo's own
product surface** (`product-assembly.ts`, `a5sf-realm-row.mjs`, the shipped
blueprint) — reporting them as a core seam blocker would be false. No
`CORE_SEAM_BLOCKER` is raised, and `CORE PATCH BUDGET` stays 0.

---

## 7. What a Member can do today vs. after

| | today (shipped default `standard`) | after a governed preset |
|---|---|---|
| `bash` body's file read of an out-of-lane path | returned as bytes, no lane consulted (PD-13's measured hole) | refused before the shell starts, `IO_READ_DENIED`, 0 bytes, 1 `shellRead` guard fact |
| the child's filesystem | host `bwrap` profile from the preset's executor; not the Member's compiled ceiling | the confined subprocess face's Landlock profile, driven by the compiled ceiling |
| `network: deny` on the shell | refused at the face only if the face is called; the shell never calls it (PD-12) | **still not delivered** — the ceiling cannot say `deny` (§6.1), so the child shares the host netns |
| `run_in_background` | available (job registry) | gone |
| per-call `timeoutMs`, `sandbox_permissions` | available | gone |
| `cd`/`export` persistence, interactive stdin | **already absent** on `standard`; present on `minimal`/kit presets (and then the Member does not survive the face declaration at all) | absent |
| long builds | run as collectable jobs | must fit one call or be backgrounded inside the command (`&` does not survive the call) |

---

## 8. Recommendation and the authorising sentence

### 8.1 Recommendation

**Yes — declare the governed faces, on a NEW opt-in preset, in a round that also
lands the three enabling product edits (§9). Do not move the deployment default in
that round.** Rationale, in owner terms: the read axis is a real hole that is fixed
today only for compositions nobody ships; the default preset's shell is transient
already, so an opt-in preset costs existing users nothing at all, and a Member that
selects it trades collectable background jobs for attributable reads and a confined
child. Moving the default would silently take `run_in_background` from every
Member, which is a separate, user-visible product decision that should be made on
its own evidence.

**The exact sentence the owner is asked to authorise:**

> Owner authorises: ship a governed Member preset (`a5sf-governed-member`) beside
> the existing default, selected explicitly by an operator; the deployment default
> stays `standard`, and no existing Member changes behaviour until its Team selects
> the governed preset. The preset's `bash` is the confined terminal face — a fresh
> confined child per command, named reads admitted against the compiled read lane,
> no persistent shell state, no background jobs — and it does **not** claim the
> network deny, which stays a separate authorisation.

### 8.2 What would change this answer to "not yet"

* If Member workflows depend on `run_in_background` for long commands (builds,
  test suites, servers) **and** the product will not carry a job-backed confined
  mode, then an opt-in preset still ships but is usable by few; the answer becomes
  *not yet, until the confined terminal tool can hand a command to the job
  registry*. Today it cannot: the tool kills its session in `finally`
  (`confined-terminal-tool.mjs#L152-L158`), so a backgrounded command would be
  killed with it.
* If the owner's actual goal is the **network** row (`unsupported` → `enforced`),
  then this decision does not deliver it and should be sequenced *after* the
  `product-assembly.ts` change in §9.3 — otherwise the product gets a confined
  shell with host network and the honest sentence does not move.

---

## 9. The smallest change that puts a Member inside the governed path today

Not a config edit. Three edits, each in a file the Integration Owner owns:

1. **A shipped provider module** — [`exemplar/a5sf-governed-realm.mjs`](exemplar/a5sf-governed-realm.mjs)
   at `packages/runtime/src/plugin/live/a5sf-governed-realm.mjs`, plus one
   `exports` entry in the root `package.json`. ~150 lines, no upstream patch;
   every import is this repo's own module.
2. **A neutral enablement key** (§6.3) — `a5sf-realm-row.mjs#L323` learns one more
   accepted key (e.g. `a5sfGovernedRealm: true`) and `plugin/types.ts` declares it.
   Without it the shipped layer cannot enable the service path without a machine
   path or a fork.
3. **A v4 blueprint with `memberIoCeilings`** in the shipped team design (§6.2) +
   the governed preset row + `memberPresetId` — the exemplar shows the shape.

For the **network** half, a fourth, separate authorisation:
4. `product-assembly.ts#L862-L873` must stop refusing a narrowed network lane when
   the composition declares a process face that mints a face-bound proof. Until
   then `network: deny` is unreachable from the product path and the matrix'
   network row cannot move.

**Cost in user-visible capability**, stated as the trade the owner is buying: a
Member's `bash` stops running arbitrary host commands and starts being a
command-scoped confined shell — it can no longer keep `cd`/`export` between calls
(on the shipped default it never could), cannot collect a long command as a job
(it can today), cannot ask for a wider sandbox for one command (it can today), and
will refuse a command that names an absolute path outside its lane *before* the
command runs (today the bytes come back). In exchange, a read the Team's ceiling
forbids stops being delivered to the model. That is the whole trade; the network is
not in it.

---

## 10. Gates (this lane)

| gate | result |
| --- | --- |
| `node scripts/doc-checks.mjs` | exit 0 (evidence is a preserved-text prefix; no doc row changed) |
| `node --test tests/world-factory/a5sf-*.test.mjs` | 508 tests / 504 pass / 0 fail / 4 skipped — **unchanged from baseline** (this lane changes no product code) |
| `node dev/agent-workflow/evidence/a5sf-face-decl-impact/measure.mjs --check` | `impact-table.json` is current (needs the pinned test host at `tests/deepseek-harness-test-use`, like every other gate in this repo; without it `census.host.hostTreePresent` is `false` and the host rows are reported as absent rather than fabricated) |
| `git diff --check` | clean |
| boots | **0** (no Host start, no port bound, no `DSH_HOME`) |

Logs: [`gates/`](gates/). Baseline for the family run was taken on the same tree
before any file in this lane existed.

## 11. Reproduction

```bash
node dev/agent-workflow/evidence/a5sf-face-decl-impact/measure.mjs          # rewrite the table
node dev/agent-workflow/evidence/a5sf-face-decl-impact/measure.mjs --check  # gate it
node --test tests/world-factory/a5sf-pd13-terminal-read-axis.test.mjs       # the face + C4 fork control
```

## 12. What this evidence does not claim

* Not that the exemplar composes on a live Host. It was never installed and never
  booted; its checks are static + one real import of the shipped declaration
  parser. `DEV-LIVE` count = 0.
* Not that declaring the faces makes any member of `TOOL-ACCEPTANCE-MATRIX` move.
  M-08/M-13 stay `NOT_WIRED` and `V@B=no` until a live acceptance round; this memo
  is not that round and does not touch the matrix.
* Not that the double-terminal refusal is the only way a preset can lose its shell
  — a preset with no `bash` row simply has none to shadow (row #2 in §2).
* Not that the census is complete for *installed* profiles: `tests/homes/**` and a
  user's own `$DSH_HOME/profiles/**` are gitignored and were not read. The census is
  of this tree plus the pinned host's shipped bundles.
* Not that `network: restricted` is reachable: it is still refused by the compiler
  (`IO_POLICY_UNSUPPORTED`, register PD-3/BL-42). This lane touched neither.
