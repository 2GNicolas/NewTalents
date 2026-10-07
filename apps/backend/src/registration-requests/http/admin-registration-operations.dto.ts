import { z } from 'zod';

type ParseResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; issues: readonly Readonly<{ field: string; code: string }>[] }>;

const requestType = z.enum([
  'PERSONAL_ADULT',
  'REPRESENTED_MINOR',
  'FORMAL_ACADEMY',
  'NATURAL_PERSON_ACADEMY',
  'ADDITIONAL_ACADEMY_ACCOUNT',
  'ACADEMY_ADULT_PLAYER',
  'ACADEMY_MINOR_PLAYER',
]);

const operationsQuery = z.object({
  query: z.string().trim().min(1).max(120).optional(),
  requestType: requestType.optional(),
}).strict();

const reviewProgressCommand = z.object({
  expectedRequestVersion: z.number().int().nonnegative(),
  stage: z.enum(['OPENED', 'REVIEWED']),
}).strict();

const parse = <T>(schema: z.ZodType<T>, input: unknown): ParseResult<T> => {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    issues: Object.freeze(result.error.issues.map((issue) => Object.freeze({ field: issue.path.join('.'), code: issue.code }))),
  };
};

export const parseAdminOperationsQuery = (input: unknown) => parse(operationsQuery, input);
export const parseAdminReviewProgressCommand = (input: unknown) => parse(reviewProgressCommand, input);
