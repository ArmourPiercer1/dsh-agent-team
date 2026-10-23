# dev/engineering — derived current state (EB1-C, v0)

Two files, two very different jobs:

| file | who writes it | what it may contain |
| --- | --- | --- |
| `registry.yaml` | a human, in a PR | only decisions and references that cannot be derived: status per axis, owner role, citations, evidence paths |
| `current-state.json` | `node scripts/gen-current-state.mjs` | a read-only assembled view: registry + Git facts + evidence existence. **Generated. Never hand-edit.** |

`registry.schema.json` states the shape; enforcement is hand-rolled inside the
generator (rule by rule, printed on failure) so this runs in a worktree with no
`node_modules`. It is not a JSON-Schema-processing dependency claim.

## The four axes (INV-EB-0009)

```
decision_status        proposed | accepted | rejected | superseded | pending_coordination
implementation_status  not_started | in_progress | implemented_in_branch | merged
verification_status    not_verified | verified_local | verified_ci | verified_host
release_status         not_released | candidate | released
```

None implies another. `accepted + merged + not_verified + release_blocked` is a
legal, common combination. `verified_*` requires at least one path in
`verification_artifacts` that **exists**; the generator refuses (exit 1, code
`FAKE_VERIFICATION`) rather than passing a claim with no artifact. That refusal
is a delivered negative control, exercised by
`scripts/doc-consistency-controls.mjs`.

## What this does not replace

`dev/agent-workflow/graph.yaml#current_contract` remains the current execution
authority. This bridge **reads** it and mirrors `current_phase` plus the
`current_contract` baseline into the generated view as read-only data. There is
no path by which this generator writes `graph.yaml`, and switching the old
consumers is a separate, coordinated migration (E1 exit condition), not a
consequence of these files existing.

Regenerate: `pnpm docs:sync --write` (or the generator directly).
Verify freshness in CI: `pnpm docs:sync --check`.
