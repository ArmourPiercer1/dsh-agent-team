# A5M2 lane status matrix — center current pointer (root 21:46 normal maintenance)

四档 ONLY：未开发 / 未接线 / 接线未测 / 已测试。"已测试" requires official full gates + real-Host evidence — NO lane has it.
Integration tips: **signed-source SHAs and center merge SHAs listed separately**. int tip `8522031e698cec9ea6062be92aa4bec35b87875e` (test-only lint fix atop the pack source). Canonical rootpack source = `874f3ae0d6aa62071ee99897c5a5154bcac004f2` (tgz sha256 `eda06b4a…1cd09d`, content receipt + PACK-RECEIPT in `.worktrees/pack-int/out-874f3ae0d-20261023T213601Z/`). 官方 CI 非全绿口径不变.

| lane / family | tier | signed/candidate SHA (branch) | in integration? | C1 vs PA-double vs real-Host (separated) |
|---|---|---|---|---|
| B-SESSION-QUERY (G6) | 接线未测 | `94ad60591` (feat/a5m2-wire-g6; evidence tip 2f1d40518) | **必要 prod 增量已合** int `874f3ae0d`（源签 SHA 与合流 SHA 分列；非全树覆盖） | C1 = lane vitest fixtures; PA ledger pairing = existing surfaces (kit prep doc); real-Host = NONE (window unruled) |
| B-SCHEDULE | 接线未测 | prod = int-landed (a66f50886 spec-only-delta; lint fix `39b9443df` picked → int `8522031e6`) | prod **in int**; kit tip `9e227c689`+PIN `39b9443df` (feat/a5m2-wire-schedule) | kit C4 PA = **service double** (lane-disclosed); real PA proof pairing untested; real-Host = NONE |
| B-IMAGE | 接线未测 | image line `70a30f670`/pack b999 (feat/a5m2-imgverify); OVERLAY-18 kit `4be79cd5…`@`b9bcc262f` | NOT in int (pack/pins only; frozen image stays bf4, 不混) | latest legit control = **over-cap honest refusal** (RC2, non-normalize, per root 21:41 — NOT a product bug); old rc.1 over-limit evidence kept |
| TERMINAL (G3) | 接线未测 | chain `6ede19e23`→`de8e6c81b`→`145f6154a` (feat/a5m2-terminal-open) | NOT in int | live-snapshot spec world = fixtures; **两用户裁决未答**: backend 读法 (i)/(ii); terminal_open enablement（结构性 fail-closed，禁生产开） |
| BROWSER (G2) | 接线未测 | chain `e37254a57`→…→`479e2994d`→`9f15e88b8` (feat/a5m2-wire-g2) | NOT in int | r26 approval = kernel REAL consumedProof shape-check; C1 = plane fixtures; final-PA-producer pairing = B-BROWSER adjacent (other boundary); B-BROWSER 闭表 = root-dispatched next |
| B-SUBAGENT trio | 接线未测 | table `fbebc3c52`(+4e96decc6 corrections, feat/a5m2-family-rules); spawn `c206fd737` rev2; controls `9de5a097d` rev3 | NOT in int (三方联合候选组合验证 = center next, per root 21:45/21:20 授权) | spawn mount spec = first end-to-end ADMITTED walk but fixture-world; no joint claims until table in combined tree (fail-closed pinned both lanes) |
| B-TEAM (Team) | 接线未测 | read-source `1eb278c37`; center merge `4ea06e4c4`; **paired batch `304deb368`** (six adds+rev2+(g)-flip one commit) + mirrors `1cc605549` drift=0 | read-source NOT in int; merge commit on lane branch only | NOT in int; 候根 source 审 (resolve/VALUE/复核); family-rules-c1 21/23 = pre-registered landing-time re-anchor; **binds=FULL-VALUE law**: fact-source prose never rides a bound literal — route to B-SUBAGENT groups at review; 144/144+tsc+eslint0
| B-CONTROL/G1, AUTH, checker | 接线未测/landed | g1 fix 87/87 `942b0d1a5`; AUTH picks; checker `833e261da` | **landed** int (705742ad5…874f3ae0d chain) | local gates only; official CI still not-all-green |

维护纪律：不新审计体系；此表每轮只按已有材料更新；历史 PR 不顶当前。
