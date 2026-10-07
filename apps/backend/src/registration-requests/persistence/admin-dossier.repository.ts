import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import type { RegistrationRequestType } from '../domain/registration-request.types.js';

export type DossierCandidate = Readonly<{
  id: string; requestId: string; requestVersion: number; confirmedAt: Date; dossierName?: string | null; labelCiphertext: string;
  labelCiphertexts?: readonly string[];
  requestType: RegistrationRequestType; requestStatus: string; approvalExecutionStatus: string;
  executionStatus?: string; finalizedAt?: Date; deletionStatuses: readonly string[]; deletionVerifiedAt?: Date;
  linkedPassport: null | Readonly<{ id: string; state: string; enrichmentStatus: string }>;
}>;

type CandidateQuery = Readonly<{
  cursor?: string; limit: number; requestType?: RegistrationRequestType; confirmedFrom?: Date; confirmedTo?: Date;
  order: 'confirmedAt-id-desc';
}>;

@Injectable()
export class AdminDossierRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listCandidates(query: CandidateQuery): Promise<Readonly<{ rows: readonly DossierCandidate[]; nextCursor?: string }>> {
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : undefined;
    const records = await this.prisma.registrationManualDossierConfirmation.findMany({
      where: {
        ...(query.requestType ? { request: { type: query.requestType } } : {}),
        ...((query.confirmedFrom || query.confirmedTo) ? { confirmedAt: { ...(query.confirmedFrom ? { gte: query.confirmedFrom } : {}), ...(query.confirmedTo ? { lte: query.confirmedTo } : {}) } } : {}),
        ...(cursor ? { OR: [{ confirmedAt: { lt: cursor.confirmedAt } }, { confirmedAt: cursor.confirmedAt, id: { lt: cursor.id } }] } : {}),
      },
      orderBy: [{ confirmedAt: 'desc' }, { id: 'desc' }], take: query.limit + 1,
      select: {
        id: true, requestId: true, requestVersion: true, confirmedAt: true, dossierName: true,
        request: { select: {
          type: true, status: true, approvalExecutionStatus: true,
          applicants: { take: 1, orderBy: { createdAt: 'asc' }, select: { encryptedLegalName: true } },
          players: { take: 1, orderBy: { createdAt: 'asc' }, select: { encryptedLegalName: true, linkedPlayer: { select: { passport: { select: { id: true, state: true, enrichmentStatus: true } } } } } },
          formalAcademyDetail: { select: { encryptedAcademyName: true } },
          naturalPersonAcademyDetail: { select: { encryptedAcademyName: true } },
          approvalExecutions: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, finalizedAt: true } },
          deletionRecords: { select: { status: true, verifiedAbsentAt: true } },
        } },
      },
    });
    const hasMore = records.length > query.limit;
    const page = records.slice(0, query.limit).map((record) => this.map(record as never));
    return Object.freeze({ rows: Object.freeze(page), ...(hasMore && page.length ? { nextCursor: this.cursorFor(page[page.length - 1]!) } : {}) });
  }

  async findById(id: string): Promise<DossierCandidate | null> {
    const record = await this.prisma.registrationManualDossierConfirmation.findUnique({
      where: { id },
      select: {
        id: true, requestId: true, requestVersion: true, confirmedAt: true, dossierName: true,
        request: { select: {
          type: true, status: true, approvalExecutionStatus: true,
          applicants: { take: 1, orderBy: { createdAt: 'asc' }, select: { encryptedLegalName: true } },
          players: { take: 1, orderBy: { createdAt: 'asc' }, select: { encryptedLegalName: true, linkedPlayer: { select: { passport: { select: { id: true, state: true, enrichmentStatus: true } } } } } },
          formalAcademyDetail: { select: { encryptedAcademyName: true } }, naturalPersonAcademyDetail: { select: { encryptedAcademyName: true } },
          approvalExecutions: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, finalizedAt: true } },
          deletionRecords: { select: { status: true, verifiedAbsentAt: true } },
        } },
      },
    });
    return record ? this.map(record as never) : null;
  }

  cursorFor(row: Pick<DossierCandidate, 'confirmedAt' | 'id'>): string {
    return Buffer.from(JSON.stringify({ confirmedAt: row.confirmedAt.toISOString(), id: row.id }), 'utf8').toString('base64url');
  }

  private decodeCursor(value: string): Readonly<{ confirmedAt: Date; id: string }> {
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
      const confirmedAt = new Date(String(parsed.confirmedAt));
      if (typeof parsed.id !== 'string' || Number.isNaN(confirmedAt.getTime())) throw new Error('invalid');
      return { confirmedAt, id: parsed.id };
    } catch { throw new Error('Invalid dossier cursor'); }
  }

  private map(record: any): DossierCandidate {
    const request = record.request;
    const execution = request.approvalExecutions[0];
    const verified = request.deletionRecords.map((item: any) => item.verifiedAbsentAt).filter(Boolean).sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];
    const labelCiphertexts = [
      ...request.players.map((item: any) => item.encryptedLegalName),
      request.formalAcademyDetail?.encryptedAcademyName,
      request.naturalPersonAcademyDetail?.encryptedAcademyName,
      ...request.applicants.map((item: any) => item.encryptedLegalName),
    ].filter((value): value is string => typeof value === 'string' && value.length > 0);
    const labelCiphertext = labelCiphertexts[0] ?? '';
    const passport = request.players.find((item: any) => item.linkedPlayer?.passport)?.linkedPlayer?.passport ?? null;
    return Object.freeze({
      id: record.id, requestId: record.requestId, requestVersion: record.requestVersion, confirmedAt: record.confirmedAt, dossierName: record.dossierName,
      labelCiphertext, labelCiphertexts: Object.freeze(labelCiphertexts), requestType: request.type, requestStatus: request.status, approvalExecutionStatus: request.approvalExecutionStatus,
      ...(execution?.status ? { executionStatus: execution.status } : {}), ...(execution?.finalizedAt ? { finalizedAt: execution.finalizedAt } : {}),
      deletionStatuses: Object.freeze(request.deletionRecords.map((item: any) => item.status)), ...(verified ? { deletionVerifiedAt: verified } : {}),
      linkedPassport: passport ? Object.freeze({ id: passport.id, state: passport.state, enrichmentStatus: passport.enrichmentStatus }) : null,
    });
  }
}
