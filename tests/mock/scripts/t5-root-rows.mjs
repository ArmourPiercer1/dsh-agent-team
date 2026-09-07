// T5.2 scoped check: list member/instance rows of the dtestp6 root from team_domain.json.
import { readFileSync } from 'node:fs';
const dom = readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/tests/mock/.dsh-home/storages/team_domain.json', 'utf8');
const j = JSON.parse(dom);
const ROOT = 'session-dtestp61051185350112102111120115117';

console.log('tables:', Object.keys(j.tables || {}));
for (const [name, table] of Object.entries(j.tables || {})) {
  if (!table || typeof table !== 'object') continue;
  const rows = Object.values(table);
  let relevant = 0;
  for (const row of rows) {
    const s = JSON.stringify(row);
    if (s.includes(ROOT)) {
      relevant++;
      // compact print: table name + row keys
      const summary = {};
      for (const [k, v] of Object.entries(row)) {
        const vs = typeof v === 'string' ? v.slice(0, 80) : v;
        summary[k] = vs;
      }
      console.log(`\n[${name}]`, JSON.stringify(summary).slice(0, 700));
    }
  }
  console.log(`\n== table ${name}: total rows=${rows.length}, dtestp6 rows=${relevant}`);
}
