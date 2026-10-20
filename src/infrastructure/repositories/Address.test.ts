import { describe, it, expect } from 'vitest';
import { checkAddress } from './Address';

// Province 1 has district 7; province 16 has district 138.
const tx = {
  province: { findUnique: async ({ where }: { where: { provinceId: number } }) => ([1, 16].includes(where.provinceId) ? { provinceId: where.provinceId } : null) },
  district: {
    findUnique: async ({ where }: { where: { districtId: number } }) =>
      ({ 7: { provinceId: 1 }, 138: { provinceId: 16 } } as Record<number, { provinceId: number }>)[where.districtId] ?? null,
  },
};
const savedDistrict138 = async () => 138;

describe('checkAddress', () => {
  it('accepts a district inside the chosen province', async () => {
    await expect(checkAddress(tx, { provinceId: 1, districtId: 7 })).resolves.toBeUndefined();
  });

  it('rejects a district from another province', async () => {
    await expect(checkAddress(tx, { provinceId: 1, districtId: 138 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('fills in the province from the district', async () => {
    const data: Record<string, unknown> = { districtId: 7 };
    await checkAddress(tx, data);
    expect(data.provinceId).toBe(1);
  });

  it('rejects an unknown province or district', async () => {
    await expect(checkAddress(tx, { provinceId: 99 })).rejects.toMatchObject({ statusCode: 400 });
    await expect(checkAddress(tx, { districtId: 999 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('on update, checks a new province against the district already saved', async () => {
    await expect(checkAddress(tx, { provinceId: 1 }, savedDistrict138)).rejects.toMatchObject({ statusCode: 400 });
    await expect(checkAddress(tx, { provinceId: 16 }, savedDistrict138)).resolves.toBeUndefined();
  });

  it('allows clearing both', async () => {
    await expect(checkAddress(tx, { provinceId: null, districtId: null })).resolves.toBeUndefined();
  });
});
