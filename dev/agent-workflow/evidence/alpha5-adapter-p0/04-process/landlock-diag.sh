#!/usr/bin/env bash
# landlock-diag.sh — Landlock 最小正确正负控诊断（ABI v4，python3 ctypes，可复跑）
# 范围纪律：只读系统 + 自有进程行为（prctl NO_NEW_PRIVS + restrict_self 仅作用于探测进程本身）；
# 不修改任何 sysctl/模块/apparmor/limits；scratch 用后即焚（trap）。
# 用法: bash landlock-diag.sh [SCRATCH_DIR]   （缺省 mktemp；传目录则在其内建 allowed/private/other 并清理）
# 退出码: 0=ENFORCE-WORKS; 2=ABI 不可用(ENOSYS/不支持); 4=正控失败(探针/配置问题→不可判定);
#         5=接口应答但零强制(ENFORCE-ABSENT); 7=结果混合(STILL-INCONCLUSIVE)
set -u
if [ $# -ge 1 ]; then
  S="$1"; rm -rf "$S"; mkdir -p "$S"
else
  S="$(mktemp -d "${TMPDIR:-/tmp}/landlock-diag.XXXXXX")"; trap 'rm -rf "$S"' EXIT
fi
mkdir -p "$S/allowed" "$S/private" "$S/other"
head -c 24 /dev/urandom | base64 | head -c 32 > "$S/private/secret.txt"   # 32B 合成数据
printf 'SYNTHETIC-OK-CONTROL' > "$S/allowed/ok.txt"
printf 'SYNTHETIC-READABLE-OK' > "$S/allowed/read.txt"
printf 'SYNTHETIC-OUTSIDE-CONTROL' > "$S/other/outside.txt"

PY="$S/landlock_diag.py"
cat > "$PY" <<'PYEOF'
import ctypes, os, struct, sys
import errno as EN

mode, scratch = sys.argv[1], sys.argv[2]
ALLOWED = os.path.join(scratch, "allowed"); PRIVATE = os.path.join(scratch, "private")
SECRET  = os.path.join(PRIVATE, "secret.txt"); OKF = os.path.join(ALLOWED, "ok.txt")
READTXT = os.path.join(ALLOWED, "read.txt"); OUTSIDE = os.path.join(scratch, "other", "outside.txt")

SYS_CR, SYS_AR, SYS_RS = 444, 445, 446   # x86_64 landlock_create_ruleset/add_rule/restrict_self
O_PATH = getattr(os, "O_PATH", 0o10000000)
libc = ctypes.CDLL("libc.so.6", use_errno=True)
libc.syscall.restype = ctypes.c_long

def sc(label, nr, *args):
    """所有整数参数强制 c_long（防 32 位截断），指针走 c_void_p；每步打印 rc+errno 原文。"""
    argv = [ctypes.c_long(nr)]
    for a in args:
        argv.append(a if isinstance(a, ctypes.c_void_p) else ctypes.c_long(a))
    r = libc.syscall(*argv)
    err = ctypes.get_errno() if r == -1 else 0
    print(f"[SC] {label}: rc={r} errno={'0' if not err else EN.errorcode.get(err, err)} strerror={os.strerror(err)!r}")
    return r, err

def odir(p):
    fd = os.open(p, O_PATH | os.O_CLOEXEC)
    print(f"[FD] O_PATH dirfd({p}) = {fd} (restrict 前打开，规则引用其 inode)")
    return fd

def chk(name, fn, expect):
    try:
        fn(); got, det = "OK", ""
    except OSError as ex:
        got, det = EN.errorcode.get(ex.errno, ex.errno), ex.strerror
    tag = "MATCH" if got == expect else "MISMATCH"
    print(f"[CHK] {name}: expect={expect} got={got} strerror={det!r} -> {tag}")
    return tag == "MATCH"

FS = {'EXECUTE':1<<0,'WRITE_FILE':1<<1,'READ_FILE':1<<2,'READ_DIR':1<<3,'REMOVE_DIR':1<<4,
      'REMOVE_FILE':1<<5,'MAKE_CHAR':1<<6,'MAKE_DIR':1<<7,'MAKE_REG':1<<8,'MAKE_SOCK':1<<9,
      'MAKE_FIFO':1<<10,'MAKE_BLOCK':1<<11,'MAKE_SYM':1<<12,'REFER':1<<13,'TRUNCATE':1<<14}
def fs_mask(abi):
    m = (1 << 13) - 1                     # bits0..12: ABI v1
    if abi >= 2: m |= FS['REFER']
    if abi >= 3: m |= FS['TRUNCATE']      # v4 的 fs 面与 v3 相同
    return m

def get_abi():
    abi, _ = sc("create_ruleset(NULL,0,VERSION)", SYS_CR, ctypes.c_void_p(None), 0, 1)
    return abi

def add_rule(rs, dirfd, access, label):
    buf = ctypes.create_string_buffer(struct.pack("@Qi", access, dirfd))  # packed: u64@0, s32@8
    r, _ = sc(f"add_rule({label}, access=0x{access:x})", SYS_AR, rs, 1,
              ctypes.c_void_p(ctypes.addressof(buf)), 0)
    buf._keep = True
    return r

def restrict(rs):
    p = libc.prctl(38, 1, 0, 0, 0)   # PR_SET_NO_NEW_PRIVS（restrict_self 前置条件）
    print(f"[SC] prctl(PR_SET_NO_NEW_PRIVS,1): rc={p} errno={ctypes.get_errno() if p else 0}")
    r, _ = sc("landlock_restrict_self", SYS_RS, rs, 0)
    return r

def run_child(argv):
    r, w = os.pipe()
    pid = os.fork()
    if pid == 0:
        try:
            os.dup2(w, 1); os.dup2(w, 2)
            os.close(r); os.close(w)
            os.execve(argv[0], argv, {})
        except OSError as ex:
            os._exit(120)
    os.close(w)
    out = b""
    while True:
        try: b = os.read(r, 4096)
        except OSError: break
        if not b: break
        out += b
    os.close(r)
    _, st = os.waitpid(pid, 0)
    rc = os.waitstatus_to_exitcode(st)
    print(f"[EXEC] {' '.join(argv)} -> rc={rc} out/err={out[:200]!r}")
    return rc

if mode == "selective":
    # ---- 基线（restrict 前）：两文件均可读 => 进程此前不在任何受限域 ----
    chk("BASE secret readable pre-restrict", lambda: os.close(os.open(SECRET, os.O_RDONLY)), "OK")
    chk("BASE ok.txt readable pre-restrict",  lambda: os.close(os.open(OKF, os.O_RDONLY)), "OK")
    # ---- 陷阱①演示：restrict 前打开的 fd（restrict 后读取按设计仍成功；用它当负控=假 ABSENT） ----
    pre_fd = os.open(SECRET, os.O_RDONLY)
    print(f"[NOTE] pre_fd({SECRET}) = {pre_fd} (restrict 前打开)")

    abi = get_abi()
    if abi < 0: print("VERDICT-selective: ABI-UNAVAILABLE"); sys.exit(2)
    supported_fs = fs_mask(abi)
    handled = supported_fs                      # 声明集 = ABI v4 全部受支持 fs 位（net 面显式不声明）
    print(f"[ABI] version={abi} supported_fs=0x{supported_fs:x} handled_access_fs=0x{handled:x}"
          f"（声明位：{','.join(sorted(n for n,b in FS.items() if handled & b))}）handled_access_net=0x0（显式不声明）")
    attr = ctypes.create_string_buffer(struct.pack("@QQ", handled, 0), 16)
    rs, _ = sc("create_ruleset(attr16)", SYS_CR, ctypes.c_void_p(ctypes.addressof(attr)), 16, 0)
    if rs < 0: print("VERDICT-selective: RULESET-FAIL"); sys.exit(2)
    # 规则：/ 仅 READ_DIR(搜索穿越)；/usr /etc 允许 exec 链；allowed 完全允许；private/other 不加任何规则
    ok_rules = True
    ok_rules &= add_rule(rs, odir("/"), FS['READ_DIR'], "/") == 0
    ok_rules &= add_rule(rs, odir("/usr"), FS['READ_DIR'] | FS['READ_FILE'] | FS['EXECUTE'], "/usr") == 0
    ok_rules &= add_rule(rs, odir("/etc"), FS['READ_DIR'] | FS['READ_FILE'], "/etc") == 0
    ok_rules &= add_rule(rs, odir(ALLOWED), FS['READ_DIR'] | FS['READ_FILE'] | FS['WRITE_FILE']
                         | FS['MAKE_REG'] | FS['REMOVE_FILE'] | FS['TRUNCATE'], "allowed") == 0
    if not ok_rules: print("VERDICT-selective: ADD-RULE-FAIL"); sys.exit(4)
    if restrict(rs) != 0: print("VERDICT-selective: RESTRICT-FAIL"); sys.exit(4)

    scores = []
    # ---- 负控（全部 restrict 后新建 fd）----
    scores.append(chk("NEG read private/secret.txt", lambda: os.close(os.open(SECRET, os.O_RDONLY)), "EACCES"))
    scores.append(chk("NEG read other/outside.txt",  lambda: os.close(os.open(OUTSIDE, os.O_RDONLY)), "EACCES"))
    scores.append(chk("NEG create private/new.txt",  lambda: os.close(os.open(os.path.join(PRIVATE, "new.txt"),
                          os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)), "EACCES"))
    # ---- 正控 ----
    scores.append(chk("POS read allowed/ok.txt", lambda: os.close(os.open(OKF, os.O_RDONLY)), "OK"))
    scores.append(chk("POS write allowed/new.txt", lambda: os.close(os.open(os.path.join(ALLOWED, "new.txt"),
                          os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)), "OK"))
    scores.append(chk("POS read /etc/hostname (规则内正控)", lambda: os.close(os.open("/etc/hostname", os.O_RDONLY)), "OK"))
    # ---- 陷阱①对照：restrict 前 fd 仍可读（设计行为，非强制失效）----
    scores.append(chk("NOTE pre-restrict fd read (by-design OK)",
                      lambda: os.read(pre_fd, 32), "OK"))
    print(f"[NOTE] listdir(private) = {sorted(os.listdir(PRIVATE))} —— '/' 授 READ_DIR 仅允许目录穿越，"
          f"泄露的是目录项名而非文件内容（规则设计使然，非强制失效）")
    # ---- fork+exec 继承腿：restrict 只作用本进程域，子进程 exec 后应继承同一域 ----
    rc1 = run_child(["/usr/bin/cat", OKF])
    print(f"[CHK] POS-exec cat allowed -> {'MATCH' if rc1 == 0 else 'MISMATCH'}")
    rc2 = run_child(["/usr/bin/cat", SECRET])
    print(f"[CHK] NEG-exec cat private -> {'MATCH' if rc2 != 0 else 'MISMATCH'}（cat 本身可 exec，见上，排除二进制不可读假阴性）")
    scores.append(rc1 == 0); scores.append(rc2 != 0)
    if all(scores): print("VERDICT-selective: ENFORCE-CONFIRMED"); sys.exit(0)
    print("VERDICT-selective: MIXED/FAILED"); sys.exit(1)

elif mode == "denyall":
    # 鉴别器：handled=全部支持位、零规则 => 域一旦生效，一切新的 open 必 EACCES（排除"规则语义没对上"）
    chk("BASE secret readable pre-restrict", lambda: os.close(os.open(SECRET, os.O_RDONLY)), "OK")
    abi = get_abi()
    if abi < 0: print("VERDICT-denyall: ABI-UNAVAILABLE"); sys.exit(2)
    handled = fs_mask(abi)
    attr = ctypes.create_string_buffer(struct.pack("@QQ", handled, 0), 16)
    rs, _ = sc("create_ruleset(denyall)", SYS_CR, ctypes.c_void_p(ctypes.addressof(attr)), 16, 0)
    if rs < 0: print("VERDICT-denyall: RULESET-FAIL"); sys.exit(2)
    if restrict(rs) != 0: print("VERDICT-denyall: RESTRICT-FAIL"); sys.exit(4)
    a = chk("DENYALL open secret", lambda: os.close(os.open(SECRET, os.O_RDONLY)), "EACCES")
    b = chk("DENYALL open allowed", lambda: os.close(os.open(OKF, os.O_RDONLY)), "EACCES")
    print("VERDICT-denyall: " + ("ENFORCE-CONFIRMED" if a and b else "NO-ENFORCEMENT"))
    sys.exit(0 if a and b else 1)

elif mode == "badhandled":
    # 常见探针错误演示：handled 漏 READ_FILE → 读根本不被中介 → 负控"读得到"是配置错，不是强制缺失
    abi = get_abi()
    if abi < 0: print("VERDICT-badhandled: ABI-UNAVAILABLE"); sys.exit(2)
    handled = FS['MAKE_REG']  # 故意只含 MAKE_REG
    attr = ctypes.create_string_buffer(struct.pack("@QQ", handled, 0), 16)
    rs, _ = sc("create_ruleset(badhandled)", SYS_CR, ctypes.c_void_p(ctypes.addressof(attr)), 16, 0)
    if rs < 0: print("VERDICT-badhandled: RULESET-FAIL"); sys.exit(2)
    if restrict(rs) != 0: print("VERDICT-badhandled: RESTRICT-FAIL"); sys.exit(4)
    chk("DEMO secret readable (READ_FILE not handled)", lambda: os.close(os.open(SECRET, os.O_RDONLY)), "OK")
    chk("DEMO create new file DENIED (MAKE_REG handled, no rule)", lambda: os.close(os.open(
        os.path.join(PRIVATE, "n2.txt"), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)), "EACCES")
    print("VERDICT-badhandled: DEMO-OK（handled 不全 ⇒ 假 ABSENT 可复现）"); sys.exit(0)

elif mode == "prior":
    # 逐字复跑前轮 landlock_probe.py 的逻辑（含其原始 ctypes 调用风格），验证其观察是否稳定复现
    import struct as _st
    ALLOWEDp, SECRETp, READp = ALLOWED, SECRET, READTXT
    def scp(n, *a):
        r = libc.syscall(ctypes.c_long(n), *a)
        return r, (EN.errorcode.get(ctypes.get_errno(), "?") if r == -1 else "")
    abi, e = scp(SYS_CR, None, 0, 1); print(f"[PRIOR] ABI_VERSION={abi} err={e}")
    if abi < 0: print("VERDICT-prior: ABI-UNAVAILABLE"); sys.exit(2)
    attrs = _st.pack("Q", FS['READ_FILE'])
    rs, e = scp(SYS_CR, ctypes.byref(ctypes.create_string_buffer(attrs, 64)), 8, 0)
    print(f"[PRIOR] ruleset_fd={rs} err={e}")
    pb = _st.pack("Qi", FS['READ_FILE'], os.open(ALLOWEDp, O_PATH | os.O_RDONLY))
    r, e = scp(SYS_AR, rs, 1, ctypes.byref(ctypes.create_string_buffer(pb, 64)), 0)
    print(f"[PRIOR] add_rule(allowed/) rc={r} err={e}")
    libc.prctl(38, 1, 0, 0, 0)
    r, e = scp(SYS_RS, rs, 0); print(f"[PRIOR] restrict_self rc={r} err={e}")
    if r < 0: print("VERDICT-prior: RESTRICT-FAIL"); sys.exit(3)
    try:
        n = len(open(READp, "rb").read()); print(f"[PRIOR] POS: allowed/read.txt READ OK ({n}B)")
    except OSError as ex:
        print(f"[PRIOR] POS-FAIL: {ex.strerror}"); sys.exit(4)
    try:
        n = len(open(SECRETp, "rb").read()); print(f"[PRIOR] NEG-FAIL: secret READABLE ({n}B) -> 前轮观察复现"); sys.exit(5)
    except OSError as ex:
        print(f"[PRIOR] NEG: secret DENIED errno={ex.strerror} => 前轮观察未复现"); sys.exit(0)
PYEOF

echo "== landlock-diag RUN $(date -u +%Y-%m-%dT%H:%M:%SZ) kernel=$(uname -r) scratch=$S ($(stat -f -c %T "$S"))"
echo; echo "### mode=selective（完整 handled，选择性允许；主判定）"
python3 "$PY" selective "$S"; r1=$?
echo; echo "### mode=denyall（零规则鉴别器）"
python3 "$PY" denyall "$S";   r2=$?
echo; echo "### mode=badhandled（handled 不全 → 假 ABSENT 演示）"
python3 "$PY" badhandled "$S"; r3=$?
echo; echo "### mode=prior（逐字复跑前轮探针）"
python3 "$PY" prior "$S";     r4=$?
echo; echo "MODE_RC selective=$r1 denyall=$r2 badhandled=$r3 prior=$r4"
if [ $r1 -eq 0 ] && [ $r2 -eq 0 ]; then rc=0; note=ENFORCE-WORKS
elif [ $r1 -eq 2 ] && [ $r2 -eq 2 ]; then rc=2; note=ABI-UNAVAILABLE
elif [ $r2 -ne 0 ]; then rc=5; note=ZERO-ENFORCEMENT-CONFIRMED
elif [ $r1 -ne 0 ]; then rc=4; note=POSITIVE-CONTROL-FAIL-INCONCLUSIVE
else rc=7; note=MIXED; fi
echo "OVERALL: rc=$rc $note"
exit $rc
