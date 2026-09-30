import { render } from '@testing-library/react-native';
import { createElement } from 'react';

import { AcademyMinorPlayerFlow, buildAcademyMinorPlayerDraft } from './academy-minor-player-flow';

describe('AcademyMinorPlayerFlow', () => {
  it('keeps representative authority separate from academy presentation and creates no account fields', async () => {
    const draft = buildAcademyMinorPlayerDraft('academy-1', {
      minor: { names: 'Valentina', surnames: 'Pérez', documentType: 'RC', documentNumber: '1000641', birthDate: '2012-08-22', country: 'CO', city: '11001' },
      representative: { names: 'Mariana', surnames: 'Torres', documentType: 'CC', documentNumber: '7392', birthDate: '1986-01-01', country: 'CO', city: '11001', phone: '3000000017' },
      relationship: 'MOTHER', authorityDeclared: true, privacyAccepted: true, truthfulnessAccepted: true, representationAccepted: true, minorTreatmentAccepted: true, academyPresentationAccepted: true,
    });
    expect(draft).toMatchObject({ type: 'ACADEMY_MINOR_PLAYER', academyId: 'academy-1', details: { relationship: 'MOTHER', authorityDeclared: true } });
    expect(JSON.stringify(draft)).not.toMatch(/password|email/);
    const screen = await render(createElement(AcademyMinorPlayerFlow, { academy: { id: 'academy-1', name: 'Academia Horizonte', location: 'Bogotá', approved: true }, onSubmit: jest.fn(), initialValid: true }));
    expect(screen.getByText('El menor no recibirá una cuenta.')).toBeTruthy();
    expect(screen.getByText('La academia no reemplaza al representante legal.')).toBeTruthy();
    const editable = await render(createElement(AcademyMinorPlayerFlow, { academy: { id: 'academy-1', name: 'Academia Horizonte', location: 'Bogotá', approved: true }, onSubmit: jest.fn() }));
    expect(editable.getByLabelText('Nombres legales del menor')).toBeTruthy();
    expect(editable.getByLabelText('Teléfono obligatorio del representante')).toBeTruthy();
  });
});
