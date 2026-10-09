export type AdministratorRecordKind = 'Expediente' | 'Solicitud' | 'Pasaporte';

export function readableRecordName(kind: AdministratorRecordKind, displayLabel: string): string {
  const label = displayLabel.trim();
  return new RegExp(`^${kind}\\b`, 'i').test(label) ? label : `${kind} de ${label}`;
}
