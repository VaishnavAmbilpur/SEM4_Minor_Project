import { extractFieldsWithOpenRouter } from './openrouter';
import type { DetectedFormField } from './formTypes';

export async function extractFieldsFromImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<DetectedFormField[]> {
  return extractFieldsWithOpenRouter(imageBuffer, mimeType);
}
