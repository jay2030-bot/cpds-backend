import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { ProductsService } from './products.service';

const audit = { log: jest.fn() };
const P2002 = new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002' });

const adminUser = { id: 'admin1', role: Role.ADMIN, manufacturerId: null } as any;
const mfrA = { id: 'mfrUser-A', role: Role.MANUFACTURER, manufacturerId: 'mfr-A' } as any;
const mfrB = { id: 'mfrUser-B', role: Role.MANUFACTURER, manufacturerId: 'mfr-B' } as any;

const activeManufacturer = { id: 'mfr-A', isActive: true };

function buildService(prismaOverrides: Record<string, any>) {
  const prisma = {
    manufacturer: { findUnique: jest.fn().mockResolvedValue(activeManufacturer) },
    product: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    ...prismaOverrides,
  };
  return { service: new ProductsService(prisma as any, audit as any), prisma };
}

describe('ProductsService.create', () => {
  beforeEach(() => audit.log.mockClear());

  it('lets a manufacturer register a product under their own manufacturerId', async () => {
    const { service, prisma } = buildService({});
    prisma.product.create.mockResolvedValue({ id: 'p1', manufacturerId: 'mfr-A' });
    const dto = { name: 'Rice', productCode: 'rice-1', category: 'Food', batchNumber: 'B1' } as any;

    await service.create(dto, mfrA);

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ manufacturerId: 'mfr-A', productCode: 'RICE-1' }) }),
    );
  });

  it('rejects a manufacturer trying to set a different manufacturerId', async () => {
    const { service } = buildService({});
    const dto = { manufacturerId: 'mfr-B', name: 'Rice', productCode: 'R1', category: 'Food', batchNumber: 'B1' } as any;
    await expect(service.create(dto, mfrA)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires manufacturerId when an admin creates a product', async () => {
    const { service } = buildService({});
    const dto = { name: 'Rice', productCode: 'R1', category: 'Food', batchNumber: 'B1' } as any;
    await expect(service.create(dto, adminUser)).rejects.toThrow(/manufacturerId is required/);
  });

  it('turns a duplicate product code into a 409 Conflict, not a raw DB error', async () => {
    const { service, prisma } = buildService({});
    prisma.product.create.mockRejectedValue(P2002);
    const dto = { manufacturerId: 'mfr-A', name: 'Rice', productCode: 'R1', category: 'Food', batchNumber: 'B1' } as any;
    await expect(service.create(dto, adminUser)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ProductsService tenant isolation', () => {
  it("scopes findOne to the caller's manufacturerId, so another tenant's product looks not-found", async () => {
    const { service, prisma } = buildService({});
    // Simulate the DB correctly filtering the row out because it belongs to mfr-B.
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.findOne('some-product-id', mfrB)).rejects.toBeInstanceOf(NotFoundException);

    // The critical assertion: the manufacturer's own ID was included in the WHERE clause sent to the DB,
    // so isolation is enforced in the query itself, not just in application-level filtering after the fact.
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ id: 'some-product-id' }, { manufacturerId: 'mfr-B' }] },
      }),
    );
  });

  it('lets an admin read any product with no manufacturer restriction', async () => {
    const { service, prisma } = buildService({});
    prisma.product.findFirst.mockResolvedValue({ id: 'p1', _count: { verificationCodes: 0 } });

    await service.findOne('p1', adminUser);

    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ id: 'p1' }, {}] } }),
    );
  });

  it('fails closed for a manufacturer user with no manufacturerId set', async () => {
    const { service, prisma } = buildService({});
    prisma.product.findFirst.mockResolvedValue(null);
    const orphanUser = { id: 'u', role: Role.MANUFACTURER, manufacturerId: null } as any;

    await expect(service.findOne('p1', orphanUser)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ id: 'p1' }, { manufacturerId: '__none__' }] } }),
    );
  });
});
