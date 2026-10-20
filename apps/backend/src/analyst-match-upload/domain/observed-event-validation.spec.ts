import { describe, expect, it } from 'vitest';

import { EVENT_RESULT_CATALOG, OBSERVED_EVENT_CATALOG_VERSION,
  validateObservedEvent } from './observed-event-validation.js';

const context = {
  spatial: { status: 'OBSERVED', value: 'zona central' },
  temporal: { status: 'NOT_OBSERVABLE' },
  competitive: { status: 'OBSERVED', value: 'partido igualado' },
  pressure: { status: 'OBSERVED', value: 'presión visible' },
  positional: { status: 'OBSERVED', value: 'defensa' },
};
const complexity = {
  technicalDifficulty: { status: 'OBSERVED', value: 'LOW' },
  distance: { status: 'NOT_APPLICABLE' },
  precision: { status: 'NOT_OBSERVABLE' },
  executionSpeed: { status: 'OBSERVED', value: 'MEDIUM' },
  opponents: { status: 'OBSERVED', value: 'NONE' },
  nonDominantLimb: { status: 'OBSERVED', value: 'NO' },
  risk: { status: 'OBSERVED', value: 'HIGH' },
};
const base = { sequence: 1, eventType: 'PASS', variant: 'THROUGH', result: 'SUCCESS', videoMinute: '90+7',
  period: 'segundo tiempo', addedTime: 7, context, complexity };

describe('observed event validation', () => {
  it('accepts Gol and Asistencia without measurements but keeps other events strict', () => {
    for (const eventType of ['GOAL', 'ASSIST']) {
      const event = { sequence: 1, eventType, result: 'NONE', videoMinute: '17', context: {}, complexity: {} };
      expect(validateObservedEvent(event)).toMatchObject(event);
      expect(() => validateObservedEvent({ ...event, context })).toThrow();
    }
    expect(() => validateObservedEvent({ sequence: 1, eventType: 'SHOT', result: 'WIDE',
      videoMinute: '17', context: {}, complexity: {} })).toThrow();
  });
  it('accepts FAILURE without guided measurements but requires them for SUCCESS', () => {
    for (const eventType of ['PASS', 'CROSS', 'RECEPTION', 'SAVE']) {
      const failed = { sequence: 1, eventType, result: 'FAILURE', videoMinute: '34',
        ...(eventType === 'PASS' ? { variant: 'NORMAL' } : {}), context: {}, complexity: {} };
      expect(validateObservedEvent(failed)).toMatchObject(failed);
      expect(() => validateObservedEvent({ ...failed, context })).toThrow();
    }
    expect(() => validateObservedEvent({ ...base, context: {}, complexity: {} })).toThrow();
  });
  it('accepts every approved type/result pair and rejects every unapproved result', () => {
    expect(OBSERVED_EVENT_CATALOG_VERSION).toBe(1);
    expect(Object.keys(EVENT_RESULT_CATALOG)).toHaveLength(22);
    for (const [eventType, results] of Object.entries(EVENT_RESULT_CATALOG)) {
      for (const result of results) {
        const input = { ...base, eventType, result,
          ...(eventType === 'GOAL' || eventType === 'ASSIST' || result === 'FAILURE' ? { context: {}, complexity: {} } : {}),
          ...(eventType === 'PASS' ? { variant: 'NORMAL' } : { variant: undefined }),
          ...(eventType === 'SAVE' && result !== 'FAILURE' ? { goalkeeperDetail: {
            handUsed: { status: 'OBSERVED', value: 'BOTH' }, handChanged: { status: 'NOT_APPLICABLE' },
          } } : {}),
        };
        expect(validateObservedEvent(input).eventType).toBe(eventType);
        expect(() => validateObservedEvent({ ...input, result: 'NOT_IN_CATALOG' })).toThrow();
      }
    }
  });

  it('keeps video minute, period, added time and distinct context/complexity absences', () => {
    expect(validateObservedEvent(base)).toMatchObject({ videoMinute: '90+7', period: 'segundo tiempo', addedTime: 7,
      context: { temporal: { status: 'NOT_OBSERVABLE' } },
      complexity: { distance: { status: 'NOT_APPLICABLE' }, precision: { status: 'NOT_OBSERVABLE' } } });
    expect(() => validateObservedEvent({ ...base, context: { ...context, temporal: { status: 'NOT_APPLICABLE' } } })).toThrow();
    expect(() => validateObservedEvent({ ...base, context: { ...context, pressure: undefined } })).toThrow();
    expect(() => validateObservedEvent({ ...base, complexity: { ...complexity, nonDominantLimb: { status: 'OBSERVED', value: 'LOW' } } })).toThrow();
    expect(() => validateObservedEvent({ ...base, videoMinute: 'unknown' })).toThrow();
  });

  it('accepts each descriptive context choice offered by the capture UI without inferring a temporal band', () => {
    const choices = {
      spatial: ['Área propia', 'Primer tercio', 'Zona media', 'Último tercio', 'Área rival'],
      temporal: ['Primer 20 %', '20 % a menos de 40 %', '40 % a menos de 60 %',
        '60 % a menos de 80 %', 'Desde el 80 %'],
      competitive: ['Ganando', 'Empatando', 'Perdiendo'],
      pressure: ['Sin presión', 'Baja', 'Media', 'Alta'],
      positional: ['Arquero', 'Central', 'Lateral', 'Volante', 'Extremo', 'Delantero'],
    } as const;
    for (const [key, values] of Object.entries(choices)) {
      for (const value of values) {
        const event = validateObservedEvent({ ...base, context: { ...context, [key]: { status: 'OBSERVED', value } } });
        expect(event.context[key as keyof typeof choices]).toEqual({ status: 'OBSERVED', value });
        expect(event.videoMinute).toBe('90+7');
      }
    }
  });

  it('requires pass variant and SAVE hand facts but never turns an event into another', () => {
    expect(() => validateObservedEvent({ ...base, variant: undefined })).toThrow();
    expect(() => validateObservedEvent({ ...base, variant: 'THROUGH', eventType: 'CROSS' })).toThrow();
    expect(() => validateObservedEvent({ ...base, eventType: 'SAVE', variant: undefined, result: 'SUCCESS' })).toThrow();
    expect(() => validateObservedEvent({ ...base, score: 7 })).toThrow();
    expect(() => validateObservedEvent({ ...base, eventType: 'DRIVE' })).toThrow();
  });
});
