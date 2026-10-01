# graph.yaml YAML-escape fix — 2026-10-01 (closure writer, authorized by coordinator as handoff-doc correctness)

- Fact-first (same parser PyYAML 6.0.1, identical command): master `1385f1ee` AND pr52 `a04681a4` graph.yaml both fail at the SAME position (742:5 → 743:3078); line 743 byte-identical (sha256 above). Defect introduced on master side by `401e8a12` (2026-09-30 bookkeeping), i.e. pre-existing in master — NOT introduced by the closure sync rounds.
- Minimal repair authorized and applied: escape the single unescaped internal quote pair `"4 commits"` inside the `pr_f.progress` scalar. No semantic change, no historical text altered, no other line touched. Full file now PARSEs OK; validator output retained in parse-evidence.txt.
- Copies of the exact pre-fix files are committed alongside for reproducibility.
