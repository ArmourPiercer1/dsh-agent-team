# F3-F11-F9-T1.4-repair — live acceptance round r2 — NOTES

Executor: live Playwright acceptance subagent (delegated). Host: mock team host over pristine
`references/deepseek-harness-test-use` @ a66e4702 (clean at postflight, porcelain empty).
DSH_HOME: `tests/mock/.dsh-home-repair-r1` (repair-r1 home; credentials gap fixed this round — see
§7.1). Ports: host 3181 / MCP 3491 (dtest-mini) / 3492 (dtesthttp). Model: qwen3.8-27b via
qiyuan-self. All assets run **exactly as committed** (`tests/mock/scripts/…` tracked, tree clean).
Evidence: this directory. No product source / upstream / active plan / graph / router-log
modification; no push; :3080 GET-only health probe; no fabricated state.

## 1. Verdict summary

| # | asset (committed) | half | result | exit |
|---|---|---|---|---|
| 00 | `preflight-check.mjs` | boot#1 | **PASS** 8 PASS CLEAR | 0 |
| 01 | `f9-check.mjs selftest` | offline | **PASS** 23 PASS | 0 |
| 02 | `f9-check.mjs version-gate` | boot#1 | **PASS** 5 PASS (v1-3 unsupported, v4 reaches port, v4 spoof → malformed) | 0 |
| 04 | `ui-gate.mjs gates/smoke-g1.json` | boot#1 | **PASS** (root 请初始化团队 + 团队 tab) | 0 |
| 06 | `f9-check.mjs pending --json '{"kind":"user-approval"}'` | G3 | **PASS** (rid ctrl-1utbsww1kjuqwl08yzyyu0ma; wrote state/f9-pending.json) | 0 |
| 07 | `ui-gate.mjs gates/f9-g3-pending.json` | G3 | **PASS** (§26.2 bar + all detail fields + enabled Allow/Deny) | 0 |
| 08 | `ui-gate.mjs gates/f9-g3-allow.json` | G3 | **PASS** (Allow clicked; bar gone; decision row allow; zero error chips) | 0 |
| 09 | `f9-check.mjs decided --request-id … --expect allow` | G3 | **PASS** (1× control-decision-recorded, decider=human) | 0 |
| 11 | `f9-check.mjs consumed --request-id …` | G3 allow | **FAIL** (0 control-allow-consumed; expected exactly 1) | 1 |
| 13 | `f9-check.mjs pending --json '{"kind":"user-approval","out":"tests/mock/state/f9-deny-pending.json"}'` | G3 deny | **PASS** (rid ctrl-1vnalzt1jpvxto08p0d9v0mk) | 0 |
| 14 | `ui-gate.mjs gates/f9-g3-deny.json` | G3 deny | **PASS** (Deny clicked; deny decision row) | 0 |
| 15 | `f9-check.mjs decided --expect deny` | G3 deny | **PASS** (decider=human) | 0 |
| 16 | `f9-check.mjs consumed --json '{"expectAbsent":true}'` | G3 deny | **PASS** (zero consumption = zero side effects; disk negative both paths) | 0 |
| 17 | `preflight-check.mjs` | boot#2 (MOCK_HARD_TOOLS=1) | **PASS** 8 PASS CLEAR (team gen 15) | 0 |
| 18 | `f9-check.mjs version-gate` | boot#2 | **PASS** 5 PASS | 0 |
| 20 | `f9-check.mjs pending --json '{"out":"tests/mock/state/f9-policy-pending.json"}'` | G4 | **PASS** (4 pending; first by seq = ctrl-0f8mo951hnv44s1ytucq70l3, v2-l1) | 0 |
| 21 | `ui-gate.mjs gates/f9-g4-policy.json` | G4 | **FAIL (1)** — Allow clicked; expected deny+external-policy decision row absent; resolve bar still present; (error-chip assert vacuously true — empty list) | 1 |
| 22 | `f9-check.mjs policy --request-id ctrl-0f8mo951hnv44s1ytucq70l3` | G4 | **FAIL** — durable decision was `allow` (reason absent), not deny+external-policy | 1 |

**Score: 16 PASS / 2 FAIL.** Both FAILs diagnosed (§5, §6): one is a committed-recipe defect in the
G4 flow (request shape cannot reach the policy branch); the other is an asset-expectation vs
frozen-product-semantics mismatch on the allow-half consumption (F10 class, V1-documented).
**No credential, host, or browser-infrastructure failures this round** (r1's two infra failures —
shell-quoting JSON mangling and playwright-cli daemon EPERM — were both worked around with
committed-safe mechanisms and did not recur as asset failures).

## 2. World (model-driven, all turns)

| turn | session | recipe | outcome (durable) |
|---|---|---|---|
| root t1 (38.6s… see below) | session-dtestmts69xkr6b54 | `prompts/r2-root-init.md` (verbatim V2 root prompt) | team gen 4; W1=inst-0fi1an617bjs (worker), W2=inst-1ds2q2n0nete (collector); child sessions session-team-child-f1898fca… / session-team-child-a28fa0cc… |
| W1 t1 (38.6s) | child-f1898fca | `prompts/b4-requests.md` | 4× control-request-recorded: seq 3 user-approval v2-probe-1 (ctrl-1utbsww1kjuqwl08yzyyu0ma, corr dtest-v2-req-ua-1); seq 4/5/6 leader-approval v2-l1/v2-l2/v2-self (ctrl-0f8mo951…/ctrl-0eenv681…/ctrl-0ppmycw1…, corr dtest-v2-req-la-1/la-2/self-1); self-resolve of ④ → `CONTROL_RESOLVER_NOT_AUTHORIZED (allowed: [leader, human])` exactly per V2 B4 expectation |
| root t2 (52.3s) | root | `prompts/t41-exec.md` | leader team_follow_up(W1, token dtest-v2-ua-exec) executed (team-work-admitted seq 8) |
| W1 t2 | child-f1898fca | (follow-up) | base `write` executed; content V2-UA-CONTENT; path resolved workspace-relative → `tests/mock/tests/mock-outside/probe/v2-probe-1.txt` (inside session workspace; default sandbox, no escalation) — artifact captured (11c2-…) |
| W1 t3 (10.3s) | child-f1898fca | `prompts/t41-deny-req.md` | control-request-recorded seq 12 user-approval v2-probe-2 (ctrl-1vnalzt1jpvxto08p0d9v0mk, corr dtest-v2-req-ua-2) |
| W1 t4 (8.2s, boot#2) | child-f1898fca | `prompts/b6-req.md` | control-request-recorded seq 14 leader-approval v2-hard (ctrl-1eaer590x95ko00wdd0y71jw, corr dtest-v2-hard-req-1) — **no toolName in the call** |

UI-driven (committed gates): Allow on ctrl-1utbsww1… (seq 7 allow/human), Deny on ctrl-1vnalzt1…
(seq 13 deny/human), Allow on ctrl-0f8mo951… (seq 15 allow/human — under boot#2 hard tools policy;
see §5).

## 3. Model-turn ledger (final durable control plane)

15 ledger facts at postflight: 2 provision + 5 request (seq 3,4,5,6,12,14 — six requests total) +
3 decision (seq 7 allow, 13 deny, 15 allow; all decider=human) + work/activity/lifecycle (seq 8-11).
**0 control-allow-consumed facts.** No stale-denied, no double-decision, no member-decided rows.

## 4. G3 allow half (pending → allow → decided → exec → consumed)

- pending gate, §26.2 detail fields, Allow click, decision row, durable allow: **all PASS** — the
  F9 human-ingress (Remote v4 `team.resolveControl`, T12-B4 human principal) works end-to-end live.
- t41-exec: leader follow-up + W1 guarded write executed and verified read-back (V2-UA-CONTENT).
- `consumed` **FAIL**: 0 consumption facts. Diagnosis `11d-consumed-fail-diagnosis.md`:
  the product's last-mile guard (`tools/src/guard.ts` SD-GUARD, `tools.ts executeGuarded`,
  `control/service.ts guardOperation` scope-key `(root,target,actionName,toolName,correlation)`)
  is consulted only for the four team work operations; a `write`-intent request (actionName=write,
  no toolName, corr dtest-v2-req-ua-1) can never match any consulted team-operation scope, so its
  allow can never be consumed by the tool pipeline; the member's write executed via the base write
  tool (host-sandbox lane), not the control guard. **Frozen semantics, unchanged by the F9 repair
  (frozen contract L173/L436); V1 T4.3 OBS documented the identical behavior pre-F9; V1 measured
  exactly-once consumption on a follow-up scope instead (T4.5).** Class: asset-expectation vs
  frozen product semantics — the committed recipe pair (b4-requests + t41-exec) cannot satisfy the
  committed `consumed` expectation. Not a new product regression; not credentials/host/browser.

## 5. G4 policy half (boot#2, MOCK_HARD_TOOLS=1)

- boot#2 clean: ports free after boot#1 kill; MOCKBOOT_READY keyConfigured=true, hardTools=true,
  team resumed (gen 15→17 during gate). preflight 8 PASS / version-gate 5 PASS.
- b6-req model turn recorded the v2-hard request (seq 14).
- pending (no kind filter) correctly took the FIRST pending by sequence (v2-l1, seq 4) and wrote
  state/f9-policy-pending.json; the other three pending stayed pending (gate isolated the bar by
  exact requestId via varsFile interpolation — mechanism itself worked).
- `ui-gate f9-g4-policy` **FAIL(1)** + `f9-check policy` **FAIL**: the human's Allow on v2-l1
  committed as a **plain allow** (durable seq 15) because the request payload has no `toolName` and
  no explicit `capabilityDomain` → `service.ts` L925-929 derives `capabilityDomain=undefined` → the
  external hard-policy branch (L925-955) is unreachable. **Every r2 request (b4-requests + b6-req)
  was created without toolName by the committed recipes**, so no request in this world could ever be
  blocked by `hard.tools=deny`; the gate's deny+external-policy expectations are structurally
  unsatisfiable as committed. Diagnosis `22b-g4-fail-diagnosis.md` incl. the V1 T4.7a precedent
  (NOTES L201) which declared `toolName:"write"` and DID produce the durable deny · external-policy
  + UI "deny · external-policy" row — the committed V2 recipe dropped that parameter.
- Secondary observations (record only): (a) the gate's error-chip `every()` assert is vacuously
  true on an empty chip list; (b) after the durable allow (seq 15) the v2-l1 row still showed
  等待裁决 + live resolve bar at the 8s-settle snapshot while its decision row had rendered —
  client projection-lag class (V1 F5 precedent), not the FAIL cause; the "3 项待裁决" count was
  correct.

## 6. Postflight (phase 6)

- boot#2 killed; ports 3181/3491/3492 all free.
- Stable instance :3080: GET-only probe → **401 (auth-protected text/plain)** — up and untouched
  (this round performed zero operations against it).
- `references/deepseek-harness-test-use`: `git status --porcelain` **empty** (pristine preserved).
- Artifacts copied into this evidence dir: `state/` (f9-*-pending.json ×3, boot-state.json,
  teamtab-*.yml ×5, ui-gate-*-raw.txt ×5), `screenshots/` (v2-smoke-g1, f9-g3-pending/allow/deny,
  f9-g4-policy). `state/cookie-header.txt` deliberately NOT copied (session credential; stays in the
  gitignored state dir).
- Residual world facts (durable, model/UI-driven, all accounted for in §3): 3 pending requests
  (v2-l2, v2-self, v2-hard) + 1 unconsumed allow (v2-probe-1) + nested write artifact
  `tests/mock/tests/mock-outside/probe/v2-probe-1.txt` (V2-UA-CONTENT; workspace-relative
  resolution — see §4). Left in place as acceptance residue (V1 precedent: mock-outside probe files
  persist across rounds).

## 7. Environment / executor diagnostics (r2-specific)

1. **Credentials gap (fixed, boot#1 pre)**: repair-r1 home's `.credentials.yaml` lacked the
   `QIYUAN_SELF_API_KEY` ref (boot WARN, keyConfigured=false). Fixed by appending the `refs:`
   section byte-exact from the V2 home (`tests/mock/.dsh-home/.credentials.yaml`); backup
   `.credentials.yaml.bak-r1`→`.bak-r2` kept in the gitignored home; value never printed. Boot
   re-ran clean (keyConfigured=true). Classification: credentials (home provisioning), per the
   task's diagnostic instruction — isolated and fixed before any model turn.
2. **Shell-quoting class (r1 carry-over, worked around)**: the session transport strips embedded
   double quotes from `--json` payloads (r1 f9-pending SyntaxError class; re-confirmed live when
   `{"kind":"user-approval"}` arrived as `{kind:user-approval}`). Fixed with
   `tools/run-asset.mjs` exact-argv wrapper + `@file` argument expansion (JSON read verbatim from a
   file, zero shell involvement). All f9-check invocations ran through it.
3. **playwright-cli daemon (r1 carry-over, worked around)**: `PWTEST_DAEMON_SESSION_DIR` set to
   workspace-local `tests/mock/.playwright-cli/daemon` for every ui-gate call (r1 EPERM under the
   prior subagent's narrower sandbox; this session is danger-full-access — probe passed).
4. **wait-turn discipline**: watchdog armed BEFORE delivery every time after the initial root-turn
   baseline race (root t1: watchdog started post-delivery → baseline race → TIMEOUT despite
   completion; verified via fingerprint turn/end seq=338). All subsequent turns settled inside
   watchdogs (W1 t1 38.6s, root t2 52.3s, W1 t3 10.3s, W1 t4 8.2s). One executor slip (b6-req):
   watchdog armed without the delivery call → correct TIMEOUT with fingerprint proof (no new turn);
   re-armed and delivered properly. No world state affected.
5. **f9-check `out` path semantics**: `out` is used verbatim (CWD-relative) while the default is
   script-anchored (`STATE_DIR`); the asset doc's invocation assumes CWD=`tests/mock`. r2 ran from
   the repo root with `tests/mock/state/…` targets — same files the committed invocation produces.
6. **pwsh 5.1 transport quirks**: ANSI console mojibake on UTF-8 output (display only; files are
   UTF-8); no ternary/underscore numerals; multi-statement pipe blocks need explicit `$var`.

## 8. Red-line compliance (final)

- Product source / dist: untouched (diagnosis reads only). Upstream test-use: pristine (verified).
- `docs/plans/active`, `dev/agent-workflow/graph.yaml`, `SESSION_ROUTER_LOG.md`: untouched (this
  round is acceptance evidence, not orchestration state — delegation scope).
- No push. No :3080 operations (GET health probe only). No fabricated state: every ledger fact is
  model-driven or committed-gate UI-driven; every artifact in this dir is captured, not authored.
- Credential values never printed or copied into evidence (backup stays in gitignored home).

## 9. What a compliant G4 re-run would need (decision for the delegating agent)

The G4 FAIL is a **committed-recipe defect**, not a product regression: `prompts/b6-req.md` (and
`b4-requests.md`) omit `toolName`, so no request can reach the external-policy branch
(`service.ts` L925-929 derivation; V1 T4.7a precedent declared `toolName:"write"`). Minimal fix
out-of-scope here (assets were run exactly as committed): have the policy-half request carry
`toolName` (and select THAT request for the gate — e.g. create it while it is the only/first
pending, or extend the committed pending `out` selection), then re-run `f9-g4-policy` +
`f9-check policy`. The product side (durable deny · external-policy + §26.4 UI row) has V1
precedent; the F9-U display assertions in the committed gate remain the live check.
