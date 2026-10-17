
const fs=require('node:fs');const out={};
try{fs.appendFileSync("/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-ptc-outerfs/tests/homes/a5ptc4d-rev-probe-2026-10-17T15-49-14Z/.revl2c/lane-channel.jsonl",JSON.stringify({kind:'register',nonce:'rev-forged',sessionId:'x',role:'lane'})+'\n');out.ipcWrite='WRITTEN-DANGER'}catch(e){out.ipcWrite=String(e.code)}
try{fs.appendFileSync("/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-ptc-outerfs/tests/homes/a5ptc4d-rev-probe-2026-10-17T15-49-14Z-forb/rev-attack.txt",'x');out.forb='WRITTEN-DANGER'}catch(e){out.forb=String(e.code)}
try{fs.writeFileSync("/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-ptc-outerfs/tests/homes/a5ptc4d-rev-probe-2026-10-17T15-49-14Z/ws/rev-ws.txt",'ok');out.ws='ok'}catch(e){out.ws=String(e.code)}
out.statuses={};
for(const p of ['/__a5ptc4b/provision','/__a5ptc4c/provision','/__a5ptc4cdev/provision','/__a5ptc4c/register','/__a5ptc4c/grant']){
  try{const r=await fetch('http://127.0.0.1:3184'+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:"session-219392b2-2ce9-40bd-b2e7-04a3fb6ed720",role:'lane',nonce:'rev-forged-2',decision:'allow'})});out.statuses[p]=r.status;await r.text()}catch(e){out.statuses[p]='ERR:'+String(e.code??e.message)}
}
try{const g=await fetch('http://127.0.0.1:3184/__a5ptc4c/roster');out.rosterStatus=g.status;await g.text()}catch(e){out.rosterStatus='ERR'}
fs.writeFileSync("/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-ptc-outerfs/tests/homes/a5ptc4d-rev-probe-2026-10-17T15-49-14Z/ws/rev-child-result.json",JSON.stringify(out));
process.stdout.write(JSON.stringify(out));
