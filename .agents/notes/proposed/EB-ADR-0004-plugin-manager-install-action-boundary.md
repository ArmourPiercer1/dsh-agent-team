---
id: EB-ADR-0004
status: proposed
title: Alpha.5 declines to promise isolation of install_bundle's install-internal IO; the other seven plugin_manager actions keep their obligations, and the residual question stays open
decided: 2026-10-24
owners: [Contract/Security Owner]
affects:
  - docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-B-FAMILY-TARGET-CONTRACTS.md
  - docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md
references:
  - docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-B-FAMILY-TARGET-CONTRACTS.md
  - docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md
  - docs/plans/active/alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md
  - docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md
  - docs/ideas/IDEA-EB-0002-install-internal-io-governance-review.md
  - IDEA-EB-0002
  - docs/contracts/engineering-baseline/ids.yaml
  - docs/glossary.md
---

## Context

`plugin_manager` is one tool name carrying a closed set of **eight actions** in the Host tree
(`packages/boot/plugin-manager/src/tools.ts:20–31`), with `approveEscalation` at `:38–45` and the
manager's own invocation at `:47–94`. The recorded rule for the whole tool is that **Host full-access
"no prompt" is not Team "allow"**: a call passes Team tool/action/target authorization *and* the Host's
escalation plus the service's own validation — the intersection of two gates
(`M0-B-FAMILY-TARGET-CONTRACTS.md` §B-PLUGIN, :136–:138). An earlier narrowing, recorded by main on
2026-10-23 at :215 (`ACTIVATION-TCB → USER_SCOPE_CLARIFIED`, `Sentinel_e08e9aeed9e08191bd7208454dca9323`),
already established that Alpha.5 governs the manager's management calls and does not build a general
sandbox for the initialization code of approved plugins. In the capability matrix the per-name row is
still `UNKNOWN` (`TOOL-CAPABILITY-MATRIX-9b2.md:117`).

On 2026-10-24 the user answered the remaining scope question and asked that the residue be kept as a
discussion item:

- **09:03:32Z**, on the `plugin_manager` installation boundary: *"只管理安装动作即可"*.
- **09:04:45Z**: *"请将这一点记录为后续待讨论项目。这只是目前 Alpha.5 这么做，以后如果发现有问题可能还会进一步升级管控。请同时更新当前文档和 PR #361 工程基线升级对应更新体系的文档。"*

Main holds and maintains that contract. At `c9258f50f8b9d9613f92be098803dfa046a01293`
(branch `feat/a5-m2-integration`) the current short table row for `plugin_manager` 8 actions
(`dev/agent-workflow/evidence/a5m2-integration/TOOL-TABLE-CURRENT.md:27`) carries the 09:03:32Z ruling;
that file is not in this checkout's tree, so it is cited by commit rather than as a local path. Main's
designated home for the same content is `ALPHA5-EFFECTIVE-BACKLOG.md` §D — **BL20** for the stage
decision and **BL21** for the open item — with the same wording supplemented in
`current-execution-plan.md` and the matrix keeping its history by append. **As of authoring, no `BL20`
or `BL21` text exists in the refs visible from this checkout**, so this note points at where main is
putting it rather than pretending to quote it, and root is narrowly amending one sentence there (see
below) without any structural change.

## Decision

**The narrow scope, stated exactly.** What Alpha.5 declines to promise is the isolation of the
**internal IO of one action: `install_bundle`** — the file writes, network fetches and any package
initialization code that the install performs once it has been permitted. It is *not* a statement that
`plugin_manager` now has only "install governance" and has otherwise been relaxed:

- **The other seven actions keep their existing governance obligations unchanged.** Nothing in the
  09:03:32Z answer touches them, and reading the ruling as tool-wide would be an over-generalization of
  a sentence about one action.
- **The install action itself is not exempted from anything it already owed.** It still requires an
  accurate target, real PA plus Host approval, an end-point freshness check, and waitcancel handling.
  Those are contract obligations on `install_bundle`, not consequences of the IO concession.
- **Nothing here is delivered or tested, and nothing here may be written as complete.** The obligations
  in the preceding bullet are contract requirements whose implementation and verification are not
  established by this note or by any receipt this line holds; "declined to promise X" is a statement
  about scope, and must not be read as "X-adjacent work is done".
- **Preserved unchanged:** the Host installer and `approveEscalation`. No fork of `plugin_manager`, no
  second manager, no re-implementation.
- **Not exempted beyond that one action:** every other tool's IO governance, and every other IO this
  tool's chain may perform outside `install_bundle`.

Two placements are deliberate. This note sits in `proposed/` and carries no `verified_by`: by the
mechanism's own rule a delivery claim belongs elsewhere, and here there is no delivery to claim —
`implementation_status` and `verification_status` are untouched and unimplied. And **no entry is added
to `dev/engineering/registry.yaml`**: its closed kind set
(`work-package` / `implementation-pr` / `gate` / `migration`) describes units of work, and per
`dev/engineering/work-package-authorization.md` a work-package entry is what mechanical work authority
attaches to, so creating one would manufacture exactly the follow-up construction authority the user did
not grant. Whether that kind set should grow a `decision` kind is a Contract Owner question about this
mechanism; it is named here so the gap stays visible instead of being quietly routed around.

## Consequences

- The residue is recorded as an open reconsideration item with no execution authority: `IDEA-EB-0002`
  (`docs/ideas/IDEA-EB-0002-install-internal-io-governance-review.md`, id in
  `docs/contracts/engineering-baseline/ids.yaml`), holding the three undecided questions — whether to
  govern install-internal IO at all, what observation would justify reopening it, and what maintaining
  it would cost.
- **One authority, one pointer.** Main's backlog §D (BL20/BL21), the execution-plan supplement, the
  matrix's appended history and the current short table are the contract; this note is the decision
  record and the pointer. When main's BL20/BL21 text lands in a ref this checkout can see, the pointer
  here is what gets repointed — nothing in this branch copies the contract, which is why there remains
  exactly one place to change it. If root's in-flight sentence amendment lands with different wording,
  main's wording wins and this note's bullet list follows it.
- Reading order: matrix row (`TOOL-CAPABILITY-MATRIX-9b2.md:117`, still `UNKNOWN` per name) → family
  contract and the 2026-10-23 boundary (`M0-B-FAMILY-TARGET-CONTRACTS.md:136–138`, `:215`) → main's
  current short table row at `c9258f50f…` (`TOOL-TABLE-CURRENT.md:27`) → this note for the 2026-10-24
  narrowing and its exact edges → `IDEA-EB-0002` for what is open.
- A future tightening would not be cheap: it would reach into the installer path and the
  `approveEscalation` seam in the Host tree and would have to avoid duplicating the Host's own
  script/version-exemption approval — duplicating a guarantee is how two authorities over one decision
  get created. That cost is the maintenance half of `IDEA-EB-0002`, and it has never been estimated here.
- This note moves directory only on delivery or rejection, neither of which is claimed. Approval of the
  boundary lives with the dated user answers and main's contract, not with a directory name.
