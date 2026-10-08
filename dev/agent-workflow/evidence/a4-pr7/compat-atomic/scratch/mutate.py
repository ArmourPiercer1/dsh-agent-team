import subprocess, shutil, os, re
E='dev/agent-workflow/evidence/a4-pr7/compat-atomic'
PROBE='packages/runtime/compatibility/probe.ts'
AUTH='packages/runtime/compatibility/authority.ts'
COMPAT='packages/storage/repositories/compatibility.ts'
FILES=[PROBE,AUTH,COMPAT]

def splice_method_tail(path, after_marker, lines):
    """Replace the body of the method containing `after_marker` from that marker
    to just before its closing `  }` with `lines`."""
    s=open(path).read().splitlines(keepends=True)
    start=next(i for i,l in enumerate(s) if after_marker in l)
    i=next(k for k in range(start,len(s)) if 'const next = serializeCompatibilityState(record)' in s[k])
    j=next(k for k in range(i,len(s)) if s[k].rstrip('\n')=='  }')
    s[i:j]=[l+'\n' for l in lines]
    return ''.join(s)

def mut_cas_is_old_delete_put():
    return (COMPAT, splice_method_tail(COMPAT,'async replaceIfGeneration',[
      '    // MUTANT: the OLD destructive replace, performed behind the new name.',
      '    await this.delete(key)',
      '    const stored = await this.put(record)',
      '    return stored',
    ]))

def mut_anchor(path, old, new):
    s=open(path).read()
    assert old in s, ('anchor missing', path)
    return (path, s.replace(old,new,1))

MUTS=[
 ("M1-cas-performs-the-old-delete-then-put", mut_cas_is_old_delete_put),
 ("M2-drop-the-generation-check", lambda: mut_anchor(COMPAT,
    "      if (existing.generation !== expectedGeneration) {\n        throw teamDomainError(\n          'RECORD_DUPLICATE',",
    "      if (false) {\n        throw teamDomainError(\n          'RECORD_DUPLICATE',")),
 ("M3-no-convergence-always-fail-closed", lambda: mut_anchor(AUTH,
    "        if (row === undefined || row.fingerprint !== liveFingerprint) {",
    "        if (row !== undefined || true) {")),
 ("M4-converge-ignoring-the-fingerprint", lambda: mut_anchor(AUTH,
    "        if (row === undefined || row.fingerprint !== liveFingerprint) {",
    "        if (row === undefined) {")),
 ("M5-cold-create-loses-its-branch", lambda: mut_anchor(COMPAT,
    "    if (expectedGeneration === 0) {\n      // The cold transition: one durable create; an occupied key is the typed\n      // report of a concurrent creator (see the disclosed residual above).\n      return this.put(record)\n    }\n",
    "")),
 ("M6-drop-the-generation-stamp-advance", lambda: mut_anchor(PROBE,
    "    await repositories.compatibility.replaceIfGeneration(record, expectedGeneration)\n    await repositories.teamSessions.advanceGeneration(rootSessionId)",
    "    await repositories.compatibility.replaceIfGeneration(record, expectedGeneration)")),
]

def backup():
    for f in FILES: shutil.copy(f, f+'.mutbak')
def restore():
    for f in FILES:
        if os.path.exists(f+'.mutbak'): shutil.move(f+'.mutbak', f)

def run(name):
    # A leftover world dir from a killed run collides with the next scenario
    # ("team_domain already exists"), which would report as a leg failure and be
    # read as a mutation signal. Clean the fault-scratch root before every run,
    # exactly as the repo's pre-vitest step does.
    shutil.rmtree('packages/testkit/test/.tmp-fault', ignore_errors=True)
    env=dict(os.environ, CI='true', XDG_CACHE_HOME='/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache')
    try:
        p=subprocess.run(['npx','vitest','run','packages/runtime/test/a4-compat-atomic-state.test.ts'],
                         capture_output=True, text=True, env=env, timeout=90)
        out=p.stdout+p.stderr
    except subprocess.TimeoutExpired as e:
        out=(e.stdout or b'').decode()+ (e.stderr or b'').decode() + '\n[HUNG: the mutated product path never reached the seam the leg parks on]\n'
    open(f'{E}/raw/mutation-{name}.log','w').write(out)
    reds=sorted(set(re.findall(r'^\s*[×✕]\s+(.+?) \d+ms', out, re.M)))
    if 'HUNG' in out: reds.append('(run hung: the mutated path no longer performs the write this leg parks on)')
    if not reds:
        reds=['(NO RED — the mutation is NOT reachable from these legs) ' + (l.strip() for l in out.splitlines() if 'Tests ' in l).__next__() if any('Tests ' in l for l in out.splitlines()) else '(NO RED)']
    return reds

backup()
rows=[]
try:
    for name, build in MUTS:
        try:
            path, text = build()
            open(path,'w').write(text)
            rows.append((name, run(name)))
        except Exception as e:
            rows.append((name,[f'HARNESS ERROR {e!r}']))
        finally:
            restore(); backup()
finally:
    restore()

with open(f'{E}/raw/mutation-table.md','w') as fh:
    fh.write('# Mutation table — `packages/runtime/test/a4-compat-atomic-state.test.ts`\n\n'
             'Every mutation is a single production-line change reverted immediately after its run '
             '(logs in `raw/mutation-*.log`). A RED LEG IS THE REACHABILITY PROOF: the mutated line is '
             'on the path these legs drive, so the leg\'s green means the property holds, not that '
             'nothing was observed.\n\n')
    for name, reds in rows:
        fh.write(f'## {name}\n\n')
        for r in reds: fh.write(f'- {r}\n')
        fh.write('\n')
print(open(f'{E}/raw/mutation-table.md').read())
