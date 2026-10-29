#!/usr/bin/env python3
"""U1-A assembler: merges raw collection outputs into the final JSON deliverables.
Reads only files under u1a/raw + git/du facts already captured; writes only under u1a/."""
import json, os, re, hashlib, subprocess, collections

REPO = "/srv/workspace/dsh-plugins/dsh-agent-team"
U = os.path.join(REPO, "dev/agent-workflow/evidence/u1-closure-20261025/u1a")
RAW = os.path.join(U, "raw")
EVID = "dev/agent-workflow/evidence/"
NOW = "2026-10-25"

def rd(p): return open(os.path.join(RAW, p)).read()

# ---------- shared: du tsv loader ----------
def load_du(path):
    m = {}
    for l in open(path):
        parts = l.rstrip("\n").split("\t")
        if len(parts) == 2 and parts[0].isdigit():
            m[parts[1].rstrip('/')] = int(parts[0])
    return m

wt_du = load_du(os.path.join(RAW, "worktrees_du.tsv"))
home_du = load_du(os.path.join(RAW, "homes_du.tsv"))
ru_du = load_du(os.path.join(RAW, "root_untracked_du.tsv"))
totals = load_du(os.path.join(RAW, "du_totals.tsv"))

wt_git = json.loads(rd("worktrees_git.json"))
pr_map = json.loads(rd("pr_lookup.json"))
b_scan = json.loads(rd("branch_scan.json"))

KEEP_ACTIVE = {"s2-authority-iso-20261025": "listed active (s2 authority line)",
               "u1-audit-master": "listed active (U1 audit)",
               "eb-e0-e1": "listed active (EB E0-E1)",
               "pr363-docs-review": "listed active (PR#363 docs review)",
               "a5-m2-int": "listed active (PR #360 head)"}

def wt_name(path):
    return os.path.basename(path) if path != "." else "ROOT-master"

# ---------- 1. worktrees.json ----------
entries = []
for w in wt_git:
    e = dict(w)
    du_bytes = wt_du.get(w["abs_path"])
    e["du_bytes"] = du_bytes
    if w["path"] == "." and du_bytes and du_bytes > 4_000_000_000:
        e["du_note"] = ("root du includes .worktrees+tests/homes+recovery+evidence+.git; "
                        "partial (unreadable dir tests/homes/reviewb-rgsem-NrPx/locked)")
    # untracked split (evidence vs non-evidence)
    untr = w.get("untracked_paths", [])
    untr_ne = [p for p in untr if not p.startswith(EVID)]
    e["untracked_non_evidence_count"] = len(untr_ne) if not w.get("untracked_truncated") else None
    e["untracked_non_evidence_paths"] = untr_ne
    name = wt_name(w["path"])
    b = w.get("branch_short")
    # open PRs (state OPEN only) and all PRs
    prs = pr_map.get(b, {}).get("prs", []) if b else []
    e["prs_all"] = [{"number": p["number"], "state": p["state"]} for p in prs]
    e["open_pr"] = next((p["number"] for p in prs if p["state"] == "OPEN"), None)
    other = w.get("other_modifications_count", 0)
    untr_n = w.get("untracked_count", 0)
    untr_ne_n = e["untracked_non_evidence_count"] if e["untracked_non_evidence_count"] is not None else untr_n
    loc = w.get("commits_not_on_remote")
    # classification
    if name in KEEP_ACTIVE:
        cls, reason = "KEEP-ACTIVE", KEEP_ACTIVE.get(name, "")
        if name == "u1-audit-master":
            reason += "; detached HEAD with all commits reachable from remotes"
    elif other > 0 or untr_ne_n > 0 or (loc or 0) > 0:
        bits = []
        if loc: bits.append(f"{loc} local-only commit(s)")
        if other: bits.append(f"{other} non-evidence tracked modification(s)")
        if untr_ne_n: bits.append(f"{untr_ne_n} untracked non-evidence file(s)")
        if untr_n > untr_ne_n: bits.append(f"{untr_n - untr_ne_n} untracked evidence-run file(s) (possibly sole copy)")
        cls, reason = "REUSE-CANDIDATE", "; ".join(bits)
    elif untr_n > untr_ne_n or w.get("untracked_truncated"):
        cls = "REUSE-CANDIDATE"
        reason = f"{untr_n} untracked under dev/agent-workflow/evidence only — uncommitted evidence, possibly sole copy; keep or relocate in U3"
    elif w.get("evidence_deletions_count", 0) > 0 and (loc == 0):
        cls = "REGENERABLE"
        reason = f"clean except {w['evidence_deletions_count']} evidence-purge deletions; all commits on remote"
    elif other == 0 and untr_n == 0 and loc == 0:
        cls = "REGENERABLE"
        reason = "clean worktree; all commits reachable from remotes"
    else:
        cls, reason = "UNKNOWN", "could not classify from collected facts"
    if w.get("dir_exists") is False or w.get("status_error"):
        cls, reason = "UNKNOWN", "worktree unreadable: " + str(w.get("status_error") or "dir missing")
    e["classification"] = cls
    e["classification_reason"] = reason
    if w["path"] == ".":
        e["note"] = ("primary master checkout (796 behind origin/master, 0 ahead) — not a disposable task worktree; "
                     "REUSE-CANDIDATE flags the KEEP-PROTECTED uncommitted SESSION_ROUTER_LOG.md incident entry + root scratch")
    e["reclaim_if_deleted_bytes"] = du_bytes if cls == "REGENERABLE" else None
    entries.append(e)

with open(os.path.join(U, "worktrees.json"), "w") as f:
    json.dump({"captured_utc": NOW, "source": "git worktree list --porcelain + per-worktree git status/rev-list + du -sb + gh pr list",
               "count": len(entries), "entries": entries}, f, indent=1)

# ---------- 2. local-only-branches.json ----------
lob = b_scan["local_only_branches"]
# add open PR for each branch
for b, rec in lob.items():
    prs = pr_map.get(b, {}).get("prs", [])
    rec["prs_all"] = [{"number": p["number"], "state": p["state"]} for p in prs]
with open(os.path.join(U, "local-only-branches.json"), "w") as f:
    json.dump({"definition": "local branches with commits not on any remote ref (git rev-list branch --not --remotes --count > 0)",
               "count": len(lob), "branches": lob, "stash": b_scan["stash"],
               "stash_full_stat_file": "raw/stash_0_stat.txt",
               "root_master_note": "master @6259cf4b is 796 behind origin/master, 0 ahead (git rev-list --count HEAD..origin/master); no local-only commits on master"},
              f, indent=1)

# ---------- bundle-refs.txt ----------
refs = sorted(lob.keys()) + ["refs/stash"]
with open(os.path.join(U, "bundle-refs.txt"), "w") as f:
    f.write("\n".join(refs) + "\n")

# ---------- 3. root-untracked.json ----------
srr = rd("session_router_log_sha256.txt").split()[0]
def classify_untracked(p):
    b = p.rstrip("/").split("/")[-1]
    if p.startswith(EVID):
        line = b.split("-")[0]
        protected = re.match(r'^(s1|s2|u1)-', b) or b == "u1-closure-20261025"
        return ("EVIDENCE", "KEEP-PROTECTED (s1-*/s2-*/u1-* line)" if protected else None)
    if p.rstrip("/") == "recovery":
        return ("RECOVERY", "recovery/ per F0")
    if (b.startswith((".tmp-", "tmp-", ".scratch-", ".rt-", ".probe-")) or
        re.match(r'^\.bteam-.*-msg\.txt$', b) or
        b in (".npm-cache", ".npm-probe-cache", ".pnpm-store-a5ie-r2b")):
        return ("SCRATCH", None)
    return ("UNKNOWN", None)

ru_entries = []
for l in rd("root_untracked_paths.txt").splitlines():
    if not l.strip(): continue
    cls, prot = classify_untracked(l)
    ru_entries.append({"path": l, "du_bytes": ru_du.get(l.rstrip("/")),
                       "classification": cls, "protection": prot})
scratch = sum(e["du_bytes"] or 0 for e in ru_entries if e["classification"] == "SCRATCH")
ru_json = {
    "root_checkout": {"branch": "master", "head": "6259cf4bc4d61af74d84bbd9d265184f95493172",
                      "behind_origin_master": 796, "ahead_origin_master": 0, "origin_master_tip": "4aaaa7b2a"},
    "uncommitted_incident_entry": {
        "path": "dev/agent-workflow/SESSION_ROUTER_LOG.md",
        "diff": "+17 / -0 (git diff --numstat)", "sha256": srr,
        "protection": "KEEP-PROTECTED (uncommitted SESSION_ROUTER_LOG incident entry)"},
    "du_note": "du measured 2026-10-25; dev/agent-workflow/evidence/u1-closure-20261025 grew during capture (this task writes there)",
    "counts_by_class": dict(collections.Counter(e["classification"] for e in ru_entries)),
    "scratch_total_bytes": scratch,
    "entries": ru_entries,
}
with open(os.path.join(U, "root-untracked.json"), "w") as f:
    json.dump(ru_json, f, indent=1)

# ---------- 4. homes.json ----------
refs_hit = {}
for l in rd("home_ref_hits.txt").splitlines():
    if not l.strip(): continue
    n, cnt = l.split("\t")[:2]
    refs_hit[n] = int(cnt)
lock_files = set(rd("home_files.txt").split())
lock_names = {n[:-5] for n in lock_files if n.endswith(".lock")}
TS = re.compile(r'20\d\d-?\d{2}-?\d{2}[T_]\d[\d:.TZ-]*Z*$|20\d{6}T[\dTZ-]+Z*$')
mtime = {}
for l in rd("home_mtimes.tsv").splitlines():
    parts = l.split("\t")
    if len(parts) == 3:
        mtime[parts[0]] = {"type": parts[1], "mtime_utc_epoch": float(parts[2])}
homes = []
all_home_names = rd("home_names.txt").split()
for n in all_home_names:
    path = "tests/homes/" + n
    du = home_du.get(path)
    if n == "reviewb-rgsem-NrPx":
        du = None  # du rc=1: Permission denied inside locked/; only 22 bytes readable -> NOT_OBSERVED
    if n in (".dsh-test", ".playwright-browsers"):
        cls, reason = "KEEP", "F0 rule: named KEEP"
    elif n in refs_hit:
        cls, reason = "KEEP-REFERENCED", f"referenced in s1*/s2* evidence ({refs_hit[n]} hit(s))"
    else:
        cls, reason = "REGENERABLE", "tests/homes/<world> scratch world; no reference in s1*/s2* evidence"
    m = TS.search(n)
    prefix = n[:m.start()].rstrip("-_") if m else n
    homes.append({"name": n, "du_bytes": du, "mtime_utc": mtime.get(n, {}).get("mtime_utc_epoch"),
                  "lock_sibling": n + ".lock" in lock_files, "prefix": prefix,
                  "classification": cls, "reason": reason})
grp = collections.defaultdict(lambda: {"count": 0, "du_bytes": 0})
for h in homes:
    g = grp[h["prefix"]]; g["count"] += 1
    g["du_bytes"] += h["du_bytes"] or 0
homes_out = {
    "count": len(homes),
    "du_sum_bytes": sum(h["du_bytes"] or 0 for h in homes),
    "tree_du_single_pass_bytes": 3744809488,
    "keep_set_single_pass_du_bytes": 1741616318,
    "regenerable_upper_bound_reclaim_bytes_approx": 3744809488 - 1741616318,
    "hardlink_note": ("homes are hardlinked world copies (observed inode link counts up to 32). "
                      "du -b values are apparent bytes; per-dir sum (9.8 GB) double-counts shared inodes, "
                      "single-pass tree du (3.74 GB) is the authoritative footprint. Reclaim if all "
                      "REGENERABLE worlds deleted ~= tree - KEEP-set single-pass = 2.00 GB (upper bound: "
                      "inodes shared with surviving KEEP worlds are not freed)."),
    "dsh_test_note": "`.dsh-test` (TEST_METHODS §7 durable home) is ABSENT from tests/homes — NOT_OBSERVED on disk",
    "du_note": "tests/homes/reviewb-rgsem-NrPx NOT_OBSERVED: du rc=1, Permission denied on locked/ subdir (only 22 bytes readable)",
    "orphan_lock_files": sorted(lock_names - set(all_home_names)),
    "keep_referenced_names": sorted(refs_hit),
    "groups_by_prefix": {k: v for k, v in sorted(grp.items(), key=lambda kv: -kv[1]["du_bytes"])},
    "classification_counts": dict(collections.Counter(h["classification"] for h in homes)),
    "regenerable_du_bytes": sum(h["du_bytes"] or 0 for h in homes if h["classification"] == "REGENERABLE"),
    "entries": homes,
}
with open(os.path.join(U, "homes.json"), "w") as f:
    json.dump(homes_out, f, indent=1)

# ---------- 5. runtime.json ----------
ss = []
for l in rd("ss_ltnp.txt").splitlines()[1:]:
    parts = l.split()
    if len(parts) >= 5 and parts[0] == "LISTEN":
        addr, port = parts[3].rsplit(":", 1)
        ss.append({"addr": addr, "port": int(port), "process": parts[5] if len(parts) > 5 else None})
tgt = set([3080]) | set(range(3180, 3187)) | set(range(3491, 3501))
listening = [s for s in ss if s["port"] in tgt]
df = subprocess.run(["df", "-B1", REPO], capture_output=True, text=True).stdout
pin = rd("host_pin.txt")
du_homes_partial = subprocess.run("du -sb tests/homes 2>/dev/null", shell=True, cwd=REPO, capture_output=True, text=True).stdout.strip()
runtime = {
    "listening_ports_of_interest": {"watched": "3080, 3180-3186, 3491-3500",
        "found": listening,
        "none_listening_note": "only 3080 (stable dev instance — not touched) found; no test-port listeners" if len(listening) == 1 else None},
    "ss_process_column_note": "ss -ltnp showed no process/owner info in this sandbox (process table not visible); NOT_OBSERVED for owner PIDs",
    "node_dsh_processes": {"observed": [], "note": "ps in sandbox sees only 4 processes (own namespace); host node/dsh processes NOT_OBSERVED"},
    "df_repo_filesystem": df,
    "du_totals_bytes": {k: totals.get(k) for k in (".worktrees", "recovery", "dev/agent-workflow/evidence", ".git")} | {
        "tests/homes": {"per_dir_sum": sum(h["du_bytes"] or 0 for h in homes),
                        "tree_du_partial": int(du_homes_partial.split()[0]) if du_homes_partial.split() and du_homes_partial.split()[0].isdigit() else "NOT_OBSERVED",
                        "note": "tree du -sb tests/homes exits 1: Permission denied on reviewb-rgsem-NrPx/locked"},
        ".worktrees_root_check": totals.get(".worktrees")},
    "host_pin": {"TEST_USE_BASELINE_SHA": "46a7f68b0922371ce7144b668b90e377d8e799f4",
                 "CLIENT_COMMIT_HASH": "46a7f68b09",
                 "tests/deepseek-harness-test_USE_HEAD": "639ed015397290b3745d163aafe02ffee4aa3f84",
                 "test_use_porcelain_count": 0,
                 "pin_matches_head": False,
                 "note": "test-use checkout HEAD 639ed015397 (merge PR #5479 release dsh-0.2.0-rc.2) != pinned baseline 46a7f68b09 (0.1.7-rc.1); baseline is an ancestor of HEAD (git merge-base --is-ancestor OK); porcelain empty"},
}
with open(os.path.join(U, "runtime.json"), "w") as f:
    json.dump(runtime, f, indent=1)

# ---------- summary numbers for SUMMARY.md ----------
def s(seq): return sum(x for x in seq if x is not None)
wt_by_cls = collections.defaultdict(list)
for e in entries: wt_by_cls[e["classification"]].append(e)
summary = {
  "worktree_counts": {k: len(v) for k, v in wt_by_cls.items()},
  "worktree_du_by_cls": {k: s(e["du_bytes"] for e in v) for k, v in wt_by_cls.items()},
  "homes": {"count": len(homes), "total": s(h["du_bytes"] for h in homes),
            "regenerable": sum(h["du_bytes"] or 0 for h in homes if h["classification"]=="REGENERABLE"),
            "keep": sum(h["du_bytes"] or 0 for h in homes if h["classification"]=="KEEP"),
            "keep_referenced": sum(h["du_bytes"] or 0 for h in homes if h["classification"]=="KEEP-REFERENCED")},
  "root_untracked": {"scratch": scratch,
                     "by_cls_du": {c: s(e["du_bytes"] for e in ru_entries if e["classification"]==c)
                                   for c in ("SCRATCH","EVIDENCE","RECOVERY","UNKNOWN")},
                     "unknown_paths": [e["path"] for e in ru_entries if e["classification"]=="UNKNOWN"]},
  "local_only": {"branch_count": len(lob), "commit_total": sum(r["commits_not_on_remote"] for r in lob.values()),
                 "stashes": len(b_scan["stash"])},
  "top20": sorted([(h["du_bytes"], "home:"+h["name"]) for h in homes] +
                  [(e["du_bytes"], "worktree:"+e["path"]) for e in entries if e["path"] != "."] +
                  [(e["du_bytes"], "root-untracked:"+e["path"]) for e in ru_entries],
                  key=lambda t: -(t[0] or 0))[:20],
  "totals": totals,
}
with open(os.path.join(RAW, "summary_numbers.json"), "w") as f:
    json.dump(summary, f, indent=1)
print("ASSEMBLED")
print(json.dumps({k: v for k, v in summary.items() if k not in ("top20",)}, indent=1)[:2500])
