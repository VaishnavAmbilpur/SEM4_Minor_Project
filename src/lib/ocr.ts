import { extractFieldsWithAI } from './ai';
import type { DetectedFormField } from './formTypes';

export async function extractFieldsFromImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<DetectedFormField[]> {
  return extractFieldsWithAI(imageBuffer, mimeType);
}
