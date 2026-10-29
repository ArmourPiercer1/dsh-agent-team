#!/usr/bin/env bash
# U1-A: find which home names are referenced under dev/agent-workflow/evidence/s1-*/s2-*.
# Pass 1: fast fixed-string filename list. Pass 2: PCRE longest-context (boundary) per candidate file.
# Binary files are skipped (-I) and their count noted. Read-only.
set -u
cd /srv/workspace/dsh-plugins/dsh-agent-team
U=dev/agent-workflow/evidence/u1-closure-20261025/u1a
DIRS=$(cat "$U/raw/s1s2_dirs.txt")
# Pass 1
: > "$U/raw/home_ref_candidate_files.txt"
xargs -d '\n' -a "$U/raw/s1s2_dirs.txt" -P 4 -n 1 grep -rlIF -f "$U/raw/home_names.txt" -- >> "$U/raw/home_ref_candidate_files.txt" 2>/dev/null
sort -u "$U/raw/home_ref_candidate_files.txt" -o "$U/raw/home_ref_candidate_files.txt"
echo PASS1_FILES $(wc -l < "$U/raw/home_ref_candidate_files.txt")
# Pass 2: escaped PCRE patterns with both-boundary lookarounds so ".dsh-test" does not
# match inside ".dsh-test-rc2b" (escaping done by python re.escape for safety).
python3 - "$U/raw/home_names.txt" "$U/raw/home_names_pcre.txt" <<'EOF'
import re, sys
inp, outp = sys.argv[1], sys.argv[2]
with open(inp) as f, open(outp, 'w') as o:
    for line in f:
        n = line.rstrip('\n')
        if not n:
            continue
        o.write('(?<![A-Za-z0-9._-])' + re.escape(n) + '(?![A-Za-z0-9._-])\n')
EOF
: > "$U/raw/home_ref_hits.txt"
xargs -d '\n' -a "$U/raw/home_ref_candidate_files.txt" -P 4 -n 20 grep -aHoiP -f "$U/raw/home_names_pcre.txt" -- >> "$U/raw/home_ref_hits.txt" 2>/dev/null
echo PASS2_HITS $(wc -l < "$U/raw/home_ref_hits.txt")
echo DONE_GREP_HOMES
