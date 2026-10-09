import type { AllowanceCadence, CalendarDate } from './allowance-period.js';

export type { AllowanceCadence, CalendarDate } from './allowance-period.js';

/** Absence of an aggregate is UNCONFIGURED, never a zero-match allowance. */
export type AllowanceState =
  | Readonly<{ kind: 'UNCONFIGURED'; version: 0 }>
  | Readonly<{
      kind: 'CONFIGURED';
      version: number;
      activatedOn: CalendarDate;
      current: Readonly<{ cadence: AllowanceCadence; matchLimit: number }>;
    }>;

export type AllowanceRevisionSnapshot = Readonly<{
  cadence: AllowanceCadence;
  matchLimit: number;
  effectiveOn: CalendarDate;
}>;
