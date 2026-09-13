import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

// DTO = Data Transfer Object.
// A plain class that does TWO jobs in NestJS:
//   1. Types the shape of the request body at COMPILE TIME.
//   2. Hosts class-validator decorators that run at RUNTIME,
//      so invalid payloads are rejected before reaching our logic.
export class CreateUserDto {
  // @IsEmail() checks the value is a valid email string.
  // The first {} is an options object; `message` overrides the default text
  // that gets returned to the client on failure.
  @IsEmail({}, { message: 'email must be a valid email address' })
  email: string;

  // @IsString() rejects non-strings (numbers, arrays, objects, null).
  // @MinLength(8) enforces our minimum password length. We enforce minimum
  // here on the way IN; bcrypt's 72-byte limit is why we don't need a max yet.
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'name is required' })
  name: string;

  // @IsOptional() = the field may be absent entirely, but IF it is present
  // it must satisfy every validator below it (so a provided avatar_url
  // must be a string).
  @IsOptional()
  @IsString()
  avatar_url?: string;
}