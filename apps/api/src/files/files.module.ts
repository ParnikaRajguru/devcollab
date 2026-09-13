import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { File } from './file.entity';
import { Project } from '../projects/project.entity';
import { ProjectMember } from '../projects/project-member.entity';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  // forFeature([File, Project, ProjectMember]) — File is our entity, Project
  // is needed for existence checks in the service, and ProjectMember MUST be
  // here too because FilesController uses RolesGuard: a guard is instantiated
  // in the module that USES it, so that module has to satisfy the guard's
  // @InjectRepository(ProjectMember) dependency. (ProjectsModule didn't need
  // worry — its own controller uses the same guard that lives there.)
  imports: [
    TypeOrmModule.forFeature([File, Project, ProjectMember]),
    PassportModule.register({}),
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}