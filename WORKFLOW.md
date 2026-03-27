# Automated Form Processing System - Workflow

Here is a step-by-step breakdown of how the Automated Form Processing System works under the hood from start to finish:

### 1. Document Upload (Frontend)
The workflow starts in the frontend (`UploadDropzone.tsx`). A user drops a blank or partially filled form image into the application. The image is converted into base64 or a buffer and sent to the backend processing API.

### 2. OCR Text & Field Extraction (`/api/process`)
Once the image reaches the backend, our OCR utility (`src/lib/ocr.ts`) kicks in. It uses **Tesseract.js** to scan the image and identify:
- The text labels on the form (e.g., "First Name:", "Date of Birth:").
- The exact geometrical bounding boxes (x, y, width, height) of where those labels exist so we know exactly *where* to fill in the data later.

### 3. Data Normalization & Matching (`src/lib/matcher.ts`)
The system takes the raw OCR text (which might be messy, like "F1rst Nam:" instead of "First Name") and passes it through a **Label Normalizer**. 
It then cross-references these cleaned-up field names with a user's profile stored in **MongoDB** (`src/models/user.ts`). For example, if it detects a "Phone Number" field on the form, it pulls the user's phone number from the database.

### 4. Handling Missing Data (Frontend Modal)
The backend responds to the frontend with two lists:
- **Matched Fields**: Data that was successfully found in the database.
- **Unmatched/Missing Fields**: Fields that were detected on the form but don't exist in the database (e.g., a "Signature" or "Today's Date" field).

The frontend displays a `MissingFieldsModal`, prompting the user to manually enter the missing information before proceeding.

### 5. Form Generation & Rasterization (`/api/generate`)
Once all fields have data attached to them, the frontend sends a final payload back to the server. The **Image Generator** (`src/lib/imageGenerator.ts`) uses **Sharp** (a high-performance Node.js image processing library) to:
- Take the original blank image as a base layer.
- Render the text (from the database and user input) at the exact `(x, y)` coordinates detected during the OCR phase.
- Composite (draw) the text seamlessly onto the image.

### 6. Final Output
The customized, filled-out form is returned to the frontend as a downloadable image file, completing the automation loop!
