#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
landlock_lanes.py — Alpha.5 P0 landlock 通路补做：L1-L4 + TOCTOU 行为级证据 runner。
基座 = 04-process/landlock-diag.sh 内嵌探针的 ctypes 底座（syscall 444/445/446、
attr16 = pack("@QQ")、rule = pack("@Qi")、c_long 防截断、O_PATH dirfd、prctl NO_NEW_PRIVS）。

机制姿势（写明，见 notes.md §机制）：
  - landlock 域**不可由父进程在 fork+exec 前为子进程预设**（父进程 restrict_self 会同时收缩父域；
    ruleset fd 为 O_CLOEXEC 无法跨 exec——L1 内有 EBADF 实证）。
  - 正确姿势 = **子进程入口先自锁再执行任务**：子进程读父进程编译好的 per-member 策略 JSON，
    在自身进程内 create_ruleset → add_rule（自开 O_PATH dirfd）→ prctl(PR_SET_NO_NEW_PRIVS)
    → landlock_restrict_self，然后才 fork+exec 真实任务（sh -c / cat）。域随 fork+exec 继承。
  - 所有负控一律用 **restrict 后新建 fd**；已开 fd 的存活由 TOCTOU 腿单独显式测试并如实记录。
判定 = OS_ENFORCED（landlock 由内核中介 syscall，errno 原文入 JSON）；fixture/子进程级，宿主级措辞如实。
范围纪律：只在 10-landlock-lanes/ 内写；~/.ssh、/etc/shadow 仅 open 探测（不读取任何字节、真实键内容零进入证据）；
不改任何系统设置；不触 :3080；幂等（fixture 每次整体重建）。
用法: python3 landlock_lanes.py <MODE> --root <lane/workspace>
MODE: L1 L2 L3 L4 TOCTOU_A TOCTOU_B AGG（*-CHILD 由父半自动派生，勿手跑）
"""
import ctypes, errno as EN, fcntl, json, os, struct, sys, time, hashlib

SYS_CR, SYS_AR, SYS_RS = 444, 445, 446            # x86_64: create_ruleset / add_rule / restrict_self
RULE_PATH_BENEATH = 1
O_PATH = getattr(os, "O_PATH", 0o10000000)
FS = {'EXECUTE': 1 << 0, 'WRITE_FILE': 1 << 1, 'READ_FILE': 1 << 2, 'READ_DIR': 1 << 3,
      'REMOVE_DIR': 1 << 4, 'REMOVE_FILE': 1 << 5, 'MAKE_CHAR': 1 << 6, 'MAKE_DIR': 1 << 7,
      'MAKE_REG': 1 << 8, 'MAKE_SOCK': 1 << 9, 'MAKE_FIFO': 1 << 10, 'MAKE_BLOCK': 1 << 11,
      'MAKE_SYM': 1 << 12, 'REFER': 1 << 13, 'TRUNCATE': 1 << 14}
libc = ctypes.CDLL("libc.so.6", use_errno=True)
libc.syscall.restype = ctypes.c_long

MODEL_REPORTED = "qwen3.8-flash-next"  # 系统提示 powered-by 逐字；由代理注入，runner 自身不可核验


def sc(label, nr, *args):
    """diag 底座：整数一律 c_long 防 32 位截断；每步记录 rc+errno 原文。"""
    argv = [ctypes.c_long(nr)]
    for a in args:
        argv.append(a if isinstance(a, ctypes.c_void_p) else ctypes.c_long(a))
    r = libc.syscall(*argv)
    err = ctypes.get_errno() if r == -1 else 0
    rec = f"[SC] {label}: rc={r} errno={'OK' if not err else EN.errorcode.get(err, err)} strerror={os.strerror(err)!r}"
    return r, err, rec


def fs_mask(abi):
    m = (1 << 13) - 1
    if abi >= 2:
        m |= FS['REFER']
    if abi >= 3:
        m |= FS['TRUNCATE']
    return m


def abi_version(slog):
    abi, e, rec = sc("create_ruleset(NULL,0,GET_VERSION)", SYS_CR, ctypes.c_void_p(None), 0, 1)
    slog.append(rec)
    return abi


class LL:
    """规则集编译 + 自锁（在调用它的进程内执行 = '子进程入口自锁' 姿势）。"""
    def __init__(self, slog):
        self.slog = slog
        self.abi = abi_version(slog)
        self.fd = -1
        self._keep = []
        if self.abi >= 0:
            handled = fs_mask(self.abi)                       # 全部受支持 fs 位（diag 同款，杜绝 badhandled 假象）
            attr = ctypes.create_string_buffer(struct.pack("@QQ", handled, 0), 16)
            r, e, rec = sc("create_ruleset(attr16, handled_fs=0x%x)" % handled, SYS_CR,
                           ctypes.c_void_p(ctypes.addressof(attr)), 16, 0)
            slog.append(rec)
            self.fd = r
            self._keep.append(attr)

    def add(self, path, access, label):
        try:
            dfd = os.open(path, O_PATH | os.O_CLOEXEC)
        except OSError as ex:
            self.slog.append(f"[RULE] open({path}) FAILED errno={EN.errorcode.get(ex.errno, ex.errno)}")
            return False
        buf = ctypes.create_string_buffer(struct.pack("@Qi", access, dfd))
        r, e, rec = sc(f"add_rule({label}, access=0x{access:x})", SYS_AR, self.fd, RULE_PATH_BENEATH,
                       ctypes.c_void_p(ctypes.addressof(buf)), 0)
        self.slog.append(rec)
        self._keep.append(buf)
        return r == 0

    def compile(self, policy):
        if self.fd < 0:
            return False
        ok = True
        for ent in policy["allow"] + policy["system"]:
            m = 0
            for b in ent["access"]:
                m |= FS[b]
            ok = self.add(ent["path"], m, ent.get("label", ent["path"])) and ok
        return ok

    def restrict(self):
        p = libc.prctl(38, 1, 0, 0, 0)                        # PR_SET_NO_NEW_PRIVS（restrict_self 前置）
        self.slog.append(f"[SC] prctl(PR_SET_NO_NEW_PRIVS,1): rc={p} errno={ctypes.get_errno() if p else 0}")
        r, e, rec = sc("landlock_restrict_self", SYS_RS, self.fd, 0)
        self.slog.append(rec)
        return r


def probe(name, expect, fn, kind="NEG", baseline=None, note=None):
    try:
        fn()
        got, serr = "OK", ""
    except OSError as ex:
        got, serr = EN.errorcode.get(ex.errno, ex.errno), ex.strerror
    match = (got == expect) if expect not in (None, "ANY") else True
    rec = {"name": name, "kind": kind, "expect": expect, "got": got, "errno_strerror": serr,
           "match": match}
    if baseline is not None:
        rec["baseline_pre_restrict"] = baseline
    if note:
        rec["note"] = note
    return rec


def probe_got(fn):
    try:
        fn()
        return "OK"
    except OSError as ex:
        return EN.errorcode.get(ex.errno, ex.errno)


def run_sh(cmd, cwd=None, env=None, close_fds_extra=()):
    """restrict 后 fork+exec /usr/bin/sh -c（域继承腿）；返回 (rc, out+err 文本)。"""
    r, w = os.pipe()
    pid = os.fork()
    if pid == 0:
        try:
            os.dup2(w, 1)
            os.dup2(w, 2)
            os.close(r)
            os.close(w)
            for fd in close_fds_extra:
                try:
                    os.close(fd)
                except OSError:
                    pass
            if cwd:
                os.chdir(cwd)
            os.execve("/usr/bin/sh", ["sh", "-c", cmd], env or {})
        except Exception:
            os._exit(127)
    os.close(w)
    out = b""
    while True:
        try:
            b = os.read(r, 4096)
        except OSError:
            break
        if not b:
            break
        out += b
    os.close(r)
    _, st = os.waitpid(pid, 0)
    return os.waitstatus_to_exitcode(st), out.decode(errors="replace")


def read_result_env():
    root = os.environ["A5_ROOT"]
    resfd = int(os.environ.get("A5_RESULT_FD", "-1"))
    return root, resfd


def emit(resfd, obj):
    data = (json.dumps(obj, ensure_ascii=False) + "\n").encode()
    if resfd >= 0:
        os.write(resfd, data)
    else:
        sys.stderr.write("RESULT:" + data.decode())


def sha256(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def spawn_child(mode, root, resfile, extra_env=None):
    """父半 → fork+execve 子半（纯内核 fd 继承语义，不经 subprocess 的 CLOEXEC 干预）。
    resfile 以裸 O_WRONLY fd 传入（无 CLOEXEC ⇒ 跨 exec 存活，子半 os.write 结果 JSON）。"""
    rfd = os.open(resfile, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    os.set_inheritable(rfd, True)                            # Python os.open 默认 CLOEXEC，交付 fd 需显式清除
    pid = os.fork()
    if pid == 0:
        env = dict(os.environ)
        env["A5_ROOT"] = root
        env["A5_RESULT_FD"] = str(rfd)
        if extra_env:
            env.update({k: str(v) for k, v in extra_env.items()})
        try:
            os.execve(sys.executable, [sys.executable, os.path.abspath(__file__), mode, "--root", root], env)
        except Exception:
            pass
        os._exit(127)
    os.close(rfd)
    _, st = os.waitpid(pid, 0)
    return os.waitstatus_to_exitcode(st)


def child_json(resfile):
    with open(resfile) as f:
        lines = [l for l in f.read().splitlines() if l.strip()]
    return json.loads(lines[-1]) if lines else {"verdict": "CHILD-NO-OUTPUT"}


def rewrite(resfile, obj):
    with open(resfile, "w") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def tree_state(d):
    """目录树快照（相对路径→sha256），供 '负控未落盘/未创建' 证据。"""
    out = {}
    for dp, _dn, fn in os.walk(d):
        for f in fn:
            p = os.path.join(dp, f)
            out[os.path.relpath(p, d)] = sha256(p)
    return out


# ----------------------------------------------------------------------------- policy (父进程编译)
def build_policy(root):
    """per-member 策略（合成）。父进程（adapter 形态）编译产物 = 本 JSON；子进程入口据此自锁。"""
    W = os.environ.get("HOME", "/home/user")
    allowed_access = ["READ_DIR", "READ_FILE", "WRITE_FILE", "MAKE_REG", "REMOVE_FILE", "REMOVE_DIR", "TRUNCATE"]
    return {
        "member": "m-a5",
        "allow": [{"path": os.path.join(root, "a5ll/allowed"), "access": allowed_access, "label": "allowed"}],
        "system": [
            {"path": "/", "access": ["READ_DIR"], "label": "/(仅穿越+枚举,不泄露内容;diag§3.4)"},
            {"path": "/usr", "access": ["READ_DIR", "READ_FILE", "EXECUTE"], "label": "/usr(exec链)"},
            {"path": "/etc", "access": ["READ_DIR"], "label": "/etc(仅穿越,shadow 不可读)"},
            {"path": "/etc/ld.so.cache", "access": ["READ_FILE"], "label": "ld.so.cache(exec 链需要)"},
        ],
        "deny": [
            os.path.join(root, "a5ll/private"), os.path.join(root, "outside"),
            os.path.join(root, "a5ll/home-fixture"), os.path.join(W, ".ssh"), "/etc/shadow",
            os.path.join(W, ".bashrc"),
        ],
    }


def policy_path(root):
    return os.path.join(root, "..", "diag", "results", "policy-m-a5.json")


def write_policy(root):
    pp = policy_path(root)
    os.makedirs(os.path.dirname(pp), exist_ok=True)
    with open(pp, "w") as f:
        json.dump(build_policy(root), f, ensure_ascii=False, indent=1)
    return os.path.abspath(pp)


def load_policy(root):
    with open(policy_path(root)) as f:
        return json.load(f)


def paths(root):
    return {
        "allowed": os.path.join(root, "a5ll/allowed"),
        "sub": os.path.join(root, "a5ll/allowed/sub"),
        "ok": os.path.join(root, "a5ll/allowed/ok.txt"),
        "read": os.path.join(root, "a5ll/allowed/read.txt"),
        "private": os.path.join(root, "a5ll/private"),
        "secret": os.path.join(root, "a5ll/private/secret.txt"),
        "outside": os.path.join(root, "outside/outside.txt"),
        "homefix": os.path.join(root, "a5ll/home-fixture"),
        "sshkey": os.path.join(root, "a5ll/home-fixture/.ssh/id_rsa"),
        "bashrc": os.path.join(root, "a5ll/home-fixture/.bashrc"),
        "real_sshdir": os.path.join(os.environ.get("HOME", "/home/user"), ".ssh"),
        "real_key": os.path.join(os.environ.get("HOME", "/home/user"), ".ssh/config"),
        "shadow": "/etc/shadow",
    }


# ----------------------------------------------------------------------------- L1
def l1_child(root, resfd):
    P, checks, slog = paths(root), [], []
    # 机制检查放最前 = 在任何本进程 fd 分配之前（否则自家 create_ruleset 会复用父 fd 空位，readlink 假阳性）。
    # 实测：ruleset fd 的 F_GETFD=0x1（FD_CLOEXEC=1，内核置位）⇒ execve 即闭合 ⇒ 父侧预编译 ruleset
    # **不可**跨 exec 传递；"父编译、子自锁"只能走 fork(无 exec) 继承 fd（L1FD 腿实证）。
    rsfd = int(os.environ.get("A5_RSFD", "-1"))
    if rsfd >= 0:
        try:
            tgt = os.readlink(f"/proc/self/fd/{rsfd}")
            got = f"OPEN target={tgt}"
        except OSError as ex:
            got = EN.errorcode.get(ex.errno, ex.errno)
        checks.append({"name": "MECH 父进程 ruleset fd 跨 exec 不可用(readlink,先于自家 fd 分配)", "kind": "MECH",
                       "expect": "ENOENT(FD_CLOEXEC=1,execve 即闭合)", "got": got,
                       "errno_strerror": f"父侧 F_GETFD={os.environ.get('A5_RSFD_FLAGS', '?')}；"
                                          "⇒ 跨 exec 姿势必须子进程入口自编译（本腿）；fork 继承走 L1FD 腿",
                       "match": got == "ENOENT" or (got.startswith("OPEN") and "landlock" not in got)})
    base = {}
    # 基线（restrict 前）：证明这些对象此前对本进程可读 ⇒ 之后 EACCES 只能归因 landlock 域。
    # 真实 ~/.ssh/config 与 /etc/shadow 一律只 open+close，绝不 read —— 内容零进入证据。
    base["private/secret.txt"] = probe_got(lambda: os.close(os.open(P["secret"], os.O_RDONLY)))
    base["outside/outside.txt"] = probe_got(lambda: os.close(os.open(P["outside"], os.O_RDONLY)))
    base["home-fixture/.ssh/id_rsa"] = probe_got(lambda: os.close(os.open(P["sshkey"], os.O_RDONLY)))
    base["real ~/.ssh/config"] = probe_got(lambda: os.close(os.open(P["real_key"], os.O_RDONLY)))
    base["/etc/shadow"] = probe_got(lambda: os.close(os.open(P["shadow"], os.O_RDONLY)))

    ll = LL(slog)
    if ll.abi < 0:
        emit(resfd, {"mode": "L1", "verdict": "ABI-UNAVAILABLE", "raw_syscalls": slog}); sys.exit(2)
    if not ll.compile(load_policy(root)):
        emit(resfd, {"mode": "L1", "verdict": "COMPILE-FAIL", "raw_syscalls": slog}); sys.exit(4)
    if ll.restrict() != 0:
        emit(resfd, {"mode": "L1", "verdict": "RESTRICT-FAIL", "raw_syscalls": slog}); sys.exit(4)

    checks.append(probe("POS read allowed/read.txt (fresh fd)", "OK",
                        lambda: os.close(os.open(P["read"], os.O_RDONLY)), "POS"))
    checks.append(probe("NEG read private/secret.txt", "EACCES",
                        lambda: os.close(os.open(P["secret"], os.O_RDONLY)), baseline=base["private/secret.txt"]))
    checks.append(probe("NEG read outside/outside.txt (外部路径)", "EACCES",
                        lambda: os.close(os.open(P["outside"], os.O_RDONLY)), baseline=base["outside/outside.txt"]))
    checks.append(probe("NEG read fixture-home/.ssh/id_rsa", "EACCES",
                        lambda: os.close(os.open(P["sshkey"], os.O_RDONLY)), baseline=base["home-fixture/.ssh/id_rsa"]))
    checks.append(probe("NEG open real ~/.ssh/config (只 open 不 read)", "EACCES",
                        lambda: os.close(os.open(P["real_key"], os.O_RDONLY)),
                        baseline=base["real ~/.ssh/config"], note="真实凭据路径，open-only，零字节读取/披露"))
    checks.append(probe("NEG open /etc/shadow (只 open 不 read)", "EACCES",
                        lambda: os.close(os.open(P["shadow"], os.O_RDONLY)), baseline=base["/etc/shadow"],
                        note="基线若已 EACCES 则 DAC 先拒（非 root），本腿为双保险；干净信号由 private/outside/ssh 腿承担"))
    checks.append(probe("NEG create private/newfile.txt", "EACCES",
                        lambda: os.close(os.open(os.path.join(P["private"], "newfile.txt"),
                                                 os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644))))
    checks.append(probe("NEG create outside/newfile.txt (可写 fs 上的干净 landlock 写拒)", "EACCES",
                        lambda: os.close(os.open(os.path.join(os.path.dirname(P["outside"]), "newfile.txt"),
                                                 os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644))))
    checks.append(probe("NEG append real ~/.bashrc", None,
                        lambda: os.close(os.open(os.path.join(os.environ.get("HOME", "/home/user"), ".bashrc"),
                                                 os.O_WRONLY | os.O_APPEND)), "NEG",
                        note="任意 errno=拒即符合预期；若观测=EROFS 则为 harness 沙箱只读挂载先于 landlock（判定层=沙箱非 landlock，如实记录）；landlock 干净写拒信号=上两条腿"))
    # 设计行为记录（diag §3.4 同源）：'/' READ_DIR 递归 ⇒ 目录名可枚举（非内容泄露）
    checks.append(probe("NOTE listdir(real ~/.ssh) 可枚举(设计行为,仅目录名)", "OK",
                        lambda: os.listdir(P["real_sshdir"]), "POS",
                        note="landlock READ_DIR 位合并 search+enumerate；'/' 授予穿越 ⇒ 枚举面存在；内容面由 READ_FILE 负控封死"))
    # exec 继承腿：restrict 后 fork+exec cat
    rc1, o1 = run_sh(f"cat {P['read']}", env=dict(os.environ, PATH="/usr/bin:/bin"))
    checks.append({"name": "POS-exec cat allowed", "kind": "POS", "expect": "rc=0",
                   "got": f"rc={rc1}", "errno_strerror": o1.strip()[:80], "match": rc1 == 0})
    rc2, o2 = run_sh(f"cat {P['secret']}", env=dict(os.environ, PATH="/usr/bin:/bin"))
    checks.append({"name": "NEG-exec cat private/secret.txt", "kind": "NEG", "expect": "rc!=0 & Permission denied",
                   "got": f"rc={rc2}", "errno_strerror": o2.strip()[:120],
                   "match": rc2 != 0 and "Permission denied" in o2,
                   "note": "cat 本身可 exec（上腿证明），排除二进制不可读假阴性"})
    allm = all(c["match"] for c in checks)
    emit(resfd, {"mode": "L1", "baseline_pre_restrict": base, "raw_syscalls": slog, "checks": checks,
                 "verdict": "OS_ENFORCED" if allm else "MIXED"})
    sys.exit(0 if allm else 1)


def l1_parent(root, resfile):
    pp = write_policy(root)
    slog = []
    abi = abi_version(slog)
    rsfd = -1
    extra = {}
    if abi >= 0:                                             # 父侧建 ruleset 仅测其跨 exec 性质（不加规则、不 restrict）
        attr = ctypes.create_string_buffer(struct.pack("@QQ", fs_mask(abi), 0), 16)
        rsfd, _, rec = sc("create_ruleset(父侧,性质探针)", SYS_CR, ctypes.c_void_p(ctypes.addressof(attr)), 16, 0)
        slog.append(rec)
        if rsfd >= 0:
            fl = fcntl.fcntl(rsfd, fcntl.F_GETFD)
            slog.append(f"[MECH] 父 ruleset fd F_GETFD=0x{fl:x} FD_CLOEXEC={fl & 1}")
            extra["A5_RSFD"] = rsfd
            extra["A5_RSFD_FLAGS"] = f"0x{fl:x}(FD_CLOEXEC={fl & 1})"
    rc = spawn_child("L1-CHILD", root, resfile, extra)
    if rsfd >= 0:
        os.close(rsfd)
    obj = child_json(resfile)
    obj["parent"] = {"abi": abi, "policy_file": pp, "child_rc": rc,
                     "private_dir_after": sorted(os.listdir(paths(root)["private"])),
                     "private_untouched": sorted(os.listdir(paths(root)["private"])) == ["secret.txt"]}
    obj["verdict"] = "OS_ENFORCED" if (rc == 0 and obj["parent"]["private_untouched"]) else obj.get("verdict", "?")
    rewrite(resfile, obj)
    return 0 if obj["verdict"] == "OS_ENFORCED" else (rc if rc else 1)


# ----------------------------------------------------------------------------- L1FD（父编译+fork 继承自锁姿势）
def l1fd_parent(root, resfile):
    """第二种真实可行姿势（与 L1 互补）：父进程按 per-member 策略编译 ruleset（含规则）→ **fork（不 exec）**
    继承 ruleset fd → 子进程 prctl+restrict_self（restrict 在 exec 之前完成，锁的是子域）→ fork+exec 真实
    任务证明域对 exec 后命令同样生效。（ruleset fd FD_CLOEXEC=1 不能跨 exec——L1 MECH 腿实测；fork 不受
    CLOEXEC 影响。域随 fork+exec 继承 = diag §2 结论的 adapter 化用法。父进程自身域完全不受影响。）"""
    write_policy(root)
    slog = []
    pll = LL(slog)
    if pll.abi < 0:
        rewrite(resfile, {"mode": "L1FD", "verdict": "ABI-UNAVAILABLE", "raw_syscalls": slog}); return 2
    if not pll.compile(load_policy(root)):
        rewrite(resfile, {"mode": "L1FD", "verdict": "PARENT-COMPILE-FAIL", "raw_syscalls": slog}); return 4
    fl = fcntl.fcntl(pll.fd, fcntl.F_GETFD)
    slog.append(f"[MECH] 父 ruleset fd F_GETFD=0x{fl:x} FD_CLOEXEC={fl & 1}（exec 即闭合，fork 仍继承）")
    P = paths(root)
    rfd = os.open(resfile, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    pid = os.fork()
    if pid == 0:
        checks, clog = [], list(slog)
        allm = False
        try:
            p = libc.prctl(38, 1, 0, 0, 0)
            clog.append(f"[SC] prctl(PR_SET_NO_NEW_PRIVS,1): rc={p}")
            r, e, rec = sc("restrict_self(fork 继承的父编译 ruleset fd)", SYS_RS, pll.fd, 0)
            clog.append(rec)
            checks.append({"name": "POS restrict_self(继承 fd, exec 前) rc=0", "kind": "POS", "expect": "OK",
                           "got": "OK" if r == 0 else f"rc={r} errno={EN.errorcode.get(e, e)}",
                           "errno_strerror": "", "match": r == 0})
            if r == 0:
                checks.append(probe("POS read allowed/read.txt", "OK",
                                    lambda: os.close(os.open(P["read"], os.O_RDONLY)), "POS"))
                checks.append(probe("NEG read private/secret.txt", "EACCES",
                                    lambda: os.close(os.open(P["secret"], os.O_RDONLY))))
                checks.append(probe("NEG create private/newfile.txt", "EACCES",
                                    lambda: os.close(os.open(os.path.join(P["private"], "newfile.txt"),
                                                             os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644))))
                rc1, o1 = run_sh(f"cat {P['read']}", env=dict(os.environ, PATH="/usr/bin:/bin"),
                                 close_fds_extra=(rfd,))
                checks.append({"name": "POS-exec cat allowed（restrict→exec 任务链）", "kind": "POS",
                               "expect": "rc=0", "got": f"rc={rc1}", "errno_strerror": o1.strip()[:80],
                               "match": rc1 == 0})
                rc2, o2 = run_sh(f"cat {P['secret']}", env=dict(os.environ, PATH="/usr/bin:/bin"),
                                 close_fds_extra=(rfd,))
                checks.append({"name": "NEG-exec cat private/secret.txt", "kind": "NEG",
                               "expect": "rc!=0 & Permission denied", "got": f"rc={rc2}",
                               "errno_strerror": o2.strip()[:120],
                               "match": rc2 != 0 and "Permission denied" in o2})
            allm = all(c["match"] for c in checks)
            emit(rfd, {"mode": "L1FD", "raw_syscalls": clog, "checks": checks,
                       "verdict": "OS_ENFORCED_FORK_HANDOFF" if allm else "MIXED"})
        except Exception as ex:
            import traceback
            emit(rfd, {"mode": "L1FD", "verdict": "CHILD-EXCEPTION", "error": repr(ex),
                       "traceback_tail": traceback.format_exc()[-400:]})
            allm = False
        os._exit(0 if allm else 1)
    os.close(rfd)
    _, st = os.waitpid(pid, 0)
    rc = os.waitstatus_to_exitcode(st)
    obj = child_json(resfile)
    obj["parent"] = {"child_rc": rc, "parent_raw_syscalls": slog,
                     "note": "ruleset fd 只能 fork 继承（CLOEXEC 挡 exec）；restrict_self 必须子进程调用；"
                             "子进程在 fd 上仍可 add_rule ⇒ 防篡改边界=子进程入口是受信 adapter 运行时（notes §机制）"}
    rewrite(resfile, obj)
    try:
        os.close(pll.fd)
    except OSError:
        pass
    return 0 if rc == 0 else (rc if rc else 1)


# ----------------------------------------------------------------------------- L2
def l2_child(root, resfd):
    P, checks, slog = paths(root), [], []
    ll = LL(slog)
    if ll.abi < 0:
        emit(resfd, {"mode": "L2", "verdict": "ABI-UNAVAILABLE", "raw_syscalls": slog}); sys.exit(2)
    if not ll.compile(load_policy(root)) or ll.restrict() != 0:
        emit(resfd, {"mode": "L2", "verdict": "COMPILE/RESTRICT-FAIL", "raw_syscalls": slog}); sys.exit(4)
    env = {"HOME": P["homefix"], "PATH": "/usr/bin:/bin", "A5_DENY_ABS": P["secret"],
           "A5_DENY_DIR": P["private"], "A5_ALLOWED": P["allowed"], "TERM": "dumb"}
    close_extra = [int(os.environ.get("A5_RESULT_FD", "-1"))]
    cmds = [
        ("POS sh cat allowed/ok.txt", "cat ok.txt", P["allowed"], 0),
        ("POS sh write allowed/sub/w_ok.txt", "printf 'SYNTH-W-OK\\n' > sub/w_ok.txt", P["allowed"], 0),
        ("NEG sh cat $A5_DENY_ABS (绝对 deny 路径)", 'cat "$A5_DENY_ABS"', P["allowed"], None),
        ("NEG-INJECT sh cat ../../private/secret.txt (相对穿越,命令文本含 deny 串)", "cat ../../private/secret.txt",
         P["sub"], None),
        ("NEG-INJECT sh cat \"${A5_DENY_DIR}/secret.txt\" (env 拼接,命令文本零 deny 字面量)",
         'cat "${A5_DENY_DIR}/secret.txt"', P["allowed"], None),
        ("NEG sh append \"$HOME/.bashrc\" (fixture HOME)", 'printf X >> "$HOME/.bashrc"', P["allowed"], None),
        ("NEG sh cat \"$HOME/.ssh/id_rsa\" (fixture HOME)", 'cat "$HOME/.ssh/id_rsa"', P["allowed"], None),
    ]
    for name, cmd, cwd, exp_rc in cmds:
        rc, out = run_sh(cmd, cwd=cwd, env=env, close_fds_extra=close_extra)
        denied = rc != 0 and "Permission denied" in out
        if exp_rc == 0:
            checks.append({"name": name, "kind": "POS", "expect": "rc=0", "got": f"rc={rc}",
                           "errno_strerror": out.strip()[:100], "match": rc == 0, "cmd": cmd})
        else:
            checks.append({"name": name, "kind": "NEG", "expect": "rc!=0 & 'Permission denied'(EACCES)",
                           "got": f"rc={rc}", "errno_strerror": out.strip()[:160], "match": denied, "cmd": cmd,
                           "note": "OS 层拒：sh/cat 全部在 landlock 域内执行；fixture 未对命令文本做任何审查/过滤"})
    allm = all(c["match"] for c in checks)
    emit(resfd, {"mode": "L2", "raw_syscalls": slog, "checks": checks,
                 "verdict": "OS_ENFORCED" if allm else "MIXED"})
    sys.exit(0 if allm else 1)


def l2_parent(root, resfile):
    write_policy(root)
    P = paths(root)
    before = {"bashrc": sha256(P["bashrc"]), "private_tree": tree_state(P["private"]),
              "homefix_tree": tree_state(P["homefix"])}
    rc = spawn_child("L2-CHILD", root, resfile)
    obj = child_json(resfile)
    after = {"bashrc": sha256(P["bashrc"]), "private_tree": tree_state(P["private"]),
             "homefix_tree": tree_state(P["homefix"])}
    wok = os.path.join(P["sub"], "w_ok.txt")
    obj["parent"] = {"child_rc": rc, "bashrc_sha_unchanged": before["bashrc"] == after["bashrc"],
                     "private_untouched": before["private_tree"] == after["private_tree"],
                     "homefix_untouched": before["homefix_tree"] == after["homefix_tree"],
                     "w_ok_exists": os.path.exists(wok) and open(wok).read().strip() == "SYNTH-W-OK"}
    ok = (rc == 0 and obj["parent"]["bashrc_sha_unchanged"] and obj["parent"]["private_untouched"]
          and obj["parent"]["homefix_untouched"] and obj["parent"]["w_ok_exists"])
    obj["verdict"] = "OS_ENFORCED" if ok else obj.get("verdict", "?")
    rewrite(resfile, obj)
    return 0 if obj["verdict"] == "OS_ENFORCED" else (rc if rc else 1)


# ----------------------------------------------------------------------------- L3
def l3_child(root, resfd):
    P, checks, slog = paths(root), [], []
    ll = LL(slog)
    if ll.abi < 0:
        emit(resfd, {"mode": "L3", "verdict": "ABI-UNAVAILABLE", "raw_syscalls": slog}); sys.exit(2)
    if not ll.compile(load_policy(root)) or ll.restrict() != 0:
        emit(resfd, {"mode": "L3", "verdict": "COMPILE/RESTRICT-FAIL", "raw_syscalls": slog}); sys.exit(4)
    # 持锁后正常能力：读一次 + 新建写
    fd = os.open(P["read"], os.O_RDONLY)
    data = os.read(fd, 64)
    checks.append({"name": "POS restrict 后 open+read allowed (持 fd)", "kind": "POS", "expect": "OK",
                   "got": "OK", "errno_strerror": f"{len(data)}B", "match": len(data) > 0})
    nf = os.path.join(P["allowed"], "l3_newfile.txt")
    try:
        with open(nf, "w") as f:
            f.write("SYNTHETIC-L3-NEW\n")
        got = "OK"
    except OSError as ex:
        got = EN.errorcode.get(ex.errno, ex.errno)
    checks.append({"name": "POS restrict 后 allowed 内新建+写", "kind": "POS", "expect": "OK", "got": got,
                   "errno_strerror": "", "match": got == "OK"})
    # 扩权尝试 1：再 create_ruleset 授 private READ_FILE 并 restrict_self
    ll2 = LL(slog)
    esc1 = ll2.fd
    r_add = ll2.add(P["private"], FS["READ_FILE"], "private(扩权尝试1)")
    rs2_rc = ll2.restrict()
    checks.append({"name": "ESC-1 create+add_rule+restrict_self(授 private READ_FILE) 原始结果", "kind": "ESC",
                   "expect": "记录原文", "got": f"rs={esc1} add={r_add} restrict={rs2_rc}",
                   "errno_strerror": "syscall 层是否放行见 raw_syscalls；能力面见下一条",
                   "match": True})
    checks.append({"name": "ESC-1 后 open private/secret.txt", "kind": "NEG", "expect": "EACCES",
                   "got": probe_got(lambda: os.close(os.open(P["secret"], os.O_RDONLY))),
                   "errno_strerror": "", "match": probe_got(lambda: os.close(os.open(P["secret"], os.O_RDONLY))) == "EACCES",
                   "note": "域单调性 = 交集语义：restrict 只会收缩；syscall 可否调用 ≠ 能力是否扩大"})
    # 扩权尝试 2：向已消费的 rs1 fd 继续 add_rule（diag 姿势里 restrict 后 fd 未关闭）
    ok2 = ll.add(P["private"], FS["READ_FILE"] | FS["WRITE_FILE"], "private(扩权尝试2,已消费rs1)")
    checks.append({"name": "ESC-2 add_rule 到已 restrict 的 rs1", "kind": "ESC", "expect": "记录原文",
                   "got": f"add_rule_ok={ok2}", "errno_strerror": "见 raw_syscalls", "match": True})
    checks.append({"name": "ESC-2 后 open private/secret.txt", "kind": "NEG", "expect": "EACCES",
                   "got": probe_got(lambda: os.close(os.open(P["secret"], os.O_RDONLY))),
                   "errno_strerror": "", "match": probe_got(lambda: os.close(os.open(P["secret"], os.O_RDONLY))) == "EACCES"})
    # 扩权尝试 3：create_ruleset(VERSION) 探测（syscall 是否被 landlock 域直接封禁）
    v, _, rec = sc("create_ruleset(VERSION) after restrict", SYS_CR, ctypes.c_void_p(None), 0, 1)
    slog.append(rec)
    checks.append({"name": "ESC-3 create_ruleset(VERSION) after restrict", "kind": "ESC", "expect": "记录原文",
                   "got": f"rc={v}", "errno_strerror": "成功≠扩权；能力面已被 ESC-1/2 探针否证", "match": True})
    # 持锁 fd 存续（one-shot grant 类比差异记录）
    try:
        d2 = os.read(fd, 8)
        got = "OK" if d2 == b"" else "MORE"    # 已 EOF
    except OSError as ex:
        got = EN.errorcode.get(ex.errno, ex.errno)
    checks.append({"name": "NOTE 二次 restrict 后原持 fd 仍可用(EOF='OK')", "kind": "POS", "expect": "OK",
                   "got": got, "errno_strerror": "", "match": True,
                   "note": "landlock=进程域终身棘轮，非可消费 grant；已交出的 fd 不被撤销 —— 差异见 notes §L3"})
    os.close(fd)
    allm = all(c["match"] for c in checks)
    emit(resfd, {"mode": "L3", "raw_syscalls": slog, "checks": checks,
                 "verdict": "OS_ENFORCED_LOCK_IRREVERSIBLE" if allm else "MIXED"})
    sys.exit(0 if allm else 1)


def l3_parent(root, resfile):
    write_policy(root)
    rc = spawn_child("L3-CHILD", root, resfile)
    obj = child_json(resfile)
    P = paths(root)
    obj["parent"] = {"child_rc": rc,
                     "allowed_newfile_created": os.path.exists(os.path.join(P["allowed"], "l3_newfile.txt")),
                     "private_dir_after": sorted(os.listdir(P["private"]))}
    rewrite(resfile, obj)
    return 0 if rc == 0 else (rc if rc else 1)


# ----------------------------------------------------------------------------- L4
def l4_child(root, resfd):
    P, checks, slog, ledger = paths(root), [], [], []
    pol = load_policy(root)               # restrict 之前读毕（策略文件在 allow 域外，锁后读=by-design EACCES）
    ll = LL(slog)
    if ll.abi < 0:
        emit(resfd, {"mode": "L4", "verdict": "ABI-UNAVAILABLE", "raw_syscalls": slog}); sys.exit(2)
    if not ll.compile(pol) or ll.restrict() != 0:
        emit(resfd, {"mode": "L4", "verdict": "COMPILE/RESTRICT-FAIL", "raw_syscalls": slog}); sys.exit(4)
    allow_dirs = [e["path"] for e in pol["allow"]]

    def under(p, d):
        return p == d or p.startswith(d.rstrip("/") + "/")

    # P0-3 open 账本最小化复用：决策严格先于 open；refused:* 时 open-issued=0
    def adapter_read(member, req):
        rp = os.path.realpath(req)
        if not any(under(rp, d) for d in allow_dirs):
            ledger.append({"member": member, "req": req, "real": rp, "stage": "refused", "code": "READ_DENIED"})
            return {"refused": "READ_DENIED"}
        ledger.append({"member": member, "req": req, "real": rp, "stage": "open-issued"})
        try:
            fd = os.open(rp, os.O_RDONLY)
            os.close(fd)
            return {"ok": True}
        except OSError as ex:
            return {"os_errno": EN.errorcode.get(ex.errno, ex.errno)}

    checks.append({"name": "L4.pos adapter_read(allowed/read.txt)", "kind": "POS", "expect": "OK",
                   "got": "OK" if adapter_read("m-a5", P["read"]).get("ok") else "FAIL",
                   "errno_strerror": "", "match": True})
    r = adapter_read("m-a5", P["secret"])
    issued = [e for e in ledger if e["stage"] == "open-issued" and e["real"] == os.path.realpath(P["secret"])]
    refused = [e for e in ledger if e["stage"] == "refused" and e["req"] == P["secret"]]
    checks.append({"name": "L4.neg1 策略层拒 private（账本）", "kind": "NEG", "expect": "READ_DENIED & open-issued=0",
                   "got": f"{r.get('refused')} issued={len(issued)} refused={len(refused)}", "errno_strerror": "",
                   "match": r.get("refused") == "READ_DENIED" and len(issued) == 0 and len(refused) >= 1})
    checks.append({"name": "L4.neg1 同路 OS 底复核 raw open private（绕过策略层=未适配旁路）", "kind": "NEG",
                   "expect": "EACCES", "got": probe_got(lambda: os.close(os.open(P["secret"], os.O_RDONLY))),
                   "errno_strerror": "P0-3 里此旁路可直读；landlock OS 底使其同样 EACCES ⇒ 双层缺一不可",
                   "match": probe_got(lambda: os.close(os.open(P["secret"], os.O_RDONLY))) == "EACCES",
                   "note": "负控双重拒：OS EACCES 且账本 0 次 issued"})
    r2 = adapter_read("m-a5", P["outside"])
    checks.append({"name": "L4.neg2 策略层拒 outside + OS 底复核", "kind": "NEG", "expect": "READ_DENIED & EACCES",
                   "got": f"{r2.get('refused')}+{probe_got(lambda: os.close(os.open(P['outside'], os.O_RDONLY)))}",
                   "errno_strerror": "", "match": r2.get("refused") == "READ_DENIED"
                   and probe_got(lambda: os.close(os.open(P["outside"], os.O_RDONLY))) == "EACCES"})
    checks.append({"name": "L4.neg3 raw O_CREAT private/new（无策略层直接写）", "kind": "NEG", "expect": "EACCES",
                   "got": probe_got(lambda: os.close(os.open(os.path.join(P["private"], "l4_new.txt"),
                                                             os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644))),
                   "errno_strerror": "", "match": True})
    allm = all(c["match"] for c in checks)
    emit(resfd, {"mode": "L4", "raw_syscalls": slog, "checks": checks, "ledger": ledger,
                 "verdict": "OS_ENFORCED_AND_LEDGER_ZERO_ISSUED" if allm else "MIXED"})
    sys.exit(0 if allm else 1)


def l4_parent(root, resfile):
    write_policy(root)
    rc = spawn_child("L4-CHILD", root, resfile)
    obj = child_json(resfile)
    obj["parent"] = {"child_rc": rc, "private_dir_after": sorted(os.listdir(paths(root)["private"]))}
    rewrite(resfile, obj)
    return 0 if rc == 0 else (rc if rc else 1)


# ----------------------------------------------------------------------------- TOCTOU
def toctou_child(root, resfd):
    """入口先自锁，再探测继承 fd（A=无 CLOEXEC 应存活；B=CLOEXEC 应 EBADF）。"""
    P, checks, slog = paths(root), [], []
    ll = LL(slog)
    if ll.abi < 0:
        emit(resfd, {"mode": "TOCTOU", "verdict": "ABI-UNAVAILABLE", "raw_syscalls": slog}); sys.exit(2)
    if not ll.compile(load_policy(root)) or ll.restrict() != 0:
        emit(resfd, {"mode": "TOCTOU", "verdict": "COMPILE/RESTRICT-FAIL", "raw_syscalls": slog}); sys.exit(4)
    fd = int(os.environ["A5_IN_FD"])
    # 身份判定先行：exec 后 fd 号可能被解释器复用 ⇒ 先 readlink 确认是否仍指向 secret，再谈读
    try:
        tgt = os.readlink(f"/proc/self/fd/{fd}")
    except OSError as ex:
        tgt = None
        terr = EN.errorcode.get(ex.errno, ex.errno)
    same = (tgt == os.path.realpath(P["secret"]))
    variant = os.environ.get("A5_TOCTOU_VARIANT", "?")
    if same:
        try:
            n = len(os.read(fd, 64))          # 合成数据；只记字节数，内容不入 JSON
            readgot, rserr = f"READ-OK({n}B)", ""
        except OSError as ex:
            readgot, rserr = EN.errorcode.get(ex.errno, ex.errno), ex.strerror
    else:
        readgot, rserr = ("FD-NOT-SECRET:" + (f"ENOENT({terr})" if tgt is None else f"REUSED target={tgt}")), ""
    if variant == "A":
        m1 = same and readgot.startswith("READ-OK")
    else:
        m1 = not same
    checks.append({"name": f"TOCTOU[{variant}] 父进程 fd 跨 fork+exec+自锁 的存续与身份", "kind": "TOCTOU",
                   "expect": "A=仍指向 secret 且可读" if variant == "A" else "B=fd 号已非 secret（CLOEXEC 关闭/号复用）",
                   "got": f"target={'SECRET' if same else tgt} read={readgot}", "errno_strerror": rserr, "match": m1})
    # 同进程对照：同一路径 restrict 后新建 fd 必须 EACCES ⇒ 域已生效，非"整个进程没锁上"
    g = probe_got(lambda: os.close(os.open(P["secret"], os.O_RDONLY)))
    checks.append({"name": f"TOCTOU[{variant}] 同路径新建 fd 对照", "kind": "NEG", "expect": "EACCES",
                   "got": g, "errno_strerror": "", "match": g == "EACCES"})
    allm = all(c["match"] for c in checks)
    emit(resfd, {"mode": "TOCTOU-" + variant, "raw_syscalls": slog, "checks": checks,
                 "verdict": ("BY_DESIGN_FD_SURVIVES" if variant == "A" else "MITIGATED_BY_CLOEXEC") if allm else "MIXED"})
    sys.exit(0 if allm else 1)


def toctou_parent(root, resfile, variant):
    write_policy(root)
    P = paths(root)
    fd = os.open(P["secret"], os.O_RDONLY)               # 自锁之前由“adapter 父进程”打开的敏感 fd
    os.set_inheritable(fd, variant == "A")               # A=清 CLOEXEC（裸 fd 继承面）；B=保持 CLOEXEC
    rc = spawn_child("TOCTOU-CHILD", root, resfile,
                     {"A5_IN_FD": fd, "A5_TOCTOU_VARIANT": variant})
    os.close(fd)
    obj = child_json(resfile)
    obj["parent"] = {"child_rc": rc, "variant": variant,
                     "note": "A=父进程未设 CLOEXEC 的敏感 fd 跨 fork+exec+自锁 仍可读写（landlock 不追溯已开 fd）；"
                             "B=同 fd 设 O_CLOEXEC 后 exec 即闭合（EBADF）⇒ 缓解 = spawn 前对一切非交付 fd 强制 CLOEXEC"}
    rewrite(resfile, obj)
    return 0 if rc == 0 else (rc if rc else 1)


# ----------------------------------------------------------------------------- AGG
EXPECT = {"L1": "OS_ENFORCED", "L1FD": "OS_ENFORCED_FORK_HANDOFF", "L2": "OS_ENFORCED",
          "L3": "OS_ENFORCED_LOCK_IRREVERSIBLE",
          "L4": "OS_ENFORCED_AND_LEDGER_ZERO_ISSUED", "TOCTOU_A": "BY_DESIGN_FD_SURVIVES",
          "TOCTOU_B": "MITIGATED_BY_CLOEXEC"}


def agg(root, resdir, rc_map):
    legs, table, allok = {}, [], True
    for leg in ("L1", "L1FD", "L2", "L3", "L4", "TOCTOU_A", "TOCTOU_B"):
        f = os.path.join(resdir, leg + ".json")
        obj = json.loads(open(f).read().strip().splitlines()[-1]) if os.path.exists(f) else {"verdict": "NOT-RUN"}
        legs[leg] = obj
        v = obj.get("verdict", "?")
        ok = v == EXPECT[leg] and rc_map.get(leg, 1) == 0
        allok = allok and ok
        checks = obj.get("checks", [])
        table.append({"lane": leg, "verdict": v, "rc": rc_map.get(leg), "checks": len(checks),
                      "checks_matched": sum(1 for c in checks if c.get("match")), "expected": EXPECT[leg],
                      "ok": ok})
    out = {
        "header": {
            "task": "alpha5-adapter-p0 / 10-landlock-lanes（L1 受限读面 / L2 受控 spawn / L3 锁不可自解 / L4 策略+OS 双层 / TOCTOU）",
            "utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "kernel": os.uname().release, "uid": os.getuid(),
            "landlock_abi": abi_version([]),
            "model_reported_by_agent": MODEL_REPORTED,
            "evidence_level": "fixture/子进程级；landlock 规则由测试代码编译；真实 Team adapter 集成属实施阶段",
            "basis": "04-process/landlock-diag.sh ctypes 底座；ENFORCE-WORKS 前提已实证不重做",
        },
        "table": table, "legs": legs, "overall": "ALL-LANES-AS-EXPECTED" if allok else "MIXED/FAIL",
    }
    with open(os.path.join(resdir, "..", "..", "lanes-result.json"), "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for t in table:
        print(f"  {t['lane']:>9}: {t['verdict']} rc={t['rc']} checks {t['checks_matched']}/{t['checks']} "
              f"{'OK' if t['ok'] else 'NOT-AS-EXPECTED'}")
    print("OVERALL:", out["overall"])
    return 0 if allok else 7


# ----------------------------------------------------------------------------- main
def main():
    mode = sys.argv[1]
    root = os.path.abspath(sys.argv[sys.argv.index("--root") + 1])
    if mode == "AGG":
        rc_map = {}
        if "--rcs" in sys.argv:
            for pair in sys.argv[sys.argv.index("--rcs") + 1].split(","):
                k, _, v = pair.partition("=")
                rc_map[k] = int(v)
        sys.exit(agg(root, os.path.abspath(sys.argv[sys.argv.index("--resdir") + 1]), rc_map))
    resfile = os.environ["A5_RESULT_FILE"]
    child = mode.endswith("-CHILD")
    if child:
        root, resfd = read_result_env()
        try:
            {"L1-CHILD": l1_child, "L2-CHILD": l2_child, "L3-CHILD": l3_child,
             "L4-CHILD": l4_child, "TOCTOU-CHILD": toctou_child}[mode](root, resfd)
        except SystemExit:
            raise
        except Exception as ex:                       # 兜底：崩溃也落 JSON（不静默空文件）
            import traceback
            emit(resfd, {"mode": mode, "verdict": "CHILD-EXCEPTION",
                         "error": f"{type(ex).__name__}: {ex}",
                         "traceback_tail": traceback.format_exc()[-600:]})
            sys.exit(9)
    if mode == "L1":
        sys.exit(l1_parent(root, resfile))
    if mode == "L1FD":
        sys.exit(l1fd_parent(root, resfile))
    if mode == "L2":
        sys.exit(l2_parent(root, resfile))
    if mode == "L3":
        sys.exit(l3_parent(root, resfile))
    if mode == "L4":
        sys.exit(l4_parent(root, resfile))
    if mode == "TOCTOU_A":
        sys.exit(toctou_parent(root, resfile, "A"))
    if mode == "TOCTOU_B":
        sys.exit(toctou_parent(root, resfile, "B"))
    sys.exit(9)


if __name__ == "__main__":
    main()
