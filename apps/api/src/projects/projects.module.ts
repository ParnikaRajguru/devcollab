import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { Project } from './project.entity';
import { ProjectMember } from './project-member.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { RolesGuard } from './roles.guard';

@Module({
  // forFeature([Project, ProjectMember]) makes both repositories injectable
  // (ProjectsService + RolesGuard use @InjectRepository on them).
  //
  // PassportModule.register({}) needed here because the controller uses
  // JwtAuthGuard (same v12 gotcha as UsersModule — see dev-log).
  //
  // UsersModule imported so ProjectsService can inject UsersService (to verify
  // a to-be-added member actually exists).
  imports: [
    TypeOrmModule.forFeature([Project, ProjectMember]),
    PassportModule.register({}),
    UsersModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, RolesGuard],
})
export class ProjectsModule {}