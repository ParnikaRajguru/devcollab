import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { type Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

// The shape Passport attaches to req.user (see JwtStrategy.validate).
interface RequestWithUser extends Request {
  user: { userId: string; email: string };
}

// @Controller('users') sets the base path; every route here is /users/...
@Controller('users')
export class UsersController {
  // Nest injects the singleton UsersService (constructor injection — the
  // dependency is handed to us, not constructed inside the controller).
  constructor(private readonly usersService: UsersService) {}

  // @Post() with no extra path = POST /users.
  // @Body() binds the parsed JSON request body into createUserDto. Because of
  // the global ValidationPipe (added in main.ts), by the time this line runs
  // the DTO is GUARANTEED valid — otherwise Nest already answered 400.
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // @UseGuards(JwtAuthGuard) runs the guard BEFORE the handler. A missing,
  // bad-signed, or expired token -> Passport answers 401 and this handler
  // never runs. On success req.user holds the verified { userId, email }.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: RequestWithUser) {
    // The token only carried the userId; load the fresh row so we return
    // current data (name, avatar) instead of a snapshot from login time.
    const user = await this.usersService.findById(req.user.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password_hash: _removed, ...safeUser } = user;
    return safeUser;
  }
}