"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ArrowLeft, ArrowRight, Camera, CameraOff, Check, CheckCircle2, ChevronDown, CircleAlert, CirclePlus, FileImage, ImagePlus, LoaderCircle, LockKeyhole, Package, RotateCcw, ScanLine, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { boxNumberCandidates, boxNumberError } from "@/lib/box-scan";
import { findDeviceConflicts, deviceConflictMessage } from "@/lib/device-conflicts";
import { createBarcodeReader, type BarcodeReader } from "@/lib/barcode";
import { deviceModelsKey, initialBoxes, initialDeviceModels, validMac, validSerial, type BoxRecord, type Model, type DeviceModelOption } from "@/lib/data";

type Row = { id: string; mac: string; serial: string };
type BarcodeValue = { rawValue: string; format: string };
const key = "gudang-in-boxes-v1";
function loadBoxes(): BoxRecord[] { try { const value=localStorage.getItem(key); return value?JSON.parse(value) as BoxRecord[]:initialBoxes; } catch { return initialBoxes; } }
function readBarcodeIdentifiers(values: BarcodeValue[]) {
  const macs = new Set<string>(); const serials = new Set<string>(); let number = "";
  for (const code of values) {
    const value = code.rawValue.toUpperCase();
    const taggedMac = value.match(/MAC(?:\s*ADDRESS)?\s*[:=]\s*([\dA-F]{12})/);
    const taggedSerial = value.match(/(?:SERIAL(?:\s*NUMBER)?|S\/?N)\s*[:=]\s*(\d{12})/);
    const taggedBox = value.match(/(?:BOX(?:\s*(?:NUMBER|NO\.?))?)\s*[:=#-]?\s*(\d{15,30})/);
    if (taggedMac) macs.add(taggedMac[1]);
    for (const match of value.matchAll(/(?:[\dA-F]{2}[:-]){5}[\dA-F]{2}/g)) macs.add(match[0].replace(/[:-]/g, ""));
    if (taggedSerial) serials.add(taggedSerial[1]);
    if (!number && taggedBox) number = taggedBox[1];
    const boxMatch = value.match(/(?<!\d)\d{15,30}(?!\d)/);
    if (!number && boxMatch) number = boxMatch[0];
    for (const match of value.matchAll(/(?<![\dA-Z])[\dA-F]{12}(?![\dA-Z])/g)) {
      const identifier = match[0];
      if (/[A-F]/.test(identifier)) macs.add(identifier);
      else serials.add(identifier);
    }
  }
  const macList = [...macs]; const serialList = [...serials];
  const rows = Array.from({ length: Math.max(macList.length, serialList.length) }, (_, index) => ({ id: `barcode-${index + 1}`, mac: macList[index] ?? "", serial: serialList[index] ?? "" }));
  return { number, rows };
}

export default function NewScanPage() {
  const router=useRouter(); const inputRef=useRef<HTMLInputElement>(null); const videoRef=useRef<HTMLVideoElement>(null); const streamRef=useRef<MediaStream|null>(null); const detectorRef=useRef<BarcodeReader|null>(null); const [step,setStep]=useState(1); const [name,setName]=useState("BOX 4"); const [number,setNumber]=useState(""); const [model,setModel]=useState<Model>("ROUTER OUTDOOR T3000"); const [photo,setPhoto]=useState<string|null>(null); const [photoName,setPhotoName]=useState(""); const [drag,setDrag]=useState(false); const [rows,setRows]=useState<Row[]>([]); const [codes,setCodes]=useState<BarcodeValue[]>([]); const [cameraActive,setCameraActive]=useState(false); const [cameraMessage,setCameraMessage]=useState(""); const [processing,setProcessing]=useState(false); const [error,setError]=useState("");
  const [scanStage,setScanStage]=useState<"box"|"serial">("box");
  const [boxCandidates,setBoxCandidates]=useState<string[]>([]);
  const cameraRequestRef=useRef(0);const cameraStartingRef=useRef(false);
  const [photoProgress,setPhotoProgress]=useState<{completed:number;total:number;found:number}|null>(null);
  const [models,setModels]=useState<DeviceModelOption[]>(initialDeviceModels);
  useEffect(()=>{try{const saved=localStorage.getItem(deviceModelsKey);if(saved){const parsed=JSON.parse(saved) as DeviceModelOption[];if(parsed.length){setModels(parsed);if(!parsed.some(item=>item.id===model))setModel(parsed[0].id);}}}catch{}},[model]);
  useEffect(()=>{const boxes=loadBoxes();setName(`BOX ${boxes.length+1}`);},[]);
  useEffect(()=>()=>{cameraRequestRef.current+=1;streamRef.current?.getTracks().forEach(track=>track.stop());},[]);
  useEffect(()=>{
    if(!cameraActive)return;
    let active=true;let busy=false;let timer=0;
    const video=videoRef.current;
    const scan=async()=>{
      if(!active||!video||!detectorRef.current)return;
      if(video.readyState>=2&&!busy){busy=true;try{const found=await detectorRef.current.detect(video);if(active&&found.length)setCodes(current=>{const known=new Set(current.map(item=>`${item.format}:${item.rawValue}`));const added=found.filter(item=>!known.has(`${item.format}:${item.rawValue}`));return added.length?[...current,...added]:current;});}catch{setCameraMessage("Barcode belum terbaca. Atur posisi kamera agar barcode terlihat jelas.");}finally{busy=false;}}
      timer=window.setTimeout(()=>void scan(),450);
    };
    if(video&&streamRef.current){video.srcObject=streamRef.current;void video.play().catch(()=>setCameraMessage("Kamera belum dapat menampilkan video."));}
    void scan();
    return()=>{active=false;window.clearTimeout(timer);};
  },[cameraActive]);
  const stopCamera=()=>{cameraRequestRef.current+=1;cameraStartingRef.current=false;streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null;setCameraActive(false);};
  const resetForNext=()=>{stopCamera();setStep(1);setScanStage("box");setBoxCandidates([]);setName(`BOX ${loadBoxes().length+1}`);setNumber("");setPhoto(null);setPhotoName("");setRows([]);setCodes([]);setError("");setCameraMessage("");};
  function acceptFile(file?:File){if(!file)return; if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setError("Gunakan foto JPG, PNG, atau WebP.");return;}if(file.size>10*1024*1024){setError("Ukuran foto maksimal 10 MB.");return;}setError("");setPhotoName(file.name);const reader=new FileReader();reader.onload=()=>setPhoto(String(reader.result));reader.readAsDataURL(file);}
  function onFile(e:ChangeEvent<HTMLInputElement>){acceptFile(e.target.files?.[0]);stopCamera();e.target.value="";}
  function onDrop(e:DragEvent<HTMLDivElement>){e.preventDefault();setDrag(false);acceptFile(e.dataTransfer.files[0]);}
  async function openCamera(){
    if(cameraStartingRef.current)return;
    if(!name.trim()){setError("Nama box wajib diisi.");return;}
    stopCamera();const request= cameraRequestRef.current;cameraStartingRef.current=true;
    setError("");setCameraMessage("");setCodes([]);setStep(2);
    if(!navigator.mediaDevices?.getUserMedia){setCameraMessage("Kamera tidak tersedia di browser ini. Buka tautan melalui Safari atau Chrome, atau gunakan foto dan input manual.");cameraStartingRef.current=false;return;}
    let stream:MediaStream|null=null;
    try{
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});
      if(request!==cameraRequestRef.current){stream.getTracks().forEach(track=>track.stop());return;}
      streamRef.current=stream;
      const reader=await createBarcodeReader();
      if(request!==cameraRequestRef.current){stream.getTracks().forEach(track=>track.stop());return;}
      detectorRef.current=reader;setCameraActive(true);
    }catch(cause){
      stream?.getTracks().forEach(track=>track.stop());
      if(request!==cameraRequestRef.current)return;
      streamRef.current=null;
      const reason=cause instanceof Error?cause.name:"";
      setCameraMessage(reason==="NotAllowedError"?"Izinkan akses kamera di pengaturan browser, lalu tekan Mulai kamera. Jika dibuka dari WhatsApp atau aplikasi lain, buka tautan di Safari atau Chrome.":reason==="NotFoundError"?"Kamera tidak ditemukan. Anda tetap dapat mengunggah foto atau mengisi data manual.":"Kamera belum dapat dibuka. Tutup aplikasi lain yang memakai kamera, lalu coba lagi atau gunakan foto/input manual.");
    }finally{if(request===cameraRequestRef.current)cameraStartingRef.current=false;}
  }
  useEffect(()=>{if(new URLSearchParams(window.location.search).get("camera")==="1")setStep(2);},[]);
  function confirmBoxNumber(){
    const message=boxNumberError(number,loadBoxes());
    if(message){setError(message);return;}
    stopCamera();setScanStage("serial");setCodes([]);setRows([]);setPhoto(null);setPhotoName("");setError("");setCameraMessage("");
  }
  function rescanBox(){stopCamera();setScanStage("box");setNumber("");setBoxCandidates([]);setCodes([]);setRows([]);setPhoto(null);setPhotoName("");setError("");}
  function completeExtraction(values:BarcodeValue[]){
    stopCamera();setCodes(values);setError("");
    if(scanStage==="box"){
      const candidates=boxNumberCandidates(values);setBoxCandidates(candidates);
      if(candidates.length===1){setNumber(candidates[0]);setError(boxNumberError(candidates[0],loadBoxes()));}
      else{setNumber("");setError(candidates.length?"Beberapa nomor box ditemukan. Pilih nomor box yang sesuai.":"Nomor box belum terbaca. Scan barcode Box No terlebih dahulu atau isi nomor box secara manual.");}
      return;
    }
    if(boxNumberError(number,loadBoxes())){setError("Konfirmasi nomor box terlebih dahulu sebelum scan Serial Number.");return;}
    const extracted=readBarcodeIdentifiers(values);
    if(!extracted.rows.some(row=>row.serial)){setError("Serial Number belum terbaca. Arahkan kamera ke barcode SN perangkat.");return;}
    setRows(extracted.rows);setStep(3);
  }
  function finishCameraScan(){if(!codes.length){setError("Arahkan kamera ke barcode pada label terlebih dahulu.");return;}const video=videoRef.current;if(video?.videoWidth){const canvas=document.createElement("canvas");canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext("2d")?.drawImage(video,0,0);setPhoto(canvas.toDataURL("image/jpeg",.86));setPhotoName("Foto label dari kamera.jpg");}completeExtraction(codes);}
  async function scanUploadedPhoto(){
    if(!photo){setError("Pilih foto label terlebih dahulu.");return;}
    setProcessing(true);setPhotoProgress({completed:0,total:1,found:0});setError("");
    try{
      const {scanPhotoBarcodes}=await import("@/lib/photo-barcode");
      const image=new window.Image();
      await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("Foto gagal dimuat"));image.src=photo;});
      const found=await scanPhotoBarcodes(image,setPhotoProgress);
      if(!found.length){setError("Barcode tidak ditemukan pada foto. Coba foto ulang atau lanjutkan input manual.");return;}
      completeExtraction(found);
    }catch{setError("Foto belum dapat dipindai. Coba unggah ulang atau gunakan input manual.");}finally{setProcessing(false);setPhotoProgress(null);}
  }
  function continueManualReview(){stopCamera();setError("");if(!name.trim()){setError("Nama box wajib diisi.");return;}if(scanStage==="box"){setStep(2);setCameraMessage("Scan barcode Box No atau isi nomor box, lalu konfirmasi sebelum melanjutkan ke SN.");return;}setRows([{id:"manual-1",mac:"",serial:""}]);setCodes([]);setStep(3);}
  const updateRow=(id:string,field:"mac"|"serial",value:string)=>{setError("");setRows(current=>current.map(row=>row.id===id?{...row,[field]:field==="mac"?value.replace(/[^\da-f]/gi,"").slice(0,12).toUpperCase():value.replace(/\D/g,"").slice(0,12)}:row));};
  const deviceConflicts=findDeviceConflicts(rows,loadBoxes());
  const macConflictRows=new Set(deviceConflicts.filter(conflict=>conflict.field==="mac").flatMap(conflict=>conflict.rows));
  const serialConflictRows=new Set(deviceConflicts.filter(conflict=>conflict.field==="serial").flatMap(conflict=>conflict.rows));
  const rowErrors=rows.map((row,index)=>({mac:!validMac(row.mac)||macConflictRows.has(index+1),serial:!validSerial(row.serial)||serialConflictRows.has(index+1)}));
  const duplicateNumber=!!number&&loadBoxes().some(box=>box.number===number.trim());
  const canConfirm=scanStage==="serial"&&rows.length>0&&/^\d{8,30}$/.test(number.trim())&&!duplicateNumber&&rows.every(row=>validMac(row.mac)&&validSerial(row.serial))&&!deviceConflicts.length;
  function addRow(){setRows(current=>[...current,{id:`r-${Math.random().toString(36).slice(2,9)}`,mac:"",serial:""}]);}
  function confirm(){const existing=loadBoxes();const latestConflicts=findDeviceConflicts(rows,existing);if(latestConflicts.length){setError(latestConflicts.map(deviceConflictMessage).join(" "));return;}if(existing.some(box=>box.number===number.trim())){setError("Nomor box ini sudah tercatat. Koreksi nomor hasil ekstraksi.");return;}if(!canConfirm){setError(duplicateNumber?"Nomor box ini sudah tercatat. Koreksi nomor hasil ekstraksi.":!/^\d{8,30}$/.test(number.trim())?"Nomor box hasil ekstraksi harus berisi 8–30 digit angka.":"Lengkapi MAC 12 karakter dan SN 12 digit sebelum menyimpan.");return;}const now=new Date();const box:BoxRecord={id:`box-${now.getTime()}`,name:name.trim(),number:number.trim(),model,date:new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(now),status:"confirmed",devices:rows.map((row,index)=>({id:String(index+1),mac:row.mac.toUpperCase(),serial:row.serial}))};try{localStorage.setItem(key,JSON.stringify([box,...existing]));}catch{setError("Penyimpanan browser penuh. Hapus beberapa foto/data uji lalu coba lagi.");return;}setStep(4);}
  const steps=["Identitas box","Scan barcode","Periksa data","Selesai"];
  return <div className="workflow-page"><Link href="/" className="back-link"><ArrowLeft size={15}/> Kembali ke ringkasan</Link><div className="workflow-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> PEMINDAIAN BARU</div><h1>Catat box baru</h1><p>Ikuti beberapa langkah untuk mencatat perangkat ke inventaris.</p></div><span className="secure-note"><LockKeyhole size={14}/> Sesi aman</span></div>
    <div className="stepper" aria-label="Progres pemindaian">{steps.map((label,index)=><div key={label} className={`stepper-item ${step===index+1?"step-active":""} ${step>index+1?"step-done":""}`}><span className="step-circle">{step>index+1?<Check size={14}/>:`0${index+1}`}</span><span>{label}</span>{index<steps.length-1&&<span className="step-line"/>}</div>)}</div>
    {step===1&&<section className="workflow-card"><div className="workflow-card-header"><span className="step-index">01</span><div><h2>Identitas box</h2><p>Masukkan informasi dasar yang tertera pada kardus.</p></div></div><div className="form-grid"><label className="field"><span>Nama box <b>*</b></span><input value={name} onChange={e=>setName(e.target.value)} maxLength={40} placeholder="Contoh: BOX 1"/><small>Nama singkat untuk identifikasi box.</small></label><label className="field field-wide"><span>Model device <b>*</b></span><div className="select-wrap"><select value={model} onChange={e=>setModel(e.target.value as Model)}>{models.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select><ChevronDown size={16}/></div><small>Pilih model sesuai perangkat yang labelnya akan dipindai.</small></label></div><div className="form-note"><span className="note-info">i</span><p>Nomor box akan dibaca dari foto label dan dapat diperiksa atau dikoreksi sebelum disimpan.</p></div>{error&&<div className="form-error" role="alert"><CircleAlert size={16}/>{error}</div>}<div className="workflow-actions"><span><b>*</b> Wajib diisi</span><button className="btn btn-quiet" onClick={continueManualReview}>Input manual</button><button className="btn btn-primary" onClick={()=>void openCamera()}>Buka kamera & scan <Camera size={16}/></button></div></section>}
    {step===2&&<section className="workflow-card camera-workflow"><div className="workflow-card-header"><span className="step-index">02</span><div><h2>{scanStage==="box"?"1. Scan barcode Box No":"2. Scan barcode Serial Number"}</h2><p>{scanStage==="box"?"Scan nomor box terlebih dahulu, lalu konfirmasi untuk melanjutkan.":"Nomor box sudah dikonfirmasi. Scan barcode SN perangkat di dalam box ini."}</p></div></div>
      <div className="box-context"><span className="box-mini-icon"><Package size={16}/></span><span><b>{name}</b><small>{model.replace("ROUTER OUTDOOR ","")}</small></span><button className="context-edit" onClick={()=>{stopCamera();setStep(1)}}>Ubah detail</button></div>
      <div className="form-note"><span className="note-info">{scanStage==="box"?"1":"2"}</span><p><b>1. Barcode Box No {scanStage==="serial"?"✓":""} → 2. Barcode Serial Number</b></p></div>
      {scanStage==="box"?<div className="form-grid" style={{marginBlock:16}}><label className="field field-wide"><span>Nomor box hasil scan</span><input aria-label="Nomor box tahap pertama" inputMode="numeric" value={number} onChange={event=>{setNumber(event.target.value.replace(/\D/g,"").slice(0,30));setError("");}} placeholder="Scan barcode Box No atau isi manual"/></label>{boxCandidates.length>1&&<div className="field field-wide">{boxCandidates.map(candidate=><button key={candidate} className="btn btn-secondary" onClick={()=>{setNumber(candidate);setError("");}}>{candidate}</button>)}</div>}<button className="btn btn-primary" disabled={!number} onClick={confirmBoxNumber}>Konfirmasi Box No & lanjut scan SN <ArrowRight size={16}/></button></div>:<div className="box-context"><span><b>Box No: {number}</b><small>Scan SN untuk box ini</small></span><button className="context-edit" onClick={rescanBox}>Scan ulang Box No</button></div>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={onFile}/>
      {cameraActive?<div className="camera-stage"><video ref={videoRef} autoPlay playsInline muted aria-label="Tampilan kamera untuk memindai barcode"/><div className="camera-frame" aria-hidden="true"><i/><i/><i/><i/></div><div className="camera-hud"><span className="camera-live-dot"/>KAMERA AKTIF</div><div className="camera-count">{codes.length} barcode terbaca</div></div>:photo?<div className="photo-preview"><img src={photo} alt={`Pratinjau label untuk ${name}`}/><div className="photo-info"><FileImage size={17}/><span><b>{photoName}</b><small>Foto siap dipindai</small></span><button className="icon-btn" aria-label="Hapus foto" onClick={()=>{setPhoto(null);setPhotoName("")}}><Trash2 size={17}/></button></div></div>:<div className={`upload-drop ${drag?"upload-drag":""}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}><div className="upload-symbol"><ScanLine size={24}/></div><h3>Kamera siap untuk scan barcode</h3><p>Gunakan kamera perangkat atau unggah foto label. Foto tegak lurus, pastikan seluruh barcode dan area putih di tepinya terlihat jelas.</p><div className="upload-buttons"><button className="btn btn-secondary" onClick={()=>void openCamera()}><Camera size={16}/> Mulai kamera</button><button className="btn btn-quiet" onClick={()=>inputRef.current?.click()}><ImagePlus size={16}/> Pilih foto</button></div><span className="upload-format">JPG, PNG, WebP · Maksimal 10 MB</span></div>}
      {cameraMessage&&<div className="camera-message" role="status"><CameraOff size={17}/><span>{cameraMessage}</span>{!cameraActive&&<button className="btn btn-small btn-secondary" onClick={()=>void openCamera()}>Coba kamera lagi</button>}</div>}
      {codes.length>0&&<div className="barcode-detections"><div><b>Barcode terbaca</b><span>{codes.length} nilai ditemukan · hasil akan dikelompokkan untuk pemeriksaan</span></div><ul>{codes.map((code,index)=><li key={`${code.format}-${code.rawValue}-${index}`}><span>{code.format.replaceAll("_"," ")}</span><code>{code.rawValue}</code></li>)}</ul></div>}
      {error&&<div className="form-error" role="alert"><CircleAlert size={16}/>{error}</div>}
      <div className="form-note"><span className="note-info">i</span><p>Scan barcode berjalan di browser ini. Pastikan setiap barcode berada di dalam bingkai dan tahan kamera tetap stabil.</p></div>
      <div className="workflow-actions"><button className="btn btn-quiet" onClick={()=>{stopCamera();setStep(1);setError("")}}><ArrowLeft size={15}/> Kembali</button>{cameraActive?<><button className="btn btn-quiet" onClick={()=>inputRef.current?.click()}><ImagePlus size={15}/> Pakai foto</button><button className="btn btn-primary" onClick={finishCameraScan}><Check size={16}/> {scanStage==="box"?"Baca Box No":"Selesai & periksa SN"}</button></>:photo?<><button className="btn btn-quiet" onClick={continueManualReview}>Input manual</button><button className="btn btn-primary" onClick={()=>void scanUploadedPhoto()}><ScanLine size={16}/> {scanStage==="box"?"Baca Box No dari foto":"Baca Serial Number dari foto"}</button></>:<><button className="btn btn-quiet" onClick={continueManualReview}>Input manual</button><button className="btn btn-secondary" onClick={()=>inputRef.current?.click()}><ImagePlus size={16}/> Unggah foto label</button></>}</div>
    </section>}
    {processing&&<div className="processing-overlay" role="status" aria-live="polite"><div className="processing-card"><span className="processing-spinner"><LoaderCircle size={27}/></span><h2>Menganalisis barcode…</h2><p>{photoProgress?`Memeriksa area ${photoProgress.completed} dari ${photoProgress.total} · ${photoProgress.found} barcode ditemukan`:"Menyusun nomor box, MAC, dan serial number yang terbaca."}</p><span className="processing-caption"><Sparkles size={13}/> Data berasal dari barcode label</span></div></div>}
    {step===3&&<section className="workflow-card review-card"><div className="workflow-card-header"><span className="step-index">03</span><div><h2>Periksa hasil pemindaian</h2><p>Periksa ulang pasangan MAC dan nomor seri sebelum menyimpan.</p></div></div><div className="review-banner"><span className="review-banner-icon"><Sparkles size={16}/></span><p><b>{codes.length?"Barcode berhasil dibaca":"Input data hasil scan"}</b><span>{codes.length?`${codes.length} barcode terbaca. Pastikan nomor box dan pasangan MAC/SN sesuai label.`:"Barcode belum menyediakan semua field. Isi atau koreksi nilai yang masih kosong sebelum menyimpan."}</span></p><span className="confidence-pill"><CheckCircle2 size={13}/> Perlu konfirmasi</span></div>{codes.length>0&&<div className="review-detections"><b>Nilai barcode sumber</b><div>{codes.map((code,index)=><code key={`${code.format}-${code.rawValue}-${index}`}>{code.rawValue}</code>)}</div></div>}<div className="review-summary"><span><small>NAMA BOX</small><b>{name}</b></span><label className="extracted-number"><small>NOMOR BOX · HASIL BACA LABEL</small><input aria-label="Nomor box hasil baca label" readOnly inputMode="numeric" value={number} onChange={e=>setNumber(e.target.value.replace(/\D/g,"").slice(0,30))} className={`mono-text ${duplicateNumber||!/^\d{8,30}$/.test(number)?"extracted-number-invalid":""}`}/>{duplicateNumber&&<em>Nomor box sudah tercatat.</em>}</label><span><small>MODEL DEVICE</small><b>{model.replace("ROUTER OUTDOOR ","")}</b></span><span><small>JUMLAH UNIT</small><b>{rows.length} unit</b></span></div><div className="review-table-heading"><div><h3>Data perangkat</h3><span>{rows.length} baris ditemukan</span></div><button className="btn btn-small btn-secondary" onClick={addRow}><ImagePlus size={14}/> Tambah baris</button></div><div className="table-scroll review-table-wrap"><table className="data-table review-table"><thead><tr><th>NO.</th><th>MAC ADDRESS</th><th>SERIAL NUMBER (SN)</th><th>STATUS</th><th/></tr></thead><tbody>{rows.map((row,index)=><tr key={row.id}><td className="row-index">{String(index+1).padStart(2,"0")}</td><td><input className={`cell-input ${rowErrors[index]?.mac?"cell-invalid":""}`} aria-label={`MAC perangkat ${index+1}`} aria-invalid={rowErrors[index]?.mac} aria-describedby={macConflictRows.has(index+1)?"device-conflicts":undefined} value={row.mac} onChange={e=>updateRow(row.id,"mac",e.target.value)} placeholder="12 digit heksadesimal"/></td><td><input className={`cell-input serial-input ${rowErrors[index]?.serial?"cell-invalid":""}`} aria-label={`Serial perangkat ${index+1}`} aria-invalid={rowErrors[index]?.serial} aria-describedby={serialConflictRows.has(index+1)?"device-conflicts":undefined} value={row.serial} onChange={e=>updateRow(row.id,"serial",e.target.value)} placeholder="12 digit angka"/></td><td><span className={rowErrors[index]?.mac||rowErrors[index]?.serial?"status-pill status-review":"status-pill status-success"}><span/>{macConflictRows.has(index+1)&&serialConflictRows.has(index+1)?"Data duplikat":macConflictRows.has(index+1)?"MAC duplikat":serialConflictRows.has(index+1)?"SN duplikat":rowErrors[index]?.mac||rowErrors[index]?.serial?"Periksa":"Terbaca"}</span></td><td><button className="row-menu" aria-label={`Hapus perangkat ${index+1}`} onClick={()=>{setError("");setRows(current=>current.filter(item=>item.id!==row.id));}}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>{deviceConflicts.length>0&&<div id="device-conflicts" className="form-error" role="alert"><CircleAlert size={16}/><div>{deviceConflicts.map(conflict=><p key={`${conflict.field}-${conflict.value}`} style={{margin:"0 0 6px"}}>{deviceConflictMessage(conflict)}</p>)}</div></div>}{error&&!deviceConflicts.length&&<div className="form-error" role="alert"><CircleAlert size={16}/>{error}</div>}<div className="review-footnote"><span><ShieldCheck size={15}/> Data baru tersimpan setelah dikonfirmasi.</span><button className="btn btn-quiet" onClick={()=>{setStep(2);setError("")}}><RotateCcw size={14}/> Scan ulang</button></div><div className="workflow-actions"><button className="btn btn-quiet" onClick={()=>setStep(2)}><ArrowLeft size={15}/> Kembali</button><button className="btn btn-primary" onClick={confirm}><Check size={16}/> Konfirmasi & simpan</button></div></section>}
    {step===4&&<section className="workflow-card success-card"><span className="success-symbol"><CheckCircle2 size={31}/></span><div className="success-eyebrow">BOX BERHASIL DISIMPAN</div><h2>Inventaris sudah diperbarui.</h2><p>Data perangkat untuk <b>{name}</b> sudah tersimpan dan siap masuk ke laporan.</p><div className="success-summary"><span><small>NOMOR BOX</small><b className="mono-text">{number}</b></span><span><small>MODEL</small><b>{model.replace("ROUTER OUTDOOR ","")}</b></span><span><small>PERANGKAT</small><b>{rows.length} unit</b></span></div><div className="success-actions"><button className="btn btn-secondary" onClick={()=>router.push("/export")}><FileImage size={15}/> Pratinjau ekspor</button><button className="btn btn-primary" onClick={resetForNext}><CirclePlus size={16}/> Tambah box lain</button></div><Link href="/" className="success-back">Kembali ke ringkasan <ArrowRight size={14}/></Link></section>}
    <div className="workflow-trust"><span><ShieldCheck size={14}/> Data terlindungi di workspace</span><span>Butuh bantuan? <a href="mailto:admin@warehouse.local">Hubungi admin</a></span></div>
  </div>;
}
