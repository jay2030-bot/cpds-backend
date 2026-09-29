import { Role } from '@prisma/client';
import { DashboardService } from './dashboard.service';

const adminUser = { id: 'a1', role: Role.ADMIN, manufacturerId: null } as any;
const mfrUser = { id: 'm1', role: Role.MANUFACTURER, manufacturerId: 'mfr-A' } as any;

function buildService(overrides: { codes?: any[]; logs?: any[] } = {}) {
  const prisma = {
    product: { count: jest.fn().mockResolvedValue(0) },
    productVerificationCode: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue(overrides.codes ?? []),
    },
    verificationLog: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue(overrides.logs ?? []),
    },
  };
  const verification = { findHistory: jest.fn().mockResolvedValue({ items: [], meta: {} }) };
  return { service: new DashboardService(prisma as any, verification as any), prisma, verification };
}

describe('DashboardService.getDashboard', () => {
  it('scopes every query to the manufacturer for a MANUFACTURER caller', async () => {
    const { service, prisma, verification } = buildService();

    await service.getDashboard(mfrUser);

    expect(prisma.product.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ manufacturerId: 'mfr-A' }) }),
    );
    expect(prisma.productVerificationCode.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ product: { manufacturerId: 'mfr-A' } }) }),
    );
    expect(verification.findHistory).toHaveBeenCalledWith(expect.anything(), mfrUser, 'SUSPICIOUS');
  });

  it('applies no manufacturer filter for an ADMIN caller', async () => {
    const { service, prisma } = buildService();

    await service.getDashboard(adminUser);

    expect(prisma.product.count).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('sums verificationCount per product across multiple codes and ranks them descending', async () => {
    const codes = [
      { verificationCount: 5, product: { id: 'p1', name: 'Rice', productCode: 'R1' } },
      { verificationCount: 3, product: { id: 'p1', name: 'Rice', productCode: 'R1' } }, // second code of same product
      { verificationCount: 9, product: { id: 'p2', name: 'Oil', productCode: 'O1' } },
    ];
    const { service } = buildService({ codes });

    const res = await service.getDashboard(adminUser);

    expect(res.topVerifiedProducts[0]).toEqual({ productId: 'p2', name: 'Oil', productCode: 'O1', verificationCount: 9 });
    expect(res.topVerifiedProducts[1]).toEqual({ productId: 'p1', name: 'Rice', productCode: 'R1', verificationCount: 8 });
  });

  it('buckets verification logs into a 14-day series with the correct result counted on the correct day', async () => {
    const today = new Date();
    const logs = [
      { verifiedAt: today, result: 'GENUINE' },
      { verifiedAt: today, result: 'SUSPICIOUS' },
    ];
    const { service } = buildService({ logs });

    const res = await service.getDashboard(adminUser);

    expect(res.activityOverTime).toHaveLength(14);
    const todayKey = today.toISOString().slice(0, 10);
    const todayBucket = res.activityOverTime.find((p) => p.date === todayKey);
    expect(todayBucket).toEqual({ date: todayKey, genuine: 1, suspicious: 1, invalid: 0, deactivated: 0, expired: 0 });
  });

  it('returns a full 8-field stats object every time', async () => {
    const { service } = buildService();
    const res = await service.getDashboard(adminUser);
    expect(Object.keys(res.stats).sort()).toEqual(
      [
        'activeProducts', 'deactivatedProducts', 'genuineVerifications', 'invalidAttempts',
        'suspiciousVerifications', 'totalProducts', 'totalVerificationCodes', 'totalVerifications',
      ].sort(),
    );
  });
});
