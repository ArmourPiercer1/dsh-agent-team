#!/usr/bin/env bash
# =============================================================================
# user-side-acceptance-script.sh — 用户普通 SSH 验收 PR-D + tracked PRF
# =============================================================================
# 性质 / 诚实边界（必读）：
#  - 本脚本由 agent 侧编写，**未经任何用户侧实际运行验证**；不承诺成功。
#    预期值仅来自 agent 侧同 kit/同参数的已记录运行（见文末 EVIDENCE 指针）。
#  - 设计目标 = 在用户普通 SSH 上下文（比 agent 会话少一层 harness wrapper）
#    运行 tracked kit，补齐 agent 侧环境阻塞的 3 条真实 bash 侧效腿：
#      PR-D C1 / C2a（marker 文件侧效）+ PRF G6（300KB spill → durable fact）。
#  - **绝不触碰 :3080 / :3180**（kit 自身 H1 腿只做只读 pre==post 观测）；
#    不修改任何 prod/模型/内核/容器/安全配置；kit 自宿主（3180 族端口 +
#    tests/homes/<stamp> + 自带 mock model）。
#  - 每条 kit 运行显式捕获 rc 并持久记录（不设全局 set -e 跳过后续步骤）。
#  - worktree/logdir = 本次 mktemp 唯一路径；不删除任何已存在目录；
#    cleanup 只清本次运行创建物。
# 用法：
#  - PIN_SHA 必填：#51 分支（test/kits-stable-probe-consent-fix）已推送并
#    用户核定的最终 commit SHA（40 位）。脚本拒绝在 PIN_SHA 与 fetch 结果
#    不一致时继续（不用漂移 FETCH_HEAD 当审定身份）。
#  - 依赖：node >= 24、pnpm、git、curl、ss（VM 既有）。
# =============================================================================
set -uo pipefail   # 刻意不用 set -e：每步显式处理 rc（见下）

# ── 必填 pin（push 后由用户/agent 核对填入；留空 = 拒绝运行）────────────────
PIN_SHA="${PIN_SHA:-}"
R=/srv/workspace/dsh-plugins/dsh-agent-team          # 已证实的外层真实路径
BRANCH=test/kits-stable-probe-consent-fix
TEST_USE_SHA=46a7f68b0922371ce7144b668b90e377d8e799f4   # 0.1.7-rc.1 基线 pin
TEST_USE_REMOTE="${TEST_USE_REMOTE:-https://github.com/deepseek-ai/deepseek-harness.git}"

[ -n "$PIN_SHA" ] || { echo "FATAL: PIN_SHA 未提供（push 后核实填入 40 位 SHA）"; exit 3; }
[ -d "$R" ] || { echo "FATAL: 仓库路径不存在: $R（先运行定位命令）"; exit 3; }

# ── 本次运行唯一路径（mktemp；不触碰任何已存在目录）─────────────────────────
RUNDIR=$(mktemp -d "/tmp/dsh-acceptance-$(date -u +%Y%m%dT%H%M%S)XXXX") || { echo "FATAL: mktemp 失败"; exit 3; }
LOGDIR="$RUNDIR/logs"; WT="$RUNDIR/worktree"; mkdir -p "$LOGDIR"
meta() { echo "[meta $1] $*" | tee -a "$LOGDIR/meta.log"; }
meta "run dir = $RUNDIR"
meta "PIN_SHA = $PIN_SHA"

# 收尾：只清本次创建物（用户可在验收后删除整个 $RUNDIR；此处保留供检）
cleanup_note() { meta "本次运行创建物 = $RUNDIR（worktree + 日志）；确认归档后可整体删除"; }
trap cleanup_note EXIT

# ── 0) 定位 + 身份核对 + 同参数 probe（fast，零侧效）────────────────────────
meta "repo HEAD (main worktree) = $(git -C "$R" rev-parse HEAD)"
git -C "$R" fetch origin "$BRANCH" || { meta "FATAL: fetch 失败"; exit 3; }
FETCHED=$(git -C "$R" rev-parse FETCH_HEAD)
meta "fetched tip = $FETCHED"
if [ "$FETCHED" != "$PIN_SHA" ]; then
  meta "FATAL: fetched tip ($FETCHED) != PIN_SHA ($PIN_SHA) — 审定身份不匹配，拒绝继续"
  exit 3
fi
meta "identity OK: fetched == PIN"

# probe = test-use 宿主 sandbox 后端自检的同一 argv（sandbox-local/src/index.ts L70 原文参数）
if bwrap --ro-bind / / --dev /dev /dev 2>/dev/null; then :; fi   # (占位，防误读)
bwrap --ro-bind / / --dev /dev --unshare-pid --proc /proc --die-with-parent -- true
probe_rc=$?
meta "backend probe (同参数) rc=$probe_rc"
[ "$probe_rc" = "0" ] || { meta "FATAL: 同参数 probe 失败（rc=$probe_rc）— 与 agent 侧观测矛盾，停止"; exit 4; }

# 可选恒等 uid_map 形态自证（推断性检查，失败不阻塞；观测记录）
unshare -U sh -c 'u=$(id -u); echo "$u $u 1" > /proc/self/uid_map && echo IDENTITY_MAP_OK' 2>&1 | tee -a "$LOGDIR/meta.log" || meta "identity-map probe 失败（非阻塞；仅记录）"

# ── 1) 隔离 worktree @ PIN_SHA + 依赖 ───────────────────────────────────────
git -C "$R" worktree add --detach "$WT" "$PIN_SHA" || { meta "FATAL: worktree add 失败"; exit 3; }
cd "$WT" || { meta "FATAL: cd worktree 失败"; exit 3; }
pnpm install --frozen-lockfile > "$LOGDIR/01-pnpm-install.log" 2>&1
rc=$?; meta "pnpm install rc=$rc"
[ "$rc" = "0" ] || { meta "FATAL: pnpm install 失败（日志 $LOGDIR/01-pnpm-install.log）"; exit 5; }

# ── 2) test-use pristine @ pin（gitignored，fresh 检出必缺）────────────────
if [ -e tests/deepseek-harness-test-use ]; then
  meta "FATAL: tests/deepseek-harness-test-use 已存在 — 本脚本不覆盖/不盲删已有目录；请人工确认后重选 RUNDIR"; exit 3
fi
git clone "$TEST_USE_REMOTE" tests/deepseek-harness-test-use > "$LOGDIR/02-testuse-clone.log" 2>&1
rc=$?; meta "test-use clone rc=$rc"
[ "$rc" = "0" ] || { meta "FATAL: test-use clone 失败"; exit 5; }
( cd tests/deepseek-harness-test-use \
    && git checkout "$TEST_USE_SHA" > "$LOGDIR/02b-checkout.log" 2>&1 \
    && pnpm install >> "$LOGDIR/02b-checkout.log" 2>&1 \
    && DSH_CLIENT_COMMIT_HASH=46a7f68b09 ESBUILD_WORKER_THREADS=1 pnpm run build >> "$LOGDIR/02b-checkout.log" 2>&1 )
rc=$?; meta "test-use checkout+install+build rc=$rc"
[ "$rc" = "0" ] || { meta "FATAL: test-use 准备失败（日志 $LOGDIR/02b-checkout.log）"; exit 5; }
PORC1=$(git -C tests/deepseek-harness-test-use status --porcelain | wc -l)
meta "H1 baseline: test-use porcelain lines = $PORC1 (must be 0)"
[ "$PORC1" = "0" ] || { meta "FATAL: test-use 基线不 pristine"; exit 5; }

# ── 3) 端口预检（3180 族空闲；:3080/:3180 只观测）──────────────────────────
for p in 3182 3183 3184 3185 3186 3491 3492 3493 3494 3495 3496 3497 3498 3506; do
  if ss -ltn 2>/dev/null | grep -q ":$p "; then
    meta "FATAL: 端口占用 $p — 释放后重跑（不代杀进程）"; exit 6
  fi
done
STABLE_3080_PRE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:3080/ 2>/dev/null || echo refused)
STABLE_3180_PRE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:3180/ 2>/dev/null || echo refused)
meta "stable observe PRE: :3080=$STABLE_3080_PRE :3180=$STABLE_3180_PRE"

# ── 4) PR-D（30min 有界；显式 rc 捕获持久化；串行禁并行 kit）────────────────
meta "START PR-D $(date -u +%FT%TZ)"
timeout 1800 node tests/kits/pr-d-control-real-host/pr-d-control-real-host.mjs > "$LOGDIR/prd.log" 2>&1
prd_rc=$?
echo "PRD_EXIT=$prd_rc" > "$LOGDIR/prd-exit.txt"
meta "END PR-D rc=$prd_rc (log: $LOGDIR/prd.log; 非零 = 见 FAIL 行，kit 自身 H 腿断言在日志内)"

# ── 5) PRF（30min 有界；PR-D 之后串行）─────────────────────────────────────
meta "START PRF $(date -u +%FT%TZ)"
timeout 1800 node tests/kits/pr-f-closure-smoke/pr-f-closure-smoke.mjs > "$LOGDIR/prf.log" 2>&1
prf_rc=$?
echo "PRF_EXIT=$prf_rc" > "$LOGDIR/prf-exit.txt"
meta "END PRF rc=$prf_rc (log: $LOGDIR/prf.log)"

# ── 6) 观测 + 结果汇总（scoped：只读；不清理任何 run 创建物，留供检）───────
STABLE_3080_POST=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:3080/ 2>/dev/null || echo refused)
STABLE_3180_POST=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:3180/ 2>/dev/null || echo refused)
meta "stable observe POST: :3080=$STABLE_3080_POST :3180=$STABLE_3180_POST"
[ "$STABLE_3080_PRE" = "$STABLE_3080_POST" ] || meta "WARN: :3080 pre/post 不一致（kit H1 腿判定为准；此为本脚本旁证）"
PORC2=$(git -C tests/deepseek-harness-test-use status --porcelain | wc -l)
meta "H1 post: test-use porcelain lines = $PORC2 (must be 0)"
ls tests/homes/ 2>/dev/null | tee -a "$LOGDIR/meta.log" || echo "(tests/homes 空 = kit 自清 PASS)" | tee -a "$LOGDIR/meta.log"

{
  echo "════ user-side acceptance result ($(date -u +%FT%TZ)) ════"
  echo "PIN_SHA:            $PIN_SHA"
  echo "PRD_EXIT:           $prd_rc   (log: $LOGDIR/prd.log)"
  echo "PRF_EXIT:           $prf_rc   (log: $LOGDIR/prf.log)"
  echo "stable :3080 pre/post: $STABLE_3080_PRE / $STABLE_3080_POST"
  echo "stable :3180 pre/post: $STABLE_3180_PRE / $STABLE_3180_POST"
  echo "test-use porcelain pre/post: $PORC1 / $PORC2"
  echo "run dir (保留):     $RUNDIR"
  echo "预期对照（agent 侧同 kit 记录，非承诺）：PRD 40/40（C1/C2a 侧效腿应转绿）；"
  echo "PRF = G6 侧效腿应转绿，其余腿与 agent 侧 t2/t3 一致（G6 外全绿 + H1/H2）。"
} | tee "$LOGDIR/RESULT.txt"

meta "worktree 保留于 $WT（git -C $R worktree remove --force $WT 可移除；由用户决定）"
exit 0   # 脚本自身完成 ≠ kit 通过；判定以 RESULT.txt 的 EXIT 值 + kit 日志为准
