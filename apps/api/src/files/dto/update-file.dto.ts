import { IsString } from 'class-validator';

// PATCH /projects/:id/files/:fileId body — just the new content.
// The file path cannot be renamed yet (that would be a move/rename
// operation, not a simple content update).
export class UpdateFileDto {
  @IsString()
  content: string;
}