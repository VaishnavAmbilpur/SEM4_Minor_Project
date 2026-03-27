# Automated Form Processing & Filling System

A complete, production-quality full-stack application that automatically processes uploaded forms, extracts fields using OCR, matches them with stored user data, fills them automatically, and generates a downloadable filled form image.

## Technology Stack
- **Frontend**: Next.js 16, React 18, TypeScript, TailwindCSS, Framer Motion, Lucide React
- **Backend**: Next.js App Router API Routes, Node.js
- **Database**: MongoDB, Mongoose ORM
- **OCR Engine**: Tesseract.js
- **Image Processing**: Sharp

## Prerequisites
- Node.js (v18+)
- MongoDB server running locally or MongoDB Atlas URI

## Setup Instructions

1. **Install Dependencies**
   \`\`\`bash
   npm install
   \`\`\`

2. **Environment Variables**
   Create a \`.env.local\` file in the root directory:
   \`\`\`env
   MONGODB_URI=mongodb://localhost:27017/automated_form_system
   \`\`\`

3. **Database Seeding**
   The application requires some initial profile data to auto-fill the forms. Run the development server and visit the seed API endpoint to insert test data.
   \`\`\`bash
   npm run dev
   \`\`\`
   Navigate to [http://localhost:3000/api/seed](http://localhost:3000/api/seed) to seed the database with test user "John Doe".

4. **Testing the App**
   The project includes a generated test form located at \`public/test-form.png\`.
   - Go to [http://localhost:3000](http://localhost:3000)
   - Upload \`public/test-form.png\`
   - The AI will extract the text, match "Name", "Date of Birth", "Phone Number", and "Address" from the database.
   - It will prompt you a Missing Fields modal for the "Signature" field which is not in the database.
   - Click "Complete Form" to generate and download the filled image.

## Project Structure
- \`src/app\`: Main Next.js application & API routes.
  - \`/api/process\`: OCR extraction & field matching logic.
  - \`/api/generate\`: Form filling and rasterization logic.
  - \`/api/seed\`: Database testing prep.
- \`src/components\`: Reusable UI elements (UploadDropzone, ProcessingLoader, MissingFieldsModal, PreviewPanel, DownloadButton).
- \`src/lib\`: Core utilities (\`ocr.ts\`, \`matcher.ts\`, \`labelNormalizer.ts\`, \`imageGenerator.ts\`, \`database.ts\`).
- \`src/models\`: Mongoose schemas (\`user.ts\`).

