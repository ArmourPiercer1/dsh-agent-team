// Count control request/decision facts and per-request occurrence counts.
import { readFileSync } from 'node:fs';
const dom = readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/tests/mock/.dsh-home/storages/team_domain.json', 'utf8');
const reqs = (dom.match(/control-request-recorded/g) || []).length;
const decs = (dom.match(/control-decision-recorded/g) || []).length;
const cons = (dom.match(/control-allow-consumed/g) || []).length;
console.log('requests:', reqs, 'decisions:', decs, 'consumed:', cons);
const ids = [
  'ctrl-064wd6o1ft4y810lq7zvy07u',
  'ctrl-0agrtlw1xck6vr1ypk3bq0l2',
  'ctrl-1ex2uvz124kelo0o103v11o4',
  'ctrl-0uo9g0p0woqd4u0bqizmn182',
  'ctrl-1rep75m0mgx4b10hjkvyg0ei',
];
for (const id of ids) {
  console.log(id, 'occurrences:', dom.split(id).length - 1);
}
