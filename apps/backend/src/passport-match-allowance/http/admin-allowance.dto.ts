import { z } from 'zod';

type Parsed<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false }>;
const uuid = z.string().uuid();
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
});
const listQuery = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(50)).default(20),
  cursor: z.string().min(1).max(1000).optional(),
}).strict();
const createCommand = z.object({
  expectedVersion: z.literal(0),
  idempotencyKey: uuid,
  cadence: z.enum(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']),
  matchLimit: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  expectedActivationDate: calendarDate,
}).strict();
const confirmCommand = z.object({
  expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  idempotencyKey: uuid,
  cadence: z.enum(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']),
  matchLimit: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  expectedActivationDate: calendarDate.optional(),
}).strict().superRefine((value, context) => {
  if (value.expectedVersion === 0 && !value.expectedActivationDate) context.addIssue({ code: 'custom', path: ['expectedActivationDate'], message: 'Required for creation' });
  if (value.expectedVersion > 0 && value.expectedActivationDate) context.addIssue({ code: 'custom', path: ['expectedActivationDate'], message: 'Not allowed for an update' });
});

function parse<T>(schema: z.ZodType<T>, input: unknown): Parsed<T> {
  const result = schema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false };
}

export const validPassportId = (value: string): boolean => uuid.safeParse(value).success;
export const parseAdminPassportsQuery = (input: unknown) => parse(listQuery, input);
export const parseAllowanceCreateCommand = (input: unknown) => parse(createCommand, input);
export const parseAllowanceCommand = (input: unknown) => parse(confirmCommand, input);
