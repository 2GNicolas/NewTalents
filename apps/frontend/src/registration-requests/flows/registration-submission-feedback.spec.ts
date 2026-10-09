import { feedbackForNotice, feedbackForValidation, feedbackForUpload } from './registration-submission-feedback';

describe('safe initial-registration submission feedback', () => {
  it.each([
    ['REPRESENTED_MINOR', 'representative.phone', 'representative', 'Teléfono'],
    ['REPRESENTED_MINOR', 'minor.birthDate', 'minor', 'fecha de nacimiento'],
    ['REPRESENTED_MINOR', 'consent.minorTreatmentAccepted', 'consent', 'tratamiento de datos del menor'],
    ['PERSONAL_ADULT', 'person.documentNumber', 'identity', 'número de documento'],
    ['FORMAL_ACADEMY', 'academy.academyName', 'academy', 'nombre'],
    ['NATURAL_PERSON_ACADEMY', 'academy.responsiblePerson.phone', 'responsible', 'teléfono'],
  ] as const)('maps %s field %s to the named %s control', (type, field, step, expected) => {
    const feedback = feedbackForValidation(type, [{ field, code: 'invalid_type', message: 'unsafe raw server message' }]);
    expect(feedback.step).toBe(step);
    expect(feedback.field).toBe(field);
    expect(feedback.message.toLowerCase()).toContain(expected.toLowerCase());
    expect(feedback.message).not.toContain('unsafe');
  });

  it('names the failed document and preserves a safe retry for antivirus outage', () => {
    expect(feedbackForUpload('REPRESENTED_MINOR', 'REPRESENTATION_AUTHORITY', 'unavailable-backend')).toMatchObject({ step: 'documents', category: 'REPRESENTATION_AUTHORITY' });
    expect(feedbackForUpload('REPRESENTED_MINOR', 'REPRESENTATION_AUTHORITY', 'unavailable-backend').message).toMatch(/representación legal.*reintenta/i);
  });

  it.each([
    ['registration-conflict', 'review', /registro existente/i],
    ['version-conflict', 'review', /cambi.*revisa/i],
    ['session-expired', 'account', /inicia sesi[oó]n/i],
    ['connectivity-failure', 'review', /no se confirm[oó].*reintenta/i],
    ['unavailable-backend', 'review', /no se confirm[oó].*reintenta/i],
    ['invalid-response', 'review', /no se confirm[oó].*reintenta/i],
  ] as const)('maps %s without leaking server details', (notice, step, message) => {
    expect(feedbackForNotice(notice)).toMatchObject({ step, message: expect.stringMatching(message) });
  });

  it('does not falsely attribute a generic duplicate conflict to the email field', () => {
    expect(feedbackForNotice('registration-conflict')).toEqual(expect.objectContaining({ step: 'review' }));
    expect(feedbackForNotice('registration-conflict')).not.toHaveProperty('field');
  });

  it('uses the authorized exact-document message on the concrete field', () => {
    expect(feedbackForValidation('PERSONAL_ADULT', [{ field: 'person.documentNumber', code: 'document_in_use' }])).toEqual({
      field: 'person.documentNumber',
      message: 'Ya existe un registro con este documento',
      step: 'identity',
    });
  });

  it('uses field-specific messages for exact academy-name and email conflicts', () => {
    expect(feedbackForValidation('NATURAL_PERSON_ACADEMY', [{ field: 'academy.academyName', code: 'academy_name_in_use' }])).toEqual({
      field: 'academy.academyName', message: 'Ya existe un registro con este nombre de academia', step: 'academy',
    });
    expect(feedbackForValidation('NATURAL_PERSON_ACADEMY', [{ field: 'credentials.email', code: 'email_in_use' }])).toEqual({
      field: 'credentials.email', message: 'Ya existe un registro con este correo electrónico', step: 'responsible',
    });
  });
});
