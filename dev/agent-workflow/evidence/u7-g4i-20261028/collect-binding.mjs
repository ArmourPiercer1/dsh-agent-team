import {readFileSync,writeFileSync,statSync,readdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const dir='dev/agent-workflow/evidence/u7-g4i-20261028'
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim()
const r=JSON.parse(readFileSync(`${dir}/c2/arc-a/run-record.json`))
const files=['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','dev/engineering/current-authority.json','dev/engineering/authority-snapshots/as20261026r1.json','dev/engineering/tool-obligations/authoritative-tool-sources.v1.json','tests/world-factory/lib/world-factory.mjs','tests/world-factory/lib/oracle.mjs','tests/world-factory/lib/u6-arc-a-assembly.mjs','tests/world-factory/u5-canary-runner.mjs']
const packageFiles=git('ls-files','packages/runtime/dist').split('\n').filter(Boolean)
const hashes=Object.fromEntries(files.map(p=>[p,sha(p)]))
const packageManifest=packageFiles.map(p=>`${sha(p)}  ${p}`).join('\n')+'\n'
writeFileSync(`${dir}/package-dist-sha256.txt`,packageManifest)
const binding={candidate:r.bindings.teamSha,host:r.bindings.hostSha,trackedPorcelain:git('status','--porcelain','--untracked-files=no'),toolchain:{node:process.version,pnpm:execFileSync('pnpm',['-v'],{encoding:'utf8'}).trim(),git:git('--version')},inputHashes:hashes,runtimeDistManifestSha256:createHash('sha256').update(packageManifest).digest('hex'),runnerBindings:r.bindings,runnerComposedProfileDigest:null,runnerTrustedSourcesDigest:null,runnerWorldOracleDigest:null,missingDigestDisclosure:'The unchanged ARC-A runner records authority/canary pin but does not persist composed profile bytes/digest or trusted-source/world-oracle digest. Its world was torn down. Explicit offline file pins above do NOT retroactively substitute for missing runner fields. Candidate binding is PARTIAL for these requested fields.',arcAResult:{overall:r.overall,finishedAt:r.finishedAt,cases:r.cases.map(({id,verdict})=>({id,verdict})),cleanup:r.cleanup??r.teardown??null}}
writeFileSync(`${dir}/candidate-binding.json`,JSON.stringify(binding,null,2)+'\n')
console.log(`dist manifest ${binding.runtimeDistManifestSha256}; ARC-A ${r.overall}; input hashes ${files.length}`)
