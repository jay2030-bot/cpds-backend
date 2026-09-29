import { RiskLevel, VerificationResult } from '@prisma/client';

export interface RiskThresholds {
  mediumThreshold: number;
  highThreshold: number;
}

/**
 * Pure, configurable risk classification for repeated verification attempts.
 * Deliberately does NOT hard-code "second scan = counterfeit" (see spec section 11):
 * thresholds are supplied by the caller (read from env / ConfigService), so a
 * demonstration or a deployment can retune them without touching this logic.
 */
export function calculateRiskLevel(verificationCount: number, thresholds: RiskThresholds): RiskLevel {
  if (verificationCount >= thresholds.highThreshold) return RiskLevel.HIGH;
  if (verificationCount >= thresholds.mediumThreshold) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}

/** LOW risk reads as a normal, expected scan; MEDIUM/HIGH both surface as SUSPICIOUS (never "counterfeit"). */
export function resultForRisk(risk: RiskLevel): typeof VerificationResult.GENUINE | typeof VerificationResult.SUSPICIOUS {
  return risk === RiskLevel.LOW ? VerificationResult.GENUINE : VerificationResult.SUSPICIOUS;
}
