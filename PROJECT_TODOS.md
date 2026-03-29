# Project TODOs: Fix `/api/process` Latency + Add NLP Field Layer

Date: 2026-03-28
Priority ordering: P0 (critical) -> P3 (nice to have)

## P0 - Stabilize `/api/process` Runtime

- [ ] Add stage-level timing metrics in `src/app/api/process/route.ts` (`ocr_ms`, `db_ms`, `match_ms`, `total_ms`).
- [ ] Add OCR timeout (AbortController/guard) to prevent extreme waits.
- [ ] Reduce OCR logger noise (`console.log`) or gate by env variable.
- [ ] Return actionable error when OCR exceeds timeout (not generic 500).

## P0 - Optimize OCR Throughput

- [ ] Refactor `src/lib/ocr.ts` to use a reused Tesseract worker/scheduler instead of one-shot heavy recognize path.
- [ ] Add image pre-processing pipeline with `sharp` before OCR:
  - [ ] resize to bounded width
  - [ ] grayscale
  - [ ] contrast/threshold tune
  - [ ] optional denoise/deskew
- [ ] Add limits for oversized dimensions and reject impossible inputs early.

## P1 - Add NLP Field Classification Layer (New Requirement)

- [ ] Add OpenRouter API-backed LLM layer for semantic field classification/normalization.
- [ ] Create `src/lib/fieldClassifier.ts`.
- [ ] Define field categories:
  - [ ] `fillable_field`
  - [ ] `instructional_text`
  - [ ] `title_or_section`
  - [ ] `non_form_noise`
- [ ] Add canonical key mapping (`full name` -> `name`, `date of birth` -> `dob`, etc.).
- [ ] Add confidence score and reason per classification.
- [ ] Integrate into `src/app/api/process/route.ts`:
  - [ ] run classifier after OCR
  - [ ] pass only `fillable_field` labels to matcher
  - [ ] return discarded labels for debugging

## P1 - Upgrade Matching Logic

- [ ] Extend `src/lib/matcher.ts` to consume canonical keys from classifier.
- [ ] Support fuzzy fallback for OCR typo tolerance (thresholded similarity).
- [ ] Add deterministic tie-breaking rules and confidence thresholds.

## P2 - Workflow and API Contract Updates

- [ ] Update `WORKFLOW.md` with explicit NLP stage between OCR and matching.
- [ ] Update API response schema of `/api/process`:
  - [ ] `detectedFieldsRaw`
  - [ ] `classifiedFields`
  - [ ] `fillableFields`
  - [ ] `autoFilled`
  - [ ] `missingFields`
  - [ ] `timings`
- [ ] Add backward-compatible handling in frontend if payload evolves.

## P2 - Frontend UX for Slow Processing

- [ ] Update `src/components/ProcessingLoader.tsx` to show stage progress text (OCR, Classification, Matching).
- [ ] Add elapsed-time indicator and cancellation affordance.
- [ ] Show clear error guidance when OCR times out.

## P2 - Test Coverage

- [ ] Add unit tests for `normalizeLabel`, `matcher`, and new `fieldClassifier`.
- [ ] Add integration test for `/api/process` happy-path and timeout-path.
- [ ] Add regression test to ensure non-fillable text is excluded from `missingFields`.

## P3 - Operational Hardening

- [ ] Add request ID and structured logs for tracing slow runs.
- [ ] Add benchmark script with representative forms (small/medium/large).
- [ ] Define SLA target (example: P95 < 12s for 4MP image).
- [ ] Document deployment recommendations (CPU/memory sizing for OCR).

## Suggested Milestones

- Milestone 1: P0 latency stabilization complete.
- Milestone 2: NLP classifier integrated and matcher updated.
- Milestone 3: Frontend/status UX + tests + workflow/docs finalized.
