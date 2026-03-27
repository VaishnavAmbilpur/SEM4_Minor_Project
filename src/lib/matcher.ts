import { normalizeLabel } from './labelNormalizer';

export interface MatchResult {
  autoFilled: Record<string, string>;
  missingFields: string[];
}

export function matchFields(detectedLabels: string[], dbData: Record<string, string>): MatchResult {
  const autoFilled: Record<string, string> = {};
  const missingFields: string[] = [];

  const normalizedDb = new Map<string, string>(); 
  for (const key of Object.keys(dbData)) {
    normalizedDb.set(normalizeLabel(key), key);
  }

  for (const label of detectedLabels) {
    const normalizedDetected = normalizeLabel(label);
    
    if (normalizedDb.has(normalizedDetected)) {
      const originalDbKey = normalizedDb.get(normalizedDetected)!;
      autoFilled[originalDbKey] = dbData[originalDbKey];
    } else {
      missingFields.push(label);
    }
  }

  return { autoFilled, missingFields };
}
