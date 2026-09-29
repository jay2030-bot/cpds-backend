import { Injectable } from '@nestjs/common';
import { Prisma, ProductStatus, Role, VerificationResult } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { QueryVerificationsDto } from '../verification/dto/query-verifications.dto';
import { VerificationService } from '../verification/verification.service';
import { ActivityPoint, DashboardResponse, ResultBreakdown, TopVerifiedProduct } from './dashboard.types';

const ACTIVITY_WINDOW_DAYS = 14;
const TOP_PRODUCTS_LIMIT = 5;
const RECENT_SUSPICIOUS_LIMIT = 5;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService, private readonly verification: VerificationService) {}

  /** Every dashboard query is scoped through this, so a manufacturer only ever sees their own numbers. */
  private productScope(user: AuthUser): Prisma.ProductWhereInput {
    return user.role === Role.MANUFACTURER ? { manufacturerId: user.manufacturerId ?? '__none__' } : {};
  }
  private codeScope(user: AuthUser): Prisma.ProductVerificationCodeWhereInput {
    return user.role === Role.MANUFACTURER ? { product: { manufacturerId: user.manufacturerId ?? '__none__' } } : {};
  }
  private logScope(user: AuthUser): Prisma.VerificationLogWhereInput {
    return user.role === Role.MANUFACTURER
      ? { verificationCode: { product: { manufacturerId: user.manufacturerId ?? '__none__' } } }
      : {};
  }

  async getDashboard(user: AuthUser): Promise<DashboardResponse> {
    const productWhere = this.productScope(user);
    const codeWhere = this.codeScope(user);
    const logWhere = this.logScope(user);

    const [
      totalProducts,
      activeProducts,
      deactivatedProducts,
      totalVerificationCodes,
      totalVerifications,
      genuineVerifications,
      suspiciousVerifications,
      invalidAttempts,
      deactivatedLogCount,
      expiredLogCount,
    ] = await Promise.all([
      this.prisma.product.count({ where: productWhere }),
      this.prisma.product.count({ where: { AND: [productWhere, { status: ProductStatus.ACTIVE }] } }),
      this.prisma.product.count({ where: { AND: [productWhere, { status: ProductStatus.INACTIVE }] } }),
      this.prisma.productVerificationCode.count({ where: codeWhere }),
      this.prisma.verificationLog.count({ where: logWhere }),
      this.prisma.verificationLog.count({ where: { AND: [logWhere, { result: VerificationResult.GENUINE }] } }),
      this.prisma.verificationLog.count({ where: { AND: [logWhere, { result: VerificationResult.SUSPICIOUS }] } }),
      this.prisma.verificationLog.count({ where: { AND: [logWhere, { result: VerificationResult.INVALID }] } }),
      this.prisma.verificationLog.count({ where: { AND: [logWhere, { result: VerificationResult.DEACTIVATED }] } }),
      this.prisma.verificationLog.count({ where: { AND: [logWhere, { result: VerificationResult.EXPIRED }] } }),
    ]);

    const resultBreakdown: ResultBreakdown = {
      genuine: genuineVerifications,
      suspicious: suspiciousVerifications,
      invalid: invalidAttempts,
      deactivated: deactivatedLogCount,
      expired: expiredLogCount,
    };

    const [activityOverTime, topVerifiedProducts, recentSuspicious] = await Promise.all([
      this.activityOverTime(logWhere),
      this.topVerifiedProducts(codeWhere),
      this.verification.findHistory(
        { page: 1, limit: RECENT_SUSPICIOUS_LIMIT } as QueryVerificationsDto,
        user,
        VerificationResult.SUSPICIOUS,
      ),
    ]);

    return {
      stats: {
        totalProducts,
        activeProducts,
        deactivatedProducts,
        totalVerificationCodes,
        totalVerifications,
        genuineVerifications,
        suspiciousVerifications,
        invalidAttempts,
      },
      activityOverTime,
      resultBreakdown,
      topVerifiedProducts,
      recentSuspiciousActivity: recentSuspicious.items,
    };
  }

  /**
   * Buckets verification logs from the last ACTIVITY_WINDOW_DAYS by calendar day.
   * Done in application code (not a raw SQL date_trunc query) to keep the query
   * portable and easy for a student to read and explain during a project defense.
   */
  private async activityOverTime(logWhere: Prisma.VerificationLogWhereInput): Promise<ActivityPoint[]> {
    const since = new Date();
    since.setDate(since.getDate() - (ACTIVITY_WINDOW_DAYS - 1));
    since.setHours(0, 0, 0, 0);

    const logs = await this.prisma.verificationLog.findMany({
      where: { AND: [logWhere, { verifiedAt: { gte: since } }] },
      select: { verifiedAt: true, result: true },
    });

    const buckets = new Map<string, ActivityPoint>();
    for (let i = 0; i < ACTIVITY_WINDOW_DAYS; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { date: key, genuine: 0, suspicious: 0, invalid: 0, deactivated: 0, expired: 0 });
    }

    for (const log of logs) {
      const key = log.verifiedAt.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue; // outside the window due to timezone edges; safely ignored
      if (log.result === VerificationResult.GENUINE) bucket.genuine++;
      else if (log.result === VerificationResult.SUSPICIOUS) bucket.suspicious++;
      else if (log.result === VerificationResult.INVALID) bucket.invalid++;
      else if (log.result === VerificationResult.DEACTIVATED) bucket.deactivated++;
      else if (log.result === VerificationResult.EXPIRED) bucket.expired++;
    }

    return [...buckets.values()];
  }

  /**
   * Ranks products by total scans. Reuses ProductVerificationCode.verificationCount
   * (already maintained incrementally by VerificationService on every scan) instead
   * of re-deriving totals from the full VerificationLog table.
   */
  private async topVerifiedProducts(codeWhere: Prisma.ProductVerificationCodeWhereInput): Promise<TopVerifiedProduct[]> {
    const codes = await this.prisma.productVerificationCode.findMany({
      where: codeWhere,
      select: { verificationCount: true, product: { select: { id: true, name: true, productCode: true } } },
    });

    const totals = new Map<string, TopVerifiedProduct>();
    for (const code of codes) {
      const existing = totals.get(code.product.id);
      if (existing) existing.verificationCount += code.verificationCount;
      else totals.set(code.product.id, {
        productId: code.product.id,
        name: code.product.name,
        productCode: code.product.productCode,
        verificationCount: code.verificationCount,
      });
    }

    return [...totals.values()]
      .sort((a, b) => b.verificationCount - a.verificationCount)
      .slice(0, TOP_PRODUCTS_LIMIT);
  }
}
