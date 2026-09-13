import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';

// Salt rounds = bcrypt's "cost factor".
// 10 means the algorithm internally repeats 2^10 = 1024 times.
// Higher = slower per hash = harder to brute-force; 10 is a safe common default.
const SALT_ROUNDS = 10;

// Detects Postgres' unique_violation regardless of whether TypeORM wraps the
// raw driver error. The SQLSTATE code string lives at error.code on the raw
// pg error, or nested on error.driverError.code when TypeORM wraps it.
function isUniqueViolation(error: unknown): boolean {
  return (
    (error as { driverError?: { code?: string } })?.driverError?.code ===
      '23505' ||
    (error as { code?: string })?.code === '23505'
  );
}

@Injectable()
export class UsersService {
  // @InjectRepository(User) asks Nest's TypeORM module to hand us the
  // Repository<User>. The repository is our data-access object that wraps all
  // SQL — this is Dependency Injection: we RECEIVE it, we never `new` it.
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  // Return type uses Omit<User, 'password_hash'> — a compile-time contract
  // that forces us never to return the hash from this method.
  async create(
    createUserDto: CreateUserDto,
  ): Promise<Omit<User, 'password_hash'>> {
    // 1. Hash the plain password BEFORE any DB work.
    //    bcrypt.hash(password, rounds) generates its OWN random salt
    //    internally, so two users with the same password get different hashes.
    const passwordHash = await bcrypt.hash(
      createUserDto.password,
      SALT_ROUNDS,
    );

    // 2. repository.create() builds an entity instance in memory WITHOUT
    //    touching the DB. Note the mapping: DTO `password` -> entity
    //    `password_hash`; the field the CLIENT knows vs the column the DB has.
    const user = this.usersRepository.create({
      email: createUserDto.email,
      name: createUserDto.name,
      password_hash: passwordHash,
      avatar_url: createUserDto.avatar_url,
    });

    try {
      // 3. save() runs the INSERT. If the email already exists, Postgres
      //    aborts with a unique-violation error before returning any row.
      const saved = await this.usersRepository.save(user);

      // 4. Pull the hash out with destructuring so the API never sees it.
      //    `_removed` is "intentionally unused" (the underscore is the
      //    convention that says so); `safeUser` holds everything else.
      const { password_hash: _removed, ...safeUser } = saved;
      return safeUser;
    } catch (error) {
      // 5. Translate the DB's cryptic 23505 into a meaningful 409 Conflict.
      //    We never leak "database blew up" to the client; every other error
      //    is rethrown so Nest logs it and answers 500.
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'A user with this email already exists',
        );
      }
      throw error;
    }
  }

  // AuthService's login() calls this. Because password_hash is select:false,
  // the QueryBuilder re-adds the column here — the ONLY caller that needs it
  // (login must bcrypt.compare). Every other read never touches the hash.
  // Returns null when no row matches — callers decide what that means
  // (AuthService turns it into "Invalid credentials").
  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password_hash')
      .where('user.email = :email', { email })
      .getOne();
  }

  // Used by /users/me (refresh flow too): load the full row for a user whose
  // identity we already KNOW from the verified JWT.
  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }
}