# Performance Report: Form Filling App Lag Analysis

Date: 2026-03-28
Scope: Full codebase review focused on `/api/process` latency and NLP-layer integration needs.

## Executive Summary

The primary bottleneck is OCR in `src/lib/ocr.ts`, not MongoDB, matching, or image generation.

`/api/process` is doing one heavyweight OCR pass per upload using `Tesseract.recognize(...)` with no worker reuse, no pre-processing, and verbose logging. This creates very high cold-start and per-request cost.

A 1-hour response time can happen when:
- Tesseract language/model assets are repeatedly downloaded or delayed by network issues.
- OCR runs on large images without resize/threshold pre-processing.
- CPU is saturated and each request starts fresh OCR internals.
- Excessive OCR logger output slows execution.

## Current `/api/process` Pipeline

File: `src/app/api/process/route.ts`
1. Read uploaded file into buffer.
2. Run OCR: `extractFieldsFromImage(buffer)`.
3. Connect DB and fetch first user profile.
4. Match OCR labels to DB keys.
5. Return detected fields, auto-filled fields, and missing fields.

## Latency Hotspots (Ranked)

### 1) OCR cold-start + per-request heavyweight execution (Critical)

File: `src/lib/ocr.ts`
- Uses `Tesseract.recognize(imageBuffer, 'eng', { logger })` directly.
- No persistent worker/scheduler reuse.
- No OCR timeout or abort strategy.
- No performance instrumentation per stage.

Impact:
- Very high first-run latency.
- High repeated latency under load.
- Can hang for long periods if worker/model initialization is slow.

### 2) No image pre-processing before OCR (High)

File: `src/lib/ocr.ts`
- OCR is run directly on original uploaded image.
- No resize, grayscale, threshold, denoise, rotate correction.

Impact:
- OCR takes significantly longer on high-resolution or noisy forms.
- Accuracy drops, increasing downstream manual effort.

### 3) Verbose OCR logging in hot path (High)

File: `src/lib/ocr.ts`
- `logger: m => console.log(m)` logs many progress events.

Impact:
- Extra CPU and I/O overhead, especially in dev/Windows terminals.
- Slower throughput and noisy logs.

### 4) Missing request-size and OCR-stage timing controls (Medium)

Files: `src/app/api/process/route.ts`, `src/lib/ocr.ts`
- No upload dimension checks after decode.
- No hard timeout guard for OCR step.
- No telemetry for stage durations.

Impact:
- Hard to detect whether delay is OCR init, recognition, or DB.
- Slow/failing requests can block user flow too long.

### 5) Matching is exact-normalization only (Functional Gap, not major latency)

Files: `src/lib/matcher.ts`, `src/lib/labelNormalizer.ts`
- Matching only strips non-alphanumeric and lowercases.
- No semantic categorization of true fillable fields vs headers/static text.

Impact:
- False positives in missing-fields modal.
- Workflow quality issues and unnecessary user inputs.

## What Is NOT the Problem

- MongoDB connection/query path is lightweight and cached in `src/lib/database.ts`.
- `matchFields(...)` complexity is small (`O(n)` over labels + keys).
- `/api/generate` uses Sharp once and is generally fast compared to OCR.

## Root Cause for "1 Hour" Behavior

Most likely combined effect:
1. Tesseract worker/model initialization overhead on each request.
2. Potential language-data download/network delay.
3. Large image OCR without pre-processing.
4. Logging overhead during OCR progress.

This stack can turn expected seconds into many minutes in poor runtime conditions.

## Recommended NLP Layer (After Extraction)

Required by your request and aligned with `WORKFLOW.md`:

Add a post-OCR NLP classification stage:
1. Input: raw OCR `DetectedField[]`.
2. Classify each extracted text into categories:
   - `fillable_field` (should be filled)
   - `instructional_text`
   - `title_or_section`
   - `non_form_noise`
3. Normalize canonical field name (e.g., "Date of Birth" -> `dob`).
4. Confidence score + reason.
5. Only pass `fillable_field` into matcher.

This reduces irrelevant fields and improves modal quality.

## Target Architecture Update

Insert new stage in workflow:
- OCR extraction -> NLP field classification -> DB matching -> Missing fields modal -> Generate image

Proposed modules:
- `src/lib/fieldClassifier.ts` (NLP rules + model adapter)
- `src/lib/types.ts` (shared interfaces, confidence schema)
- `src/lib/metrics.ts` (stage timing helper)

## Quick Wins (1-2 days)

1. Reuse a persistent Tesseract worker/scheduler.
2. Add image pre-processing before OCR (`sharp`: resize max width, grayscale, threshold).
3. Remove/limit OCR progress logging in production.
4. Add stage timings (`ocr_ms`, `db_ms`, `match_ms`) in API response/log.
5. Add 30-60s OCR timeout with graceful error.

## Validation Metrics to Track

- P50/P95 `api/process` total latency.
- OCR-only latency before vs after optimizations.
- Average detected labels per form.
- Precision of fillable-field classification.
- Modal missing-field count reduction.

## Workflow Alignment Check

Current workflow in `WORKFLOW.md` is mostly implemented, but step 3 should be split into:
- 3A: NLP classification of extracted text (new)
- 3B: normalization + DB matching (existing)

This change is required to satisfy your desired behavior (fill only proper form fields).
