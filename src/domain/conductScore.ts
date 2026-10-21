export interface BehaviorEntry {
  type: 'merit' | 'demerit';
  points: number;
}

export type ConductRating = 'excellent' | 'good' | 'fair' | 'needs_improvement';

export interface ConductScoreResult {
  baseScore: number;
  totalMerits: number;
  totalDemerits: number;
  finalScore: number;
  rating: ConductRating;
  ratingLabelEn: string;
  ratingLabelLo: string;
}

export function calculateConductScore(
  records: BehaviorEntry[],
  baseScore = 100
): ConductScoreResult {
  let totalMerits = 0;
  let totalDemerits = 0;

  for (const record of records) {
    const pts = Math.abs(record.points || 0);
    if (record.type === 'merit') {
      totalMerits += pts;
    } else if (record.type === 'demerit') {
      totalDemerits += pts;
    }
  }

  // Base score 100, clamped to a minimum of 0
  const finalScore = Math.max(0, Math.min(150, baseScore + totalMerits - totalDemerits));

  let rating: ConductRating = 'excellent';
  let ratingLabelEn = 'Excellent';
  let ratingLabelLo = 'ດີຫຼາຍ';

  if (finalScore >= 90) {
    rating = 'excellent';
    ratingLabelEn = 'Excellent';
    ratingLabelLo = 'ດີຫຼາຍ';
  } else if (finalScore >= 80) {
    rating = 'good';
    ratingLabelEn = 'Good';
    ratingLabelLo = 'ດີ';
  } else if (finalScore >= 70) {
    rating = 'fair';
    ratingLabelEn = 'Fair';
    ratingLabelLo = 'ປານກາງ';
  } else {
    rating = 'needs_improvement';
    ratingLabelEn = 'Needs Improvement';
    ratingLabelLo = 'ຕ້ອງປັບປຸງ';
  }

  return {
    baseScore,
    totalMerits,
    totalDemerits,
    finalScore,
    rating,
    ratingLabelEn,
    ratingLabelLo,
  };
}
