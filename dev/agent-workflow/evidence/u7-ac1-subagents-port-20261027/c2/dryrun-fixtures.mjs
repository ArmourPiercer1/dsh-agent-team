import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { createAc1Assembly, AGENT_CONTROL_MANAGED_NAMES } from './ac1-assembly.mjs'

// Recorded HTTP model bodies, not invented success transcripts. The old face
// mode preserves the boot-6 errors byte-for-byte; current mode replaces only
// the four positive results by executing today's public row definitions.
export async function fixtures({ drive, run, here, repo, mode }) {
  const capture = JSON.parse(readFileSync(join(here, 'mock-corpus-boot6.json'), 'utf8'))
  const entries = structuredClone(capture.entries)
  const assembly = createAc1Assembly({ repoRoot: repo, home: '/fixture', runStamp: 'u5u7ac1-20261027T20-11-46Z', reportDir: '/fixture' })
  assembly.writeMainBlueprint = () => { trace.push('blueprint') }
  const pilot = entries.find(r => r.reply?.content === assembly.DONE.pilot2)
  const blocks = pilot.body.messages.flatMap(m => Array.isArray(m.content) ? m.content : [])
  const uses = new Map(blocks.filter(b => b.type === 'tool_use').map(b => [b.id, b]))
  const positive = ['list_subagent_models', 'subagent', 'list_agents', 'subagent_fork']
  const rows = [ ['list-models-row.mjs', 'buildListModelsRowDefinition', 'listModelsExecutor'], ['spawn-row.mjs', 'buildSpawnRowDefinition', 'spawnExecutor'], ['list-agents-row.mjs', 'buildListAgentsRowDefinition', 'listAgentsExecutor'], ['fork-row.mjs', 'buildForkRowDefinition', 'forkExecutor'] ]
  const values = [{ ok: true, models: [{ provider: 'deepseek-official', name: 'Mock' }] }, {kind:'foreground',runId:'spawn',output:[{type:'text',text:assembly.DONE.childPong}]}, {ok:true,agents:[],catalogSize:1,oneShotChildren:1}, {kind:'foreground',runId:'fork',output:[{type:'text',text:assembly.DONE.forkSaw}]}]
  if (mode !== 'old') {
    for (let i=0;i<rows.length;i++) {
      const [file, builder, executor] = rows[i]
      const mod = await import(new URL(`../../../../../packages/tools/agent-control-family/src/${file}`, import.meta.url))
      const row = mod[builder]({name:positive[i],[executor]:async()=>({kind:'ok',value:values[i]})})
      const use = [...uses.values()].find(b=>b.name===positive[i] && (!b.input?.description || b.input.description.endsWith('probe')))
      const result = blocks.find(b=>b.type==='tool_result' && b.tool_use_id===use.id)
      try {
        const value = await row.execute(use.input ?? {}, {})
        result.is_error = false
        result.content = row.output.render(use.input ?? {}, value)
      } catch (e) { result.is_error=true; result.content=[{type:'text',text:String(e)}] }
    }
  }
  if (mode === 'mutation') {
    const use = [...uses.values()].find(b=>b.input?.description==='ac1 route override')
    const result = blocks.find(b=>b.type==='tool_result' && b.tool_use_id===use.id)
    result.is_error=false // typed text alone must never pass a refusal
  }
  const trace=[]
  const world={ token:'fake', mock:{requests:[]} }
  const ledger=[]; const resolved=new Set()
  const reply=(value)=>({status:200,body:{result:{ok:true,value}}})
  const io={
    authenticate:async()=>{trace.push('authenticate');return 'fake'},
    stableProbe:async()=>({status:401}),
    readFile:(path)=>path==='fake-host' ? log : assembly.SECRET_CLAIM+'\n',
    sleep:async()=>{await new Promise(r=>setImmediate(r))},
    apiPrompt:async(_o,_c,_id,text)=>{
      trace.push('prompt')
      if(text===assembly.markers.MK_DISC) world.mock.requests.push({body:{messages:[{role:'user',content:text}],tools:AGENT_CONTROL_MANAGED_NAMES.map(name=>({name}))}})
      return {status:200}
    },
    fetchJsonRetry:async(url,opts)=>{
      if(url.endsWith('/health')) {trace.push('health');return {status:200,body:{ok:true}}}
      if(url.endsWith('/state')) {trace.push('state');return {status:200,body:{rootSessionId:assembly.ROOT,phase:'create',teamSession:{}}}}
      const req=JSON.parse(opts.body); trace.push(req.method)
      if(req.method==='team.create') {
        for(let i=0;i<positive.length;i++) ledger.push({sequence:i+1,factType:'control-request-recorded',payload:{requestId:`ask-${i}`,toolName:positive[i]}})
        return reply({})
      }
      if(req.method==='team.getLedgerPage') return reply({entries:ledger,nextAfterSequence:null})
      if(req.method==='team.resolveControl') {
        const id=req.payload.params.requestId; resolved.add(id)
        ledger.push({sequence:ledger.length+1,factType:'control-decision-recorded',payload:{requestId:id,decision:'allow'}})
        ledger.push({sequence:ledger.length+1,factType:'control-allow-consumed',payload:{requestId:id}})
        if(resolved.size===4) {
          // Only effect completion after all real approver resolutions publishes
          // the captured per-call transcripts and completion fences.
          world.mock.requests.push(...entries)
          world.mock.requests.push({reply:{kind:'text',content:assembly.DONE.pilot1}})
        }
        return reply({})
      }
      throw Error(`unexpected HTTP ${url}`)
    },
  }
  const log = `placement-feed rows=[${AGENT_CONTROL_MANAGED_NAMES.join(',')}]\n` + positive.map(n=>`agent-control-${n} RAN`).join('\n') + '\nagent-runtime host-port: catalog-read count=1 oneShot=1\nagent-runtime host-port: child-toolview provider=spawn tools=[]\nagent-runtime host-port: child-toolview provider=fork tools=[]'
  await drive({world,assembly,planted:{secretBefore:assembly.SECRET_CLAIM+'\n'},boot:{port:3181,logPath:'fake-host'},stableBefore:{status:401},io})
  assert.equal(resolved.size,4)
  assert(trace.includes('team.create') && trace.includes('team.getLedgerPage') && trace.includes('team.resolveControl'))
  run.record.fixture={mode,source:'mock-corpus-boot6.json',trace,syntheticLedger:true,live:false}
  run.finalize()
  run.write(join(here,'..','c1-dryrun',`${mode}.json`))
  const failures=run.record.cases.filter(c=>c.verdict!=='PASS').map(c=>c.id)
  if(mode==='old') assert(positive.every((_,i)=>failures.includes(['ac:list-models','ac:spawn-positive','ac:list-agents','ac:fork-positive'][i])))
  else if(mode==='mutation') assert.deepEqual(failures,['ac:refusal-provider'])
  else assert.deepEqual(failures,[])
  console.log(`DRYRUN ${mode}: ${run.record.overall}; expected signature proven`)
}
