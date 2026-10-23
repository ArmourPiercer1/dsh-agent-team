# CENSUS IDENTITY — scanned 1255 vs booked 1245 (handoff to the exclusive CI owner; NO number touched here)

Facts only, all computed STATICALLY from git (zero suite runs by this writer).

- Booking: `e922591dc` (2026-10-23 07:42Z, "test(testkit): book round 6 and correct the census pin") — title literal books **1245** on that tree.
- Current int HEAD at handoff: `233ba84113c6bc86da1b1c62ee9f8cdaaf319e41` (origin tip; the C2 pin `3def71a9a` shares the same scannable surface — 233ba added ONLY dist mirrors + already-counted edits).
- Delta `e922591dc..233ba8411` under packages/** (dist excluded — dist is outside the scan; dev/** outside; docs/** outside): **ADDED = 10, REMOVED = 0**. All ten are scannable source/test paths:

| added-by | blob@233ba | path |
|---|---|---|
| c0dcd378b | 5278e06a8a13 | packages/runtime/controlled-fs/src/bounded-bytes-read.ts |
| c0dcd378b | 41197166c88d | packages/runtime/test/a5m2-fs-bounded-read-c1.test.ts |
| 057178d2b | 327f40f8f560 | packages/runtime/controlled-fs/src/governed-image-read-port.ts |
| 057178d2b | 40aaba56044a | packages/runtime/test/a5m2-image-read-port-c1.test.ts |
| bce6173a2 | ad049a70d2aa | packages/runtime/controlled-fs/src/post-consume-write.ts |
| bce6173a2 | 79a5cee921a7 | packages/runtime/test/a5m2-post-consume-write-c1.test.ts |
| 1a399e977 | 70d22d69e1e6 | packages/runtime/src/plugin/live/governed-families/write.mjs |
| 1a399e977 | a8e8ac37fd60 | packages/runtime/test/a5m2-write-existing-c1.test.ts |
| 307e9951a | 5e857d709801 | packages/runtime/test/a5m2-todo-assembly-c1.test.ts |
| 0d5255a49 | 7ebdaa91b0b3 | packages/runtime/test/a5m2-image-row-c1.test.ts |

- Arithmetic: booked 1245 + 10 added − 0 removed = **1255** = the observed scan count. The delta is ENTIRELY these ten files; NO old-9-reds involvement, no test deleted, no baseline altered, no denylist vocabulary.
- Every path above carries its adding commit + current blob for the owner's manifest re-anchor (booking list additions + title literal are the owner's to write; this writer does not touch the expected count).
