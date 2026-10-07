import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../authentication/authentication.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { PASSPORT_KEY_MATERIAL } from '../player-passport/passport-key.token.js';
import { decryptPassportValue } from '../player-passport/player-private-identity/passport-crypto.js';
import type { PassportKeyMaterial } from '../player-passport/player-private-identity/passport-keys.js';
import { PlayerPassportModule } from '../player-passport/player-passport.module.js';
import { PassportCustodyCommandService } from './application/passport-custody-command.service.js';
import { PassportCustodyDetailService } from './application/passport-custody-detail.service.js';
import { AnalystPassportsQueryService } from './application/analyst-passports-query.service.js';
import { PASSPORT_CUSTODY_LABEL_DECRYPTOR, PassportCustodyQueryService, type PassportCustodyLabelDecryptor } from './application/passport-custody-query.service.js';
import { PassportCustodyAuthorizationAdapter } from './authorization/passport-custody-authorization.adapter.js';
import { PassportCustodyController } from './http/passport-custody.controller.js';
import { AnalystPassportsController } from './http/analyst-passports.controller.js';
import { PassportCustodyExceptionFilter } from './http/passport-custody-exception.filter.js';
import { PassportCustodyRepository } from './persistence/passport-custody.repository.js';
import { PassportCustodyTransactionRunner } from './persistence/passport-custody-transaction.runner.js';

@Module({
  imports: [DatabaseModule, AuthorizationModule, AuthenticationModule, IdentityModule, PlayerPassportModule],
  controllers: [PassportCustodyController, AnalystPassportsController],
  providers: [
    PassportCustodyRepository,
    AnalystPassportsQueryService,
    PassportCustodyQueryService,
    PassportCustodyDetailService,
    PassportCustodyCommandService,
    PassportCustodyTransactionRunner,
    PassportCustodyAuthorizationAdapter,
    PassportCustodyExceptionFilter,
    {
      provide: PASSPORT_CUSTODY_LABEL_DECRYPTOR,
      inject: [PASSPORT_KEY_MATERIAL],
      useFactory: (keys: PassportKeyMaterial): PassportCustodyLabelDecryptor => ({
        decrypt: (ciphertext) => decryptPassportValue(keys.privateEncryptionKey, ciphertext),
      }),
    },
  ],
  exports: [PassportCustodyQueryService, PassportCustodyCommandService, PassportCustodyAuthorizationAdapter],
})
export class PassportCustodyModule {}
