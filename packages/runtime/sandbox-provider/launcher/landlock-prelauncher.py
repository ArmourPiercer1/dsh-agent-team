#!/usr/bin/env python3
"""landlock-prelauncher — Alpha.5 PR4 (C Lane) reference TRUSTED PRE-LAUNCHER.

Mechanism = the measured posture of evidence/alpha5-adapter-p0: bare syscalls
444/445/446 via ctypes (NO liblandlock, NO npm prebuilt), every integer passed
as c_long (no 32-bit truncation), ruleset attr = pack("@QQ"), rule =
pack("@Qi"), prctl(PR_SET_NO_NEW_PRIVS) before landlock_restrict_self.

Scope discipline (identical to the PoC lanes): the process that runs this
script confines ITSELF and its children ONLY (P1 entry self-lock; P2 = fork
WITHOUT exec, then the child self-locks). It writes nothing outside the
scratch directory it is handed and touches no sysctl/module. BL-42 adds ONE
capability: a confined child MAY be placed in a fresh network namespace
(`CLONE_NEWUSER|CLONE_NEWNET`, unprivileged, owned by the child itself — no
system-wide setting, no host interface, no external process). That namespace
is created by the confined child for the confined child; the launcher never
changes the namespace of anything it does not spawn, and it states
`applied: true` only after reading the child's own `/proc/<pid>/ns/net`
inode back. Its authoritative capability answer comes from the bare
GET_VERSION syscall plus REAL enforcement legs — never from an existence check.

Modes:
  --abi-probe
  --enforce-leg {selective,denyall,badhandled} --scratch DIR
  --net-leg --scratch DIR
      (BL-42: the network-enforcement leg. The launcher — in the HOST network
      namespace — binds a loopback TCP listener and a loopback UDP socket,
      forks a CONTROL child that connects to both (and proves the bytes arrived
      by echoing a nonce), then forks a DENY child that enters a fresh
      network namespace and attempts the same two calls. `NET-DENY-CONFIRMED`
      requires: the deny child's namespace inode differs from the host's, both
      of its calls fail with a KERNEL/TRANSPORT errno, and the listener's own
      accept/receive counters did NOT move. The counters are read in the parent
      process — an out-of-band transport observation, not a flag.)
  --fd-close --scratch DIR [--fd-plan-json JSON]
  --confined-exec --policy FILE --out-dir DIR     (P1: self-lock, then execve
                                                  the untrusted argv; NEVER
                                                  runs unconfined)
  --confined-exec-stream --policy FILE --out-dir DIR [--exit-passthrough]
      (R-1 streaming arm: the SAME ruleset build and the SAME P1 self-lock,
      but the payload keeps this launcher's inherited 0/1/2 as LIVE PIPES
      (the provider's end-to-end pipes; no out-file redirection), and the
      single-line JSON handshake goes on FD 3 — a launcher-owned channel
      that NEVER crosses the untrusted boundary (the child closes it before
      execve, whatever the policy declares). Handshake:
      {"stream":true,"pid":<payload pid>} or {"abi_unavailable":true}.
      After fork THIS process closes 0/1/2/3 (zero hot handles on the
      payload pipes), waits, and records {"pid":…,"rc":…} in
      <out-dir>/exit.json. The exit record is bookkeeping; the streaming
      provider observes the exit through the process itself.
      DEFAULT EXIT LAW (unchanged, additive flag below): the process itself
      exits 0 whatever the payload did — the constant-completion law every
      stream consumer was built against.
      --exit-passthrough (B2, opt-in, DEFAULT OFF): the payload's OWN
      completion state becomes this process's exit code. Off, the arm is
      byte-for-byte the historical behaviour, so a consumer that has not
      asked for the code (glob, search) keeps its constant-0 completion law
      and its "no payload exit code on this face" pin stays true. The code
      is taken from the waitpid status and nothing else — never guessed
      from stderr text, never flattened to 0 on failure.)

One single-line JSON verdict on stdout; diagnostics on stderr.
Exit codes: 0 usable answer; 2 ABI unavailable; 4 config/self-lock failure;
1 MIXED/FAILED leg. On --confined-exec-stream with --exit-passthrough the
process exit code is the payload's (signal death reported as 128+signum);
without the flag it stays the constant 0 above.
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


# ---------------------------------------------------------------------------
# BL-42 — THE NETWORK NAMESPACE MECHANISM
#
# One mechanism, measured, never inferred: a fresh `CLONE_NEWUSER|CLONE_NEWNET`
# pair created by the confined child for itself. The new network namespace is
# owned by the new user namespace, which is why an UNPRIVILEGED process can
# create it (no CAP_SYS_ADMIN on the host, no setuid helper, no bwrap
# dependency) — and why it needs no system setting: `unshare(2)` either returns
# 0 (the namespace exists, and the child can read its own inode back) or an
# errno (the mechanism did not happen, and everything downstream refuses).
#
# WHAT THIS MECHANISM COVERS, stated so it cannot be read as more:
#   covered   TCP/UDP connect+send to any address, IPv4 AND IPv6, raw sockets,
#             AF_UNIX ABSTRACT sockets (the abstract namespace is per-netns),
#             and the loopback interface itself (this namespace's `lo` is a
#             different, down device — there is no route to the host's).
#   NOT covered  AF_UNIX *pathname* sockets: they are filesystem objects, not
#             network destinations, so a path the effective lane grants stays
#             reachable. That is a Landlock/lane question, not this one, and it
#             is disclosed rather than papered over.
#   NOT covered  an inherited socket FD. The confined child closes every fd the
#             policy did not declare; a DECLARED fd that happens to be a socket
#             would cross the boundary, so `refuse_inherited_sockets()` below
#             refuses that case outright instead of assuming it away.
CLONE_NEWUSER = 0x10000000
CLONE_NEWNET = 0x40000000


def net_ns_inode_of(pid=None):
    """The inode of a process's network namespace (the namespace's identity)."""
    path = "/proc/self/ns/net" if pid is None else f"/proc/{pid}/ns/net"
    try:
        return os.stat(path).st_ino
    except OSError:
        return None


def enter_netns():
    """Put THIS process in a fresh user+network namespace. Never partial.

    Returns {"applied": True, "net_ns_inode": N, "host_net_ns_inode": M} on
    success or {"applied": False, "reason": ..., "errno": ...} on failure. A
    failure is a FAILURE: the caller must not exec a payload under a deny claim
    it could not apply.
    """
    host_ino = net_ns_inode_of()
    # The kernel's OWN precondition for an unprivileged uid_map/gid_map write is
    # that the writer is dumpable; a process that entered this tree through a
    # wrapper which cleared it would otherwise get EPERM on the map (measured).
    # This does not weaken NoNewPrivs: it is re-read and reported below.
    libc.prctl(4, 1, 0, 0, 0)  # PR_SET_DUMPABLE
    # The identity to map is the one BEFORE the namespace switch: inside an
    # unmapped user namespace `geteuid()` reports the overflow id (65534), and a
    # map written from that value is refused EPERM (measured on this host).
    uid, gid = os.geteuid(), os.getegid()
    r = libc.unshare(ctypes.c_int(CLONE_NEWUSER | CLONE_NEWNET))
    if r != 0:
        err = ctypes.get_errno()
        return {"applied": False, "reason": "unshare(CLONE_NEWUSER|CLONE_NEWNET) refused", "errno": EN.errorcode.get(err, err), "strerror": os.strerror(err)}
    try:
        with open("/proc/self/setgroups", "w") as f:
            f.write("deny")
    except OSError:
        pass  # older kernels have no setgroups file; gid_map write below decides
    for path, line in (("/proc/self/uid_map", f"{uid} {uid} 1"), ("/proc/self/gid_map", f"{gid} {gid} 1")):
        try:
            with open(path, "w") as f:
                f.write(line)
        except OSError as ex:
            return {"applied": False, "reason": f"writing {path} refused", "errno": EN.errorcode.get(ex.errno, ex.errno), "strerror": ex.strerror}
    ino = net_ns_inode_of()
    if ino is None or host_ino is None or ino == host_ino:
        return {"applied": False, "reason": "the process did not move to a distinct network namespace", "net_ns_inode": ino, "host_net_ns_inode": host_ino}
    return {"applied": True, "mechanism": "netns", "net_ns_inode": ino, "host_net_ns_inode": host_ino, "no_new_privs": _no_new_privs()}


def _no_new_privs():
    """The child's own NoNewPrivs bit, read from /proc (a fact, not a claim)."""
    try:
        for line in open("/proc/self/status"):
            if line.startswith("NoNewPrivs:"):
                return line.split(":")[1].strip() == "1"
    except OSError:
        pass
    return None


def inherited_socket_fds():
    """The fds (>2) this process holds that are SOCKETS, read from /proc.

    Used by the deny lane's fd gate: the fd-closure law removes undeclared fds,
    and a DECLARED socket fd would be a live transport that a network namespace
    cannot revoke. Refused, never reasoned away.
    """
    out = []
    try:
        for name in os.listdir("/proc/self/fd"):
            try:
                fd = int(name)
            except ValueError:
                continue
            if fd <= 2:
                continue
            try:
                target = os.readlink(f"/proc/self/fd/{fd}")
            except OSError:
                continue
            if target.startswith("socket:"):
                out.append({"fd": fd, "target": target})
    except OSError:
        pass
    return out


def _connect_once(port, nonce, tcp=True):
    """One connect/send attempt, returning the kernel's answer (never raising)."""
    import socket
    try:
        if tcp:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(3.0)
            s.connect(("127.0.0.1", int(port)))
            s.sendall(nonce.encode())
            s.close()
        else:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(3.0)
            s.sendto(nonce.encode(), ("127.0.0.1", int(port)))
            s.close()
    except OSError as ex:
        return {"ok": False, "errno": EN.errorcode.get(ex.errno, ex.errno), "strerror": ex.strerror}
    return {"ok": True}


def _net_child(pipe_w, port_tcp, port_udp, nonce, deny):
    """The forked transport-attempt child: CONTROL (deny=False) or DENY."""
    try:
        ns = {"applied": False, "reason": "not attempted"}
        if deny:
            ns = enter_netns()
            if not ns.get("applied"):
                os.write(pipe_w, (json.dumps({"net": ns}) + "\n").encode())
                os._exit(0)
        if not deny:
            ns = {"applied": False, "reason": "control child — no namespace change", "net_ns_inode": net_ns_inode_of(), "host_net_ns_inode": net_ns_inode_of()}
        tcp = _connect_once(port_tcp, nonce, tcp=True)
        udp = _connect_once(port_udp, nonce, tcp=False)
        os.write(pipe_w, (json.dumps({"net": ns, "tcp": tcp, "udp": udp}) + "\n").encode())
    except OSError:
        pass
    os._exit(0)


def mode_net_leg(scratch):
    """BL-42 — the measured network-enforcement leg (see the module docstring)."""
    import select
    import socket
    os.makedirs(scratch, exist_ok=True)
    nonce = os.urandom(12).hex()
    tcp_srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    tcp_srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    tcp_srv.bind(("127.0.0.1", 0))
    tcp_srv.listen(8)
    tcp_srv.setblocking(False)
    udp_srv = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    udp_srv.bind(("127.0.0.1", 0))
    udp_srv.setblocking(False)
    port_tcp = tcp_srv.getsockname()[1]
    port_udp = udp_srv.getsockname()[1]
    host_ino = net_ns_inode_of()
    accepted = []      # one entry per accepted TCP connection (the bytes it carried)
    datagrams = []     # one entry per UDP datagram received

    def drain(timeout=1.5):
        """Accept/receive everything already there, bounded (out-of-band counts)."""
        end = None
        import time
        end = time.time() + timeout
        while time.time() < end:
            r, _, _ = select.select([tcp_srv, udp_srv], [], [], 0.1)
            if not r:
                continue
            for sock in r:
                if sock is tcp_srv:
                    while True:
                        try:
                            conn, _ = tcp_srv.accept()
                        except OSError:
                            break
                        try:
                            conn.settimeout(1.0)
                            accepted.append(conn.recv(64).decode(errors="replace"))
                        except OSError:
                            accepted.append("")
                        finally:
                            conn.close()
                else:
                    while True:
                        try:
                            data, _ = udp_srv.recvfrom(64)
                        except OSError:
                            break
                        datagrams.append(data.decode(errors="replace"))
            if accepted or datagrams:
                # one more short sweep so a second packet is not missed
                continue

    def run_child(deny):
        r_fd, w_fd = os.pipe()
        pid = os.fork()
        if pid == 0:
            os.close(r_fd)
            _net_child(w_fd, port_tcp, port_udp, nonce, deny)
        os.close(w_fd)
        buf = b""
        while True:
            try:
                chunk = os.read(r_fd, 4096)
            except OSError:
                break
            if not chunk:
                break
            buf += chunk
        os.close(r_fd)
        try:
            os.waitpid(pid, 0)
        except OSError:
            pass
        try:
            return json.loads(buf.decode().strip().split("\n")[-1])
        except (ValueError, IndexError):
            return {"net": {"applied": False, "reason": "child answer unparseable"}, "tcp": {"ok": None}, "udp": {"ok": None}}

    before_tcp, before_udp = len(accepted), len(datagrams)
    control = run_child(False)
    drain(1.5)
    control_tcp, control_udp = len(accepted) - before_tcp, len(datagrams) - before_udp
    control_nonce_ok = nonce in accepted[before_tcp:before_tcp + control_tcp] and nonce in datagrams[before_udp:before_udp + control_udp]

    deny_before_tcp, deny_before_udp = len(accepted), len(datagrams)
    deny = run_child(True)
    drain(1.5)
    deny_tcp, deny_udp = len(accepted) - deny_before_tcp, len(datagrams) - deny_before_udp

    net = deny.get("net", {}) if isinstance(deny, dict) else {}
    deny_tcp_answer = deny.get("tcp", {}) if isinstance(deny, dict) else {}
    deny_udp_answer = deny.get("udp", {}) if isinstance(deny, dict) else {}
    ns_distinct = bool(net.get("applied")) and net.get("net_ns_inode") is not None and net.get("net_ns_inode") != net.get("host_net_ns_inode")
    tcp_refused = deny_tcp_answer.get("ok") is False and isinstance(deny_tcp_answer.get("errno"), str)
    udp_refused = deny_udp_answer.get("ok") is False and isinstance(deny_udp_answer.get("errno"), str)

    checks = [
        {"name": "CONTROL tcp reaches the listener", "expect": "CONNECTED", "got": "CONNECTED" if control.get("tcp", {}).get("ok") is True else "REFUSED", "match": control.get("tcp", {}).get("ok") is True},
        {"name": "CONTROL udp reaches the listener", "expect": "DELIVERED", "got": "DELIVERED" if control.get("udp", {}).get("ok") is True else "FAILED", "match": control.get("udp", {}).get("ok") is True},
        {"name": "CONTROL listener counted the control traffic", "expect": "1/1", "got": f"{control_tcp}/{control_udp}", "match": control_tcp == 1 and control_udp == 1 and control_nonce_ok},
        {"name": "DENY child moved to a distinct net namespace", "expect": "DISTINCT", "got": "DISTINCT" if ns_distinct else str(net.get("reason", "SAME")), "match": ns_distinct},
        {"name": "DENY tcp refused by the kernel", "expect": "ERRNO", "got": deny_tcp_answer.get("errno") or "connected", "match": tcp_refused},
        {"name": "DENY udp refused by the kernel", "expect": "ERRNO", "got": deny_udp_answer.get("errno") or "delivered", "match": udp_refused},
        {"name": "DENY listener counter unchanged (tcp)", "expect": "0", "got": str(deny_tcp), "match": deny_tcp == 0},
        {"name": "DENY listener counter unchanged (udp)", "expect": "0", "got": str(deny_udp), "match": deny_udp == 0},
    ]
    verdict = "NET-DENY-CONFIRMED" if all(c["match"] for c in checks) else "NO-ENFORCEMENT"
    emit({
        "kind": "net-leg",
        "verdict": verdict,
        "checks": checks,
        "mechanism": "netns" if verdict == "NET-DENY-CONFIRMED" else None,
        "host_net_ns_inode": host_ino,
        "deny_net_ns_inode": net.get("net_ns_inode"),
        "listener": {"port_tcp": port_tcp, "port_udp": port_udp, "accepted_total": len(accepted), "datagrams_total": len(datagrams)},
        "control": {"tcp": control.get("tcp"), "udp": control.get("udp"), "accepted": control_tcp, "datagrams": control_udp, "nonce_matched": control_nonce_ok},
        "deny": {"net": net, "tcp": deny_tcp_answer, "udp": deny_udp_answer, "accepted": deny_tcp, "datagrams": deny_udp},
        "coverage": {
            "covered": ["tcp", "udp", "ipv4", "ipv6", "raw", "af_unix_abstract", "loopback"],
            "not_covered": ["af_unix_pathname", "inherited_socket_fds (refused by refuse_inherited_sockets)"],
        },
        "raw": list(RAW),
    }, 0 if verdict == "NET-DENY-CONFIRMED" else 1)


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
        # runtime-base-narrow: this leg mirrors the PRODUCTION base set — the
        # '/' READ_DIR drift is gone here too (see build_ruleset). No check on
        # this leg depends on whole-tree READ_DIR: the fixture reads ride
        # scratch paths (READ_FILE never granted outside `allowed`), the base
        # reads ride /etc (POS) and /usr (EXEC legs). Verdict semantics
        # unchanged; instrument stays honest to what production enforces.
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


def build_ruleset(pol, abi, label):
    """THE confined ruleset — one builder for BOTH exec arms (one-shot + stream)."""
    attr = ctypes.create_string_buffer(struct.pack("@QQ", fs_mask(abi), 0), 16)
    rs, _ = sc(f"create_ruleset({label})", SYS_CR, ctypes.c_void_p(ctypes.addressof(attr)), 16, 0)
    if rs < 0:
        return -1
    if pol.get("runtime_base", True):
        # runtime-base-narrow (bug fix, root ruling 22:43Z): the base is the
        # EXPLICIT enumeration of architecture.md:77 — "a trusted execution
        # runtime base (interpreter, libraries, devices) … Do not accidentally
        # expose host home" — and :257 gates "environment base readability
        # WITHOUT arbitrary host-home access". The former `odir("/") READ_DIR`
        # line had NO authorizing sentence (glue7 runtime-base-probe): under
        # Landlock's nearest-ancestor rule matching it reached EVERY
        # ungoverned directory (/home, /srv, …) and surfaced host NAMES
        # through governed rows (glue7 §4b name-class leak; a5rbn witness
        # `ls /home/*` -> real names on the row output). Devices: fs_mask()
        # handles no block/char-device bit, so the :77 device word carries no
        # FS rule here. Anything a legitimate row needs beyond THIS
        # enumeration rides its per-call allow[] grants (dynamic anchor
        # roots), never the whole tree.
        add_rule(rs, odir("/usr"), FS['READ_DIR'] | FS['READ_FILE'] | FS['EXECUTE'], abi)
        add_rule(rs, odir("/etc"), FS['READ_DIR'] | FS['READ_FILE'], abi)
        add_rule(rs, odir("/proc"), FS['READ_DIR'] | FS['READ_FILE'], abi)
    for a in pol.get("allow", []):
        add_rule(rs, odir(a["path"]), bits_from_names(a.get("bits", {}), abi), abi)
    return rs


def mode_confined_exec(policy_path, out_dir):
    with open(policy_path) as f:
        pol = json.load(f)
    net_deny = pol.get("network") == "deny"
    # The fd-3 reservation is computed BEFORE any fd is allocated here: a later
    # ruleset/policy fd could otherwise masquerade as an inherited channel and
    # the child would close the very ruleset it is about to restrict with.
    try:
        os.fstat(HANDSHAKE_FD)
        reserve = {HANDSHAKE_FD}  # the stream channel never crosses into the payload, even on the one-shot arm
    except OSError:
        reserve = set()
    abi = get_abi()
    if abi < 0:
        # FAIL-CLOSED: this launcher has no unconfined arm.
        emit({"abi_unavailable": True, "raw": list(RAW)}, 2)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "out")
    err_path = os.path.join(out_dir, "err")
    rs = build_ruleset(pol, abi, "confined-exec")
    if rs < 0:
        emit({"abi_unavailable": True, "raw": list(RAW)}, 2)
    keep = {1, 2}
    for entry in pol.get("fd_plan", {}).get("declared", []):
        if isinstance(entry.get("fd"), int):
            keep.add(entry["fd"])
    # BL-42: the child reports what it ACTUALLY applied (namespace facts) on a
    # dedicated pipe BEFORE execve, so the parent's answer is a measurement of
    # the payload's own process, not a restatement of the request.
    net_r, net_w = os.pipe()
    pid = os.fork()
    if pid == 0:
        try:
            os.close(net_r)
            out_fd = os.open(out_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
            err_fd = os.open(err_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
            os.dup2(out_fd, 1)
            os.dup2(err_fd, 2)
            keep2 = keep | {out_fd, err_fd}
            if pol.get("close_extra_fds", True):
                # net_w is LAUNCHER-OWNED (it carries the namespace facts and is
                # closed before execve); without it in the keep set this law would
                # close the very pipe the measurement travels on.
                close_all_except(keep2 | {rs, net_w})
            for leaky in reserve:  # unconditional: launcher-owned channels never reach the payload
                try:
                    os.close(leaky)
                except OSError:
                    pass
            if net_deny:
                applied = enter_netns()
                if applied.get("applied"):
                    sockets = inherited_socket_fds()
                    if sockets:
                        applied = {"applied": False, "reason": "a declared inherited fd is a live socket, which a network namespace cannot revoke", "sockets": sockets}
                        os.write(net_w, (json.dumps({"net": applied}) + "\n").encode())
                        os._exit(125)
                os.write(net_w, (json.dumps({"net": applied}) + "\n").encode())
                try:
                    os.close(net_w)
                except OSError:
                    pass
                if not applied.get("applied"):
                    os._exit(125)
            else:
                os.write(net_w, (json.dumps({"net": {"applied": False, "reason": "the policy requests no network confinement"}}) + "\n").encode())
                try:
                    os.close(net_w)
                except OSError:
                    pass
            if restrict(rs) != 0:
                os._exit(127)
            os.chdir(pol["cwd"])
            env = {k: v for k, v in pol.get("env", [])}
            argv = pol["argv"]
            os.execve(argv[0], argv, env)
        except OSError:
            os._exit(126)
    os.close(net_w)
    net_buf = b""
    while True:
        try:
            chunk = os.read(net_r, 4096)
        except OSError:
            break
        if not chunk:
            break
        net_buf += chunk
    os.close(net_r)
    try:
        net_facts = json.loads(net_buf.decode().strip().split("\n")[-1]).get("net", {})
    except (ValueError, IndexError):
        net_facts = {"applied": False, "reason": "the payload child reported no namespace facts"}
    _, st = os.waitpid(pid, 0)
    rc = os.waitstatus_to_exitcode(st)
    if net_deny and not net_facts.get("applied"):
        # FAIL-CLOSED and NAMED: the deny lane did not run a network-capable
        # child under a claim it could not keep.
        emit({"network_unenforced": True, "network": net_facts, "rc": rc, "pid": pid, "raw": list(RAW)}, 4)
    emit({"executed": True, "rc": rc, "pid": pid, "out_ref": out_path, "err_ref": err_path, "network": net_facts}, 0)


# ---------------------------------------------------------------------------
# R-1 STREAM ARM — same confined-exec policy, live pipes instead of out-files.
# The handshake travels on HANDSHAKE_FD (fd 3), a launcher-owned channel:
# the payload never inherits it and the parent never keeps a payload pipe fd.
# ---------------------------------------------------------------------------

HANDSHAKE_FD = 3


def hs_write(obj):
    try:
        os.write(HANDSHAKE_FD, (json.dumps(obj, separators=(",", ":")) + "\n").encode())
    except OSError:
        pass


def hs_close():
    try:
        os.close(HANDSHAKE_FD)
    except OSError:
        pass


def hs_close_quiet(*fds):
    for fd in fds:
        try:
            os.close(fd)
        except OSError:
            pass


def mode_confined_exec_stream(policy_path, out_dir, exit_passthrough=False):
    try:
        os.fstat(HANDSHAKE_FD)
    except OSError:
        hs_write({"launcher_error": "the stream arm requires the fd-3 handshake channel"})
        sys.exit(4)
    try:
        with open(policy_path) as f:
            pol = json.load(f)
    except OSError as ex:
        hs_write({"launcher_error": f"policy unreadable: {ex.strerror or ex}"})
        sys.exit(4)
    abi = get_abi()
    if abi < 0:
        # FAIL-CLOSED: no ABI ⇒ no payload, no handshake pid — same law as the one-shot arm.
        hs_write({"abi_unavailable": True})
        sys.exit(2)
    rs = build_ruleset(pol, abi, "confined-exec-stream")
    if rs < 0:
        hs_write({"abi_unavailable": True})
        sys.exit(2)
    os.makedirs(out_dir, exist_ok=True)
    keep = set()
    for entry in pol.get("fd_plan", {}).get("declared", []):
        if isinstance(entry.get("fd"), int):
            keep.add(entry["fd"])
    net_deny = pol.get("network") == "deny"
    net_r, net_w = os.pipe()
    pid = os.fork()
    if pid == 0:
        try:
            os.close(net_r)
            hs_close()  # the handshake channel is launcher-owned — never crosses the boundary
            if pol.get("close_extra_fds", True):
                # pipes 0/1/2 always survive (they ARE the streaming interface); everything
                # above 2 that the policy did not declare is closed, exactly as on the
                # one-shot arm (close_all_except only ever touches fds > 2).
                close_all_except(keep | {rs, net_w})
            if net_deny:
                applied = enter_netns()
                if applied.get("applied"):
                    sockets = inherited_socket_fds()
                    if sockets:
                        applied = {"applied": False, "reason": "a declared inherited fd is a live socket, which a network namespace cannot revoke", "sockets": sockets}
                os.write(net_w, (json.dumps({"net": applied}) + "\n").encode())
                try:
                    os.close(net_w)
                except OSError:
                    pass
                if not applied.get("applied"):
                    os._exit(125)
            else:
                os.write(net_w, (json.dumps({"net": {"applied": False, "reason": "the policy requests no network confinement"}}) + "\n").encode())
                try:
                    os.close(net_w)
                except OSError:
                    pass
            if restrict(rs) != 0:
                os._exit(127)
            os.chdir(pol["cwd"])
            env = {k: v for k, v in pol.get("env", [])}
            argv = pol["argv"]
            os.execve(argv[0], argv, env)
        except OSError:
            os._exit(126)
    # parent: read the child's namespace facts FIRST (the handshake states what
    # was applied, so it cannot claim more than the child measured).
    os.close(net_w)
    net_buf = b""
    while True:
        try:
            chunk = os.read(net_r, 4096)
        except OSError:
            break
        if not chunk:
            break
        net_buf += chunk
    os.close(net_r)
    try:
        net_facts = json.loads(net_buf.decode().strip().split("\n")[-1]).get("net", {})
    except (ValueError, IndexError):
        net_facts = {"applied": False, "reason": "the payload child reported no namespace facts"}
    if net_deny and not net_facts.get("applied"):
        hs_write({"network_unenforced": True, "network": net_facts})
        hs_close()
        try:
            os.waitpid(pid, 0)
        except OSError:
            pass
        sys.exit(4)
    # parent: handshake, then ZERO hot handles on the payload pipes (0/1/2), then supervise.
    hs_write({"stream": True, "pid": pid, "network": net_facts})
    hs_close()
    hs_close_quiet(0, 1, 2)
    _, st = os.waitpid(pid, 0)
    rc = os.waitstatus_to_exitcode(st)
    try:
        with open(os.path.join(out_dir, "exit.json"), "w") as f:
            json.dump({"pid": pid, "rc": rc}, f)
    except OSError:
        pass
    if not exit_passthrough:
        # THE DEFAULT LAW, byte-for-byte unchanged: the streaming face completes with
        # 0 and the payload's own code stays inside exit.json as bookkeeping. Every
        # consumer that did not ask for a code (glob, search) proves completion from
        # the stream itself and pins that there is no payload exit code on its face.
        sys.exit(0)
    # B2 --exit-passthrough: the payload's completion state IS this process's exit
    # code, taken from the waitpid status and from nothing else — never guessed from
    # stderr text, never flattened to 0 because a run "looked like it finished".
    #
    # A NEGATIVE rc means the payload never exited: waitpid reports -signum for a
    # child that was killed. The consumer contract reserves a non-number for that
    # gap — packages/tools/a5p5-tools/src/types.ts:144-151 says `exitCode === null`
    # means NOT OBSERVED ("never a fabricated 0 and never conflated with
    # 'stopped'"). Here the end WAS observed, it just had no exit code, so pushing
    # it into the null bucket would erase the difference between "killed by
    # SIGKILL" and "we never saw an end at all". Reported instead in the convention
    # /bin/sh itself uses for this case: 128 + signum (SIGTERM -> 143,
    # SIGKILL -> 137).
    #
    # WHAT THAT NUMBER DOES NOT PROVE, said out loud because the mapping is
    # constructive and one-way: a payload that returns 137 BY ITSELF (the literal
    # `exit 137`, or any wrapper re-reporting a child's signal status) leaves the
    # NON-negative branch above with the same 137. So the 128..159 range does not
    # identify a cause of death, and a caller cannot read "killed by signal N" off
    # the exit code — this process knows which branch it took and the exit status
    # does not carry that. The mapping is there to avoid the two errors its
    # alternatives commit (fabricating a 0 for a run that never returned, or
    # claiming no end was observed when one clearly was), not to make signal death
    # detectable. Where the difference matters, the record that DOES carry it is
    # <out-dir>/exit.json above: its "rc" is the raw waitpid-derived value,
    # NEGATIVE for a killed payload and the plain number for a returned one.
    # Pinned as leg A5 of `a5b2-exit-code-fidelity.test.ts`.
    sys.exit(rc if rc >= 0 else 128 + (-rc))


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
    elif a[0] == "--net-leg":
        mode_net_leg(flag("--scratch"))
    elif a[0] == "--confined-exec":
        mode_confined_exec(flag("--policy"), flag("--out-dir"))
    elif a[0] == "--confined-exec-stream":
        mode_confined_exec_stream(flag("--policy"), flag("--out-dir"), "--exit-passthrough" in a)
    else:
        emit({"verdict": "MIXED/FAILED", "raw": [f"unknown mode {a[0]}"]}, 4)


if __name__ == "__main__":
    main()
