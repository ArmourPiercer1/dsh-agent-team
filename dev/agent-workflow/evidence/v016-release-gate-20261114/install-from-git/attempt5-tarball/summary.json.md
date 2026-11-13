```json
{
  "label": "attempt5-tarball",
  "spec": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/.artifacts/tmp/pack-gate/dsh-agent-team-0.1.6.tgz",
  "installExit": 0,
  "verdict": "PASS",
  "facts": {
    "command": "DSH_HOME=/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/v016-install-from-git-attempt5-tarball-2026-11-13T16-55-31/home node /home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use/apps/cli/lib/bin.js plugin --profile web add /home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/.artifacts/tmp/pack-gate/dsh-agent-team-0.1.6.tgz",
    "exit": 0,
    "elapsedMs": 2486,
    "spec": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/.artifacts/tmp/pack-gate/dsh-agent-team-0.1.6.tgz",
    "viaPnpmDsh": false,
    "world": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/v016-install-from-git-attempt5-tarball-2026-11-13T16-55-31",
    "dshHome": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/v016-install-from-git-attempt5-tarball-2026-11-13T16-55-31/home",
    "profile": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/v016-install-from-git-attempt5-tarball-2026-11-13T16-55-31/home/profiles/web",
    "installed": true,
    "installedName": "dsh-agent-team",
    "installedVersion": "0.1.6",
    "installedPrivate": true,
    "installedHasDshBundle": true,
    "installedHasBin": false,
    "installedScripts": [
      "build",
      "build:composition",
      "setup",
      "check:artifacts",
      "check:artifacts:head",
      "typecheck",
      "lint",
      "lint:identities",
      "test",
      "test:node",
      "smoke:composition",
      "check:install-manifest",
      "docs:probe",
      "docs:sync",
      "docs:controls",
      "ci:local"
    ],
    "installedHostEntry": true,
    "installedHostEntrySha256": "187bc363dc816703a364ad1288dd575135892fb7ad644273a38bba86e7d612b6",
    "installedDistFiles": 2200,
    "installedFiles": 2241,
    "installedTreeDigest": "sha256:c03362f6cce19092df564e6865263b2e5e033ec08383ff4f0cfa9b773530335e",
    "bundlePatchPresent": true,
    "profileDependency": "file:/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/.artifacts/tmp/pack-gate/dsh-agent-team-0.1.6.tgz",
    "profileBundles": [
      "@deepseek-ai/dsh-base",
      "@deepseek-ai/dsh-web-app",
      "dsh-agent-team"
    ],
    "lock": {
      "text": "  dsh-agent-team@file:../../../../../../.artifacts/tmp/pack-gate/dsh-agent-team-0.1.6.tgz:\n    resolution: {integrity: sha512-wrXG0+XShrRtGlxWXreEZQ3O5YcxafcRdAb6KPk18HFhLs5gu3uofRiWnWIJxv5o/R6nvlK141HDKcNHv21TwA==, tarball: file:../../../../../../.artifacts/tmp/pack-gate/dsh-agent-team-0.1.6.tgz}\n    version: 0.1.6\n    engines: {node: ^22.19.0 || >=24.0.0}\n    peerDependencies:\n      '@deepseek-ai/dsh': 0.2.0-rc.2\n      '@deepseek-ai/dsh-agent': 0.2.0-rc.2\n      '@deepseek-ai/dsh-home-paths': 0.2.0-rc.2\n      '@deepseek-ai/dsh-llm': 0.2.0-rc.2\n      '@deepseek-ai/dsh-mcp-client': 0.2.0-rc.2\n      '@deepseek-ai/dsh-scope': 0.2.0-rc.2\n      '@deepseek-ai/dsh-session': 0.2.0-rc.2\n      '@deepseek-ai/dsh-skill': 0.2.0-rc.2\n      '@deepseek-ai/dsh-spill-local': 0.2.0-rc.2\n      '@deepseek-ai/dsh-storage-domain': 0.2.0-rc.2\n      '@deepseek-ai/dsh-terminal': 0.2.0-rc.2\n      '@deepseek-ai/dsh-terminal-bash': 0.2.0-rc.2\n      '@deepseek-ai/dsh-tool-bash-persistent': 0.2.0-rc.2\n      '@deepseek-ai/dsh-tool-fs': 0.2.0-rc.2\n      '@deepseek-ai/dsh-tool-fs-search': 0.2.0-rc.2\n      '@deepseek-ai/dsh-tool-web': 0.2.0-rc.2\n      '@deepseek-ai/dsh-tools': 0.2.0-rc.2\n      '@deepseek-ai/dsh-web-fetch-http': 0.2.0-rc.2\n    peerDependenciesMeta:\n      '@deepseek-ai/dsh':\n        optional: true\n      '@deepseek-ai/dsh-agent':\n        optional: true\n      '@deepseek-ai/dsh-home-paths':\n        optional: true\n      '@deepseek-ai/dsh-llm':\n        optional: true\n      '@deepseek-ai/dsh-mcp-client':\n        optional: true\n      '@deepseek-ai/dsh-scope':\n        optional: true\n      '@deepseek-ai/dsh-session':\n        optional: true\n      '@deepseek-ai/dsh-skill':\n        optional: true\n      '@deepseek-ai/dsh-spill-local':\n        optional: true\n      '@deepseek-ai/dsh-storage-domain':\n        optional: true\n      '@deepseek-ai/dsh-terminal':\n        optional: true\n      '@deepseek-ai/dsh-terminal-bash':\n        optional: true\n      '@deepseek-ai/dsh-tool-bash-persistent':\n        optional: true\n      '@deepseek-ai/dsh-tool-fs':\n        optional: true\n      '@deepseek-ai/dsh-tool-fs-search':\n        optional: true\n      '@deepseek-ai/dsh-tool-web':\n        optional: true\n      '@deepseek-ai/dsh-tools':\n        optional: true\n      '@deepseek-ai/dsh-web-fetch-http':\n        optional: true\n",
      "commit": null,
      "file": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/v016-install-from-git-attempt5-tarball-2026-11-13T16-55-31/home/profiles/web/pnpm-lock.yaml",
      "sha256": "5e5b5f930eaac2a754e54b70ed8d60a43061bf8177f9588a6c6a39d247ac8a95"
    }
  },
  "list": {
    "command": "DSH_HOME=/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/v016-install-from-git-attempt5-tarball-2026-11-13T16-55-31/home node /home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use/apps/cli/lib/bin.js plugin --profile web list",
    "exit": 0,
    "mentionsPlugin": true,
    "stdout": "Legend: production dependency, optional only, dev only\n\ndsh-profile-web /home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/v016-install-from-git-attempt5-tarball-2026-11-13T16-55-31/home/profiles/web (PRIVATE)\n│\n│   dependencies:\n└── dsh-agent-team@0.1.6\n\n1 package\n",
    "stderr": ""
  },
  "boot": {
    "port": 3191,
    "booted": true,
    "bootLine": "http://127.0.0.1:3191/?token=<redacted>",
    "authStatus": 303,
    "pluginMounted": true,
    "skillsRegistered": true,
    "error": null,
    "logSha256": "761a7f5b2c1e5cd4a3840d9dc4950a9297efbdfddaccb85e82002e6c313a4e3e",
    "logBytes": 467,
    "tokenAccepted": true,
    "noTokenStatus": 401,
    "remoteRouteStatusWithoutAuth": 401,
    "exitCodeAfterTeardown": 0
  }
}
```
