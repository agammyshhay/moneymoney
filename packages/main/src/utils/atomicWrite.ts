import { promises as fs } from 'fs';
import path from 'path';

/**
 * Writes a file atomically: content is written to a temp file in the same
 * directory, flushed to disk, then renamed over the target. A reader therefore
 * always sees either the previous complete file or the new complete file —
 * never a half-written / torn file (which is what produced the `]   {`
 * concatenation corruption when two writes overlapped).
 *
 * The rename is atomic on the same filesystem. On Windows, replacing an open
 * file can transiently fail (a reader or antivirus holding a handle), so the
 * rename is retried a few times before giving up.
 */
export async function writeFileAtomic(filePath: string, data: string): Promise<void> {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}`);

  const fh = await fs.open(tmp, 'w');
  try {
    await fh.writeFile(data, 'utf8');
    await fh.sync(); // flush to disk before the rename
  } finally {
    await fh.close();
  }

  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(tmp, filePath);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (attempt < 5 && (code === 'EPERM' || code === 'EACCES' || code === 'EBUSY')) {
        await new Promise((r) => setTimeout(r, 50));
        continue;
      }
      await fs.rm(tmp, { force: true }); // don't leave temp files behind
      throw e;
    }
  }
}
