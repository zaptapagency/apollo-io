import * as argon2 from 'argon2';

/** Hashes a plaintext password with argon2id (library default). Never store the raw password. */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

/** Verifies a plaintext password against a previously-stored argon2 hash. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
