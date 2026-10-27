# u7-inspect-c2-20261027 — inspect family C2 live arms, completed on master

**This record supersedes the PR #404 C2 records**
(`dev/agent-workflow/evidence/u7-f-inspect-20261026/c2/c2-verdicts.json` = boot 5,
`overall: FAIL`; `c2/boot4-record/`; `c2/round1-boots-1-3/`). Those files are kept
byte-untouched; nothing in them was edited or deleted. The per-tool acceptance ledger
(`dev/agent-workflow/ledgers/u7-tool-acceptance.json`) now cites
`c2/c2-verdicts-boot1.json` here for the three inspect tools.

- Base: `origin/master` @ `6a0482fed` (includes #409's hardlink law; the skill loader
  goes through it). Record `bindings.teamSha` = `d9d1f5817` = that master + the drive
  script commit only (`teamTreeClean: true` over `packages/ tests/ scripts/`).
- Host: `639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2, porcelain empty before and after).
- Record: `c2/c2-verdicts-boot1.json` — `u5-run-record/1` via
  `tests/world-factory/lib/run-record.mjs` (`createRunRecord` + `readAuthorityBinding`,
  finalized before write): `overall: PASS`, 7/7 cases PASS.

## Zero family/product change

The family code, the World, the row config and both envelopes are the #404 ones. Only the
drive script changed (`c2/run-c2.mjs`, `c2/u7f-inspect-assembly.mjs`, forked from the
#404 copies). The one blueprint edit removes `team_resolve_control` from the LEADER's
`teamTools` allow list (fixture data), because the approval now comes from the human seam.

## The three #404 FAILs: root cause in the drive script, and the fix

Each cause was measured on the #404 boot-5 capture
(`u7-f-inspect-20261026/c2/mock-corpus.json`, entries 12 and 43), not guessed.

| #404 FAIL | root cause (drive script) | fix |
| --- | --- | --- |
| `u7f:inspect-list` (`transcriptHasProviders=false, ranWitness=[]`) | **The leader fence satisfied itself.** After 12 fence rounds the brain replied `U7F_FENCE_HOLD_<fence>`, and its fence test was "the leader transcript contains `<fence>`". Its own hold reply matched, so the leader went to `U7F_L1_DONE` and answered every later `[team-control requestId=…]` notice with text. That includes the inspect-list ask `ctrl-13zy3130ixp3gi0i0h3rd0ew` (visible in entry 43). The ask was never resolved and the member turn never resumed. | F1: the hold text no longer contains the fence, and the fence is read only from non-assistant messages. D4: strict-lane window raised from 240 s / 20 wakes to 420 s / 60. |
| `u7f:refusal-zero-effect` (`transcriptHasRefusal=false`) | Same stall: the unknown-provider query is the member's step after inspect-list, so it was never issued. | Fixed by F1. The arm now reads the refusal back from the member's `tool_result` and requires zero durable Control rows for it and zero dispatch lines for that provider. |
| `u7f:approval-leg` (`resolveIssues=30, pendingSeenNonEmpty=0`) | **The witness read the wrong field.** The #404 regex ran over `content[].text` of each message. A `team_list_pending_control` result is a `tool_result` block whose text sits at `block.content[].text`, so the regex matched **0 of the 2** real `count:1` listings in the capture. `resolveIssues=30` was also inflated: the counter summed `team_resolve_control` tool_uses over every captured request, and each request repeats the whole history. The final leader transcript (entry 43) holds exactly **one** resolve (the skill ask). The inspect-list ask was never resolved (see row 1). | D3: `pendingListedOf()` parses the real shape `{"status":"pending-control-listed","pending":[{"requestId":"ctrl-…","toolName":…,"status":"pending",…}],"count":N,"truncated":false}`. Checked against the #404 capture, it finds `ctrl-0oknj0q0rt6rw10tf3r1k0jr` (team_skill). D2: approval goes through the human public seam. The runner reads durable Control rows (`team.getLedgerPage`) and resolves via `team.resolveControl` v4, the pattern the u7-f-web C2 used. It resolves only after a leader listing has shown the row as pending. PASS requires, per ask: listed pending, human resolve ok, exactly one `allow` decision fact and exactly one `control-allow-consumed` fact. |

New in this round: `u7f:inspect-query` is an authorized `team_cordis_inspect_query`
positive. The host provider set allows one: `host/Tool.listTools` (input `{}`) is
registered on this host and is read-only.

## Verdicts (verbatim from `c2/c2-verdicts-boot1.json`, runner stdout)

```
[u7insp-c2] human allow ctrl-1yrcks31lsa7hc1lm1xf10zw tool=team_skill ok=true witnessed=true
[u7insp-c2] human allow ctrl-00h15k70s1smku18bwoeh11y tool=team_cordis_inspect_list ok=true witnessed=true
[u7insp-c2] human allow ctrl-1o676580ss2cc1005un0609k tool=team_cordis_inspect_query ok=true witnessed=true
u7f:mounted             PASS  placement-feed rows=[team_skill,team_cordis_inspect_list,team_cordis_inspect_query,…]
u7f:skill-load          PASS  governed-skill RAN name=u7f-demo-skill bytes=144; <skill_content …> read back
u7f:inspect-list        PASS  governed-inspect-list RAN count=4; read back 4 providers host/Service, host/Event, host/Config, host/Tool
u7f:inspect-query       PASS  governed-inspect-query RAN platform=host provider=Tool method=listTools; {"tools":[{"name":"read",…}]} read back
u7f:refusal-zero-effect PASS  "Error: refused-admission inspect-provider-unknown — inspect provider "u7f-no-such-provider" is not registered on platform "host". Available: Service, Event, Config, Tool — …"; unknownProviderLogLines=[]; durableQueryAsks=1 == positiveQueryCalls=1
u7f:approval-leg        PASS  3 asks (skill/list/query), each listedPending=true, humanResolveOk=true, decisions=["allow"], consumptions=1
u7f:leak-check          PASS  secret claim in no corpus / host log; bytes unchanged
DONE overall=PASS pass=7 nonpass=0
```

## Boot budget

Budget = 3. Each boot is declared in `c2/boot-budget.jsonl` before the host starts, and
the runner refuses a 4th. Spent: **1** (boot 1, all PASS). Boots 2–3 were not used.

## Files

| file | what |
| --- | --- |
| `c2/run-c2.mjs` | the runner (drive fixes D1–D4 in its header) |
| `c2/u7f-inspect-assembly.mjs` | World + scripted brain (F1) + `pendingListedOf` (D3) |
| `c2/c2-verdicts-boot1.json` | the RUN record (cited by the acceptance ledger) |
| `c2/boot-budget.jsonl` | the boot declarations |
| `c2/host-boot1.log` | host log copy. The launch token is redacted; the token was dead and its home was deleted at teardown. |
| `c2/mock-corpus-boot1.json` | declared EXCERPT, using the #404 `trim-mock-corpus.mjs` selector. The raw capture is not committed; its sha256 is in the header. |

The World home was deleted at teardown through the ownership marker (receipt in the record).

## Still DISCLOSED / NOT_VERIFIED

- `team_skill` L3-refusal and `team_cordis_inspect_list` L3-refusal remain
  **NOT_VERIFIED**. This round has no live refusal case for either tool; their refusal
  arms are C1-only.
- No live DENY arm for the inspect family. Every human decision in this round was `allow`.
