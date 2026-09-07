// W2 lifecycle audit: domain member_instances row + last lifecycle-changed facts.
import { readFileSync } from 'node:fs';
const dom = readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/tests/mock/.dsh-home/storages/team_domain.json', 'utf8');
const j = JSON.parse(dom);

// member_instances rows for W2.
for (const [key, rowRaw] of Object.entries(j.tables.member_instances || {})) {
  const row = typeof rowRaw === 'string' ? JSON.parse(rowRaw) : rowRaw;
  if (JSON.stringify(row).includes('inst-0zb3tna1drgr')) {
    console.log('W2 member_instances row key=', key, '=>', JSON.stringify(row).slice(0, 500));
  }
}
// lifecycle-changed facts for W2 (from ledger table).
const ledger = j.tables.ledger || {};
const rows = Object.entries(ledger).map(([k, v]) => ({ k, row: typeof v === 'string' ? JSON.parse(v) : v }));
for (const { k, row } of rows) {
  const s = JSON.stringify(row);
  if (s.includes('inst-0zb3tna1drgr') && s.includes('member-lifecycle-changed')) {
    console.log(`ledger[${k}]`, s.slice(0, 400));
  }
}
// work-admitted facts for W2.
for (const { k, row } of rows) {
  const s = JSON.stringify(row);
  if (s.includes('inst-0zb3tna1drgr') && s.includes('team-work-admitted')) {
    console.log(`work-admitted ledger[${k}]`, s.slice(0, 300));
  }
}
