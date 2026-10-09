import { Transform, TransformFnParams } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator';
import { Role } from '../../users/enums/role.enum';
import { DocumentType } from '../enums/document-type.enum';

/**
   * Описывает структуру данных «IngestDocumentDto», используемую на границе API или между слоями приложения; ограничения полей определяются декораторами валидации, если они предусмотрены.
   */
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

  @Transform(({ value }: TransformFnParams): number => Number(value))
  @IsInt()
  @Min(1)
  documentVersion: number;

  @IsString()
  @IsNotEmpty()
  documentId: string;
}
