import { Injectable } from '@nestjs/common';

export type PassportAgeClassification = 'MINOR' | 'ADULT';

@Injectable()
export class PassportAgePolicyService {
  classify(dateOfBirth: Date | string, evaluationDate: Date = new Date()): PassportAgeClassification {
    const birth = this.toUtcDate(dateOfBirth);
    const evaluation = this.toBogotaDate(evaluationDate);
    if (!birth || birth > evaluation) throw new Error('INVALID_DATE_OF_BIRTH');
    let age = evaluation.getUTCFullYear() - birth.getUTCFullYear();
    const isLeapDayInNonLeapYear = birth.getUTCDate() === 29 && birth.getUTCMonth() === 1 && !this.isLeap(evaluation.getUTCFullYear());
    const anniversaryMonth = isLeapDayInNonLeapYear ? 2 : birth.getUTCMonth();
    const anniversaryDay = isLeapDayInNonLeapYear ? 1 : birth.getUTCDate();
    if (evaluation.getUTCMonth() < anniversaryMonth || (evaluation.getUTCMonth() === anniversaryMonth && evaluation.getUTCDate() < anniversaryDay)) age -= 1;
    return age >= 18 ? 'ADULT' : 'MINOR';
  }

  private toUtcDate(value: Date | string): Date | null {
    const date = value instanceof Date ? new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())) : new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toBogotaDate(value: Date): Date {
    const shifted = new Date(value.getTime() - (5 * 60 * 60 * 1000));
    return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
  }

  private isLeap(year: number): boolean { return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0); }
}
