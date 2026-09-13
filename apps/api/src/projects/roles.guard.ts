import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { ProjectMember } from './project-member.entity';
import { ProjectRole } from './project-role.enum';

// Authorization (who may act) — distinct from authentication (who are you,
// handled by JwtAuthGuard). This guard answers: "does the caller hold at least
// the role this route demands, WITHIN the project named in the URL?"
//
// Roles carry a partial order: owner >= collaborator >= viewer. Requiring
// 'viewer' lets every member in; requiring 'owner' locks the route to the
// owner alone. Meets the access matrix without if-chains in controllers.
const ROLE_RANK: Record<ProjectRole, number> = {
  [ProjectRole.OWNER]: 3,
  [ProjectRole.COLLABORATOR]: 2,
  [ProjectRole.VIEWER]: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  // Injection: the ProjectMember repository (to look up the caller's role) and
  // the Reflector (to read the @Roles() metadata on the handler being called).
  constructor(
    @InjectRepository(ProjectMember)
    private readonly membersRepository: Repository<ProjectMember>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Reflector reads metadata attached by @Roles(...). getAllAndOverride
    // checks both the method AND any class-level @Roles() — this handler wins.
    const required = this.reflector.getAllAndOverride<ProjectRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() metadata = nothing role-specific to enforce here; the
    // JwtAuthGuard (listed first in @UseGuards) has already authenticated.
    // Only endpoints with a :projectId carry roles.
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId;
    const projectId: string | undefined = request.params?.projectId;

    if (!userId || !projectId) {
      throw new ForbiddenException('Access denied');
    }

    const membership = await this.membersRepository.findOne({
      where: { user_id: userId, project_id: projectId },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this project');
    }

    const hasRequiredRole = required.some(
      (role) => ROLE_RANK[membership.role] >= ROLE_RANK[role],
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException('Insufficient role for this action');
    }

    return true;
  }
}