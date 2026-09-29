import { CodeStatus, VerificationResult } from '@prisma/client';
import { VerificationService } from './verification.service';

const config = { get: (key: string) => ({ VERIFICATION_MEDIUM_THRESHOLD: '3', VERIFICATION_HIGH_THRESHOLD: '6' }[key]) } as any;

const manufacturer = { name: 'ABC Foods Ltd.' };
const baseProduct = {
  name: 'Premium Rice 5kg',
  category: 'Food',
  batchNumber: 'RICE-2026-001',
  manufactureDate: new Date('2026-01-01'),
  expiryDate: new Date('2099-01-01'), // far future by default
  manufacturer,
};

function buildService(codeRow: any) {
  const updatedRows: any[] = [];
  const prisma = {
    productVerificationCode: {
      findUnique: jest.fn().mockResolvedValue(codeRow),
      update: jest.fn((args: any) => {
        const next = {
          ...codeRow,
          status: args.data.status ?? codeRow.status,
          verificationCount: args.data.verificationCount?.increment
            ? codeRow.verificationCount + args.data.verificationCount.increment
            : codeRow.verificationCount,
          firstVerifiedAt: args.data.firstVerifiedAt ?? codeRow.firstVerifiedAt,
          lastVerifiedAt: args.data.lastVerifiedAt ?? codeRow.lastVerifiedAt,
        };
        updatedRows.push(next);
        codeRow.status = next.status;
        codeRow.verificationCount = next.verificationCount;
        codeRow.firstVerifiedAt = next.firstVerifiedAt;
        return Promise.resolve(next);
      }),
    },
    verificationLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return { service: new VerificationService(prisma as any, config), prisma };
}

describe('VerificationService.verify', () => {
  it('returns INVALID and logs a null-code attempt when the token does not exist', async () => {
    const prisma = {
      productVerificationCode: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      verificationLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new VerificationService(prisma as any, config);

    const res = await service.verify('CPDS-FAKE-1234-XXXX-YYYY', {});

    expect(res.status).toBe(VerificationResult.INVALID);
    expect(prisma.verificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ verificationCodeId: null, result: VerificationResult.INVALID }) }),
    );
  });

  it('returns GENUINE with count 1 on the first scan of an active code', async () => {
    const codeRow = { id: 'c1', status: CodeStatus.ACTIVE, verificationCount: 0, firstVerifiedAt: null, product: baseProduct };
    const { service } = buildService(codeRow);

    const res = await service.verify('cpds-8f7k-x29p-4lmq-7tz1', {});

    expect(res.status).toBe(VerificationResult.GENUINE);
    expect(res.verificationCount).toBe(1);
    expect(res.riskLevel).toBe('LOW');
    expect(res.product?.name).toBe('Premium Rice 5kg');
  });

  it('increases verificationCount on every subsequent scan', async () => {
    const codeRow = { id: 'c1', status: CodeStatus.ACTIVE, verificationCount: 1, firstVerifiedAt: new Date(), product: baseProduct };
    const { service } = buildService(codeRow);

    const res = await service.verify('token', {});

    expect(res.verificationCount).toBe(2);
  });

  it('flips to SUSPICIOUS once the medium threshold (3rd scan) is reached', async () => {
    const codeRow = { id: 'c1', status: CodeStatus.ACTIVE, verificationCount: 2, firstVerifiedAt: new Date(), product: baseProduct };
    const { service } = buildService(codeRow);

    const res = await service.verify('token', {});

    expect(res.verificationCount).toBe(3);
    expect(res.status).toBe(VerificationResult.SUSPICIOUS);
    expect(res.riskLevel).toBe('MEDIUM');
    expect(res.detail).toMatch(/exercise caution/i);
    expect(res.detail).not.toMatch(/counterfeit/i); // spec: never assert counterfeit outright
  });

  it('escalates to HIGH risk at the high threshold (6th scan) while staying SUSPICIOUS, not a harder verdict', async () => {
    const codeRow = { id: 'c1', status: CodeStatus.ACTIVE, verificationCount: 5, firstVerifiedAt: new Date(), product: baseProduct };
    const { service } = buildService(codeRow);

    const res = await service.verify('token', {});

    expect(res.verificationCount).toBe(6);
    expect(res.status).toBe(VerificationResult.SUSPICIOUS);
    expect(res.riskLevel).toBe('HIGH');
  });

  it('returns DEACTIVATED for a deactivated code without ever computing risk', async () => {
    const codeRow = { id: 'c1', status: CodeStatus.DEACTIVATED, verificationCount: 4, firstVerifiedAt: new Date(), product: baseProduct };
    const { service } = buildService(codeRow);

    const res = await service.verify('token', {});

    expect(res.status).toBe(VerificationResult.DEACTIVATED);
    expect(res.riskLevel).toBeUndefined();
  });

  it('returns EXPIRED for a product past its expiry date and persists the code status transition', async () => {
    const expiredProduct = { ...baseProduct, expiryDate: new Date('2020-01-01') };
    const codeRow = { id: 'c1', status: CodeStatus.ACTIVE, verificationCount: 0, firstVerifiedAt: null, product: expiredProduct };
    const { service, prisma } = buildService(codeRow);

    const res = await service.verify('token', {});

    expect(res.status).toBe(VerificationResult.EXPIRED);
    expect(res.detail).not.toMatch(/is counterfeit|definitely counterfeit/i); // spec: expiry must not assert counterfeit
    // The lazy status transition to EXPIRED was persisted.
    expect(prisma.productVerificationCode.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: CodeStatus.EXPIRED }) }),
    );
  });

  it('treats an already-EXPIRED code as expired without re-checking the date', async () => {
    const expiredProduct = { ...baseProduct, expiryDate: new Date('2020-01-01') };
    const codeRow = { id: 'c1', status: CodeStatus.EXPIRED, verificationCount: 2, firstVerifiedAt: new Date(), product: expiredProduct };
    const { service } = buildService(codeRow);

    const res = await service.verify('token', {});

    expect(res.status).toBe(VerificationResult.EXPIRED);
  });
});
