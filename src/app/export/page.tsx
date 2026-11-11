"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, Check, FileSpreadsheet, Info, ShieldCheck } from "lucide-react";
import { initialBoxes, type BoxRecord } from "@/lib/data";
import { createWarehouseWorkbook, getBoxPairs } from "@/lib/excel";

const storageKey = "gudang-in-boxes-v1";
function readBoxes(): BoxRecord[] { try { const value = localStorage.getItem(storageKey); return value ? JSON.parse(value) as BoxRecord[] : initialBoxes; } catch { return initialBoxes; } }

export default function ExportPage() {
  const [boxes, setBoxes] = useState(initialBoxes);
  const [downloaded, setDownloaded] = useState(false);
  useEffect(() => setBoxes(readBoxes()), []);
  const pairs = useMemo(() => getBoxPairs(boxes.filter(box => box.status === "confirmed")), [boxes]);
  const rowCount = pairs.reduce((total, pair) => total + Math.max(pair.t3000?.devices.length ?? 0, pair.mc7500?.devices.length ?? 0), 0);
  const extraModels = [...new Set(boxes.filter(box => box.status === "confirmed" && box.model !== "ROUTER OUTDOOR T3000" && box.model !== "ROUTER OUTDOOR MC7500").map(box => box.model))];
  const extraRows = boxes.filter(box => box.status === "confirmed" && extraModels.includes(box.model)).reduce((total, box) => total + box.devices.length, 0);

  function download() {
    const file = createWarehouseWorkbook(boxes.filter(box => box.status === "confirmed"));
    const blob = new Blob([file], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `warehouse_inventory_${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 3500);
  }

  return <div className="dashboard-page">
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> LAPORAN INVENTARIS</div><h1>Ekspor data</h1><p className="page-subtitle">Pratinjau dan unduh laporan Excel mengikuti format gudang.</p></div><button className="btn btn-primary" onClick={download}><ArrowDownToLine size={17} /> Unduh Excel</button></div>
    <div className="export-alert"><span><Info size={18} /></span><p><b>Format mengikuti template 10 November 2026</b><span>MAC, serial number, dan nomor box ditulis sebagai teks. Kolom MAC berisi MAC dari T3000; SN kedua model sejajar berdasarkan nomor unit. Model tambahan dari Data Device diekspor pada sheet tersendiri.</span></p></div>
    <div className="export-controls"><div className="export-count"><FileSpreadsheet size={19} /><span><b>{rowCount + extraRows} baris perangkat</b><small>{pairs.length} grup box · {boxes.filter(box => box.status === "confirmed").length} box terkonfirmasi</small></span></div><span className="export-version"><ShieldCheck size={15} /> XLSX · {extraModels.length ? "Table 1 + Other Devices" : "Table 1"}</span></div>
    <section className="inventory-section export-table-section"><div className="inventory-header"><div><h2>Pratinjau format Excel</h2><p>Satu grup per nama box; baris perangkat disejajarkan menurut urutan unit.</p></div></div><div className="table-scroll"><table className="data-table reference-export-table"><thead><tr><th rowSpan={2} className="mac-head-blank" /><th>ROUTER OUTDOOR T3000</th><th>ROUTER OUTDOOR MC7500</th></tr><tr><th>SN</th><th>SN</th></tr></thead><tbody>{pairs.map((pair, groupIndex) => <FragmentRows key={pair.name} pair={pair} first={groupIndex === 0} />)}</tbody></table></div><div className="table-footer"><span>Menampilkan <b>{rowCount}</b> baris perangkat pada <b>{pairs.length}</b> grup box</span><span>Semua identifier disimpan sebagai teks</span></div></section>
    {downloaded && <div className="download-toast" role="status"><Check size={17} /> File Excel berhasil diunduh.</div>}
    <p className="export-footnote"><ShieldCheck size={15} /> File .xlsx berisi header model, nomor box, border tabel, dan susunan unit seperti template.</p>
  </div>;
}

function FragmentRows({ pair, first }: { pair: ReturnType<typeof getBoxPairs>[number]; first: boolean }) {
  const count = Math.max(pair.t3000?.devices.length ?? 0, pair.mc7500?.devices.length ?? 0);
  return <>
    <tr className="reference-box-row"><td>{first ? "MAC AD" : ""}</td><td>{pair.t3000 ? `${pair.name}_${pair.t3000.number}` : ""}</td><td>{pair.mc7500 ? `${pair.name}_${pair.mc7500.number}` : ""}</td></tr>
    {Array.from({ length: count }, (_, index) => <tr key={`${pair.name}-${index}`}><td>{pair.t3000?.devices[index]?.mac ?? ""}</td><td>{pair.t3000?.devices[index]?.serial ?? ""}</td><td>{pair.mc7500?.devices[index]?.serial ?? ""}</td></tr>)}
  </>;
}
