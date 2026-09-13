import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // forFeature([User]) makes the Repository<User> injectable INSIDE this
  // module, so UsersService's @InjectRepository(User) resolves. (The table
  // config itself lives in AppModule's TypeOrmModule.forRoot.)
  //
  // PassportModule is imported because UsersController uses JwtAuthGuard
  // (GET /users/me). Every module that USES a passport guard must import
  // PassportModule ITSELF — the guard's AuthModuleOptions dependency resolves
  // only inside modules that provide it. IMPORTANT: it must be the dynamic
  // .register() form; a bare `PassportModule` is an empty @Module({}) in v12
  // and provides nothing (we hit exactly that error and read the library
  // source to find it).
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({}),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  // exports lets OTHER modules (e.g. AuthModule) inject the same
  // UsersService instance too.
  exports: [UsersService],
})
export class UsersModule {}