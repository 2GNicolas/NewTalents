import type { PassportListResponse, PassportPresentationResponse, PassportStatusResponse } from '../../../src/passport/passport-types';

export const WEB_EXPORT_PASSPORT_FIXTURES: Readonly<{
  list: PassportListResponse;
  status: PassportStatusResponse;
  presentation: PassportPresentationResponse;
}> = Object.freeze({
  list: {
    context: 'PARTICULAR',
    passports: [{ passportId: '77000000-0000-4000-8000-000000000001', displayName: 'Jugador Sintetico', lifecycleState: 'DRAFT', origin: 'PARTICULAR', academyOriginName: null, availableActions: ['VIEW', 'EDIT', 'SUBMIT', 'VIEW_HISTORY'] }],
    collectionActions: ['VIEW_PARTICULAR_SELECTOR', 'CREATE_SELF', 'CREATE_REPRESENTED_MINOR'],
  },
  status: { passportId: '77000000-0000-4000-8000-000000000001', displayName: 'Jugador Sintetico', lifecycleState: 'DRAFT', origin: 'PARTICULAR', academyOriginName: null, availableActions: ['VIEW', 'EDIT', 'SUBMIT', 'VIEW_HISTORY'], version: 1, correctionReason: null, ageSensitiveMutationAvailability: 'AVAILABLE' },
  presentation: {
    passportId: '77000000-0000-4000-8000-000000000001', lifecycleState: 'DRAFT',
    identity: { displayName: 'Jugador Sintetico', primaryPosition: { availability: 'AVAILABLE', value: 'Defensa' }, declaredAgeCategory: { availability: 'AVAILABLE', value: 'Sub-17' }, city: { availability: 'AVAILABLE', value: 'Bogota' }, country: { availability: 'AVAILABLE', value: 'Colombia' }, dominantFoot: { availability: 'AVAILABLE', value: 'Derecha' }, academyOrigin: { availability: 'UNAVAILABLE', value: null }, photograph: { state: 'NEUTRAL_LOCAL_PLACEHOLDER' } },
    sections: [{ section: 'SUMMARY', availability: 'AVAILABLE', dependency: null }, { section: 'STATISTICS', availability: 'FUTURE_DEPENDENCY', dependency: 'STATISTICS_FEM' }, { section: 'MATCHES', availability: 'FUTURE_DEPENDENCY', dependency: 'MATCHES' }, { section: 'VIDEOS', availability: 'FUTURE_DEPENDENCY', dependency: 'AUDIOVISUAL' }],
  },
});
