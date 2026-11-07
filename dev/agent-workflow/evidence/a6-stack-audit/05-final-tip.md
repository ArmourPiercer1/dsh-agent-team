# Final Preview tip and final gate

- Preview merge commit (A5 first parent / A6 second parent):
  `0c646897bbb03b01c48abfc7abbc9a93de45e107`
- Evidence commits after the merge change only `dev/agent-workflow/evidence/**`;
  they do not touch `packages/**`, `tests/**`, `scripts/**` or dist.
- Final full gate was run on the evidence tip with the same product tree:
  **8/9 PASS**. The only failing leg is census with exactly one pre-existing
  Alpha.5 environmental red (`a5sf-os-runner`, Landlock network-deny premise).
- Raw final gate: `full-gate3.log`; comparison: `census-comparison-final.json`.
- No master merge, no un-draft, no production enablement, no release.
