import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// AuthGuard('jwt') runs Passport's 'jwt' strategy (registered when JwtStrategy
// bootstraps inside AuthModule) BEFORE a route handler. Failure -> 401, the
// handler never runs. Success -> fills req.user with validate()'s return value.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}