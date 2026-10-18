# Privacy and data handling

What the software does, not a legal claim. SkinProof does not claim compliance
with any particular law.

| Data | Where | Kept | Deleted |
| --- | --- | --- | --- |
| Photo (normalised, metadata stripped) | `DATA_DIR/artifacts`, tied to the consultation | `RETENTION_HOURS` (default 24) | automatically; on a new upload; on request |
| YouCam masks and try-on images | same | same | same |
| Analysis scores, skin type | SQLite | `CONSULTATION_RETENTION_DAYS` (default 30) | automatically; on request |
| Goals, limits, decisions | SQLite | same | same |
| Raw YouCam responses | not stored | — | — |
| Diagnostics | SQLite | with the job | statuses, timings, counts and field shapes only; never keys, URLs or values |
| Logs | stdout | — | identifiers and codes only |

* **Consent.** Analysis and try-on each need their own agreement, recorded
  with a timestamp. Either covers uploading a photo; each feature checks its own.
* **Identity.** No accounts. A random consultation id in an httpOnly,
  SameSite=Lax cookie (Secure in production).
* **Access.** Images and job status are served only to the browser holding the
  owning cookie, with `Cache-Control: private, no-store`.
* **Retention.** A sweep runs at start-up and every 15 minutes.
* **Deletion.** “Your data” deletes the consultation, cascades to every derived
  record, and removes image files no other record references.
* **YouCam.** Photos sent for analysis or try-on are processed by Perfect Corp.
  under its terms. Its documentation says uploads and results are removed after
  30 days and result URLs expire after 2 hours. SkinProof cannot delete files on
  YouCam's side and says so on the consent and data pages.
* **Medical claims.** Goals are cosmetic; pages say the analysis is not a
  diagnosis and point to a clinician for conditions.
* **Repository.** No photos of people. Tests and screenshots use a synthetic
  drawn portrait. Live-check output images are git-ignored.
