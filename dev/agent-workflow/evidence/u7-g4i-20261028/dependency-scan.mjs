import {execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {resolve,dirname,relative} from 'node:path'
const root=process.cwd(), out=resolve('dev/agent-workflow/evidence/u7-g4i-20261028')
const git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:16*1024*1024}).trim()
const entries=[
 ['arc-a','dev/agent-workflow/evidence/u7-w0b-20261026/c2/arc-a/run-record.json','tests/world-factory/lib/u6-arc-a-assembly.mjs'],
 ['jobs','dev/agent-workflow/evidence/u7-w0b-20261026/c2/u74a-r2/u7w0b-u74a-2.u74a-run-record.json','tests/world-factory/lib/u74a-jobs-assembly.mjs'],
 ['arc-d','dev/agent-workflow/evidence/u7-g4d-20261027/c2-retry/run-record.json','tests/world-factory/lib/u6-arc-d-assembly.mjs'],
 ['tbash','dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/c2-verdicts-boot7.json','tests/world-factory/lib/u7-tbash-assembly.mjs'],
 ['agent-control','dev/agent-workflow/evidence/u7-ac1-subagents-port-20261027/c2/c2-verdicts-boot8.json','dev/agent-workflow/evidence/u7-ac1-subagents-port-20261027/c2/ac1-assembly.mjs'],
]
// Conservative mount envelope: these Worlds mount the production Host plugin, which
// registers the complete family manifest. Include EVERY tracked production package
// input, not just modules a static-import parser happened to find. This deliberately
// over-approximates dynamic imports and built distribution, never declares unaffected
// on the strength of an incomplete closure. Tests/docs/maps/declarations excluded.
const isInput=p=>/\.(mjs|js|ts|json|ya?ml|py)$/.test(p)&&!/(\/test\/|\.test\.|\.d\.ts$|\.d\.mts$|\/fixtures\/)/.test(p)
const current=git('ls-files','packages','tests/world-factory','tests/kits','tests/paths.mjs').split('\n').filter(isInput)
const results=[]
for(const [id,path,assembly] of entries){
 const r=JSON.parse(readFileSync(path,'utf8')), sha=r.bindings.teamSha
 const old=git('ls-tree','-r','--name-only',sha,'--','packages','tests/world-factory','tests/kits','tests/paths.mjs').split('\n').filter(isInput)
 const files=[...new Set([...current,...old,'package.json','pnpm-lock.yaml','pnpm-workspace.yaml','dev/engineering/current-authority.json',assembly])].sort()
 const changed=git('diff','--name-only',sha,'HEAD','--',...files).split('\n').filter(Boolean)
 const stat=git('diff','--stat',sha,'HEAD','--',...files)
 writeFileSync(resolve(out,`${id}-dependencies.txt`),files.join('\n')+'\n')
 writeFileSync(resolve(out,`${id}-diff-stat.txt`),`git diff --stat ${sha} HEAD -- <exact paths in ${id}-dependencies.txt>\n${stat||'(empty)'}\n`)
 const obj={id,record:path,teamSha:sha,teamTreeClean:r.bindings.teamTreeClean??null,overall:r.overall,finishedAt:r.finishedAt,assembly,method:'conservative-complete-production-mount-envelope',dependencyCount:files.length,changed,verdict:changed.length?'AFFECTED':'UNAFFECTED'}
 results.push(obj)
}
writeFileSync(resolve(out,'dependency-results.json'),JSON.stringify({candidate:git('rev-parse','HEAD'),method:'Every production package input plus all World/kit execution modules (conservative superset of transitive closure including dynamic manifest imports). A changed member causes AFFECTED; no hunk exemptions claimed. Exact lists are the union of both old and candidate tracked inputs, including deleted historical inputs.',results},null,2)+'\n')
console.log(results.map(r=>`${r.id} ${r.verdict} ${r.changed.length} changed / ${r.dependencyCount} dependencies`).join('\n'))
