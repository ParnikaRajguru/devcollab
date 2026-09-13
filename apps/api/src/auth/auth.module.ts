import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    // UsersModule EXPORTS UsersService (set up in Phase 5), so it is
    // injectable into AuthService here.
    UsersModule,
    // PassportModule.register() — NOT bare PassportModule. In @nestjs/passport
    // v12, the bare class is an EMPTY @Module({}) that provides nothing.
    // .register() is the dynamic API that actually creates + exports
    // AuthModuleOptions (the very dependency the guard injects).
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // registerAsync reads the secret from .env (never hardcoded). AuthService
    // overrides the secret per-call with explicit values anyway; this module
    // default is a safety net.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get('JWT_ACCESS_EXPIRES_IN') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}