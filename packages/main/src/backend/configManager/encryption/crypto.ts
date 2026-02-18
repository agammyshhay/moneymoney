/*
Copied from https://github.com/eshaham/israeli-ynab-updater/blob/b207a6b2468fa2904412fe9563b8f65ac1e4cfaa/src/helpers/crypto.js
*/

import crypto from 'crypto';
import SALT from './salt';

const ALGORITHM = 'aes-256-ctr';
const V2_PREFIX = 'v2:';
const V2_IV_LENGTH = 16;

export function randomHex(characters = 16) {
  return crypto.randomBytes(characters).toString('hex');
}

function deriveKey(salt: string): Buffer {
  return crypto.scryptSync(salt, 'moneymoney', 32);
}

function encryptV2(text: string, salt: string): string {
  const key = deriveKey(salt);
  const iv = crypto.randomBytes(V2_IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return V2_PREFIX + iv.toString('hex') + encrypted.toString('hex');
}

function decryptV2(text: string, salt: string): string {
  const payload = text.slice(V2_PREFIX.length);
  const iv = Buffer.from(payload.slice(0, V2_IV_LENGTH * 2), 'hex');
  const encrypted = Buffer.from(payload.slice(V2_IV_LENGTH * 2), 'hex');
  const key = deriveKey(salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export async function encrypt(text: string) {
  const salt = await SALT(randomHex());
  return encryptV2(text, salt);
}

export async function decrypt(text: string) {
  try {
    const salt = await SALT();

    if (text.startsWith(V2_PREFIX)) {
      return decryptV2(text, salt);
    }

    // Legacy fallback: old format encrypted with crypto.createDecipher
    const decipher = crypto.createDecipher(ALGORITHM, salt);
    const decrypted = decipher.update(text, 'hex', 'utf8');
    return decrypted + decipher.final('utf8');
  } catch (e) {
    if (!text) {
      console.info('Failed to decrypt an empty string, returning null');
      return null;
    }
    console.error('Failed to decrypt', e);
    throw e;
  }
}
