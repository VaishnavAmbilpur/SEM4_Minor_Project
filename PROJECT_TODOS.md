# Project TODOs: OpenRouter-Driven Form Autofill Pipeline


Priority ordering: P0 (critical) -> P3 (nice to have)

## P0 - Core API Pipeline

- [ ] Update `src/app/api/process/route.ts` to orchestrate full flow:
  - [ ] receive uploaded image
  - [ ] call OpenRouter image-to-text model
  - [ ] parse required fields + fill coordinates
  - [ ] split into auto-fillable vs missing values
  - [ ] return either `needsUserInput` or `filledForm`
- [ ] Add strict input validation (mime type, size, dimensions) for upload safety.
- [ ] Add stage-level timings (`openrouter_ms`, `mapping_ms`, `fill_ms`, `total_ms`).

## P0 - OpenRouter LLM Extraction Layer

- [ ] Create `src/lib/openrouter.ts` for OpenRouter API calls.
- [ ] Add env config and guards:
  - [ ] `OPENROUTER_API_KEY`
  - [ ] `OPENROUTER_MODEL`
  - [ ] optional timeout and retries
- [ ] Define a strict extraction schema from model output:
  - [ ] field label
  - [ ] canonical key
  - [ ] bounding box (`x`, `y`, `width`, `height`)
  - [ ] confidence
- [ ] Add robust JSON parsing and fallback handling for malformed model responses.

## P1 - Field Mapping and Missing Input Logic

- [ ] Map extracted canonical keys to user profile values from `src/models/user.ts`.
- [ ] Create deterministic merge logic:
  - [ ] `autoFilledFields` (value available)
  - [ ] `missingFields` (value required from user)
- [ ] Ensure response includes coordinate metadata for both groups.
- [ ] Add clear prompt payload format for frontend collection of missing values.

## P1 - Form Filling with Sharp

- [ ] Update `src/lib/imageGenerator.ts` to fill text using extracted coordinates from OpenRouter output.
- [ ] Add text rendering rules (font size, wrapping, overflow clipping by field box).
- [ ] Fill in two passes when needed:
  - [ ] first pass: DB/user-known values
  - [ ] second pass: user-supplied missing values
- [ ] Return downloadable final form image buffer from backend.

## P2 - Frontend Flow Changes

- [ ] Update upload flow in `src/components/UploadDropzone.tsx` for new `/api/process` contract.
- [ ] Update `src/components/MissingFieldsModal.tsx` to render missing fields from API payload.
- [ ] Add submit action to send missing values and coordinates for final fill.
- [ ] Update `src/components/PreviewPanel.tsx` / `src/components/DownloadButton.tsx` for final image handling.

## P2 - API Contract and Docs

- [ ] Define and document `/api/process` response states:
  - [ ] `status: needs_input`
  - [ ] `status: completed`
  - [ ] `status: failed`
- [ ] Include these payload sections:
  - [ ] `extractedFields`
  - [ ] `autoFilledFields`
  - [ ] `missingFields`
  - [ ] `filledImage` (when completed)
  - [ ] `timings`
  - [ ] `requestId`
- [ ] Align `WORKFLOW.md` with this OpenRouter-first architecture.

## P2 - Testing

- [ ] Add unit tests for OpenRouter response parser and schema validator.
- [ ] Add unit tests for field mapping and missing-input splitter.
- [ ] Add integration test for `/api/process`:
  - [ ] complete path (no missing fields)
  - [ ] missing-input path
  - [ ] OpenRouter timeout/error path
- [ ] Add regression tests for coordinate correctness used by Sharp filling.

## P3 - Reliability and Ops

- [ ] Add structured logging for each stage with `requestId`.
- [ ] Add retry strategy with backoff for transient OpenRouter failures.
- [ ] Add benchmark script for small/medium/large forms.
- [ ] Set SLA target (example: P95 < 15s end-to-end).

## Suggested Milestones

- Milestone 1: OpenRouter extraction + parsing integrated.
- Milestone 2: Missing-input loop and Sharp fill complete.
- Milestone 3: Frontend UX, tests, and operational hardening complete.
