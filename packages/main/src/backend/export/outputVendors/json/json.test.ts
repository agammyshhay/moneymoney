import { type EnrichedTransaction } from '@/backend/commonTypes';
import { writeFileAtomic } from '@/utils/atomicWrite';
import { withFileLock } from '@/utils/fileMutex';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// app-globals runs Electron's App.getAppPath() at import time, which isn't available
// under vitest. Our tests use absolute paths, so the value here is irrelevant.
vi.mock('@/app-globals', () => ({ userDataPath: '', configFilePath: '' }));

// electron-log touches Electron-only transports at import time; stub it.
vi.mock('/@/logging/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { parseTransactionsFile, tryRecoverTransactionsJson } from './json';

const tx = (hash: string, date: string): Partial<EnrichedTransaction> => ({
  hash,
  date,
  description: 'test',
  chargedAmount: -10,
});

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'json-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('tryRecoverTransactionsJson', () => {
  test('welds a `]   {` concatenation seam into one valid array', () => {
    const a = [tx('a', '2026-01-01'), tx('b', '2026-01-02')];
    const b = [tx('c', '2026-01-03')];
    // Simulate the real corruption: two arrays glued with `]   {`.
    const corrupt = `${JSON.stringify(a, null, 4).replace(/]$/, ']    ')}${JSON.stringify(b, null, 4).replace(
      /^\[/,
      '',
    )}`;
    const recovered = tryRecoverTransactionsJson(corrupt);
    expect(recovered).not.toBeNull();
    expect(recovered!.map((t) => t.hash)).toEqual(['a', 'b', 'c']); // merged + date-sorted
  });

  test('dedupes transactions that appear in both glued arrays', () => {
    const a = [tx('a', '2026-01-01'), tx('b', '2026-01-02')];
    const b = [tx('b', '2026-01-02'), tx('c', '2026-01-03')];
    const corrupt = `${JSON.stringify(a)}  ${JSON.stringify(b).replace(/^\[/, '')}`;
    const recovered = tryRecoverTransactionsJson(corrupt);
    expect(recovered!.map((t) => t.hash)).toEqual(['a', 'b', 'c']);
  });

  test('returns null for unrecoverable garbage', () => {
    expect(tryRecoverTransactionsJson('}{ not json at all ][')).toBeNull();
  });
});

describe('parseTransactionsFile', () => {
  test('parses a valid file normally', async () => {
    const file = path.join(tmpDir, 'transaction.json');
    await fs.writeFile(file, JSON.stringify([tx('a', '2026-01-01')]));
    const result = await parseTransactionsFile(file);
    expect(result.map((t) => t.hash)).toEqual(['a']);
  });

  test('returns [] when the file does not exist (first run)', async () => {
    const result = await parseTransactionsFile(path.join(tmpDir, 'missing.json'));
    expect(result).toEqual([]);
  });

  test('recovers a corrupt file, heals it on disk, and backs up the original', async () => {
    const file = path.join(tmpDir, 'transaction.json');
    const a = [tx('a', '2026-01-01')];
    const b = [tx('b', '2026-01-02')];
    const corrupt = `${JSON.stringify(a, null, 4)}    ${JSON.stringify(b, null, 4).replace(/^\[/, '')}`;
    await fs.writeFile(file, corrupt);

    const result = await parseTransactionsFile(file);
    expect(result.map((t) => t.hash)).toEqual(['a', 'b']);

    // File is healed: re-reading parses cleanly with no recovery needed.
    const healed = JSON.parse(await fs.readFile(file, 'utf8'));
    expect(healed.map((t: EnrichedTransaction) => t.hash)).toEqual(['a', 'b']);

    // The original corrupt content was backed up.
    const backups = (await fs.readdir(tmpDir)).filter((f) => f.includes('.corrupt-'));
    expect(backups).toHaveLength(1);
    expect(await fs.readFile(path.join(tmpDir, backups[0]), 'utf8')).toBe(corrupt);
  });

  test('throws (does NOT return []) when corruption is unrecoverable, but still backs up', async () => {
    const file = path.join(tmpDir, 'transaction.json');
    await fs.writeFile(file, '}{ totally broken ][');

    await expect(parseTransactionsFile(file)).rejects.toThrow();
    const backups = (await fs.readdir(tmpDir)).filter((f) => f.includes('.corrupt-'));
    expect(backups).toHaveLength(1); // never lose the original, even when unrecoverable
  });
});

describe('writeFileAtomic', () => {
  test('writes content and leaves no temp file behind', async () => {
    const file = path.join(tmpDir, 'out.json');
    await writeFileAtomic(file, 'hello');
    expect(await fs.readFile(file, 'utf8')).toBe('hello');
    const leftovers = (await fs.readdir(tmpDir)).filter((f) => f.includes('.tmp-'));
    expect(leftovers).toHaveLength(0);
  });

  test('overwrites an existing file', async () => {
    const file = path.join(tmpDir, 'out.json');
    await fs.writeFile(file, 'old');
    await writeFileAtomic(file, 'new');
    expect(await fs.readFile(file, 'utf8')).toBe('new');
  });
});

describe('withFileLock', () => {
  test('serializes overlapping operations on the same key', async () => {
    const events: string[] = [];
    const op = (name: string) => async () => {
      events.push(`${name}:enter`);
      await new Promise((r) => setTimeout(r, 10));
      events.push(`${name}:exit`);
    };
    await Promise.all([withFileLock('k', op('A')), withFileLock('k', op('B'))]);
    // B must not enter until A has exited.
    expect(events).toEqual(['A:enter', 'A:exit', 'B:enter', 'B:exit']);
  });

  test('allows operations on different keys to run concurrently', async () => {
    const events: string[] = [];
    const op = (name: string) => async () => {
      events.push(`${name}:enter`);
      await new Promise((r) => setTimeout(r, 10));
      events.push(`${name}:exit`);
    };
    await Promise.all([withFileLock('k1', op('A')), withFileLock('k2', op('B'))]);
    // Both enter before either exits.
    expect(events.slice(0, 2).sort()).toEqual(['A:enter', 'B:enter']);
  });

  test('a rejected operation does not wedge the lock for the next caller', async () => {
    await expect(
      withFileLock('k3', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const result = await withFileLock('k3', async () => 'ok');
    expect(result).toBe('ok');
  });
});
