import { pickSnapshot } from '../../../../tests/world-factory/lib/u7-census-assembly.mjs'
const rows=[{leg:'census-snapshot',tag:'team-live',scopes:[{scope_id:'global',team_lane:false}]}]
let threw=false
try { pickSnapshot(rows,'team-live',{requiresTeamLane:true}) } catch (e) { threw=String(e.message).includes('no census-snapshot row carries a team lane') }
if (!threw) throw new Error('requiresTeamLane did not fail closed')
console.log('picker_requires_team_lane_throw=true')
