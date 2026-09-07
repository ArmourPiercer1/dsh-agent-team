// T3.5 consequence probe: count per-turn tools arrays in W2's durable log,
// check the LAST one for mcp__dtest-mini__ping (must be absent after reset).
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

const path = process.argv[2];
const text = decAll(readFileSync(path)).toString('utf8');
const marker = '"name":"mcp__dtesthttp__ping"';
let i = 0, n = 0;
const positions = [];
for (;;) {
  const j = text.indexOf(marker, i);
  if (j < 0) break;
  n++;
  positions.push(j);
  i = j + 10;
}
console.log('tools-arrays found:', n);
const R = 25000; // window around each array
positions.forEach((j, idx) => {
  const lo = Math.max(0, j - R);
  const seg = text.slice(lo, j + R);
  const mini = seg.includes('mcp__dtest-mini__ping');
  // count team_ occurrences in this window as a face-size proxy
  const teamCount = (seg.match(/"name":"team_/g) || []).length;
  const mcpCount = (seg.match(/"name":"mcp__/g) || []).length;
  console.log(`ARR#${idx + 1} @${j} dtest-mini-nearby:${mini} team_-names:${teamCount} mcp_-names:${mcpCount}`);
});
// Last array: definitive check
const last = positions[positions.length - 1];
const seg = text.slice(Math.max(0, last - R), last + R);
console.log('LAST-ARRAY has dtest-mini:', seg.includes('mcp__dtest-mini__ping'));
