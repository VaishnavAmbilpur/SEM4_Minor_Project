# Automated Form Processing System - OpenRouter Workflow

This workflow describes the new end-to-end pipeline where OpenRouter performs image-to-text field extraction, the backend identifies missing values, and Sharp fills the final form image.

### 1. Upload Image to Server
The user uploads a form image from the frontend to `/api/process`. The backend validates file type, file size, and image dimensions before processing.

### 2. OpenRouter Image-to-Text Extraction
The backend sends the image to an OpenRouter image-capable model. The model must return structured output for each detected fillable field:
- field label text
- canonical key (for profile mapping)
- bounding box coordinates (`x`, `y`, `width`, `height`)
- confidence

### 3. Build Fill Plan
The backend matches canonical keys with known user profile values from the database.
- If value exists, field moves to `autoFilledFields`.
- If value is missing, field moves to `missingFields` and is returned for user input.

### 4. Missing-Field Loop (If Needed)
If `missingFields` is not empty, the API returns `status: needs_input` with all unresolved fields and coordinate metadata. The frontend displays a form (modal or panel) asking the user for only the missing values.

### 5. Fill Form Using Sharp
Once all required values are available, the backend uses `src/lib/imageGenerator.ts` (Sharp) to render text into the image at the exact coordinates returned by OpenRouter.
- supports database-derived values and user-entered values
- applies text layout constraints (size, wrapping, overflow handling)

### 6. Return Final Image
The API returns `status: completed` with the final filled form image for preview/download, plus processing metadata (timings and request ID).

## API Response States

- `needs_input`: extraction succeeded, but extra user values are required.
- `completed`: extraction and filling succeeded, final image included.
- `failed`: validation, OpenRouter, parsing, or rendering failure.

## Expected `/api/process` Payload Sections

- `extractedFields`
- `autoFilledFields`
- `missingFields`
- `filledImage` (on completed)
- `timings`
- `requestId`

## Notes

- OpenRouter output must be parsed with strict schema validation before use.
- Coordinates should be treated as authoritative fill anchors for Sharp rendering.
- All failures should return actionable errors so frontend can guide users clearly.
