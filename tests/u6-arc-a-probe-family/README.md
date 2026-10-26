# u6-arc-a-probe-family — the ARC-A PROBE lane (TEST-ONLY)

Owner role: **U6 slice-1 ARC-A proof lane**. This is a FAMILY, written by a
consumer's hand, that rides the shipped governance-center public seams
(contribution schema, registry, kernel, host-surface adapter) with
**ZERO diff to any product center file**. It exists to make a law testable:
"A NEW family can mount, declare, plan, refuse, execute and settle" must be
demonstrable WITHOUT touching the center — if this lane could only mount by
editing the center, ARC-A would be false.

| file | role |
| --- | --- |
| `src/probe-contribution.mjs` | the declaration — a `FamilyContributionInput` built through the PR1 schema (literal `nativeNames`, closed familyId `dsh.u6-probe-family`) |
| `src/probe-assembly.mjs` | the mount point — its OWN registry + enforcing kernel over `createCenterAssembly`, the approval-entry bind, the one-shot consume walk, and the marker-write family body |

Hard law — **test-only**: nothing under `product` profiles may import this
lane; it is booked `mount: 'test-only'` in
`dev/agent-workflow/ledgers/arc-a-family-census.json`, and the fitness gate
(`packages/runtime/test/u6-arc-a-fitness.test.ts`) fails the tree if a
product file ever imports it. The marker effect writes only into a
caller-supplied directory (never the repo, never a DSH home).

Consumers: `packages/runtime/test/u6-arc-a-probe-family.test.ts` (C1 walk:
mount → plan → execute → settle + every refusal leg, zero-effect verified
against the filesystem, never a transcript) and
`tests/world-factory/u6-arc-a` (C2: the same lane mounted on a REAL Host
through `canary/u6-arc-a-probe-host.mjs`).
