import { createPassportApi } from '../../src/passport/passport-api';
import { PassportStateMachine } from '../../src/passport/passport-state';
import type { CreateDraftInput, PassportApiResult, PassportStatusResponse } from '../../src/passport/passport-types';
import { WEB_EXPORT_PASSPORT_FIXTURES } from './fixtures/web-export-passport.fixture';

const PRIVATE = {
  documentType: 'T106-DOCUMENT-TYPE', documentNumber: 'T106-DOCUMENT-NUMBER', birthDate: '2008-09-21', representativeFact: 'T106-REPRESENTATIVE-CONFIRMATION',
  contact: 'T106-CONTACT@example.test', accessToken: 'T106-ACCESS-TOKEN', refreshToken: 'T106-REFRESH-TOKEN', preciseLocation: '4.6097,-74.0817', media: 'https://media.example.test/t106-player.jpg',
} as const;
const passportId = '77000000-0000-4000-8000-000000000001';
const status: PassportStatusResponse = { passportId, displayName: 'Jugador Sintetico', lifecycleState: 'DRAFT', origin: 'PARTICULAR', academyOriginName: null, availableActions: ['EDIT', 'SUBMIT', 'VIEW_HISTORY'], version: 1, correctionReason: null, ageSensitiveMutationAvailability: 'AVAILABLE' };
const privateDraft: CreateDraftInput = { managementContext: 'SELF', playerLegalName: 'Nombre privado T106', dateOfBirth: PRIVATE.birthDate, playerDocument: { documentType: PRIVATE.documentType, documentNumber: PRIVATE.documentNumber }, footballProfile: { primaryPosition: 'Defensa', declaredAgeCategory: 'Mayores', city: 'Bogota', country: 'Colombia', dominantFoot: 'RIGHT' } };

function serialized(value: unknown) { return JSON.stringify(value); }
function expectNoPrivateValues(value: unknown) { const output = serialized(value); for (const secret of Object.values(PRIVATE)) expect(output).not.toContain(secret); }

describe('T106 frontend diagnostic and web-export fixture secret safety', () => {
  it('discards protected backend diagnostics and rejected-request details', async () => {
    const diagnostic = { code: 'passport_not_found', ...PRIVATE };
    const fetcher = jest.fn().mockResolvedValueOnce(new Response(JSON.stringify(diagnostic), { status: 404 })).mockRejectedValueOnce(new Error(Object.values(PRIVATE).join('|')));
    const api = createPassportApi({ apiBaseUrl: 'https://api.example.test' }, fetcher);
    const results = [await api.status(passportId, PRIVATE.accessToken), await api.status(passportId, PRIVATE.accessToken)];
    expect(results).toEqual([{ kind: 'not-found-safe' }, { kind: 'connectivity-failure' }]);
    expectNoPrivateValues(results);
  });

  it('does not retain private create input or access tokens in frontend state', async () => {
    const api = {
      list: jest.fn().mockResolvedValue({ kind: 'success', value: { context: 'PARTICULAR', passports: [], collectionActions: ['CREATE_SELF'] } }),
      createDraft: jest.fn().mockResolvedValue({ kind: 'success', value: status } satisfies PassportApiResult<PassportStatusResponse>),
    };
    const machine = new PassportStateMachine({ api: api as never, getAccessToken: () => PRIVATE.accessToken });
    await machine.loadList({ context: 'PARTICULAR' });
    await machine.createDraft(privateDraft);
    expectNoPrivateValues(machine.state);
  });

  it('keeps export fixtures limited to approved presentation fields and a neutral local placeholder', () => {
    expectNoPrivateValues(WEB_EXPORT_PASSPORT_FIXTURES);
    const output = serialized(WEB_EXPORT_PASSPORT_FIXTURES);
    expect(output).not.toMatch(/documentType|documentNumber|dateOfBirth|representative|contact|accessToken|refreshToken|latitude|longitude|coordinates|address|photoUrl|media(?:Url|Uri|Reference)/i);
    expect(WEB_EXPORT_PASSPORT_FIXTURES.presentation.identity.photograph).toEqual({ state: 'NEUTRAL_LOCAL_PLACEHOLDER' });
  });
});
