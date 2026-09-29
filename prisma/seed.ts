import { CodeStatus, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { generateVerificationToken } from '../src/common/utils/token.util';

const prisma = new PrismaClient();
const FRONTEND_URL = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/+$/, '');

// DEMO CREDENTIALS ONLY - never use these outside local development.
const DEMO_ADMIN = { name: 'CPDS Admin', email: 'admin@cpds.local', password: 'Admin@123456' };
const DEMO_PASSWORD = 'Manufacturer@123456';

const MANUFACTURERS = [
  {
    name: 'ABC Foods Ltd.',
    email: 'contact@abcfoods.demo',
    phone: '+234-800-000-0001',
    address: '12 Industrial Avenue, Lagos',
    registrationNumber: 'RC-100001',
    user: { name: 'ABC Foods Admin', email: 'manufacturer1@cpds.local' },
    products: [
      { name: 'Premium Rice 5kg', category: 'Food', batchNumber: 'RICE-2026-001', codes: 3 },
      { name: 'Vegetable Oil 1L', category: 'Food', batchNumber: 'OIL-2026-004', codes: 2 },
      { name: 'Tomato Paste 400g', category: 'Food', batchNumber: 'TOM-2026-002', codes: 2 },
    ],
  },
  {
    name: 'MediCare Pharmaceuticals',
    email: 'contact@medicare.demo',
    phone: '+234-800-000-0002',
    address: '45 Pharma Road, Abuja',
    registrationNumber: 'RC-100002',
    user: { name: 'MediCare Admin', email: 'manufacturer2@cpds.local' },
    products: [
      { name: 'Paracetamol 500mg', category: 'Pharmaceutical', batchNumber: 'PCM-2026-001', codes: 4 },
      { name: 'Amoxicillin 250mg', category: 'Pharmaceutical', batchNumber: 'AMX-2026-002', codes: 3 },
    ],
  },
];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo data when NODE_ENV=production');
  }

  const adminPassword = await bcrypt.hash(DEMO_ADMIN.password, 12);
  await prisma.user.upsert({
    where: { email: DEMO_ADMIN.email },
    update: {},
    create: { name: DEMO_ADMIN.name, email: DEMO_ADMIN.email, password: adminPassword, role: Role.ADMIN },
  });
  console.log(`Seeded demo admin: ${DEMO_ADMIN.email} / ${DEMO_ADMIN.password}`);

  const manufacturerPassword = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const [mIndex, m] of MANUFACTURERS.entries()) {
    let manufacturer = await prisma.manufacturer.findFirst({ where: { email: m.email } });
    if (!manufacturer) {
      manufacturer = await prisma.manufacturer.create({
        data: { name: m.name, email: m.email, phone: m.phone, address: m.address, registrationNumber: m.registrationNumber },
      });
    }

    await prisma.user.upsert({
      where: { email: m.user.email },
      update: {},
      create: { name: m.user.name, email: m.user.email, password: manufacturerPassword, role: Role.MANUFACTURER, manufacturerId: manufacturer.id },
    });

    for (const [pIndex, p] of m.products.entries()) {
      const product = await prisma.product.upsert({
        where: { productCode: p.batchNumber }, // demo data: batch number doubles as a stable, human-readable product code
        update: {},
        create: {
          manufacturerId: manufacturer.id,
          name: p.name,
          productCode: p.batchNumber,
          category: p.category,
          batchNumber: p.batchNumber,
          manufactureDate: new Date('2026-01-15'),
          expiryDate: new Date('2027-06-15'),
        },
      });

      // The very first code of the very first product is left DEACTIVATED, so
      // Scenario D from the spec (a deactivated code) is demonstrable immediately.
      const isFirstCodeOfFirstDemoProduct = mIndex === 0 && pIndex === 0;

      const existingCodes = await prisma.productVerificationCode.count({ where: { productId: product.id } });
      for (let i = existingCodes; i < p.codes; i++) {
        const verificationToken = generateVerificationToken();
        await prisma.productVerificationCode.create({
          data: {
            productId: product.id,
            verificationToken,
            qrCodeUrl: `${FRONTEND_URL}/verify/${verificationToken}`,
            status: isFirstCodeOfFirstDemoProduct && i === 0 ? CodeStatus.DEACTIVATED : CodeStatus.ACTIVE,
          },
        });
      }
    }
    console.log(`Seeded manufacturer: ${m.name} (login: ${m.user.email} / ${DEMO_PASSWORD})`);
  }

  console.log('\nNote: verification logs (genuine/suspicious/invalid scan history) are seeded from Phase 9 onward,');
  console.log('once the verification endpoint that produces them exists.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
