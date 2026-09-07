// Extract structured tool/call + tool/result lines from a session durable log.
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
const only = process.argv[3] || null; // e.g. team_request_control
const text = decAll(readFileSync(file)).toString('utf8');
for (const l of text.split('\n').filter(Boolean)) {
  let o;
  try { o = JSON.parse(l); } catch { continue; }
  if (o.type === 'tool/call') {
    if (only && o.data.name !== only) continue;
    console.log('CALL ' + new Date(o.time).toISOString(), o.data.name, String(o.data.arguments).slice(0, 220));
  }
  if (o.type === 'tool/result') {
    const s = JSON.stringify(o.data);
    if (only && !s.includes(only)) continue;
    console.log('RESULT ' + new Date(o.time).toISOString(), s.slice(0, 600));
  }
}
