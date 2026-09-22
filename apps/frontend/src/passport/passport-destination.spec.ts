import { getPassportDestination } from './passport-destination';
import type { PassportSummaryResponse } from './passport-types';
const passport = (lifecycleState: PassportSummaryResponse['lifecycleState']): PassportSummaryResponse => ({ passportId: '44444444-4444-4444-8444-444444444444', displayName: 'Jugador', lifecycleState, origin: 'PARTICULAR', academyOriginName: null, availableActions: [] });
describe('passport visual destination', () => {
  it.each(['DRAFT', 'IN_REVIEW', 'RETURNED_FOR_CORRECTION', 'APPROVED', 'ACTIVE'] as const)('opens %s in Resumen with technical state secondary', state => { expect(getPassportDestination(passport(state))).toEqual({ href: '/passports/44444444-4444-4444-8444-444444444444/sections/resumen', label: 'Ver pasaporte' }); });
});
