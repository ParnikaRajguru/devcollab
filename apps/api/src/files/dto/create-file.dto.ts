import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// POST /projects/:id/files body. Path must be non-empty, max 500 chars,
// no leading/trailing slash, no empty segments (no "a//b"), and only safe
// characters (alphanumeric, ., -, _, and / between segments).
export class CreateFileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Matches(/^[a-zA-Z0-9._-]+(\/[a-zA-Z0-9._-]+)*$/, {
    message:
      'path must be like "src/main.ts": segments of letters, numbers, dots, hyphens or underscores separated by single slashes',
  })
  path: string;

  @IsString()
  content: string;
}