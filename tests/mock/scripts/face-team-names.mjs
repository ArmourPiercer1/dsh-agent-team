// List team_* tool names present in a session's durable log (face ground truth).
import { readFileSync } from 'node:fs';
import { zstdDecompressSync } from 'node:zlib';

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
function decAll(buf) {
  const starts = [];
  let off = 0;
  for (;;) {
    const i = buf.indexOf(MAGIC, off);
    if (i === -1) break;
    starts.push(i);
    off = i + 4;
  }
  const bounds = [...starts, buf.length];
  const parts = [];
  let pending;
  for (let k = 0; k < bounds.length - 1; k++) {
    const chunk = buf.subarray(bounds[k], bounds[k + 1]);
    const cand = pending === undefined ? chunk : Buffer.concat([pending, chunk]);
    try { parts.push(zstdDecompressSync(cand)); pending = undefined; } catch { pending = cand; }
  }
  if (pending !== undefined) parts.push(zstdDecompressSync(pending));
  return Buffer.concat(parts);
}

const base = 'D:/AgentDev/dsh-plugins/dsh-agent-team/tests/mock/.dsh-home/sessions/--D-AgentDev-dsh-plugins-dsh-agent-team-tests-mock--/';
const files = {
  root: 'session-dtestmtr0i8cxb3de/session.jsonl.zstd',
  w1: 'session-team-child-abaa6fd6711921efd38e33fb09399cf6/session.jsonl.zstd',
  w2: 'session-team-child-a5e31e6c53c7aefdba3c2e284b535f38/session.jsonl.zstd',
};
const all = new Set();
for (const [label, rel] of Object.entries(files)) {
  const text = decAll(readFileSync(base + rel)).toString('utf8');
  const re = /"name":"(team_[a-z_]+)"/g;
  const names = new Set();
  let m;
  while ((m = re.exec(text)) !== null) names.add(m[1]);
  names.forEach((n) => all.add(n));
  console.log(label + ':', [...names].sort().join(', ') || '(none)');
}
console.log('UNION:', [...all].sort().join(', '));
console.log('count:', all.size);
