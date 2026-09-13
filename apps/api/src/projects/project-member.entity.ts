import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { User } from '../users/user.entity';
import { ProjectRole } from './project-role.enum';

// The membership join table: "User X is role R in Project P".
//
// Both PK columns use @PrimaryColumn (NOT a generated id + unique constraint)
// because the pair (project_id, user_id) IS the identity of a membership:
// one row per user per project, guaranteed by the composite primary key.
@Entity('project_members')
export class ProjectMember {
  @PrimaryColumn('uuid')
  project_id: string;

  @PrimaryColumn('uuid')
  user_id: string;

  // Postgres enum column; new members default to viewer unless the owner
  // explicitly adds them as a collaborator.
  @Column({ type: 'enum', enum: ProjectRole, default: ProjectRole.VIEWER })
  role: ProjectRole;

  @CreateDateColumn()
  created_at: Date;

  // CASCADE both ways: deleting a project deletes its memberships, and
  // deleting a user removes them from every project they were in.
  @ManyToOne(() => Project, (project) => project.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}