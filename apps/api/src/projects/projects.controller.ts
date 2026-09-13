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
import { RolesGuard } from './roles.guard';
import { ProjectRole } from './project-role.enum';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

interface RequestWithUser extends Request {
  user: { userId: string; email: string };
}

// Base path: /projects. Two guards run on EVERY route here, in order:
//   1. JwtAuthGuard — authentication: is there a valid token? (401 if not)
//   2. RolesGuard  — authorization: does the token's user hold the required
//                    role IN THIS project? (403 if not)
// Routes WITHOUT @Roles(...) metadata still require authentication (guard 1)
// but skip role checks (guard 2 returns true when no metadata is present).
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // POST /projects — any authenticated user. The callers becomes the owner
  // (both rows created in one transaction by the service).
  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(req.user.userId, dto);
  }

  // GET /projects — any authenticated user; returns only THEIR projects,
  // each with their role in it.
  @Get()
  findAll(@Req() req: RequestWithUser) {
    return this.projectsService.findAllForUser(req.user.userId);
  }

  // GET /projects/:id — project + member list for a member of it (404 if the
  // caller isn't a member). Note: NO @Roles here — membership is checked in
  // the service instead, so the error is a uniform 404 (no existence leak).
  @Get(':projectId')
  findOne(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.projectsService.findOneForUser(projectId, req.user.userId);
  }

  // Everything below changes data and is owner-only. @Roles(OWNER) makes
  // RolesGuard demand ROLE_RANK[user.role] >= 3 for THIS project.

  @Patch(':projectId')
  @Roles(ProjectRole.OWNER)
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(projectId, req.user.userId, dto);
  }

  @Delete(':projectId')
  @Roles(ProjectRole.OWNER)
  remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.projectsService.remove(projectId, req.user.userId);
  }

  @Post(':projectId/members')
  @Roles(ProjectRole.OWNER)
  addMember(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: RequestWithUser,
    @Body() dto: AddMemberDto,
  ) {
    return this.projectsService.addMember(
      projectId,
      req.user.userId,
      dto,
    );
  }

  @Patch(':projectId/members/:memberId')
  @Roles(ProjectRole.OWNER)
  updateMemberRole(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.projectsService.updateMemberRole(
      projectId,
      req.user.userId,
      memberId,
      dto,
    );
  }

  @Delete(':projectId/members/:memberId')
  @Roles(ProjectRole.OWNER)
  removeMember(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.projectsService.removeMember(
      projectId,
      req.user.userId,
      memberId,
    );
  }
}