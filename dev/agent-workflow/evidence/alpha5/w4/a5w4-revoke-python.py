#!/usr/bin/python3
"""a5w4-revoke-python.py — the W4 negative-control-B REVOCATION WRAPPER.

A python interpreter shim that removes the Landlock enforcement plane from
its own process with a classic-BPF seccomp filter — syscalls 444/445/446
(landlock_create_ruleset / add_rule / restrict_self) answer EACCES — and then
execs the real /usr/bin/python3. seccomp filters are inherited across execve
(PR_SET_NO_NEW_PRIVS is set first), so every provider probe leg and every
launcher mode that runs through THIS interpreter sees a host where Landlock is
OS-revoked: the bare GET_VERSION probe measures EACCES, the launcher's
confined-exec arm is structurally unreachable, and there is no userspace
fallback the provider could take except its typed refusal.

Honesty (IF-7 / G-g discipline): this is a PER-PROCESS OS-mechanism revocation
(seccomp BPF — the kernel enforces it, not a userspace mock). It is NOT a
system-wide removal: no sysctl, no module, no boot parameter, no namespace —
this sandbox cannot touch those (recorded as an environment constraint in the
README; the system-wide arm stays out of reach unprivileged).

Why prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER) and not seccomp(2): on this
pinned sandbox the direct seccomp(321) entry answers E2BIG (the nested bwrap
seccomp environment rejects that path); the prctl(22, 2, prog) entry installs
the identical filter — measured 2026-10-17: install rc=0, then
landlock_create_ruleset rc=-1 errno=EACCES under the filter, sanity getpid OK.

Usage: a5w4-revoke-python.py <python-args...>   (transparent shim)
Exit: 4 if the filter cannot be installed (fail-closed: the wrapper NEVER
execs python unconfined-by-filter — a revocation that silently did not happen
would turn the negative control into a false positive).

@module dev/agent-workflow/evidence/alpha5/w4/a5w4-revoke-python
"""
import ctypes
import os
import sys

# classic BPF instruction (sock_filter), 8 bytes, same layout the kernel parses
class SockFilter(ctypes.Structure):
    _fields_ = [("code", ctypes.c_uint16), ("jt", ctypes.c_uint8),
                ("jf", ctypes.c_uint8), ("k", ctypes.c_uint32)]


class SockFprog(ctypes.Structure):
    _fields_ = [("len", ctypes.c_uint16),
                ("filter", ctypes.POINTER(SockFilter))]


def build_filter():
    """BPF_LD [nr]; for nr in {444,445,446}: jeq->RET ERRNO(EACCES); RET ALLOW."""
    code = [SockFilter(0x20, 0, 0, 0)]  # BPF_LD | BPF_W | BPF_ABS, off=0 = seccomp_data.nr (x86_64)
    for nr in (444, 445, 446):
        code.append(SockFilter(0x15, 0, 1, nr))  # BPF_JMP | BPF_JEQ | BPF_K — jt=0 (fall into RET), jf=+1
        code.append(SockFilter(0x06, 0, 0, 0x00050000 | 13))  # BPF_RET | SECCOMP_RET_ERRNO | EACCES
    code.append(SockFilter(0x06, 0, 0, 0x7FFF0000))  # SECCOMP_RET_ALLOW
    return code


def main():
    libc = ctypes.CDLL("libc.so.6", use_errno=True)
    code = build_filter()
    arr = (SockFilter * len(code))(*code)
    prog = SockFprog(len(code), arr)
    # PR_SET_NO_NEW_PRIVS — required precondition; also what carries the
    # filter across the execve below.
    if libc.prctl(38, 1, 0, 0, 0) != 0:
        sys.stderr.write("A5W4-REVOKE: PR_SET_NO_NEW_PRIVS failed errno=%s\n" % ctypes.get_errno())
        sys.exit(4)
    # PR_SET_SECCOMP(22), SECCOMP_MODE_FILTER(2) — the entry that installs here
    # (seccomp(2) itself answers E2BIG inside this nested sandbox — measured).
    if libc.prctl(22, 2, ctypes.byref(prog), 0, 0) != 0:
        sys.stderr.write("A5W4-REVOKE: seccomp filter install failed errno=%s\n" % ctypes.get_errno())
        sys.exit(4)
    os.execv("/usr/bin/python3", ["/usr/bin/python3"] + sys.argv[1:])


if __name__ == "__main__":
    main()
