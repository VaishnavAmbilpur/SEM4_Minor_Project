import Tesseract from 'tesseract.js';

export interface DetectedField {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function extractFieldsFromImage(imageBuffer: Buffer): Promise<DetectedField[]> {
  const result = await Tesseract.recognize(
    imageBuffer,
    'eng',
    { logger: m => console.log(m) }
  );

  // Bypass incorrect type definitions by using a type assertion
  const lines = (result.data as any).lines || [];
  const detectedFields: DetectedField[] = [];

  for (const line of lines) {
    const text = line.text.trim();
    if (text.length > 2) {
      detectedFields.push({
        label: text,
        x: line.bbox.x0,
        y: line.bbox.y0,
        width: line.bbox.x1 - line.bbox.x0,
        height: line.bbox.y1 - line.bbox.y0
      });
    }
  }

  return detectedFields;
}
