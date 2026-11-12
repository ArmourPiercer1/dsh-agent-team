AUDIT-A-ALPHA5

# Audit A — the Alpha.5 **Preview** tool surface vs. real-Host acceptance

| field | value |
| --- | --- |
| audit | A of four (read-only) |
| integration baseline | `origin/master` @ `9e1c493b67659704df02da5ce3541fb0c81d2425` |
| audit tree | `.worktrees/audit-a`, branch `task/audit-a-alpha5-20261111`, cut from `origin/master` |
| product diff vs. master | **none** (`git diff --name-status origin/master...HEAD -- packages cordis.patch.yml scripts package.json` is empty) |
| product changes | **none** (this report is the only file) |
| Host boots | **0** (forbidden by the task; every evidence path below was produced by a lane that did boot) |
| Host-free suites run | 3 (see Appendix); all green |
| frozen authority docs read | `PREVIEW-CONTRACT-2026-11-16.md` (269 lines), `PREVIEW-READINESS-2026-11-15.md` (572), `TOOL-ACCEPTANCE-MATRIX.md` (1257), `RELEASE-NOTES-0.1.6.md` (372), plus `PRODUCT-DEBT-REGISTER.md`, `ALPHA5-SANDBOX-BACKLOG.md`, `ALPHA5-END-STATE.md` |
| current authority pointer | `dev/engineering/current-authority.json` → snapshot `as20261109r1`, baseline `cb2e41483`, digest `sha256:d85fdc1a…` (`node scripts/current-authority.mjs`, appendix) |

**Auditor's summary.** The Preview's ten governed I/O names are real: they are served through confined
faces on the shipped opt-in preset, and the web face decides allow/deny before any transport. The
frozen documents are, however, a palimpsest with several live contradictions: the newest correction
says ordinary install works, an older "explicit is-not" section still says it does not; the release
notes say `bash` is refused at admission, while the code only admits the *spawn root* and the contract
itself discloses that command bodies are not parsed; and every Preview run measures only the
`MemberCeiling` factor of the advertised two-factor invariant — `ToolRestriction` is `null` on every
guard fact because the derived Preview path cannot carry member-scoped tool bindings. I found **no
product P0**; the P0 below is a user-facing documentation overclaim that would make a Preview GO
statement false.

---

## 0. Verdict summary

| # | Question | Verdict | One line |
| --- | --- | --- | --- |
| 1 | Surface inventory against the contract | **PARTIAL** | 34 product names measured = 10 I/O + 5 same-family + `read_image` + 3 Goal + 15 `team_*`; 2 instruments excluded; 7 deferred names absent. The contract names only 4 of the 34 individually (`web_search`, `read_image`, `web_fetch`, `create_goal`), and only the internal readiness report enumerates the deferred set. |
| 2 | `Ceiling ∧ ToolRestriction` enforcement | **PARTIAL / NOT_MEASURED** | The compiler implements the intersection (`compile.ts:176`), but the shipped Preview path derives **ceilings only**; every Preview guard fact carries `toolBindingIdentity: null`. C2-A's binding-lane evidence comes from a fixture realm row, not the shipped preset. |
| 3 | Web governance before transport | **PASS** | Guard runs entirely before `provider.fetch`/`provider.search`; no-provider search is typed `WEB_PROVIDER_UNAVAILABLE` inside the same guard (one fact, zero requests). Two independent DEV-LIVE arms confirm. |
| 4 | `read_image` evidence | **DISCLOSED-GAP** | The last C2 (cand-v0.1.6-2) still records `NOT_REACHED`; PD-31's DEV-LIVE pair now measures both allow and deny on a declared-`image` route. The C2 gap is an instrument/route-configuration gap, not a product gap. Contract §2.2 still says only the refusal branch was measured. |
| 5 | Goal lifecycle | **PASS** | Durable facts live in the upstream `goals` service; our code calls `goals.pause`/`goals.disarm`, the round driver is an upstream BASE row, and nothing on the Preview path re-implements the state machine. One separate mirror exists in `agent-state-family` (not mounted by this preset). |
| 6 | Coverage gate / unknown-tool bypass | **PARTIAL** | In strict mode unknown → `UNKNOWN_UNMANAGED` → fatal setup throw; but the governed Member declares no `capabilities.permissions`, so the gate is **absent**, not merely lenient. There is no failing mutation control for the unknown-name branch, and F-2 shows strict mode and the Goal trio are mutually exclusive on one Member. |
| 7 | Preview vs. full Alpha.5 boundary | **PARTIAL** | The boundary is stated, but three of the four named documents disagree with each other or with later evidence (bash admission, install status, `read_image` scope), and the deferred seven are not disclosed in any user-facing document. |

Evidence-ladder used below: **V@B** = verified at the current baseline; **C2** = independent
`CANDIDATE-C2` record; **DEV-LIVE** = real Host, `candidateClaimEligibility=false`. The latest C2 is
`cand-v0.1.6-2` @ `bb3c158eb` (2026-11-11); the current master is later (`9e1c493b6`). **No product tool
on the Preview surface has `V@B`**: the matrix's ⑨ column is `no` for every row and §1.7.2 says
"全部 7 条都仍是 no `V@B`" (`TOOL-ACCEPTANCE-MATRIX.md:712-726`).

---

## 1. Surface inventory, verified against the contract

### 1.1 The measured surface is 36 names = 34 product + 2 instruments

The newest live surface artefact is
`dev/agent-workflow/evidence/a5sf-pd31-read-image/runs/boot01/member-surface.json` (36 names; the
`boot02` pair and `a5sf-pd33-preview-e2e/runs/boot02` agree). Parsed:

```
bash create_goal edit exit_plan_mode get_goal glob grep job_kill job_list job_output present
read read_image skill team_archive_member team_collect team_create_member team_delegate
team_follow_up team_grant_permission team_inspect_config team_list_members
team_list_pending_control team_list_templates team_report_progress team_request_control
team_resolve_control team_revoke_permission team_send_message todo_write u5_canary u6fs_probe
update_goal web_fetch web_search write
```

`u5_canary` is registered by `tests/world-factory/lib/world-factory.mjs:66`
(`CANARY_TOOL_NAME`), `u6fs_probe` by `tests/world-factory/lib/u6-fs-assembly.mjs:31`
(`PROBE_TOOL_NAME`); neither string occurs in `cordis.patch.yml`. The ledger builder excludes them
explicitly (`tests/world-factory/drivers/a5sf-pd24-surface-ledger/build-ledger.mjs:37`, `FIXTURES`),
and the contract freezes the dual count (`PREVIEW-CONTRACT-2026-11-16.md:206-216`, "34 产品 / 36 含仪器").
**Confirmed: they are instruments, not product tools, and the 34-name product count is correct.**

### 1.2 Per-surface table

`claim` = whether the frozen contract names it. `code` = the product site that supplies it.
`evidence` = the strongest record I could resolve. `level` = V@B / C2 / DEV-LIVE / none.

| Surface row | In the contract? | Implemented at | Evidence | Level | Verdict |
| --- | --- | --- | --- | --- | --- |
| `read` | **No** — count only (§5.1 `:208`); named in release notes §2.1 `:51` | preset `tool-fs` row `cordis.patch.yml:320`; confined fs face `packages/runtime/team-services/src/fs.ts`; native shadow `confined-fs-tool.mjs` | C2-A A1 (`c2-adjudication-2/README.md`, C2-A PASS); PD-33 Member A; preflight row1/2/3 | C2 (cand-2) + DEV-LIVE; **V@B=no** | **PARTIAL** — governed allow and deny, but only the ceiling factor is live on the shipped preset (see §2) |
| `write` | **No** — count only (§5.1 `:208`) | same fs face; `confined-fs-tool.mjs` | C2-A A3/A4 **partial** (read-before-write is a host contract, not a lane denial); PD-17 DEV-LIVE | C2 + DEV-LIVE; V@B=no | **PARTIAL** |
| `edit` | **No** — count only (§5.1 `:208`) | same fs face | C2-A A5/A6 partial; PD-17 D4/A3; PD-33 counts `edit=1` fact | C2 + DEV-LIVE; V@B=no | **PARTIAL** — no lane-level write denial was demonstrated (host version guard is L2) |
| `grep` | **No** — count only (§5.1 `:208`) | `tool-fs-search` row `:322`; confined subprocess/search face `confined-search-tool.mjs:91` | C2-A A7/A8; PD-16 DEV-LIVE; matrix §1.3.1 | C2 + DEV-LIVE; V@B=no | **PARTIAL** |
| `glob` | **No** — count only (§5.1 `:208`) | same search face | C2-A A9/A10; PD-16 DEV-LIVE | C2 + DEV-LIVE; V@B=no | **PARTIAL** |
| `bash` | **No** — count only (§5.1 `:208`) | `tool-bash` row `:317`; confined terminal face `confined-terminal-tool.mjs` | C2-A A13 (`bash` 64 facts); PD-19; readiness §5.2 | C2 + DEV-LIVE; V@B=no | **PARTIAL** — admission is the **spawn root only**; command-body paths are not parsed (`confined-terminal-tool.mjs:118-125`), disclosed in readiness §6.2.3 |
| `skill` | **No** — count only (§5.1 `:208`) | `tool-skill` row `:333`; confined skill provider `a5sf-skill-provider.mjs`; PD-26 route-C shadow | PD-26 DEV-LIVE allow/deny + PD-33 (`skill=2` facts) | DEV-LIVE; V@B=no | **PARTIAL** |
| `present` | **No** — count only (§5.1 `:208`) | `tool-present` row `:335`; PD-26 confined fs listener | PD-26 DEV-LIVE allow/deny + PD-33 (`present=2` facts) | DEV-LIVE; V@B=no | **PARTIAL** |
| `web_fetch` | Named incidentally (§2.3/§2.3.1 tables), not as a surface row | `tool-web` row `:350` (`dsh-agent-team/web-tool`) + transport row; `a5sf-web-transport.mjs`; `web.ts` | C2-A A11; PD-27/PD-30 DEV-LIVE allow/deny/SSRF/malformed | C2 + DEV-LIVE; V@B=no | **PARTIAL** |
| `web_search` | Yes | same web face; Exa provider optional | C2-A A12; PD-30 allow arm (real POST + parse) and nosearch arm typed `WEB_PROVIDER_UNAVAILABLE` | C2 + DEV-LIVE; V@B=no | **PARTIAL** — deployment-conditional, correctly disclosed in contract §2.1 |
| `read_image` | Yes, §2.2 | native `tool-fs` (`tool-fs` row `:320`), route-modality gate in the pinned host | PD-31 DEV-LIVE 7/7 cases, both arms, two boots; C2-2 still `NOT_REACHED` | DEV-LIVE; **no C2**; V@B=no | **DISCLOSED-GAP** (see §4) |
| `job_list` | **No name**; count only, §5.1 `:209` ("5 同族") | `tool-jobs` row `:326` | PD-24 ledger, foreign-job refusal; PD-33 surface but not invoked | DEV-LIVE; no C2; V@B=no | **PARTIAL** — contract never names the five |
| `job_output` | No name (count only) | `tool-jobs` | PD-24 ledger | DEV-LIVE | **PARTIAL** |
| `job_kill` | No name (count only) | `tool-jobs` | PD-24 ledger | DEV-LIVE | **PARTIAL** |
| `todo_write` | No name (count only) | `tool-todo` row `:401` | PD-24 ledger (session-local) | DEV-LIVE | **PARTIAL** |
| `exit_plan_mode` | No name (count only) | plan-mode group `cordis.patch.yml:363-394` | PD-24 ledger: only the **inactive** branch measured; active branch has no seam | DEV-LIVE (inactive branch only) | **NOT_MEASURED** for the active branch; row otherwise PARTIAL |
| `create_goal` | Family count §5.1; named itself in §2.3.1 table | upstream `@deepseek-ai/dsh-tool-goal`, `cordis.patch.yml:361` | C2-A A13 (A5-governed: `rounds=3 finalPhase=complete`); C2-B §8: A6-on ∧ governed Goal **NOT ESTABLISHED**; PD-37 installed goal 5/4 rounds | C2 (A5 leg) + DEV-LIVE; V@B=no | **PARTIAL** — newest DEV-LIVE is post-C2 |
| `get_goal` | **No name** — family count only | same | C2-A A13; PD-33 / PD-29 | C2 + DEV-LIVE | **PARTIAL** |
| `update_goal` | **No name** — family count only | same | C2-A A13 (`complete` accepted); PD-29 pause CAS | C2 + DEV-LIVE | **PARTIAL** |
| `team_list_members` … `team_revoke_permission` (15 names) | Only as `team_*` family in contract §5.2; enumerated in readiness §2 | `packages/tools/src/tools.ts` (tool defs) + `team-tool-plane.mjs` | C2-B (subset: create/delegate/collect/message/control); PD-33 used delegate/collect/list/archive | C2-B §3: allow/deny/consumption/Stop arms PASS, **Sticky Stop NOT PASS**, A6-on ∧ governed Goal NOT ESTABLISHED; DEV-LIVE for the used subset | **PARTIAL** — not an I/O-governed plane, correctly labelled "另一套授权" |
| `workflow` | Deferred; only readiness §2/§6.2 names it | **removed** from governed preset (PD-18 fail-closed), `cordis.patch.yml:200-211` | PD-33: 7/7 deferred names typed `unknown tool`, 0 facts | DEV-LIVE (absence) | **DISCLOSED-GAP** — absent and verified, but the contract and release notes never say so |
| `subagent` | Deferred; readiness only | removed by PD-21 (`cordis.patch.yml:216-232`) | PD-33 7/7; PD-21 measured the child-realm hole before removal | DEV-LIVE (absence) | **DISCLOSED-GAP** |
| `subagent_fork` | Deferred; readiness only | removed by PD-21 | same | DEV-LIVE (absence) | **DISCLOSED-GAP** |
| `send_message` | Deferred; readiness only | removed by PD-21 (`tool-subagent-control`) | same | DEV-LIVE (absence) | **DISCLOSED-GAP** |
| `interrupt_agent` | Deferred; readiness only | removed by PD-21 | same | DEV-LIVE (absence) | **DISCLOSED-GAP** |
| `list_agents` | Deferred; readiness only | removed by PD-21 | same | DEV-LIVE (absence) | **DISCLOSED-GAP** |
| `ask_user_question` | Deferred; readiness only | removed by PD-25 (`tool-ask-user`); before removal PD-24 measured the **blocking** branch | PD-24 ASK arm: no result, turn stays open; PD-33 7/7 absence | DEV-LIVE (absence + pre-removal hazard) | **DISCLOSED-GAP** — the blocking hazard is in the debt register, not the user docs |
| `u5_canary`, `u6fs_probe` | **No** (instruments) | WorldFactory harness only | contract §5.1, ledger `FIXTURES` | n/a | **PASS** (correctly excluded) |

**Count check.** 10 I/O + 5 same-family + `read_image` + 3 Goal + 15 `team_*` = **34**. With the two
instruments the measured surface is **36**. Deferred 7 = **0** on the surface. This matches
`PREVIEW-CONTRACT-2026-11-16.md:206-216` and `PREVIEW-READINESS-2026-11-15.md:71-100`.

**Contract-completeness finding.** The contract names only **four** product tools individually —
`web_search` (§2.1), `read_image` (§2.2), `create_goal` (§2.3.1), and `web_fetch` incidentally in the
install tables — while the other **30** names (`read`, `write`, `edit`, `grep`, `glob`, `bash`, `skill`,
`present`, the 5 same-family tools, `get_goal`, `update_goal`, and the 15 `team_*`) appear only as
counts or as the `team_*` family. A reader of the contract alone cannot reconstruct the 34-name roster.
That is an under-specification, not an overclaim; the release notes §2.1 names the 8 governed I/O tools
and is the better list.

---

## 2. `Ceiling ∧ ToolRestriction`: where it is enforced and what is actually measured

### 2.1 The code does implement the intersection

- `packages/runtime/member-io-policy/src/compile.ts:176-224` — `compileEffectiveIo` checks invocation
  identity/revision/binding, refuses `network:'unsupported'`, then:
  - `read = intersectLane(member.read, tool.read)` (`:162-166`),
  - `write = intersectLane(member.write, tool.write)`,
  - `network = member.allow && tool.allow ? allow : deny`.
- `projectToolIoRestriction` (`compile.ts:237-290`) correctly keeps an `all` lane that carries a
  non-empty `deny` instead of collapsing it to the identity (the B1 fix).
- The realm consumes that compiled object for the fs, search, terminal and web faces
  (`install.ts:201-240` admits the compiled policy; `terminal.ts:526`, `subprocess.ts:1476`
  and `web.ts:18-24` consume the effective lane).

### 2.2 The shipped Preview path cannot supply the right-hand factor

The v4 **derived** product path derives ceilings from `memberIoCeilings` but explicitly does **not**
derive `toolBindings`:

- `packages/runtime/team-services/src/product-assembly.ts:774-782`: "v4 `toolBindings` are Team-scoped
  and carry no MemberTemplate association, so the derived declaration derives CEILINGS only".
- `product-assembly.ts:1076`: when a blueprint carries `toolBindings`, the assembly records the
  residual `'blueprint-tool-bindings-not-member-scoped'` — i.e. it does not attach them to a Member.
- Per-tool restrictions are read from only one place, the **explicit exception** path
  `a5sfMemberPolicies` → `member.toolRestrictions` (`product-assembly.ts:977-1007`).
- The shipped governed preset does not set `a5sfMemberPolicies` — the key does not occur in
  `cordis.patch.yml` at all; it is a row-config declaration read at
  `packages/runtime/src/plugin/types.ts:322` and `a5sf-realm-row.mjs:335-360`. The Preview
  precondition is v4 + `memberIoCeilings`
  only (`PREVIEW-CONTRACT-2026-11-16.md:22`).

**Measured consequence.** In the Preview E2E run, every guard fact has no binding identity:

```
dev/agent-workflow/evidence/a5sf-pd33-preview-e2e/runs/boot02/guard-facts.json
('bash', None) x8  ('read', None) x3  ('web_fetch', None) x2  ('skill', None) x2
('present', None) x2  ('grep', None)  ('glob', None)  ('write', None)  ('edit', None)  ('web_search', None)
```

So on the shipped Preview, `EffectiveIo = MemberCeiling` and the `ToolRestriction` factor is the
identity. The invariant in `TOOL-ACCEPTANCE-MATRIX.md:15` is true of the compiler, but **not
exercised by the Preview's real I/O**.

### 2.3 Which matrix cells have measured allow *and* deny evidence

| Matrix cell | Allow measured | Deny measured | Which factor | Evidence | Level |
| --- | --- | --- | --- | --- | --- |
| M-01 `read` | yes | yes (restriction deny and ceiling deny in the preflight lane) | both (fixture realm provider) | `a5sf-preflight/README.md` §13; C2-A FS row1/2/3 | C2 + DEV-LIVE (old), V@B=no |
| M-02 `write` | yes | partial (ceiling only; native read-before-write is L2) | ceiling | C2-A A3/A4; PD-17 D3/A2/A4 | C2 partial |
| M-03 `edit` | yes | **no lane deny** (host version guard only) | ceiling | C2-A A5/A6 partial; PD-17 D4/A3 | C2 partial |
| M-04 `read_image` | yes (PD-31, declared `image` route) | yes (out-of-lane existing and missing, identical sentence) | ceiling + host route gate | `a5sf-pd31-read-image/runs/boot01/summary.txt` PASS 7/7; C2 `NOT_REACHED` | DEV-LIVE only |
| M-06 `grep` | yes | yes (restriction narrower than ceiling) | both (fixture) | C2-A A7/A8; PD-16 | C2 + DEV-LIVE |
| M-07 `glob` | yes | yes | both (fixture) | C2-A A9/A10 | C2 + DEV-LIVE |
| M-08/M-09 `bash` | yes | read deny (in-lane/out-of-lane); **write deny only OS-level, not the lane** | ceiling | C2-A A13; PD-19; readiness §5.2 / §6.2.3 | C2 + DEV-LIVE |
| M-14 `web_fetch` | yes | yes (`NETWORK_UNCONFINED_REALM`, `WEB_DESTINATION_FORBIDDEN`, `WEB_REQUEST_MALFORMED`) | ceiling (network boolean) | C2-A A11; PD-30 deny/SSRF/malformed arms | C2 + DEV-LIVE |
| M-15 `web_search` | yes (real POST + parse) | yes + `WEB_PROVIDER_UNAVAILABLE` | ceiling + availability | C2-A A12; PD-30 nosearch agreement | C2 + DEV-LIVE |
| M-20 `skill` / `present` | yes | yes (`IO_READ_DENIED`, no existence oracle) | ceiling | PD-26 DEV-LIVE pair | DEV-LIVE |
| M-19 Goal / todo / jobs / exit | session-local only | foreign-id refusal (jobs); inactive-branch error (exit) | none (no I/O face) | PD-24 ledger | DEV-LIVE |
| M-05, M-10–M-13, M-17, M-18 (`pwsh`, `run_code`, `lsp`, terminal_* , remote MCP) | **no** | **no** | none | matrix `NOT_WIRED` / `UNSUPPORTED` | none |

### 2.4 The unmeasured cells

1. **`ToolRestriction` on the shipped Preview** — every preview fact is `null`; only fixture rows
   exercise the right-hand factor. This is the largest acceptance hole and it is **not** disclosed in
   the Preview contract or release notes. The nearest disclosure is
   `ALPHA5-END-STATE.md:151` ("`toolBindingIdentity` 仍为 `null`（v4 toolBindings 无 Member 关联）"),
   which is scoped to Search and is not a Preview document.
2. **`exit_plan_mode` plan-mode-active branch** — no seam to set `plan/mode` active on a delegated
   Member (`TOOL-ACCEPTANCE-MATRIX.md:958-966`).
3. **`ask_user_question` answered branch** — the tool is now absent (PD-25); the matrix still lists
   the branch as unmeasured even though the name is not on the surface.
4. **`bash` dynamic reads** (`$(…)`, backticks) — not lexically attributable; admission does not
   refuse them (readiness §6.2.3, matrix bash row).
5. **`read_image` under C2** — PD-31 is DEV-LIVE only; JPEG/WebP/GIF and within-limit downscaling are
   explicitly not measured (`PRODUCT-DEBT-REGISTER.md:917`).
6. **`network: restricted`** — typed `UNSUPPORTED`; per-host ACL and OS isolation are not implemented
   (`NetworkAccess` is a boolean, `member-io-policy/src/types.ts`).
7. **PTY / persistent shell / managed jobs / `run_code` / `lsp` / `terminal_*` / dynamic MCP** —
   `NOT_WIRED` or absent; matrix appendix and backlog BL-21..BL-26.

### 2.5 Does the register/backlog agree?

**Register: mostly yes.** It records 0 name-level `UNMEASURED` rows
(`TOOL-ACCEPTANCE-MATRIX.md:822-844`) and closes `read_image`'s live branch via PD-31
(`PRODUCT-DEBT-REGISTER.md:98`, `:1287`). **Matrix: no.** §1.8.6 (`:958-968`) still lists
`read_image` live execution and `ask_user_question` answered as unmeasured, both contradicted by
later corrections in the same file (§1.8.13 closes the former; PD-25 removes the latter).

**Backlog: no.** BL-16 still carries "live 半场尝试 1–2 已花、0/6 行未测得" and BL-18 still says the web
live half is unmeasured (`ALPHA5-SANDBOX-BACKLOG.md:128`, `:319`), while the matrix records live
allow/deny for both faces (§1.3.1/§1.3.4/§1.8.10/§1.8.11). A reader who takes the backlog as the
current TODO list will re-run measurements that already exist. **This is a finding.**

---

## 3. Web governance: decision before transport, typed no-provider

### 3.1 Code path

`packages/runtime/team-services/src/web.ts`:

- `createWebNetworkGuard` (`:273-345`) actually does:
  1. **shape** — `assertDeclaredUrl` / `assertDeclaredQuery` → `WEB_REQUEST_MALFORMED`;
  2. **lane** — if `effective.network.access !== 'deny'`, it runs the method's own admission and
     returns: for `search`, `assertSearchAvailable` (`:424-443`, typed `WEB_PROVIDER_UNAVAILABLE`
     when `provider.search` is absent or `searchAvailable()` is false); for `fetch`,
     `assertDestinationAllowed` (SSRF ranges, exact-origin test exemption). It does **not** run both;
  3. **deny path** — it asks the backend's own `probeNetworkDenial`, refuses anything but `enforced`
     with `NETWORK_UNCONFINED_REALM`, then requires a **web-face** proof (PD-15), refusing
     `NETWORK_PROOF_FACE_MISMATCH` otherwise.

  The header comment at `:285-295` advertises "SHAPE -> LANE -> DESTINATION -> AVAILABILITY"; the
  implementation collapses the last two into one method-specific check, so the comment is one stage
  wider than the code. The security-relevant order (lane before any provider entry) is real.
- `createConfinedWebClass` (`:589-658`) wraps that guard with `observeGuard` and then:
  - `fetch` (`:624-632`): `await guard(...)` **then** `return provider.fetch(...)`;
  - `search` (`:635-650`): `await guard(...)` **then** `provider.search(...)` and `capSearchSources`.
  The comments at `:620-623` and `:637-641` state the position is the guarantee.
- The composition-owned transport (`packages/runtime/src/plugin/live/a5sf-web-transport.mjs:165-225`)
  loads the pinned host's `HttpFetchProvider` and only supplies an optional Exa search provider; with
  no key, `searchProvider` is `null` and `searchReason` is recorded (one fact, zero provider entries,
  `:189-219`).

There is **no** `super.fetch` fallback: the confined class replaces both methods, so a provider
registered on the inherited registry cannot silently take the call (`web.ts:580-588`).

### 3.2 Run evidence

- **No-provider search:** `dev/agent-workflow/evidence/a5sf-pd30-web-preview/runs/nosearch/agreement.txt`
  — two agreeing boots, `noBackend PROVEN`, `searchConns 0`, `webFacts {"total":2,"fetch":1,"search":1,"allow":1,"deny":1}`,
  `hostWebCalls 0`; README §2: `web_search` refused `WEB_PROVIDER_UNAVAILABLE` with **1** fact and **0**
  POSTs.
- **Deny before transport:** same README §2 / `agreement-deny.txt` — deny arm `NETWORK_UNCONFINED_REALM`,
  fixture connections **0**, **1** deny fact, inherited host web **0** calls.
- **Allow:** one real connection to the declared origin, body byte-for-byte, exactly 1 allow fact
  (`agreement-allow.txt`).
- **PD-27 prefix arm:** the archived composition answers typed `unknown tool` with 0 facts / 0
  connections, proving the measurement is not a base-web fallback
  (`a5sf-pd27-web-egress/agreement-prefix.txt`).

**Verdict: PASS.** The allow/deny decision is in the guard closure and cannot be bypassed by the
provider; the no-provider case is a typed `WEB_PROVIDER_UNAVAILABLE` produced inside the same guard,
so it also gets exactly one fact. Residual boundaries are disclosed: the deny is service-level, not
OS-level; the allow lane does not mediate redirects or proxy selection (`web.ts:44-58`), and the
network axis is a single boolean.

---

## 4. `read_image`: what the current evidence actually shows

### 4.1 The C2 record is still `NOT_REACHED` — and that is true

`dev/agent-workflow/evidence/c2-adjudication-2/README.md:63`:

> two FS boots (14/14 identical row verdicts: 13 PASS + 1 `NOT_REACHED` `read_image` — the model
> declares no image input, outside C2-A scope).

The latest C2 is `cand-v0.1.6-2` @ `bb3c158eb`; the C2-B A6 adjudication is not a pass (Sticky Stop latch-scoped; A6-on ∧ governed Goal NOT ESTABLISHED), and
neither C2 record reaches a positive `read_image` call. The C2 instrument uses the scripted mock on
the shipped `deepseek-v4-flash` route, which the pinned catalog does not carry, so `modelInfo()`
resolves `['text']` and the native tool refuses **before** the fs face. The C2 record is honest and
correct for its configuration.

### 4.2 The product evidence is newer and goes further

`dev/agent-workflow/evidence/a5sf-pd31-read-image/` (DEV-LIVE, two agreeing boots, 7/7 cases each,
`runs/boot01/summary.txt` and `boot02`):

- positive: in-lane 3×2 PNG, 68 bytes, sha256 `0bf7e492…`; `read_image` returns a real `image` block
  and the same bytes ride the model request as a base64 `image` part
  (`model-request-image-parts.json`); **2** allow facts (`stat` → `readBytes`);
- negative: out-of-lane existing and missing files give the **identical** lane sentence, **1**
  `IO_READ_DENIED` deny fact, **0** bytes, no existence oracle;
- default text route: 0 guard facts, 0 attachment bytes, refusal before provider I/O;
- mutations: declaration→text goes red; gate-removed on the text route serves the read (2 allow
  facts) and the wire gets a text placeholder (0 image parts).

### 4.3 Classification

**DISCLOSED-GAP at C2 level; not a product gap, not merely an instrument bug.** The product capability
exists and was measured on a real Host; the C2 instrument was configured with a text-only route, which
`PD-31` correctly identifies as a **satisfiable branch**, not a broken tool. The disclosure gap is in
the frozen documents:

- `PREVIEW-CONTRACT-2026-11-16.md:47-51` still says "本 Preview 的实测只覆盖**拒绝分支**（脚本化
  mock 路由是 `text`）". That is no longer the complete truth: PD-31 measured the positive branch on a
  declared-`image` route, and the release notes' stable table
  (`RELEASE-NOTES-0.1.6.md:56`) claims the positive path as stable.
- `PREVIEW-READINESS-2026-11-15.md:98` and §5.3 repeat the refusal-only claim.

So the **contract understates** the product while the **release notes overstate the C2 coverage**
implicitly (no C2 reaches the positive path). Both need the same dated correction.

---

## 5. Goal lifecycle: durable facts, rounds, Stop, and where the state machine lives

### 5.1 State machine is upstream

- `cordis.patch.yml:354-362`: `tool-goal` is the upstream `@deepseek-ai/dsh-tool-goal` row
  unchanged, over the host's `goals` service; the round driver
  (`@deepseek-ai/dsh-goal-round-driver`) is a **BASE bundle row, never on this preset**; the round cap
  remains the upstream `maxGoalRounds`.
- Our only lifecycle writes are calls into that service:
  - `packages/runtime/src/plugin/live/agent-bindings.mjs:6156-6199`: `goals.get` → if `phase==='active'`
    `goals.pause(agent, {id, revision})` (durable CAS) → `goals.disarm(agent)`; no local goal store,
    no local transition table, no round counter.
  - `packages/client/src/model/member-stop.ts:248-306`: the first-class Member Stop control emits
    `goals.get → goals.pause → session.cancel → goals.get`; the durable re-read is the only oracle.
- The `agent-state-family` does contain a **mirror** of the upstream goal transition table
  (`packages/tools/agent-state-family/src/agent-state-law.mjs:1-78`), but that family is not mounted by
  the governed preset (`packages/tools/families/manifest.json:29`; no `agent-state` row in
  `cordis.patch.yml`). It is a second implementation of the *law* for a different governed surface,
  not a second Goal Service on the Preview path.

### 5.2 Durable facts and measured behaviour

- Durable facts: `goalId`, `objective`, `phase` (`active`/`paused`/`complete`/`blocked`), `revision`
  (advances exactly one per applied transition), `roundsStarted`, `armed`, `maxGoalRounds`.
- Rounds: driven by the upstream driver; PD-33 measured **3** automatic rounds → terminal `complete`
  for Member B (`PREVIEW-READINESS-2026-11-15.md:80`, §5.2); PD-37 measured 5/4 rounds on the
  installed artifact.
- Stop: after the durable `pause` is ACKed, **0 rounds / 0 requests / 0 new calls**:
  - S1c control sequence: 6 rounds / 7 calls → 0/0, re-read `paused`, lifecycle `SETTLED`
    (`PREVIEW-READINESS-2026-11-15.md:163`);
  - S1 in-turn cancel: 7/8 → 0/0/0 (`:164`);
  - S4 Leader archive: 107/108 → 0/0, `ARCHIVED` (`:165`).
- The exact limitation is frozen: the guarantee starts **after** the `pause` ACK; there is a
  millisecond window between click and ACK where a call can start (`PREVIEW-CONTRACT-2026-11-16.md:144-152`).

**C2 boundary (important).** The 3-round A5-governed Goal evidence is **C2-A A13**, at
`cand-v0.1.6-2`. It is **not** an A6-on ∧ governed measurement: C2-2 §8 says "no shipped driver
enables `alpha6ReviewRouting` on the governed preset, so no single boot measures the exact A6-on ∧
governed `create_goal` conjunction. It remains NOT ESTABLISHED". The Preview contract does not include
the Alpha.6 review plane, so this is outside the contract's scope; it is, however, another reason the
"Goal stable" cell in the release notes describes only the A6-off path.

**Verdict: PASS.** The Preview path does not re-implement the Goal state machine. One caveat: the
`agent-state-family` mirror is a maintenance risk if the upstream law changes; it is currently
citable to the pin and pinned by its own T-table, and it is out of the Preview surface.

---

## 6. Coverage gate: can an unknown tool bypass it?

### 6.1 The check

- `packages/runtime/operation-permission/permission-coverage.ts:294-317` — the closed six-class
  classifier. The final fallthrough is `UNKNOWN_UNMANAGED`.
- `:333-380` — `evaluatePermissionCoverage`: `ok === false` iff `unmanagedTools` is non-empty;
  known-sensitive and unknown are both fatal.
- `packages/runtime/src/plugin/live/agent-bindings.mjs:3604-3635` — the live gate: the final
  model-facing surface is snapshotted after preset mount + `builtinToolDeny` + Team tool/skill
  registration + MCP reconcile; the verdict is evaluated and a non-ok verdict throws
  `PermissionCoverageUnmanagedError` with a deterministic detail. **No auto-hide, no acknowledgement
  escape hatch** (`permission-coverage.ts:36-40`).

### 6.2 Can an unknown name bypass it?

- **In strict mode, no.** A name in no class → `UNKNOWN_UNMANAGED` → setup throws. The unit suite
  exercises the synthetic `foo_magic` surface and expects exactly that
  (`packages/runtime/test/a2c2-permission-coverage.test.ts:91`, `:951-970`; I ran the suite: 18/18
  pass).
- **Structurally, yes — by the gate being absent.** The gate runs only when the bound template
  declares `capabilities.permissions` (`agent-bindings.mjs:2495`, `:3604` "Strict mode only").
  The governed Preview blueprint used by PD-33 declares members with only
  `templateId`/`displayName`/`persona` and no `capabilities`
  (`tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs:519-570`). Therefore the
  governed Member never runs the coverage gate at all. A future base upgrade that adds a name to the
  preset would not be blocked by this gate; the only guard is prose plus the static preset list.
- **There is no failing mutation test for the unknown-name branch.** I found no mutation control that
  removes/weakens the classifier and shows a setup going green; the only negative control is the
  synthetic unit case above, which asserts the classifier/verdict, not a live setup throw. The
  surface-coverage gate that *does* have a failure mode is the **evidence ledger builder**
  (`tests/world-factory/drivers/a5sf-pd24-surface-ledger/build-ledger.mjs:288`, throws on an
  unclassified measured name; `:353`, `:357` refuse if the bucket identity or fixed shape moves), but
  that is a one-off evidence generator, not CI, and its mutation controls (`M1`, `M2`, `PIN`) never
  inject an unknown name. **This is a finding.**

### 6.3 The strict-mode / Goal conflict (F-2)

`dev/agent-workflow/evidence/v016-packaged-acceptance/README.md:175-182` (F-2): a Member that declares
the `bash` ask lane must also declare `builtinToolDeny` for the 19 unmanaged names, which removes
`create_goal`/`update_goal`. The packaged acceptance consequently runs the Goal arm on a **third
Member without `capabilities`**. In other words, on this candidate a Member cannot simultaneously
(a) be strict-mode covered and (b) own the Goal trio. This is a real product limitation, and it is not
disclosed in the Preview contract or the release notes; it lives only in the evidence README. For a
Preview that advertises both "Goal tools work" and "approval routing", this is a P1 disclosure gap.

**Verdict: PARTIAL.** The gate is fail-closed when present and has no in-mode bypass; it is absent on
the shipped governed Member, has no failing mutation control, and conflicts with the Goal trio when a
user turns it on.

---

## 7. Preview-vs-full-Alpha.5 boundary, and doc-vs-code mismatches

### 7.1 What the contract claims

| Claim | Site | Status |
| --- | --- | --- |
| One opt-in preset; default `standard` unchanged; no default path claim | contract §1, §7; release notes §7 | **true** (`cordis.patch.yml:302-410`; `standard` preset untouched) |
| 10 governed I/O + `read_image` (route-conditional) + Goal trio + 15 `team_*`; 34 product / 36 names | contract §5.1 `:206-216`; release notes §2.1 `:51` | **true** (measured 36; see §1), but the contract names only 4 of the 34 |
| `web_search` typed `WEB_PROVIDER_UNAVAILABLE` with 0 requests by default | contract §2.1 | **true** (PD-30 nosearch; see §3) |
| `read_image` refused before provider I/O on a `text` route | contract §2.2 | **true**, but the positive branch is now also measured |
| Ordinary install: tools execute; team.create not re-measured, no DOM click, no restart-no-continuation | contract §2.3.1/§2.3.2, §5.3 | **true and disclosed**, but contradicted by §4 item 5 (below) |
| Stop: durable pause ACK then no continuation | contract §3.1; release notes §2.1 | **true** (S1/S1c/S4) |
| Not a per-host network policy, not OS isolation, not a security boundary, not team-wide Stop | contract §4 | **true** (and important) |
| C2 independent adjudication, `release` BLOCKED | contract §1; matrix §0 | **true** (C2-2 exists; C2-B NOT PASS; release blocked) |

### 7.2 What is genuinely verified

- **V@B: none.** Zero product rows on the Preview surface carry `V@B`; the 2026-11-05 live grades were
  withdrawn by Q7. The matrix's strongest live grade is `NEEDS_REVALIDATION` with `V@B=no`.
- **C2:** C2-A (governed E2E) PASS at `cand-v0.1.6-1` and again at `cand-v0.1.6-2`, with A1–A13
  PASS except the two partials; C2-B (Alpha.6) is **not a pass** (Sticky Stop latch-scoped; A6-on ∧ governed
  Goal NOT ESTABLISHED). Both C2 records predate `9e1c493b6`.
- **DEV-LIVE:** PD-24/26/27/29/30/31/33/34/37 add live evidence after C2, including the read_image
  positive/negative pair, the web allow/deny/nosearch triple, the Member Stop sequence, and the
  installed-artifact run.

### 7.3 Doc-vs-code / doc-vs-doc mismatches (blunt)

| # | Claim in the named docs | What the code/evidence shows | Site | Severity |
| --- | --- | --- | --- | --- |
| D1 | Release notes stable table: `bash` is one of the governed I/O tools whose "out-of-lane access is refused at the admission layer with a typed denial and a guard fact, **before a provider call or a process exists**" | The confined `bash` face admits the **spawn only by the declared cwd**; the command body is not parsed (`confined-terminal-tool.mjs:118-125` passes `{type:'confined-shell', cwd}` to `terminals.spawn`, then `startSend({text: command})`). The contract itself says "shell 体不由服务轴归属" and readiness §6.2.3 says "不解析命令体，越界写由 OS profile 兜住". A `bash -c 'cat /etc/passwd'` exists as a process; the refusal, if any, is the OS profile's, not a typed admission denial. | `RELEASE-NOTES-0.1.6.md:51` vs `PREVIEW-CONTRACT-2026-11-16.md:192-193`, `PREVIEW-READINESS-2026-11-15.md:301-303`, `confined-terminal-tool.mjs:118-125` | **P0** (user-facing overclaim) |
| D2 | Contract "explicit is-not" #5: "不是'普通安装即可用'… **当前只在 WorldFactory harness 形态下有 live 证据**" | §2.3.1/§2.3.2 (same file) and §5.3 say the opposite: PD-37 fixed the manifest and a real model executed fetch/fs/goal/Stop on the installed artifact; the release notes' stable table also claims "Ordinary install". §5.3 corrects §1 and §2.3 but **does not name §4 item 5**, so the "is-not" list still tells a reader the install is not live. | `PREVIEW-CONTRACT-2026-11-16.md:194` (and `:24`) vs `:100-177`, `:231-246` | **P1** (same document contradicts itself) |
| D3 | Contract §2.2 says the capability is promised **when the route declares `image`**, but also that "本 Preview 的实测只覆盖**拒绝分支**（脚本化 mock 路由是 `text`）" | PD-31's DEV-LIVE pair measures a **declared-`image`** route positive branch (2 allow facts, base64 image part on the wire, decoded sha256 match) and the negative branch, so the measurement-coverage sentence is stale; release notes §2.1 treats the positive path as stable. The capability sentence is not the problem. | `PREVIEW-CONTRACT-2026-11-16.md:47-51`, `PREVIEW-READINESS-2026-11-15.md:98` vs `a5sf-pd31-read-image/README.md:3-17`, `RELEASE-NOTES-0.1.6.md:56` | **P1** |
| D4 | Matrix §0: every restricted call satisfies `EffectiveIo ⊆ MemberCeiling ∩ ToolRestriction`; matrix rows list restriction denies | The shipped Preview path derives ceilings only and records `blueprint-tool-bindings-not-member-scoped`; every Preview fact has `toolBindingIdentity: null`. The restriction-denies are measured with a **fixture** realm provider (`a5sf-preflight`, C2-A FS), not the shipped preset. | `TOOL-ACCEPTANCE-MATRIX.md:15`, `product-assembly.ts:774-782`, `:1076`, `a5sf-pd33-preview-e2e/runs/boot02/guard-facts.json` | **P1** |
| D5 | Matrix §1.8.6 lists `read_image` live and `ask_user_question` answered as unmeasured; `PREVIEW-READINESS` §2 says 7 deferred names are closed but the contract/release notes never enumerate them | PD-31 closes `read_image`'s live branch (DEV-LIVE); PD-25 removes `ask_user_question`; PD-18/21 remove the other six. The deferred set is only in the internal readiness table (§2, §6.2). | `TOOL-ACCEPTANCE-MATRIX.md:958-968` vs `:1235-1257`; `RELEASE-NOTES-0.1.6.md` (no occurrence of `subagent`/`workflow`/`ask_user`) | **P1** (internal inconsistency + user-facing omission) |
| D6 | Backlog BL-16/BL-18 still describe the live half of search/web as unmeasured ("0/6 行未测得", "live 半场仍未测") | Matrix §1.3.1/§1.3.4 and §1.8.10/§1.8.11 record live DEV-LIVE allow/deny for search and web. | `ALPHA5-SANDBOX-BACKLOG.md:128`, `:319` vs `TOOL-ACCEPTANCE-MATRIX.md:362-434`, `:1023-1069` | **P1** (stale TODO source) |
| D7 | `ALPHA5-END-STATE.md` §1.5 says `web_fetch`/`web_search` are "fail-closed removed (PD-18)" and "no strengthening, only regression" | PD-27 restored them on the Team-owned `dsh-agent-team/web-tool` row, and PD-30/PD-37 measured real transport. The end-state table was not corrected. | `ALPHA5-END-STATE.md:157` vs `cordis.patch.yml:340-351`, `a5sf-pd30-web-preview/README.md` | **P2** (not one of the four authority docs, but a "current end state" page) |
| D8 | Release notes "Ordinary install" does not repeat the contract's disclosure that `team.create` → Leader turns were **not re-measured** in the installed shape and `n=1` | Contract §2.3.2 discloses it; PD-37 README:167 says "Does not: re-measure `team.create` → Leader turns"; the release notes only say "n=1 is an existence proof". | `RELEASE-NOTES-0.1.6.md:64-67` vs `PREVIEW-CONTRACT-2026-11-16.md:138-143`, `a5sf-pd37-installed-tools/README.md:167` | **P2** |
| D9 | Release notes stable `read_image` says "On a model route that declares `image`, `read_image` reads through the governed fs face" (stable) while contract §2.2 promises only the refusal branch | Code does both; the two docs assign different stability scope. No C2 reaches the positive path. | `RELEASE-NOTES-0.1.6.md:56` vs `PREVIEW-CONTRACT-2026-11-16.md:47-51` | **P2** (same as D3, different consumer) |

**Claims the code does *not* do at all** (as opposed to doc-only scopes):

- A **member-scoped ToolRestriction** on the Preview path (D4).
- **Admission-level refusal of `bash` command-body paths** (D1).
- **Per-host network policy / OS network isolation** — correctly disclaimed in contract §4, so not a
  mismatch.
- **A coverage-gate guarantee for the governed Member** — not claimed in the docs, but the matrix's
  "every name has an owner" prose can be read as broader than the strict-mode-only implementation.

---

## 8. P0 / P1 candidates

> No **product** P0 was found. The single P0 is a documentation blocker: the user-facing release
> notes make a safety claim the code does not implement.

### P0-1 — Release notes overclaim `bash` admission

- **Site:** `docs/plans/active/alpha5-sandbox-first/RELEASE-NOTES-0.1.6.md:51`.
- **Why it blocks a Preview GO:** this is the stable-surface table a Preview adopter relies on. It
  says out-of-lane `bash` access is refused at admission "before … a process exists". The code admits
  a process by `cwd` and lets the shell body run
  (`packages/runtime/src/plugin/live/confined-terminal-tool.mjs:118-125`); the only backstop for an
  out-of-lane path inside the command is the OS profile. The contract (`:192-193`) and readiness
  (`:301-303`) say this plainly; the release notes do not. A GO statement built on the release notes
  would be false.
- **Minimal fix:** replace the `bash` clause with two sentences: "the spawn root (cwd) is admitted at
  the confinement layer; the command body is not lexically attributed, and an out-of-lane path inside
  the shell is stopped only by the OS profile, not by a typed admission denial." No product change.

### P1-1 — `ToolRestriction` is the identity on every shipped Preview call

- **Sites:** `packages/runtime/team-services/src/product-assembly.ts:774-782` (derives ceilings only),
  `:977-1007` (restrictions only from the explicit `a5sfMemberPolicies` exception), `:1076` (residual
  `blueprint-tool-bindings-not-member-scoped`); the shipped preset sets no `a5sfMemberPolicies`
  (the key occurs nowhere in `cordis.patch.yml`).
- **Evidence:** `a5sf-pd33-preview-e2e/runs/boot02/guard-facts.json` — all facts
  `toolBindingIdentity: null`.
- **Why it blocks a Preview GO:** the acceptance matrix's central invariant is advertised as
  `MemberCeiling ∩ ToolRestriction`; the Preview proves only the ceiling. A Preview GO that cites the
  matrix would overstate what was enforced.
- **Minimal fix (choose one, product change only for the second):**
  1. **Disclosure:** append to contract §2.3 a sentence that the Preview's opt-in derived path
     compiles the Member ceiling only; `ToolRestriction` is empty and every fact is `null`; the
     restriction denies in the matrix were measured with a fixture realm provider. Add the same
     sentence to release notes §2.1.
  2. **Product:** give `memberIoCeilings[]` a member-scoped `toolRestrictions` field (or derive the
     existing `toolBindings` by `templateId`) and measure one restriction deny on the shipped preset.
     This is a full-Alpha.5 item, not a Preview prerequisite.

### P1-2 — Contract §4 item 5 contradicts §2.3.1/§2.3.2/§5.3 on install status

- **Sites:** `PREVIEW-CONTRACT-2026-11-16.md:194` ("当前只在 WorldFactory harness 形态下有 live
  证据") vs `:100-177` and §5.3 `:231-246`.
- **Why it blocks a Preview GO:** two statements in the same frozen document assign different evidence
  bases to the shipped artifact; a GO reviewer cannot cite one without the other being false.
- **Minimal fix:** append a §5.4 bullet naming §4 item 5, or edit the item to: "installed-shape tool
  execution is now measured (§2.3.1/§2.3.2); the team path, DOM click and restart-no-continuation are
  not."

### P1-3 — The coverage gate is absent on the governed Member, and strict mode conflicts with the Goal trio

- **Sites:** `packages/runtime/src/plugin/live/agent-bindings.mjs:2495`, `:3604` (strict-mode only);
  governed blueprint has no `capabilities` (`tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs:519-570`);
  `permission-coverage.ts:294-317` (unknown → fatal **when the gate runs**);
  `v016-packaged-acceptance/README.md:175-182` (F-2: ask lane + Goal tools mutually exclusive).
- **Why it blocks a Preview GO:** the gate is the only mechanical "no unknown tool on the surface"
  check, and it does not run for the shipped governed Member. If a user enables permissions to get
  approval, F-2 removes the Goal tools; if they keep Goal, the gate is off. Neither trade-off is in
  the named docs.
- **Minimal fix:** (a) add a host-free governance test that the shipped governed surface is exactly
  the known 34-name set and fails on any added name (a surface allowlist, not the A2C-2 gate); (b)
  disclose F-2 in release notes §2.2 or §4 ("one Member cannot both declare the bash ask lane and own
  the Goal trio on this candidate"). A failing mutation that injects an unknown name into the surface
  and asserts the setup throws would close the acceptance gap.

### P1-4 — The deferred seven are not disclosed where a user sees them

- **Sites:** the contract never enumerates them; release notes never mention `subagent`, `workflow`,
  `subagent_fork`, `send_message`, `interrupt_agent`, `list_agents`, `ask_user_question` (verified by
  grep: zero occurrences). Only `PREVIEW-READINESS-2026-11-15.md:71-100` and §6.2 say they are closed.
- **Why it blocks a Preview GO:** a Team product that silently loses the delegation family and
  `ask_user_question` is a capability regression a user will notice; the contract's "what ships"
  list is read as complete.
- **Minimal fix:** add a "not on the governed preset" block to release notes §2.1/§4 listing the
  seven names and the reason (fail-closed after measured base-service leaks / approval-plane
  conflicts); point at the debt-register rows.

### P1-5 — `read_image` scope statements are stale in both directions

- **Sites:** contract §2.2 (`:47-51`) and readiness §2 disclosure 3 (`:98`) say only the refusal branch was
  measured; release notes §2.1 (`:56`) treats the positive path as stable; C2-2 still says
  `NOT_REACHED` (`c2-adjudication-2/README.md:63`).
- **Why it blocks a Preview GO:** the stable table and the contract assign different scope to the same
  tool, and no C2 covers the positive path, so a GO citing "stable" is citing DEV-LIVE under a C2
  label.
- **Minimal fix:** append a dated correction to contract §2.2 and readiness §5.3: "PD-31 (2026-11-15,
  DEV-LIVE, two boots) measured the positive branch on a declared-`image` route; the C2 records
  remain `NOT_REACHED` and the default `['text']` route still refuses before provider I/O."

### P1-6 — Unmeasured-cell ledger and backlog disagree with the matrix

- **Sites:** `TOOL-ACCEPTANCE-MATRIX.md:958-968` (read_image live, ask_user answered) vs `:1235-1257`
  (PD-31 closes read_image; PD-25 removes ask_user); `ALPHA5-SANDBOX-BACKLOG.md:128`, `:319` (web/search
  live unmeasured) vs `TOOL-ACCEPTANCE-MATRIX.md:362-434`, `:1023-1069`.
- **Why it blocks a Preview GO:** the "unmeasured cells" list is the GO reviewer's checklist; if it
  names cells that are already measured or impossible, the checklist is not auditable.
- **Minimal fix:** append matrix §1.8.14 with the authoritative three remaining branches
  (`exit_plan_mode` active; `bash` dynamic reads; `read_image` under C2), mark the ask_user branch
  "tool removed, branch unreachable", and update the BL-16/BL-18 current status lines to point at the
  matrix's DEV-LIVE sections.

### P2 candidates

- **P2-1** `ALPHA5-END-STATE.md:157` still says web is fail-closed removed; PD-27 restored it. Append
  a correction.
- **P2-2** Release notes "Ordinary install" does not repeat the contract's `team.create`/DOM/restart
  non-measurements. Add one sentence.
- **P2-3** The PD-24 evidence ledger's coverage gate (`build-ledger.mjs:288`) is not CI-wired and has
  no mutation control that injects an unknown name. If it is meant to be a gate, it is an evidence
  generator today.

---

## 9. What I could not determine

1. **No Host was booted** (task constraint). I could not re-measure the surface at `9e1c493b6`; the
   36-name surface is read from `a5sf-pd31-read-image` (measured at `0c2a8f422`) and PD-33
   (`a2e0df3c9`). I did not verify that the 36 names are unchanged at the current HEAD; the preset
   rows are unchanged, but a base-upgrade effect is not observable without a boot.
2. **No C2 after `cand-v0.1.6-2` (`bb3c158eb`).** The current master contains post-C2 work
   (`a1d8f6f33` integration, WP1/WP2, PD-31/33/34/37). I cannot convert the later DEV-LIVE evidence
   into a candidate claim, and I did not find a later C2 record.
3. **The packaged/install shape at the current HEAD was not re-run.** The PD-37 evidence is from a
   different tarball (`0.1.1-alpha.2`, sha `61fd2e48…`) than the release notes' `0.1.6` artifact, and
   PD-37 itself says `team.create` → Leader turns were not re-measured. I did not verify that the
   current manifest still produces the fixed profile graph; the host-free `plugin-dsh-compat.test.ts`
   is a manifest-level stand-in, not a boot.
4. **DOM Stop click and restart-no-continuation** were not measured by any lane I could find; PD-36/37
   and the contract disclose this. I cannot close them.
5. **The `agent-state-family` goal-law mirror** may drift from the upstream goal law; I verified it is
   not mounted by the governed preset, but I did not audit every transition against the pin.
6. **The exact behaviour of `read_image` on JPEG/WebP/GIF or within-limit downscaling** is not
   measured (PD-31 README, register `:917`), and I did not boot a Host to try.
7. **Doc checks:** I did not modify any repository doc, so I did not run `node scripts/doc-checks.mjs`
   against changed docs; the audit report itself is under `dev/agent-workflow/evidence/`, which is not
   part of the docs tree checked by that script. If the report is later promoted into `docs/`, the
   check must be run.

---

## Appendix — commands actually run (read-only / host-free)

```
node scripts/current-authority.mjs
  -> pointer as20261109r1, baseline cb2e41483…, digest sha256:d85fdc1a…

node --test tests/world-factory/a5sf-pd24-surface-ledger.test.mjs
  -> 5 pass, 1 skipped (PD24-PIN), 0 fail

node --test tests/world-factory/a5sf-pd31-read-image.test.mjs
  -> 7 pass, 0 fail

npx vitest run packages/runtime/test/a2c2-permission-coverage.test.ts
  -> 18 pass, 0 fail

git diff --name-status origin/master...HEAD -- packages cordis.patch.yml scripts package.json
  -> empty

git worktree add .worktrees/audit-a -b task/audit-a-alpha5-20261111 origin/master
  -> HEAD 9e1c493b67659704df02da5ce3541fb0c81d2425
```

No product file, no `docs/` file, and no upstream/test-use tree was written. The only file written is
this report.
