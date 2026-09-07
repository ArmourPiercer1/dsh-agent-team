// T6.2 timeline: dump dtestp6 ledger facts for the T6 business-task tokens (W1 + W2),
// plus confirm both members end SETTLED and count activity-interval (progress) facts for the T6 task.
import { readFileSync } from 'node:fs';
const dom = readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/tests/mock/.dsh-home/storages/team_domain.json', 'utf8');
const j = JSON.parse(dom);
const ROOT = 'session-dtestp61051185350112102111120115117';

const ledger = j.tables.ledger || {};
const rows = Object.entries(ledger)
  .map(([k, v]) => ({ k, row: typeof v === 'string' ? JSON.parse(v) : v }))
  .filter(({ row }) => row && row.rootSessionId === ROOT)
  .sort((a, b) => (a.row.sequence || 0) - (b.row.sequence || 0));

console.log('total dtestp6 ledger facts:', rows.length);

// T6 task tokens.
const T6 = ['t52-w1-sentinel', 't52-w2-summary', 't52-w2-final', 'followup-w1'];
console.log('\n== T6-task-related facts (work/lifecycle/progress) ==');
for (const { row } of rows) {
  const s = JSON.stringify(row);
  const isT6 = s.includes('t52-w1') || s.includes('t52-w2-summary') || s.includes('t52-w2-final');
  if (!isT6) continue;
  const tok = (s.match(/t52-w[12][a-z-]*/) || [])[0] || '?';
  const seq = row.sequence;
  const ft = row.factType;
  const to = (row.payload && row.payload.to) || '';
  const from = (row.payload && row.payload.from) || '';
  const inst = (row.payload && row.payload.instanceId) || '';
  console.log(`seq ${seq} [${ft}] token~${tok} inst=${inst} ${from}->${to}`);
}

// progress (activity-interval) facts for the T6 window (seq >= 121)
console.log('\n== activity-interval (progress) facts seq>=121 ==');
let prog = 0;
for (const { row } of rows) {
  if ((row.sequence || 0) >= 121 && row.factType === 'activity-interval-opened') {
    prog++;
    console.log(`seq ${row.sequence} subject=${row.payload.subject} progress=${row.payload.progress} inst=${row.payload.instanceId} tok~${(JSON.stringify(row).match(/t52-w[12][a-z-]*/)||['?'])[0]}`);
  }
}
console.log('activity-interval-opened (T6 window):', prog);

// final lifecycle state per member
console.log('\n== final member lifecycle (from member_instances) ==');
for (const [, rv] of Object.entries(j.tables.member_instances || {})) {
  const row = typeof rv === 'string' ? JSON.parse(rv) : rv;
  if (row.rootSessionId === ROOT) {
    console.log(`${row.label} (${row.instanceId}) lifecycle=${row.lifecycle} template=${row.templateId}`);
  }
}
