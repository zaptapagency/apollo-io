import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { extractBearerToken } from './bearer-token.util';

function makeRequest(headerValue: string | undefined): Request {
  return { header: (name: string) => (name === 'authorization' ? headerValue : undefined) } as unknown as Request;
}

describe('extractBearerToken', () => {
  it('extracts the token from a well-formed Authorization: Bearer header', () => {
    expect(extractBearerToken(makeRequest('Bearer abc123'))).toEqual('abc123');
  });

  it('returns undefined when the header is missing', () => {
    expect(extractBearerToken(makeRequest(undefined))).toBeUndefined();
  });

  it('returns undefined for a non-Bearer scheme', () => {
    expect(extractBearerToken(makeRequest('Basic abc123'))).toBeUndefined();
  });
});
