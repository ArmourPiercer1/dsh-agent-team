# Host-absolute path audit — UTE-G1 captured transcripts

**Date:** 2026-11-21. **Scope owner:** `task/ute3-truth-v2-20261121`.
**Finding:** `VERIFICATION-2.md` §2 (non-blocking table, "absolute host paths … **PARTIAL**")
and §6. The first remediation's verification grep listed only the ledger-cited new-path
files, so `ute3-search-b1-20261120/{README.md,lane-suite.txt}` and
`ute3-search-b2-20261120/lane-suite.txt` still carried `/home/armourpiercer/...`.

## What "captured transcript" means here

A file in `dev/agent-workflow/evidence/` that records the **output** of a command run in
this repository (a lane suite, a capture, a gate, a probe, a hosted job log). Review
prose (`ute3-review-20261121/REVIEW.md`, `VERIFICATION-2.md`) is not a transcript and is
left verbatim as the record of what the reviewers wrote.

## The redaction

The replacement is textual and mechanical; it changes path spelling only. The rules, in
order (the first match wins):

| pattern | replacement |
| --- | --- |
| `/home/<this-host>/projects/dsh-agent-team/.worktrees/<lane>` | `<host-root>/.worktrees/<lane>` |
| `/home/<this-host>/projects/dsh-agent-team` | `<host-root>` |
| `/home/runner/work/dsh-agent-team/dsh-agent-team` (hosted runner root) | `<host-root>` |
| any remaining `/home/<user>` | `<host-root>` |
| `/Users/<user>` | `<host-root>` |
| absolute `/tmp/` (including `file:///tmp/`) | `<tmp>/` |
| `/srv/` | `<srv>/` |
| session-slug encoding `--home-<host>-projects-dsh-agent-team` | `--host-root` |

Relative `.artifacts/tmp/` paths are **not** touched: the `tmp` there is a directory name
inside the worktree, not an absolute root.

**Why textual redaction is acceptable.** These files are records, not generator inputs
that must be reproducible byte-for-byte: the lane suites compare their **own fresh
output** against transcripts committed under `dev/agent-workflow/evidence/ute-g1-fs-20261121/`,
`ute3-search-b1-20261120/negative-controls.txt` and `ute3-search-b2-20261120/new-path-run.txt`,
and those three are already path-clean and were not edited here. Re-running a lane suite
prints the same measurements; only the host prefix in a `fixture=`/`tree=`/`entry=` field
would differ, and the generators now emit relative paths. No measured number changed:
re-applying the exact rules above to each file's `HEAD` bytes reproduces the committed
bytes exactly (`node .artifacts/tmp/verify-redact.mjs` → `files=21 mismatch=0`), so only
the recorded path spellings changed.

## Files changed (21)

```
ute1-fs-binding-20261120/{gates,prebuild-failure,postbuild-pass,suite,legacy-fs-before-after,mutation-transcript}.txt
ute1-fs-binding-20261120/lifecycle/{mutation-transcript,suite}.txt
ute3-routec-image-20261120/{gates.txt,red-before-fix.txt}
ute3-search-b1-20261120/{README.md,lane-suite.txt}
ute3-search-b2-20261120/lane-suite.txt
ute-g1-fs-20261119/{ci-lane-step,gates,host-provisioning,new-path-run,next-lane,testkit-after.log}.txt
ute-g1-fs-20261120/{hosted-ci-failure,postbuild-product-lane}.txt
```

## The audit grep

Whole UTE-G1 evidence set (`ute0-*`, `ute1-*`, `ute2-*`, `ute3-*`, `ute-g1-*`), absolute
roots only, excluding the review directory:

```
$ grep -rInE '(^|[^.[:alnum:]_/-])(/home/|/Users/|/tmp/|/srv/)' \
    dev/agent-workflow/evidence/ute0-* dev/agent-workflow/evidence/ute1-* \
    dev/agent-workflow/evidence/ute2-* dev/agent-workflow/evidence/ute3-* \
    dev/agent-workflow/evidence/ute-g1-* | grep -v ute3-review-20261121 | wc -l
0
```

The same grep over the **whole** `dev/agent-workflow/evidence/` tree still returns
**6,574 files / 62,380 lines**, all in historical pre-UTE evidence directories
(`a5sf-*`, `c2-*`, `a6-*`, `v016-*`, …). Those transcripts are outside the UTE-G1
evidence set that the release request and the retirement ledger cite, are not inputs to
any UTE-G1 claim, and many of them are byte-compared by their own suites (a mechanical
redaction there would either red those suites or require regenerating unrelated
historical evidence). They are therefore recorded as **out of this PR's scope**, not as
"clean"; this audit claims zero host-absolute paths only for the UTE-G1 evidence set.

The one raw-pattern residue inside the UTE set is relative `.artifacts/tmp/...` text
(e.g. `ute3-process-b1-20261120/composition-probe.txt`, `ute-g1-fs-20261119/isolation.txt`),
which matches `/tmp/` literally but is not an absolute path and is left as-is.
