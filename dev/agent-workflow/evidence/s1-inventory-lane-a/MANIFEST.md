# S1 Lane A · MANIFEST（读过的文件 / 时间盒 / 未做项）

- **Lane**：S1 Lane A 资产 / F0 盘点 owner（root 拆分的独立并行 lane；root agent = `session-2bed8fe0-0507-4ec1-8573-3dfab305d76c`）
- **唯一可写目录**：`dev/agent-workflow/evidence/s1-inventory-lane-a/`（本次全部产出仅此目录内 5 份文件）
- **T_start = `2026-10-24T23:09:56Z`**（开工第一条命令 `date -u +%FT%TZ` 实测）
- **T_end = `2026-10-24T23:22:13Z`**（最后一次 `date -u +%FT%TZ` 实测；时间盒 30 分钟，截止 `23:39:56Z` → **未逾时**，实际占用 ≈ 12 min 17 s）
- 纪律遵守：零写入其它路径；零删除/移动/压缩/chmod；零 git 写（只读 `rev-parse`/`tag -l`/`worktree list`/`ls-files`/`show`）；零 Host/端口/网络/install/build；零全盘 `du`/`find`（只做具名单路径 `du -sk`）；未读任何凭据正文；**未解包、未读任何 `.tar.zst` 内容**；未改 `s1-h0-m1/**`、`s1-h0-m2/**`。

## 1. 本 lane 写出的文件（自算 SHA256，最终态）

| 文件（`dev/agent-workflow/evidence/s1-inventory-lane-a/`） | SHA256 |
|---|---|
| `GAPS.md` | `7ba2b3383947fad14a4c4f705c5345d64d2db27dfb21db5056804bd66b1c13fd` |
| `TOOL-SOURCE-DIFF.md` | `42d70e0b5e87bc20fae0ce8689d76b2deff29b079b8f0d243df9713ec5f5ef26` |
| `RECOVERY-VALUE-INDEX.md` | `65cd575cfc73bdf8554e496ff800ba3eea80643693f0effad04bfa5c8bc16ff7` |
| `SEED-SET-93.md` | `6cb559cfc878709130723ebefb4bbeef3ff39035dcfac2108e7a7c5e0c25d612` |
| `MANIFEST.md` | （自身不含；本表定稿后未再改动其它文件） |

写入面自证：`ls` 本目录 = 恰上述 5 份；仓库 `git status --porcelain` 中**本 lane 只新增 `?? dev/agent-workflow/evidence/s1-inventory-lane-a/`**。同列出现的 ` M dev/agent-workflow/SESSION_ROUTER_LOG.md` 与 `.bteam-*.txt` 等条目**非本 lane 产物**（本 lane 对该日志只读；其 mtime 23:1xZ 属主 Agent 自己的记账窗口）。

## 2. 实际读过的文件（路径 + SHA256，本 lane 自算）

### 2.1 F0 / 清理证据 `.worktrees/.s1-f0-census-20261025/`
| 路径 | SHA256 |
|---|---|
| `F0-SNAPSHOT-20261024.md` | `66f92d058ff9f2f7df0966b5b7f6711592c559e9683130b669460540cd2c9fc4` |
| `du-census.txt` | `74f9017ab6d79040d5d5605aa025a48719029e15d27e2b0bcdaecf814cb4595d` |
| `du-census2.txt` | `367cbba6e1f3c19e51468148104362224102f68fe5ac9f3ea54a6668c17b628c` |
| `du-pass1.txt` | `b9d577154e359e53fa58d4c3b5f760420d88528bb13c39c45de80af2af22e5c2` |
| `du.err` | `8baf124986b69c657f9107386c1ffa2473681731968e0853a184e0ffcfc07321` |
| `gittrees-1.txt` | `469000d2e18a04ed744b756ad1a842b88e891cd92eb246f62962fe43d9ee6cb6` |
| `first-batch-recovery-basis.md` | `93577fddf4ddfc8ce92d5af3f318143e652e0c71e5c4b2a0a9bc1f4c67bc7884` |
| `first-batch-DELETED-receipt.md` | `a9a8274de0463dc9a3b29ae20ffeaf96a492cfa66f82a44cd267575ba1655f22` |
| `RECOVERY-a5m2-pinbuild-node_modules.md` | `78194afe723c0105c5b27e78cc35a7b48aa4a8ba63e315204a97bc557485d55a` |
| `delete-a5m2-pinbuild-node_modules.txt` | `e171f09013577955999042057c9aa43517774b93606ffe2c3eaaf72abb6a69d2` |
| `delete-pack-int-install-0a3f11b2-d703affb.txt` | `9970f73ae26c2039f972cfe4889f871617e15f6792c89fcda65271cf1d696493` |
| `recovered-candidate.install-0a3f11b2.package.json` | `f17e6a0f5d6e60687c1f9038ae60acd5f94011ce597128dcd08d0b353bbfa5fa` |
| `recovered-candidate.install-d703affb.package.json` | `38a5d47d01a7b67f53273286f503f12ae987530b3089d7185debcbdd20a989bd` |
| `verify.mjs.from-install-0a3f11b2` / `verify.mjs.from-install-d703affb` | 两份同值 `6a5b1f76c27012e2e0c7ad9c2ee2a35a3d724afaa3eb3a46da56a30161337647` |
| （仅列目录，未展开内容）`m1-selfcheck-20261024/` | 16+ 个 `.log/.out`；`check_*.log` 6 份为 0 B |

### 2.2 保全目录（只读清单文件；**未解包 / 未读 tar**）
| 路径 | SHA256 |
|---|---|
| `.s1-asset-preserve-q6-20261024/PROVENANCE.md` | `75eb746ec36ffb0689048a51042cd4cbc00be5e125528838c7e32603ee49b16c` |
| `.s1-asset-preserve-q6-20261024/index.sha256` | `686a4abf5025c8aa7ecaa6742eacf78e97f793fc598fc21e0cb79f5a1ca0ae8c` |
| `.s1-asset-preserve-q6-20261024/archive.sha256` | `ac5b04963aabf065adacb32cee62c5b4c50368cea65a42c57903879b7b35f2ec` |
| `.s1-asset-preserve-q6-20261024/source-find.tsv` | `b7a40477a29df75cca4ff73e0a508266b776b1f8baf99e37f14eabe872ffaebf`（= index 记录值 ✓） |
| `.s1-asset-preserve-q6-20261024/archive-list.txt` | `7157a1f32aeaf1b612e9ee7e4343e8127b989233d70374c8f20a22a43f6e3359`（= index 记录值 ✓） |
| `.s1-asset-preserve-q6-20261024/source-baseline-aggregates.txt` | `9a67b7c3e0e821fc983ffff3c211104b8d56db53a026040d6a7ccba7a30bf79e` |
| `.s1-asset-preserve-q6-20261024/meta-diff.txt` | `0830482c74153be8621be32d85801b9c18abc4ff30c14095f7605508b1b1bf2f` |
| `.s1-asset-preserve-q6-20261024/strict-credential-hits.txt` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`（空 = 0 命中） |
| `.s1-asset-preserve-q7-20261024/PROVENANCE.md` | `9a24ce9d9da27890ab7623a20d64ab4c828751a62036b8853b990173c99fd070` |
| `.s1-asset-preserve-q7-20261024/index.sha256` | `21d4282a07e4c8e90eb7e1cb941d4e96b26e187bef08a4150abdb1df230cbe5a` |
| `.s1-asset-preserve-q7-20261024/archive.sha256` | `daca80ca03053e85031aee873ae68c8e63a76cc9f4cf44b3b28866ecc7bd9eeb` |
| `.s1-asset-preserve-q7-20261024/metadata-crosscheck.txt` | `6c0de9dda44cc1e4be795f4601d5951b7d617fdd4c421bd86ff1ee8e275fbf8e` |
| `.s1-asset-preserve-q7-20261024/source-find.tsv` | `36a153d046f3b475ad5f955a47679fc4d754a10eee8a66d98e22ca5c9e5bd124`（= index 记录值 ✓） |
| `.s1-asset-preserve-q7-20261024/archive-list.txt` | `2f7eb0da5149af47211b33cf7198d944e137f0d6756fc2dc1cc765c6eff4c154`（= index 记录值 ✓） |
| `.s1-asset-preserve-q7-20261024/source-baseline-aggregates.txt` / `source-after-aggregates.txt` | 两份同值 `a4f055d34d7a66d63d874218dabc66a4ec35c87cf056e6adff30ab5ef4111e4d` |
| `.s1-asset-preserve-q7-20261024/strict-credential-hits.txt` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`（空） |
| 注：`.s1-asset-preserve-q6-20261024/metadata-crosscheck.txt` | **不存在**（任务把它列在 q6 名下，实测该文件只在 q7 目录；q6 侧对应件为 `meta-diff.txt`） |

### 2.3 恢复包 `.worktrees/.s1-recover-0a3-d703-20261024/`
| 路径 | SHA256 |
|---|---|
| `RECOVERY-PACKAGE.md` | `0fc1c181eec5fe4f3a32c78fbd131bf7e19f4169d96f161b849dd3340a700f4a` |
| `hashes.txt` | `ed6c6a4e0ef9c1130fae1e22833e9e36f5d250716c0dd3f582763357697d4d8b` |
| 仅列目录 | `locks/`(4)、`package-json/`(2)、`work/`(6) |

### 2.4 H0-M1 fixture 与两个 run
| 路径 | SHA256 |
|---|---|
| `dev/agent-workflow/evidence/s1-h0-m1/README.md` | `d67fe24b447961f1bba2957a14764c250673cd1363cee70c5df27f1a939afc9a` |
| `dev/agent-workflow/evidence/s1-h0-m1/inputs.json` | `6204caf376876d726ab8de7421594acc9984d6bdbbd49d7c86a71ba3d18da06c` |
| `dev/agent-workflow/evidence/s1-h0-m1/probe-plugin.mjs` | `c883ac3f80efcfe4a4fe462b137f32cbfc1724fafb0662d19c92848a8618f195` |
| `dev/agent-workflow/evidence/s1-h0-m1/m1-run.mjs` | `4542782e71d2b73b2f54e67c812b4ce945cd9d93fc0312f9dfcd5c882bfb07f0` |
| `runs/s1-h0-m1-20261024T222400Z/summary.json` | `a15226f04913740b726b0baa7b96183197031d36d10882f86439fb17d1ac0100` |
| `runs/s1-h0-m1-20261024T222400Z/steps.jsonl` | `a7736a801bec5ba12034e2ff93752ebf554c4283656234309dbb33431d845b86` |
| `runs/s1-h0-m1-20261024T222400Z/ledger.jsonl` | `35dc2c1217fb88550ee303a7b370fb6580c0477f35ba25c1468c46822548b8ce` |
| `runs/s1-h0-m1-20261024T222400Z/session-transcript.redacted.jsonl` | `46b7a21c9cba7406458b29df29ea9b7ec225963ce30c4d5e70153a4effd68a82` |
| `runs/s1-h0-m1-20261024T222400Z/registration.json` | `f0ac9baa6fd2532113433b437c10bf241bd29cde265546c0eca1e314726f1252` |
| `runs/s1-h0-m1-noext-20261024T225300Z/summary.json` | `0a965136672cb9a4b9556ca2fb41a4a4b43f2854c7a0043cca78ed2e3d3516e1` |
| `runs/s1-h0-m1-noext-20261024T225300Z/steps.jsonl` | `95911c04048b3c76f17f039598d6d468d67b21a07f397c50563864cbf55574dd` |
| `runs/s1-h0-m1-noext-20261024T225300Z/ledger.jsonl` | `e50efe90c03c60cb02a0e342946f144a0b489f1d42896b45644f77ebe095c200` |
| `runs/s1-h0-m1-noext-20261024T225300Z/session-transcript.redacted.jsonl` | `7a9808f36ebf99dbc180ca126ad6c1392b7f449f764e59fb32bb8f492a6904b6` |
| `runs/s1-h0-m1-noext-20261024T225300Z/registration.json` | `0bfb1000ed18ca7f72f72d310615c08d8fa1d8be05ecb4e0e089aafd2a431c51` |

### 2.5 权威 / 协议 / 迁移 / 种子（含 93 账）
| 路径 | SHA256 |
|---|---|
| `dev/agent-workflow/SESSION_ROUTER_LOG.md` | `512702c315e0486fff040c85513ff9f4f6b7c290705118d1134f6690429cd230` |
| `dev/agent-workflow/graph.yaml` | `766f8bf91ecfb65fda2c16ed2d3a816d068191e2da4f82f7f9c40e3c03401cea` |
| `AGENTS.md` | `2248b657544d7a259f2816a24a32ce0fba30f540d186dc3b49571fa8cfdfa87e` |
| `docs/STATUS.md` | `519197d8612004979d3f81ab9ca7797d3b8cd17da09b1eb91c56840fc29c5d41` |
| `docs/ROUTER_RULES.md` | `40afcf019df55e2055109c63aac27f5b853bb4cb0ebf57a9fdd7c67751fb8fec` |
| `docs/TEST_METHODS.md` | `9c8a1602daa38b39089e87120b7266c45435dc3222b26d16931874154e086999` |
| `docs/migration/legacy-behavior-inventory.md` | `0c29b4bd0fe70ebb869f695a18c3e864b2f5804e3974b0b232c95eba2646d7c6` |
| `docs/migration/reuse-map.md` | `bf403101c4a513c910c99f342f03286d2801e0a821b8397eb93e074d20cba9f9` |
| `tests/paths.mjs` | `c0ec639f70e36f2ab42aa196b54dba8ce25476089eb5082cd799d927103479f5` |
| `tests/kits/README.md` | `a41f7438b9c7641d832ccb8b54a0692854e0ba869492d96eeee17ad7a8870ecb` |
| `dev/agent-workflow/evidence/G8-S1/attempt-log.md` | `aa2c54acf5f9076466dfda5167bbce54ebd5c854b193ac4de7cd320c3f4b8bfe` |
| `dev/agent-workflow/evidence/G8-S1/design-note.md` | `efe9f7c3b29ae2de3878685be6e2ea3b11015299a4b0aae6391da3a5a12f6b33` |
| `dev/agent-workflow/briefs/G8-S1-brief.md` | `cb5ee4df4111e711e44e6a4e9565b9c2adce5b3a9605b964e34e9f4405f19917` |
| `docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/**`（经 symlink，真实体在 `.worktrees/a5m2-bmcp/docs/plans/active/…`，该 worktree HEAD `3954d6368cd6fb533c03f20e0017126f1b5880ba` / 分支 `feat/a5m2-b-mcp`，主树 `git ls-files` = 0） | — |
| `…/m0-closure-v3/M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json` | `e1b8b29aae79c5bdcb0ffbada6ab97f21301d446c8b210098e92480fa5b418f8` |
| `…/m0-closure-v3/route-records-v3c.json` | `55233426a022531cb5049587ffb605c5e487608cdcc08004e68509c2e535c929` |
| `…/m0-closure-v3/M0-B-FAMILY-TARGET-CONTRACTS.md` | `1b06c40231c99990a105cdd7837c7725509ca2867a2900144248bcfaa607156b` |
| `…/m0-closure-v3/M0-PLANB-ASSEMBLY.md` | `dc2747ae4265a4e2261853e81db8efcb5b66563d6007800824ce3ef039c46419` |
| `…/m0-closure-v3/M0-A-LIFECYCLE-CONTRACT-v1.1.md` | `208ba98cf0b9ddca91cb34d403f479b6994cf283f4fed04b75e1f40f3cdfb61c` |
| `…/m0-closure-v3/machine-v3/check.mjs`（未运行） | `84d3fdcf2758a488b94489c058092b9641ee1a2ab85ed36d49464e0f50f416f4` |
| `…/m0-closure-v3/machine-v3/route-record.schema.json` | `0620a715f23d4233ebe140aff09f9d28847719be76d83f9f0e0339556414ecb8` |
| `tests/deepseek-harness-test-use/docs/tool-catalog.md`（HTU HEAD `639ed015…` = `dsh-v0.2.0-rc.2`，porcelain 0） | `a273d4152f565c4223bb96dba2b38da7c22be16f5aa0727336b87e501d428b4c` |

### 2.6 回收价值面补测（本 lane 追加实测）
| 路径 | 实测 |
|---|---|
| `recovery/int-restore-pnpm-install.log` | `sha256` 未单列（1,406 B）；正文关键行：`Scope: all 10 workspace projects` + `[ERR_SQLITE_ERROR] unable to open database file`（pnpm 11.7.0 `StoreIndex.openDatabase`）→ 恢复安装**曾失败** |
| `recovery/a5-m2-int-damaged-20261023.sha256.manifest` | 39,708,369 B / **183,973 行** / sha16 `df1bb568a3fae41f`（首行 `./dev/agent-workflow/evidence/a5m2-verify-rsj/run-rsj-c2.mjs`） |
| `tests/homes/.playwright-browsers/probe-about-blank.mjs` | `bb1049fb0298fd23f0bbc9cb89334760e3b25dba4b8dcf97ac064be9940a248a` |
| `…/probe-result.json` | `095ffc16c73d3e4b920e2331a4a9ff7ae54a11962e8a7b5afacc48f49208022d` |
| `…/probe-result-20261001T133832Z.json` | `ab7510f13af7bebe9b253d374fb9c0093e48a0332853125d78f28adb52bd51cb` |
| `…/probe-result-20261001T135149Z-fullaccess.json` | `50bfef769d003e90367b4ea8886d38c05a0d9da912c0b023a2df51774217fd01` |
| `…/probe-console-20261001T135149Z-fullaccess.log` | `9c61192ccfecde9b8d67e2821f1cd8de36f2ec69f0d216a2501b5fd9fdd49d19` |
| `…/a5m2-c2-r15-…/storages/team_domain.json` | `3c96ee1c1104cf758a06233d68f8e326fd032d34797d120080aa69c9c81280c7`（25,092 B） |
| `…/a5m2-c2-r15-…/storages/workspace.json` | `8332e072a55f6c6ac287e41ac1a57640d630c2143cd55eeba907a3a33fb3240e`（227 B） |
| `…/.playwright-browsers/{chromium-1228, chromium_headless_shell-1228, ffmpeg-1011}` | 单路径 `du -sk` = 388,076 / 267,528 / 5,016 KiB |

### 2.7 只读存在性 / 计数探测（未取内容，无 SHA）
`.worktrees/a5m2-wire-g1/tests/deepseek-harness-test-use`(**GONE**)、`.worktrees/a5-m2-int/tests/deepseek-harness-test-use`(**GONE**)、`.worktrees/a5m2-pinbuild/node_modules`(**GONE**)、`.worktrees/pack-int/install-0a3f11b2`(**GONE**)；`references/`(**不存在**)；`git worktree list`=48；`tests/homes` 条目 549（含隐藏 562）；`.worktrees/` 54 可见 + 16 隐藏目录。

## 3. 逾时未做的具名项（明确登记，未做 = 不做成"已完成"）
1. **`RECOVERY-VALUE-INDEX.md` 的"可再生性"三列仍有 UNKNOWN**：`tests/homes` 两个 world、`.playwright-browsers`、`recovery/a5-m2-int-damaged-20261023` 的再生产路径均未闭合（时间盒内未展开 `recovery/` 的 39,708,369 B manifest，也禁做逐 world 普查）。
2. **93 账的校验器未运行**（`machine-v3/check.mjs`），因此 §SEED-SET-93 只交付哈希自洽 + 计数，不交付"校验通过"。
3. **Q6 归档未做本体 SHA 复核**（禁读 tar 内容）；只复核到清单层（4 份清单与 `index.sha256` 逐条一致）。
4. `dev/agent-workflow/evidence/s1-h0-m1/inputs.json` 只读了 `host/budget/NOT_OBSERVED/not_claimed/route` 五个顶层键，其余 13 键（含 `fixture_files_sha256`、`copied_helpers`）未逐项展开核对。
5. `docs/plans/paused/` 实测只有 4 份 2026-alpha.1 文档，**AGENTS.md 所称 20260829 冻结四份（Architecture / UI / Development Plan / Task Decomposition）不在该目录**；本 lane 未在时间盒内继续追查其下落（只登记，不动权威文档）。
