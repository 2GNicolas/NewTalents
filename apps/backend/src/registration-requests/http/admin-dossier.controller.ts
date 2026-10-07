import { ArgumentsHost, Catch, Controller, ExceptionFilter, Get, Header, Param, Query, Req, UseFilters, UseGuards } from '@nestjs/common';

import { AuthenticationGuard, type RequestActor } from '../../authentication/authentication.guard.js';
import { AdminDossierQueryService } from '../review/admin-dossier-query.service.js';
import { parseAdminDossierQuery } from './admin-dossier.dto.js';

type DossierHttpCode = 'validation' | 'forbidden' | 'not-found' | 'unavailable';
export class AdminDossierHttpError extends Error {
  readonly status: number; readonly safeCode: string;
  constructor(readonly code: DossierHttpCode, readonly issues: readonly Readonly<{ field: string; code: string }>[] = []) {
    super(code);
    const values = code === 'validation' ? [400, 'dossier_query_invalid'] : code === 'forbidden' ? [403, 'dossier_access_denied'] : code === 'not-found' ? [404, 'dossier_not_found'] : [503, 'dossier_service_unavailable'];
    this.status = values[0] as number; this.safeCode = values[1] as string;
  }
}

@Catch(AdminDossierHttpError)
export class AdminDossierExceptionFilter implements ExceptionFilter {
  catch(error: AdminDossierHttpError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{ status(code: number): { json(body: unknown): void } }>();
    response.status(error.status).json({ error: { code: error.safeCode, message: error.code === 'not-found' ? 'Dossier not found' : error.code === 'forbidden' ? 'Dossier access denied' : error.code === 'validation' ? 'Dossier query is invalid' : 'Dossier service is temporarily unavailable' }, ...(error.issues.length ? { issues: error.issues } : {}) });
  }
}

@Controller('admin/dossiers')
@UseGuards(AuthenticationGuard)
@UseFilters(AdminDossierExceptionFilter)
export class AdminDossierController {
  constructor(private readonly queries: AdminDossierQueryService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Req() request: { actor: RequestActor }, @Query() query: unknown) {
    const parsed = parseAdminDossierQuery(query);
    if (!parsed.ok) throw new AdminDossierHttpError('validation', parsed.issues);
    const value = parsed.value;
    const result = await this.queries.list(request.actor.identityId, {
      limit: value.limit,
      ...(value.cursor ? { cursor: value.cursor } : {}),
      ...(value.query ? { query: value.query } : {}),
      ...(value.status ? { status: value.status } : {}),
      ...(value.requestType ? { requestType: value.requestType } : {}),
      ...(value.confirmedFrom ? { confirmedFrom: value.confirmedFrom } : {}),
      ...(value.confirmedTo ? { confirmedTo: value.confirmedTo } : {}),
    });
    if (result.outcome !== 'found') throw new AdminDossierHttpError(result.outcome === 'denied' ? 'forbidden' : 'unavailable');
    return { data: result.items, pagination: { hasMore: Boolean(result.nextCursor), ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}) } };
  }

  @Get(':dossierId')
  @Header('Cache-Control', 'no-store')
  async detail(@Req() request: { actor: RequestActor }, @Param('dossierId') dossierId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dossierId)) throw new AdminDossierHttpError('not-found');
    const result = await this.queries.detail(request.actor.identityId, dossierId);
    if (result.outcome !== 'found') throw new AdminDossierHttpError(result.outcome === 'unavailable' ? 'unavailable' : 'not-found');
    return { data: result.detail };
  }
}
