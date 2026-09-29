import { RiskLevel, VerificationResult } from '@prisma/client';
import { calculateRiskLevel, resultForRisk } from './risk.util';

const thresholds = { mediumThreshold: 3, highThreshold: 6 };

describe('calculateRiskLevel', () => {
  it.each([
    [1, RiskLevel.LOW],
    [2, RiskLevel.LOW],
    [3, RiskLevel.MEDIUM],
    [5, RiskLevel.MEDIUM],
    [6, RiskLevel.HIGH],
    [50, RiskLevel.HIGH],
  ])('count=%i -> %s', (count, expected) => {
    expect(calculateRiskLevel(count, thresholds)).toBe(expected);
  });

  it('respects custom thresholds instead of hard-coded ones', () => {
    expect(calculateRiskLevel(2, { mediumThreshold: 2, highThreshold: 4 })).toBe(RiskLevel.MEDIUM);
  });
});

describe('resultForRisk', () => {
  it('maps LOW risk to GENUINE and MEDIUM/HIGH to SUSPICIOUS, never "counterfeit"', () => {
    expect(resultForRisk(RiskLevel.LOW)).toBe(VerificationResult.GENUINE);
    expect(resultForRisk(RiskLevel.MEDIUM)).toBe(VerificationResult.SUSPICIOUS);
    expect(resultForRisk(RiskLevel.HIGH)).toBe(VerificationResult.SUSPICIOUS);
  });
});
