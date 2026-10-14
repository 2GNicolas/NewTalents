import { z } from 'zod';

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
});
const label = z.string().min(1).max(160).refine((value) => value.trim().length > 0);
const mutationFields = {
  idempotencyKey: uuid,
};
const matchFields = {
  matchDate: date,
  matchTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  opponent: label,
  competition: label,
  venue: label,
};
const scheduleSchema = z.object({ expectedVersion: z.literal(0), ...mutationFields, ...matchFields }).strict();
const rescheduleSchema = z.object({ expectedVersion: z.number().int().positive(), ...mutationFields, ...matchFields }).strict();
const cancelSchema = z.object({ expectedVersion: z.number().int().positive(), ...mutationFields }).strict();

export type ScheduleFields = z.infer<typeof scheduleSchema>;
export type RescheduleFields = z.infer<typeof rescheduleSchema>;
export type CancelFields = z.infer<typeof cancelSchema>;

export function parseScheduleCommand(input: unknown): { ok: true; value: ScheduleFields } | { ok: false } {
  const parsed = scheduleSchema.safeParse(input);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
}

export function parseRescheduleCommand(input: unknown): { ok: true; value: RescheduleFields } | { ok: false } {
  const parsed = rescheduleSchema.safeParse(input);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
}

export function parseCancelCommand(input: unknown): { ok: true; value: CancelFields } | { ok: false } {
  const parsed = cancelSchema.safeParse(input);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
}

export function parseMatchDate(input: unknown): string | null {
  const parsed = date.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function validPassportId(input: unknown): input is string {
  return uuid.safeParse(input).success;
}
