import { useMemo, type ReactNode } from 'react';
import { useAuthentication } from '../../authentication/authentication-provider';
import type { RegistrationEvidenceUploadQueue } from '../evidence/upload-queue';
import type { EvidenceCategory } from '../evidence/upload-queue';
import type { RegistrationDraft } from '../registration-request-api';
import { RegistrationRequestProvider, useRegistrationRequest } from '../registration-request-state';
import { RegistrationSubmissionCoordinator } from './registration-submission';
import type { SubmissionFailureStep } from './registration-submission-feedback';

export type FlowOperations = Readonly<{ onSave: (draft: RegistrationDraft, identityFields?: readonly string[]) => Promise<readonly Readonly<{ field: string; code: string; message: string }>[] >; onSubmit: (draft: RegistrationDraft) => Promise<boolean>; getSubmissionError: () => string | null; getSubmissionFailureStep: () => SubmissionFailureStep | null; getSubmissionFailureField: () => string | null; getSubmissionFailureCategory: () => EvidenceCategory | null; getSubmittedRequestId: () => string | null; evidenceQueue: RegistrationEvidenceUploadQueue; readOnly: boolean }>;
export function createFlowOperations(coordinator: RegistrationSubmissionCoordinator, evidenceQueue: RegistrationEvidenceUploadQueue, readOnly: boolean): FlowOperations {
  return Object.freeze({
    onSave: async (draft, identityFields = []) => { if (readOnly) return []; coordinator.saveLocal(draft); return coordinator.validateStep(draft, identityFields); },
    onSubmit: async (draft) => readOnly ? false : coordinator.submit(draft),
    getSubmissionError: () => coordinator.failure,
    getSubmissionFailureStep: () => coordinator.failureStep,
    getSubmissionFailureField: () => coordinator.failureField,
    getSubmissionFailureCategory: () => coordinator.failureCategory,
    getSubmittedRequestId: () => coordinator.submittedRequestId,
    evidenceQueue,
    readOnly,
  });
}
function Owner({ children, readOnly }: Readonly<{ children: (operations: FlowOperations) => ReactNode; readOnly: boolean }>) {
  const { machine, uploadQueue } = useRegistrationRequest();
  const authentication = useAuthentication();
  const coordinator = useMemo(() => new RegistrationSubmissionCoordinator(machine, uploadQueue, async ({ email, password }) => {
    const access = await authentication.login({ email, password }, { deferAccessProjection: true });
    return { authenticated: authentication.getAccessToken() !== null, ...(access?.requestId ? { requestId: access.requestId } : {}) };
  }, undefined, authentication.refreshCapabilities, authentication.getAccessToken), [authentication, machine, uploadQueue]);
  return <>{children(createFlowOperations(coordinator, uploadQueue, readOnly))}</>;
}
export function RegistrationFlowRoute({ children, readOnly = false }: Readonly<{ children: (operations: FlowOperations) => ReactNode; readOnly?: boolean }>) { return <RegistrationRequestProvider><Owner readOnly={readOnly}>{children}</Owner></RegistrationRequestProvider>; }
