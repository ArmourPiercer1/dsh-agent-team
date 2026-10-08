#!/usr/bin/env python3
"""Query the registered-leg index: q.py <regex> [more regexes] [--index client]"""
import re, sys, os
EV = os.path.dirname(os.path.abspath(__file__))
idx = f'{EV}/registered-legs-before.tsv'
args = sys.argv[1:]
if args and args[0] == '--client':
    idx = f'{EV}/client-names-before.txt'; args = args[1:]
pats = [re.compile(a, re.I) for a in args]
rows = []
with open(idx) as f:
    for line in f:
        parts = line.rstrip('\n').split('\t') if idx.endswith('tsv') else [
            (lambda s: (s[0], s[1], s[2]))(re.match(r'^(.*?)::(.*?)::(\w+)$', line.rstrip('\n')).groups()
             if re.match(r'^(.*?)::(.*?)::(\w+)$', line.rstrip('\n')) else (line.rstrip('\n'), '', ''))]
        if len(parts) < 4 and idx.endswith('tsv'):
            continue
        if idx.endswith('tsv'):
            path, desc, title, status, full = parts
        else:
            path, full, status = parts; desc, title = '', full
        hay = path + ' ' + full
        if all(p.search(hay) for p in pats):
            rows.append((path, status, full, path, desc, title))
seen = set()
for path, status, full, *_ in rows:
    key = (path, full)
    if key in seen:
        continue
    seen.add(key)
    print(f'[{status}] {path} > {full}')
print(f'--- {len(seen)} match(es) in {os.path.basename(idx)}')
