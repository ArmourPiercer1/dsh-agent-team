# 清源可 boot 收据（root 01:33Z ② 选择支一：真人世界自含，源可删）

流程（单次会话内按序）：
1. 真安装世界 17MB 整copy → scratch 根（`clearsrc/homes/candidate-install-clearsrc`），scratch 状态文件指过去；
2. `human-world.mjs init`（scratch --state/--homes）→ `WORLD=` 行给出真人世界（`init.out`，含 deref 审计行）；
3. **`rm -rf` 源安装世界**（scratch 内）；
4. 真人世界 `--check-config`（源已不存在）→ **rc=0**（`check-aftersourcegone.out`：三路径全在真人世界内，launcher sha 对状态记录）；
5. 真 boot：boot 行（`boot.log`，token 脱敏）+ 无鉴权 **401** + token 面 **303** + 按 PID kill（`token-gate.out`）。

结论：真人世界**不依赖**自动清理面的任何活体（symlink 在 init 全量 dereference 成字节副本，
`find -type l`=0；无其他活体引用被 boot 实证）——**源可删成立**，无需"源不可删"告示。
