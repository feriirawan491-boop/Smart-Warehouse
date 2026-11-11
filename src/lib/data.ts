export type Model = string;
export type DeviceModelOption = { id: string; label: string };
export const deviceModelsKey = "gudang-in-device-models-v1";
export const initialDeviceModels: DeviceModelOption[] = [
  { id: "ROUTER OUTDOOR T3000", label: "Router Outdoor T3000" },
  { id: "ROUTER OUTDOOR MC7500", label: "Router Outdoor MC7500" },
  { id: "MF296A2", label: "MF296A2" },
];
export type Device = { id: string; mac: string; serial: string };
export type BoxRecord = { id: string; name: string; number: string; model: Model; devices: Device[]; date: string; status: "confirmed" | "review" };

export const initialBoxes: BoxRecord[] = [
  { id: "box-001", name: "BOX 1", number: "320080532609300063", model: "ROUTER OUTDOOR T3000", date: "10 Nov 2026, 14:32", status: "confirmed", devices: [
    { id: "1", mac: "5CFFA94CCCA8", serial: "324462875638" }, { id: "2", mac: "5CFFA94CCCDA", serial: "324462875688" }, { id: "3", mac: "5CFFA94CCCD6", serial: "324462875684" }, { id: "4", mac: "5CFFA94CCCD7", serial: "324462875685" }
  ] },
  { id: "box-002", name: "BOX 1", number: "320101002609220242", model: "ROUTER OUTDOOR MC7500", date: "10 Nov 2026, 14:32", status: "confirmed", devices: [
    { id: "1", mac: "", serial: "323962794243" }, { id: "2", mac: "", serial: "323962794289" }, { id: "3", mac: "", serial: "323962794951" }, { id: "4", mac: "", serial: "323962794987" }
  ] },
  { id: "box-003", name: "BOX 2", number: "320080532609300064", model: "ROUTER OUTDOOR T3000", date: "10 Nov 2026, 13:56", status: "confirmed", devices: [
    { id: "1", mac: "5CFFA94CCCD1", serial: "324462875679" }, { id: "2", mac: "5CFFA94CCCDF", serial: "324462875681" }, { id: "3", mac: "5CFFA94CCCE1", serial: "324462875691" }, { id: "4", mac: "5CFFA94CCCE4", serial: "324462875692" }
  ] },
  { id: "box-004", name: "BOX 2", number: "320101002609220243", model: "ROUTER OUTDOOR MC7500", date: "10 Nov 2026, 13:56", status: "confirmed", devices: [
    { id: "1", mac: "", serial: "323962795011" }, { id: "2", mac: "", serial: "323962794960" }, { id: "3", mac: "", serial: "323962794946" }, { id: "4", mac: "", serial: "323962795021" }
  ] }
];

export function validMac(mac: string) { return /^[\da-fA-F]{12}$/.test(mac); }
export function validSerial(serial: string) { return /^\d{12}$/.test(serial); }
export function escapeCsv(value: string) { const safe = /^[=+@\-]/.test(value) ? `'${value}` : value; return `"${safe.replaceAll('"', '""')}"`; }
