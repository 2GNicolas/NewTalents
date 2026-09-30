import { Injectable } from '@nestjs/common';

export type RegistrationAgeClassification = 'MINOR' | 'ADULT';
export type PersonalRegistrationRoute = 'PERSONAL_ADULT' | 'REPRESENTED_MINOR';

@Injectable()
export class RegistrationAgePolicy {
  evaluate(input: Readonly<{ dateOfBirth: string; operationInstant?: Date; clientIsAdult?: unknown }>): Readonly<{ classification: RegistrationAgeClassification; age: number; operationDate: string }> {
    if (input.clientIsAdult !== undefined) throw new Error('CLIENT_AGE_AUTHORITY_FORBIDDEN');
    const birth = this.validBirthDate(input.dateOfBirth);
    const operation = this.colombiaDate(input.operationInstant ?? new Date());
    if (birth.getTime() > operation.getTime()) throw new Error('INVALID_DATE_OF_BIRTH');
    let age = operation.getUTCFullYear() - birth.getUTCFullYear();
    const leapAnniversary = birth.getUTCMonth() === 1 && birth.getUTCDate() === 29 && !this.isLeap(operation.getUTCFullYear());
    const anniversaryMonth = leapAnniversary ? 2 : birth.getUTCMonth();
    const anniversaryDay = leapAnniversary ? 1 : birth.getUTCDate();
    if (operation.getUTCMonth() < anniversaryMonth || (operation.getUTCMonth() === anniversaryMonth && operation.getUTCDate() < anniversaryDay)) age -= 1;
    return Object.freeze({ classification: age >= 18 ? 'ADULT' : 'MINOR', age, operationDate: operation.toISOString().slice(0, 10) });
  }

  routeCompatibility(route: PersonalRegistrationRoute, dateOfBirth: string, operationInstant = new Date()): Readonly<{ compatible: boolean; classification: RegistrationAgeClassification }> {
    const { classification } = this.evaluate({ dateOfBirth, operationInstant });
    return Object.freeze({ classification, compatible: route === 'PERSONAL_ADULT' ? classification === 'ADULT' : classification === 'MINOR' });
  }

  private validBirthDate(value: string): Date {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('INVALID_DATE_OF_BIRTH');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('INVALID_DATE_OF_BIRTH');
    return date;
  }

  private colombiaDate(instant: Date): Date {
    if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) throw new Error('INVALID_OPERATION_DATE');
    const shifted = new Date(instant.getTime() - 5 * 60 * 60 * 1000);
    return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
  }

  private isLeap(year: number): boolean { return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0); }
}
