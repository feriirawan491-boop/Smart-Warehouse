"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, Plus, Save, Trash2 } from "lucide-react";
import type { BoxRecord } from "@/lib/data";
import { updateBox } from "@/lib/edit-box";
import { deleteBoxInDb, getBoxes, updateBoxInDb } from "@/lib/supabase";
import { useWarehouse } from "@/components/warehouse-provider";

export default function BoxDetailPage() {
  const router = useRouter();
  const { boxes, ready, error: syncError, refresh } = useWarehouse();
  const [id, setId] = useState<string | null>(null);
  const [original, setOriginal] = useState<BoxRecord | null>(null);
  const [draft, setDraft] = useState<BoxRecord | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { setId(new URLSearchParams(window.location.search).get("id")); }, []);
  const box = boxes.find(item => item.id === id) ?? null;
  const shown = editing ? draft : box;
  const changedElsewhere = editing && original?.updatedAt !== box?.updatedAt;

  function startEditing() {
    if (!box) return;
    setOriginal(box); setDraft({ ...box, devices: box.devices.map(device => ({ ...device })) });
    setEditing(true); setError(""); setMessage("");
  }

  async function save() {
    if (!original || !draft || busy || !ready || syncError) return;
    setBusy(true); setError("");
    try {
      const latest = await getBoxes();
      const saved = updateBox(latest, original, draft).find(item => item.id === original.id)!;
      if (!original.updatedAt) throw new Error("Muat ulang data box sebelum menyimpan.");
      await updateBoxInDb(saved, original.updatedAt);
      await refresh();
      setEditing(false); setMessage("Perubahan berhasil disimpan ke Supabase.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Perubahan belum dapat disimpan."); }
    finally { setBusy(false); }
  }

  async function removeBox() {
    if (!box || busy || !ready || syncError) return;
    if (!window.confirm(`Hapus ${box.name} (${box.number}) beserta ${box.devices.length} perangkat dari Supabase?`)) return;
    setBusy(true); setError("");
    try { await deleteBoxInDb(box.id); await refresh(); router.push("/history"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Box belum dapat dihapus."); }
    finally { setBusy(false); }
  }

  return <div className="workflow-page">
    <Link href="/history" className="back-link"><ArrowLeft size={16}/> Kembali ke riwayat scan</Link>
    <div className="page-heading"><div><h1>Detail box</h1><p className="page-subtitle">Informasi box dan daftar Serial Number perangkat.</p></div>{box && !editing && <div className="detail-actions"><button className="btn btn-secondary" disabled={busy || !!syncError} onClick={() => void removeBox()}><Trash2 size={16}/> Hapus box</button><button className="btn btn-primary" disabled={busy || !!syncError} onClick={startEditing}><Pencil size={16}/> Edit</button></div>}</div>
    {!ready ? <p>Memuat data box…</p> : !box || !shown ? <div className="empty-state"><strong>Box tidak ditemukan</strong><span>{syncError || error || "Box tidak tersedia atau sudah dihapus."}</span></div> : <section className="workflow-card">
      <fieldset className="detail-fields" disabled={busy}>
      <div className="form-grid">
        <label className="field"><span>Nama box</span><input readOnly={!editing} value={shown.name} maxLength={40} onChange={event=>setDraft({...shown,name:event.target.value})}/></label>
        <label className="field"><span>Nomor box</span><input readOnly={!editing} inputMode="numeric" value={shown.number} onChange={event=>setDraft({...shown,number:event.target.value.replace(/\D/g,"").slice(0,30)})}/></label>
        <label className="field"><span>Model device</span><input readOnly value={shown.model}/></label>
        <label className="field"><span>Tanggal scan</span><input readOnly value={box.date}/></label>
      </div>
      <div className="review-table-heading"><div><h3>Daftar Serial Number</h3><span>{shown.devices.length} perangkat</span></div>{editing && <button className="btn btn-secondary" onClick={()=>setDraft({...shown,devices:[...shown.devices,{id:`new-${Date.now()}-${Math.random().toString(36).slice(2)}`,mac:"",serial:""}]})}><Plus size={16}/> Tambah SN</button>}</div>
      <div className="table-scroll"><table className="data-table sn-only-review"><thead><tr><th>NO.</th><th>SERIAL NUMBER (SN)</th>{editing&&<th>AKSI</th>}</tr></thead><tbody>{shown.devices.map((device,index)=><tr key={`${device.id}-${index}`}><td>{index+1}</td><td>{editing?<input className="cell-input serial-input" aria-label={`SN perangkat ${index+1}`} inputMode="numeric" value={device.serial} onChange={event=>setDraft({...shown,devices:shown.devices.map((item,row)=>row===index?{...item,serial:event.target.value.replace(/\D/g,"").slice(0,12)}:item)})}/>:<span className="number-cell">{device.serial || "Belum diisi"}</span>}</td>{editing&&<td><button className="icon-btn" aria-label={`Hapus SN baris ${index+1}`} onClick={()=>setDraft({...shown,devices:shown.devices.filter((_,row)=>row!==index)})}><Trash2 size={16}/></button></td>}</tr>)}</tbody></table></div>
      {changedElsewhere&&<p className="form-error" role="alert">Data box berubah di perangkat lain. Batalkan edit lalu periksa data terbaru sebelum mengedit kembali.</p>}
      {error&&<p className="form-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
      {editing&&<div className="workflow-actions"><button className="btn btn-quiet" onClick={()=>{setEditing(false);setError("");}}>Batal</button><button className="btn btn-primary" disabled={changedElsewhere || !!syncError} onClick={() => void save()}><Save size={16}/> {busy ? "Menyimpan…" : "Simpan perubahan"}</button></div>}
      </fieldset>
    </section>}
  </div>;
}
