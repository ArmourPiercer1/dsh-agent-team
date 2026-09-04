// temp: compute legacy(506191b) -> P9 diff numstat for the reuse audit
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'

const WT = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9'
const SNAP = `${WT}/dev/agent-workflow/evidence/P9/legacy-506191b/packages/client/ui-team`

// Parse manifest: legacy path -> full blob sha
const manifest = readFileSync(
  `${WT}/dev/agent-workflow/evidence/P9/legacy-ui-team-manifest-at-506191b.txt`,
  'utf8',
)
const sha = new Map()
for (const line of manifest.split('\n').map((l) => l.replace(/\r$/, ''))) {
  const m = line.match(/^100644 blob ([0-9a-f]{40})\s+\d+\s+(packages\/client\/ui-team\/.+)$/)
  if (m) sha.set(m[2].replace('packages/client/ui-team/', ''), m[1])
}

// legacy file -> P9 target(s) relative to worktree root (null = DROP)
const MAP = {
  'src/client/index.ts': ['packages/client/src/plugin/client.ts', 'packages/client/src/plugin/team-mount-core.ts'],
  'src/client/team-timeline-model.ts': ['packages/client/src/model/team-timeline-model.ts'],
  'src/client/TeamTimeline.tsx': ['packages/client/src/ui/TeamTimeline.tsx'],
  'src/client/team-members-model.ts': ['packages/client/src/model/team-members-model.ts'],
  'src/client/TeamMembers.tsx': ['packages/client/src/ui/TeamMembers.tsx'],
  'src/client/team-dock-model.ts': ['packages/client/src/model/team-dock-model.ts'],
  'src/client/TeamDock.tsx': ['packages/client/src/ui/TeamDock.tsx'],
  'src/client/team-feed-model.ts': [
    'packages/client/src/model/team-ledger-model.ts',
    'packages/client/src/model/ledger-adapter.ts',
  ],
  'src/client/TeamFeed.tsx': ['packages/client/src/ui/TeamLedger.tsx'],
  'src/client/TeamView.tsx': ['packages/client/src/ui/TeamView.tsx'],
  'src/client/TeamTasks.tsx': ['packages/client/src/ui/TeamActivity.tsx'],
  'src/client/TeamSettingsSection.tsx': ['packages/client/src/ui/TeamSettingsSection.tsx'],
  'src/client/TeamMarker.tsx': ['packages/client/src/ui/TeamLedger.tsx'],
  'src/client/TeamMarker.module.css': ['packages/client/src/ui/TeamLedger.module.css'],
  'src/client/team-marker-definition.ts': null,
  'src/client/team-marker-jump.ts': ['packages/client/src/model/team-ledger-model.ts'],
  'src/client/locales.ts': ['packages/client/src/ui/locales.ts'],
  'src/client/TeamDock.module.css': ['packages/client/src/ui/TeamDock.module.css'],
  'src/client/TeamFeed.module.css': ['packages/client/src/ui/TeamLedger.module.css'],
  'src/client/TeamMembers.module.css': ['packages/client/src/ui/TeamMembers.module.css'],
  'src/client/TeamSettingsSection.module.css': ['packages/client/src/ui/TeamSettingsSection.module.css'],
  'src/client/TeamTasks.module.css': ['packages/client/src/ui/TeamActivity.module.css'],
  'src/client/TeamTimeline.module.css': ['packages/client/src/ui/TeamTimeline.module.css'],
  'src/client/TeamView.module.css': ['packages/client/src/ui/TeamView.module.css'],
  'package.json': null,
  'tsconfig.json': null,
  'tsdown.config.ts': null,
  'src/index.ts': null,
  'src/invariant.ts': null,
  'src/css-modules.d.ts': ['packages/client/src/css-modules.d.ts'],
  'README.md': null,
  'README.zh.md': null,
  'README.i18n.yaml': null,
  'tests/client-bundle.client.spec.ts': ['packages/client/test/client-bundle.client.spec.ts'],
  'tests/team-dock-model.client.spec.ts': ['packages/client/test/team-dock-model.client.spec.ts'],
  'tests/team-dock.client.spec.tsx': ['packages/client/test/team-dock.client.spec.tsx'],
  'tests/team-feed-model.client.spec.ts': ['packages/client/test/team-ledger-model.client.spec.ts'],
  'tests/team-feed.client.spec.tsx': ['packages/client/test/team-activity.client.spec.tsx'],
  'tests/team-marker-definition.client.spec.ts': ['packages/client/test/client-architecture-negatives.test.ts'],
  'tests/team-marker.client.spec.tsx': ['packages/client/test/team-ledger.client.spec.tsx'],
  'tests/team-members-model.client.spec.ts': ['packages/client/test/team-members-model.client.spec.ts'],
  'tests/team-members.client.spec.tsx': ['packages/client/test/team-members.client.spec.tsx'],
  'tests/team-plugin.client.spec.tsx': ['packages/client/test/team-plugin.client.spec.tsx'],
  'tests/team-tasks.client.spec.tsx': ['packages/client/test/team-activity.client.spec.tsx'],
  'tests/team-timeline-model.client.spec.ts': ['packages/client/test/team-timeline-model.client.spec.ts'],
  'tests/team-timeline.client.spec.tsx': ['packages/client/test/team-timeline.client.spec.tsx'],
  'tests/team-view.client.spec.tsx': ['packages/client/test/team-view.client.spec.tsx'],
}

function numstat(a, b) {
  try {
    const out = execFileSync('git', ['diff', '--no-index', '--numstat', '--', a, b], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const m = out.match(/^(\d+)\t(\d+)/)
    return m ? `+${m[1]}/-${m[2]}` : 'identical'
  } catch (error) {
    const out = String(error.stdout ?? '')
    const m = out.match(/^(\d+)\t(\d+)/m)
    return m ? `+${m[1]}/-${m[2]}` : `ERR ${String(error.message).slice(0, 60)}`
  }
}

const rows = []
for (const [legacy, targets] of Object.entries(MAP)) {
  const fullSha = sha.get(legacy) ?? '???'
  const snapFile = `${SNAP}/${legacy}`
  if (!existsSync(snapFile)) {
    rows.push(`| \`${legacy}\` | \`${fullSha.slice(0, 8)}\` | SNAP-MISSING |`)
    continue
  }
  if (targets === null) {
    rows.push(`| \`${legacy}\` | \`${fullSha.slice(0, 8)}\` | — (DROP) |`)
    continue
  }
  const parts = targets.map((t) => {
    const p9 = `${WT}/${t}`
    if (!existsSync(p9)) return `${t}: P9-MISSING`
    return `${t.replace('packages/client/', '')}: ${numstat(snapFile, p9)}`
  })
  rows.push(`| \`${legacy}\` | \`${fullSha.slice(0, 8)}\` | ${parts.join(' + ')} |`)
}
console.log(rows.join('\n'))
