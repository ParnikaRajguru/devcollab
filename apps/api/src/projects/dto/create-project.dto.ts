import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// POST /projects body. name is the only hard requirement; the global
// ValidationPipe rejects missing/empty names with 400 before the service runs.
export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}