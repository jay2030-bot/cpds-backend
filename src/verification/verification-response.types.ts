import { RiskLevel, VerificationResult } from '@prisma/client';

export interface PublicProductView {
  name: string;
  category: string;
  manufacturer: string;
  batchNumber: string;
  manufactureDate: Date | null;
  expiryDate: Date | null;
}

export interface VerificationResponseDto {
  status: VerificationResult;
  message: string;
  detail: string;
  riskLevel?: RiskLevel;
  verificationCount?: number;
  product?: PublicProductView;
}

/** Never expose the manufacturer's internal ID, contact details, or other codes to a public scanner. */
export function toPublicProductView(product: {
  name: string;
  category: string;
  batchNumber: string;
  manufactureDate: Date | null;
  expiryDate: Date | null;
  manufacturer: { name: string };
}): PublicProductView {
  return {
    name: product.name,
    category: product.category,
    manufacturer: product.manufacturer.name,
    batchNumber: product.batchNumber,
    manufactureDate: product.manufactureDate,
    expiryDate: product.expiryDate,
  };
}
