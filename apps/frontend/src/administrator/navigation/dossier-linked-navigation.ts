export type DossierReturnTarget = Readonly<{
  pathname: '/(admin)/admin/dossiers/[dossierId]';
  params: Readonly<{ dossierId: string }>;
}>;

export function dossierReturnTarget(dossierId?: string): DossierReturnTarget | undefined {
  const normalized = dossierId?.trim();
  return normalized ? { pathname: '/(admin)/admin/dossiers/[dossierId]', params: { dossierId: normalized } } : undefined;
}

export function dossierLinkedRoute(kind: 'request' | 'passport', id: string, dossierId: string) {
  return kind === 'request'
    ? { pathname: '/(admin)/admin/registration/[requestId]' as const, params: { requestId: id, returnDossierId: dossierId } }
    : { pathname: '/(admin)/admin/custody/[passportId]' as const, params: { passportId: id, returnDossierId: dossierId } };
}
