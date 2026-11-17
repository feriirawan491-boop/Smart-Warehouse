import { describe, expect, it, vi } from "vitest";
import { createRefreshQueue } from "./refresh-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("inventory synchronization", () => {
  it("coalesces events during a fetch and eventually shows the newest snapshot", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const receive = vi.fn();
    const queue = createRefreshQueue(load, receive, vi.fn());
    const initial = queue.refresh();
    queue.refresh(); queue.refresh();
    expect(load).toHaveBeenCalledTimes(1);
    first.resolve("before delete");
    await first.promise;
    expect(load).toHaveBeenCalledTimes(2);
    second.resolve("after delete");
    await initial;
    expect(receive.mock.calls.map(call => call[0])).toEqual(["before delete", "after delete"]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps the previous snapshot on a network failure and recovers on retry", async () => {
    const load = vi.fn().mockResolvedValueOnce(["box-1"]).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
    const receive = vi.fn(); const fail = vi.fn();
    const queue = createRefreshQueue(load, receive, fail);
    await queue.refresh(); await queue.refresh();
    expect(receive).toHaveBeenCalledTimes(1);
    expect(fail).toHaveBeenCalledWith(expect.objectContaining({ message: "offline" }));
    await queue.refresh();
    expect(receive).toHaveBeenLastCalledWith([]);
  });

  it("ignores pending responses and events after logout/unmount", async () => {
    const request = deferred<string>(); const receive = vi.fn(); const fail = vi.fn();
    const load = vi.fn().mockReturnValue(request.promise);
    const queue = createRefreshQueue(load, receive, fail);
    const pending = queue.refresh();
    queue.stop(); request.resolve("private inventory"); await pending; await queue.refresh();
    expect(receive).not.toHaveBeenCalled(); expect(fail).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
