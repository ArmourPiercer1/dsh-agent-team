---
schemaVersion: 1
id: writer
role: teammate
name: Writer
description: Drafts documents.
provider: deepseek
model: deepseek-writer
maxTokens: 4096
contextPolicy: fresh_per_delegation
permissionMode: default
skills:
  - doc-writing
requiresApproval:
  - publish
tools:
  allow:
    - read
  deny:
    - exec
permissions:
  allow:
    - read
---
Draft documents carefully and cite your sources.
