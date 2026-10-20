import { describe, expect, it } from 'vitest';

import { validateConfirmUpload, ConfirmUploadValidationError } from './confirm-upload-validation.js';

const context = Object.fromEntries(['spatial', 'temporal', 'competitive', 'pressure', 'positional']
  .map((key) => [key, { status: 'NOT_OBSERVABLE' }]));
const event = { sequence: 1, eventType: 'GOAL', result: 'NONE', videoMinute: '90+7', context: {}, complexity: {} };
const base = { expectedVersion: 1, participation: 'PARTICIPATED', totalMinutesPlayed: 97,
  youtubeUrl: 'https://youtu.be/Feature011TestVideo', events: [event] };

describe('Feature 011 final upload validation', () => {
  it('accepts added time, late substitute and optional observation without scoring', () => {
    expect(validateConfirmUpload(base).totalMinutesPlayed).toBe(97);
    expect(validateConfirmUpload({ ...base, totalMinutesPlayed: 12 }).events[0]?.videoMinute).toBe('90+7');
    expect(validateConfirmUpload({ ...base, events: [{ ...event, observation: '' }] }).events[0]?.observation).toBe('');
    expect(validateConfirmUpload({ ...base, events: [{ ...event, observation: 'Visible en video' }] }).events[0]?.observation)
      .toBe('Visible en video');
    expect(validateConfirmUpload({ ...base, events: [{ ...event, eventType: 'ASSIST' }] }).events[0]?.eventType)
      .toBe('ASSIST');
    expect(validateConfirmUpload({ ...base, participation: 'DID_NOT_PARTICIPATE', totalMinutesPlayed: 0, events: [] }).events)
      .toEqual([]);
  });

  it('confirms an explicitly failed measured type without fabricated measurements', () => {
    const failed = { ...event, eventType: 'CROSS', result: 'FAILURE', context: {}, complexity: {} };
    expect(validateConfirmUpload({ ...base, events: [failed] }).events[0]).toMatchObject(failed);
    expect(() => validateConfirmUpload({ ...base, events: [{ ...failed, result: 'SUCCESS' }] }))
      .toThrow(ConfirmUploadValidationError);
  });

  it('rejects incoherent participation, incomplete events, and invalid minutes', () => {
    for (const input of [
      { ...base, events: [] }, { ...base, totalMinutesPlayed: 0 }, { ...base, totalMinutesPlayed: -1 },
      { ...base, totalMinutesPlayed: 1.5 }, { ...base, totalMinutesPlayed: '97' },
      { ...base, totalMinutesPlayed: undefined }, { ...base, events: [{ ...event, context: { ...context, spatial: { status: 'UNSET' } } }] },
      { ...base, events: [{ ...event, observation: 7 }] },
      { ...base, participation: 'DID_NOT_PARTICIPATE', totalMinutesPlayed: 0 },
      { ...base, participation: 'DID_NOT_PARTICIPATE', totalMinutesPlayed: 1, events: [] },
    ]) expect(() => validateConfirmUpload(input)).toThrow(ConfirmUploadValidationError);
  });

  it('accepts only a genuine HTTPS YouTube video URL, bounded by 2048 characters', () => {
    for (const url of ['https://www.youtube.com/watch?v=abc', 'https://m.youtube.com/shorts/abc',
      'https://youtu.be/abc']) expect(validateConfirmUpload({ ...base, youtubeUrl: url }).youtubeUrl).toBe(url);
    for (const url of ['', 'http://youtu.be/abc', 'https://youtube.com.evil.test/watch?v=abc',
      'https://youtube.com/', 'https://youtu.be/', 'https://example.com/watch?v=abc',
      `https://youtu.be/${'a'.repeat(2049)}`]) {
      expect(() => validateConfirmUpload({ ...base, youtubeUrl: url })).toThrow(ConfirmUploadValidationError);
    }
  });
});
