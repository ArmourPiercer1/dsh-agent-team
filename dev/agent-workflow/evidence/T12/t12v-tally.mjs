import { readFileSync } from 'node:fs';
const p = 'D:\\AgentDev\\dsh-plugins\\dsh-agent-team\\dev\\agent-workflow\\evidence\\T12\\summary.json';
const s = JSON.parse(readFileSync(p, 'utf8'));
const order = ['V1', 'V2', 'V3', 'V4', 'V5', 'HANDOFF', 'LIFECYCLE', 'RESTART'];
const sc = s.scenarios ?? s;
for (const k of order) {
  const r = sc[k];
  if (!r) { console.log(`${k}: MISSING`); continue; }
  const a = r.assertions ?? [];
  const ok = a.filter((x) => x.ok).length;
  console.log(`== ${k} pass=${r.pass} dur=${r.durationMs}ms checks=${ok}/${a.length} :: ${r.criterion ?? ''}`);
  for (const x of a) if (!x.ok) console.log(`   [FAIL] ${x.name} :: ${String(x.detail ?? '').slice(0, 200)}`);
  if (r.evidence) {
    const ev = Object.entries(r.evidence).filter(([kk, v]) => typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean');
    if (ev.length) console.log('   evidence: ' + ev.map(([kk, v]) => `${kk}=${JSON.stringify(v)}`).join(' '));
  }
}
console.log('modelPath:', JSON.stringify(s.modelPath ?? s.model_path ?? null));
