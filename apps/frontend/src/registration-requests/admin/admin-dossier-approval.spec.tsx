import { fireEvent, render } from '@testing-library/react-native';

import { AdminDossierApproval } from './admin-dossier-approval';

describe('AdminDossierApproval', () => {
  it('confirms a manual dossier and keeps the response waiting for verified deletion', async () => {
    const onApprove = jest.fn();
    const screen = await render(<AdminDossierApproval evidenceCategories={['IDENTITY_FRONT', 'IDENTITY_BACK']} state="ready" onBack={jest.fn()} onApprove={onApprove} onRetryDeletion={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Nombre del expediente manual'), 'EXP-006-2026');
    await fireEvent.press(screen.getByRole('checkbox', { name: /confirmo la transferencia manual/i }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar expediente y continuar' }));
    expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({ dossierName: 'EXP-006-2026', categories: ['IDENTITY_FRONT', 'IDENTITY_BACK'] }));
    expect(screen.getByText('Eliminación segura de evidencias')).toBeTruthy();
    expect(screen.getByText('Respuesta enviada')).toBeTruthy();
  });

  it('offers an explicit retry only in recovery and describes status without color alone', async () => {
    const onRetryDeletion = jest.fn();
    const screen = await render(<AdminDossierApproval evidenceCategories={['IDENTITY_FRONT']} state="recovery-required" onBack={jest.fn()} onApprove={jest.fn()} onRetryDeletion={onRetryDeletion} />);
    expect(screen.getByText(/requiere recuperación/i)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar eliminación segura' }));
    expect(onRetryDeletion).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Error')).toBeTruthy();
    expect(screen.getByText('Pendiente')).toBeTruthy();
  });
});
