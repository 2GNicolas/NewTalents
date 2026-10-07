import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { IdentityService } from './identity.service.js';
import { AnalystOperationalProfileService } from './analyst-operational-profile.service.js';
import { RoleAssignmentService } from './role-assignment.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [IdentityService, RoleAssignmentService, AnalystOperationalProfileService],
  exports: [IdentityService, RoleAssignmentService, AnalystOperationalProfileService],
})
export class IdentityModule {}
