import { createConnection, type Socket } from 'node:net';
import { once } from 'node:events';
import type { Readable } from 'node:stream';

import type { EvidenceMalwareScanner, EvidenceScanResult } from './evidence-malware-scanner.js';

export type ClamAvScannerOptions = Readonly<{ host: string; port: number; timeoutMs: number }>;
export type ClamSocketFactory = (options: Readonly<{ host: string; port: number }>) => Socket;

const COMMAND = Buffer.from('zINSTREAM\0');
const TERMINATOR = Buffer.alloc(4);

export class ClamAvInstreamScanner implements EvidenceMalwareScanner {
  constructor(private readonly options: ClamAvScannerOptions, private readonly createSocket: ClamSocketFactory = createConnection) {}

  async scan(stream: Readable): Promise<EvidenceScanResult> {
    return new Promise<EvidenceScanResult>((resolve) => {
      const socket = this.createSocket({ host: this.options.host, port: this.options.port });
      let settled = false;
      let connected = false;
      let response = Buffer.alloc(0);
      const timer = setTimeout(() => finish({ status: 'indeterminate', code: 'SCANNER_TIMEOUT' }), this.options.timeoutMs);

      const finish = (result: EvidenceScanResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        stream.destroy();
        socket.destroy();
        resolve(result);
      };

      socket.once('connect', () => {
        connected = true;
        void this.writeStream(socket, stream).catch(() => finish({ status: 'indeterminate', code: 'SCANNER_ERROR' }));
      });
      socket.on('data', (chunk: Buffer) => {
        if (response.length + chunk.length > 4096) return finish({ status: 'indeterminate', code: 'SCANNER_MALFORMED_RESPONSE' });
        response = Buffer.concat([response, chunk]);
        const terminator = response.indexOf(0);
        if (terminator >= 0) finish(this.parseResponse(response.subarray(0, terminator).toString('utf8')));
      });
      socket.once('end', () => {
        if (!settled) finish(response.length > 0 ? this.parseResponse(response.toString('utf8')) : { status: 'indeterminate', code: 'SCANNER_MALFORMED_RESPONSE' });
      });
      socket.once('error', () => finish({ status: 'indeterminate', code: connected ? 'SCANNER_ERROR' : 'SCANNER_UNAVAILABLE' }));
    });
  }

  private async writeStream(socket: Socket, stream: Readable): Promise<void> {
    if (!socket.write(COMMAND)) await once(socket, 'drain');
    for await (const value of stream) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array);
      const length = Buffer.allocUnsafe(4);
      length.writeUInt32BE(chunk.length);
      if (!socket.write(length)) await once(socket, 'drain');
      if (!socket.write(chunk)) await once(socket, 'drain');
    }
    socket.write(TERMINATOR);
  }

  private parseResponse(value: string): EvidenceScanResult {
    const response = value.trim();
    if (/^stream: OK$/i.test(response)) return { status: 'clean', code: 'CLEAN' };
    if (/^stream: .+ FOUND$/i.test(response)) return { status: 'infected', code: 'MALWARE_DETECTED' };
    if (/^stream: .+ ERROR$/i.test(response)) return { status: 'indeterminate', code: 'SCANNER_ERROR' };
    return { status: 'indeterminate', code: 'SCANNER_MALFORMED_RESPONSE' };
  }
}
