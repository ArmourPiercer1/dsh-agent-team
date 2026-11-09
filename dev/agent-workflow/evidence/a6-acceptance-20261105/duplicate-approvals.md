# Duplicate-approval evidence (real Host, rerun 2026-11-05T13-22-47)

## The two durable requests

| Fact | Request A | Request B |
|---|---|---|
| requestId | `ctrl-0v7zhk11cthwri0oz5zvj1eh` | `ctrl-1u2v1ph1qgwmja0mzqqc70ww` |
| actionName | `parameter-permission` | `team-tool-execute` |
| kind | `leader-approval` | `leader-approval` |
| subject / operation owner | `inst-0k257w10zy8l` (worker) | `inst-0k257w10zy8l` (worker, template `worker`) |
| reviewAuthority | `leader` | `leader` |
| requestedEffect | `allow` | `allow` |
| authorityScope | `{operationClass: 'bash', matcher: {kind:'exact', resource:'bash'}}` | `{operationClass: 'tool-invoke', matcher: {kind:'exact', resource:'c1-plane-realm-…\|tool:bash'}}` |
| operationFingerprint | `sha256:00128488e222…` | `sha256:28a0b0a39a8e…` |
| effectSetFingerprint | absent (guard row) | `sha256:77b14744144e…` |
| parametersFingerprint | absent | `sha256:bf9a1579644d…` |
| authorityGeneration | absent | `0` |
| approvalCaseId | `case-074mw220svpzjh1e82qac0np` | `case-0fhb7gr18blcwc15570st05x` |
| decider | `inst-leader` (`role: leader`) | `inst-0alpljp1t5ni` (Officer; `reviewCapability.source = blueprint-officer`, `effectiveReviewAuthority = leader`) |
| decision / sequence | allow / 8 | allow / 11 |
| consumption / sequence | sequence 9, paired to decision 8 | sequence 12, paired to decision 11 |
| execution result | one bash command executed once | same invocation |

## Are they substantively duplicate?

**Not byte-identical and not a replay of one approval.** Every identity that the authority
plane checks differs: request id, approval case id, operation fingerprint, authority scope,
effect-set/parameters fingerprints (B only), and decider. Each allow was consumed exactly
once, and the guard's decision sequence was paired to its own consumption. No second
execution occurred.

**They are two layers of one invocation.** A asked the host's parameter-permission guard to
allow the bash parameter; B asked the PA effect boundary to authorize the tool invocation.
If both were surfaced to the same human, that person would be deciding the same command
twice. In this run A went to the Leader through the legacy notification path (the row lacks
Alpha.6 ordinary-tool facts, so it is legally Leader authority) and B went to the assigned
Officer; no human was involved.

## Minimal recommendation

Do **not** merge the two approvals in this round. The evidence proves the current layering is
safe and one-shot; it does not prove a general cross-entry reuse rule. If a future round
removes the duplicate decision burden, the only defensible direction is a PA→Guard handoff:

1. the PA leg must prove the guard's consumed approval names the **same subject, operation,
   parameter fingerprint and effect set**;
2. the PA leg must still re-check the authority generation, hard ceiling and effect-set
   coverage at execution time;
3. the PA one-shot consumption must remain exactly once, and a prior Control allow must
   never be treated as valid for a later PA leg without those checks;
4. no unconditional skip, no Guard weakening, and no extension to `bash@bash` or other
   entries without a minimal design ruling.

Until then, the duplicate is accepted as a disclosed layering cost.
