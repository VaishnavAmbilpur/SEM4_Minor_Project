import { extractFieldsWithOpenRouter } from './openrouter';

export interface DetectedField {
  label: string;
  canonicalKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export async function extractFieldsFromImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<DetectedField[]> {
  return extractFieldsWithOpenRouter(imageBuffer, mimeType);
}
