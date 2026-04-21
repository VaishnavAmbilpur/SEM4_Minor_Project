# Automated Form Processing System - Target Workflow

This document describes the intended end-to-end application flow based on the latest product requirements, and compares it with what the codebase currently does.

## Target User Flow

### 1. Authentication and user creation
- A user signs up or signs in.
- On sign-up, a user document is created in MongoDB if one does not already exist.
- On sign-in, the existing MongoDB user document is loaded and used as the source of profile data.

### 2. Two-page application structure
- `Home page`: the user uploads a form and completes the autofill flow.
- `Account page`: the user sees all stored data from MongoDB as dynamic key-value pairs, not only a fixed hardcoded subset.

### 3. Form upload and single-pass field recognition
- The user uploads a form image from the home page to `/api/process`.
- The backend validates file type, size, and image dimensions before processing.
- The image is sent to an AI model for a single-pass extraction.
- The AI must identify:
  - Every fillable field (label and bounding box).
  - Optional fields like middle name.
  - The exact `fill_point` (x, y) where the value should be written.

### 4. Build a per-form field mapping object
- The backend creates a form-specific mapping object for the current upload.
- Every detected field gets:
  - a unique `fieldId`
  - the detected field name or label
  - a canonical profile key
  - a required/optional marker
  - label/text coordinates (`labelBox`)
  - fill-space coordinates (`fillPoint`)
  - confidence and matching metadata
- This object becomes the single source of truth for the upload while it moves through extraction, matching, missing-input collection, and final filling.

### 5. Match detected fields against MongoDB profile data
- The backend compares the detected form fields with the user data already stored in MongoDB.
- Matching must be alias-aware and ambiguity-safe.
- Equivalent terms such as `DoB`, `DOB`, `Date of Birth`, and `Birth Date` must resolve to the same canonical key.
- The resolved profile value is copied into the current form mapping object for every confident match.

### 6. Ask the user only for unresolved values
- After matching, the UI should ask the user only for the fields that are still unresolved.
- Required fields and optional fields should both be surfaced, with clear indication of which is which.
- The user should not be asked again for values already found confidently in MongoDB.

### 7. Write user-supplied values back to MongoDB and the form object
- When the user supplies missing values, those values update the current form mapping object immediately.
- The same values are also persisted in MongoDB so future forms can be autofilled.
- Persistence should preserve reliable canonical storage while still retaining the original form field name when useful for traceability.

### 8. High-Precision Alignment Calibration
To solve coordinate drift and Hallucinations, the system applies two layers of calibration:
- **Label-Anchored Snapping**: The vertical position of the text is mathematically anchored to the center of the detected `labelBox`. This ensures text is always perfectly level with its label.
- **Cumulative Manual Shift**: A linear offset (-25px starting, -25px increment per field) is applied to counteract scaling drift in the processing pipeline.

### 9. Fill the image and return it on the home page
- Using the completed mapping object and `sharp`, the backend renders each value into the actual form image using SVG overlays.
- The filled form is returned to the home page for high-resolution preview and download.

## Current Implementation Snapshot

The system is now fully aligned with the target requirements:

- **Two-Page Structure**: Separate home and account pages are implemented.
- **Dynamic Data**: MongoDB profile data is managed via a flexible key-value store.
- **Single-Pass Pipeline**: Unified extraction of labels, bounding boxes, and fill-points.
- **Precision Rendering**: SVG-based rendering with label snapping and cumulative drift correction.
- **Persistence**: Missing values supplied by the user are automatically written back to the database.

### Project Status: 100% Core Alignment
The "What happens now" vs "What should happen" table has been cleared as all P0/P1 items are now implemented in the core pipeline.

## Suggested Data Shape for the Form Mapping Object

```ts
type FormFieldMapping = {
  fieldId: string;
  detectedLabel: string;
  canonicalKey: string;
  originalFormKey: string;
  isOptional: boolean;
  confidence: number;
  labelBox: { x: number; y: number; width: number; height: number };
  fillPoint?: { x: number; y: number };
  value?: string;
  valueSource?: 'database' | 'user_input';
  matchStatus: 'matched' | 'missing' | 'needs_review';
};
```

## API Expectations After Alignment

- `needs_input`: extraction and matching succeeded, but unresolved fields still need user input.
- `completed`: extraction, matching, missing-value collection, sequential fill-point discovery, and rendering succeeded.
- `failed`: validation, extraction, mapping, fill-point detection, or rendering failed.

Recommended payload sections:

- `formFields`
- `resolvedFields`
- `missingFields`
- `filledImage`
- `timings`
- `requestId`

## Notes

- The second AI pass should be isolated per field to reduce hallucination.
- Canonical profile keys should be stable even when the form wording changes.
- MongoDB should remain the long-term memory layer, while the per-upload form mapping object should remain the short-term execution layer.
