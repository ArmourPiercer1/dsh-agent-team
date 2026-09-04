import { readFileSync } from 'node:fs';
const ev = 'D:\\AgentDev\\dsh-plugins\\dsh-agent-team\\dev\\agent-workflow\\evidence\\T12';
const s = JSON.parse(readFileSync(ev + '\\summary.json', 'utf8'));
console.log('summary top-level keys:', Object.keys(s).join(', '));
for (const k of Object.keys(s)) {
  if (!s.scenarios && k !== 'scenarios') {
    const v = s[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) console.log(k + ':', JSON.stringify(v).slice(0, 300));
    else console.log(k + ':', String(v).slice(0, 200));
  }
}
const cap = JSON.parse(readFileSync(ev + '\\t12v-mock-capture.json', 'utf8'));
const reqs = cap.requests ?? cap;
console.log('mock capture requests:', reqs.length);
for (const [i, r] of reqs.entries()) {
  const tools = Array.isArray(r.tools) ? r.tools : [];
  const toolNames = tools.map((t) => t?.function?.name ?? t?.name).filter(Boolean);
  const lastMsg = r.messages?.[r.messages.length - 1];
  const lastText = typeof lastMsg?.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg?.content ?? '').slice(0, 80);
  console.log(`#${i + 1} model=${r.model} tools=${toolNames.length} mcpPing=${toolNames.includes('mcp__t12vmini__ping')} last[${lastMsg?.role}]=${String(lastText).slice(0, 90)}`);
}
const useMcp = reqs.find((r) => JSON.stringify(r.messages ?? []).includes('T12V_USE_MCP'));
if (useMcp) {
  const names = (useMcp.tools ?? []).map((t) => t?.function?.name ?? t?.name);
  console.log('USE_MCP request tools exactly:', JSON.stringify(names));
  console.log('USE_MCP mcp tool present:', names.includes('mcp__t12vmini__ping'));
}
