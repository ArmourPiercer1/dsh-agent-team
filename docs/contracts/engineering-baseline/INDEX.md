<!-- GENERATED FILE - do not edit. Rendered from docs/contracts/engineering-baseline/ids.yaml
     by scripts/gen-current-state.mjs; refresh with `node scripts/docs-sync.mjs --write`.
     docs:sync --check and docs:probe refuse when this file no longer matches the catalog. -->

# Engineering Baseline id index (20 ids)

Browsable listing over the machine-readable catalog. `ids.yaml` stays the source of
truth; this file exists so the ids can be read and cited without opening YAML.
Listing an id here grants it nothing: every entry stays
`proposed-not-ratified` until an approval is recorded in
`dev/engineering/registry.yaml` and the Contract Owner has reviewed it.

## acceptance (4)

### AC-EB-0001

- normative_status: proposed-not-ratified
- owners: Doc/Tooling Owner
- source_anchor: tests/doc-consistency/README.md
- statement: Given a source or generated derivative that is newer than its document, the probe names the owning document and fails; given a document-only Idea change, the probe passes without demanding runtime evidence.

### AC-EB-0002

- normative_status: proposed-not-ratified
- owners: Doc/Contract Owner
- source_anchor: .agents/notes/README.md
- statement: A note that claims delivery without a resolvable evidence artifact fails as NOT_VERIFIED; a proposal describing future behaviour passes.

### AC-EB-0003

- normative_status: proposed-not-ratified
- owners: Tooling Owner
- source_anchor: dev/engineering/README.md
- statement: Writing verification_status verified without a resolvable RUN artifact is refused by the state generator, and the four status axes are displayed independently in the derived view.

### AC-EB-0004

- normative_status: proposed-not-ratified
- owners: Doc/Contract Owner
- source_anchor: docs/glossary.md
- statement: A duplicated stable id, a deprecated synonym used in a current-state document, or a dangling reference fails the check; an unratified proposed entry does not fail merely because it is unimplemented.

## idea (2)

### IDEA-EB-0001

- normative_status: idea-no-execution-authority
- owners: CI/Test/Doc Owner
- source_anchor: docs/ideas/IDEA-EB-0001-change-impact-graph.md
- statement: Derive a change-impact graph that selects the minimal document and test set per PR from source symbols, owning contracts and dynamic tool-source deltas.

### IDEA-EB-0002

- normative_status: idea-no-execution-authority
- owners: Contract/Security Owner
- source_anchor: docs/ideas/IDEA-EB-0002-install-internal-io-governance-review.md
- statement: Reconsider whether the internal IO of the install_bundle action (installer file writes, network access, package initialization code) should be governed beyond the action's own permission and approval, what observed problem would trigger that discussion, and what maintaining it would cost; the other seven plugin_manager actions and all other tools' IO are outside this idea.

## invariant (10)

### INV-EB-0001

- normative_status: proposed-not-ratified
- owners: Contract/Security Owner
- source_anchor: docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-A-LIFECYCLE-CONTRACT-v1.1.md
- statement: A governed Team tool call executes only through the single ACTIVE binding observed on the Host for that scope; name equality never proves execution-body identity.

### INV-EB-0002

- normative_status: proposed-not-ratified
- owners: Contract/Security Owner
- source_anchor: docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-A-LIFECYCLE-CONTRACT-v1.1.md
- statement: Effects classification and both envelopes are complete and evaluated before admission; a partial classification is a refusal, not a permissive default.

### INV-EB-0003

- normative_status: proposed-not-ratified
- owners: Contract/Security Owner
- source_anchor: docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-A-LIFECYCLE-CONTRACT-v1.1.md
- statement: An Ask path produces zero unauthorized side effects before the decision; zero-effect is proven by external observation, not by a guard return value.

### INV-EB-0004

- normative_status: proposed-not-ratified
- owners: Contract/Security Owner
- source_anchor: docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-A-LIFECYCLE-CONTRACT-v1.1.md
- statement: Control consumption and PA consumption are each consumed exactly once and are distinct facts; neither implies the other.

### INV-EB-0005

- normative_status: proposed-not-ratified
- owners: Contract/Security Owner
- source_anchor: docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-A-LIFECYCLE-CONTRACT-v1.1.md
- statement: Cancel or restart never replays an already-consumed grant or an already-settled work unit.

### INV-EB-0006

- normative_status: proposed-not-ratified
- owners: Contract/Security Owner
- source_anchor: docs/plans/active/alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md
- statement: A governed tool never silently falls back to the native implementation; absence of takeover is a typed refusal.

### INV-EB-0007

- normative_status: proposed-not-ratified
- owners: Contract/Security Owner
- source_anchor: docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md
- statement: Non-Team sessions keep native DSH tool semantics; Team governance neither restricts nor expands them by accident.

### INV-EB-0008

- normative_status: proposed-not-ratified
- owners: Contract/Security Owner
- source_anchor: docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-A-LIFECYCLE-CONTRACT-v1.1.md
- statement: Settlement reflects the real outcome; an indeterminate termination is reported as indeterminate and never as success.

### INV-EB-0009

- normative_status: proposed-not-ratified
- owners: Doc/Contract Owner
- source_anchor: docs/contracts/engineering-baseline/README.md
- statement: decision_status, implementation_status, verification_status and release_status are recorded separately and none is derived from another; a verification claim without a resolvable RUN is NOT_VERIFIED.

### INV-EB-0010

- normative_status: proposed-not-ratified
- owners: Evidence Owner
- source_anchor: docs/TEST_METHODS.md
- statement: Automatic cleanup may touch only paths whose creation and ownership the cleaning process can prove; user homes, active worktrees and A-class evidence are never reachable by path or name heuristics.

## requirement (4)

### REQ-EB-0001

- normative_status: proposed-not-ratified
- owners: Doc/Tooling Owner
- source_anchor: docs/plans/memo/post-alpha4-debt-register.md
- statement: A fast document probe exists that resolves real Git change scope (committed, staged, unstaged) against a verified base, maps it to owning documents, and fails on stale derivatives or unsupported delivery claims while passing Ideas and Proposals that declare no runtime evidence.

### REQ-EB-0002

- normative_status: proposed-not-ratified
- owners: Doc/Contract Owner
- source_anchor: docs/plans/memo/post-alpha4-debt-register.md
- statement: A complete document sync exists in read-only check mode for CI and explicit write mode for maintainers; write mode never modifies normative contracts, approval status, or test results.

### REQ-EB-0003

- normative_status: proposed-not-ratified
- owners: Tooling Owner
- source_anchor: dev/agent-workflow/graph.yaml
- statement: Current engineering state is a derived read-only view assembled from the registry, Git and CI evidence; the generated view is never a second writable authority, and the legacy graph.yaml current_contract stays the execution authority until an approved migration.

### REQ-EB-0004

- normative_status: proposed-not-ratified
- owners: Tool Inventory Owner
- source_anchor: tests/paths.mjs
- statement: The expected tool baseline is derived from trusted upstream Host, reviewed Team declarations and trusted profile/config sources; it is mutable by source change and never a hand-maintained frozen name list, and a newly discovered tool becomes UNKNOWN rather than authorized.
