import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../authentication/authentication.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { FirstMatchModule } from '../first-match/first-match.module.js';
import { AnalystMatchUploadAccess } from './application/analyst-match-upload-access.js';
import { AnalystMatchCapture } from './application/analyst-match-capture.js';
import { ConfirmedUploadSources } from './application/confirmed-upload-source.js';
import { ConfirmAnalystMatchUpload } from './application/confirm-analyst-match-upload.js';
import { ReadAnalystMatchUpload } from './application/read-analyst-match-upload.js';
import { AnalystMatchUploadRepository } from './persistence/analyst-match-upload.repository.js';
import { AnalystMatchUploadController } from './http/analyst-match-upload.controller.js';
import { AnalystMatchUploadExceptionFilter } from './http/analyst-match-upload-exception.filter.js';

@Module({
  imports: [AuthenticationModule, DatabaseModule, FirstMatchModule],
  controllers: [AnalystMatchUploadController],
  providers: [AnalystMatchUploadAccess, ConfirmedUploadSources, AnalystMatchCapture, ReadAnalystMatchUpload, ConfirmAnalystMatchUpload,
    AnalystMatchUploadRepository, AnalystMatchUploadExceptionFilter],
})
export class AnalystMatchUploadModule {}
