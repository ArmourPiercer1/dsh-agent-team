#!/usr/bin/env bash
# a5x-wr0-step1.sh — 严格只写不读（write-without-read）内核层验证（脱离 Team/DSH，纯 Linux OS 机制）
# 审查跟进：ioaxis 轮 PoC 已证路径掩蔽/精确目录写/单文件暴露，但未证「严格只写不读」。
#
# 机制选型（如实记录）：
#   bwrap 无法表达只写不读 —— rw bind ⇒ 可读（ioaxis 轮已实测并记录 dialect）。
#   landlock（handled bits 仅 WRITE_FILE，拒绝=EACCES，无元数据改动）= 正统机制，
#     但本 WSL2 宿主 ENV_BLOCK（a5x-dfs02step1-20261102T164041Z §env-probe：add_rule 全 fd 变体 EBADF）。
#   本宿主可用真实机制 = VFS owner 权限位（ext4 原生强制）：
#     dir  0300（owner -wx，无 r）⇒ 不可列表（getdents → EACCES），可创建/打开已知路径（w+x）
#     file 0200（owner -w-，无 r）⇒ 可 open O_WRONLY（追加/截断），不可读（read/open O_RDONLY → EACCES）
#   与 bwrap 组合 = 严格只写不读写根：挂载层 rw-bind（允许写路径存在）× 文件层 VFS 位（拒绝读）。
#   关键判别：域内读失败 = EACCES（VFS 层）而非 EROFS（挂载层）/ ENOENT（掩码）——三种拒绝机制可分辨。
# 前置条件（如实记录）：mode bits 由宿主侧在 spawn 前设置（deployer 前置条件）；confinement 层不改元数据。
#   生产形态的域生命周期须管理这些位（设置/恢复/审计）——与掩码的「显式祖先」同类的生产化注记。
#   新建文件不受限（umask 决定，可读）；严格继承需 default-ACL 或 landlock（生产扩展点，本轮不测——不过度实验）。
set -u
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
EV="$(cd "$(dirname "$0")" && pwd)/../../../dev/agent-workflow/evidence/a5x-wr0step1-$STAMP"
mkdir -p "$EV"
BASE="$EV/baseW"; W="$BASE/rootW"
mkdir -p "$W"
printf 'WRITEONLY-SEED-1123\n' > "$W/wf.txt"
chmod 300 "$W"; chmod 200 "$W/wf.txt"   # 只写不读前置条件（宿主侧，spawn 前）
OUT="$EV/wr0-results.txt"
: > "$OUT"

echo "── preconf (host-side mode bits, before any spawn) ──" >> "$OUT"
stat -c '%a %n' "$BASE" "$W" "$W/wf.txt" >> "$OUT"

NAT=(--ro-bind / / --dev /dev --unshare-pid --proc /proc --die-with-parent --tmpfs /tmp)

# ── 探针：bwrap 0.11 能否直接 bind 一个无读位目录（0300）为源路径 ──
# bwrap 若需对源目录 open(O_DIRECTORY)（需 MAY_READ），direct 形不可行 → 回退 ancestor 形
# （bind 祖先 baseW 0755 为 rw，rootW 作为其 rw 子路径；写作用域=祖先，泄漏如实记录）。
{
  echo "── probe: bwrap direct-bind of no-read dir ──"
  bwrap "${NAT[@]}" --bind "$W" "$W" -- /bin/true 2>&1
  echo "[probe exit=$?]"
} >> "$OUT"
PROBE_OK=0
grep -q '\[probe exit=0\]' "$OUT" && PROBE_OK=1
if [ "$PROBE_OK" = 1 ]; then MOUNT="direct"; else MOUNT="ancestor"; fi
echo "[mount-mode=$MOUNT]" >> "$OUT"

# ── HOST 腿（无域，纯 OS）：证明机制本身 = 内核 VFS 强制 ──
{
  echo "── host (no domain, pure VFS) ──"
  echo "H1 read file (expect DENIED EACCES):"; cat "$W/wf.txt" 2>&1; echo "[exit=$?]"
  echo "H2 list dir (expect DENIED EACCES):"; ls -A "$W" 2>&1; echo "[exit=$?]"
  echo "H3 append file (expect OK):"; echo HOST-APPEND-9042 >> "$W/wf.txt" 2>&1; echo "[exit=$?]"
  echo "H4 create new file (expect OK):"; echo HOST-NEW-5511 > "$W/wf2.txt" 2>&1; echo "[exit=$?]"
  echo "H5 stat size (expect OK, stat needs only x):"; stat -c '%s' "$W/wf.txt" 2>&1; echo "[exit=$?]"
} >> "$OUT"

# ── DOMAIN 腿（bwrap 组合）：证明组合在域内成立，且 EACCES≠EROFS ──
if [ "$MOUNT" = "direct" ]; then
  MOUNTARGS=(--bind "$W" "$W")
else
  MOUNTARGS=(--bind "$BASE" "$BASE")
fi
{
  echo "── domain WO (bwrap + VFS bits, mount=$MOUNT) ──"
  bwrap "${NAT[@]}" "${MOUNTARGS[@]}" -- /bin/sh -c '
    echo "D1 read file in domain (expect DENIED EACCES):"; cat '"$W"'/wf.txt 2>&1; echo "[exit=$?]"
    echo "D2 list dir in domain (expect DENIED EACCES):"; ls -A '"$W"' 2>&1; echo "[exit=$?]"
    echo "D3 append file in domain (expect OK — proves mount is rw, not ro):"; echo DOMAIN-APPEND-4417 >> '"$W"'/wf.txt 2>&1; echo "[exit=$?]"
    echo "D4 stat size in domain (expect OK):"; stat -c %s '"$W"'/wf.txt 2>&1; echo "[exit=$?]"
    echo "D5 write OUTSIDE write-root (expect '"$( [ "$MOUNT" = direct ] && echo DENIED-EROFS || echo OK-leak-ancestor )"' ):"; echo z > '"$BASE"'/sib.txt 2>&1; echo "[exit=$?]"
  ' 2>&1
  echo "[domain exit=$?]"
} >> "$OUT"

# ── teardown + FS oracle（宿主侧：恢复权限位后读回，证明写真实落盘）──
{
  echo "── teardown + FS oracle (host-side) ──"
  chmod 755 "$W"; chmod 644 "$W/wf.txt"
  [ -f "$W/wf2.txt" ] && chmod 644 "$W/wf2.txt"
  [ -f "$BASE/sib.txt" ] && { cat "$BASE/sib.txt"; rm -f "$BASE/sib.txt"; }
  echo "wf.txt content after restore:"; cat "$W/wf.txt"
  echo "wf2.txt content (if exists):"; cat "$W/wf2.txt" 2>&1
  echo "[teardown exit=$?]"
} >> "$OUT"

# ── 判定（真实 OS 效果逐格断言）──
python3 - "$OUT" "$EV" <<'PY'
import json, re, sys
out = open(sys.argv[1]).read()
ev = sys.argv[2]
def grab(marker):
    lines = out.split('\n')
    starts = [k for k, l in enumerate(lines) if l.startswith('── ')]
    for k, idx in enumerate(starts):
        if lines[idx].startswith(marker):
            end = starts[k + 1] if k + 1 < len(starts) else len(lines)
            return '\n'.join(lines[idx:end]).strip()
    return ''
h = grab('── host (no domain')
d = grab('── domain WO')
o = grab('── teardown + FS oracle')
pre = grab('── preconf')
mount = re.search(r'mount=(\w+)', d)
mount = mount.group(1) if mount else 'unknown'
verdicts = {
  # 机制本身（纯 VFS，无域）
  'H1_readFile_denied_EACCES': 'Permission denied' in h.split('H1')[1].split('H2')[0] and 'WRITEONLY-SEED-1123' not in h.split('H1')[1].split('H2')[0],
  'H2_listDir_denied_EACCES':  'Permission denied' in h.split('H2')[1].split('H3')[0] and 'wf.txt' not in h.split('H2')[1].split('H3')[0],
  'H3_append_ok':              '[exit=0]' in h.split('H3')[1].split('H4')[0] and 'Permission denied' not in h.split('H3')[1].split('H4')[0],
  'H4_create_ok':              '[exit=0]' in h.split('H4')[1].split('H5')[0],
  'H5_stat_ok':                '[exit=0]' in h.split('H5')[1],
  # bwrap 组合（域内）
  'D1_domain_readFile_EACCES': 'Permission denied' in d.split('D1')[1].split('D2')[0],
  'D2_domain_listDir_EACCES':  'Permission denied' in d.split('D2')[1].split('D3')[0],
  'D3_domain_append_ok':       '[exit=0]' in d.split('D3')[1].split('D4')[0] and 'Read-only file system' not in d.split('D3')[1].split('D4')[0],
  'D4_domain_stat_ok':         '[exit=0]' in d.split('D4')[1].split('D5')[0],
  'D5_outside_write_scope':    ('Read-only file system' in d.split('D5')[1]) if mount == 'direct'
                               else ('[exit=0]' in d.split('D5')[1]),  # ancestor 形：泄漏如实记录
  'D_denial_is_EACCES_not_EROFS': ('Permission denied' in d) and ('Read-only file system' not in d.split('D1')[1].split('D5')[0]),
  # FS 侧效应（写真实落盘）
  'O_hostAppend_landed':  'HOST-APPEND-9042' in o,
  'O_domainAppend_landed':'DOMAIN-APPEND-4417' in o,
  'O_hostNewFile_landed': 'HOST-NEW-5511' in o,
  # 记录性事实
  'preconf_bits_300_200':   '300' in pre and '200' in pre,
  'mountMode':              mount,
}
json.dump({'verdicts': verdicts, 'mountMode': mount,
           'hostLeg': h, 'domainLeg': d, 'oracleLeg': o, 'preconf': pre},
          open(ev + '/wr0-verdicts.json', 'w'), indent=1)
real = {k: v for k, v in verdicts.items() if v in (True, False)}
print(json.dumps(verdicts, indent=1))
print('WR0-OVERALL:', 'PASS' if all(real.values()) else 'FAIL')
sys.exit(0 if all(real.values()) else 1)
PY
rc=$?
echo "EVIDENCE $EV"
exit $rc
