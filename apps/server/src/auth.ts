import {
  createHash,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual
} from "node:crypto";

export interface PasswordRecord {
  salt: string;
  hash: string;
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function createRecoveryCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashPassword(password: string): PasswordRecord {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, record: PasswordRecord): boolean {
  const actual = scryptSync(password, record.salt, 64);
  const expected = Buffer.from(record.hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
