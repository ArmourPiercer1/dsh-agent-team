#!/usr/bin/env bash
# a5x-dfs02-step1.sh — D-FS-02 内核层验证（脱离 Team/DSH，纯 Linux OS 机制）
# 核心问题：能否为真实 Linux 子进程构造独立 read/write 访问规则？
#
# 域构造（bwrap 0.11 实测，T6–T13 负控见头部注释与证据）：
#   基线 = 原生 DSH 同构：--ro-bind / / --dev /dev --unshare-pid --proc /proc
#          --die-with-parent --tmpfs /tmp
#          （系统全 ro：执行环境依赖 /usr,/lib64,/bin,/etc 自动满足）
#   写轴 = --bind <祖先> <祖先>（使 bwrap 可建挂载点）→ --remount-ro <祖先>
#          → --bind <写根> <写根>   写作用域 = 精确写根（祖先恢复 ro）
#   读轴 = --bind <祖先> <祖先> → --tmpfs <被掩码路径>（目录或单文件）
#          → --remount-ro <祖先>   被掩码路径 = 空 tmpfs（ENOENT/Is-a-directory）
#   弃用方案（实测不可行）：--tmpfs / 从零建根 + 后随 bind（bwrap 0.11 源路径
#          解析在命名空间态，系统路径无法复活 → exec ENOENT，T7/T8）；
#          ro 父链上直接 --tmpfs（mkdir parents EROFS，T9/T10）
# 拒绝证明 = 真实 OS 效果（exit code + stderr 原文），不靠散文。
set -u
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
EV="$(cd "$(dirname "$0")" && pwd)/../../../dev/agent-workflow/evidence/a5x-dfs02step1-$STAMP"
mkdir -p "$EV"
A="$EV/baseA/rootA"; B="$EV/baseB/rootB"
EV_A="$EV/baseA"; EV_B="$EV/baseB"
mkdir -p "$A" "$B"
printf 'ALPHA-CONTENT-7741\n' > "$A/one-file.txt"
printf 'ALPHA-DIR-OTHER-2290\n' > "$A/dir-other.txt"
printf 'BETA-CONTENT-3356\n' > "$B/b-file.txt"
OUT="$EV/step1-results.txt"
: > "$OUT"

NAT=(--ro-bind / / --dev /dev --unshare-pid --proc /proc --die-with-parent --tmpfs /tmp)

run_domain() { # $1=tag, rest = bwrap argv（最后 -- 命令）
  local tag="$1"; shift
  {
    echo "── domain $tag ──"
    bwrap "$@" 2>&1
    echo "[exit=$?]"
  } >> "$OUT"
}

# ── 域 R（目录规则·读轴）：只允许读 A；B 目录整体掩码（存在但内容不可见）──
run_domain R "${NAT[@]}" \
  --bind "$EV_B" "$EV_B" --tmpfs "$B" --remount-ro "$EV_B" \
  -- /bin/sh -c '
    echo "R1 read A dir-file (expect OK):"; cat '"$A"'/one-file.txt; echo "[exit=$?]"
    echo "R2 read B (expect DENIED ENOENT):"; cat '"$B"'/b-file.txt 2>&1; echo "[exit=$?]"
    echo "R2b list B (expect EMPTY):"; ls -A '"$B"'; echo "[ls exit=$?]"
    echo "R3 write A (expect DENIED EROFS):"; echo x > '"$A"'/r3.txt 2>&1; echo "[exit=$?]"
    echo "R3b create sibling under baseB (expect DENIED EROFS):"; mkdir '"$EV_B"'/sib 2>&1; echo "[exit=$?]"
    echo "R4 env-dep shell+coreutils+math:"; echo "sum=$((21*2))"; ls /usr/bin | head -2; echo "[exit=$?]"
    echo "R5 env-dep etc+proc+dev+tmp:"; head -1 /etc/hostname; head -1 /proc/self/status; test -w /dev/null && echo devnull-ok; echo tmpok > /tmp/r5.txt && cat /tmp/r5.txt; echo "[exit=$?]"
  '

# ── 域 W（目录规则·写轴）：只允许写 B（精确）；A 只读（写 EROFS）──
run_domain W "${NAT[@]}" \
  --bind "$EV_B" "$EV_B" --remount-ro "$EV_B" --bind "$B" "$B" \
  -- /bin/sh -c '
    echo "W1 write B (expect OK):"; echo w-content > '"$B"'/w-new.txt; cat '"$B"'/w-new.txt; echo "[exit=$?]"
    echo "W2 write A (expect DENIED EROFS):"; echo x > '"$A"'/w2.txt 2>&1; echo "[exit=$?]"
    echo "W2b create sibling under baseB (expect DENIED EROFS):"; mkdir '"$EV_B"'/sib 2>&1; echo "[exit=$?]"
    echo "W3 read A in write-domain (documented dialect: ro / => A readable):"; cat '"$A"'/one-file.txt; echo "[exit=$?]"
    echo "W4 env-dep binaries resolve+run:"; which cat; id -u; echo "[exit=$?]"
  '

# ── 域 Rf（文件规则·读轴，单文件粒度，bwrap 暴露式）：A 目录掩码，
#    单文件 one-file.txt 以 ro-bind 暴露到指定路径 /tmp/whitelist-x.txt ──
run_domain Rf "${NAT[@]}" \
  --bind "$EV_A" "$EV_A" --remount-ro "$EV_A" --tmpfs "$A" \
  --ro-bind "$A/one-file.txt" /tmp/whitelist-x.txt \
  --bind "$EV_B" "$EV_B" --tmpfs "$B" --remount-ro "$EV_B" \
  -- /bin/sh -c '
    echo "Rf1 read the exposed single file (expect OK):"; cat /tmp/whitelist-x.txt; echo "[exit=$?]"
    echo "Rf2 list A dir (expect EMPTY — masked):"; ls -A '"$A"'; echo "[ls exit=$?]"
    echo "Rf3 read via original path (expect DENIED ENOENT):"; cat '"$A"'/one-file.txt 2>&1; echo "[exit=$?]"
    echo "Rf4 write the exposed file (expect DENIED EROFS):"; echo x >> /tmp/whitelist-x.txt 2>&1; echo "[exit=$?]"
    echo "Rf5 read B (expect DENIED ENOENT):"; cat '"$B"'/b-file.txt 2>&1; echo "[exit=$?]"
  '

# ── 边界探针（记录 bwrap 0.11 实测不可行点，非域运行）──
{
  echo "── boundary: single-file MASK on existing file path ──"
  bwrap "${NAT[@]}" \
    --bind "$EV_A" "$EV_A" --remount-ro "$EV_A" --tmpfs "$A/dir-other.txt" \
    -- /bin/true 2>&1
  echo "[boundary exit=$?]"
} >> "$OUT"

# ── 负控（域外宿主直跑）：证明域内效果非环境噪音 ──
{
  echo "── host control (no domain) ──"
  cat "$B/b-file.txt" && echo "[control readB exit=0]"
  cat "$A/dir-other.txt" && echo "[control readA-sibling exit=0]"
} >> "$OUT"

# ── 环境探测：landlock 可用性（本宿主 = WSL2 kernel）──
{
  echo "── env-probe: landlock ──"
  echo "kernel=$(uname -r)"
  cat > /tmp/a5x-llprobe.c <<'CEOF'
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <errno.h>
#include <fcntl.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <unistd.h>
#include <linux/landlock.h>
#define FS_ALL 0x3ffULL
int main(void){
  prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0);
  struct landlock_ruleset_attr attr = { .handled_access_fs = FS_ALL };
  int rs = syscall(SYS_landlock_create_ruleset, &attr, sizeof(attr), 0);
  fprintf(stderr, "create_ruleset: %s\n", rs>=0?"OK":strerror(errno));
  if (rs < 0) return 0;
  int fd = open("/tmp", O_RDONLY | O_DIRECTORY);
  struct landlock_path_beneath_attr pb = { .allowed_access = FS_ALL, .parent_fd = fd };
  int r = syscall(SYS_landlock_add_rule, LANDLOCK_RULE_PATH_BENEATH, rs, &pb, 0);
  fprintf(stderr, "add_rule: %s\n", r==0?"OK":strerror(errno));
  return 0;
}
CEOF
  if gcc -o /tmp/a5x-llprobe /tmp/a5x-llprobe.c 2>/tmp/a5x-llcc.err; then
    /tmp/a5x-llprobe 2>&1
    echo "[probe exit=$?]"
  else
    echo "gcc unavailable: $(head -1 /tmp/a5x-llcc.err)"
  fi
  echo "securityfs-content: $(ls /sys/kernel/security/ 2>/dev/null | wc -l) entries"
} >> "$OUT"

# ── 判定（真实 OS 效果逐格断言）──
python3 - "$OUT" "$EV" <<'PY'
import json, re, sys
out = open(sys.argv[1]).read()
ev = sys.argv[2]
def grab(tag):
    m = re.search(r'── domain %s ──(.*?)(?=── domain|── host control|\Z)' % tag, out, re.S)
    return m.group(1) if m else ''
r, w, rf = grab('R'), grab('W'), grab('Rf')
verdicts = {
  'R1_readA_ok':            'ALPHA-CONTENT-7741' in r,
  'R2_readB_denied':        ('BETA-CONTENT-3356' not in r) and ('No such file' in r),
  'R2b_listB_empty':        ('b-file' not in r.split('R2b')[1].split('R3')[0]) and ('[ls exit=0]' in r),
  'R3_writeA_erofs':        'Read-only file system' in r.split('R3 write')[1].split('R3b')[0],
  'R3b_sibling_erofs':      'Read-only file system' in r.split('R3b')[1].split('R4')[0],
  'R4_env_shell_math':      'sum=42' in r,
  'R5_env_etc_proc_dev_tmp':'tmpok' in r and 'devnull-ok' in r and 'Name:' in r.split('R5')[1],
  'W1_writeB_ok':           'w-content' in w,
  'W2_writeA_erofs':        'Read-only file system' in w.split('W2 write')[1].split('W2b')[0],
  'W2b_sibling_erofs':      'Read-only file system' in w.split('W2b')[1].split('W3')[0],
  'W3_readA_in_W_readable': 'ALPHA-CONTENT-7741' in w,
  'W4_env_binaries':        '/usr/bin/cat' in w.split('W4')[1] and 'exit=0' in w.split('W4')[1],
  'Rf1_exposedFile_ok':     'ALPHA-CONTENT-7741' in rf,
  'Rf2_listA_empty':        ('ALPHA-CONTENT' not in rf.split('Rf2')[1].split('Rf3')[0]) and ('[ls exit=0]' in rf),
  'Rf3_origPath_denied':    'ALPHA-CONTENT-7741' not in rf.split('Rf3 read via')[1].split('Rf4')[0],
  'Rf4_exposedWrite_erofs': 'Read-only file system' in rf.split('Rf4')[1].split('Rf5')[0],
  'Rf5_readB_denied':       'BETA-CONTENT-3356' not in rf,
  'boundary_fileMask_enotdir': 'Not a directory' in out,
  'control_host_ok':        'BETA-CONTENT-3356' in out and 'ALPHA-DIR-OTHER-2290' in out,
}
def effect(blob, key, end):
    i = blob.find(key)
    j = blob.find(end, i + 1) if i >= 0 else -1
    return blob[i:j].strip() if i >= 0 else 'NOT FOUND'
effects = {
  'R2_readB':     effect(r, 'R2 read B', 'R2b'),
  'R3_writeA':    effect(r, 'R3 write A', 'R3b'),
  'W2_writeA':    effect(w, 'W2 write A', 'W2b'),
  'Rf3_origPath': effect(rf, 'Rf3 read via', 'Rf4'),
  'Rf4_exposedW': effect(rf, 'Rf4 write', 'Rf5'),
  'boundary':     (out.split('── boundary')[1][:300].strip() if '── boundary' in out else 'NOT FOUND'),
  'landlock_probe': (out.split('── env-probe: landlock ──')[1][:300].strip() if '── env-probe: landlock ──' in out else 'NOT FOUND'),
}
json.dump({'verdicts': verdicts, 'osEffects': effects}, open(ev + '/step1-verdicts.json', 'w'), indent=1)
print(json.dumps(verdicts, indent=1))
print('STEP1-OVERALL:', 'PASS' if all(verdicts.values()) else 'FAIL')
sys.exit(0 if all(verdicts.values()) else 1)
PY
rc=$?
echo "EVIDENCE $EV"
exit $rc
