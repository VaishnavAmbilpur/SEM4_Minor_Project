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

### 3. Form upload and field recognition
- The user uploads a form image from the home page to `/api/process`.
- The backend validates file type, size, and image dimensions before processing.
- The image is sent to an AI model for field recognition.
- The AI must identify every fillable field, including optional fields such as middle name.
- For each field, the AI must return the coordinates of the field text or label region that identifies the field, not the blank space where the value will later be written.

### 4. Build a per-form field mapping object
- The backend creates a form-specific mapping object for the current upload.
- Every detected field gets:
  - a unique `fieldId`
  - the detected field name or label
  - a canonical profile key
  - a required/optional marker
  - label/text coordinates from the first AI pass
  - a placeholder for later fill-space coordinates
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

### 8. Second AI pass to locate the blank write area
- Once the form mapping object has values for every field that should be filled, each field is processed one by one.
- For each field, the system sends the field label, field value, and label/text coordinates to an AI model.
- The model returns the correct `x` and `y` location of the blank space where the value should be written.
- This second pass must happen sequentially, field by field, to reduce hallucination and cross-field confusion.

### 9. Update the form mapping object with fill coordinates
- The field object is updated with the blank-space coordinates returned by the second AI pass.
- The final field entry now contains both:
  - label/text coordinates from recognition
  - fill-space coordinates for rendering

### 10. Fill the image and return it on the home page
- Using the completed mapping object and `sharp`, the backend renders each value into the actual form image.
- The filled form is returned to the home page for preview and download.

## Current Implementation Snapshot

The current codebase already supports part of the pipeline:

- Users can register and log in, and a MongoDB user document is created on registration.
- `/api/process` is protected and uses the authenticated user profile as input data.
- The app currently uses a single dashboard page in [src/app/page.tsx](/C:/D/DEV/Github%20Repos/SEM4_Minor_Project/src/app/page.tsx) that combines account editing and upload.
- OpenRouter extraction currently returns `label`, `canonicalKey`, `x`, `y`, `width`, `height`, and `confidence`.
- The matcher normalizes labels and tries to match extracted fields against stored profile data and user-supplied values.
- If values are missing, a modal asks the user for those fields.
- Sharp renders text into the image and the completed image is returned for download.

## Current vs Required Improvements

| Area | What happens now | What should happen |
| --- | --- | --- |
| App structure | One page combines account and upload flow. | Split into two pages: home upload page and separate account page. |
| Account data view | The UI shows a fixed set of profile inputs (`name`, `dob`, `address`, `email`, `phone`). | Show all MongoDB-stored key-value pairs dynamically. |
| Field extraction result | The extraction payload does not include `fieldId`, optional/required status, or second-pass fill coordinates. | Create a full field mapping object with IDs, required/optional flags, label coordinates, fill coordinates, and status metadata. |
| Label vs fill coordinates | The current render step uses the coordinates from the first extraction pass directly for writing text. | The first pass should capture label/text coordinates only; a second AI pass should locate the blank writing area. |
| Optional fields | Optional fields are not modeled separately. | Optional fields such as middle name must still be identified and surfaced clearly. |
| Ambiguity-safe matching | Matching mainly depends on normalized text equality and candidate labels. | Introduce canonical alias dictionaries and conflict handling so synonyms map safely without ambiguity. |
| Missing field UX | The modal asks for unresolved fields, but it does not distinguish required vs optional fields. | Ask only for unresolved fields and clearly mark required vs optional inputs. |
| Database write-back | User-entered missing values are used to finish the current request, but they are not persisted back to MongoDB in `/api/process`. | Persist user-entered answers so future forms can reuse them. |
| Sequential per-field AI fill placement | Not implemented. | Call the AI one field at a time to find the correct blank-space coordinates. |
| Final fill object | The backend builds arrays for `autoFilledFields` and `missingFields`, but not a durable per-upload form object. | Maintain a single form object that tracks every field across extraction, matching, prompting, fill-coordinate discovery, and rendering. |

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
