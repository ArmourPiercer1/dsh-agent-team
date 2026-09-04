import { readFileSync } from 'node:fs'
const c = readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/P9/s8/s8-browser.mjs', 'utf8')
console.log('hasNewStep=' + c.includes('launch-token param set'))
const i = c.indexOf('launch-token param set')
if (i >= 0) {
  const line = c.slice(c.lastIndexOf('\n', i) + 1, c.indexOf('\n', i))
  console.log('stepLine=' + JSON.stringify(line))
}
const j = c.indexOf('launchUrl')
const line2 = c.slice(c.lastIndexOf('\n', j) + 1, c.indexOf('\n', j) + 300)
console.log('gotoRegion=' + JSON.stringify(line2.slice(0, 400)))
