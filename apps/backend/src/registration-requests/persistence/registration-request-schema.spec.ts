import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(fileURLToPath(new URL('../../../prisma/schema.prisma', import.meta.url)), 'utf8');

describe('Feature 006 registration request Prisma schema', () => {
  it('declares exactly the seven request types and the five product lifecycle states', () => {
    expect(enumValues('RegistrationRequestType')).toEqual([
      'PERSONAL_ADULT',
      'REPRESENTED_MINOR',
      'FORMAL_ACADEMY',
      'NATURAL_PERSON_ACADEMY',
      'ADDITIONAL_ACADEMY_ACCOUNT',
      'ACADEMY_ADULT_PLAYER',
      'ACADEMY_MINOR_PLAYER',
    ]);
    expect(enumValues('RegistrationRequestStatus')).toEqual([
      'DRAFT',
      'SUBMITTED',
      'REQUIRES_CORRECTION',
      'APPROVED',
      'REJECTED',
    ]);
  });

  it('keeps lifecycle state separate from evidence, approval, and deletion execution state', () => {
    expect(enumValues('EvidenceStatus')).toEqual([
      'QUARANTINED', 'SCANNING', 'CLEAN', 'REJECTED', 'REPLACED', 'DELETION_PENDING', 'DELETED',
    ]);
    expect(enumValues('ApprovalExecutionStatus')).toEqual([
      'NONE', 'PREPARED', 'DELETING_EVIDENCE', 'READY_TO_FINALIZE', 'FINALIZED', 'RECOVERY_REQUIRED',
    ]);
    expect(enumValues('EvidenceDeletionStatus')).toEqual(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'RECOVERY_REQUIRED']);
  });

  it('models one explicit detail relation for each request type and optimistic versioning', () => {
    const request = modelBody('RegistrationRequest');
    expect(request).toMatch(/\bversion\s+Int\s+@default\(0\)/);
    for (const relation of [
      'personalAdultDetail',
      'representedMinorDetail',
      'formalAcademyDetail',
      'naturalPersonAcademyDetail',
      'additionalAcademyAccountDetail',
      'academyAdultPlayerDetail',
      'academyMinorPlayerDetail',
    ]) expect(request).toContain(relation);
    for (const model of [
      'PersonalAdultRequestDetail',
      'RepresentedMinorRequestDetail',
      'FormalAcademyRequestDetail',
      'NaturalPersonAcademyRequestDetail',
      'AdditionalAcademyAccountRequestDetail',
      'AcademyAdultPlayerRequestDetail',
      'AcademyMinorPlayerRequestDetail',
    ]) expect(modelBody(model)).toContain('requestId');
  });

  it('contains pending access, metadata-only evidence, immutable records, and no document payload fields', () => {
    for (const model of [
      'RegistrationApplicantAccess', 'RegistrationEvidenceItem', 'RegistrationConsentRecord',
      'RegistrationReviewDecision', 'RegistrationManualDossierConfirmation',
      'RegistrationApprovalExecution', 'RegistrationEvidenceDeletionRecord', 'RegistrationRequestEvent',
    ]) expect(schema).toContain(`model ${model} {`);
    const evidence = modelBody('RegistrationEvidenceItem');
    expect(evidence).toContain('objectKey');
    expect(evidence).toContain('contentDigest');
    expect(evidence).not.toMatch(/\b(bytes|base64|publicUrl|password)\b/i);
    expect(modelBody('RegistrationRequestEvent')).not.toMatch(/document|birth|contact|evidenceContent|password|base64/i);
  });
});

function enumValues(name: string): string[] {
  const match = schema.match(new RegExp(`enum ${name} \\{([\\s\\S]*?)\\}`));
  if (!match?.[1]) throw new Error(`Missing enum ${name}`);
  return match[1].split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function modelBody(name: string): string {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!match?.[1]) throw new Error(`Missing model ${name}`);
  return match[1];
}
