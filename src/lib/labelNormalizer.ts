export function normalizeLabel(label: string): string {
  if (!label) return "";
  return label.toLowerCase().replace(/[^a-z0-9]/g, '');
}
