```json
{
  "port": 3191,
  "booted": false,
  "bootLine": null,
  "authStatus": null,
  "pluginMounted": false,
  "skillsRegistered": false,
  "error": "no boot line in 180s; log tail:\nnode:internal/modules/cjs/loader:1568\n  throw err;\n  ^\n\nError: Cannot find module '/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/deepseek-harness-test-use/apps/cli/lib/bin.js'\n    at Module._resolveFilename (node:internal/modules/cjs/loader:1564:15)\n    at wrapResolveFilename (node:internal/modules/cjs/loader:1118:27)\n    at defaultResolveImplForCJSLoading (node:internal/modules/cjs/loader:1142:10)\n    at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1169:12)\n    at Module._load (node:internal/modules/cjs/loader:1341:5)\n    at wrapModuleLoad (node:internal/modules/cjs/loader:261:19)\n    at Module.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:154:5)\n    at node:internal/main/run_main_module:33:47 {\n  code: 'MODULE_NOT_FOUND',\n  requireStack: []\n}\n\nNode.js v24.21.0\n",
  "logSha256": "02d315e9babe59fe364674be45f7e6999986f739228a9b87b522a4b5b46f60b7",
  "logBytes": 839,
  "exitCodeAfterTeardown": 1
}
```
