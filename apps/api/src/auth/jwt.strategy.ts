import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './jwt-payload.interface';

// PassportStrategy ties the raw passport-jwt library into Nest's DI.
// The 'jwt' name is what JwtAuthGuard's AuthGuard('jwt') looks up.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      // Extract the token from the Authorization header: "Bearer <token>".
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Automatically reject tokens whose exp claim is in the past.
      ignoreExpiration: false,
      // Validate the signature against the ACCESS secret. getOrThrow fails at
      // STARTUP if the env var is missing — better than silently verifying
      // tokens with `undefined` later.
      secretOrKey: config.getOrThrow('JWT_ACCESS_SECRET'),
    });
  }

  // Passport only calls validate() AFTER the token verified successfully
  // (signature + expiry). So reaching here means the token is genuinely ours.
  // In here we do a BUSINESS check (token type) and decide what "login state"
  // to attach to the request.
  validate(payload: JwtPayload) {
    // A REFRESH token must not grant access to protected endpoints. The
    // `type` claim enforces that.
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    // Whatever we return becomes req.user on the handler.
    return { userId: payload.sub, email: payload.email };
  }
}