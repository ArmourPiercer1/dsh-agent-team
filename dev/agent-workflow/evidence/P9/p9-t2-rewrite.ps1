# P9-T2 mechanical import rewrites (ui//model split + NodeNext .js convention).
# Each row: file|old-specifier|new-specifier. Assertion: old appears EXACTLY ONCE.
$ErrorActionPreference = 'Stop'
$root = 'D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\P9\packages\client'

$rows = @(
  'src/ui/TeamDock.tsx|./team-dock-model.ts|../model/team-dock-model.js',
  'src/ui/TeamDock.tsx|./locales.ts|./locales.js',
  'src/ui/TeamFeed.tsx|./locales.ts|./locales.js',
  'src/ui/TeamFeed.tsx|./team-feed-model.ts|../model/team-feed-model.js',
  'src/ui/TeamFeed.tsx|./team-timeline-model.ts|../model/team-timeline-model.js',
  'src/ui/TeamMembers.tsx|./team-members-model.ts|../model/team-members-model.js',
  'src/ui/TeamMembers.tsx|./locales.ts|./locales.js',
  'src/ui/TeamTasks.tsx|./locales.ts|./locales.js',
  'src/ui/TeamTimeline.tsx|./team-timeline-model.ts|../model/team-timeline-model.js',
  'src/ui/TeamView.tsx|./TeamTimeline.tsx|./TeamTimeline.js',
  'src/ui/TeamView.tsx|./TeamMembers.tsx|./TeamMembers.js',
  'src/ui/TeamView.tsx|./TeamTasks.tsx|./TeamTasks.js',
  'src/ui/TeamView.tsx|./TeamFeed.tsx|./TeamFeed.js',
  'test/team-dock-model.client.spec.ts|../src/client/team-dock-model.ts|../src/model/team-dock-model.js',
  'test/team-dock.client.spec.tsx|../src/client/TeamDock.tsx|../src/ui/TeamDock.js',
  'test/team-dock.client.spec.tsx|../src/client/locales.ts|../src/ui/locales.js',
  'test/team-feed.client.spec.tsx|../src/client/TeamFeed.tsx|../src/ui/TeamFeed.js',
  'test/team-feed.client.spec.tsx|../src/client/team-timeline-model.ts|../src/model/team-timeline-model.js',
  'test/team-feed.client.spec.tsx|../src/client/locales.ts|../src/ui/locales.js',
  'test/team-members-model.client.spec.ts|../src/client/team-members-model.ts|../src/model/team-members-model.js',
  'test/team-members.client.spec.tsx|../src/client/TeamMembers.tsx|../src/ui/TeamMembers.js',
  'test/team-members.client.spec.tsx|../src/client/locales.ts|../src/ui/locales.js',
  'test/team-tasks.client.spec.tsx|../src/client/TeamTasks.tsx|../src/ui/TeamTasks.js',
  'test/team-tasks.client.spec.tsx|../src/client/locales.ts|../src/ui/locales.js',
  'test/team-timeline.client.spec.tsx|../src/client/TeamTimeline.tsx|../src/ui/TeamTimeline.js',
  'test/team-timeline.client.spec.tsx|../src/client/locales.ts|../src/ui/locales.js',
  'test/team-view.client.spec.tsx|../src/client/TeamView.tsx|../src/ui/TeamView.js',
  'test/team-view.client.spec.tsx|../src/client/locales.ts|../src/ui/locales.js'
)

$ok = 0; $fail = 0
foreach ($row in $rows) {
  $parts = $row.Split('|')
  $rel = $parts[0]; $old = $parts[1]; $new = $parts[2]
  $path = Join-Path $root $rel
  $content = [System.IO.File]::ReadAllText($path)
  $count = [regex]::Matches($content, [regex]::Escape("'" + $old + "'")).Count
  if ($count -ne 1) {
    Write-Output "FAIL $rel : '$old' appears $count times (want 1)"
    $fail++
    continue
  }
  $content = $content.Replace("'" + $old + "'", "'" + $new + "'")
  [System.IO.File]::WriteAllText($path, $content)
  Write-Output "OK   $rel : '$old' -> '$new'"
  $ok++
}
Write-Output ("RESULT: {0} OK / {1} fail / {2} total" -f $ok, $fail, $rows.Count)
if ($fail -gt 0) { exit 1 }
