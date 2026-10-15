#!/usr/bin/env python3
"""Debug: did landlock_restrict_self actually apply? Check out-of-scope opens with errno."""
import ctypes, ctypes.util, errno, os, struct, sys

SCRATCH = os.path.dirname(os.path.abspath(__file__))
ALLOWED = os.path.join(SCRATCH, "allowed")
libc = ctypes.CDLL(ctypes.util.find_library("c"), use_errno=True)
SYS_CR, SYS_AR, SYS_RS = 444, 445, 446
READ_FILE, READ_DIR = 1 << 0, 1 << 1

def sc(n, *a):
    r = libc.syscall(ctypes.c_long(n), *a)
    e = ctypes.get_errno() if r == -1 else 0
    return r, errno.errorcode.get(e, "") if e else ""

print("pre-restrict /etc/hostname open:", end=" ")
try:
    os.close(os.open("/etc/hostname", os.O_RDONLY)); print("OK")
except OSError as ex: print(f"{ex.strerror}")

abi, e = sc(SYS_CR, None, 0, 1)
print(f"abi={abi} err={e}")
attrs = struct.pack("Q", READ_FILE | READ_DIR)
ruleset, e = sc(SYS_CR, ctypes.byref(ctypes.create_string_buffer(attrs, 64)), len(attrs), 0)
print(f"ruleset_fd={ruleset} err={e}")
fd_allowed = os.open(ALLOWED, os.O_PATH | os.O_RDONLY)
pb = struct.pack("Qi", READ_FILE | READ_DIR, fd_allowed)  # packed 12 bytes, s32 fd
r, e = sc(SYS_AR, ruleset, 1, ctypes.byref(ctypes.create_string_buffer(pb, 64)), 0)
print(f"add_rule rc={r} err={e}")
r = libc.prctl(38, 1, 0, 0, 0)
print(f"prctl NO_NEW_PRIVS rc={r} errno={ctypes.get_errno() if r else 0}")
print("no_new_privs now:", open("/proc/self/status").read().split("NoNewPrivs:")[1].split("\n")[0].strip() if "NoNewPrivs:" in open("/proc/self/status").read() else "?")
r, e = sc(SYS_RS, ruleset, 0)
print(f"restrict_self rc={r} err={e}")

for path in (os.path.join(ALLOWED, "read.txt"),
             os.path.join(SCRATCH, "private", "secret.txt"),
             "/etc/hostname",
             "/etc/passwd"):
    try:
        fd = os.open(path, os.O_RDONLY)
        data = os.read(fd, 8); os.close(fd)
        print(f"POST-RESTRICT open({path}) = ALLOWED ({len(data)} bytes)")
    except OSError as ex:
        print(f"POST-RESTRICT open({path}) = DENIED ({ex.strerror}, errno={ex.errno})")
