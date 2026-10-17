
const fs=require('node:fs');const out={};
try{fs.appendFileSync("/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-ptc-outerfs/tests/homes/a5ptc4d-rev-probe-2026-10-17T15-50-12Z/.revl2c/lane-channel.jsonl",JSON.stringify({kind:'register',nonce:'rev-forged',sessionId:'x',role:'lane'})+'\n');out.ipcWrite='WRITTEN-DANGER'}catch(e){out.ipcWrite=String(e.code)}
try{fs.appendFileSync("/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-ptc-outerfs/tests/homes/a5ptc4d-rev-probe-2026-10-17T15-50-12Z-forb/rev-attack.txt",'x');out.forb='WRITTEN-DANGER'}catch(e){out.forb=String(e.code)}
try{fs.writeFileSync("/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-ptc-outerfs/tests/homes/a5ptc4d-rev-probe-2026-10-17T15-50-12Z/ws/rev-ws.txt",'ok');out.ws='ok'}catch(e){out.ws=String(e.code)}
out.statuses={};out.rosterStatus='ERR';
const POST=(p,body)=>fetch('http://127.0.0.1:3184'+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(async(r)=>{await r.text();return r.status},(e)=>'ERR:'+String(e.code??e.message));
(async()=>{
  for(const p of ['/__a5ptc4b/provision','/__a5ptc4c/provision','/__a5ptc4cdev/provision','/__a5ptc4c/register','/__a5ptc4c/grant']){
    out.statuses[p]=await POST(p,{sessionId:"session-eb6bf531-7f4e-459a-a4f3-06197843cf28",role:'lane',nonce:'rev-forged-2',decision:'allow',grant_id:'g1'});
  }
  try{const g=await fetch('http://127.0.0.1:3184/__a5ptc4c/roster');out.rosterStatus=g.status;await g.text()}catch(e){out.rosterStatus='ERR'}
  fs.writeFileSync("/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-ptc-outerfs/tests/homes/a5ptc4d-rev-probe-2026-10-17T15-50-12Z/ws/rev-child-result.json",JSON.stringify(out));
})();
