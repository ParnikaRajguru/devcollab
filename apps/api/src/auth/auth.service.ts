import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    // bcrypt.compare re-derives the hash using the salt stored INSIDE
    // $2b$10$... and compares in constant time. Answering the same "Invalid
    // credentials" for BOTH "no such user" AND "wrong password" stops an
    // attacker from learning which email addresses are registered
    // (user enumeration).
    if (
      !user ||
      !(await bcrypt.compare(loginDto.password, user.password_hash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      user: this.stripHash(user),
      ...this.signTokens(user.id, user.email),
    };
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      // verifyAsync checks signature + expiry against the REFRESH secret.
      // Tampered, expired, or wrong-secret tokens throw here.
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // An ACCESS token must NEVER be accepted at /auth/refresh — this check
    // enforces the separation even though both token types share one format.
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.signTokens(user.id, user.email);
  }

  // Two DIFFERENT secrets + two DIFFERENT lifetimes is the classic pattern:
  // short-lived access token (minutes) minimizes harm if stolen; longer-lived
  // refresh token (days) saves the user from logging in constantly. Stealing
  // the SHORT one is nearly useless on its own.
  private signTokens(userId: string, email: string) {
    // `sub` (the JWT-standard "subject" claim) MUST be inside the payload —
    // JwtStrategy.validate() and refresh() both read payload.sub to find the
    // user. We once forgot it here: the tokens lacked sub, guards resolved it
    // to undefined, and findById({ id: undefined }) threw in TypeORM.
    const accessToken = this.jwtService.sign(
      { sub: userId, email, type: 'access' },
      {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN'),
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, email, type: 'refresh' },
      {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN'),
      },
    );

    return { tokenType: 'Bearer', accessToken, refreshToken };
  }

  // Same strip-as-you-leave rule as UsersService.create: the hash never
  // leaves the server in a response.
  private stripHash(user: Awaited<ReturnType<UsersService['findByEmail']>>) {
    const { password_hash: _removed, ...safeUser } = user!;
    return safeUser;
  }
}