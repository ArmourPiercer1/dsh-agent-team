// Dump raw domain segments around each given id (structure inspection).
import { readFileSync } from 'node:fs';
const dom = readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/tests/mock/.dsh-home/storages/team_domain.json', 'utf8');
for (const id of process.argv.slice(2)) {
  let i = -1;
  const hits = [];
  while (true) {
    const j = dom.indexOf(id, i + 1);
    if (j < 0) break;
    hits.push(j);
    i = j;
  }
  console.log('=== ' + id + ' hits: ' + hits.length);
  const first = hits[0];
  console.log(dom.slice(first - 250, first + 350).replace(/\\n/g, ' '));
}
