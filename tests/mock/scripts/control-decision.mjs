// Show the decision fact payload for a control requestId from team_domain.json.
import { readFileSync } from 'node:fs';
const id = process.argv[2];
const dom = readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/tests/mock/.dsh-home/storages/team_domain.json', 'utf8');
// Find the control-decision-recorded fact whose payload mentions this requestId.
const re = /control-decision-recorded[^]*?requestId":"[^"]*"[^]*?requestId":"([a-z0-9]+)"/g;
// Simpler: split facts by sequence entries and locate the one containing the id.
const idxs = [];
let i = dom.indexOf('control-decision-recorded');
while (i !== -1) {
  idxs.push(i);
  i = dom.indexOf('control-decision-recorded', i + 1);
}
for (const start of idxs) {
  const chunk = dom.slice(start, start + 1200);
  if (chunk.includes(id)) {
    console.log('DECISION FACT for', id, ':');
    console.log(chunk.slice(0, 900).replace(/\\n/g, ' '));
    break;
  }
}
