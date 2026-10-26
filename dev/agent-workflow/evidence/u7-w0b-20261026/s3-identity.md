# S3 search — identity proof (mount fingerprint, 12-config matrix)

base 88107ad71: FINGERPRINT 7b2babd6c22924f7321b137b3e9ae13caecdd88f72dcc04e33468ca661454552
head (search on seam): FINGERPRINT 7b2babd6c22924f7321b137b3e9ae13caecdd88f72dcc04e33468ca661454552

Sensitivity plant (measured, then reverted): moving the kit 'injected.glob' seam ahead of the globEnabled=false shut gate in packages/tools/families/search.mjs changed the fingerprint to eb18e51a… with exactly one diff hunk:
    "glob": "a5-glob-config-disabled"  ->  "glob": "kit-glob"   (config injectedGlobOff)
Restored; index --check OK; fingerprint back to 7b2babd6….

## S3b fs (read + write + edit + read_image)

head (fs + search on seam): FINGERPRINT 7b2babd6c22924f7321b137b3e9ae13caecdd88f72dcc04e33468ca661454552 — equal to base 88107ad71 (fp-s3-fs.json).
Regression: 41 files / 608 tests; the one red was the p4t6 +1 booking (fs.mjs), booked after (p4t6-RED-unbooked-s3b.log).
