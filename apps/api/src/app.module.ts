import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/user.entity';
import { Project } from './projects/project.entity';
import { ProjectMember } from './projects/project-member.entity';
import { File } from './files/file.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { FilesModule } from './files/files.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST'),
        port: config.get<number>('DATABASE_PORT'),
        username: config.get('DATABASE_USER'),
        password: config.get('DATABASE_PASSWORD'),
        database: config.get('DATABASE_NAME'),
        entities: [User, Project, ProjectMember, File],
        synchronize: true, // DEV ONLY — auto-creates tables; we'll discuss migrations later
      }),
    }),
    // Feature modules get listed here; UsersModule brings its own
    // controller/service/repository wiring.
    UsersModule,
    AuthModule,
    ProjectsModule,
    FilesModule,
  ],
})
export class AppModule {}
