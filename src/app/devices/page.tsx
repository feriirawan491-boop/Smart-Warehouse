"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Cpu, Package, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { deviceModelsKey, initialDeviceModels, initialBoxes, type DeviceModelOption, type BoxRecord } from "@/lib/data";

export default function DeviceCatalogPage() {
  const [models, setModels] = useState(initialDeviceModels);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(deviceModelsKey);
      if (saved) setModels(JSON.parse(saved) as DeviceModelOption[]);
    } catch { setMessage("Data device lokal tidak dapat dibaca."); }
  }, []);

  const filtered = useMemo(() => models.filter(model => model.label.toLowerCase().includes(query.toLowerCase())), [models, query]);

  function save(next: DeviceModelOption[]) {
    setModels(next);
    try { localStorage.setItem(deviceModelsKey, JSON.stringify(next)); }
    catch { setMessage("Perubahan tidak dapat disimpan di browser ini."); }
  }

  function addModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = name.trim();
    if (!label) { setMessage("Nama model device perlu diisi."); return; }
    if (models.some(model => model.label.toLowerCase() === label.toLowerCase())) { setMessage("Model device tersebut sudah ada."); return; }
    save([...models, { id: label.toUpperCase(), label }]);
    setName("");
    setMessage(`${label} ditambahkan ke pilihan scan.`);
  }

  function removeModel(model: DeviceModelOption) {
    if (models.length <= 1) { setMessage("Pertahankan minimal satu model device di daftar."); return; }
    let boxes: BoxRecord[] = initialBoxes;
    try {
      const saved = localStorage.getItem("gudang-in-boxes-v1");
      if (saved) boxes = JSON.parse(saved) as BoxRecord[];
    } catch { /* Use demo data for the guard if browser storage cannot be read. */ }
    if (boxes.some(box => box.model === model.id)) { setMessage("Model masih dipakai box yang tercatat, jadi belum bisa dihapus."); return; }
    if (!window.confirm(`Hapus ${model.label} dari pilihan model device?`)) return;
    save(models.filter(item => item.id !== model.id));
    setMessage(`${model.label} dihapus.`);
  }

  return <div className="dashboard-page device-catalog-page">
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> MASTER DATA</div><h1>Data Device</h1><p className="page-subtitle">Kelola model device yang tersedia di formulir scan.</p></div></div>
    <div className="device-catalog-grid">
      <section className="device-add-card"><div className="device-card-heading"><span className="device-catalog-icon"><Cpu size={21} /></span><div><h2>Tambah model device</h2><p>Model baru langsung tersedia di pilihan scan.</p></div></div>
        <form className="device-model-form" onSubmit={addModel}><label className="field"><span>Nama model device <b>*</b></span><input value={name} onChange={event => setName(event.target.value)} maxLength={80} placeholder="Contoh: Router Outdoor T3000"/><small>Gunakan nama yang mudah dikenali operator.</small></label><button className="btn btn-primary" type="submit"><Plus size={17} /> Tambah model</button></form>
        {message && <p className="device-catalog-message" role="status">{message}</p>}
        <div className="device-add-note"><ShieldCheck size={16}/><span>Model yang sudah dipakai box tidak dapat dihapus.</span></div>
      </section>
      <section className="inventory-section device-catalog-section"><div className="inventory-header"><div><h2>Daftar model</h2><p>{models.length} model tersedia di dropdown scan.</p></div><span className="export-version"><Package size={15} /> Master data</span></div>
      <div className="table-toolbar"><label className="search-box"><Search size={16}/><input aria-label="Cari model device" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari model device…"/></label></div>
      <div className="device-model-list">{filtered.map((model,index)=><article className="device-model-item" key={model.id}><span className="device-model-index">{String(index+1).padStart(2,"0")}</span><span className="device-model-symbol"><Cpu size={17}/></span><span className="device-model-copy"><b>{model.label}</b><small>{model.id === model.label.toUpperCase() ? "Model device" : model.id}</small></span><span className="device-model-state"><span/>Tersedia di scan</span><button className="row-menu" aria-label={`Hapus ${model.label}`} onClick={() => removeModel(model)}><Trash2 size={16}/></button></article>)}{!filtered.length&&<div className="empty-state"><Search size={22}/><strong>Model tidak ditemukan</strong><span>Ubah kata kunci pencarian atau tambahkan model baru.</span></div>}</div>
      <div className="table-footer"><span>Menampilkan <b>{filtered.length}</b> dari <b>{models.length}</b> model</span><span>Perubahan tersimpan di browser ini</span></div>
      </section>
    </div>
  </div>;
}
