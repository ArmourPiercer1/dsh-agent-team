// M2-MOUNT-AUDIT-01 — set computation. Run: node <this file> (expects cwd = worktree root)
import { readFileSync } from 'node:fs';
const src = readFileSync('packages/runtime/src/plugin/live/team-tool-plane.mjs', 'utf8');
const noComments = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
const rMatch = noComments.match(/PLANE_RESERVED_NATIVE = Object\.freeze\(\[([\s\S]*?)\]\)/);
const R = [...rMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
console.log('PLANE_RESERVED_NATIVE len =', R.length, 'unique =', new Set(R).size);
const tMatch = noComments.match(/PLANE_SUPPORTED_NATIVE_TAKEOVERS = Object\.freeze\(\{([\s\S]*?)\n\}\)/);
const takeover = {};
for (const m of tMatch[1].matchAll(/(\w+):\s*Object\.freeze\(\[([^\]]*)\]\)/g)) takeover[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map(x=>x[1]);
console.log('takeover map =', JSON.stringify(takeover));

// Declared-mount sets: derived by hand-reading each preset plugin entry and verifying that
// package's tool registration source at pin639 (tests/deepseek-harness-test-use, 639ed01539).
// Includes entries declared with disabled:true (matrix :52 convention: declared counts as declared).
const common = [
  'bash','pwsh','read','read_image','write','edit','glob','grep',
  'job_output','job_list','job_kill','skill','create_goal','get_goal','update_goal','exit_plan_mode',
  'send_message','interrupt_agent','list_agents','subagent','list_subagent_models',
  'subagent_fork','subagent_codex','subagent_claude_code','workflow','ralph','ask_user_question',
  'todo_write','web_search','web_fetch','present','plugin_manager',
];
const standard = new Set(common), ptc = new Set(common);
const cordis = new Set([...common, 'cordis_inspect_list', 'cordis_inspect_query']);
const union = new Set([...standard, ...cordis, ...ptc]);
const inter = [...standard].filter(n => cordis.has(n) && ptc.has(n));
console.log('standard =', standard.size, 'ptc =', ptc.size, 'cordis =', cordis.size, 'union =', union.size, 'intersection =', inter.length);
console.log('cordis-only =', JSON.stringify([...cordis].filter(n=>!standard.has(n))));
const takeoverNames = new Set(Object.values(takeover).flat());
const takeoverRows = [...union].filter(n => takeoverNames.has(n));
const reservedNoTakeover = [...union].filter(n => R.includes(n) && !takeoverNames.has(n));
const notReserved = [...union].filter(n => !R.includes(n) && !n.startsWith('mcp__'));
console.log('takeover rows =', takeoverRows.length, JSON.stringify(takeoverRows));
console.log('reserved-no-takeover =', reservedNoTakeover.length, JSON.stringify(reservedNoTakeover));
console.log('not in plane names =', notReserved.length, JSON.stringify(notReserved));
const resNotDeclared = R.filter(n => !union.has(n));
console.log('reserved-not-declared =', resNotDeclared.length, JSON.stringify(resNotDeclared));
