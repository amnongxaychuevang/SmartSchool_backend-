import { describe, it, expect } from 'vitest';
import { crossedLowBalance, effectiveThreshold, readLowBalanceDefault } from './lowBalance';

describe('lowBalance', () => {
  it('alerts once, on the purchase that goes below the threshold', () => {
    expect(crossedLowBalance(15000, 8000, 10000)).toBe(true);
    expect(crossedLowBalance(10000, 9000, 10000)).toBe(true); // exactly at the threshold, then below
    expect(crossedLowBalance(8000, 5000, 10000)).toBe(false); // already below: no repeat
    expect(crossedLowBalance(30000, 12000, 10000)).toBe(false); // still above
  });

  it('never alerts without a threshold', () => {
    expect(crossedLowBalance(15000, 0, null)).toBe(false);
    expect(crossedLowBalance(15000, 0, 0)).toBe(false);
  });

  it("uses the parent's threshold, else the school default", () => {
    expect(effectiveThreshold('20000.00', 10000)).toBe(20000);
    expect(effectiveThreshold(null, 10000)).toBe(10000);
    expect(effectiveThreshold(0, 10000)).toBe(10000);
    expect(effectiveThreshold(null, null)).toBeNull();
  });

  it('reads the school setting', () => {
    expect(readLowBalanceDefault({ defaultThreshold: 10000 })).toBe(10000);
    expect(readLowBalanceDefault({ defaultThreshold: null })).toBeNull();
    expect(readLowBalanceDefault(undefined)).toBeNull();
  });
});
