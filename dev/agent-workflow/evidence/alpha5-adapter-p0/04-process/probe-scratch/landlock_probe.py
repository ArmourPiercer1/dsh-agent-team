#!/usr/bin/env python3
"""Landlock minimal positive/negative read-control probe (self-scoped, read-only fs effect).

Runs entirely inside this python process:
  1. query landlock ABI version
  2. create ruleset handling READ_FILE|READ_DIR
  3. allow path_beneath ONLY on <scratch>/allowed
  4. prctl(PR_SET_NO_NEW_PRIVS) + landlock_restrict_self  (process-local, no system change)
  5. try open(read) on allowed/read.txt  -> expect success   (positive control)
     try open(read) on private/secret.txt -> expect EACCES   (negative control)
Exit codes: 0 = full PASS (ABI ok, pos ok, neg blocked EACCES)
            2 = landlock unavailable (ENOSYS/EACCES at ABI query)
            3 = restrict_self failed
            4 = positive control failed (allowed read denied)
            5 = NEGATIVE CONTROL FAILED (secret was readable!)
"""
import ctypes, ctypes.util, errno, os, struct, sys

SCRATCH = os.path.dirname(os.path.abspath(__file__))
ALLOWED = os.path.join(SCRATCH, "allowed")
SECRET = os.path.join(SCRATCH, "private", "secret.txt")

libc = ctypes.CDLL(ctypes.util.find_library("c"), use_errno=True)

SYS_ll_create_ruleset = 444  # x86_64
SYS_ll_add_rule = 445
SYS_ll_restrict_self = 446
LANDLOCK_RULE_PATH_BENEATH = 1
LANDLOCK_CREATE_RULESET_VERSION = 1 << 0
PR_SET_NO_NEW_PRIVS = 38
READ_FILE = 1 << 0
READ_DIR = 1 << 1

def syscall(n, *a):
    r = libc.syscall(ctypes.c_long(n), *a)
    if r == -1:
        e = ctypes.get_errno()
        return -1, errno.errorcode.get(e, str(e))
    return r, None

# 1) ABI version
abi, err = syscall(SYS_ll_create_ruleset, ctypes.c_void_p(0), 0, LANDLOCK_CREATE_RULESET_VERSION)
if abi < 0:
    print(f"LANDLOCK ABI query FAILED errno={err}")
    sys.exit(2)
print(f"LANDLOCK ABI_VERSION={abi}")

# 2) ruleset
ruleset, err = syscall(SYS_ll_create_ruleset, None, 0, 0)  # attrs=NULL -> handled=0? need attrs
if ruleset >= 0:
    os.close(ruleset)
attrs = struct.pack("Q", READ_FILE | READ_DIR)  # landlock_ruleset_attr{handled_access_fs}
buf = ctypes.create_string_buffer(attrs)
ruleset, err = syscall(SYS_ll_create_ruleset, ctypes.byref(buf), len(attrs), 0)
if ruleset < 0:
    print(f"LANDLOCK create_ruleset FAILED errno={err}")
    sys.exit(2)
print(f"LANDLOCK ruleset_fd={ruleset} (handled=READ_FILE|READ_DIR)")

# 3) allow path_beneath on allowed/ only
fd_allowed = os.open(ALLOWED, os.O_PATH | os.O_RDONLY)
pb = struct.pack("QH", READ_FILE | READ_DIR, fd_allowed)  # landlock_path_beneath_attr{allowed_access u64; parent_fd u32} aligned
pbbuf = ctypes.create_string_buffer(pb)
r, err = syscall(SYS_ll_add_rule, ruleset, LANDLOCK_RULE_PATH_BENEATH, ctypes.byref(pbbuf), 0)
if r < 0:
    print(f"LANDLOCK add_rule FAILED errno={err}")
    sys.exit(2)
print("LANDLOCK add_rule ok for allowed/ only")

# 4) no_new_privs + restrict_self
if libc.prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0:
    print(f"prctl NO_NEW_PRIVS FAILED errno={errno.errorcode.get(ctypes.get_errno(),'?')}")
    sys.exit(3)
r, err = syscall(SYS_ll_restrict_self, ruleset, 0)
if r < 0:
    print(f"LANDLOCK restrict_self FAILED errno={err}")
    sys.exit(3)
print("LANDLOCK restrict_self ok (this process now restricted)")

# 5) controls
rc = 0
try:
    with open(os.path.join(ALLOWED, "read.txt"), "rb") as f:
        data = f.read()
    print(f"POS-CONTROL: allowed/read.txt READ OK ({len(data)} bytes)")
except OSError as e:
    print(f"POS-CONTROL FAILED: allowed read denied errno={e.strerror}")
    sys.exit(4)
try:
    with open(SECRET, "rb") as f:
        data = f.read()
    print(f"NEGATIVE CONTROL FAILED: secret readable ({len(data)} bytes)!")
    rc = 5
except OSError as e:
    print(f"NEG-CONTROL PASS: private/secret.txt DENIED errno={e.strerror} (errno.no={e.errno})")
    rc = 0 if rc == 0 else rc
sys.exit(rc)
