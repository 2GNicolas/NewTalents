import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { AcademyMembershipService } from './academy-membership.service.js';
import { MembershipTransitionService } from './membership-transition.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [AcademyMembershipService, MembershipTransitionService],
  exports: [AcademyMembershipService, MembershipTransitionService],
})
export class AcademyMembershipModule {}
