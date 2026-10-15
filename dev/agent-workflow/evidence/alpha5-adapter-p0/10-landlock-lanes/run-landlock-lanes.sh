#!/usr/bin/env bash
# run-landlock-lanes.sh — Alpha.5 P0 landlock 通路（L1-L4+TOCTOU）幂等驱动。
# 前提（不重做）：04-process/landlock-diagnosis.md = ENFORCE-WORKS（ABI v4）；本脚本复用其 ctypes 底座。
# 范围纪律：只写本目录（fixture=workspace/，日志=diag/，聚合=lanes-result.json）；
#   不改任何系统设置；真实 ~/.ssh 与 /etc/shadow 只被 open 探测（子进程内、预期 EACCES，零字节读取）；
#   不触 :3080；fixture 每次整体重建 ⇒ 幂等。
# 退出码：0=全部 lane 判定符合预期；2=landlock ABI 不可用；7=混合/未达预期；9=用法错误。
set -u
LANE="$(cd "$(dirname "$0")" && pwd)"
W="$LANE/workspace"
R="$LANE/diag/results"
PY="$LANE/landlock_lanes.py"

# ---------- fixture（全部 SYNTHETIC 合成数据；private 32B 随机 base64，同 diag 口径） ----------
rm -rf "$W" "$LANE/diag" "$LANE/lanes-result.json"
mkdir -p "$W/a5ll/allowed/sub" "$W/a5ll/private" "$W/outside" "$W/a5ll/home-fixture/.ssh" "$R"
printf 'SYNTHETIC-OK-CONTROL'    > "$W/a5ll/allowed/ok.txt"
printf 'SYNTHETIC-READABLE-OK'   > "$W/a5ll/allowed/read.txt"
head -c 24 /dev/urandom | base64 | head -c 32 > "$W/a5ll/private/secret.txt"
printf 'SYNTHETIC-OUTSIDE-CONTROL' > "$W/outside/outside.txt"
printf 'SYNTHETIC-KEY-DATA\n'      > "$W/a5ll/home-fixture/.ssh/id_rsa"
printf 'SYNTHETIC-BASHRC-ORIGINAL\n' > "$W/a5ll/home-fixture/.bashrc"

export A5_ROOT="$W"
RCS=""
run_leg() {  # run_leg <LEG>
  local leg="$1"
  A5_RESULT_FILE="$R/$leg.json" python3 "$PY" "$leg" --root "$W" > "$LANE/diag/run-$leg.log" 2>&1
  local rc=$?
  echo "== $leg rc=$rc (log: diag/run-$leg.log)"
  tail -n 3 "$LANE/diag/run-$leg.log" | sed 's/^/   | /'
  RCS="${RCS:+$RCS,}$leg=$rc"
}
echo "== landlock-lanes RUN $(date -u '+%Y-%m-%dT%H:%M:%SZ') kernel=$(uname -r) lane=$LANE"
for leg in L1 L1FD L2 L3 L4 TOCTOU_A TOCTOU_B; do run_leg "$leg"; done
echo
python3 "$PY" AGG --root "$W" --resdir "$R" --rcs "$RCS"
rc=$?
echo "MODE_RC $RCS"
echo "OVERALL: rc=$rc $( [ $rc -eq 0 ] && echo ALL-LANES-AS-EXPECTED || echo MIXED )"
exit $rc
