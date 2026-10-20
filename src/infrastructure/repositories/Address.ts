// Shared address handling for people (students, teachers): province and district
// come from the reference tables, village / house details are free text.

export const ADDRESS_INCLUDE = {
  province: { select: { provinceId: true, nameLo: true, nameEn: true } },
  district: { select: { districtId: true, nameLo: true, nameEn: true } },
} as const;

const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

/**
 * Keeps province and district consistent: the district must lie in the chosen
 * province, and a district on its own fills in its province. On update, pass
 * `loadSavedDistrictId` so a province change is checked against the district
 * already stored when the request doesn't send one.
 */
export async function checkAddress(
  tx,
  data: Record<string, unknown>,
  loadSavedDistrictId?: () => Promise<number | null | undefined>,
) {
  if (data.provinceId === undefined && data.districtId === undefined) return;

  let districtId = data.districtId as number | null | undefined;
  if (districtId === undefined && loadSavedDistrictId) districtId = await loadSavedDistrictId();

  if (data.provinceId) {
    const exists = await tx.province.findUnique({ where: { provinceId: data.provinceId }, select: { provinceId: true } });
    if (!exists) throw httpError('Province not found', 400);
  }
  if (!districtId) return;

  const district = await tx.district.findUnique({ where: { districtId }, select: { provinceId: true } });
  if (!district) throw httpError('District not found', 400);
  if (data.provinceId === undefined || data.provinceId === null) {
    data.provinceId = district.provinceId;
  } else if (data.provinceId !== district.provinceId) {
    throw httpError('The district is not in the selected province', 400);
  }
}
