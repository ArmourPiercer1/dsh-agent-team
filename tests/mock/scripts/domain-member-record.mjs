// Print the full member record (value object) for a given instance id from team_domain.json.
import { readFileSync } from 'node:fs';
const dom = readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/tests/mock/.dsh-home/storages/team_domain.json', 'utf8');
const id = process.argv[2];
// The value is a JSON-encoded string: "key": "{\"...\"}"
const keyPat = new RegExp('"{1}\\\\"instanceId\\":\\"' + id + '\\"');
let i = 0;
while (true) {
  const j = dom.indexOf('\\"instanceId\\":\\"' + id + '\\"', i);
  if (j < 0) break;
  // walk back to the opening quote of the value string
  let start = dom.lastIndexOf('":', j);
  start = dom.indexOf('"{', start);
  // find the matching close: scan for '}"' while respecting escapes
  let k = start + 1;
  let depth = 0;
  let end = -1;
  for (; k < dom.length; k++) {
    const c = dom[k];
    if (c === '\\') { k++; continue; }
    if (c === '"') {
      // check if this closes the value string: next char should be ',' or '}'
      if (dom[k + 1] === ',' || dom[k + 1] === '}') { end = k; break; }
    }
  }
  if (end > 0) {
    const raw = dom.slice(start, end + 1);
    try {
      const obj = JSON.parse(raw);
      console.log(JSON.stringify(obj, null, 1).slice(0, 1500));
    } catch {
      console.log('RAW:', raw.slice(0, 600));
    }
    break;
  }
  i = j + 10;
}
