# Erratum（dated，§8.5.5 式；原文照留不改）— 2026-10-31T03:4xZ

`PRE-REGISTRATION-BOOT2.json` 的 `registeredAt` 字段值 "2026-10-30T03:20:00Z" 为**伪值**（晚于其自身 commit 02:49:18Z 与 boot#2 工件 02:49:28Z，且日期漂移一天）。R472-fl P2 发现，复审席复核：证据绑定不受影响（pre-reg commit 即 boot#2 绑定头 604f9d585，git 祖先+时序证据独立成立；任何判级不引用该字段）。原文件按证据绑定律**不回改**；本条为唯一更正载体。boot#2 保留池消耗的 NOT_REACHED-类读法已由协调者在 #472 清偿中 dated 批注（用户裁决池 #449≤2 之内，未扩池）。
