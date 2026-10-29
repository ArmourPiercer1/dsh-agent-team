#!/usr/bin/env python3
"""U1-A: git metadata collector (strictly read-only git/gh invocations).

Writes:
  raw/worktrees_git.json  per-worktree git facts (no du, no classification)
  raw/branch_scan.json    local branches with commits not on any remote + stash info
  raw/pr_lookup.json      branch -> [PR {number,state,url}] (gh, read-only)
"""
import json, subprocess, sys, os
from concurrent.futures import ThreadPoolExecutor

REPO = "/srv/workspace/dsh-plugins/dsh-agent-team"
U = os.path.join(REPO, "dev/agent-workflow/evidence/u1-closure-20261025/u1a")
RAW = os.path.join(U, "raw")
EVID_PREFIX = "dev/agent-workflow/evidence"

def sh(args, cwd=REPO):
    p = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    return p.returncode, p.stdout, p.stderr

# ---------- worktrees ----------
def parse_worktrees():
    _, out, _ = sh(["git", "worktree", "list", "--porcelain"])
    entries, cur = [], {}
    for line in out.splitlines():
        if line.startswith("worktree "):
            if cur: entries.append(cur)
            cur = {"path": line[len("worktree "):]}
        elif line.startswith("HEAD "):
            cur["head_sha"] = line[5:]
        elif line.startswith("branch "):
            cur["branch"] = line[len("branch "):]
        elif line == "detached":
            cur["detached"] = True
        elif line.startswith("prunable"):
            cur["prunable"] = line.strip()
    if cur: entries.append(cur)
    return entries

def worktree_facts(wt):
    path = wt["path"]
    rel = os.path.relpath(path, REPO)
    e = {
        "path": rel, "abs_path": path,
        "branch": wt.get("branch"), "detached": bool(wt.get("detached")),
        "head_sha": wt.get("head_sha"), "prunable": wt.get("prunable"),
        "dir_exists": os.path.isdir(path),
    }
    if not e["dir_exists"]:
        e["status_error"] = "worktree directory missing"
        return e
    _, d, err = sh(["git", "show", "-s", "--format=%cI|%s", "HEAD"], cwd=path)
    if "|" in d:
        e["head_commit_date"], e["head_subject"] = d.split("|", 1)
        e["head_subject"] = e["head_subject"].strip()
    # status
    rc, out, err = sh(["git", "status", "--porcelain=1", "--untracked-files=normal"], cwd=path)
    if rc != 0:
        e["status_error"] = (err or "").strip()[:300]
    else:
        ev_del, other, untracked = [], [], []
        for line in out.splitlines():
            if not line.strip():
                continue
            xy, fpath = line[:2], line[3:]
            if xy == "??":
                untracked.append(fpath)
                continue
            p1 = fpath.split(" -> ")[-1]
            if "D" in xy and p1.startswith(EVID_PREFIX):
                ev_del.append(xy + " " + p1)
            else:
                other.append(xy + " " + fpath)
        e["evidence_deletions_count"] = len(ev_del)
        e["evidence_deletions_sample"] = ev_del[:10]
        e["other_modifications_count"] = len(other)
        e["other_modifications"] = other[:100]
        e["untracked_count"] = len(untracked)
        e["untracked_paths"] = untracked if len(untracked) <= 50 else untracked[:50]
        e["untracked_truncated"] = len(untracked) > 50
    # local-only commits
    rc, out, err = sh(["git", "rev-list", "HEAD", "--not", "--remotes", "--count"], cwd=path)
    e["commits_not_on_remote"] = int(out.strip()) if rc == 0 and out.strip().isdigit() else None
    if rc != 0:
        e["revlist_error"] = (err or "").strip()[:200]
    return e

wt_entries = parse_worktrees()
with ThreadPoolExecutor(max_workers=6) as ex:
    wt_facts = list(ex.map(worktree_facts, wt_entries))

# branch on origin (from root repo)
_, remotes_out, _ = sh(["git", "for-each-ref", "--format=%(refname)", "refs/remotes"])
remote_refs = set(remotes_out.split())
for e in wt_facts:
    b = e.get("branch")
    if b:
        short = b.replace("refs/heads/", "")
        e["branch_short"] = short
        e["branch_on_origin"] = f"refs/remotes/origin/{short}" in remote_refs
    else:
        e["branch_on_origin"] = None

# ---------- branches with local-only commits ----------
_, heads, _ = sh(["git", "for-each-ref", "--format=%(refname:short)\t%(objectname)", "refs/heads"])
wt_branches = {e["branch_short"]: e["path"] for e in wt_facts if e.get("branch_short")}

def branch_facts(line):
    short, sha = line.split("\t")
    rc, out, _ = sh(["git", "rev-list", f"refs/heads/{short}", "--not", "--remotes", "--count"])
    n = int(out.strip()) if out.strip().isdigit() else None
    rec = {"branch": short, "tip_sha": sha, "commits_not_on_remote": n,
           "checked_out_in_worktree": wt_branches.get(short)}
    if n:
        _, d, _ = sh(["git", "show", "-s", "--format=%cI\t%s", sha])
        if "\t" in d:
            rec["tip_date"], rec["tip_subject"] = d.split("\t", 1)
    return short, n, rec

branch_local = {}
with ThreadPoolExecutor(max_workers=8) as ex:
    for short, n, rec in ex.map(branch_facts, [l for l in heads.splitlines() if l.strip()]):
        if n:  # only local-only-owning branches
            branch_local[short] = rec

# stash
rc, stash_out, _ = sh(["git", "stash", "list"])
stashes = [l for l in stash_out.splitlines() if l.strip()]
stash_details = []
for i, s in enumerate(stashes):
    ref = f"stash@{{{i}}}"
    rc1, stat, _ = sh(["git", "stash", "show", "--stat", ref])
    rc2, meta, _ = sh(["git", "show", "--format=%H|%cI|%s", "-s", ref])
    rc3, cnt, _ = sh(["git", "rev-list", "--count", ref, "--not", "--remotes"])
    rc4, onrem, _ = sh(["git", "stash", "list"])
    stash_details.append({
        "ref": ref, "desc": s.split(": ", 2)[-1] if ": " in s else s,
        "base_commit_info": meta.strip(),
        "stat_summary_tail": "\n".join(stat.splitlines()[-3:]) if rc1 == 0 else None,
        "stat_files_changed": len(stat.splitlines()) - 1 if rc1 == 0 and stat.strip() else 0,
        "full_stat_saved_to": f"raw/stash_{i}_stat.txt",
    })
    with open(os.path.join(RAW, f"stash_{i}_stat.txt"), "w") as f:
        f.write(stat)

with open(os.path.join(RAW, "worktrees_git.json"), "w") as f:
    json.dump(wt_facts, f, indent=1)
with open(os.path.join(RAW, "branch_scan.json"), "w") as f:
    json.dump({"local_only_branches": branch_local, "stash": stash_details}, f, indent=1)
print("DONE_GIT_META worktrees=%d local_only_branches=%d stashes=%d" %
      (len(wt_facts), len(branch_local), len(stashes)))

# ---------- gh PR lookup (branch -> PRs), read-only ----------
branches = sorted({e["branch_short"] for e in wt_facts if e.get("branch_short")})
def gh_prs(b):
    rc, out, err = sh(["gh", "pr", "list", "--repo", "ArmourPiercer1/dsh-agent-team",
                       "--state", "all", "--head", b, "--json", "number,state,url"])
    if rc != 0:
        return b, {"error": (err or "").strip()[:200]}
    try:
        return b, {"prs": json.loads(out)}
    except Exception as ex:
        return b, {"error": str(ex)[:200]}

with ThreadPoolExecutor(max_workers=4) as ex:
    pr_map = dict(ex.map(gh_prs, branches))
with open(os.path.join(RAW, "pr_lookup.json"), "w") as f:
    json.dump(pr_map, f, indent=1)
print("DONE_PR_LOOKUP", len(pr_map))
