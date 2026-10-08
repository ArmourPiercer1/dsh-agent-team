# Consumer sets for the five promoted fixture modules — derivation and how to re-derive

`edges.txt` — every test file that imports one of the five modules (223 import edges).
`distinct.txt` — the same set as unique files (**135 distinct files**). A file that imports
two of the modules appears twice in `edges.txt` and once in `distinct.txt`; the earlier
"193" was the sum of five per-module lists, which double-counts.

Re-derive (the command that produced both files):

```sh
for h in bound-blueprint-persona-helpers p6t1-helpers p6t2-helpers p6t3-helpers p6t4-helpers; do
  grep -rl "test/$h\.js\|from '\./$h\.js'\|/$h'" packages/*/test tests/kits \
    | sort -u | sed "s|^|$h :: |"
done > edges.txt
awk -F' :: ' '{print $2}' edges.txt | sort -u > distinct.txt
```

Scope note (a hole the first version of this lane had): the scan covers `packages/*/test`,
**including `packages/tools/test`**, plus `tests/kits`. An earlier per-helper list built by
grepping only under `packages/runtime/test` missed 8 consumers that import these modules
from `packages/tools/test`; those are in `distinct.txt` and are in every consumer run below.
