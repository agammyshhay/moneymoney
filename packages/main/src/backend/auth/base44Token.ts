// [CUSTOM-BASE44-START]
import { saveIntoAccount, getFromAccount, deleteFromAccount } from '@/backend/configManager/encryption/keytar';

const ACCOUNT_NAME = 'bearer-token';
const MAX_TOKEN_LENGTH = 4096;

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
