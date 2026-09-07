// Identify which contentHash (5556ccb7… old / 53c9d4d2… new) the current
// blueprint source hashes to, by hashing the blueprintSource string as stored
// in the patch file, with and without the outer --- fences, raw and trimmed.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const patch = readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/tests/mock/.dsh-home/profiles/web/cordis.patch.yml', 'utf8');
const m = patch.match(/blueprintSource: "(.*)"/s);
if (!m) { console.log('no blueprintSource'); process.exit(1); }
// unescape the YAML double-quoted scalar (\n -> newline, \" -> ")
const src = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
const variants = {
  'raw-with-fences': src,
  'trimmed': src.trim(),
  'no-fences': src.replace(/^---\n/, '').replace(/\n---\s*$/, ''),
  'no-fences-trimmed': src.replace(/^---\n/, '').replace(/\n---\s*$/, '').trim(),
  'no-fences-trailing-newline': src.replace(/^---\n/, '').replace(/\n---\s*$/, '') + '\n',
};
for (const [k, v] of Object.entries(variants)) {
  const h = createHash('sha256').update(v, 'utf8').digest('hex');
  console.log(k.padEnd(24), 'sha256:' + h.slice(0, 16) + '…');
}
console.log('target-old: sha256:5556ccb79ad80d85…');
console.log('target-new: sha256:53c9d4d20a6fa5c9…');
