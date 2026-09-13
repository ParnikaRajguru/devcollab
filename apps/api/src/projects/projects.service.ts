import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { Project } from './project.entity';
import { ProjectMember } from './project-member.entity';
import { ProjectRole } from './project-role.enum';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

function isUniqueViolation(error: unknown): boolean {
  return (
    (error as { driverError?: { code?: string } })?.driverError?.code ===
      '23505' ||
    (error as { code?: string })?.code === '23505'
  );
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly membersRepository: Repository<ProjectMember>,
    // DataSource = the app's connection pool; we use it to open a transaction
    // where two writes must succeed together.
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
  ) {}

  // Two writes, one transaction: the project row AND the creator's OWNER
  // membership row. If membership failed after the project succeeded we'd have
  // an owner-less project nobody could ever manage. ACID says all-or-nothing.
  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    return this.dataSource.transaction(async (manager) => {
      const project = await manager.save(
        manager.create(Project, {
          name: dto.name,
          description: dto.description ?? null,
          owner_id: userId,
        }),
      );

      await manager.save(
        manager.create(ProjectMember, {
          project_id: project.id,
          user_id: userId,
          role: ProjectRole.OWNER,
        }),
      );

      return project;
    });
  }

  // Every project the current user is a member of, each tagged with THEIR role
  // in that project — from the join table, not duplicated on the project row.
  // The front-end needs `role` to know whether to render owner buttons.
  async findAllForUser(userId: string) {
    const rows = await this.projectsRepository
      .createQueryBuilder('project')
      .innerJoin('project.members', 'member')
      .where('member.user_id = :userId', { userId })
      .select([
        'project.id AS id',
        'project.name AS name',
        'project.description AS description',
        'project.created_at AS created_at',
        'member.role AS role',
      ])
      .orderBy('project.created_at', 'DESC')
      .getRawMany();

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      created_at: row.created_at,
      role: row.role,
    }));
  }

  // Single project for a member, including the full member list (the owner UI
  // needs names/emails/roles to manage people). A non-member gets the SAME 404
  // as a missing project so we don't leak which ids exist.
  async findOneForUser(projectId: string, userId: string) {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
      relations: { members: { user: true } },
    });

    if (!project) throw new NotFoundException('Project not found');

    const membership = project.members.find((m) => m.user_id === userId);
    if (!membership) throw new NotFoundException('Project not found');

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      created_at: project.created_at,
      owner_id: project.owner_id,
      my_role: membership.role,
      members: project.members.map((m) => ({
        user_id: m.user_id,
        email: m.user.email,
        name: m.user.name,
        role: m.role,
        created_at: m.created_at,
      })),
    };
  }

  async update(
    projectId: string,
    userId: string,
    dto: UpdateProjectDto,
  ): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.owner_id !== userId) {
      throw new ForbiddenException('Only the owner can update this project');
    }

    project.name = dto.name ?? project.name;
    project.description =
      dto.description === undefined ? project.description : dto.description;

    return this.projectsRepository.save(project);
  }

  async remove(projectId: string, userId: string) {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.owner_id !== userId) {
      throw new ForbiddenException('Only the owner can delete this project');
    }

    // Removing the project cascades to project_members rows (FK onDelete).
    await this.projectsRepository.remove(project);
    return { deleted: true };
  }

  async addMember(
    projectId: string,
    actorId: string,
    dto: AddMemberDto,
  ): Promise<ProjectMember> {
    // RolesGuard already verified actorId is the owner; the explicit checks
    // below are defense in depth (a guard is NOT the data's integrity).
    await this.requireOwner(projectId, actorId);

    // Never allow a SECOND owner: ownership is created exactly once, at
    // project creation, and it's what keeps the project manageable at all.
    if (dto.role === ProjectRole.OWNER) {
      throw new BadRequestException('A project can have only one owner');
    }

    const user = await this.usersService.findById(dto.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      // `insert` (NOT `save`): save() is upsert — if the (project_id, user_id)
      // composite key already exists it UPDATES the row instead of erroring.
      // insert() always INSERTs, so a duplicate hits the PK constraint and we
      // translate the 23505 into the 409 the client should see.
      const inserted = await this.membersRepository.insert({
        project_id: projectId,
        user_id: dto.userId,
        role: dto.role,
      });
      const id = inserted.identifiers[0];
      return (await this.membersRepository.findOne({
        where: { project_id: id.project_id, user_id: id.user_id },
      }))!;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('This user is already a member');
      }
      throw error;
    }
  }

  async updateMemberRole(
    projectId: string,
    actorId: string,
    memberUserId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<ProjectMember> {
    await this.requireOwner(projectId, actorId);

    // The owner cannot demote/promote themselves: with no second owner, a
    // self-demotion would leave the project ownerless.
    if (memberUserId === actorId) {
      throw new BadRequestException('You cannot change your own role');
    }
    if (dto.role === ProjectRole.OWNER) {
      throw new BadRequestException('A project can have only one owner');
    }

    const membership = await this.membersRepository.findOne({
      where: { project_id: projectId, user_id: memberUserId },
    });
    if (!membership) throw new NotFoundException('Membership not found');

    membership.role = dto.role;
    return this.membersRepository.save(membership);
  }

  async removeMember(
    projectId: string,
    actorId: string,
    memberUserId: string,
  ) {
    await this.requireOwner(projectId, actorId);

    if (memberUserId === actorId) {
      throw new BadRequestException('You cannot remove yourself');
    }

    const membership = await this.membersRepository.findOne({
      where: { project_id: projectId, user_id: memberUserId },
    });
    if (!membership) throw new NotFoundException('Membership not found');

    await this.membersRepository.remove(membership);
    return { removed: true };
  }

  // Shared guard helper: the caller must exist and be the project's owner.
  private async requireOwner(projectId: string, actorId: string) {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.owner_id !== actorId) {
      throw new ForbiddenException('Only the owner can manage members');
    }
  }
}