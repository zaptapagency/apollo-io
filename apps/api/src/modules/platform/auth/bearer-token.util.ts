import type { Request } from 'express';

/** Extracts the raw bearer token from the Authorization header, if present. */
export function extractBearerToken(req: Request): string | undefined {
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return undefined;
}
