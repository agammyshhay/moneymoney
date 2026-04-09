// [CUSTOM-BASE44-START]
import crypto from 'node:crypto';
import { saveIntoAccount, getFromAccount, deleteFromAccount } from '@/backend/configManager/encryption/keytar';

const ACCOUNT_NAME = 'bearer-token';
const MAX_TOKEN_LENGTH = 4096;

// Deep-link auth nonce — prevents accepting unsolicited moneymoney://auth callbacks
const AUTH_NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let pendingAuthNonce: { nonce: string; createdAt: number } | null = null;

export function generateAuthNonce(): string {
  const nonce = crypto.randomBytes(32).toString('hex');
  pendingAuthNonce = { nonce, createdAt: Date.now() };
  return nonce;
}

export function validateAuthNonce(state: string | null): boolean {
  if (!pendingAuthNonce) return false;
  const elapsed = Date.now() - pendingAuthNonce.createdAt;
  if (elapsed > AUTH_NONCE_TTL_MS) {
    pendingAuthNonce = null;
    return false;
  }
  // If Base44 echoes back the state param, verify it matches
  if (state && state !== pendingAuthNonce.nonce) return false;
  // Valid — consume the nonce so it can't be reused
  pendingAuthNonce = null;
  return true;
}

export async function saveBase44Token(token: string): Promise<void> {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token: must be a non-empty string');
  }
  if (token.length > MAX_TOKEN_LENGTH) {
    throw new Error('Invalid token: exceeds maximum length');
  }
  await saveIntoAccount(ACCOUNT_NAME, token);
}

export async function getBase44Token(): Promise<string | null> {
  return getFromAccount(ACCOUNT_NAME);
}

export async function clearBase44Token(): Promise<void> {
  await deleteFromAccount(ACCOUNT_NAME);
}

export async function hasBase44Token(): Promise<boolean> {
  return !!(await getBase44Token());
}
// [CUSTOM-BASE44-END]
