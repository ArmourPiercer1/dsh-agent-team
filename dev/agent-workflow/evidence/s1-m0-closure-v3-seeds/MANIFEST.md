# MANIFEST — S1 独立证据副本：m0-closure-v3 PROPOSED 种子集

> 状态地位：**已定位的历史 PROPOSED 种子**（`targetStatus` 全部 `PROPOSED_NOT_IMPLEMENTED_NOT_ACCEPTED`）。
> **不是**当前冻结契约，**不是**实现完成证据；本副本**未把 PROPOSED 改为 FROZEN**，未改任何 `status` 字段，
> 未切换任何 `current` 入口，`machine-v3/check.mjs` **未运行**。

## 来源（逐字实核）
- 工作树 `.worktrees/a5m2-bmcp`，branch `feat/a5m2-b-mcp`，HEAD **`3954d6368cd6fb533c03f20e0017126f1b5880ba`**，该子树 `git status --porcelain` 干净。
  （更正：此前一处报告写 HEAD `64d258e8…`，该对象在本仓 **不存在**，作废。）
- 源子树路径 `docs/plans/active/alpha5-tool-io-governance/m0-closure-v3`，经 `.worktrees/current` 符号链接指向。

## "93" 与文件数的区分（重要）
- **93 = 记录条数**：`route-records-v3c.json` 的 `records` 数组长度 = **93**；`M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json` 的 `counts = {records:93, uniqueNames:90, families:27}`。
- **63 = 文件数**：该子树磁盘文件 **63**（顶层 5 + `machine-v3` 子树 58），与 `git ls-files` 计数一致，untracked 0。
- ⇒ "93 条种子" 由这 **63 个文件**承载；两者不可混称。

## 复制与校验
- 复制方式：逐文件 `cp`（保留子树结构），本目录 `0700`、文件 `0644`（**与源侧同为 0644**；源侧权限分布实测唯一值 644）。
- 逐文件 `sha256sum` 比对：**63 个文件，失配 0**。
- 聚合摘要（`find -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum`，**不含本 MANIFEST**）：
  源与副本相同 = **`81102fae614b16521c30717c3122fce6791c66f3c04b901e7e9bb61ab207c657`**

## 逐文件 sha256（副本侧）
```
  208ba98cf0b9ddca91cb34d403f479b6994cf283f4fed04b75e1f40f3cdfb61c  M0-A-LIFECYCLE-CONTRACT-v1.1.md
  1b06c40231c99990a105cdd7837c7725509ca2867a2900144248bcfaa607156b  M0-B-FAMILY-TARGET-CONTRACTS.md
  e1b8b29aae79c5bdcb0ffbada6ab97f21301d446c8b210098e92480fa5b418f8  M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json
  dc2747ae4265a4e2261853e81db8efcb5b66563d6007800824ce3ef039c46419  M0-PLANB-ASSEMBLY.md
  2e62170474c3c4f0a709b626ddc24a68fe2e4e91597b5b75eb06810589ab88c9  machine-v3/README.md
  84d3fdcf2758a488b94489c058092b9641ee1a2ab85ed36d49464e0f50f416f4  machine-v3/check.mjs
  9ff4118aadc73a4737496b3590ef4291f914394e23b6d8d7d1af72069f266d30  machine-v3/contract-candidate.d.ts
  4133cd3578f7cb9449c95fd1e4180f659835943844ece400d270d4290834a254  machine-v3/coverage-keys-expected.json
  ff0736de57d8c55ab05dc2d8449afb74875f1f41c7f4398558fc77af7f3e4f93  machine-v3/eff-vocabulary.json
  07009165159afab18ce80a08c7464e1d307f319fa634bd54190950e2cd58f47e  machine-v3/error-priority-closure.json
  061b3f7581374d9fc48ae8dc635eccca053b8d98fce5f7f0dea608b937e16a68  machine-v3/examples/neg-allallow-consumption-proof.json
  065cbc07f37b9b4052651a1557376ce1d3482a52e8cf6c0cc2b4794d51c16ff8  machine-v3/examples/neg-allallow-fake-durable.json
  93f3bd043c31817cb330416d5fc4d2d7cd4d3f7d856eb9b9850ee514a807759f  machine-v3/examples/neg-allallow-fresh-cancel-missing.json
  692d680a151c9a90db8eccfe2f27dd1f82b6c7635e3ff903c1ebefd165316d3a  machine-v3/examples/neg-allallow-fresh-cancel-null.json
  4cd6d5a113b407e3f1ecc3ad1d1b55554e557c7fa4f3a3ac9d5e8aaea35581c3  machine-v3/examples/neg-allallow-fresh-rev-false.json
  79cfbf5cb58e4eae33b9cb25481dc6026869878f9e815dcf3cacfc6a574e7686  machine-v3/examples/neg-ask-contains-alladmitted.json
  60bfc5f61154027457e52b67f5f0a110566d6574694aa163a0e2c916bfbda76d  machine-v3/examples/neg-ask-decision-deny-verified.json
  df9cc5314cb2b0d8913c6b543e311e947653c751a838e9c7b671984d73334e76  machine-v3/examples/neg-ask-decision-missing-verified.json
  082f5e2abcf7cb663ff86ccf8a363d3b0a0758b6e58a5710a0c0faeb39aafd63  machine-v3/examples/neg-ask-prepare-without-reserved.json
  baba555ccc3cbc538fbe12e77a5b39a92961161a0f36361d5d4c2b10fc66c2d7  machine-v3/examples/neg-bad-acc-enum.json
  af23bd53109d48e15c79be1d1c349e706923abfbfc957f6b74e4abda335bbb1e  machine-v3/examples/neg-body-jump-skip-admission.json
  7e45aeabe0f78e7719de6af7bb104aa1b40d284fec6c49f66a2de30e432c2e6a  machine-v3/examples/neg-cancel-after-consume-unchanged-claim.json
  7f3fa41ee6b2382906b3c41e2a6c1cd1c6bcf5314e146dcd00f85fea989d8b08  machine-v3/examples/neg-cancel-terminal-body-started.json
  bd7567254268d39435a9c8eb73ce223fa66321e3ff9779d5cd8a3b7a94c02b26  machine-v3/examples/neg-ceiling-missing.json
  b233e1e94c2bebb72de17b5556d3c1e306e58eacb54489de5ac6235198692dbe  machine-v3/examples/neg-cold-recovery-grant-reuse.json
  11adc3b2172cdc6b8a795e0bc3be26230cfc6c2c81d314e07b2d2ff58496ebc7  machine-v3/examples/neg-consumption-decision-mismatch.json
  fc6244bfe87580cb82cbf02ac9f74acf1cab157a8b506c6b5dee0a72b517879e  machine-v3/examples/neg-cross-call-request-carry.json
  a4bf6d3707c64da23b73b3aaa60c264234bd18b17ce8a653713d664f09af2065  machine-v3/examples/neg-eff-unknown-token.json
  030918612b99ed2184952117dc77e7d50dfa11f7bf1da49e2ddfe3d962cc7fcc  machine-v3/examples/neg-gen-drift-at-dispatch.json
  2cefeb190b92bb8bb1eebdee5a4b72ecf84cccd30d911e70cd809ba1fd0fb2be  machine-v3/examples/neg-grant-fingerprint-absent.json
  3c8276023f45d0a78d61836fd8b7dc740cc4ad8631564fcecd404cf962d00293  machine-v3/examples/neg-grant-fingerprint-mismatch.json
  18b84c3dc7026386283ec89cfe7a1749c70e73996fb6209ccc9febd30b33466f  machine-v3/examples/neg-grant-issuedto-missing.json
  a122d72e67fa6f3472e3e3e882c333c4520fd6197dcf56dfed086f7600349989  machine-v3/examples/neg-hosttoken-null.json
  489574cc89787b305b2361ed663eabac65bc27e1ee8389d13ce5bddf3207f33d  machine-v3/examples/neg-lease-consume-grantid-swap.json
  6625a9c3d2671e8cb07e308ff45671cbba483fb726452e6aaca14f16ad0d923f  machine-v3/examples/neg-lease-fresh-cancel-missing.json
  55415bb990cde591b278ea351af2bf4a2ad95a03fb68eec063993cf7e91155f8  machine-v3/examples/neg-lease-fresh-cancel-null.json
  0417b5be7880d42275e2ac9cc3cef4d461bc915385e4eb893ca5704079e75230  machine-v3/examples/neg-member-empty.json
  b22592be0ded9ed64f38ed7bd085eab871d1788e0cdd83311037c5be04a8adca  machine-v3/examples/neg-missing-scope.json
  d1d71b1cbb93fdbb588d2d3e4456b8f68cfb3d70ca3402d6c5df0ccce2556413  machine-v3/examples/neg-na-on-tool-name.json
  ace8dced546df0652ce1312483f8a495ddb3e460b69bc400b16ef704e86a13af  machine-v3/examples/neg-nonstring-route.json
  f45c402f73e3251f272523be1bfa23e6b618cbe939439e709fd6f8d326e925c4  machine-v3/examples/neg-ownlayer-bidirectional.json
  fd7404f8a4c4aac02535d464d789c90ac63bb6497070ac3dd65a53ebbc0a0824  machine-v3/examples/neg-prepare-failed-pa-consumed-claim.json
  90ca48bf02015e1b71852c0fc84b4ff53bcc16ae1c752f3d26088b91d73deab1  machine-v3/examples/neg-prepare-failed-pa-ledger-claim.json
  9a8e5ddb6b0365714a5279f4afeb0e6f7b61e281d8ed937ee95938c3c25219a4  machine-v3/examples/neg-realmid-empty.json
  e9471cdfae806aeae4d162aa7d2a782e812a559cdc01fe751b8b77b21af12046  machine-v3/examples/neg-replay-durable-reserved.json
  c59c8f6de663dd339684217b6eef4ad5dd77993d100f7963e22f39debe63c2ab  machine-v3/examples/neg-replay-pa-consume.json
  1ba9deda7de9b6764d156e956dd0527465e9ebe524ab66d22f3d44b616f876a3  machine-v3/examples/neg-single-state-only-settled.json
  ceeadcffd228b460d843a879613f355f22dcf4629e1c11d0de11ed199f70fc02  machine-v3/examples/neg-terminal-mismatch.json
  3002965d8e982276ab711a9e4182d6d8f5a23dfa0959decfde6b949779d3bb13  machine-v3/examples/neg-unknown-state.json
  6f22de81b4d9b0f4c364fe94528472e31043d15fe6bcbb8e60532d4e73670eee  machine-v3/examples/pos-allallow-settled.json
  897f9a1eaad85e899bc9d92f27138d2b8985ac5786856be17cf46eab66f59fc9  machine-v3/examples/pos-ask-settled.json
  95190546a4e0c4ddfd260a80b452930e7102e9bc6e688abb7ad7cc09af0a8f1e  machine-v3/examples/pos-cancel-at-ask-wait-no-decision.json
  71f7dc966fd024be6f7da6e5fbc55608a4010fcf8ff2e9730ed694b0c3c8cbf3  machine-v3/examples/pos-cancel-before-pa-consume.json
  0da09ef9fd67c42a43097d073b0da91c5245a26ea2d7eef016597d126a9f1489  machine-v3/examples/pos-lease-unconfirmed-pa-consumed.json
  cb5e8000f1e6fe558a5d3080bf34485af681eac9fd784b8ee3adac1f4540a7cd  machine-v3/receipts/keyset-probe/mutated-records.json
  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  machine-v3/receipts/run6-probe.err
  22807c7cb0ec17c37e50f8c7eb8160ae65e0d0120c2e2bc1090e73cfa5172647  machine-v3/receipts/run6-probe.meta
  bbdc7cf15c364994f05a833cf4c2e58b971ec9fef1b5abb054efbc5d9da16818  machine-v3/receipts/run6-probe.out
  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  machine-v3/receipts/run7.err
  de3b93f1b021a771b9def3b2d3c2b76e2e66868c25ae98d740b73aa72a602d32  machine-v3/receipts/run7.meta
  38f9932b39d986bdb89ead1c2a8175a96d686a5db2f748e8fec61abe5d6d7992  machine-v3/receipts/run7.out
  0620a715f23d4233ebe140aff09f9d28847719be76d83f9f0e0339556414ecb8  machine-v3/route-record.schema.json
  55233426a022531cb5049587ffb605c5e487608cdcc08004e68509c2e535c929  route-records-v3c.json
```
