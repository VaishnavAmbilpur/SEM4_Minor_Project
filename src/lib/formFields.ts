import { randomUUID } from 'crypto';
import type { FormFieldMapping, DetectedFormField } from './formTypes';
import { humanizeProfileKey, resolveCanonicalProfileKey, normalizeLookupKey } from './profileKeys';

interface LookupEntry {
  originalKey: string;
  value: string;
}

function createLookup(source: Record<string, string>): Map<string, LookupEntry[]> {
  const map = new Map<string, LookupEntry[]>();

  for (const [originalKey, rawValue] of Object.entries(source)) {
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (!value) continue;

    const canonical = resolveCanonicalProfileKey(originalKey);
    if (!canonical) continue;

    const current = map.get(canonical) ?? [];
    current.push({ originalKey, value });
    map.set(canonical, current);
  }

  return map;
}

function uniqueValues(entries: LookupEntry[]): string[] {
  return [...new Set(entries.map((entry) => entry.value.trim()).filter(Boolean))];
}

function resolveFieldValue(
  field: FormFieldMapping,
  userLookup: Map<string, LookupEntry[]>,
  profileLookup: Map<string, LookupEntry[]>,
): FormFieldMapping {
  const canonicalKey = resolveCanonicalProfileKey(
    field.canonicalKey,
    field.originalFormKey,
    field.detectedLabel,
  );

  const nextField: FormFieldMapping = {
    ...field,
    canonicalKey,
    originalFormKey: field.originalFormKey || field.detectedLabel || humanizeProfileKey(canonicalKey),
    matchCandidates: [],
    matchedProfileKey: undefined,
    value: undefined,
    valueSource: undefined,
    matchStatus: 'missing',
  };

  const userEntries = userLookup.get(canonicalKey) ?? [];
  const userValues = uniqueValues(userEntries);
  if (userValues.length > 1) {
    return {
      ...nextField,
      matchStatus: 'needs_review',
      matchCandidates: userEntries.map((entry) => entry.originalKey),
    };
  }

  if (userValues.length === 1) {
    return {
      ...nextField,
      value: userValues[0],
      valueSource: 'user_input',
      matchStatus: 'matched',
      matchedProfileKey: userEntries[0]?.originalKey ?? canonicalKey,
      matchCandidates: userEntries.map((entry) => entry.originalKey),
    };
  }

  const profileEntries = profileLookup.get(canonicalKey) ?? [];
  const profileValues = uniqueValues(profileEntries);
  if (profileValues.length > 1) {
    return {
      ...nextField,
      matchStatus: 'needs_review',
      matchCandidates: profileEntries.map((entry) => entry.originalKey),
    };
  }

  if (profileValues.length === 1) {
    return {
      ...nextField,
      value: profileValues[0],
      valueSource: 'database',
      matchStatus: 'matched',
      matchedProfileKey: profileEntries[0]?.originalKey ?? canonicalKey,
      matchCandidates: profileEntries.map((entry) => entry.originalKey),
    };
  }

  return nextField;
}

export function createFormFields(detectedFields: DetectedFormField[]): FormFieldMapping[] {
  return detectedFields.map((field) => ({
    fieldId: randomUUID(),
    detectedLabel: field.detectedLabel,
    canonicalKey: resolveCanonicalProfileKey(field.canonicalKey, field.originalFormKey, field.detectedLabel),
    originalFormKey: field.originalFormKey || field.detectedLabel,
    isOptional: field.isOptional,
    confidence: field.confidence,
    labelBox: field.labelBox,
    fillPoint: field.fillPoint,
    fillPointSource: field.fillPoint ? 'ai' : undefined,
    matchedProfileKey: undefined,
    matchCandidates: [],
    matchStatus: 'missing',
    value: undefined,
    valueSource: undefined,
  }));
}

export function rehydrateFormFields(formFields: FormFieldMapping[]): FormFieldMapping[] {
  return formFields.map((field) => ({
    ...field,
    canonicalKey: resolveCanonicalProfileKey(field.canonicalKey, field.originalFormKey, field.detectedLabel),
    originalFormKey: field.originalFormKey || field.detectedLabel || humanizeProfileKey(field.canonicalKey),
    matchCandidates: Array.isArray(field.matchCandidates) ? field.matchCandidates : [],
  }));
}

export function classifyFormFields(
  formFields: FormFieldMapping[],
  profileData: Record<string, string>,
  userProvidedData: Record<string, string>,
) {
  const profileLookup = createLookup(profileData);
  const userLookup = createLookup(userProvidedData);

  const resolvedFields: FormFieldMapping[] = [];
  const missingFields: FormFieldMapping[] = [];

  const nextFields = formFields.map((field) => {
    const resolved = resolveFieldValue(field, userLookup, profileLookup);

    if (resolved.matchStatus === 'matched' && resolved.value) {
      resolvedFields.push(resolved);
    } else {
      missingFields.push(resolved);
    }

    return resolved;
  });

  return {
    formFields: nextFields,
    resolvedFields,
    missingFields,
  };
}

export function buildPersistencePatch(formFields: FormFieldMapping[]): Record<string, string> {
  const patch: Record<string, string> = {};

  for (const field of formFields) {
    const value = field.value?.trim();
    if (!value || field.valueSource !== 'user_input') continue;

    const canonicalKey = resolveCanonicalProfileKey(field.canonicalKey, field.originalFormKey, field.detectedLabel);
    if (canonicalKey) {
      patch[canonicalKey] = value;
    }

    const originalKey = normalizeLookupKey(field.originalFormKey);
    if (originalKey && originalKey !== normalizeLookupKey(canonicalKey)) {
      patch[field.originalFormKey] = value;
    }
  }

  return patch;
}
