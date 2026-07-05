import { describe, expect, it } from 'vitest';
import { companySizeFromCount } from './company-size';

describe('companySizeFromCount', () => {
  it.each([
    [5, 'SIZE_1_10'],
    [10, 'SIZE_1_10'],
    [11, 'SIZE_11_50'],
    [200, 'SIZE_51_200'],
    [500, 'SIZE_201_500'],
    [1000, 'SIZE_501_1000'],
    [5000, 'SIZE_1001_5000'],
    [10000, 'SIZE_5001_10000'],
    [10001, 'SIZE_10001_PLUS'],
    [500000, 'SIZE_10001_PLUS'],
  ])('buckets %i employees as %s', (count, expected) => {
    expect(companySizeFromCount(count)).toBe(expected);
  });
});
