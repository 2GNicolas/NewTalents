import { z } from 'zod';

const requestType = z.enum(['PERSONAL_ADULT', 'REPRESENTED_MINOR', 'FORMAL_ACADEMY', 'NATURAL_PERSON_ACADEMY', 'ADDITIONAL_ACADEMY_ACCOUNT', 'ACADEMY_ADULT_PLAYER', 'ACADEMY_MINOR_PLAYER']);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()), 'invalid_date');
const query = z.object({
  cursor: z.string().min(1).max(500).optional(),
  limit: z.preprocess((value) => value === undefined ? 20 : Number(value), z.number().int().min(1).max(50)),
  query: z.string().trim().min(1).max(120).optional(),
  status: z.enum(['CONFIRMED', 'DELETION_PENDING', 'RECOVERY_REQUIRED', 'APPROVED']).optional(),
  requestType: requestType.optional(), confirmedFrom: isoDate.optional(), confirmedTo: isoDate.optional(),
}).strict().superRefine((value, context) => { if (value.confirmedFrom && value.confirmedTo && value.confirmedFrom > value.confirmedTo) context.addIssue({ code: 'custom', path: ['confirmedTo'], message: 'invalid_range' }); });

type ParseResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; issues: readonly Readonly<{ field: string; code: string }>[] }>;
export function parseAdminDossierQuery(input: unknown): ParseResult<z.infer<typeof query>> {
  const result = query.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false, issues: Object.freeze(result.error.issues.map((issue) => Object.freeze({ field: issue.path.join('.'), code: issue.code }))) };
}
