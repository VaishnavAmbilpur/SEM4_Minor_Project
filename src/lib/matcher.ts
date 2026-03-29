import { normalizeLabel } from './labelNormalizer';

export interface ExtractedField {
  label: string;
  canonicalKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface AutoFilledField extends ExtractedField {
  value: string;
  source: 'profile' | 'user';
}

export interface MissingField extends ExtractedField {
  reason: 'missing_value';
}

export interface MatchResult {
  autoFilledFields: AutoFilledField[];
  missingFields: MissingField[];
}

function createLookupMap(source: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();

  for (const [rawKey, value] of Object.entries(source)) {
    const normalized = normalizeLabel(rawKey);
    if (!normalized || typeof value !== 'string') continue;

    map.set(normalized, value);
  }

  return map;
}

function candidateKeys(field: ExtractedField): string[] {
  const candidates = new Set<string>();
  candidates.add(normalizeLabel(field.canonicalKey));
  candidates.add(normalizeLabel(field.canonicalKey.replace(/_/g, ' ')));
  candidates.add(normalizeLabel(field.label));

  return [...candidates].filter(Boolean);
}

function resolveValue(
  field: ExtractedField,
  userLookup: Map<string, string>,
  profileLookup: Map<string, string>,
): { value: string; source: 'profile' | 'user' } | null {
  const keys = candidateKeys(field);

  for (const key of keys) {
    if (userLookup.has(key)) {
      return { value: userLookup.get(key) as string, source: 'user' };
    }
  }

  for (const key of keys) {
    if (profileLookup.has(key)) {
      return { value: profileLookup.get(key) as string, source: 'profile' };
    }
  }

  return null;
}

export function matchFields(
  extractedFields: ExtractedField[],
  profileData: Record<string, string>,
  userProvidedData: Record<string, string> = {},
): MatchResult {
  const profileLookup = createLookupMap(profileData);
  const userLookup = createLookupMap(userProvidedData);

  const autoFilledFields: AutoFilledField[] = [];
  const missingFields: MissingField[] = [];

  for (const field of extractedFields) {
    const resolved = resolveValue(field, userLookup, profileLookup);

    if (resolved) {
      autoFilledFields.push({
        ...field,
        value: resolved.value,
        source: resolved.source,
      });
      continue;
    }

    missingFields.push({
      ...field,
      reason: 'missing_value',
    });
  }

  return { autoFilledFields, missingFields };
}
