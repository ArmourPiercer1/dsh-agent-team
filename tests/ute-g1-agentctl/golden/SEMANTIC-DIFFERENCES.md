# Semantic differences — `dsh.agent-control-family` (UTE-3 / G1 B1)

Three differences between the governed agent-control old path (the governed
family body at C1) and the native path (the pinned host's own agent-control
rows) are MEASURED and declared below. **Every one is retirement-blocking and
carries NO approval record.** `SemanticDifferencesResolved` is therefore false by
construction, not by opinion, and retirement stays refused.

Printed form (one line each, from `lib/semantic-differences.mjs`):

```
SEMANTIC-DIFF id=SD-AGENTCTL-1-route-c-unserved blocking=yes approval=none
SEMANTIC-DIFF id=SD-AGENTCTL-2-native-name-claim-not-graded blocking=yes approval=none
SEMANTIC-DIFF id=SD-AGENTCTL-3-governed-admission-surface blocking=yes approval=none
```

retirement-blocking   YES
approval              NONE

## SD-AGENTCTL-1-route-c-unserved

The product route-C composition serves **none** of the seven booked members.
`attachA5sfNativeToolModules` (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`)
appends confined shell/search/fs/skill/present/web shadows, and **no
agent-control spec**. Measured on the product route-C: every one of the seven
dispatches is an `unknown tool` refusal, `providerCalls=0`, `guardFacts=0`.

Consequence: a retirement that “switched to the route-C path” would switch this
family to nothing. A replacement must be a NEW native binding that does not
exist at B1. That is a product change, not a same-meaning swap.

Evidence: `dev/agent-workflow/evidence/ute3-agentctl-b1-20261121/composition-probe.txt`
(`PROBE-ROUTE-C` lines).

## SD-AGENTCTL-2-native-name-claim-not-graded

The governed family claims all seven RESERVED native spellings, but the natexe
name ledger does not grade a family claim:

- `PLANE_SUPPORTED_NATIVE_TAKEOVERS` declares no agent-control class (classes:
  `bash`, `read`, `grep`, `glob`, `write`, `edit`, `read_image`, `jobs`);
- `verifyPlaneNames` is closed to the grep/glob/bash map, so it cannot express
  these names at all;
- `family-assembly.mjs` contains **zero** references to `PLANE_RESERVED_NATIVE`.

Name ownership between the enabled family and the host preset is therefore
unresolved by construction. Retiring the family is a name/schema change the
ledger never adjudicated.

Evidence: the probe's `PROBE-PLANE` lines + the three source files named above.

## SD-AGENTCTL-3-governed-admission-surface

Every **admitted** governed row opens a real PA Control ask and consumes a
fingerprint-bound, one-shot grant before the runtime port runs. The fixture
records `control=1;decisions=approve` on every allow row and `control=0` on every
pre-PA fence refusal (schema, amplification, context-authority, scope,
template-default-deny, cancellation). The host native rows do not ride this
plane PA edge (route-C mounts no agent-control shadow).

Consequence: removing the family removes an approval round-trip and a one-shot
consume from the model-visible path. That is a permission-surface change, not a
same-meaning switch.

Evidence: `tests/ute-g1-agentctl/golden/old-path.tsv` (`facts` column) +
`PROBE-ROUTE-C` lines.

## What these differences are not

They are not a refusal to compare: the fixture compares the governed old path
against itself idempotently and the refusal surface goes through the IMPORTED
closed category vocabulary (`tests/ute-g1-fs/lib/refusal-categories.mjs`), with
unmapped codes raising `REFUSAL_VOCABULARY_INCOMPLETE` and the residual bucket
`other` unreachable. They are a refusal to RETIRE without an owner decision that
names the replacement native binding and resolves name ownership.
