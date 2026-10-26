# a5g6-install-face-render — first-test timeout under parallel load (disclosed, not masked)

Observed twice in the 41-file parallel regression (S3a, S4): 'GLUE-6 LEG B … the trio definitions all carry a render…' fails with 'Test timed out in 5000ms' — the FIRST test of the file does the cold dynamic import of the whole plane graph (a5p5 .ts transforms) under the default 5 s timeout while 40 other files transform in parallel.
Isolated reruns on this tree: 5/5 pass (3 runs at S3a, 3 at S4); the base 88107ad71 isolated run passes in ~0.7 s for that test. It is not an assertion failure and no assertion in the file changed. This lane does NOT raise the timeout (that would be a test-infra change outside scope); flagged for the CI owner.
