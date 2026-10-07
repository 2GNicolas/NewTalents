import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../authentication/authentication.module.js';
import { AcademyMembershipModule } from '../academy-membership/academy-membership.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { BACKEND_RUNTIME_CONFIGURATION } from '../config/config.module.js';
import type { BackendRuntimeConfiguration } from '../config/environment.schema.js';
import { DatabaseModule } from '../database/database.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { DuplicateReviewService } from './duplicate-review/duplicate-review.service.js';
import { PassportAuthorizationAdapter } from './passport-authorization/passport-authorization.adapter.js';
import { PassportController, PassportRepresentationController } from './http/passport.controller.js';
import { PassportLifecycleService } from './passport-lifecycle/passport-lifecycle.service.js';
import { PassportTraceService } from './passport-lifecycle/passport-trace.service.js';
import { PassportTransactionRunner } from './passport-lifecycle/transaction-runner.js';
import { PassportTransitionService } from './passport-lifecycle/passport-transition.service.js';
import { PASSPORT_KEY_MATERIAL } from './passport-key.token.js';
import { loadPassportKeys, type PassportKeyMaterial } from './player-private-identity/passport-keys.js';
import { PrivateIdentityService } from './player-private-identity/private-identity.service.js';
import { PassportAgePolicyService } from './age-policy/passport-age-policy.service.js';
import { RepresentativeConfirmationService } from './representation/representative-confirmation.service.js';
import { PassportResponsibilityService } from './responsibility/passport-responsibility.service.js';
import { HistoricalTutorReconciliationService } from './reconciliation/historical-tutor-reconciliation.service.js';
import { PlayerPassportService } from './player-passport.service.js';
import { LocalReviewProvisioningService } from './review-environment/local-review-provisioning.service.js';

@Module({
  imports: [DatabaseModule, AuthorizationModule, AuthenticationModule, AcademyMembershipModule, IdentityModule],
  controllers: [PassportController, PassportRepresentationController],
  providers: [
    {
      provide: PASSPORT_KEY_MATERIAL,
      inject: [BACKEND_RUNTIME_CONFIGURATION],
      useFactory: (configuration: BackendRuntimeConfiguration): PassportKeyMaterial => loadPassportKeys({
        PASSPORT_DOCUMENT_HMAC_KEY: configuration.passport.documentHmacKey,
        PASSPORT_NAME_DOB_HMAC_KEY: configuration.passport.nameDobHmacKey,
        PASSPORT_PRIVATE_ENCRYPTION_KEY: configuration.passport.privateEncryptionKey,
      }),
    },
    {
      provide: PrivateIdentityService,
      inject: [PASSPORT_KEY_MATERIAL],
      useFactory: (keys: PassportKeyMaterial): PrivateIdentityService => new PrivateIdentityService(keys),
    },
    PassportAuthorizationAdapter,
    PassportLifecycleService,
    PassportTransitionService,
    PassportTraceService,
    DuplicateReviewService,
    PassportTransactionRunner,
    PassportAgePolicyService,
    RepresentativeConfirmationService,
    PassportResponsibilityService,
    HistoricalTutorReconciliationService,
    PlayerPassportService,
    LocalReviewProvisioningService,
  ],
  exports: [PASSPORT_KEY_MATERIAL, PrivateIdentityService, PassportTransactionRunner, PassportAuthorizationAdapter, PassportAgePolicyService, RepresentativeConfirmationService, PassportResponsibilityService, HistoricalTutorReconciliationService, PlayerPassportService, LocalReviewProvisioningService],
})
export class PlayerPassportModule {}
