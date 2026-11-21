```json
{
  "command": "cd /home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use && DSH_HOME=/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/v016-install-from-git-attempt4-pnpm-dsh-2026-11-13T16-49-21/home pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team",
  "exit": 0,
  "elapsedMs": 5722,
  "spec": "github:ArmourPiercer1/dsh-agent-team",
  "viaPnpmDsh": true,
  "world": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/v016-install-from-git-attempt4-pnpm-dsh-2026-11-13T16-49-21",
  "dshHome": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/v016-install-from-git-attempt4-pnpm-dsh-2026-11-13T16-49-21/home",
  "profile": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/v016-install-from-git-attempt4-pnpm-dsh-2026-11-13T16-49-21/home/profiles/web",
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
  "installedTreeDigest": "sha256:fc4f2f1a25d0f1cd1a31ff238dae82748f8926250ff570817308dad071b9c067",
  "bundlePatchPresent": true,
  "profileDependency": "github:ArmourPiercer1/dsh-agent-team",
  "profileBundles": [
    "@deepseek-ai/dsh-base",
    "@deepseek-ai/dsh-web-app",
    "dsh-agent-team"
  ],
  "lock": {
    "text": "  dsh-agent-team@https://codeload.github.com/ArmourPiercer1/dsh-agent-team/tar.gz/6361185d878ab2617193d51dd419e6dfe521a2ad:\n    resolution: {gitHosted: true, tarball: https://codeload.github.com/ArmourPiercer1/dsh-agent-team/tar.gz/6361185d878ab2617193d51dd419e6dfe521a2ad}\n    version: 0.1.6\n    engines: {node: ^22.19.0 || >=24.0.0}\n    peerDependencies:\n      '@deepseek-ai/dsh': 0.2.0-rc.2\n      '@deepseek-ai/dsh-agent': 0.2.0-rc.2\n      '@deepseek-ai/dsh-home-paths': 0.2.0-rc.2\n      '@deepseek-ai/dsh-llm': 0.2.0-rc.2\n      '@deepseek-ai/dsh-mcp-client': 0.2.0-rc.2\n      '@deepseek-ai/dsh-scope': 0.2.0-rc.2\n      '@deepseek-ai/dsh-session': 0.2.0-rc.2\n      '@deepseek-ai/dsh-skill': 0.2.0-rc.2\n      '@deepseek-ai/dsh-spill-local': 0.2.0-rc.2\n      '@deepseek-ai/dsh-storage-domain': 0.2.0-rc.2\n      '@deepseek-ai/dsh-terminal': 0.2.0-rc.2\n      '@deepseek-ai/dsh-terminal-bash': 0.2.0-rc.2\n      '@deepseek-ai/dsh-tool-bash-persistent': 0.2.0-rc.2\n      '@deepseek-ai/dsh-tool-fs': 0.2.0-rc.2\n      '@deepseek-ai/dsh-tool-fs-search': 0.2.0-rc.2\n      '@deepseek-ai/dsh-tool-web': 0.2.0-rc.2\n      '@deepseek-ai/dsh-tools': 0.2.0-rc.2\n      '@deepseek-ai/dsh-web-fetch-http': 0.2.0-rc.2\n    peerDependenciesMeta:\n      '@deepseek-ai/dsh':\n        optional: true\n      '@deepseek-ai/dsh-agent':\n        optional: true\n      '@deepseek-ai/dsh-home-paths':\n        optional: true\n      '@deepseek-ai/dsh-llm':\n        optional: true\n      '@deepseek-ai/dsh-mcp-client':\n        optional: true\n      '@deepseek-ai/dsh-scope':\n        optional: true\n      '@deepseek-ai/dsh-session':\n        optional: true\n      '@deepseek-ai/dsh-skill':\n        optional: true\n      '@deepseek-ai/dsh-spill-local':\n        optional: true\n      '@deepseek-ai/dsh-storage-domain':\n        optional: true\n      '@deepseek-ai/dsh-terminal':\n        optional: true\n      '@deepseek-ai/dsh-terminal-bash':\n        optional: true\n      '@deepseek-ai/dsh-tool-bash-persistent':\n        optional: true\n      '@deepseek-ai/dsh-tool-fs':\n        optional: true\n      '@deepseek-ai/dsh-tool-fs-search':\n        optional: true\n      '@deepseek-ai/dsh-tool-web':\n        optional: true\n      '@deepseek-ai/dsh-tools':\n        optional: true\n      '@deepseek-ai/dsh-web-fetch-http':\n        optional: true\n",
    "commit": "6361185d878ab2617193d51dd419e6dfe521a2ad",
    "file": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/v016-install-from-git-attempt4-pnpm-dsh-2026-11-13T16-49-21/home/profiles/web/pnpm-lock.yaml",
    "sha256": "2c69efa0ad9e4265adc179ce6084f4a614d7974c778670ccdc31cbea66d4784e"
  }
}
```
