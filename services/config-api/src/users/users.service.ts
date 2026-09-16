import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { UserSummary } from "@opspilot/contracts";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../database/prisma.service";

export type UserWithPassword = User;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    email: string;
    password: string;
    firstName: string;
    lastName?: string;
  }): Promise<UserSummary> {
    const email = this.normalizeEmail(input.email);
    const passwordHash = await bcrypt.hash(input.password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: input.firstName.trim(),
          lastName: input.lastName?.trim() || null,
        },
      });
      return this.toSummary(user);
    } catch (error: unknown) {
      if (this.isPrismaError(error, "P2002")) {
        throw new ConflictException("An account with this email already exists");
      }
      throw error;
    }
  }

  findByEmail(email: string): Promise<UserWithPassword | null> {
    return this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
    });
  }

  async findPublicById(id: string): Promise<UserSummary | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.toSummary(user) : null;
  }

  async updateProfile(
    id: string,
    input: { firstName: string; lastName?: string },
  ): Promise<UserSummary> {
    const firstName = input.firstName.trim();
    if (!firstName) {
      throw new BadRequestException("First name cannot be empty");
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          firstName,
          lastName: input.lastName?.trim() || null,
        },
      });
      return this.toSummary(user);
    } catch (error: unknown) {
      if (this.isPrismaError(error, "P2025")) {
        throw new NotFoundException("User account no longer exists");
      }
      throw error;
    }
  }

  checkPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }

  toSummary(user: UserWithPassword): UserSummary {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isPrismaError(
    error: unknown,
    code: string,
  ): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
  }
}
