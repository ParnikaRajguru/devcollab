import { SetMetadata } from '@nestjs/common';
import { ProjectRole } from '../../projects/project-role.enum';

// Metadata key under which we store the roles required to hit a route.
export const ROLES_KEY = 'roles';

// @Roles(ProjectRole.OWNER) on a handler stores that value as route metadata.
// RolesGuard reads it via Reflector at request time. Decorators are just
// functions that attach data; guards are what ACT on that data.
export const Roles = (...roles: ProjectRole[]) =>
  SetMetadata(ROLES_KEY, roles);