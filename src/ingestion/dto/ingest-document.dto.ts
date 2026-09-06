import { Transform, TransformFnParams } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsString,
} from 'class-validator';
import { Role } from '../../users/enums/role.enum';
import { DocumentType } from '../enums/document-type.enum';

export class IngestDocumentDto {
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @Transform(({ value }: TransformFnParams): Role[] =>
    Array.isArray(value) ? value : [value],
  )
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(Role, { each: true })
  allowedRoles: Role[];

  @IsString()
  language: string;
}

