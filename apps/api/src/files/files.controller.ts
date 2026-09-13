import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { type Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../projects/roles.guard';
import { ProjectRole } from '../projects/project-role.enum';
import { FilesService } from './files.service';
import { CreateFileDto } from './dto/create-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';

interface RequestWithUser extends Request {
  user: { userId: string; email: string };
}

// Nested routes under /projects/:projectId/files. All routes share the same
// two guards: JwtAuthGuard (auth) + RolesGuard (authz). The :projectId
// param in the URL lets RolesGuard look up the caller's role.
@Controller('projects/:projectId/files')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // GET /projects/:projectId/files — flat list of paths + metadata.
  // @Roles(VIEWER) lets any member see the file tree.
  @Get()
  @Roles(ProjectRole.VIEWER)
  list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.filesService.listByProject(projectId);
  }

  // GET /projects/:projectId/files/:fileId — full content for the editor.
  @Get(':fileId')
  @Roles(ProjectRole.VIEWER)
  findOne(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.filesService.findOne(projectId, fileId);
  }

  // POST /projects/:projectId/files — create a new file.
  // @Roles(COLLABORATOR) — viewers cannot add files.
  @Post()
  @Roles(ProjectRole.COLLABORATOR)
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: RequestWithUser,
    @Body() dto: CreateFileDto,
  ) {
    return this.filesService.create(projectId, req.user.userId, dto);
  }

  // PATCH /projects/:projectId/files/:fileId — update content (save button).
  @Patch(':fileId')
  @Roles(ProjectRole.COLLABORATOR)
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body() dto: UpdateFileDto,
  ) {
    return this.filesService.update(projectId, fileId, dto);
  }

  // DELETE /projects/:projectId/files/:fileId — owner only.
  @Delete(':fileId')
  @Roles(ProjectRole.OWNER)
  remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.filesService.remove(projectId, fileId);
  }
}