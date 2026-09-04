// T12-V5 probe: create + verify the packages-level 7-junction @deepseek-ai bridge in T12-V.
// Idempotent: skips existing junctions, refuses non-junction occupants.
import { mkdirSync, symlinkSync, existsSync, lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const store = 'D:\\AgentDev\\dsh-plugins\\dsh-agent-team\\references\\deepseek-harness-test-use\\node_modules\\.pnpm\\node_modules\\@deepseek-ai';
const linkRoot = 'D:\\AgentDev\\dsh-plugins\\dsh-agent-team\\.worktrees\\T12-V\\packages\\node_modules\\@deepseek-ai';
const names = ['dsh-agent', 'dsh-llm', 'dsh-mcp-client', 'dsh-session', 'dsh-storage-domain', 'dsh-scope', 'dsh-system-prompt'];

mkdirSync(linkRoot, { recursive: true });
for (const n of names) {
  const target = join(store, n);
  if (!existsSync(target)) throw new Error('target missing: ' + target);
  const link = join(linkRoot, n);
  let st = null;
  try { st = lstatSync(link); } catch { /* absent */ }
  if (st) {
    if (st.isSymbolicLink()) { console.log('exists(junction):', n); continue; }
    throw new Error('link exists but is not a junction: ' + link);
  }
  symlinkSync(target, link, 'junction');
  console.log('created:', n);
}
for (const n of names) {
  const j = JSON.parse(readFileSync(join(linkRoot, n, 'package.json'), 'utf8'));
  console.log('verified:', n, '->', j.name, j.version);
}
console.log('bridge ok:', names.length, 'links');
