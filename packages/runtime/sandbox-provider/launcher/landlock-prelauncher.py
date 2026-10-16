#!/usr/bin/env python3
"""landlock-prelauncher — Alpha.5 PR4 (C Lane) reference TRUSTED PRE-LAUNCHER.

Mechanism = the measured posture of evidence/alpha5-adapter-p0: bare syscalls
444/445/446 via ctypes (NO liblandlock, NO npm prebuilt), every integer passed
as c_long (no 32-bit truncation), ruleset attr = pack("@QQ"), rule =
pack("@Qi"), prctl(PR_SET_NO_NEW_PRIVS) before landlock_restrict_self.

Scope discipline (identical to the PoC lanes): the process that runs this
script confines ITSELF and its children ONLY (P1 entry self-lock; P2 = fork
WITHOUT exec, then the child self-locks). It writes nothing outside the
scratch directory it is handed, touches no sysctl/module/namespace, and its
authoritative capability answer comes from the bare GET_VERSION syscall plus
REAL enforcement legs — never from an existence check.

Modes:
  --abi-probe
  --enforce-leg {selective,denyall,badhandled} --scratch DIR
  --fd-close --scratch DIR [--fd-plan-json JSON]
  --confined-exec --policy FILE --out-dir DIR     (P1: self-lock, then execve
                                                  the untrusted argv; NEVER
                                                  runs unconfined)

One single-line JSON verdict on stdout; diagnostics on stderr.
Exit codes: 0 usable answer; 2 ABI unavailable; 4 config/self-lock failure;
1 MIXED/FAILED leg.
"""
import ctypes
import errno as EN
import fcntl
import json
import os
import struct
import sys

SYS_CR, SYS_AR, SYS_RS = 444, 445, 446  # landlock_create_ruleset / add_rule / restrict_self
O_PATH = getattr(os, "O_PATH", 0o10000000)
FS = {'EXECUTE': 1 << 0, 'WRITE_FILE': 1 << 1, 'READ_FILE': 1 << 2, 'READ_DIR': 1 << 3,
      'REMOVE_DIR': 1 << 4, 'REMOVE_FILE': 1 << 5, 'MAKE_CHAR': 1 << 6, 'MAKE_DIR': 1 << 7,
      'MAKE_REG': 1 << 8, 'MAKE_SOCK': 1 << 9, 'MAKE_FIFO': 1 << 10, 'MAKE_BLOCK': 1 << 11,
      'MAKE_SYM': 1 << 12, 'REFER': 1 << 13, 'TRUNCATE': 1 << 14}

libc = ctypes.CDLL("libc.so.6", use_errno=True)
libc.syscall.restype = ctypes.c_long

RAW = []


def sc(label, nr, *args):
    argv = [ctypes.c_long(nr)]
    for a in args:
        argv.append(a if isinstance(a, ctypes.c_void_p) else ctypes.c_long(a))
    r = libc.syscall(*argv)
    err = ctypes.get_errno() if r == -1 else 0
    RAW.append(f"[SC] {label}: rc={r} errno={'0' if not err else EN.errorcode.get(err, err)} strerror={os.strerror(err)!r}")
    return r, err


def get_abi():
    abi, _ = sc("create_ruleset(NULL,0,GET_VERSION)", SYS_CR, ctypes.c_void_p(None), 0, 1)
    return abi


def fs_mask(abi):
    m = (1 << 13) - 1
    if abi >= 2:
        m |= FS['REFER']
    if abi >= 3:
        m |= FS['TRUNCATE']
    return m


def odir(p):
    return os.open(p, O_PATH | os.O_CLOEXEC)


def add_rule(rs, dirfd, access, abi):
    access &= fs_mask(abi)
    buf = ctypes.create_string_buffer(struct.pack("@Qi", access, dirfd))
    r, _ = sc(f"add_rule(access=0x{access:x})", SYS_AR, rs, 1, ctypes.c_void_p(ctypes.addressof(buf)), 0)
    buf._keep = True
    return r


def restrict(rs):
    libc.prctl(38, 1, 0, 0, 0)  # PR_SET_NO_NEW_PRIVS — precondition, inherited across fork+exec
    r, _ = sc("landlock_restrict_self", SYS_RS, rs, 0)
    return r


def chk(name, fn, expect):
    try:
        fn()
        got, det = "OK", ""
    except OSError as ex:
        got, det = EN.errorcode.get(ex.errno, ex.errno), ex.strerror
    match = (got == expect) if expect not in ("rc!=0",) else (got != "OK")
    return {"name": name, "expect": expect, "got": got, "strerror": det, "match": bool(match)}


def emit(obj, rc=0):
    print(json.dumps(obj, separators=(",", ":")))
    sys.exit(rc)


def run_child_captured(argv, out_w):
    """fork+exec /usr/bin-style child; its stdout+stderr go to out_w (same fd)."""
    pid = os.fork()
    if pid == 0:
        try:
            os.dup2(out_w, 1)
            os.dup2(out_w, 2)
            os.execve(argv[0], argv, {})
        except OSError:
            os._exit(120)
    return pid


# ---------------------------------------------------------------------------
# modes
# ---------------------------------------------------------------------------

def mode_abi_probe():
    abi = get_abi()
    if abi < 0:
        emit({"kind": "abi-unavailable", "abi_version": None, "raw": list(RAW)}, 2)
    emit({"kind": "abi-available", "abi_version": int(abi), "raw": list(RAW)}, 0)


def fixture_tree(s):
    for sub in ("allowed", "private", "other"):
        os.makedirs(os.path.join(s, sub), exist_ok=True)
    with open(os.path.join(s, "private", "secret.txt"), "w") as f:
        f.write("SYNTHETIC-SECRET\n" * 3)
    with open(os.path.join(s, "allowed", "ok.txt"), "w") as f:
        f.write("SYNTHETIC-OK-CONTROL")
    with open(os.path.join(s, "other", "outside.txt"), "w") as f:
        f.write("SYNTHETIC-OUTSIDE-CONTROL")
    return {
        "allowed": os.path.join(s, "allowed"),
        "private": os.path.join(s, "private"),
        "other": os.path.join(s, "other"),
        "secret": os.path.join(s, "private", "secret.txt"),
        "ok": os.path.join(s, "allowed", "ok.txt"),
        "outside": os.path.join(s, "other", "outside.txt"),
    }


def mode_enforce_leg(leg, scratch):
    abi = get_abi()
    if abi < 0:
        emit({"verdict": "ABI-UNAVAILABLE", "checks": [], "raw": list(RAW)}, 2)
    t = fixture_tree(scratch)
    handled = fs_mask(abi)
    checks = []
    if leg == "selective":
        checks.append(chk("BASE secret readable pre-restrict", lambda: os.close(os.open(t["secret"], os.O_RDONLY)), "OK"))
        checks.append(chk("BASE ok.txt readable pre-restrict", lambda: os.close(os.open(t["ok"], os.O_RDONLY)), "OK"))
        pre_fd = os.open(t["secret"], os.O_RDONLY)
        attr = ctypes.create_string_buffer(struct.pack("@QQ", handled, 0), 16)
        rs, _ = sc("create_ruleset(selective)", SYS_CR, ctypes.c_void_p(ctypes.addressof(attr)), 16, 0)
        if rs < 0:
            emit({"verdict": "MIXED/FAILED", "checks": [], "raw": list(RAW)}, 1)
        add_rule(rs, odir("/"), FS['READ_DIR'], abi)
        add_rule(rs, odir("/usr"), FS['READ_DIR'] | FS['READ_FILE'] | FS['EXECUTE'], abi)
        add_rule(rs, odir("/etc"), FS['READ_DIR'] | FS['READ_FILE'], abi)
        add_rule(rs, odir("/proc"), FS['READ_DIR'] | FS['READ_FILE'], abi)
        add_rule(rs, odir(t["allowed"]), FS['READ_DIR'] | FS['READ_FILE'] | FS['WRITE_FILE']
                 | FS['MAKE_REG'] | FS['REMOVE_FILE'] | FS['TRUNCATE'], abi)
        if restrict(rs) != 0:
            emit({"verdict": "MIXED/FAILED", "checks": checks, "raw": list(RAW)}, 4)
        checks.append(chk("NEG read private/secret.txt", lambda: os.close(os.open(t["secret"], os.O_RDONLY)), "EACCES"))
        checks.append(chk("NEG read other/outside.txt", lambda: os.close(os.open(t["outside"], os.O_RDONLY)), "EACCES"))
        checks.append(chk("NEG create private/new.txt", lambda: os.close(os.open(os.path.join(t["private"], "new.txt"),
                            os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)), "EACCES"))
        checks.append(chk("NEG create other/newfile.txt", lambda: os.close(os.open(os.path.join(t["other"], "newfile.txt"),
                            os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)), "EACCES"))
        checks.append(chk("POS read allowed/ok.txt", lambda: os.close(os.open(t["ok"], os.O_RDONLY)), "OK"))
        checks.append(chk("POS write allowed/new.txt", lambda: os.close(os.open(os.path.join(t["allowed"], "new.txt"),
                            os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)), "OK"))
        checks.append(chk("POS read /etc/hostname", lambda: os.close(os.open("/etc/hostname", os.O_RDONLY)), "OK"))
        checks.append(chk("NOTE pre-restrict fd read (by-design OK)", lambda: os.read(pre_fd, 16), "OK"))
        out_path = os.path.join(t["allowed"], "exec-leg.out")
        out_fd = os.open(out_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
        p1 = run_child_captured(["/usr/bin/cat", t["ok"]], out_fd)
        _, st1 = os.waitpid(p1, 0)
        checks.append({"name": "EXEC POS cat allowed", "expect": "rc=0", "got": f"rc={os.waitstatus_to_exitcode(st1)}",
                       "match": os.waitstatus_to_exitcode(st1) == 0})
        p2 = run_child_captured(["/usr/bin/cat", t["secret"]], out_fd)
        _, st2 = os.waitpid(p2, 0)
        rc2 = os.waitstatus_to_exitcode(st2)
        checks.append({"name": "EXEC NEG cat private", "expect": "rc!=0", "got": f"rc={rc2}", "match": rc2 != 0})
        os.close(out_fd)
        ok = all(c["match"] for c in checks)
        emit({"verdict": "ENFORCE-CONFIRMED" if ok else "MIXED/FAILED", "checks": checks, "raw": list(RAW)}, 0 if ok else 1)
    elif leg == "denyall":
        # discriminator: every supported bit handled, ZERO rules ⇒ once the
        # domain is live EVERY fresh open must EACCES (rules-semantics can't hide).
        attr = ctypes.create_string_buffer(struct.pack("@QQ", handled, 0), 16)
        rs, _ = sc("create_ruleset(denyall)", SYS_CR, ctypes.c_void_p(ctypes.addressof(attr)), 16, 0)
        if rs < 0:
            emit({"verdict": "MIXED/FAILED", "checks": [], "raw": list(RAW)}, 1)
        if restrict(rs) != 0:
            emit({"verdict": "MIXED/FAILED", "checks": [], "raw": list(RAW)}, 4)
        a = chk("DENYALL open secret", lambda: os.close(os.open(t["secret"], os.O_RDONLY)), "EACCES")
        b = chk("DENYALL open allowed", lambda: os.close(os.open(t["ok"], os.O_RDONLY)), "EACCES")
        ok = a["match"] and b["match"]
        emit({"verdict": "ENFORCE-CONFIRMED" if ok else "NO-ENFORCEMENT", "checks": [a, b], "raw": list(RAW)}, 0 if ok else 1)
    elif leg == "badhandled":
        # false-ABSENT discriminator: handled missing READ_FILE ⇒ reads are not
        # mediated; the "secret still readable" observation here is the CONFIG
        # error reproduced on purpose, which is what a missing enforcement looks
        # like to a naive probe.
        attr = ctypes.create_string_buffer(struct.pack("@QQ", FS['MAKE_REG'], 0), 16)
        rs, _ = sc("create_ruleset(badhandled)", SYS_CR, ctypes.c_void_p(ctypes.addressof(attr)), 16, 0)
        if rs < 0:
            emit({"verdict": "MIXED/FAILED", "checks": [], "raw": list(RAW)}, 1)
        if restrict(rs) != 0:
            emit({"verdict": "MIXED/FAILED", "checks": [], "raw": list(RAW)}, 4)
        trap = chk("TRAP secret readable (READ_FILE unhandled)", lambda: os.close(os.open(t["secret"], os.O_RDONLY)), "OK")
        mk = chk("MAKE_REG create denied (handled, no rule)", lambda: os.close(os.open(os.path.join(t["private"], "n2.txt"),
                   os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)), "EACCES")
        ok = trap["match"] and mk["match"]
        emit({"verdict": "DEMO-CONFIRMED" if ok else "MIXED/FAILED", "checks": [trap, mk], "raw": list(RAW)}, 0 if ok else 1)
    else:
        emit({"verdict": "MIXED/FAILED", "checks": [], "raw": [f"unknown leg {leg}"]}, 4)


def close_all_except(keep):
    for fd in os.listdir("/proc/self/fd"):
        n = int(fd)
        if n > 2 and n not in keep:
            try:
                os.close(n)
            except OSError:
                pass


def mode_fd_close(scratch, fd_plan_json):
    abi = get_abi()
    if abi < 0:
        emit({"verdict": "ABI-UNAVAILABLE", "declared_seen": None, "undeclared_closed": None, "raw": list(RAW)}, 2)
    os.makedirs(scratch, exist_ok=True)
    declared_path = os.path.join(scratch, "declared.txt")
    undeclared_path = os.path.join(scratch, "undeclared.txt")
    for p in (declared_path, undeclared_path):
        with open(p, "w") as f:
            f.write("A5P4-FD-PROBE\n")
    d1 = os.open(declared_path, os.O_RDONLY)
    u1 = os.open(undeclared_path, os.O_RDONLY)
    for fd in (d1, u1):  # simulate a sloppy spawner: CLOEXEC cleared on BOTH
        fcntl.fcntl(fd, fcntl.F_SETFD, 0)
    keep_extra = set()
    if fd_plan_json:
        for entry in json.loads(fd_plan_json).get("declared", []):
            if isinstance(entry.get("fd"), int):
                keep_extra.add(entry["fd"])
    attr = ctypes.create_string_buffer(struct.pack("@QQ", fs_mask(abi), 0), 16)
    rs, _ = sc("create_ruleset(fd-close)", SYS_CR, ctypes.c_void_p(ctypes.addressof(attr)), 16, 0)
    if rs < 0:
        emit({"verdict": "MIXED/FAILED", "declared_seen": None, "undeclared_closed": None, "raw": list(RAW)}, 1)
    add_rule(rs, odir(scratch), FS['READ_DIR'] | FS['READ_FILE'], abi)
    add_rule(rs, odir("/proc"), FS['READ_DIR'] | FS['READ_FILE'], abi)
    pid = os.fork()  # fork WITHOUT exec: CLOEXEC never bites; P2 handoff shape
    if pid == 0:
        out = {}
        try:
            close_all_except({d1, rs} | keep_extra)  # the launcher law: close all UNDECLARED
            if restrict(rs) != 0:
                os.write(1, json.dumps({"verdict": "MIXED/FAILED", "declared_seen": None, "undeclared_closed": None}).encode() + b"\n")
                os._exit(4)
            try:
                target = os.readlink(f"/proc/self/fd/{d1}")
                out["declared_seen"] = os.path.basename(target) == "declared.txt"
            except OSError:
                out["declared_seen"] = False
            try:
                os.readlink(f"/proc/self/fd/{u1}")
                out["undeclared_closed"] = False
            except OSError as ex:
                out["undeclared_closed"] = ex.errno == EN.ENOENT
            # discriminator: the domain is actually live — reopening the
            # undeclared PATH (not the closed fd) must be refused... it IS in
            # the scratch allow rule, so use the deny side: /etc/shadow-style
            # path OUTSIDE any rule except /etc READ_FILE:
            probe = chk("NEG reopen /etc/hostname (outside scratch rules)",
                        lambda: os.close(os.open("/etc/hostname", os.O_RDONLY)), "EACCES")
            out["domain_live"] = probe["match"]
            out["verdict"] = ("FD-CLOSURE-CONFIRMED"
                              if out["declared_seen"] and out["undeclared_closed"] and out["domain_live"]
                              else "NO-ENFORCEMENT")
        except Exception as ex:  # noqa: BLE001 — the leg must answer, never crash silently
            out = {"verdict": "MIXED/FAILED", "declared_seen": None, "undeclared_closed": None, "err": repr(ex)}
        line = (json.dumps(out, separators=(",", ":")) + "\n").encode()
        os.write(1, line)
        os._exit(0)
    _, st = os.waitpid(pid, 0)
    rc = os.waitstatus_to_exitcode(st)
    sys.exit(rc)


def bits_from_names(bits, abi):
    m = 0
    mapping = {"execute": 'EXECUTE', "write_file": 'WRITE_FILE', "read_file": 'READ_FILE', "read_dir": 'READ_DIR',
               "remove_file": 'REMOVE_FILE', "make_reg": 'MAKE_REG', "truncate": 'TRUNCATE'}
    for k, v in bits.items():
        if v and k in mapping:
            m |= FS[mapping[k]]
    return m & fs_mask(abi)


def mode_confined_exec(policy_path, out_dir):
    with open(policy_path) as f:
        pol = json.load(f)
    abi = get_abi()
    if abi < 0:
        # FAIL-CLOSED: this launcher has no unconfined arm.
        emit({"abi_unavailable": True, "raw": list(RAW)}, 2)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "out")
    err_path = os.path.join(out_dir, "err")
    attr = ctypes.create_string_buffer(struct.pack("@QQ", fs_mask(abi), 0), 16)
    rs, _ = sc("create_ruleset(confined-exec)", SYS_CR, ctypes.c_void_p(ctypes.addressof(attr)), 16, 0)
    if rs < 0:
        emit({"abi_unavailable": True, "raw": list(RAW)}, 2)
    if pol.get("runtime_base", True):
        add_rule(rs, odir("/"), FS['READ_DIR'], abi)
        add_rule(rs, odir("/usr"), FS['READ_DIR'] | FS['READ_FILE'] | FS['EXECUTE'], abi)
        add_rule(rs, odir("/etc"), FS['READ_DIR'] | FS['READ_FILE'], abi)
        add_rule(rs, odir("/proc"), FS['READ_DIR'] | FS['READ_FILE'], abi)
    for a in pol.get("allow", []):
        add_rule(rs, odir(a["path"]), bits_from_names(a.get("bits", {}), abi), abi)
    keep = {1, 2}
    for entry in pol.get("fd_plan", {}).get("declared", []):
        if isinstance(entry.get("fd"), int):
            keep.add(entry["fd"])
    pid = os.fork()
    if pid == 0:
        try:
            out_fd = os.open(out_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
            err_fd = os.open(err_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
            os.dup2(out_fd, 1)
            os.dup2(err_fd, 2)
            keep2 = keep | {out_fd, err_fd}
            if pol.get("close_extra_fds", True):
                close_all_except(keep2 | {rs})
            if restrict(rs) != 0:
                os._exit(127)
            os.chdir(pol["cwd"])
            env = {k: v for k, v in pol.get("env", [])}
            argv = pol["argv"]
            os.execve(argv[0], argv, env)
        except OSError:
            os._exit(126)
    _, st = os.waitpid(pid, 0)
    rc = os.waitstatus_to_exitcode(st)
    emit({"executed": True, "rc": rc, "pid": pid, "out_ref": out_path, "err_ref": err_path}, 0)


def main():
    a = sys.argv[1:]
    if not a:
        emit({"verdict": "MIXED/FAILED", "raw": ["no mode given"]}, 4)
    def flag(name):
        return a[a.index(name) + 1] if name in a else None
    if a[0] == "--abi-probe":
        mode_abi_probe()
    elif a[0] == "--enforce-leg":
        mode_enforce_leg(a[1], flag("--scratch"))
    elif a[0] == "--fd-close":
        mode_fd_close(flag("--scratch"), flag("--fd-plan-json"))
    elif a[0] == "--confined-exec":
        mode_confined_exec(flag("--policy"), flag("--out-dir"))
    else:
        emit({"verdict": "MIXED/FAILED", "raw": [f"unknown mode {a[0]}"]}, 4)


if __name__ == "__main__":
    main()
