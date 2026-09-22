import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { AuthenticationController } from './authentication.controller.js';
import { AuthenticationGuard } from './authentication.guard.js';
import { AuthenticationService } from './authentication.service.js';
import { AttemptControlService, ATTEMPT_TRUSTED_PROXY } from './attempt-control.service.js';
import { AuthenticationTransactionService } from './authentication-transaction.service.js';
import { CredentialService } from './credential.service.js';
import { CredentialReplacementService, FIRST_SESSION_ISSUER } from './credential-replacement.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { SecurityEventService } from './security-event.service.js';
import { SessionService } from './session.service.js';
import { TemporaryCredentialService } from './temporary-credential.service.js';
import { TokenService } from './token.service.js';
import { AuthorizationAdapter } from './authorization.adapter.js';
import { AdministratorBootstrapService } from './administrator-bootstrap.service.js';
import { AdministratorRecoveryService } from './administrator-recovery.service.js';
import { BACKEND_RUNTIME_CONFIGURATION } from '../config/config.module.js';
@Module({ imports: [DatabaseModule, AuthorizationModule], controllers: [AuthenticationController], providers: [CredentialService, AuthenticationTransactionService, SecurityEventService, SessionService, { provide: FIRST_SESSION_ISSUER, useExisting: SessionService }, TokenService, RefreshTokenService, TemporaryCredentialService, CredentialReplacementService, { provide: ATTEMPT_TRUSTED_PROXY, useFactory: (configuration: { authentication: { trustedProxy: boolean } }) => configuration.authentication.trustedProxy, inject: [BACKEND_RUNTIME_CONFIGURATION] }, AttemptControlService, AuthenticationService, AuthenticationGuard, AuthorizationAdapter, AdministratorBootstrapService, AdministratorRecoveryService, { provide: TokenService, useFactory: (configuration: never) => new TokenService(configuration), inject: [BACKEND_RUNTIME_CONFIGURATION] }], exports: [AuthenticationService, AuthenticationGuard, TokenService, SessionService, AuthorizationAdapter, AdministratorBootstrapService, AdministratorRecoveryService, CredentialService, AuthenticationTransactionService] })
export class AuthenticationModule {}
