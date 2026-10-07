import { dossierLinkedRoute, dossierReturnTarget } from './dossier-linked-navigation';

describe('dossier-linked navigation', () => {
  it('carries the originating dossier into request and passport links', () => {
    expect(dossierLinkedRoute('request', 'request-1', 'dossier-1')).toEqual({
      pathname: '/(admin)/admin/registration/[requestId]',
      params: { requestId: 'request-1', returnDossierId: 'dossier-1' },
    });
    expect(dossierLinkedRoute('passport', 'passport-1', 'dossier-1')).toEqual({
      pathname: '/(admin)/admin/custody/[passportId]',
      params: { passportId: 'passport-1', returnDossierId: 'dossier-1' },
    });
  });

  it('resolves contextual back navigation to the originating dossier', () => {
    expect(dossierReturnTarget('dossier-1')).toEqual({
      pathname: '/(admin)/admin/dossiers/[dossierId]',
      params: { dossierId: 'dossier-1' },
    });
    expect(dossierReturnTarget('')).toBeUndefined();
  });
});
