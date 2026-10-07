import { Module } from '@nestjs/common';

import { AcademyMembershipModule } from './academy-membership/academy-membership.module.js';
import { AuthorizationModule } from './authorization/authorization.module.js';
import { RuntimeConfigModule } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { PrivilegedChangesModule } from './privileged-changes/privileged-changes.module.js';
import { AuthenticationModule } from './authentication/authentication.module.js';
import { PlayerPassportModule } from './player-passport/player-passport.module.js';
import { RegistrationRequestsModule } from './registration-requests/registration-requests.module.js';
import { PassportCustodyModule } from './passport-custody/passport-custody.module.js';

@Module({
  imports: [
    RuntimeConfigModule,
    HealthModule,
    IdentityModule,
    AcademyMembershipModule,
    AuthorizationModule,
    PrivilegedChangesModule,
    AuthenticationModule,
    PlayerPassportModule,
    RegistrationRequestsModule,
    PassportCustodyModule,
  ],
})
export class AppModule {}
