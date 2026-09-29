import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { buildMeta } from '../common/dto/api-result';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const MANUFACTURER_SELECT = { select: { id: true, name: true } } as const;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  /**
   * The single place where tenant isolation is enforced. Every read/update/delete
   * goes through this, so a manufacturer can never touch another manufacturer's data.
   */
  private scope(user: AuthUser): Prisma.ProductWhereInput {
    if (user.role === Role.MANUFACTURER) {
      // Fail closed: a manufacturer account without a manufacturer matches nothing.
      return { manufacturerId: user.manufacturerId ?? '__none__' };
    }
    return {};
  }

  private validateDates(manufactureDate?: Date | null, expiryDate?: Date | null) {
    if (manufactureDate && expiryDate && expiryDate < manufactureDate) {
      throw new BadRequestException('Expiry date cannot be earlier than the manufacture date');
    }
  }

  private isUniqueViolation(e: unknown) {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
  }

  private resolveManufacturerId(dto: CreateProductDto, user: AuthUser): string {
    if (user.role === Role.MANUFACTURER) {
      if (!user.manufacturerId) throw new ForbiddenException('Your account is not linked to a manufacturer');
      if (dto.manufacturerId && dto.manufacturerId !== user.manufacturerId) {
        throw new ForbiddenException('You can only register products for your own manufacturer');
      }
      return user.manufacturerId;
    }
    if (!dto.manufacturerId) throw new BadRequestException('manufacturerId is required');
    return dto.manufacturerId;
  }

  async create(dto: CreateProductDto, user: AuthUser) {
    const manufacturerId = this.resolveManufacturerId(dto, user);
    const manufacturer = await this.prisma.manufacturer.findUnique({ where: { id: manufacturerId } });
    if (!manufacturer) throw new NotFoundException('Manufacturer not found');
    if (!manufacturer.isActive) throw new BadRequestException('Manufacturer is deactivated');

    const manufactureDate = dto.manufactureDate ? new Date(dto.manufactureDate) : null;
    const expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;
    this.validateDates(manufactureDate, expiryDate);

    try {
      const product = await this.prisma.product.create({
        data: {
          manufacturerId,
          name: dto.name,
          productCode: dto.productCode.toUpperCase(),
          category: dto.category,
          description: dto.description,
          batchNumber: dto.batchNumber,
          serialNumber: dto.serialNumber,
          manufactureDate,
          expiryDate,
          status: dto.status,
        },
        include: { manufacturer: MANUFACTURER_SELECT },
      });
      await this.audit.log(user.id, 'PRODUCT_CREATED', 'Product', product.id, { productCode: product.productCode });
      return product;
    } catch (e) {
      if (this.isUniqueViolation(e)) throw new ConflictException('A product with this product code already exists');
      throw e;
    }
  }

  async findAll(q: QueryProductsDto, user: AuthUser) {
    const filters: Prisma.ProductWhereInput[] = [this.scope(user)];
    if (user.role === Role.ADMIN && q.manufacturerId) filters.push({ manufacturerId: q.manufacturerId });
    if (q.status) filters.push({ status: q.status });
    if (q.category) filters.push({ category: { equals: q.category, mode: 'insensitive' } });
    if (q.createdFrom || q.createdTo) {
      filters.push({
        createdAt: {
          ...(q.createdFrom ? { gte: new Date(q.createdFrom) } : {}),
          ...(q.createdTo ? { lte: new Date(q.createdTo) } : {}),
        },
      });
    }
    if (q.search) {
      filters.push({
        OR: [
          { name: { contains: q.search, mode: 'insensitive' } },
          { productCode: { contains: q.search, mode: 'insensitive' } },
          { batchNumber: { contains: q.search, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.ProductWhereInput = { AND: filters };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { [q.sortBy]: q.order },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { manufacturer: MANUFACTURER_SELECT, _count: { select: { verificationCodes: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, meta: buildMeta(q.page, q.limit, total) };
  }

  /** Returns 404 (not 403) for other tenants' products so their existence isn't revealed. */
  async findOne(id: string, user: AuthUser) {
    const product = await this.prisma.product.findFirst({
      where: { AND: [{ id }, this.scope(user)] },
      include: { manufacturer: MANUFACTURER_SELECT, _count: { select: { verificationCodes: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, dto: UpdateProductDto, user: AuthUser) {
    const existing = await this.findOne(id, user);

    const manufactureDate = dto.manufactureDate ? new Date(dto.manufactureDate) : undefined;
    const expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : undefined;
    this.validateDates(manufactureDate ?? existing.manufactureDate, expiryDate ?? existing.expiryDate);

    try {
      const product = await this.prisma.product.update({
        where: { id: existing.id },
        data: {
          ...dto,
          ...(dto.productCode ? { productCode: dto.productCode.toUpperCase() } : {}),
          manufactureDate,
          expiryDate,
        },
        include: { manufacturer: MANUFACTURER_SELECT },
      });
      await this.audit.log(user.id, 'PRODUCT_UPDATED', 'Product', id, { fields: Object.keys(dto) });
      return product;
    } catch (e) {
      if (this.isUniqueViolation(e)) throw new ConflictException('A product with this product code already exists');
      throw e;
    }
  }

  /** Products that already have verification codes carry history, so they can only be set INACTIVE. */
  async remove(id: string, user: AuthUser) {
    const product = await this.findOne(id, user);
    if (product._count.verificationCodes > 0) {
      throw new ConflictException('This product has verification codes. Set its status to INACTIVE instead of deleting it.');
    }
    await this.prisma.product.delete({ where: { id: product.id } });
    await this.audit.log(user.id, 'PRODUCT_DELETED', 'Product', id, { productCode: product.productCode });
    return null;
  }
}
