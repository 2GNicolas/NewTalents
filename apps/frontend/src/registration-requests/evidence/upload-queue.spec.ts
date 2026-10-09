import { createElement } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { EvidenceUpload } from '../components/evidence-upload';
import { classifyEvidenceUploadFailure, createEvidenceUploadTransport, RegistrationEvidenceUploadQueue, type EvidenceUploadResult, type EvidenceUploadTransport } from './upload-queue';

const requestId = '22222222-2222-4222-8222-222222222222';
const webFile = { name: 'identidad.pdf', type: 'application/pdf', size: 128 };

function transport(): EvidenceUploadTransport {
  return {
    upload: jest.fn(async ({ onProgress }): Promise<EvidenceUploadResult> => {
      onProgress(25);
      onProgress(100);
      return { kind: 'success', evidence: { id: 'evidence-1', category: 'IDENTITY_FRONT', status: 'SCANNING', sizeBytes: 128 } };
    }),
  };
}

describe('RegistrationEvidenceUploadQueue', () => {
  it('classifies safe upload failures by HTTP status and backend code', () => {
    expect(classifyEvidenceUploadFailure(401)).toBe('session-expired');
    expect(classifyEvidenceUploadFailure(409, 'registration_request_version_conflict')).toBe('version-conflict');
    expect(classifyEvidenceUploadFailure(409, 'registration_conflict')).toBe('rejected');
    expect(classifyEvidenceUploadFailure(503)).toBe('unavailable-backend');
    expect(classifyEvidenceUploadFailure(413)).toBe('too-large');
    expect(classifyEvidenceUploadFailure(415)).toBe('unsupported');
  });
  it('builds multipart without setting a JSON content type or serializing the document', async () => {
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { id: 'evidence-1', category: 'IDENTITY_FRONT', status: 'CLEAN', sizeBytes: 128 } }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    const transport = createEvidenceUploadTransport('https://api.example.test/api/');
    const file = new File([new Uint8Array([37, 80, 68, 70])], 'identidad.pdf', { type: 'application/pdf' });

    await transport.upload({ requestId, expectedVersion: 2, category: 'IDENTITY_FRONT', source: { kind: 'web', file }, idempotencyKey: '11111111-1111-4111-8111-111111111111', signal: new AbortController().signal, onProgress: jest.fn() });

    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(`/registration-requests/${requestId}/evidence`), expect.objectContaining({
      method: 'POST',
      body: expect.any(FormData),
      headers: expect.not.objectContaining({ 'Content-Type': expect.anything() }),
    }));
    fetcher.mockRestore();
  });

  it('exposes labeled picker and retry controls with live status text', async () => {
    const queue = new RegistrationEvidenceUploadQueue({ transport: transport() });
    const screen = await render(createElement(EvidenceUpload, {
      queue,
      requestId,
      expectedVersion: 2,
      onPick: async () => ({ category: 'IDENTITY_FRONT' as const, label: 'Documento frontal', source: { kind: 'web' as const, file: webFile } }),
    }));
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Seleccionar documento' })); });
    expect(await screen.findByText('Documento frontal')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cargar' })).toBeTruthy();
    await screen.unmount();
  });

  it('keeps File/URI references ephemeral and projects only safe queue metadata', () => {
    const queue = new RegistrationEvidenceUploadQueue({ transport: transport(), createIdempotencyKey: () => '11111111-1111-4111-8111-111111111111' });
    queue.add({ category: 'IDENTITY_FRONT', label: 'Documento frontal', source: { kind: 'web', file: webFile } });
    queue.add({ category: 'IDENTITY_BACK', label: 'Documento posterior', source: { kind: 'native', uri: 'file:///private/synthetic-image.png', name: 'identidad.png', mimeType: 'image/png', size: 256 } });

    const serialized = JSON.stringify(queue.items);
    expect(serialized).not.toContain('file:///private');
    expect(serialized).not.toContain('application/pdf');
    expect(serialized).not.toMatch(/base64|objectKey|digest|hash/i);
    expect(queue.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'IDENTITY_FRONT', safeLabel: 'Documento frontal', status: 'selected' }),
      expect.objectContaining({ category: 'IDENTITY_BACK', safeLabel: 'Documento posterior', status: 'selected' }),
    ]));
  });

  it('replaces a locally selected category without retaining or uploading a duplicate file', async () => {
    const adapter: EvidenceUploadTransport = { upload: jest.fn().mockResolvedValue({ kind: 'success', evidence: { id: 'evidence-1', category: 'IDENTITY_FRONT', status: 'CLEAN', sizeBytes: 128 } }) };
    const queue = new RegistrationEvidenceUploadQueue({ transport: adapter });
    const first = queue.add({ category: 'IDENTITY_FRONT', label: 'Frente anterior', source: { kind: 'web', file: webFile } });
    const second = queue.add({ category: 'IDENTITY_FRONT', label: 'Frente nuevo', source: { kind: 'web', file: webFile } });
    expect(queue.hasEphemeralReference(first.id)).toBe(false);
    expect(queue.items).toEqual([expect.objectContaining({ id: second.id, status: 'selected' })]);
    await queue.uploadRequired(['IDENTITY_FRONT'], { requestId, expectedVersion: 0 });
    expect(adapter.upload).toHaveBeenCalledTimes(1);
  });

  it('removes a selected file and permits choosing a replacement before submission', () => {
    const queue = new RegistrationEvidenceUploadQueue({ transport: transport() });
    const first = queue.add({ category: 'IDENTITY_FRONT', label: 'Frente descartado', source: { kind: 'web', file: webFile } });
    expect(queue.remove(first.id)).toBe(true);
    expect(queue.items).toEqual([]);
    expect(queue.hasEphemeralReference(first.id)).toBe(false);
    const replacement = queue.add({ category: 'IDENTITY_FRONT', label: 'Frente nuevo', source: { kind: 'web', file: webFile } });
    expect(queue.items).toEqual([expect.objectContaining({ id: replacement.id, status: 'selected' })]);
    expect(queue.items[0]?.progress).toBeUndefined();
  });

  it('allows replacement selection only while the backend snapshot requires correction and binds it to the permitted current evidence', async () => {
    const adapter = transport();
    const queue = new RegistrationEvidenceUploadQueue({ transport: adapter });
    const replacement = { category: 'IDENTITY_FRONT' as const, label: 'Documento corregido', source: { kind: 'web' as const, file: webFile } };

    expect(() => queue.addReplacement(replacement, 'DRAFT')).toThrow('evidence-replacement-not-allowed');
    const item = queue.addReplacement(replacement, 'REQUIRES_CORRECTION');
    expect(item).toEqual(expect.objectContaining({ safeLabel: 'Documento corregido', status: 'selected', correctionReplacement: true }));
    await queue.upload(item.id, { requestId, expectedVersion: 2 });
    expect(adapter.upload).toHaveBeenCalledWith(expect.not.objectContaining({ replacesEvidenceId: expect.anything() }));
  });

  it('streams multipart, reports progress and retains the raw reference only until submission succeeds', async () => {
    const adapter = transport();
    const queue = new RegistrationEvidenceUploadQueue({ transport: adapter, createIdempotencyKey: () => '11111111-1111-4111-8111-111111111111' });
    const item = queue.add({ category: 'IDENTITY_FRONT', label: 'Documento frontal', source: { kind: 'web', file: webFile } });

    await queue.upload(item.id, { requestId, expectedVersion: 2, accessToken: 'test-token-not-usable' });

    expect(adapter.upload).toHaveBeenCalledWith(expect.objectContaining({ requestId, expectedVersion: 2, category: 'IDENTITY_FRONT', source: expect.objectContaining({ kind: 'web' }) }));
    expect(queue.items[0]).toEqual(expect.objectContaining({ progress: 100, status: 'scanning', evidenceId: 'evidence-1' }));
    expect(queue.hasEphemeralReference(item.id)).toBe(true);
  });

  it('keeps a quarantined upload retryable when the real scanner is unavailable', async () => {
    const adapter: EvidenceUploadTransport = { upload: jest.fn().mockResolvedValue({ kind: 'success', evidence: { id: 'quarantined', category: 'IDENTITY_FRONT', status: 'QUARANTINED', sizeBytes: 128 } }) };
    const queue = new RegistrationEvidenceUploadQueue({ transport: adapter });
    const item = queue.add({ category: 'IDENTITY_FRONT', label: 'Documento frontal', source: { kind: 'web', file: webFile } });
    await queue.upload(item.id, { requestId, expectedVersion: 0, accessToken: 'pending-token' });
    expect(queue.items[0]).toEqual(expect.objectContaining({ status: 'failed', error: 'unavailable-backend' }));
    expect(queue.hasEphemeralReference(item.id)).toBe(true);
  });

  it('cancels an active upload and retries a connectivity failure with the same idempotency key', async () => {
    let capturedSignal: AbortSignal | undefined;
    const adapter: EvidenceUploadTransport = {
      upload: jest.fn()
        .mockImplementationOnce(async ({ signal }) => {
          capturedSignal = signal;
          return { kind: 'connectivity-failure' };
        })
        .mockResolvedValueOnce({ kind: 'success', evidence: { id: 'evidence-1', category: 'IDENTITY_FRONT', status: 'CLEAN', sizeBytes: 128 } }),
    };
    const queue = new RegistrationEvidenceUploadQueue({ transport: adapter, createIdempotencyKey: () => '11111111-1111-4111-8111-111111111111' });
    const item = queue.add({ category: 'IDENTITY_FRONT', label: 'Documento frontal', source: { kind: 'web', file: webFile } });

    await queue.upload(item.id, { requestId, expectedVersion: 2 });
    await queue.retry(item.id, { requestId, expectedVersion: 2 });

    expect(adapter.upload).toHaveBeenNthCalledWith(1, expect.objectContaining({ idempotencyKey: '11111111-1111-4111-8111-111111111111' }));
    expect(adapter.upload).toHaveBeenNthCalledWith(2, expect.objectContaining({ idempotencyKey: '11111111-1111-4111-8111-111111111111' }));
    queue.cancel(item.id);
    expect(capturedSignal?.aborted ?? true).toBe(true);
  });

  it.each(['submit', 'logout', 'abandonment', 'unmount'] as const)('clears all file references on %s', (reason) => {
    const queue = new RegistrationEvidenceUploadQueue({ transport: transport() });
    const item = queue.add({ category: 'IDENTITY_FRONT', label: 'Documento frontal', source: { kind: 'web', file: webFile } });
    expect(queue.hasEphemeralReference(item.id)).toBe(true);

    queue.clearEphemeralReferences(reason);

    expect(queue.hasEphemeralReference(item.id)).toBe(false);
  });
});
