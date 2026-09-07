// T5.2/T5.4 checks on team_domain.json for the dtestp6 root.
import { readFileSync, existsSync, statSync } from 'node:fs';
const root = 'D:/AgentDev/dsh-plugins/dsh-agent-team/tests/mock/.dsh-home/storages/team_domain.json';
const TARGET_ROOT = 'session-dtestp61051185350112102111120115117';

if (!existsSync(root)) { console.log('DOMAIN MISSING'); process.exit(1) }
const st = statSync(root);
console.log('DOMAIN exists, size=', st.size, 'mtime=', st.mtime.toISOString());

const dom = readFileSync(root, 'utf8');
const j = JSON.parse(dom);
console.log('top-level keys:', Object.keys(j).join(', '));

// Instances for the target root.
function findRoots(node, out) {
  if (node && typeof node === 'object') {
    if (node.rootSessionId === TARGET_ROOT) out.push(node)
    for (const v of Object.values(node)) findRoots(v, out)
  }
}
const hits = [];
findRoots(j, hits);

// Instance ids present in the domain for this root.
const ids = new Set();
for (const m of ['inst-1yabcoe00jed', 'inst-0zb3tna1drgr', 'inst-leader', 'inst-05lerpm0ydqe', 'inst-05bf60n0ynq0']) {
  console.log('instance', m, 'present:', dom.includes(m));
}
// Deterministic id stability: the dtestp6 root should carry ONLY its two members (not dtestp4's).
console.log('W1 inst-1yabcoe00jed count:', dom.split('inst-1yabcoe00jed').length - 1);
console.log('W2 inst-0zb3tna1drgr count:', dom.split('inst-0zb3tna1drgr').length - 1);
console.log('leader inst-leader count:', dom.split('inst-leader').length - 1);
// stale dtestp4 instances should NOT appear in dtestp6 domain
console.log('stale dtestp4 W1 inst-05lerpm0ydqe present:', dom.includes('inst-05lerpm0ydqe'));
console.log('stale dtestp4 W2 inst-05bf60n0ynq0 present:', dom.includes('inst-05bf60n0ynq0'));

// Persistent records.
const reqs = (dom.match(/control-request-recorded/g) || []).length;
const decs = (dom.match(/control-decision-recorded/g) || []).length;
const cons = (dom.match(/control-allow-consumed/g) || []).length;
console.log('control requests:', reqs, 'decisions:', decs, 'consumed:', cons);
// progress ledger
const prog = (dom.match(/progress-recorded/g) || []).length;
console.log('progress facts:', prog);
// external-policy durable trace (from T4.7)
console.log('external-policy deny present:', dom.includes('"reason":"external-policy"') || dom.includes('"reason\\":\\"external-policy'));
// overrides
const overrides = (dom.match(/override/g) || []).length;
console.log('override mentions:', overrides);
