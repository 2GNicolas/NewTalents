import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../authentication/authentication.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PassportCustodyModule } from '../passport-custody/passport-custody.module.js';
import { PassportMatchAllowanceModule } from '../passport-match-allowance/passport-match-allowance.module.js';
import { PlayerPassportModule } from '../player-passport/player-passport.module.js';
import { FirstMatchRepository } from './persistence/first-match.repository.js';
import { FirstMatchAccess } from './application/first-match-access.js';
import { FirstMatchCommand } from './application/first-match-command.js';
import { FirstMatchQuery } from './application/first-match-query.js';
import { ConfirmedLoadService } from './application/confirmed-load.service.js';
import { FirstMatchController } from './http/first-match.controller.js';
import { FirstMatchExceptionFilter } from './http/first-match-exception.filter.js';

@Module({
  imports: [AuthenticationModule, DatabaseModule, PlayerPassportModule, PassportCustodyModule, PassportMatchAllowanceModule],
  controllers: [FirstMatchController],
  providers: [FirstMatchRepository, FirstMatchAccess, FirstMatchCommand, FirstMatchQuery, ConfirmedLoadService, FirstMatchExceptionFilter],
  exports: [FirstMatchRepository, FirstMatchAccess, FirstMatchCommand, FirstMatchQuery, ConfirmedLoadService],
})
export class FirstMatchModule {}
