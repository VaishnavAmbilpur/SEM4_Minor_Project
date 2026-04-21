# Automated Form Processing & Filling System

A complete, production-quality full-stack application that automatically processes uploaded forms, extracts fields using state-of-the-art vision AI, matches them with stored user data, requests only missing field info from users, cleanly identifies placement areas, and generates a downloadable filled form image.

## Technology Stack
- **Frontend**: Next.js 16, React 19, TypeScript, TailwindCSS, Framer Motion, Lucide React
- **Backend**: Next.js App Router API Routes, Node.js
- **Database**: MongoDB, Mongoose ORM
- **AI & Vision Engine**: Google GenAI (Gemini 1.5 Flash/Pro) for unified single-pass field extraction and high-precision fill-point localization
- **Calibration Engine**: Deterministic Label-Anchored Snapping & Cumulative Drift Correction for pixel-perfect document filling
- **Image Processing**: Sharp

## Prerequisites
- Node.js (v18+)
- MongoDB server running locally or MongoDB Atlas URI
- Gemini API Key

## Setup Instructions

1. **Install Dependencies**
   
pm install

2. **Environment Variables**
   Create a .env.local file in the root directory:
   `env
   MONGODB_URI=mongodb://localhost:27017/automated_form_system
   GEMINI_API_KEY=your_gemini_api_key_here
   `

3. **Setting Up User Data**
   The application requires initial profile data to auto-fill uploaded forms. Run the development server:
   ```bash
   npm run dev
   ```
   - Go to [http://localhost:3000](http://localhost:3000).
   - Sign up for a new account or log in.
   - Navigate to the **Account** workspace (\/account\).
   - Create profile fields like "DOB", "Address", "Phone Number", etc. The app uses these flexible key-value maps to auto-fill the document fields safely using canonical aliases.

4. **Testing the App**
   The project includes a generated test form located at `/public/test-form.png`.
   - Go back to the Home page [http://localhost:3000](http://localhost:3000).
   - Upload `/public/test-form.png`.
   - **Single-Pass Extraction**: The AI extracts labels, bounding boxes, and fill-points in one go.
   - **Identity Matching**: The app automatically maps them using your backend profile data via canonical alias resolution.
   - **User Input**: Any unresolved fields (e.g., "Signature") are surfaced in a modal. User inputs are automatically written back to MongoDB!
   - **Calibrated Rendering**: Click to complete. The system applies **Label-Anchored Snapping** and **Cumulative Drift Correction** to generate a pixel-perfect filled image for download.

## Project Structure
- \src/app\: Main Next.js application & API routes.
  - \/account\: The interactive dashboard to manage user profile key-values.
  - \/api/auth\: Login, logout, registration, and user data routes.
  - `/api/process`: Unified backend procedure handling form validation, single-pass AI field extraction, recursive profile matching, and sharp-based rasterization with alignment calibration.
  - \/api/seed\: Optional test endpoint to populate a dummy profile via a POST request.
- \src/components\: Reusable UI elements (\UploadDropzone\, \ProcessingLoader\, \MissingFieldsModal\, \PreviewPanel\, \AccountPageClient\).
- \src/lib\: Core AI & process utilities (\ai.ts\, \ocr.ts\, \matcher.ts\, \auth.ts\, \imageGenerator.ts\, \database.ts\).
- \src/models\: Mongoose schemas (\user.ts\).
