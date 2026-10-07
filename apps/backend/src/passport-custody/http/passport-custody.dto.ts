import { z } from 'zod';

type ParseResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; issues: readonly Readonly<{ field: string; code: string }>[] }>;

const optionalQuery = z.string().trim().min(1).max(120).optional();
const cursor = z.string().trim().min(1).max(1000).optional();
const limit = z.coerce.number().int().min(1).max(50).default(20);
const uuid = z.string().uuid();

const analystQuery = z.object({ query: optionalQuery, cursor, limit }).strict();
const passportQuery = z.object({
  query: optionalQuery,
  cursor,
  limit,
  assignment: z.enum(['ALL', 'UNASSIGNED', 'ASSIGNED']).default('ALL'),
  analystId: uuid.optional(),
}).strict();
const assignCommand = z.object({
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: uuid,
  analystIdentityId: uuid,
}).strict();
const changeCommand = assignCommand.extend({
  reason: z.string().trim().min(1).max(500),
}).strict();
const removeCommand = z.object({
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: uuid,
  reason: z.string().trim().min(1).max(500),
}).strict();

function parse<T>(schema: z.ZodType<T>, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, issues: Object.freeze(result.error.issues.map((issue) => Object.freeze({ field: issue.path.join('.'), code: issue.code }))) };
}

export const parseAnalystQuery = (input: unknown) => parse(analystQuery, input);
export const parseCustodyPassportQuery = (input: unknown) => parse(passportQuery, input);
export const parseAssignCustodyCommand = (input: unknown) => parse(assignCommand, input);
export const parseChangeCustodyCommand = (input: unknown) => parse(changeCommand, input);
export const parseRemoveCustodyCommand = (input: unknown) => parse(removeCommand, input);
