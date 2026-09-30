import { Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';

import { DatabaseModule } from '../database/database.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { AuthenticationModule } from '../authentication/authentication.module.js';
import { BACKEND_RUNTIME_CONFIGURATION } from '../config/config.module.js';
import type { BackendRuntimeConfiguration } from '../config/environment.schema.js';
import { PrismaService } from '../database/prisma.service.js';
import { PlayerPassportModule } from '../player-passport/player-passport.module.js';
import { RegistrationAuthorizationAdapter } from './authorization/registration-authorization.adapter.js';
import { ApplicantRequestService, REGISTRATION_TYPED_REQUEST_APPLICATION } from './application/applicant-request.service.js';
import { ClamAvInstreamScanner } from './evidence/clamav-instream-scanner.js';
import { EvidenceAccessAuditService } from './evidence/evidence-access-audit.service.js';
import { EvidenceDeletionService } from './evidence/evidence-deletion.service.js';
import { EvidenceDeletionWorker } from './evidence/evidence-deletion.worker.js';
import { EvidenceStreamController } from './evidence/evidence-stream.controller.js';
import { EvidenceIngestionService } from './evidence/evidence-ingestion.service.js';
import { LocalPrivateEvidenceStore } from './evidence/local-private-evidence-store.js';
import { PRIVATE_EVIDENCE_STORE, type PrivateEvidenceStore } from './evidence/private-evidence-store.js';
import { S3PrivateEvidenceStore } from './evidence/s3-private-evidence-store.js';
import { RegistrationRequestHistoryService } from './history/registration-request-history.service.js';
import { AdminRegistrationReviewController } from './http/admin-registration-review.controller.js';
import { RegistrationRequestController } from './http/registration-request.controller.js';
import { RegistrationRequestExceptionFilter } from './http/registration-request-exception.filter.js';
import { RegistrationRequestLifecycleService } from './lifecycle/registration-request-lifecycle.service.js';
import { RegistrationRequestRepository } from './persistence/registration-request.repository.js';
import { AdminRegistrationQueryService } from './review/admin-registration-query.service.js';
import { AdminRegistrationReviewService } from './review/admin-registration-review.service.js';
import { AdminRegistrationDecisionService } from './review/admin-registration-decision.service.js';
import { ApprovalExecutionService } from './review/approval-execution.service.js';
import { PrivateDuplicateReviewService } from './review/private-duplicate-review.service.js';
import { RegistrationAgePolicy } from './personal/registration-age-policy.js';
import { PersonalAdultApplicationService } from './personal/personal-adult-application.service.js';
import { RepresentedMinorApplicationService } from './personal/represented-minor-application.service.js';
import { RegistrationDuplicateService } from './duplicates/registration-duplicate.service.js';
import { PersonalAdultApprovalOrchestrator } from './outcomes/personal-adult-approval.orchestrator.js';
import { RepresentedMinorApprovalOrchestrator } from './outcomes/represented-minor-approval.orchestrator.js';
import { PersonalRegistrationTypedRequestApplication } from './personal/personal-registration-typed-request.application.js';
import { FormalAcademyApplicationService } from './academy/formal-academy-application.service.js';
import { NaturalPersonAcademyApplicationService } from './academy/natural-person-academy-application.service.js';
import { AdditionalAcademyAccountService } from './academy/additional-academy-account.service.js';
import { AcademyAdultPlayerService } from './academy/academy-adult-player.service.js';
import { AcademyMinorPlayerService } from './academy/academy-minor-player.service.js';
import { AcademyDuplicateService } from './duplicates/academy-duplicate.service.js';
import { RegistrationExactConflictService } from './duplicates/registration-exact-conflict.service.js';
import { FormalAcademyApprovalOrchestrator } from './outcomes/formal-academy-approval.orchestrator.js';
import { NaturalPersonAcademyApprovalOrchestrator } from './outcomes/natural-person-academy-approval.orchestrator.js';
import { AdditionalAcademyAccountApprovalOrchestrator } from './outcomes/additional-academy-account-approval.orchestrator.js';
import { AcademyAdultPlayerApprovalOrchestrator } from './outcomes/academy-adult-player-approval.orchestrator.js';
import { AcademyMinorPlayerApprovalOrchestrator } from './outcomes/academy-minor-player-approval.orchestrator.js';

@Module({
  imports: [DatabaseModule, AuthorizationModule, AuthenticationModule, PlayerPassportModule],
  controllers: [RegistrationRequestController, AdminRegistrationReviewController, EvidenceStreamController],
  providers: [
    RegistrationAuthorizationAdapter,
    RegistrationRequestRepository,
    { provide: RegistrationRequestLifecycleService, inject: [RegistrationRequestRepository], useFactory: (repository: RegistrationRequestRepository) => new RegistrationRequestLifecycleService(repository) },
    RegistrationRequestHistoryService,
    AdminRegistrationQueryService,
    AdminRegistrationReviewService,
    AdminRegistrationDecisionService,
    ApprovalExecutionService,
    PrivateDuplicateReviewService,
    ApplicantRequestService,
    RegistrationRequestExceptionFilter,
    RegistrationAgePolicy,
    PersonalAdultApplicationService,
    RepresentedMinorApplicationService,
    FormalAcademyApplicationService,
    NaturalPersonAcademyApplicationService,
    AdditionalAcademyAccountService,
    AcademyAdultPlayerService,
    AcademyMinorPlayerService,
    RegistrationDuplicateService,
    AcademyDuplicateService,
    RegistrationExactConflictService,
    FormalAcademyApprovalOrchestrator,
    NaturalPersonAcademyApprovalOrchestrator,
    AdditionalAcademyAccountApprovalOrchestrator,
    AcademyAdultPlayerApprovalOrchestrator,
    AcademyMinorPlayerApprovalOrchestrator,
    PersonalAdultApprovalOrchestrator,
    RepresentedMinorApprovalOrchestrator,
    PersonalRegistrationTypedRequestApplication,
    { provide: REGISTRATION_TYPED_REQUEST_APPLICATION, useExisting: PersonalRegistrationTypedRequestApplication },
    EvidenceAccessAuditService,
    {
      provide: PRIVATE_EVIDENCE_STORE,
      inject: [BACKEND_RUNTIME_CONFIGURATION],
      useFactory: (configuration: BackendRuntimeConfiguration): PrivateEvidenceStore => {
        const evidence = configuration.registration.evidence;
        if (evidence.provider === 'local') {
          if (!evidence.privateRoot) throw new Error('Private evidence root is unavailable');
          return new LocalPrivateEvidenceStore(evidence.privateRoot);
        }
        if (!evidence.bucket || !evidence.region || !evidence.encryption) throw new Error('Private S3 evidence configuration is unavailable');
        return new S3PrivateEvidenceStore(new S3Client({ region: evidence.region }), {
          bucket: evidence.bucket,
          region: evidence.region,
          encryption: evidence.encryption,
        });
      },
    },
    {
      provide: EvidenceIngestionService,
      inject: [PRIVATE_EVIDENCE_STORE, BACKEND_RUNTIME_CONFIGURATION],
      useFactory: (store: PrivateEvidenceStore, configuration: BackendRuntimeConfiguration) => new EvidenceIngestionService(
        store,
        new ClamAvInstreamScanner(configuration.registration.scanner),
        { maxItemBytes: configuration.registration.evidence.maxItemBytes, maxRequestBytes: configuration.registration.evidence.maxRequestBytes },
      ),
    },
    {
      provide: EvidenceDeletionService,
      inject: [PrismaService, PRIVATE_EVIDENCE_STORE, RegistrationAuthorizationAdapter, BACKEND_RUNTIME_CONFIGURATION],
      useFactory: (prisma: PrismaService, store: PrivateEvidenceStore, authorization: RegistrationAuthorizationAdapter, configuration: BackendRuntimeConfiguration) =>
        new EvidenceDeletionService(prisma, store, authorization, { ...configuration.registration.deletion, maxAttempts: 5 }),
    },
    EvidenceDeletionWorker,
  ],
  exports: [RegistrationAuthorizationAdapter, RegistrationRequestRepository, RegistrationRequestLifecycleService, RegistrationRequestHistoryService, ApplicantRequestService, AdminRegistrationQueryService, AdminRegistrationReviewService, AdminRegistrationDecisionService, ApprovalExecutionService, PrivateDuplicateReviewService, PersonalAdultApplicationService, RepresentedMinorApplicationService, FormalAcademyApplicationService, NaturalPersonAcademyApplicationService, AdditionalAcademyAccountService, AcademyAdultPlayerService, AcademyMinorPlayerService, RegistrationDuplicateService, AcademyDuplicateService, PersonalAdultApprovalOrchestrator, RepresentedMinorApprovalOrchestrator, FormalAcademyApprovalOrchestrator, NaturalPersonAcademyApprovalOrchestrator, AdditionalAcademyAccountApprovalOrchestrator, AcademyAdultPlayerApprovalOrchestrator, AcademyMinorPlayerApprovalOrchestrator, PRIVATE_EVIDENCE_STORE, EvidenceIngestionService, EvidenceDeletionService, EvidenceDeletionWorker],
})
export class RegistrationRequestsModule {}
