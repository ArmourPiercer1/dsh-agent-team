#!/usr/bin/env python3
"""Offline lint for a GitHub Actions workflow file — the checks available in a sandbox with no
actionlint, run BEFORE spending a hosted run.

Why this exists: a hosted workflow file is an interface, and GitHub rejects the WHOLE file for one
illegal expression, producing a red run with ZERO jobs, no log and no annotation. That happened to
`pr-gate.yml` four times over (`${{ runner.temp }}` in `jobs.<id>.env`, where the `runner` context is
not permitted). actionlint named both lines in under a second; `command -v actionlint` is empty in
this sandbox, so this script runs the two checks that ARE available.

usage: python3 offline-lint-workflow.py <worktree-root> <workflow.yml> [more.yml …]
exit 0 = every check clean on every file.

Checks, in the order they catch real incidents:
  1. YAML parses at all (pyyaml — the SAME parser the graph-parse leg and the pre-commit hook use).
  2. No `${{ … }}` in any env mapping uses a context illegal in that scope. The encoded rule is
     GitHub's permitted-context list for `jobs.<id>.env` (github, inputs, matrix, needs, secrets,
     strategy, vars); `runner` there is the bug that cost four job-less runs.
  3. Every `run:` block passes `bash -n` (syntax check, nothing executed).
  4. Every `run:` block goes through findContinuationComments(), EXPORTED from
     scripts/ci-pr-gate.mjs for exactly this purpose: a `#` between backslash-continued command
     lines silently eats the rest of the logical line (hosted run 37801019804 lost --allow-refused,
     --census-test-timeout, --store-dir and --transcript-dir that way while the runner log echoed
     them as if they had run).
"""
import os
import re
import subprocess
import sys
import tempfile

import yaml

# Permitted contexts in `jobs.<job_id>.env` per GitHub's expression-context documentation.
JOB_ENV_ALLOWED = {"github", "inputs", "matrix", "needs", "secrets", "strategy", "vars"}


def walk_runs(node, path, out):
    """Collect (label, script) for every `run:` in the document, whatever nesting it lives at."""
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "run" and isinstance(v, str):
                out.append((path, v))
            else:
                walk_runs(v, f"{path}.{k}", out)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk_runs(v, f"{path}[{i}]", out)


def env_scopes(doc):
    """Yield (scope_label, is_job_level, env_mapping) for every env mapping under jobs."""
    for jid, job in ((doc or {}).get("jobs") or {}).items():
        if not isinstance(job, dict):
            continue
        yield (f"jobs.{jid}.env", True, job.get("env") or {})
        for i, step in enumerate(job.get("steps") or []):
            if isinstance(step, dict):
                yield (f"jobs.{jid}.steps[{i}].env", False, step.get("env") or {})


def contexts_in(value):
    return [m.group(1).strip().split(".")[0] for m in re.finditer(r"\$\{\{\s*([^}]*?)\s*\}\}", str(value))]


def bash_n(script):
    with tempfile.NamedTemporaryFile("w", suffix=".sh", delete=False) as f:
        f.write(script)
        name = f.name
    try:
        r = subprocess.run(["bash", "-n", name], capture_output=True, text=True)
        return r.returncode, (r.stdout + r.stderr).strip()
    finally:
        os.unlink(name)


def continuation_probe(gate_path, script):
    """Call the EXPORTED findContinuationComments by importing the real file, not a copy of its rule."""
    js = (
        "import(%s).then((m) => {"
        "const chunks = [];"
        "process.stdin.on('data', (c) => chunks.push(c));"
        "process.stdin.on('end', () => {"
        "process.stdout.write(JSON.stringify(m.findContinuationComments(Buffer.concat(chunks).toString('utf8'))));"
        "});});"
    ) % repr(os.path.abspath(gate_path))
    r = subprocess.run(["node", "-e", js], input=script, capture_output=True, text=True)
    if r.returncode != 0:
        return None, (r.stdout + r.stderr).strip()
    return r.stdout.strip(), None


fail = 0
worktree, targets = sys.argv[1], sys.argv[2:]
gate = os.path.join(worktree, "scripts", "ci-pr-gate.mjs")
if not os.path.isfile(gate):
    sys.exit(f"no {gate} — pass the worktree root as argv[1]")

for target in targets:
    print(f"=== {target}")
    raw = open(target, encoding="utf-8").read()
    try:
        doc = yaml.safe_load(raw)
        print("  [1] YAML parse (pyyaml): ok")
    except yaml.YAMLError as e:
        print(f"  [1] YAML parse (pyyaml): FAIL {e}")
        sys.exit(1)

    bad_ctx = []
    for scope, is_job_env, env in env_scopes(doc):
        for k, v in (env or {}).items():
            for c in contexts_in(v):
                if c == "":
                    bad_ctx.append(f"{scope}: {k} contains an empty expression")
                elif is_job_env and c not in JOB_ENV_ALLOWED:
                    bad_ctx.append(f"{scope}: {k} uses context `{c}`; permitted: {', '.join(sorted(JOB_ENV_ALLOWED))}")
    if bad_ctx:
        fail = 1
        print("  [2] expression-context scope: FAIL")
        for b in bad_ctx:
            print(f"      {b}")
    else:
        print("  [2] expression-context scope: ok (no `runner`-class context in any job-level env)")

    blocks = []
    walk_runs(doc, "doc", blocks)
    code_bad = [(lbl, err) for lbl, s in blocks for (code, err) in [bash_n(s)] if code != 0]
    if code_bad:
        fail = 1
        print(f"  [3] bash -n on {len(blocks)} run: block(s): FAIL")
        for lbl, err in code_bad:
            print(f"      {lbl}: {err}")
    else:
        print(f"  [3] bash -n on {len(blocks)} run: block(s): all clean")

    fcc_bad, fcc_err = [], []
    for lbl, s in blocks:
        got, err = continuation_probe(gate, s)
        if err is not None:
            fcc_err.append(f"{lbl}: node probe failed: {err}")
        elif re.findall(r"\d+", got or "[]"):
            fcc_bad.append(f"{lbl}: comment inside a backslash continuation at line(s) {re.findall(r'[\d]+', got)}")
    if fcc_bad or fcc_err:
        fail = 1
        print("  [4] findContinuationComments (exported from scripts/ci-pr-gate.mjs): FAIL")
        for m in fcc_bad + fcc_err:
            print(f"      {m}")
    else:
        print("  [4] findContinuationComments (exported from scripts/ci-pr-gate.mjs): all clean")

print("OFFLINE-LINT", "FAIL" if fail else "PASS")
sys.exit(fail)
