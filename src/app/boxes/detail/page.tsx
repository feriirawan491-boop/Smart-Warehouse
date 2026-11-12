"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { initialBoxes, type BoxRecord } from "@/lib/data";
import { updateBox } from "@/lib/edit-box";

const storageKey = "gudang-in-boxes-v1";
function readBoxes(): BoxRecord[] {
  const saved = localStorage.getItem(storageKey);
  return saved ? JSON.parse(saved) as BoxRecord[] : initialBoxes;
}

export default function BoxDetailPage() {
  const [box, setBox] = useState<BoxRecord | null>(null);
  const [draft, setDraft] = useState<BoxRecord | null>(null);
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const id = new URLSearchParams(window.location.search).get("id");
      const found = readBoxes().find(item => item.id === id) ?? null;
      setBox(found); setDraft(found);
    } catch { setError("Data box tidak dapat dibaca dari browser ini."); }
    setReady(true);
  }, []);

  function save() {
    if (!box || !draft) return;
    try {
      const next = updateBox(readBoxes(), box, draft);
      localStorage.setItem(storageKey, JSON.stringify(next));
      const saved = next.find(item=>item.id===box.id)!;
      setBox(saved); setDraft(saved); setEditing(false); setError(""); setMessage("Perubahan berhasil disimpan.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Perubahan belum dapat disimpan."); }
  }

  return <div className="workflow-page">
    <Link href="/history" className="back-link"><ArrowLeft size={16}/> Kembali ke riwayat scan</Link>
    <div className="page-heading"><div><h1>Detail box</h1><p className="page-subtitle">Informasi box dan daftar Serial Number perangkat.</p></div>{box && !editing && <button className="btn btn-primary" onClick={() => {setDraft({...box, devices:box.devices.map(device=>({...device}))});setEditing(true);setError("");setMessage("");}}><Pencil size={16}/> Edit</button>}</div>
    {!ready ? <p>Memuat data box…</p> : !box || !draft ? <div className="empty-state"><strong>Box tidak ditemukan</strong><span>{error || "Data box ini tidak tersedia di browser ini."}</span></div> : <section className="workflow-card">
      <div className="form-grid">
        <label className="field"><span>Nama box</span><input readOnly={!editing} value={draft.name} maxLength={40} onChange={event=>setDraft({...draft,name:event.target.value})}/></label>
        <label className="field"><span>Nomor box</span><input readOnly={!editing} inputMode="numeric" value={draft.number} onChange={event=>setDraft({...draft,number:event.target.value.replace(/\D/g,"").slice(0,30)})}/></label>
        <label className="field"><span>Model device</span><input readOnly value={draft.model}/></label>
        <label className="field"><span>Tanggal scan</span><input readOnly value={box.date}/></label>
      </div>
      <div className="review-table-heading"><div><h3>Daftar Serial Number</h3><span>{draft.devices.length} perangkat</span></div>{editing && <button className="btn btn-secondary" onClick={()=>setDraft({...draft,devices:[...draft.devices,{id:crypto.randomUUID(),mac:"",serial:""}]})}><Plus size={16}/> Tambah SN</button>}</div>
      <div className="table-scroll"><table className="data-table sn-only-review"><thead><tr><th>NO.</th><th>SERIAL NUMBER (SN)</th>{editing&&<th>AKSI</th>}</tr></thead><tbody>{draft.devices.map((device,index)=><tr key={`${device.id}-${index}`}><td>{index+1}</td><td>{editing?<input className="cell-input serial-input" aria-label={`SN perangkat ${index+1}`} inputMode="numeric" value={device.serial} onChange={event=>setDraft({...draft,devices:draft.devices.map((item,row)=>row===index?{...item,serial:event.target.value.replace(/\D/g,"").slice(0,12)}:item)})}/>:<span className="number-cell">{device.serial || "Belum diisi"}</span>}</td>{editing&&<td><button className="icon-btn" aria-label={`Hapus SN baris ${index+1}`} onClick={()=>setDraft({...draft,devices:draft.devices.filter((_,row)=>row!==index)})}><Trash2 size={16}/></button></td>}</tr>)}</tbody></table></div>
      {error&&<p className="form-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
      {editing&&<div className="workflow-actions"><button className="btn btn-quiet" onClick={()=>{setDraft(box);setEditing(false);setError("");}}>Batal</button><button className="btn btn-primary" onClick={save}><Save size={16}/> Simpan perubahan</button></div>}
    </section>}
  </div>;
}
