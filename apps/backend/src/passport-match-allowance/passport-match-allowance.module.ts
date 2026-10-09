import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../authentication/authentication.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PASSPORT_KEY_MATERIAL } from '../player-passport/passport-key.token.js';
import { decryptPassportValue } from '../player-passport/player-private-identity/passport-crypto.js';
import type { PassportKeyMaterial } from '../player-passport/player-private-identity/passport-keys.js';
import { PlayerPassportModule } from '../player-passport/player-passport.module.js';
import { AdminPassportsQuery, ADMIN_PASSPORT_LABEL_DECRYPTOR, type AdminPassportLabelDecryptor } from './application/admin-passports-query.js';
import { AdministratorAllowanceAuthorization } from './application/administrator-allowance-authorization.js';
import { AllowanceCommand } from './application/allowance-command.js';
import { AllowanceQuery } from './application/allowance-query.js';
import { AllowanceHistory } from './application/allowance-history.js';
import { AdminAllowanceController } from './http/admin-allowance.controller.js';
import { AdminAllowanceExceptionFilter } from './http/admin-allowance-exception.filter.js';
import { AdminPassportsRepository } from './persistence/admin-passports.repository.js';
import { AllowanceTransactionRunner } from './persistence/allowance-transaction.runner.js';

@Module({
  imports: [DatabaseModule, AuthorizationModule, AuthenticationModule, PlayerPassportModule],
  controllers: [AdminAllowanceController],
  providers: [AdminPassportsRepository, AdminPassportsQuery, AdministratorAllowanceAuthorization,
    AllowanceQuery, AllowanceHistory, AllowanceCommand, AllowanceTransactionRunner, AdminAllowanceExceptionFilter,
    { provide: ADMIN_PASSPORT_LABEL_DECRYPTOR, inject: [PASSPORT_KEY_MATERIAL],
      useFactory: (keys: PassportKeyMaterial): AdminPassportLabelDecryptor => ({
        decrypt: (ciphertext) => decryptPassportValue(keys.privateEncryptionKey, ciphertext),
      }) },
  ],
})
export class PassportMatchAllowanceModule {}
