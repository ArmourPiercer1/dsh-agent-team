#!/usr/bin/env python3
"""Extract one `run:` step of .github/workflows/census-runtime.yml into (script, env) files.

A `run:` block is only half of a step. Its `env:` mapping is the other half, and `${{ … }}` inside
that mapping is resolved by the RUNNER, so executing the extracted script without its env is not a
dry run of the step — it is a dry run of something else. The first version of e2e-provision-run.sh
did exactly that: HOST_URL came out empty, `mkdir -p ""` failed, the block fell through to build
THIS repo, and the simulation reported a green that had tested the wrong tree.

usage: extract-step.py <workflow> <job> <index-among-run-steps> <out-prefix> [<runner-temp>]
writes <out>.sh (the script) and <out>.env (shell assignments for job env + step env, with the two
contexts this file uses substituted: runner.temp, github.workspace).
"""
import re
import sys

import yaml

workflow, job_id, index, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
runner_temp = sys.argv[5] if len(sys.argv) > 5 else "/tmp/runner-temp"

job = yaml.safe_load(open(workflow, encoding="utf-8"))["jobs"][job_id]
steps = [s for s in job.get("steps") or [] if "run" in s]
step = steps[index]

# actionlint's `shell: bash` is `bash -e`; nothing else in these files overrides it.
open(out + ".sh", "w", encoding="utf-8").write(step["run"])

env = {}
env.update(job.get("env") or {})
env.update(step.get("env") or {})
with open(out + ".env", "w", encoding="utf-8") as f:
    for k, v in env.items():
        v = str(v)
        v = re.sub(r"\$\{\{\s*runner\.temp\s*\}\}", runner_temp, v)
        v = v.replace("${{ github.workspace }}", ".")
        if "${{" in v:
            raise SystemExit(f"unhandled context expression in {job_id}.steps[{index}].env.{k}: {v}")
        f.write("export %s=%s\n" % (k, "'" + v.replace("'", "'\\''") + "'"))
print(f"{out}.sh ({len(steps[index]['run'].splitlines())} lines) + {out}.env ({len(env)} vars)")
