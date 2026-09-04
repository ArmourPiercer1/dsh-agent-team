param()
$w = 'D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\P9'
$src = "$w\dev\agent-workflow\evidence\P9\legacy-506191b\packages\client\ui-team"
$ui = "$w\packages\client\src\ui"
$model = "$w\packages\client\src\model"
$test = "$w\packages\client\test"
$scratch = "$w\dev\agent-workflow\evidence\P9\review-scratch"
foreach ($d in @($ui, $model, $test, $scratch)) {
  New-Item -ItemType Directory -Force -Path $d | Out-Null
}
# dst (relative to worktree) | source (relative to snapshot ui-team root) | expected blob sha
$rows = @(
  'packages\client\src\ui\TeamDock.tsx|src\client\TeamDock.tsx|6e2ffbf9879016a040519c5102ce878ad9e15040',
  'packages\client\src\ui\TeamDock.module.css|src\client\TeamDock.module.css|f61ecee1417a2f91ca6e749163b83a4be839fd43',
  'packages\client\src\ui\TeamFeed.tsx|src\client\TeamFeed.tsx|bbcc5408dc3ff7a35b9114c073f0760265ae17b7',
  'packages\client\src\ui\TeamFeed.module.css|src\client\TeamFeed.module.css|d4205391f8e05faef37edcd265447933489d5980',
  'packages\client\src\ui\TeamMembers.tsx|src\client\TeamMembers.tsx|a04b046c6861b5aca825d2866a09c6b58d414a27',
  'packages\client\src\ui\TeamMembers.module.css|src\client\TeamMembers.module.css|78d103d9a4d94d3954f76c3406e5778b6ffd6814',
  'packages\client\src\ui\TeamTasks.tsx|src\client\TeamTasks.tsx|b2556c52d64abbce3babdc6802f72558626441a2',
  'packages\client\src\ui\TeamTasks.module.css|src\client\TeamTasks.module.css|0181c3623e1c90c627c3ccc0f92014d2a0baefda',
  'packages\client\src\ui\TeamTimeline.tsx|src\client\TeamTimeline.tsx|92a478b2941e5fe173b4a9f61b4607896495cdee',
  'packages\client\src\ui\TeamTimeline.module.css|src\client\TeamTimeline.module.css|092293582c93438575531e44ef8285639b22038a',
  'packages\client\src\ui\TeamView.tsx|src\client\TeamView.tsx|5f4aabd9dd3b031e9f3741a3434e2d9d1bf22361',
  'packages\client\src\ui\TeamView.module.css|src\client\TeamView.module.css|7716f128f2c65a1a3c29946becc56e2cdace5fda',
  'packages\client\src\ui\locales.ts|src\client\locales.ts|ad589d4b8c51d9063df0d7b095f750d9353d5af9',
  'packages\client\src\model\team-dock-model.ts|src\client\team-dock-model.ts|c640865a58aaf0e2d02a3ece3d6a9f8a31c8b1ce',
  'packages\client\src\model\team-feed-model.ts|src\client\team-feed-model.ts|10581ba89693f83051b6f72c946775b19eb65aaf',
  'packages\client\src\model\team-members-model.ts|src\client\team-members-model.ts|56e53cb9dd7d2a0bbfe432da8b0c4843b028ff3d',
  'packages\client\src\model\team-timeline-model.ts|src\client\team-timeline-model.ts|4921f6b8c0b152669606ea49d422b8c00dc0bcbe',
  'packages\client\test\client-bundle.client.spec.ts|tests\client-bundle.client.spec.ts|c9bd8ad8b06f67fbe413b5644cea7cdaab485607',
  'packages\client\test\team-dock-model.client.spec.ts|tests\team-dock-model.client.spec.ts|ba4989453e43932807f5b166ee74bcef0e912b33',
  'packages\client\test\team-dock.client.spec.tsx|tests\team-dock.client.spec.tsx|fe98ac1199f4a0a7e4075a9a636a5495934e8f65',
  'packages\client\test\team-feed-model.client.spec.ts|tests\team-feed-model.client.spec.ts|39c4c57945269669fd5c3348c5c738f530c8a61b',
  'packages\client\test\team-feed.client.spec.tsx|tests\team-feed.client.spec.tsx|d28015b9fa22fd95493f4e5c3cdc5884c2c3fd06',
  'packages\client\test\team-marker-definition.client.spec.ts|tests\team-marker-definition.client.spec.ts|9ff87443691b100bada4b8f162d52d8bab4a8b45',
  'packages\client\test\team-marker.client.spec.tsx|tests\team-marker.client.spec.tsx|ccafe89e4378b923849a7fe1b4e62faf58a1422d',
  'packages\client\test\team-members-model.client.spec.ts|tests\team-members-model.client.spec.ts|482a0ded8935011393be8e8ae49c455112a2cbc9',
  'packages\client\test\team-members.client.spec.tsx|tests\team-members.client.spec.tsx|6f59353c5610213194d0d5a4837b2962bd580812',
  'packages\client\test\team-plugin.client.spec.tsx|tests\team-plugin.client.spec.tsx|d5e60bfad4abf8ad48852bd595ffbd97618d30d6',
  'packages\client\test\team-tasks.client.spec.tsx|tests\team-tasks.client.spec.tsx|5e36484016839724c280394cd88e2522351af792',
  'packages\client\test\team-timeline-model.client.spec.ts|tests\team-timeline-model.client.spec.ts|786b6c9d6f7ce1e09285e6b825d5d4240bfdec1b',
  'packages\client\test\team-timeline.client.spec.tsx|tests\team-timeline.client.spec.tsx|5828ed019c3ccbc3cd4c1d11b1f9119b996d6158',
  'packages\client\test\team-view.client.spec.tsx|tests\team-view.client.spec.tsx|9f07bad14e2205d0178a32624de3b4455231a925',
  'dev\agent-workflow\evidence\P9\review-scratch\TeamMarker.tsx|src\client\TeamMarker.tsx|fa05c532a64616fd9077c7c1190672a490a9ed7d',
  'dev\agent-workflow\evidence\P9\review-scratch\TeamMarker.module.css|src\client\TeamMarker.module.css|34245a2b57918d2c243f009c848a7266708384ed',
  'dev\agent-workflow\evidence\P9\review-scratch\team-marker-definition.ts|src\client\team-marker-definition.ts|18dba491ab6f670ae86ba476d649401ca09887f1',
  'dev\agent-workflow\evidence\P9\review-scratch\team-marker-jump.ts|src\client\team-marker-jump.ts|1e64af4a76e1dc8e23c3ce808d59f74b6bcd35af'
)
$lines = @('P9-T1 copy verification')
$lines += ('source pin: feat/agent-teams@506191ba893ac55980dd09680c438710ab24095b (506191b)')
$lines += ('snapshot: dev/agent-workflow/evidence/P9/legacy-506191b/packages/client/ui-team (47/47 blob-verified at P9-T0)')
$lines += ''
$ok = 0
$bad = 0
foreach ($row in $rows) {
  $parts = $row.Split('|')
  $dstRel = $parts[0]
  $fromRel = $parts[1]
  $exp = $parts[2]
  $dst = Join-Path $w $dstRel
  $from = Join-Path $src $fromRel
  Copy-Item $from $dst -Force
  $h = (git hash-object $dst).Trim()
  $name = Split-Path $dstRel -Leaf
  if ($h -ceq $exp) { $status = 'OK      '; $ok++ } else { $status = 'MISMATCH'; $bad++ }
  $lines += ("{0}  {1}  expected={2}  actual={3}  {4}" -f $status, $name, $exp, $h, $dstRel)
}
$lines += ''
$lines += ("RESULT: {0} OK / {1} mismatch / {2} total" -f $ok, $bad, $rows.Count)
$lines | Out-File "$w\dev\agent-workflow\evidence\P9\p9-t1-copy-verification.txt" -Encoding utf8
Write-Output ("RESULT: {0} OK / {1} mismatch / {2} total" -f $ok, $bad, $rows.Count)
