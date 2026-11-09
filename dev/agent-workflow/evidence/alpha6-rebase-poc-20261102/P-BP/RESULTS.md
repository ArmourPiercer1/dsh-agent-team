# P-BP — Blueprint Template × Tool routing (executed 2026-11-02, real UTC)

**Verdict: PASS (feasibility at the prototype layer).** 12/12 probe assertions
(11 → 12 in the 2026-11-02 review revision).
The production grammar is untouched; `reviewRouting` is validated by a
throwaway module (`review-routing.mjs`) that is not imported by any package.

## What was executed

```
npx vitest run --config dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/vitest.poc.config.ts \
  dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/P-BP/pbp.test.ts
```

## Findings

1. **The frozen canaries do not move.** v3 `team.rebase-canary` parses to
   `sha256:e71c4629…0cdd`; v4 to `sha256:0c6c1cee…a4b`. Both are pinned in the
   probe, so a later accidental field/grammar change turns this suite red.
2. **The current production entry refuses the family.** A v4 document carrying
   `reviewRouting` fails with `MALFORMED_DTO` and
   `details.unknownFields = ['reviewRouting']`. The refusal is real, but it
   lands in the core document normalizer rather than the v4 grammar's own
   closed-key pass — an implementation detail the final PR must not misread
   as "the grammar already tolerates the field".
3. **A minimal additive face resolves deterministically over the SAME frozen
   document.** With `officerTemplateId`, `default: officer`, and per-template
   `leaderExceptions` keyed by a trusted `{owner, name}` coordinate:
   - two instances of `researcher` get the SAME route for the same tool (the
     API has no instance input at all);
   - `researcher × dsh.shell/bash` → Leader while `analyst × dsh.shell/bash`
     → Officer (per-template, not global);
   - an exception matches only its exact owner/name coordinate;
   - the unconfigured majority defaults to Officer;
   - **the Officer must be a MemberTemplate**: naming the Leader template as
     `officerTemplateId` refuses (`reviewRouting/officer-not-member`);
   - **the Officer's OWN ordinary ask routes to the Leader**
     (`reason: 'officer-self-ask'`), never back to the Officer — the review's
     self-wait cycle;
   - `instanceId` and `label` selectors refuse
     (`reviewRouting/instance-selector`);
   - bad `default`, bad `whenOfficerUnavailable`, unknown template, duplicate
     selector and a missing owner/name all refuse with typed codes.
4. **The family must move the content hash.** Adding `reviewRouting` to the
   hashable v4 projection changes the hash, while the v4 core hash is
   unchanged. Therefore old v3/v4 hashes stay stable only across a **version
   boundary** — a v4 document that silently accepts the field would be the
   wrong shape.

## Residual decisions (not PoC-green)

- final field names, version digit and migration path;
- whether `enabled: false` is a legal authored state or only an absent block;
- the interaction with v4 `toolBindings` (one binding per owner/name, but the
  routing selector may need to reuse the shipped identity projection);
- where the validator lives (the v4 grammar's closed pass vs the document
  normalizer) so the refusal is single-sourced;
- Officer template must be a MemberTemplate, not the Leader template; the
  probe enforces membership in the frozen member-template set (the Leader
  template is in the blueprint, but not in `blueprint.members`).
