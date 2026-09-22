import { type DominantFoot, type PassportDuplicateResolution } from '../../generated/prisma/client.js';
import type { ManagementContext, RepresentativeInput } from '../player-passport.service.js';

export type CreateDraftRequest = Readonly<{ managementContext?: ManagementContext; academyId?: string; representativeConfirmationId?: string; representative?: RepresentativeInput; legalName: string; dateOfBirth: string; documentType: string; documentNumber: string; position: string; ageCategory: string; city: string; country: string; dominantFoot: DominantFoot }>;
export type EditDraftRequest = Readonly<{ legalName?: string; dateOfBirth?: string; documentType?: string; documentNumber?: string; position?: string; ageCategory?: string; city?: string; country?: string; dominantFoot?: DominantFoot; expectedVersion?: number }>;
export type RepresentationConfirmationRequest = Readonly<{ playerDocument: Readonly<{ documentType: string; documentNumber: string }>; representative: RepresentativeInput }>;
export type VersionRequest = Readonly<{ expectedVersion?: number }>;
export type ReturnRequest = Readonly<{ reason: string; expectedVersion?: number }>;
export type ResolveDuplicateRequest = Readonly<{ resolution: PassportDuplicateResolution; correctionReason?: string; expectedVersion?: number }>;
export type PassportDtoResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: 'invalid_request' }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FEET: Readonly<Record<string, DominantFoot>> = Object.freeze({ Izquierda: 'LEFT', Derecha: 'RIGHT', Ambos: 'BOTH', 'No declarado': 'UNDECLARED', LEFT: 'LEFT', RIGHT: 'RIGHT', BOTH: 'BOTH', UNDECLARED: 'UNDECLARED' });
const RESOLUTIONS: Readonly<Record<string, PassportDuplicateResolution>> = Object.freeze({ DIFFERENT_PLAYER: 'DIFFERENT_PLAYERS', RETURN_FOR_CORRECTION: 'CORRECTABLE', CONFIRMED_EXISTING: 'CONFIRMED_EXISTING_PLAYER', DIFFERENT_PLAYERS: 'DIFFERENT_PLAYERS', CORRECTABLE: 'CORRECTABLE', CONFIRMED_EXISTING_PLAYER: 'CONFIRMED_EXISTING_PLAYER' });
const RELATIONSHIPS = new Set(['MOTHER', 'FATHER', 'LEGAL_GUARDIAN']);
const PRECISE_LOCATION = /[\d\r\n,;]|calle|carrera|avenida|transversal|diagonal|barrio|manzana|latitud|longitud|coordenada|coordinate|neighborhood|[#°]|n\s*[°o]/i;

function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function only(value: Record<string, unknown>, allowed: readonly string[]) { return Object.keys(value).every((key) => allowed.includes(key)); }
function required(value: Record<string, unknown>, key: string, max: number) { const raw = value[key]; if (typeof raw !== 'string') return null; const result = raw.normalize('NFC').trim(); return result.length > 0 && result.length <= max ? result : null; }
function optional(value: Record<string, unknown>, key: string, max: number) { return !(key in value) || value[key] === undefined ? undefined : required(value, key, max); }
function validDate(value: unknown): value is string { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return false; const parsed = new Date(`${value.trim()}T00:00:00.000Z`); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value.trim()); }
function location(value: Record<string, unknown>, key: string, max: number) { const result = required(value, key, max); return result && !PRECISE_LOCATION.test(result) ? result : null; }
function foot(value: unknown) { return typeof value === 'string' ? FEET[value] ?? null : null; }
function uuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }
function documentInput(value: unknown) { if (!object(value) || !only(value, ['documentType', 'documentNumber'])) return null; const documentType = required(value, 'documentType', 40); const documentNumber = required(value, 'documentNumber', 80); return documentType && documentNumber ? { documentType, documentNumber } : null; }
function profileInput(value: unknown) { if (!object(value) || !only(value, ['primaryPosition', 'declaredAgeCategory', 'city', 'country', 'dominantFoot'])) return null; const position = required(value, 'primaryPosition', 80); const ageCategory = required(value, 'declaredAgeCategory', 40); const city = location(value, 'city', 100); const country = location(value, 'country', 100); const dominantFoot = foot(value.dominantFoot); return position && ageCategory && city && country && dominantFoot ? { position, ageCategory, city, country, dominantFoot } : null; }
function representativeInput(value: unknown): RepresentativeInput | null { if (!object(value) || !only(value, ['legalName', 'documentType', 'documentNumber', 'relationship', 'authorityConfirmed'])) return null; const legalName = required(value, 'legalName', 200); const documentType = required(value, 'documentType', 40); const documentNumber = required(value, 'documentNumber', 80); if (!legalName || !documentType || !documentNumber || typeof value.relationship !== 'string' || !RELATIONSHIPS.has(value.relationship) || value.authorityConfirmed !== true) return null; return { legalName, documentType, documentNumber, relationship: value.relationship as RepresentativeInput['relationship'], authorityConfirmed: true }; }

export function parseListContext(value: unknown): 'PARTICULAR' | 'ACADEMY' | null { return value === 'PARTICULAR' || value === 'ACADEMY' ? value : null; }
export function parseListAcademyId(context: 'PARTICULAR' | 'ACADEMY', value: unknown): string | null | undefined {
  if (context === 'PARTICULAR') return value === undefined ? undefined : null;
  return uuid(value) ? value : null;
}
export function parseRepresentationConfirmationRequest(body: unknown): PassportDtoResult<RepresentationConfirmationRequest> { if (!object(body) || !only(body, ['playerDocument', 'representative'])) return { ok: false, error: 'invalid_request' }; const playerDocument = documentInput(body.playerDocument); const representative = representativeInput(body.representative); return playerDocument && representative ? { ok: true, value: { playerDocument, representative } } : { ok: false, error: 'invalid_request' }; }

export function parseCreateDraftRequest(body: unknown): PassportDtoResult<CreateDraftRequest> {
  if (!object(body) || 'isAdult' in body) return { ok: false, error: 'invalid_request' };
  if ('managementContext' in body) {
    if (!only(body, ['managementContext', 'academyId', 'playerLegalName', 'dateOfBirth', 'playerDocument', 'footballProfile', 'representative', 'representativeConfirmationId'])) return { ok: false, error: 'invalid_request' };
    const context = body.managementContext; if (context !== 'SELF' && context !== 'LEGAL_REPRESENTATIVE' && context !== 'ACADEMY') return { ok: false, error: 'invalid_request' };
    const legalName = required(body, 'playerLegalName', 200); const dateOfBirth = validDate(body.dateOfBirth) ? body.dateOfBirth.trim() : null; const document = documentInput(body.playerDocument); const profile = profileInput(body.footballProfile);
    const representative = body.representative === undefined ? undefined : representativeInput(body.representative); const academyId = body.academyId === undefined ? undefined : uuid(body.academyId) ? body.academyId : null; const confirmationId = body.representativeConfirmationId === undefined ? undefined : uuid(body.representativeConfirmationId) ? body.representativeConfirmationId : null;
    const shape = context === 'SELF' ? academyId === undefined && representative === undefined && confirmationId === undefined : context === 'LEGAL_REPRESENTATIVE' ? academyId === undefined && Boolean(representative) && confirmationId === undefined : Boolean(academyId) && representative === undefined;
    if (!legalName || !dateOfBirth || !document || !profile || !shape || academyId === null || confirmationId === null) return { ok: false, error: 'invalid_request' };
    return { ok: true, value: { managementContext: context, ...(academyId ? { academyId } : {}), ...(confirmationId ? { representativeConfirmationId: confirmationId } : {}), ...(representative ? { representative } : {}), legalName, dateOfBirth, ...document, ...profile } };
  }
  if (!only(body, ['legalName', 'dateOfBirth', 'documentType', 'documentNumber', 'position', 'ageCategory', 'city', 'country', 'dominantFoot'])) return { ok: false, error: 'invalid_request' };
  const legalName = required(body, 'legalName', 200); const dateOfBirth = validDate(body.dateOfBirth) ? body.dateOfBirth.trim() : null; const documentType = required(body, 'documentType', 40); const documentNumber = required(body, 'documentNumber', 80); const position = required(body, 'position', 80); const ageCategory = required(body, 'ageCategory', 40); const city = location(body, 'city', 100); const country = location(body, 'country', 100); const dominantFoot = foot(body.dominantFoot);
  return legalName && dateOfBirth && documentType && documentNumber && position && ageCategory && city && country && dominantFoot ? { ok: true, value: { legalName, dateOfBirth, documentType, documentNumber, position, ageCategory, city, country, dominantFoot } } : { ok: false, error: 'invalid_request' };
}

export function parseEditDraftRequest(body: unknown): PassportDtoResult<EditDraftRequest> {
  if (!object(body) || 'isAdult' in body) return { ok: false, error: 'invalid_request' };
  if ('playerLegalName' in body || 'playerDocument' in body || 'footballProfile' in body || 'expectedVersion' in body || 'dateOfBirth' in body) {
    if (!only(body, ['playerLegalName', 'dateOfBirth', 'playerDocument', 'footballProfile', 'expectedVersion'])) return { ok: false, error: 'invalid_request' };
    const legalName = optional(body, 'playerLegalName', 200); const dateOfBirth = body.dateOfBirth === undefined ? undefined : validDate(body.dateOfBirth) ? body.dateOfBirth.trim() : null; const document = body.playerDocument === undefined ? undefined : documentInput(body.playerDocument); const profile = body.footballProfile === undefined ? undefined : profileInput(body.footballProfile); const expectedVersion = body.expectedVersion === undefined ? undefined : Number.isInteger(body.expectedVersion) && Number(body.expectedVersion) >= 1 ? Number(body.expectedVersion) : null;
    if (legalName === null || dateOfBirth === null || document === null || profile === null || expectedVersion === null || [legalName, dateOfBirth, document, profile, expectedVersion].every((item) => item === undefined)) return { ok: false, error: 'invalid_request' };
    return { ok: true, value: { ...(legalName ? { legalName } : {}), ...(dateOfBirth ? { dateOfBirth } : {}), ...(document ?? {}), ...(profile ?? {}), ...(expectedVersion ? { expectedVersion } : {}) } };
  }
  if (!only(body, ['position', 'ageCategory', 'city', 'country', 'dominantFoot'])) return { ok: false, error: 'invalid_request' };
  const position = optional(body, 'position', 80); const ageCategory = optional(body, 'ageCategory', 40); const city = body.city === undefined ? undefined : location(body, 'city', 100); const country = body.country === undefined ? undefined : location(body, 'country', 100); const dominantFoot = body.dominantFoot === undefined ? undefined : foot(body.dominantFoot);
  if (position === null || ageCategory === null || city === null || country === null || dominantFoot === null || [position, ageCategory, city, country, dominantFoot].every((item) => item === undefined)) return { ok: false, error: 'invalid_request' };
  return { ok: true, value: { ...(position ? { position } : {}), ...(ageCategory ? { ageCategory } : {}), ...(city ? { city } : {}), ...(country ? { country } : {}), ...(dominantFoot ? { dominantFoot } : {}) } };
}

function expectedVersion(value: unknown): number | null | undefined { return value === undefined ? undefined : Number.isInteger(value) && Number(value) >= 1 ? Number(value) : null; }
export function parseVersionRequest(body: unknown): PassportDtoResult<VersionRequest> { if (body === undefined || body === null) return { ok: true, value: {} }; if (!object(body) || !only(body, ['expectedVersion'])) return { ok: false, error: 'invalid_request' }; const version = expectedVersion(body.expectedVersion); return version === null ? { ok: false, error: 'invalid_request' } : { ok: true, value: version === undefined ? {} : { expectedVersion: version } }; }
export function parseReturnRequest(body: unknown): PassportDtoResult<ReturnRequest> { if (!object(body) || !only(body, ['reason', 'expectedVersion'])) return { ok: false, error: 'invalid_request' }; const reason = required(body, 'reason', 1000); const version = expectedVersion(body.expectedVersion); return reason && version !== null ? { ok: true, value: { reason, ...(version === undefined ? {} : { expectedVersion: version }) } } : { ok: false, error: 'invalid_request' }; }
export function parseResolveDuplicateRequest(body: unknown): PassportDtoResult<ResolveDuplicateRequest> { if (!object(body) || !only(body, ['resolution', 'creatorSafeReason', 'expectedVersion'])) return { ok: false, error: 'invalid_request' }; const resolution = typeof body.resolution === 'string' ? RESOLUTIONS[body.resolution] ?? null : null; const correctionReason = optional(body, 'creatorSafeReason', 1000); const version = expectedVersion(body.expectedVersion); if (!resolution || correctionReason === null || version === null || (resolution === 'CORRECTABLE' && !correctionReason)) return { ok: false, error: 'invalid_request' }; return { ok: true, value: { resolution, ...(correctionReason ? { correctionReason } : {}), ...(version === undefined ? {} : { expectedVersion: version }) } }; }
