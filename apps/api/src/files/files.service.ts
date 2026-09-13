import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/project.entity';
import { File } from './file.entity';
import { CreateFileDto } from './dto/create-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';

function isUniqueViolation(error: unknown): boolean {
  return (
    (error as { driverError?: { code?: string } })?.driverError?.code ===
      '23505' ||
    (error as { code?: string })?.code === '23505'
  );
}

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(File)
    private readonly filesRepository: Repository<File>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
  ) {}

  // List every file in a project (the front-end builds the file tree from
  // the flat path list). `select` drops the `content` column — the tree view
  // only needs paths + metadata; content loads via the per-file GET.
  async listByProject(projectId: string) {
    return this.filesRepository.find({
      where: { project_id: projectId },
      order: { path: 'ASC' },
      select: {
        id: true,
        project_id: true,
        path: true,
        created_by: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  // Full file content for the editor. Returns all fields including content.
  async findOne(projectId: string, fileId: string) {
    const file = await this.filesRepository.findOne({
      where: { id: fileId, project_id: projectId },
    });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  async create(projectId: string, userId: string, dto: CreateFileDto) {
    // Validate the project exists (defense in depth — RolesGuard already
    // verified membership and role).
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    try {
      return await this.filesRepository.save(
        this.filesRepository.create({
          project_id: projectId,
          path: dto.path,
          content: dto.content,
          created_by: userId,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `A file with path "${dto.path}" already exists in this project`,
        );
      }
      throw error;
    }
  }

  async update(projectId: string, fileId: string, dto: UpdateFileDto) {
    const file = await this.filesRepository.findOne({
      where: { id: fileId, project_id: projectId },
    });
    if (!file) throw new NotFoundException('File not found');

    file.content = dto.content;
    // updated_at auto-increments via @UpdateDateColumn — no manual set needed.
    return this.filesRepository.save(file);
  }

  async remove(projectId: string, fileId: string) {
    const file = await this.filesRepository.findOne({
      where: { id: fileId, project_id: projectId },
    });
    if (!file) throw new NotFoundException('File not found');

    await this.filesRepository.remove(file);
    return { deleted: true };
  }
}