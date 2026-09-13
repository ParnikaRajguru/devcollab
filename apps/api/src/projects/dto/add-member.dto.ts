import { IsEnum, IsUUID } from 'class-validator';
import { ProjectRole } from '../project-role.enum';

// POST /projects/:id/members body — which user, in which role. The owner
// (whoever invokes this) can never add a second OWNER (enforced in the
// service), so effectively this adds collaborators or viewers.
export class AddMemberDto {
  @IsUUID()
  userId: string;

  @IsEnum(ProjectRole)
  role: ProjectRole;
}