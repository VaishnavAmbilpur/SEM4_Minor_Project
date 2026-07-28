# Project TODOs: Required Alignment for the Full Form Autofill Flow

Priority ordering: P0 (critical) -> P3 (nice to have)

## Current State Summary

- Authentication exists and MongoDB user creation already happens on registration.
- `/api/process` already validates uploads, extracts fields with Gemini, matches against profile data, and returns a completed image or a missing-fields modal.
- The current UI is still a single page, not the required two-page flow.
- The current extraction response does not create a durable field object with IDs, optional flags, or second-pass fill coordinates.
- User-supplied missing values are not written back to MongoDB during form completion.
- The rendering step writes into the coordinates from the first extraction pass instead of doing a second AI pass to find the blank write area.

## P0 - App Flow and Data Model Alignment

- [ ] Split the app into two pages:
  - [ ] `src/app/page.tsx` should stay the home upload/download flow.
  - [ ] create `src/app/account/page.tsx` for account data display and profile editing.
- [ ] Replace the current fixed profile UI with a dynamic key-value view of all data stored in MongoDB.
- [ ] Introduce a per-upload `formFields` object/array as the single source of truth for the active form.
- [ ] Give every detected field a unique `fieldId`.
- [ ] Expand the field schema to include:
  - [ ] `fieldId`
  - [ ] detected field label
  - [ ] canonical key
  - [ ] original form key
  - [ ] required vs optional flag
  - [ ] first-pass label/text coordinates
  - [ ] second-pass blank-space coordinates
  - [ ] resolved value
  - [ ] value source
  - [ ] match status

## P0 - First AI Pass: Field Recognition

- [ ] Update `src/lib/ai.ts` prompt and schema so the first AI pass returns the coordinates of the field text/label region, not the whitespace where text will be filled.
- [ ] Ensure the extraction response explicitly identifies optional fields such as middle name.
- [ ] Tighten schema validation so malformed or partial field objects are rejected early.
- [ ] Update `src/app/api/process/route.ts` to store first-pass results in the new `formFields` structure instead of only `extractedFields`.

## P0 - Deterministic Field Matching

- [ ] Replace simple normalization-only matching with canonical alias resolution.
- [ ] Add a shared mapping dictionary for equivalent terms such as:
  - [ ] `dob`
  - [ ] `date_of_birth`
  - [ ] `birth_date`
  - [ ] `phone`
  - [ ] `phone_number`
- [ ] Add ambiguity handling when multiple stored keys could map to the same detected field.
- [ ] Mark uncertain matches as `needs_review` instead of silently autofilling the wrong value.

## P0 - Missing Field Collection and Persistence

- [ ] Return only unresolved fields to the frontend after matching.
- [ ] Distinguish required and optional fields in the missing-fields response.
- [ ] Update `src/components/MissingFieldsModal.tsx` so the UI clearly labels optional vs required values.
- [ ] When the user submits missing values:
  - [ ] update the in-memory `formFields` object
  - [ ] persist the answer to MongoDB
  - [ ] preserve canonical storage for future reuse
  - [ ] keep the original form field label when useful for traceability

## P0 - Second AI Pass: Blank-Space Coordinate Detection

- [ ] Add a second AI step after all field values are known.
- [ ] Process fields one by one to reduce hallucination.
- [ ] For each field, send:
  - [ ] field label
  - [ ] resolved value
  - [ ] first-pass label/text coordinates
  - [ ] relevant image context
- [ ] Store the returned blank-space `x` and `y` coordinates back into the `formFields` object.
- [ ] Add guardrails so impossible coordinates or out-of-bounds points are rejected.

## P1 - Final Rendering and Download Flow

- [ ] Update `src/lib/imageGenerator.ts` to render using second-pass fill coordinates, not first-pass label coordinates.
- [ ] Decide whether each field needs:
  - [ ] a point anchor
  - [ ] a box anchor
  - [ ] multiline wrapping
- [ ] Keep the completed download experience on the home page after rendering succeeds.
- [ ] Return the filled image together with the finalized `formFields` object for debugging and auditability.

## P1 - API Contract Updates

- [ ] Redesign `/api/process` around the new lifecycle:
  - [ ] upload and validate image
  - [ ] first AI pass extracts fields and label coordinates
  - [ ] backend matches values from MongoDB
  - [ ] frontend collects only unresolved inputs
  - [ ] backend persists submitted values
  - [ ] second AI pass finds blank write coordinates per field
  - [ ] Sharp renders final image
- [ ] Update response payloads to prefer:
  - [ ] `formFields`
  - [ ] `resolvedFields`
  - [ ] `missingFields`
  - [ ] `filledImage`
  - [ ] `timings`
  - [ ] `requestId`
- [ ] Preserve response states:
  - [ ] `needs_input`
  - [ ] `completed`
  - [ ] `failed`

## P2 - Frontend UX Follow-Through

- [ ] Refactor the authenticated experience so account management is not mixed into the upload workflow.
- [ ] Add an account page section that lists every stored DB key-value pair, not just editable hardcoded fields.
- [ ] Show the user which values were:
  - [ ] matched from the database
  - [ ] entered manually
  - [ ] unresolved or ambiguous
- [ ] Consider showing a lightweight per-field status view for the active form object.

## P2 - Testing

- [ ] Add unit tests for first-pass extraction schema validation.
- [ ] Add unit tests for alias matching and ambiguity handling.
- [ ] Add unit tests for persistence of user-entered missing values back into MongoDB.
- [ ] Add unit tests for second-pass fill-coordinate validation.
- [ ] Add integration tests for `/api/process`:
  - [ ] no missing fields path
  - [ ] missing required fields path
  - [ ] optional field present path
  - [ ] ambiguous alias path
  - [ ] second-pass coordinate failure path

## P3 - Reliability and Observability

- [ ] Add stage-level timings for:
  - [ ] first AI extraction
  - [ ] matching
  - [ ] missing-value persistence
  - [ ] second AI fill-point detection
  - [ ] Sharp rendering
  - [ ] total request time
- [ ] Add structured logs with `requestId` and `fieldId`.
- [ ] Add retries/backoff only where AI failures are safe to retry.
- [ ] Add benchmark coverage for small, medium, and large forms.

## Suggested Milestones

- Milestone 1: Two-page app structure and dynamic account data view.
- Milestone 2: Durable `formFields` object with IDs, optional flags, and deterministic matching.
- Milestone 3: Missing-value persistence to MongoDB and improved unresolved-field UX.
- Milestone 4: Second AI pass for blank-space coordinates and Sharp rendering update.
- Milestone 5: Tests, logging, and hardening.
