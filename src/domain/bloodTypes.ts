// ABO group × Rh factor (ISBT/HL7 convention), plus ABO-only entries for
// students whose Rh factor has not been tested — common in school records.
export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'A', 'B', 'AB', 'O'] as const;

export type BloodType = (typeof BLOOD_TYPES)[number];

export const bloodTypeOptions = () =>
  BLOOD_TYPES.map((code) => {
    const rh = code.endsWith('+') ? '+' : code.endsWith('-') ? '-' : null;
    return { code, group: rh ? code.slice(0, -1) : code, rh };
  });
