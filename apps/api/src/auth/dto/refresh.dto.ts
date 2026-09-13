import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
  // The refresh token arrives as a string in the body. Nest's ValidationPipe
  // guarantees it's present and a string before AuthService ever sees it.
  @IsString()
  @IsNotEmpty({ message: 'refresh_token is required' })
  refresh_token: string;
}