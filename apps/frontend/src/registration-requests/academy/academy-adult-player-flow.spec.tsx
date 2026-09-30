import { render } from '@testing-library/react-native';
import { createElement } from 'react';

import { AcademyAdultPlayerFlow, buildAcademyAdultPlayerDraft } from './academy-adult-player-flow';

describe('AcademyAdultPlayerFlow', () => {
  it('builds express academy presentation authorization without USER, SELF or sports fields', async () => {
    const draft = buildAcademyAdultPlayerDraft('academy-1', { names: 'Andrés', surnames: 'Rojas', documentType: 'CC', documentNumber: '4186', birthDate: '2000-01-01', country: 'CO', city: '11001', adultAuthorization: true, privacyAccepted: true, truthfulnessAccepted: true, academyPresentationAccepted: true });
    expect(draft).toMatchObject({ type: 'ACADEMY_ADULT_PLAYER', academyId: 'academy-1', details: { adultAuthorization: true } });
    expect(JSON.stringify(draft)).not.toMatch(/position|dominantFoot|SELF|USER/);
    const screen = await render(createElement(AcademyAdultPlayerFlow, { academy: { id: 'academy-1', name: 'Academia Horizonte', location: 'Bogotá', approved: true }, onSubmit: jest.fn(), initialValid: true }));
    expect(screen.getByText(/no crea credenciales de acceso/i)).toBeTruthy();
    const editable = await render(createElement(AcademyAdultPlayerFlow, { academy: { id: 'academy-1', name: 'Academia Horizonte', location: 'Bogotá', approved: true }, onSubmit: jest.fn() }));
    expect(editable.getByLabelText('Nombres legales')).toBeTruthy();
    expect(editable.getByRole('checkbox', { name: 'Autorización expresa del jugador' })).toBeTruthy();
  });
});
