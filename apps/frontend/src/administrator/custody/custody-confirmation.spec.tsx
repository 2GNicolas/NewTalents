import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { buildAnalystSummaryFixture, buildLinkedPassportSummaryFixture } from '../testing/feature-007-fixtures';
import type { CustodyConfirmationSnapshot } from './custody-confirmation-state';
import { CustodyConfirmation } from './custody-confirmation';
import { CustodyAnalystDropZone, DraggableCustodyPassport, installCustodyDragPreview } from './custody-drag-selection';

const passport = buildLinkedPassportSummaryFixture();
const analyst = buildAnalystSummaryFixture();
const confirmation: CustodyConfirmationSnapshot = {
  stage: 'confirmation', passport, analyst, action: 'ASSIGN', idempotencyKey: '90000000-0000-4000-8000-000000000001',
};

describe('custody confirmation interaction', () => {
  it('uses a readable browser drag image that is detached from clipping workspace layers', () => {
    const preview = { style: {}, remove: jest.fn() };
    const transparentImage = { style: {}, remove: jest.fn() };
    const source = {
      cloneNode: jest.fn(() => preview),
      getBoundingClientRect: jest.fn(() => ({ left: 300, top: 200, width: 278, height: 112 })),
      ownerDocument: { createElement: jest.fn(() => transparentImage) },
    };
    const transfer = { setDragImage: jest.fn() };
    const host = { appendChild: jest.fn() };

    const installed = installCustodyDragPreview(source, transfer, host, { x: 420, y: 260 });
    expect(host.appendChild).toHaveBeenCalledWith(preview);
    expect(host.appendChild).toHaveBeenCalledWith(transparentImage);
    expect(transfer.setDragImage).toHaveBeenCalledWith(transparentImage, 0, 0);
    expect(preview.style).toEqual(expect.objectContaining({
      position: 'fixed',
      pointerEvents: 'none',
      left: '300px',
      top: '200px',
      width: '278px',
      zIndex: '2147483647',
    }));
    installed.move(510, 310);
    expect(preview.style).toEqual(expect.objectContaining({ left: '390px', top: '250px' }));
    installed.remove();
    expect(preview.remove).toHaveBeenCalledTimes(1);
    expect(transparentImage.remove).toHaveBeenCalledTimes(1);
  });

  it('uses desktop drop only to select a destination and open confirmation', async () => {
    const onDragStart = jest.fn();
    const onDrop = jest.fn();
    const persist = jest.fn();
    const screen = await render(<>
      <DraggableCustodyPassport passport={passport} onDragStart={onDragStart}><Text>{passport.displayLabel}</Text></DraggableCustodyPassport>
      <CustodyAnalystDropZone analyst={analyst} active onDrop={onDrop} onSelect={onDrop} />
    </>);

    await fireEvent(screen.getByTestId(`drag-passport-${passport.passportId}`), 'dragStart', { nativeEvent: {} });
    await fireEvent(screen.getByTestId(`drop-analyst-${analyst.identityId}`), 'drop', { nativeEvent: { preventDefault: jest.fn() } });
    expect(onDragStart).toHaveBeenCalledWith(passport.passportId);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(persist).not.toHaveBeenCalled();
    expect(screen.getByText(`Soltar para seleccionar a ${analyst.displayLabel}`)).toBeTruthy();
  });

  it('lets keyboard and mobile activate the same Analyst destination selector', async () => {
    const onSelect = jest.fn();
    const screen = await render(<CustodyAnalystDropZone analyst={analyst} active onDrop={jest.fn()} onSelect={onSelect} />);
    const destination = screen.getByRole('button', { name: `Seleccionar ${analyst.displayLabel} como destino` });
    await fireEvent.press(destination);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('announces passport, current and selected Analyst in one confirmation surface', async () => {
    const screen = await render(<CustodyConfirmation snapshot={confirmation} onReason={jest.fn()} onCancel={jest.fn()} onConfirm={jest.fn()} />);
    expect(screen.getByRole('header', { name: 'Confirmar custodia' })).toBeTruthy();
    expect(screen.getByText(`PAS-${passport.passportId.toUpperCase()} · ${passport.displayLabel}`)).toBeTruthy();
    expect(screen.getByText('Sin asignar')).toBeTruthy();
    expect(screen.getByText(analyst.displayLabel)).toBeTruthy();
    expect(screen.getByText('La asignación se guardará solo al confirmar.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirmar asignación' })).toBeTruthy();
    expect(screen.queryByLabelText('Motivo obligatorio')).toBeNull();
    expect(screen.queryByText('Motivo')).toBeNull();
  });

  it('cancels with button or Escape without persistence and requests focus return', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const onReturnFocus = jest.fn();
    const screen = await render(<CustodyConfirmation snapshot={confirmation} onReason={jest.fn()} onCancel={onCancel} onConfirm={onConfirm} onReturnFocus={onReturnFocus} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    await fireEvent(screen.getByTestId('custody-confirmation-surface'), 'keyDown', { nativeEvent: { key: 'Escape' } });
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onReturnFocus).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('uses text and an instant border state when reduced motion is enabled', async () => {
    const screen = await render(<CustodyAnalystDropZone analyst={analyst} active reducedMotion onDrop={jest.fn()} onSelect={jest.fn()} />);
    expect(screen.getByText(`Soltar para seleccionar a ${analyst.displayLabel}`)).toBeTruthy();
    expect(screen.getByTestId(`drop-analyst-${analyst.identityId}`)).toHaveProp('accessibilityHint', 'La selección cambia de forma instantánea, sin animación.');
  });
});
