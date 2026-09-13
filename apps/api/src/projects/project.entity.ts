import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { ProjectMember } from './project-member.entity';

// A project is the container for a code review: a working tree of files that
// a set of users (ProjectMember) can view/edit according to their role.
@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  // Free-form project blurb; nullable — blank description is fine.
  @Column({ type: 'text', nullable: true })
  description: string | null;

  // The user who created the project. Stored as a plain uuid column AND as a
  // real FK relation; the relation enforces referential integrity and lets us
  // join in owner data when needed.
  @Column('uuid', { name: 'owner_id' })
  owner_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @CreateDateColumn()
  created_at: Date;

  // Inverse side of ProjectMember.project — lets us load members per project
  // (e.g. relations: { members: { user: true } } in ProjectsService).
  @OneToMany(() => ProjectMember, (member) => member.project)
  members: ProjectMember[];
}