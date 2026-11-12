import re,subprocess
reg='docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md'
for it in range(40):
    p=subprocess.run(['node','--test','tests/world-factory/a5sf-debt-register.test.mjs'],capture_output=True,text=True)
    out=p.stdout+p.stderr
    m=re.search(r'AssertionError \[ERR_ASSERTION\]: (\S+): anchor (\S+?)#L(\d+)(?:-(\d+))? no longer contains "([^"]+)"',out)
    if not m:
        print('DONE' if p.returncode==0 else 'other failure')
        if p.returncode!=0: print('\n'.join([l for l in out.splitlines() if 'AssertionError' in l][:2]))
        break
    row,path,a,b,sym=m.groups()
    rng = True
    raw=f'{path}#L{a}-L{b or a}'
    lines=open(path,encoding='utf-8').read().split('\n')
    hits=[i+1 for i,l in enumerate(lines) if sym in l]
    if not hits: print('SYMBOL CHANGED:',row,path,'|',sym); break
    defs=[h for h in hits if re.search(r'\b(function|const|class|interface|type)\b', lines[h-1])]
    new_a=(defs or hits)[0]
    new_raw=f'{path}#L{new_a}-L{new_a+(int(b or a)-int(a))}'
    s=open(reg,encoding='utf-8').read()
    if raw not in s: print('not found:',raw); break
    # repair already-mangled descending ranges too
    open(reg,'w',encoding='utf-8').write(s.replace(raw,new_raw,1))
    print(f'{row}: {raw} -> {new_raw}')
