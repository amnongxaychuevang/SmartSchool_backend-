import { describe, it, expect } from 'vitest';
import { normalizeLaoPhone, LAO_PHONE_PATTERN } from './phone';

describe('normalizeLaoPhone', () => {
  it.each([
    ['02055500105'],
    ['2055500105'],
    ['+8562055500105'],
    ['+856 20 5550 0105'],
    ['856-20-5550-0105'],
    [' 020 5550 0105 '],
  ])('%s → +856 20 5550 0105', (input) => {
    expect(normalizeLaoPhone(input)).toBe('+856 20 5550 0105');
  });

  it.each([['0305550010'], ['020555001'], ['0205550010599'], ['abc'], ['']])('rejects %s', (input) => {
    expect(normalizeLaoPhone(input)).toBeNull();
  });

  it('output always matches the stored pattern', () => {
    expect(LAO_PHONE_PATTERN.test(normalizeLaoPhone('02012345678')!)).toBe(true);
  });
});
