/**
 * Path-keyed in-process mutex. Serializes async operations that share a key
 * (e.g. all read-modify-write access to a single file), while operations on
 * different keys run concurrently. Generalizes the promise-chain mutex used for
 * the config file in handlers/configHandlers.ts.
 *
 * All callers run in the single Electron main process, so this fully serializes
 * the periodic scrape, the overdue check, auto-run, and the manual "Sync now"
 * paths that would otherwise clobber each other's writes.
 */
const chains = new Map<string, Promise<unknown>>();

export function withFileLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  chains.set(
    key,
    prev.then(() => gate),
  );
  const run = prev.then(fn);
  // Release the gate once fn settles so the next queued operation can start.
  // The .catch here only guards the release chain — run's rejection still
  // propagates to the caller below.
  run
    .finally(() => release())
    .catch(() => {
      /* run's rejection is surfaced via the returned promise below */
    });
  return run;
}
