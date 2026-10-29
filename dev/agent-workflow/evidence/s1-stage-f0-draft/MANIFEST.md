# S1-stage-f0-draft MANIFEST — 版本戳 2026-10-25T00:13:53Z（**非签发清单**，只证明本 rev 的字节与所指锚件）

本目录件：

| 件 | 行 | sha256 |
|---|---:|---|
| `F0-DRAFT.md` | 75 | `dcaaff9728dbbebddd722677fe543d7f434e59357cbc3e47660a819db8fafbe8` |

所引锚件（复用，不复制、不重扫；sha 为本清单生成时实测）：

| 锚件 | sha256 |
|---|---|
| `.worktrees/.s1-f0-census-20261025/gittrees-1.txt` | `469000d2e18a04ed744b756ad1a842b88e891cd92eb246f62962fe43d9ee6cb6` |
| `.worktrees/.s1-f0-census-20261025/F0-SNAPSHOT-20261024.md` | `66f92d058ff9f2f7df0966b5b7f6711592c559e9683130b669460540cd2c9fc4` |
| `.worktrees/.s1-f0-census-20261025/du-pass1.txt` | `b9d577154e359e53fa58d4c3b5f760420d88528bb13c39c45de80af2af22e5c2` |
| `.worktrees/.s1-f0-census-20261025/delete-pack-int-install-0a3f11b2-d703affb.txt` | `9970f73ae26c2039f972cfe4889f871617e15f6792c89fcda65271cf1d696493` |
| `.worktrees/.s1-f0-census-20261025/first-batch-DELETED-receipt.md` | `a9a8274de0463dc9a3b29ae20ffeaf96a492cfa66f82a44cd267575ba1655f22` |
| `.worktrees/.s1-f0-census-20261025/RECOVERY-a5m2-pinbuild-node_modules.md` | `78194afe723c0105c5b27e78cc35a7b48aa4a8ba63e315204a97bc557485d55a` |
| `.worktrees/.s1-asset-preserve-q6-20261024/PROVENANCE.md` | `75eb746ec36ffb0689048a51042cd4cbc00be5e125528838c7e32603ee49b16c` |
| `.worktrees/.s1-asset-preserve-q7-20261024/PROVENANCE.md` | `9a24ce9d9da27890ab7623a20d64ab4c828751a62036b8853b990173c99fd070` |
| `dev/agent-workflow/evidence/s1-inventory-lane-a/RECOVERY-VALUE-INDEX.md` | `65cd575cfc73bdf8554e496ff800ba3eea80643693f0effad04bfa5c8bc16ff7` |
| `dev/agent-workflow/evidence/s1-inventory-lane-a/F0-SOURCE-SET.md` | `281e140e9c212d45c0dea4acb7536a41d7d8f23c1331c743c1fd4fcdee6e5075` |
| `dev/agent-workflow/evidence/s1-inventory-lane-a/G1-I-MIN-TASKS.md` | `cfe0da6a0d968502c510f7669e0178de070a2cce30163e208d4114256ac4fda8` |
| `dev/agent-workflow/evidence/s1-m0-closure-v3-seeds/MANIFEST.md` | `ec05902e6e9b9ba4575382280daae0f2675f8bd5f6c346eed39222fd38f328f0` |
| `dev/agent-workflow/evidence/s1-h0-m1/m1-run.mjs` | `4542782e71d2b73b2f54e67c812b4ce945cd9d93fc0312f9dfcd5c882bfb07f0` |
| `dev/agent-workflow/evidence/s1-h0-m1/probe-plugin.mjs` | `c883ac3f80efcfe4a4fe462b137f32cbfc1724fafb0662d19c92848a8618f195` |
| `dev/agent-workflow/evidence/s1-h0-m2/m2-run.mjs` | `ef2bf20f30c1463862fa19500908d1d76500dd48a2b17f1edbeec7cbdc5a766b` |
| `dev/agent-workflow/evidence/s1-h0-m2/probe-m2-plugin.mjs` | `03d36a895cea8336a75dee4e4f67bdf1f4d252af29c1a35bbb1cab1169a0ea1b` |
| `dev/agent-workflow/evidence/s1-h0-m3/probe-m3-plugin.mjs` | `181fc9a73fc77151f8bb3c232dc3778c9109366869e62403a834cb10c5cf57a3` |
| `dev/agent-workflow/evidence/s1-h0-m3/m3-run.mjs` | `d581e559656be4729a81f91888a63be727af6d0d405ab0fc7f80c127b05ed677` |
| `dev/agent-workflow/evidence/s1-h0-m3/selfcheck/oracle-selfcheck.mjs` | `c2a1e33a993fd84b7d957bf9519d8d36afa80f52968ff141aa88790d9e978c85` |
| `dev/agent-workflow/evidence/s1-h0-m3-safety-determination/SAFETY-DETERMINATION.md` | `29ec16cda74f3e8256c1e3e6f9b4d2891330c96acf2850a4eca5b7d2b5497537` |
| `dev/agent-workflow/evidence/s1-frozen-refs-index.md` | `c908e390cc773c044f034c62030e7dce8941918663cbed6c22e5388673733e58` |

三锚（命令实测，非记忆）：`origin/master` = `4aaaa7b2af87f80a0fae62d9c8d9cf03d5a6fd84` ｜ PR363 计划 = `1310b959595b211e5da7a5f727dadf522f79d60b`（只 `git show`）｜ HTU HEAD = `639ed015397290b3745d163aafe02ffee4aa3f84` 且 `git tag --points-at HEAD` = `dsh-v0.2.0-rc.2`；本地 master `6259cf4bc4d61af74d84bbd9d265184f95493172` = 历史漂移。

聚合（相对路径法：`cd <dir> && find <rel> -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum`）：本目录**内容件**聚合（**排除本清单自身**，否则自指不可复现）= `f238d9368454d7e586898e256b8176148538ac80e6434b46c67ccf9ca422c09a`；93 种子副本（63 文件）= `81102fae614b16521c30717c3122fce6791c66f3c04b901e7e9bb61ab207c657`。

状态：**DRAFT / 未签发 / G1-I 未过**。写面 = 本目录两文件；`current` / `graph.yaml` / PR363 三计划 / Lane A 与 M3 文件均未触碰。**未知资产保持具名 owner + 保护；未判定任何对象可删。**

> 勘误（登记于账本）：首版把目录聚合写进清单本身 —— 先有重定向建的空件、后有内容，且任何后续更正都会改变聚合 ⇒ **自指聚合不可复现**，两次值（含空件版 / 更正后再算版）均作废；以"排除本清单"的聚合 `f238d9368454d7e586898e256b8176148538ac80e6434b46c67ccf9ca422c09a` 为准。教训：**清单不得自指未定稿聚合**；本清单自身的最终 sha 由账本记录，不由自身记录。
