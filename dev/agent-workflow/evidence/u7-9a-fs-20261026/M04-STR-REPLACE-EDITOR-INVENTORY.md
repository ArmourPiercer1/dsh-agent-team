# U7-9a fix-round R1 — M-04 `str_replace_editor`: scope inventory (finding 2, MAJOR)

Verdict of this file: the delivery claim `OUT_OF_SCOPE / NONE_SHIPPED` is
**WITHDRAWN** (reviewer finding 2 stands). The matrix stays **unchanged**
(no re-colouring by this worker — matrix is user/主Agent product). M-04
remains an **OPEN, UNRESOLVED obligation** and this file records exactly
what is and is not proven, with receipts.

## 1. The matrix says (verbatim, TOOL-CAPABILITY-MATRIX-9b2.md)

* `:24` (M-04 row): 「plane 无注册（Host 本体注册状态未亲读，**不等于 Host 未注册**）」;
  verdict 「NOT_IMPLEMENTED（治理面臂无实现；Host 层未亲读）」.
* `:62` (appendix): 「str_replace_editor [独立包；装载条件待核（**default 未证**，
  web preset 未见声明）] — 逐名适用：主表 str_replace_editor(M-04) 行事实；无另证。」

The delivery README:101-103 and PR-BODY:6-8 asserted the second half
(NONE_SHIPPED → OUT_OF_SCOPE) as closed fact. That went beyond the matrix
and against its explicit caution. Withdrawn.

## 2. Receipts collected at THIS round (facts, no verdict beyond them)

### R-A — Host-本体 registration status is now DIRECTLY READ (the matrix's open question)

Pinned host runtime `tests/deepseek-harness-test-use` (pristine, detached @
`639ed015397290b3745d163aafe02ffee4aa3f84` = 0.2.0-rc.2, the ONLY baseline
this evidence may speak for):

* `packages/fs/tool-str-replace-editor/lib/index.js:267` — `name: "str_replace_editor"`
  and `:329` — `const inject = ["tools", "fs"]`: a SHIPPED host tool package
  registering the name through the host tools seam. **Host 本体注册状态（pinned
  baseline）: REGISTERED.**
* `packages/deliverables/workspace-changes/lib/index.js:535` — the host's own
  change classifier treats `str_replace_editor` commands
  (`create`/`str_replace`/`insert`) as mutating writes — the host itself
  counts this tool as a file-mutation face.
* Corroboration from THIS repo's drift law (not new authority, an
  independent cross-check): `team-tool-plane.mjs` `PLANE_RESERVED_NATIVE`
  carries `'str_replace_editor'` in the pinned registry derivation
  (`PLANE_RESERVED_NATIVE_HOST_PIN = '0.2.0-rc.2@639ed01539'`); the C-16
  bidirectional drift test requires EVERY pinned name to carry a real
  registration source at the pin — the pin being green is consistent with
  R-A.

### R-B — Load/shipment of the SURFACE in the booted worlds (runtime registration)

The u7-fsmut boots harvest the ACTUAL tool surface the pinned host serves
the anchored session (discovery request `tools` arrays; runtime, not static):

* boot `u7fsmut1`: surface = ["bash", "edit", "read", "read_image", "team_archive_member", "team_collect", "team_create_member", "team_delegate", "team_follow_up", "team_grant_permission", "team_inspect_config", "team_list_members", "team_list_pending_control", "team_list_templates", "team_report_progress", "team_request_control", "team_resolve_control", "team_revoke_permission", "team_send_message", "u5_canary", "write"] — contains `str_replace_editor`: **NO**
* boot `u7fsmut2`: surface = ["bash", "edit", "read", "read_image", "team_archive_member", "team_collect", "team_create_member", "team_delegate", "team_follow_up", "team_grant_permission", "team_inspect_config", "team_list_members", "team_list_pending_control", "team_list_templates", "team_report_progress", "team_request_control", "team_resolve_control", "team_revoke_permission", "team_send_message", "u5_canary", "write"] — contains `str_replace_editor`: **NO**
* boot `u7fsmut3`: surface = ["bash", "edit", "read", "read_image", "team_archive_member", "team_collect", "team_create_member", "team_delegate", "team_follow_up", "team_grant_permission", "team_inspect_config", "team_list_members", "team_list_pending_control", "team_list_templates", "team_report_progress", "team_request_control", "team_resolve_control", "team_revoke_permission", "team_send_message", "u5_canary", "write"] — contains `str_replace_editor`: **NO**
* boot `u7fsmut4`: surface = ["bash", "edit", "read", "read_image", "team_archive_member", "team_collect", "team_create_member", "team_delegate", "team_follow_up", "team_grant_permission", "team_inspect_config", "team_list_members", "team_list_pending_control", "team_list_templates", "team_report_progress", "team_request_control", "team_resolve_control", "team_revoke_permission", "team_send_message", "u5_canary", "write"] — contains `str_replace_editor`: **NO**
* boot `x`: surface = ["bash", "edit", "read", "read_image", "team_archive_member", "team_collect", "team_create_member", "team_delegate", "team_follow_up", "team_grant_permission", "team_inspect_config", "team_list_members", "team_list_pending_control", "team_list_templates", "team_report_progress", "team_request_control", "team_resolve_control", "team_revoke_permission", "team_send_message", "u5_canary", "write"] — contains `str_replace_editor`: **NO**

* boot `x-2026T12-48` (boot 6, fixed kit): surface contains `str_replace_editor`: **NO**

So: the package is REGISTERED in the pinned host build (R-A), yet the name
is NOT SURFACED in the booted worlds' preset composition. These are
different questions and the matrix appendix kept them open for exactly
this reason (「装载条件待核… default 未证」). Other user presets/profiles
were NOT examined and stay undecided.

### R-C — plane face

No takeover row for the name (`PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED`
semantics unchanged; the plane refuses to claim names it does not govern).

## 3. Honest disposition (what this delivery now claims)

1. `OUT_OF_SCOPE / NONE_SHIPPED` for M-04: **withdrawn** (README/PR-BODY
   corrected this round).
2. What IS proven: at the pinned baseline the host package **registers**
   `str_replace_editor` natively (R-A); in the booted u7-fsmut worlds the
   surface **does not carry it** (R-B); the governance plane has **no
   takeover row** (R-C) — the governed面 for M-04 is NOT_IMPLEMENTED,
   matching the matrix's governing-arm half.
3. What stays OPEN (not this worker's call): whether M-04 becomes a
   REQUIRED governed row replacing/suppressing the native face, or a
   suppressed native name, i.e. the matrix's 「装载条件待核」 + 「Host 层」
   verdict completion. That is a user/matrix-owner ruling; this round
   records the receipts and does not touch the matrix.
4. U7-9a's delivery scope (write/edit/read_image governed rows + CA-01)
   neither depends on M-04 nor closes it.
