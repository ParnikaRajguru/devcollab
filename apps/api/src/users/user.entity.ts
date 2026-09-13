import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  // select: false means TypeORM EXCLUDES this column from every SELECT by
  // default. Queries that genuinely need the hash must re-add it explicitly
  // (UsersService.findByEmail does addSelect). This is the backstop that keeps
  // password hashes out of joined responses — e.g. Project members, comments.
  @Column({ select: false })
  password_hash: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  avatar_url: string;

  @CreateDateColumn()
  created_at: Date;
}
