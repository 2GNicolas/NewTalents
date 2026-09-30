import { fireEvent, render } from '@testing-library/react-native';

import { AdminCorrectionRejection } from './admin-correction-rejection';

describe('AdminCorrectionRejection', () => {
  it('previews the applicant-safe correction and submits only selected controlled targets', async () => {
    const onCorrection = jest.fn();
    const screen = await render(<AdminCorrectionRejection applicantLabel="Persona sintética" evidenceCategories={['IDENTITY_FRONT', 'IDENTITY_BACK']} onBack={jest.fn()} onCorrection={onCorrection} onReject={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Seleccionar Documento de identidad · frente' }));
    await fireEvent.changeText(screen.getByLabelText('Motivo visible para la persona solicitante'), 'La imagen frontal no permite verificar los datos.');
    await fireEvent.press(screen.getByRole('checkbox', { name: /confirmo que el mensaje no contiene/i }));
    expect(screen.getByText('La imagen frontal no permite verificar los datos.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Solicitar corrección' }));
    expect(onCorrection).toHaveBeenCalledWith({ safeReason: 'La imagen frontal no permite verificar los datos.', correctionTargets: ['IDENTITY_FRONT'] });
    expect(screen.queryByText(/fingerprint|candidato interno|clave de objeto/i)).toBeNull();
  });

  it('requires a second explicit confirmation before final rejection', async () => {
    const onReject = jest.fn();
    const screen = await render(<AdminCorrectionRejection applicantLabel="Persona sintética" evidenceCategories={[]} onBack={jest.fn()} onCorrection={jest.fn()} onReject={onReject} />);
    await fireEvent.changeText(screen.getByLabelText('Motivo visible para la persona solicitante'), 'La solicitud no cumple los requisitos informados.');
    await fireEvent.press(screen.getByRole('checkbox', { name: /confirmo que el mensaje no contiene/i }));
    await fireEvent.press(screen.getByRole('button', { name: 'Rechazar solicitud' }));
    expect(onReject).not.toHaveBeenCalled();
    expect(screen.getByText(/confirma la decisión final/i)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar rechazo definitivo' }));
    expect(onReject).toHaveBeenCalledWith({ safeReason: 'La solicitud no cumple los requisitos informados.' });
  });
});
