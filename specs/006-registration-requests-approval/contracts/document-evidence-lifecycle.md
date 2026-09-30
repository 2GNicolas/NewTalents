# Contract: Document evidence lifecycle

## Provider boundary

`PrivateEvidenceStore` exposes streaming `put`, `openStream`, idempotent `delete` and `exists`. Domain records only a random opaque `objectKey`. Local development stores beneath an explicitly configured private volume outside served/static paths. Production uses an S3-compatible private bucket with public access blocked and encryption at rest.

No provider URL, local path, document bytes or base64 value enters ordinary JSON, logs, traces, events, exports or diagnostics.

## Upload pipeline

1. Authorize request ownership/context and editable lifecycle/version.
2. Stream to a new quarantine key while enforcing 10 MiB per item and 40 MiB total defaults.
3. Permit only PDF, JPEG and PNG; compare declared MIME, extension policy and detected magic bytes.
4. Calculate technical digest without logging it.
5. Invoke malware scanner through stream with bounded timeout.
6. On clean result, mark `CLEAN`; on mismatch/malware mark `REJECTED` and enqueue deletion.
7. Only current `CLEAN` items satisfy evidence completeness.

Scanner timeout, unavailable daemon, malformed response or uncertain result fails closed. The request cannot be submitted and the file remains inaccessible in quarantine until rejected/deleted by recovery.

## State model

```text
QUARANTINED -> SCANNING -> CLEAN -> DELETION_PENDING -> DELETED
       |          |          |-> REPLACED -> DELETION_PENDING -> DELETED
       |          `-> REJECTED -> DELETION_PENDING -> DELETED
       `-> REJECTED
```

State changes are versioned and audited using safe categories only.

## Access and viewer

- Applicant sees category, upload/completeness/correction status, never unrestricted original after submit.
- Only Administrator with `registration.review.view-evidence` can stream current CLEAN evidence for SUBMITTED review.
- Backend reauthorizes every stream and sets attachment/inline policy, `nosniff`, no-store caching and safe generated filename.
- Each open attempt records actor, request, evidence id, category, result and time; never bytes/raw document.
- Analyst, academy staff beyond safe authorization state, unaffiliated identity and public clients receive safe denial.

## Replacement

Replacement is allowed only in `REQUIRES_CORRECTION`. New evidence completes the full pipeline before becoming current. The previous item becomes `REPLACED`, loses ordinary visibility and enters deletion. A stale Admin view cannot decide a newer request version.

## Dossier, approval and deletion

1. Admin reviews current complete evidence and records `ManualDossierConfirmation` for the current version.
2. Approval preparation records durable intent, freezes version and removes ordinary evidence access.
3. One deletion record per object is processed in bounded batches.
4. Provider delete is followed by absence verification. Missing object is idempotent success.
5. When all are `COMPLETED`, execution becomes `READY_TO_FINALIZE`.
6. Serializable transaction creates typed outcome, final decision/event and `APPROVED`.
7. Failure before step 6 leaves no product outcome and remains recoverable/non-final.

Rejection records `REJECTED` atomically, removes access and starts deletion. Its final product decision does not create access; deletion status remains visible to authorized Admin/owner until complete.

## Bounded recovery

- Worker claims a configured small batch with lease and processes only Feature 006 deletion records.
- Exponential/controlled backoff, five automatic attempts by default.
- Exhaustion sets `RECOVERY_REQUIRED`; no infinite loop.
- Explicit Admin retry creates an audited attempt and is idempotent.
- Orphan sweeper considers only quarantine objects older than configured grace time and cross-checks DB before deletion.
- Shutdown/crash leaves durable records claimable after lease expiry.

## Configuration gates

Startup fails closed when provider root/bucket is public/undefined, encryption expectation is unmet in production, limits/types are empty, scanner is unavailable for upload processing, or deletion retry bounds are invalid. Secrets are environment-managed and never committed.
