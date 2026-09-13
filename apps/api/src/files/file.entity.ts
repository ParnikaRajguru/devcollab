import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';

// A file inside a project. The path IS the folder structure: "src/main.ts"
// means the file lives in a "src" folder. Folders are derived at read time
// by splitting on "/" — no explicit folder entity needed.
@Entity('files')
@Unique(['project_id', 'path']) // one file per path per project
export class File {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'project_id' })
  project_id: string;

  // Max 500 chars covers deep nested paths (e.g. "src/components/auth/Login.tsx").
  @Column({ type: 'varchar', length: 500 })
  path: string;

  // Unlimited text content for code files. TEXT = variable-length up to 1GB
  // in Postgres. For MVP we store the full content; large binary files and
  // streaming diffs come later.
  @Column({ type: 'text' })
  content: string;

  // Who originally created this file (for attribution in review comments).
  @Column('uuid', { name: 'created_by' })
  created_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  creator: User;
}