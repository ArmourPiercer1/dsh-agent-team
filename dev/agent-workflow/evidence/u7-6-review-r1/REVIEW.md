# U7-6 GLUE-4 adversarial review R1

Branch: `task/u7-6-review-20261026`
Subject: PR #391 / `task/u7-6-glue4-search-assurance-20261026`

## Verdict: BLOCKED

The implementation is directionally coherent and the focused unit tests plus disk-backed C2 receipt support the ordinary positive, blinded policy refusals, read→list projection, `/etc` backend-anchor refusal, zero center search literals, and booked protected-center override. However, the mandatory adversarial mutation requirement is not satisfied, and a direct mutation probe demonstrates a security-relevant untested acceptance: an unknown/unregistered invoke class can ride a valid governing read rule and be covered. The current tests only validate malformed `invokeClasses` input; they do not establish that an unknown class is rejected or that the resulting class arm is bound to a reviewed mounted row. This leaves the claimed fail-closed law unproven and allows a stub/typo class to become admitted if supplied by the trusted mount.

## Findings

### F1 — major — unknown invoke classes are accepted and no negative test catches it

- **File:line:** `packages/runtime/tool-admission/admission-kernel.ts:844-870` (especially `845-854`); regression coverage `packages/runtime/test/a5p2-admission-kernel.test.ts:964-970`.
- **What is wrong:** `invokeClasses` validates only token shape and that governors are grammar tools. It does not validate the effect-class key against a reviewed/registered class set or mounted row inventory. Consequently `{ evil: ['read'] }` is accepted, and a read allow projects `tool-invoke(evil)` with the same ceiling. The implementation's own comment says unknown classes must fail closed, but the code has no such check. The tests cover `read` (nameable key), `grep` governed by `grep` (invalid governor), empty list, casing, and non-record shape; they never test an unknown-but-well-formed class key.
- **Evidence:** direct mutation/probe command:
  ```
  node --input-type=module <<'NODE'
  import { deriveTeamPolicyAuthority } from './packages/runtime/dist/packages/runtime/tool-admission/admission-kernel.js'
  const r = deriveTeamPolicyAuthority({permissionPolicy:{default:'deny',allow:[{tool:'read',resource:{kind:'exact',path:'/data/root'}}],ask:[],deny:[]},realmId:'r',templateId:'t',definitionOwnerAuthority:'human-user',role:'member',sourceVersion:()=>1,invokeClasses:{evil:['read']}})
  console.log(JSON.stringify({ok:r.ok,error:r.ok?null:r.error,evilCovered:r.ok?r.value.coversEffect({kind:'tool-invoke',toolName:'evil',resource:null}):null},null,2))
  NODE
  ```
  Verbatim output tail: `{"ok":true,"error":null,"evilCovered":true}`.
- **Evidence needed:** A reviewed closed-world class registry/row inventory must be passed or otherwise enforced at the trusted assembly boundary, with a negative test for a well-formed unknown class (and a typo/removed-row mutation) that returns typed construction refusal or leaves the class uncovered. The test must be red against the current implementation and green after the fix. If the intended contract is that any trusted mount may introduce arbitrary classes, the PR must explicitly document and prove why that is safe; that would not match the requested “fail-closed on unknown classes” law.
- **Classification:** defect (not merely disclosure). The accepted behavior is an authority projection bug; disclosure alone cannot prove the required law.

### F2 — major — required mutation probes are absent

- **File:line:** PR evidence directory `dev/agent-workflow/evidence/u7-6-glue4-20261026/`; tests `packages/runtime/test/a5p2-admission-kernel.test.ts:899-972`.
- **What is wrong:** The task explicitly requires mutation-probing the new ride code, including removing deny-source mirroring and allowing an unknown class, then confirming tests catch the mutation. The committed evidence contains no mutation run, mutant diff, RED result, or mutation manifest. Search of the PR evidence for `mutation`, `MUTATION`, `remove.*deny`, or `unknown class` finds no such receipt. Existing tests assert the intended deny mirror but have not been shown to fail when the implementation is mutated; more importantly, they do not exercise the unknown-class mutation at all.
- **Evidence needed:** committed, reproducible mutation receipts showing at minimum: (a) deny-source mirror removed → targeted test RED; (b) unknown-class validation removed/relaxed or unknown class injected → targeted test RED; preferably (c) a class ride ceiling changed to allow → targeted test RED. Each receipt must identify the mutated source, command, exit status, and verbatim failing tail, with the worktree restored.
- **Classification:** disclosure gap for the missing probe, compounded by F1's actual defect.

### F3 — minor — PR narrative calls the closure an assurance-face fix while the evidence correctly says the assurance face is vacuous

- **File:line:** PR title/body and `dev/agent-workflow/evidence/u7-6-glue4-20261026/glue4-post-fix-receipt.md:1-8`.
- **What is wrong:** The implementation is a coverage-gate/projection closure, not an assurance-runtime adapter. The receipt correctly says `assurance-runtime.ts:139-142` is not reached and no assurance probe is mounted, but the PR title/body repeatedly says “admissible at the assurance face.” This is materially confusing for gate accounting and risks counting the wrong claim as proven.
- **Evidence needed:** Correct the PR/review-facing claim to “template-policy coverage/admission projection face,” retain the explicit vacuous-assurance disclosure, and ensure the gate ledger does not count this as assurance-runtime capability evidence.
- **Classification:** disclosure gap.

## What I VERIFIED

1. **Focused unit tests**
   Command:
   `pnpm exec vitest run packages/runtime/test/a5p2-admission-kernel.test.ts packages/tools/a5p5-tools/test/a5p5-effects-schema.test.ts`

   Verbatim tail:
   ```
    ✓ packages/tools/a5p5-tools/test/a5p5-effects-schema.test.ts (17 tests) 30ms
    ✓ packages/runtime/test/a5p2-admission-kernel.test.ts (52 tests) 39ms

    Test Files  2 passed (2)
       Tests  69 passed (69)
   ```

2. **Root-cause and post-fix offline reproduction**
   Command:
   `node dev/agent-workflow/evidence/u7-6-glue4-20261026/glue4-offline-repro.mjs | tail -n 24`

   Verbatim tail:
   ```
   P1 empty-template +class +anchored grep: denied code=IO_POLICY_UNSUPPORTED ...
   P2 read-exact-root +class +anchored grep: admitted
   P3 read-exact-root +class +anchored glob: admitted
   P4 read-exact-root +class +anchored grep /etc: admitted
   P5 read-exact-elsewhere +class +anchored grep: denied code=IO_POLICY_UNSUPPORTED ...
   P6 read-any +class +anchored grep: denied code=IO_POLICY_UNSUPPORTED ...
   ```
   This reproduces the refusal at the template-default-deny coverage gate and confirms the post-fix blinded negatives, but it is not a mutation probe.

3. **Protected-center override and scope**
   `git diff origin/master...HEAD -- dev/agent-workflow/ledgers/arc-a-protected-center.json` shows a booked PR #391 override for `packages/runtime/tool-admission/admission-kernel.ts` with SHA `f4903948...`; no search-name literal was found in the protected center grep. The named center-interface declaration is therefore correctly booked in the ledger.

4. **C2 disk receipt is present**
   `dev/agent-workflow/evidence/u7-6-glue4-20261026/c2/` contains a sanitized host log, RUN record, budget ledger, and receipt. The receipt records `RUN-SUMMARY overall=PASS cases=10 PASS:10`, `admissionRefused:false` for the `/etc` leg, backend refusal `target-outside-governed-root`, and zero census change. I count these as disk evidence, not transcript-only claims.

5. **Read→list and no bash ride are covered by focused tests**
   The test file includes explicit read root coverage for list/read/invoke, no-class refusal, bash non-ride, deny-source mirror assertions, and malformed class-input checks. These are useful but do not close F1/F2.

6. **Lint attempt**
   Command:
   `pnpm exec eslint packages/runtime/tool-admission/admission-kernel.ts packages/runtime/src/plugin/live/team-tool-plane.mjs packages/tools/a5p5-tools/src/effects-schema.ts packages/tools/a5p5-tools/src/pipeline.ts packages/tools/a5p5-tools/src/register.ts`

   Verbatim tail:
   ```
   undefined
   [ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL] Command "eslint" not found
   [exit code: 1]
   ```
   Lint was not verified; this is an environment/tooling limitation, not a product finding by itself.

## Could NOT verify

- No Host was booted by this review, per instruction.
- I could not verify the claimed lint gate because `eslint` is unavailable in the fresh worktree's installed tool resolution.
- I could not verify the claimed install leg; PR body explicitly marks it skipped locally.
- I could not verify a mutation-probe RED receipt because none is committed, and I did not modify product files in this review.
- I did not count any `FAIL`, `SKIP`, `ENV_BLOCK`, or `UNDECIDED` item as delivery.

## End-state discipline

The review branch contains only this review evidence addition; no product/test source was modified. The review worktree's `packages/` and `tests/` status is clean.
