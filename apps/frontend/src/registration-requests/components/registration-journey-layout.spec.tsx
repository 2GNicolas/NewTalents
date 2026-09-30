import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { createElement } from 'react';
import * as ReactNative from 'react-native';
import { RegistrationEvidenceUploadQueue } from '../evidence/upload-queue';
import { DocumentTypeSelect, EvidenceRequirements, JourneyShell, MunicipalitySelect, getJourneyFixedBackgroundStyle, getJourneyViewportStyles } from './registration-journey';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

describe('registration journey responsive shell', () => {
  it('covers a short mobile web viewport without clipping vertical content', () => {
    const { action, content, shell } = getJourneyViewportStyles('web', 642);

    expect(shell).toEqual(expect.objectContaining({ backgroundColor: '#030806', minHeight: '100dvh' }));
    expect(shell.overflow).not.toBe('hidden');
    expect(content).toEqual(expect.objectContaining({ minHeight: '100dvh' }));
    expect(action.position).not.toBe('sticky');
    expect(String(action.paddingBottom)).toContain('safe-area-inset-bottom');
  });

  it('keeps one fixed cover background behind scrollable registration content', async () => {
    const screen = await render(createElement(JourneyShell, { steps: [], title: 'Solicitud', subtitle: 'Prueba' }, createElement(ReactNative.Text, null, 'Contenido')));
    expect(getJourneyFixedBackgroundStyle('web')).toEqual(expect.objectContaining({ bottom: 0, left: 0, position: 'fixed', right: 0, top: 0 }));
    expect(screen.getByTestId('registration-fixed-background')).toBeTruthy();
    expect(screen.getByTestId('registration-fixed-background-image').props.resizeMode).toBe('cover');
    expect(ReactNative.StyleSheet.flatten(screen.getByTestId('registration-fixed-background-image').props.style)).toEqual(expect.objectContaining({ height: '100%', width: '100%' }));
    expect(screen.getByTestId('registration-fixed-background-gradient')).toBeTruthy();
  });

  it('renders municipality results in an opaque scrollable layer above the form', async () => {
    const screen = await render(createElement(MunicipalitySelect, { value: '', onChange: jest.fn() }));
    await act(async () => { fireEvent.changeText(screen.getByLabelText('Municipio'), 'Bog'); });
    const results = screen.getByLabelText('Resultados de municipios');
    expect(ReactNative.StyleSheet.flatten(results.props.style)).toEqual(expect.objectContaining({
      backgroundColor: '#031811',
      elevation: 64,
      opacity: 1,
      position: 'absolute',
      zIndex: 10000,
    }));
    expect(ReactNative.StyleSheet.flatten(screen.getByTestId('municipality-field-wrap').props.style)).toEqual(expect.objectContaining({ zIndex: 9000 }));
    expect(results.props.nestedScrollEnabled).toBe(true);
  });

  it('uses the same foreground menu layer for document type and municipality controls', async () => {
    const document = await render(createElement(DocumentTypeSelect, { subject: 'adult', value: '', onChange: jest.fn() }));
    await act(async () => { fireEvent.press(document.getByRole('button', { name: 'Tipo de documento' })); });
    const documentMenu = document.getByLabelText('Opciones de Tipo de documento');
    expect(ReactNative.StyleSheet.flatten(documentMenu.props.style)).toEqual(expect.objectContaining({ backgroundColor: '#031811', opacity: 1, zIndex: 10000 }));
  });

  it('reserves one shared label height so wrapped labels do not lower their controls', async () => {
    const short = await render(createElement(MunicipalitySelect, { label: 'Municipio', value: '', onChange: jest.fn() }));
    const long = await render(createElement(MunicipalitySelect, { label: 'Municipio de la persona responsable', value: '', onChange: jest.fn() }));
    expect(ReactNative.StyleSheet.flatten(short.getByTestId('registration-field-label-slot').props.style)).toEqual(expect.objectContaining({ height: 40 }));
    expect(ReactNative.StyleSheet.flatten(long.getByTestId('registration-field-label-slot').props.style)).toEqual(expect.objectContaining({ height: 40 }));
  });

  it('gives the web document the same dark fallback and dynamic viewport floor', () => {
    const css = readFileSync(resolve(__dirname, '../../../app/global.css'), 'utf8');

    expect(css).toMatch(/html[\s\S]*body[\s\S]*#root/);
    expect(css).toContain('background-color: #030806');
    expect(css).toContain('min-height: 100dvh');
    expect(css).toContain('overflow-x: hidden');
  });

  it('announces a document-picker failure and keeps the selection control available', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockRejectedValueOnce(new Error('synthetic picker failure'));
    const queue = new RegistrationEvidenceUploadQueue({ transport: { upload: jest.fn() } });
    const screen = await render(createElement(EvidenceRequirements, { items: [{ category: 'IDENTITY_FRONT', label: 'Documento frontal' }], queue }));
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Seleccionar Documento frontal' })); });
    expect(screen.getByText('No pudimos abrir el selector de documentos. Intenta seleccionar el archivo de nuevo.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Seleccionar Documento frontal' })).toBeTruthy();
  });

  it('shows a selected document immediately from the ephemeral upload queue', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///synthetic.pdf', name: 'synthetic.pdf', mimeType: 'application/pdf', size: 32, file: new File(['%PDF-1.4'], 'synthetic.pdf', { type: 'application/pdf' }) }] });
    const queue = new RegistrationEvidenceUploadQueue({ transport: { upload: jest.fn() } });
    const screen = await render(createElement(EvidenceRequirements, { items: [{ category: 'IDENTITY_FRONT', label: 'Documento frontal' }], queue }));
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Seleccionar Documento frontal' })); });
    expect(screen.getByText('Seleccionado para enviar')).toBeTruthy();
    expect(queue.hasCategory('IDENTITY_FRONT')).toBe(true);
    expect(screen.getByRole('button', { name: 'Quitar Documento frontal' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Quitar Documento frontal' }));
    expect(queue.hasCategory('IDENTITY_FRONT')).toBe(false);
  });

  it('renders only document choices permitted for the selected subject', async () => {
    const adult = await render(createElement(DocumentTypeSelect, { subject: 'adult', value: '', onChange: jest.fn() }));
    await act(async () => { fireEvent.press(adult.getByRole('button', { name: 'Tipo de documento' })); });
    expect(adult.queryByText('Registro civil de nacimiento')).toBeNull();
    expect(adult.queryByText('Tarjeta de identidad')).toBeNull();
    expect(adult.getByText('Cédula de ciudadanía')).toBeTruthy();

    const minor = await render(createElement(DocumentTypeSelect, { subject: 'minor', value: '', onChange: jest.fn() }));
    await act(async () => { fireEvent.press(minor.getByRole('button', { name: 'Tipo de documento' })); });
    expect(minor.getByText('Registro civil de nacimiento')).toBeTruthy();
    expect(minor.queryByText('Cédula de ciudadanía')).toBeNull();
  });
});
