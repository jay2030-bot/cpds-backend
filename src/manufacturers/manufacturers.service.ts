import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { buildMeta } from '../common/dto/api-result';
import { PrismaService } from '../prisma/prisma.service';
import { CreateManufacturerDto } from './dto/create-manufacturer.dto';
import { QueryManufacturersDto } from './dto/query-manufacturers.dto';
import { UpdateManufacturerDto } from './dto/update-manufacturer.dto';

const USER_SELECT = { id: true, name: true, email: true, isActive: true } as const;

@Injectable()
export class ManufacturersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async create(dto: CreateManufacturerDto, actor: AuthUser) {
    const { adminUser, ...data } = dto;
    const password = adminUser ? await bcrypt.hash(adminUser.password, 12) : null;

    // Nested create makes manufacturer + login one atomic operation.
    const manufacturer = await this.prisma.manufacturer.create({
      data: {
        ...data,
        ...(adminUser && password
          ? { users: { create: [{ name: adminUser.name, email: adminUser.email.toLowerCase(), password, role: 'MANUFACTURER' as const }] } }
          : {}),
      },
      include: { users: { select: USER_SELECT } },
    });
    await this.audit.log(actor.id, 'MANUFACTURER_CREATED', 'Manufacturer', manufacturer.id, { name: manufacturer.name });
    return manufacturer;
  }

  async findAll(q: QueryManufacturersDto) {
    const where: Prisma.ManufacturerWhereInput = {
      ...(q.isActive !== undefined ? { isActive: q.isActive } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { email: { contains: q.search, mode: 'insensitive' } },
              { registrationNumber: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.manufacturer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { _count: { select: { products: true, users: true } } },
      }),
      this.prisma.manufacturer.count({ where }),
    ]);
    return { items, meta: buildMeta(q.page, q.limit, total) };
  }

  async findOne(id: string) {
    const manufacturer = await this.prisma.manufacturer.findUnique({
      where: { id },
      include: { users: { select: USER_SELECT }, _count: { select: { products: true } } },
    });
    if (!manufacturer) throw new NotFoundException('Manufacturer not found');
    return manufacturer;
  }

  async update(id: string, dto: UpdateManufacturerDto, actor: AuthUser) {
    await this.findOne(id);
    const { isActive, ...rest } = dto;
    const manufacturerUpdate = this.prisma.manufacturer.update({
      where: { id },
      data: { ...rest, ...(isActive !== undefined ? { isActive } : {}) },
    });
    // Login accounts follow the manufacturer's active state.
    if (isActive !== undefined) {
      await this.prisma.$transaction([
        manufacturerUpdate,
        this.prisma.user.updateMany({ where: { manufacturerId: id }, data: { isActive } }),
      ]);
    } else {
      await manufacturerUpdate;
    }
    await this.audit.log(actor.id, 'MANUFACTURER_UPDATED', 'Manufacturer', id, { fields: Object.keys(dto) });
    return this.findOne(id);
  }

  /** Soft delete: manufacturers own products and verification history, so rows are never removed. */
  async deactivate(id: string, actor: AuthUser) {
    return this.update(id, { isActive: false }, actor).then(async (m) => {
      await this.audit.log(actor.id, 'MANUFACTURER_DEACTIVATED', 'Manufacturer', id);
      return m;
    });
  }
}
