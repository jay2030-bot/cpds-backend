import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CodeStatus, Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { buildMeta } from '../common/dto/api-result';
import { generateVerificationToken } from '../common/utils/token.util';
import { PrismaService } from '../prisma/prisma.service';
import { QueryCodesDto } from './dto/query-codes.dto';
import { QrCodeService } from './qrcode.service';

const MAX_TOKEN_ATTEMPTS = 5;

@Injectable()
export class ProductCodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qr: QrCodeService,
    private readonly audit: AuditService,
  ) {}

  /** Loads the product and enforces that manufacturers only touch their own products. */
  private async loadOwnedProduct(productId: string, user: AuthUser) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (user.role === Role.MANUFACTURER && product.manufacturerId !== user.manufacturerId) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  /** Generates a token, retrying on the (astronomically unlikely) chance of a collision. */
  private async createUniqueCode(productId: string) {
    for (let attempt = 1; attempt <= MAX_TOKEN_ATTEMPTS; attempt++) {
      const verificationToken = generateVerificationToken();
      const qrCodeUrl = this.qr.buildVerificationUrl(verificationToken);
      try {
        return await this.prisma.productVerificationCode.create({
          data: { productId, verificationToken, qrCodeUrl },
        });
      } catch (e) {
        const isCollision = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
        if (!isCollision || attempt === MAX_TOKEN_ATTEMPTS) throw e;
      }
    }
    throw new Error('Unreachable');
  }

  async create(productId: string, user: AuthUser) {
    const product = await this.loadOwnedProduct(productId, user);
    const code = await this.createUniqueCode(product.id);
    await this.audit.log(user.id, 'VERIFICATION_CODE_CREATED', 'ProductVerificationCode', code.id, { productId });
    return code;
  }

  /**
   * Generates many codes efficiently: tokens are drawn and de-duplicated in memory,
   * then inserted with a single batched write per chunk (skipDuplicates guards the
   * negligible chance of a collision with an existing row instead of failing the batch).
   */
  async bulkCreate(productId: string, quantity: number, user: AuthUser) {
    const product = await this.loadOwnedProduct(productId, user);

    const tokens = new Set<string>();
    while (tokens.size < quantity) tokens.add(generateVerificationToken());

    const rows = [...tokens].map((verificationToken) => ({
      productId: product.id,
      verificationToken,
      qrCodeUrl: this.qr.buildVerificationUrl(verificationToken),
    }));

    const CHUNK = 500;
    let created = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const result = await this.prisma.productVerificationCode.createMany({
        data: rows.slice(i, i + CHUNK),
        skipDuplicates: true,
      });
      created += result.count;
    }

    // Extremely rare: a token happened to collide with an existing row and was skipped. Top up.
    if (created < quantity) {
      created += (await this.bulkCreate(productId, quantity - created, user)).created;
    }

    await this.audit.log(user.id, 'VERIFICATION_CODES_BULK_CREATED', 'Product', product.id, { quantity: created });
    return { productId: product.id, requested: quantity, created };
  }

  async findAllForProduct(productId: string, q: QueryCodesDto, user: AuthUser) {
    await this.loadOwnedProduct(productId, user);
    const where: Prisma.ProductVerificationCodeWhereInput = {
      productId,
      ...(q.status ? { status: q.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.productVerificationCode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.productVerificationCode.count({ where }),
    ]);
    return { items, meta: buildMeta(q.page, q.limit, total) };
  }

  /** Loads a code and enforces the same tenant scoping as products. */
  async findOneScoped(id: string, user: AuthUser) {
    const code = await this.prisma.productVerificationCode.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!code) throw new NotFoundException('Verification code not found');
    if (user.role === Role.MANUFACTURER && code.product.manufacturerId !== user.manufacturerId) {
      throw new NotFoundException('Verification code not found');
    }
    return code;
  }

  async updateStatus(id: string, status: CodeStatus, user: AuthUser) {
    const code = await this.findOneScoped(id, user);
    if (status === CodeStatus.EXPIRED) {
      // EXPIRED is derived from the product's expiry date at verification time, not set by hand.
      throw new BadRequestException('EXPIRED is set automatically based on the product expiry date, not manually');
    }
    const updated = await this.prisma.productVerificationCode.update({ where: { id: code.id }, data: { status } });
    await this.audit.log(user.id, 'VERIFICATION_CODE_STATUS_CHANGED', 'ProductVerificationCode', id, { status });
    return updated;
  }

  async getQrPng(id: string, user: AuthUser) {
    const code = await this.findOneScoped(id, user);
    return this.qr.toPngBuffer(code.qrCodeUrl ?? this.qr.buildVerificationUrl(code.verificationToken));
  }

  async getQrSvg(id: string, user: AuthUser) {
    const code = await this.findOneScoped(id, user);
    return this.qr.toSvgString(code.qrCodeUrl ?? this.qr.buildVerificationUrl(code.verificationToken));
  }
}
