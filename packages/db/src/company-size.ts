import type { CompanySize } from '@prisma/client';

/** Maps a raw employee count to the bucketed CompanySize enum used for faceted search. */
export function companySizeFromCount(count: number): CompanySize {
  if (count <= 10) return 'SIZE_1_10';
  if (count <= 50) return 'SIZE_11_50';
  if (count <= 200) return 'SIZE_51_200';
  if (count <= 500) return 'SIZE_201_500';
  if (count <= 1000) return 'SIZE_501_1000';
  if (count <= 5000) return 'SIZE_1001_5000';
  if (count <= 10000) return 'SIZE_5001_10000';
  return 'SIZE_10001_PLUS';
}
