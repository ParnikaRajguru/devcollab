import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  email: string;

  // NOTE: no @MinLength(8) here on purpose. Signup enforces password strength;
  // LOGIN must accept whatever the user typed years ago, so we only check
  // "is it a string at all". The comparison itself happens in AuthService.
  @IsString()
  @IsNotEmpty({ message: 'password is required' })
  password: string;
}