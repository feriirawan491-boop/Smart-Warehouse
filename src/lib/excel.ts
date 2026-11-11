import type { BoxRecord, Model } from "@/lib/data";

const encoder = new TextEncoder();
const t3000: Model = "ROUTER OUTDOOR T3000";
const mc7500: Model = "ROUTER OUTDOOR MC7500";

type BoxPair = { name: string; t3000?: BoxRecord; mc7500?: BoxRecord };

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function columnName(index: number) {
  let name = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  return name;
}

function groupBoxes(boxes: BoxRecord[]): BoxPair[] {
  const groups = new Map<string, BoxPair>();
  for (const box of boxes) {
    const group = groups.get(box.name) ?? { name: box.name };
    if (box.model === t3000) group.t3000 = box;
    if (box.model === mc7500) group.mc7500 = box;
    groups.set(box.name, group);
  }
  return [...groups.values()].filter(group => group.t3000 || group.mc7500).sort((a, b) => {
    const index = (name: string) => Number(name.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
    return index(a.name) - index(b.name) || a.name.localeCompare(b.name);
  });
}

function otherDevicesWorksheet(boxes: BoxRecord[]) {
  const headings = ["MODEL DEVICE", "NAMA BOX", "NOMOR BOX", "UNIT", "MAC AD", "SERIAL NUMBER", "TANGGAL SCAN"];
  const rows = [`<row r="1" ht="30" customHeight="1">${headings.map((heading, index) => cell(`${columnName(index)}1`, heading, index === 0 ? 1 : 2)).join("")}</row>`];
  let rowNo = 2;
  for (const box of boxes) for (const [index, device] of box.devices.entries()) {
    const values = [box.model, box.name, box.number, String(index + 1), device.mac, device.serial, box.date];
    rows.push(`<row r="${rowNo}" ht="23" customHeight="1">${values.map((value, col) => cell(`${columnName(col)}${rowNo}`, value, col === 0 || col === 1 || col === 4 ? 3 : 4)).join("")}</row>`);
    rowNo += 1;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:G${Math.max(1, rowNo - 1)}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="1" width="31" customWidth="1"/><col min="2" max="2" width="17" customWidth="1"/><col min="3" max="3" width="24" customWidth="1"/><col min="4" max="4" width="10" customWidth="1"/><col min="5" max="6" width="19" customWidth="1"/><col min="7" max="7" width="24" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData><autoFilter ref="A1:G${Math.max(1, rowNo - 1)}"/><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

function cell(address: string, value: string, style: number) {
  return `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

function worksheet(boxes: BoxRecord[]) {
  const rows: string[] = [];
  rows.push(`<row r="1" ht="25" customHeight="1">${cell("B1", t3000, 1)}${cell("C1", mc7500, 2)}</row>`);
  rows.push(`<row r="2" ht="23" customHeight="1">${cell("B2", "SN", 2)}${cell("C2", "SN", 2)}</row>`);

  let rowNo = 3;
  for (const [groupIndex, pair] of groupBoxes(boxes).entries()) {
    const boxTitle = (box?: BoxRecord) => box ? `${pair.name}_${box.number}` : "";
    const rowCells = [groupIndex === 0 ? cell(`A${rowNo}`, "MAC AD", 2) : "", cell(`B${rowNo}`, boxTitle(pair.t3000), 1), cell(`C${rowNo}`, boxTitle(pair.mc7500), 2)];
    rows.push(`<row r="${rowNo}" ht="28" customHeight="1">${rowCells.join("")}</row>`);
    rowNo += 1;

    const count = Math.max(pair.t3000?.devices.length ?? 0, pair.mc7500?.devices.length ?? 0);
    for (let index = 0; index < count; index += 1) {
      const tDevice = pair.t3000?.devices[index];
      const mDevice = pair.mc7500?.devices[index];
      rows.push(`<row r="${rowNo}" ht="23" customHeight="1">${cell(`A${rowNo}`, tDevice?.mac ?? "", 3)}${cell(`B${rowNo}`, tDevice?.serial ?? "", 4)}${cell(`C${rowNo}`, mDevice?.serial ?? "", 4)}</row>`);
      rowNo += 1;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:C${Math.max(2, rowNo - 1)}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="1" width="25" customWidth="1"/><col min="2" max="2" width="34" customWidth="1"/><col min="3" max="3" width="34" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData><mergeCells count="1"><mergeCell ref="A1:A2"/></mergeCells><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

function styles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files: Array<[string, string]>) {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let localOffset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const makeHeader = (size: number) => new Uint8Array(size);

  for (const [path, contents] of files) {
    const name = encoder.encode(path);
    const data = encoder.encode(contents);
    const checksum = crc32(data);
    const localHeader = makeHeader(30 + name.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true); localView.setUint16(4, 20, true); localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true); localView.setUint16(10, dosTime, true); localView.setUint16(12, dosDate, true);
    localView.setUint32(14, checksum, true); localView.setUint32(18, data.length, true); localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true); localHeader.set(name, 30);
    local.push(localHeader, data);

    const centralHeader = makeHeader(46 + name.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true); centralView.setUint16(4, 20, true); centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true); centralView.setUint16(10, 0, true); centralView.setUint16(12, dosTime, true); centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, checksum, true); centralView.setUint32(20, data.length, true); centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true); centralView.setUint32(42, localOffset, true); centralHeader.set(name, 46);
    central.push(centralHeader);
    localOffset += localHeader.length + data.length;
  }

  const centralBytes = central.reduce((sum, item) => sum + item.length, 0);
  const end = makeHeader(22); const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, files.length, true); view.setUint16(10, files.length, true);
  view.setUint32(12, centralBytes, true); view.setUint32(16, localOffset, true);
  const parts = [...local, ...central, end]; const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

export function createWarehouseWorkbook(boxes: BoxRecord[]) {
  const otherModels = boxes.filter(box => box.model !== t3000 && box.model !== mc7500);
  const hasOther = otherModels.length > 0;
  const files: Array<[string, string]> = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>${hasOther ? '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' : ""}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Table 1" sheetId="1" r:id="rId1"/>${hasOther ? '<sheet name="Other Devices" sheetId="2" r:id="rId2"/>' : ""}</sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>${hasOther ? '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' : ""}<Relationship Id="rId${hasOther ? 3 : 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/worksheets/sheet1.xml", worksheet(boxes)],
    ["xl/styles.xml", styles()],
  ];
  if (hasOther) files.splice(5, 0, ["xl/worksheets/sheet2.xml", otherDevicesWorksheet(otherModels)]);
  return zipStore(files);
}

export function getBoxPairs(boxes: BoxRecord[]) { return groupBoxes(boxes); }
export function getColumnName(index: number) { return columnName(index); }
