import re, sys, pathlib
paths = set()
for n in open(sys.argv[1]).read().split():
    paths.add(f"packages/runtime/test/{n}.test.ts")
    paths.add(f"packages/runtime/test/{n}.ts")
p = pathlib.Path("packages/testkit/test/a4p7-blueprint-version-clean.test.ts")
lines = p.read_text().split("\n")
keep, dropped = [], []
for l in lines:
    m = re.match(r"^\s*\['([^']+)'", l)
    if m and m.group(1) in paths:
        dropped.append(m.group(1))
        continue
    keep.append(l)
p.write_text("\n".join(keep))
print("dropped", len(dropped), "rows:", ", ".join(sorted(x.split("/")[-1] for x in dropped)))
