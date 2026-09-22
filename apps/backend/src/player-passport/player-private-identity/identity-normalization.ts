export function normalizeIdentityText(value: string): string {
  if (typeof value !== 'string') {
    throw new Error('Invalid identity input');
  }
  const normalized = value.normalize('NFC').trim().replace(/\s+/g, ' ').toUpperCase();
  if (normalized.length === 0) {
    throw new Error('Invalid identity input');
  }
  return normalized;
}

export function normalizeLegalName(value: string): string {
  return normalizeIdentityText(value);
}

export function normalizeDocumentType(value: string): string {
  return normalizeIdentityText(value);
}

export function normalizeDocumentNumber(value: string): string {
  return normalizeIdentityText(value);
}

export function normalizeDateOfBirth(value: string): string {
  if (typeof value !== 'string') {
    throw new Error('Invalid identity input: dateOfBirth');
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('Invalid identity input: dateOfBirth');
  }
  return trimmed;
}
