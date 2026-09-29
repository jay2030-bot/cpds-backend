import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CodeStatus, Prisma, Role, VerificationResult } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { buildMeta } from '../common/dto/api-result';
import { normalizeToken } from '../common/utils/token.util';
import { calculateRiskLevel, resultForRisk, RiskThresholds } from '../common/utils/risk.util';
import { PrismaService } from '../prisma/prisma.service';
import { QueryVerificationsDto } from './dto/query-verifications.dto';
import { toPublicProductView, VerificationResponseDto } from './verification-response.types';

export interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

const CODE_WITH_PRODUCT = { product: { include: { manufacturer: true } } } as const;
type CodeWithProduct = Prisma.ProductVerificationCodeGetPayload<{ include: typeof CODE_WITH_PRODUCT }>;

@Injectable()
export class VerificationService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private thresholds(): RiskThresholds {
    return {
      mediumThreshold: Number(this.config.get('VERIFICATION_MEDIUM_THRESHOLD') ?? 3),
      highThreshold: Number(this.config.get('VERIFICATION_HIGH_THRESHOLD') ?? 6),
    };
  }

  /**
   * The single entry point for both the QR-scan flow (GET /verification/:token) and
   * manual entry (POST /verification/manual). Every branch writes exactly one
   * VerificationLog row, so history is complete regardless of the outcome.
   */
  async verify(rawInput: string, meta: RequestMeta): Promise<VerificationResponseDto> {
    const token = normalizeToken(rawInput);

    const code = await this.prisma.productVerificationCode.findUnique({
      where: { verificationToken: token },
      include: CODE_WITH_PRODUCT,
    });

    if (!code) {
      await this.writeLog(null, token, VerificationResult.INVALID, 'LOW', meta);
      return this.invalidResponse();
    }

    // Lazy transition: an ACTIVE code whose product has passed its expiry date becomes
    // EXPIRED the first time anyone checks it. This keeps the persisted CodeStatus in sync
    // with the product's expiryDate so admin listings never show a stale ACTIVE status.
    let status = code.status;
    if (status === CodeStatus.ACTIVE && code.product.expiryDate && code.product.expiryDate.getTime() < Date.now()) {
      await this.prisma.productVerificationCode.update({ where: { id: code.id }, data: { status: CodeStatus.EXPIRED } });
      status = CodeStatus.EXPIRED;
    }

    if (status === CodeStatus.DEACTIVATED) {
      const updated = await this.recordAttempt(code);
      await this.writeLog(code.id, token, VerificationResult.DEACTIVATED, 'LOW', meta);
      return this.deactivatedResponse(code, updated.verificationCount);
    }

    if (status === CodeStatus.EXPIRED) {
      const updated = await this.recordAttempt(code);
      await this.writeLog(code.id, token, VerificationResult.EXPIRED, 'LOW', meta);
      return this.expiredResponse(code, updated.verificationCount);
    }

    // ACTIVE: the only path where repeated-scan risk is evaluated.
    const updated = await this.recordAttempt(code);
    const risk = calculateRiskLevel(updated.verificationCount, this.thresholds());
    const result = resultForRisk(risk);
    await this.writeLog(code.id, token, result, risk, meta);
    return this.activeResponse(code, updated.verificationCount, risk, result);
  }

  private recordAttempt(code: CodeWithProduct) {
    const now = new Date();
    return this.prisma.productVerificationCode.update({
      where: { id: code.id },
      data: {
        verificationCount: { increment: 1 },
        firstVerifiedAt: code.firstVerifiedAt ?? now,
        lastVerifiedAt: now,
      },
    });
  }

  private writeLog(
    verificationCodeId: string | null,
    enteredCode: string,
    result: VerificationResult,
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH',
    meta: RequestMeta,
  ) {
    return this.prisma.verificationLog.create({
      data: {
        verificationCodeId,
        enteredCode,
        result,
        riskLevel,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
      },
    });
  }

  // ---- response builders (public-safe: never leak manufacturer internals) ----

  private invalidResponse(): VerificationResponseDto {
    return {
      status: VerificationResult.INVALID,
      message: 'Product Could Not Be Verified',
      detail:
        'This verification code does not exist in the system. The product may be counterfeit, or the code may have been entered incorrectly.',
    };
  }

  private deactivatedResponse(code: CodeWithProduct, count: number): VerificationResponseDto {
    return {
      status: VerificationResult.DEACTIVATED,
      message: 'Product Verification Unavailable',
      detail: 'This verification code is no longer active. Please contact the manufacturer if you believe this is a mistake.',
      verificationCount: count,
      product: toPublicProductView(code.product),
    };
  }

  private expiredResponse(code: CodeWithProduct, count: number): VerificationResponseDto {
    return {
      status: VerificationResult.EXPIRED,
      message: 'Product Registered — Expiry Notice',
      detail:
        "This verification code is genuine and registered in our system, but the product's expiry date has passed. Please check the expiry date before use. This is not an indication of a counterfeit product.",
      verificationCount: count,
      product: toPublicProductView(code.product),
    };
  }

  private activeResponse(
    code: CodeWithProduct,
    count: number,
    risk: 'LOW' | 'MEDIUM' | 'HIGH',
    result: VerificationResult,
  ): VerificationResponseDto {
    const product = toPublicProductView(code.product);
    if (result === VerificationResult.GENUINE) {
      return {
        status: VerificationResult.GENUINE,
        message: 'Product Verified',
        detail:
          count === 1
            ? 'This is the first time this verification code has been checked. The product appears to be genuine.'
            : `This product has been verified ${count} times. This is within the normal range and does not indicate any problem.`,
        riskLevel: risk,
        verificationCount: count,
        product,
      };
    }
    return {
      status: VerificationResult.SUSPICIOUS,
      message: 'Suspicious Verification Activity',
      detail:
        'This verification code has been verified multiple times. Repeated use of a verification code may indicate that the code has been copied or reused. Please exercise caution and contact the manufacturer if necessary.',
      riskLevel: risk,
      verificationCount: count,
      product,
    };
  }

  // ---- history (admin / manufacturer) ----

  private historyScope(user: AuthUser): Prisma.VerificationLogWhereInput {
    if (user.role === Role.MANUFACTURER) {
      return { verificationCode: { product: { manufacturerId: user.manufacturerId ?? '__none__' } } };
    }
    return {};
  }

  async findHistory(q: QueryVerificationsDto, user: AuthUser, forceResult?: VerificationResult) {
    const filters: Prisma.VerificationLogWhereInput[] = [this.historyScope(user)];
    if (forceResult) filters.push({ result: forceResult });
    else if (q.result) filters.push({ result: q.result });
    if (q.riskLevel) filters.push({ riskLevel: q.riskLevel });
    if (q.productId) filters.push({ verificationCode: { productId: q.productId } });
    if (q.from || q.to) {
      filters.push({
        verifiedAt: {
          ...(q.from ? { gte: new Date(q.from) } : {}),
          ...(q.to ? { lte: new Date(q.to) } : {}),
        },
      });
    }
    const where: Prisma.VerificationLogWhereInput = { AND: filters };

    const [items, total] = await Promise.all([
      this.prisma.verificationLog.findMany({
        where,
        orderBy: { verifiedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          verificationCode: {
            select: { verificationToken: true, product: { select: { id: true, name: true, productCode: true, manufacturerId: true } } },
          },
        },
      }),
      this.prisma.verificationLog.count({ where }),
    ]);
    return { items, meta: buildMeta(q.page, q.limit, total) };
  }
}
