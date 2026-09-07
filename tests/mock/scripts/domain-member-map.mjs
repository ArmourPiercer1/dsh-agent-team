// Map member instance ids to label/template/root from team_domain.json.
import { readFileSync } from 'node:fs';
const dom = readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/tests/mock/.dsh-home/storages/team_domain.json', 'utf8');
const wanted = process.argv.slice(2);
for (const id of wanted) {
  const j = dom.indexOf(id);
  if (j < 0) { console.log(id, 'NOT FOUND'); continue; }
  const seg = dom.slice(j - 300, j + 400);
  const lab = seg.match(/"label":"([A-Za-z0-9_]+)"/);
  const tpl = seg.match(/"templateId":"([a-z0-9_-]+)"/);
  const root = seg.match(/"rootSessionId":"([a-z0-9-]+)"/);
  console.log(id, 'label=' + (lab && lab[1]), 'template=' + (tpl && tpl[1]), 'root=' + (root && root[1]));
}
