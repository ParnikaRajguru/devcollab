import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// PATCH /projects/:id body. Every field optional so a partial update works;
// anything the client omits is preserved (see ProjectsService.update).
export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}