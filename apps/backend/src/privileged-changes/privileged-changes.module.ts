import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ChangeAuditService } from './change-audit.service.js';
import { PrivilegedChangesService } from './privileged-changes.service.js';
@Module({ imports: [AuthorizationModule, DatabaseModule], providers: [ChangeAuditService, PrivilegedChangesService], exports: [PrivilegedChangesService] })
export class PrivilegedChangesModule {}
