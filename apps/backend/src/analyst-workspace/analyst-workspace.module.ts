import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { AuthenticationModule } from '../authentication/authentication.module.js';
import { PlayerPassportModule } from '../player-passport/player-passport.module.js';
import { PASSPORT_KEY_MATERIAL } from '../player-passport/passport-key.token.js';
import { decryptPassportValue } from '../player-passport/player-private-identity/passport-crypto.js';
import type { PassportKeyMaterial } from '../player-passport/player-private-identity/passport-keys.js';
import { AnalystWorkspaceAccess } from './application/analyst-workspace-access.js';
import { AnalystPassports } from './application/analyst-passports.js';
import { AnalystMatches } from './application/analyst-matches.js';
import { AnalystWorkContact } from './application/analyst-work-contact.js';
import { AnalystOverview, ANALYST_OVERVIEW_CLOCK, ANALYST_WORKSPACE_NAME_DECRYPTOR, type AnalystWorkspaceNameDecryptor } from './application/analyst-overview.js';
import { AnalystWorkspaceController } from './http/analyst-workspace.controller.js';
import { AnalystWorkspaceExceptionFilter } from './http/analyst-workspace-exception.filter.js';
import { Feature009ConfirmedMatchSource } from './persistence/confirmed-match-source.js';
import { AnalystPassportReadRepository } from './persistence/analyst-passport-read.repository.js';

@Module({
  imports: [DatabaseModule, AuthenticationModule, PlayerPassportModule],
  controllers: [AnalystWorkspaceController],
  providers: [AnalystWorkspaceAccess, Feature009ConfirmedMatchSource, AnalystOverview, AnalystPassports, AnalystMatches, AnalystWorkspaceExceptionFilter,
    { provide: AnalystPassportReadRepository, inject: [Feature009ConfirmedMatchSource, ANALYST_WORKSPACE_NAME_DECRYPTOR],
      useFactory: (source: Feature009ConfirmedMatchSource, cipher: AnalystWorkspaceNameDecryptor) => new AnalystPassportReadRepository(source, cipher) },
    { provide: AnalystWorkContact, inject: [ANALYST_WORKSPACE_NAME_DECRYPTOR],
      useFactory: (cipher: AnalystWorkspaceNameDecryptor) => new AnalystWorkContact(cipher) },
    { provide: ANALYST_OVERVIEW_CLOCK, useValue: () => new Date() },
    { provide: ANALYST_WORKSPACE_NAME_DECRYPTOR, inject: [PASSPORT_KEY_MATERIAL],
      useFactory: (keys: PassportKeyMaterial): AnalystWorkspaceNameDecryptor => ({
        decrypt: (ciphertext) => decryptPassportValue(keys.privateEncryptionKey, ciphertext),
      }) },
  ],
  exports: [AnalystWorkspaceAccess, Feature009ConfirmedMatchSource],
})
export class AnalystWorkspaceModule {}
