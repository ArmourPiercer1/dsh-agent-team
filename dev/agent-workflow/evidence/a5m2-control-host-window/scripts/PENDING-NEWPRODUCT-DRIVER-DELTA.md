# PENDING new-product driver delta (B control window) — staged, NOT applied

Root's FINAL B-authorization ruling (verbatim force): 83/84 are **not** PA
exemptions; the old PR-D/native behaviour cannot prove the new CONTROL arm;
83/84 (and 87/88) still LACK the closed-set registration in blueprint/runtime.
The registration is the MAIN's unique shared-writer job (85 invocation-only
pattern, four names + SRE; no new matcher/ledger, native roles / envelopes /
ceiling / default-deny untouched). **B does not write the schema**, and B no
longer calls "default deny + empty rules" an arrangement (claim retracted in
the runner header at this commit).

The current runner rules are the honest OLD-product interim (vocabulary cannot
name 83/84). When the main's NEW product SHA receipt lands, apply exactly the
delta below — nothing else.

## Registration SHA verified (2026-10-24, read-only)

Int tip `0c15d1448c1a90f8df550d2eb263c7e06adc8370` (origin/feat/a5-m2-integration,
ls-remote verified) carries the closed-vocabulary registration this delta waits
on: blueprint `schema.ts` rule vocabulary now lists `team_request_control` /
`team_resolve_control` / `team_grant_permission` / `team_revoke_permission`
(:493-496) behind `team_list_pending_control`, on the 85 invocation-only
pattern (tool-invoke arm, resource `any`, exact realm|tool:name matcher; the
"stays OUT" list at :579 is the EFFECT-arm set — no exact/subtree for these
four, matching the a1 suite's refusal legs; envelope + native resolver
identity UNTOUCHED — naming pre-wires the named channel only). The main's a1
87/87 covers my two future rule shapes (26 names x three lanes x both roles
whole-tool `any` under default:deny parse; exact/subtree refused per name).
This is the SOURCE-side registration — §0's PIN swap still waits for the
actual NEW PRODUCT receipt (composed/pack/lock/tgz/INSTALL_DIR), never for
this SHA alone.

## 0. Pin swap (same change, from the main's receipt — never from memory)

`05-control-window-runner.mjs` constants:
`COMPOSED_SHA` / `EXPECTED_PACK_SHA` / `EXPECTED_LOCK_SHA` /
`EXPECTED_TGZ_NAME` / `EXPECTED_TGZ_DIR_PREFIX` / default `INSTALL_DIR`.
Any pin unconfirmed by the receipt ⇒ do not apply (fail-closed, root law).

## 1. MEMBER (ctl-worker) — arm 83 for the requesting role

Old (OLD-PRODUCT INTERIM block, `permissions:` of `ctl-worker`):

```
  '        default: deny', '        allow: [], // vocabulary (the real parse proved no rule can
```

New (kind:any SINGLE-TOOL rule — projects the exact realm|tool:name in the
SRE, NOT alltools; everything else stays deny):

```
  '        default: deny', '        allow:',
  '          - tool: team_request_control', '            resource:', '              kind: any',
```

Member gets ONLY 83 (no resolver rule; the L4 identity-refusal leg keeps
proving a member never resolves).

## 2. LEADER — arm 84 next to the existing 85

Old (`permissions.allow` tail):

```
  '          - tool: team_list_pending_control', '            resource:', '              kind: any', // 83/84 are NOT exempt — they await the MAIN's closed-vocabulary registration; the
  '      ask: []', '      deny: []', // prepared per-role delta (exact kind:any single-tool rules) is staged in
  '', // PENDING-NEWPRODUCT-DRIVER-DELTA.md (apply ONLY with the new product SHA pins).
```

New (85 rule already exact single-tool kind:any — keep; add 84 the same
shape; drop the now-false "never gates" comment):

```
  '          - tool: team_list_pending_control', '            resource:', '              kind: any',
  '          - tool: team_resolve_control', '            resource:', '              kind: any',
  '      ask: []', '      deny: []',
```

Leader does NOT get 83 (does not request). 87/88 are not in this scenario's
roles — no rules authored here for them.

## 3. Post-swap verification (no test system built, no native rollback)

1. `node --check` on the runner.
2. One-off REAL `parseBlueprint` over the runner's own YAML with the NEW
   product's validator (scratch run, removed after — the b0d2 precedent),
   expecting the three rules to validate against the NEW closed vocabulary
   (the registration must make them nameable; if the new product still
   refuses a name, that is the precise breakpoint to report — do not route
   around it, do not re-claim "arranged").
3. NOT_RUN rc3 + `A5M2_CONTROL_DRY=1` to-boot-boundary (rc3 NOT_RUN verdict).
   Boot only on the root's window GO.

## Hard stays

No schema/vocabulary writes by B; no new matcher/ledger; no native-role/
envelope/ceiling/default-deny edits; no product-package touches; scenario
unchanged (83→85→84 + identity refusal; consumption/EDIT stays UNTESTED).
