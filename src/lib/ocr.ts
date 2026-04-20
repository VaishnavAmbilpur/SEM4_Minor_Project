import { extractFieldsWithAI } from './ai';
import type { DetectedFormField } from './formTypes';

export async function extractFieldsFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  existingKeys: string[] = [],
): Promise<DetectedFormField[]> {
  return extractFieldsWithAI(imageBuffer, mimeType, existingKeys);
}
