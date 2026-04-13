const aliasGroups: Record<string, string[]> = {
  name: ['name', 'full name', 'applicant name', 'candidate name'],
  first_name: ['first name', 'given name', 'forename'],
  middle_name: ['middle name', 'middle initial', 'middle'],
  last_name: ['last name', 'surname', 'family name'],
  dob: ['dob', 'date of birth', 'birth date', 'dateofbirth'],
  address: ['address', 'residential address', 'current address', 'home address'],
  email: ['email', 'email address', 'mail id'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number'],
  signature: ['signature', 'sign here', 'applicant signature'],
};

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toSnakeCase(value: string): string {
  return normalizeToken(value).replace(/\s+/g, '_');
}

const aliasToCanonical = new Map<string, string>();

for (const [canonicalKey, aliases] of Object.entries(aliasGroups)) {
  for (const alias of aliases) {
    aliasToCanonical.set(normalizeToken(alias), canonicalKey);
  }

  aliasToCanonical.set(normalizeToken(canonicalKey), canonicalKey);
  aliasToCanonical.set(normalizeToken(canonicalKey.replace(/_/g, ' ')), canonicalKey);
}

export function normalizeLookupKey(value: string): string {
  return normalizeToken(value);
}

export function resolveCanonicalProfileKey(...values: string[]): string {
  for (const value of values) {
    const normalized = normalizeToken(value);
    if (!normalized) continue;

    const aliased = aliasToCanonical.get(normalized);
    if (aliased) {
      return aliased;
    }

    return toSnakeCase(normalized);
  }

  return '';
}

export function humanizeProfileKey(value: string): string {
  const normalized = value.replace(/_/g, ' ').trim();
  if (!normalized) return '';

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isOptionalFieldLabel(label: string): boolean {
  const normalized = normalizeToken(label);
  return /\boptional\b/.test(normalized) || /\bif any\b/.test(normalized);
}
