import { describe, it, expect } from 'vitest';
import { calculateConductScore } from './conductScore';

describe('conductScore', () => {
  it('returns baseline 100 with excellent rating when no records exist', () => {
    const result = calculateConductScore([]);
    expect(result.finalScore).toBe(100);
    expect(result.rating).toBe('excellent');
  });

  it('adds merits and deducts demerits correctly', () => {
    const result = calculateConductScore([
      { type: 'merit', points: 10 },
      { type: 'demerit', points: 25 },
    ]);
    expect(result.totalMerits).toBe(10);
    expect(result.totalDemerits).toBe(25);
    expect(result.finalScore).toBe(85);
    expect(result.rating).toBe('good');
  });

  it('categorizes as needs_improvement when score drops below 70', () => {
    const result = calculateConductScore([
      { type: 'demerit', points: 40 },
    ]);
    expect(result.finalScore).toBe(60);
    expect(result.rating).toBe('needs_improvement');
    expect(result.ratingLabelLo).toBe('ຕ້ອງປັບປຸງ');
  });

  it('clamps minimum final score at 0', () => {
    const result = calculateConductScore([
      { type: 'demerit', points: 200 },
    ]);
    expect(result.finalScore).toBe(0);
    expect(result.rating).toBe('needs_improvement');
  });
});
