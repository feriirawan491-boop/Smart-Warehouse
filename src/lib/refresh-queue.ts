// A change arriving during a fetch schedules one more fetch, so a late response
// cannot permanently hide a newer database change.
export function createRefreshQueue<T>(load: () => Promise<T>, receive: (data: T) => void, fail: (error: unknown) => void) {
  let pending: Promise<void> | null = null;
  let dirty = false;
  let stopped = false;
  return {
    refresh(): Promise<void> {
      if (stopped) return Promise.resolve();
      dirty = true;
      if (!pending) {
        pending = (async () => {
          while (dirty && !stopped) {
            dirty = false;
            try { const data = await load(); if (!stopped) receive(data); }
            catch (error) { if (!stopped) fail(error); }
          }
        })().finally(() => { pending = null; });
      }
      return pending;
    },
    stop() { stopped = true; dirty = false; },
  };
}
