import { Redirect, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { RegistrationEvidenceUploadQueue } from '../../../src/registration-requests/evidence/upload-queue';
import { ApplicantStatusFlow } from '../../../src/registration-requests/flows/applicant-status-flow';

export default function ApplicantStatusPreviewScreen() {
  const params = useLocalSearchParams<{ state?: string }>();
  const queue = useMemo(() => new RegistrationEvidenceUploadQueue({ transport: { upload: async () => ({ kind: 'unavailable-backend' }) } }), []);
  if (!__DEV__) return <Redirect href="/(public)/registration" />;
  const submitted = params.state === 'submitted';
  return <ApplicantStatusFlow
    onRefreshCapabilities={() => undefined}
    onResubmit={() => false}
    onRetryRestore={() => undefined}
    readOnly
    state={{
      phase: 'ready', draft: null, validationIssues: [],
      snapshot: {
        id: '00600000-0000-4000-8000-000000002841', type: 'PERSONAL_ADULT', status: submitted ? 'SUBMITTED' : 'REQUIRES_CORRECTION', version: 3,
        capabilities: ['registration.request.own.view'], createdAt: '2026-09-23T12:00:00.000Z', submittedAt: '2026-09-23T12:05:00.000Z',
        correctionRequired: !submitted,
        ...(submitted ? { evidenceComplete: true, evidence: [] } : {
          safeReason: 'El reverso del documento no permite verificar la información con claridad. Carga una imagen más nítida y completa.',
          evidenceComplete: false,
          evidence: [{ id: 'preview-evidence', category: 'IDENTITY_BACK' as const, status: 'CLEAN' as const, sizeBytes: 248000, correctionRequired: true }],
        }),
      },
    }}
    uploadQueue={queue}
  />;
}
