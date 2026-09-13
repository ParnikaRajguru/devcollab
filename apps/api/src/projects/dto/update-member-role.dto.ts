import { IsEnum } from 'class-validator';
import { ProjectRole } from '../project-role.enum';

// PATCH /projects/:id/members/:memberId body — just the new role.
export class UpdateMemberRoleDto {
  @IsEnum(ProjectRole)
  role: ProjectRole;
}