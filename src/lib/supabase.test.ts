import { beforeEach, describe, expect, it, vi } from "vitest";

const { client } = vi.hoisted(() => ({ client: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => client) }));

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://warehouse.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-test-key");
});

const draft = { name: " BOX 1 ", number: " 00000001 ", model: "MODEL A", status: "confirmed" as const, date: "", devices: [{ id: "1", mac: "aabbccddeeff", serial: "000000000001" }] };

describe("Supabase inventory persistence", () => {
  it("saves a complete box in one RPC and preserves leading zeros", async () => {
    const { insertBox } = await import("./supabase");
    client.rpc.mockResolvedValue({ data: "box-id", error: null });
    await insertBox(draft);
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("save_warehouse_box", { payload: { name: "BOX 1", box_number: "00000001", model_code: "MODEL A", status: "confirmed", devices: [{ mac_address: "AABBCCDDEEFF", serial_number: "000000000001" }] } });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("includes the original version when editing and surfaces database conflicts", async () => {
    const { updateBoxInDb } = await import("./supabase");
    const version = "2026-11-17T01:00:00.123456+00:00";
    client.rpc.mockResolvedValue({ error: { code: "P0001", message: "Data box telah berubah di tab lain." } });
    await expect(updateBoxInDb({ ...draft, id: "box-id" }, version)).rejects.toThrow("tab lain");
    expect(client.rpc).toHaveBeenCalledWith("save_warehouse_box", expect.objectContaining({ target_box_id: "box-id", expected_updated_at: version }));
    expect(client.from).not.toHaveBeenCalled();
  });

  it("reports a missing migration with an actionable error", async () => {
    const { insertBox } = await import("./supabase");
    client.rpc.mockResolvedValue({ error: { code: "PGRST202", message: "function not found" } });
    await expect(insertBox(draft)).rejects.toThrow("supabase/schema.sql");
  });

  it("loads additional pages and sorts devices by their unit sequence", async () => {
    const { getBoxes } = await import("./supabase");
    const row = { id: "box-id", name: "BOX 1", box_number: "00000001", status: "confirmed", scanned_at: "2026-11-17T01:00:00Z", updated_at: "2026-11-17T02:00:00.123456Z", model: { code: "MODEL A" }, devices: [{ id: "2", unit_sequence: 2, mac_address: null, serial_number: "000000000002" }, { id: "1", unit_sequence: 1, mac_address: "AABBCCDDEEFF", serial_number: "000000000001" }] };
    const query = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, i) => ({ ...row, id: `box-${i}` })), error: null }).mockResolvedValueOnce({ data: [{ ...row, id: "last-box" }], error: null }) };
    client.from.mockReturnValue(query);
    const boxes = await getBoxes();
    expect(boxes).toHaveLength(501);
    expect(boxes[0].devices.map(device => device.serial)).toEqual(["000000000001", "000000000002"]);
    expect(boxes[0].updatedAt).toBe(row.updated_at);
    expect(boxes[500].id).toBe("last-box");
    expect(query.range.mock.calls).toEqual([[0, 499], [500, 999]]);
  });
});
