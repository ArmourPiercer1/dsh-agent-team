#!/usr/bin/env bash
# env-capability-probe.sh — Alpha.5 P0-4 OS 强制能力探测（可复跑，幂等）
#
# 用法:  bash env-capability-probe.sh [log-path]
#        默认 log 写到脚本同目录 env-capability-probe-run.log（追加时间戳节）
# 判定:  SUPPORTED / UNSUPPORTED / ENV_BLOCK / BLOCKED
#
# 零配置修改承诺（本脚本全程遵守）:
#   * 不安装任何软件；不改任何系统配置 / 权限 / 安全设置；不使用 sudo
#   * 所有实验文件只在 04-process/probe-scratch/ 下创建，退出时 trap 销毁
#   * 探测用虚构 secret，内容 "SYNTHETIC-NOT-SECRET-DO-NOT-CARE"，无任何真实秘密
#   * 不触碰 :3080；E/F 两节对既有证据与 pinned 源码为只读引用
#   * Landlock 实验用 python3 ctypes 直接 syscall，仅作用于探测进程自身
#     （prctl NO_NEW_PRIVS + landlock_restrict_self 均为进程内、不可逆仅及本身，
#      不产生任何系统级状态）
#
# 诚实纪律:
#   * 负控必须以实际 errno（EACCES/ENOENT）为准；"没打印出内容" ≠ "没读到秘密"
#   * 探针本身跑不起来 => ENV_BLOCK / BLOCKED，绝不推断为 SUPPORTED
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRATCH="$SCRIPT_DIR/probe-scratch"
LOG="${1:-$SCRIPT_DIR/env-capability-probe-run.log}"
T_PINNED="/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/exp-alpha5-poc-20261016/tests/deepseek-harness-test-use/packages/sandbox/sandbox-local/src/profiles.ts"
E_PRIOR="/srv/workspace/dsh-plugins/dsh-agent-team/audit-reports/20261016-postalpha4-fix/FINAL-REPORT.md"
SECRET_CONTENT="SYNTHETIC-NOT-SECRET-DO-NOT-CARE"

cleanup() { rm -rf "$SCRATCH"; }
trap cleanup EXIT
mkdir -p "$SCRATCH/allowed" "$SCRATCH/private"
printf '%s' "$SECRET_CONTENT" > "$SCRATCH/private/secret.txt"
printf '%s' 'SYNTHETIC-READABLE-OK' > "$SCRATCH/allowed/read.txt"

exec > >(tee -a "$LOG") 2>&1
echo "================================================================"
echo "ENVP-PROBE RUN $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "pwd=$(pwd)"
echo "kernel=$(uname -r)"
echo "script_sha256=$(sha256sum "$0" | cut -d' ' -f1)"

# probe <label> <cmd...> — 记录命令原文 / 退出码 / 关键输出 / 耗时(ms)
probe() {
  local label="$1"; shift
  echo "--- PROBE $label"
  echo "CMD: $*"
  local t0 t1 rc
  t0=$(date +%s%N)
  "$@" > "$SCRATCH/.out" 2> "$SCRATCH/.err"; rc=$?
  t1=$(date +%s%N)
  echo "RC=$rc ELAPSED_MS=$(( (t1 - t0) / 1000000 ))"
  if [ -s "$SCRATCH/.out" ]; then echo "STDOUT(first 400B):"; head -c 400 "$SCRATCH/.out"; echo; fi
  if [ -s "$SCRATCH/.err" ]; then echo "STDERR(first 400B):"; head -c 400 "$SCRATCH/.err"; echo; fi
}

echo; echo "### 0. ENV HEADER"
probe 0a-knob cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns
probe 0b-uname uname -r
probe 0c-lsm cat /sys/kernel/security/lsm
probe 0d-secfs-landlock ls -la /sys/kernel/security/landlock
probe 0e-pid1-sandbox cat -v /proc/1/cmdline
probe 0f-uidmap cat /proc/1/uid_map
probe 0g-nnp grep -E 'NoNewPrivs|Seccomp' /proc/self/status
probe 0h-apparmor-label cat /proc/self/attr/current
probe 0i-netns readlink /proc/self/ns/net
probe 0j-id id

echo; echo "### A. bwrap"
probe A1 which bwrap
probe A2 bwrap --version
( cd "$SCRATCH" && \
  probe A3-neg bwrap --ro-bind allowed allowed --dev /dev --proc /proc cat private/secret.txt ; \
  probe A4-pos bwrap --ro-bind allowed allowed --dev /dev --proc /proc cat /allowed/read.txt ; \
  probe A5-unshare-all bwrap --unshare-all --ro-bind / / echo inside-ok )
echo "JUDGE-A: 若 A4-pos 非 0 => bwrap 在本环境不可运行 => ENV_BLOCK（负控无从验证）"

echo; echo "### B. Landlock（python3 ctypes 绑定，正负控）"
cat > "$SCRATCH/landlock_probe.py" <<'PYEOF'
import ctypes, ctypes.util, errno, os, struct, sys
SCRATCH = os.path.dirname(os.path.abspath(__file__))
ALLOWED = os.path.join(SCRATCH, "allowed"); SECRET = os.path.join(SCRATCH, "private", "secret.txt")
libc = ctypes.CDLL(ctypes.util.find_library("c"), use_errno=True)
SYS_CR, SYS_AR, SYS_RS, READ = 444, 445, 446, 3  # x86_64 syscall 号; READ_FILE|READ_DIR
def sc(n, *a):
    r = libc.syscall(ctypes.c_long(n), *a)
    return r, (errno.errorcode.get(ctypes.get_errno(), "?") if r == -1 else "")
abi, e = sc(SYS_CR, None, 0, 1); print(f"ABI_VERSION={abi} err={e}")
if abi < 0: sys.exit(2)
attrs = struct.pack("Q", READ)
rs, e = sc(SYS_CR, ctypes.byref(ctypes.create_string_buffer(attrs, 64)), 8, 0)
print(f"ruleset_fd={rs} err={e}")
if rs < 0: sys.exit(2)
pb = struct.pack("Qi", READ, os.open(ALLOWED, os.O_PATH | os.O_RDONLY))
r, e = sc(SYS_AR, rs, 1, ctypes.byref(ctypes.create_string_buffer(pb, 64)), 0)
print(f"add_rule(allowed/) rc={r} err={e}")
libc.prctl(38, 1, 0, 0, 0)  # PR_SET_NO_NEW_PRIVS, 本进程
r, e = sc(SYS_RS, rs, 0); print(f"restrict_self rc={r} err={e}")
if r < 0: sys.exit(3)
rc = 0
try:
    n = len(open(os.path.join(ALLOWED, "read.txt"), "rb").read())
    print(f"POS: allowed/read.txt READ OK ({n}B)")
except OSError as ex:
    print(f"POS-FAIL: allowed read denied ({ex.strerror})"); sys.exit(4)
try:
    n = len(open(SECRET, "rb").read())
    print(f"NEG-FAIL: secret READABLE ({n}B) -> enforcement ABSENT"); rc = 5
except OSError as ex:
    print(f"NEG: secret DENIED errno={ex.strerror}({ex.errno}) => enforcement CONFIRMED")
sys.exit(rc)
PYEOF
probe B1-landlock python3 "$SCRATCH/landlock_probe.py"
echo "JUDGE-B: RC=0 正负控双过=>SUPPORTED; RC=5 接口通但无强制=>ENV_BLOCK; RC=2=>UNSUPPORTED"

echo; echo "### C. 网络隔离（netns）"
probe C1-netns unshare --net -- echo ok
probe C2-user-netns unshare --user --net -- echo ok
probe C3-loopback-baseline ip -o link show
echo "JUDGE-C: C1/C2 非 0 => 非特权 netns 不可得 => ENV_BLOCK（loopback 基线仅为记录）"

echo; echo "### D. 用户命名空间"
probe D1-userns unshare --user -- echo ok
probe D2-map-root unshare --user --map-root-user -- echo ok
probe D3-uidmap-empty unshare --user -- cat /proc/self/uid_map
echo "JUDGE-D: D1=0 且 D2!=0 => 只能创建不可映射 => 用作降权沙箱不可行 ENV_BLOCK"

echo; echo "### E. 前轮证据引用（旁证，非本轮实测）"
if [ -f "$E_PRIOR" ]; then
  echo "PRIOR(ref-only): $E_PRIOR §八 L112-115 —"
  sed -n '112,115p' "$E_PRIOR"
else
  echo "PRIOR-MISSING: $E_PRIOR 不可读（本轮记 BLOCKED 于该项）"
fi

echo; echo "### F. pinned 源码事实（只读）"
if [ -f "$T_PINNED" ]; then
  echo "PINNED: $T_PINNED"
  echo "pinned_git_sha=$(git -C "${T_PINNED%%/packages*}" rev-parse HEAD 2>/dev/null || echo unknown)"
  grep -n -- "--ro-bind" "$T_PINNED" | sed 's/^/L/'
else
  echo "PINNED-MISSING: $T_PINNED（记 BLOCKED 于该项）"
fi
echo "JUDGE-F(源码判读): bwrapProfileArgs 两种 mode 均以 --ro-bind / / 起始 =>"
echo "  全盘可读、仅写受限 => 对『受限读』不合格（源码级判定，非运行时能力）"

echo; echo "### 销毁验证"
cleanup_flag=""
ls "$SCRATCH" >/dev/null 2>&1 && cleanup_flag="SCRATCH-STILL-PRESENT(trap 将处理)" || cleanup_flag="SCRATCH-REMOVED-OR-REMOVING"
echo "cleanup: $cleanup_flag (trap EXIT rm -rf $SCRATCH)"
echo "### ENDP-PROBE $(date -u +%Y-%m-%dT%H:%M:%SZ)"
