#!/usr/bin/env bash
# A5M2 EDIT/SRE host-window prep — 01 PACK SEQUENCE (WRITTEN, NOT EXECUTED).
# pack 唯一 owner 另派（避免双跑）。本 lane 在准备轮零执行；窗口 owner 逐段执行。
# 组合单 SHA 写死（README §1）：
set -euo pipefail

COMPOSED_SHA=161e4cd38185e0b6280a8d530ab07fbd7f9fba8c   # 现 int 头（ls-remote 实测于准备轮）
REPO=/srv/workspace/dsh-plugins/dsh-agent-team          # 主仓（worktree 外正主）

# [1] 取组合树（只读 fetch + 校验对象存在；不改任何工作树）
git -C "$REPO" fetch origin feat/a5-m2-integration
git -C "$REPO" cat-file -e "${COMPOSED_SHA}^{commit}"

# [2] pack：复用既有 9c 打包链（kit 资产，本 lane 不复写/不修改）。
#     产物形 = install-<sha>/package/packages/runtime/dist/packages/runtime/src/plugin/host.js
#     + glueUrl(live/agent-bindings.mjs) + seamUrl(root-binding/harness/seam.mjs)，
#     同 dev/agent-workflow/evidence/a5m2-g3-host-scenario/README.md §1 装载形。
#     执行入口 = 既有 pack/install 流程（tests/kits 现网的 install-<sha> 步骤）；
#     此处只钉步骤，不重写命令。

# [3] pack 产物核验（清单在场即 RC0；非空判定按脚本自身协议）
node "$REPO"/scripts/check-install-manifest.mjs   # owner 在 pack 目录上下文执行

# [4] 登记：pack 目录名 + 其内 dist 两臂 blob 复核（必须等于 source 同 blob）
#     git -C <install-tree> hash-object packages/runtime/dist/.../governed-families/edit.mjs
#       == 5a6db608a4043793e8569998bbe1c8fa5a0695be
#     git -C <install-tree> hash-object packages/runtime/dist/.../governed-families/sre.mjs
#       == 6a1ec67f062dd77ee7110a6d4d6e3781376f4f35

echo "pack-sequence: steps only — this script must NOT run in the prep round" >&2
