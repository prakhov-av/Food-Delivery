import {
  Body,
  Controller,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Roles } from '../auth/types/auth.decorators';
import { FileInterceptor } from '@nestjs/platform-express';
import { IngestionService } from './ingestion.service';
import { IngestDocumentDto } from './dto/ingest-document.dto';
import { Role } from '../users/enums/role.enum';

import { Audit } from '../audit/audit.decorator';
import { AuditAction } from '../audit/audit.enums';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/**
   * Обрабатывает HTTP-запросы соответствующего ресурса, валидирует входные DTO через инфраструктуру NestJS и делегирует бизнес-операции сервисам.
   */
@Controller('ingestion')
export class IngestionController {
  constructor(private readonly service: IngestionService) {}

  @Audit({
    action: AuditAction.KNOWLEDGE_UPLOADED,
    entityType: 'Knowledge',
  })
  @Roles(Role.ADMIN)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }),
  )
  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  async upload(
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true }))
    file: Express.Multer.File,
    @Body() ingestDocumentDto: IngestDocumentDto,
  ): Promise<void> {
    await this.service.ingest(file, ingestDocumentDto);
  }
}
