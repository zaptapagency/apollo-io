import { randomBytes } from 'node:crypto';

/** Lowercase, hyphenated, URL-safe slug derived from a display name. */
export function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : 'org';
}

/** Appends a short random suffix to a base slug, for disambiguation on collision. */
export function withRandomSuffix(base: string): string {
  return `${base}-${randomBytes(3).toString('hex')}`;
}
