// Print the last N structural lines of a session durable log (types + short data).
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
const file = process.argv[2];
const n = Number(process.argv[3] || 8);
const text = decAll(readFileSync(file)).toString('utf8');
const lines = text.split('\n').filter(Boolean);
const out = [];
for (const l of lines) {
  let o;
  try { o = JSON.parse(l); } catch { continue; }
  if (['turn/start', 'turn/end', 'tool/call', 'tool/result', 'step/start', 'user/message'].includes(o.type)) {
    out.push(o.type + ' ' + (o.data && o.data.turn != null ? 't' + o.data.turn : '') + ' ' + new Date(o.time || 0).toISOString() + ' ' + JSON.stringify(o.data).slice(0, 180));
  }
}
for (const l of out.slice(-n)) console.log(l);
console.log('NOW:', new Date().toISOString());
