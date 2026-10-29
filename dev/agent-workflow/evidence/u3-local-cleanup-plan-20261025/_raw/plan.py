#!/usr/bin/env python3
"""U3-B DRY-RUN cleanup planner. Reads u1a inventory + live state; writes plan TSVs.
Deletes NOTHING. bytes = du -sb apparent; dir sha256 = manifest algorithm reproducible in
execute.sh: sort regular-file+symlink lines '<sha>  <./rel>\n' / 'L <target> <./rel>\n'
by path bytes (LC_ALL=C), hash the concatenation."""
import json, os, subprocess, hashlib, collections, sys

ROOT='/srv/workspace/dsh-plugins/dsh-agent-team'
PLAN=ROOT+'/dev/agent-workflow/evidence/u3-local-cleanup-plan-20261025'
RAW=PLAN+'/_raw'
STORE_REL='.artifacts/evidence'
CUTOFF=1792922400                     # 2026-10-25T10:00Z
EVID='dev/agent-workflow/evidence'

def sh(args, cwd=None):
    r=subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    return r.returncode, r.stdout, r.stderr

def sha_file(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for c in iter(lambda:f.read(1<<20), b''): h.update(c)
    return h.hexdigest()

def manifest_lines(base):
    """(path_bytes, line_bytes) for every non-dir entry under base.
    Line format (byte-identical to execute.sh manifest_dir):
      regular: '<sha256>  ./<rel>\n' ; symlink: 'L <target> ./<rel>\n'"""
    out=[]; nperm=[0]
    def rec(relb):
        d=os.path.join(base, os.fsdecode(relb)) if relb else base
        try:
            it=list(os.scandir(d))
        except OSError:
            nperm[0]+=1; return
        for e in it:
            eb=(relb+b'/' if relb else b'')+os.fsencode(e.name)
            try:
                if e.is_symlink():
                    out.append((eb, b'L '+os.fsencode(os.readlink(e.path))+b' ./'+eb+b'\n'))
                elif e.is_dir(follow_symlinks=False):
                    rec(eb)
                else:
                    try: fh=sha_file(e.path)
                    except OSError: nperm[0]+=1; continue
                    out.append((eb, fh.encode()+b'  ./'+eb+b'\n'))
            except OSError:
                nperm[0]+=1
    rec(b'')
    return out, nperm[0]

def dir_bytes_and_sha(d):
    out,nperm=manifest_lines(d)
    total=0
    for eb,_ in out:
        try: total+=os.lstat(os.path.join(d,os.fsdecode(eb))).st_size
        except OSError: pass
    agg=hashlib.sha256()
    for _,line in sorted(out, key=lambda x:x[0]): agg.update(line)
    return total, agg.hexdigest(), len(out), nperm

# recorded deviation: worktree-local pnpm/npm content stores are regenerable caches
# (u1a classifies the root equivalents SCRATCH) -> excluded from salvage
EXCL_SEGMENTS={'node_modules','dist','.turbo','coverage','.pnp-store','.pnpm-store','.npm-probe-cache','.npm-cache'}
def excluded(rel):
    parts=rel.rstrip('/').split('/')
    for p in parts[:-1]:
        if p in EXCL_SEGMENTS: return True
    if parts[-1] in EXCL_SEGMENTS: return True
    if parts[-1].endswith('.tsbuildinfo'): return True
    return False

u1a_wt=json.load(open(ROOT+'/dev/agent-workflow/evidence/u1-closure-20261025/u1a/worktrees.json'))
cls={x['abs_path']:x['classification'] for x in u1a_wt['entries']}
du_u1a={x['abs_path']:x.get('du_bytes') for x in u1a_wt['entries']}
wtsz=json.load(open(RAW+'/wtsize.json'))
branches=json.load(open(RAW+'/branches.json'))
bundle=json.load(open(RAW+'/bundle-heads.json'))
u1a_homes=json.load(open(ROOT+'/dev/agent-workflow/evidence/u1-closure-20261025/u1a/homes.json'))
root_un=json.load(open(ROOT+'/dev/agent-workflow/evidence/u1-closure-20261025/u1a/root-untracked.json'))
live_wts=set(wtsz)

KEEP=['.', '.worktrees/s2-authority-iso-20261025', '.worktrees/u1-audit-master',
      '.worktrees/eb-e0-e1', '.worktrees/pr363-docs-review', '.worktrees/a5-m2-int']
KEEP_ABS={os.path.normpath(os.path.join(ROOT,k)) for k in KEEP}
remove_wts=sorted(p for p,c in cls.items() if p not in KEEP_ABS and c in ('REGENERABLE','REUSE-CANDIDATE'))
assert all(p in live_wts for p in remove_wts)
print('remove candidates:',len(remove_wts))
print('created-after-cutoff among them:',[w for w in remove_wts if wtsz[w]['dir_mtime']>CUTOFF])

def wtname(abs_p):
    rel=os.path.relpath(abs_p,ROOT)
    return rel[len('.worktrees/'):] if rel.startswith('.worktrees/') else rel.replace('/','__')

# ---------------- salvage ----------------
salvage=[]; patch_info={}
for abs_p in remove_wts:
    rel=os.path.relpath(abs_p,ROOT); name=wtname(abs_p)
    rc,so,se=sh(['git','-C',abs_p,'status','--porcelain'])   # unormal: dirs collapsed
    if rc!=0:
        print('STATUS FAIL',rel,se[:120]); continue
    mod=[]; unt=[]
    for l in so.splitlines():
        xy=l[:2]; p=l[3:]
        if xy=='??': unt.append(p)
        elif 'D' in xy: continue          # deletions: in patch (non-evidence), no salvage row
        else: mod.append(p)
    for p in sorted(set(mod)):
        if excluded(p): continue
        ap=os.path.join(ROOT,rel,p)
        if not os.path.exists(ap): continue
        st=os.lstat(ap)
        salvage.append([f"{rel}/{p}", f"{STORE_REL}/salvage/{name}/{p}", st.st_size, sha_file(ap), 'file-mod', rel])
    for p in sorted(set(unt)):
        if excluded(p): continue
        src=f"{rel}/{p}"; ap=os.path.join(ROOT,src)
        if p.endswith('/'):
            if not os.path.isdir(ap): continue
            b,sha,nf,nperm=dir_bytes_and_sha(ap)
            if excluded(p.rstrip('/')): continue
            salvage.append([src, f"{STORE_REL}/salvage/{name}/{p}", b, sha,
                            'dir-perm' if nperm else 'dir', rel])
            print(f"  dir {name}/{p} files={nf} perm_skip={nperm} bytes={b}")
        else:
            if not os.path.exists(ap): continue
            st=os.lstat(ap)
            salvage.append([src, f"{STORE_REL}/salvage/{name}/{p}", st.st_size, sha_file(ap), 'file', rel])
    rb=subprocess.run(['git','-C',abs_p,'diff','HEAD','--binary','--','.',f':(exclude){EVID}'],capture_output=True)
    pb=len(rb.stdout); ps=hashlib.sha256(rb.stdout).hexdigest()
    if pb>0:
        salvage.append([f"git-diff-HEAD(excl-evidence)@{rel}", f"{STORE_REL}/salvage/{name}/tracked-mods.patch", pb, ps, 'patch', rel])
    patch_info[rel]=(pb,ps)

with open(PLAN+'/salvage.tsv','w') as f:
    f.write("src\tdst\tbytes\tsha256\tkind\tworktree_rel\n")
    for r in salvage: f.write('\t'.join(str(x) for x in r)+'\n')
sal_cnt=collections.Counter(r[5] for r in salvage)
sal_bytes=collections.Counter()
for r in salvage: sal_bytes[r[5]]+=r[2]
print('salvage rows:',len(salvage),'salvage bytes total:',sum(r[2] for r in salvage))

# ---------------- worktree-remove.tsv ----------------
rows=[]
for abs_p in remove_wts:
    rel=os.path.relpath(abs_p,ROOT)
    with open(RAW+'/wt-live.txt') as f: pass
    rows.append(rel)
# re-derive branch/head from wt-live
info={}; cur=None
for line in open(RAW+'/wt-live.txt'):
    line=line.rstrip('\n')
    if line.startswith('worktree '): cur=line[9:]; info[cur]={'branch':None,'head':None}
    elif line.startswith('branch '): info[cur]['branch']=line[7:]
    elif line.startswith('HEAD '): info[cur]['head']=line[5:]
out=[]
for abs_p in remove_wts:
    rel=os.path.relpath(abs_p,ROOT); d=info[abs_p]
    br=d['branch'][len('refs/heads/'):] if d['branch'] else '(detached)'
    if br=='(detached)':
        rc,so,_=sh(['git','rev-list','--count',d['head'],'--not','--remotes'],cwd=ROOT)
        lo=int(so); cov='none-needed' if lo==0 else 'CHECK!'
    else:
        lo=branches.get(br,{}).get('local_only',0)
        if lo==0: cov='none-needed'
        elif 'refs/heads/'+br in bundle:
            cov='yes' if bundle['refs/heads/'+br]==branches[br]['sha'] else 'yes-bundle-tip-older-than-branch'
        else: cov='NO-BUNDLE'
    out.append(dict(path=rel,branch=br,head=d['head'],klass=cls[abs_p],
                    size_live=wtsz[abs_p]['du_sb'],size_u1a=du_u1a.get(abs_p),
                    local_only=lo,bundle=cov,salvage=sal_cnt.get(rel,0),
                    salvage_bytes=sal_bytes.get(rel,0),
                    after='YES' if wtsz[abs_p]['dir_mtime']>CUTOFF else 'no'))
with open(PLAN+'/worktree-remove.tsv','w') as f:
    f.write("path\tbranch\thead\tclass\tsize_bytes_du_live\tsize_bytes_du_u1a\tlocal_only_commits\tbundle_covered\tsalvage_items\tsalvage_bytes\tcreated_after_20261025T1000Z\n")
    for r in out:
        f.write(f"{r['path']}\t{r['branch']}\t{r['head']}\t{r['klass']}\t{r['size_live']}\t{r['size_u1a']}\t{r['local_only']}\t{r['bundle']}\t{r['salvage']}\t{r['salvage_bytes']}\t{r['after']}\n")
print('wt sizes live sum:',sum(r['size_live'] for r in out))

# ---------------- branches.tsv ----------------
with open(PLAN+'/branches.tsv','w') as f:
    f.write("branch\tworktree\tbranch_head\tlocal_only_commits\tin_bundle\taction\n")
    for r in out:
        if r['branch']=='(detached)':
            f.write(f"(detached)\t{r['path']}\t{r['head']}\t{r['local_only']}\t{r['bundle']}\tNO-REF-HEAD-IS-DETACHED\n")
        else:
            b=r['branch']
            f.write(f"{b}\t{r['path']}\t{branches.get(b,{}).get('sha','?')}\t{branches.get(b,{}).get('local_only','?')}\t{'yes' if 'refs/heads/'+b in bundle else 'no'}\tKEEP-REF\n")

# ---------------- root-scratch.tsv ----------------
EXCL_ROOT={'.artifacts','tests/homes','tests/deepseek-harness-test-use','references','.worktrees','node_modules','.pnpm-store'}
rr=[]
for e in root_un['entries']:
    p=e['path']; top=p.split('/')[0]
    if p in EXCL_ROOT or top in EXCL_ROOT:
        rr.append((p,e['classification'],'EXCLUDED-KEEP',e['du_bytes'],'','','')); continue
    ap=os.path.join(ROOT,p); live=os.path.lexists(ap); lb=''
    if live:
        if os.path.isdir(ap) and not os.path.islink(ap):
            rc,so,_=sh(['du','-sb','--max-depth=0',ap])
            lb=int(so.split('\t')[0]) if rc==0 else ''
        else: lb=os.lstat(ap).st_size
    if e['classification']=='SCRATCH': act,dst='DELETE',''
    elif e['classification']=='UNKNOWN': act,dst='MOVE',f"{STORE_REL}/unknown/{p}"
    else: act,dst='MOVE',f"{STORE_REL}/root-untracked/{p}"
    rr.append((p,e['classification'],act,e['du_bytes'],'yes' if live else 'MISSING',lb,dst))
with open(PLAN+'/root-scratch.tsv','w') as f:
    f.write("path\tclass_u1a\taction\tbytes_u1a\texists_live\tbytes_live\tdst\n")
    for r in rr: f.write('\t'.join(str(x) for x in r)+'\n')
print('root actions:',collections.Counter(r[2] for r in rr))

rc,so,_=sh(['git','status','--porcelain'],cwd=ROOT)
u1a_paths={x['path'] for x in root_un['entries']}
new_root=sorted({l[3:].rstrip('/') for l in so.splitlines() if l[:2]=='??'
                 and l[3:].rstrip('/') not in u1a_paths
                 and not (l[3:].split('/')[0] in EXCL_ROOT)})
print('new root untracked since u1a:',new_root)

# ---------------- homes.tsv ----------------
H=os.path.join(ROOT,'tests/homes')
live_names=set(os.listdir(H))
entries=u1a_homes['entries']; by_name={e['name']:e for e in entries}
keep_ref=set(u1a_homes['keep_referenced_names'])
hrows=[]
for e in entries:
    n=e['name']; p=os.path.join(H,n)
    try: mt=os.stat(p).st_mtime
    except OSError: mt=None
    if e['classification']=='KEEP': act='KEEP'
    elif e['classification']=='KEEP-REFERENCED': act='KEEP'
    elif mt is not None and mt>CUTOFF: act='SKIP-RECENT-MOD'
    elif not os.path.lexists(p): act='SKIP-MISSING'
    else: act='DELETE'
    hrows.append([n,'dir',e['classification'],act,e['du_bytes'] if e['du_bytes'] is not None else '',mt])
for ln in sorted(x for x in live_names if x.endswith('.lock')):
    base=ln[:-5]
    if base in keep_ref or base=='.playwright-browsers': act='KEEP-LOCK-WORLD-KEPT'
    elif base in by_name and by_name[base]['classification'] in ('REGENERABLE',): act='DELETE-LOCK'
    elif base in by_name: act='KEEP-LOCK-WORLD-KEPT'
    elif base in live_names: act='DELETE-LOCK'
    else: act='DELETE-LOCK-ORPHAN'
    st=os.lstat(os.path.join(H,ln))
    hrows.append([ln,'lock','lock',act,'',st.st_size])
for s in sorted(x for x in live_names if x not in by_name and not x.endswith('.lock')):
    st=os.lstat(os.path.join(H,s))
    hrows.append([s,'file','NOT-IN-U1A','KEEP-UNKNOWN-NEW','',st.st_size])
with open(PLAN+'/homes.tsv','w') as f:
    f.write("name\tkind\tclass_u1a\taction\tdu_bytes_u1a\tmtime_utc\tbytes_live\tmtime_after_cutoff\n")
    for r in hrows:
        n,k,c,a,b,mt=r[0],r[1],r[2],r[3],r[4],r[5]
        if k=='dir': f.write(f"{n}\t{k}\t{c}\t{a}\t{b}\t{int(mt) if mt else ''}\t\t{'YES' if mt and mt>CUTOFF else 'no'}\n")
        else: f.write(f"{n}\t{k}\t{c}\t{a}\t\t\t{b}\t{'YES' if mt and mt>CUTOFF else 'no'}\n")
print('homes rows:',len(hrows),collections.Counter(r[3] for r in hrows))

# ---------------- reclaim estimate (nlink-aware) ----------------
# walk remove-set items ONCE. upper: dedup bytes within set. lower: only nlink==1 files.
seen=set(); upper=0; lower=0; nfiles=0; nshared=0
def walk_size(p):
    global upper,lower,nfiles,nshared
    stack=[p]
    while stack:
        d=stack.pop()
        try: it=list(os.scandir(d))
        except OSError: continue
        for e in it:
            try:
                if e.is_dir(follow_symlinks=False): stack.append(e.path); continue
                st=e.stat(follow_symlinks=False)
            except OSError: continue
            nfiles+=1
            k=(st.st_dev,st.st_ino)
            if k in seen: continue
            seen.add(k); upper+=st.st_size
            if st.st_nlink==1: lower+=st.st_size
            else: nshared+=1
del_wts=[os.path.join(ROOT,r['path']) for r in out]
del_homes=[r[0] for r in hrows if r[3]=='DELETE']
del_locks=[r[0] for r in hrows if r[3] in ('DELETE-LOCK','DELETE-LOCK-ORPHAN')]
del_scratch=[r[0] for r in rr if r[2]=='DELETE']
for p in del_wts: walk_size(p)
wt_lower=lower; wt_upper=upper
upper=lower=0; seen=set()
for p in del_homes: walk_size(os.path.join(H,p))
for p in del_locks: walk_size(os.path.join(H,p))
hm_lower,hm_upper=lower,upper
upper=lower=0; seen=set()
for p in del_scratch: walk_size(os.path.join(ROOT,p))
sc_lower,sc_upper=lower,upper
free=os.statvfs(ROOT).f_frsize*os.statvfs(ROOT).f_bavail
numbers=dict(free_before=free, remove_wts=len(out),
  wt_upper=wt_upper, wt_lower=wt_lower,
  homes_upper=hm_upper, homes_lower=hm_lower,
  scratch_upper=sc_upper, scratch_lower=sc_lower,
  salvage_bytes=sum(r[2] for r in salvage), salvage_rows=len(salvage),
  nshared_files_wt=nshared)
print(json.dumps(numbers,indent=1))
json.dump({'rows':out,'numbers':numbers}, open(RAW+'/remove-rows.json','w'), indent=0)
with open(RAW+'/numbers.json','w') as f: json.dump(numbers,f,indent=1)
print('DONE plan.py')
