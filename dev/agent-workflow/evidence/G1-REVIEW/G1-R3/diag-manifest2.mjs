// V11 focused extraction: path-only lists per classification
import { readFileSync, writeFileSync } from 'node:fs';
const m = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const by = (c) => m.files.filter((e) => e.classification === c).map((e) => e.path);
const dirs = {
  generic: by('GENERIC_FORK_CAPABILITY'),
  unrelated: by('UNRELATED_FORK_FEATURE'),
  mixed: by('MIXED'),
  team: by('TEAM_OWNED'),
  generated: by('GENERATED_FROM_TEAM'),
};
const base = process.argv[3];
for (const [k, v] of Object.entries(dirs)) writeFileSync(`${base}-paths-${k}.txt`, v.join('\n') + '\n');
// mixed entries in full (need disposition + mixed_hunks detail)
writeFileSync(
  `${base}-mixed-full.json`,
  JSON.stringify(m.files.filter((e) => e.classification === 'MIXED'), null, 1),
);
writeFileSync(
  `${base}-unrelated-full.json`,
  JSON.stringify(m.files.filter((e) => e.classification === 'UNRELATED_FORK_FEATURE'), null, 1),
);
console.log(
  `generic=${dirs.generic.length} unrelated=${dirs.unrelated.length} mixed=${dirs.mixed.length} team=${dirs.team.length} generated=${dirs.generated.length}`,
);
