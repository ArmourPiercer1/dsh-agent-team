// temp: legacy line counts + rough retained% per file for the §9 band comparison
import { readFileSync, readdirSync, statSync } from 'node:fs'

const SNAP = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9/dev/agent-workflow/evidence/P9/legacy-506191b/packages/client/ui-team'

// numstat from temp-reuse-numstat-out.txt (primary P9 target only, summed if multiple)
const NUMSTAT = {
  'src/client/index.ts': [70, 161, 589, 144],
  'src/client/team-timeline-model.ts': [88, 59],
  'src/client/TeamTimeline.tsx': [24, 22],
  'src/client/team-members-model.ts': [134, 57],
  'src/client/TeamMembers.tsx': [480, 63],
  'src/client/team-dock-model.ts': [77, 57],
  'src/client/TeamDock.tsx': [103, 65],
  'src/client/team-feed-model.ts': [362, 149, 466, 165],
  'src/client/TeamFeed.tsx': [254, 163],
  'src/client/TeamView.tsx': [293, 58],
  'src/client/TeamTasks.tsx': [67, 67],
  'src/client/TeamSettingsSection.tsx': [18, 12],
  'src/client/TeamMarker.tsx': [290, 153],
  'src/client/TeamMarker.module.css': [109, 3],
  'src/client/team-marker-jump.ts': [376, 61],
  'src/client/locales.ts': [511, 69],
  'src/client/TeamDock.module.css': [0, 0],
  'src/client/TeamFeed.module.css': [18, 0],
  'src/client/TeamMembers.module.css': [88, 11],
  'src/client/TeamSettingsSection.module.css': [0, 0],
  'src/client/TeamTasks.module.css': [0, 0],
  'src/client/TeamTimeline.module.css': [0, 0],
  'src/client/TeamView.module.css': [94, 0],
}

function linesOf(p) {
  const st = statSync(p)
  if (!st.isFile()) return 0
  return readFileSync(p, 'utf8').split('\n').length
}

const out = []
for (const [rel, ns] of Object.entries(NUMSTAT)) {
  const legacyLines = linesOf(`${SNAP}/${rel}`)
  const added = ns[0] + (ns[2] ?? 0)
  const removed = ns[1] + (ns[3] ?? 0)
  const retained = Math.max(0, legacyLines - removed)
  const pct = legacyLines > 0 ? Math.round((100 * retained) / legacyLines) : 0
  out.push(`${rel}: legacy=${legacyLines}L added=+${added} removed=-${removed} retained~${retained}L (~${pct}%)`)
}
console.log(out.join('\n'))
